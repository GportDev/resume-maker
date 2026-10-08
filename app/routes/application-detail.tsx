import type { ReactNode } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { StatusBadge } from "../components/application-card";
import {
  type ApplicationDocuments,
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
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplicationDocumentSummaries,
  updateApplication,
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
      initialStatus: status,
      documents: null,
      tailored: false,
    };
  }
  const applicationId = requireApplicationId(params.applicationId);
  const [application, summaries] = await Promise.all([
    getApplication(user.id, applicationId),
    listApplicationDocumentSummaries(user.id, applicationId),
  ]);
  if (!application) throw notFound();
  return {
    application,
    initialStatus: application.status,
    documents: toApplicationDocuments(summaries.get(application.id)),
    tailored: new URL(request.url).searchParams.get("tailored") === "1",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const isNew = params.applicationId === "new";

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

  const updated = await updateApplication(
    user.id,
    requireApplicationId(params.applicationId),
    parsed.data,
  );
  if (!updated) throw notFound();
  return data({ saved: true as const });
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400";

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: boolean) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

function AsideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-slate-400">{children}</div>
    </section>
  );
}

const asideLinkClass = "font-medium text-cyan-400 hover:text-cyan-300";

function TailoredDocuments({
  applicationId,
  documents,
}: {
  applicationId: string;
  documents: ApplicationDocuments;
}) {
  const tailorPath = `/applications/${applicationId}/tailor`;
  return (
    <>
      <AsideSection title="Match">
        {documents.fitScore !== null ? (
          <p>
            <span className="text-3xl font-semibold text-cyan-300">
              {documents.fitScore}
            </span>{" "}
            / 100 fit estimate.{" "}
            <Link to={tailorPath} className={asideLinkClass}>
              View matches
            </Link>
          </p>
        ) : (
          <p className="text-slate-500">
            No analysis yet. Tailor this application to see which positions
            match the job.
          </p>
        )}
        <Link
          to={tailorPath}
          className="mt-4 inline-block rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Tailor
        </Link>
      </AsideSection>
      <AsideSection title="Tailored resume">
        {documents.resumeId ? (
          <p className="flex flex-wrap gap-3">
            <Link
              to={`/resumes/${documents.resumeId}`}
              className={asideLinkClass}
            >
              Edit resume
            </Link>
            <a
              href={`/resumes/${documents.resumeId}/pdf`}
              className={asideLinkClass}
            >
              Download PDF
            </a>
          </p>
        ) : (
          <p className="text-slate-500">No tailored resume yet.</p>
        )}
      </AsideSection>
      <AsideSection title="Cover letter">
        {documents.coverLetterId ? (
          <p className="flex flex-wrap gap-3">
            <Link
              to={`/cover-letters/${documents.coverLetterId}`}
              className={asideLinkClass}
            >
              Edit cover letter
            </Link>
            <a
              href={`/cover-letters/${documents.coverLetterId}/pdf`}
              className={asideLinkClass}
            >
              Download PDF
            </a>
          </p>
        ) : (
          <p className="text-slate-500">No cover letter yet.</p>
        )}
      </AsideSection>
    </>
  );
}

