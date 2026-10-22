export type FormatAction =
  | "heading"
  | "heading1"
  | "heading3"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "divider"
  | "codeblock"
  | "template";

export type TextSelection = { start: number; end: number };

export type TextChange = {
  from: number;
  to: number;
  insert: string;
  selection: TextSelection;
};

const headingPattern = /^#{1,6} /;
const bulletPrefix = "- ";
const checklistPattern = /^- \[[ xX]\] /;
const numberedPattern = /^\d+\. /;
const quotePrefix = "> ";

const inlinePlaceholders = {
  bold: { marker: "**", placeholder: "strong text" },
  italic: { marker: "*", placeholder: "emphasis" },
  code: { marker: "`", placeholder: "code" },
} as const;

function lineStartAt(text: string, index: number): number {
  if (index <= 0) return 0;
  return text.lastIndexOf("\n", index - 1) + 1;
}

function lineEndAt(text: string, index: number): number {
  const end = text.indexOf("\n", index);
  return end === -1 ? text.length : end;
}

function toggleHeading(
  text: string,
  selection: TextSelection,
  level: number,
): TextChange {
  const lineStart = lineStartAt(text, selection.start);
  const lineEnd = lineEndAt(text, lineStart);
  const line = text.slice(lineStart, lineEnd);
  const prefix = `${"#".repeat(level)} `;
  const existing = line.match(headingPattern)?.[0] ?? "";
  const replacement = existing === prefix ? "" : prefix;
  const shift = replacement.length - existing.length;
  return {
    from: lineStart,
    to: lineStart + existing.length,
    insert: replacement,
    selection: {
      start: Math.max(lineStart, selection.start + shift),
      end: Math.max(lineStart, selection.end + shift),
    },
  };
}

type LinePrefix = {
  /** Matches the prefix this action owns. */
  owns: RegExp;
  /** Prefixes from sibling list styles that this action replaces. */
  replaces: RegExp;
  make: (index: number) => string;
};

const linePrefixes: Record<
  "bullet" | "numbered" | "checklist" | "quote",
  LinePrefix
> = {
  bullet: {
    owns: /^- (?!\[[ xX]\] )/,
    replaces: /^(?:- \[[ xX]\] |\d+\. )/,
    make: () => bulletPrefix,
  },
  numbered: {
    owns: numberedPattern,
    replaces: /^(?:- \[[ xX]\] |- )/,
    make: (index) => `${index + 1}. `,
  },
  checklist: {
    owns: checklistPattern,
    replaces: /^(?:- |\d+\. )/,
    make: () => "- [ ] ",
  },
  quote: { owns: /^> /, replaces: /^(?!)/, make: () => quotePrefix },
};

function toggleLinePrefix(
  text: string,
  selection: TextSelection,
  style: keyof typeof linePrefixes,
): TextChange {
  const { owns, replaces, make } = linePrefixes[style];
  const from = lineStartAt(text, selection.start);
  const lastIndex =
    selection.end > selection.start && text[selection.end - 1] === "\n"
      ? selection.end - 1
      : selection.end;
  const to = lineEndAt(text, lastIndex);
  const lines = text.slice(from, to).split("\n");
  const allOwned = lines.every((line) => owns.test(line));
  const insert = lines
    .map((line, index) => {
      if (allOwned) return line.replace(owns, "");
      if (owns.test(line)) return line;
      return `${make(index)}${line.replace(replaces, "")}`;
    })
    .join("\n");
  const singleCursor = selection.start === selection.end && lines.length === 1;
  if (singleCursor) {
    const shift = insert.length - (to - from);
    const cursor = Math.max(from, selection.start + shift);
    return { from, to, insert, selection: { start: cursor, end: cursor } };
  }
  return {
    from,
    to,
    insert,
    selection: { start: from, end: from + insert.length },
  };
}

