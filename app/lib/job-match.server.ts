import { z } from "zod";

import { jobAnalysisSchema } from "./analysis";
import type { ExperienceWithCompany } from "./contributions";
import { getJevClient, type JevClient, logJevError } from "./jev.server";
import {
  applyMatchOverride,
  buildMatchQuestions,
  buildMatchState,
  chunkExperiences,
  evaluateMatchPolicy,
  type JobMatchResult,
  jobMatchResultSchema,
  listMatchRequirements,
  type MatchOverride,
  matchAnswerSchema,
  mergeChunkAnswers,
  QUESTION_VERSION,
} from "./job-match";
import {
  createJobMatch,
  getAnalysis,
  getApplication,
  getJobMatch,
  type JobMatchInput,
  listExperiences,
  updateJobMatchResult,
} from "./repositories.server";

export const storedMatchAnswersSchema = z.object({
  chunks: z.array(
    z.object({
      experienceIds: z.array(z.string()),
      modelVersion: z.string(),
      answers: z.record(z.string(), matchAnswerSchema),
    }),
  ),
});

export type JobMatchDeps = {
  getApplication: (
    userId: string,
    applicationId: string,
  ) => Promise<{ id: string } | undefined>;
  getAnalysis: (
    userId: string,
    analysisId: string,
  ) => Promise<
    { id: string; applicationId: string | null; analysis: unknown } | undefined
  >;
  listExperiences: (userId: string) => Promise<ExperienceWithCompany[]>;
  createJobMatch: (
    userId: string,
    input: JobMatchInput,
  ) => Promise<{ id: string } | undefined>;
  getJobMatch: (
    userId: string,
    matchId: string,
  ) => Promise<
    { id: string; applicationId: string | null; result: unknown } | undefined
  >;
  updateJobMatchResult: (
    userId: string,
    matchId: string,
    result: unknown,
  ) => Promise<{ id: string } | undefined>;
  getJevClient: () => JevClient | null;
  logJevError: (operation: string, error: unknown) => void;
};

const defaultDeps: JobMatchDeps = {
  getApplication,
  getAnalysis,
  listExperiences,
  createJobMatch,
  getJobMatch,
  updateJobMatchResult,
  getJevClient,
  logJevError,
};

export type JobMatchFailure =
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "no-experiences" }
  | { ok: false; reason: "not-configured" }
  | { ok: false; reason: "jev-failed" }
  | { ok: false; reason: "invalid-override" };

export async function runJobMatch(
  userId: string,
  applicationId: string,
  analysisId: string,
  deps: JobMatchDeps = defaultDeps,
): Promise<
  { ok: true; matchId: string; result: JobMatchResult } | JobMatchFailure
> {
  const client = deps.getJevClient();
  if (!client) return { ok: false, reason: "not-configured" };

  const [application, record, experiences] = await Promise.all([
    deps.getApplication(userId, applicationId),
    deps.getAnalysis(userId, analysisId),
    deps.listExperiences(userId),
  ]);
  if (!application || !record || record.applicationId !== application.id) {
    return { ok: false, reason: "not-found" };
  }
  if (!experiences.length) return { ok: false, reason: "no-experiences" };

  const analysis = jobAnalysisSchema.parse(record.analysis);
  const chunks: z.infer<typeof storedMatchAnswersSchema>["chunks"] = [];
  try {
    for (const chunk of chunkExperiences(experiences)) {
      const response = await client.systemOne({
        state: buildMatchState(chunk),
        questions: buildMatchQuestions(analysis, chunk),
      });
      chunks.push({
        experienceIds: chunk.map((experience) => experience.id),
        modelVersion: response.modelVersion,
        answers: response.answers,
      });
    }
  } catch (error) {
    deps.logJevError("job-match", error);
    return { ok: false, reason: "jev-failed" };
  }

  const result = evaluateMatchPolicy(
    listMatchRequirements(analysis),
    mergeChunkAnswers(chunks.map((chunk) => chunk.answers)),
  );
  const saved = await deps.createJobMatch(userId, {
    applicationId: application.id,
    analysisId: record.id,
    modelVersion: [...new Set(chunks.map((chunk) => chunk.modelVersion))].join(
      ", ",
    ),
    questionVersion: QUESTION_VERSION,
    answers: { chunks },
    result,
  });
  if (!saved) return { ok: false, reason: "not-found" };
  return { ok: true, matchId: saved.id, result };
}

export async function setJobMatchOverride(
  userId: string,
  input: {
    applicationId: string;
    matchId: string;
    requirementId: string;
    override: MatchOverride | null;
  },
  deps: JobMatchDeps = defaultDeps,
): Promise<{ ok: true; result: JobMatchResult } | JobMatchFailure> {
  const { applicationId, matchId, requirementId, override } = input;
  const match = await deps.getJobMatch(userId, matchId);
  if (!match || match.applicationId !== applicationId) {
    return { ok: false, reason: "not-found" };
  }
  const current = jobMatchResultSchema.safeParse(match.result);
  if (!current.success) return { ok: false, reason: "not-found" };

  const result = applyMatchOverride(current.data, requirementId, override);
  if (!result) return { ok: false, reason: "invalid-override" };
  const saved = await deps.updateJobMatchResult(userId, matchId, result);
  if (!saved) return { ok: false, reason: "not-found" };
  return { ok: true, result };
}

export type StoredJobMatch = {
  id: string;
  analysisId: string;
  modelVersion: string;
  createdAt: Date;
  result: JobMatchResult;
};

export function parseStoredJobMatch(
  row:
    | {
        id: string;
        analysisId: string;
        modelVersion: string;
        createdAt: Date;
        result: unknown;
      }
    | undefined,
): StoredJobMatch | null {
  if (!row) return null;
  const result = jobMatchResultSchema.safeParse(row.result);
  if (!result.success) {
    console.warn("Stored job match failed validation", { matchId: row.id });
    return null;
  }
  return {
    id: row.id,
    analysisId: row.analysisId,
    modelVersion: row.modelVersion,
    createdAt: row.createdAt,
    result: result.data,
  };
}

export function describeJobMatchFailure(failure: JobMatchFailure): {
  status: number;
  message: string;
} {
  switch (failure.reason) {
    case "not-found":
      return { status: 404, message: "Application or analysis not found." };
    case "no-experiences":
      return {
        status: 400,
        message: "Add at least one work experience before matching.",
      };
    case "not-configured":
      return {
        status: 400,
        message: "Job matching is not configured on this server.",
      };
    case "jev-failed":
      return {
        status: 502,
        message: "Job match failed. Nothing was saved. Try again later.",
      };
    case "invalid-override":
      return {
        status: 400,
        message:
          "Only requirements that need review can be accepted or rejected.",
      };
  }
}
