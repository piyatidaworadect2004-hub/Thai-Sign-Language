from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Lesson
from app.schemas import LessonBase, LessonOut

router = APIRouter(prefix="/lessons", tags=["Lessons"])

@router.get("/", response_model=List[LessonOut])
def get_lessons(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).all()
    return lessons

# 🟢 เพิ่ม Endpoint นี้: ดึงรายการบทเรียนทั้งหมดตามหมวดหมู่ (Category ID)
@router.get("/category/{category_id}", response_model=List[LessonOut])
def get_lessons_by_category(category_id: int, db: Session = Depends(get_db)):
    lessons = db.query(Lesson).filter(Lesson.category_id == category_id).all()
    # ส่งคืนเป็น List (หากไม่พบบทเรียนในหมวดหมู่นี้ จะคืนค่า [] ซึ่งดีกว่าคืนค่า 404 เพื่อให้ UI ไม่พัง)
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
    # 🟢 ใช้ **lesson_in.model_dump() เพื่อให้โค้ดสั้นลงและยืดหยุ่นกว่า
    new_lesson = Lesson(**lesson_in.model_dump())
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson