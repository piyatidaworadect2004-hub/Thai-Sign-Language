from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib

# คีย์ลับสำหรับสร้าง JWT Token
SECRET_KEY = "SUPER_SECRET_KEY_NEVER_SHARE_THIS_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# 💡 เปลี่ยนมาใช้ pbkdf2_sha256 แทน bcrypt เพื่อเลี่ยงบั๊ก library บน Windows
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ฟังก์ชันเข้ารหัส Password ก่อนบันทึก
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# ฟังก์ชันเช็กความถูกต้องของ Password ตอน Login (รองรับทุกกรณีรวมถึง SHA-256 ดั้งเดิม)
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # ลองตรวจสอบด้วย pbkdf2_sha256 ก่อน
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # 💡 Fallback หากรหัสผ่านเดิมใน DB ไม่ใช่ Format ของ pbkdf2_sha256
        
        # กรณีที่ 1: รหัสผ่านตรงกันดั้งเดิม (Plain text)
        if plain_password == hashed_password:
            return True
            
        # กรณีที่ 2: รหัสผ่านเดิมเป็นแบบ SHA-256
        sha256_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
        if sha256_hash == hashed_password:
            return True
            
        # กรณีที่ 3: หากคุณเคยสมัครผ่าน bcrypt ไปก่อนหน้านี้ แล้วตัวตรวจสอบพัง 
        # เราจะไม่ปล่อยให้ระบบแครช แต่จะคืนค่า False เพื่อให้กรอกใหม่แทน
        return False

# ฟังก์ชันสร้าง JWT Token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt