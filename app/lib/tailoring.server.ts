import type { LanguageModel } from "ai";

import type { profiles } from "../db/schema";
import { analyzeJob, generateCoverLetter, generateResume } from "./ai.server";
import {
  logProviderError,
  NoAiKeyError,
  resolveLanguageModel,
} from "./ai-provider.server";
import { type AiProvider, aiProviderDetails } from "./ai-providers";
import {
  type JobAnalysis,
  jobAnalysisSchema,
  type ScoreBreakdown,
  sanitizeAnalysisExperienceIds,
  scoreAnalysisAgainstEvidence,
} from "./analysis";
import { type ApplicationInput, applicationInputSchema } from "./applications";
import type { ExperienceWithCompany } from "./contributions";
import { sanitizeCoverLetterEvidence } from "./cover-letter";
import {
  type AnalysisInput,
  createAnalysis,
  createApplicationWithAnalysis,
  createTailoredDocuments,
  getAnalysis,
  getApplication,
  getProfile,
  listExperiences,
  saveApplicationJobDescription,
  type TailoredDocumentsInput,
} from "./repositories.server";
import { sanitizeResumeEvidence } from "./resume";

type Profile = typeof profiles.$inferSelect;

export type TailoringApplication = {
  id: string;
  companyName: string;
  position: string;
  location: string;
  jobDescription: string;
};

export type TailoringDeps = {
  getApplication: (
    userId: string,
    applicationId: string,
  ) => Promise<TailoringApplication | undefined>;
  saveApplicationJobDescription: (
    userId: string,
    applicationId: string,
    jobDescription: string,
  ) => Promise<TailoringApplication | undefined>;
  getProfile: (userId: string) => Promise<Profile | undefined>;
  listExperiences: (userId: string) => Promise<ExperienceWithCompany[]>;
  getAnalysis: (
    userId: string,
    analysisId: string,
  ) => Promise<
    { id: string; applicationId: string | null; analysis: unknown } | undefined
  >;
  createAnalysis: (
    userId: string,
    input: AnalysisInput & { applicationId: string },
  ) => Promise<{ id: string } | undefined>;
  createApplicationWithAnalysis: (
    userId: string,
    application: ApplicationInput,
    analysis: AnalysisInput,
  ) => Promise<{ applicationId: string; analysisId: string }>;
  createTailoredDocuments: (
    userId: string,
    input: TailoredDocumentsInput,
  ) => Promise<{ resumeId: string; coverLetterId: string } | undefined>;
  resolveLanguageModel: (
    userId: string,
  ) => Promise<{ model: LanguageModel; provider: AiProvider }>;
  logProviderError: (
    operation: string,
    provider: AiProvider | undefined,
    error: unknown,
  ) => void;
};

const defaultDeps: TailoringDeps = {
  getApplication,
  saveApplicationJobDescription,
  getProfile,
  listExperiences,
  getAnalysis,
  createAnalysis,
  createApplicationWithAnalysis,
  createTailoredDocuments,
  resolveLanguageModel,
  logProviderError,
};

export type TailoringFailure =
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "no-experiences" }
  | { ok: false; reason: "no-key"; message: string }
  | { ok: false; reason: "ai-failed"; provider?: AiProvider };

type Result<Success> = ({ ok: true } & Success) | TailoringFailure;

const notFound = { ok: false, reason: "not-found" } as const;
const noExperiences = { ok: false, reason: "no-experiences" } as const;

async function withModel<Value>(
  userId: string,
  operation: string,
  deps: TailoringDeps,
  run: (model: LanguageModel) => Promise<Value>,
): Promise<{ ok: true; value: Value } | TailoringFailure> {
  let provider: AiProvider | undefined;
  try {
    const resolved = await deps.resolveLanguageModel(userId);
    provider = resolved.provider;
    return { ok: true, value: await run(resolved.model) };
  } catch (error) {
    if (error instanceof NoAiKeyError) {
      return { ok: false, reason: "no-key", message: error.message };
    }
    deps.logProviderError(operation, provider, error);
    return { ok: false, reason: "ai-failed", provider };
  }
}

async function analyzeAndScore(
  userId: string,
  jobDescription: string,
  experiences: ExperienceWithCompany[],
  deps: TailoringDeps,
): Promise<
  | { ok: true; value: { analysis: JobAnalysis; score: ScoreBreakdown } }
  | TailoringFailure
> {
  const profile = await deps.getProfile(userId);
  return withModel(userId, "analyze-job", deps, async (model) => {
    const rawAnalysis = await analyzeJob({
      model,
      jobDescription,
      profile,
      experiences,
    });
    const analysis = sanitizeAnalysisExperienceIds(
      rawAnalysis,
      new Set(experiences.map((experience) => experience.id)),
    );
    return {
      analysis,
      score: scoreAnalysisAgainstEvidence({ analysis, profile, experiences }),
    };
  });
}

