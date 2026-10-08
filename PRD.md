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
4. Optionally choose AI provider (Anthropic default, OpenAI optional) and save own API key.
5. Paste job description and run analysis.
6. Review score, matches, gaps, and learning resources.
7. Generate, edit, save, and download tailored resume.

### Returning user

1. Sign in.
2. Select or paste new job description.
3. Reuse current experiences.
4. Review prior analyses and resumes.

### Tracking applications

1. Add an application with company, position, location, job description, and salary range.
2. Move its card across board columns as status changes.
3. Filter the board and open a card to edit details or notes.

## MVP requirements

### Authentication

- Email/password sign-up, sign-in, sign-out through Better Auth.
- Protected app routes and server mutations.
- Secure HTTP-only session cookies.
- User can access only own records.

### Profile and experiences

- Profile: full name, headline, email, phone, location, website, LinkedIn.
- Company: name (unique per user, case-insensitive), optional website and location.
- Experience: company, position, start date, optional end date, current-role flag, Markdown content.
- Create, read, update, delete, preview, import `.md`, export `.md`.
- Markdown should emphasize facts, outcomes, tools, scope, and measurable impact.

### Contributions workspace

- Page lists every position as a Markdown file grouped under its company folder; companies ordered by most recent role, positions by start date descending.
- Selecting a file opens a Markdown code editor with toolbar (heading, bullet, bold, contribution template), edit/preview toggle, and position metadata.
- Editor works before JavaScript loads (plain textarea form) and upgrades to a code editor after hydration.
- Changes autosave after a short pause; status shows saved or unsaved; leaving with unsaved changes asks for confirmation.
- Import one or more `.md` files into a position (append or replace, with confirmation); export each position as `.md`.
- Company can be renamed or edited; deletion only allowed when it has no positions and requires explicit confirmation.

### Job application tracking

- Application: company name, position, location, job description, optional salary range (min, max, currency, period), status, notes, applied date.
- Statuses: Saved, Applied, Interviewing, Offer, Rejected, Withdrawn.
- Board shows one column per status; cards show position, company, location, salary range, and status.
- Cards move between columns and reorder within a column by drag-and-drop (pointer and keyboard, with screen-reader announcements); a per-card status select works without JavaScript.
- Text filter narrows cards by company, position, or location.
- Create and edit applications on a detail page; deletion requires explicit confirmation.
- Applications record source (`manual` now; LinkedIn later).
- Cards and detail page show the latest fit score and links to the latest tailored resume and cover letter, plus a Tailor action.

### Tailoring and cover letter

- Tailor page belongs to one application; its job description is prefilled from the application and editable.
- Analysis step shows ATS keywords, which keywords and required skills each past or current position matches, unmatched keywords, score factors, and gaps.
- Generation step rewrites the resume and writes a cover letter from verified evidence, then saves both on the application in one step.
- Home page is a quick-tailor entry: paste a job description, then pick an existing application or create one from the analysis.
- Cover letter: recipient, opening, cited body paragraphs, and closing; editable, with ATS-safe preview and selectable-text PDF download.
- Cover letters never invent company facts beyond the job description or candidate facts beyond stored evidence.

### AI provider and API key settings

- Supported providers: Anthropic (Claude, default) and OpenAI (optional), both through Vercel AI SDK.
- User selects preferred provider; platform default comes from `AI_DEFAULT_PROVIDER`.
- Platform Anthropic or OpenAI key may power generation.
- User may save one own API key per provider.
- Saved keys encrypted at rest; UI shows only masked suffix.
- User can test, replace, or revoke each key.
- For preferred provider, user key takes precedence over platform key; missing both yields actionable error.
- Structured output failing schema validation is retried once; second failure returns actionable error.

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

- Stripe billing, team workspaces, recruiter portal, job-board scraping, DOCX export, AI providers beyond Anthropic and OpenAI, vector search, and automatic application submission.
- Predicting actual recruiter decisions or guaranteeing ATS passage.

## Data entities

- Better Auth: user, session, account, verification.
- Profile: one per user.
- Company: many per user; groups experiences.
- Experience: many per user; belongs to one owned company.
- Job application: many per user; status, fractional board order, salary range, and source with optional external ID unique per user and source.
- Job analysis: immutable job input plus structured analysis and score; optionally linked to an application.
- Resume: editable generated snapshot linked to analysis and optionally to an application.
- Cover letter: editable generated snapshot linked to analysis and optionally to an application.
- User API credential: encrypted provider secret metadata, at most one active key per provider per user.
- User settings: one per user; preferred AI provider.

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
- Every cover-letter body paragraph references at least one owned experience.
- Tailoring persists the resume and cover letter together; if either generation fails, neither is saved.
- Score can be recomputed from persisted factors without model call.
- PDF contains selectable text, one column, standard headings, and no graphics required for meaning.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Success measures

- At least 80% of successful analyses lead to resume generation.
- Median analysis-to-download time under five minutes.
- Less than 2% structured-output failures after one controlled retry.
- Zero unsupported generated claims in acceptance review.
