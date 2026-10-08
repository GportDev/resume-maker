import { type JobAnalysis, normalize } from "./analysis";

export type KeywordMatchExperience = {
  id: string;
  position: string;
  company: string;
  markdown: string;
};

export type ExperienceKeywordMatch = {
  experienceId: string;
  matchedKeywords: string[];
  matchedRequiredSkills: string[];
};

export type KeywordMatchResult = {
  experiences: ExperienceKeywordMatch[];
  unmatchedKeywords: string[];
};

// Sentence punctuation stays attached after `normalize` ("TypeScript." ->
// "typescript."), so trailing dots are dropped before whole-term matching.
function toTerm(value: string): string {
  return normalize(value)
    .replace(/\.+(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(haystack: string, term: string): boolean {
  return term !== "" && haystack.includes(` ${term} `);
}

function uniqueTerms(values: string[]): { label: string; term: string }[] {
  const seen = new Set<string>();
  const result: { label: string; term: string }[] = [];
  for (const value of values) {
    const term = toTerm(value);
    if (!term || seen.has(term)) continue;
    seen.add(term);
    result.push({ label: value.trim(), term });
  }
  return result;
}

export function matchKeywordsToExperiences(
  analysis: Pick<JobAnalysis, "keywords" | "requiredSkills" | "matches">,
  experiences: KeywordMatchExperience[],
): KeywordMatchResult {
  const keywords = uniqueTerms(analysis.keywords);
  const requiredSkills = uniqueTerms(analysis.requiredSkills);
  const matchedKeywordTerms = new Set<string>();

  const results = experiences.map((experience) => {
    const haystack = ` ${toTerm(
      `${experience.position} ${experience.company} ${experience.markdown}`,
    )} `;
    const citedRequirements = analysis.matches
      .filter((match) => match.experienceIds.includes(experience.id))
      .map((match) => toTerm(match.requirement));

    const matchedKeywords = keywords.filter(({ term }) =>
      containsTerm(haystack, term),
    );
    for (const { term } of matchedKeywords) matchedKeywordTerms.add(term);

    const matchedRequiredSkills = requiredSkills.filter(
      ({ term }) =>
        containsTerm(haystack, term) ||
        citedRequirements.some((requirement) =>
          containsTerm(` ${requirement} `, term),
        ),
    );

    return {
      experienceId: experience.id,
      matchedKeywords: matchedKeywords.map(({ label }) => label),
      matchedRequiredSkills: matchedRequiredSkills.map(({ label }) => label),
    };
  });

  return {
    experiences: results,
    unmatchedKeywords: keywords
      .filter(({ term }) => !matchedKeywordTerms.has(term))
      .map(({ label }) => label),
  };
}
