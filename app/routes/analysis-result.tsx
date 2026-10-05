import { data, Form, Link, redirect, useNavigation } from "react-router";
import { generateResume } from "../lib/ai.server";
import {
  logProviderError,
  NoAiKeyError,
  resolveLanguageModel,
} from "../lib/ai-provider.server";
import type { AiProvider } from "../lib/ai-providers";
import {
  getLearningResources,
  jobAnalysisSchema,
  scoreBreakdownSchema,
} from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import {
  createResume,
  getAnalysis,
  getProfile,
  listExperiences,
} from "../lib/repositories.server";
import { sanitizeResumeEvidence } from "../lib/resume";
import type { Route } from "./+types/analysis-result";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.record.jobTitle ?? "Analysis"} | Resume Fit`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const record = await getAnalysis(user.id, params.analysisId);
  if (!record) {
    throw new Response("Analysis not found.", { status: 404 });
  }

  const analysis = jobAnalysisSchema.parse(record.analysis);
  const score = scoreBreakdownSchema.parse(record.score);
  return {
    record,
    analysis,
    score,
    gaps: analysis.missingSkills.map((skill) => ({
      skill,
      resources: getLearningResources(skill),
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const [record, profile, experienceList] = await Promise.all([
    getAnalysis(user.id, params.analysisId),
    getProfile(user.id),
    listExperiences(user.id),
  ]);
  if (!record) {
    throw new Response("Analysis not found.", { status: 404 });
  }

  let provider: AiProvider | undefined;
  try {
    const analysis = jobAnalysisSchema.parse(record.analysis);
    const resolved = await resolveLanguageModel(user.id);
    provider = resolved.provider;
    const generated = await generateResume({
      model: resolved.model,
      account: user,
      profile,
      experiences: experienceList,
      analysis,
    });
    const content = sanitizeResumeEvidence(
      generated,
      new Set(experienceList.map((experience) => experience.id)),
    );
    const resume = await createResume(user.id, {
      analysisId: record.id,
      title: `${record.jobTitle}${record.companyName ? ` at ${record.companyName}` : ""}`,
      content,
    });
    return redirect(`/resumes/${resume.id}`);
  } catch (error) {
    if (error instanceof NoAiKeyError) {
      return data({ error: error.message }, { status: 400 });
    }
    logProviderError("generate-resume", provider, error);
    return data(
      {
        error:
          "Resume generation failed. Check your API key and evidence, then try again.",
      },
      { status: 502 },
    );
  }
}

const factorLabels = {
  keywordCoverage: "Keyword coverage",
  requiredSkillCoverage: "Required skills",
  evidenceStrength: "Evidence strength",
  titleAlignment: "Title alignment",
  profileCompleteness: "Profile completeness",
} as const;

export default function AnalysisResult({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { record, analysis, score, gaps } = loaderData;
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/" className="text-sm text-cyan-400 hover:text-cyan-300">
        ← New analysis
      </Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:sticky lg:top-6 lg:self-start">
          <p className="text-sm uppercase tracking-wider text-slate-500">
            Fit estimate
          </p>
          <p className="mt-2 text-6xl font-semibold text-cyan-300">
            {score.total}
          </p>
          <p className="text-sm text-slate-500">out of 100</p>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Heuristic based on your stored evidence. Not hiring probability or
            guarantee.
          </p>
          <Form method="post" className="mt-6">
            <button
              type="submit"
              name="intent"
              value="generate-resume"
              disabled={isGenerating}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              {isGenerating ? "Generating…" : "Generate resume"}
            </button>
          </Form>
          {actionData?.error ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {actionData.error}
            </p>
          ) : null}
        </aside>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Analysis
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{record.jobTitle}</h1>
          <p className="mt-2 text-slate-400">
            {record.companyName || "Company not specified"} ·{" "}
            {analysis.seniority || "Seniority not specified"}
          </p>

          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Object.entries(factorLabels).map(([key, label]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {score[key as keyof typeof factorLabels]}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Evidence matches</h2>
            <div className="mt-5 space-y-4">
              {analysis.matches.map((match) => (
                <article
                  key={`${match.requirement}:${match.experienceIds.join(":")}:${match.evidence}`}
                  className="rounded-xl bg-slate-950 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium">{match.requirement}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        match.strength === "strong"
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-amber-950 text-amber-300"
                      }`}
                    >
                      {match.strength}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {match.evidence}
                  </p>
                </article>
              ))}
              {!analysis.matches.length ? (
                <p className="text-sm text-slate-500">
                  No supported matches found. Add more detailed experience
                  evidence before generating.
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">
              Missing skills and keywords
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {gaps.map(({ skill, resources }) => (
                <article key={skill} className="rounded-xl bg-slate-950 p-4">
                  <h3 className="font-medium">{skill}</h3>
                  <div className="mt-3 flex gap-3">
                    {resources.map((resource) => (
                      <a
                        key={resource.label}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        Learn on {resource.label}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
              {!gaps.length ? (
                <p className="text-sm text-emerald-300">
                  No explicit required-skill gaps found.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
