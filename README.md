# Daily English Buddy

A focused web app for improving English consistently — by tracking your own mistakes and building personalized learning habits.

---

## What it does

You write a sentence. The app corrects it, explains the mistake, and saves it. Over time, you can see which types of mistakes you make most, and revisit your history to reinforce learning.

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Python 3.9+ · FastAPI · Uvicorn   |
| Database | SQLite · SQLAlchemy ORM           |
| Frontend | Vanilla HTML · CSS · JavaScript   |

No JavaScript framework. No build step. Easy to read and modify.

---

## Project Structure

```
english-buddy/
├── backend/
│   ├── main.py               FastAPI app entry point
│   ├── database.py           SQLAlchemy engine + session
│   ├── models.py             Database table definitions
│   ├── schemas.py            Request/response shapes (Pydantic)
│   ├── routes/
│   │   └── mistakes.py       /api/mistakes endpoints
│   ├── services/
│   │   └── ai_service.py     AI correction logic (mock for now)
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

### 2. Run the server

```bash
uvicorn main:app --reload
```

### 3. Open the app

Visit [http://localhost:8000](http://localhost:8000)

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## API Endpoints

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| POST   | `/api/mistakes`       | Submit a sentence for correction         |
| GET    | `/api/mistakes`       | List history (filter: `?mistake_type=grammar`) |
| GET    | `/api/mistakes/stats` | Mistake counts by type                   |
| DELETE | `/api/mistakes/{id}`  | Remove a mistake                         |

---

## Roadmap

| Phase | Feature                        | Status      |
|-------|--------------------------------|-------------|
| 1     | Sentence correction + tracking | ✅ Done      |
| 2     | AI story + quiz generator      | Planned     |
| 3     | Flashcards + spaced repetition | Planned     |

---

## Upgrading to a real AI

Open `backend/services/ai_service.py` and replace the body of `correct_sentence()` with a Claude API call. No other file needs to change.

## Upgrading to PostgreSQL

In `backend/database.py`, change:

```python
DATABASE_URL = "sqlite:///./english_buddy.db"
```

to:

```python
DATABASE_URL = "postgresql://user:password@host/dbname"
```

Then install `psycopg2-binary`.
