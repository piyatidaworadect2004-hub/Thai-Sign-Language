from sqlalchemy import text

from app.database import engine

print("Database:", engine.url)

with engine.begin() as conn:
    conn.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS instructions TEXT"))

print("เพิ่มคอลัมน์ instructions สำเร็จ")