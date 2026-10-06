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

## S10 — Application board

- Status: `DONE`
- Depends on: S09
- Intent: track job applications on a Kanban board with accessible drag-and-drop and a detail page ready for tailored documents and match results.
- Files: `PRD.md`, `package.json`, `app/db/schema.ts`, `drizzle/*`, `app/lib/applications.ts`, `app/lib/repositories.server.ts`, `app/components/application-card.tsx`, `app/components/application-board.tsx`, `app/routes/applications-board.tsx`, `app/routes/application-detail.tsx`, `app/routes/app-layout.tsx`, `app/routes.ts`, `tests/*`
- Acceptance:
  - `job_applications` table: owner FK (cascade), `company_name`, `position`, `location`, `job_description`, nullable integer `salary_min`/`salary_max`, `salary_currency` char(3) default `USD`, `salary_period` in `year|month|hour`, `status` in `saved|applied|interviewing|offer|rejected|withdrawn`, double `sort_order`, `source` in `manual|linkedin`, nullable `external_id`/`source_url`, `notes`, nullable `applied_at`, timestamps.
  - Database checks: salaries non-negative and `salary_min <= salary_max`; enum checks for status, period, source, and currency format. Index `(user_id, status, sort_order)`; partial unique `(user_id, source, external_id) where external_id is not null`. RLS enabled and Supabase roles revoked.
  - Pure `app/lib/applications.ts`: `applicationStatuses` with labels; `applicationInputSchema` requires company name and position, validates salary order, non-negative integers, ISO 4217-style uppercase currency, period, status, optional `https?` source URL, applied date; `formatSalaryRange` uses `Intl.NumberFormat` and handles min-only, max-only, equal, and empty ranges; `computeSortOrder(before?, after?)` returns midpoint/edge values and `needsRebalance` flags exhausted gaps; `groupApplicationsByStatus` orders cards by `sort_order`.
  - Repository methods `listApplications(userId, { q })`, `getApplication`, `createApplication` (appends to end of status column), `updateApplication`, `moveApplication(userId, id, status, sortOrder)`, `deleteApplication` all include the owner condition; moving rebalances a column when gaps are exhausted.
  - `/applications` shows one column per status with per-column and whole-board empty states; `?q=` filters by company, position, or location; action intents `move` (validated status/neighbour ids) and `delete` (requires confirmation); foreign IDs return 404.
  - Drag-and-drop via dnd-kit with pointer and keyboard sensors and screen-reader announcements; drop submits `intent=move` through a fetcher and shows optimistic placement from `fetcher.formData`; each card has a status `<select>` form that works without JavaScript; columns scroll horizontally on small screens.
  - `/applications/new` and `/applications/:applicationId` edit all fields (job description textarea, salary min/max/currency/period, status, notes, applied date); detail layout reserves Resume, Cover letter, and Match sections; delete requires confirmation checkbox.
  - Nav includes Applications.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; `pnpm db:migrate` on local PostgreSQL; dev-server smoke of create/move/filter/delete and cross-user 404.
- Evidence:
  - `pnpm test`: 114 tests across 10 files pass (`tests/applications.test.ts`: schema defaults, required-field messages, salary parsing/order/bounds, currency, status/period enums, URL scheme, applied date; `formatSalaryRange` full/equal/open-ended/unknown currency; `computeSortOrder`, `needsRebalance`, `planMove` placement/invalid neighbours/rebalance; `groupApplicationsByStatus`; `applyPendingMove`; `parseMoveFormData`).
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (60 files), `git diff --check` pass; `pnpm db:generate` reports no schema changes.
  - Local PostgreSQL 16: `pnpm db:migrate` applies `0004_job_applications.sql`; RLS enabled; raw inserts rejected for `salary_min > salary_max`, lowercase currency, unknown status, and duplicate `(user_id, 'linkedin', external_id)`; manual rows without `external_id` coexist.
  - Dev-server smoke (curl, two users): unauthenticated board redirects to sign-in; create 302; salary order and missing company return 400 with field messages; board renders `$150,000–$180,000/yr` and per-column empty states; neighbour-based move within and across columns, status-only move appends, invalid status 400, stale neighbour 409; detail status change appends to new column; crowded column rebalances to 1024/2048/3072; `?q=lisb` filters; `?q=%` treated literally; other user sees none of the cards and gets 404 on detail, edit, move, and delete, 409 when using a foreign neighbour id; delete without confirmation 400, with confirmation 200 (board) and 302 (detail).
  - Browser: computer-use walkthrough passed creation, validation, column `+ Add` status preset, card layout, status-select move, filter/clear, delete confirmation, and horizontal scroll at narrow width; its synthetic drag tool sends no intermediate pointer moves, so drags were verified with scripted Chrome (playwright-core, outside repo): mouse drag across columns and within a column, keyboard pick-up/arrow/drop across columns and within a column all submit `intent=move`, update immediately, and persist after reload; no console errors or hydration warnings; live-region announcements report target column and position.
- Notes:
  - Moves send neighbour ids (`beforeId`/`afterId`) instead of a client sort order; `placeApplication` recomputes the order inside a locked transaction via pure `planMove` and rebalances when gaps are exhausted. `moveApplication(userId, id, status, sortOrder)` remains the low-level setter.
  - One route `applications/:applicationId` serves both `new` and existing ids (same pattern as contributions). Creating redirects to the new card's detail page.
  - Board move/delete actions return 404 data instead of throwing so a fetcher failure does not replace the board with the error boundary.

## Handoff

- Current task: S10 `DONE`.
- Last completed action: S10 application board implemented, unit-tested, migration-tested on local PostgreSQL, curl-smoke-tested with two users, and drag-and-drop verified in Chrome.
- Verification: `pnpm test && pnpm typecheck && pnpm build && pnpm check` pass (114 tests, 10 files); `pnpm db:migrate` applies `0000`–`0004` locally.
- Blockers: Supabase migration and live Anthropic/OpenAI generation not exercised; no Supabase `DATABASE_URL`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` in environment.
- Changed files: `PRD.md`, `TASKS.md`, `package.json`, `pnpm-lock.yaml`, `app/db/schema.ts`, `drizzle/0004_job_applications.sql`, `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json`, `app/lib/applications.ts`, `app/lib/repositories.server.ts`, `app/components/application-card.tsx`, `app/components/application-board.tsx`, `app/routes.ts`, `app/routes/applications-board.tsx`, `app/routes/application-detail.tsx`, `app/routes/app-layout.tsx`, `tests/applications.test.ts`.
- Next task: S11 — Tailoring + cover letter (not yet in this file).
- First next action: add `S11 — Tailoring + cover letter` section above `## Handoff` with acceptance criteria from the resume and cover letter tailoring plan (nullable `application_id` FKs on `job_analyses`/`resumes`, `cover_letters` table, pure `app/lib/keyword-match.ts` and `app/lib/cover-letter.ts`, `generateCoverLetter` in `app/lib/ai.server.ts`, transactional `app/lib/tailoring.server.ts`, `applications/:applicationId/tailor` route, cover letter editor/PDF); remove "cover letters" from PRD non-goals; then start in `app/db/schema.ts` `jobAnalyses` table.
