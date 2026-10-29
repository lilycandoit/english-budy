# Daily English Buddy

An AI English learning web app — correct your writing, build vocabulary, review words with flashcards, and learn from topic-based stories and dialogs every day.

Built with Next.js, PostgreSQL, and Groq AI. Designed for Australian English practice, with a free-text native-language preference per user (not limited to Vietnamese — pick any language in Settings).

---

## Features

| Tab | What it does |
|-----|-------------|
| **Sentence Check** | Write a sentence → AI corrects grammar/spelling/punctuation → shows a native-speaker rewrite with a naturalness tip → refresh the native version for another natural phrasing → history and stats saved |
| **Vocabulary Builder** | Enter words or phrases (including slang and idioms) → AI returns full breakdown: dictionary-verified IPA, compact translation in your native language, all parts of speech with inflections, meanings per POS, synonyms, antonyms, collocations, and Australian English examples → generate the quiz only when needed → click any tag to drill down into that word |
| **Say It Differently** | Enter one phrase → AI explains the meaning and gives natural alternatives grouped by tone/context, with best-pick highlights, examples, avoid-when notes, and usage tips → saves the phrase to history for faster reuse and later review |
| **Daily Topic** | Pick a topic + format (Dialog / Story) + level (Everyday / Natural / Advanced) → optional Aussie flavour → AI generates content with 12 vocabulary words highlighted → **🔄 Fresh version** regenerates with different phrases (excludes all previously seen vocab for that topic) → **select any text to look it up instantly** → 🔊 listen aloud |
| **Words Review** | Select words by date → **🃏 start flashcards** (front shows pronunciation + synonym/antonym chips, back shows meaning) for chosen words only OR generate an English review story, a fresh version, or a bilingual English/native-language story → SM-2 spaced repetition schedules "Due Today" reviews automatically |
| **Progress** | Day streak 🔥, words learned, mastery breakdown (new/learning/mastered), sentence check stats, quiz average, 4-week GitHub-style activity heatmap |
| **Word Bank** | Auto-tracks every studied word (max 200) — searchable chips with full expandable detail card including all POS forms, visible on the Vocabulary Builder tab |
| **Account Settings** | Editable display name, generated avatar (initials + color, no upload needed), native language preference (free text, with common-language suggestions) — gear icon in the top nav |

### Account & Auth

