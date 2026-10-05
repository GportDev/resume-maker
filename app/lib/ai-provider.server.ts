import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, type LanguageModel } from "ai";

import { type AiProvider, aiProviderDetails } from "./ai-providers";
import {
  decryptUserApiKey,
  encryptedCredentialSchema,
} from "./credentials.server";
import { getServerEnv } from "./env.server";
import { getUserApiCredential, getUserSettings } from "./repositories.server";

export class NoAiKeyError extends Error {
  readonly provider: AiProvider;

  constructor(provider: AiProvider) {
    super(
      `No ${aiProviderDetails[provider].label} API key is configured. Add your key in AI settings.`,
    );
    this.name = "NoAiKeyError";
    this.provider = provider;
  }
}

export function createLanguageModel(
  provider: AiProvider,
  apiKey: string,
): LanguageModel {
  const env = getServerEnv();
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(env.ANTHROPIC_MODEL);
  }
  return createOpenAI({ apiKey })(env.OPENAI_MODEL);
}

function getPlatformKey(provider: AiProvider): string | undefined {
  const env = getServerEnv();
  return provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
}

export async function getPreferredAiProvider(
  userId: string,
): Promise<AiProvider> {
  const settings = await getUserSettings(userId);
  return settings?.aiProvider ?? getServerEnv().AI_DEFAULT_PROVIDER;
}

export async function resolveApiKey(
  userId: string,
  provider: AiProvider,
): Promise<string> {
  const credential = await getUserApiCredential(userId, provider);
  if (credential) {
    return decryptUserApiKey({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.authTag,
      keyVersion: encryptedCredentialSchema.shape.keyVersion.parse(
        credential.keyVersion,
      ),
    });
  }

  const platformKey = getPlatformKey(provider);
  if (!platformKey) {
    throw new NoAiKeyError(provider);
  }
  return platformKey;
}

export async function resolveLanguageModel(
  userId: string,
): Promise<{ model: LanguageModel; provider: AiProvider }> {
  const provider = await getPreferredAiProvider(userId);
  const apiKey = await resolveApiKey(userId, provider);
  return { provider, model: createLanguageModel(provider, apiKey) };
}

export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
): Promise<void> {
  await generateText({
    model: createLanguageModel(provider, apiKey),
    prompt: "Reply with only OK.",
    maxOutputTokens: 16,
    maxRetries: 0,
  });
}

export function describeProviderError(error: unknown): {
  name: string;
  status?: number;
} {
  if (APICallError.isInstance(error)) {
    return { name: error.name, status: error.statusCode };
  }
  return { name: error instanceof Error ? error.name : "UnknownError" };
}

export function logProviderError(
  operation: string,
  provider: AiProvider | undefined,
  error: unknown,
): void {
  console.error("AI provider request failed", {
    operation,
    provider,
    ...describeProviderError(error),
  });
}
