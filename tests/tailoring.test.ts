import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { JobAnalysis } from "../app/lib/analysis";
import type { CoverLetterContent } from "../app/lib/cover-letter";
import {
  evaluateMatchPolicy,
  listMatchRequirements,
} from "../app/lib/job-match";
import type { ResumeContent } from "../app/lib/resume";

vi.mock("../app/lib/repositories.server", () => {
  const unused = () => {
    throw new Error("Tests must inject repositories.");
  };
  return {
    getApplication: unused,
    saveApplicationJobDescription: unused,
    getProfile: unused,
    listExperiences: unused,
    getAnalysis: unused,
    createAnalysis: unused,
    createApplicationWithAnalysis: unused,
    createTailoredDocuments: unused,
    createJobMatch: unused,
    getJobMatch: unused,
    getLatestAnalysisJobMatch: unused,
    updateJobMatchResult: unused,
    getUserApiCredential: unused,
    getUserSettings: unused,
  };
});

const { NoAiKeyError } = await import("../app/lib/ai-provider.server");
const {
  describeTailoringFailure,
  generateTailoredDocuments,
  runQuickTailoring,
  runTailoringAnalysis,
} = await import("../app/lib/tailoring.server");
type TailoringDeps = import("../app/lib/tailoring.server").TailoringDeps;

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const userId = "user-1";
const user = { id: userId, name: "Ada Lovelace", email: "ada@example.com" };
const experienceId = "11111111-1111-4111-8111-111111111111";
const foreignId = "99999999-9999-4999-8999-999999999999";
const applicationId = "22222222-2222-4222-8222-222222222222";
const analysisId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-01-01T00:00:00Z");
const jobDescription = `Senior Engineer at Globex.${" Build TypeScript services.".repeat(10)}`;

const experience = {
  id: experienceId,
  userId,
  companyId: "44444444-4444-4444-8444-444444444444",
  company: "Acme",
  position: "Engineer",
  startDate: "2024-01-01",
  endDate: null,
  isCurrent: true,
  markdown: "- Built TypeScript services handling 1M requests per day.",
  createdAt: now,
  updatedAt: now,
};

const application = {
  id: applicationId,
  companyName: "Globex",
  position: "Senior Engineer",
  location: "Remote",
  jobDescription,
};

const analysis: JobAnalysis = {
  jobTitle: "Senior Engineer",
  companyName: "Globex",
  seniority: "Senior",
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  keywords: ["TypeScript"],
  responsibilities: ["Build services"],
  matches: [
    {
      requirement: "TypeScript",
      evidence: "Built TypeScript services.",
      experienceIds: [experienceId, foreignId],
      strength: "strong",
    },
  ],
  missingSkills: [],
};

const resume: ResumeContent = {
  targetTitle: "Senior Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
  },
  summary: "Engineer focused on reliable TypeScript services.",
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
          text: "Built TypeScript services handling 1M requests per day.",
          sourceExperienceIds: [experienceId, foreignId],
        },
      ],
    },
  ],
};

const coverLetter: CoverLetterContent = {
  recipient: "Hiring team at Globex",
  opening:
    "I am applying for the Senior Engineer role at Globex, which centres on TypeScript services.",
  bodyParagraphs: [
    {
      text: "At Acme I built TypeScript services handling one million requests per day.",
      sourceExperienceIds: [experienceId, foreignId],
    },
  ],
  closing: "Thank you for considering my application.",
};

function textResult(text: string): GenerateResult {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    },
    warnings: [],
  };
}

type Route = "analysis" | "resume" | "coverLetter";

function routedModel(responses: Partial<Record<Route, string | Error>>) {
  const calls: Route[] = [];
  const prompts: Partial<Record<Route, { system: string; user: string }>> = {};
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const system = options.prompt.find(
        (message) => message.role === "system",
      );
      const text = typeof system?.content === "string" ? system.content : "";
      const route: Route = text.includes("cover letter")
        ? "coverLetter"
        : text.includes("resume")
          ? "resume"
          : "analysis";
      calls.push(route);
      const userMessage = options.prompt.find(
        (message) => message.role === "user",
      );
      prompts[route] = {
        system: text,
        user:
          userMessage?.role === "user"
            ? userMessage.content
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("")
            : "",
      };
      const response = responses[route];
      if (response === undefined) throw new Error(`Unexpected ${route} call`);
      if (response instanceof Error) throw response;
      return textResult(response);
    },
  });
  return { model, calls, prompts };
}

