# Project Agent Rules

## Source of truth

Read in order before work:

1. `PRD.md` for product scope and acceptance criteria.
2. `TASKS.md` for current task and exact pickup point.
3. Relevant source and tests.

If documents conflict: user instruction wins, then `PRD.md`, then `AGENTS.md`, then `TASKS.md`.

## Stack

- React Router 8 Framework Mode with SSR and typed route modules.
- React 19, TypeScript strict mode, Tailwind CSS 4.
- Better Auth with email/password.
- Supabase hosted PostgreSQL through server-only pooled connection.
- Drizzle ORM and migrations.
- Vercel AI SDK with OpenAI.
- Zod at all external boundaries.
- Vitest for unit/integration tests.

## Architecture rules

- Route definitions live in `app/routes.ts`.
- Route modules use `loader` for reads and `action` for mutations.
- Database, auth, encryption, and AI code must live in `*.server.ts`.
- UI never imports server modules.
- Repository methods require `userId`; queries include ownership condition.
- Keep domain logic pure where possible and test it without network/database.
- Store experience Markdown as canonical text plus structured metadata.
- AI may select and rewrite verified evidence, never invent evidence.
- ATS score is deterministic domain logic over validated analysis, never a model-provided probability.

## Security rules

- Never expose `DATABASE_URL`, `BETTER_AUTH_SECRET`, `OPENAI_API_KEY`, or `CREDENTIAL_ENCRYPTION_KEY`.
- Never log plaintext API keys, session tokens, or complete provider responses containing user data.
- Encrypt user API keys with AES-256-GCM. Store ciphertext, IV, auth tag, key version, and last four characters.
- Better Auth user IDs are not Supabase Auth IDs. Do not use `auth.uid()` as ownership proof.
- Product data stays server-only; revoke Supabase `anon` and `authenticated` access.
- Validate request input and database JSON with Zod.
- Return generic provider errors to client; preserve safe diagnostics server-side.

## Spec-Driven Development

For each task:

1. Mark one task `IN_PROGRESS` in `TASKS.md`.
2. Read its intent, dependencies, file scope, acceptance criteria, and verification.
3. Add or update tests that encode acceptance criteria.
4. Implement only task scope.
5. Run task verification.
6. Record changed files and evidence.
7. Mark task `DONE`.
8. Set exactly one `Next task` with first concrete action.

Do not start work lacking acceptance criteria. Add missing criteria to `TASKS.md` before code.

## Coding conventions

- Prefer named functions for route loaders/actions and domain operations.
- Use generated `Route.*` types; never edit generated route types.
- Use `import type` for types.
- Avoid `any`, non-null assertions, and silent catches.
- Keep components focused; extract repeated UI after second use.
- Use semantic HTML, visible focus, explicit labels, keyboard access, and useful empty/error states.
- Keep copy direct. Do not promise employment outcomes.
- No arbitrary model-generated links. Resolve learning resources through allowlist.

## Commands

- `pnpm dev`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm db:generate`
- `pnpm db:migrate`

## Definition of done

- Acceptance criteria pass.
- Relevant tests exist and pass.
- Typecheck and build pass.
- No secret or ownership regression.
- `TASKS.md` contains verification evidence and exact pickup point.

## Mandatory handoff

Before ending any task or session, update `TASKS.md`:

- Current task status.
- Last completed action.
- Verification command and result.
- Blockers with exact error.
- Changed files.
- `Next task` ID.
- First next action, including file and symbol/section.

Agent must be able to continue using repository files only, without chat history.
