import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redirect } from "react-router";

import { authSchema } from "../db/schema";
import { db } from "./db.server";
import { getServerEnv } from "./env.server";

const env = getServerEnv();

export const auth = betterAuth({
  appName: "Resume Fit",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  trustedOrigins: [env.BETTER_AUTH_URL],
  advanced: {
    cookiePrefix: "resume-fit",
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
  },
});

export type AuthSession = typeof auth.$Infer.Session;

export async function getSession(
  request: Request,
): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(request: Request): Promise<AuthSession> {
  const session = await getSession(request);
  if (!session) {
    const url = new URL(request.url);
    const destination = `${url.pathname}${url.search}`;
    throw redirect(`/sign-in?redirectTo=${encodeURIComponent(destination)}`);
  }
  return session;
}