export default function ApplicationDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { application, initialStatus, documents, tailored } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};
  const saved = Boolean(actionData && "saved" in actionData);
  const navigation = useNavigation();
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";

  const currency = application?.salaryCurrency ?? "USD";
  const currencies = commonCurrencies.some((code) => code === currency)
    ? commonCurrencies
    : [currency, ...commonCurrencies];
  const salary = application
    ? formatSalaryRange(
        application.salaryMin,
        application.salaryMax,
        application.salaryCurrency,
        application.salaryPeriod,
      )
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to="/applications"
        className="text-sm text-cyan-400 hover:text-cyan-300"
      >
        ← Back to board
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            {application ? application.companyName : "Job application"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {application ? application.position : "New application"}
          </h1>
          {application ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <StatusBadge status={application.status} />
              {salary ? <span>{salary}</span> : null}
              {application.location ? (
                <span>{application.location}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <p role="status" className="text-sm text-emerald-300">
          {saved
            ? "Application saved."
            : tailored
              ? "Tailored resume and cover letter saved."
              : ""}
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Form
          key={application?.updatedAt.toString() ?? "new"}
          method="post"
          className="space-y-6"
        >
          <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:grid-cols-2">
            <h2 className="text-xl font-semibold sm:col-span-2">Role</h2>
            <Field id="companyName" label="Company" error={errors.companyName}>
              <input
                id="companyName"
                name="companyName"
                defaultValue={application?.companyName ?? ""}
                required
                maxLength={160}
                aria-invalid={errors.companyName ? true : undefined}
                aria-describedby={describedBy(
                  "companyName",
                  errors.companyName,
                )}
                className={inputClass}
              />
            </Field>
            <Field id="position" label="Position" error={errors.position}>
              <input
                id="position"
                name="position"
                defaultValue={application?.position ?? ""}
                required
                maxLength={160}
                aria-invalid={errors.position ? true : undefined}
                aria-describedby={describedBy("position", errors.position)}
                className={inputClass}
              />
            </Field>
            <Field id="location" label="Location" error={errors.location}>
              <input
                id="location"
                name="location"
                defaultValue={application?.location ?? ""}
                maxLength={160}
                placeholder="Remote, Lisbon, hybrid…"
                aria-describedby={describedBy("location", errors.location)}
                className={inputClass}
              />
            </Field>
            <Field
              id="sourceUrl"
              label="Job posting link"
              error={errors.sourceUrl}
            >
              <input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                defaultValue={application?.sourceUrl ?? ""}
                placeholder="https://"
                aria-invalid={errors.sourceUrl ? true : undefined}
                aria-describedby={describedBy("sourceUrl", errors.sourceUrl)}
                className={inputClass}
              />
            </Field>
            <Field id="status" label="Status" error={errors.status}>
              <select
                id="status"
                name="status"
                defaultValue={initialStatus}
                aria-describedby={describedBy("status", errors.status)}
                className={inputClass}
              >
                {applicationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {applicationStatusLabels[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="appliedAt" label="Applied on" error={errors.appliedAt}>
              <input
                id="appliedAt"
                name="appliedAt"
                type="date"
                defaultValue={application?.appliedAt ?? ""}
                aria-invalid={errors.appliedAt ? true : undefined}
                aria-describedby={describedBy("appliedAt", errors.appliedAt)}
                className={inputClass}
              />
            </Field>
          </section>

          <fieldset className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:grid-cols-4">
            <legend className="sr-only">Salary range</legend>
            <h2 className="text-xl font-semibold sm:col-span-4">
              Salary range
            </h2>
            <Field id="salaryMin" label="Minimum" error={errors.salaryMin}>
              <input
                id="salaryMin"
                name="salaryMin"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={application?.salaryMin ?? ""}
                aria-invalid={errors.salaryMin ? true : undefined}
                aria-describedby={describedBy("salaryMin", errors.salaryMin)}
                className={inputClass}
              />
            </Field>
            <Field id="salaryMax" label="Maximum" error={errors.salaryMax}>
              <input
                id="salaryMax"
                name="salaryMax"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={application?.salaryMax ?? ""}
                aria-invalid={errors.salaryMax ? true : undefined}
                aria-describedby={describedBy("salaryMax", errors.salaryMax)}
                className={inputClass}
              />
            </Field>
            <Field
              id="salaryCurrency"
              label="Currency"
              error={errors.salaryCurrency}
            >
              <select
                id="salaryCurrency"
                name="salaryCurrency"
                defaultValue={currency}
                aria-describedby={describedBy(
                  "salaryCurrency",
                  errors.salaryCurrency,
                )}
                className={inputClass}
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="salaryPeriod" label="Period" error={errors.salaryPeriod}>
              <select
                id="salaryPeriod"
                name="salaryPeriod"
                defaultValue={application?.salaryPeriod ?? "year"}
                aria-describedby={describedBy(
                  "salaryPeriod",
                  errors.salaryPeriod,
                )}
                className={inputClass}
              >
                {salaryPeriods.map((period) => (
                  <option key={period} value={period}>
                    {salaryPeriodLabels[period]}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>

          <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <Field
              id="jobDescription"
              label="Job description"
              error={errors.jobDescription}
              hint="Paste the full posting, including requirements. Tailoring and matching read this text."
            >
              <textarea
                id="jobDescription"
                name="jobDescription"
                rows={14}
                defaultValue={application?.jobDescription ?? ""}
                maxLength={50_000}
                aria-describedby={describedBy(
                  "jobDescription",
                  errors.jobDescription,
                  true,
                )}
                className={`${inputClass} font-mono text-sm leading-6`}
              />
            </Field>
            <Field id="notes" label="Notes" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={5}
                defaultValue={application?.notes ?? ""}
                maxLength={10_000}
                placeholder="Recruiter contact, interview dates, follow-ups…"
                aria-describedby={describedBy("notes", errors.notes)}
                className={`${inputClass} text-sm`}
              />
            </Field>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={isSaving}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {isSaving
                ? "Saving…"
                : application
                  ? "Save application"
                  : "Add application"}
            </button>
            <Link
              to="/applications"
              className="text-sm text-slate-400 hover:text-slate-100"
            >
              Cancel
            </Link>
            {errors.form ? (
              <p role="alert" className="text-sm text-red-300">
                {errors.form}
              </p>
            ) : null}
          </div>
        </Form>

        <aside className="space-y-4">
          {application && documents ? (
            <TailoredDocuments
              applicationId={application.id}
              documents={documents}
            />
          ) : (
            <AsideSection title="Tailoring">
              <p className="text-slate-500">
                Save the application first, then tailor a resume and cover
                letter to it.
              </p>
            </AsideSection>
          )}
          {application ? (
            <section className="rounded-2xl border border-red-950 bg-slate-900 p-5">
              <h2 className="font-semibold">Delete application</h2>
              <Form method="post" className="mt-3 space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="confirm"
                    value="yes"
                    required
                    className="mt-0.5 size-4 accent-red-400"
                  />
                  I understand this permanently deletes this application.
                </label>
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:border-red-600"
                >
                  Delete application
                </button>
                {errors.delete ? (
                  <p role="alert" className="text-sm text-red-300">
                    {errors.delete}
                  </p>
                ) : null}
              </Form>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
