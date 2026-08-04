from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import PracticeLog
from app.schemas import PracticeLogCreate, PracticeLogOut  # 🟢 Import PracticeLogOut

router = APIRouter(prefix="/practice", tags=["Practice"])

# 🟢 แก้ไข response_model เป็น PracticeLogOut
@router.post("/log", response_model=PracticeLogOut, status_code=status.HTTP_201_CREATED)
def create_practice_log(log_in: PracticeLogCreate, db: Session = Depends(get_db)):
    new_log = PracticeLog(
        user_id=1,  # Mock user_id หรือดึงจาก current_user
        lesson_id=log_in.lesson_id,
        sign_label=log_in.sign_label,
        accuracy=log_in.accuracy,
        is_correct=log_in.is_correct
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.get("/logs", response_model=List[PracticeLogOut])
def get_practice_logs(db: Session = Depends(get_db)):
    logs = db.query(PracticeLog).all()
    return logs