"""
batch_build_ground_truth_from_raw.py
======================================
เดินลุยทั้งโฟลเดอร์ raw/{คำศัพท์}/{ไฟล์วิดีโอ}.mp4 แล้วสร้าง Ground Truth
ใช้ LandmarkExtractor ตัวเดียวกัน (IMAGE mode) ซ้ำตลอดทั้งรัน แทนที่จะสร้างใหม่ทุกไฟล์วิดีโอ
"""

import argparse
import json
import os

import numpy as np

from ground_truth_builder import (
    LandmarkExtractor,
    process_video,
    build_ground_truth,
)


def find_word_folders(raw_dir: str):
    entries = []
    for name in sorted(os.listdir(raw_dir)):
        full_path = os.path.join(raw_dir, name)
        if os.path.isdir(full_path):
            entries.append((name, full_path))
    return entries


def find_video_files(folder: str):
    files = []
    for name in sorted(os.listdir(folder)):
        if name.lower().endswith(".mp4"):
            files.append(os.path.join(folder, name))
    return files


def build_word_ground_truth(
    label: str,
    video_folder: str,
    extractor: LandmarkExtractor,
    out_dir: str,
):
    video_files = find_video_files(video_folder)

    if not video_files:
        print(f"[skip] '{label}' ไม่มีไฟล์วิดีโอในโฟลเดอร์ {video_folder}")
        return

    feature_matrices = []
    raw_pose_matrices = []
    raw_hand_left_matrices = []
    raw_hand_right_matrices = []
    frames_per_sample = []
    source_files = []
    skipped = []

    for i, video_path in enumerate(video_files):
        print(f"  [{i + 1}/{len(video_files)}] {os.path.basename(video_path)}", end=" ... ")
        try:
            frame_records = process_video(video_path, extractor)
            if len(frame_records) == 0:
                print("ไม่พบเฟรม (ข้าม)")
                skipped.append(os.path.basename(video_path))
                continue
            gt = build_ground_truth(label, frame_records)
            feature_matrices.append(gt["feature_matrix"])
            raw_pose_matrices.append(gt["raw_pose_sequence"])
            raw_hand_left_matrices.append(gt["raw_hand_left_sequence"])
            raw_hand_right_matrices.append(gt["raw_hand_right_sequence"])
            frames_per_sample.append(gt["num_frames"])
            source_files.append(os.path.basename(video_path))
            print(f"สำเร็จ ({gt['num_frames']} เฟรม)")
        except Exception as e:
            print(f"ERROR: {e}")
            skipped.append(os.path.basename(video_path))

    if not feature_matrices:
        print(f"[skip] '{label}' ไม่มี Sample ที่ประมวลผลสำเร็จเลย")
        return

    os.makedirs(out_dir, exist_ok=True)
    npz_path = os.path.join(out_dir, f"{label}.npz")

    # เก็บ raw_pose/raw_hand สำรองไว้ต่อ sample (ไม่ใช่แค่ feature_matrices ที่คำนวณแล้ว)
    # เพื่อให้ถ้าอนาคตเปลี่ยนสูตร compute_features() สามารถคำนวณ feature ใหม่จากพิกัดดิบนี้ได้เลย
    # โดยไม่ต้องมีไฟล์วิดีโอต้นฉบับอยู่แล้ว (ลบวิดีโอทิ้งได้อย่างสบายใจ)
    np.savez_compressed(
        npz_path,
        feature_matrices=np.array(feature_matrices, dtype=object),
        raw_pose=np.array(raw_pose_matrices, dtype=object),
        raw_hand_left=np.array(raw_hand_left_matrices, dtype=object),
        raw_hand_right=np.array(raw_hand_right_matrices, dtype=object),
        num_samples=len(feature_matrices),
    )

    meta_path = os.path.join(out_dir, f"{label}.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "label": label,
                "num_samples": len(feature_matrices),
                "source_files": source_files,
                "frames_per_sample": frames_per_sample,
                "skipped_files": skipped,
                "feature_dim": int(feature_matrices[0].shape[1]),
                "feature_type": "pose+hand direction & global spatial (WorldLandmarks, 36-dim)",
                # ตัวเลข feature_matrices เต็มรูปแบบ (list ต่อ sample ต่อเฟรม ต่อมิติ)
                # เก็บไว้เพื่อเปิดดู/ตรวจสอบด้วยตา หรือส่งไฟล์นี้ไปให้ระบบ/AI อื่นใช้ต่อได้โดยไม่ต้องพึ่ง numpy
                # ตัวที่ backend ใช้เทียบท่าจริงยังคงเป็น .npz (โหลดเร็วกว่า) ไม่เกี่ยวกับส่วนนี้
                "feature_matrices": [m.tolist() for m in feature_matrices],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"[saved] {npz_path}  ({len(feature_matrices)} samples, dim={feature_matrices[0].shape[1]})")
    if skipped:
        print(f"  [warning] ข้ามไป {len(skipped)} ไฟล์: {skipped}")


def main(raw_dir: str, out_dir: str, pose_model_path: str, hand_model_path: str):
    word_folders = find_word_folders(raw_dir)
    if not word_folders:
        raise FileNotFoundError(f"ไม่พบโฟลเดอร์คำศัพท์ย่อยใน {raw_dir}")

    print(f"พบ {len(word_folders)} คำศัพท์: {[w for w, _ in word_folders]}")

    extractor = LandmarkExtractor(pose_model_path, hand_model_path)
    try:
        for label, folder in word_folders:
            print(f"\n=== กำลังประมวลผลคำ: {label} ===")
            build_word_ground_truth(label, folder, extractor, out_dir)
    finally:
        extractor.close()

    print("\nเสร็จสิ้น Batch Processing ทั้งหมด")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="สร้าง Ground Truth ให้ครบทุกคำจากโฟลเดอร์ raw/{คำ}/*.mp4")
    parser.add_argument("--raw_dir", required=True)
    parser.add_argument("--out", default="gt_data")
    parser.add_argument("--pose-model", default="pose_landmarker.task")
    parser.add_argument("--hand-model", default="hand_landmarker.task")
    args = parser.parse_args()

    main(args.raw_dir, args.out, args.pose_model, args.hand_model)