---
name: Resume Fit
description: The job hunt as a well-kept exhibit binder — evidence filed once, cited everywhere.
colors:
  board: "#e8e4db"
  board-deep: "#dcd7cc"
  sheet: "#fcfbf8"
  sheet-sunk: "#f4f1ea"
  field: "#ffffff"
  ink: "#1c1c1c"
  ink-2: "#4b4943"
  ink-3: "#65615a"
  rule: "#dcd7cc"
  rule-strong: "#8f887a"
  exhibit: "#24427a"
  exhibit-deep: "#1b3463"
  exhibit-tint: "#e4e9f2"
  manila: "#e1c06a"
  manila-tint: "#f6ecd0"
  manila-ink: "#6b5216"
  margin: "#c4473b"
  danger: "#a1352b"
  danger-tint: "#f6e3e0"
  ok: "#2f6b45"
  ok-tint: "#e2efe6"
  warn: "#8a5a12"
  warn-tint: "#f7ead2"
  violet: "#5b3f8c"
  violet-tint: "#ece6f4"
  paper: "#ffffff"
  paper-ink: "#111111"
  paper-ink-2: "#444444"
  paper-rule: "#999999"
  print-ink: "#111827"
  print-ink-2: "#374151"
  print-ink-3: "#4b5563"
typography:
  title:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  metric:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  auth-title:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  section-title:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  ui-small:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  label:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  stamp:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  writing:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  code:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875em"
    fontWeight: 400
    lineHeight: 1.5
  paper-name:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
  paper-name-letter:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
  paper-header-name:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
  paper-body:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  paper-letter-body:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  paper-heading:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.04em"
  paper-meta:
    fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
  pdf-body:
    fontFamily: "Helvetica"
    fontSize: "10pt"
    fontWeight: 400
    lineHeight: 1.4
  pdf-bold:
    fontFamily: "Helvetica-Bold"
    fontSize: "10pt"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  stamp: "2px"
  sheet: "3px"
  inner: "4px"
  control: "6px"
  pill: "999px"
  tab: "6px 6px 0 0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.exhibit}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.exhibit-deep}"
  button-secondary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.field}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "38px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "32px"
  tab-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
  tab-idle:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tab}"
  stamp:
    rounded: "{rounded.stamp}"
    typography: "{typography.stamp}"
    padding: "3px 6px"
  citation:
    backgroundColor: "{colors.manila-tint}"
    textColor: "{colors.manila-ink}"
    rounded: "{rounded.stamp}"
    typography: "{typography.stamp}"
---

# Design System: Resume Fit

## Overview

**Creative North Star: "The Exhibit Binder"**

Exhibit Binder. The job hunt is a well-kept binder: work history is filed once as numbered exhibits, and every score, resume bullet, and cover-letter paragraph cites the exhibit it came from. The interface is an Operate tool used daily at a desk, so it is light, calm, and dense where data lives. Expression lives in a few precise binder details: index tabs, white sheets on a warm-gray board, ruled hairlines, rubber-stamp status marks, and "Ex. N" citation chips. It is never in decoration.

Light only for now; a dark theme is deferred.

**Key Characteristics:**
- Warm-gray board ground with one white sheet per page.
- Index-tab navigation whose active tab joins the sheet.
- Rubber-stamp status marks and "Ex. N" citation chips.
- Notion-style live-preview writing page with a legal-pad margin rule.
- Documents previewed on true Letter paper, ATS-neutral.

## Colors

### Primary
- **Exhibit blue** (`#24427a`): primary actions, links, focus rings, the active selection. Hover deepens to `#1b3463`; tint `#e4e9f2` for selected rows and drop targets.

### Secondary
- **Manila** (`#e1c06a`, tint `#f6ecd0`, ink `#6b5216`): exhibit labels and citation chips, the "Saved" status. Never a button fill.

### Tertiary
- **Margin red** (`#c4473b`): the double margin rule on writing sheets. **Danger** (`#a1352b`, tint `#f6e3e0`) marks destructive actions and the Rejected status.

### Neutral
- **Board** (`#e8e4db`, deep `#dcd7cc`): the page ground behind sheets, sidebars, and the top band.
- **Sheet** (`#fcfbf8`, sunk `#f4f1ea`): the one working surface per page. **Field** (`#ffffff`) for inputs.
- **Ink** (`#1c1c1c`), **ink-2** (`#4b4943`), **ink-3** (`#65615a`, ≥4.5:1 on board and sheet): text tiers. **Rule** (`#dcd7cc`) hairlines; **rule-strong** (`#8f887a`, 3.4:1) control borders.

### Semantic
- Status inks: Saved = manila-ink, Applied = exhibit, Interviewing = violet `#5b3f8c`, Offer = ok `#2f6b45`, Rejected = danger, Withdrawn = ink-3. Each has a matching tint.
- Verification: verified = ok, needs review = warn `#8a5a12`, missing / unverified = danger.

### Named Rules
**The One Sheet Rule.** Each page has one white sheet carrying its primary work. Sections inside it are separated by ruled hairlines and headings, never by nested panels. Sidebars and secondary context sit directly on the board.

## Typography

- **Libre Franklin** for all UI. Franklin Gothic is the voice of legal and newspaper print, which fits the binder.
- **Source Serif 4** for writing surfaces (the evidence editor) and the long-form text of generated documents shown on paper.
- **JetBrains Mono** only for code and code blocks.

