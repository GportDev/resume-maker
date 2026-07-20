import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = serverEnvSchema.parse({
      ...process.env,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    });
  }

  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
