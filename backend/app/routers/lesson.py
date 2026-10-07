import html
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid

import cv2
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Lesson, User
from app.schemas import LessonBase, LessonOut
from app.routers.auth import require_admin

router = APIRouter(prefix="/lessons", tags=["Lessons"])

# ★ เพิ่มใหม่: อัปโหลดวิดีโอตัวอย่างจากเครื่อง แทนการวางลิงก์ตรงๆ
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploaded_videos")
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"}
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB


@router.post("/upload-video")
async def upload_lesson_video(
    file: UploadFile = File(...),
    current_admin: User = Depends(require_admin),
):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="รองรับเฉพาะไฟล์วิดีโอ (mp4, webm, mov, avi)",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 100MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".mp4"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(content)

    # ★ URL เต็มไปเลย (ไม่ใช่ path สัมพัทธ์) เพราะไฟล์นี้ถูก serve จาก backend (:8000)
    # ไม่ใช่ frontend (:5173) — video_url ที่เก็บใน DB ต้องเปิดได้ตรงๆ ไม่ว่าจะมาจากหน้าไหน
    return {"video_url": f"http://127.0.0.1:8000/uploaded-videos/{filename}"}

class VideoUrlIn(BaseModel):
    url: str


def _to_direct_download_url(url: str) -> str:
    """แปลงลิงก์แชร์ที่เปิดเป็นหน้าเว็บ (Google Drive / Dropbox) ให้เป็นลิงก์ดาวน์โหลดไฟล์ตรง"""
    drive_id = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:.*&)?id=)([\w-]+)", url)
    if drive_id:
        return f"https://drive.usercontent.google.com/download?id={drive_id.group(1)}&export=download&confirm=t"
    if "dropbox.com" in url:
        parts = urllib.parse.urlsplit(url)
        query = urllib.parse.parse_qs(parts.query)
        query["dl"] = ["1"]
        return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query, doseq=True)))
    return url


