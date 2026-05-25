# Requirements

## Observed Functional Requirements

- Users can create an account and sign in.
- Dashboard access requires authentication.
- Users can store a personal Groq API key.
- Groq API keys are encrypted at rest and not exposed to the browser.
- Sentence Check accepts learner text and returns correction, classification, explanation, and optional natural rewrite.
- Sentence Check saves user-specific history and stats.
- Vocabulary Builder accepts comma-separated words and returns detailed word information plus a quiz.
- Generated vocabulary is saved into a per-user word bank capped by app logic.
- Topic generation supports topic, format, level, Aussie mode, saved sessions, fresh versions, inline lookup, and TTS.
- Review supports selecting learned words, generating review stories, and flashcard practice.
- Flashcard reviews update SM-2-style due scheduling.
- Progress aggregates learning activity, mastery, sentence stats, topics, and quiz scores.

## Observed Technical Requirements

- Runtime database is PostgreSQL through Prisma.
- Local and deployment environments need `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `ENCRYPTION_KEY`.
- Groq calls require a user-provided API key.
- API routes must derive user identity from the server session.
- App should remain deployable to Vercel.

## Constraints

- There is no observed automated test suite.
- Many database fields store serialized JSON in text columns, so schema-level validation is limited.
- External AI responses may be malformed; current code uses extraction and parsing helpers in some routes.
- Existing UI is implemented with Tailwind class strings and client components.
- `archive/` code should not be changed unless explicitly requested.

## Assumptions

- The README represents intended current behavior.
- The live product is the `web/` Next.js app.
- Existing `.env` values are local/private and should not be documented beyond variable names.

