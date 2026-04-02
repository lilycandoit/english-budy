from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import FlashcardReview, LearningSession, QuizResult, ReviewSession, WordEntry
from schemas import (
    FlashcardReviewBatch,
    LessonRequest,
    LessonResponse,
    QuizQuestion,
    QuizResultItem,
    QuizResultResponse,
    QuizSubmission,
    ReviewRequest,
    ReviewResponse,
    ReviewSessionSummary,
    SessionSummary,
    WordBankEntry,
    WordBankResponse,
    WordBankStats,
    WordInfo,
    WordsByDate,
)
from services.ai_service import generate_lesson, generate_review_story

router = APIRouter(prefix="/api/learning", tags=["learning"])

USER_ID = 1  # hardcoded until auth is added
WORD_BANK_LIMIT = 200


def _upsert_word_bank(db: Session, user_id: int, word_infos: list) -> None:
    """Insert or update word_entries for each word; enforce 200-word cap."""
    for info in word_infos:
        word_lower = info.get("word", "").strip().lower()
        if not word_lower:
            continue
        existing = (
            db.query(WordEntry)
            .filter(WordEntry.user_id == user_id, WordEntry.word == word_lower)
            .first()
        )
        if existing:
            existing.word_info = json.dumps(info)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(WordEntry(user_id=user_id, word=word_lower, word_info=json.dumps(info)))

    db.flush()

    # Enforce cap: delete oldest entries beyond the limit
    total = db.query(WordEntry).filter(WordEntry.user_id == user_id).count()
    if total > WORD_BANK_LIMIT:
        overflow = total - WORD_BANK_LIMIT
        oldest_ids = (
            db.query(WordEntry.id)
            .filter(WordEntry.user_id == user_id)
            .order_by(WordEntry.updated_at.asc())
            .limit(overflow)
            .all()
        )
        ids = [row[0] for row in oldest_ids]
        db.query(WordEntry).filter(WordEntry.id.in_(ids)).delete(synchronize_session=False)


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
    db.flush()  # get session.id before commit

    _upsert_word_bank(db, USER_ID, raw_word_infos)
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


@router.get("/words-by-date", response_model=list[WordsByDate])
def words_by_date(db: Session = Depends(get_db)):
    sessions = (
        db.query(LearningSession)
        .filter(LearningSession.user_id == USER_ID)
        .order_by(LearningSession.created_at.desc())
        .all()
    )
    groups: dict = defaultdict(list)
    seen_per_date: dict = defaultdict(set)
    for s in sessions:
        date_key = s.created_at.strftime("%Y-%m-%d")
        for word in json.loads(s.words):
            key = word.lower()
            if key not in seen_per_date[date_key]:
                seen_per_date[date_key].add(key)
                groups[date_key].append(word)
    return [{"date": date, "words": words} for date, words in groups.items()]


@router.get("/all-words")
def all_words(db: Session = Depends(get_db)):
    sessions = db.query(LearningSession).filter(LearningSession.user_id == USER_ID).all()
    seen: set = set()
    result = []
    for s in sessions:
        for word in json.loads(s.words):
            key = word.lower()
            if key not in seen:
                seen.add(key)
                result.append(word)
    return {"words": result}


@router.post("/review", response_model=ReviewResponse, status_code=201)
def generate_review(req: ReviewRequest, db: Session = Depends(get_db)):
    words = [w.strip() for w in req.words if w.strip()]
    if not words:
        raise HTTPException(status_code=422, detail="Provide at least one word.")

    story = generate_review_story(words)
    if not story:
        raise HTTPException(
            status_code=503,
            detail="AI provider unavailable. Set AI_PROVIDER + API key to enable stories.",
        )

    review = ReviewSession(user_id=USER_ID, words=json.dumps(words), story=story)
    db.add(review)
    db.commit()
    db.refresh(review)
    return ReviewResponse(session_id=review.id, story=story)


@router.get("/reviews", response_model=list[ReviewSessionSummary])
def list_reviews(db: Session = Depends(get_db)):
    reviews = (
        db.query(ReviewSession)
        .filter(ReviewSession.user_id == USER_ID)
        .order_by(ReviewSession.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        ReviewSessionSummary(
            id=r.id,
            words=json.loads(r.words),
            story=r.story,
            created_at=r.created_at,
        )
        for r in reviews
    ]


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


@router.get("/word-bank", response_model=WordBankResponse)
def word_bank(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    entries = (
        db.query(WordEntry)
        .filter(WordEntry.user_id == USER_ID)
        .order_by(WordEntry.updated_at.desc())
        .all()
    )

    total = len(entries)
    this_week = sum(1 for e in entries if e.updated_at.replace(tzinfo=timezone.utc) >= week_start)
    today = sum(1 for e in entries if e.updated_at.replace(tzinfo=timezone.utc) >= today_start)

    words = [
        WordBankEntry(word=e.word, word_info=json.loads(e.word_info), updated_at=e.updated_at)
        for e in entries
    ]
    return WordBankResponse(stats=WordBankStats(total=total, this_week=this_week, today=today), words=words)


@router.post("/flashcards/review", status_code=204)
def save_flashcard_reviews(req: FlashcardReviewBatch, db: Session = Depends(get_db)):
    for item in req.reviews:
        db.add(FlashcardReview(user_id=USER_ID, word=item.word, result=item.result))
    db.commit()
