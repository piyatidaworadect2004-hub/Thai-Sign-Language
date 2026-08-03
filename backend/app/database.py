# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# เปลี่ยน username, password, localhost, port, dbname ให้ตรงกับเครื่องของคุณนะครับ
DATABASE_URL = "postgresql://postgres:6610210001@localhost:5432/thai_sign_learning"
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