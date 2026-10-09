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

## S11 — Tailoring + cover letter

- Status: `DONE`
- Depends on: S08, S10
- Intent: tailor a resume and a new cover letter to one application's job description, show per-position keyword matches, and save both documents on the application card atomically.
- Files: `PRD.md`, `app/db/schema.ts`, `drizzle/*`, `app/lib/analysis.ts`, `app/lib/keyword-match.ts`, `app/lib/cover-letter.ts`, `app/lib/applications.ts`, `app/lib/ai.server.ts`, `app/lib/tailoring.server.ts`, `app/lib/repositories.server.ts`, `app/components/analysis-summary.tsx`, `app/components/cover-letter-pdf.tsx`, `app/components/application-card.tsx`, `app/routes/application-tailor.tsx`, `app/routes/application-detail.tsx`, `app/routes/applications-board.tsx`, `app/routes/home.tsx`, `app/routes/analysis-result.tsx`, `app/routes/resume-editor.tsx`, `app/routes/cover-letter-editor.tsx`, `app/routes/cover-letter-pdf.tsx`, `app/routes.ts`, `tests/*`
- Acceptance:
  - `job_analyses.application_id` and `resumes.application_id`: nullable FKs to `job_applications` with `on delete set null` and indexes. New `cover_letters` table: owner FK (cascade), nullable `application_id` (set null), `analysis_id` (cascade), `title`, `content` jsonb, timestamps, owner/application/analysis indexes. RLS enabled and Supabase roles revoked.
  - Pure `matchKeywordsToExperiences(analysis, experiences)` returns, per experience, `{ experienceId, matchedKeywords, matchedRequiredSkills }` plus global `unmatchedKeywords`, using `normalize` exported from `app/lib/analysis.ts`, whole-term matching, and deduplicated keywords.
  - Pure `coverLetterContentSchema` (`recipient`, `opening`, `bodyParagraphs[{ text, sourceExperienceIds[] }]`, `closing`) requires at least one paragraph, each citing at least one experience; `sanitizeCoverLetterEvidence` drops unowned IDs and uncited paragraphs, failing when none remain; `applyCoverLetterEdits` replaces text and keeps citations.
  - `generateCoverLetter({ model, profile, experiences, analysis, application })` uses structured output with one retry; system prompt forbids invented evidence and company facts beyond the job description and requires every paragraph to cite experience IDs.
  - `app/lib/tailoring.server.ts`: `runTailoringAnalysis(userId, applicationId, jobDescription)` saves the job description on the application, analyzes it, sanitizes experience IDs, scores deterministically, and saves the analysis linked to the application. `generateTailoredDocuments(user, applicationId, analysisId)` generates the resume and cover letter in parallel, validates and sanitizes both, then inserts both in one transaction; if either fails, nothing is persisted. Dependencies (repositories, model resolver, logger) are injectable. Foreign or unlinked IDs return not-found.
  - `/applications/:applicationId/tailor`: job description textarea prefilled from the application; intent `analyze` shows keyword chips, per-position match table, score factors, evidence, and gaps (shared `app/components/analysis-summary.tsx`); intent `generate` creates both documents and redirects to the application detail. Provider failures show a generic error.
  - `/` is the quick-tailor entry: paste a job description and pick an existing application or create one (position/company from analysis), then redirect to the tailor page.
  - `/cover-letters/:coverLetterId` edits recipient, opening, paragraphs, and closing with preview; `/cover-letters/:coverLetterId/pdf` downloads a selectable-text PDF (`app/components/cover-letter-pdf.tsx`, resume PDF styles).
  - Board cards and application detail show the latest fit score, Resume and Cover letter links, and a Tailor action. `/analyses/:analysisId` stays as a read-only legacy view.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; `pnpm db:migrate` on local PostgreSQL; dev-server smoke of tailor page, documents on card, cover letter edit/PDF, and cross-user 404.
