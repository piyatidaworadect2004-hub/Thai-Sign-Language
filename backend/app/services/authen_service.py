from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

# คีย์ลับสำหรับสร้าง JWT Token (ควรย้ายไปไว้ใน .env ในขั้นตอนถัดไป)
SECRET_KEY = "SUPER_SECRET_KEY_NEVER_SHARE_THIS_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ฟังก์ชันเข้ารหัส Password ก่อนบันทึก
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

import hashlib

# ฟังก์ชันเช็กความถูกต้องของ Password ตอน Login
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Fallback if hashed_password in DB is not a valid bcrypt hash
        # Case 1: Already hashed SHA-256 password matches directly
        if plain_password == hashed_password:
            return True
        # Case 2: Plain password matches SHA-256 hash in DB
        sha256_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
        if sha256_hash == hashed_password:
            return True
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