import { describe, expect, it } from "vitest";

import {
  applyResumeEdits,
  type ResumeContent,
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
        "Improved critical TypeScript workflows with reliable services.",
      ],
    });
    expect(edited.targetTitle).toBe("Staff Engineer");
    expect(edited.experiences[0].bullets[0].sourceExperienceIds).toEqual([
      experienceId,
      foreignId,
    ]);
  });
});
