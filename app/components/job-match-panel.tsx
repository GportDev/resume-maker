import { Form, Link, useNavigation } from "react-router";
import {
  effectiveStatus,
  type JobMatchResult,
  matchWeights,
  type RequirementDecision,
  type RequirementStatus,
} from "../lib/job-match";
import type { PositionLabel } from "./analysis-summary";
import { MatchBadge } from "./application-card";

export type JobMatchView = {
  id: string;
  createdAt: Date | string;
  modelVersion: string;
  stale: boolean;
  result: JobMatchResult;
};

const seniorityLabels = [
  "Below the role's level",
  "Somewhat below the role's level",
  "At the role's level",
  "Above the role's level",
];

const domainFitLabels: Record<JobMatchResult["domainFit"]["fit"], string> = {
  yes: "Fits the role's domain",
  no: "Different domain",
  unclear: "Unclear",
};

const statusLabels: Record<RequirementStatus, string> = {
  verified: "Verified",
  missing: "Missing",
  needs_review: "Needs review",
};

const statusTone: Record<RequirementStatus, string> = {
  verified: "bg-emerald-950 text-emerald-300",
  missing: "bg-slate-800 text-slate-300",
  needs_review: "bg-amber-950 text-amber-300",
};

const smallButtonClass =
  "rounded-lg border border-slate-700 px-2.5 py-1 text-xs hover:border-cyan-400 disabled:opacity-60";

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function RequirementStatusCell({
  matchId,
  decision,
  overrides,
  busy,
}: {
  matchId: string;
  decision: RequirementDecision;
  overrides: JobMatchResult["overrides"];
  busy: boolean;
}) {
  const status = effectiveStatus(decision, overrides);
  const override = overrides[decision.id];
  const label = override
    ? override === "accept"
      ? "Accepted"
      : "Rejected"
    : statusLabels[status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded px-1.5 py-0.5 text-xs ${statusTone[status]}`}>
        {label}
      </span>
      {decision.status === "needs_review" ? (
        <Form method="post" className="flex gap-1.5">
          <input type="hidden" name="intent" value="match-override" />
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="requirementId" value={decision.id} />
          {override ? (
            <button
              type="submit"
              name="decision"
              value="clear"
              disabled={busy}
              aria-label={`Undo review of ${decision.text}`}
              className={smallButtonClass}
            >
              Undo
            </button>
          ) : (
            <>
              {decision.experienceId ? (
                <button
                  type="submit"
                  name="decision"
                  value="accept"
                  disabled={busy}
                  aria-label={`Accept match for ${decision.text}`}
                  className={smallButtonClass}
                >
                  Accept
                </button>
              ) : null}
              <button
                type="submit"
                name="decision"
                value="reject"
                disabled={busy}
                aria-label={`Reject match for ${decision.text}`}
                className={smallButtonClass}
              >
                Reject
              </button>
            </>
          )}
        </Form>
      ) : null}
    </div>
  );
}

export function JobMatchPanel({
  applicationId,
  match,
  configured,
  hasAnalysis,
  positions,
  error,
}: {
  applicationId: string;
  match: JobMatchView | null;
  configured: boolean;
  hasAnalysis: boolean;
  positions: PositionLabel[];
  error?: string;
}) {
  const navigation = useNavigation();
  const pendingIntent =
    navigation.state === "submitting"
      ? navigation.formData?.get("intent")
      : null;
  const busy = Boolean(pendingIntent);
  const labels = new Map(positions.map((position) => [position.id, position]));
  const result = match?.result;
  const seniorityLevel =
    result?.seniority.score != null
      ? seniorityLabels[
          Math.min(
            seniorityLabels.length - 1,
            Math.round(result.seniority.score),
          )
        ]
      : undefined;

  return (
    <section
      aria-labelledby="job-match-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="job-match-heading" className="text-xl font-semibold">
            Job match
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Checks which of your positions demonstrates each requirement.
          </p>
        </div>
        {configured && hasAnalysis ? (
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="run-match"
              disabled={busy}
              className="rounded-xl border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-950 disabled:opacity-60"
            >
              {pendingIntent === "run-match"
                ? "Running match…"
                : match
                  ? "Run match again"
                  : "Run match"}
            </button>
          </Form>
        ) : null}
      </div>

      {!configured ? (
        <p className="mt-4 text-sm text-slate-400">
          Job matching is not configured on this server. Tailoring still uses
          the analysis.
        </p>
      ) : !hasAnalysis ? (
        <p className="mt-4 text-sm text-slate-400">
          Analyze the job description first.{" "}
          <Link
            to={`/applications/${applicationId}/tailor`}
            className="font-medium text-cyan-400 hover:text-cyan-300"
          >
            Tailor this application
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {match && result ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-4xl font-semibold text-cyan-300">
                {result.matchScore}%
              </p>
              <div className="mt-1">
                <MatchBadge match={result} />
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Required</dt>
                <dd>
                  {result.points.required} / {matchWeights.required}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Preferred</dt>
                <dd>
                  {result.points.preferred} / {matchWeights.preferred}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Seniority</dt>
                <dd>
                  {result.points.seniority} / {matchWeights.seniority}
                </dd>
              </div>
            </dl>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-slate-500">Seniority:</dt>
                <dd>
                  {seniorityLevel ?? "Unclear"}
                  {result.seniority.needsReview ? (
                    <span className="text-amber-300"> (low confidence)</span>
                  ) : null}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Domain:</dt>
                <dd>
                  {domainFitLabels[result.domainFit.fit]} (
                  {percent(result.domainFit.probability)})
                </dd>
              </div>
            </dl>
          </div>

          {match.stale ? (
            <p className="text-sm text-amber-300">
              This match is for an earlier analysis. Run match again to update
              it.
            </p>
          ) : null}

          {result.requirements.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Requirement
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Position
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Probability
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {result.requirements.map((decision) => {
                    const position = decision.experienceId
                      ? labels.get(decision.experienceId)
                      : undefined;
                    return (
                      <tr key={decision.id} className="align-top">
                        <th scope="row" className="py-3 pr-4 font-medium">
                          {decision.text}
                          <span className="block text-xs font-normal text-slate-500">
                            {decision.kind === "required"
                              ? "Required"
                              : "Preferred"}
                          </span>
                        </th>
                        <td className="py-3 pr-4 text-slate-300">
                          {decision.status === "missing" || !position ? (
                            <span className="text-slate-500">None</span>
                          ) : (
                            <>
                              {position.position}
                              <span className="block text-xs text-slate-500">
                                {position.company}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {decision.status === "missing"
                            ? `${percent(decision.noneProbability)} none`
                            : percent(decision.probability)}
                        </td>
                        <td className="py-3">
                          <RequirementStatusCell
                            matchId={match.id}
                            decision={decision}
                            overrides={result.overrides}
                            busy={busy}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              The analysis listed no required or preferred skills.
            </p>
          )}

          <p className="text-xs leading-5 text-slate-500">
            Match score is a heuristic over your stored evidence, not a hiring
            probability. Matched {formatDateTime(match.createdAt)} UTC with{" "}
            {match.modelVersion}.
          </p>
        </div>
      ) : configured && hasAnalysis ? (
        <p className="mt-4 text-sm text-slate-500">No match yet.</p>
      ) : null}
    </section>
  );
}
