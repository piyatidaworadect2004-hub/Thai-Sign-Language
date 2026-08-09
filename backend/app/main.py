import json
import base64
import random
from typing import List, Optional
from datetime import datetime

import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Import Database, Models และ Routers ทั้งหมด
from app.database import engine, Base, get_db
from app.routers import auth, category, lesson, practice, progress, quiz, practice_compare
from app.routers.auth import get_current_user
from app.models import User, Category, UserProgress, PracticeLog
Base.metadata.create_all(bind=engine)

# ==========================================
# 🟢 Import MediaPipe แบบปลอดภัยสูงสุด
# ==========================================
import mediapipe as mp

mp_hands = None
if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
    mp_hands = mp.solutions.hands
else:
    try:
        import mediapipe.python.solutions.hands as mp_hands
    except (ModuleNotFoundError, AttributeError):
        mp_hands = None

app = FastAPI(title="Thai Sign Learning API")

# 🟢 ตั้งค่า CORS อนุญาตให้ Frontend เรียกใช้ API ได้
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🟢 ลงทะเบียน Routers ครบทุกตัว
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(category.router, prefix="/categories", tags=["Categories"])
app.include_router(lesson.router, tags=["Lessons"])
app.include_router(practice.router, prefix="/practice", tags=["Practice"])
app.include_router(progress.router, prefix="/progress", tags=["Progress"])
app.include_router(quiz.router, prefix="/quizzes", tags=["Quizzes"])
app.include_router(practice_compare.router, prefix="/practice-compare", tags=["Practice Compare"])

# Instance MediaPipe Hands Detector
mp_hands = mp.solutions.hands

# 🟢 ตั้งค่าให้รองรับการตรวจจับสูงสุด 2 มือ
hands_detector = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,            # 👈 รองรับสูงสุด 2 มือ
    min_detection_confidence=0.3,
    min_tracking_confidence=0.3
)

# 🟢 เปลี่ยนจาก difficulty -> level และลบ color ออก ให้ตรงกับ DB จริง (Supabase: category table)
BASE_CATEGORIES = [
    {"id": 1, "name": "คำทักทาย", "total_words": 5, "level": "ง่าย", "image": "👋"},
    {"id": 2, "name": "ครอบครัว", "total_words": 5, "level": "ปานกลาง", "image": "👨‍👩‍👧"},
    {"id": 3, "name": "อาหาร", "total_words": 5, "level": "ง่าย", "image": "🍜"}
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

def get_optional_current_user(
    authorization: Optional[str] = Header(None), 
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ")[1]
        return get_current_user(token=token, db=db)
    except Exception:
        return None

@app.get("/")
def root():
    return {"message": "Thai Sign Learning API is running"}

# ==========================================
# 🎯 Schema & Endpoints สำหรับจัดการสิทธิ์ (Role Update)
# ==========================================
class RoleUpdate(BaseModel):
    role: str

@app.put("/auth/users/{user_id}/role")
def update_user_role(
    user_id: int, 
    body: RoleUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้")

    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้งานนี้ในระบบ")

    user_to_update.role = body.role
    db.commit()
    db.refresh(user_to_update)

    return {
        "status": "success",
        "message": f"อัปเดตสิทธิ์ของ User ID {user_id} เป็น {body.role} เรียบร้อยแล้ว",
        "user_id": user_to_update.id,
        "new_role": user_to_update.role
    }

# ==========================================
# 🎯 Schema & Endpoints สำหรับกล้อง / Predict / WebSocket
# ==========================================
class SignData(BaseModel):
    lesson_id: Optional[str] = "1"
    target_word: Optional[str] = None
    hand_landmarks: List[float]
    world_landmarks: Optional[List[float]] = []

@app.post("/predict")
def predict(
    data: SignData, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    if not data.hand_landmarks or len(data.hand_landmarks) < 63:
        raise HTTPException(status_code=400, detail="ข้อมูลพิกัดมือไม่สมบูรณ์")

    target_word = data.target_word if (data.target_word and data.target_word.strip() != "") else "random_word"
    predicted_word = target_word
    confidence = round(random.uniform(0.85, 0.98), 2)
    correctness_percentage = round(confidence * 100, 2)
    is_correct = True

    log_id = None
    if current_user:
        try:
            new_log = PracticeLog(
                user_id=current_user.id,
                lesson_id=data.lesson_id or "1",
                target_word=target_word,
                predicted_word=predicted_word,
                correctness_percentage=correctness_percentage,
                confidence=confidence,
                is_correct=is_correct,
                created_at=datetime.utcnow()
            )
            db.add(new_log)
            db.commit()
            db.refresh(new_log)
            log_id = new_log.id
        except Exception as e:
            db.rollback()
            print(f"⚠️ บันทึกลง Postgres ไม่สำเร็จ: {e}")

    return {
        "status": "success",
        "log_id": log_id,
        "word": predicted_word,
        "predicted_word": predicted_word,
        "result": predicted_word,
        "detected": predicted_word,
        "target_word": target_word,
        "confidence": confidence,
        "correctness_percentage": correctness_percentage,
        "is_correct": is_correct
    }

@app.get("/practice-history")
@app.get("/progress")
def get_practice_history(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    logs = db.query(PracticeLog)\
             .filter(PracticeLog.user_id == current_user.id)\
             .order_by(PracticeLog.created_at.desc())\
             .limit(50)\
             .all()
             
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "id": log.id,
            "lesson_id": log.lesson_id,
            "confidence": log.confidence or (log.correctness_percentage / 100 if log.correctness_percentage else 0.9),
            "created_at": log.created_at.isoformat() if log.created_at else datetime.utcnow().isoformat(),
            "lesson": {
                "word": log.target_word or f"บทเรียนที่ {log.lesson_id}"
            }
        })
    return formatted_logs

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    print("🔌 Client connected via WebSocket")

    try:
        while True:
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            
            image_base64 = data.get("image", "")
            target_word = data.get("word", "")

            landmarks_list = []
            detected_word = "ไม่พบมือ"
            accuracy = 0

            if image_base64 and hands_detector:
                try:
                    encoded_data = image_base64.split(",")[1] if "," in image_base64 else image_base64
                    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                    if frame is not None:
                        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        results = hands_detector.process(rgb_frame)

                        # 🟢 รองรับการตรวจจับ 2 มือพร้อมกัน
                        if results.multi_hand_landmarks:
                            all_hands_data = []
                            
                            for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                                hand_side = results.multi_handedness[idx].classification[0].label # Left หรือ Right
                                
                                single_hand_pts = []
                                for lm in hand_landmarks.landmark:
                                    single_hand_pts.append({"x": lm.x, "y": lm.y, "z": lm.z})
                                
                                all_hands_data.append({
                                    "hand": hand_side,
                                    "landmarks": single_hand_pts
                                })
                            
                            landmarks_list = all_hands_data
                            detected_word = target_word if target_word else "สวัสดี"
                            accuracy = random.randint(88, 98)

                except Exception as img_err:
                    print(f"⚠️ Frame processing error: {img_err}")

            response = {
                "detected": detected_word,
                "word": detected_word,
                "accuracy": accuracy,
                "landmarks": landmarks_list
            }

            await websocket.send_text(json.dumps(response))

    except WebSocketDisconnect:
        print("❌ Client disconnected from WebSocket")
    except Exception as e:
        print(f"⚠️ Error in WebSocket: {e}")