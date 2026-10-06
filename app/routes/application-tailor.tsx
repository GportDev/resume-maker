import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { AnalysisSummary, FitScore } from "../components/analysis-summary";
import {
  jobAnalysisSchema,
  jobDescriptionInputSchema,
  jobDescriptionMaxLength,
  jobDescriptionMinLength,
  scoreBreakdownSchema,
} from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import { matchKeywordsToExperiences } from "../lib/keyword-match";
import {
  getApplication,
  getLatestApplicationAnalysis,
  listApplicationDocumentSummaries,
  listExperiences,
} from "../lib/repositories.server";
import {
  describeTailoringFailure,
  generateTailoredDocuments,
  runTailoringAnalysis,
} from "../lib/tailoring.server";
import type { Route } from "./+types/application-tailor";

export function meta({ loaderData }: Route.MetaArgs) {
  const application = loaderData?.application;
  return [
    {
      title: `Tailor ${application ? `${application.position} at ${application.companyName}` : "application"} | Resume Fit`,
    },
  ];
}

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  if (!isUuid(params.applicationId)) {
    throw new Response("Application not found.", { status: 404 });
  }
  const [application, record, experienceList, summaries] = await Promise.all([
    getApplication(user.id, params.applicationId),
    getLatestApplicationAnalysis(user.id, params.applicationId),
    listExperiences(user.id),
    listApplicationDocumentSummaries(user.id, params.applicationId),
  ]);
  if (!application) {
    throw new Response("Application not found.", { status: 404 });
  }

  const latest = record
    ? (() => {
        const analysis = jobAnalysisSchema.parse(record.analysis);
        return {
          id: record.id,
          createdAt: record.createdAt,
          jobDescriptionChanged:
            record.jobDescription.trim() !== application.jobDescription.trim(),
          analysis,
          score: scoreBreakdownSchema.parse(record.score),
          keywordMatch: matchKeywordsToExperiences(analysis, experienceList),
        };
      })()
    : null;
  const documents = summaries.get(application.id);

  return {
    application: {
      id: application.id,
      companyName: application.companyName,
      position: application.position,
      jobDescription: application.jobDescription,
    },
    latest,
    positions: experienceList.map(({ id, position, company }) => ({
      id,
      position,
      company,
    })),
    hasDocuments: Boolean(documents?.resumeId || documents?.coverLetterId),
  };
}

type ActionResult = { intent: "analyze" | "generate"; error: string };

function failure(
  intent: ActionResult["intent"],
  status: number,
  error: string,
) {
  return data<ActionResult>({ intent, error }, { status });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const applicationId = params.applicationId;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "analyze") {
    if (!isUuid(applicationId)) {
      return failure("analyze", 404, "Application not found.");
    }
    const jobDescription = jobDescriptionInputSchema.safeParse(
      formData.get("jobDescription"),
    );
    if (!jobDescription.success) {
      return failure(
        "analyze",
        400,
        jobDescription.error.issues[0]?.message ?? "Invalid job description.",
      );
    }
    const result = await runTailoringAnalysis(
      user.id,
      applicationId,
      jobDescription.data,
    );
    if (!result.ok) {
      const { status, message } = describeTailoringFailure(result, "analysis");
      return failure("analyze", status, message);
    }
    return redirect(`/applications/${applicationId}/tailor`);
  }

  if (intent === "generate") {
    const analysisId = z.uuid().safeParse(formData.get("analysisId"));
    if (!isUuid(applicationId) || !analysisId.success) {
      return failure("generate", 404, "Analysis not found.");
    }
    const result = await generateTailoredDocuments(
      user,
      applicationId,
      analysisId.data,
    );
    if (!result.ok) {
      const { status, message } = describeTailoringFailure(
        result,
        "generation",
      );
      return failure("generate", status, message);
    }
    return redirect(`/applications/${applicationId}?tailored=1`);
  }

  return failure("analyze", 400, "Unknown action.");
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function ApplicationTailor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { application, latest, positions, hasDocuments } = loaderData;
  const navigation = useNavigation();
  const pendingIntent =
    navigation.state === "submitting"
      ? navigation.formData?.get("intent")
      : null;
  const analyzeError =
    actionData?.intent === "analyze" ? actionData.error : undefined;
  const generateError =
    actionData?.intent === "generate" ? actionData.error : undefined;
  const busy = Boolean(pendingIntent);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to={`/applications/${application.id}`}
        className="text-sm text-cyan-400 hover:text-cyan-300"
      >
        ← Back to application
      </Link>
      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Tailor
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{application.position}</h1>
        <p className="mt-1 text-slate-400">{application.companyName}</p>
      </div>

      <Form
        method="post"
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <h2 className="text-xl font-semibold">1. Job description</h2>
        <label
          htmlFor="jobDescription"
          className="mt-4 block text-sm font-medium"
        >
          Job description
        </label>
        <p id="jobDescription-hint" className="mt-1 text-xs text-slate-500">
          Saved on the application when you analyze. Use the full posting,
          including requirements.
        </p>
        <textarea
          id="jobDescription"
          name="jobDescription"
          defaultValue={application.jobDescription}
          minLength={jobDescriptionMinLength}
          maxLength={jobDescriptionMaxLength}
          required
          rows={14}
          aria-describedby={
            analyzeError
              ? "jobDescription-hint analyze-error"
              : "jobDescription-hint"
          }
          aria-invalid={analyzeError ? true : undefined}
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 outline-none focus:border-cyan-400"
          placeholder="Paste the complete role description here…"
        />
        {analyzeError ? (
          <p
            id="analyze-error"
            className="mt-3 text-sm text-red-300"
            role="alert"
          >
            {analyzeError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {positions.length} position{positions.length === 1 ? "" : "s"} to
            match
            {!positions.length ? (
              <>
                {" · "}
                <Link
                  to="/contributions"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  Add experience first
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="submit"
            name="intent"
            value="analyze"
            disabled={busy}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
          >
            {pendingIntent === "analyze"
              ? "Analyzing…"
              : latest
                ? "Analyze again"
                : "Analyze job"}
          </button>
        </div>
      </Form>

      {latest ? (
        <section
          aria-labelledby="analysis-heading"
          className="mt-10 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]"
        >
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <FitScore score={latest.score}>
              <Form method="post" className="mt-6">
                <input type="hidden" name="analysisId" value={latest.id} />
                <button
                  type="submit"
                  name="intent"
                  value="generate"
                  disabled={busy}
                  className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {pendingIntent === "generate"
                    ? "Writing documents…"
                    : "Generate resume and cover letter"}
                </button>
              </Form>
              {hasDocuments ? (
                <p className="mt-3 text-xs text-slate-500">
                  Generating again saves new versions. The card shows the
                  latest.
                </p>
              ) : null}
              {generateError ? (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {generateError}
                </p>
              ) : null}
            </FitScore>
          </aside>
          <div>
            <h2 id="analysis-heading" className="text-xl font-semibold">
              2. Review matches and gaps
            </h2>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Analyzed {formatDateTime(latest.createdAt)} UTC
              {latest.jobDescriptionChanged
                ? ". The job description changed since; analyze again to update."
                : "."}
            </p>
            <AnalysisSummary
              analysis={latest.analysis}
              score={latest.score}
              keywordMatch={latest.keywordMatch}
              positions={positions}
            />
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Analyze the job description to see keyword matches for each position
          before generating documents.
        </p>
      )}
    </main>
  );
}