- Evidence:
  - `pnpm test`: 147 tests across 13 files pass (`tests/keyword-match.test.ts`: whole-term matching, dedupe, required skills via cited matches, unmatched keywords; `tests/cover-letter.test.ts`: schema bounds, sanitizer drops foreign IDs and uncited paragraphs, edits keep citations, sender fallback, date format; `tests/tailoring.test.ts`: 14 orchestration cases including not-found, no-experiences, no-key, ai-failed logging, quick tailor new/existing, both documents persisted together, cover letter or resume failure persists nothing, all-foreign citations persist nothing, unlinked analysis, transaction ownership reject; `tests/ai.test.ts`: `generateCoverLetter` structured output, retry, and prompt rules; `tests/pdf.test.tsx`: cover letter PDF has selectable text).
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (71 files) pass; `pnpm db:generate` reports no schema changes.
  - Local PostgreSQL 16: `pnpm db:migrate` applies `0005_tailoring_cover_letters.sql`; `cover_letters` RLS enabled; deleting an application keeps its analysis/resume/cover letter with `application_id` null.
  - Dev-server smoke (curl, two users, fake Anthropic server via `ANTHROPIC_BASE_URL`): tailor page empty state; short job description 400; analyze 302 saves the job description and drops a foreign experience ID; chips show matched and missing keywords; generate 302 to `?tailored=1` with resume and cover letter linked to the application and a paragraph citing only a foreign ID dropped; detail and board card show fit score and links; cover letter edit validates (400 with message) and saves; PDF 200 `application/pdf`; forced cover letter failure returns 502 "Generation failed. Nothing was saved…" with document counts unchanged; other user gets 404 on tailor GET/analyze/generate, cover letter, PDF, resume, analysis, and quick tailor with a foreign application; invalid IDs 404; unauthenticated requests redirect to sign-in; quick tailor creates "position @ company" application plus analysis or reuses an existing one; legacy analysis view has no generate action; logs contain only operation, provider, and error name.
  - Browser (scripted Chrome via playwright-core, outside repo): home quick tailor → tailor page per-position table (Senior Engineer/Acme matched TypeScript, PostgreSQL, React; Developer/Initech matched Terraform) → generate shows saved status; board card shows Fit, Tailor, Resume, Cover letter; cover letter greeting edit updates preview; editing the job description shows the "changed since" notice; no console errors or hydration warnings.
- Notes:
  - `application_id` columns are single-column FKs; ownership of application and analysis is checked inside the insert transactions (`ownsApplication` with `for share`) instead of composite FKs.
  - The job description is saved on the application before the AI call so it survives a provider failure.
  - Quick tailor with "new application" creates the application and analysis in one transaction; company falls back to "Company not specified".
  - `/analyses/:analysisId` is read-only; the old standalone `createResume` path was removed, so documents are only created through `createTailoredDocuments`.
  - Cover letter sender name/email/contact come from the profile or account at render time, not stored in `content`.

## S12 — Jev job match

- Status: `DONE`
- Depends on: S10, S11
- Intent: use TypeSafe Jev typed decisions to verify which stored position demonstrates each job requirement, turn them into a deterministic match result with review flags, and feed only verified evidence into resume and cover letter generation.
- Files: `PRD.md`, `.env.example`, `app/lib/env.server.ts`, `app/lib/jev.server.ts`, `app/lib/job-match.ts`, `app/lib/job-match.server.ts`, `app/lib/tailoring.server.ts`, `app/lib/ai.server.ts`, `app/lib/applications.ts`, `app/lib/repositories.server.ts`, `app/db/schema.ts`, `drizzle/*`, `app/components/job-match-panel.tsx`, `app/components/application-card.tsx`, `app/components/analysis-summary.tsx`, `app/routes/application-detail.tsx`, `app/routes/application-tailor.tsx`, `app/routes/applications-board.tsx`, `tests/*`
- Acceptance:
  - Env: optional `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` default `jev-latest`, optional `TYPESAFE_BASE_URL` default `https://api.typesafe.ai`. App boots and tailors without them.
  - `app/lib/jev.server.ts`: `JevClient.systemOne({ state, questions })` posts to `/v1/systemone` with bearer key and model; Zod validates request and response (`model`, `answers` per question ID with `choice`/`probabilities`/`confidence`, `score`/`confidence`, `noul`; `usage`); answers missing or of the wrong type are rejected; API `noul` is normalized to a `boolean` answer with `probability`. Retries 429/529 up to 3 attempts with bounded exponential backoff honoring `Retry-After`; no retry on 401/422 or other statuses; request timeout. Logs only status, model version, and token usage.
  - Pure `app/lib/job-match.ts`: `buildMatchQuestions(analysis, experiences)` emits stable IDs `req_<i>`/`pref_<i>` as `choice` questions keyed by experience ID plus `none` (max 255 options), `seniority` (`score`, 4-level rubric), `domainFit` (`boolean`); `buildMatchState` and `chunkExperiences` keep each call under the state token budget (~chars/4) and option limit; `mergeChunkAnswers` keeps the highest-probability position, the lowest `none` probability, the highest seniority, and the highest domain-fit probability; `evaluateMatchPolicy` marks requirements verified (choice ≠ none, p ≥ 0.7, confidence ≥ 0.6), missing (none p ≥ 0.7), else needs review (including missing answers or confidence); `scoreMatch` computes 0–100 (required 70, preferred 15, seniority 15) and recommendation `strong_match | worth_tailoring | weak_match | needs_review` with overrides applied; thresholds and `QUESTION_VERSION` are named constants; `reconcileAnalysisMatches` splits analysis matches into verified and unverified.
  - `job_matches` table: owner FK (cascade), nullable `application_id` (set null), `analysis_id` (cascade), `model_version`, `question_version`, `answers` jsonb, `result` jsonb, timestamps, owner/application/analysis indexes. RLS enabled and Supabase roles revoked. Repositories require `userId`; insert checks application ownership and analysis link in one transaction; jsonb is Zod-validated on read.
  - `app/lib/job-match.server.ts`: `runJobMatch(userId, applicationId, analysisId)` returns not-found for foreign or unlinked IDs, not-configured without a key, and a generic failure on client errors (safe diagnostics logged); persists answers and result. `setJobMatchOverride` accepts or rejects only needs-review requirements and recomputes the score.
  - Tailoring: when Jev is configured, analysis runs the match after saving (match failure does not fail analysis). Generation uses the latest match for the analysis: only verified pairs are sent as matches and as `verifiedEvidence`; without a match, behavior is unchanged.
  - Application detail: Match section with recommendation, match %, seniority and domain fit, per-requirement chosen position, probability, and review flag; accept/reject for needs-review items; Run match action; heuristic disclaimer. Tailor page flags unverified analysis matches. Board card shows recommendation and match %.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; `pnpm db:generate` reports no changes after the migration.
