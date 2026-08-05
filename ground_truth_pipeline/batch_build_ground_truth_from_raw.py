"""
batch_build_ground_truth_from_raw.py (FIXED VERSION)
======================================
เดินลุยทั้งโฟลเดอร์ raw/{คำศัพท์}/{ไฟล์วิดีโอ}.mp4 แล้วสร้าง Ground Truth
สร้าง LandmarkExtractor ใหม่ "ทุกไฟล์วิดีโอ" เพื่อแก้ปัญหา Timestamp
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
    pose_model_path: str,
    hand_model_path: str,
    out_dir: str,
):
    video_files = find_video_files(video_folder)

    if not video_files:
        print(f"[skip] '{label}' ไม่มีไฟล์วิดีโอในโฟลเดอร์ {video_folder}")
        return

    feature_matrices = []
    frames_per_sample = []
    source_files = []
    skipped = []

    for i, video_path in enumerate(video_files):
        print(f"  [{i + 1}/{len(video_files)}] {os.path.basename(video_path)}", end=" ... ")
        extractor = LandmarkExtractor(pose_model_path, hand_model_path)
        try:
            frame_records = process_video(video_path, extractor)
            if len(frame_records) == 0:
                print("ไม่พบเฟรม (ข้าม)")
                skipped.append(os.path.basename(video_path))
                continue
            gt = build_ground_truth(label, frame_records)
            feature_matrices.append(gt["feature_matrix"])
            frames_per_sample.append(gt["num_frames"])
            source_files.append(os.path.basename(video_path))
            print(f"สำเร็จ ({gt['num_frames']} เฟรม)")
        except Exception as e:
            print(f"ERROR: {e}")
            skipped.append(os.path.basename(video_path))
        finally:
            extractor.close()

    if not feature_matrices:
        print(f"[skip] '{label}' ไม่มี Sample ที่ประมวลผลสำเร็จเลย")
        return

    os.makedirs(out_dir, exist_ok=True)
    npz_path = os.path.join(out_dir, f"{label}.npz")

    np.savez_compressed(
        npz_path,
        feature_matrices=np.array(feature_matrices, dtype=object),
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

    for label, folder in word_folders:
        print(f"\n=== กำลังประมวลผลคำ: {label} ===")
        build_word_ground_truth(label, folder, pose_model_path, hand_model_path, out_dir)

    print("\nเสร็จสิ้น Batch Processing ทั้งหมด")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="สร้าง Ground Truth ให้ครบทุกคำจากโฟลเดอร์ raw/{คำ}/*.mp4")
    parser.add_argument("--raw_dir", required=True)
    parser.add_argument("--out", default="gt_data")
    parser.add_argument("--pose-model", default="pose_landmarker.task")
    parser.add_argument("--hand-model", default="hand_landmarker.task")
    args = parser.parse_args()

    main(args.raw_dir, args.out, args.pose_model, args.hand_model)