const blockPrefix = /^(?:#{1,6} |\s*(?:[-*+] \[[ xX]\] |[-*+] |\d+\. )|> )/;

/** Keeps inline formatting off a line's block marker ("- ", "## ", "> "). */
function skipBlockPrefix(
  text: string,
  selection: TextSelection,
): TextSelection {
  const lineStart = lineStartAt(text, selection.start);
  const prefix = text
    .slice(lineStart, lineEndAt(text, lineStart))
    .match(blockPrefix)?.[0];
  if (!prefix) return selection;
  const contentStart = lineStart + prefix.length;
  if (selection.start >= contentStart || selection.end <= contentStart) {
    return selection;
  }
  return { start: contentStart, end: selection.end };
}

function toggleInline(
  text: string,
  rawSelection: TextSelection,
  kind: keyof typeof inlinePlaceholders,
): TextChange {
  const selection = skipBlockPrefix(text, rawSelection);
  const { marker, placeholder } = inlinePlaceholders[kind];
  const size = marker.length;
  const before = text.slice(selection.start - size, selection.start);
  const after = text.slice(selection.end, selection.end + size);
  // Selection already sits inside the markers: unwrap.
  if (
    selection.start >= size &&
    before === marker &&
    after === marker &&
    !(kind === "italic" && text[selection.start - size - 1] === "*")
  ) {
    const inner = text.slice(selection.start, selection.end);
    return {
      from: selection.start - size,
      to: selection.end + size,
      insert: inner,
      selection: {
        start: selection.start - size,
        end: selection.end - size,
      },
    };
  }
  const selected = text.slice(selection.start, selection.end);
  // Selection includes the markers: unwrap.
  if (
    selected.length > size * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(size, -size);
    return {
      from: selection.start,
      to: selection.end,
      insert: inner,
      selection: {
        start: selection.start,
        end: selection.start + inner.length,
      },
    };
  }
  const inner = selected || placeholder;
  return {
    from: selection.start,
    to: selection.end,
    insert: `${marker}${inner}${marker}`,
    selection: {
      start: selection.start + size,
      end: selection.start + size + inner.length,
    },
  };
}

function insertLink(text: string, selection: TextSelection): TextChange {
  const selected = text.slice(selection.start, selection.end);
  const label = selected || "link text";
  const url = "https://";
  const insert = `[${label}](${url})`;
  const labelStart = selection.start + 1;
  const urlStart = labelStart + label.length + 2;
  return {
    from: selection.start,
    to: selection.end,
    insert,
    selection: selected
      ? { start: urlStart, end: urlStart + url.length }
      : { start: labelStart, end: labelStart + label.length },
  };
}

function insertBlock(
  text: string,
  selection: TextSelection,
  block: string,
  cursorOffset?: number,
): TextChange {
  const before = text.slice(0, selection.start);
  const separator =
    !before || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const insert = `${separator}${block}`;
  const cursor =
    selection.start + separator.length + (cursorOffset ?? block.length);
  return {
    from: selection.start,
    to: selection.end,
    insert,
    selection: { start: cursor, end: cursor },
  };
}

export function formatMarkdown(
  text: string,
  selection: TextSelection,
  action: FormatAction,
  template = "",
): TextChange {
  const bounded = {
    start: Math.max(0, Math.min(selection.start, text.length)),
    end: Math.max(0, Math.min(selection.end, text.length)),
  };
  switch (action) {
    case "heading":
      return toggleHeading(text, bounded, 2);
    case "heading1":
      return toggleHeading(text, bounded, 1);
    case "heading3":
      return toggleHeading(text, bounded, 3);
    case "bullet":
    case "numbered":
    case "checklist":
    case "quote":
      return toggleLinePrefix(text, bounded, action);
    case "bold":
    case "italic":
    case "code":
      return toggleInline(text, bounded, action);
    case "link":
      return insertLink(text, bounded);
    case "divider":
      return insertBlock(text, bounded, "---\n\n");
    case "codeblock":
      return insertBlock(text, bounded, "```\n\n```\n", 4);
    case "template":
      return insertBlock(text, bounded, template);
  }
}

export function applyTextChange(text: string, change: TextChange): string {
  return `${text.slice(0, change.from)}${change.insert}${text.slice(change.to)}`;
}

/** Counts words the way a reader would: whitespace-separated, markup ignored. */
export function countWords(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~[\]()-]/g, " ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return words.length;
}
