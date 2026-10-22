import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  type ApplicationCardData,
  type ApplicationStatus,
  applicationStatusLabels,
  formatSalaryRange,
} from "../lib/applications";
import { linkedInJobUrlOrNull } from "../lib/job-listings";
import {
  type JobMatchSummary,
  type MatchRecommendation,
  matchRecommendationLabels,
} from "../lib/job-match";
import { Stamp, type StampTone } from "./ui/stamp";

export const statusStampTone: Record<ApplicationStatus, StampTone> = {
  saved: "manila",
  applied: "exhibit",
  interviewing: "violet",
  offer: "ok",
  rejected: "danger",
  withdrawn: "neutral",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Stamp tone={statusStampTone[status]}>
      {applicationStatusLabels[status]}
    </Stamp>
  );
}

export function FitBadge({ score }: { score: number }) {
  return (
    <span className="tabular inline-flex items-baseline gap-1 text-[0.8125rem] text-ink-2">
      <span className="sr-only">Fit estimate </span>
      <span
        aria-hidden="true"
        className="text-[0.6875rem] font-semibold text-ink-3 uppercase tracking-[0.06em]"
      >
        Fit
      </span>
      <span className="font-semibold text-ink">{score}</span>
    </span>
  );
}

const recommendationTone: Record<MatchRecommendation, StampTone> = {
  strong_match: "ok",
  worth_tailoring: "exhibit",
  weak_match: "neutral",
  needs_review: "warn",
};

export function MatchBadge({ match }: { match: JobMatchSummary }) {
  return (
    <Stamp tone={recommendationTone[match.recommendation]}>
      <span className="sr-only">Job match: </span>
      {matchRecommendationLabels[match.recommendation]} · {match.matchScore}%
    </Stamp>
  );
}

const documentLinkClass =
  "rounded text-exhibit hover:text-exhibit-deep focus-visible:outline-2 focus-visible:outline-exhibit";

export function LinkedInBadge() {
  return <Stamp tone="neutral">LinkedIn</Stamp>;
}

export function LinkedInPostingLink({
  externalId,
  label,
  className = documentLinkClass,
  children = "LinkedIn posting",
}: {
  externalId: string | null | undefined;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const href = linkedInJobUrlOrNull(externalId);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`LinkedIn posting for ${label} (opens in a new tab)`}
      className={className}
    >
      {children}
    </a>
  );
}

function DocumentLinks({ application }: { application: ApplicationCardData }) {
  const documents = application.documents;
  const label = `${application.position} at ${application.companyName}`;
  const postingLink =
    application.source === "linkedin" ? (
      <LinkedInPostingLink externalId={application.externalId} label={label} />
    ) : null;
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
      {postingLink ? <li>{postingLink}</li> : null}
    </ul>
  );
}

export function ApplicationCard({
  application,
  dragHandle,
  menu,
  badges,
  actions,
  showStatus = true,
}: {
  application: ApplicationCardData;
  dragHandle?: ReactNode;
  menu?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
    application.salaryPeriod,
  );
  const meta = [application.location, salary].filter(Boolean);
  const hasBadges =
    showStatus ||
    application.source === "linkedin" ||
    application.documents?.fitScore != null ||
    Boolean(application.documents?.match) ||
    Boolean(badges);

  return (
    <article className="rounded-sheet bg-sheet p-3 shadow-sheet">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-sm font-semibold leading-5">
            <Link
              to={`/applications/${application.id}`}
              className="hover:text-exhibit"
            >
              {application.position}
            </Link>
          </h3>
          <p className="truncate text-[0.8125rem] text-ink-2">
            {application.companyName}
          </p>
        </div>
        {menu}
        {dragHandle}
      </div>
      {meta.length ? (
        <p className="tabular mt-1.5 truncate text-xs text-ink-3">
          <span className="sr-only">Location and salary: </span>
          {meta.join(" · ")}
        </p>
      ) : null}
      {hasBadges ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showStatus ? <StatusBadge status={application.status} /> : null}
          {application.documents?.match ? (
            <MatchBadge match={application.documents.match} />
          ) : null}
          {application.documents?.fitScore != null ? (
            <FitBadge score={application.documents.fitScore} />
          ) : null}
          {application.source === "linkedin" ? <LinkedInBadge /> : null}
          {badges}
        </div>
      ) : null}
      <DocumentLinks application={application} />
      {actions}
    </article>
  );
}
