# Personalized Resume MVP

## Product

Personalized Resume converts a user's verified work history into a job-specific, ATS-friendly resume. User stores each role once as structured metadata and Markdown. For each application, user pastes job description; system extracts requirements, matches only supported experience, reports gaps, and produces editable PDF-ready resume.

## Goals

- Make tailoring one application take under five minutes after profile setup.
- Keep every generated claim traceable to stored experience.
- Explain estimated ATS fit with visible factors, matched terms, and gaps.
- Produce selectable-text, single-column PDF.
- Keep architecture ready for teams, subscriptions, quotas, and Stripe without implementing billing now.

## Users and core flows

### New user

1. Sign up with email and password.
2. Add profile details.
3. Add one or more experiences with company, role, dates, and Markdown evidence.
4. Optionally save own OpenAI API key.
5. Paste job description and run analysis.
6. Review score, matches, gaps, and learning resources.
7. Generate, edit, save, and download tailored resume.

### Returning user

1. Sign in.
2. Select or paste new job description.
3. Reuse current experiences.
4. Review prior analyses and resumes.

## MVP requirements

### Authentication

- Email/password sign-up, sign-in, sign-out through Better Auth.
- Protected app routes and server mutations.
- Secure HTTP-only session cookies.
- User can access only own records.

### Profile and experiences

- Profile: full name, headline, email, phone, location, website, LinkedIn.
- Experience: company, position, start date, optional end date, current-role flag, Markdown content.
- Create, read, update, delete, preview, import `.md`, export `.md`.
- Markdown should emphasize facts, outcomes, tools, scope, and measurable impact.

### API key settings

- Platform OpenAI key may power generation.
- User may save own OpenAI API key.
- Saved key encrypted at rest; UI shows only masked suffix.
- User can test, replace, or revoke key.
- User key takes precedence over platform key.

### Job analysis

- Accept plain-text job description.
- Extract title, seniority, required/preferred skills, responsibilities, domain terms, and ATS keywords into validated structured output.
- Match requirements to experience evidence and preserve source experience IDs.
- Calculate deterministic 0–100 fit estimate from keyword coverage, required-skill coverage, evidence strength, title/seniority alignment, and profile completeness.
- Show factor breakdown, matches, missing terms, and learning links from allowlisted sources.
- State clearly: score is heuristic, not hiring probability or guarantee.

### Resume

- Generate only claims supported by stored profile/experience.
- Include contact, summary, skills, and selected experience bullets.
- Keep editable structured content and analysis snapshot.
- Provide ATS-safe preview and selectable-text PDF download.
- Never add hidden keywords, fabricate skills, or alter dates/employers.

## Non-goals

- Stripe billing, team workspaces, recruiter portal, job-board scraping, cover letters, DOCX export, multi-provider AI, vector search, and automatic application submission.
- Predicting actual recruiter decisions or guaranteeing ATS passage.

## Data entities

- Better Auth: user, session, account, verification.
- Profile: one per user.
- Experience: many per user.
- Job analysis: immutable job input plus structured analysis and score.
- Resume: editable generated snapshot linked to analysis.
- User API credential: encrypted provider secret metadata, one active OpenAI key per user.

## Security and privacy

- Database and provider secrets stay server-side.
- Product tables are not browser-accessible through Supabase Data API.
- Every query includes authenticated owner ID.
- API keys use AES-256-GCM with versioned encryption key; plaintext exists only during request processing.
- Logs and errors redact secrets and job/profile content where practical.
- Destructive actions require explicit user intent.

## Acceptance criteria

- Unauthorized requests redirect to sign-in or return 401.
- Cross-user IDs never reveal or mutate records.
- User completes full core flow from sign-up through PDF.
- AI response failing schema validation produces actionable error and no partial persisted resume.
- Every generated bullet references at least one owned experience.
- Score can be recomputed from persisted factors without model call.
- PDF contains selectable text, one column, standard headings, and no graphics required for meaning.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Success measures

- At least 80% of successful analyses lead to resume generation.
- Median analysis-to-download time under five minutes.
- Less than 2% structured-output failures after one controlled retry.
- Zero unsupported generated claims in acceptance review.
