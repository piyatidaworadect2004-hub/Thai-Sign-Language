from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth
from pydantic import BaseModel
import random



Base.metadata.create_all(bind=engine)

app = FastAPI(title="My Backend Service")

# จัดการเรื่อง CORS หากต้องเชื่อมต่อกับ React หน้าบ้าน
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # ในงานจริงระบุเป็นที่อยู่หน้าบ้าน เช่น ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

# ----------------------------
# ข้อมูลหมวดหมู่
# ----------------------------

categories = [
    {
        "id": 1,
        "name": "คำทักทาย",
        "total_words": 20,
        "difficulty": "ง่าย",
        "progress": 30,
        "image": "👋",
        "color": "bg-blue-400"
    },
    {
        "id": 2,
        "name": "ครอบครัว",
        "total_words": 15,
        "difficulty": "ปานกลาง",
        "progress": 50,
        "image": "👨‍👩‍👧",
        "color": "bg-green-400"
    },
    {
        "id": 3,
        "name": "อาหาร",
        "total_words": 25,
        "difficulty": "ง่าย",
        "progress": 20,
        "image": "🍜",
        "color": "bg-orange-400"
    }
]

# ----------------------------
# ข้อมูลคำศัพท์
# ----------------------------

words = [
    {
        "id": 1,
        "category_id": 1,
        "word": "สวัสดี",
        "meaning": "Hello",
        "image": "👋"
    },
    {
        "id": 2,
        "category_id": 1,
        "word": "ขอบคุณ",
        "meaning": "Thank you",
        "image": "🙏"
    },
    {
        "id": 3,
        "category_id": 1,
        "word": "ลาก่อน",
        "meaning": "Goodbye",
        "image": "👋"
    },
    {
        "id": 4,
        "category_id": 2,
        "word": "พ่อ",
        "meaning": "Father",
        "image": "👨"
    },
    {
        "id": 5,
        "category_id": 2,
        "word": "แม่",
        "meaning": "Mother",
        "image": "👩"
    },
    {
        "id": 6,
        "category_id": 2,
        "word": "ลูก",
        "meaning": "Child",
        "image": "👧"
    },
    {
        "id": 7,
        "category_id": 3,
        "word": "ข้าว",
        "meaning": "Rice",
        "image": "🍚"
    },
    {
        "id": 8,
        "category_id": 3,
        "word": "น้ำ",
        "meaning": "Water",
        "image": "💧"
    },
    {
        "id": 9,
        "category_id": 3,
        "word": "อาหาร",
        "meaning": "Food",
        "image": "🍜"
    }
]


@app.get("/")
def home():
    return {"message": "API is running"}


@app.get("/categories")
def get_categories():
    return categories


@app.get("/categories/{category_id}/words")
def get_words(category_id: int):
    return [
        word
        for word in words
        if word["category_id"] == category_id
    ]


# ===========================
# Predict API
# ===========================

class PredictRequest(BaseModel):
    landmarks: list[float]


@app.post("/predict")
def predict(data: PredictRequest):

    print("ได้รับข้อมูล Landmark :", len(data.landmarks))

    labels = [
        "สวัสดี",
        "ขอบคุณ",
        "ลาก่อน",
        "พ่อ",
        "แม่",
        "ลูก",
        "ข้าว",
        "น้ำ",
        "อาหาร"
    ]

    return {
        "word": random.choice(labels),
        "confidence": round(random.uniform(0.85, 0.99), 2)
    }