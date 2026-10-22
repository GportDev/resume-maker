import { useEffect, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { AnalysisSummary, FitScore } from "../components/analysis-summary";
import { MatchBadge } from "../components/application-card";
import { Button, buttonClass, textLinkClass } from "../components/ui/button";
import { Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import {
  jobAnalysisSchema,
  jobDescriptionInputSchema,
  jobDescriptionMaxLength,
  jobDescriptionMinLength,
  scoreBreakdownSchema,
} from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import { exhibitNumbers } from "../lib/contributions";
import { reconcileAnalysisMatches } from "../lib/job-match";
import { parseStoredJobMatch } from "../lib/job-match.server";
import { matchKeywordsToExperiences } from "../lib/keyword-match";
import {
  getApplication,
  getLatestAnalysisJobMatch,
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

  const match = record
    ? parseStoredJobMatch(await getLatestAnalysisJobMatch(user.id, record.id))
    : null;
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
          matchVerification: match
            ? reconcileAnalysisMatches(analysis.matches, match.result)
                .verification
            : undefined,
          jobMatch: match
            ? {
                matchScore: match.result.matchScore,
                recommendation: match.result.recommendation,
              }
            : null,
        };
      })()
    : null;
  const documents = summaries.get(application.id);
  const exhibits = exhibitNumbers(experienceList);

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
      exhibit: exhibits.get(id) ?? null,
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

const generationSteps = [
  "Selecting verified evidence",
  "Writing the resume",
  "Writing the cover letter",
  "Saving both documents",
];

function GenerationProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  // Steps are an honest estimate of order, not server progress events.
  const current = Math.min(generationSteps.length - 1, Math.floor(elapsed / 8));
  return (
    <div role="status" className="mt-4 rounded-control bg-sheet-sunk p-3">
      <p className="text-sm font-medium">
        Writing documents · <span className="tabular">{elapsed}s</span>
      </p>
      <ol className="mt-2 space-y-1 text-[0.8125rem]">
        {generationSteps.map((step, index) => (
          <li
            key={step}
            className={
              index < current
                ? "text-ink-3 line-through decoration-ink-3/50"
                : index === current
                  ? "font-medium text-ink"
                  : "text-ink-3"
            }
          >
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-3">
        Both documents save together, or neither does. Keep this tab open.
      </p>
    </div>
  );
}

const analyzedFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

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
  const words = application.jobDescription.trim()
    ? application.jobDescription.trim().split(/\s+/).length
    : 0;

  const descriptionForm = (
    <Form method="post" className="space-y-3">
      <Field
        id="jobDescription"
        label="Job description"
        error={analyzeError}
        hint="Saved on the application when you analyze. Use the full posting, including requirements."
      >
        <textarea
          id="jobDescription"
          name="jobDescription"
          defaultValue={application.jobDescription}
          minLength={jobDescriptionMinLength}
          maxLength={jobDescriptionMaxLength}
          required
          aria-describedby={
            analyzeError ? "jobDescription-error" : "jobDescription-hint"
          }
          aria-invalid={analyzeError ? true : undefined}
          className={`${fieldClass} min-h-56 max-h-[60vh] font-mono text-sm leading-6 [field-sizing:content]`}
          placeholder="Paste the complete role description here…"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          {positions.length} position{positions.length === 1 ? "" : "s"} to
          match
          {!positions.length ? (
            <>
              {" · "}
              <Link to="/contributions/new" className={textLinkClass}>
                Add a position first
              </Link>
            </>
          ) : null}
        </p>
        <Button
          type="submit"
          name="intent"
          value="analyze"
          variant={latest ? "secondary" : "primary"}
          disabled={busy}
          pending={pendingIntent === "analyze"}
        >
          {pendingIntent === "analyze"
            ? "Analyzing…"
            : latest
              ? "Analyze again"
              : "Analyze job"}
        </Button>
      </div>
    </Form>
  );

  return (
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <Sheet className="rounded-t-none">
        <PageHeader
          back={
            <Link
              to={`/applications/${application.id}`}
              className={textLinkClass}
            >
              ← {application.position}
            </Link>
          }
          title={`Tailor for ${application.companyName}`}
          meta={application.position}
        />

        {latest ? (
          <SheetSection
            title="Job description"
            id="jd-summary-heading"
            description={
              <>
                {words} words · analyzed{" "}
                {analyzedFormat.format(new Date(latest.createdAt))} UTC
                {latest.jobDescriptionChanged ? (
                  <span className="text-warn">
                    {" "}
                    · changed since; analyze again to update
                  </span>
                ) : null}
              </>
            }
          >
            <details open={Boolean(analyzeError)} className="group/jd">
              <summary
                className={`${buttonClass({ variant: "secondary", size: "sm" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                <span className="group-open/jd:hidden">
                  Edit and re-analyze
                </span>
                <span className="hidden group-open/jd:inline">
                  Hide description
                </span>
              </summary>
              <div className="mt-4">{descriptionForm}</div>
            </details>
          </SheetSection>
        ) : (
          <SheetSection
            title="Job description"
            id="jd-heading"
            description="Analysis extracts requirements and keywords, then checks them against your filed positions."
          >
            {descriptionForm}
          </SheetSection>
        )}

        {latest ? (
          <AnalysisSummary
            analysis={latest.analysis}
            score={latest.score}
            keywordMatch={latest.keywordMatch}
            positions={positions}
            matchVerification={latest.matchVerification}
          />
        ) : (
          <SheetSection>
            <p className="rounded-sheet border border-dashed border-rule-strong p-8 text-center text-sm text-ink-2">
              Analyze the job description to see keyword matches for each
              position before generating documents.
            </p>
          </SheetSection>
        )}
      </Sheet>

      {latest ? (
        <aside className="lg:sticky lg:top-4 lg:self-start lg:pt-6">
          <FitScore score={latest.score}>
            <Form method="post" className="mt-5 border-t border-rule pt-4">
              <input type="hidden" name="analysisId" value={latest.id} />
              <Button
                type="submit"
                name="intent"
                value="generate"
                variant="primary"
                className="w-full"
                disabled={busy}
                pending={pendingIntent === "generate"}
              >
                {pendingIntent === "generate"
                  ? "Writing documents…"
                  : hasDocuments
                    ? "Write new versions"
                    : "Write resume and cover letter"}
              </Button>
            </Form>
            {pendingIntent === "generate" ? <GenerationProgress /> : null}
            {latest.jobMatch ? (
              <div className="mt-4 text-xs leading-5 text-ink-3">
                <MatchBadge match={latest.jobMatch} />
                <p className="mt-2">
                  Documents use only matches verified by the job match.{" "}
                  <Link
                    to={`/applications/${application.id}`}
                    className={textLinkClass}
                  >
                    Review match
                  </Link>
                </p>
              </div>
            ) : null}
            {hasDocuments && pendingIntent !== "generate" ? (
              <p className="mt-3 text-xs text-ink-3">
                Writing again saves new versions. The application shows the
                latest.
              </p>
            ) : null}
            {generateError ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {generateError}
              </p>
            ) : null}
          </FitScore>
        </aside>
      ) : null}
    </main>
  );
}
