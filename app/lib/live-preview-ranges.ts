import type { SyntaxNodeRef, Tree } from "@lezer/common";

/**
 * Pure description of how the live-preview editor renders Markdown. The editor
 * maps these to CodeMirror decorations; nothing here writes to the document.
 * Lines touched by the cursor or selection ("active" lines) keep their raw
 * markers visible but still get styling.
 */
export type PreviewDecoration =
  | { type: "hide"; from: number; to: number }
  | { type: "mark"; from: number; to: number; className: string; href?: string }
  | { type: "line"; from: number; className: string }
  | { type: "bullet"; from: number; to: number }
  | {
      type: "checkbox";
      from: number;
      to: number;
      checked: boolean;
      /** Position of the character inside the brackets ("[ ]" / "[x]"). */
      toggleAt: number;
    }
  | { type: "rule"; from: number; to: number };

export type PreviewDoc = {
  lineAt(pos: number): { number: number; from: number; to: number };
  sliceString(from: number, to: number): string;
  readonly length: number;
};

const safeHref = /^https?:\/\/[^\s]+$/i;

function headingLevel(name: string): number | null {
  const match = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
  return match ? Number(match[1]) : null;
}

export function activeLinesFor(
  doc: PreviewDoc,
  ranges: readonly { from: number; to: number }[],
): Set<number> {
  const lines = new Set<number>();
  for (const range of ranges) {
    const first = doc.lineAt(range.from).number;
    const last = doc.lineAt(range.to).number;
    for (let line = first; line <= last; line++) lines.add(line);
  }
  return lines;
}

export function livePreviewDecorations(
  tree: Tree,
  doc: PreviewDoc,
  activeLines: ReadonlySet<number>,
  visible: readonly { from: number; to: number }[] = [
    { from: 0, to: doc.length },
  ],
): PreviewDecoration[] {
  const out: PreviewDecoration[] = [];
  const lineIsActive = (pos: number) => activeLines.has(doc.lineAt(pos).number);
  const linesOf = (from: number, to: number) => {
    const starts: number[] = [];
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      starts.push(line.from);
      if (line.to >= to) break;
      pos = line.to + 1;
    }
    return starts;
  };
  /** Hide a marker plus the single space that follows it. */
  const hideWithSpace = (from: number, to: number) => {
    const end = doc.sliceString(to, to + 1) === " " ? to + 1 : to;
    out.push({ type: "hide", from, to: end });
  };

  for (const range of visible) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter: (node: SyntaxNodeRef) => {
        const name = node.name;
        const level = headingLevel(name);
        if (level !== null) {
          const line = doc.lineAt(node.from);
          out.push({
            type: "line",
            from: line.from,
            className: `cm-h cm-h${Math.min(level, 3)}`,
          });
          return;
        }
        switch (name) {
          case "HeaderMark": {
            const parent = node.node.parent;
            if (parent?.name.startsWith("Setext")) return;
            if (!lineIsActive(node.from)) hideWithSpace(node.from, node.to);
            return;
          }
          case "StrongEmphasis":
            out.push({
              type: "mark",
              from: node.from,
              to: node.to,
              className: "cm-strong",
            });
            return;
          case "Emphasis":
            out.push({
              type: "mark",
              from: node.from,
              to: node.to,
              className: "cm-em",
            });
            return;
          case "Strikethrough":
            out.push({
              type: "mark",
              from: node.from,
              to: node.to,
              className: "cm-strike",
            });
            return;
          case "EmphasisMark":
          case "StrikethroughMark":
            if (!lineIsActive(node.from)) {
              out.push({ type: "hide", from: node.from, to: node.to });
            }
            return;
          case "InlineCode":
            out.push({
              type: "mark",
              from: node.from,
              to: node.to,
              className: "cm-inline-code",
            });
            return;
          case "CodeMark": {
            if (node.node.parent?.name === "InlineCode") {
              if (!lineIsActive(node.from)) {
                out.push({ type: "hide", from: node.from, to: node.to });
              }
            }
            return;
          }
          case "Link": {
            const link = node.node;
            const marks = link.getChildren("LinkMark");
            const url = link.getChild("URL");
            const open = marks[0];
            const close = marks[1];
            if (!open || !close) return false;
            const href = url ? doc.sliceString(url.from, url.to) : "";
            out.push({
              type: "mark",
              from: open.to,
              to: close.from,
              className: "cm-link",
              href: safeHref.test(href) ? href : undefined,
            });
            if (!lineIsActive(link.from)) {
              out.push({ type: "hide", from: open.from, to: open.to });
              out.push({ type: "hide", from: close.from, to: link.to });
            }
            return false;
          }
          case "Blockquote":
            for (const start of linesOf(node.from, node.to)) {
              out.push({ type: "line", from: start, className: "cm-quote" });
            }
            return;
          case "QuoteMark":
            if (!lineIsActive(node.from)) hideWithSpace(node.from, node.to);
            return;
          case "HorizontalRule": {
            const line = doc.lineAt(node.from);
            out.push({
              type: "line",
              from: line.from,
              className: "cm-hr-line",
            });
            if (!lineIsActive(node.from)) {
              out.push({ type: "rule", from: node.from, to: node.to });
            }
            return;
          }
          case "FencedCode":
            for (const start of linesOf(node.from, node.to)) {
              out.push({
                type: "line",
                from: start,
                className: "cm-codeblock",
              });
            }
            return false;
          case "ListItem": {
            const item = node.node;
            const mark = item.getChild("ListMark");
            if (!mark) return;
            const listName = item.parent?.name;
            out.push({
              type: "line",
              from: doc.lineAt(mark.from).from,
              className: "cm-li",
            });
            const task = item.getChild("Task");
            const taskMarker = task?.getChild("TaskMarker");
            const active = lineIsActive(mark.from);
            if (taskMarker) {
              if (!active) {
                const marker = doc.sliceString(taskMarker.from, taskMarker.to);
                const end =
                  doc.sliceString(taskMarker.to, taskMarker.to + 1) === " "
                    ? taskMarker.to + 1
                    : taskMarker.to;
                out.push({
                  type: "checkbox",
                  from: mark.from,
                  to: end,
                  checked: /\[[xX]\]/.test(marker),
                  toggleAt: taskMarker.from + 1,
                });
              }
              if (
                task &&
                /\[[xX]\]/.test(doc.sliceString(task.from, task.to))
              ) {
                out.push({
                  type: "mark",
                  from: taskMarker.to,
                  to: task.to,
                  className: "cm-task-done",
                });
              }
              return;
            }
            if (listName === "BulletList") {
              if (!active)
                out.push({
                  type: "bullet",
                  from: mark.from,
                  to:
                    doc.sliceString(mark.to, mark.to + 1) === " "
                      ? mark.to + 1
                      : mark.to,
                });
            } else {
              out.push({
                type: "mark",
                from: mark.from,
                to: mark.to,
                className: "cm-list-number",
              });
            }
            return;
          }
          default:
            return;
        }
      },
    });
  }
  return dedupe(out);
}

/** Parent nodes that span several visible ranges are entered once per range. */
function dedupe(decorations: PreviewDecoration[]): PreviewDecoration[] {
  const seen = new Set<string>();
  return decorations.filter((decoration) => {
    const key = JSON.stringify(decoration);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
