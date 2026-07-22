from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, ForeignKey, DateTime, func
from app.database import engine, Base, get_db
from app.routers import auth
from pydantic import BaseModel
from typing import List
import random
from datetime import datetime

# Import ตัว User, Category และ UserProgress ที่เป็น SQLModel มาใช้งาน
from sqlmodel import SQLModel, select
from app.models import User, Category, UserProgress
from app.routers.auth import get_current_user

# ==========================================
# สั่งสร้างตารางผ่าน SQLModel
# ==========================================
SQLModel.metadata.create_all(bind=engine) 

app = FastAPI(title="My Backend Service")

# เปิดสิทธิ์ CORS ให้เข้าถึงได้หมด
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

# 🔓 ดึงหมวดหมู่ทั่วไป (ค่าเริ่มต้นเป็น 0)
@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    personal_categories = []
    for cat in BASE_CATEGORIES:
        personal_categories.append({
            "id": cat["id"],
            "name": cat["name"],
            "total_words": cat["total_words"],
            "difficulty": cat["difficulty"],
            "completion_percentage": 0, 
            "correctness_percentage": 0, 
            "image": cat["image"],
            "color": cat["color"]
        })
    return personal_categories

# 🔐 ดึงหมวดหมู่แบบที่คำนวณเปอร์เซ็นต์ความคืบหน้าของ User คนนั้นๆ จาก DB จริง
@app.get("/user-categories")
def get_user_specific_categories(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    personal_categories = []
    
    # ดึง Progress ทั้งหมดของ User คนนี้มาทำเป็น Dictionary เพื่อค้นหาง่ายๆ
    progress_records = db.query(UserProgress).filter(UserProgress.user_id == user_id).all()
    progress_dict = {p.category_id: p for p in progress_records}
    
    for cat in BASE_CATEGORIES:
        # ถ้าเคยบันทึก Progress ไว้ให้เอามาใช้ ถ้าไม่มีให้เป็น 0
        record = progress_dict.get(cat["id"])
        comp_percent = record.completion_percentage if record else 0
        corr_percent = record.correctness_percentage if record else 0
        
        personal_categories.append({
            "id": cat["id"],
            "name": cat["name"],
            "total_words": cat["total_words"],
            "difficulty": cat["difficulty"],
            "completion_percentage": comp_percent, 
            "correctness_percentage": corr_percent, 
            "image": cat["image"],
            "color": cat["color"]
        })
    return personal_categories

@app.get("/categories/{category_id}/words")
def get_words(category_id: int):
    return [word for word in words if word["category_id"] == category_id]

# 📥 API ดูประวัติการเรียน และคำนวณภาพรวมว่า User เรียนไปแล้วกี่เปอร์เซ็นต์ (เฉลี่ยจากทุกหมวดหมู่)
@app.get("/progress/summary")
def get_user_progress_summary(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.id
    records = db.query(UserProgress).filter(UserProgress.user_id == user_id).all()
    
    if not records:
        return {
            "user_id": user_id,
            "overall_completion": 0.0,
            "overall_correctness": 0.0,
            "details": []
        }
        
    total_comp = sum(r.completion_percentage for r in records)
    total_corr = sum(r.correctness_percentage for r in records)
    total_categories = len(BASE_CATEGORIES) # หารเฉลี่ยตามจำนวนหมวดหมู่ทั้งหมดที่มีในระบบ
    
    return {
        "user_id": user_id,
        "overall_completion": round(total_comp / total_categories, 2),
        "overall_correctness": round(total_corr / total_categories, 2),
        "details": [
            {
                "category_id": r.category_id,
                "completion_percentage": r.completion_percentage,
                "correctness_percentage": r.correctness_percentage
            } for r in records
        ]
    }

# 📤 API อัปเดตความก้าวหน้า
@app.post("/categories/{category_id}/progress")
def update_progress(
    category_id: int, 
    completion: int, 
    correctness: int, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.id

    progress_record = db.query(UserProgress).filter(
        UserProgress.user_id == user_id, 
        UserProgress.category_id == category_id
    ).first()

    if progress_record:
        progress_record.completion_percentage = completion
        progress_record.correctness_percentage = correctness
    else:
        progress_record = UserProgress(
            user_id=user_id, 
            category_id=category_id, 
            completion_percentage=completion,
            correctness_percentage=correctness
        )
        db.add(progress_record)

    db.commit()
    return {
        "status": "success", 
        "completion_percentage": completion,
        "correctness_percentage": correctness
    }

# 🤟 ปรับแก้ไขตรงนี้: สร้างแผงรับพิกัดมือให้ตรงกับข้อมูลที่หน้าบ้านส่งมาจริงๆ
class SignData(BaseModel):
    lesson_id: str
    hand_landmarks: List[float]
    world_landmarks: List[float]

@app.post("/predict")
def predict(data: SignData):

    labels = ["สวัสดี", "ขอบคุณ", "ลาก่อน", "พ่อ", "แม่", "ลูก", "ข้าว", "น้ำ", "อาหาร"]
    
    return {
        "word": random.choice(labels),
        "confidence": round(random.uniform(0.85, 0.99), 2)
    }