- Evidence:
  - `pnpm test`: 205 tests across 16 files pass. `tests/job-match.test.ts` (28): stable `req_`/`pref_` IDs, `none` option, 255-option guard, empty-input guard, state shape and token estimate, chunking by budget and option limit, merge rules, threshold boundaries (0.7/0.6 inclusive, just-below values, missing answer or confidence → needs review), score weights and recommendations, overrides, schema round trip, reconcile verified/unverified. `tests/jev-client.test.ts` (15): request body and bearer header, noul → boolean, probabilities filtered to criteria, null confidence, Zod rejections (missing/wrong-type answer, choice outside criteria, non-JSON), request validated before fetch, 429 `Retry-After` and 529 backoff then success, `retry-after-ms` capped, no retry on 401/422/500, network error wrapped, logs carry only status/model/usage. `tests/job-match-server.test.ts` (11): run persists answers per chunk and result, not-configured, foreign/unlinked not-found, no-experiences, Jev failure logged and nothing saved, transaction ownership reject, override accept recomputes score, override on verified rejected, foreign/mismatched/invalid stored match not-found, stored JSON validation, generic failure messages. `tests/tailoring.test.ts` (+6): match runs after analysis and quick tailor, match exception keeps the analysis, generation receives only verified pairs and `verifiedEvidence` with the system rule, unverified matches dropped, no match keeps prior prompts.
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (81 files) pass; `pnpm db:generate` reports no schema changes.
  - `pnpm db:migrate` not run: no local PostgreSQL in this environment, and the only configured database is the user's remote Neon instance. `drizzle/0006_job_matches.sql` is generated and includes RLS enable plus the `anon`/`authenticated` revoke block.
- Notes:
  - Added `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`) for tests and proxies, and an `updated_at` column so override edits are timestamped.
  - Jev failures never block analysis or generation; generation falls back to unchanged behavior when no valid match exists for the analysis.
  - Match recommendation is `needs_review` while any required item is unresolved; accepting a needs-review item requires a chosen position.
  - Design hook false positives (near-black text on cyan primary buttons) are ignored per file in untracked `.impeccable/config.json` for `app/routes/application-detail.tsx` and `app/routes/application-tailor.tsx`.
  - Live Jev calls, dev-server smoke, and browser check not exercised: no `TYPESAFE_API_KEY` and no local database.

## S13 — LinkedIn listings