### Hierarchy
- Metric 2rem/700 (fit and match numbers). Title 1.75rem/700, tracking -0.015em. Auth title 1.5rem. Section title 1.375rem (pages inside the contributions workspace). Heading 1.125rem/650. Body 0.9375rem/1.55 (15px root). UI small 0.875rem. Label 0.8125rem/500. Caption 0.75rem. Stamp 0.6875rem/700 uppercase, tracking 0.06em; micro 0.625rem for exhibit chips in dense lists.
- Paper (resume and letter previews) uses fixed px sizes at Letter scale: name 22–26px, body 13px (letter body 14px serif), section headings 12px uppercase, meta 10–11px.
- Generated PDFs use Helvetica / Helvetica-Bold (built-in PDF fonts, selectable text, ATS-safe) with print inks `#111827`, `#374151`, `#4b5563`.
- Numbers in tables, salaries, scores, and dates use `font-variant-numeric: tabular-nums`.

### Named Rules
**The Paper Is Not The App Rule.** Paper previews and PDFs use plain inks on white with no binder tokens, so what the user sees is what a recruiter's ATS sees.

**No eyebrows.** No small uppercase kicker above a heading. Uppercase tracked text exists only inside stamps and citation chips.

## Layout

- The top band is board-colored: wordmark at left, index tabs across, account menu at right. Below it, the page sheet spans the content width (max 1200px; 1600px for the board), with 32px padding (20px under 640px).
- Spacing rhythm: 4/8/12/16/24/32/48. More space above a heading than below it.
- Two-pane pages (contributions, find jobs) put the list on the board and the selected item on the sheet.
- Under 768px: tabs collapse into a menu button; two-pane pages stack list then detail.

## Elevation & Depth

Paper on a board. Sheets cast one soft shadow; nothing else floats except popovers, menus, and dialogs.

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgb(28 28 28 / 0.06), 0 10px 28px -14px rgb(28 28 28 / 0.22)`): the page sheet and board-column cards.
- **Lifted** (`0 2px 4px rgb(28 28 28 / 0.08), 0 18px 40px -16px rgb(28 28 28 / 0.35)`): dragged cards, popovers, menus, dialogs.

## Shapes

Paper corners are nearly square (sheet 3px, stamp 2px). Controls are 6px; items inside popovers, menus, and toolbars are 4px. Pills (keyword chips, avatar, dots) are fully round. Index tabs round only their top corners (6px) and sit flush on the sheet's top edge. Borders are 1px. Ruled lines are hairlines in `rule`.

## Components

### Index tabs (signature)
- Idle: ink-2 text on board, 6px top radius, 1px rule-colored top and side edges.
- Active: sheet background, ink text, joins the sheet below with no seam. Switching tabs is instant, with no animation.

### Stamps
- Uppercase 11px/700 text in a status ink, a 1.5px border in the same ink at 70% opacity, a tint fill, 2px radius. Used for application status, verification, and match recommendation.

### Citation chips
- "Ex. 3" in manila-ink on manila-tint, 2px radius. Focus or hover shows the cited evidence in a popover. A chip is a link to the exhibit.

### Buttons
- **Primary:** exhibit fill, sheet text, 36px high, 6px radius. **Secondary:** field fill, ink text, rule-strong border. **Ghost:** no border, ink-2 text. **Danger:** field fill, danger text and border.
- **Press:** `transform: scale(0.97)` over 160ms `--ease-out`. Hover color changes are gated to fine pointers.

### Inputs / Fields
- White field, 1px rule-strong border, 6px radius, 38px high. Focus: 2px exhibit outline, offset 1px. Error: danger border and message below, wired with `aria-describedby`.

### Sheets and writing sheet
- Writing sheet (the evidence editor) adds a double margin rule (two 1px margin-red lines, 3px apart) 40px from the left edge on wide screens.

### Writing page (signature)
- The contribution editor is a Notion-style live preview: Markdown renders in place (headings, emphasis, bullets, checkboxes, quotes, links, code), raw markers show only on lines touched by the cursor. A `/` menu inserts blocks and contribution sections and opens instantly; a dark ink toolbar appears over mouse selections (150ms, from the selection edge). Footer: save status, word count, evidence suggestions, shortcuts.

### Board cards
- Paper cards on board-deep columns; status shown by the column stamp, not on each card. A "⋯" menu holds Move to, Tailor, Open, Delete. Dragging lifts a copy (scale 1.02, slight tilt, lifted shadow) over a dashed placeholder; keyboard drags skip the lift.

### Paper preview
- Letter page (816×1056 CSS px) scaled to its column, with a page count and dashed "Page N" markers in margin red.

### Dialogs, menus, toasts
- Dialogs enter with `opacity 0→1` and `scale(0.96→1)` over 240ms `--ease-out`, and exit in 150ms. Menus and popovers scale from their trigger (`transform-origin` at the trigger) over 150ms. Toasts slide 8px from the bottom edge and leave the same way.

## Do's and Don'ts

### Do:
- **Do** keep one sheet per page and separate its sections with hairlines.
- **Do** cite exhibits ("Ex. 3") wherever a generated or matched claim appears.
- **Do** use motion tokens: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`; press 160ms, popover 150ms, dialog 240ms; exits faster than enters.
- **Do** respect `prefers-reduced-motion`: keep opacity, drop transforms.

### Don't:
- **Don't** nest panels or wrap every section in a bordered card.
- **Don't** put eyebrow labels above headings.
- **Don't** animate keyboard-initiated actions, tab switches, or list navigation.
- **Don't** use `transition: all`, `ease-in`, or UI durations over 300ms.
- **Don't** use emoji or Unicode glyphs as icons. Icons are drawn SVG with one stroke weight (1.75px, 16/20px grid).
