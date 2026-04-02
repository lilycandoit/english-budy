from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


# ---------------------------------------------------------------------------
# Phase 1 — Sentence Correction & Mistake Tracking
# ---------------------------------------------------------------------------

class Mistake(Base):
    __tablename__ = "mistakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)  # future auth
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Type values: grammar | spelling | punctuation | vocabulary | no_mistake
    mistake_type: Mapped[str] = mapped_column(String(50), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Phase 2 — AI Learning Generator
# ---------------------------------------------------------------------------

class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    words: Mapped[str] = mapped_column(Text, nullable=False)             # JSON list of vocab words
    word_info: Mapped[str] = mapped_column("story", Text, nullable=False)  # JSON word info (DB col: story)
    quiz: Mapped[str] = mapped_column(Text, nullable=False)               # JSON quiz data
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("learning_sessions.id"), index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    answers: Mapped[str] = mapped_column(Text, nullable=False)  # JSON list of submitted answers
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Phase 3 — Words Review (daily story from studied words)
# ---------------------------------------------------------------------------

class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    words: Mapped[str] = mapped_column(Text, nullable=False)   # JSON list
    story: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Phase 3b — Word Bank (cumulative vocabulary store, max 200 words)
# ---------------------------------------------------------------------------

class WordEntry(Base):
    __tablename__ = "word_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    word: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    word_info: Mapped[str] = mapped_column(Text, nullable=False)  # JSON WordInfo object
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 4 — Flashcard Reviews (for spaced repetition)
# ---------------------------------------------------------------------------

class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    word: Mapped[str] = mapped_column(String(100), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # "known" | "review"
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