- Status: `DONE`
- Depends on: S10 (applications with the `(user_id, source, external_id)` unique index); S11 and S12 are optional follow-on actions.
- Intent: search LinkedIn job listings through a licensed aggregator API behind a pluggable provider, save listings to the board without duplicates, and jump straight into tailoring.
- Files: `PRD.md`, `.env.example`, `app/lib/env.server.ts`, `app/lib/job-listings.ts`, `app/lib/job-listings.server.ts`, `app/lib/applications.ts`, `app/lib/repositories.server.ts`, `app/components/application-card.tsx`, `app/routes.ts`, `app/routes/job-search.tsx`, `app/routes/app-layout.tsx`, `app/routes/applications-board.tsx`, `app/routes/application-detail.tsx`, `tests/*`
- Acceptance:
  - Env: `JOB_LISTINGS_PROVIDER` (`fantastic_jobs`, default), optional `RAPIDAPI_KEY`, and `JOB_LISTINGS_BASE_URL` (default `https://linkedin-job-search-api.p.rapidapi.com`, for proxies and smoke tests). App boots without them; `/jobs` shows a not-configured state and never calls a provider.
  - Pure `app/lib/job-listings.ts`: `JobListing` type; `jobSearchInputSchema` parses URL params (keywords 2–120 chars required, location ≤ 120, `postedWithin` `24h|7d|30d` default `7d`, remote flag, page 1–20 default 1); `htmlToPlainText` strips tags, drops script/style content, keeps paragraph and list breaks, decodes named and numeric entities once; `linkedInJobUrl(id)` returns `https://www.linkedin.com/jobs/view/{id}` only for IDs matching `^\d+$` and throws otherwise; `jobListingSchema` validates listings and `saveListingFormSchema` validates the posted intent plus listing JSON; `listingToApplicationInput(listing)` returns a valid `ApplicationInput` (status `saved`, `sourceUrl` from `linkedInJobUrl`, truncated title/company/location, description, salary) plus origin `{ source: "linkedin", externalId }`, or null when the listing cannot become a valid application.
  - `app/lib/job-listings.server.ts`: `JobListingProvider.search(input)` returns `{ listings, hasMore }`. `FantasticJobsProvider` calls `GET https://linkedin-job-search-api.p.rapidapi.com/active-jb` with `x-rapidapi-key`/`x-rapidapi-host`, `title`, `location`, `time_frame` (`24h`, `7d`, or `6m` plus `date_posted_gte` for 30 days), `ai_work_arrangement=Remote OK,Remote Solely` when remote, `description_format=html`, `limit=25`, `offset`. Zod validates the array response; rows without a numeric LinkedIn ID (from `linkedin_id` or a `linkedin.com/jobs/view` URL) are dropped; salary maps from `ai_salary_*` only for year/month/hour units, ISO currency, and min ≤ max. 10 s timeout; non-200, timeout, network, and schema failures raise one generic `JobListingProviderError`; logs carry only provider and status.
  - Repositories: `saveListingApplication(userId, input, externalId)` inserts with `ON CONFLICT DO NOTHING` and returns `{ applicationId, created }`, returning the existing owned row on conflict; `listSavedListingIds(userId, externalIds)` maps saved LinkedIn IDs to application IDs.
  - `/jobs` (`routes/job-search.tsx`): GET form keeps search in the URL; loader validates and calls the provider only with valid input; results show title, company, location, salary, posted date, and "View on LinkedIn"; listings already saved show "On your board" with a link. Action `save` creates a Saved application or reports "Already on your board" with a link; `save-and-tailor` redirects to `/applications/:id/tailor`. Saving does not re-run the search. Loading, empty, invalid-input, provider-error, and not-configured states.
  - Board cards and application detail show the LinkedIn badge and a posting link built from the external ID. Nav includes "Find jobs".
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; live smoke needs `RAPIDAPI_KEY`.
- Evidence:
  - `pnpm test`: 261 tests across 18 files pass. `tests/job-listings.test.ts` (36): `htmlToPlainText` breaks, script/style/comment removal, single-pass entity decoding, invalid code points, bare `<`/`>` text; `linkedInJobUrl` accepts digits and rejects empty, letters, traversal, whitespace, and over-long IDs; search params idle/defaults/all filters and every invalid field; page links; application mapping, truncation, company fallback, bad ID; save form rejects broken JSON, tampered ID, inverted salary, unknown intent, missing listing; UTC posted date. `tests/job-listings-provider.test.ts` (20) with `tests/fixtures/fantastic-jobs-active-jb.json`: keeps 4 of 8 rows (drops duplicate, non-LinkedIn URL, wrong-type, and blank-title rows), full normalization, URL-derived ID, telecommute → Remote, hourly single salary, drops weekly salary/inverted range/bad date/unknown arrangement, non-array rejected; URL params for 24h/remote/page 3 and 30d → `6m` + `date_posted_gte`; RapidAPI headers and timeout signal; `hasMore` only for a full page below page 20; HTTP 401/403/429/500, network error, 20 ms timeout (`TimeoutError` cause), non-JSON and non-array bodies all raise the generic error; logs carry only provider and status (no body, no key); skipped rows log a count; env without key returns no provider.
  - `pnpm typecheck`, `pnpm build`, `pnpm check` (87 files) pass; `pnpm db:generate` reports no schema changes.
  - Local smoke (Docker `postgres:16` on a throwaway container, fake aggregator on `JOB_LISTINGS_BASE_URL`, two users, curl): `pnpm db:migrate` applies `0000`–`0006` on a fresh database (this also clears the S12 local-migration gap). `/jobs` idle and invalid input make no provider call; 30-day remote search sends `time_frame=6m`, `date_posted_gte`, `title`, `location`, `ai_work_arrangement`, `description_format=html`, `limit=25`, `offset=0` with RapidAPI headers; results render decoded titles, escaped `<fast>`, no script text, EUR salary, posted date, and links only to `linkedin.com/jobs/view/{id}`. Save creates one `linkedin` row with external ID, posting URL, description, salary; saving again returns the same application with `created: false`; save-and-tailor 302s to the tailor page with the description prefilled; tampered ID 400. Second user sees the listing unsaved, saving it creates their own row, and gets 404 on the first user's card and tailor page. Board card and detail show the LinkedIn badge and posting link. Upstream 500 shows the generic 502 message and logs only `{ provider: 'fantastic_jobs', status: 500 }`; empty result shows the empty state; unauthenticated request redirects to sign-in; a server without `RAPIDAPI_KEY` shows "Job search is not set up on this server." and makes no provider call.
