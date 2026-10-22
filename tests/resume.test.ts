import { describe, expect, it } from "vitest";

import {
  applyResumeEdits,
  type ResumeContent,
  readBulletFields,
  sanitizeResumeEvidence,
} from "../app/lib/resume";

const experienceId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";

const content: ResumeContent = {
  targetTitle: "Senior Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "London",
    website: "",
    linkedin: "",
  },
  summary: "Engineer focused on reliable software and measurable outcomes.",
  skills: ["TypeScript"],
  experiences: [
    {
      experienceId,
      company: "Acme",
      position: "Engineer",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      bullets: [
        {
          text: "Built reliable TypeScript services for critical workflows.",
          sourceExperienceIds: [experienceId, foreignId],
        },
      ],
    },
  ],
};

describe("resume evidence", () => {
  it("removes source IDs the user does not own", () => {
    const sanitized = sanitizeResumeEvidence(content, new Set([experienceId]));
    expect(sanitized.experiences[0].bullets[0].sourceExperienceIds).toEqual([
      experienceId,
    ]);
  });

  it("applies text edits without changing evidence references", () => {
    const edited = applyResumeEdits(content, {
      title: "Staff Engineer",
      summary:
        "Staff engineer building reliable systems with measurable impact.",
      skills: ["TypeScript", "React"],
      bullets: [
        {
          experienceIndex: 0,
          sourceIndex: 0,
          text: "Improved critical TypeScript workflows with reliable services.",
        },
      ],
    });
    expect(edited.targetTitle).toBe("Staff Engineer");
    expect(edited.experiences[0].bullets[0].sourceExperienceIds).toEqual([
      experienceId,
      foreignId,
    ]);
  });
});

describe("resume bullet order", () => {
  const second = "33333333-3333-4333-8333-333333333333";
  const twoBullets: ResumeContent = {
    ...content,
    experiences: [
      {
        ...content.experiences[0],
        bullets: [
          {
            text: "Built reliable TypeScript services for critical workflows.",
            sourceExperienceIds: [experienceId],
          },
          {
            text: "Mentored three engineers through their first on-call rotations.",
            sourceExperienceIds: [second],
          },
        ],
      },
    ],
  } as ResumeContent;
  const base = {
    title: "Senior Engineer",
    summary: content.summary,
    skills: ["TypeScript"],
  };

  it("reorders bullets and keeps each bullet's citations", () => {
    const edited = applyResumeEdits(twoBullets, {
      ...base,
      bullets: [
        {
          experienceIndex: 0,
          sourceIndex: 1,
          text: "Mentored three engineers through on-call.",
        },
        {
          experienceIndex: 0,
          sourceIndex: 0,
          text: "Built reliable TypeScript services.",
        },
      ],
    });
    expect(
      edited.experiences[0].bullets.map((bullet) => bullet.sourceExperienceIds),
    ).toEqual([[second], [experienceId]]);
  });

  it("removes bullets that were not posted", () => {
    const edited = applyResumeEdits(twoBullets, {
      ...base,
      bullets: [
        {
          experienceIndex: 0,
          sourceIndex: 1,
          text: "Mentored three engineers through on-call.",
        },
      ],
    });
    expect(edited.experiences[0].bullets).toHaveLength(1);
  });

  it("refuses to empty a position", () => {
    expect(() =>
      applyResumeEdits(
        {
          ...twoBullets,
          experiences: [
            ...twoBullets.experiences,
            { ...twoBullets.experiences[0], experienceId: second },
          ],
        } as ResumeContent,
        {
          ...base,
          bullets: [
            {
              experienceIndex: 0,
              sourceIndex: 0,
              text: "Built reliable TypeScript services.",
            },
          ],
        },
      ),
    ).toThrow(/Keep at least one bullet/);
  });

  it("rejects unknown or duplicated sources", () => {
    const text = "Built reliable TypeScript services.";
    expect(() =>
      applyResumeEdits(twoBullets, {
        ...base,
        bullets: [{ experienceIndex: 0, sourceIndex: 5, text }],
      }),
    ).toThrow();
    expect(() =>
      applyResumeEdits(twoBullets, {
        ...base,
        bullets: [
          { experienceIndex: 0, sourceIndex: 0, text },
          { experienceIndex: 0, sourceIndex: 0, text },
        ],
      }),
    ).toThrow();
  });

  it("reads posted refs and texts in order", () => {
    expect(readBulletFields(["0:1", "2:0"], ["first", "second"])).toEqual([
      { experienceIndex: 0, sourceIndex: 1, text: "first" },
      { experienceIndex: 2, sourceIndex: 0, text: "second" },
    ]);
  });
});
