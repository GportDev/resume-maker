import { z } from "zod";

export const resumeContentSchema = z.object({
  targetTitle: z.string().min(1).max(160),
  contact: z.object({
    fullName: z.string().min(1).max(120),
    email: z.string().max(200),
    phone: z.string().max(40),
    location: z.string().max(120),
    website: z.string().max(300),
    linkedin: z.string().max(300),
  }),
  summary: z.string().min(20).max(1_200),
  skills: z.array(z.string().min(1).max(100)).max(40),
  experiences: z
    .array(
      z.object({
        experienceId: z.uuid(),
        company: z.string().min(1).max(160),
        position: z.string().min(1).max(160),
        startDate: z.iso.date(),
        endDate: z.iso.date().nullable(),
        isCurrent: z.boolean(),
        bullets: z
          .array(
            z.object({
              text: z.string().min(10).max(500),
              sourceExperienceIds: z.array(z.uuid()).min(1).max(5),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(12),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;

export function sanitizeResumeEvidence(
  content: ResumeContent,
  ownedExperienceIds: Set<string>,
): ResumeContent {
  return resumeContentSchema.parse({
    ...content,
    experiences: content.experiences
      .filter((experience) => ownedExperienceIds.has(experience.experienceId))
      .map((experience) => ({
        ...experience,
        bullets: experience.bullets
          .map((bullet) => ({
            ...bullet,
            sourceExperienceIds: bullet.sourceExperienceIds.filter((id) =>
              ownedExperienceIds.has(id),
            ),
          }))
          .filter((bullet) => bullet.sourceExperienceIds.length > 0),
      }))
      .filter((experience) => experience.bullets.length > 0),
  });
}

export const resumeEditSchema = z.object({
  title: z.string().trim().min(1, "Target title is required.").max(160),
  summary: z
    .string()
    .trim()
    .min(20, "Summary must be at least 20 characters.")
    .max(1_200),
  skills: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Add at least one skill.")
    .max(40),
  bullets: z
    .array(
      z.object({
        experienceIndex: z.number().int().min(0),
        sourceIndex: z.number().int().min(0),
        text: z
          .string()
          .trim()
          .min(10, "Each bullet must be at least 10 characters.")
          .max(500),
      }),
    )
    .min(1)
    .max(96),
});

export type ResumeEdit = z.output<typeof resumeEditSchema>;

/** Pairs posted bullet texts with their "experience:bullet" source refs. */
export function readBulletFields(
  refs: FormDataEntryValue[],
  texts: FormDataEntryValue[],
): { experienceIndex: number; sourceIndex: number; text: string }[] {
  return texts.map((text, index) => {
    const [experienceIndex, sourceIndex] = String(refs[index] ?? "")
      .split(":")
      .map((part) => Number.parseInt(part, 10));
    return {
      experienceIndex: experienceIndex ?? -1,
      sourceIndex: sourceIndex ?? -1,
      text: String(text),
    };
  });
}

export class ResumeEditError extends Error {}

/**
 * Applies edited text, order, and removals. Each bullet keeps the citations
 * of the generated bullet it came from; new bullets cannot be added, and a
 * bullet cannot move to another position.
 */
export function applyResumeEdits(
  content: ResumeContent,
  input: ResumeEdit,
): ResumeContent {
  const seen = new Set<string>();
  const byExperience = content.experiences.map(
    () => [] as typeof input.bullets,
  );
  for (const bullet of input.bullets) {
    const key = `${bullet.experienceIndex}:${bullet.sourceIndex}`;
    const source =
      content.experiences[bullet.experienceIndex]?.bullets[bullet.sourceIndex];
    if (!source || seen.has(key)) {
      throw new ResumeEditError("A bullet no longer matches its source.");
    }
    seen.add(key);
    byExperience[bullet.experienceIndex]?.push(bullet);
  }
  const experiences = content.experiences.map((experience, index) => {
    const bullets = byExperience[index] ?? [];
    if (!bullets.length) {
      throw new ResumeEditError(
        `Keep at least one bullet for ${experience.position}.`,
      );
    }
    return {
      ...experience,
      bullets: bullets.map((bullet) => ({
        text: bullet.text,
        sourceExperienceIds:
          experience.bullets[bullet.sourceIndex]?.sourceExperienceIds ?? [],
      })),
    };
  });
  return resumeContentSchema.parse({
    ...content,
    targetTitle: input.title,
    summary: input.summary,
    skills: input.skills,
    experiences,
  });
}