- Notes:
  - Saving posts the listing back as hidden JSON and re-validates it with Zod instead of calling the aggregator again, so saving never spends quota. The data is the user's own board entry, equivalent to manual entry, and the posting URL is always rebuilt from the numeric ID.
  - `shouldRevalidate` skips loader revalidation after same-URL POSTs, so a JavaScript save does not re-run the paid search. Without JavaScript, a save re-renders the page and searches once more.
  - Fantastic.jobs V4 has no 30-day window; 30 days uses `time_frame=6m` with `date_posted_gte`. Description search is not used, so the `6m` description-search restriction does not apply.
  - Listings without a LinkedIn job ID are dropped because they cannot be deduplicated or linked safely.
  - Design hook false positive (near-black text on cyan primary buttons) is ignored per file in untracked `.impeccable/config.json` for `app/routes/applications-board.tsx` and `app/routes/job-search.tsx`.
  - Browser check not run: installing `playwright-core` outside the repo was blocked by auto-review.

## Handoff

- Current task: none `IN_PROGRESS`.
- Previous task: S13 `DONE`.
- Last completed action: S13 LinkedIn listings implemented (pure listing domain, Fantastic.jobs provider, `/jobs` search with save and save-and-tailor, dedupe, LinkedIn badge and posting links, nav), unit-tested, and curl-smoke-tested against local Postgres and a fake aggregator.
- Verification: `pnpm test && pnpm typecheck && pnpm build && pnpm check` pass (261 tests, 18 files); `pnpm db:generate` reports no changes; `pnpm db:migrate` applies `0000`–`0006` on a fresh local Postgres 16.
- Blockers: no live `RAPIDAPI_KEY` or `TYPESAFE_API_KEY`, so real Fantastic.jobs and Jev calls are untested. Migration `0006_job_matches.sql` is not applied to the user's remote Neon database (pending user approval). No browser check for S13.
- Changed files: `PRD.md`, `TASKS.md`, `.env.example`, `app/lib/env.server.ts`, `app/lib/job-listings.ts`, `app/lib/job-listings.server.ts`, `app/lib/applications.ts`, `app/lib/repositories.server.ts`, `app/components/application-card.tsx`, `app/routes.ts`, `app/routes/job-search.tsx`, `app/routes/app-layout.tsx`, `app/routes/applications-board.tsx`, `app/routes/application-detail.tsx`, `tests/job-listings.test.ts`, `tests/job-listings-provider.test.ts`, `tests/fixtures/fantastic-jobs-active-jb.json`.
- Next task: S14 — Release integration (not yet in this file).
- First next action: add `S14 — Release integration` above `## Handoff` covering merging the stacked branches (`cursor/jev-job-match-c985`, then `cursor/linkedin-job-listings-c985`) into `main`, applying `0006_job_matches.sql` to the target database after user approval, and live smoke of `/jobs` with `RAPIDAPI_KEY` and Run match with `TYPESAFE_API_KEY`; then start with `gh pr create` for `cursor/jev-job-match-c985`.
