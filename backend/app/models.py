from typing import Optional
from sqlmodel import SQLModel, Field

# ==========================
# Category
# ==========================
class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    difficulty: str
    total_words: int
    image: str


# ==========================
# User
# ==========================
# 💡 ปรับปรุงคลาส User ใหม่ให้ใช้ SQLModel เพียงตัวเดียว และมีฟิลด์ครบถ้วนตรงกับ Database จริง!
class User(SQLModel, table=True):
    __tablename__ = "users" # กำหนดชื่อตารางให้ตรงกับใน PostgreSQL

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, nullable=False)
    email: str = Field(index=True, unique=True, nullable=False)
    password_hash: str = Field(nullable=False)
    full_name: Optional[str] = Field(default=None, nullable=True) # 💡 เพิ่มฟิลด์นี้เข้ามาใน SQLModel
    role: str = Field(default="user", nullable=False)             # 💡 มีฟิลด์ role ตามฐานข้อมูลจริง