from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import func


class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    difficulty: str
    total_words: int
    image: str


class User(SQLModel, table=True):
    __tablename__ = "users" 

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, nullable=False)
    email: str = Field(index=True, unique=True, nullable=False)
    password_hash: str = Field(nullable=False)
    full_name: Optional[str] = Field(default=None, nullable=True) 
    role: str = Field(default="user", nullable=False)


class UserProgress(SQLModel, table=True):
    __tablename__ = "user_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", nullable=False)
    category_id: int = Field(nullable=False)
    completion_percentage: int = Field(default=0)
    correctness_percentage: int = Field(default=0)
    
    # ดึงฟังก์ชันเวลาปัจจุบันมาใส่ให้อัตโนมัติเวลาเซฟข้อมูลและอัปเดตคะแนน
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()}
    )


# 🟢 เพิ่มตารางบันทึก Log การซ้อมทำท่าภาษามือลง PostgreSQL
class PracticeLog(SQLModel, table=True):
    __tablename__ = "practice_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", nullable=False)
    lesson_id: str = Field(nullable=False)
    target_word: str = Field(nullable=False)             # โจทย์ เช่น "สวัสดี"
    predicted_word: str = Field(nullable=False)          # คำที่ AI/ระบบทำนายได้
    correctness_percentage: float = Field(default=0.0)   # % ความถูกต้องของท่าทาง
    confidence: float = Field(default=0.0)              # ค่าความมั่นใจของโมเดล
    is_correct: bool = Field(default=False)             # ทำถูกต้องตามโจทย์ไหม
    
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now()}
    )