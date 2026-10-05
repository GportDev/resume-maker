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

- Status: `IN_PROGRESS`
- Depends on: S08
- Intent: edit each position's contributions as a Markdown file inside a company-grouped workspace.
- Files: `PRD.md`, `package.json`, `app/db/schema.ts`, `drizzle/*`, `app/lib/repositories.server.ts`, `app/lib/contributions.ts`, `app/lib/validation.ts`, `app/components/markdown-editor.tsx`, `app/routes/contributions*.tsx`, `app/routes/contribution-*.tsx`, `app/routes/experience-editor.tsx`, `app/routes/profile.tsx`, `app/routes/app-layout.tsx`, `app/routes.ts`, `tests/*`
- Acceptance:
  - `companies` table owned by user with case-insensitive unique name; `experiences.company_id` non-null FK (`on delete restrict`); migration backfills companies from existing `experiences.company` text and drops that column; RLS enabled and Supabase roles revoked.
  - Experience queries still return `company` name so analysis/resume code is unchanged; every company/experience query includes owner condition; a foreign `companyId` is rejected.
  - `groupExperiencesByCompany` (pure) orders companies by most recent role (current roles first) and positions by start date descending; companies without positions still appear.
  - `/contributions` shows keyboard-navigable company→position tree with `aria-current`; empty state when no companies.
  - `/contributions/:experienceId` edits metadata and Markdown; textarea works without JavaScript; CodeMirror replaces it after hydration; toolbar inserts heading, bullet, bold, and contribution template; edit/preview toggle.
  - Autosave via debounced fetcher (intent `autosave`) persists Markdown only; status `role="status"` shows saved/unsaved/error; navigation with unsaved changes asks for confirmation.
  - Multiple `.md` import appends or replaces with confirmation; `?download=1` export stays.
  - `/contributions/companies/:companyId` renames/edits company; delete only when no positions and requires confirmation checkbox.
  - `/profile/experiences/:id` redirects to `/contributions/:id`; profile links to contributions; nav includes Contributions.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; `pnpm db:migrate` on local PostgreSQL with pre-existing experience rows.

## Handoff

- Current task: S09 `IN_PROGRESS`.
- Last completed action: S08 Anthropic provider implemented, tested, and smoke-tested against local PostgreSQL.
- Verification: `pnpm test && pnpm typecheck && pnpm build && pnpm check` pass (29 tests, 7 files).
- Blockers: live Anthropic/OpenAI generation and Supabase migration not exercised; no `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or Supabase `DATABASE_URL` available in environment.
- Changed files: `PRD.md`, `TASKS.md`, `package.json`, `pnpm-lock.yaml`, `.env.example`, `app/db/schema.ts`, `drizzle/0001_ai_provider_settings.sql`, `drizzle/meta/*`, `app/lib/ai-providers.ts`, `app/lib/ai-provider.server.ts`, `app/lib/ai.server.ts`, `app/lib/env.server.ts`, `app/lib/repositories.server.ts`, `app/routes.ts`, `app/routes/ai-settings.tsx`, `app/routes/api-key-settings.tsx`, `app/routes/app-layout.tsx`, `app/routes/home.tsx`, `app/routes/analysis-result.tsx`, `tests/ai-provider.test.ts`, `tests/ai.test.ts`.
- Next task: S09 — Contributions workspace (not yet in this file).
- First next action: add `S09 — Contributions workspace` section above `## Handoff` with acceptance criteria: `companies` table (`user_id`, `name`, unique per user, case-insensitive) and `experiences.company_id` FK with backfill migration from `experiences.company`; pure `groupExperiencesByCompany` in `app/lib/contributions.ts`; `contributions` layout route with company→position file tree plus `contributions/:experienceId` CodeMirror Markdown editor (SSR textarea fallback, preview, debounced `useFetcher` autosave, `useBlocker` dirty warning); redirect `profile/experiences/:id` to `contributions/:id`; then start in `app/db/schema.ts` `experiences` table.
