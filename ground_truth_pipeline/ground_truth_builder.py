"""
ground_truth_builder.py
========================
สร้างและจัดเก็บ Ground Truth สำหรับระบบตรวจสอบท่าภาษามือ (ASL/ThSL)

แนวคิดหลัก:
    ต่อ 1 เฟรม เก็บทั้ง 2 อย่างคู่กันในระเบียนเดียว
        1) Raw WorldLandmarks (x, y, z) จาก PoseLandmarker + HandLandmarker
        2) Pre-computed Features (Joint Angles + Direction Vectors)
    เพื่อให้ตอน Real-time Inference ดึง Feature ไปเทียบกับ DTW ได้ทันที
    โดยไม่ต้องคำนวณซ้ำ แต่ยังมี Raw เก็บสำรองไว้ ถ้าอนาคตต้องเปลี่ยนสูตร Feature
    จะได้ไม่ต้องอัดวิดีโอ/รัน MediaPipe ใหม่

ต้องเตรียมไฟล์โมเดล MediaPipe Tasks ก่อนใช้งาน (ดาวน์โหลดครั้งเดียว):
    pose_landmarker.task
        https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
    hand_landmarker.task
        https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

การใช้งาน:
    python ground_truth_builder.py --video hello.mp4 --label hello --out gt_data/
"""

import argparse
import json
import os
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision


# ----------------------------------------------------------------------------
# 0. ค่าคงที่ / Index ของจุดสำคัญ
# ----------------------------------------------------------------------------

# Pose landmark indices (MediaPipe Pose: 33 จุด)
POSE_NOSE = 0
POSE_LEFT_SHOULDER = 11
POSE_RIGHT_SHOULDER = 12
POSE_LEFT_ELBOW = 13
POSE_RIGHT_ELBOW = 14
POSE_LEFT_WRIST = 15
POSE_RIGHT_WRIST = 16

# Hand landmark indices (MediaPipe Hand: 21 จุด ต่อมือ)
HAND_WRIST = 0
HAND_FINGERTIPS = [4, 8, 12, 16, 20]  # โป้ง, ชี้, กลาง, นาง, ก้อย

NUM_POSE_LANDMARKS = 33
NUM_HAND_LANDMARKS = 21


# ----------------------------------------------------------------------------
# 1. โครงสร้างข้อมูลต่อ 1 เฟรม
# ----------------------------------------------------------------------------

@dataclass
class FrameRecord:
    """ระเบียนข้อมูล 1 เฟรม เก็บทั้ง Raw และ Feature คู่กัน"""
    frame_index: int
    # --- Raw WorldLandmarks ---
    pose_world: np.ndarray            # shape (33, 3) หรือ None ถ้าตรวจไม่เจอ
    hand_left_world: Optional[np.ndarray]   # shape (21, 3) หรือ None
    hand_right_world: Optional[np.ndarray]  # shape (21, 3) หรือ None
    # --- Pre-computed Features ---
    feature_vector: np.ndarray        # shape (D,) สำหรับป้อนเข้า DTW โดยตรง
    joint_angles: dict = field(default_factory=dict)  # อ่านง่าย / debug


# ----------------------------------------------------------------------------
# 2. Utility functions ทางคณิตศาสตร์
# ----------------------------------------------------------------------------

def l2_normalize(v: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    """ทำ Unit Normalization ให้เวกเตอร์มีขนาด = 1 (เก็บเฉพาะทิศทาง)"""
    norm = np.linalg.norm(v)
    if norm < eps:
        return np.zeros_like(v)
    return v / norm


def angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    """หามุมระหว่างเวกเตอร์ 2 เส้น (องศา) ด้วย Dot Product"""
    v1n, v2n = l2_normalize(v1), l2_normalize(v2)
    cos_theta = np.clip(np.dot(v1n, v2n), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_theta)))


def safe_get(landmarks: Optional[np.ndarray], idx: int) -> np.ndarray:
    """ดึงจุดพิกัด ถ้าไม่มีข้อมูล (None) คืนค่า zero-vector แทน"""
    if landmarks is None:
        return np.zeros(3, dtype=np.float32)
    return landmarks[idx]


# ----------------------------------------------------------------------------
# 3. Step 2: สกัดพิกัด 3 มิติจาก MediaPipe (Landmark Inference)
# ----------------------------------------------------------------------------

