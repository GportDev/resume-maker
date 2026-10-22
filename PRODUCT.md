# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and a small circle of invited people running their own job hunts. Public launch is undecided; architecture stays ready for teams and subscriptions, but no surface should assume anonymous mass-market visitors yet.

Situation: an active job search with many applications in flight. Users store their work history once, then return repeatedly to find listings, track applications, and tailor a resume and cover letter per posting. Returning-user sessions dominate after setup.

## Product Purpose

Resume Fit turns a user's verified work history into job-specific, ATS-friendly resumes and cover letters, and holds the rest of the job hunt around them: finding listings, tracking applications on a board, analyzing fit, and tailoring.

Success: tailoring one application takes under five minutes after profile setup; every generated claim traces to stored experience; analysis-to-download median under five minutes; most analyses lead to a generated resume.

## Positioning

The whole job-hunt loop in one place, built on one evidence vault: contributions written once as Markdown, LinkedIn listing search, an application board, deterministic fit analysis and job match, and tailored resume plus cover letter, all connected per application. Neighboring tools cover one step; Resume Fit carries the same verified evidence through every step.

Honesty is the floor under that loop: AI selects and rewrites stored evidence, never invents it; scores are deterministic and explained, never hiring probabilities.

## Operating Context

- Core loop: Find jobs (LinkedIn via licensed aggregator) → save to board → tailor (analysis, optional Jev match, generation) → edit and download PDF → move card through Saved, Applied, Interviewing, Offer, Rejected, Withdrawn.
- Contributions workspace: each position is a Markdown file under its company folder; code editor with preview, autosave, `.md` import/export.
- Home is a quick-tailor entry: paste a job description, then attach to an existing or new application.
- Outputs are documents read by ATS parsers and recruiters: single-column, selectable-text PDFs with standard headings.
- Users bring their own AI key (Anthropic default, OpenAI optional) or use the platform key.

## Capabilities and Constraints

- Auth: Better Auth email/password; every record owner-scoped.
- Fit score: deterministic 0–100 from keyword coverage, required-skill coverage, evidence strength, title/seniority alignment, profile completeness. Always shown with factors, matches, gaps, and a heuristic disclaimer.
- Job match (TypeSafe Jev): optional, server-key gated. Typed decisions per requirement (verified, missing, needs review); user overrides recompute score. Only verified pairs reach generation when a match exists.
- Job search: optional, gated on `RAPIDAPI_KEY`; listing HTML never rendered; LinkedIn links built only from numeric job IDs.
- Learning resources come only from an allowlist; no model-generated links.
- Progressive enhancement is a requirement: editor works as a plain textarea before hydration; board status select works without JavaScript.
- Non-goals: billing, team workspaces, recruiter portal, scraping, DOCX export, automatic application submission, predicting recruiter decisions or guaranteeing ATS passage.
- Open decision: whether and when to open sign-up publicly.

## Brand Commitments

- Name: **Resume Fit** (canonical; PRD.md's "Personalized Resume" is a working title).
- Voice: direct and plain. Never promise employment outcomes. Every score carries its "heuristic, not hiring probability" framing.

## Evidence on Hand

- Real product copy and flows in `app/routes/` and `PRD.md`.
- No logo or brand mark beyond the default `public/favicon.ico`.
- No testimonials, user counts, outcome statistics, or press. Do not fabricate any; with a small private user base, social proof does not exist yet.

## Product Principles

1. **One evidence vault, every step.** Work history is entered once and flows into analysis, match, resume, and cover letter; never ask for it twice.
2. **Traceable over impressive.** A weaker true bullet beats a stronger invented one. Every generated claim links back to its source position.
3. **Explain every number.** Scores show their factors, matched terms, and gaps; nothing is a black-box probability.
4. **Fast repeat sessions.** Optimize for the returning user moving many applications forward, not first-time onboarding spectacle.
5. **Optional services degrade cleanly.** Missing AI, match, or search keys produce clear explanations while the rest of the loop keeps working.

## Accessibility & Inclusion

- Keyboard access everywhere, including board drag-and-drop with screen-reader announcements.
- Visible focus, explicit labels, semantic HTML, useful empty and error states.
- Core actions work before or without JavaScript where specified (editor, board status).
- Generated PDFs: selectable text, one column, no graphics required for meaning.
