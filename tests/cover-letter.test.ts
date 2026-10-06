import { describe, expect, it } from "vitest";

import {
  applyCoverLetterEdits,
  type CoverLetterContent,
  coverLetterContentSchema,
  coverLetterEditSchema,
  sanitizeCoverLetterEvidence,
} from "../app/lib/cover-letter";

const owned = "11111111-1111-4111-8111-111111111111";
const foreign = "99999999-9999-4999-8999-999999999999";

const content: CoverLetterContent = {
  recipient: "Hiring team at Globex",
  opening:
    "I am applying for the Senior Engineer role at Globex because it matches my platform work.",
  bodyParagraphs: [
    {
      text: "At Acme I built TypeScript services that handled one million requests per day.",
      sourceExperienceIds: [owned],
    },
    {
      text: "I also led a migration to React that shortened release cycles for the team.",
      sourceExperienceIds: [owned, foreign],
    },
  ],
  closing: "Thank you for your time and consideration.",
};

describe("coverLetterContentSchema", () => {
  it("accepts cited paragraphs", () => {
    expect(coverLetterContentSchema.parse(content)).toEqual(content);
  });

  it("rejects paragraphs without citations", () => {
    const result = coverLetterContentSchema.safeParse({
      ...content,
      bodyParagraphs: [{ ...content.bodyParagraphs[0], sourceExperienceIds: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one body paragraph", () => {
    expect(
      coverLetterContentSchema.safeParse({ ...content, bodyParagraphs: [] })
        .success,
    ).toBe(false);
  });
});

describe("sanitizeCoverLetterEvidence", () => {
  it("drops unowned experience ids", () => {
    const sanitized = sanitizeCoverLetterEvidence(content, new Set([owned]));
    expect(sanitized.bodyParagraphs[1]?.sourceExperienceIds).toEqual([owned]);
  });

  it("drops paragraphs citing only unowned experiences", () => {
    const sanitized = sanitizeCoverLetterEvidence(
      {
        ...content,
        bodyParagraphs: [
          content.bodyParagraphs[0],
          {
            text: "Invented paragraph citing an experience the user does not own.",
            sourceExperienceIds: [foreign],
          },
        ],
      },
      new Set([owned]),
    );
    expect(sanitized.bodyParagraphs).toHaveLength(1);
  });

  it("fails when no cited paragraph remains", () => {
    expect(() => sanitizeCoverLetterEvidence(content, new Set())).toThrow();
  });
});

describe("applyCoverLetterEdits", () => {
  it("replaces text and keeps citations", () => {
    const edited = applyCoverLetterEdits(content, {
      recipient: "Dear Globex team",
      opening: content.opening,
      paragraphs: [
        "Rewritten first paragraph that still describes the Acme services work.",
      ],
      closing: "Best regards and thank you.",
    });

    expect(edited.recipient).toBe("Dear Globex team");
    expect(edited.bodyParagraphs[0]).toEqual({
      text: "Rewritten first paragraph that still describes the Acme services work.",
      sourceExperienceIds: [owned],
    });
    expect(edited.bodyParagraphs[1]).toEqual(content.bodyParagraphs[1]);
    expect(edited.closing).toBe("Best regards and thank you.");
  });

  it("rejects edits that break the schema", () => {
    expect(() =>
      applyCoverLetterEdits(content, {
        recipient: "",
        opening: content.opening,
        paragraphs: [],
        closing: content.closing,
      }),
    ).toThrow();
  });
});

describe("coverLetterEditSchema", () => {
  it("returns field messages for short text", () => {
    const result = coverLetterEditSchema.safeParse({
      title: "Cover letter",
      recipient: "Team",
      opening: "Too short",
      paragraphs: ["Short"],
      closing: "Thanks",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Opening must be at least 20 characters.",
      "Each paragraph must be at least 40 characters.",
      "Closing must be at least 10 characters.",
    ]);
  });
});
