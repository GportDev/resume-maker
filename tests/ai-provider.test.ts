import { randomBytes } from "node:crypto";

import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptCredential } from "../app/lib/credentials.server";
import { resetEnvForTests } from "../app/lib/env.server";

const repositories = vi.hoisted(() => ({
  getUserApiCredential: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("../app/lib/repositories.server", () => repositories);

const {
  getPreferredAiProvider,
  logProviderError,
  NoAiKeyError,
  resolveApiKey,
  resolveLanguageModel,
} = await import("../app/lib/ai-provider.server");

const encryptionKey = randomBytes(32).toString("base64");
const userKey = "sk-ant-user-abcdefghijklmnopqrstuvwxyz";
const platformAnthropicKey = "sk-ant-platform-abcdefghijklmnopqrstuv";
const platformOpenAiKey = "sk-platform-openai-abcdefghijklmnopqrst";

function setEnv(overrides: Record<string, string | undefined>) {
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/test");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:5173");
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", encryptionKey);
  vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
  vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value ?? "");
  }
  resetEnvForTests();
}

function modelId(model: unknown): string {
  if (typeof model === "object" && model && "modelId" in model) {
    return String(model.modelId);
  }
  throw new Error("Expected a language model instance.");
}

beforeEach(() => {
  repositories.getUserApiCredential.mockResolvedValue(undefined);
  repositories.getUserSettings.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvForTests();
});

describe("getPreferredAiProvider", () => {
  it("defaults to Anthropic when nothing is configured", async () => {
    setEnv({ AI_DEFAULT_PROVIDER: undefined });
    await expect(getPreferredAiProvider("user-1")).resolves.toBe("anthropic");
  });

  it("uses the platform default when the user has no setting", async () => {
    setEnv({ AI_DEFAULT_PROVIDER: "openai" });
    await expect(getPreferredAiProvider("user-1")).resolves.toBe("openai");
  });

  it("prefers the user's saved provider over the platform default", async () => {
    setEnv({ AI_DEFAULT_PROVIDER: "openai" });
    repositories.getUserSettings.mockResolvedValue({ aiProvider: "anthropic" });
    await expect(getPreferredAiProvider("user-1")).resolves.toBe("anthropic");
    expect(repositories.getUserSettings).toHaveBeenCalledWith("user-1");
  });
});

describe("resolveApiKey", () => {
  it("prefers the user's decrypted key over the platform key", async () => {
    setEnv({ ANTHROPIC_API_KEY: platformAnthropicKey });
    repositories.getUserApiCredential.mockResolvedValue(
      encryptCredential(userKey, encryptionKey),
    );

    await expect(resolveApiKey("user-1", "anthropic")).resolves.toBe(userKey);
    expect(repositories.getUserApiCredential).toHaveBeenCalledWith(
      "user-1",
      "anthropic",
    );
  });

  it("falls back to the platform key for the requested provider", async () => {
    setEnv({
      ANTHROPIC_API_KEY: platformAnthropicKey,
      OPENAI_API_KEY: platformOpenAiKey,
    });

    await expect(resolveApiKey("user-1", "anthropic")).resolves.toBe(
      platformAnthropicKey,
    );
    await expect(resolveApiKey("user-1", "openai")).resolves.toBe(
      platformOpenAiKey,
    );
  });

  it("does not borrow another provider's platform key", async () => {
    setEnv({ OPENAI_API_KEY: platformOpenAiKey, ANTHROPIC_API_KEY: undefined });

    const result = resolveApiKey("user-1", "anthropic");
    await expect(result).rejects.toBeInstanceOf(NoAiKeyError);
    await expect(result).rejects.toThrow(
      "No Anthropic API key is configured. Add your key in AI settings.",
    );
  });

  it("rejects stored credentials with an unknown key version", async () => {
    setEnv({ ANTHROPIC_API_KEY: platformAnthropicKey });
    repositories.getUserApiCredential.mockResolvedValue({
      ...encryptCredential(userKey, encryptionKey),
      keyVersion: "v0",
    });

    await expect(resolveApiKey("user-1", "anthropic")).rejects.toThrow();
  });
});

describe("resolveLanguageModel", () => {
  it("builds the configured Anthropic model by default", async () => {
    setEnv({ ANTHROPIC_API_KEY: platformAnthropicKey });

    const resolved = await resolveLanguageModel("user-1");
    expect(resolved.provider).toBe("anthropic");
    expect(modelId(resolved.model)).toBe("claude-sonnet-5-5");
  });

  it("builds the OpenAI model when the user selected OpenAI", async () => {
    setEnv({ OPENAI_API_KEY: platformOpenAiKey });
    repositories.getUserSettings.mockResolvedValue({ aiProvider: "openai" });

    const resolved = await resolveLanguageModel("user-1");
    expect(resolved.provider).toBe("openai");
    expect(modelId(resolved.model)).toBe("gpt-5-mini");
  });
});

describe("logProviderError", () => {
  it("logs only safe diagnostics", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new APICallError({
      message: `Invalid key ${userKey}`,
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: { prompt: "Confidential job description" },
      statusCode: 401,
      responseBody: "Confidential provider response",
    });

    logProviderError("analyze-job", "anthropic", error);

    expect(spy).toHaveBeenCalledWith("AI provider request failed", {
      operation: "analyze-job",
      provider: "anthropic",
      name: "AI_APICallError",
      status: 401,
    });
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(userKey);
    expect(logged).not.toContain("Confidential");
  });
});
