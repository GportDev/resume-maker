# Task Management

## Status

Allowed values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

Only one task may be `IN_PROGRESS`. Complete dependencies in order. Update handoff before stopping.

## S01 — Product specifications

- Status: `DONE`
- Depends on: none
- Intent: establish product, engineering, and execution contracts.
- Files: `PRD.md`, `AGENTS.md`, `TASKS.md`
- Acceptance:
  - Product scope, flows, non-goals, security, and measurable criteria defined.
  - Agent workflow includes exact pickup protocol.
  - Every implementation task below has scope and verification.
- Verify: review all three files for contradictions and missing task dependencies.

## S02 — Foundation and database

- Status: `DONE`
- Depends on: S01
- Intent: create typed server foundation, schema, migrations, and encrypted credential storage.
- Files: `package.json`, `.env.example`, `drizzle.config.ts`, `app/lib/env.server.ts`, `app/lib/db.server.ts`, `app/db/*`, `tests/*`
- Acceptance:
  - Dependencies and scripts install with pnpm.
  - Schema includes Better Auth and product tables with ownership indexes.
  - User key encryption round-trips and rejects tampering.
  - Browser code cannot import server secrets.
- Verify: `pnpm test && pnpm typecheck`

## S03 — Authentication and app shell

- Status: `DONE`
- Depends on: S02
- Intent: secure all product routes with Better Auth and provide usable account flow.
- Files: `app/lib/auth*`, `app/routes/auth*`, `app/routes/app-layout.tsx`, `app/routes.ts`
- Acceptance:
  - Sign-up, sign-in, sign-out work through `/api/auth/*`.
  - Protected loader redirects unauthenticated user.
  - Authenticated shell shows navigation and account identity.
  - Ownership helper never accepts user ID from form input.
- Verify: auth tests, `pnpm typecheck`

## S04 — Profile and experiences

- Status: `DONE`
- Depends on: S03
- Intent: manage reusable verified experience evidence.
- Files: `app/routes/profile*`, `app/lib/repositories.server.ts`, `app/components/*`
- Acceptance:
  - Profile and experience CRUD validate input and enforce owner.
  - Markdown edit/preview and `.md` import/export work.
  - Current role disables end date; invalid date ranges fail.
  - Empty and pending states are accessible.
- Verify: experience/domain tests, `pnpm typecheck`

## S05 — Job analysis

- Status: `DONE`
- Depends on: S04
- Intent: analyze job text, produce transparent score, gaps, and resources.
- Files: `app/lib/ai.server.ts`, `app/lib/analysis.ts`, `app/routes/home.tsx`, `app/routes/analysis.tsx`
- Acceptance:
  - AI output validated before persistence.
  - Matches cite owned experience IDs.
  - Score is deterministic and factor breakdown totals correctly.
  - Missing skills map only to allowlisted learning URLs.
  - User key is preferred; platform key is fallback.
- Verify: analysis/credential tests with mocked model, `pnpm typecheck`

## S06 — Resume editor and PDF

- Status: `DONE`
- Depends on: S05
- Intent: generate truthful editable resume and selectable-text PDF.
- Files: `app/lib/resume*`, `app/routes/resume.tsx`, `app/components/resume-pdf.tsx`
- Acceptance:
  - Generated claims cite source experiences.
  - User can edit and persist summary, skills, and bullets.
  - Preview is one-column and standard-section ATS layout.
  - PDF download contains selectable text.
- Verify: resume schema tests, `pnpm typecheck`, manual PDF smoke test.

## S07 — Polish and release verification

- Status: `DONE`
- Depends on: S06
- Intent: finish responsive/accessibility states and verify complete flow.
- Files: all touched files, this handoff
- Acceptance:
  - Core flow works from account creation through PDF.
  - No obvious secret, cross-user, keyboard, or mobile layout issue.
  - Test, typecheck, and production build pass.
  - Handoff below records exact evidence and next action.
- Verify: `pnpm test && pnpm typecheck && pnpm build`

## Handoff

- Current task: none; MVP implementation complete.
- Last completed action: Biome 2.5.4 linting, formatting, import organization, Tailwind CSS parsing, and package scripts configured; unused starter assets removed.
- Verification: `pnpm check` passes 38 files; `pnpm test` passes 12 tests across 5 files; `pnpm typecheck`, `pnpm build`, and `git diff --check` pass.
- Blockers: live database migration and browser end-to-end flow require project environment credentials; no credentials were present in repository.
- Changed files: product/task specs; dependencies and environment template; Biome config; Drizzle schema/migration; auth/app shell; profile and Markdown experience CRUD; encrypted BYOK; analysis/scoring/resources; resume editor/PDF; tests and global styling.
- Next task: operational setup.
- First next action: copy `.env.example` to `.env`, supply Supabase/Better Auth/OpenAI/encryption values, run `pnpm db:migrate`, then smoke-test sign-up through PDF download with `pnpm dev`.