- Email/password signup with **required email verification** (a real email must be clicked before login works).
- Forgot-password flow with a real emailed reset link (both verification and password-reset emails send via the user's own configured Gmail account over SMTP — see Environment Variables below).
- Dark mode, manually toggled, persisted per browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript, React 19 |
| Auth | NextAuth.js v4, credentials provider (email/password) with required email verification |
| Database | PostgreSQL (Neon) · Prisma ORM — **separate databases for local dev and production**, each needs its own `prisma db push` after a schema change |
| AI | Groq API — `openai/gpt-oss-120b` by default, `openai/gpt-oss-20b` for Vocabulary Builder generation (faster, made reliable via native JSON mode); automatic retry on rate limits and malformed responses; user supplies their own API key |
| Email | Gmail SMTP via `nodemailer`, using the app owner's own Gmail address + an app password — no third-party email service |
| Text-to-Speech | Microsoft Edge TTS — `en-AU-NatashaNeural` (free, no API key) · browser `speechSynthesis` fallback |
| Styling | Tailwind CSS, CSS-variable-based theme tokens (light/dark) |
| Deployment | Vercel |

---

## Project Structure

```
web/
├── app/
│   ├── (auth)/              login, signup, forgot-password, reset-password, verify-email
│   ├── api/
│   │   ├── auth/            signup, NextAuth, forgot-password, reset-password, verify-email, resend-verification
│   │   ├── learning/        Vocab Builder: generate, quiz, word-bank, sessions, submit
│   │   ├── mistakes/        Sentence Check: CRUD + stats + native rewrite
│   │   ├── topic/           Daily Topic: generate + sessions
│   │   ├── review/          Review stories, bilingual stories + words-by-date
│   │   ├── phrases/         Say It Differently phrase expansion
│   │   ├── flashcards/      SM-2 due queue + review submission
│   │   ├── stats/           Progress dashboard aggregation
│   │   ├── tts/             Edge TTS proxy (en-AU-NatashaNeural)
│   │   └── user/            Groq API key + profile (name, native language)
│   └── dashboard/           Main app page
├── components/
│   ├── tabs/                SentenceCheck, VocabBuilder, PhraseExpansion, DailyTopic, WordsReview, Progress
│   ├── ui/                  Card, Button, Badge, Avatar, PasswordInput, ThemeToggle — shared design-token primitives
│   ├── WordCard.tsx          Shared word detail card (used in Vocab + Topic lookup)
│   ├── SettingsModal.tsx     Profile (name/avatar/language) + Groq key
│   ├── GroqKeyModal.tsx      First-login Groq key prompt
│   ├── TabShell.tsx
│   └── Navbar.tsx
├── lib/
│   ├── auth.ts               NextAuth config (credentials, email-verification gate)
│   ├── db.ts                 Prisma client singleton
│   ├── groq.ts                Groq API wrapper — retries 429s and malformed JSON responses
│   ├── email.ts                Gmail SMTP sender (password reset + email verification)
│   ├── emailVerification.ts    Verification token generation/hashing
│   ├── passwordReset.ts        Reset token generation/hashing
│   ├── ipaLookup.ts            Verified IPA lookup (vendored dictionary, overrides AI-guessed pronunciation)
│   ├── encrypt.ts               AES-256-GCM for stored API keys
│   ├── languages.ts             Free-text native-language resolver + common-language suggestions
│   └── useSpeech.ts, useTheme.ts   TTS hook, dark-mode hook
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

Copy `web/.env.example` to `web/.env` and fill in:

```env
DATABASE_URL=postgresql://...          # Neon pooled connection URL
DIRECT_URL=postgresql://...            # Neon direct connection URL (used only for db:push)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=64-character-hex-string
GMAIL_USER=your-address@gmail.com      # for password-reset and verification emails
GMAIL_APP_PASSWORD=your-16-char-app-password
```

`GMAIL_APP_PASSWORD` requires 2-Step Verification enabled on the Gmail account — generate one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Without it, signup/forgot-password still work, but the emails won't send (`EMAIL_NOT_CONFIGURED` error).

### 3. Push the database schema

```bash
cd web
pnpm db:push
```

**If deploying to production separately from local dev**, repeat this against the production `DATABASE_URL`/`DIRECT_URL` too — they're independent databases, and a schema change only applies to whichever one is active when you run the command.

### 4. Run the dev server

```bash
cd web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, click the verification link sent to your email, sign in, add your Groq API key in the modal, and start learning.

---

## How to get a Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free) → API Keys → Create key
3. Paste it into the app when prompted on first login

Each user stores their own encrypted Groq key — the app never uses a shared key.

---

## Database Schema (key models)

```
User                — auth, name, generated-avatar inputs, native language, email verification state, encrypted Groq key
VerificationToken   — signup email-verification tokens (hashed, single-use, 24h expiry)
PasswordResetToken  — password-reset tokens (hashed, single-use, 1h expiry)
Mistake             — sentence check history (grammar/spelling/punctuation/none)
LearningSession     — vocab builder sessions (words + quiz)
QuizResult          — quiz scores per session
WordEntry           — word bank (max 200/user, JSON word info incl. translation + translationLanguage)
TopicSession        — daily topic sessions (content + vocab)
ReviewSession        — AI review stories, including structured bilingual story payloads
FlashcardReview      — raw "known"/"review" ratings log
WordSchedule         — SM-2 schedule (easeFactor, intervalDays, repetitions, nextReviewAt)
```

---

## AI Token Budget

All Groq calls run with `reasoning_effort: "low"`, since the `gpt-oss` models otherwise spend part of `max_tokens` on hidden reasoning before writing the visible answer.

| Feature | max_tokens | Notes |
|---------|-----------|-------|
| Sentence correction | ~300, scales with input length | Low temp (0.2) for accuracy |
| Native rewrite refresh | 250 | Higher temp (0.85) for a noticeably different rephrasing each time |
| Vocab lesson | 420 + (words × 480), max 4200 | `gpt-oss-20b`, native JSON mode; no quiz in the initial request; includes a compact translation in the user's native language |
| Vocab quick lookup | 700 | `gpt-oss-20b`; lightweight drill-down lookup; no session saved |
| Vocab quiz | 900 | Generated on demand after the word lesson |
| Phrase expansion | 1500 | Flat 4-6 alternative list, tone/region-tagged, best-pick highlights, cached phrase history |
| Review story | 600 | English story mode |
| Bilingual review story | 1800 | Structured English/native-language rows |
| Daily topic | 1750 | Higher temp (0.85) for variety; exclusion list in prompt for Fresh version |

Free-tier Groq rate limits are tight relative to some of these budgets, so `lib/groq.ts` automatically retries once on a 429 if Groq's suggested wait is short, and retries once on a malformed JSON response.

---

## Roadmap

| Feature | Status |
|---------|--------|
| Sentence Check + history | ✅ |
| Vocabulary Builder with full word breakdown | ✅ |
| Say It Differently / Phrase Expansion | ✅ |
| Daily Topic — Dialog / Story, levels, Fresh version, Aussie flavour, inline lookup | ✅ |
| Words Review — flashcards, SM-2 spaced repetition, English + bilingual stories | ✅ |
| Progress dashboard + activity heatmap | ✅ |
| Text-to-speech (en-AU) for words and stories | ✅ |
| Multi-user auth with required email verification | ✅ |
| Password reset via email (Gmail SMTP) | ✅ |
| Dark mode | ✅ |
| Account/Profile Settings (name, generated avatar) | ✅ |
| Multi-language support (free-text native language, not just Vietnamese) | ✅ |
| Verified (dictionary-backed) IPA in Vocabulary Builder | ✅ |
| Mistake Pattern Coach | Paused |
| Translate tab (default to user's native language) | Idea, not scoped |
| Writing Practice | Deferred |
| Word Bank export | Deferred |

See `.planning/ROADMAP.md` for full phase-by-phase history and rationale (not checked into a public repo view, but present in this working copy).
