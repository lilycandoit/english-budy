# Existing Codebase

## Repository Layout

- `README.md`: user-facing overview, setup, feature list, and roadmap.
- `web/`: current Next.js app.
- `web/app/`: App Router pages, layouts, and API routes.
- `web/components/`: dashboard UI, tab panels, modals, and shared cards.
- `web/lib/`: auth, database, encryption, Groq wrapper, and speech hook.
- `web/prisma/schema.prisma`: database schema.
- `web/package.json`: scripts and dependencies.
- `archive/js-version-old/`: old implementation, not current.
- `internal-info/`: older assistant notes and TODOs, likely stale.

## Main Runtime Flow

- `web/app/page.tsx` redirects to `/dashboard` or `/login`.
- `web/app/dashboard/page.tsx` requires a server session, renders `Navbar`, `TabShell`, and `GroqKeyModal` when needed.
- `web/components/TabShell.tsx` renders five client-side tabs:
  - Sentence Check
  - Vocabulary Builder
  - Daily Topic
  - Words Review
  - Progress

## API Surface

Observed API route groups:

- `auth`: NextAuth and signup.
- `user/groq-key`: save and delete encrypted user Groq keys.
- `mistakes`: sentence correction CRUD and stats.
- `learning`: vocabulary generation, quiz submission, sessions, and word bank.
- `topic`: topic generation and saved sessions.
- `review`: review story generation and words by date.
- `flashcards`: due cards and review submission.
- `stats`: progress aggregation.
- `tts`: text-to-speech proxy.

## Data Model

Prisma models:

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Mistake`
- `LearningSession`
- `QuizResult`
- `WordEntry`
- `TopicSession`
- `ReviewSession`
- `FlashcardReview`
- `WordSchedule`

Learning payloads are mostly stored as JSON strings in text columns.

## Important Implementation Details

- `web/lib/auth.ts` uses credentials auth only in the observed code, despite the README noting OAuth readiness.
- `web/lib/groq.ts` retrieves and decrypts user Groq keys, calls Groq chat completions, and includes a JSON extraction helper.
- `web/lib/encrypt.ts` requires `ENCRYPTION_KEY` and uses AES-256-GCM.
- `web/middleware.ts` protects `/dashboard/:path*`.
- `web/components/tabs/WordsReview.tsx` includes flashcard UI and SM-2 review submission flow.
- `web/app/api/flashcards/review/route.ts` updates `WordSchedule`.

## Verification Surface

Observed scripts:

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm db:push`
- `pnpm db:generate`
- `pnpm db:studio`

No explicit test script was observed in `web/package.json`.

