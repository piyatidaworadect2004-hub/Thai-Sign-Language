from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Category
from app.schemas import CategoryBase, CategoryOut

router = APIRouter()

@router.get("/", response_model=List[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return categories

@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Category not found"
        )
    return category

@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(category_in: CategoryBase, db: Session = Depends(get_db)):
    # 🟢 ใช้ **category_in.model_dump() เพื่อ unpacking ทุก field 
    # (รวมถึง difficulty, color, total_words, image ที่ตั้งค่า default ไว้ใน Pydantic)
    new_category = Category(**category_in.model_dump())
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category