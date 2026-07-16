# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOut, Token
from ..services.authen_service import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# 1. สมัครสมาชิก (Register)
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # ตรวจสอบว่า Username หรือ Email ซ้ำไหม
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email already registered"
        )
    
    # ทำการ Hash Password ก่อนเซฟ
    hashed_password = get_password_hash(user_data.password)
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 2. เข้าสู่ระบบ (Login)
@router.post("/login", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), # ใช้ฟอร์มมาตรฐานของ FastAPI
    db: Session = Depends(get_db)
):
    # ค้นหา user จาก database
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # ตรวจสอบว่ามี user หรือรหัสผ่านถูกต้องไหม
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # สร้าง Access Token ส่งกลับไปให้ Client นำไปเก็บไว้ใน LocalStorage/Cookie
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
# 🚨 วางเพิ่มไว้ที่ท้ายไฟล์ app/routers/auth.py 🚨

from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError # ถ้ายังไม่มีให้ pip install python-jose[cryptography]

# บอก FastAPI ว่าจะหา Token จากช่องทาง Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ค้นหาคำสั่ง SECRET_KEY และ ALGORITHM จาก authen_service มาใช้งาน (ปรับชี้ทางให้ถูกตามโปรเจกต์ของคุณ)
from ..services.authen_service import SECRET_KEY, ALGORITHM 

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # ถอดรหัสตั๋ว Token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # เอา username ที่ได้จากตั๋ว ไปค้นหาข้อมูลเต็มๆ ใน PostgreSQL 
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
        
    return user # คืนค่าข้อมูล User (ในนี้จะมี user.id, user.username) ส่งไปให้ main.py ใช้งานต่อ