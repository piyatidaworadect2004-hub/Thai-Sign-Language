from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, ForeignKey
from app.database import engine, Base, get_db
from app.routers import auth
from pydantic import BaseModel
import random

# 🚀 ตอนนี้เปิดใช้งานบรรทัดนี้ได้แล้ว! เพราะเราสร้างฟังก์ชันไว้ใน auth.py แล้ว
from app.routers.auth import get_current_user 

# โครงสร้างตารางสำหรับเก็บ Progress 
class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, nullable=False)
    progress = Column(Integer, default=0)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="My Backend Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

BASE_CATEGORIES = [
    {"id": 1, "name": "คำทักทาย", "total_words": 20, "difficulty": "ง่าย", "image": "👋", "color": "bg-blue-400"},
    {"id": 2, "name": "ครอบครัว", "total_words": 15, "difficulty": "ปานกลาง", "image": "👨‍👩‍👧", "color": "bg-green-400"},
    {"id": 3, "name": "อาหาร", "total_words": 25, "difficulty": "ง่าย", "image": "🍜", "color": "bg-orange-400"}
]

words = [
    {"id": 1, "category_id": 1, "word": "สวัสดี", "meaning": "Hello", "image": "👋"},
    {"id": 2, "category_id": 1, "word": "ขอบคุณ", "meaning": "Thank you", "image": "🙏"},
    {"id": 3, "category_id": 1, "word": "ลาก่อน", "meaning": "Goodbye", "image": "👋"},
    {"id": 4, "category_id": 2, "word": "พ่อ", "meaning": "Father", "image": "👨"},
    {"id": 5, "category_id": 2, "word": "แม่", "meaning": "Mother", "image": "👩"},
    {"id": 6, "category_id": 2, "word": "ลูก", "meaning": "Child", "image": "👧"},
    {"id": 7, "category_id": 3, "word": "ข้าว", "meaning": "Rice", "image": "🍚"},
    {"id": 8, "category_id": 3, "word": "น้ำ", "meaning": "Water", "image": "💧"},
    {"id": 9, "category_id": 3, "word": "อาหาร", "meaning": "Food", "image": "🍜"}
]

@app.get("/")
def home():
    return {"message": "API is running"}

# 🚀 ทำงานแบบ Multi-user สมบูรณ์แบบ
@app.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user) # ดัก Token สำเร็จแล้ว!
):
    # ดึง id จากคนที่ส่ง Token มา
    user_id = current_user.id
    
    # ดึงคะแนนความก้าวหน้าเฉพาะของคนนี้จาก PostgreSQL
    db_progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).all()
    progress_map = {p.category_id: p.progress for p in db_progress}

    personal_categories = []
    for cat in BASE_CATEGORIES:
        personal_categories.append({
            "id": cat["id"],
            "name": cat["name"],
            "total_words": cat["total_words"],
            "difficulty": cat["difficulty"],
            "progress": progress_map.get(cat["id"], 0), 
            "image": cat["image"],
            "color": cat["color"]
        })

    return personal_categories

@app.get("/categories/{category_id}/words")
def get_words(category_id: int):
    return [word for word in words if word["category_id"] == category_id]

# API อัปเดตความก้าวหน้าแยกรายบุคคล
@app.post("/categories/{category_id}/progress")
def update_progress(
    category_id: int, 
    new_progress: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.id

    progress_record = db.query(UserProgress).filter(
        UserProgress.user_id == user_id, 
        UserProgress.category_id == category_id
    ).first()

    if progress_record:
        progress_record.progress = new_progress
    else:
        progress_record = UserProgress(user_id=user_id, category_id=category_id, progress=new_progress)
        db.add(progress_record)

    db.commit()
    return {"status": "success", "progress": new_progress}

class PredictRequest(BaseModel):
    landmarks: list[float]

@app.post("/predict")
def predict(data: PredictRequest):
    labels = ["สวัสดี", "ขอบคุณ", "ลาก่อน", "พ่อ", "แม่", "ลูก", "ข้าว", "น้ำ", "อาหาร"]
    return {
        "word": random.choice(labels),
        "confidence": round(random.uniform(0.85, 0.99), 2)
    }