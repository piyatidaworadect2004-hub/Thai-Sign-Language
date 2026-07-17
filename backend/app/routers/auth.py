from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from ..database import get_db
from ..models import User
from ..schemas import UserOut, Token, UserLoginRequest
from ..services.authen_service import (
    get_password_hash, verify_password, create_access_token, 
    SECRET_KEY, ALGORITHM
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ฟังก์ชันดึงผู้ใช้ปัจจุบัน (ย้ายมาไว้ที่นี่เพื่อแก้ปัญหา Import)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None: raise credentials_exception
    return user

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(request: Request, db: Session = Depends(get_db)):
    try:
        try: data = await request.json()
        except: data = dict(await request.form())
        
        if db.query(User).filter((User.username == data.get("username")) | (User.email == data.get("email"))).first():
            raise HTTPException(status_code=400, detail="Username หรือ Email นี้ถูกใช้ไปแล้ว")

        new_user = User(
            username=data.get("username"),
            email=data.get("email"),
            password_hash=get_password_hash(data.get("password")),
            full_name=data.get("full_name", ""),
            role=data.get("role", "user")
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
def login_for_access_token(login_data: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username หรือ Password ไม่ถูกต้อง")
    return {"access_token": create_access_token(data={"sub": user.username}), "token_type": "bearer"}