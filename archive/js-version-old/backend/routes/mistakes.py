from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Mistake
from schemas import CorrectionRequest, MistakeResponse, StatsResponse
from services.ai_service import correct_sentence

router = APIRouter(prefix="/api/mistakes", tags=["mistakes"])


@router.post("", response_model=MistakeResponse, status_code=201)
def submit_sentence(body: CorrectionRequest, db: Session = Depends(get_db)):
    """Submit a sentence → AI corrects it → stored and returned."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    ai_result = correct_sentence(body.text)

    mistake = Mistake(
        user_id=1,  # hardcoded until auth is added in a future phase
        original_text=body.text,
        corrected_text=ai_result["corrected_text"],
        natural_text=ai_result.get("natural_text"),
        mistake_type=ai_result["mistake_type"],
        explanation=ai_result["explanation"],
        naturalness_tip=ai_result.get("naturalness_tip"),
    )
    db.add(mistake)
    db.commit()
    db.refresh(mistake)
    return mistake


@router.get("", response_model=List[MistakeResponse])
def list_mistakes(
    mistake_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List past mistakes. Optional filter: ?mistake_type=grammar"""
    query = db.query(Mistake).filter(Mistake.user_id == 1)
    if mistake_type:
        query = query.filter(Mistake.mistake_type == mistake_type)
    return query.order_by(Mistake.created_at.desc()).limit(limit).all()


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return total mistakes and breakdown by type."""
    rows = (
        db.query(Mistake.mistake_type, func.count(Mistake.id))
        .filter(Mistake.user_id == 1)
        .group_by(Mistake.mistake_type)
        .all()
    )
    by_type = {row[0]: row[1] for row in rows}
    total = sum(by_type.values())
    return StatsResponse(total=total, by_type=by_type)


@router.delete("/{mistake_id}", status_code=204)
def delete_mistake(mistake_id: int, db: Session = Depends(get_db)):
    """Remove a mistake record."""
    mistake = db.query(Mistake).filter(Mistake.id == mistake_id).first()
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found.")
    db.delete(mistake)
    db.commit()
