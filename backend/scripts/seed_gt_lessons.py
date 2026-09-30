"""
scripts/seed_gt_lessons.py
============================
เพิ่มบทเรียนให้คำที่มี Ground Truth แล้วแต่ยังไม่มีใน DB (ชื่อบทเรียนต้องตรงกับชื่อไฟล์ gt_data/{คำ}.npz
เพราะ backend ค้น Ground Truth ด้วย lesson.title)

- สร้างหมวด "การสื่อสารพื้นฐาน" ถ้ายังไม่มี
- คัดลอกคลิปแรกใน source_files ของ GT ไปเป็นวิดีโอตัวอย่าง (uploaded_videos/) ให้หน้าฝึกมีวิดีโอแสดง
- รันซ้ำได้: ข้ามคำที่มีบทเรียนชื่อนี้อยู่แล้ว

การใช้งาน (จากโฟลเดอร์ backend):
    venv/Scripts/python scripts/seed_gt_lessons.py --raw_dir "C:/Users/User/Downloads/archive/data/raw"
"""

import argparse
import json
import os
import shutil
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Category, Lesson  # noqa: E402

APP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")
GT_DATA_DIR = os.path.join(APP_DIR, "sign_engine", "gt_data")
UPLOAD_DIR = os.path.join(APP_DIR, "uploaded_videos")

CATEGORY_NAME = "การสื่อสารพื้นฐาน"
CATEGORY_LEVEL = "ง่าย"
CATEGORY_DESCRIPTION = "คุณ - ช่วย - ถาม - เข้าใจ และอื่นๆ"
WORDS = ["คนหูหนวก", "คุณ", "ช่วย", "ต้องการ", "ถาม", "บอก", "เข้าใจ"]


def copy_sample_video(word: str, raw_dir: str):
    """คัดลอกคลิปแรกที่ใช้สร้าง GT ของคำนี้ไปเป็นวิดีโอตัวอย่าง คืน video_url หรือ None ถ้าหาไม่เจอ"""
    json_path = os.path.join(GT_DATA_DIR, f"{word}.json")
    if not os.path.exists(json_path):
        return None
    with open(json_path, encoding="utf-8") as f:
        source_files = json.load(f).get("source_files") or []
    for name in source_files:
        src = os.path.join(raw_dir, word, name)
        if os.path.exists(src):
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            filename = f"{uuid.uuid4().hex}.mp4"
            shutil.copyfile(src, os.path.join(UPLOAD_DIR, filename))
            # รูปแบบ URL เดียวกับ /lessons/upload-video
            return f"http://127.0.0.1:8000/uploaded-videos/{filename}"
    return None


def sync_id_sequence(db, table: str):
    """
    ข้อมูลตั้งต้นถูก insert พร้อม id เอง ทำให้ sequence ของ Postgres ค้างต่ำกว่า max(id)
    (insert ใหม่จะชน primary key) ตั้ง sequence ให้ต่อจาก max(id) ก่อนเพิ่มแถว
    """
    db.execute(text(
        f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
        f"GREATEST((SELECT COALESCE(MAX(id), 0) FROM {table}), 1))"
    ))
    db.commit()


def main(raw_dir: str):
    db = SessionLocal()
    try:
        sync_id_sequence(db, "category")
        sync_id_sequence(db, "lessons")

        category =db.query(Category).filter(Category.name == CATEGORY_NAME).first()
        if category:
            print(f"[มีอยู่แล้ว] หมวด '{CATEGORY_NAME}' (id={category.id})")
        else:
            category = Category(
                name=CATEGORY_NAME,
                description=CATEGORY_DESCRIPTION,
                level=CATEGORY_LEVEL,
                total_words=len(WORDS),
            )
            db.add(category)
            db.commit()
            db.refresh(category)
            print(f"[สร้าง] หมวด '{CATEGORY_NAME}' (id={category.id})")

        for word in WORDS:
            if db.query(Lesson).filter(Lesson.title == word).first():
                print(f"[ข้าม] '{word}' มีบทเรียนอยู่แล้ว")
                continue
            if not os.path.exists(os.path.join(GT_DATA_DIR, f"{word}.npz")):
                print(f"[ข้าม] '{word}' ยังไม่มี Ground Truth")
                continue

            video_url = copy_sample_video(word, raw_dir)
            db.add(Lesson(
                category_id=category.id,
                title=word,
                description=f"ฝึกท่าทางภาษามือคำว่า {word}",
                video_url=video_url,
                is_active=True,
            ))
            db.commit()
            print(f"[สร้าง] บทเรียน '{word}' วิดีโอ: {video_url or '— ไม่พบคลิป'}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="เพิ่มบทเรียนให้คำที่มี Ground Truth แล้ว")
    parser.add_argument("--raw_dir", required=True, help="โฟลเดอร์ dataset raw/{คำ}/*.mp4")
    args = parser.parse_args()
    main(args.raw_dir)
