import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  getLearningResources,
  type JobAnalysis,
  type ScoreBreakdown,
} from "../lib/analysis";
import type { MatchVerification } from "../lib/job-match";
import type { KeywordMatchResult } from "../lib/keyword-match";
import { FitBreakdown } from "./fit-breakdown";
import { textLinkClass } from "./ui/button";
import { SheetSection } from "./ui/sheet";
import { Stamp } from "./ui/stamp";

export type PositionLabel = {
  id: string;
  position: string;
  company: string;
  exhibit?: number | null;
};

/** Fit estimate with its factor breakdown, plus any actions below it. */
export function FitScore({
  score,
  children,
}: {
  score: ScoreBreakdown;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-sheet bg-sheet p-5 shadow-sheet">
      <FitBreakdown score={score} />
      {children}
    </div>
  );
}

/** "Ex. 3" citation linking back to the contribution file it came from. */
export function ExhibitCitation({ position }: { position: PositionLabel }) {
  return (
    <Link
      to={`/contributions/${position.id}`}
      title={`${position.position} · ${position.company}`}
      className="inline-flex items-center gap-1.5 rounded-stamp bg-manila-tint px-1.5 py-0.5 text-[0.75rem] text-manila-ink hover:bg-manila/40"
    >
      {position.exhibit ? (
        <span className="text-[0.6875rem] font-bold tracking-[0.06em] uppercase">
          Ex. {position.exhibit}
        </span>
      ) : null}
      <span className="max-w-[16rem] truncate">{position.position}</span>
    </Link>
  );
}

