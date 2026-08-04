from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Quiz
from app.schemas import QuizBase, QuizOut

# 🟢 กำหนดตัวแปร router ให้ตรงกับที่ main.py เรียกใช้
router = APIRouter(prefix="/quizzes", tags=["Quizzes"])

@router.get("/", response_model=List[QuizOut])
def get_quizzes(db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).all()
    return quizzes

@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Quiz not found"
        )
    return quiz

@router.post("/", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(quiz_in: QuizBase, db: Session = Depends(get_db)):
    new_quiz = Quiz(
        title=quiz_in.title,
        description=quiz_in.description
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    return new_quiz