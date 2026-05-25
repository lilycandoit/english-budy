# Decisions

## Current App Location

Decision: Treat `web/` as the current application.

Rationale: README and live code structure identify `web/` as the Next.js app with current feature routes and dashboard components.

## Archived Code

Decision: Treat `archive/js-version-old/` as historical.

Rationale: It contains the old FastAPI and vanilla JS implementation, while the README and `web/` contain the active Next.js implementation.

## Stale Internal Notes

Decision: Do not use `internal-info/CLAUDE.md` as the source of truth.

Rationale: It documents an old stack and migration phases that are already represented in the current `web/` implementation.

## Planning Source Of Truth

Decision: Use root `CLAUDE.md` and `.planning/` for future assistant context.

Rationale: The repository lacked Lily planning files, and adoption requires a reliable planning baseline.

## Product Code During Adoption

Decision: Do not edit product code during adoption.

Rationale: The adoption workflow requires documenting the existing system before changing behavior.

## Keep Internal Learning Notes

Decision: Keep `internal-info/` as user learning reference material.

Rationale: The folder may still be useful for understanding how the project evolved. It is historical reference only and should not override root `CLAUDE.md` or `.planning/`.

## Local Environment File

Decision: Keep `web/.env` in the local workspace, excluded from git.

Rationale: The project uses local environment variables for Neon, NextAuth, encryption, and related services. Secrets should remain local or in Vercel environment variables.

## Database Environments

Decision: Use separate Neon databases for local/development and production.

Rationale: Separating data reduces the chance that local testing changes production user data.

## Package Manager

Decision: Use `pnpm` for dependency and build commands.

Rationale: The active app has `web/pnpm-lock.yaml`, so verification should prefer commands such as `pnpm run build`.

## AI Payload Storage

Decision: Keep AI payload fields as text columns containing JSON for now.

Rationale: Migrating selected fields to Prisma `Json` may improve future querying and validation, but it is not needed for the current performance and personal-usability priorities. Most current flows read and write whole AI payloads.

## README Roadmap Priority

Decision: Treat README as product documentation, not the authoritative next-work queue.

Rationale: The README lists planned features such as Writing Practice and Word Bank export, but the current user priority is performance. `.planning/STATE.md` and `.planning/ROADMAP.md` should guide near-term work.

## Password Reset Email Delivery

Decision: Leave production password reset email delivery pending.

Rationale: This is currently a personal student project without a custom domain, and password reset is not needed now. The reset-token code can remain available, but email sending should stay disabled until the app scales to more users or a no-domain sender is deliberately chosen.

Future options:

- Manual database reset remains acceptable while the app is personal.
- Gmail app-password SMTP is the likely best no-domain option if reset email becomes necessary before buying a domain.
- Resend remains a good option later if a custom domain is added.

