import { z } from "zod";

import { type JobAnalysis, normalize } from "./analysis";

export const QUESTION_VERSION = "2026-10-08";

export const verifiedProbabilityThreshold = 0.7;
export const verifiedConfidenceThreshold = 0.6;
export const missingProbabilityThreshold = 0.7;
export const domainFitThreshold = 0.7;
export const matchWeights = { required: 70, preferred: 15, seniority: 15 };
export const strongMatchThreshold = 75;
export const worthTailoringThreshold = 50;

export const maxChoiceOptions = 255;
export const stateTokenLimit = 32_000;
export const questionTokenReserve = 4_000;
export const noneOption = "none";
export const seniorityQuestionId = "seniority";
export const domainFitQuestionId = "domainFit";

export const seniorityLevels = [
  "Clearly below the level this role asks for",
  "Somewhat below the level this role asks for",
  "At the level this role asks for",
  "Above the level this role asks for",
];
const seniorityTargetLevel = 2;
const evidenceSummaryLength = 160;

export type MatchState = string | string[] | Record<string, unknown>;

export type MatchQuestion =
  | {
      type: "choice";
      instructions: string;
      criteria: Record<string, string>;
    }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "boolean"; instructions: string };

const probability = z.number().min(0).max(1);

export const matchAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    choice: z.string().min(1),
    probabilities: z.record(z.string(), probability),
    confidence: probability.nullable(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number().min(0),
    confidence: probability.nullable(),
  }),
  z.object({ type: z.literal("boolean"), probability }),
]);

export type MatchAnswer = z.infer<typeof matchAnswerSchema>;
export type MatchAnswers = Record<string, MatchAnswer>;

export type MatchExperience = {
  id: string;
  position: string;
  company: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  markdown: string;
};

export const requirementKinds = ["required", "preferred"] as const;
export type RequirementKind = (typeof requirementKinds)[number];

export type MatchRequirement = {
  id: string;
  kind: RequirementKind;
  text: string;
};

