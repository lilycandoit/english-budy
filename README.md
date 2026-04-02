# Daily English Buddy

A personal English learning web app — correct your writing, build vocabulary with AI, and review words through stories and flashcards.

---

## What it does

| Tab | Feature |
|-----|---------|
| **Sentence Check** | Paste a sentence → AI corrects it and explains the mistake → history + stats saved |
| **Vocabulary Builder** | Enter words → AI generates detailed word breakdowns (IPA, meanings, synonyms, collocations, examples) + a 5-question quiz → results saved |
| **Words Review** | Pick words from your history → AI writes a review story OR generate flashcards with flip animation and Known/Review Again ratings |
| **Word Bank** | Automatically tracks every word studied (up to 200) — searchable chip grid with expandable detail panel |

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
│   │   └── learning.py       /api/learning endpoints
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

```bash
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
| POST   | `/api/mistakes`       | Submit a sentence for correction               |
| GET    | `/api/mistakes`       | List history (filter: `?mistake_type=grammar`) |
| GET    | `/api/mistakes/stats` | Mistake counts by type                         |
| DELETE | `/api/mistakes/{id}`  | Remove a mistake entry                         |

### Vocabulary Builder

| Method | Path                          | Description                                        |
|--------|-------------------------------|----------------------------------------------------|
| POST   | `/api/learning/generate`      | AI word breakdown + 5-question quiz                |
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

---

## Database Schema

```
mistakes
  id, user_id, original_text, corrected_text, mistake_type, explanation, created_at

learning_sessions
  id, user_id, words (JSON), word_info (JSON), quiz (JSON), created_at

quiz_results
  id, session_id (FK), score, total, answers (JSON), created_at

review_sessions
  id, user_id, words (JSON), story, created_at

word_entries                     ← Word Bank (max 200 per user)
  id, user_id, word, word_info (JSON), created_at, updated_at

flashcard_reviews                ← Flashcard ratings for future spaced repetition
  id, user_id, word, result ("known"|"review"), created_at
```

---

## AI Provider Notes

- **Default (no key):** uses rule-based mock for sentence correction. Vocab Builder and review features return 503 without a real provider.
- **Groq** (recommended): fast, generous free tier. Model: `llama-3.3-70b-versatile`.
- **Gemini**: good JSON reliability. Model: `gemini-2.0-flash`.
- Token caps: correction `max_tokens=150`, lesson `max_tokens=1500`, review story `max_tokens=500`.
- HTTP calls use stdlib `urllib` only — no SDK dependency.

---

## Roadmap

| Phase | Feature                                | Status       |
|-------|----------------------------------------|--------------|
| 1     | Sentence correction + mistake history  | ✅ Done       |
| 2     | AI vocab breakdown + quiz              | ✅ Done       |
| 3     | Words Review (story) + Word Bank + Flashcards | ✅ Done |
| 4     | Spaced repetition (SM-2 algorithm)     | Planned      |
| 5     | Auth / multi-user                      | Planned      |
