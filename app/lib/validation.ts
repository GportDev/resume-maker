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

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, "Company name is required.")
  .max(160);

export const companyInputSchema = z.object({
  name: companyNameSchema,
  website: optionalUrl.default(""),
  location: z.string().trim().max(120).default(""),
});

export const experienceMarkdownSchema = z
  .string()
  .trim()
  .min(20, "Write at least 20 characters of evidence.")
  .max(50_000);

export const experienceInputSchema = z
  .object({
    companyId: z.union([z.literal(""), z.uuid()]).default(""),
    newCompanyName: z.string().trim().max(160).default(""),
    position: z.string().trim().min(1).max(160),
    startDate: z.iso.date(),
    endDate: z.union([z.literal(""), z.iso.date()]).nullable(),
    isCurrent: z.boolean(),
    markdown: experienceMarkdownSchema,
  })
  .superRefine((value, context) => {
    if (!value.companyId && !value.newCompanyName) {
      context.addIssue({
        code: "custom",
        path: ["companyId"],
        message: "Choose a company or enter a new company name.",
      });
    }
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
  .transform(({ companyId, newCompanyName, ...value }) => ({
    ...value,
    company: companyId
      ? ({ kind: "existing", id: companyId } as const)
      : ({ kind: "new", name: newCompanyName } as const),
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
