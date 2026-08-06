from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Lesson
from app.schemas import LessonBase, LessonOut

router = APIRouter(prefix="/lessons", tags=["Lessons"])

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