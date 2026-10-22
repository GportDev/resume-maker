# Task Management

## Status

Allowed values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

Only one task may be `IN_PROGRESS`. Complete dependencies in order. Update handoff before stopping.

## History

S01–S13 (specs through LinkedIn listings) are `DONE`. Their full acceptance criteria and evidence live in git history: `git show 2df43be:TASKS.md`. Still open from S13's handoff: U00 below.

## Why this plan exists

UX review of every route (2026-10-21) found the app usable but generic and heavy:

- **Generic look.** Every page uses the same recipe: `slate-950` background, `cyan-400` accent, Inter, uppercase `tracking-[0.2em]` eyebrow (9 pages), and the same `rounded-2xl border border-slate-800 bg-slate-900` panel (13 files, 37 `rounded-2xl`). Each section has the same visual weight, so nothing leads. The only motion in the app is the dnd-kit transform. No button press feedback, no enter/exit for dialogs or status messages.
- **Duplicate primitives.** 18 hand-written copies of the primary button class and 3 separate `inputClass` constants. The same destructive pattern (`<details>` + checkbox + red button) appears in 4 places with different wording.
- **Markdown editor.** (User wants Notion-style inline live preview; see U04.) It uses the stock `@uiw` `theme="dark"`, which clashes with the app palette. The toolbar labels are text (`H2`, `• List`, `B`, `Template`) with no keyboard shortcuts. Split view only goes side by side at ≥1280px; below that, preview stacks under the editor. The editor has a fixed 24rem height. Save status sits in the page header, far from the text. Markdown autosaves but position details need a manual save, so users juggle two save models.
- **Operate surfaces read like a landing page.** Home opens with a marketing headline. Detail pages are one long always-editable form. Board cards repeat a status select, a Move button, and a Delete disclosure on every card.

Product rules from `PRODUCT.md` still apply: one evidence vault, traceable claims, explained numbers, fast repeat sessions, and clean degradation. Visual decisions belong in `DESIGN.md` (U01), not here.

### Shared rules for every U-task

- Motion rules (Emil Kowalski design-engineering guidance):
  - Animate only `transform`/`opacity`. Name exact properties; never `transition: all`.
  - UI motion is ≤ 250ms. Use `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for enter/exit and `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement. Never `ease-in`.
  - Exits are faster than enters.
  - No animation on keyboard-initiated or 100+/day actions (shortcuts, toolbar formatting, tab switching).
  - Pressables get `:active { transform: scale(0.97) }`.
  - Gate hover effects behind `@media (hover: hover) and (pointer: fine)`.
  - Honor `prefers-reduced-motion`: keep opacity, drop movement.
- Progressive enhancement stays: every mutation that works without JavaScript today keeps working.
- No new copy promising outcomes. Scores keep their heuristic disclaimer.
- Verify each UI task in the built-in browser at 1440×900 and 390×844, and run `~/.claude/skills/impeccable/scripts/impeccable detect --json <changed files>` once, at the end.

## U00 — Release carryover from S13

- Status: `BLOCKED`
- Depends on: none (independent of U-tasks; can run any time)
- Intent: close the S13 handoff items that are not yet verified.
- Files: none expected; `TASKS.md` evidence only.
- Acceptance:
  - `drizzle/0006_job_matches.sql` is applied to the user's remote database **only after explicit user approval in chat**.
  - Live smoke of `/jobs` with a real `RAPIDAPI_KEY` and of Run match with a real `TYPESAFE_API_KEY`, or a recorded `BLOCKED` with the exact missing key.
- Verify: `pnpm db:migrate` output against the approved target; one saved LinkedIn listing; one stored job-match row.
- Evidence (2026-10-21):
  - Not run. The main `.env` points at a remote Neon database (`…-pooler.c-6.us-east-2.aws.neon.tech`). Applying `0006_job_matches.sql` there needs explicit user approval in chat, which has not been given.
  - `.env` has no `RAPIDAPI_KEY` or `TYPESAFE_API_KEY`, so live smoke tests cannot run.
  - Unblock: the user approves the migration target and supplies both keys; then run `pnpm db:migrate` against it and smoke `/jobs` and Run match.
  - Local development for U-tasks uses Docker `postgres:16` (`resume-maker-pg`, port 55432), migrated `0000`–`0006`, seeded with `node scripts/seed-dev.mjs`.

