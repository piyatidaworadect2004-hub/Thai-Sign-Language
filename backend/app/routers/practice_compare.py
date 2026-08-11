"""
routers/practice_compare.py
=============================
Endpoint สำหรับรับวิดีโอที่ผู้ใช้อัดมา แล้วเปรียบเทียบกับ Ground Truth จริง
ด้วย DTW + Cosine Distance พร้อมบันทึกผลลง PracticeLog (ถ้า Login อยู่)
"""

import os
import tempfile
import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PracticeLog, User
from app.routers.auth import get_current_user
from app.sign_engine.engine import (
    LandmarkExtractor,
    extract_feature_matrix_from_video,
    compare_to_word,
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
    lesson_id: str = Form("1"),
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