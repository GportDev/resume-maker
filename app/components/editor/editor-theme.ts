import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const ui = '"Libre Franklin", ui-sans-serif, system-ui, sans-serif';
const writing = '"Source Serif 4", ui-serif, Georgia, serif';
const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

/** A writing page, not a code box: serif text on the sheet, no gutters. */
export const writingTheme = EditorView.theme({
  "&": {
    color: "var(--color-ink)",
    backgroundColor: "transparent",
    fontSize: "1.0625rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: writing,
    lineHeight: "1.7",
    overflow: "visible",
  },
  ".cm-content": {
    padding: "0 0 40vh",
    caretColor: "var(--color-exhibit)",
    maxWidth: "68ch",
  },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-exhibit)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
    { backgroundColor: "var(--color-exhibit-tint) !important" },
  ".cm-placeholder": { color: "var(--color-ink-3)", fontStyle: "italic" },

  ".cm-h": {
    fontFamily: ui,
    fontWeight: "700",
    letterSpacing: "-0.01em",
    color: "var(--color-ink)",
  },
  ".cm-h1": { fontSize: "1.75em", lineHeight: "1.25", paddingTop: "0.6em" },
  ".cm-h2": { fontSize: "1.3em", lineHeight: "1.3", paddingTop: "0.9em" },
  ".cm-h3": { fontSize: "1.1em", lineHeight: "1.35", paddingTop: "0.6em" },
  ".cm-strong": { fontWeight: "700", color: "var(--color-ink)" },
  ".cm-em": { fontStyle: "italic" },
  ".cm-strike": {
    textDecoration: "line-through",
    color: "var(--color-ink-3)",
  },
  ".cm-inline-code": {
    fontFamily: mono,
    fontSize: "0.86em",
    backgroundColor: "var(--color-sheet-sunk)",
    borderRadius: "2px",
    padding: "0.1em 0.25em",
  },
  ".cm-link": {
    color: "var(--color-exhibit)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    textDecorationColor:
      "color-mix(in srgb, var(--color-exhibit) 45%, transparent)",
  },
  ".cm-link[data-href]": { cursor: "pointer" },
  ".cm-li": {
    paddingLeft: "1em !important",
    textIndent: "-1em",
  },
  ".cm-list-number": {
    fontFamily: ui,
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-ink-3)",
  },
  ".cm-bullet": {
    display: "inline-block",
    width: "1em",
    textIndent: "0",
  },
  ".cm-bullet::before": {
    content: '""',
    display: "inline-block",
    width: "0.32em",
    height: "0.32em",
    marginLeft: "0.3em",
    verticalAlign: "0.2em",
    borderRadius: "999px",
    backgroundColor: "var(--color-ink-2)",
  },
  ".cm-task-box": {
    width: "0.95em",
    height: "0.95em",
    margin: "0 0.45em 0 0.1em",
    verticalAlign: "-0.1em",
    accentColor: "var(--color-exhibit)",
    cursor: "pointer",
  },
  ".cm-task-done": {
    color: "var(--color-ink-3)",
    textDecoration: "line-through",
  },
  ".cm-quote": {
    borderLeft: "2px solid var(--color-rule-strong)",
    paddingLeft: "0.9em !important",
    color: "var(--color-ink-2)",
    fontStyle: "italic",
  },
  ".cm-hr-line": { color: "var(--color-ink-3)" },
  ".cm-rule": {
    display: "inline-block",
    width: "100%",
    height: "1px",
    verticalAlign: "middle",
    backgroundColor: "var(--color-rule)",
  },
  ".cm-codeblock": {
    fontFamily: mono,
    fontSize: "0.86em",
    lineHeight: "1.6",
    backgroundColor: "var(--color-sheet-sunk)",
    padding: "0 0.9em !important",
  },

  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--color-rule)",
    borderRadius: "6px",
    backgroundColor: "var(--color-sheet)",
    boxShadow:
      "0 2px 4px rgb(28 28 28 / 0.08), 0 18px 40px -16px rgb(28 28 28 / 0.35)",
    padding: "4px",
    fontFamily: ui,
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: ui,
    maxHeight: "18rem",
    minWidth: "15rem",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "6px 8px !important",
    borderRadius: "4px",
    fontSize: "0.875rem",
    lineHeight: "1.3",
    color: "var(--color-ink)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-exhibit-tint)",
    color: "var(--color-ink)",
  },
  ".cm-completionDetail": {
    marginLeft: "0.75em",
    fontStyle: "normal",
    color: "var(--color-ink-3)",
    fontSize: "0.8125rem",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    fontWeight: "700",
  },
});

/** Raw markers (visible on the active line) read as quiet notation. */
export const writingHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.processingInstruction, color: "var(--color-ink-3)" },
    { tag: tags.url, color: "var(--color-ink-3)" },
    { tag: tags.labelName, color: "var(--color-ink-3)" },
    { tag: tags.contentSeparator, color: "var(--color-ink-3)" },
    { tag: tags.monospace, fontFamily: mono },
  ]),
);