## U01 — Visual direction and DESIGN.md

- Status: `DONE`
- Depends on: none
- Intent: replace the generic slate/cyan look with a deliberate identity suited to an Operate tool used daily during a job hunt. Write it down so every later task builds against one source.
- Files: `DESIGN.md`, `.impeccable/design.json` (sidecar, if the skill writes one)
- Acceptance:
  - Run `/impeccable shape` → new-work for a redesign. Present 2–3 directions and get the **user's choice in chat** before writing DESIGN.md. The agent must not pick the direction.
  - DESIGN.md defines:
    - color tokens for surface tiers, text tiers, accent, and semantic status colors (saved/applied/interviewing/offer/rejected/withdrawn, verified/needs-review/missing), with both themes if dark stays default;
    - type scale and font pairing (one display or editorial face allowed, one UI face, one mono for Markdown);
    - spacing and radius scale;
    - elevation rules: when a surface is a panel and when it is plain page, replacing border-on-everything;
    - motion tokens (`--ease-out`, `--ease-in-out`, `--duration-press: 160ms`, `--duration-pop: 200ms`, `--duration-dialog: 240ms`);
    - document-preview styling (resume/cover letter paper) kept ATS-neutral.
  - Names one signature element that makes the app recognizable (e.g. how scores, evidence citations, or the contribution tree look), grounded in the product's evidence-first positioning.
- Verify: user approval recorded in this task's evidence; DESIGN.md exists and lists every token U02 needs.
- Evidence (2026-10-21):
  - Direction round served on the impeccable decision page (seed `7800247e`; roll degraded, so there were no challengers). Options: Herbarium Sheet (assigned), Exhibit Binder (pick), and the category standard. **User chose Exhibit Binder**, code-led (no image generation available).
  - Direction contract written to `.impeccable/surfaces/app-routes-app-layout-tsx.md` (all six blocks plus FINISH; verified by reading it back).
  - `DESIGN.md` defines board/sheet/ink/rule neutrals, exhibit blue, manila, margin red, status and verification inks; Libre Franklin / Source Serif 4 / JetBrains Mono; radius, spacing, shadow, and motion tokens; signature components: index tabs, stamps, and "Ex. N" citation chips. Light only; dark deferred.
  - Contrast checked: ink-3 on board and sheet ≥ 4.5:1, exhibit on sheet 9.5:1, white on exhibit 9.8:1, status inks on their tints ≥ 4.97:1, rule-strong control border 3.4:1.
  - Note: the impeccable flow normally writes DESIGN.md at finish. It is written now so U02 has tokens; U13 refreshes it from the built result and adds `.impeccable/design.json`.

## U02 — Tokens and shared UI primitives

