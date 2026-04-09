# Daily English Buddy

A personal AI English learning web app — correct your writing, build vocabulary, review words with flashcards, and learn from topic-based stories and dialogs every day.

Built with Next.js, PostgreSQL, and Groq AI. Designed for Australian English learners.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Sentence Check** | Write a sentence → AI corrects grammar/spelling/punctuation → shows a native-speaker rewrite with a naturalness tip → history and stats saved |
| **Vocabulary Builder** | Enter words or phrases (including slang and idioms) → AI returns full breakdown: IPA, stress, all parts of speech with inflections, meanings per POS, 6–8 synonyms, antonyms, collocations, 4–5 Australian English examples + 5-question quiz → click any tag to drill down into that word |
| **Daily Topic** | Pick a topic → AI writes a dialog, story, or Aussie-mode conversation → 12 vocabulary words highlighted → **select any text to look it up instantly** (saves to Word Bank automatically) → 🔊 listen to the story read aloud |
| **Words Review** | Select words by date → **🃏 start flashcards** for chosen words only OR **📖 generate a review story** → SM-2 spaced repetition schedules "Due Today" reviews automatically |
| **Progress** | Day streak 🔥, words learned, mastery breakdown (new/learning/mastered), sentence check stats, quiz average, 4-week GitHub-style activity heatmap |
| **Word Bank** | Auto-tracks every studied word (max 200) — searchable chips with full expandable detail card including all POS forms, visible on the Vocabulary Builder tab |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | NextAuth.js (credentials + OAuth) |
| Database | PostgreSQL (Neon) · Prisma ORM |
| AI | Groq API — `llama-3.3-70b-versatile` (user supplies own API key) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/              Login & signup pages
│   ├── api/
│   │   ├── learning/        Vocab Builder: generate, word-bank, sessions, submit
│   │   ├── mistakes/        Sentence Check: CRUD + stats
│   │   ├── topic/           Daily Topic: generate + sessions
│   │   ├── review/          Review Story + words-by-date
│   │   ├── flashcards/      SM-2 due queue + review submission
│   │   ├── stats/           Progress dashboard aggregation
│   │   └── user/            Groq API key management
│   └── dashboard/           Main app page
├── components/
│   ├── tabs/
│   │   ├── SentenceCheck.tsx
│   │   ├── VocabBuilder.tsx
│   │   ├── DailyTopic.tsx
│   │   ├── WordsReview.tsx
│   │   └── Progress.tsx
│   ├── WordCard.tsx          Shared word detail card (used in Vocab + Topic lookup)
│   ├── TabShell.tsx
│   └── Navbar.tsx
├── lib/
│   ├── auth.ts              NextAuth config
│   ├── db.ts                Prisma client singleton
│   ├── groq.ts              Groq API wrapper
│   ├── encrypt.ts           AES-256-GCM for stored API keys
│   └── useSpeech.ts         Browser TTS hook (en-AU)
└── prisma/
    └── schema.prisma
```

---

## Getting Started (local)

### 1. Install dependencies

```bash
cd web
pnpm install
```

### 2. Set up environment variables

Create `web/.env`:

```env
DATABASE_URL=postgresql://...          # Neon pooled connection URL
DIRECT_URL=postgresql://...            # Neon direct connection URL (for migrations)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

### 3. Push the database schema

```bash
cd web
pnpm dlx prisma db push
```

### 4. Run the dev server

```bash
cd web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, add your Groq API key in the modal, and start learning.

---

## How to get a Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free) → API Keys → Create key
3. Paste it into the app when prompted on first login

Each user stores their own encrypted Groq key — the app never uses a shared key.

---

## Database Schema (key models)

```
User              — auth, encrypted Groq key
Mistake           — sentence check history (grammar/spelling/punctuation/none)
LearningSession   — vocab builder sessions (words + quiz)
QuizResult        — quiz scores per session
WordEntry         — word bank (max 200/user, JSON word info)
TopicSession      — daily topic sessions (content + vocab)
ReviewSession     — AI review stories
FlashcardReview   — raw "known"/"review" ratings log
WordSchedule      — SM-2 schedule (easeFactor, intervalDays, repetitions, nextReviewAt)
```

---

## AI Token Budget

| Feature | max_tokens | Notes |
|---------|-----------|-------|
| Sentence correction | 400 | Low temp (0.2) for accuracy |
| Vocab lesson (1 word) | ~1200 | Scales: 500 + (words × 700), max 6000 |
| Quick lookup (topic) | 800 | No quiz, no session saved |
| Review story | 600 | |
| Daily topic | 1500 | |

---

## Roadmap

| Feature | Status |
|---------|--------|
| Sentence Check + history | ✅ |
| Vocabulary Builder with full word breakdown | ✅ |
| Daily Topic (dialog / story / Aussie mode) | ✅ |
| Inline text-selection lookup in Topic | ✅ |
| SM-2 spaced repetition (Due Today queue) | ✅ |
| Selectable flashcard sessions | ✅ |
| Progress dashboard + activity heatmap | ✅ |
| Text-to-speech (en-AU) for words and stories | ✅ |
| Multi-user auth | ✅ |
| Writing practice tab | Planned |
| Export word bank (CSV / Anki) | Planned |
