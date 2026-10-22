import { markdownLanguage } from "@codemirror/lang-markdown";
import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  activeLinesFor,
  livePreviewDecorations,
  type PreviewDecoration,
} from "../app/lib/live-preview-ranges";

function preview(markdown: string, activeLines: number[] = []) {
  const doc = Text.of(markdown.split("\n"));
  const tree = markdownLanguage.parser.parse(markdown);
  return livePreviewDecorations(tree, doc, new Set(activeLines));
}

function hidden(markdown: string, decorations: PreviewDecoration[]) {
  return decorations
    .filter((item) => item.type === "hide")
    .map((item) => markdown.slice(item.from, item.to));
}

function rendered(markdown: string, decorations: PreviewDecoration[]) {
  const ranges = decorations
    .filter(
      (item): item is Extract<PreviewDecoration, { to: number }> =>
        item.type === "hide" ||
        item.type === "bullet" ||
        item.type === "checkbox" ||
        item.type === "rule",
    )
    .sort((a, b) => b.from - a.from);
  let text = markdown;
  for (const range of ranges) {
    const replacement =
      range.type === "bullet"
        ? "• "
        : range.type === "checkbox"
          ? range.checked
            ? "☑ "
            : "☐ "
          : range.type === "rule"
            ? "———"
            : "";
    text = text.slice(0, range.from) + replacement + text.slice(range.to);
  }
  return text;
}

describe("live preview headings", () => {
  it("hides heading markers on inactive lines and styles the line", () => {
    const md = "## Outcomes";
    const result = preview(md);
    expect(hidden(md, result)).toEqual(["## "]);
    expect(result).toContainEqual({
      type: "line",
      from: 0,
      className: "cm-h cm-h2",
    });
  });

  it("keeps markers visible when the cursor is on the line", () => {
    const md = "## Outcomes";
    const result = preview(md, [1]);
    expect(hidden(md, result)).toEqual([]);
    expect(result.some((item) => item.type === "line")).toBe(true);
  });

  it("caps heading classes at level three", () => {
    const result = preview("#### Deep");
    expect(result).toContainEqual({
      type: "line",
      from: 0,
      className: "cm-h cm-h3",
    });
  });
});

describe("live preview inline marks", () => {
  it("renders bold and italic without markers", () => {
    const md = "Cut latency **40%** and *more*";
    const result = preview(md);
    expect(rendered(md, result)).toBe("Cut latency 40% and more");
    expect(
      result.some(
        (item) => item.type === "mark" && item.className === "cm-strong",
      ),
    ).toBe(true);
    expect(
      result.some((item) => item.type === "mark" && item.className === "cm-em"),
    ).toBe(true);
  });

  it("handles nested emphasis", () => {
    const md = "***both***";
    expect(rendered(md, preview(md))).toBe("both");
  });

  it("leaves an unclosed marker untouched", () => {
    const md = "half **open";
    expect(hidden(md, preview(md))).toEqual([]);
  });

  it("renders inline code without backticks", () => {
    const md = "Use `pnpm test` daily";
    expect(rendered(md, preview(md))).toBe("Use pnpm test daily");
  });

  it("renders strikethrough without tildes", () => {
    const md = "~~old~~ new";
    expect(rendered(md, preview(md))).toBe("old new");
  });
});

describe("live preview links", () => {
  it("shows only the link text and keeps a safe href", () => {
    const md = "See [docs](https://example.com/a) now";
    const result = preview(md);
    expect(rendered(md, result)).toBe("See docs now");
    expect(result).toContainEqual({
      type: "mark",
      from: 5,
      to: 9,
      className: "cm-link",
      href: "https://example.com/a",
    });
  });

  it("drops non-http hrefs", () => {
    const md = "[x](javascript:alert(1))";
    const link = preview(md).find(
      (item) => item.type === "mark" && item.className === "cm-link",
    );
    expect(link && "href" in link ? link.href : "missing").toBeUndefined();
  });

  it("renders a link inside a list item", () => {
    const md = "- Shipped [Stripe](https://stripe.com) migration";
    expect(rendered(md, preview(md))).toBe("• Shipped Stripe migration");
  });
});

describe("live preview lists and blocks", () => {
  it("turns bullet markers into bullets off the active line", () => {
    const md = "- one\n- two";
    expect(rendered(md, preview(md))).toBe("• one\n• two");
    expect(rendered(md, preview(md, [2]))).toBe("• one\n- two");
  });

  it("keeps ordered list numbers and styles them", () => {
    const md = "1. first";
    const result = preview(md);
    expect(rendered(md, result)).toBe(md);
    expect(result).toContainEqual({
      type: "mark",
      from: 0,
      to: 2,
      className: "cm-list-number",
    });
  });

  it("renders task items as checkboxes with a toggle position", () => {
    const md = "- [ ] todo\n- [x] done";
    const result = preview(md);
    expect(rendered(md, result)).toBe("☐ todo\n☑ done");
    const boxes = result.filter((item) => item.type === "checkbox");
    expect(boxes.map((box) => md[box.toggleAt])).toEqual([" ", "x"]);
  });

  it("hides quote markers and styles quote lines", () => {
    const md = "> quoted\n> again";
    const result = preview(md);
    expect(rendered(md, result)).toBe("quoted\nagain");
    expect(result.filter((item) => item.type === "line")).toHaveLength(2);
  });

  it("marks list item lines for a hanging indent", () => {
    const result = preview("- one\n- two");
    expect(
      result.filter(
        (item) => item.type === "line" && item.className === "cm-li",
      ),
    ).toHaveLength(2);
  });

  it("draws horizontal rules off the active line", () => {
    const md = "a\n\n---\n\nb";
    expect(preview(md).some((item) => item.type === "rule")).toBe(true);
    expect(preview(md, [3]).some((item) => item.type === "rule")).toBe(false);
  });

  it("styles fenced code lines and never hides inside them", () => {
    const md = "```\n**not bold**\n```";
    const result = preview(md);
    expect(hidden(md, result)).toEqual([]);
    expect(result.filter((item) => item.type === "line")).toHaveLength(3);
  });
});

describe("active lines", () => {
  it("marks every line a multi-line selection touches", () => {
    const doc = Text.of(["one", "two", "three"]);
    expect([...activeLinesFor(doc, [{ from: 1, to: 9 }])]).toEqual([1, 2, 3]);
  });

  it("keeps all lines touched by the selection raw", () => {
    const md = "**a**\n**b**\n**c**";
    expect(rendered(md, preview(md, [1, 2]))).toBe("**a**\n**b**\nc");
  });
});
