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

## S08 — Anthropic provider

- Status: `DONE`
- Depends on: S07
- Intent: run all reading/rewriting AI tasks through Anthropic (default) or OpenAI with per-provider encrypted BYOK and injectable models.
- Files: `package.json`, `.env.example`, `app/lib/env.server.ts`, `app/lib/ai-provider.server.ts`, `app/lib/ai.server.ts`, `app/lib/repositories.server.ts`, `app/db/schema.ts`, `drizzle/*`, `app/routes/ai-settings.tsx`, `app/routes/api-key-settings.tsx`, `app/routes/home.tsx`, `app/routes/analysis-result.tsx`, `app/routes/app-layout.tsx`, `app/routes.ts`, `tests/*`
- Acceptance:
  - `@ai-sdk/anthropic` installed; `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_DEFAULT_PROVIDER` validated server-side and documented in `.env.example`.
  - `resolveLanguageModel(userId)` uses preferred provider (user setting, else `AI_DEFAULT_PROVIDER`); user key beats platform key; neither raises `NoAiKeyError` with actionable message.
  - Credential repository methods require `userId` and `provider`; one key per provider per user.
  - `user_settings` table stores preferred provider; migration generated.
  - `analyzeJob`/`generateResume` accept `LanguageModel`; structured output schema failure retried once; second failure throws, nothing returned.
  - Client sees generic provider errors; server logs only provider, status, and error name.
  - `/settings/ai` lets user pick provider and test/save/revoke one masked key per provider; `/settings/api-key` redirects there; nav updated.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`
- Evidence:
  - `pnpm test`: 29 tests across 7 files pass (`tests/ai-provider.test.ts` precedence/no-key/safe-logging; `tests/ai.test.ts` mock-model retry-once, second failure throws, provider errors not retried).
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (43 files), `git diff --check` pass.
  - Local PostgreSQL 16: `pnpm db:migrate` applies `0000` and `0001`; `user_settings` has RLS enabled and provider check constraint.
  - Dev-server smoke (curl): unauthenticated `/settings/ai` redirects to sign-in; `/settings/api-key` returns 301 to `/settings/ai`; set-provider persists; invalid provider returns 400; short key rejected; bogus Anthropic key rejected by provider (401) and not stored; server log contains only operation/provider/name/status; analysis with no key returns `No Anthropic API key is configured…` (400).
- Notes:
  - `ai` bumped to 7.0.127 and `@ai-sdk/openai` to 4.0.83 so all AI SDK packages share `@ai-sdk/provider` 4.0.21; older `ai` failed `tsc` with incompatible `LanguageModelV4`.
  - `@ai-sdk/anthropic` already strips JSON-schema keywords Anthropic rejects while AI SDK validates against full Zod schema; no relaxed generation schema needed.
  - Default `ANTHROPIC_MODEL` is `claude-sonnet-5-5`.

## S09 — Contributions workspace

- Status: `DONE`
- Depends on: S08
- Intent: edit each position's contributions as a Markdown file inside a company-grouped workspace.
- Files: `PRD.md`, `package.json`, `app/db/schema.ts`, `drizzle/*`, `app/lib/repositories.server.ts`, `app/lib/contributions.ts`, `app/lib/validation.ts`, `app/components/markdown-editor.tsx`, `app/routes/contributions*.tsx`, `app/routes/contribution-*.tsx`, `app/routes/experience-editor.tsx`, `app/routes/profile.tsx`, `app/routes/app-layout.tsx`, `app/routes.ts`, `tests/*`
- Acceptance:
  - `companies` table owned by user with case-insensitive unique name; `experiences.company_id` non-null owner-composite FK that blocks deleting a company with positions (`on delete no action`); migration backfills companies from existing `experiences.company` text and drops that column; RLS enabled and Supabase roles revoked.
  - Experience queries still return `company` name so analysis/resume code is unchanged; every company/experience query includes owner condition; a foreign `companyId` is rejected.
  - `groupExperiencesByCompany` (pure) orders companies by most recent role (current roles first) and positions by start date descending; companies without positions still appear.
  - `/contributions` shows keyboard-navigable company→position tree with `aria-current`; empty state when no companies.
  - `/contributions/:experienceId` edits metadata and Markdown; textarea works without JavaScript; CodeMirror replaces it after hydration; toolbar inserts heading, bullet, bold, and contribution template; edit/preview toggle.
  - Autosave via debounced fetcher (intent `autosave`) persists Markdown only; status `role="status"` shows saved/unsaved/error; navigation with unsaved changes asks for confirmation.
  - Multiple `.md` import appends or replaces with confirmation; `?download=1` export stays (redirects to `/contributions/:experienceId/download`).
  - `/contributions/companies/:companyId` renames/edits company; delete only when no positions and requires confirmation checkbox.
  - `/profile/experiences/:id` redirects to `/contributions/:id`; profile links to contributions; nav includes Contributions.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; `pnpm db:migrate` on local PostgreSQL with pre-existing experience rows.
- Evidence:
  - `pnpm test`: 68 tests across 9 files pass (`tests/contributions.test.ts` grouping/ordering, template, import merge, file name, date label; `tests/markdown-format.test.ts` toolbar transforms; `tests/validation.test.ts` company choice, Markdown, and company schemas).
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (54 files) pass; `pnpm db:generate` reports no schema changes.
  - Local PostgreSQL 16, seeded with pre-existing experiences for two users (including `" acme "` vs `"Acme"`): `0002` backfills one company per user per case-insensitive name and links every experience; `0003` drops `experiences.company`; composite FK rejects pointing a position at another user's company; deleting a company with positions fails; user delete still cascades; `companies` RLS enabled. Fresh empty-database `pnpm db:migrate` also applies `0000`–`0003`.
  - Dev-server smoke (curl, two users): create company 302; case-insensitive duplicate 409; create position with existing company and with new company name 302; tree lists current-role company first; autosave 200 and short Markdown 400; legacy `/profile/experiences/:id?download=1` 301 → `?download=1` 302 → `/contributions/:id/download` 200 `text/markdown` attachment containing autosaved text; other user gets 404 on read, autosave, download, company view, and company delete, and 400 when attaching a position to a foreign company; company delete without confirmation 400, with positions 409, empty 302; invalid ids 404; profile links to `/contributions`.
  - Browser walkthrough (Chrome): CodeMirror replaces textarea after hydration; bold toolbar wraps selection and preview renders it; create redirects with `aria-current` file highlighted; autosave status goes unsaved → saved and survives reload; short text shows `Autosave failed: …`; leaving with unsaved changes opens confirmation dialog and Stay keeps page; multi-file import append and replace with confirmation persist; write/split/preview toggle; arrow-key tree focus; profile shows summary link only.
- Notes:
  - FK uses `on delete no action` instead of `restrict`: same protection for direct company delete, but checked at statement end so user-delete cascade cannot fail on trigger order. Repository also refuses deleting a company with positions.
  - Migration is split into `0002_companies.sql` (create, backfill, enforce) and `0003_drop_experience_company_text.sql` to avoid drizzle-kit's interactive rename prompt; `0002` is hand-edited and its snapshot matches schema.
  - Export moved to resource route `contributions/:experienceId/download` (returning a `Response` from a UI route loader is treated as data in React Router 8 and crashed the page); `?download=1` redirects there.
  - CodeMirror is lazy-loaded (`app/components/codemirror-markdown.tsx`, ~211 kB gzip chunk) only on the editor route.

## Handoff

- Current task: S09 `DONE`.
- Last completed action: S09 contributions workspace implemented, unit-tested, migration-tested on seeded local PostgreSQL, and smoke-tested via curl and browser.
- Verification: `pnpm test && pnpm typecheck && pnpm build && pnpm check` pass (68 tests, 9 files); `pnpm db:migrate` applies `0000`–`0003` locally.
- Blockers: Supabase migration and live Anthropic/OpenAI generation not exercised; no Supabase `DATABASE_URL`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` in environment.
- Changed files: `PRD.md`, `TASKS.md`, `package.json`, `pnpm-lock.yaml`, `app/app.css`, `app/db/schema.ts`, `drizzle/0002_companies.sql`, `drizzle/0003_drop_experience_company_text.sql`, `drizzle/meta/*`, `app/lib/contributions.ts`, `app/lib/markdown-format.ts`, `app/lib/validation.ts`, `app/lib/repositories.server.ts`, `app/lib/ai.server.ts`, `app/components/markdown-editor.tsx`, `app/components/codemirror-markdown.tsx`, `app/routes.ts`, `app/routes/contributions.tsx`, `app/routes/contributions-index.tsx`, `app/routes/contribution-file.tsx`, `app/routes/contribution-company.tsx`, `app/routes/contribution-download.ts`, `app/routes/experience-editor.tsx`, `app/routes/profile.tsx`, `app/routes/home.tsx`, `app/routes/app-layout.tsx`, `tests/contributions.test.ts`, `tests/markdown-format.test.ts`, `tests/validation.test.ts`, `tests/ai.test.ts`.
- Next task: S10 — Application board (not yet in this file).
- First next action: add `S10 — Application board` section above `## Handoff` with acceptance criteria from the job application tracking board plan: `job_applications` table (`company_name`, `position`, `location`, `job_description`, `salary_min`/`salary_max`/`salary_currency`/`salary_period`, `status` in `saved|applied|interviewing|offer|rejected|withdrawn`, fractional `sort_order`, `source`/`external_id`/`source_url`, `notes`, `applied_at`), salary checks, `(user_id, status, sort_order)` index and partial unique `(user_id, source, external_id)`; pure `app/lib/applications.ts` (`applicationStatuses`, `applicationInputSchema`, `formatSalaryRange`, `computeSortOrder`); then start in `app/db/schema.ts` after the `experiences` table.
