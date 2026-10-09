import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  createJevClient,
  describeJevError,
  JevRequestError,
  JevResponseError,
} from "../app/lib/jev.server";
import type { MatchQuestion } from "../app/lib/job-match";

const apiKey = "ts-secret-key-1234567890";
const experienceId = "11111111-1111-4111-8111-111111111111";
const secretEvidence = "Confidential: migrated payroll for 40k employees";

const choiceCriteria = {
  [experienceId]: "Engineer at Acme: Built TypeScript services",
  none: "No listed experience demonstrates this",
};

const questions: Record<string, MatchQuestion> = {
  req_0: {
    type: "choice",
    instructions: "Which experience demonstrates TypeScript?",
    criteria: choiceCriteria,
  },
  seniority: {
    type: "score",
    instructions: "Rate seniority.",
    criteria: ["Below", "Somewhat below", "At", "Above"],
  },
  domainFit: { type: "boolean", instructions: "Does the domain fit?" },
};

const state = { experiences: [{ id: experienceId, evidence: secretEvidence }] };

const validBody = {
  model: "jev-1.13.0",
  answers: {
    req_0: {
      type: "choice",
      choice: experienceId,
      probabilities: { [experienceId]: 0.91, none: 0.09, injected: 0.5 },
      confidence: 0.91,
    },
    seniority: {
      type: "score",
      score: 2.1,
      confidence: 0.8,
      legend: { "0": "Below" },
      probabilities: { "0": 0.1 },
    },
    domainFit: { type: "noul", noul: 0.83 },
  },
  usage: { input_tokens: 812, output_tokens: 24 },
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function status(code: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: { message: secretEvidence } }), {
    status: code,
    headers,
  });
}

function setup(responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async (_milliseconds: number) => {});
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const client = createJevClient({
    apiKey,
    model: "jev-latest",
    baseUrl: "https://api.typesafe.ai",
    fetch: fetchMock,
    sleep,
    logger,
  });
  return { client, fetchMock, sleep, logger };
}

function loggedText(logger: ReturnType<typeof setup>["logger"]): string {
  return JSON.stringify([
    logger.info.mock.calls,
    logger.warn.mock.calls,
    logger.error.mock.calls,
  ]);
}

