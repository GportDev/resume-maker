import { describe, expect, it } from "vitest";

import {
  applyTextChange,
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
