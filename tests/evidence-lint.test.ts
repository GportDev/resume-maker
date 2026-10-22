import { describe, expect, it } from "vitest";

import { exhibitNumbers } from "../app/lib/contributions";
import { lintEvidence } from "../app/lib/evidence-lint";

const strong = `## Context

Payments platform serving 4,000 merchants across 12 EU markets with a team of 6 engineers and two product managers.

## Contributions

- Led the migration of card processing to Stripe, moving €1.2B annual volume.
- Designed an idempotent ledger reconciling 2M transactions per day.
- Mentored 4 engineers; 2 promoted to senior within a year of joining the team.

## Tools

TypeScript, PostgreSQL, Kafka`;

const ids = (markdown: string) => lintEvidence(markdown).map((hint) => hint.id);

describe("lintEvidence", () => {
  it("returns nothing for strong, measurable evidence", () => {
    expect(lintEvidence(strong)).toEqual([]);
  });

  it("returns nothing for an empty file", () => {
    expect(lintEvidence("   ")).toEqual([]);
  });

  it("flags short files with the word count", () => {
    const [hint] = lintEvidence("- Built 3 services\n\n## Tools\nGo");
    expect(hint?.id).toBe("short");
    expect(hint?.message).toMatch(/^\d+ words so far/);
  });

  it("flags files without bullets", () => {
    expect(ids("Wrote things.")).toContain("no-bullets");
  });

  it("flags when most bullets have no number", () => {
    const hints = lintEvidence("- Built the API\n- Wrote docs\n- Cut cost 10%");
    expect(hints.find((hint) => hint.id === "no-numbers")?.message).toBe(
      "2 of 3 bullets have no number. Add a metric, count, or scale where you can.",
    );
  });

  it("accepts a Tools label instead of a heading", () => {
    expect(ids(`${strong.replace("## Tools", "**Tools:**")}`)).not.toContain(
      "no-tools",
    );
  });

  it("flags a missing tools section", () => {
    expect(ids(strong.replace(/## Tools[\s\S]*$/, ""))).toContain("no-tools");
  });

  it("names the vague phrase it found", () => {
    const hint = lintEvidence(`${strong}\n- Responsible for on-call 24/7`).find(
      (item) => item.id === "vague",
    );
    expect(hint?.message).toContain("“responsible for”");
  });

  it("is deterministic", () => {
    expect(lintEvidence(strong)).toEqual(lintEvidence(strong));
  });
});

describe("exhibitNumbers", () => {
  it("numbers positions chronologically from 1", () => {
    const numbers = exhibitNumbers([
      { id: "c", startDate: "2022-03-01" },
      { id: "a", startDate: "2014-06-01" },
      { id: "b", startDate: "2017-06-01" },
    ]);
    expect([...numbers.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("breaks start-date ties by ID", () => {
    const numbers = exhibitNumbers([
      { id: "z", startDate: "2020-01-01" },
      { id: "m", startDate: "2020-01-01" },
    ]);
    expect(numbers.get("m")).toBe(1);
    expect(numbers.get("z")).toBe(2);
  });
});