function KeywordList({
  title,
  keywords,
  tone,
  empty,
  footer,
}: {
  title: string;
  keywords: string[];
  tone: "found" | "missing";
  empty: string;
  footer?: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title}{" "}
        <span className="tabular font-normal text-ink-3">
          {keywords.length}
        </span>
      </h3>
      {keywords.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <li
              key={keyword}
              className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] ${
                tone === "found"
                  ? "bg-ok-tint text-ok"
                  : "border border-dashed border-rule-strong text-ink-2"
              }`}
            >
              {keyword}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-ink-3">{empty}</p>
      )}
      {footer}
    </div>
  );
}

function KeywordSection({
  keywordMatch,
  positions,
}: {
  keywordMatch: KeywordMatchResult;
  positions: PositionLabel[];
}) {
  const matched = [
    ...new Set(keywordMatch.experiences.flatMap((row) => row.matchedKeywords)),
  ];
  const labels = new Map(positions.map((position) => [position.id, position]));
  const rows = [...keywordMatch.experiences].sort(
    (left, right) =>
      right.matchedKeywords.length +
      right.matchedRequiredSkills.length -
      (left.matchedKeywords.length + left.matchedRequiredSkills.length),
  );

  return (
    <>
      <SheetSection
        title="ATS keywords"
        id="keywords-heading"
        description="Exact terms from the posting, checked against your contribution files."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <KeywordList
            title="In your evidence"
            keywords={matched}
            tone="found"
            empty="None of the posting's keywords appear in your files yet."
          />
          <KeywordList
            title="Not found"
            keywords={keywordMatch.unmatchedKeywords}
            tone="missing"
            empty="Every keyword appears somewhere in your evidence."
            footer={
              keywordMatch.unmatchedKeywords.length ? (
                <p className="mt-3 text-[0.8125rem] text-ink-3">
                  If you have real experience with one of these,{" "}
                  <Link to="/contributions" className={textLinkClass}>
                    add it to the right contribution file
                  </Link>{" "}
                  and analyze again. Never add terms you cannot back up.
                </p>
              ) : null
            }
          />
        </div>
      </SheetSection>

      <SheetSection
        title="Matches by position"
        id="positions-heading"
        description="Which filed positions mention the posting's keywords and required skills."
      >
        {rows.length ? (
          <ul className="divide-y divide-rule border-y border-rule">
            {rows.map((row) => {
              const label = labels.get(row.experienceId);
              const total =
                row.matchedKeywords.length + row.matchedRequiredSkills.length;
              return (
                <li key={row.experienceId}>
                  <details className="group/row">
                    <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-open/row:rotate-90"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {label?.position ?? "Position"}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-ink-3">
                          {label?.company}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-right text-[0.8125rem] text-ink-2">
                        {row.matchedKeywords.length} keywords ·{" "}
                        {row.matchedRequiredSkills.length} required
                      </span>
                      {total === 0 ? (
                        <span className="sr-only">No matches</span>
                      ) : null}
                    </summary>
                    <dl className="grid gap-3 pb-4 pl-7 text-[0.8125rem] sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-3">Keywords</dt>
                        <dd className="mt-0.5 text-ink">
                          {row.matchedKeywords.join(", ") || "None"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-3">Required skills</dt>
                        <dd className="mt-0.5 text-ink">
                          {row.matchedRequiredSkills.join(", ") || "None"}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">
            No positions to compare.{" "}
            <Link to="/contributions/new" className={textLinkClass}>
              Add a position
            </Link>
            .
          </p>
        )}
      </SheetSection>
    </>
  );
}

export function AnalysisSummary({
  analysis,
  keywordMatch,
  positions = [],
  matchVerification,
}: {
  analysis: JobAnalysis;
  score?: ScoreBreakdown;
  keywordMatch?: KeywordMatchResult;
  positions?: PositionLabel[];
  matchVerification?: MatchVerification[];
}) {
  const labels = new Map(positions.map((position) => [position.id, position]));
  const gaps = analysis.missingSkills.map((skill) => ({
    skill,
    resources: getLearningResources(skill),
  }));

  return (
    <>
      {keywordMatch ? (
        <KeywordSection keywordMatch={keywordMatch} positions={positions} />
      ) : null}

      <SheetSection
        title="Evidence matches"
        id="evidence-heading"
        description={
          matchVerification
            ? "Job match checked these. Only verified matches are used to write documents."
            : "Requirements paired with the evidence that supports them. Each cites its exhibit."
        }
      >
        {analysis.matches.length ? (
          <ol className="divide-y divide-rule border-y border-rule">
            {analysis.matches.map((match, index) => {
              const verification = matchVerification?.[index];
              return (
                <li
                  key={`${match.requirement}:${match.experienceIds.join(":")}:${match.evidence}`}
                  className="py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <h3 className="min-w-0 flex-1 text-[0.9375rem] font-medium">
                      {match.requirement}
                    </h3>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {verification ? (
                        <Stamp
                          tone={verification === "verified" ? "ok" : "warn"}
                        >
                          {verification === "verified"
                            ? "Verified"
                            : "Unverified, excluded"}
                        </Stamp>
                      ) : null}
                      <Stamp
                        tone={match.strength === "strong" ? "ok" : "neutral"}
                      >
                        {match.strength}
                      </Stamp>
                    </div>
                  </div>
                  <p className="mt-1.5 max-w-[72ch] font-serif text-[0.9375rem] leading-6 text-ink-2">
                    {match.evidence}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {match.experienceIds.map((id) => {
                      const position = labels.get(id);
                      return position ? (
                        <ExhibitCitation key={id} position={position} />
                      ) : null;
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-ink-3">
            No supported matches found. Add more detailed experience evidence
            before generating.
          </p>
        )}
      </SheetSection>

      <SheetSection
        title="Gaps"
        id="gaps-heading"
        description="Required skills your evidence does not show. Learning links come from an allowlist."
      >
        {gaps.length ? (
          <ul className="divide-y divide-rule border-y border-rule">
            {gaps.map(({ skill, resources }) => (
              <li
                key={skill}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
              >
                <span className="min-w-40 flex-1 text-sm font-medium">
                  {skill}
                </span>
                <span className="flex flex-wrap gap-3 text-[0.8125rem]">
                  {resources.map((resource) => (
                    <a
                      key={resource.label}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className={textLinkClass}
                    >
                      Learn on {resource.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ok">
            No explicit required-skill gaps found.
          </p>
        )}
      </SheetSection>
    </>
  );
}
