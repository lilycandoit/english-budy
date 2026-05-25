# Project

## Name

Daily English Buddy

## What It Does

Daily English Buddy is a personal AI English learning web app. It helps learners correct sentences, build vocabulary, learn from generated topics, review words with flashcards, and track progress over time.

## Observed Users

- English learners who want practical daily practice.
- The README says the app is designed for Australian English learners.
- Users bring their own Groq API key.

## Current App

The current app is the Next.js implementation in `web/`.

Key user flows:

- Sign up or log in.
- Add a Groq API key if missing.
- Use dashboard tabs for Sentence Check, Vocabulary Builder, Daily Topic, Words Review, and Progress.
- Store learning history and schedules per user.

## Technical Snapshot

- Framework: Next.js 15 App Router
- Language: TypeScript
- UI: React 19 and Tailwind CSS
- Auth: NextAuth v4 credentials provider with Prisma adapter
- Database: PostgreSQL through Prisma
- AI: Groq OpenAI-compatible chat completions
- TTS: `msedge-tts` with browser fallback
- Deployment target: Vercel

## Non-Current Code

- `archive/js-version-old/` contains the old FastAPI and vanilla JS implementation.
- `internal-info/CLAUDE.md` contains stale migration notes and should not override the root `CLAUDE.md` or `.planning/` files.