- Status: `DONE`
- Depends on: U01
- Intent: one implementation of each control, so polish happens once and every page inherits it.
- Files: `app/app.css`, `app/root.tsx` (fonts), new `app/components/ui/*` (`button.tsx`, `field.tsx`, `badge.tsx`, `panel.tsx`, `page-header.tsx`, `confirm-dialog.tsx`, `toast.tsx`), `tests/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | 18 inline `rounded-xl bg-cyan-400 px-5 py-3 …` primary buttons | `<Button variant="primary\|secondary\|ghost\|danger" size>` | One place for focus, disabled, pending, and press states |
  | No `:active` feedback anywhere | `transition: transform 160ms var(--ease-out)`; `:active { scale(0.97) }` | Buttons must confirm the press |
  | `button:disabled { cursor: wait }` for every disabled button | `cursor: not-allowed` by default; `aria-busy` + spinner only while pending | Disabled ≠ loading |
  | 3 `inputClass` copies; labels sometimes wrap inputs, sometimes `htmlFor` | `<Field label hint error>` with consistent `aria-describedby` | Consistent error and hint wiring |
  | `<details>` + checkbox + red button delete in 4 places | `<ConfirmDialog>` on native `<dialog>`; enter `opacity 0→1` + `scale(0.96→1)` 240ms ease-out, exit 150ms; checkbox form kept as no-JS fallback | Destructive intent stays explicit with less page clutter |
  | "Saved." text persists until next action | `<Toast>` (polite live region), slides from the same edge it exits, CSS transitions not keyframes, timer pauses when tab hidden | Spatially consistent, interruptible feedback |
  | Eyebrow + h1 hand-written per page | `<PageHeader eyebrow? title meta actions>` | Consistent hierarchy |

- Acceptance:
  - Tokens from DESIGN.md exist in `@theme`. No raw `slate-*`/`cyan-*` utilities remain in the new primitives.
  - Hover styles are gated by `(hover: hover) and (pointer: fine)`. A `prefers-reduced-motion` block removes transforms and keeps opacity.
  - Primitives are adopted on at least the board and profile pages (proof). Other pages migrate in their own tasks.
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; browser check at both widths; keyboard-only pass through ConfirmDialog (focus trap, Escape, focus return).
- Evidence (2026-10-21):
  - Tokens from DESIGN.md are in `@theme` (`app/app.css`). Fonts: Libre Franklin, Source Serif 4, JetBrains Mono (`app/root.tsx`). Browser surfaces themed: selection, caret, scrollbar color, underline offset, tabular numerals.
  - New `app/components/ui/`: `button.tsx` (variants primary/secondary/ghost/danger/destructive, `pressable` scale 0.97 over 160ms `--ease-out`, pending spinner + `aria-busy`), `field.tsx` (`Field`, `fieldClass`, `describedBy`), `stamp.tsx`, `sheet.tsx` (`Sheet`, `PageHeader`, `SheetSection`), `confirm-dialog.tsx` (native `<dialog>`, 240ms enter / 150ms exit via `@starting-style`; checkbox `<details>` form before hydration), `toast.tsx` (`toast()`, `useToast`, `<Toaster>`; polite live region, enter and exit from the bottom edge, timer pauses on hover and hidden tab).
  - Whole app moved off the dark slate/cyan palette with a mapping codemod (23 files, 0 unmapped classes), so every page is coherent before its own task. `lucide-react` added for drawn icons.
  - Adopted on the profile page (Sheet, PageHeader, Field, Button with pending state, toast on save) and the board (header buttons, filter field, card delete through ConfirmDialog with a keyed fetcher; optimistic hide still works).
  - Hover is gated by Tailwind 4's `(hover: hover)` variant. Reduced motion removes transforms on pressables, dialogs, popovers, and toasts.
  - `pnpm test` 261 passed; `pnpm typecheck`, `pnpm check`, `pnpm build` pass.
  - Browser (1440 wide, local dev): profile save shows the toast; board Delete opens the dialog, Escape closes it, and focus returns to the trigger.

## U03 — App shell and navigation

- Status: `TODO`
- Depends on: U02
- Intent: navigation that follows the job-hunt loop and works on a phone.
- Files: `app/routes/app-layout.tsx`, `app/root.tsx` (ErrorBoundary), `app/components/ui/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | 6 flat links + name/email + Sign out in one row; overflows below ~900px, no mobile menu | Primary nav for the loop (Find jobs, Applications, Tailor) and Evidence (Contributions, Profile); account menu holds name, email, AI settings, Sign out; small screens get a sheet or menu button | Fits phone widths; groups by job, not by table |
  | "Analyze" label for `/` | Rename per U06 outcome (e.g. "Home" or "Tailor") | Label matches what the page does |
  | No skip link | "Skip to content" link targeting `<main id="main">` | Keyboard users skip the nav on every page |
  | Root ErrorBoundary says "Oops!" | Plain message, link home, keeps shell styling | Direct copy; error state still navigable |

- Acceptance: nav never wraps or scrolls horizontally at 390px. The active route is visible without color alone. The account menu is keyboard-operable (Escape closes and returns focus). Sign-out pending state is kept.
- Verify: browser at 390, 768, and 1440; keyboard pass; `pnpm typecheck && pnpm build`.

## U04 — Notion-style live-preview Markdown editor

