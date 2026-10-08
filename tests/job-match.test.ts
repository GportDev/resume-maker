import { describe, expect, it } from "vitest";

import type { JobAnalysis } from "../app/lib/analysis";
import {
  applyMatchOverride,
  buildMatchQuestions,
  buildMatchState,
  chunkExperiences,
  estimateTokens,
  evaluateMatchPolicy,
  jobMatchResultSchema,
  jobMatchSummarySchema,
  listMatchRequirements,
  type MatchAnswer,
  type MatchExperience,
  matchOverrideInputSchema,
  maxChoiceOptions,
  mergeChunkAnswers,
  noneOption,
  QUESTION_VERSION,
  reconcileAnalysisMatches,
  scoreMatch,
} from "../app/lib/job-match";

const e1 = "11111111-1111-4111-8111-111111111111";
const e2 = "22222222-2222-4222-8222-222222222222";

function experience(
  id: string,
  overrides: Partial<MatchExperience> = {},
): MatchExperience {
  return {
    id,
    position: "Engineer",
    company: "Acme",
    startDate: "2022-01-01",
    endDate: null,
    isCurrent: true,
    markdown:
      "## Impact\n\n- Built **TypeScript** services with [Node](https://nodejs.org).",
    ...overrides,
  };
}

const experiences = [
  experience(e1),
  experience(e2, {
    position: "Developer",
    company: "Initech",
    isCurrent: false,
    endDate: "2021-12-31",
    markdown: "- Ran PostgreSQL migrations.",
  }),
];

const analysis: JobAnalysis = {
  jobTitle: "Senior Engineer",
  companyName: "Globex",
  seniority: "Senior",
  requiredSkills: ["TypeScript", "PostgreSQL"],
  preferredSkills: ["Kubernetes"],
  keywords: ["TypeScript"],
  responsibilities: ["Build services"],
  matches: [
    {
      requirement: "TypeScript services",
      evidence: "Built TypeScript services.",
      experienceIds: [e1, e2],
      strength: "strong",
    },
    {
      requirement: "Kubernetes",
      evidence: "Deployed containers.",
      experienceIds: [e2],
      strength: "partial",
    },
  ],
  missingSkills: [],
};

function choice(
  probabilities: Record<string, number>,
  confidence: number | null = null,
): MatchAnswer {
  const [winner] = Object.entries(probabilities).sort(
    ([, left], [, right]) => right - left,
  );
  return {
    type: "choice",
    choice: winner?.[0] ?? noneOption,
    probabilities,
    confidence: confidence ?? winner?.[1] ?? null,
  };
}

const requirements = listMatchRequirements(analysis);

