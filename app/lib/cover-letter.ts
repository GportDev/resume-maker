import { z } from "zod";

export const coverLetterContentSchema = z.object({
  recipient: z.string().min(1).max(200),
  opening: z.string().min(20).max(1_200),
  bodyParagraphs: z
    .array(
      z.object({
        text: z.string().min(40).max(1_500),
        sourceExperienceIds: z.array(z.uuid()).min(1).max(5),
      }),
    )
    .min(1)
    .max(5),
  closing: z.string().min(10).max(800),
});

export type CoverLetterContent = z.infer<typeof coverLetterContentSchema>;

export function sanitizeCoverLetterEvidence(
  content: CoverLetterContent,
  ownedExperienceIds: Set<string>,
): CoverLetterContent {
  return coverLetterContentSchema.parse({
    ...content,
    bodyParagraphs: content.bodyParagraphs
      .map((paragraph) => ({
        ...paragraph,
        sourceExperienceIds: paragraph.sourceExperienceIds.filter((id) =>
          ownedExperienceIds.has(id),
        ),
      }))
      .filter((paragraph) => paragraph.sourceExperienceIds.length > 0),
  });
}

export const coverLetterEditSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  recipient: z.string().trim().min(1, "Recipient is required.").max(200),
  opening: z
    .string()
    .trim()
    .min(20, "Opening must be at least 20 characters.")
    .max(1_200),
  paragraphs: z
    .array(
      z
        .string()
        .trim()
        .min(40, "Each paragraph must be at least 40 characters.")
        .max(1_500),
    )
    .min(1)
    .max(5),
  closing: z
    .string()
    .trim()
    .min(10, "Closing must be at least 10 characters.")
    .max(800),
});

export type CoverLetterEdit = z.output<typeof coverLetterEditSchema>;

export function applyCoverLetterEdits(
  content: CoverLetterContent,
  input: Omit<CoverLetterEdit, "title">,
): CoverLetterContent {
  return coverLetterContentSchema.parse({
    recipient: input.recipient,
    opening: input.opening,
    bodyParagraphs: content.bodyParagraphs.map((paragraph, index) => ({
      ...paragraph,
      text: input.paragraphs[index] ?? paragraph.text,
    })),
    closing: input.closing,
  });
}