- Status: `TODO`
- Depends on: U02
- Intent: one calm writing page, like Notion or Obsidian's Live Preview. The user types Markdown and sees it rendered in the same place, with no separate preview pane. The stored value stays plain canonical Markdown (PRD rule).
- Decision (user, 2026-10-21): inline live preview chosen over split source|preview and over inline + split toggle.
- Files: `app/components/markdown-editor.tsx`, `app/components/codemirror-markdown.tsx`, new `app/components/editor/live-preview.ts` (CodeMirror `ViewPlugin` + decorations), new `app/components/editor/editor-theme.ts`, new `app/components/editor/slash-menu.ts`, new `app/components/editor/selection-toolbar.tsx`, new pure `app/lib/live-preview-ranges.ts`, `app/lib/markdown-format.ts`, `app/app.css`, `package.json` (declare `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/autocomplete`, `@lezer/markdown` directly; they are already transitive), `PRD.md` (contributions section: replace "edit/preview toggle" with inline live preview), `tests/live-preview-ranges.test.ts`, `tests/markdown-format.test.ts`
- Target experience:

  ```
  ┌──────────────────────────────────────────────┐
  │ Senior Engineer                Saved · 2m ago│  ← page title + status
  │ Acme · Jan 2022 – now · Current              │  ← properties row (U05)
  │                                              │
  │ Context                         (rendered H2)│
  │ Led payments team of 6 engineers.            │
  │                                              │
  │ ## Outcomes|          ← active line shows raw│
  │ • Cut checkout latency **40%**  (bold shown) │
  │ • Shipped Stripe migration                   │
  │                                              │
  │ /out▸  Outcomes · Tools · Context            │  ← slash menu
  └──────────────────────────────────────────────┘
  ```

- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Raw Markdown editor + separate preview pane (Write/Split/Preview), side by side only ≥1280px | Single surface. Markdown renders inline as you type; syntax markers show only on lines touched by the cursor or selection | Write and see the result at once, with no pane juggling or stacked layout on smaller screens |
  | Stock `theme="dark"`, mono font, 24rem box with border | Page layout: centered column (~68ch), proportional UI/serif face from DESIGN.md, generous line-height (~1.7), no box border, blank space below the last line clickable to focus. Mono only for inline code and code blocks | Reads like a document, not a code field |
  | Headings are `##` text | H1–H3 render at a type scale with markers hidden off-line; heading spacing above > below | Structure is visible at a glance |
  | `- item` shown raw | Bullets render as a `•` widget, numbered lists keep numbers, `- [ ]` renders a clickable checkbox that toggles the source | Lists look like lists; checkboxes still edit Markdown |
  | `**bold**`, `*italic*`, `` `code` ``, `[text](url)` raw | Markers hidden off-line, text styled; links show text only, Mod-click opens (only `http/https`; others plain text) | Clean reading without losing source fidelity |
  | Blockquotes, `---`, fenced code raw | Quote gets a left rule, `---` a thin divider widget, fenced code a tinted block with mono text (raw fences visible when cursor inside) | Common blocks covered. Tables and HTML stay raw (out of scope) |
  | Text toolbar `H2`, `• List`, `B`, `Template` above the editor | Notion-style **slash menu**: typing `/` at line start opens a filtered list (Heading 1–3, Bullet, Numbered, Checklist, Quote, Divider, Code, and sections Context/Contributions/Outcomes/Tools). Plus a **selection toolbar** on mouse text selection: Bold, Italic, Code, Link, Heading | Formatting where the cursor is; no chrome when writing |
  | No shortcuts | `Mod-b`, `Mod-i`, `Mod-e` (code), `Mod-k` (link), `Mod-Alt-1/2/3` (headings), `Mod-Shift-7/8/9` (numbered/bullet/checklist), `Mod-s` (save now), Markdown auto-continue on Enter, Tab/Shift-Tab indent lists. All reuse `formatMarkdown` | 100+/day actions on the keyboard |
  | — | Typing shortcuts like Notion: `# ` → heading, `- ` → bullet, `1. ` → numbered, `[] ` → checklist, `> ` → quote, `---` → divider (these are already valid Markdown, so they render immediately) | Muscle memory from Notion works |
  | Template button inserts whole template anywhere | Empty file shows placeholder "Type / for sections, or start writing…" and an "Insert starter template" ghost button; sections inserted one at a time from the slash menu | No duplicated scaffolding |
  | Status text in page header | Quiet status top-right of the page ("Saved · 2m ago" / "Saving…" / "Unsaved" / "Couldn't save · Retry") + word count in a footer | Feedback near the writing |

