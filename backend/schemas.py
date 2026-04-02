from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel


class CorrectionRequest(BaseModel):
    text: str


class MistakeResponse(BaseModel):
    id: int
    original_text: str
    corrected_text: str
    mistake_type: str
    explanation: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StatsResponse(BaseModel):
    total: int
    by_type: Dict[str, int]


# ---------------------------------------------------------------------------
# Phase 2 — Vocabulary Builder / Quiz
# ---------------------------------------------------------------------------

class LessonRequest(BaseModel):
    words: List[str]


class WordInfo(BaseModel):
    word: str
    ipa: str
    stress: str
    meanings: List[str]
    synonyms: List[str]
    antonyms: List[str]
    collocations: List[str]
    examples: List[str]


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct: str
    explanation: str


class LessonResponse(BaseModel):
    session_id: int
    word_infos: List[WordInfo]
    quiz: List[QuizQuestion]


class QuizSubmission(BaseModel):
    session_id: int
    answers: List[str]


class QuizResultItem(BaseModel):
    question: str
    your_answer: str
    correct: str
    explanation: str
    is_correct: bool


class QuizResultResponse(BaseModel):
    score: int
    total: int
    results: List[QuizResultItem]


class SessionSummary(BaseModel):
    id: int
    words: List[str]
    score: Optional[int] = None
    total: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Phase 3 — Words Review
# ---------------------------------------------------------------------------

class WordsByDate(BaseModel):
    date: str
    words: List[str]


class ReviewRequest(BaseModel):
    words: List[str]


class ReviewResponse(BaseModel):
    session_id: int
    story: str


class ReviewSessionSummary(BaseModel):
    id: int
    words: List[str]
    story: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Phase 3b — Word Bank
# ---------------------------------------------------------------------------

class WordBankEntry(BaseModel):
    word: str
    word_info: dict
    updated_at: datetime

    model_config = {"from_attributes": True}


class WordBankStats(BaseModel):
    total: int
    this_week: int
    today: int


class WordBankResponse(BaseModel):
    stats: WordBankStats
    words: List[WordBankEntry]


# ---------------------------------------------------------------------------
# Phase 4 — Flashcard Reviews
# ---------------------------------------------------------------------------

class FlashcardReviewItem(BaseModel):
    word: str
    result: str  # "known" | "review"


class FlashcardReviewBatch(BaseModel):
    reviews: List[FlashcardReviewItem]
