# Daily English Buddy

A personal English learning web app — correct your writing, build vocabulary with AI, review words through stories and flashcards, and learn from topic-based conversations every day.

---

## What it does

| Tab | Feature |
|-----|---------|
| **Sentence Check** | Write a sentence → AI corrects grammar/spelling → shows a "native speaker" rewrite with a naturalness tip → history + stats saved |
| **Vocabulary Builder** | Enter words → AI generates detailed word breakdowns (IPA, stress, meanings, synonyms, antonyms, collocations, examples) + 5-question quiz → click any synonym/antonym/collocation to drill down into that word |
| **Daily Topic** | Pick a topic or type your own → AI writes a dialog or story using 12 everyday Australian English words → vocabulary summary with definitions and context sentences → past topics expandable accordion |
| **Words Review** | Pick words from history → AI writes a review story OR generate flashcards with flip animation and Known/Review Again ratings |
| **Word Bank** | Auto-tracks every word studied (up to 200) — searchable chip grid with expandable detail, visible on the Vocabulary Builder tab |

---

## Tech Stack

| Layer    | Technology                               |
|----------|------------------------------------------|
| Backend  | Python 3.9 · FastAPI · Uvicorn           |
| Database | SQLite · SQLAlchemy ORM                  |
| AI       | Groq (llama-3.3-70b-versatile) or Gemini (gemini-2.0-flash) — switchable via env var |
| Frontend | Vanilla HTML · CSS · JavaScript (no framework, no build step) |

---

## Project Structure

```
english-buddy/
├── backend/
│   ├── main.py               FastAPI app entry point
│   ├── database.py           SQLAlchemy engine + session
│   ├── models.py             All DB table definitions
│   ├── schemas.py            Pydantic request/response models
│   ├── routes/
│   │   ├── mistakes.py       /api/mistakes endpoints
│   │   ├── learning.py       /api/learning endpoints
│   │   └── topic.py          /api/topic endpoints
│   ├── services/
│   │   └── ai_service.py     AI provider logic (Groq / Gemini / mock)
│   ├── .env                  API keys (not committed)
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Getting Started

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure AI provider

Create `backend/.env`:

```env
AI_PROVIDER=groq          # or: gemini | mock
GROQ_API_KEY=gsk_...      # get from console.groq.com
# GEMINI_API_KEY=...      # alternative
```

### 3. Run the server

```bash
cd backend
uvicorn main:app --reload
```

### 4. Open the app

- App: [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Endpoints

### Sentence Correction

| Method | Path                  | Description                                    |
|--------|-----------------------|------------------------------------------------|
| POST   | `/api/mistakes`       | Submit sentence → correction + native rewrite  |
| GET    | `/api/mistakes`       | List history (filter: `?mistake_type=grammar`) |
| GET    | `/api/mistakes/stats` | Mistake counts by type                         |
| DELETE | `/api/mistakes/{id}`  | Remove a mistake entry                         |

### Vocabulary Builder

| Method | Path                          | Description                                        |
|--------|-------------------------------|----------------------------------------------------|
| POST   | `/api/learning/generate`      | AI word breakdown + 5-question quiz (auto-saves to Word Bank) |
| POST   | `/api/learning/submit`        | Submit quiz answers → score + feedback             |
| GET    | `/api/learning/sessions`      | Past Vocab Builder sessions                        |
| GET    | `/api/learning/word-bank`     | Word bank with stats (total / this week / today)   |

### Words Review

| Method | Path                               | Description                              |
|--------|------------------------------------|------------------------------------------|
| POST   | `/api/learning/review`             | AI review story from selected words      |
| GET    | `/api/learning/reviews`            | Past review stories                      |
| GET    | `/api/learning/words-by-date`      | Studied words grouped by date            |
| GET    | `/api/learning/all-words`          | All unique studied words                 |
| POST   | `/api/learning/flashcards/review`  | Save flashcard Known/Review ratings      |

### Daily Topic

| Method | Path                    | Description                                           |
|--------|-------------------------|-------------------------------------------------------|
| POST   | `/api/topic/generate`   | AI dialog or story with 12 everyday Australian words  |
| GET    | `/api/topic/sessions`   | Past topic sessions (full content included)           |

---

## Database Schema

```
mistakes
  id, user_id, original_text, corrected_text, natural_text,
  mistake_type, explanation, naturalness_tip, created_at

learning_sessions
  id, user_id, words (JSON), word_info (JSON), quiz (JSON), created_at

quiz_results
  id, session_id (FK), score, total, answers (JSON), created_at

review_sessions
  id, user_id, words (JSON), story, created_at

topic_sessions
  id, user_id, topic, format ("dialog"|"story"), title, content, words (JSON), created_at

word_entries                     ← Word Bank (max 200 per user)
  id, user_id, word, word_info (JSON), created_at, updated_at

flashcard_reviews                ← Flashcard ratings for spaced repetition
  id, user_id, word, result ("known"|"review"), created_at
```

---

## AI Provider Notes

- **Default (no key):** mock rules for sentence correction only. Vocab Builder, Topic, and review features return 503.
- **Groq** (recommended): fast, generous free tier. Model: `llama-3.3-70b-versatile`.
- **Gemini**: reliable JSON output. Model: `gemini-2.0-flash`.
- All HTTP calls use stdlib `urllib` — no SDK dependency.

| Feature | max_tokens | temp |
|---------|-----------|------|
| Sentence correction | 300 | 0.2 |
| Vocab lesson + quiz | 1500 | 0.7 |
| Review story | 500 | 0.8 |
| Topic dialog/story | 1500 | 0.8 |

---

## Roadmap

| Phase | Feature                                        | Status       |
|-------|------------------------------------------------|--------------|
| 1     | Sentence correction + mistake history          | ✅ Done       |
| 2     | Vocab Builder (AI word breakdown + quiz)       | ✅ Done       |
| 3     | Words Review + Word Bank + Flashcards          | ✅ Done       |
| 3b    | Daily Topic (dialog/story + vocab summary)     | ✅ Done       |
| **4** | **Spaced repetition (SM-2, Due Today queue)**  | **Next**     |
| 5     | Auth / multi-user                              | Later        |
