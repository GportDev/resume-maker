import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobAnalysis } from "../app/lib/analysis";
import type { JevClient } from "../app/lib/jev.server";
import { JevRequestError } from "../app/lib/jev.server";
import {
  evaluateMatchPolicy,
  listMatchRequirements,
  QUESTION_VERSION,
} from "../app/lib/job-match";

vi.mock("../app/lib/repositories.server", () => {
  const unused = () => {
    throw new Error("Tests must inject repositories.");
  };
  return {
    createJobMatch: unused,
    getAnalysis: unused,
    getApplication: unused,
    getJobMatch: unused,
    listExperiences: unused,
    updateJobMatchResult: unused,
  };
});

const {
  describeJobMatchFailure,
  parseStoredJobMatch,
  runJobMatch,
  setJobMatchOverride,
} = await import("../app/lib/job-match.server");
type JobMatchDeps = import("../app/lib/job-match.server").JobMatchDeps;

const userId = "user-1";
const experienceId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const analysisId = "33333333-3333-4333-8333-333333333333";
const matchId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-01-01T00:00:00Z");

const analysis: JobAnalysis = {
  jobTitle: "Senior Engineer",
  companyName: "Globex",
  seniority: "Senior",
  requiredSkills: ["TypeScript", "Terraform"],
  preferredSkills: [],
  keywords: ["TypeScript"],
  responsibilities: ["Build services"],
  matches: [],
  missingSkills: [],
};

const experience = {
  id: experienceId,
  userId,
  companyId: "55555555-5555-4555-8555-555555555555",
  company: "Acme",
  position: "Engineer",
  startDate: "2024-01-01",
  endDate: null,
  isCurrent: true,
  markdown: "- Built TypeScript services.",
  createdAt: now,
  updatedAt: now,
};

function jevClient(): JevClient & { systemOne: ReturnType<typeof vi.fn> } {
  return {
    systemOne: vi.fn<JevClient["systemOne"]>(async () => ({
      modelVersion: "jev-1.13.0",
      answers: {
        req_0: {
          type: "choice",
          choice: experienceId,
          probabilities: { [experienceId]: 0.9, none: 0.1 },
          confidence: 0.9,
        },
        req_1: {
          type: "choice",
          choice: "none",
          probabilities: { [experienceId]: 0.45, none: 0.55 },
          confidence: 0.55,
        },
        seniority: { type: "score", score: 2, confidence: 0.8 },
        domainFit: { type: "boolean", probability: 0.8 },
      },
      usage: { inputTokens: 100, outputTokens: 10 },
    })),
  };
}

