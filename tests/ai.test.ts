import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import {
  analyzeJob,
  generateResume,
  StructuredOutputError,
} from "../app/lib/ai.server";
import type { JobAnalysis } from "../app/lib/analysis";
import type { ResumeContent } from "../app/lib/resume";

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const experienceId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-01-01T00:00:00Z");

const experience = {
  id: experienceId,
  userId: "user-1",
  company: "Acme",
  position: "Engineer",
  startDate: "2024-01-01",
  endDate: null,
  isCurrent: true,
  markdown: "- Built TypeScript services handling 1M requests per day.",
  createdAt: now,
  updatedAt: now,
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
      experienceIds: [experienceId],
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
          sourceExperienceIds: [experienceId],
        },
      ],
    },
  ],
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

function mockModel(responses: Array<string | Error>) {
  let call = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const response = responses[Math.min(call, responses.length - 1)];
      call++;
      if (response instanceof Error) throw response;
      return textResult(response);
    },
  });
  return { model, calls: () => call };
}

const invalidAnalysis = JSON.stringify({ ...analysis, jobTitle: "" });

describe("analyzeJob", () => {
  const input = {
    jobDescription: "Senior Engineer role requiring TypeScript.",
    profile: undefined,
    experiences: [experience],
  };

  it("returns validated structured output", async () => {
    const { model, calls } = mockModel([JSON.stringify(analysis)]);

    await expect(analyzeJob({ ...input, model })).resolves.toEqual(analysis);
    expect(calls()).toBe(1);
  });

  it("retries once when output fails schema validation", async () => {
    const { model, calls } = mockModel([
      invalidAnalysis,
      JSON.stringify(analysis),
    ]);

    await expect(analyzeJob({ ...input, model })).resolves.toEqual(analysis);
    expect(calls()).toBe(2);
  });

  it("throws without partial data after a second schema failure", async () => {
    const { model, calls } = mockModel([invalidAnalysis, "not json"]);

    await expect(analyzeJob({ ...input, model })).rejects.toBeInstanceOf(
      StructuredOutputError,
    );
    expect(calls()).toBe(2);
  });

  it("does not retry provider failures as schema failures", async () => {
    const { model, calls } = mockModel([new Error("Provider unavailable")]);

    await expect(analyzeJob({ ...input, model })).rejects.toThrow(
      "Provider unavailable",
    );
    expect(calls()).toBe(1);
  });

  it("sends only supplied evidence to the model", async () => {
    const { model } = mockModel([JSON.stringify(analysis)]);

    await analyzeJob({ ...input, model });
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain(experienceId);
    expect(prompt).toContain("Built TypeScript services");
  });
});

describe("generateResume", () => {
  const input = {
    account: { name: "Ada Lovelace", email: "ada@example.com" },
    profile: undefined,
    experiences: [experience],
    analysis,
  };

  it("returns a validated resume", async () => {
    const { model } = mockModel([JSON.stringify(resume)]);

    await expect(generateResume({ ...input, model })).resolves.toEqual(resume);
  });

  it("rejects resumes with uncited bullets after one retry", async () => {
    const uncited = JSON.stringify({
      ...resume,
      experiences: [
        {
          ...resume.experiences[0],
          bullets: [{ text: "Invented claim with no source.", sources: [] }],
        },
      ],
    });
    const { model, calls } = mockModel([uncited]);

    await expect(generateResume({ ...input, model })).rejects.toBeInstanceOf(
      StructuredOutputError,
    );
    expect(calls()).toBe(2);
  });
});
