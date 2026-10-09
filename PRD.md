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

### Finding jobs

1. Search LinkedIn listings by keywords, location, posting age, and remote preference.
2. Save a listing to the board, or save it and go straight to tailoring.

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
- Applications record source (`manual` or `linkedin`); LinkedIn cards show a LinkedIn badge and a link to the posting.
- Cards and detail page show the latest fit score and links to the latest tailored resume and cover letter, plus a Tailor action.
- Cards show the latest job-match recommendation and match percentage when a match exists.

### Tailoring and cover letter

- Tailor page belongs to one application; its job description is prefilled from the application and editable.
- Analysis step shows ATS keywords, which keywords and required skills each past or current position matches, unmatched keywords, score factors, and gaps.
- Generation step rewrites the resume and writes a cover letter from verified evidence, then saves both on the application in one step.
- Home page is a quick-tailor entry: paste a job description, then pick an existing application or create one from the analysis.
- Cover letter: recipient, opening, cited body paragraphs, and closing; editable, with ATS-safe preview and selectable-text PDF download.
- Cover letters never invent company facts beyond the job description or candidate facts beyond stored evidence.

### Job match (TypeSafe Jev)

- Optional: runs only when the server has `TYPESAFE_API_KEY`; without it, tailoring keeps the analysis-only behavior and the Match section says matching is unavailable.
- After analysis extracts requirements, Jev decides for each required and preferred skill which stored position demonstrates it, or none, and rates seniority fit and domain fit. Jev returns typed decisions and probabilities, never text.
- Code-owned thresholds decide each requirement: verified (a position chosen with probability ≥ 0.7 and confidence ≥ 0.6), missing (none chosen with probability ≥ 0.7), otherwise needs review.
- Match score 0–100 = required coverage (70) + preferred coverage (15) + seniority (15); recommendation is strong match, worth tailoring, weak match, or needs review. Score and recommendation are deterministic; the ATS fit estimate stays separate.
- Application detail shows a Match section with each requirement's chosen position, probability, and review flag, plus a Run match action. User can accept or reject needs-review items; overrides are stored and the score recomputes.
- Board cards show the recommendation and match percentage.
- When a match exists for the analysis, resume and cover letter generation receive only verified requirement-to-position pairs; analysis matches Jev does not confirm are flagged unverified on the tailor page and excluded from generation.
- Disclaimer: match score is a heuristic over stored evidence, not a hiring probability.
- Data retention: each run stores model version, question version, raw probabilities and confidence, and the computed result as an audit trail. Rows are deleted with their analysis or user account. Experience text is sent to TypeSafe only when a match runs.

### Job listing search (LinkedIn)

- Data source: LinkedIn has no public job-search API, and scraping LinkedIn is excluded. Listings come from a licensed aggregator API (Fantastic.jobs "LinkedIn Job Search API" on RapidAPI) behind a pluggable provider, using a platform `RAPIDAPI_KEY`. An official LinkedIn partner adapter can be added later behind the same interface.
- Optional: without `RAPIDAPI_KEY` the Find jobs page explains that search is not configured; the rest of the app is unaffected.
- Search by keywords (job title), location (full place names), posted within 24 hours, 7 days, or 30 days, and remote only; 25 results per page.
- Results show title, company, location, salary when present, posted date, and a "View on LinkedIn" link built only from the numeric LinkedIn job ID.
- Listing descriptions are converted to plain text; listing HTML is never rendered.
- Save creates a Saved application with source `linkedin`, the LinkedIn job ID, posting link, description, and salary. Saving a listing already on the board does not duplicate it and links to the existing card. Save and tailor opens the tailor page for that application.
- External dependency and quota: each search page is one paid aggregator request; saving does not call the provider. Provider failures show a generic message; server logs keep only the provider status.

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

- Stripe billing, team workspaces, recruiter portal, job-board scraping (job listings come only from licensed APIs), DOCX export, text-generation providers beyond Anthropic and OpenAI (TypeSafe Jev is used only for match decisions), vector search, and automatic application submission.
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
- Job match: Jev decisions for one analysis and application; model and question version, raw answers, computed result, and user overrides.
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
- Job match score and recommendation can be recomputed from stored answers and overrides without a model call; only verified pairs reach generation when a match exists.
- Saving the same LinkedIn listing twice never creates a second application for the user.
- PDF contains selectable text, one column, standard headings, and no graphics required for meaning.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.

## Success measures

- At least 80% of successful analyses lead to resume generation.
- Median analysis-to-download time under five minutes.
- Less than 2% structured-output failures after one controlled retry.
- Zero unsupported generated claims in acceptance review.
