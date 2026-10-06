import {
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
import { ZodError, type z } from "zod";

import type { profiles } from "../db/schema";
import { type JobAnalysis, jobAnalysisSchema } from "./analysis";
import type { ExperienceWithCompany } from "./contributions";
import { coverLetterContentSchema } from "./cover-letter";
import { resumeContentSchema } from "./resume";

type Experience = ExperienceWithCompany;
type Profile = typeof profiles.$inferSelect;

const structuredOutputAttempts = 2;

export class StructuredOutputError extends Error {
  constructor(options: { cause: unknown }) {
    super("AI response did not match the expected structure.", options);
    this.name = "StructuredOutputError";
  }
}

function isSchemaFailure(error: unknown): boolean {
  return (
    error instanceof ZodError ||
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  );
}

export async function generateStructured<Schema extends z.ZodType>(input: {
  model: LanguageModel;
  schema: Schema;
  system: string;
  prompt: string;
}): Promise<z.output<Schema>> {
  let lastFailure: unknown;
  for (let attempt = 0; attempt < structuredOutputAttempts; attempt++) {
    try {
      const { output } = await generateText({
        model: input.model,
        output: Output.object({ schema: input.schema }),
        system: input.system,
        prompt: input.prompt,
      });
      return input.schema.parse(output);
    } catch (error) {
      if (!isSchemaFailure(error)) throw error;
      lastFailure = error;
    }
  }
  throw new StructuredOutputError({ cause: lastFailure });
}

export async function analyzeJob(input: {
  model: LanguageModel;
  jobDescription: string;
  profile: Profile | undefined;
  experiences: Experience[];
}): Promise<JobAnalysis> {
  const evidence = input.experiences.map((experience) => ({
    id: experience.id,
    company: experience.company,
    position: experience.position,
    startDate: experience.startDate,
    endDate: experience.endDate,
    isCurrent: experience.isCurrent,
    markdown: experience.markdown,
  }));

  return generateStructured({
    model: input.model,
    schema: jobAnalysisSchema,
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
}

export async function generateResume(input: {
  model: LanguageModel;
  account: { name: string; email: string };
  profile: Profile | undefined;
  experiences: Experience[];
  analysis: JobAnalysis;
}) {
  return generateStructured({
    model: input.model,
    schema: resumeContentSchema,
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
}

export async function generateCoverLetter(input: {
  model: LanguageModel;
  profile: Profile | undefined;
  experiences: Experience[];
  analysis: JobAnalysis;
  application: {
    companyName: string;
    position: string;
    location: string;
    jobDescription: string;
  };
}) {
  return generateStructured({
    model: input.model,
    schema: coverLetterContentSchema,
    system: [
      "Write a concise, specific cover letter from verified evidence only.",
      "Never invent metrics, tools, skills, employers, positions, dates, or personal motivations.",
      "State nothing about the company beyond what the job description says.",
      "Every body paragraph must cite sourceExperienceIds from supplied evidence.",
      "Use two to four body paragraphs in plain professional language without placeholders.",
      "Recipient is a greeting line such as the hiring team at the company; do not guess a person's name.",
      "Do not claim missing skills.",
    ].join(" "),
    prompt: JSON.stringify({
      targetJob: {
        position: input.application.position,
        companyName: input.application.companyName,
        location: input.application.location,
        jobDescription: input.application.jobDescription,
        analysis: input.analysis,
      },
      candidate: {
        fullName: input.profile?.fullName ?? "",
        headline: input.profile?.headline ?? "",
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
}
