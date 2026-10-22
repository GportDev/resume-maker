import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useFetcher,
  useNavigation,
} from "react-router";
import { z } from "zod";
import {
  LinkedInBadge,
  LinkedInPostingLink,
} from "../components/application-card";
import { FitBreakdown } from "../components/fit-breakdown";
import { JobMatchPanel } from "../components/job-match-panel";
import {
  Button,
  ButtonLink,
  buttonClass,
  textLinkClass,
} from "../components/ui/button";
import { ConfirmDialog, openDialog } from "../components/ui/confirm-dialog";
import { describedBy, Field, fieldClass } from "../components/ui/field";
import { Popover, popoverItemClass } from "../components/ui/popover";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import { useToast } from "../components/ui/toast";
import { scoreBreakdownSchema } from "../lib/analysis";
import {
  applicationInputSchema,
  applicationStatuses,
  applicationStatusLabels,
  commonCurrencies,
  formatSalaryRange,
  parseApplicationStatus,
  salaryPeriodLabels,
  salaryPeriods,
  toApplicationDocuments,
} from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import { isJevConfigured } from "../lib/jev.server";
import { matchOverrideInputSchema } from "../lib/job-match";
import {
  describeJobMatchFailure,
  parseStoredJobMatch,
  runJobMatch,
  setJobMatchOverride,
} from "../lib/job-match.server";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getLatestApplicationAnalysis,
  getLatestApplicationJobMatch,
  listApplicationDocumentSummaries,
  listExperiences,
  placeApplication,
  updateApplication,
  updateApplicationNotes,
} from "../lib/repositories.server";
import { firstFormError } from "../lib/validation";
import type { Route } from "./+types/application-detail";

const notFound = () => new Response("Application not found.", { status: 404 });

const applicationFields = [
  "companyName",
  "position",
  "location",
  "jobDescription",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "salaryPeriod",
  "status",
  "sourceUrl",
  "notes",
  "appliedAt",
] as const;

export function meta({ loaderData }: Route.MetaArgs) {
  const application = loaderData?.application;
  return [
    {
      title: `${application ? `${application.position} at ${application.companyName}` : "New application"} | Resume Fit`,
    },
  ];
}

function requireApplicationId(applicationId: string): string {
  if (!z.uuid().safeParse(applicationId).success) throw notFound();
  return applicationId;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  if (params.applicationId === "new") {
    const status =
      parseApplicationStatus(new URL(request.url).searchParams.get("status")) ??
      "saved";
    return {
      application: null,
      editing: true,
      justSaved: false,
      score: null,
      initialStatus: status,
      documents: null,
      tailored: false,
      jobMatch: null,
      hasAnalysis: false,
      jevConfigured: false,
      positions: [],
    };
  }
  const applicationId = requireApplicationId(params.applicationId);
  const [application, summaries, latestAnalysis, latestMatch, experienceList] =
    await Promise.all([
      getApplication(user.id, applicationId),
      listApplicationDocumentSummaries(user.id, applicationId),
      getLatestApplicationAnalysis(user.id, applicationId),
      getLatestApplicationJobMatch(user.id, applicationId),
      listExperiences(user.id),
    ]);
  if (!application) throw notFound();
  const match = parseStoredJobMatch(latestMatch);
  const url = new URL(request.url);
  const score = scoreBreakdownSchema.safeParse(latestAnalysis?.score);
  return {
    application,
    editing: url.searchParams.get("edit") === "1",
    justSaved: url.searchParams.get("saved") === "1",
    score: score.success ? score.data : null,
    initialStatus: application.status,
    documents: toApplicationDocuments(summaries.get(application.id)),
    tailored: url.searchParams.get("tailored") === "1",
    jobMatch: match
      ? {
          id: match.id,
          createdAt: match.createdAt,
          modelVersion: match.modelVersion,
          stale: match.analysisId !== latestAnalysis?.id,
          result: match.result,
        }
      : null,
    hasAnalysis: Boolean(latestAnalysis),
    jevConfigured: isJevConfigured(),
    positions: experienceList.map(({ id, position, company }) => ({
      id,
      position,
      company,
    })),
  };
}

function matchError(status: number, message: string) {
  return data({ errors: { match: message } }, { status });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const isNew = params.applicationId === "new";

  if (intent === "run-match") {
    if (isNew) throw notFound();
    const applicationId = requireApplicationId(params.applicationId);
    const analysis = await getLatestApplicationAnalysis(user.id, applicationId);
    if (!analysis) {
      return matchError(
        400,
        "Analyze the job description before running a match.",
      );
    }
    const result = await runJobMatch(user.id, applicationId, analysis.id);
    if (!result.ok) {
      const { status, message } = describeJobMatchFailure(result);
      return matchError(status, message);
    }
    return data({ matched: true as const });
  }

  if (intent === "match-override") {
    if (isNew) throw notFound();
    const applicationId = requireApplicationId(params.applicationId);
    const parsed = matchOverrideInputSchema.safeParse({
      matchId: formData.get("matchId"),
      requirementId: formData.get("requirementId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return matchError(400, "Choose accept or reject for a requirement.");
    }
    const result = await setJobMatchOverride(user.id, {
      applicationId,
      matchId: parsed.data.matchId,
      requirementId: parsed.data.requirementId,
      override: parsed.data.decision === "clear" ? null : parsed.data.decision,
    });
    if (!result.ok) {
      const { status, message } = describeJobMatchFailure(result);
      return matchError(status, message);
    }
    return data({ reviewed: true as const });
  }

  if (intent === "status") {
    if (isNew) throw notFound();
    const status = z
      .enum(applicationStatuses)
      .safeParse(formData.get("status"));
    if (!status.success) {
      return data(
        { errors: { status: "Choose a valid status." } },
        { status: 400 },
      );
    }
    const result = await placeApplication(
      user.id,
      requireApplicationId(params.applicationId),
      status.data,
      {},
    );
    if (result === "not-found") throw notFound();
    if (result === "invalid") {
      return data(
        { errors: { status: "The board changed. Refresh and try again." } },
        { status: 409 },
      );
    }
    return data({ statusSaved: status.data });
  }

  if (intent === "notes") {
    if (isNew) throw notFound();
    const notes = z
      .string()
      .trim()
      .max(10_000)
      .safeParse(formData.get("notes") ?? "");
    if (!notes.success) {
      return data(
        { errors: { notes: "Notes must be at most 10,000 characters." } },
        { status: 400 },
      );
    }
    const updated = await updateApplicationNotes(
      user.id,
      requireApplicationId(params.applicationId),
      notes.data,
    );
    if (!updated) throw notFound();
    return data({ notesSaved: true as const });
  }

  if (intent === "delete") {
    if (isNew) throw notFound();
    if (formData.get("confirm") !== "yes") {
      return data(
        {
          errors: {
            delete: "Confirm that you want to delete this application.",
          },
        },
        { status: 400 },
      );
    }
    const deleted = await deleteApplication(
      user.id,
      requireApplicationId(params.applicationId),
    );
    if (!deleted) throw notFound();
    return redirect("/applications");
  }

  const parsed = applicationInputSchema.safeParse(
    Object.fromEntries(
      applicationFields.map((field) => [
        field,
        formData.get(field) ?? undefined,
      ]),
    ),
  );
  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  if (isNew) {
    const created = await createApplication(user.id, parsed.data);
    if (!created) throw new Error("Application could not be created.");
    return redirect(`/applications/${created.id}`);
  }

  const applicationId = requireApplicationId(params.applicationId);
  const updated = await updateApplication(user.id, applicationId, parsed.data);
  if (!updated) throw notFound();
  return redirect(`/applications/${applicationId}?saved=1`);
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "notes") return false;
  return defaultShouldRevalidate;
}

type LoaderData = Route.ComponentProps["loaderData"];

const appliedDateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});
type Application = NonNullable<LoaderData["application"]>;

