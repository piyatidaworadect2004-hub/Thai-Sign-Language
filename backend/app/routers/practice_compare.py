"""
routers/practice_compare.py
=============================
Endpoint สำหรับรับวิดีโอที่ผู้ใช้อัดมา แล้วเปรียบเทียบกับ Ground Truth จริง
ด้วย DTW + Cosine Distance พร้อมบันทึกผลลง PracticeLog (ถ้า Login อยู่)
"""

import os
import tempfile
import threading
import urllib.parse
import urllib.request
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lesson, PracticeLog, User
from app.routers.auth import get_current_user, require_admin
from app.routers.lesson import ALLOWED_VIDEO_TYPES, MAX_UPLOAD_SIZE
from app.sign_engine.engine import (
    LandmarkExtractor,
    extract_feature_matrix_from_video,
    compare_to_word,
    save_ground_truth_sample,
    list_ground_truth_info,
    DEFAULT_THRESHOLD,
    FEATURE_VERSION,
)

router = APIRouter()

# โหลดโมเดล MediaPipe ครั้งเดียวตอน import module นี้ (ตอน server start)
# แล้วใช้ซ้ำทุก request แทนการสร้าง/ปิดใหม่ทุกครั้ง (ตัดเวลาโหลดโมเดลที่ซ้ำซ้อน)
_extractor = LandmarkExtractor()
_extractor_lock = threading.Lock()


def _extract_with_lock(video_path: str):
    """รันใน threadpool (นอก event loop) ล็อกไว้กันสอง request เรียก extractor พร้อมกัน"""
    with _extractor_lock:
        return extract_feature_matrix_from_video(video_path, _extractor)


