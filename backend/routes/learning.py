from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import LearningSession, QuizResult
from schemas import (
    LessonRequest,
    LessonResponse,
    QuizQuestion,
    QuizResultItem,
    QuizResultResponse,
    QuizSubmission,
    SessionSummary,
    WordInfo,
)
from services.ai_service import generate_lesson

router = APIRouter(prefix="/api/learning", tags=["learning"])

USER_ID = 1  # hardcoded until auth is added


@router.post("/generate", response_model=LessonResponse, status_code=201)
def generate(req: LessonRequest, db: Session = Depends(get_db)):
    words = [w.strip() for w in req.words if w.strip()]
    if not words:
        raise HTTPException(status_code=422, detail="Provide at least one word.")

    lesson = generate_lesson(words)
    if not lesson:
        raise HTTPException(
            status_code=503,
            detail="AI provider unavailable. Set AI_PROVIDER + API key to enable lessons.",
        )

    raw_word_infos = lesson.get("words", [])
    raw_quiz = lesson.get("quiz", [])
    if not raw_word_infos or not raw_quiz:
        raise HTTPException(status_code=502, detail="AI returned an incomplete lesson.")

    session = LearningSession(
        user_id=USER_ID,
        words=json.dumps(words),
        word_info=json.dumps(raw_word_infos),
        quiz=json.dumps(raw_quiz),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    word_infos = [WordInfo(**w) for w in raw_word_infos]
    quiz = [QuizQuestion(**q) for q in raw_quiz]
    return LessonResponse(session_id=session.id, word_infos=word_infos, quiz=quiz)


@router.post("/submit", response_model=QuizResultResponse)
def submit(req: QuizSubmission, db: Session = Depends(get_db)):
    session = db.query(LearningSession).filter(LearningSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    raw_quiz = json.loads(session.quiz)
    if len(req.answers) != len(raw_quiz):
        raise HTTPException(
            status_code=422,
            detail=f"Expected {len(raw_quiz)} answers, got {len(req.answers)}.",
        )

    results = []
    score = 0
    for q, answer in zip(raw_quiz, req.answers):
        is_correct = answer.strip().upper() == q["correct"].strip().upper()
        if is_correct:
            score += 1
        results.append(
            QuizResultItem(
                question=q["question"],
                your_answer=answer,
                correct=q["correct"],
                explanation=q["explanation"],
                is_correct=is_correct,
            )
        )

    quiz_result = QuizResult(
        session_id=session.id,
        score=score,
        total=len(raw_quiz),
        answers=json.dumps(req.answers),
    )
    db.add(quiz_result)
    db.commit()

    return QuizResultResponse(score=score, total=len(raw_quiz), results=results)


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(LearningSession)
        .filter(LearningSession.user_id == USER_ID)
        .order_by(LearningSession.created_at.desc())
        .limit(50)
        .all()
    )

    summaries = []
    for s in sessions:
        latest_result = (
            db.query(QuizResult)
            .filter(QuizResult.session_id == s.id)
            .order_by(QuizResult.created_at.desc())
            .first()
        )
        summaries.append(
            SessionSummary(
                id=s.id,
                words=json.loads(s.words),
                score=latest_result.score if latest_result else None,
                total=latest_result.total if latest_result else None,
                created_at=s.created_at,
            )
        )
    return summaries
