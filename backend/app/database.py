# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ใช้พอร์ต 5432 (Session mode / Direct URL) สำหรับการรันและสร้างตาราง (Base.metadata.create_all)
DATABASE_URL = "postgresql://postgres.urbqulnmzmmtdyagasqe:Piyatida2026@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

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