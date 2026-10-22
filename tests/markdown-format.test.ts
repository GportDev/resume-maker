import { describe, expect, it } from "vitest";

import {
  applyTextChange,
  countWords,
  type FormatAction,
  formatMarkdown,
} from "../app/lib/markdown-format";

function run(
  text: string,
  start: number,
  end: number,
  action: FormatAction,
  template = "",
) {
  const change = formatMarkdown(text, { start, end }, action, template);
  return { text: applyTextChange(text, change), selection: change.selection };
}

describe("formatMarkdown heading", () => {
  it("adds a heading prefix to the current line", () => {
    const result = run("Intro\nResults", 8, 8, "heading");
    expect(result.text).toBe("Intro\n## Results");
    expect(result.selection).toEqual({ start: 11, end: 11 });
  });

  it("removes an existing heading prefix", () => {
    const result = run("## Results", 5, 5, "heading");
    expect(result.text).toBe("Results");
    expect(result.selection).toEqual({ start: 2, end: 2 });
  });

  it("targets the first line when the text starts with a newline", () => {
    expect(run("\nBody", 0, 0, "heading").text).toBe("## \nBody");
  });
});

describe("formatMarkdown bullet", () => {
  it("bullets every selected line", () => {
    const result = run("one\ntwo\nthree", 0, 7, "bullet");
    expect(result.text).toBe("- one\n- two\nthree");
    expect(result.selection).toEqual({ start: 0, end: 11 });
  });

  it("removes bullets when all selected lines are bulleted", () => {
    expect(run("- one\n- two", 0, 11, "bullet").text).toBe("one\ntwo");
  });

  it("ignores a trailing newline at the end of the selection", () => {
    expect(run("one\ntwo", 0, 4, "bullet").text).toBe("- one\ntwo");
  });
});

describe("formatMarkdown bold", () => {
  it("wraps the selection and keeps the inner text selected", () => {
    const result = run("make bold now", 5, 9, "bold");
    expect(result.text).toBe("make **bold** now");
    expect(result.selection).toEqual({ start: 7, end: 11 });
  });

  it("inserts a selected placeholder when nothing is selected", () => {
    const result = run("", 0, 0, "bold");
    expect(result.text).toBe("**strong text**");
    expect(result.selection).toEqual({ start: 2, end: 13 });
  });
});

describe("formatMarkdown template", () => {
  it("inserts into empty text without a separator", () => {
    const result = run("", 0, 0, "template", "## Context\n");
    expect(result.text).toBe("## Context\n");
    expect(result.selection).toEqual({ start: 11, end: 11 });
  });

  it("separates the block from preceding text with a blank line", () => {
    expect(run("Notes", 5, 5, "template", "## Tools\n").text).toBe(
      "Notes\n\n## Tools\n",
    );
  });

  it("adds one newline after a line break", () => {
    expect(run("Notes\n", 6, 6, "template", "## Tools\n").text).toBe(
      "Notes\n\n## Tools\n",
    );
  });
});

describe("formatMarkdown bounds", () => {
  it("clamps a selection beyond the text length", () => {
    expect(run("abc", 10, 12, "bold").text).toBe("abc**strong text**");
  });
});

describe("formatMarkdown headings by level", () => {
  it("switches an H2 to an H1 in place", () => {
    expect(run("## Title", 4, 4, "heading1").text).toBe("# Title");
  });

  it("adds and removes an H3", () => {
    expect(run("Title", 0, 0, "heading3").text).toBe("### Title");
    expect(run("### Title", 5, 5, "heading3").text).toBe("Title");
  });
});

describe("formatMarkdown list styles", () => {
  it("numbers every selected line", () => {
    expect(run("a\nb", 0, 3, "numbered").text).toBe("1. a\n2. b");
  });

  it("converts bullets to a checklist and back", () => {
    expect(run("- a", 1, 1, "checklist").text).toBe("- [ ] a");
    expect(run("- [ ] a", 1, 1, "checklist").text).toBe("a");
  });

  it("converts a checklist item to a bullet", () => {
    expect(run("- [x] a", 1, 1, "bullet").text).toBe("- a");
  });

  it("keeps the cursor on its text when toggling one line", () => {
    const result = run("abc", 2, 2, "bullet");
    expect(result.selection).toEqual({ start: 4, end: 4 });
  });

  it("toggles quotes", () => {
    expect(run("a\nb", 0, 3, "quote").text).toBe("> a\n> b");
    expect(run("> a", 3, 3, "quote").text).toBe("a");
  });
});

describe("formatMarkdown inline toggles", () => {
  it("unwraps bold when the selection sits inside the markers", () => {
    const result = run("make **bold** now", 7, 11, "bold");
    expect(result.text).toBe("make bold now");
    expect(result.selection).toEqual({ start: 5, end: 9 });
  });

  it("unwraps when the selection includes the markers", () => {
    expect(run("`code`", 0, 6, "code").text).toBe("code");
  });

  it("wraps italic with a placeholder", () => {
    const result = run("", 0, 0, "italic");
    expect(result.text).toBe("*emphasis*");
    expect(result.selection).toEqual({ start: 1, end: 9 });
  });

  it("keeps list and heading markers outside the wrap", () => {
    expect(run("- Raised NPS", 0, 12, "bold").text).toBe("- **Raised NPS**");
    expect(run("## Title", 0, 8, "italic").text).toBe("## *Title*");
  });

  it("does not treat bold markers as italic markers", () => {
    expect(run("**a**", 2, 3, "italic").text).toBe("***a***");
  });
});

describe("formatMarkdown links and blocks", () => {
  it("wraps selected text in a link and selects the URL", () => {
    const result = run("see docs", 4, 8, "link");
    expect(result.text).toBe("see [docs](https://)");
    expect(
      result.text.slice(result.selection.start, result.selection.end),
    ).toBe("https://");
  });

  it("inserts a placeholder link and selects its label", () => {
    const result = run("", 0, 0, "link");
    expect(
      result.text.slice(result.selection.start, result.selection.end),
    ).toBe("link text");
  });

  it("inserts a code block with the cursor inside", () => {
    const result = run("", 0, 0, "codeblock");
    expect(result.text).toBe("```\n\n```\n");
    expect(result.selection.start).toBe(4);
  });

  it("inserts a divider as its own block", () => {
    expect(run("a", 1, 1, "divider").text).toBe("a\n\n---\n\n");
  });
});

describe("countWords", () => {
  it("ignores markup and code blocks", () => {
    expect(
      countWords("## Context\n\n- Led **6** engineers\n```\nx y\n```"),
    ).toBe(4);
  });
});
