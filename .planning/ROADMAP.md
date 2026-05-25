# Roadmap

## Current Status

The visible README roadmap marks the core product features complete and lists Writing Practice plus Word Bank export as planned. The code also appears to contain the main migrated Next.js flows.

## Current Priority

Performance improvement is the top priority, especially reducing the time from submitting a word in Vocabulary Builder to seeing the first useful word result.

Phase 2 automated coverage and Phase 4 export are intentionally deferred because they are not important to the current product direction.

## Recommended Phases

### Phase 1: Speed Up Vocabulary Builder

Plan file: `phases/performance-vocab-builder.md`

Goal: reduce perceived and actual latency in the slowest learning flow.

Completed first pass:

- Split quiz generation out of the initial vocabulary generation request.
- Added on-demand quiz generation for saved learning sessions.
- Added immediate cached returns for words already in the user's word bank.
- Switched drill-down tag lookups to the lighter quick-lookup prompt.
- Reduced initial vocabulary generation token budget.

Candidate follow-up:

- Add simple timing logs around Groq calls and database writes.
- Consider showing cached entries before refreshing stale AI data.
- Consider a faster Groq model for first-pass vocabulary if quality is acceptable.
- Consider streaming or partial rendering if a future model/provider supports it cleanly.

### Deferred: Add Basic Automated Coverage

This is useful later, but not a current priority. When revisited, prefer a small test suite for AI JSON parsing, auth basics, password reset token logic, and SM-2 scheduling over broad UI testing.

### Later: Writing Practice

Goal: implement the planned Writing Practice tab.

Candidate work:

- Define exact writing exercise behavior.
- Add Prisma model(s) if persistent history is needed.
- Add API route and dashboard tab.
- Add progress integration if appropriate.

### Deferred: Export Word Bank

This is useful later, but not a current priority.

## Recommended First Plan

Measure the deployed Vocabulary Builder after the quiz split and cached-word path. If it is still too slow for new words, add timing instrumentation and compare Groq model/output-size tradeoffs.
