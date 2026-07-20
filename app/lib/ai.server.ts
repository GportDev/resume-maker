import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { experiences, profiles } from "../db/schema";
import { type JobAnalysis, jobAnalysisSchema } from "./analysis";
import { decryptUserApiKey } from "./credentials.server";
import { getServerEnv } from "./env.server";
import { getUserApiCredential } from "./repositories.server";
import { resumeContentSchema } from "./resume";

type Experience = typeof experiences.$inferSelect;
type Profile = typeof profiles.$inferSelect;

export async function getOpenAiKeyForUser(userId: string): Promise<string> {
  const credential = await getUserApiCredential(userId);
  if (credential) {
    return decryptUserApiKey({
      ciphertext: credential.ciphertext,
      iv: credential.iv,
      authTag: credential.authTag,
      keyVersion: credential.keyVersion as "v1",
    });
  }

  const platformKey = getServerEnv().OPENAI_API_KEY;
  if (!platformKey) {
    throw new Error(
      "No OpenAI API key is configured. Add your key in Settings.",
    );
  }
  return platformKey;
}

function createModel(apiKey: string) {
  const openai = createOpenAI({ apiKey });
  return openai(getServerEnv().OPENAI_MODEL);
}

export async function testOpenAiKey(apiKey: string): Promise<void> {
  await generateText({
    model: createModel(apiKey),
    prompt: "Reply with only OK.",
  });
}

export async function analyzeJob(input: {
  apiKey: string;
  jobDescription: string;
  profile: Profile | undefined;
  experiences: Experience[];
}) {
  const evidence = input.experiences.map((experience) => ({
    id: experience.id,
    company: experience.company,
    position: experience.position,
    startDate: experience.startDate,
    endDate: experience.endDate,
    isCurrent: experience.isCurrent,
    markdown: experience.markdown,
  }));

  const { output } = await generateText({
    model: createModel(input.apiKey),
    output: Output.object({ schema: jobAnalysisSchema }),
    system: [
      "You analyze job descriptions against verified candidate evidence.",
      "Never infer a skill or accomplishment absent from evidence.",
      "Every match must cite one or more supplied experience UUIDs.",
      "Required skills are explicit must-have requirements; preferred skills are optional.",
      "Keywords should be concise ATS terms, deduplicated, and job-relevant.",
      "Missing skills must not appear in candidate evidence.",
    ].join(" "),
    prompt: JSON.stringify({
      jobDescription: input.jobDescription,
      candidateProfile: input.profile ?? null,
      candidateExperiences: evidence,
    }),
  });

  return jobAnalysisSchema.parse(output);
}

export async function generateResume(input: {
  apiKey: string;
  account: { name: string; email: string };
  profile: Profile | undefined;
  experiences: Experience[];
  analysis: JobAnalysis;
}) {
  const { output } = await generateText({
    model: createModel(input.apiKey),
    output: Output.object({ schema: resumeContentSchema }),
    system: [
      "Create a concise ATS-friendly resume from verified evidence only.",
      "Never invent metrics, tools, skills, employers, positions, or dates.",
      "Every bullet must cite sourceExperienceIds from supplied evidence.",
      "Use single-column conventional sections and plain professional language.",
      "Select only experience relevant to the target role.",
      "Do not include missing skills as candidate skills.",
    ].join(" "),
    prompt: JSON.stringify({
      targetJob: input.analysis,
      contact: {
        fullName: input.profile?.fullName || input.account.name,
        email: input.profile?.email || input.account.email,
        phone: input.profile?.phone || "",
        location: input.profile?.location || "",
        website: input.profile?.website || "",
        linkedin: input.profile?.linkedin || "",
      },
      experiences: input.experiences.map((experience) => ({
        experienceId: experience.id,
        company: experience.company,
        position: experience.position,
        startDate: experience.startDate,
        endDate: experience.endDate,
        isCurrent: experience.isCurrent,
        evidence: experience.markdown,
      })),
    }),
  });

  return resumeContentSchema.parse(output);
}