def _save_practice_log(
    db: Session,
    current_user: User,
    word: str,
    lesson_id: str,
    result: dict,
    correctness_percentage: float,
    confidence: float,
) -> Optional[int]:
    """รันใน threadpool เพราะ db.commit() เป็น network I/O แบบ blocking (sync SQLAlchemy)"""
    try:
        # lesson_id ที่ไม่ตรงกับบทเรียนจริง (ไม่ได้ส่งมา / บทเรียนถูกลบแล้วสร้างใหม่) ทำให้ log หาหมวดไม่เจอ
        # → หาบทเรียนจากชื่อคำแทน (backend ใช้ lesson.title เป็นชื่อคำอยู่แล้ว)
        lesson_exists = lesson_id.isdigit() and db.query(Lesson.id).filter(Lesson.id == int(lesson_id)).first()
        if not lesson_exists:
            by_title = db.query(Lesson.id).filter(Lesson.title == word).first()
            if by_title:
                lesson_id = str(by_title.id)

        new_log = PracticeLog(
            user_id=current_user.id,
            lesson_id=lesson_id,
            target_word=word,
            predicted_word=word if result["is_pass"] else None,
            correctness_percentage=round(correctness_percentage, 2),
            confidence=round(confidence, 4),
            is_correct=result["is_pass"],
            created_at=datetime.utcnow(),
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log.id
    except Exception as e:
        db.rollback()
        print(f"⚠️ บันทึกลง Postgres ไม่สำเร็จ: {e}")
        return None


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ")[1]
        return get_current_user(token=token, db=db)
    except Exception:
        return None


@router.post("/compare")
async def compare_practice_video(
    word: str = Form(...),
    lesson_id: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    suffix = os.path.splitext(file.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        user_feature_matrix = await run_in_threadpool(_extract_with_lock, tmp_path)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="ไฟล์วิดีโอไม่สามารถเปิดได้")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp_path)

    try:
        result = await run_in_threadpool(compare_to_word, user_feature_matrix, word)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # 🔑 CORE: แปลง DTW score (ยิ่งน้อยยิ่งดี, ไม่มีเพดานบน) เป็น % ที่มนุษย์อ่านง่าย
    # ทำไม: เทียบเท่า score=threshold (พอดีเส้นผ่าน) ให้ตกกลางพอดีที่ 50% โดยตั้งเพดาน
    # ไว้ที่ threshold*2 — เลย 2 เท่าของ threshold ไปถือว่าต่างจนไม่มีความหมาย จึงตัดที่ 0%
    max_expected_score = result["threshold"] * 2
    correctness_percentage = max(0.0, 100.0 * (1 - result["best_score"] / max_expected_score))
    confidence = correctness_percentage / 100.0

    log_id = None
    if current_user:
        log_id = await run_in_threadpool(
            _save_practice_log,
            db,
            current_user,
            word,
            lesson_id,
            result,
            correctness_percentage,
            confidence,
        )

    return {
        "status": "success",
        "log_id": log_id,
        "num_user_frames": int(user_feature_matrix.shape[0]),
        "correctness_percentage": round(correctness_percentage, 2),
        "confidence": round(confidence, 4),
        **result,
    }


@router.post("/build-ground-truth/{lesson_id}")
async def build_ground_truth_from_video(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """
    สร้าง Ground Truth ให้คำศัพท์นี้อัตโนมัติ โดยดึงวิดีโอจาก lesson.video_url มาผ่าน
    sign_engine ตัวเดียวกับที่ใช้ตอนฝึกจริง แล้วเปิด is_active ให้เองถ้าสำเร็จ
    (ใช้ extractor ตัวเดียวกับ /compare กันโหลดโมเดล MediaPipe ซ้ำสองชุด)
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบคำศัพท์นี้")
    if not lesson.video_url:
        raise HTTPException(status_code=400, detail="คำนี้ยังไม่มี Video URL ตัวอย่าง กรุณาใส่ก่อน")

    suffix = os.path.splitext(lesson.video_url.split("?")[0])[1] or ".mp4"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        try:
            await run_in_threadpool(urllib.request.urlretrieve, lesson.video_url, tmp_path)
        except Exception:
            raise HTTPException(status_code=400, detail="ดาวน์โหลดวิดีโอจาก video_url ไม่สำเร็จ")

        try:
            feature_matrix = await run_in_threadpool(_extract_with_lock, tmp_path)
        except FileNotFoundError:
            raise HTTPException(status_code=400, detail="ไฟล์วิดีโอไม่สามารถเปิดได้")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    source_name = os.path.basename(urllib.parse.unquote(lesson.video_url.split("?")[0]))
    num_samples = await run_in_threadpool(save_ground_truth_sample, lesson.title, feature_matrix, source_name)

    lesson.is_active = True
    db.commit()

    return {
        "status": "success",
        "word": lesson.title,
        "num_frames": int(feature_matrix.shape[0]),
        "num_samples": num_samples,
        "is_active": lesson.is_active,
    }


MAX_GT_FILES_PER_REQUEST = 10


@router.post("/build-ground-truth/{lesson_id}/upload")
async def build_ground_truth_from_uploads(
    lesson_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """
    สร้าง Ground Truth จากคลิปที่แอดมินอัปโหลด (1 หรือหลายไฟล์) แต่ละคลิปเป็นตัวอย่างใหม่ 1 ตัว
    ไฟล์ที่ล้มเหลวจะถูกข้ามและรายงานใน failed โดยไม่ยกเลิกไฟล์อื่น
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="ไม่พบคำศัพท์นี้")
    if len(files) > MAX_GT_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"อัปโหลดได้ครั้งละไม่เกิน {MAX_GT_FILES_PER_REQUEST} ไฟล์")

    added, failed = [], []
    num_samples = None
    for upload in files:
        name = upload.filename or "video"
        if upload.content_type not in ALLOWED_VIDEO_TYPES:
            failed.append({"file": name, "reason": "ไม่ใช่ไฟล์วิดีโอที่รองรับ (mp4, webm, mov, avi)"})
            continue
        content = await upload.read()
        if len(content) > MAX_UPLOAD_SIZE:
            failed.append({"file": name, "reason": "ไฟล์ใหญ่เกิน 100MB"})
            continue

        suffix = os.path.splitext(name)[1] or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            feature_matrix = await run_in_threadpool(_extract_with_lock, tmp_path)
        except FileNotFoundError:
            failed.append({"file": name, "reason": "เปิดไฟล์วิดีโอไม่ได้"})
            continue
        except ValueError as e:
            failed.append({"file": name, "reason": str(e)})
            continue
        finally:
            os.unlink(tmp_path)

        num_samples = await run_in_threadpool(save_ground_truth_sample, lesson.title, feature_matrix, name)
        added.append({"file": name, "num_frames": int(feature_matrix.shape[0])})

    if added:
        lesson.is_active = True
        db.commit()

    return {
        "word": lesson.title,
        "added": added,
        "failed": failed,
        "num_samples": num_samples,
        "is_active": lesson.is_active,
    }


@router.get("/ground-truth-info")
async def get_ground_truth_info(current_admin: User = Depends(require_admin)):
    """สรุป Ground Truth (pre-computed features) ทุกคำ สำหรับแท็บ Ground Truth ในหน้า Admin"""
    items = await run_in_threadpool(list_ground_truth_info)
    return {
        "threshold": DEFAULT_THRESHOLD,
        "feature_version": FEATURE_VERSION,
        "words": items,
    }