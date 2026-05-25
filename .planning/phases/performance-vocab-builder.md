# Phase 1: Vocabulary Builder Performance

## Status

First pass implemented.

## Goal

Reduce the time from entering a word in Vocabulary Builder to seeing useful word information.

## Problem

The original Vocabulary Builder flow generated full word information and a 5-question quiz in one Groq request. That increased prompt size, output size, parsing time, and perceived wait time before the user could see the main word card.

## Completed Changes

- Split quiz generation out of the initial vocabulary generation request.
- Added `/api/learning/quiz` for on-demand quiz generation from a saved learning session.
- Changed Vocabulary Builder UI to show a separate `Generate quiz` action.
- Added cached word-bank return for words already saved by the user, skipping Groq for exact cached matches.
- Changed drill-down tag lookups to use the lighter `quickLookup` prompt.
- Reduced the initial vocabulary generation token budget.
- Cleared the Vocabulary Builder input after a successful search so the next word can be entered immediately.
- Kept failed searches retry-friendly by only clearing input after success.

## Files

- `web/app/api/learning/generate/route.ts`
- `web/app/api/learning/quiz/route.ts`
- `web/components/tabs/VocabBuilder.tsx`

## Verification

- `pnpm run build` passes.

## Remaining Follow-Up

- Measure deployed response time for new words and cached words.
- If new-word lookups are still slow, add timing logs around:
  - session/auth lookup
  - word-bank cache lookup
  - Groq request duration
  - JSON parse duration
  - database writes
- Consider a faster Groq model for first-pass vocabulary only if quality remains acceptable.
- Consider showing stale cached entries immediately while refreshing in the background if repeated-word UX becomes important.

## Out Of Scope

- Writing Practice.
- Word Bank export.
- Broad automated testing.
- Password reset email delivery.

