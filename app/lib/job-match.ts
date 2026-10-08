import { z } from "zod";

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
