import { describe, expect, it } from "vitest";

import { normalize, scoreAnalysisAgainstEvidence } from "../app/lib/analysis";
import { matchKeywordsToExperiences } from "../app/lib/keyword-match";

const acme = "11111111-1111-4111-8111-111111111111";
const globex = "22222222-2222-4222-8222-222222222222";

const experiences = [
  {
    id: acme,
    position: "Senior Engineer",
    company: "Acme",
    markdown:
      "- Built TypeScript services on PostgreSQL.\n- Led migration to React.",
  },
  {
    id: globex,
    position: "Developer",
    company: "Globex",
    markdown: "- Maintained Go and C++ tooling for Node.js teams.",
  },
];

const analysis = {
  keywords: ["TypeScript", "typescript", "React", "Go", "Kubernetes", "C++"],
  requiredSkills: ["PostgreSQL", "Leadership", "Node.js"],
  matches: [
    {
      requirement: "Leadership of migrations",
      evidence: "Led migration to React.",
      experienceIds: [acme],
      strength: "strong" as const,
    },
  ],
};

describe("matchKeywordsToExperiences", () => {
  it("maps keywords and required skills to each experience", () => {
    const result = matchKeywordsToExperiences(analysis, experiences);

    expect(result.experiences).toEqual([
      {
        experienceId: acme,
        matchedKeywords: ["TypeScript", "React"],
        matchedRequiredSkills: ["PostgreSQL", "Leadership"],
      },
      {
        experienceId: globex,
        matchedKeywords: ["Go", "C++"],
        matchedRequiredSkills: ["Node.js"],
      },
    ]);
    expect(result.unmatchedKeywords).toEqual(["Kubernetes"]);
  });

  it("matches whole terms only", () => {
    const result = matchKeywordsToExperiences(
      { keywords: ["Go", "Java"], requiredSkills: [], matches: [] },
      [
        {
          id: acme,
          position: "Engineer",
          company: "Good Co",
          markdown: "Wrote JavaScript.",
        },
      ],
    );

    expect(result.experiences[0]?.matchedKeywords).toEqual([]);
    expect(result.unmatchedKeywords).toEqual(["Go", "Java"]);
  });

  it("ignores requirement citations for other experiences", () => {
    const result = matchKeywordsToExperiences(
      {
        keywords: [],
        requiredSkills: ["Leadership"],
        matches: analysis.matches,
      },
      experiences,
    );

    expect(result.experiences[1]?.matchedRequiredSkills).toEqual([]);
  });

  it("returns every keyword as unmatched without experiences", () => {
    expect(matchKeywordsToExperiences(analysis, [])).toEqual({
      experiences: [],
      unmatchedKeywords: ["TypeScript", "React", "Go", "Kubernetes", "C++"],
    });
  });
});

describe("normalize", () => {
  it("keeps technical punctuation", () => {
    expect(normalize("C++, C# & Node.js!")).toBe("c++ c# node.js");
  });
});

describe("scoreAnalysisAgainstEvidence", () => {
  it("counts profile completeness from filled fields", () => {
    const score = scoreAnalysisAgainstEvidence({
      analysis: {
        jobTitle: "Senior Engineer",
        companyName: "",
        seniority: "",
        requiredSkills: [],
        preferredSkills: [],
        keywords: [],
        responsibilities: [],
        matches: [],
        missingSkills: [],
      },
      profile: { fullName: "Ada", email: "ada@example.com", phone: "" },
      experiences,
    });

    expect(score.profileCompleteness).toBe(1);
    expect(score.titleAlignment).toBe(10);
  });
});
