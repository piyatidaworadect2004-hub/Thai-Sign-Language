from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Integer, Numeric, and_

from app.database import get_db
from app.models import PracticeLog, Category, Lesson

router = APIRouter()


@router.get("/user/{user_id}/overview")
def get_progress_overview(user_id: int, db: Session = Depends(get_db)):
    results = (
        db.query(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            Category.total_words.label("total_words"),
            func.count(func.distinct(PracticeLog.target_word)).label("words_practiced"),
            func.round(cast(func.avg(PracticeLog.correctness_percentage), Numeric), 2).label("avg_correctness"),
        )
        .outerjoin(Lesson, Lesson.category_id == Category.id)
        .outerjoin(
            PracticeLog,
            and_(
                PracticeLog.user_id == user_id,
                cast(PracticeLog.lesson_id, Integer) == Lesson.id,
            ),
        )
        .group_by(Category.id, Category.name, Category.total_words)
        .all()
    )

    overview = []
    for row in results:
        total_words = row.total_words or 0
        words_practiced = row.words_practiced or 0

        completion_percentage = 0
        if total_words > 0:
            completion_percentage = round(min(words_practiced / total_words * 100, 100), 2)

        overview.append({
            "category_id": row.category_id,
            "category_name": row.category_name,
            "total_words": total_words,
            "words_practiced": words_practiced,
            "completion_percentage": completion_percentage,
            "correctness_percentage": float(row.avg_correctness) if row.avg_correctness is not None else 0,
        })

    return overview


@router.get("/user/{user_id}/detail")
def get_progress_detail(user_id: int, db: Session = Depends(get_db)):
    results = (
        db.query(
            PracticeLog.id,
            PracticeLog.target_word,
            PracticeLog.predicted_word,
            PracticeLog.correctness_percentage,
            PracticeLog.confidence,
            PracticeLog.is_correct,
            PracticeLog.created_at,
            Lesson.title.label("lesson_title"),
            Category.name.label("category_name"),
        )
        .outerjoin(Lesson, cast(PracticeLog.lesson_id, Integer) == Lesson.id)
        .outerjoin(Category, Lesson.category_id == Category.id)
        .filter(PracticeLog.user_id == user_id)
        .order_by(PracticeLog.created_at.desc())
        .all()
    )

    return [
        {
            "id": row.id,
            "target_word": row.target_word,
            "predicted_word": row.predicted_word,
            "correctness_percentage": row.correctness_percentage,
            "confidence": row.confidence,
            "is_correct": row.is_correct,
            "created_at": row.created_at,
            "lesson_title": row.lesson_title,
            "category_name": row.category_name,
        }
        for row in results
    ]


@router.get("/user/{user_id}/top-words")
def get_top_practiced_words(user_id: int, db: Session = Depends(get_db)):
    results = (
        db.query(
            PracticeLog.target_word,
            func.count(PracticeLog.id).label("practice_count"),
            func.round(cast(func.avg(PracticeLog.correctness_percentage), Numeric), 2).label("avg_score"),
        )
        .filter(PracticeLog.user_id == user_id)
        .group_by(PracticeLog.target_word)
        .order_by(desc("practice_count"))
        .limit(5)
        .all()
    )

    return [
        {
            "target_word": row.target_word,
            "practice_count": row.practice_count,
            "avg_score": float(row.avg_score) if row.avg_score is not None else 0,
        }
        for row in results
    ]