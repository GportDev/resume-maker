import { countWords } from "./markdown-format";

export type EvidenceHint = {
  id: "short" | "no-bullets" | "no-numbers" | "no-tools" | "vague";
  message: string;
};

const minimumWords = 60;
const bulletLine = /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/;
const toolsHeading = /^#{1,6}\s+.*\b(tools|stack|technolog)/im;
const toolsLabel = /^\s*(?:[-*+]\s+)?\*{0,2}(tools|stack)\*{0,2}\s*:/im;
const vaguePhrases =
  /\b(responsible for|helped (?:with|to)?|worked on|involved in|various|etc\.?)(?=\W|$)/i;

/**
 * Deterministic, non-blocking hints toward traceable evidence. Never calls a
 * model; never prevents saving.
 */
export function lintEvidence(markdown: string): EvidenceHint[] {
  const hints: EvidenceHint[] = [];
  const text = markdown.trim();
  if (!text) return hints;

  const words = countWords(text);
  if (words < minimumWords) {
    hints.push({
      id: "short",
      message: `${words} words so far. Aim for at least ${minimumWords} so tailoring has enough to cite.`,
    });
  }

  const bullets = text
    .split("\n")
    .map((line) => bulletLine.exec(line)?.[1]?.trim() ?? null)
    .filter((line): line is string => Boolean(line));
  if (!bullets.length) {
    hints.push({
      id: "no-bullets",
      message:
        "Use one bullet per contribution so each can be cited on its own.",
    });
  } else {
    const withoutNumbers = bullets.filter((line) => !/\d/.test(line)).length;
    if (withoutNumbers * 2 > bullets.length) {
      hints.push({
        id: "no-numbers",
        message: `${withoutNumbers} of ${bullets.length} bullets have no number. Add a metric, count, or scale where you can.`,
      });
    }
  }

  if (!toolsHeading.test(text) && !toolsLabel.test(text)) {
    hints.push({
      id: "no-tools",
      message: "Add a Tools section so skill matching can see your stack.",
    });
  }

  const vague = vaguePhrases.exec(text)?.[1];
  if (vague) {
    hints.push({
      id: "vague",
      message: `Replace vague phrases like “${vague.toLowerCase()}” with what you did.`,
    });
  }

  return hints;
}
