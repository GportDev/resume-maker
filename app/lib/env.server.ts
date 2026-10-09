import { z } from "zod";

import { aiProviderSchema } from "./ai-providers";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AI_DEFAULT_PROVIDER: aiProviderSchema.default("anthropic"),
  ANTHROPIC_API_KEY: z.string().min(20).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(1),
  TYPESAFE_API_KEY: z.string().min(1).optional(),
  TYPESAFE_MODEL: z.string().min(1).default("jev-latest"),
  TYPESAFE_BASE_URL: z.string().url().default("https://api.typesafe.ai"),
  JOB_LISTINGS_PROVIDER: z.enum(["fantastic_jobs"]).default("fantastic_jobs"),
  RAPIDAPI_KEY: z.string().min(1).optional(),
  JOB_LISTINGS_BASE_URL: z
    .string()
    .url()
    .default("https://linkedin-job-search-api.p.rapidapi.com"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse({
      ...process.env,
      AI_DEFAULT_PROVIDER: process.env.AI_DEFAULT_PROVIDER || undefined,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
      OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
      TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY || undefined,
      TYPESAFE_MODEL: process.env.TYPESAFE_MODEL || undefined,
      TYPESAFE_BASE_URL: process.env.TYPESAFE_BASE_URL || undefined,
      JOB_LISTINGS_PROVIDER: process.env.JOB_LISTINGS_PROVIDER || undefined,
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || undefined,
      JOB_LISTINGS_BASE_URL: process.env.JOB_LISTINGS_BASE_URL || undefined,
    });
  }

  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
