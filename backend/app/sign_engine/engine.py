"""
sign_engine/engine.py
=======================
รวม Logic ทั้งหมดสำหรับตรวจสอบท่าภาษามือไว้ในไฟล์เดียว
"""

import os
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSE_MODEL_PATH = os.path.join(BASE_DIR, "pose_landmarker.task")
HAND_MODEL_PATH = os.path.join(BASE_DIR, "hand_landmarker.task")
GT_DATA_DIR = os.path.join(BASE_DIR, "gt_data")

POSE_NOSE = 0
POSE_LEFT_WRIST = 15
POSE_RIGHT_WRIST = 16
HAND_WRIST = 0
HAND_FINGERTIPS = [4, 8, 12, 16, 20]


def l2_normalize(v: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    norm = np.linalg.norm(v)
    if norm < eps:
        return np.zeros_like(v)
    return v / norm


def safe_get(landmarks: Optional[np.ndarray], idx: int) -> np.ndarray:
    if landmarks is None:
        return np.zeros(3, dtype=np.float32)
    return landmarks[idx]


class LandmarkExtractor:
    def __init__(self, pose_model_path: str = POSE_MODEL_PATH, hand_model_path: str = HAND_MODEL_PATH):
        with open(pose_model_path, "rb") as f:
            pose_model_bytes = f.read()
        with open(hand_model_path, "rb") as f:
            hand_model_bytes = f.read()

        pose_options = mp_vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_buffer=pose_model_bytes),
            running_mode=mp_vision.RunningMode.IMAGE,
            num_poses=1,
        )
        hand_options = mp_vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_buffer=hand_model_bytes),
            running_mode=mp_vision.RunningMode.IMAGE,
            num_hands=2,
        )
        self.pose_landmarker = mp_vision.PoseLandmarker.create_from_options(pose_options)
        self.hand_landmarker = mp_vision.HandLandmarker.create_from_options(hand_options)

    def extract(self, frame_rgb: np.ndarray, timestamp_ms: int):
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        pose_result = self.pose_landmarker.detect(mp_image)
        hand_result = self.hand_landmarker.detect(mp_image)

        pose_world = None
        if pose_result.pose_world_landmarks:
            lm = pose_result.pose_world_landmarks[0]
            pose_world = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)

        hand_left_world = None
        hand_right_world = None
        if hand_result.hand_world_landmarks:
            for lm, handedness in zip(hand_result.hand_world_landmarks, hand_result.handedness):
                coords = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)
                label = handedness[0].category_name
                if label == "Left":
                    hand_left_world = coords
                else:
                    hand_right_world = coords

        return pose_world, hand_left_world, hand_right_world

    def close(self):
        self.pose_landmarker.close()
        self.hand_landmarker.close()


def compute_features(pose_world, hand_left_world, hand_right_world) -> np.ndarray:
    feature_parts = []
    nose = safe_get(pose_world, POSE_NOSE)

    for hand_lm in (hand_left_world, hand_right_world):
        wrist = safe_get(hand_lm, HAND_WRIST)
        for tip_idx in HAND_FINGERTIPS:
            tip = safe_get(hand_lm, tip_idx)
            feature_parts.append(l2_normalize(tip - wrist))

    pose_left_wrist = safe_get(pose_world, POSE_LEFT_WRIST)
    pose_right_wrist = safe_get(pose_world, POSE_RIGHT_WRIST)
    feature_parts.append(l2_normalize(pose_left_wrist - nose))
    feature_parts.append(l2_normalize(pose_right_wrist - nose))

    return np.concatenate(feature_parts, axis=0).astype(np.float32)


