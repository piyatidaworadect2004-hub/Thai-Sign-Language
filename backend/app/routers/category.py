from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, User
from app.schemas import CategoryBase, CategoryOut
from app.routers.auth import get_current_user
from app.routers.progress import _build_overview

router = APIRouter()


# ★ เพิ่ม: auth แบบ optional (ไม่ login ก็ยังดูหมวดหมู่ได้ แค่ progress จะเป็น 0)
# เหมือน get_optional_current_user ใน main.py แต่ต้องมีในนี้ด้วย
# เพราะ router นี้ import จาก main.py ไม่ได้ (จะเกิด circular import)
def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ")[1]
        return get_current_user(token=token, db=db)
    except Exception:
        return None


@router.get("/", response_model=List[CategoryOut])
def get_categories(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    categories = db.query(Category).all()

    # ★ ดึง progress ของ user คนนี้ทั้งหมดมาเตรียมไว้ครั้งเดียว (กัน query ซ้ำในลูป)
    # ใช้สูตรเดียวกับ /progress/me/overview เสมอ (นับคำที่เคยฝึกอย่างน้อย 1 ครั้ง)
    # กันไม่ให้เลขไม่ตรงกับหน้า Home ที่อ่านจาก overview โดยตรง
    progress_by_category = {}
    if current_user:
        overview = _build_overview(current_user.id, db)
        progress_by_category = {row["category_id"]: row["completion_percentage"] for row in overview}

    # ★ สร้าง response เอง (dict) แทนการ serialize ORM object ตรงๆ
    # เพราะ Category.progress (relationship) กับ progress (int ที่ frontend ต้องการ) ชื่อชนกัน
    result = []
    for cat in categories:
        result.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "total_words": cat.total_words,
            "level": cat.level,
            "image": cat.image,
            "progress": progress_by_category.get(cat.id, 0),
            "lessons": [
                {
                    "id": lesson.id,
                    "category_id": lesson.category_id,
                    "title": lesson.title,
                    "description": lesson.description,
                    "video_url": lesson.video_url,
                    "is_active": lesson.is_active,
                }
                for lesson in cat.lessons
            ],
        })

    return result


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    progress_value = 0
    if current_user:
        overview = _build_overview(current_user.id, db)
        match = next((row for row in overview if row["category_id"] == category_id), None)
        if match:
            progress_value = match["completion_percentage"]

    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "total_words": category.total_words,
        "level": category.level,
        "image": category.image,
        "progress": progress_value,
        "lessons": [
            {
                "id": lesson.id,
                "category_id": lesson.category_id,
                "title": lesson.title,
                "description": lesson.description,
                "video_url": lesson.video_url,
                "is_active": lesson.is_active,
            }
            for lesson in category.lessons
        ],
    }


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(category_in: CategoryBase, db: Session = Depends(get_db)):
    # 🟢 ใช้ **category_in.model_dump() เพื่อ unpacking ทุก field
    # (รวมถึง difficulty, color, total_words, image ที่ตั้งค่า default ไว้ใน Pydantic)
    new_category = Category(**category_in.model_dump())

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    # ★ category ที่เพิ่งสร้างยังไม่มี lessons/progress เลย ส่งเป็น list ว่าง/0 ไปตรงๆ
    return {
        "id": new_category.id,
        "name": new_category.name,
        "description": new_category.description,
        "total_words": new_category.total_words,
        "level": new_category.level,
        "image": new_category.image,
        "progress": 0,
        "lessons": [],
    }