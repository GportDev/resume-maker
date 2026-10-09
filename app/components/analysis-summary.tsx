import type { ReactNode } from "react";
import {
  getLearningResources,
  type JobAnalysis,
  type ScoreBreakdown,
} from "../lib/analysis";
import type { MatchVerification } from "../lib/job-match";
import type { KeywordMatchResult } from "../lib/keyword-match";

const factorLabels = {
  keywordCoverage: "Keyword coverage",
  requiredSkillCoverage: "Required skills",
  evidenceStrength: "Evidence strength",
  titleAlignment: "Title alignment",
  profileCompleteness: "Profile completeness",
} as const satisfies Record<Exclude<keyof ScoreBreakdown, "total">, string>;

const factorMaximums: Record<keyof typeof factorLabels, number> = {
  keywordCoverage: 25,
  requiredSkillCoverage: 35,
  evidenceStrength: 25,
  titleAlignment: 10,
  profileCompleteness: 5,
};

export type PositionLabel = { id: string; position: string; company: string };

export function FitScore({
  score,
  children,
}: {
  score: ScoreBreakdown;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm uppercase tracking-wider text-slate-500">
        Fit estimate
      </p>
      <p className="mt-2 text-6xl font-semibold text-cyan-300">{score.total}</p>
      <p className="text-sm text-slate-500">out of 100</p>
      <p className="mt-5 text-xs leading-5 text-slate-500">
        Heuristic based on your stored evidence. Not hiring probability or
        guarantee.
      </p>
      {children}
    </div>
  );
}

function Chip({ matched, children }: { matched: boolean; children: string }) {
  return (
    <li
      className={`rounded-full px-2.5 py-1 text-xs ${
        matched
          ? "bg-emerald-950 text-emerald-300"
          : "border border-dashed border-slate-700 text-slate-400"
      }`}
    >
      <span className="sr-only">{matched ? "Matched: " : "Not found: "}</span>
      {children}
    </li>
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

  return (
    <>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">ATS keywords</h2>
        <p className="mt-1 text-sm text-slate-500">
          {matched.length} found in your experience,{" "}
          {keywordMatch.unmatchedKeywords.length} not found.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {matched.map((keyword) => (
            <Chip key={`m:${keyword}`} matched>
              {keyword}
            </Chip>
          ))}
          {keywordMatch.unmatchedKeywords.map((keyword) => (
            <Chip key={`u:${keyword}`} matched={false}>
              {keyword}
            </Chip>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Matches by position</h2>
        {keywordMatch.experiences.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Position
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Keywords
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Required skills
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {keywordMatch.experiences.map((row) => {
                  const label = labels.get(row.experienceId);
                  return (
                    <tr key={row.experienceId} className="align-top">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {label?.position ?? "Position"}
                        <span className="block text-xs font-normal text-slate-500">
                          {label?.company}
                        </span>
                      </th>
                      <td className="py-3 pr-4 text-slate-300">
                        {row.matchedKeywords.join(", ") || (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-300">
                        {row.matchedRequiredSkills.join(", ") || (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No positions to compare. Add experience first.
          </p>
        )}
      </section>
    </>
  );
}

export function AnalysisSummary({
  analysis,
  score,
  keywordMatch,
  positions = [],
  matchVerification,
}: {
  analysis: JobAnalysis;
  score: ScoreBreakdown;
  keywordMatch?: KeywordMatchResult;
  positions?: PositionLabel[];
  matchVerification?: MatchVerification[];
}) {
  const gaps = analysis.missingSkills.map((skill) => ({
    skill,
    resources: getLearningResources(skill),
  }));

  return (
    <div className="space-y-8">
      <section
        aria-label="Score factors"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {Object.entries(factorLabels).map(([key, label]) => {
          const factor = key as keyof typeof factorLabels;
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {score[factor]}
                <span className="text-sm font-normal text-slate-500">
                  {" "}
                  / {factorMaximums[factor]}
                </span>
              </p>
            </div>
          );
        })}
      </section>

      {keywordMatch ? (
        <KeywordSection keywordMatch={keywordMatch} positions={positions} />
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Evidence matches</h2>
        {matchVerification ? (
          <p className="mt-1 text-sm text-slate-500">
            Job match checked these. Only verified matches are used to write
            documents.
          </p>
        ) : null}
        <div className="mt-5 space-y-4">
          {analysis.matches.map((match, index) => {
            const verification = matchVerification?.[index];
            return (
              <article
                key={`${match.requirement}:${match.experienceIds.join(":")}:${match.evidence}`}
                className="rounded-xl bg-slate-950 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium">{match.requirement}</h3>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {verification ? (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          verification === "verified"
                            ? "bg-cyan-950 text-cyan-300"
                            : "border border-dashed border-amber-700 text-amber-300"
                        }`}
                      >
                        {verification === "verified"
                          ? "Verified"
                          : "Unverified, excluded"}
                      </span>
                    ) : null}
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
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {match.evidence}
                </p>
              </article>
            );
          })}
          {!analysis.matches.length ? (
            <p className="text-sm text-slate-500">
              No supported matches found. Add more detailed experience evidence
              before generating.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Missing skills and keywords</h2>
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
  );
}