export function listMatchRequirements(
  analysis: Pick<JobAnalysis, "requiredSkills" | "preferredSkills">,
): MatchRequirement[] {
  return [
    ...analysis.requiredSkills.map((text, index) => ({
      id: `req_${index}`,
      kind: "required" as const,
      text,
    })),
    ...analysis.preferredSkills.map((text, index) => ({
      id: `pref_${index}`,
      kind: "preferred" as const,
      text,
    })),
  ];
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function summarizeEvidence(markdown: string): string {
  const text = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > evidenceSummaryLength
    ? `${text.slice(0, evidenceSummaryLength - 1).trimEnd()}…`
    : text;
}

function experienceOption(experience: MatchExperience): string {
  const summary = summarizeEvidence(experience.markdown);
  const label = `${experience.position} at ${experience.company}`;
  return summary ? `${label}: ${summary}` : label;
}

export function buildMatchQuestions(
  analysis: Pick<
    JobAnalysis,
    | "jobTitle"
    | "companyName"
    | "seniority"
    | "requiredSkills"
    | "preferredSkills"
    | "responsibilities"
  >,
  experiences: MatchExperience[],
): Record<string, MatchQuestion> {
  if (!experiences.length) {
    throw new RangeError("Matching needs at least one experience.");
  }
  if (experiences.length > maxChoiceOptions - 1) {
    throw new RangeError(
      `Choice questions allow ${maxChoiceOptions} options; chunk experiences first.`,
    );
  }

  const criteria: Record<string, string> = Object.fromEntries(
    experiences.map((experience) => [
      experience.id,
      experienceOption(experience),
    ]),
  );
  criteria[noneOption] = "No listed experience demonstrates this";

  const role = analysis.companyName
    ? `${analysis.jobTitle} at ${analysis.companyName}`
    : analysis.jobTitle;
  const questions: Record<string, MatchQuestion> = {};
  for (const requirement of listMatchRequirements(analysis)) {
    questions[requirement.id] = {
      type: "choice",
      instructions: `Which listed experience best demonstrates this ${requirement.kind} skill for the ${role} role: "${requirement.text}"? Choose an experience only if its evidence shows the skill; otherwise choose none.`,
      criteria,
    };
  }
  questions[seniorityQuestionId] = {
    type: "score",
    instructions: `Rate the seniority the candidate's experience demonstrates against the ${role} role${analysis.seniority ? ` (${analysis.seniority} level)` : ""}.`,
    criteria: seniorityLevels,
  };
  const responsibilities = analysis.responsibilities.slice(0, 8).join("; ");
  questions[domainFitQuestionId] = {
    type: "boolean",
    instructions: `Does the candidate's experience come from a domain that fits the ${role} role${responsibilities ? `, whose responsibilities are: ${responsibilities}` : ""}?`,
  };
  return questions;
}

function describePeriod(experience: MatchExperience): string {
  const end = experience.isCurrent ? "present" : (experience.endDate ?? "");
  return `${experience.startDate} to ${end}`.trim();
}

export function buildMatchState(experiences: MatchExperience[]): {
  experiences: {
    id: string;
    position: string;
    company: string;
    period: string;
    evidence: string;
  }[];
} {
  return {
    experiences: experiences.map((experience) => ({
      id: experience.id,
      position: experience.position,
      company: experience.company,
      period: describePeriod(experience),
      evidence: experience.markdown,
    })),
  };
}

export function chunkExperiences<Experience extends MatchExperience>(
  experiences: Experience[],
  options: { tokenBudget?: number; maxPerChunk?: number } = {},
): Experience[][] {
  const tokenBudget =
    options.tokenBudget ?? stateTokenLimit - questionTokenReserve;
  const maxPerChunk = options.maxPerChunk ?? maxChoiceOptions - 1;
  const chunks: Experience[][] = [];
  let current: Experience[] = [];
  let currentTokens = 0;
  for (const experience of experiences) {
    const tokens = estimateTokens(
      JSON.stringify(buildMatchState([experience])),
    );
    if (
      current.length &&
      (currentTokens + tokens > tokenBudget || current.length >= maxPerChunk)
    ) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(experience);
    currentTokens += tokens;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

type ChoiceAnswer = Extract<MatchAnswer, { type: "choice" }>;

function bestOption(
  probabilities: Record<string, number>,
): { option: string; probability: number } | null {
  let best: { option: string; probability: number } | null = null;
  for (const [option, value] of Object.entries(probabilities)) {
    if (option === noneOption) continue;
    if (!best || value > best.probability)
      best = { option, probability: value };
  }
  return best;
}

function noneProbability(answer: ChoiceAnswer): number | null {
  if (Object.hasOwn(answer.probabilities, noneOption)) {
    return answer.probabilities[noneOption] ?? null;
  }
  return answer.choice === noneOption ? answer.confidence : null;
}

function mergeChoiceAnswers(answers: ChoiceAnswer[]): ChoiceAnswer {
  const probabilities: Record<string, number> = {};
  const owner = new Map<string, ChoiceAnswer>();
  const noneValues: number[] = [];
  for (const answer of answers) {
    for (const [option, value] of Object.entries(answer.probabilities)) {
      if (option === noneOption) continue;
      if (value > (probabilities[option] ?? -1)) {
        probabilities[option] = value;
        owner.set(option, answer);
      }
    }
    const none = noneProbability(answer);
    if (none !== null) noneValues.push(none);
  }
  const best = bestOption(probabilities);
  const none = noneValues.length ? Math.min(...noneValues) : null;
  if (none !== null) probabilities[noneOption] = none;

  if (best && (none === null || best.probability >= none)) {
    return {
      type: "choice",
      choice: best.option,
      probabilities,
      confidence: owner.get(best.option)?.confidence ?? null,
    };
  }
  const confidences = answers.map((answer) => answer.confidence);
  return {
    type: "choice",
    choice: noneOption,
    probabilities,
    confidence: confidences.some((value) => value === null)
      ? null
      : Math.min(...confidences.filter((value) => value !== null)),
  };
}

export function mergeChunkAnswers(chunks: MatchAnswers[]): MatchAnswers {
  const [first, ...rest] = chunks;
  if (!first) return {};
  if (!rest.length) return first;

  const ids = new Set(chunks.flatMap((chunk) => Object.keys(chunk)));
  const merged: MatchAnswers = {};
  for (const id of ids) {
    const answers = chunks
      .map((chunk) => chunk[id])
      .filter((answer) => answer !== undefined);
    const type = answers[0]?.type;
    if (type === "choice") {
      merged[id] = mergeChoiceAnswers(
        answers.filter((answer) => answer.type === "choice"),
      );
    } else if (type === "score") {
      const scores = answers.filter((answer) => answer.type === "score");
      merged[id] = scores.reduce((best, answer) =>
        answer.score > best.score ? answer : best,
      );
    } else if (type === "boolean") {
      const booleans = answers.filter((answer) => answer.type === "boolean");
      merged[id] = booleans.reduce((best, answer) =>
        answer.probability > best.probability ? answer : best,
      );
    }
  }
  return merged;
}

export const requirementStatuses = [
  "verified",
  "missing",
  "needs_review",
] as const;
export type RequirementStatus = (typeof requirementStatuses)[number];

export const matchOverrides = ["accept", "reject"] as const;
export type MatchOverride = (typeof matchOverrides)[number];

export const matchRecommendations = [
  "strong_match",
  "worth_tailoring",
  "weak_match",
  "needs_review",
] as const;
export type MatchRecommendation = (typeof matchRecommendations)[number];

export const matchRecommendationLabels: Record<MatchRecommendation, string> = {
  strong_match: "Strong match",
  worth_tailoring: "Worth tailoring",
  weak_match: "Weak match",
  needs_review: "Needs review",
};

const nullableProbability = probability.nullable();

const requirementDecisionSchema = z.object({
  id: z.string().regex(/^(req|pref)_\d+$/),
  kind: z.enum(requirementKinds),
  text: z.string().min(1),
  status: z.enum(requirementStatuses),
  experienceId: z.string().nullable(),
  probability: nullableProbability,
  noneProbability: nullableProbability,
  confidence: nullableProbability,
});

export type RequirementDecision = z.infer<typeof requirementDecisionSchema>;

const seniorityDecisionSchema = z.object({
  score: z.number().min(0).nullable(),
  confidence: nullableProbability,
  needsReview: z.boolean(),
});

const domainFitDecisionSchema = z.object({
  probability: nullableProbability,
  fit: z.enum(["yes", "no", "unclear"]),
});

export const jobMatchResultSchema = z.object({
  questionVersion: z.string().min(1),
  requirements: z.array(requirementDecisionSchema),
  seniority: seniorityDecisionSchema,
  domainFit: domainFitDecisionSchema,
  overrides: z.record(z.string(), z.enum(matchOverrides)).default({}),
  points: z.object({
    required: z.number().int().min(0).max(matchWeights.required),
    preferred: z.number().int().min(0).max(matchWeights.preferred),
    seniority: z.number().int().min(0).max(matchWeights.seniority),
  }),
  matchScore: z.number().int().min(0).max(100),
  recommendation: z.enum(matchRecommendations),
});

export type JobMatchResult = z.infer<typeof jobMatchResultSchema>;
type MatchEvaluation = Pick<
  JobMatchResult,
  "requirements" | "seniority" | "domainFit"
>;

function decideRequirement(
  requirement: MatchRequirement,
  answer: MatchAnswer | undefined,
): RequirementDecision {
  const base = {
    ...requirement,
    experienceId: null,
    probability: null,
    noneProbability: null,
    confidence: null,
  };
  if (answer?.type !== "choice") {
    return { ...base, status: "needs_review" };
  }

  const best = bestOption(answer.probabilities);
  const none = noneProbability(answer);
  const chosen =
    answer.choice === noneOption
      ? best
      : {
          option: answer.choice,
          probability: answer.probabilities[answer.choice] ?? null,
        };
  const decision = {
    ...base,
    experienceId: chosen?.option ?? null,
    probability: chosen?.probability ?? null,
    noneProbability: none,
    confidence: answer.confidence,
  };

  if (
    answer.choice !== noneOption &&
    decision.probability !== null &&
    decision.confidence !== null &&
    decision.probability >= verifiedProbabilityThreshold &&
    decision.confidence >= verifiedConfidenceThreshold
  ) {
    return { ...decision, status: "verified" };
  }
  if (none !== null && none >= missingProbabilityThreshold) {
    return { ...decision, status: "missing" };
  }
  return { ...decision, status: "needs_review" };
}

function decideSeniority(
  answer: MatchAnswer | undefined,
): JobMatchResult["seniority"] {
  if (answer?.type !== "score") {
    return { score: null, confidence: null, needsReview: true };
  }
  return {
    score: answer.score,
    confidence: answer.confidence,
    needsReview:
      answer.confidence === null ||
      answer.confidence < verifiedConfidenceThreshold,
  };
}

function decideDomainFit(
  answer: MatchAnswer | undefined,
): JobMatchResult["domainFit"] {
  if (answer?.type !== "boolean") {
    return { probability: null, fit: "unclear" };
  }
  const fit =
    answer.probability >= domainFitThreshold
      ? "yes"
      : answer.probability <= 1 - domainFitThreshold
        ? "no"
        : "unclear";
  return { probability: answer.probability, fit };
}

export function effectiveStatus(
  decision: RequirementDecision,
  overrides: Record<string, MatchOverride>,
): RequirementStatus {
  if (decision.status !== "needs_review") return decision.status;
  const override = overrides[decision.id];
  if (override === "accept" && decision.experienceId) return "verified";
  if (override === "reject") return "missing";
  return "needs_review";
}

function coverage(
  decisions: RequirementDecision[],
  overrides: Record<string, MatchOverride>,
  weight: number,
): number {
  if (!decisions.length) return weight;
  const verified = decisions.filter(
    (decision) => effectiveStatus(decision, overrides) === "verified",
  ).length;
  return Math.round((verified / decisions.length) * weight);
}

export function scoreMatch(
  evaluation: MatchEvaluation,
  overrides: Record<string, MatchOverride> = {},
): Pick<JobMatchResult, "points" | "matchScore" | "recommendation"> {
  const required = evaluation.requirements.filter(
    (decision) => decision.kind === "required",
  );
  const preferred = evaluation.requirements.filter(
    (decision) => decision.kind === "preferred",
  );
  const seniorityScore = evaluation.seniority.score ?? 0;
  const points = {
    required: coverage(required, overrides, matchWeights.required),
    preferred: coverage(preferred, overrides, matchWeights.preferred),
    seniority: Math.round(
      Math.min(seniorityScore / seniorityTargetLevel, 1) *
        matchWeights.seniority,
    ),
  };
  const matchScore = Math.min(
    100,
    points.required + points.preferred + points.seniority,
  );
  const unresolved = required.some(
    (decision) => effectiveStatus(decision, overrides) === "needs_review",
  );
  const recommendation: MatchRecommendation = unresolved
    ? "needs_review"
    : matchScore >= strongMatchThreshold
      ? "strong_match"
      : matchScore >= worthTailoringThreshold
        ? "worth_tailoring"
        : "weak_match";
  return { points, matchScore, recommendation };
}

export function evaluateMatchPolicy(
  requirements: MatchRequirement[],
  answers: MatchAnswers,
  overrides: Record<string, MatchOverride> = {},
): JobMatchResult {
  const evaluation: MatchEvaluation = {
    requirements: requirements.map((requirement) =>
      decideRequirement(requirement, answers[requirement.id]),
    ),
    seniority: decideSeniority(answers[seniorityQuestionId]),
    domainFit: decideDomainFit(answers[domainFitQuestionId]),
  };
  return {
    questionVersion: QUESTION_VERSION,
    ...evaluation,
    overrides,
    ...scoreMatch(evaluation, overrides),
  };
}

export function applyMatchOverride(
  result: JobMatchResult,
  requirementId: string,
  override: MatchOverride | null,
): JobMatchResult | null {
  const decision = result.requirements.find(
    (requirement) => requirement.id === requirementId,
  );
  if (decision?.status !== "needs_review") return null;
  if (override === "accept" && !decision.experienceId) return null;

  const overrides = { ...result.overrides };
  if (override) overrides[requirementId] = override;
  else delete overrides[requirementId];
  return { ...result, overrides, ...scoreMatch(result, overrides) };
}

export type VerifiedEvidence = {
  requirement: string;
  kind: RequirementKind;
  experienceId: string;
};

export function listVerifiedEvidence(
  result: JobMatchResult,
): VerifiedEvidence[] {
  return result.requirements.flatMap((decision) =>
    effectiveStatus(decision, result.overrides) === "verified" &&
    decision.experienceId
      ? [
          {
            requirement: decision.text,
            kind: decision.kind,
            experienceId: decision.experienceId,
          },
        ]
      : [],
  );
}

function termsRelate(left: string, right: string): boolean {
  const a = ` ${normalize(left)} `;
  const b = ` ${normalize(right)} `;
  return a.includes(b) || b.includes(a);
}

export type MatchVerification = "verified" | "unverified";

export function reconcileAnalysisMatches(
  matches: JobAnalysis["matches"],
  result: JobMatchResult,
): {
  matches: JobAnalysis["matches"];
  verification: MatchVerification[];
  verifiedEvidence: VerifiedEvidence[];
} {
  const verifiedEvidence = listVerifiedEvidence(result);
  const kept: JobAnalysis["matches"] = [];
  const verification = matches.map((match): MatchVerification => {
    const supported = new Set(
      verifiedEvidence
        .filter((evidence) =>
          termsRelate(evidence.requirement, match.requirement),
        )
        .map((evidence) => evidence.experienceId),
    );
    const experienceIds = match.experienceIds.filter((id) => supported.has(id));
    if (!experienceIds.length) return "unverified";
    kept.push({ ...match, experienceIds });
    return "verified";
  });
  return { matches: kept, verification, verifiedEvidence };
}

export const matchOverrideInputSchema = z.object({
  matchId: z.uuid(),
  requirementId: z.string().regex(/^(req|pref)_\d+$/),
  decision: z.enum(["accept", "reject", "clear"]),
});

export const jobMatchSummarySchema = jobMatchResultSchema.pick({
  matchScore: true,
  recommendation: true,
});

export type JobMatchSummary = z.infer<typeof jobMatchSummarySchema>;