class LandmarkExtractor:
    """ห่อ PoseLandmarker + HandLandmarker ของ MediaPipe ให้เรียกใช้ง่าย"""

    def __init__(self, pose_model_path: str, hand_model_path: str):
        pose_options = mp_vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=pose_model_path),
            running_mode=mp_vision.RunningMode.VIDEO,
            num_poses=1,
        )
        hand_options = mp_vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=hand_model_path),
            running_mode=mp_vision.RunningMode.VIDEO,
            num_hands=2,
        )
        self.pose_landmarker = mp_vision.PoseLandmarker.create_from_options(pose_options)
        self.hand_landmarker = mp_vision.HandLandmarker.create_from_options(hand_options)

    def extract(self, frame_rgb: np.ndarray, timestamp_ms: int):
        """
        Input : เฟรมภาพ RGB (H, W, 3), timestamp เป็น ms (ต้องเรียงเพิ่มขึ้นเรื่อยๆ)
        Output: (pose_world, hand_left_world, hand_right_world)
                 แต่ละตัวเป็น np.ndarray หรือ None ถ้าตรวจไม่เจอ
        """
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        pose_result = self.pose_landmarker.detect_for_video(mp_image, timestamp_ms)
        hand_result = self.hand_landmarker.detect_for_video(mp_image, timestamp_ms)

        # --- Pose WorldLandmarks ---
        pose_world = None
        if pose_result.pose_world_landmarks:
            lm = pose_result.pose_world_landmarks[0]
            pose_world = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)

        # --- Hand WorldLandmarks (แยกซ้าย/ขวาตาม handedness) ---
        hand_left_world = None
        hand_right_world = None
        if hand_result.hand_world_landmarks:
            for lm, handedness in zip(hand_result.hand_world_landmarks, hand_result.handedness):
                coords = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)
                label = handedness[0].category_name  # "Left" หรือ "Right"
                if label == "Left":
                    hand_left_world = coords
                else:
                    hand_right_world = coords

        return pose_world, hand_left_world, hand_right_world

    def close(self):
        self.pose_landmarker.close()
        self.hand_landmarker.close()


# ----------------------------------------------------------------------------
# 4. Step 3: คำนวณ Pre-computed Features (Joint Angles + Direction Vectors)
# ----------------------------------------------------------------------------

def compute_features(
    pose_world: Optional[np.ndarray],
    hand_left_world: Optional[np.ndarray],
    hand_right_world: Optional[np.ndarray],
):
    """
    Input : Raw WorldLandmarks ของ 1 เฟรม (pose / hand ซ้าย / hand ขวา)
    Output: (feature_vector: np.ndarray, joint_angles: dict)

    feature_vector ประกอบด้วย (เรียงลำดับตายตัว เพื่อให้ทุกเฟรม/ทุกคำมีมิติเท่ากัน):
        - Local Hand Features : เวกเตอร์ wrist -> fingertip (5 นิ้ว x 2 มือ = 10 เวกเตอร์ x 3 แกน = 30 มิติ)
        - Global Spatial Features : เวกเตอร์ nose -> wrist (ซ้าย/ขวา = 2 เวกเตอร์ x 3 แกน = 6 มิติ)
        รวม D = 36 มิติ
    """
    feature_parts = []
    joint_angles = {}

    nose = safe_get(pose_world, POSE_NOSE)

    # --- Local Hand Features: wrist -> fingertips (ต่อมือ) ---
    for side_name, hand_lm in (("left", hand_left_world), ("right", hand_right_world)):
        wrist = safe_get(hand_lm, HAND_WRIST)
        for tip_idx in HAND_FINGERTIPS:
            tip = safe_get(hand_lm, tip_idx)
            vec = l2_normalize(tip - wrist)
            feature_parts.append(vec)

    # --- Global Spatial Features: nose -> wrist (ซ้าย/ขวา จาก Pose) ---
    pose_left_wrist = safe_get(pose_world, POSE_LEFT_WRIST)
    pose_right_wrist = safe_get(pose_world, POSE_RIGHT_WRIST)

    vec_left = l2_normalize(pose_left_wrist - nose)
    vec_right = l2_normalize(pose_right_wrist - nose)
    feature_parts.append(vec_left)
    feature_parts.append(vec_right)

    joint_angles["wrist_to_nose_left"] = vec_left.tolist()
    joint_angles["wrist_to_nose_right"] = vec_right.tolist()

    # --- Joint Angle เพิ่มเติมสำหรับ Debug: มุมข้อศอก (ไหล่-ศอก-ข้อมือ) ---
    for side, (shoulder_idx, elbow_idx, wrist_idx) in {
        "left": (POSE_LEFT_SHOULDER, POSE_LEFT_ELBOW, POSE_LEFT_WRIST),
        "right": (POSE_RIGHT_SHOULDER, POSE_RIGHT_ELBOW, POSE_RIGHT_WRIST),
    }.items():
        shoulder = safe_get(pose_world, shoulder_idx)
        elbow = safe_get(pose_world, elbow_idx)
        wrist = safe_get(pose_world, wrist_idx)
        v1 = shoulder - elbow
        v2 = wrist - elbow
        joint_angles[f"elbow_{side}_deg"] = angle_between(v1, v2)

    feature_vector = np.concatenate(feature_parts, axis=0).astype(np.float32)  # shape (D,)
    return feature_vector, joint_angles