describe("buildMatchQuestions", () => {
  it("emits stable requirement IDs plus seniority and domain fit", () => {
    const questions = buildMatchQuestions(analysis, experiences);

    expect(Object.keys(questions)).toEqual([
      "req_0",
      "req_1",
      "pref_0",
      "seniority",
      "domainFit",
    ]);
    expect(questions.seniority).toMatchObject({ type: "score" });
    expect(
      questions.seniority?.type === "score" && questions.seniority.criteria,
    ).toHaveLength(4);
    expect(questions.domainFit).toMatchObject({ type: "boolean" });
  });

  it("offers each experience by ID plus a none option", () => {
    const question = buildMatchQuestions(analysis, experiences).req_0;
    if (question?.type !== "choice") throw new Error("Expected choice");

    expect(Object.keys(question.criteria)).toEqual([e1, e2, noneOption]);
    expect(question.criteria[e1]).toBe(
      "Engineer at Acme: Impact Built TypeScript services with Node.",
    );
    expect(question.criteria[noneOption]).toMatch(/No listed experience/);
    expect(question.instructions).toContain('"TypeScript"');
  });

  it("guards the 255-option choice limit", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        experience(
          `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        ),
      );
    const question = buildMatchQuestions(
      analysis,
      many(maxChoiceOptions - 1),
    ).req_0;
    expect(
      question?.type === "choice" && Object.keys(question.criteria),
    ).toHaveLength(maxChoiceOptions);
    expect(() => buildMatchQuestions(analysis, many(maxChoiceOptions))).toThrow(
      RangeError,
    );
  });

  it("requires at least one experience", () => {
    expect(() => buildMatchQuestions(analysis, [])).toThrow(RangeError);
  });
});

describe("buildMatchState and chunkExperiences", () => {
  it("includes experience IDs, period, and markdown evidence", () => {
    expect(buildMatchState(experiences).experiences[1]).toEqual({
      id: e2,
      position: "Developer",
      company: "Initech",
      period: "2022-01-01 to 2021-12-31",
      evidence: "- Ran PostgreSQL migrations.",
    });
    expect(buildMatchState(experiences).experiences[0]?.period).toBe(
      "2022-01-01 to present",
    );
  });

  it("keeps everything in one chunk under the budget", () => {
    expect(chunkExperiences(experiences)).toEqual([experiences]);
  });

  it("splits by token budget and preserves order", () => {
    const big = Array.from({ length: 5 }, (_, index) =>
      experience(`00000000-0000-4000-8000-00000000000${index}`, {
        markdown: "x".repeat(4_000),
      }),
    );
    const chunks = chunkExperiences(big, { tokenBudget: 2_500 });

    expect(chunks.map((chunk) => chunk.length)).toEqual([2, 2, 1]);
    expect(chunks.flat()).toEqual(big);
    for (const chunk of chunks) {
      expect(
        estimateTokens(JSON.stringify(buildMatchState(chunk))),
      ).toBeLessThanOrEqual(2_500);
    }
  });

  it("splits by option count", () => {
    expect(
      chunkExperiences(experiences, { maxPerChunk: 1 }).map(
        (chunk) => chunk.length,
      ),
    ).toEqual([1, 1]);
  });
});

describe("mergeChunkAnswers", () => {
  it("keeps the highest-probability position and the lowest none probability", () => {
    const merged = mergeChunkAnswers([
      {
        req_0: choice({ [e1]: 0.1, none: 0.9 }, 0.9),
        seniority: { type: "score", score: 1.2, confidence: 0.7 },
        domainFit: { type: "boolean", probability: 0.4 },
      },
      {
        req_0: choice({ [e2]: 0.8, none: 0.2 }, 0.8),
        seniority: { type: "score", score: 2.4, confidence: 0.8 },
        domainFit: { type: "boolean", probability: 0.9 },
      },
    ]);

    expect(merged.req_0).toEqual({
      type: "choice",
      choice: e2,
      probabilities: { [e1]: 0.1, [e2]: 0.8, none: 0.2 },
      confidence: 0.8,
    });
    expect(merged.seniority).toMatchObject({ score: 2.4 });
    expect(merged.domainFit).toEqual({ type: "boolean", probability: 0.9 });
  });

  it("chooses none only when every chunk says none", () => {
    const merged = mergeChunkAnswers([
      { req_0: choice({ [e1]: 0.1, none: 0.9 }, 0.9) },
      { req_0: choice({ [e2]: 0.15, none: 0.85 }, 0.85) },
    ]);
    expect(merged.req_0).toMatchObject({
      choice: noneOption,
      probabilities: { none: 0.85 },
      confidence: 0.85,
    });
  });

  it("returns a single chunk unchanged", () => {
    const only = { req_0: choice({ [e1]: 0.9, none: 0.1 }) };
    expect(mergeChunkAnswers([only])).toBe(only);
    expect(mergeChunkAnswers([])).toEqual({});
  });
});

describe("evaluateMatchPolicy thresholds", () => {
  const decide = (answer: MatchAnswer | undefined) =>
    evaluateMatchPolicy(
      requirements.slice(0, 1),
      answer ? { req_0: answer } : {},
    ).requirements[0];

  it("verifies at p 0.7 and confidence 0.6", () => {
    expect(decide(choice({ [e1]: 0.7, none: 0.3 }, 0.6))).toMatchObject({
      status: "verified",
      experienceId: e1,
      probability: 0.7,
      confidence: 0.6,
    });
  });

  it("needs review just below either threshold", () => {
    expect(decide(choice({ [e1]: 0.69, none: 0.31 }, 0.9))?.status).toBe(
      "needs_review",
    );
    expect(decide(choice({ [e1]: 0.9, none: 0.1 }, 0.59))?.status).toBe(
      "needs_review",
    );
  });

  it("is missing when none reaches 0.7, else needs review with the best candidate", () => {
    expect(decide(choice({ [e1]: 0.3, none: 0.7 }))).toMatchObject({
      status: "missing",
      noneProbability: 0.7,
    });
    expect(decide(choice({ [e1]: 0.31, none: 0.69 }))).toMatchObject({
      status: "needs_review",
      experienceId: e1,
      probability: 0.31,
    });
  });

  it("needs review when confidence or the answer is missing", () => {
    const noConfidence: MatchAnswer = {
      type: "choice",
      choice: e1,
      probabilities: { [e1]: 0.95, none: 0.05 },
      confidence: null,
    };
    expect(decide(noConfidence)?.status).toBe("needs_review");
    expect(decide(undefined)).toMatchObject({
      status: "needs_review",
      experienceId: null,
    });
    expect(decide({ type: "boolean", probability: 0.9 })?.status).toBe(
      "needs_review",
    );
  });
});

describe("scoreMatch and recommendation", () => {
  const answers = {
    req_0: choice({ [e1]: 0.9, none: 0.1 }, 0.9),
    req_1: choice({ [e2]: 0.85, none: 0.15 }, 0.85),
    pref_0: choice({ [e1]: 0.05, none: 0.95 }, 0.95),
    seniority: { type: "score" as const, score: 2, confidence: 0.8 },
    domainFit: { type: "boolean" as const, probability: 0.75 },
  };

  it("weights required 70, preferred 15, seniority 15", () => {
    const result = evaluateMatchPolicy(requirements, answers);

    expect(result.points).toEqual({
      required: 70,
      preferred: 0,
      seniority: 15,
    });
    expect(result.matchScore).toBe(85);
    expect(result.recommendation).toBe("strong_match");
    expect(result.questionVersion).toBe(QUESTION_VERSION);
    expect(result.domainFit).toEqual({ probability: 0.75, fit: "yes" });
    expect(result.seniority.needsReview).toBe(false);
  });

  it("flags unresolved required items as needs review", () => {
    const result = evaluateMatchPolicy(requirements, {
      ...answers,
      req_1: choice({ [e2]: 0.55, none: 0.45 }, 0.55),
    });
    expect(result.matchScore).toBe(50);
    expect(result.recommendation).toBe("needs_review");
  });

  it("classifies worth tailoring and weak matches", () => {
    const half = evaluateMatchPolicy(requirements, {
      ...answers,
      req_1: choice({ [e2]: 0.1, none: 0.9 }, 0.9),
      seniority: { type: "score", score: 3, confidence: 0.9 },
    });
    expect(half.matchScore).toBe(50);
    expect(half.recommendation).toBe("worth_tailoring");

    const weak = evaluateMatchPolicy(requirements, {
      ...answers,
      req_0: choice({ [e1]: 0.1, none: 0.9 }, 0.9),
      req_1: choice({ [e2]: 0.1, none: 0.9 }, 0.9),
      seniority: { type: "score", score: 1, confidence: 0.9 },
    });
    expect(weak.matchScore).toBe(8);
    expect(weak.recommendation).toBe("weak_match");
  });

  it("gives full coverage points when the analysis lists no skills", () => {
    expect(
      scoreMatch({
        requirements: [],
        seniority: { score: null, confidence: null, needsReview: true },
        domainFit: { probability: null, fit: "unclear" },
      }),
    ).toEqual({
      points: { required: 70, preferred: 15, seniority: 0 },
      matchScore: 85,
      recommendation: "strong_match",
    });
  });

  it("produces a result that round-trips through the stored schema", () => {
    const result = evaluateMatchPolicy(requirements, answers);
    expect(jobMatchResultSchema.parse(result)).toEqual(result);
    expect(jobMatchSummarySchema.parse(result)).toEqual({
      matchScore: 85,
      recommendation: "strong_match",
    });
  });
});

describe("applyMatchOverride", () => {
  const result = evaluateMatchPolicy(requirements, {
    req_0: choice({ [e1]: 0.9, none: 0.1 }, 0.9),
    req_1: choice({ [e2]: 0.55, none: 0.45 }, 0.55),
    pref_0: choice({ none: 0.5, [e1]: 0.5 }, null),
    seniority: { type: "score", score: 2, confidence: 0.9 },
  });

  it("accepts a needs-review item and recomputes the score", () => {
    expect(result.recommendation).toBe("needs_review");
    const accepted = applyMatchOverride(result, "req_1", "accept");

    expect(accepted?.overrides).toEqual({ req_1: "accept" });
    expect(accepted?.points.required).toBe(70);
    expect(accepted?.recommendation).toBe("strong_match");
    expect(accepted?.requirements).toEqual(result.requirements);
  });

  it("rejects and clears overrides", () => {
    const rejected = applyMatchOverride(result, "req_1", "reject");
    expect(rejected?.points.required).toBe(35);
    expect(rejected?.recommendation).toBe("worth_tailoring");

    const cleared = rejected && applyMatchOverride(rejected, "req_1", null);
    expect(cleared?.overrides).toEqual({});
    expect(cleared?.recommendation).toBe("needs_review");
  });

  it("refuses overrides on decided or unknown requirements", () => {
    expect(applyMatchOverride(result, "req_0", "reject")).toBeNull();
    expect(applyMatchOverride(result, "req_9", "accept")).toBeNull();
  });

  it("refuses to accept without a candidate position", () => {
    const noCandidate = evaluateMatchPolicy(requirements.slice(0, 1), {});
    expect(applyMatchOverride(noCandidate, "req_0", "accept")).toBeNull();
    expect(applyMatchOverride(noCandidate, "req_0", "reject")).not.toBeNull();
  });
});

describe("reconcileAnalysisMatches", () => {
  it("keeps only verified pairs and flags the rest unverified", () => {
    const result = evaluateMatchPolicy(requirements, {
      req_0: choice({ [e1]: 0.9, [e2]: 0.05, none: 0.05 }, 0.9),
      req_1: choice({ [e2]: 0.9, none: 0.1 }, 0.9),
      pref_0: choice({ [e2]: 0.1, none: 0.9 }, 0.9),
    });

    const reconciled = reconcileAnalysisMatches(analysis.matches, result);

    expect(reconciled.verification).toEqual(["verified", "unverified"]);
    expect(reconciled.matches).toEqual([
      { ...analysis.matches[0], experienceIds: [e1] },
    ]);
    expect(reconciled.verifiedEvidence).toEqual([
      { requirement: "TypeScript", kind: "required", experienceId: e1 },
      { requirement: "PostgreSQL", kind: "required", experienceId: e2 },
    ]);
  });

  it("treats accepted reviews as verified", () => {
    const result = evaluateMatchPolicy(requirements, {
      pref_0: choice({ [e2]: 0.6, none: 0.4 }, 0.6),
    });
    const accepted = applyMatchOverride(result, "pref_0", "accept");
    if (!accepted) throw new Error("Expected override");

    expect(
      reconcileAnalysisMatches(analysis.matches, accepted).verification,
    ).toEqual(["unverified", "verified"]);
  });

  it("does not relate partial words", () => {
    const result = evaluateMatchPolicy(
      [{ id: "req_0", kind: "required", text: "Go" }],
      { req_0: choice({ [e1]: 0.9, none: 0.1 }, 0.9) },
    );
    expect(
      reconcileAnalysisMatches(
        [
          {
            requirement: "Google Cloud",
            evidence: "Deployed to Google Cloud.",
            experienceIds: [e1],
            strength: "strong",
          },
        ],
        result,
      ).verification,
    ).toEqual(["unverified"]);
  });
});

describe("matchOverrideInputSchema", () => {
  it("accepts known decisions and requirement IDs only", () => {
    const matchId = "33333333-3333-4333-8333-333333333333";
    expect(
      matchOverrideInputSchema.safeParse({
        matchId,
        requirementId: "pref_2",
        decision: "clear",
      }).success,
    ).toBe(true);
    expect(
      matchOverrideInputSchema.safeParse({
        matchId,
        requirementId: "seniority",
        decision: "accept",
      }).success,
    ).toBe(false);
    expect(
      matchOverrideInputSchema.safeParse({
        matchId: "not-a-uuid",
        requirementId: "req_0",
        decision: "accept",
      }).success,
    ).toBe(false);
  });
});
