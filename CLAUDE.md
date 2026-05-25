# Daily English Buddy

This repository contains Daily English Buddy, a personal AI English learning web app for sentence correction, vocabulary study, topic-based reading/listening, flashcards, and progress tracking.

## Current Source Of Truth

- Live application code is in `web/`.
- `archive/js-version-old/` is historical code and should not be treated as the current app.
- `internal-info/CLAUDE.md` appears stale; it documents the earlier Python/vanilla JS implementation and an incomplete migration plan.
- Lily planning files live in `.planning/`.

## Stack

- Next.js 15 App Router
- TypeScript and React 19
- Tailwind CSS
- NextAuth v4 with credentials auth and Prisma adapter
- Prisma 6 with PostgreSQL, intended for Neon
- Groq chat completions, using user-provided API keys
- AES-256-GCM encrypted storage for Groq API keys
- Microsoft Edge TTS with browser speech synthesis fallback

## Local Workflow

```bash
cd web
pnpm install
pnpm db:push
pnpm dev
pnpm build
```

Required environment variables are documented in `web/.env.example`. The app needs `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `ENCRYPTION_KEY`.

## Architecture Notes

- `/` redirects authenticated users to `/dashboard` and unauthenticated users to `/login`.
- `/dashboard` is protected by `web/middleware.ts`.
- The dashboard renders a tabbed client UI from `web/components/TabShell.tsx`.
- Server routes live under `web/app/api/`.
- User data is isolated by `session.user.id` in API routes.
- Groq API calls are made server-side through `web/lib/groq.ts`.
- Stored Groq keys are encrypted/decrypted through `web/lib/encrypt.ts`; the encryption key must be a 64-character hex string.
- Prisma models store AI payloads as JSON strings in text columns rather than typed JSON fields.

## Existing Features

- Credentials signup and login.
- Per-user encrypted Groq key setup and removal.
- Sentence Check with correction, native rewrite, history, delete, and stats.
- Vocabulary Builder with word breakdowns, quizzes, drill-down lookups, word bank, and past sessions.
- Daily Topic generation with dialog/story formats, level selector, Aussie mode, fresh version exclusion, history, inline text lookup, and TTS.
- Words Review with date-based selection, custom words, AI review stories, flashcards, due queue, and SM-2 scheduling.
- Progress dashboard with streak, word stats, mastery, sentence stats, quiz average, topic count, and activity heatmap.

## Guardrails

- Do not edit archived code unless the user explicitly asks.
- Prefer existing component and API patterns before adding new abstractions.
- Keep user API keys server-side only.
- Preserve per-user authorization checks on every data route.
- Add tests or manual verification notes when touching API behavior, auth, encryption, or scheduling.

