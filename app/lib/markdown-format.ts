export type FormatAction = "heading" | "bullet" | "bold" | "template";

export type TextSelection = { start: number; end: number };

export type TextChange = {
  from: number;
  to: number;
  insert: string;
  selection: TextSelection;
};

const headingPrefix = "## ";
const bulletPrefix = "- ";
const boldPlaceholder = "strong text";

function lineStartAt(text: string, index: number): number {
  return text.lastIndexOf("\n", index - 1) + 1;
}

function lineEndAt(text: string, index: number): number {
  const end = text.indexOf("\n", index);
  return end === -1 ? text.length : end;
}

function toggleHeading(text: string, selection: TextSelection): TextChange {
  const lineStart = lineStartAt(text, selection.start);
  if (text.startsWith(headingPrefix, lineStart)) {
    const shift = -headingPrefix.length;
    return {
      from: lineStart,
      to: lineStart + headingPrefix.length,
      insert: "",
      selection: {
        start: Math.max(lineStart, selection.start + shift),
        end: Math.max(lineStart, selection.end + shift),
      },
    };
  }
  return {
    from: lineStart,
    to: lineStart,
    insert: headingPrefix,
    selection: {
      start: selection.start + headingPrefix.length,
      end: selection.end + headingPrefix.length,
    },
  };
}

function toggleBullets(text: string, selection: TextSelection): TextChange {
  const from = lineStartAt(text, selection.start);
  const lastIndex =
    selection.end > selection.start && text[selection.end - 1] === "\n"
      ? selection.end - 1
      : selection.end;
  const to = lineEndAt(text, lastIndex);
  const lines = text.slice(from, to).split("\n");
  const allBulleted = lines.every((line) => line.startsWith(bulletPrefix));
  const insert = lines
    .map((line) =>
      allBulleted ? line.slice(bulletPrefix.length) : `${bulletPrefix}${line}`,
    )
    .join("\n");
  return {
    from,
    to,
    insert,
    selection: { start: from, end: from + insert.length },
  };
}

function wrapBold(text: string, selection: TextSelection): TextChange {
  const selected = text.slice(selection.start, selection.end);
  const inner = selected || boldPlaceholder;
  return {
    from: selection.start,
    to: selection.end,
    insert: `**${inner}**`,
    selection: {
      start: selection.start + 2,
      end: selection.start + 2 + inner.length,
    },
  };
}

function insertBlock(
  text: string,
  selection: TextSelection,
  block: string,
): TextChange {
  const before = text.slice(0, selection.start);
  const separator =
    !before || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const insert = `${separator}${block}`;
  const cursor = selection.start + insert.length;
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
  if (action === "heading") return toggleHeading(text, bounded);
  if (action === "bullet") return toggleBullets(text, bounded);
  if (action === "bold") return wrapBold(text, bounded);
  return insertBlock(text, bounded, template);
}

export function applyTextChange(text: string, change: TextChange): string {
  return `${text.slice(0, change.from)}${change.insert}${text.slice(change.to)}`;
}