# ----------------------------------------------------------------------------
# 5. Step 1+2+3 รวมกัน: ประมวลผลวิดีโอทั้งไฟล์ -> List[FrameRecord]
# ----------------------------------------------------------------------------

def process_video(
    video_path: str,
    extractor: LandmarkExtractor,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
) -> list:
    """
    Input : path วิดีโอต้นแบบ, ช่วงเฟรมที่มีความหมาย (ตัดส่วนก่อน/หลังท่าทางออก)
    Output: List[FrameRecord] ความยาว M (จำนวนเฟรมที่ใช้จริง)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"ไม่พบไฟล์วิดีโอ: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FRAME_COUNT) and cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_records = []
    frame_idx = 0

    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        if frame_idx < start_frame:
            frame_idx += 1
            continue
        if end_frame is not None and frame_idx > end_frame:
            break

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        timestamp_ms = int((frame_idx / fps) * 1000)

        pose_world, hand_left_world, hand_right_world = extractor.extract(frame_rgb, timestamp_ms)
        feature_vector, joint_angles = compute_features(pose_world, hand_left_world, hand_right_world)

        frame_records.append(
            FrameRecord(
                frame_index=frame_idx,
                pose_world=pose_world,
                hand_left_world=hand_left_world,
                hand_right_world=hand_right_world,
                feature_vector=feature_vector,
                joint_angles=joint_angles,
            )
        )
        frame_idx += 1

    cap.release()
    return frame_records


# ----------------------------------------------------------------------------
# 6. Step 4: Matrix Stacking — รวม FrameRecord ทั้งหมดเป็น Ground Truth เดียว
# ----------------------------------------------------------------------------

def build_ground_truth(label: str, frame_records: list) -> dict:
    """
    Input : label ของคำศัพท์ + List[FrameRecord] จาก process_video()
    Output: dict พร้อม Feature Matrix (ใช้จริงตอน DTW) + Raw sequences (สำรอง)
    """
    M = len(frame_records)
    if M == 0:
        raise ValueError(f"ไม่มีเฟรมสำหรับคำว่า '{label}' — ตรวจสอบวิดีโอ/ช่วง start-end")

    feature_matrix = np.stack([r.feature_vector for r in frame_records], axis=0)  # (M, D)

    # Raw sequences: แทน None ด้วย NaN เพื่อรักษาความ "ตรวจไม่เจอ" ไว้ (แยกจาก 0,0,0 จริงๆ)
    def stack_raw(getter, num_points):
        arr = np.full((M, num_points, 3), np.nan, dtype=np.float32)
        for i, r in enumerate(frame_records):
            val = getter(r)
            if val is not None:
                arr[i] = val
        return arr

    raw_pose = stack_raw(lambda r: r.pose_world, NUM_POSE_LANDMARKS)
    raw_hand_left = stack_raw(lambda r: r.hand_left_world, NUM_HAND_LANDMARKS)
    raw_hand_right = stack_raw(lambda r: r.hand_right_world, NUM_HAND_LANDMARKS)

    joint_angles_seq = [r.joint_angles for r in frame_records]

    return {
        "label": label,
        "num_frames": M,
        "feature_dim": feature_matrix.shape[1],
        "feature_matrix": feature_matrix,        # (M, D) — ใช้ตรงกับ DTW ทันที
        "raw_pose_sequence": raw_pose,            # (M, 33, 3)
        "raw_hand_left_sequence": raw_hand_left,  # (M, 21, 3)
        "raw_hand_right_sequence": raw_hand_right,# (M, 21, 3)
        "joint_angles_sequence": joint_angles_seq,  # เก็บไว้ debug (list of dict)
    }


# ----------------------------------------------------------------------------
# 7. Step 5: การจัดเก็บ (Serialization)
# ----------------------------------------------------------------------------

def save_ground_truth(gt: dict, out_dir: str):
    """
    บันทึกเป็น 2 ไฟล์ต่อ 1 คำศัพท์:
        {label}.npz   -> array ตัวเลขทั้งหมด (feature_matrix, raw_*) โหลดเร็ว ใช้จริงตอน inference
        {label}.json  -> metadata + joint_angles_sequence อ่านง่าย ใช้ debug
    """
    os.makedirs(out_dir, exist_ok=True)
    label = gt["label"]

    npz_path = os.path.join(out_dir, f"{label}.npz")
    np.savez_compressed(
        npz_path,
        feature_matrix=gt["feature_matrix"],
        raw_pose=gt["raw_pose_sequence"],
        raw_hand_left=gt["raw_hand_left_sequence"],
        raw_hand_right=gt["raw_hand_right_sequence"],
    )

    json_path = os.path.join(out_dir, f"{label}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "label": gt["label"],
                "num_frames": gt["num_frames"],
                "feature_dim": gt["feature_dim"],
                "joint_angles_sequence": gt["joint_angles_sequence"],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"[saved] {npz_path}  ({gt['num_frames']} frames, dim={gt['feature_dim']})")
    print(f"[saved] {json_path}")


def load_ground_truth(label: str, gt_dir: str) -> dict:
    """โหลด Ground Truth กลับมาใช้ตอน Inference (ใช้ feature_matrix เป็นหลัก)"""
    npz_path = os.path.join(gt_dir, f"{label}.npz")
    data = np.load(npz_path)
    return {
        "label": label,
        "feature_matrix": data["feature_matrix"],       # (M, D) — ป้อนเข้า DTW ได้ทันที
        "raw_pose_sequence": data["raw_pose"],           # สำรองไว้ debug/re-compute
        "raw_hand_left_sequence": data["raw_hand_left"],
        "raw_hand_right_sequence": data["raw_hand_right"],
    }


# ----------------------------------------------------------------------------
# 8. Main: รวมทุกขั้นตอนเป็น Pipeline เดียว
# ----------------------------------------------------------------------------

def build_and_save_ground_truth(
    video_path: str,
    label: str,
    out_dir: str,
    pose_model_path: str,
    hand_model_path: str,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
):
    extractor = LandmarkExtractor(pose_model_path, hand_model_path)
    try:
        frame_records = process_video(video_path, extractor, start_frame, end_frame)
        gt = build_ground_truth(label, frame_records)
        save_ground_truth(gt, out_dir)
    finally:
        extractor.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="สร้าง Ground Truth สำหรับคำศัพท์ ASL 1 คำ จากวิดีโอต้นแบบ")
    parser.add_argument("--video", required=True, help="path วิดีโอต้นแบบ เช่น hello.mp4")
    parser.add_argument("--label", required=True, help="ชื่อคำศัพท์ เช่น hello")
    parser.add_argument("--out", default="gt_data", help="โฟลเดอร์ปลายทางสำหรับเก็บ .npz/.json")
    parser.add_argument("--pose-model", default="pose_landmarker.task")
    parser.add_argument("--hand-model", default="hand_landmarker.task")
    parser.add_argument("--start-frame", type=int, default=0)
    parser.add_argument("--end-frame", type=int, default=None)
    args = parser.parse_args()

    build_and_save_ground_truth(
        video_path=args.video,
        label=args.label,
        out_dir=args.out,
        pose_model_path=args.pose_model,
        hand_model_path=args.hand_model,
        start_frame=args.start_frame,
        end_frame=args.end_frame,
    )