# Daily English Buddy

A personal AI English learning web app — correct your writing, build vocabulary, review words with flashcards, and learn from topic-based stories and dialogs every day.

Built with Next.js, PostgreSQL, and Groq AI. Designed for Australian English practice, currently optimized for Vietnamese learners with a scalable native-language config.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Sentence Check** | Write a sentence → AI corrects grammar/spelling/punctuation → shows a native-speaker rewrite with a naturalness tip → refresh the native version for another natural phrasing → history and stats saved |
| **Vocabulary Builder** | Enter words or phrases (including slang and idioms) → AI returns full breakdown: IPA, stress, compact Vietnamese translation, all parts of speech with inflections, meanings per POS, synonyms, antonyms, collocations, and Australian English examples → generate the quiz only when needed → click any tag to drill down into that word |
| **Say It Differently** | Enter one phrase → AI explains the meaning and gives natural alternatives grouped by tone/context, with best-pick highlights, examples, avoid-when notes, and usage tips → saves the phrase to history for faster reuse and later review |
| **Daily Topic** | Pick a topic + format (Dialog / Story) + level (Everyday / Natural / Advanced) → optional Aussie flavour → AI generates content with 12 vocabulary words highlighted → **🔄 Fresh version** regenerates with different phrases (excludes all previously seen vocab for that topic) → **select any text to look it up instantly** → 🔊 listen aloud |
| **Words Review** | Select words by date → **🃏 start flashcards** for chosen words only OR generate an English review story, a fresh version, or a bilingual English/Vietnamese story → SM-2 spaced repetition schedules "Due Today" reviews automatically |
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
| Text-to-Speech | Microsoft Edge TTS — `en-AU-NatashaNeural` (free, no API key) · browser `speechSynthesis` fallback |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/              Login & signup pages
│   ├── api/
│   │   ├── learning/        Vocab Builder: generate, quiz, word-bank, sessions, submit
│   │   ├── mistakes/        Sentence Check: CRUD + stats
│   │   ├── topic/           Daily Topic: generate + sessions
│   │   ├── review/          Review stories, bilingual stories + words-by-date
│   │   ├── phrases/         Say It Differently phrase expansion
│   │   ├── flashcards/      SM-2 due queue + review submission
│   │   ├── stats/           Progress dashboard aggregation
│   │   ├── tts/             Edge TTS proxy (en-AU-NatashaNeural)
│   │   └── user/            Groq API key management
│   └── dashboard/           Main app page
├── components/
│   ├── tabs/
│   │   ├── SentenceCheck.tsx
│   │   ├── VocabBuilder.tsx
│   │   ├── PhraseExpansion.tsx
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
│   ├── languages.ts         Native-language config (Vietnamese default)
│   └── useSpeech.ts         TTS hook — Edge TTS with browser speechSynthesis fallback
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
ENCRYPTION_KEY=64-character-hex-string
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
ReviewSession     — AI review stories, including structured bilingual story payloads
FlashcardReview   — raw "known"/"review" ratings log
WordSchedule      — SM-2 schedule (easeFactor, intervalDays, repetitions, nextReviewAt)
PasswordResetToken — reset-token infrastructure; email delivery is intentionally deferred
```

---

## AI Token Budget

| Feature | max_tokens | Notes |
|---------|-----------|-------|
| Sentence correction | 400 | Low temp (0.2) for accuracy |
| Vocab lesson | 450 + (words × 550), max 4800 | No quiz in the initial request; includes compact native-language translation |
| Vocab quick lookup | 800 | Lightweight drill-down lookup; no session saved |
| Vocab quiz | 900 | Generated on demand after the word lesson |
| Phrase expansion | 3400 | Structured alternatives across 5 tone groups, 4 alternatives per group, examples, best-pick highlights, and cached phrase history |
| Review story | 600 | English story mode |
| Bilingual review story | 1200 | Structured English/native-language rows |
| Daily topic | 2000 | Higher temp (0.85) for variety; exclusion list in prompt for Fresh version |

---

## Roadmap

| Feature | Status |
|---------|--------|
| Sentence Check + history | ✅ |
| Sentence Check result-card UI + copy buttons | ✅ |
| Sentence Check — fresh Native Speaker rewrites | ✅ |
| Vocabulary Builder with full word breakdown | ✅ |
| Vocabulary Builder performance split: cached words, quick lookup, on-demand quiz | ✅ |
| Vocabulary Builder compact Vietnamese translations | ✅ |
| Say It Differently / Phrase Expansion | ✅ |
| Daily Topic — Dialog / Story formats | ✅ |
| Daily Topic — Level selector (Everyday / Natural / Advanced) | ✅ |
| Daily Topic — 🔄 Fresh version with phrase exclusion | ✅ |
| Daily Topic — optional Aussie flavour add-on | ✅ |
| Inline text-selection lookup in Topic | ✅ |
| SM-2 spaced repetition (Due Today queue) | ✅ |
| Selectable flashcard sessions | ✅ |
| Words Review — English story fresh versions | ✅ |
| Words Review — bilingual English/Vietnamese stories | ✅ |
| Progress dashboard + activity heatmap | ✅ |
| Text-to-speech (en-AU) for words and stories | ✅ |
| Multi-user auth | ✅ |
| Password reset email delivery | Deferred until the app needs broader user support |
| Mistake Pattern Coach | Planned |
| Writing Practice | Deferred |
| Word Bank export | Deferred |
