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
from sqlalchemy import cast, Integer
from pydantic import BaseModel

# Import Database, Models และ Routers ทั้งหมด
from app.database import engine, Base, get_db
from app.routers import auth, category, lesson, progress, practice_compare
from app.routers.auth import get_current_user, require_admin
from app.models import User, PracticeLog, LoginLog, Lesson, Category
from app.sign_engine.engine import compute_features, compare_to_word
Base.metadata.create_all(bind=engine)

# ==========================================
# 🟢 ตรวจสอบว่า mp.solutions.hands ใช้งานได้ไหม (บาง build ของ mediapipe ไม่มี solutions API)
# ==========================================
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
app.include_router(progress.router, prefix="/progress", tags=["Progress"])
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

@app.get("/admin/login-logs")
def get_login_logs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    logs = db.query(LoginLog).order_by(LoginLog.login_time.desc()).limit(200).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "email": log.email,
            "login_time": log.login_time.isoformat() if log.login_time else None,
        }
        for log in logs
    ]

# ==========================================
# 🎯 Schema & Endpoints สำหรับกล้อง / Predict / WebSocket
# ==========================================
class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

class FrameLandmarks(BaseModel):
    pose_world: Optional[List[LandmarkPoint]] = None
    hand_left_world: Optional[List[LandmarkPoint]] = None
    hand_right_world: Optional[List[LandmarkPoint]] = None

class RealtimePredictRequest(BaseModel):
    lesson_id: Optional[str] = "1"
    target_word: str
    frames: List[FrameLandmarks]

@app.post("/predict")
def predict(data: RealtimePredictRequest):
    """
    เทียบ buffer เฟรมล่าสุด (sliding window จากฝั่ง frontend) กับ Ground Truth จริงแบบเดียวกับ
    /practice-compare/compare (ใช้ compute_features + compare_to_word ชุดเดียวกัน) แทนของเดิมที่
    สุ่ม confidence มั่วๆ ทุก 500ms
    ไม่บันทึกลง PracticeLog เพราะเป็นแค่ตัวช่วยแสดงผล real-time ระหว่างฝึก ไม่ใช่ผลสรุปการฝึกจริง
    (ผลสรุปจริงมาจาก /practice-compare/compare ตอนกดหยุดอัดเท่านั้น)
    """
    if not data.target_word or not data.frames:
        raise HTTPException(status_code=400, detail="ข้อมูลไม่สมบูรณ์")

    feature_list = []
    for f in data.frames:
        pose_world = (
            np.array([[p.x, p.y, p.z] for p in f.pose_world], dtype=np.float32)
            if f.pose_world else None
        )
        hand_left_world = (
            np.array([[p.x, p.y, p.z] for p in f.hand_left_world], dtype=np.float32)
            if f.hand_left_world else None
        )
        hand_right_world = (
            np.array([[p.x, p.y, p.z] for p in f.hand_right_world], dtype=np.float32)
            if f.hand_right_world else None
        )
        feature_list.append(compute_features(pose_world, hand_left_world, hand_right_world))

    user_feature_matrix = np.stack(feature_list, axis=0)

    try:
        result = compare_to_word(user_feature_matrix, data.target_word)
    except FileNotFoundError:
        return {
            "status": "no_ground_truth",
            "word": data.target_word,
            "predicted_word": None,
            "target_word": data.target_word,
            "confidence": 0.0,
            "correctness_percentage": 0.0,
            "is_correct": False,
        }

    max_expected_score = result["threshold"] * 2
    correctness_percentage = max(0.0, 100.0 * (1 - result["best_score"] / max_expected_score))
    confidence = correctness_percentage / 100.0

    return {
        "status": "success",
        "word": data.target_word if result["is_pass"] else "",
        "predicted_word": data.target_word if result["is_pass"] else None,
        "target_word": data.target_word,
        "confidence": round(confidence, 4),
        "correctness_percentage": round(correctness_percentage, 2),
        "is_correct": result["is_pass"],
        "best_score": result["best_score"],
        "threshold": result["threshold"],
    }

@app.get("/practice-history")
@app.get("/progress")
def get_practice_history(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    rows = (
        db.query(PracticeLog, Category.name.label("category_name"))
        .outerjoin(Lesson, cast(PracticeLog.lesson_id, Integer) == Lesson.id)
        .outerjoin(Category, Lesson.category_id == Category.id)
        .filter(PracticeLog.user_id == current_user.id)
        .order_by(PracticeLog.created_at.desc())
        .limit(50)
        .all()
    )

    formatted_logs = []
    for log, category_name in rows:
        formatted_logs.append({
            "id": log.id,
            "lesson_id": log.lesson_id,
            "confidence": log.confidence or (log.correctness_percentage / 100 if log.correctness_percentage else 0.9),
            "is_correct": bool(log.is_correct),
            "created_at": log.created_at.isoformat() if log.created_at else datetime.utcnow().isoformat(),
            "category_name": category_name,
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