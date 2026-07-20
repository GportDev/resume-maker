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

export function applyResumeEdits(
  content: ResumeContent,
  input: {
    title: string;
    summary: string;
    skills: string[];
    bullets: string[];
  },
): ResumeContent {
  let bulletIndex = 0;
  return resumeContentSchema.parse({
    ...content,
    targetTitle: input.title,
    summary: input.summary,
    skills: input.skills,
    experiences: content.experiences.map((experience) => ({
      ...experience,
      bullets: experience.bullets.map((bullet) => ({
        ...bullet,
        text: input.bullets[bulletIndex++] ?? bullet.text,
      })),
    })),
  });
}
