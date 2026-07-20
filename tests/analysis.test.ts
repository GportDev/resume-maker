import { describe, expect, it } from "vitest";

import {
  calculateAtsScore,
  getLearningResources,
  type JobAnalysis,
  sanitizeAnalysisExperienceIds,
} from "../app/lib/analysis";

const experienceId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";

const analysis: JobAnalysis = {
  jobTitle: "Senior TypeScript Engineer",
  companyName: "Acme",
  seniority: "Senior",
  requiredSkills: ["TypeScript", "PostgreSQL"],
  preferredSkills: ["React"],
  keywords: ["TypeScript", "PostgreSQL", "React"],
  responsibilities: ["Build reliable applications"],
  matches: [
    {
      requirement: "TypeScript",
      evidence: "Built typed applications.",
      experienceIds: [experienceId],
      strength: "strong",
    },
  ],
  missingSkills: ["PostgreSQL"],
};

describe("ATS analysis", () => {
  it("calculates a deterministic bounded score", () => {
    const first = calculateAtsScore({
      analysis,
      experienceText: "Senior Engineer using TypeScript and React",
      profileFieldsCompleted: 5,
      profileFieldCount: 7,
    });
    const second = calculateAtsScore({
      analysis,
      experienceText: "Senior Engineer using TypeScript and React",
      profileFieldsCompleted: 5,
      profileFieldCount: 7,
    });

    expect(first).toEqual(second);
    expect(first.total).toBeGreaterThan(0);
    expect(first.total).toBeLessThanOrEqual(100);
  });

  it("removes foreign evidence IDs and empty matches", () => {
    const sanitized = sanitizeAnalysisExperienceIds(
      {
        ...analysis,
        matches: [
          ...analysis.matches,
          {
            requirement: "Foreign",
            evidence: "Unsupported",
            experienceIds: [foreignId],
            strength: "strong",
          },
        ],
      },
      new Set([experienceId]),
    );
    expect(sanitized.matches).toHaveLength(1);
    expect(sanitized.matches[0].experienceIds).toEqual([experienceId]);
  });

  it("builds only allowlisted learning links", () => {
    const resources = getLearningResources("PostgreSQL");
    expect(resources).toHaveLength(2);
    expect(
      resources.every((resource) => {
        const host = new URL(resource.url).hostname;
        return ["developer.mozilla.org", "www.freecodecamp.org"].includes(host);
      }),
    ).toBe(true);
  });
});