- Motion (Emil rules):
  - Slash menu and selection toolbar enter at `opacity 0→1` + `scale(0.97→1)` over 150ms `--ease-out`, `transform-origin` at the caret/selection edge. Exit 100ms.
  - Slash menu opened by typing `/` is keyboard-initiated, so it appears **instantly** (no animation). Only the mouse-selection toolbar animates.
  - Moving the menu highlight with arrows has no animation.
  - Revealing raw markers when the cursor enters a line is instant; never animate text reflow.
  - Checkbox toggle: 120ms opacity on the check mark only.
  - Reduced motion: no transforms.
- Acceptance:
  - Saved value is byte-identical Markdown to what the user typed. Decorations never write to the document except explicit actions (checkbox toggle, slash insert, format commands).
  - Pure `livePreviewRanges(markdown, activeLineNumbers)`, built on `@lezer/markdown`, returns hide/replace/style ranges. Unit-tested for every syntax above, nested emphasis, a link inside a list, a cursor on a marker line (no hiding), a multi-line selection (all touched lines raw), and an unclosed `**` (no hiding).
  - Slash menu: opens only at line start or after whitespace, filters as you type, Enter/Tab inserts, Escape closes and leaves the `/` text. `role="listbox"` with `aria-activedescendant` (CodeMirror autocomplete provides this).
  - Selection toolbar is reachable without a mouse: every action has a shortcut, and the toolbar is never the only path.
  - Before hydration: the plain `<textarea>` still renders and submits. The page stays usable without JavaScript (raw Markdown, no preview). `.markdown-preview` CSS is kept for read-only renders elsewhere.
  - Screen readers: CodeMirror content keeps `aria-labelledby`/`aria-describedby`/`aria-invalid`. Hidden markers are hidden visually, but the text content still reads in order.
  - Performance: decorations computed for the visible viewport only. Typing in a 1,000-line file stays smooth (no long tasks > 50ms in a DevTools performance trace).
  - Light and dark themes come from U01 tokens.
- Verify: `pnpm test` (`live-preview-ranges.test.ts`, `markdown-format.test.ts`), `pnpm typecheck && pnpm build && pnpm check`. Browser at 1440 and 390: type each Notion shortcut, use the slash menu by keyboard only, select with the mouse and bold, toggle a checkbox, Mod-click a link, paste 300 lines, reload with JS disabled and save, confirm DB Markdown equals typed text.

## U05 — Contributions workspace flow

- Status: `TODO`
- Depends on: U04
- Intent: one save model, less chrome around the text, and gentle guidance toward traceable evidence.
- Files: `app/routes/contributions.tsx`, `app/routes/contribution-file.tsx`, `app/routes/contribution-company.tsx`, `app/routes/contributions-index.tsx`, `app/lib/contributions.ts`, new pure `app/lib/evidence-lint.ts`, `PRD.md` (contributions section), `tests/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Markdown autosaves; company/position/dates need "Save position" | Existing positions autosave details too (validated, debounced, same footer status); manual save only to create a new position | One mental model |
  | Position details form is a large panel above the editor | Notion-style page header: position as an editable page title, then a properties row (company · start – end · Current) where each property edits in place (select, date input, toggle); autosaves like the text | The file's text is the work; matches U04's page layout |
  | Delete is a `<details>` block under the form | Overflow menu → ConfirmDialog (U02); no-JS fallback kept | Less clutter; explicit intent |
  | Import is a label styled as a button | Also accept drag-and-drop of `.md` files onto the editor (drop zone fades in 150ms on dragenter); same append/replace confirmation | Matches how people move files |
  | Append/Replace confirmation is an inline amber fieldset | ConfirmDialog with the file names | Consistent destructive pattern |
  | No help writing good evidence | Pure `lintEvidence(markdown)` returns hints: bullets without a number or outcome, missing tools section, very short file, first-person filler. Shown as a quiet checklist in the editor footer, never blocking | Supports "traceable over impressive" without AI calls |
  | Tree shows folders open, "New position here" and "Company settings" links in every folder | Hover/focus-revealed folder actions (always visible on touch); position count per company; current role marked | Quieter tree that scans faster |
  | Index page is a dashed box with two buttons | Index shows evidence health: positions, last edited, positions with lint hints, link to the weakest file | Gives returning users a next action |

- Acceptance:
  - PRD contributions section updated for detail autosave.
  - Leaving with unsaved or in-flight changes still prompts. Autosave failure keeps the text and offers Retry.
  - `lintEvidence` is unit-tested and deterministic.
  - Keyboard tree navigation (Arrow/Home/End) is preserved.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser: create position, edit details and text, reload to confirm both persisted, drag-import, delete via dialog, no-JS create and delete.

## U06 — Home as returning-user start

- Status: `TODO`
- Depends on: U02, U03
- Intent: home serves the returning user moving many applications forward, not a first-visit pitch.
- Files: `app/routes/home.tsx`, `app/lib/repositories.server.ts` (owner-scoped summary query if needed), `tests/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Hero "Turn your real experience into a focused resume." at text-5xl | Short page header; content leads | Operate surface, not marketing |
  | 24rem textarea dominates the viewport | Quick-tailor stays, but compact: textarea grows with content; application select beside the button | Keeps the 5-minute path without crowding the page |
  | "Before you analyze" tips box on every visit | Tips only while the user has no analyses or no positions; otherwise hidden | Repeat sessions skip known advice |
  | Recent analyses: title + company only | Pipeline snapshot: count per status; "Needs tailoring" (Saved/Applied with no resume); recent analyses with fit score and age | Shows the next action |
  | First-run state is "0 experiences available" | Setup checklist: profile → first position → first analysis, each linking to its page | Clear activation path |

