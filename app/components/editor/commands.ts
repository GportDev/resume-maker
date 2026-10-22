import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { indentLess, indentMore } from "@codemirror/commands";
import type { EditorView, KeyBinding } from "@codemirror/view";
import { type FormatAction, formatMarkdown } from "../../lib/markdown-format";

/** Applies a pure Markdown format action to the editor's main selection. */
export function runFormat(
  view: EditorView,
  action: FormatAction,
  template = "",
): boolean {
  const main = view.state.selection.main;
  const change = formatMarkdown(
    view.state.doc.toString(),
    { start: main.from, end: main.to },
    action,
    template,
  );
  view.dispatch({
    changes: { from: change.from, to: change.to, insert: change.insert },
    selection: { anchor: change.selection.start, head: change.selection.end },
    scrollIntoView: true,
    userEvent: "input.format",
  });
  view.focus();
  return true;
}

const listLine = /^\s*(?:[-*+]|\d+\.)\s/;

function inListItem(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  return listLine.test(line.text);
}

export function formattingKeymap(onSave: () => void): KeyBinding[] {
  const bind = (key: string, action: FormatAction): KeyBinding => ({
    key,
    run: (view) => runFormat(view, action),
    preventDefault: true,
  });
  return [
    bind("Mod-b", "bold"),
    bind("Mod-i", "italic"),
    bind("Mod-e", "code"),
    bind("Mod-k", "link"),
    bind("Mod-Alt-1", "heading1"),
    bind("Mod-Alt-2", "heading"),
    bind("Mod-Alt-3", "heading3"),
    bind("Mod-Shift-7", "numbered"),
    bind("Mod-Shift-8", "bullet"),
    bind("Mod-Shift-9", "checklist"),
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => {
        onSave();
        return true;
      },
    },
    // Tab indents list items only, so Tab still leaves the editor elsewhere.
    {
      key: "Tab",
      run: (view) => (inListItem(view) ? indentMore(view) : false),
      shift: (view) => (inListItem(view) ? indentLess(view) : false),
    },
  ];
}

export const shortcutHelp: { keys: string; label: string }[] = [
  { keys: "⌘/Ctrl B", label: "Bold" },
  { keys: "⌘/Ctrl I", label: "Italic" },
  { keys: "⌘/Ctrl E", label: "Inline code" },
  { keys: "⌘/Ctrl K", label: "Link" },
  { keys: "⌘/Ctrl ⌥/Alt 1–3", label: "Heading 1–3" },
  { keys: "⌘/Ctrl ⇧ 7 / 8 / 9", label: "Numbered / bullet / checklist" },
  { keys: "⌘/Ctrl S", label: "Save now" },
  { keys: "/", label: "Insert a block or section" },
  { keys: "⌘/Ctrl click", label: "Open link" },
];

type SlashItem = {
  label: string;
  detail: string;
  keywords: string;
  insert: (view: EditorView, from: number, to: number) => void;
};

function replaceThenFormat(action: FormatAction, template = "") {
  return (view: EditorView, from: number, to: number) => {
    view.dispatch({ changes: { from, to, insert: "" } });
    runFormat(view, action, template);
  };
}

function section(title: string, starter: string) {
  return replaceThenFormat("template", `## ${title}\n\n${starter}`);
}

const slashItems: SlashItem[] = [
  {
    label: "Heading 1",
    detail: "#",
    keywords: "h1 title",
    insert: replaceThenFormat("heading1"),
  },
  {
    label: "Heading 2",
    detail: "##",
    keywords: "h2 section",
    insert: replaceThenFormat("heading"),
  },
  {
    label: "Heading 3",
    detail: "###",
    keywords: "h3 subsection",
    insert: replaceThenFormat("heading3"),
  },
  {
    label: "Bullet list",
    detail: "-",
    keywords: "ul unordered list",
    insert: replaceThenFormat("bullet"),
  },
  {
    label: "Numbered list",
    detail: "1.",
    keywords: "ol ordered list",
    insert: replaceThenFormat("numbered"),
  },
  {
    label: "Checklist",
    detail: "[ ]",
    keywords: "todo task checkbox",
    insert: replaceThenFormat("checklist"),
  },
  {
    label: "Quote",
    detail: ">",
    keywords: "blockquote",
    insert: replaceThenFormat("quote"),
  },
  {
    label: "Divider",
    detail: "---",
    keywords: "hr rule separator",
    insert: replaceThenFormat("divider"),
  },
  {
    label: "Code block",
    detail: "```",
    keywords: "pre fence snippet",
    insert: replaceThenFormat("codeblock"),
  },
  {
    label: "Context section",
    detail: "Team, product, scope",
    keywords: "context section team scope",
    insert: section("Context", "- Team, product, and scope: "),
  },
  {
    label: "Contributions section",
    detail: "What you did",
    keywords: "contributions section work",
    insert: section("Contributions", "- "),
  },
  {
    label: "Outcomes section",
    detail: "Metrics and results",
    keywords: "outcomes metrics results impact section",
    insert: section("Outcomes and metrics", "- "),
  },
  {
    label: "Tools section",
    detail: "Stack and methods",
    keywords: "tools stack tech section",
    insert: section("Tools", "- "),
  },
];

/** "/" at the start of a line or after a space opens block and section picks. */
export function slashCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const match = /(?:^|\s)\/([\w-]*)$/.exec(before);
  if (!match) return null;
  const query = match[1] ?? "";
  const from = context.pos - query.length - 1;
  const lower = query.toLowerCase();
  const options: Completion[] = slashItems
    .filter(
      (item) =>
        !lower ||
        item.label.toLowerCase().includes(lower) ||
        item.keywords.includes(lower),
    )
    .map((item) => ({
      label: item.label,
      detail: item.detail,
      apply: (view, _completion, applyFrom, applyTo) =>
        item.insert(view, applyFrom, applyTo),
    }));
  if (!options.length) return null;
  return { from, options, filter: false };
}
