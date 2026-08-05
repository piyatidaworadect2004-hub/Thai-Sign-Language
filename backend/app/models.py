from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    
    password_hash = Column(String, nullable=False)
    
    full_name = Column(String, nullable=True)
    role = Column(String, default="user")

    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
    practice_logs = relationship("PracticeLog", back_populates="user", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "category"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    level = Column(String, nullable=True)   # เปลี่ยนจาก difficulty -> level
    image = Column(String, nullable=True)
    total_words = Column(Integer, default=0)
    # ลบ color ออก เพราะ DB ไม่มีคอลัมน์นี้

    lessons = relationship("Lesson", back_populates="category", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="category")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("category.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    video_url = Column(String, nullable=True)

    category = relationship("Category", back_populates="lessons")

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("category.id"), nullable=False)
    completion_percentage = Column(Integer, default=0)
    correctness_percentage = Column(Integer, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint('user_id', 'category_id', name='unique_user_category'),)

    user = relationship("User", back_populates="progress")
    category = relationship("Category", back_populates="progress")

class PracticeLog(Base):
    __tablename__ = "practice_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(String, nullable=True)
    target_word = Column(String(100), nullable=False)
    predicted_word = Column(String(100), nullable=True)
    correctness_percentage = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="practice_logs")