describe("JevClient.systemOne", () => {
  it("posts typed questions and normalizes a valid response", async () => {
    const { client, fetchMock, logger } = setup([json(validBody)]);

    const result = await client.systemOne({ state, questions });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${apiKey}`,
    );
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("jev-latest");
    expect(body.state).toEqual(state);
    expect(body.questions.domainFit).toEqual({
      type: "noul",
      instructions: "Does the domain fit?",
    });
    expect(body.questions.req_0.criteria).toEqual(choiceCriteria);

    expect(result).toEqual({
      modelVersion: "jev-1.13.0",
      answers: {
        req_0: {
          type: "choice",
          choice: experienceId,
          probabilities: { [experienceId]: 0.91, none: 0.09 },
          confidence: 0.91,
        },
        seniority: { type: "score", score: 2.1, confidence: 0.8 },
        domainFit: { type: "boolean", probability: 0.83 },
      },
      usage: { inputTokens: 812, outputTokens: 24 },
    });
    expect(logger.info).toHaveBeenCalledWith("Jev request completed", {
      status: 200,
      model: "jev-1.13.0",
      inputTokens: 812,
      outputTokens: 24,
    });
  });

  it("keeps missing confidence as null", async () => {
    const body = structuredClone(validBody);
    delete (body.answers.req_0 as { confidence?: number }).confidence;
    const { client } = setup([json(body)]);

    const result = await client.systemOne({ state, questions });
    expect(result.answers.req_0).toMatchObject({ confidence: null });
  });

  it("rejects responses that fail the schema", async () => {
    const { client } = setup([json({ ...validBody, usage: undefined })]);
    await expect(client.systemOne({ state, questions })).rejects.toBeInstanceOf(
      JevResponseError,
    );
  });

  it("rejects missing, mistyped, or out-of-range answers", async () => {
    const missing = setup([
      json({
        ...validBody,
        answers: { ...validBody.answers, domainFit: undefined },
      }),
    ]);
    await expect(
      missing.client.systemOne({ state, questions }),
    ).rejects.toBeInstanceOf(JevResponseError);

    const mistyped = setup([
      json({
        ...validBody,
        answers: {
          ...validBody.answers,
          seniority: { type: "noul", noul: 0.4 },
        },
      }),
    ]);
    await expect(
      mistyped.client.systemOne({ state, questions }),
    ).rejects.toBeInstanceOf(JevResponseError);

    const foreignChoice = setup([
      json({
        ...validBody,
        answers: {
          ...validBody.answers,
          req_0: { ...validBody.answers.req_0, choice: "injected" },
        },
      }),
    ]);
    await expect(
      foreignChoice.client.systemOne({ state, questions }),
    ).rejects.toBeInstanceOf(JevResponseError);

    const badProbability = setup([
      json({
        ...validBody,
        answers: {
          ...validBody.answers,
          domainFit: { type: "noul", noul: 1.4 },
        },
      }),
    ]);
    await expect(
      badProbability.client.systemOne({ state, questions }),
    ).rejects.toBeInstanceOf(JevResponseError);
  });

  it("rejects non-JSON bodies", async () => {
    const { client } = setup([new Response("<html>", { status: 200 })]);
    await expect(client.systemOne({ state, questions })).rejects.toThrow(
      "Jev response was not JSON.",
    );
  });

  it("validates the request before calling the API", async () => {
    const { client, fetchMock } = setup([]);
    await expect(
      client.systemOne({
        state,
        questions: {
          req_0: {
            type: "choice",
            instructions: "Pick one",
            criteria: { only: "One option" },
          },
        },
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries 429 honoring Retry-After, then succeeds", async () => {
    const { client, fetchMock, sleep, logger } = setup([
      status(429, { "retry-after": "2" }),
      json(validBody),
    ]);

    await expect(client.systemOne({ state, questions })).resolves.toMatchObject(
      { modelVersion: "jev-1.13.0" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(logger.warn).toHaveBeenCalledWith(
      "Jev request throttled; retrying",
      {
        status: 429,
        attempt: 1,
      },
    );
  });

  it("backs off exponentially on 529 and stops after 3 attempts", async () => {
    const { client, fetchMock, sleep } = setup([
      status(529),
      status(529),
      status(529),
    ]);

    const error = await client
      .systemOne({ state, questions })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(JevRequestError);
    expect(error).toMatchObject({ status: 529 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("caps Retry-After at the maximum delay", async () => {
    const { client, sleep } = setup([
      status(429, { "retry-after-ms": "120000" }),
      json(validBody),
    ]);
    await client.systemOne({ state, questions });
    expect(sleep).toHaveBeenCalledWith(8000);
  });

  it.each([401, 422, 500])("does not retry %i", async (code) => {
    const { client, fetchMock, sleep } = setup([status(code), json(validBody)]);

    await expect(client.systemOne({ state, questions })).rejects.toMatchObject({
      name: "JevRequestError",
      status: code,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("wraps network failures without retrying", async () => {
    const { client, fetchMock } = setup([new TypeError("fetch failed")]);
    await expect(client.systemOne({ state, questions })).rejects.toMatchObject({
      name: "JevRequestError",
      status: undefined,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("logs only status, model version, and token usage", async () => {
    const { client, logger } = setup([status(429), json(validBody)]);
    await client.systemOne({ state, questions });

    const logged = loggedText(logger);
    expect(logged).not.toContain(apiKey);
    expect(logged).not.toContain(secretEvidence);
    expect(logged).not.toContain(experienceId);
    expect(logged).not.toContain("TypeScript");
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("describeJevError", () => {
  it("exposes only the error name and status", () => {
    expect(describeJevError(new JevRequestError(422))).toEqual({
      name: "JevRequestError",
      status: 422,
    });
    expect(describeJevError(new JevResponseError(secretEvidence))).toEqual({
      name: "JevResponseError",
    });
    expect(describeJevError("boom")).toEqual({ name: "UnknownError" });
  });
});