function createDeps(client: JevClient | null = jevClient()) {
  return {
    getApplication: vi.fn<JobMatchDeps["getApplication"]>(async () => ({
      id: applicationId,
    })),
    getAnalysis: vi.fn<JobMatchDeps["getAnalysis"]>(async () => ({
      id: analysisId,
      applicationId,
      analysis,
    })),
    listExperiences: vi.fn<JobMatchDeps["listExperiences"]>(async () => [
      experience,
    ]),
    createJobMatch: vi.fn<JobMatchDeps["createJobMatch"]>(async () => ({
      id: matchId,
    })),
    getJobMatch: vi.fn<JobMatchDeps["getJobMatch"]>(),
    updateJobMatchResult: vi.fn<JobMatchDeps["updateJobMatchResult"]>(
      async () => ({ id: matchId }),
    ),
    getJevClient: vi.fn<JobMatchDeps["getJevClient"]>(() => client),
    logJevError: vi.fn<JobMatchDeps["logJevError"]>(),
  } satisfies JobMatchDeps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runJobMatch", () => {
  it("asks Jev, applies the policy, and persists the audit trail", async () => {
    const client = jevClient();
    const deps = createDeps(client);

    const result = await runJobMatch(userId, applicationId, analysisId, deps);

    expect(result).toMatchObject({
      ok: true,
      matchId,
      result: {
        requirements: [
          { id: "req_0", status: "verified", experienceId },
          { id: "req_1", status: "needs_review", experienceId },
        ],
        recommendation: "needs_review",
        matchScore: 65,
      },
    });
    const [request] = client.systemOne.mock.calls[0] ?? [];
    expect(Object.keys(request?.questions ?? {})).toEqual([
      "req_0",
      "req_1",
      "seniority",
      "domainFit",
    ]);
    const [, saved] = deps.createJobMatch.mock.calls[0] ?? [];
    expect(saved).toMatchObject({
      applicationId,
      analysisId,
      modelVersion: "jev-1.13.0",
      questionVersion: QUESTION_VERSION,
      answers: {
        chunks: [{ experienceIds: [experienceId], modelVersion: "jev-1.13.0" }],
      },
    });
  });

  it("reports not-configured without touching data", async () => {
    const deps = createDeps(null);
    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-configured" });
    expect(deps.getApplication).not.toHaveBeenCalled();
  });

  it("returns not-found for foreign or unlinked records", async () => {
    const client = jevClient();
    const deps = createDeps(client);
    deps.getApplication.mockResolvedValueOnce(undefined);
    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });

    deps.getAnalysis.mockResolvedValueOnce({
      id: analysisId,
      applicationId: "66666666-6666-4666-8666-666666666666",
      analysis,
    });
    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(client.systemOne).not.toHaveBeenCalled();
  });

  it("requires experience", async () => {
    const deps = createDeps();
    deps.listExperiences.mockResolvedValueOnce([]);
    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "no-experiences" });
  });

  it("logs safe diagnostics and saves nothing when Jev fails", async () => {
    const client = jevClient();
    client.systemOne.mockRejectedValueOnce(new JevRequestError(529));
    const deps = createDeps(client);

    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "jev-failed" });
    expect(deps.logJevError).toHaveBeenCalledWith(
      "job-match",
      expect.any(JevRequestError),
    );
    expect(deps.createJobMatch).not.toHaveBeenCalled();
  });

  it("returns not-found when the insert transaction rejects ownership", async () => {
    const deps = createDeps();
    deps.createJobMatch.mockResolvedValueOnce(undefined);
    await expect(
      runJobMatch(userId, applicationId, analysisId, deps),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("setJobMatchOverride", () => {
  const stored = evaluateMatchPolicy(listMatchRequirements(analysis), {
    req_0: {
      type: "choice",
      choice: experienceId,
      probabilities: { [experienceId]: 0.9, none: 0.1 },
      confidence: 0.9,
    },
    req_1: {
      type: "choice",
      choice: experienceId,
      probabilities: { [experienceId]: 0.6, none: 0.4 },
      confidence: 0.6,
    },
    seniority: { type: "score", score: 2, confidence: 0.8 },
  });

  it("stores an accepted review and the recomputed score", async () => {
    const deps = createDeps();
    deps.getJobMatch.mockResolvedValueOnce({
      id: matchId,
      applicationId,
      result: stored,
    });

    const result = await setJobMatchOverride(
      userId,
      { applicationId, matchId, requirementId: "req_1", override: "accept" },
      deps,
    );

    expect(result).toMatchObject({
      ok: true,
      result: { overrides: { req_1: "accept" }, matchScore: 100 },
    });
    expect(deps.updateJobMatchResult).toHaveBeenCalledWith(
      userId,
      matchId,
      expect.objectContaining({ recommendation: "strong_match" }),
    );
  });

  it("rejects overrides on verified requirements", async () => {
    const deps = createDeps();
    deps.getJobMatch.mockResolvedValueOnce({
      id: matchId,
      applicationId,
      result: stored,
    });
    const result = await setJobMatchOverride(
      userId,
      { applicationId, matchId, requirementId: "req_0", override: "reject" },
      deps,
    );
    expect(result).toEqual({ ok: false, reason: "invalid-override" });
    expect(deps.updateJobMatchResult).not.toHaveBeenCalled();
  });

  it("returns not-found for foreign, mismatched, or invalid stored matches", async () => {
    const deps = createDeps();
    const input = {
      applicationId,
      matchId,
      requirementId: "req_1",
      override: "accept" as const,
    };

    deps.getJobMatch.mockResolvedValueOnce(undefined);
    await expect(setJobMatchOverride(userId, input, deps)).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });

    deps.getJobMatch.mockResolvedValueOnce({
      id: matchId,
      applicationId: "66666666-6666-4666-8666-666666666666",
      result: stored,
    });
    await expect(setJobMatchOverride(userId, input, deps)).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });

    deps.getJobMatch.mockResolvedValueOnce({
      id: matchId,
      applicationId,
      result: { matchScore: "high" },
    });
    await expect(setJobMatchOverride(userId, input, deps)).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(deps.updateJobMatchResult).not.toHaveBeenCalled();
  });
});

describe("parseStoredJobMatch", () => {
  it("validates stored JSON and drops invalid rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = {
      id: matchId,
      analysisId,
      modelVersion: "jev-1.13.0",
      createdAt: now,
    };
    expect(parseStoredJobMatch({ ...row, result: { bad: true } })).toBeNull();
    expect(warn).toHaveBeenCalledWith("Stored job match failed validation", {
      matchId,
    });
    expect(
      parseStoredJobMatch({
        ...row,
        result: evaluateMatchPolicy(listMatchRequirements(analysis), {}),
      }),
    ).toMatchObject({
      id: matchId,
      result: { recommendation: "needs_review" },
    });
    expect(parseStoredJobMatch(undefined)).toBeNull();
    warn.mockRestore();
  });
});

describe("describeJobMatchFailure", () => {
  it("returns generic messages", () => {
    expect(
      describeJobMatchFailure({ ok: false, reason: "jev-failed" }),
    ).toEqual({
      status: 502,
      message: "Job match failed. Nothing was saved. Try again later.",
    });
    expect(
      describeJobMatchFailure({ ok: false, reason: "not-configured" }).status,
    ).toBe(400);
  });
});