function DetailsForm({
  application,
  initialStatus,
  errors,
}: {
  application: Application | null;
  initialStatus: LoaderData["initialStatus"];
  errors: Record<string, string>;
}) {
  const navigation = useNavigation();
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";
  const currency = application?.salaryCurrency ?? "USD";
  const currencies = commonCurrencies.some((code) => code === currency)
    ? commonCurrencies
    : [currency, ...commonCurrencies];
  const input = (
    name: string,
    props: Record<string, string | number | boolean | undefined> = {},
  ) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name]),
    className: fieldClass,
    ...props,
  });

  return (
    <Form
      key={application?.updatedAt.toString() ?? "new"}
      method="post"
      className="space-y-0"
    >
      <SheetSection title="Role" id="role-heading">
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <Field id="companyName" label="Company" error={errors.companyName}>
            <input
              {...input("companyName")}
              defaultValue={application?.companyName ?? ""}
              required
              maxLength={160}
            />
          </Field>
          <Field id="position" label="Position" error={errors.position}>
            <input
              {...input("position")}
              defaultValue={application?.position ?? ""}
              required
              maxLength={160}
            />
          </Field>
          <Field id="location" label="Location" error={errors.location}>
            <input
              {...input("location")}
              defaultValue={application?.location ?? ""}
              maxLength={160}
              placeholder="Remote, Lisbon, hybrid…"
            />
          </Field>
          <Field
            id="sourceUrl"
            label="Job posting link"
            error={errors.sourceUrl}
          >
            <input
              {...input("sourceUrl")}
              type="url"
              defaultValue={application?.sourceUrl ?? ""}
              placeholder="https://"
            />
          </Field>
          <Field id="status" label="Status" error={errors.status}>
            <select {...input("status")} defaultValue={initialStatus}>
              {applicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {applicationStatusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="appliedAt" label="Applied on" error={errors.appliedAt}>
            <input
              {...input("appliedAt")}
              type="date"
              defaultValue={application?.appliedAt ?? ""}
            />
          </Field>
        </div>
        <fieldset className="mt-5 max-w-3xl">
          <legend className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">
            Salary range
          </legend>
          <div className="flex flex-wrap items-start gap-2">
            <div className="w-32">
              <label htmlFor="salaryMin" className="sr-only">
                Minimum
              </label>
              <input
                {...input("salaryMin")}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Min"
                defaultValue={application?.salaryMin ?? ""}
              />
            </div>
            <span aria-hidden="true" className="pt-2 text-ink-3">
              –
            </span>
            <div className="w-32">
              <label htmlFor="salaryMax" className="sr-only">
                Maximum
              </label>
              <input
                {...input("salaryMax")}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Max"
                defaultValue={application?.salaryMax ?? ""}
              />
            </div>
            <div className="w-24">
              <label htmlFor="salaryCurrency" className="sr-only">
                Currency
              </label>
              <select {...input("salaryCurrency")} defaultValue={currency}>
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <span aria-hidden="true" className="pt-2 text-ink-3">
              per
            </span>
            <div className="w-32">
              <label htmlFor="salaryPeriod" className="sr-only">
                Period
              </label>
              <select
                {...input("salaryPeriod")}
                defaultValue={application?.salaryPeriod ?? "year"}
              >
                {salaryPeriods.map((period) => (
                  <option key={period} value={period}>
                    {salaryPeriodLabels[period]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {["salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod"].map(
            (name) =>
              errors[name] ? (
                <p
                  key={name}
                  id={`${name}-error`}
                  className="mt-1.5 text-[0.8125rem] text-danger"
                >
                  {errors[name]}
                </p>
              ) : null,
          )}
        </fieldset>
      </SheetSection>
      <SheetSection title="Job description" id="jd-heading">
        <Field
          id="jobDescription"
          label="Full posting"
          error={errors.jobDescription}
          hint="Paste the full posting, including requirements. Tailoring and matching read this text."
        >
          <textarea
            {...input("jobDescription")}
            aria-describedby={describedBy(
              "jobDescription",
              errors.jobDescription,
              true,
            )}
            rows={14}
            defaultValue={application?.jobDescription ?? ""}
            maxLength={50_000}
            className={`${fieldClass} font-mono text-sm leading-6`}
          />
        </Field>
        <Field id="notes" label="Notes" error={errors.notes} className="mt-5">
          <textarea
            {...input("notes")}
            rows={4}
            defaultValue={application?.notes ?? ""}
            maxLength={10_000}
            placeholder="Recruiter contact, interview dates, follow-ups…"
          />
        </Field>
      </SheetSection>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <Button
          type="submit"
          name="intent"
          value="save"
          variant="primary"
          pending={isSaving}
        >
          {application ? "Save changes" : "Add application"}
        </Button>
        <ButtonLink
          to={application ? `/applications/${application.id}` : "/applications"}
          variant="ghost"
        >
          Cancel
        </ButtonLink>
        {errors.form ? (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        ) : null}
      </div>
    </Form>
  );
}

function StatusSwitcher({ application }: { application: Application }) {
  const fetcher = useFetcher<{
    statusSaved?: string;
    errors?: Record<string, string>;
  }>();
  const pending = fetcher.formData?.get("status");
  const value = typeof pending === "string" ? pending : application.status;
  useToast(
    fetcher.data?.statusSaved
      ? `Moved to ${applicationStatusLabels[fetcher.data.statusSaved as keyof typeof applicationStatusLabels]}.`
      : null,
    fetcher.data,
  );
  return (
    <fetcher.Form method="post" className="flex items-center gap-1.5">
      <input type="hidden" name="intent" value="status" />
      <label htmlFor="status-switcher" className="sr-only">
        Status
      </label>
      <select
        id="status-switcher"
        name="status"
        value={value}
        onChange={(event) => fetcher.submit(event.currentTarget.form)}
        className={`${fieldClass} h-9 w-auto py-1 font-medium`}
      >
        {applicationStatuses.map((status) => (
          <option key={status} value={status}>
            {applicationStatusLabels[status]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className={buttonClass({ size: "sm" })}>
          Update
        </button>
      </noscript>
      {fetcher.data?.errors?.status ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {fetcher.data.errors.status}
        </p>
      ) : null}
    </fetcher.Form>
  );
}

function JobDescription({
  text,
  editHref,
}: {
  text: string;
  editHref: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.split("\n").length > 12 || text.length > 1200;
  if (!text.trim()) {
    return (
      <p className="text-sm text-ink-3">
        No job description yet.{" "}
        <Link to={editHref} className={textLinkClass}>
          Paste the posting
        </Link>{" "}
        so tailoring and matching have something to read.
      </p>
    );
  }
  return (
    <div>
      <div
        className={`relative max-w-[72ch] whitespace-pre-line text-[0.9375rem] leading-7 text-ink-2 ${
          long && !expanded ? "max-h-[21rem] overflow-hidden" : ""
        }`}
      >
        {text}
        {long && !expanded ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sheet to-transparent"
          />
        ) : null}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={`mt-2 text-sm ${textLinkClass}`}
        >
          {expanded ? "Show less" : "Show the full posting"}
        </button>
      ) : null}
    </div>
  );
}

function NotesEditor({ application }: { application: Application }) {
  const fetcher = useFetcher<{
    notesSaved?: true;
    errors?: Record<string, string>;
  }>();
  const [notes, setNotes] = useState(application.notes);
  const [saved, setSaved] = useState(application.notes);
  const submittedRef = useRef<string | null>(null);
  const submit = fetcher.submit;

  useEffect(() => {
    if (notes === saved || fetcher.state !== "idle") return;
    const timer = window.setTimeout(() => {
      submittedRef.current = notes;
      submit({ intent: "notes", notes }, { method: "post" });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [notes, saved, fetcher.state, submit]);

  useEffect(() => {
    if (fetcher.state !== "idle" || submittedRef.current === null) return;
    if (fetcher.data?.notesSaved) setSaved(submittedRef.current);
    submittedRef.current = null;
  }, [fetcher.state, fetcher.data]);

  const error = fetcher.data?.errors?.notes;
  const status =
    fetcher.state !== "idle"
      ? "Saving…"
      : error
        ? error
        : notes === saved
          ? "Saved"
          : "Unsaved";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="notes" />
      <label htmlFor="notes-editor" className="sr-only">
        Notes
      </label>
      <textarea
        id="notes-editor"
        name="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={10_000}
        placeholder="Recruiter contact, interview dates, follow-ups…"
        aria-describedby="notes-status"
        className={`${fieldClass} min-h-28 leading-6 [field-sizing:content]`}
      />
      <div className="mt-1.5 flex items-center gap-3 text-[0.8125rem]">
        <p
          id="notes-status"
          role="status"
          className={error ? "text-danger" : "text-ink-3"}
        >
          {status}
        </p>
        <noscript>
          <button type="submit" className={buttonClass({ size: "sm" })}>
            Save notes
          </button>
        </noscript>
      </div>
    </fetcher.Form>
  );
}

function DocumentsPanel({
  applicationId,
  documents,
  score,
}: {
  applicationId: string;
  documents: NonNullable<LoaderData["documents"]>;
  score: LoaderData["score"];
}) {
  const tailorPath = `/applications/${applicationId}/tailor`;
  const rows = [
    {
      label: "Tailored resume",
      id: documents.resumeId,
      edit: documents.resumeId ? `/resumes/${documents.resumeId}` : null,
      pdf: documents.resumeId ? `/resumes/${documents.resumeId}/pdf` : null,
    },
    {
      label: "Cover letter",
      id: documents.coverLetterId,
      edit: documents.coverLetterId
        ? `/cover-letters/${documents.coverLetterId}`
        : null,
      pdf: documents.coverLetterId
        ? `/cover-letters/${documents.coverLetterId}/pdf`
        : null,
    },
  ];
  return (
    <section
      aria-labelledby="documents-heading"
      className="rounded-sheet bg-sheet p-5 shadow-sheet"
    >
      <h2 id="documents-heading" className="text-sm font-semibold">
        Documents
      </h2>
      <div className="mt-3">
        {score ? (
          <FitBreakdown score={score} compact />
        ) : (
          <p className="text-sm text-ink-3">
            No analysis yet. Tailoring analyzes the job against your positions
            first.
          </p>
        )}
      </div>
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center gap-2 py-2.5 text-sm"
          >
            <span className={`flex-1 ${row.id ? "font-medium" : "text-ink-3"}`}>
              {row.label}
            </span>
            {row.edit && row.pdf ? (
              <>
                <Link to={row.edit} className={textLinkClass}>
                  Edit
                </Link>
                <a href={row.pdf} className={textLinkClass}>
                  PDF
                </a>
              </>
            ) : (
              <span className="text-[0.8125rem] text-ink-3">Not yet</span>
            )}
          </li>
        ))}
      </ul>
      <ButtonLink to={tailorPath} variant="primary" className="mt-4 w-full">
        {documents.resumeId ? "Tailor again" : "Tailor"}
      </ButtonLink>
    </section>
  );
}

export default function ApplicationDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    application,
    editing,
    justSaved,
    score,
    initialStatus,
    documents,
    tailored,
    jobMatch,
    hasAnalysis,
    jevConfigured,
    positions,
  } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData && actionData.errors
      ? actionData.errors
      : {};
  const matched = Boolean(actionData && "matched" in actionData);
  const reviewed = Boolean(actionData && "reviewed" in actionData);
  useToast(
    justSaved
      ? "Application saved."
      : tailored
        ? "Tailored resume and cover letter saved."
        : null,
    `${justSaved}-${tailored}-${application?.updatedAt.toString()}`,
  );
  useToast(
    matched ? "Job match updated." : reviewed ? "Review saved." : null,
    actionData,
  );
  // Drop one-shot flags so a reload does not repeat the confirmation.
  useEffect(() => {
    if (!justSaved && !tailored) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.searchParams.delete("tailored");
    window.history.replaceState(window.history.state, "", url);
  }, [justSaved, tailored]);

  if (!application) {
    return (
      <main id="main" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6">
        <Sheet className="rounded-t-none">
          <PageHeader
            title="New application"
            back={
              <Link to="/applications" className={textLinkClass}>
                ← Applications
              </Link>
            }
          />
          <DetailsForm
            application={null}
            initialStatus={initialStatus}
            errors={errors}
          />
        </Sheet>
      </main>
    );
  }

  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
    application.salaryPeriod,
  );
  const editHref = `/applications/${application.id}?edit=1`;
  const label = `${application.position} at ${application.companyName}`;
  const posting: ReactNode =
    application.source === "linkedin" ? (
      <span className="inline-flex items-center gap-2">
        <LinkedInBadge />
        <LinkedInPostingLink
          externalId={application.externalId}
          label={label}
          className={textLinkClass}
        >
          View on LinkedIn
        </LinkedInPostingLink>
      </span>
    ) : application.sourceUrl ? (
      <a
        href={application.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 ${textLinkClass}`}
      >
        Open posting
        <ExternalLink aria-hidden="true" className="size-3.5" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      "—"
    );
  const details: [string, ReactNode][] = [
    ["Company", application.companyName],
    ["Location", application.location || "—"],
    ["Salary", salary ?? "—"],
    [
      "Applied on",
      application.appliedAt
        ? appliedDateFormat.format(
            new Date(`${application.appliedAt}T00:00:00Z`),
          )
        : "—",
    ],
    ["Posting", posting],
  ];

  return (
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <Sheet className="rounded-t-none">
        <PageHeader
          back={
            <Link to="/applications" className={textLinkClass}>
              ← Applications
            </Link>
          }
          title={application.position}
          meta={
            <>
              <span>{application.companyName}</span>
              {application.location ? (
                <span>{application.location}</span>
              ) : null}
            </>
          }
          actions={
            <>
              <StatusSwitcher application={application} />
              <ButtonLink
                to={`/applications/${application.id}/tailor`}
                variant="primary"
              >
                Tailor
              </ButtonLink>
              <Popover
                id="application-menu"
                align="end"
                triggerLabel="More actions"
                triggerClassName={buttonClass({ variant: "ghost" })}
                trigger={
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                }
              >
                <Link to={editHref} className={popoverItemClass}>
                  <Pencil aria-hidden="true" className="size-4 text-ink-3" />
                  Edit details
                </Link>
                <button
                  type="button"
                  onClick={() => openDialog("delete-application")}
                  className={`${popoverItemClass} text-danger`}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete application
                </button>
              </Popover>
            </>
          }
        />

        {editing ? (
          <DetailsForm
            application={application}
            initialStatus={initialStatus}
            errors={errors}
          />
        ) : (
          <>
            <SheetSection
              title="Details"
              id="details-heading"
              actions={
                <ButtonLink to={editHref} variant="ghost" size="sm">
                  <Pencil aria-hidden="true" className="size-3.5" />
                  Edit
                </ButtonLink>
              }
            >
              <dl className="grid max-w-3xl grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.9375rem]">
                {details.map(([term, value]) => (
                  <div key={term} className="contents">
                    <dt className="text-[0.8125rem] leading-6 text-ink-3">
                      {term}
                    </dt>
                    <dd className="tabular min-w-0 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </SheetSection>
            <SheetSection
              title="Job description"
              id="jd-read-heading"
              actions={
                <ButtonLink to={editHref} variant="ghost" size="sm">
                  <Pencil aria-hidden="true" className="size-3.5" />
                  Edit
                </ButtonLink>
              }
            >
              <JobDescription
                text={application.jobDescription}
                editHref={editHref}
              />
            </SheetSection>
            <SheetSection title="Notes" id="notes-heading">
              <NotesEditor
                key={application.updatedAt.toString()}
                application={application}
              />
            </SheetSection>
            <SheetSection>
              <JobMatchPanel
                applicationId={application.id}
                match={jobMatch}
                configured={jevConfigured}
                hasAnalysis={hasAnalysis}
                positions={positions}
                error={errors.match}
              />
            </SheetSection>
          </>
        )}
      </Sheet>

      <aside className="space-y-4 lg:pt-6">
        {documents ? (
          <DocumentsPanel
            applicationId={application.id}
            documents={documents}
            score={score}
          />
        ) : null}
        <div className="px-1">
          <ConfirmDialog
            dialogId="delete-application"
            hideTrigger
            triggerLabel="Delete application"
            title={`Delete ${label}?`}
            description="The application, its notes, and links to its tailored documents are removed permanently."
            confirmLabel="Delete application"
            fields={{ intent: "delete" }}
            error={errors.delete}
          />
        </div>
      </aside>
    </main>
  );
}
