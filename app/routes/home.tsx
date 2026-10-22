import { CircleCheck } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { FitBadge, StatusBadge } from "../components/application-card";
import {
  Button,
  ButtonLink,
  standaloneLinkClass,
  textLinkClass,
} from "../components/ui/button";
import { Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import {
  jobDescriptionInputSchema,
  jobDescriptionMaxLength,
  jobDescriptionMinLength,
  scoreBreakdownSchema,
} from "../lib/analysis";
import {
  applicationStatusLabels,
  summarizePipeline,
} from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import {
  getProfile,
  listAnalyses,
  listApplicationDocumentSummaries,
  listApplicationOptions,
  listApplications,
  listExperiences,
} from "../lib/repositories.server";
import {
  describeTailoringFailure,
  runQuickTailoring,
} from "../lib/tailoring.server";
import type { Route } from "./+types/home";

const newApplication = "new";

const applicationChoiceSchema = z.union([
  z.literal(newApplication).transform(() => undefined),
  z.uuid(),
]);

export function meta() {
  return [
    { title: "Home | Resume Fit" },
    {
      name: "description",
      content: "Create an evidence-based resume and cover letter for a job.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [
    experienceList,
    applicationOptions,
    analysisList,
    applicationRows,
    summaries,
    profile,
  ] = await Promise.all([
    listExperiences(user.id),
    listApplicationOptions(user.id),
    listAnalyses(user.id),
    listApplications(user.id),
    listApplicationDocumentSummaries(user.id),
    getProfile(user.id),
  ]);
  const selected = new URL(request.url).searchParams.get("application");
  const resumeIds = new Map(
    applicationRows.map((row) => [
      row.id,
      summaries.get(row.id)?.resumeId ?? null,
    ]),
  );
  const pipeline = summarizePipeline(applicationRows, resumeIds);
  const byId = new Map(applicationRows.map((row) => [row.id, row]));
  return {
    firstName: user.name.split(/\s+/)[0] ?? user.name,
    hasProfile: Boolean(profile),
    experienceCount: experienceList.length,
    applicationOptions,
    selectedApplication:
      applicationOptions.find((option) => option.id === selected)?.id ??
      newApplication,
    pipeline: { counts: pipeline.counts, active: pipeline.active },
    needsTailoring: pipeline.needsTailoring.slice(0, 5).flatMap((id) => {
      const row = byId.get(id);
      return row
        ? [
            {
              id: row.id,
              position: row.position,
              companyName: row.companyName,
              status: row.status,
            },
          ]
        : [];
    }),
    recentAnalyses: analysisList.slice(0, 5).map((analysis) => {
      const score = scoreBreakdownSchema.safeParse(analysis.score);
      return {
        id: analysis.id,
        jobTitle: analysis.jobTitle,
        companyName: analysis.companyName,
        applicationId: analysis.applicationId,
        score: score.success ? score.data.total : null,
        createdAt: analysis.createdAt.toISOString(),
      };
    }),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const jobDescription = jobDescriptionInputSchema.safeParse(
    formData.get("jobDescription"),
  );
  if (!jobDescription.success) {
    return data(
      {
        error:
          jobDescription.error.issues[0]?.message ?? "Paste a job description.",
      },
      { status: 400 },
    );
  }
  const application = applicationChoiceSchema.safeParse(
    formData.get("applicationId") ?? newApplication,
  );
  if (!application.success) {
    return data({ error: "Choose an application." }, { status: 400 });
  }

  const result = await runQuickTailoring(user.id, {
    applicationId: application.data,
    jobDescription: jobDescription.data,
  });
  if (!result.ok) {
    const { status, message } = describeTailoringFailure(result, "analysis");
    return data({ error: message }, { status });
  }
  return redirect(`/applications/${result.applicationId}/tailor`);
}

const relativeDay = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ageLabel(iso: string) {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > -1) return "today";
  if (days > -30) return relativeDay.format(days, "day");
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const {
    firstName,
    hasProfile,
    experienceCount,
    applicationOptions,
    selectedApplication,
    pipeline,
    needsTailoring,
    recentAnalyses,
  } = loaderData;
  const navigation = useNavigation();
  const isAnalyzing =
    navigation.state === "submitting" && navigation.formAction === "/?index";
  const setup = [
    { done: hasProfile, label: "Add contact details", to: "/profile" },
    {
      done: experienceCount > 0,
      label: "File your first position",
      to: "/contributions/new",
    },
    {
      done: recentAnalyses.length > 0,
      label: "Analyze a job description",
      to: "#jobDescription",
    },
  ];
  const setupComplete = setup.every((step) => step.done);
  const statusOrder = ["saved", "applied", "interviewing", "offer"] as const;

  return (
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <Sheet className="rounded-t-none">
        <PageHeader
          title={
            setupComplete
              ? `Welcome back, ${firstName}`
              : `Welcome, ${firstName}`
          }
          meta={
            pipeline.active
              ? `${pipeline.active} active ${pipeline.active === 1 ? "application" : "applications"}${needsTailoring.length ? ` · ${needsTailoring.length} waiting for a tailored resume` : ""}`
              : "Paste a job description to start your first application."
          }
        />

        {!setupComplete ? (
          <SheetSection title="Get set up" id="setup-heading">
            <ol className="grid gap-2 sm:grid-cols-3">
              {setup.map((step, index) => (
                <li key={step.label}>
                  <Link
                    to={step.to}
                    className={`flex h-full items-start gap-3 rounded-control border px-3 py-2.5 text-sm ${
                      step.done
                        ? "border-rule text-ink-3"
                        : "border-rule-strong bg-field text-ink hover:border-exhibit"
                    }`}
                  >
                    {step.done ? (
                      <CircleCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-ok"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="tabular grid size-[1.1rem] shrink-0 place-items-center rounded-full border border-ink-3 text-[0.6875rem] font-bold"
                      >
                        {index + 1}
                      </span>
                    )}
                    <span>
                      {step.label}
                      {step.done ? (
                        <span className="sr-only"> (done)</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </SheetSection>
        ) : null}

        <SheetSection
          title="Tailor a job"
          id="tailor-heading"
          description="Paste the full posting. Analysis shows which of your positions match; then write a resume and cover letter from that evidence."
        >
          <Form method="post" className="space-y-4">
            <Field
              id="jobDescription"
              label="Job description"
              error={actionData?.error}
            >
              <textarea
                id="jobDescription"
                name="jobDescription"
                minLength={jobDescriptionMinLength}
                maxLength={jobDescriptionMaxLength}
                required
                aria-invalid={actionData?.error ? true : undefined}
                aria-describedby={
                  actionData?.error ? "jobDescription-error" : undefined
                }
                className={`${fieldClass} min-h-40 max-h-[60vh] leading-6 [field-sizing:content]`}
                placeholder="Paste the complete role description here…"
              />
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field
                id="applicationId"
                label="Save to application"
                className="min-w-0 flex-1 basis-72"
                hint="New applications take position and company from the analysis. Choosing an existing one replaces its job description."
              >
                <select
                  id="applicationId"
                  name="applicationId"
                  defaultValue={selectedApplication}
                  aria-describedby="applicationId-hint"
                  className={fieldClass}
                >
                  <option value={newApplication}>
                    New application from this job
                  </option>
                  {applicationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.position} at {option.companyName} (
                      {applicationStatusLabels[option.status]})
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="submit"
                variant="primary"
                pending={isAnalyzing}
                className="mb-[1.6rem]"
              >
                {isAnalyzing ? "Analyzing…" : "Analyze job"}
              </Button>
            </div>
            {experienceCount === 0 ? (
              <p className="text-sm text-warn">
                Analysis matches against your positions.{" "}
                <Link to="/contributions/new" className={textLinkClass}>
                  Add a position first
                </Link>
                .
              </p>
            ) : null}
          </Form>
        </SheetSection>
      </Sheet>

      <aside className="space-y-6 pt-2 lg:pt-6">
        <section aria-labelledby="pipeline-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="pipeline-heading" className="text-sm font-semibold">
              Pipeline
            </h2>
            <Link
              to="/applications"
              className={`text-[0.8125rem] ${standaloneLinkClass}`}
            >
              Open board
            </Link>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-rule bg-rule">
            {statusOrder.map((status) => (
              <li key={status} className="bg-sheet px-3 py-2.5">
                <p className="tabular text-xl font-bold">
                  {pipeline.counts[status]}
                </p>
                <StatusBadge status={status} />
              </li>
            ))}
          </ul>
          {pipeline.counts.rejected + pipeline.counts.withdrawn ? (
            <p className="mt-1.5 text-[0.8125rem] text-ink-3">
              {pipeline.counts.rejected + pipeline.counts.withdrawn} closed
            </p>
          ) : null}
        </section>

        <section aria-labelledby="needs-heading">
          <h2 id="needs-heading" className="text-sm font-semibold">
            Needs tailoring
          </h2>
          {needsTailoring.length ? (
            <ul className="mt-2 divide-y divide-rule rounded-control border border-rule bg-sheet">
              {needsTailoring.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <Link
                    to={`/applications/${item.id}`}
                    className="min-w-0 flex-1 text-sm hover:text-exhibit"
                  >
                    <span className="block truncate font-medium">
                      {item.position}
                    </span>
                    <span className="block truncate text-[0.8125rem] text-ink-3">
                      {item.companyName}
                    </span>
                  </Link>
                  <ButtonLink
                    to={`/applications/${item.id}/tailor`}
                    size="sm"
                    aria-label={`Tailor ${item.position} at ${item.companyName}`}
                  >
                    Tailor
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.8125rem] text-ink-3">
              {pipeline.counts.saved + pipeline.counts.applied
                ? "Every saved and applied job has a tailored resume."
                : "No saved or applied jobs yet."}
            </p>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-sm font-semibold">
            Recent analyses
          </h2>
          {recentAnalyses.length ? (
            <ul className="mt-2 divide-y divide-rule rounded-control border border-rule bg-sheet">
              {recentAnalyses.map((analysis) => (
                <li key={analysis.id}>
                  <Link
                    to={
                      analysis.applicationId
                        ? `/applications/${analysis.applicationId}/tailor`
                        : `/analyses/${analysis.id}`
                    }
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-sheet-sunk"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {analysis.jobTitle}
                      </span>
                      <span className="block truncate text-[0.8125rem] text-ink-3">
                        {analysis.companyName || "Company not specified"} ·{" "}
                        {ageLabel(analysis.createdAt)}
                      </span>
                    </span>
                    {analysis.score !== null ? (
                      <FitBadge score={analysis.score} />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.8125rem] text-ink-3">No analyses yet.</p>
          )}
        </section>

        {recentAnalyses.length === 0 || experienceCount === 0 ? (
          <section className="text-[0.8125rem] text-ink-2">
            <h2 className="text-sm font-semibold text-ink">
              Before you analyze
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Use the complete job text, including requirements.</li>
              <li>Keep evidence factual and specific.</li>
              <li>The fit score is a heuristic, not a hiring probability.</li>
            </ul>
          </section>
        ) : null}
      </aside>
    </main>
  );
}