def extract_feature_matrix_from_video(
    video_path: str, extractor: LandmarkExtractor, frame_skip: int = 2
) -> np.ndarray:
    """
    frame_skip=2 หมายถึงประมวลผลแค่ 1 ใน 2 เฟรม (ข้ามเฟรมคี่) เพื่อลดจำนวนครั้งที่ต้องเรียก
    MediaPipe ต่อวิดีโอ (~100ms/เฟรม) ลงครึ่งหนึ่ง โดยไม่กระทบผลลัพธ์มาก เพราะ DTW ออกแบบมา
    รองรับสองลำดับที่มีจำนวนเฟรม/ความเร็วต่างกันอยู่แล้ว
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"ไม่สามารถเปิดไฟล์วิดีโอ: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    feature_list = []
    frame_idx = 0

    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        if frame_idx % frame_skip != 0:
            frame_idx += 1
            continue
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        timestamp_ms = int((frame_idx / fps) * 1000)
        pose_world, hand_left_world, hand_right_world = extractor.extract(frame_rgb, timestamp_ms)
        feature_list.append(compute_features(pose_world, hand_left_world, hand_right_world))
        frame_idx += 1

    cap.release()
    if not feature_list:
        raise ValueError("ไม่พบเฟรมในวิดีโอ")
    return np.stack(feature_list, axis=0)


def cosine_distance_matrix(V: np.ndarray, U: np.ndarray) -> np.ndarray:
    V_norm = V / (np.linalg.norm(V, axis=1, keepdims=True) + 1e-8)
    U_norm = U / (np.linalg.norm(U, axis=1, keepdims=True) + 1e-8)
    return 1.0 - (V_norm @ U_norm.T)


def dtw_distance(cost_matrix: np.ndarray) -> float:
    """
    เติมค่า DTW cost matrix ทีละเส้นทแยงมุม (anti-diagonal) แทนทีละเซลล์
    เซลล์บนเส้นทแยงมุมเดียวกันไม่ขึ้นกับกันเอง (ขึ้นกับ 2 เส้นทแยงมุมก่อนหน้าเท่านั้น)
    จึงคำนวณพร้อมกันด้วย numpy ได้ทั้งเส้น ผลลัพธ์เหมือนเดิมทุกประการ แค่เร็วกว่า pure-Python loop
    """
    N, M = cost_matrix.shape
    D = np.full((N + 1, M + 1), np.inf)
    D[0, 0] = 0.0

    for k in range(2, N + M + 1):
        i_min = max(1, k - M)
        i_max = min(N, k - 1)
        if i_min > i_max:
            continue
        i_arr = np.arange(i_min, i_max + 1)
        j_arr = k - i_arr

        up = D[i_arr - 1, j_arr]
        left = D[i_arr, j_arr - 1]
        diag = D[i_arr - 1, j_arr - 1]
        min_prev = np.minimum(np.minimum(up, left), diag)

        D[i_arr, j_arr] = cost_matrix[i_arr - 1, j_arr - 1] + min_prev

    return float(D[N, M])


def compare_sequences(user_matrix: np.ndarray, gt_matrix: np.ndarray) -> float:
    N, M = user_matrix.shape[0], gt_matrix.shape[0]
    cost_matrix = cosine_distance_matrix(user_matrix, gt_matrix)
    total_cost = dtw_distance(cost_matrix)
    return total_cost / (N + M)


_gt_cache: dict = {}


def load_ground_truth_matrices(word: str) -> np.ndarray:
    """
    แคชไว้ในหน่วยความจำหลังโหลดครั้งแรก (gt_data ไม่เปลี่ยนระหว่างที่ server รันอยู่)
    กันไม่ให้ต้องอ่านไฟล์ .npz จากดิสก์ซ้ำทุกครั้ง โดยเฉพาะตอนถูกเรียกถี่ๆ จาก /predict (real-time)
    """
    if word not in _gt_cache:
        npz_path = os.path.join(GT_DATA_DIR, f"{word}.npz")
        if not os.path.exists(npz_path):
            raise FileNotFoundError(f"ไม่พบ Ground Truth ของคำว่า '{word}'")
        data = np.load(npz_path, allow_pickle=True)
        _gt_cache[word] = data["feature_matrices"]
    return _gt_cache[word]


def save_ground_truth_sample(word: str, feature_matrix: np.ndarray) -> int:
    """
    เพิ่ม feature_matrix (จากวิดีโอตัวอย่าง 1 คลิป) เข้า gt_data/{word}.npz
    ถ้าคำนี้มี Ground Truth อยู่แล้วจะสะสมเป็นตัวอย่างที่ 2, 3, ... ไม่ทับของเดิม
    (รูปแบบไฟล์เดียวกับ ground_truth_pipeline/ground_truth_builder.py เพื่อให้ compare_to_word อ่านได้ตรงๆ)
    คืนค่าจำนวนตัวอย่างทั้งหมดของคำนี้หลังบันทึก
    """
    os.makedirs(GT_DATA_DIR, exist_ok=True)
    npz_path = os.path.join(GT_DATA_DIR, f"{word}.npz")

    existing_matrices = []
    if os.path.exists(npz_path):
        old_data = np.load(npz_path, allow_pickle=True)
        if "feature_matrices" in old_data:
            existing_matrices = list(old_data["feature_matrices"])

    feature_matrices = existing_matrices + [feature_matrix]
    np.savez_compressed(
        npz_path,
        feature_matrices=np.array(feature_matrices, dtype=object),
    )

    _gt_cache.pop(word, None)  # เคลียร์ cache กันอ่านของเก่าซ้ำในคำขอถัดไป
    return len(feature_matrices)


def compare_to_word(user_feature_matrix: np.ndarray, word: str, threshold: float = 0.15) -> dict:
    feature_matrices = load_ground_truth_matrices(word)

    scores = []
    for gt_matrix in feature_matrices:
        score = compare_sequences(user_feature_matrix, gt_matrix.astype(np.float32))
        scores.append(score)

    best_score = min(scores)
    best_idx = int(np.argmin(scores))
    is_pass = best_score <= threshold

    return {
        "word": word,
        "best_score": round(float(best_score), 4),
        "best_sample_index": best_idx,
        "is_pass": bool(is_pass),
        "threshold": threshold,
        "all_scores": [round(float(s), 4) for s in scores],
    }