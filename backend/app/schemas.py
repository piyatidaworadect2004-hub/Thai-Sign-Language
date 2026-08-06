from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserLoginRequest(BaseModel):
    username: str
    password: str

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    role: str
    created_at: Optional[datetime] = None   # ★ เพิ่ม: ใช้คำนวณ "ผู้ใช้ใหม่" ใน Dashboard

    model_config = ConfigDict(from_attributes=True)


# --- Lesson Schemas ---
# ★ ย้ายมาไว้ก่อน CategoryOut เพราะ CategoryOut ต้อง reference LessonOut
class LessonBase(BaseModel):
    category_id: int
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    is_active: bool = False   # ★ เพิ่ม: ใช้บอก frontend ว่าคำนี้ฝึกได้จริงหรือยัง

class LessonCreate(LessonBase):
    pass

class LessonOut(LessonBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Category Schemas ---
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    total_words: Optional[int] = 0
    level: Optional[str] = "ง่าย"   # เปลี่ยนจาก difficulty -> level
    image: Optional[str] = ""
    # ลบ color ออก

class CategoryOut(CategoryBase):
    id: int
    lessons: List[LessonOut] = []          # ★ เพิ่ม: รายการคำศัพท์ในหมวดนี้
    progress: int = 0                       # ★ เพิ่ม: completion_percentage ของ user ที่ login อยู่ (0 ถ้ายังไม่ login/ยังไม่ฝึก)

    model_config = ConfigDict(from_attributes=True)


# --- Quiz Schemas ---
class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None

class QuizOut(QuizBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- PracticeLog Schemas ---
class PracticeLogCreate(BaseModel):
    word_id: int
    word_name: str
    correctness_percentage: int

class PracticeLogOut(PracticeLogCreate):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- UserProgress Schemas ---
class UserProgressBase(BaseModel):
    category_id: int
    completion_percentage: int = 0
    correctness_percentage: int = 0

class UserProgressOut(UserProgressBase):
    id: int
    user_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)