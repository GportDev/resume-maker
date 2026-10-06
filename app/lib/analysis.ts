import { z } from "zod";

export const matchStrengthSchema = z.enum(["strong", "partial"]);

export const jobAnalysisSchema = z.object({
  jobTitle: z.string().min(1).max(160),
  companyName: z.string().max(160).default(""),
  seniority: z.string().max(80).default(""),
  requiredSkills: z.array(z.string().min(1).max(100)).max(40),
  preferredSkills: z.array(z.string().min(1).max(100)).max(40),
  keywords: z.array(z.string().min(1).max(100)).max(80),
  responsibilities: z.array(z.string().min(1).max(300)).max(30),
  matches: z
    .array(
      z.object({
        requirement: z.string().min(1).max(300),
        evidence: z.string().min(1).max(600),
        experienceIds: z.array(z.uuid()).min(1).max(10),
        strength: matchStrengthSchema,
      }),
    )
    .max(60),
  missingSkills: z.array(z.string().min(1).max(100)).max(40),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export const scoreBreakdownSchema = z.object({
  total: z.number().int().min(0).max(100),
  keywordCoverage: z.number().int().min(0).max(25),
  requiredSkillCoverage: z.number().int().min(0).max(35),
  evidenceStrength: z.number().int().min(0).max(25),
  titleAlignment: z.number().int().min(0).max(10),
  profileCompleteness: z.number().int().min(0).max(5),
});

export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

function ratio(points: number, total: number, weight: number): number {
  if (!total) return weight;
  return Math.min(weight, Math.round((points / total) * weight));
}

export function sanitizeAnalysisExperienceIds(
  analysis: JobAnalysis,
  ownedExperienceIds: Set<string>,
): JobAnalysis {
  return {
    ...analysis,
    matches: analysis.matches
      .map((match) => ({
        ...match,
        experienceIds: match.experienceIds.filter((id) =>
          ownedExperienceIds.has(id),
        ),
      }))
      .filter((match) => match.experienceIds.length > 0),
  };
}

export function calculateAtsScore(input: {
  analysis: JobAnalysis;
  experienceText: string;
  profileFieldsCompleted: number;
  profileFieldCount: number;
}): ScoreBreakdown {
  const text = normalize(input.experienceText);
  const uniqueKeywords = [...new Set(input.analysis.keywords.map(normalize))];
  const keywordMatches = uniqueKeywords.filter((keyword) =>
    text.includes(keyword),
  ).length;

  const matchedRequirements = new Set(
    input.analysis.matches.map((match) => normalize(match.requirement)),
  );
  const requiredMatches = input.analysis.requiredSkills.filter((skill) => {
    const normalizedSkill = normalize(skill);
    return (
      text.includes(normalizedSkill) ||
      [...matchedRequirements].some(
        (requirement) =>
          requirement.includes(normalizedSkill) ||
          normalizedSkill.includes(requirement),
      )
    );
  }).length;

  const evidencePoints = input.analysis.matches.reduce(
    (total, match) => total + (match.strength === "strong" ? 1 : 0.5),
    0,
  );
  const titleTokens = normalize(input.analysis.jobTitle)
    .split(" ")
    .filter((token) => token.length > 2);
  const titleMatches = titleTokens.filter((token) =>
    text.includes(token),
  ).length;

  const breakdown = {
    keywordCoverage: ratio(keywordMatches, uniqueKeywords.length, 25),
    requiredSkillCoverage: ratio(
      requiredMatches,
      input.analysis.requiredSkills.length,
      35,
    ),
    evidenceStrength: ratio(
      evidencePoints,
      Math.max(input.analysis.requiredSkills.length, 1),
      25,
    ),
    titleAlignment: ratio(titleMatches, titleTokens.length, 10),
    profileCompleteness: ratio(
      input.profileFieldsCompleted,
      input.profileFieldCount,
      5,
    ),
  };

  return scoreBreakdownSchema.parse({
    ...breakdown,
    total: Math.min(
      100,
      Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    ),
  });
}

export const profileScoreFields = [
  "fullName",
  "headline",
  "email",
  "phone",
  "location",
  "website",
  "linkedin",
] as const;

type ProfileScoreInput = Partial<
  Record<(typeof profileScoreFields)[number], string>
>;

export function scoreAnalysisAgainstEvidence(input: {
  analysis: JobAnalysis;
  profile: ProfileScoreInput | undefined;
  experiences: { position: string; company: string; markdown: string }[];
}): ScoreBreakdown {
  return calculateAtsScore({
    analysis: input.analysis,
    experienceText: input.experiences
      .map(
        (experience) =>
          `${experience.position} ${experience.company} ${experience.markdown}`,
      )
      .join("\n"),
    profileFieldsCompleted: profileScoreFields.filter(
      (field) => input.profile?.[field],
    ).length,
    profileFieldCount: profileScoreFields.length,
  });
}

const learningSources = [
  {
    label: "MDN",
    url: (skill: string) =>
      `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(skill)}`,
  },
  {
    label: "freeCodeCamp",
    url: (skill: string) =>
      `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(skill)}`,
  },
];

export function getLearningResources(skill: string) {
  return learningSources.map((source) => ({
    label: source.label,
    url: source.url(skill),
  }));
}
