# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

<<<<<<< HEAD
# เปลี่ยน username, password, localhost, port, dbname ให้ตรงกับเครื่องของคุณนะครับ
DATABASE_URL = "postgresql://postgres:6610210001@localhost:5432/thai_sign_learning"
=======
# ใช้พอร์ต 5432 (Session mode / Direct URL) สำหรับการรันและสร้างตาราง (Base.metadata.create_all)
DATABASE_URL = "postgresql://postgres.urbqulnmzmmtdyagasqe:Piyatida2026@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

>>>>>>> e0ada0f20538d9925e4b29af744bec2264d49401
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# dependency สำหรับสร้าง DB Session ในแต่ละ Request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()