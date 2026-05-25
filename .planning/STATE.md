# State

## Adoption Date

2026-05-25

## Current Phase

Performance improvement for the current deployed app.

## Current Working Tree

At adoption start, `git status --short` reported no changes.

## What Is Known

- The current app lives in `web/`.
- The app uses Next.js, TypeScript, Tailwind, NextAuth, Prisma, PostgreSQL, Groq, and Edge TTS.
- The repository did not have a `.planning/` directory before adoption.
- Root `CLAUDE.md` did not exist before adoption.
- `internal-info/CLAUDE.md` is stale relative to the live Next.js code.
- No automated test script is declared in `web/package.json`.
- Current user priority is website speed, especially Vocabulary Builder response time.
- Automated coverage and word-bank export are deferred.
- Password reset email delivery is intentionally pending because this is a personal student project without a custom domain. The reset-token code exists, but production email sending should stay disabled until a domain is available or a no-domain sender option is chosen.
- `internal-info/` is retained as user learning reference material.
- Local/development and production should use separate Neon databases.
- README is documentation; `.planning/STATE.md` and `.planning/ROADMAP.md` are the near-term priority source.
- Build verification should use `pnpm run build`.

## Verification Performed During Adoption

- Read repository tree.
- Read README.
- Read package, Prisma schema, auth, Groq, encryption, middleware, and representative UI/API files.
- Checked git status.
- Ran `npm run build` in `web/`; Prisma Client generation and Next.js production build completed successfully.
- After the Vocabulary Builder performance change, ran `npm run build` in `web/` again; build completed successfully and included the new `/api/learning/quiz` route.
- After the later Vocabulary Builder input-clear change, `pnpm run build` was used for verification.

## Verification Not Performed

- No local database or external Groq call was exercised.
- No browser QA was performed.

## Next Action

Measure the deployed Vocabulary Builder result time after the quiz split and input-clear change. If new-word lookups are still slow, add timing logs around Groq and database operations to identify the remaining bottleneck.

When revisiting password reset, either verify a custom sending domain for Resend or replace Resend with a sender that fits a no-domain personal deployment.
