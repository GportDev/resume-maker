import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  type ApplicationCardData,
  type ApplicationStatus,
  applicationStatusLabels,
  formatSalaryRange,
} from "../lib/applications";

const statusTone: Record<ApplicationStatus, string> = {
  saved: "bg-slate-800 text-slate-300",
  applied: "bg-cyan-950 text-cyan-300",
  interviewing: "bg-violet-950 text-violet-300",
  offer: "bg-emerald-950 text-emerald-300",
  rejected: "bg-red-950 text-red-300",
  withdrawn: "bg-amber-950 text-amber-300",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusTone[status]}`}
    >
      {applicationStatusLabels[status]}
    </span>
  );
}

export function FitBadge({ score }: { score: number }) {
  return (
    <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-xs font-medium text-cyan-300">
      <span className="sr-only">Fit estimate </span>Fit {score}
    </span>
  );
}

const documentLinkClass =
  "rounded text-cyan-400 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400";

function DocumentLinks({ application }: { application: ApplicationCardData }) {
  const documents = application.documents;
  const label = `${application.position} at ${application.companyName}`;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <li>
        <Link
          to={`/applications/${application.id}/tailor`}
          aria-label={`Tailor ${label}`}
          className={documentLinkClass}
        >
          Tailor
        </Link>
      </li>
      {documents?.resumeId ? (
        <li>
          <Link
            to={`/resumes/${documents.resumeId}`}
            aria-label={`Resume for ${label}`}
            className={documentLinkClass}
          >
            Resume
          </Link>
        </li>
      ) : null}
      {documents?.coverLetterId ? (
        <li>
          <Link
            to={`/cover-letters/${documents.coverLetterId}`}
            aria-label={`Cover letter for ${label}`}
            className={documentLinkClass}
          >
            Cover letter
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

export function ApplicationCard({
  application,
  dragHandle,
  badges,
  actions,
}: {
  application: ApplicationCardData;
  dragHandle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
    application.salaryPeriod,
  );

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5">
            <Link
              to={`/applications/${application.id}`}
              className="hover:text-cyan-300"
            >
              {application.position}
            </Link>
          </h3>
          <p className="truncate text-sm text-slate-400">
            {application.companyName}
          </p>
        </div>
        {dragHandle}
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-slate-400">
        {application.location ? (
          <div className="flex gap-1">
            <dt className="sr-only">Location</dt>
            <dd className="truncate">{application.location}</dd>
          </div>
        ) : null}
        {salary ? (
          <div className="flex gap-1">
            <dt className="sr-only">Salary range</dt>
            <dd>{salary}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={application.status} />
        {application.source === "linkedin" ? (
          <span className="rounded bg-sky-950 px-1.5 py-0.5 text-xs text-sky-300">
            LinkedIn
          </span>
        ) : null}
        {application.documents?.fitScore != null ? (
          <FitBadge score={application.documents.fitScore} />
        ) : null}
        {badges}
      </div>
      <DocumentLinks application={application} />
      {actions ? <div className="mt-3">{actions}</div> : null}
    </article>
  );
}