- Acceptance: all summary queries include the owner condition. Empty, first-run, and busy states are designed. The quick-tailor action and its errors behave as today.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser with a fresh user and a seeded user.

## U07 — Applications board

- Status: `TODO`
- Depends on: U02
- Intent: cards you scan, not forms you read.
- Files: `app/routes/applications-board.tsx`, `app/components/application-board.tsx`, `app/components/application-card.tsx`, `tests/applications.test.ts`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Every card shows a status `<select>`, Move button, and Delete disclosure | Card shows position, company, location/salary, and fit/match. A "⋯" menu holds Move to…, Tailor, Open, and Delete (ConfirmDialog). No-JS: per-card form inside `<noscript>`, or the detail page status field | Cuts card height by about half; actions still reachable |
  | Status badge on cards already inside a status column | Remove inside columns; keep elsewhere | Redundant |
  | Dragged item is the in-place card at 60% opacity | dnd-kit `DragOverlay` lifted: `scale(1.02)`, stronger shadow, `cursor: grabbing`; placeholder dashed slot; drop settles in 200ms `--ease-out`; keyboard drags skip the lift animation | Physical feel; clear landing spot |
  | Column drop target is a faint bg change | Accent outline + tint on the column while over | Clear target |
  | Filter needs a submit and full reload | Filter cards client-side as you type (data already loaded), URL synced with `replace`; GET form fallback kept | Instant narrowing |
  | 6 columns × min 16rem always scroll horizontally on laptops | Rejected and Withdrawn collapse into a narrow "Closed" lane that expands on click; counts stay visible | Active pipeline fits on screen |
  | Fit and match as two text pills | One compact indicator (fit number + match recommendation glyph), with text alternative | Denser, same information |

- Acceptance: drag (pointer and keyboard), screen-reader announcements, optimistic moves, and no-JS status change all still work. A pure filter function is unit-tested.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser: drag with mouse, drag with keyboard, filter, delete, no-JS move at both widths.

## U08 — Application detail

