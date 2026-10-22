import type { ScoreBreakdown } from "../lib/analysis";

export const factorLabels = {
  requiredSkillCoverage: "Required skills",
  keywordCoverage: "Keyword coverage",
  evidenceStrength: "Evidence strength",
  titleAlignment: "Title alignment",
  profileCompleteness: "Profile completeness",
} as const satisfies Record<Exclude<keyof ScoreBreakdown, "total">, string>;

export type ScoreFactor = keyof typeof factorLabels;

export const factorMaximums: Record<ScoreFactor, number> = {
  requiredSkillCoverage: 35,
  keywordCoverage: 25,
  evidenceStrength: 25,
  titleAlignment: 10,
  profileCompleteness: 5,
};

const factors = Object.keys(factorLabels) as ScoreFactor[];

/**
 * The fit estimate as one ledger line: each factor owns a slot sized by its
 * maximum, filled by the points it earned. The total is the sum of fills.
 */
export function FitBreakdown({
  score,
  compact = false,
}: {
  score: ScoreBreakdown;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="tabular text-[2rem] leading-none font-bold tracking-[-0.02em]">
          {score.total}
        </span>
        <span className="text-sm text-ink-3">/ 100 fit estimate</span>
      </p>
      <div
        role="img"
        aria-label={`Fit ${score.total} of 100: ${factors
          .map(
            (factor) =>
              `${factorLabels[factor]} ${score[factor]} of ${factorMaximums[factor]}`,
          )
          .join(", ")}.`}
        className="mt-3 flex h-2.5 gap-[3px]"
      >
        {factors.map((factor) => (
          <span
            key={factor}
            style={{ flexGrow: factorMaximums[factor] }}
            className="relative basis-0 overflow-hidden rounded-[1px] bg-rule"
          >
            <span
              style={{
                width: `${(score[factor] / factorMaximums[factor]) * 100}%`,
              }}
              className="absolute inset-y-0 left-0 bg-exhibit"
            />
          </span>
        ))}
      </div>
      {compact ? null : (
        <dl className="mt-3 space-y-1 text-[0.8125rem]">
          {factors.map((factor) => (
            <div key={factor} className="flex items-baseline gap-2">
              <dt className="flex-1 text-ink-2">{factorLabels[factor]}</dt>
              <dd className="tabular text-ink">
                {score[factor]}
                <span className="text-ink-3"> / {factorMaximums[factor]}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs leading-5 text-ink-3">
        Heuristic based on your stored evidence. Not a hiring probability or
        guarantee.
      </p>
    </div>
  );
}