function createDeps(model: MockLanguageModelV4) {
  return {
    getApplication: vi.fn<TailoringDeps["getApplication"]>(
      async () => application,
    ),
    saveApplicationJobDescription: vi.fn<
      TailoringDeps["saveApplicationJobDescription"]
    >(async () => application),
    getProfile: vi.fn<TailoringDeps["getProfile"]>(async () => undefined),
    listExperiences: vi.fn<TailoringDeps["listExperiences"]>(async () => [
      experience,
    ]),
    getAnalysis: vi.fn<TailoringDeps["getAnalysis"]>(async () => ({
      id: analysisId,
      applicationId,
      analysis,
    })),
    createAnalysis: vi.fn<TailoringDeps["createAnalysis"]>(async () => ({
      id: analysisId,
    })),
    createApplicationWithAnalysis: vi.fn<
      TailoringDeps["createApplicationWithAnalysis"]
    >(async () => ({ applicationId, analysisId })),
    createTailoredDocuments: vi.fn<TailoringDeps["createTailoredDocuments"]>(
      async () => ({
        resumeId: "55555555-5555-4555-8555-555555555555",
        coverLetterId: "66666666-6666-4666-8666-666666666666",
      }),
    ),
    resolveLanguageModel: vi.fn<TailoringDeps["resolveLanguageModel"]>(
      async () => ({ model, provider: "anthropic" }),
    ),
    logProviderError: vi.fn<TailoringDeps["logProviderError"]>(),
    runJobMatch: vi.fn<TailoringDeps["runJobMatch"]>(async () => ({
      ok: false,
    })),
    getLatestAnalysisJobMatch: vi.fn<
      TailoringDeps["getLatestAnalysisJobMatch"]
    >(async () => undefined),
  } satisfies TailoringDeps;
}

let deps: ReturnType<typeof createDeps>;

function promptPayload(text: string | undefined) {
  return z
    .object({
      targetJob: z.looseObject({
        matches: z.array(z.unknown()).optional(),
        analysis: z.looseObject({ matches: z.array(z.unknown()) }).optional(),
      }),
      verifiedEvidence: z.array(z.unknown()).optional(),
    })
    .parse(JSON.parse(text ?? "{}"));
}