- Status: `TODO`
- Depends on: U02, U07
- Intent: a record page that reads first and edits on demand, with Tailor as the obvious next step.
- Files: `app/routes/application-detail.tsx`, `app/components/job-match-panel.tsx`, `app/components/ui/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Whole page is one always-editable form (role, salary, 14-row JD, notes) with Save at the bottom | Read view by default: header (position, company, status switcher, posting link, salary, location) and primary "Tailor" action. Edit details in place per section. New application keeps the full form | Most visits read; edits are rare |
  | Status change needs editing the form and saving | Status switcher in the header saves immediately (optimistic + toast); no-JS form kept | Most common update becomes one action |
  | Notes save with the whole form | Notes autosave (debounced, footer status like U04) | Notes get written during calls and interviews |
  | JD textarea always expanded | JD shown as readable text, collapsed to ~12 lines with "Show all" and "Edit" | Reading ≠ editing |
  | Delete panel permanently in the sidebar | Overflow menu → ConfirmDialog | Destructive action off the main path |
  | Aside: three stacked cards (fit, resume, cover letter) | One "Documents" panel: fit score with factor mini-bar, resume and cover letter rows with Edit / PDF, "Tailor again" | Shows one documents set |
  | Salary: 4-column fieldset with its own h2 | Inline "min – max currency / period" row in the details edit | Less structure for one fact |

- Acceptance: create/edit/delete/status/notes all work with and without JS. The match panel keeps accept/reject overrides. Validation errors still map to fields.
- Verify: `pnpm typecheck && pnpm build`; browser both widths; no-JS create and edit.

## U09 — Tailor flow and analysis results

- Status: `TODO`
- Depends on: U02
- Intent: make the analysis read as an explained number and a clear path to generate.
- Files: `app/routes/application-tailor.tsx`, `app/routes/analysis-result.tsx`, `app/components/analysis-summary.tsx`, `tests/*`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | "1. Job description" textarea stays fully open after analysis | After analysis, collapse to a summary (title, length, analyzed time, "changed since" flag) with "Edit and re-analyze" | Results become the focus |
  | Fit score `text-6xl` number + 5 equal factor tiles | Score with one stacked bar showing each factor's share of 100; factor list with value / max and a one-line reason | Explains the number at a glance |
  | Matched and unmatched keywords in one chip cloud | Two groups: "In your evidence" and "Not found". Each unmatched keyword links to the contributions workspace | Gaps lead to an action |
  | Positions × keywords table with min-width 36rem | Per-position rows with matched counts and expandable keyword lists; stacks on mobile | No horizontal scroll on phones |
  | "Writing documents…" button text during a long generation | Pending panel listing the steps (resume → cover letter → saving), elapsed time, and a note that both save together. Disabled re-submit | Long waits feel tracked, not stuck |
  | Evidence match cards with strength + verification pills | Each match cites its source position (link to the contribution file); verified/unverified in DESIGN.md status colors | Traceability made visible |

- Acceptance: score values and disclaimers unchanged. Generation still all-or-nothing. Unverified matches still excluded and labeled.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser with a seeded analysis at both widths.

## U10 — Resume and cover letter editors

- Status: `TODO`
- Depends on: U02, U09
- Intent: edit with a live, trustworthy preview and never download stale content.
- Files: `app/routes/resume-editor.tsx`, `app/routes/cover-letter-editor.tsx`, `app/lib/resume.ts`, `app/lib/cover-letter.ts`, `tests/resume.test.ts`, `tests/cover-letter.test.ts`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Preview renders saved loader data; edits only appear after save | Preview updates live from form state | WYSIWYG for a document users will send |
  | "Download PDF" at top downloads the saved version while edits are unsaved | With unsaved changes, Download becomes "Save and download" (or is disabled with a reason); unsaved-changes leave guard | No stale PDFs |
  | Save button at the end of a long form | Sticky action bar: status, Save, Download | Always reachable |
  | Bullets are fixed textareas: no add, remove, or reorder | Remove, reorder (buttons + keyboard; drag optional), and restore-from-original per bullet. No free-form "add bullet" without a source position | Editing control without breaking traceability |
  | Bullet source is invisible | Each bullet shows its source position(s), with a popover of the cited evidence | Traceable claims visible in the editor |
  | Skills as a comma-separated textarea | Tokenized skill list (add, remove, reorder); form posts the same field | Fewer comma errors |
  | Preview is a tall white box `min-h-[70rem]` | Paper at true Letter/A4 ratio, scaled to fit the column, with page-break markers | Shows what the PDF will look like |

- Acceptance: PDF still single-column with selectable text. Persisted structure and validation unchanged unless covered by updated tests. Same patterns applied to cover-letter paragraphs (keep each paragraph's citation).
- Verify: `pnpm test` (incl. `pdf.test.tsx`), `pnpm typecheck && pnpm build`; browser: edit, then download without saving and confirm the PDF contains the edit.

## U11 — Find jobs

- Status: `TODO`
- Depends on: U02
- Intent: triage listings faster without spending extra paid searches.
- Files: `app/routes/job-search.tsx`, `app/lib/job-listings.ts`, `tests/job-listings.test.ts`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Vertical list of large cards; description hidden in `<details>` | On ≥1024px: list on the left and selected listing's description on the right (URL keeps selection; no provider call). On mobile: list then detail | Read and decide without losing your place |
  | Save buttons look the same before and after | Saved state morphs in place ("On your board · Open · Tailor") with a 200ms crossfade; listing gets a saved marker in the list | State change visible where the action happened |
  | Search form as stacked fields | Compact single-row filter bar on desktop (keywords, location, posted, remote, Search); stays a GET form | Results get the screen |
  | No hint whether a listing fits | Investigate a deterministic "evidence overlap" hint from listing text vs. stored skills without a model call. Ship only if it is pure, tested, and labeled a heuristic; otherwise record "not done" with the reason | Faster triage; must not add model/provider cost |
  | Pagination text links | Same links styled as buttons with result range ("26–50") | Clearer paging |

- Acceptance: no extra aggregator requests (saving still never re-searches with JS on). Listing HTML still never rendered.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser with a fake provider (`JOB_LISTINGS_BASE_URL`) at both widths.

## U12 — Profile, AI settings, company, and auth pages

- Status: `TODO`
- Depends on: U02, U03
- Intent: bring the remaining pages up to the shared system, and make the resume header visible where it is edited.
- Files: `app/routes/profile.tsx`, `app/routes/ai-settings.tsx`, `app/routes/contribution-company.tsx`, `app/components/auth-form.tsx`, `app/routes/sign-in.tsx`, `app/routes/sign-up.tsx`
- Findings:

  | Before | After | Why |
  | --- | --- | --- |
  | Profile is a 2-column form with no hints | Live "resume header" preview beside the form (same paper style as U10); hints for headline and links; inline URL validation | Shows what the inputs produce |
  | AI settings: provider sections with masked keys | Clear current-state line ("Using your Anthropic key · ••••abcd"); Test shows inline pass/fail with timestamp; Revoke uses ConfirmDialog | Status first, actions second |
  | Company page delete in a red panel | Overflow → ConfirmDialog; disabled with reason while positions exist | Consistent destructive pattern |
  | Auth card with `shadow-cyan-950/30` glow, "Welcome back" | Auth uses the U01 identity; one line on what the product does; password visibility toggle; pending state on submit | First impression matches the product |

- Acceptance: no secret or key material shown beyond the last four characters. Auth redirect safety unchanged.
- Verify: `pnpm test && pnpm typecheck && pnpm build`; browser both widths; sign-up, sign-in, sign-out.

## U13 — Cross-app audit and finish

- Status: `TODO`
- Depends on: U03–U12
- Intent: confirm the redesign holds together and nothing regressed.
- Files: fixes only where findings require; `TASKS.md` evidence
- Acceptance:
  - `/impeccable audit` over `app/` with no P0/P1 findings left open (or each recorded with a reason).
  - Detector run over changed files; findings fixed or ignored with a reason.
  - Every route checked at 390px and 1440px, keyboard-only, with reduced motion on.
  - Contrast ≥ 4.5:1 for body text and ≥ 3:1 for UI boundaries in both themes.
  - No `transition: all`, no `ease-in`, no UI animation > 300ms (`grep` evidence).
- Verify: `pnpm test && pnpm typecheck && pnpm build && pnpm check`; audit report summary pasted into evidence.

## Handoff

- Current task: none `IN_PROGRESS`.
- Last completed action: replaced the S-series task list with the U-series UX plan above, based on a review of every route and the editor components. `PRODUCT.md` was created by `/impeccable init` in the same session. Then rewrote U04 to the user's choice: Notion-style inline live-preview editor (no separate preview pane), and aligned U05's position header with it. No source code changed.
- Verification: documentation only; no commands needed. Prior state (S13) passed `pnpm test && pnpm typecheck && pnpm build && pnpm check` (261 tests).
- Blockers: U01 needs the user to choose a visual direction. U00 needs user approval before touching the remote database.
- Changed files: `TASKS.md`, `PRODUCT.md`.
- Next task: U01 — Visual direction and DESIGN.md.
- First next action: run `/impeccable shape app shell redesign` (new-work, redesign mode). Read `PRODUCT.md` and this file's "Why this plan exists" section, then present 2–3 directions to the user before writing `DESIGN.md`.
