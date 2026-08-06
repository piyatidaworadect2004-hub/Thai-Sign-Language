# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# เปลี่ยน username, password, localhost, port, dbname ให้ตรงกับเครื่องของคุณนะครับ
DATABASE_URL = "postgresql://postgres:6610210001@localhost:5432/thai_sign_learning"
engine = create_engine(DATABASE_URL)
# เปลี่ยนคำว่า รหัสผ่านใหม่_ของคุณ เป็นรหัสผ่านที่คุณเพิ่งตั้งในหน้าเว็บ Supabase
DATABASE_URL = "postgresql://postgres.urbqulnmzmmtdyagasqe:Bortorstamp687001@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()