async function generateWithMatch(probabilities: Record<string, number>) {
  const { model, prompts } = routedModel({
    resume: JSON.stringify(resume),
    coverLetter: JSON.stringify(coverLetter),
  });
  deps = createDeps(model);
  deps.getLatestAnalysisJobMatch.mockResolvedValueOnce({
    result: evaluateMatchPolicy(listMatchRequirements(analysis), {
      req_0: {
        type: "choice",
        choice: experienceId,
        probabilities,
        confidence: 0.9,
      },
    }),
  });
  const result = await generateTailoredDocuments(
    user,
    applicationId,
    analysisId,
    deps,
  );
  return { result, prompts };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTailoringAnalysis", () => {
  it("saves the job description and an owned, scored analysis on the application", async () => {
    const { model } = routedModel({ analysis: JSON.stringify(analysis) });
    deps = createDeps(model);

    const result = await runTailoringAnalysis(
      userId,
      applicationId,
      jobDescription,
      deps,
    );

    expect(result).toEqual({ ok: true, analysisId });
    expect(deps.saveApplicationJobDescription).toHaveBeenCalledWith(
      userId,
      applicationId,
      jobDescription,
    );
    const [, saved] = deps.createAnalysis.mock.calls[0] ?? [];
    expect(saved?.applicationId).toBe(applicationId);
    expect(saved?.jobTitle).toBe("Senior Engineer");
    expect(saved?.analysis).toMatchObject({
      matches: [{ experienceIds: [experienceId] }],
    });
    expect(saved?.score).toMatchObject({ requiredSkillCoverage: 35 });
    expect(deps.runJobMatch).toHaveBeenCalledWith(
      userId,
      applicationId,
      analysisId,
    );
  });

  it("keeps the analysis when the job match throws", async () => {
    const { model } = routedModel({ analysis: JSON.stringify(analysis) });
    deps = createDeps(model);
    deps.runJobMatch.mockRejectedValueOnce(new Error("Database unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runTailoringAnalysis(userId, applicationId, jobDescription, deps),
    ).resolves.toEqual({ ok: true, analysisId });
    expect(error).toHaveBeenCalledWith("Jev request failed", {
      operation: "job-match-after-analysis",
      name: "Error",
    });
    error.mockRestore();
  });

  it("returns not-found for a foreign application without calling the model", async () => {
    const { model, calls } = routedModel({});
    deps = createDeps(model);
    deps.saveApplicationJobDescription.mockResolvedValueOnce(undefined);

    await expect(
      runTailoringAnalysis(userId, applicationId, jobDescription, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(calls).toEqual([]);
    expect(deps.createAnalysis).not.toHaveBeenCalled();
  });

  it("requires at least one experience", async () => {
    const { model, calls } = routedModel({});
    deps = createDeps(model);
    deps.listExperiences.mockResolvedValueOnce([]);

    await expect(
      runTailoringAnalysis(userId, applicationId, jobDescription, deps),
    ).resolves.toEqual({ ok: false, reason: "no-experiences" });
    expect(calls).toEqual([]);
  });

  it("logs provider failures and saves no analysis", async () => {
    const { model } = routedModel({ analysis: new Error("Provider down") });
    deps = createDeps(model);

    await expect(
      runTailoringAnalysis(userId, applicationId, jobDescription, deps),
    ).resolves.toEqual({
      ok: false,
      reason: "ai-failed",
      provider: "anthropic",
    });
    expect(deps.logProviderError).toHaveBeenCalledWith(
      "analyze-job",
      "anthropic",
      expect.any(Error),
    );
    expect(deps.createAnalysis).not.toHaveBeenCalled();
  });

  it("reports a missing API key", async () => {
    const { model } = routedModel({});
    deps = createDeps(model);
    deps.resolveLanguageModel.mockRejectedValueOnce(
      new NoAiKeyError("anthropic"),
    );

    const result = await runTailoringAnalysis(
      userId,
      applicationId,
      jobDescription,
      deps,
    );
    expect(result).toMatchObject({ ok: false, reason: "no-key" });
    expect(deps.logProviderError).not.toHaveBeenCalled();
  });
});

describe("runQuickTailoring", () => {
  it("creates an application from the analysis when none is chosen", async () => {
    const { model } = routedModel({
      analysis: JSON.stringify({ ...analysis, companyName: "" }),
    });
    deps = createDeps(model);

    const result = await runQuickTailoring(userId, { jobDescription }, deps);

    expect(result).toEqual({ ok: true, applicationId, analysisId });
    expect(deps.saveApplicationJobDescription).not.toHaveBeenCalled();
    const [, created, saved] =
      deps.createApplicationWithAnalysis.mock.calls[0] ?? [];
    expect(created).toMatchObject({
      companyName: "Company not specified",
      position: "Senior Engineer",
      status: "saved",
      jobDescription,
    });
    expect(saved?.jobTitle).toBe("Senior Engineer");
    expect(deps.runJobMatch).toHaveBeenCalledWith(
      userId,
      applicationId,
      analysisId,
    );
  });

  it("analyzes into an existing application", async () => {
    const { model } = routedModel({ analysis: JSON.stringify(analysis) });
    deps = createDeps(model);

    await expect(
      runQuickTailoring(userId, { applicationId, jobDescription }, deps),
    ).resolves.toEqual({ ok: true, applicationId, analysisId });
    expect(deps.createApplicationWithAnalysis).not.toHaveBeenCalled();
    expect(deps.createAnalysis).toHaveBeenCalledOnce();
  });
});

describe("generateTailoredDocuments", () => {
  it("persists both sanitized documents together", async () => {
    const { model, calls } = routedModel({
      resume: JSON.stringify(resume),
      coverLetter: JSON.stringify(coverLetter),
    });
    deps = createDeps(model);

    const result = await generateTailoredDocuments(
      user,
      applicationId,
      analysisId,
      deps,
    );

    expect(result).toMatchObject({ ok: true });
    expect(calls.sort()).toEqual(["coverLetter", "resume"]);
    expect(deps.createTailoredDocuments).toHaveBeenCalledOnce();
    const [, input] = deps.createTailoredDocuments.mock.calls[0] ?? [];
    expect(input).toMatchObject({
      applicationId,
      analysisId,
      resume: { title: "Senior Engineer at Globex" },
      coverLetter: { title: "Cover letter: Senior Engineer at Globex" },
    });
    expect(input?.resume.content).toMatchObject({
      experiences: [{ bullets: [{ sourceExperienceIds: [experienceId] }] }],
    });
    expect(input?.coverLetter.content).toMatchObject({
      bodyParagraphs: [{ sourceExperienceIds: [experienceId] }],
    });
  });

  it("feeds only Jev-verified evidence into generation", async () => {
    const { result, prompts } = await generateWithMatch({
      [experienceId]: 0.9,
      none: 0.1,
    });

    expect(result).toMatchObject({ ok: true });
    const resumePrompt = promptPayload(prompts.resume?.user);
    const letterPrompt = promptPayload(prompts.coverLetter?.user);
    for (const payload of [resumePrompt, letterPrompt]) {
      expect(payload.verifiedEvidence).toEqual([
        { requirement: "TypeScript", kind: "required", experienceId },
      ]);
    }
    expect(prompts.resume?.system).toContain("verifiedEvidence lists");
    expect(prompts.coverLetter?.system).toContain("verifiedEvidence lists");
    expect(resumePrompt.targetJob.matches).toEqual([
      expect.objectContaining({ experienceIds: [experienceId] }),
    ]);
    expect(letterPrompt.targetJob.analysis?.matches).toEqual([
      expect.objectContaining({ experienceIds: [experienceId] }),
    ]);
  });

  it("drops analysis matches that Jev did not verify", async () => {
    const { prompts } = await generateWithMatch({
      [experienceId]: 0.1,
      none: 0.9,
    });

    const payload = promptPayload(prompts.resume?.user);
    expect(payload.verifiedEvidence).toEqual([]);
    expect(payload.targetJob.matches).toEqual([]);
  });

  it("generates without the verified rule when no match exists", async () => {
    const { model, prompts } = routedModel({
      resume: JSON.stringify(resume),
      coverLetter: JSON.stringify(coverLetter),
    });
    deps = createDeps(model);

    await generateTailoredDocuments(user, applicationId, analysisId, deps);

    expect(prompts.resume?.system).not.toContain("verifiedEvidence lists");
    expect(promptPayload(prompts.resume?.user)).not.toHaveProperty(
      "verifiedEvidence",
    );
  });

  it("persists nothing when the cover letter fails schema validation", async () => {
    const { model, calls } = routedModel({
      resume: JSON.stringify(resume),
      coverLetter: JSON.stringify({ ...coverLetter, bodyParagraphs: [] }),
    });
    deps = createDeps(model);

    await expect(
      generateTailoredDocuments(user, applicationId, analysisId, deps),
    ).resolves.toEqual({
      ok: false,
      reason: "ai-failed",
      provider: "anthropic",
    });
    expect(calls.filter((call) => call === "coverLetter")).toHaveLength(2);
    expect(deps.createTailoredDocuments).not.toHaveBeenCalled();
  });

  it("persists nothing when the resume generation fails", async () => {
    const { model } = routedModel({
      resume: new Error("Provider down"),
      coverLetter: JSON.stringify(coverLetter),
    });
    deps = createDeps(model);

    const result = await generateTailoredDocuments(
      user,
      applicationId,
      analysisId,
      deps,
    );
    expect(result).toMatchObject({ ok: false, reason: "ai-failed" });
    expect(deps.createTailoredDocuments).not.toHaveBeenCalled();
  });

  it("persists nothing when no cited paragraph references an owned experience", async () => {
    const { model } = routedModel({
      resume: JSON.stringify(resume),
      coverLetter: JSON.stringify({
        ...coverLetter,
        bodyParagraphs: [
          {
            ...coverLetter.bodyParagraphs[0],
            sourceExperienceIds: [foreignId],
          },
        ],
      }),
    });
    deps = createDeps(model);

    const result = await generateTailoredDocuments(
      user,
      applicationId,
      analysisId,
      deps,
    );
    expect(result).toMatchObject({ ok: false, reason: "ai-failed" });
    expect(deps.createTailoredDocuments).not.toHaveBeenCalled();
  });

  it("rejects an analysis linked to another application", async () => {
    const { model, calls } = routedModel({});
    deps = createDeps(model);
    deps.getAnalysis.mockResolvedValueOnce({
      id: analysisId,
      applicationId: "77777777-7777-4777-8777-777777777777",
      analysis,
    });

    await expect(
      generateTailoredDocuments(user, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(calls).toEqual([]);
  });

  it("returns not-found when the transaction rejects ownership", async () => {
    const { model } = routedModel({
      resume: JSON.stringify(resume),
      coverLetter: JSON.stringify(coverLetter),
    });
    deps = createDeps(model);
    deps.createTailoredDocuments.mockResolvedValueOnce(undefined);

    await expect(
      generateTailoredDocuments(user, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("describeTailoringFailure", () => {
  it("returns a generic provider message", () => {
    expect(
      describeTailoringFailure(
        { ok: false, reason: "ai-failed", provider: "anthropic" },
        "generation",
      ),
    ).toEqual({
      status: 502,
      message:
        "Generation failed. Nothing was saved. Check your Anthropic API key and evidence, then try again.",
    });
  });
});
