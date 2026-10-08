import { z } from "zod";

import { getServerEnv } from "./env.server";
import type { MatchAnswer, MatchQuestion, MatchState } from "./job-match";

const probability = z.number().min(0).max(1);
const instructions = z.string().min(1);

const apiQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    instructions,
    criteria: z
      .record(z.string().min(1), z.string())
      .refine((criteria) => {
        const count = Object.keys(criteria).length;
        return count >= 2 && count <= 255;
      }, "Choice questions need 2 to 255 options."),
  }),
  z.object({
    type: z.literal("score"),
    instructions,
    criteria: z.array(z.string().min(1)).min(2).max(10),
  }),
  z.object({ type: z.literal("noul"), instructions }),
]);

const requestSchema = z.object({
  model: z.string().min(1),
  state: z.union([
    z.string().min(1),
    z.array(z.string()).min(1),
    z.record(z.string(), z.unknown()),
  ]),
  questions: z
    .record(z.string().min(1), apiQuestionSchema)
    .refine(
      (questions) => Object.keys(questions).length > 0,
      "Ask at least one question.",
    ),
});

const apiAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    choice: z.string().min(1),
    probabilities: z.record(z.string(), probability),
    confidence: probability.optional(),
  }),
  z.object({
    type: z.literal("score"),
    score: z.number().min(0),
    confidence: probability.optional(),
  }),
  z.object({ type: z.literal("noul"), noul: probability }),
]);

const responseSchema = z.object({
  model: z.string().min(1),
  answers: z.record(z.string(), apiAnswerSchema),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
  }),
});

type ApiQuestion = z.infer<typeof apiQuestionSchema>;
type ApiAnswer = z.infer<typeof apiAnswerSchema>;

export class JevRequestError extends Error {
  readonly status?: number;

  constructor(status?: number, options?: { cause: unknown }) {
    super(
      status
        ? `Jev request failed with status ${status}.`
        : "Jev request failed.",
      options,
    );
    this.name = "JevRequestError";
    this.status = status;
  }
}

export class JevResponseError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "JevResponseError";
  }
}

export type JevResult = {
  modelVersion: string;
  answers: Record<string, MatchAnswer>;
  usage: { inputTokens: number; outputTokens: number };
};

export type JevClient = {
  systemOne(input: {
    state: MatchState;
    questions: Record<string, MatchQuestion>;
  }): Promise<JevResult>;
};

type JevLogger = Pick<Console, "info" | "warn" | "error">;

export type JevClientOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: JevLogger;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export const jevMaxAttempts = 3;
const retryableStatuses = new Set([429, 529]);

function toApiQuestion(question: MatchQuestion): ApiQuestion {
  if (question.type === "boolean") {
    return { type: "noul", instructions: question.instructions };
  }
  return question;
}

function expectedApiType(question: MatchQuestion): ApiAnswer["type"] {
  return question.type === "boolean" ? "noul" : question.type;
}

function toMatchAnswer(
  id: string,
  question: MatchQuestion,
  answer: ApiAnswer | undefined,
): MatchAnswer {
  if (!answer || answer.type !== expectedApiType(question)) {
    throw new JevResponseError(`Jev answer for ${id} is missing or mistyped.`);
  }
  switch (answer.type) {
    case "choice":
      if (
        question.type !== "choice" ||
        !Object.hasOwn(question.criteria, answer.choice)
      ) {
        throw new JevResponseError(`Jev choice for ${id} is not an option.`);
      }
      return {
        type: "choice",
        choice: answer.choice,
        probabilities: answer.probabilities,
        confidence: answer.confidence ?? null,
      };
    case "score":
      return {
        type: "score",
        score: answer.score,
        confidence: answer.confidence ?? null,
      };
    case "noul":
      return { type: "boolean", probability: answer.noul };
  }
}

function retryDelayMs(
  response: Response,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const hintMs = Number(response.headers.get("retry-after-ms"));
  const hintSeconds = Number(response.headers.get("retry-after"));
  const hinted =
    Number.isFinite(hintMs) && hintMs > 0
      ? hintMs
      : Number.isFinite(hintSeconds) && hintSeconds > 0
        ? hintSeconds * 1000
        : baseDelayMs * 2 ** attempt;
  return Math.min(maxDelayMs, hinted);
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createJevClient(options: JevClientOptions): JevClient {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? wait;
  const logger = options.logger ?? console;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const url = new URL("/v1/systemone", options.baseUrl);

  return {
    async systemOne({ state, questions }) {
      const body = requestSchema.parse({
        model: options.model,
        state,
        questions: Object.fromEntries(
          Object.entries(questions).map(([id, question]) => [
            id,
            toApiQuestion(question),
          ]),
        ),
      });

      for (let attempt = 0; attempt < jevMaxAttempts; attempt++) {
        let response: Response;
        try {
          response = await fetchImpl(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          throw new JevRequestError(undefined, { cause: error });
        }

        if (response.ok) {
          let json: unknown;
          try {
            json = await response.json();
          } catch (error) {
            throw new JevResponseError("Jev response was not JSON.", {
              cause: error,
            });
          }
          const parsed = responseSchema.safeParse(json);
          if (!parsed.success) {
            throw new JevResponseError(
              "Jev response did not match the schema.",
            );
          }
          const answers = Object.fromEntries(
            Object.entries(questions).map(([id, question]) => [
              id,
              toMatchAnswer(id, question, parsed.data.answers[id]),
            ]),
          );
          logger.info("Jev request completed", {
            status: response.status,
            model: parsed.data.model,
            inputTokens: parsed.data.usage.input_tokens,
            outputTokens: parsed.data.usage.output_tokens,
          });
          return {
            modelVersion: parsed.data.model,
            answers,
            usage: {
              inputTokens: parsed.data.usage.input_tokens,
              outputTokens: parsed.data.usage.output_tokens,
            },
          };
        }

        await response.body?.cancel();
        const canRetry =
          retryableStatuses.has(response.status) &&
          attempt < jevMaxAttempts - 1;
        if (!canRetry) throw new JevRequestError(response.status);
        logger.warn("Jev request throttled; retrying", {
          status: response.status,
          attempt: attempt + 1,
        });
        await sleep(retryDelayMs(response, attempt, baseDelayMs, maxDelayMs));
      }
      throw new JevRequestError();
    },
  };
}

export function getJevClient(): JevClient | null {
  const env = getServerEnv();
  if (!env.TYPESAFE_API_KEY) return null;
  return createJevClient({
    apiKey: env.TYPESAFE_API_KEY,
    model: env.TYPESAFE_MODEL,
    baseUrl: env.TYPESAFE_BASE_URL,
  });
}

export function describeJevError(error: unknown): {
  name: string;
  status?: number;
} {
  if (error instanceof JevRequestError) {
    return { name: error.name, status: error.status };
  }
  return { name: error instanceof Error ? error.name : "UnknownError" };
}

export function logJevError(operation: string, error: unknown): void {
  console.error("Jev request failed", {
    operation,
    ...describeJevError(error),
  });
}