def _open_url(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        return urllib.request.urlopen(request, timeout=30)
    except (urllib.error.URLError, ValueError, TimeoutError):
        raise HTTPException(status_code=400, detail="เปิดลิงก์นี้ไม่ได้ ตรวจสอบว่าลิงก์ถูกต้องและเปิดเป็นสาธารณะ")


VIDEO_FILE_URL = r"https?://[^\s\"'<>]+?\.(?:mp4|webm|mov|m4v)(?:\?[^\s\"'<>]*)?"


def _find_video_url_in_html(page: str, base_url: str) -> Optional[str]:
    """
    หาลิงก์ไฟล์วิดีโอในหน้าเว็บ เรียงจากแหล่งที่น่าเชื่อถือที่สุด:
    ฟอร์มยืนยันดาวน์โหลดของ Google Drive (ไฟล์ใหญ่) → meta og:video → <video>/<source src> → ลิงก์ .mp4 ใดๆ ในหน้า
    """
    def absolute(link: str) -> str:
        return urllib.parse.urljoin(base_url, html.unescape(link).replace("\\/", "/"))

    form = re.search(r'<form[^>]+id="download-form"[^>]+action="([^"]+)"(.*?)</form>', page, re.S)
    if form:
        fields = dict(re.findall(r'<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"', form.group(2)))
        return absolute(form.group(1)) + "?" + urllib.parse.urlencode(fields)

    for prop in ("og:video:secure_url", "og:video:url", "og:video", "twitter:player:stream"):
        meta = re.search(
            rf'<meta[^>]+(?:property|name)="{re.escape(prop)}"[^>]+content="([^"]+)"'
            rf'|<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="{re.escape(prop)}"',
            page,
        )
        if meta:
            return absolute(meta.group(1) or meta.group(2))

    tag = re.search(r'<(?:video|source)[^>]+src="([^"]+)"', page)
    if tag and not tag.group(1).startswith("blob:"):
        return absolute(tag.group(1))

    link = re.search(VIDEO_FILE_URL, page.replace("\\/", "/"))
    if link:
        return absolute(link.group(0))
    return None


# ★ เพิ่มใหม่: รับ Video URL จากภายนอก — ดาวน์โหลดมาเก็บที่ uploaded_videos/ เหมือนอัปโหลดจากเครื่อง
# ทำไม: ลิงก์ภายนอกมักเป็นหน้าเว็บ (เปิดใน <video> ไม่ได้) หรือหายไปภายหลัง ทำให้หน้าฝึกไม่มีวิดีโอ
# และปุ่มสร้าง Ground Truth ดาวน์โหลดไม่ได้ จึงตรวจให้แน่ว่าเป็นวิดีโอที่ OpenCV อ่านได้ก่อนบันทึก
@router.post("/import-video-url")
def import_lesson_video_url(
    data: VideoUrlIn,
    current_admin: User = Depends(require_admin),
):
    url = data.url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://")
    if url.startswith("http://127.0.0.1:8000/uploaded-videos/"):
        return {"video_url": url}  # เป็นไฟล์ที่เก็บไว้ในเซิร์ฟเวอร์นี้อยู่แล้ว
    if re.search(r"(youtube\.com|youtu\.be|tiktok\.com|facebook\.com)", url, re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="ลิงก์ YouTube / TikTok / Facebook ดาวน์โหลดไฟล์ตรงไม่ได้ กรุณาดาวน์โหลดคลิปแล้วอัปโหลดจากเครื่องแทน",
        )

    tmp_path = None
    try:
        # ลิงก์ที่เปิดออกมาเป็นหน้าเว็บ: หาไฟล์วิดีโอที่ฝังอยู่ในหน้าแล้วตามไปดาวน์โหลด (สูงสุด 3 ทอด)
        current_url = _to_direct_download_url(url)
        for _ in range(3):
            response = _open_url(current_url)
            if not (response.headers.get_content_type() or "").lower().startswith("text/"):
                break
            page = response.read(2 * 1024 * 1024).decode("utf-8", errors="ignore")
            next_url = _find_video_url_in_html(page, response.geturl())
            if not next_url:
                if "drive.google.com" in url or "accounts.google.com" in response.geturl():
                    raise HTTPException(
                        status_code=400,
                        detail="ดาวน์โหลดจาก Google Drive ไม่ได้ ตั้งค่าแชร์ไฟล์เป็น \"ทุกคนที่มีลิงก์\" ก่อน",
                    )
                raise HTTPException(
                    status_code=400,
                    detail="ไม่พบไฟล์วิดีโอในหน้าเว็บนี้ ลองคลิกขวาที่วิดีโอแล้วเลือก \"คัดลอกที่อยู่วิดีโอ\" มาวางแทน",
                )
            current_url = next_url
        else:
            raise HTTPException(status_code=400, detail="ไม่พบไฟล์วิดีโอในหน้าเว็บนี้")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp_path = tmp.name
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_SIZE:
                    raise HTTPException(status_code=400, detail="ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 100MB)")
                tmp.write(chunk)

        cap = cv2.VideoCapture(tmp_path)
        readable = cap.isOpened() and cap.read()[0]
        cap.release()
        if not readable:
            raise HTTPException(status_code=400, detail="ไฟล์จากลิงก์นี้ไม่ใช่วิดีโอที่เปิดได้")

        os.makedirs(UPLOAD_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.mp4"
        os.replace(tmp_path, os.path.join(UPLOAD_DIR, filename))
        tmp_path = None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return {"video_url": f"http://127.0.0.1:8000/uploaded-videos/{filename}"}


@router.get("/", response_model=List[LessonOut])
def get_lessons(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).all()
    return lessons

# 🟢 ดึงรายการบทเรียนทั้งหมดตามหมวดหมู่ (Category ID)
@router.get("/category/{category_id}", response_model=List[LessonOut])
def get_lessons_by_category(category_id: int, db: Session = Depends(get_db)):
    lessons = db.query(Lesson).filter(Lesson.category_id == category_id).all()
    return lessons

@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )
    return lesson

@router.post("/", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(lesson_in: LessonBase, db: Session = Depends(get_db)):
    new_lesson = Lesson(**lesson_in.model_dump())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson


# ★ เพิ่มใหม่: schema สำหรับแก้ไขบางส่วน (ไม่บังคับกรอกทุก field เหมือน create)
# ใช้ตอน toggle is_active อย่างเดียวได้ โดยไม่ต้องส่ง title/description/video_url มาด้วย
class LessonUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None   # ← เพิ่มบรรทัดนี้
    video_url: Optional[str] = None
    is_active: Optional[bool] = None


# ★ เพิ่มใหม่: PUT /lessons/{id} แก้ไขข้อมูลบทเรียน (ใช้สำหรับ toggle is_active ในหน้าแอดมินด้วย)
@router.put("/{lesson_id}", response_model=LessonOut)
def update_lesson(lesson_id: int, lesson_in: LessonUpdate, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )

    # อัปเดตเฉพาะ field ที่ส่งมาจริง (exclude_unset=True) ไม่ทับ field ที่ไม่ได้ส่งมาด้วยค่า None
    update_data = lesson_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lesson, key, value)

    db.commit()
    db.refresh(lesson)
    return lesson


# ★ เพิ่มใหม่: DELETE /lessons/{id} ลบบทเรียน (frontend เรียกอยู่แล้วแต่ backend ไม่มี route นี้มาก่อน)
@router.delete("/{lesson_id}", status_code=status.HTTP_200_OK)
def delete_lesson(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )

    db.delete(lesson)
    db.commit()
    return {"status": "success", "message": f"ลบบทเรียน ID {lesson_id} เรียบร้อยแล้ว"}