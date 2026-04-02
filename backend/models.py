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
# Phase 3 — Flashcards & Review System
# ---------------------------------------------------------------------------

# class Flashcard(Base):
#     __tablename__ = "flashcards"
#     id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     user_id: Mapped[int] = mapped_column(Integer, default=1)
#     front: Mapped[str] = mapped_column(Text)
#     back: Mapped[str] = mapped_column(Text)
#     times_shown: Mapped[int] = mapped_column(Integer, default=0)
#     times_correct: Mapped[int] = mapped_column(Integer, default=0)
#     next_review: Mapped[datetime] = mapped_column(DateTime, nullable=True)
#     created_at: Mapped[datetime] = mapped_column(DateTime, ...)