function analysisRecord(
  jobDescription: string,
  analysis: JobAnalysis,
  score: ScoreBreakdown,
): AnalysisInput {
  return {
    jobDescription,
    jobTitle: analysis.jobTitle,
    companyName: analysis.companyName,
    analysis,
    score,
  };
}

export async function runTailoringAnalysis(
  userId: string,
  applicationId: string,
  jobDescription: string,
  deps: TailoringDeps = defaultDeps,
): Promise<Result<{ analysisId: string }>> {
  const application = await deps.saveApplicationJobDescription(
    userId,
    applicationId,
    jobDescription,
  );
  if (!application) return notFound;

  const experiences = await deps.listExperiences(userId);
  if (!experiences.length) return noExperiences;

  const result = await analyzeAndScore(
    userId,
    jobDescription,
    experiences,
    deps,
  );
  if (!result.ok) return result;

  const saved = await deps.createAnalysis(userId, {
    ...analysisRecord(
      jobDescription,
      result.value.analysis,
      result.value.score,
    ),
    applicationId: application.id,
  });
  if (!saved) return notFound;
  return { ok: true, analysisId: saved.id };
}

const unknownCompany = "Company not specified";

export async function runQuickTailoring(
  userId: string,
  input: { applicationId?: string; jobDescription: string },
  deps: TailoringDeps = defaultDeps,
): Promise<Result<{ applicationId: string; analysisId: string }>> {
  if (input.applicationId) {
    const applicationId = input.applicationId;
    const result = await runTailoringAnalysis(
      userId,
      applicationId,
      input.jobDescription,
      deps,
    );
    return result.ok ? { ...result, applicationId } : result;
  }

  const experiences = await deps.listExperiences(userId);
  if (!experiences.length) return noExperiences;

  const result = await analyzeAndScore(
    userId,
    input.jobDescription,
    experiences,
    deps,
  );
  if (!result.ok) return result;

  const { analysis, score } = result.value;
  const created = await deps.createApplicationWithAnalysis(
    userId,
    applicationInputSchema.parse({
      companyName: analysis.companyName.trim() || unknownCompany,
      position: analysis.jobTitle,
      jobDescription: input.jobDescription,
    }),
    analysisRecord(input.jobDescription, analysis, score),
  );
  return { ok: true, ...created };
}

export async function generateTailoredDocuments(
  user: { id: string; name: string; email: string },
  applicationId: string,
  analysisId: string,
  deps: TailoringDeps = defaultDeps,
): Promise<Result<{ resumeId: string; coverLetterId: string }>> {
  const [application, record, profile, experiences] = await Promise.all([
    deps.getApplication(user.id, applicationId),
    deps.getAnalysis(user.id, analysisId),
    deps.getProfile(user.id),
    deps.listExperiences(user.id),
  ]);
  if (!application || !record || record.applicationId !== application.id) {
    return notFound;
  }
  if (!experiences.length) return noExperiences;

  const analysis = jobAnalysisSchema.parse(record.analysis);
  const ownedIds = new Set(experiences.map((experience) => experience.id));

  const generated = await withModel(
    user.id,
    "generate-tailored-documents",
    deps,
    async (model) => {
      const [resume, coverLetter] = await Promise.all([
        generateResume({
          model,
          account: user,
          profile,
          experiences,
          analysis,
        }),
        generateCoverLetter({
          model,
          profile,
          experiences,
          analysis,
          application,
        }),
      ]);
      return {
        resume: sanitizeResumeEvidence(resume, ownedIds),
        coverLetter: sanitizeCoverLetterEvidence(coverLetter, ownedIds),
      };
    },
  );
  if (!generated.ok) return generated;

  const title = `${application.position} at ${application.companyName}`;
  const saved = await deps.createTailoredDocuments(user.id, {
    applicationId: application.id,
    analysisId: record.id,
    resume: { title, content: generated.value.resume },
    coverLetter: {
      title: `Cover letter: ${title}`,
      content: generated.value.coverLetter,
    },
  });
  if (!saved) return notFound;
  return { ok: true, ...saved };
}

export function describeTailoringFailure(
  failure: TailoringFailure,
  stage: "analysis" | "generation",
): { status: number; message: string } {
  switch (failure.reason) {
    case "not-found":
      return { status: 404, message: "Application not found." };
    case "no-experiences":
      return {
        status: 400,
        message: "Add at least one work experience before tailoring.",
      };
    case "no-key":
      return { status: 400, message: failure.message };
    case "ai-failed": {
      const label = failure.provider
        ? aiProviderDetails[failure.provider].label
        : "AI";
      const action = stage === "analysis" ? "Analysis" : "Generation";
      return {
        status: 502,
        message: `${action} failed. Nothing was saved. Check your ${label} API key and evidence, then try again.`,
      };
    }
  }
}
