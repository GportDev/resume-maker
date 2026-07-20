import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => !value || z.url().safeParse(value).success, {
    message: "Enter a valid URL.",
  });

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(160).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  website: optionalUrl.default(""),
  linkedin: optionalUrl.default(""),
});

export const experienceInputSchema = z
  .object({
    company: z.string().trim().min(1).max(160),
    position: z.string().trim().min(1).max(160),
    startDate: z.iso.date(),
    endDate: z.union([z.literal(""), z.iso.date()]).nullable(),
    isCurrent: z.boolean(),
    markdown: z.string().trim().min(20).max(50_000),
  })
  .superRefine((value, context) => {
    if (!value.isCurrent && !value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date is required for a past role.",
      });
    }
    if (!value.isCurrent && value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    endDate: value.isCurrent ? null : value.endDate || null,
  }));

export function firstFormError(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
