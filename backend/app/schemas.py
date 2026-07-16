# app/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional

# โครงสร้างพื้นฐานของ User
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "user"

# รูปแบบข้อมูลเมื่อสมัครสมาชิก (ต้องรับ password)
class UserCreate(UserBase):
    password: str

# รูปแบบข้อมูลเมื่อส่งออกไป (ไม่ส่ง password กลับไป)
class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True

# รูปแบบการตอบกลับเมื่อ Login สำเร็จ (ได้ JWT Token)
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None