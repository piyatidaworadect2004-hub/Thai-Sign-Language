"""
inference_compare.py
======================
เปรียบเทียบท่าภาษามือที่ผู้ใช้ทำ (จากวิดีโอไฟล์ หรือกล้อง Webcam) กับ Ground Truth
ที่เก็บไว้ใน gt_data/{คำ}.npz โดยใช้ DTW (Dynamic Time Warping) + Cosine Distance
"""

import argparse
import os
import time

import cv2
import numpy as np

from ground_truth_builder import (
    LandmarkExtractor,
    compute_features,
)


def cosine_distance_matrix(V: np.ndarray, U: np.ndarray) -> np.ndarray:
    V_norm = V / (np.linalg.norm(V, axis=1, keepdims=True) + 1e-8)
    U_norm = U / (np.linalg.norm(U, axis=1, keepdims=True) + 1e-8)
    similarity = V_norm @ U_norm.T
    return 1.0 - similarity


def dtw_distance(cost_matrix: np.ndarray) -> float:
    N, M = cost_matrix.shape
    D = np.full((N + 1, M + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, N + 1):
        for j in range(1, M + 1):
            cost = cost_matrix[i - 1, j - 1]
            D[i, j] = cost + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return float(D[N, M])


def compare_sequences(user_matrix: np.ndarray, gt_matrix: np.ndarray) -> dict:
    N, M = user_matrix.shape[0], gt_matrix.shape[0]
    cost_matrix = cosine_distance_matrix(user_matrix, gt_matrix)
    total_cost = dtw_distance(cost_matrix)
    normalized_score = total_cost / (N + M)
    return {
        "total_dtw_cost": total_cost,
        "normalized_score": normalized_score,
        "user_frames": N,
        "gt_frames": M,
    }


def compare_to_word(user_feature_matrix, word, gt_dir, threshold=0.15):
    npz_path = os.path.join(gt_dir, f"{word}.npz")
    if not os.path.exists(npz_path):
        raise FileNotFoundError(f"ไม่พบ Ground Truth ของคำว่า '{word}' ที่ {npz_path}")

    data = np.load(npz_path, allow_pickle=True)
    feature_matrices = data["feature_matrices"]

    all_results = []
    for idx, gt_matrix in enumerate(feature_matrices):
        result = compare_sequences(user_feature_matrix, gt_matrix.astype(np.float32))
        result["sample_index"] = idx
        all_results.append(result)

    best = min(all_results, key=lambda r: r["normalized_score"])
    is_pass = best["normalized_score"] <= threshold

    return {
        "word": word,
        "best_score": best["normalized_score"],
        "best_sample_index": best["sample_index"],
        "is_pass": is_pass,
        "threshold": threshold,
        "all_scores": [r["normalized_score"] for r in all_results],
    }


def extract_user_feature_matrix_from_video(video_path, extractor):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"ไม่พบไฟล์วิดีโอ: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    feature_list = []
    frame_idx = 0

    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        timestamp_ms = int((frame_idx / fps) * 1000)
        pose_world, hand_left_world, hand_right_world = extractor.extract(frame_rgb, timestamp_ms)
        feature_vector, _ = compute_features(pose_world, hand_left_world, hand_right_world)
        feature_list.append(feature_vector)
        frame_idx += 1

    cap.release()
    if not feature_list:
        raise ValueError("ไม่พบเฟรมในวิดีโอที่อัดมา")
    return np.stack(feature_list, axis=0)


def run_webcam_capture(extractor):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("เปิดกล้อง Webcam ไม่สำเร็จ")

    recording = False
    feature_list = []
    start_time = time.time()

    print("กด SPACE เพื่อเริ่ม/หยุดอัด, กด ESC เพื่อออก")

    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        timestamp_ms = int((time.time() - start_time) * 1000)
        pose_world, hand_left_world, hand_right_world = extractor.extract(frame_rgb, timestamp_ms)

        if recording:
            feature_vector, _ = compute_features(pose_world, hand_left_world, hand_right_world)
            feature_list.append(feature_vector)
            cv2.putText(frame_bgr, f"REC... ({len(feature_list)} frames)", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        else:
            cv2.putText(frame_bgr, "Press SPACE to start", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        cv2.imshow("Webcam - Sign Language Practice", frame_bgr)
        key = cv2.waitKey(1) & 0xFF

        if key == 27:
            break
        elif key == 32:
            recording = not recording
            if not recording and feature_list:
                break

    cap.release()
    cv2.destroyAllWindows()

    if not feature_list:
        raise ValueError("ไม่ได้อัดข้อมูลเลย (ไม่ได้กด SPACE หรือกด ESC ก่อนอัด)")
    return np.stack(feature_list, axis=0)


def main():
    parser = argparse.ArgumentParser(description="เปรียบเทียบท่าภาษามือของผู้ใช้กับ Ground Truth")
    parser.add_argument("--word", required=True)
    parser.add_argument("--gt_dir", default="gt_data")
    parser.add_argument("--video", default=None)
    parser.add_argument("--webcam", action="store_true")
    parser.add_argument("--threshold", type=float, default=0.15)
    parser.add_argument("--pose-model", default="pose_landmarker.task")
    parser.add_argument("--hand-model", default="hand_landmarker.task")
    args = parser.parse_args()

    if not args.video and not args.webcam:
        parser.error("ต้องระบุ --video หรือ --webcam อย่างใดอย่างหนึ่ง")

    extractor = LandmarkExtractor(args.pose_model, args.hand_model)
    try:
        if args.webcam:
            user_feature_matrix = run_webcam_capture(extractor)
        else:
            user_feature_matrix = extract_user_feature_matrix_from_video(args.video, extractor)
    finally:
        extractor.close()

    print(f"\nสกัด Feature จากผู้ใช้ได้ {user_feature_matrix.shape[0]} เฟรม")

    result = compare_to_word(user_feature_matrix, args.word, args.gt_dir, args.threshold)

    print("\n" + "=" * 50)
    print(f"คำที่ตรวจสอบ     : {result['word']}")
    print(f"Best DTW Score   : {result['best_score']:.4f}  (threshold = {result['threshold']})")
    print(f"เทียบกับ Sample #: {result['best_sample_index']}")
    print(f"ผลลัพธ์          : {'PASS (ท่าถูกต้อง)' if result['is_pass'] else 'FAIL (ท่ายังไม่ตรง)'}")
    print("=" * 50)
    print(f"คะแนนเทียบกับทุก Sample: {[round(s, 4) for s in result['all_scores']]}")


if __name__ == "__main__":
    main()