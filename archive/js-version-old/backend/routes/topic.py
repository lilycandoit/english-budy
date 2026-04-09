from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import TopicSession
from schemas import TopicRequest, TopicResponse, TopicSessionSummary, TopicWord
from services.ai_service import generate_topic_lesson

router = APIRouter(prefix="/api/topic", tags=["topic"])

USER_ID = 1


@router.post("/generate", response_model=TopicResponse, status_code=201)
def generate_topic(req: TopicRequest, db: Session = Depends(get_db)):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Topic cannot be empty.")

    fmt = req.format if req.format in ("dialog", "story") else "dialog"

    result = generate_topic_lesson(topic, fmt)
    if not result:
        raise HTTPException(
            status_code=503,
            detail="AI provider unavailable. Set AI_PROVIDER + API key to enable topic lessons.",
        )

    title   = str(result.get("title", topic)).strip()
    content = str(result.get("content", "")).strip()
    words   = result.get("words", [])

    if not content or not words:
        raise HTTPException(status_code=502, detail="AI returned an incomplete lesson.")

    session = TopicSession(
        user_id=USER_ID,
        topic=topic,
        format=fmt,
        title=title,
        content=content,
        words=json.dumps(words),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    word_objs = [
        TopicWord(
            word=w.get("word", ""),
            definition=w.get("definition", ""),
            context=w.get("context", ""),
        )
        for w in words
    ]
    return TopicResponse(
        session_id=session.id,
        topic=topic,
        format=fmt,
        title=title,
        content=content,
        words=word_objs,
    )


@router.get("/sessions", response_model=list[TopicSessionSummary])
def list_topic_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(TopicSession)
        .filter(TopicSession.user_id == USER_ID)
        .order_by(TopicSession.created_at.desc())
        .limit(30)
        .all()
    )
    result = []
    for s in sessions:
        raw_words = json.loads(s.words)
        result.append(
            TopicSessionSummary(
                id=s.id,
                topic=s.topic,
                format=s.format,
                title=s.title,
                content=s.content,
                words=[
                    TopicWord(
                        word=w.get("word", ""),
                        definition=w.get("definition", ""),
                        context=w.get("context", ""),
                    )
                    for w in raw_words
                ],
                created_at=s.created_at,
            )
        )
    return result
