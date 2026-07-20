import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import {
  experiences,
  jobAnalyses,
  profiles,
  resumes,
  userApiCredentials,
} from "../db/schema";
import { db } from "./db.server";
import type { experienceInputSchema, profileInputSchema } from "./validation";

type ProfileInput = z.infer<typeof profileInputSchema>;
type ExperienceInput = z.output<typeof experienceInputSchema>;

export async function getProfile(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
}

export async function saveProfile(userId: string, input: ProfileInput) {
  const [profile] = await db
    .insert(profiles)
    .values({ ...input, userId })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return profile;
}

export async function listExperiences(userId: string) {
  return db.query.experiences.findMany({
    where: eq(experiences.userId, userId),
    orderBy: [desc(experiences.startDate)],
  });
}

export async function getExperience(userId: string, experienceId: string) {
  return db.query.experiences.findFirst({
    where: and(
      eq(experiences.id, experienceId),
      eq(experiences.userId, userId),
    ),
  });
}

export async function createExperience(userId: string, input: ExperienceInput) {
  const [experience] = await db
    .insert(experiences)
    .values({ ...input, userId })
    .returning();
  return experience;
}

export async function updateExperience(
  userId: string,
  experienceId: string,
  input: ExperienceInput,
) {
  const [experience] = await db
    .update(experiences)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
    )
    .returning();
  return experience;
}

export async function deleteExperience(userId: string, experienceId: string) {
  const [experience] = await db
    .delete(experiences)
    .where(
      and(eq(experiences.id, experienceId), eq(experiences.userId, userId)),
    )
    .returning({ id: experiences.id });
  return experience;
}

export async function listAnalyses(userId: string) {
  return db.query.jobAnalyses.findMany({
    where: eq(jobAnalyses.userId, userId),
    orderBy: [desc(jobAnalyses.createdAt)],
  });
}

export async function getAnalysis(userId: string, analysisId: string) {
  return db.query.jobAnalyses.findFirst({
    where: and(eq(jobAnalyses.id, analysisId), eq(jobAnalyses.userId, userId)),
  });
}

export async function createAnalysis(
  userId: string,
  input: {
    jobDescription: string;
    jobTitle: string;
    companyName: string;
    analysis: unknown;
    score: unknown;
  },
) {
  const [analysis] = await db
    .insert(jobAnalyses)
    .values({ ...input, userId })
    .returning();
  return analysis;
}

export async function getResume(userId: string, resumeId: string) {
  return db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
}

export async function createResume(
  userId: string,
  input: {
    analysisId: string;
    title: string;
    content: unknown;
  },
) {
  const [resume] = await db
    .insert(resumes)
    .values({ ...input, userId })
    .returning();
  return resume;
}

export async function updateResume(
  userId: string,
  resumeId: string,
  input: { title: string; content: unknown },
) {
  const [resume] = await db
    .update(resumes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .returning();
  return resume;
}

export async function getUserApiCredential(userId: string) {
  return db.query.userApiCredentials.findFirst({
    where: and(
      eq(userApiCredentials.userId, userId),
      eq(userApiCredentials.provider, "openai"),
    ),
  });
}

export async function saveUserApiCredential(
  userId: string,
  credential: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: string;
    lastFour: string;
  },
) {
  const [saved] = await db
    .insert(userApiCredentials)
    .values({ ...credential, userId, provider: "openai", testedAt: new Date() })
    .onConflictDoUpdate({
      target: [userApiCredentials.userId, userApiCredentials.provider],
      set: { ...credential, testedAt: new Date(), updatedAt: new Date() },
    })
    .returning();
  return saved;
}

export async function deleteUserApiCredential(userId: string) {
  const [deleted] = await db
    .delete(userApiCredentials)
    .where(
      and(
        eq(userApiCredentials.userId, userId),
        eq(userApiCredentials.provider, "openai"),
      ),
    )
    .returning({ id: userApiCredentials.id });
  return deleted;
}
