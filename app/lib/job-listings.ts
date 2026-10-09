import { z } from "zod";

import {
  type ApplicationInput,
  type ApplicationSource,
  applicationInputSchema,
  maxSalaryAmount,
  salaryPeriods,
} from "./applications";

export const postedWithinOptions = ["24h", "7d", "30d"] as const;
export type PostedWithin = (typeof postedWithinOptions)[number];

export const postedWithinLabels: Record<PostedWithin, string> = {
  "24h": "Past 24 hours",
  "7d": "Past week",
  "30d": "Past month",
};

export const jobListingsPageSize = 25;
export const maxSearchPage = 20;
export const maxListingDescriptionLength = 50_000;

const linkedInJobIdPattern = /^\d+$/;
const maxLinkedInJobIdLength = 20;

export function isLinkedInJobId(value: string): boolean {
  return (
    linkedInJobIdPattern.test(value) && value.length <= maxLinkedInJobIdLength
  );
}

export function linkedInJobUrl(id: string): string {
  if (!isLinkedInJobId(id)) {
    throw new RangeError("LinkedIn job ID must be numeric.");
  }
  return `https://www.linkedin.com/jobs/view/${id}`;
}

export function linkedInJobUrlOrNull(
  id: string | null | undefined,
): string | null {
  return id && isLinkedInJobId(id) ? linkedInJobUrl(id) : null;
}

const salaryAmount = z.number().int().min(0).max(maxSalaryAmount).nullable();

export const jobListingSalarySchema = z
  .object({
    min: salaryAmount,
    max: salaryAmount,
    currency: z.string().regex(/^[A-Z]{3}$/),
    period: z.enum(salaryPeriods),
  })
  .refine((salary) => salary.min !== null || salary.max !== null)
  .refine(
    (salary) =>
      salary.min === null || salary.max === null || salary.min <= salary.max,
  );

export const jobListingSchema = z.object({
  externalId: z.string().refine(isLinkedInJobId),
  title: z.string().trim().min(1).max(500),
  company: z.string().trim().max(500),
  location: z.string().trim().max(500),
  description: z.string().max(maxListingDescriptionLength),
  salary: jobListingSalarySchema.nullable(),
  postedAt: z.iso.datetime({ offset: true }).nullable(),
  workArrangement: z.string().trim().max(40).nullable(),
});

export type JobListing = z.infer<typeof jobListingSchema>;

export type JobSearchPage = {
  listings: JobListing[];
  hasMore: boolean;
};

const emptyToUndefined = (value: unknown) =>
  value === null || value === "" ? undefined : value;

export const jobSearchInputSchema = z.object({
  keywords: z
    .string({ error: "Enter keywords." })
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(120, "Use 120 characters or fewer."),
  location: z
    .string()
    .trim()
    .max(120, "Use 120 characters or fewer.")
    .default(""),
  postedWithin: z.preprocess(
    (value) => emptyToUndefined(value) ?? "7d",
    z.enum(postedWithinOptions, { error: "Choose a posting window." }),
  ),
  remote: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.boolean(),
  ),
  page: z.preprocess(
    (value) => (emptyToUndefined(value) === undefined ? 1 : Number(value)),
    z
      .number({ error: "Choose a valid page." })
      .int("Choose a valid page.")
      .min(1, "Choose a valid page.")
      .max(maxSearchPage, `Results stop at page ${maxSearchPage}.`),
  ),
});

export type JobSearchInput = z.output<typeof jobSearchInputSchema>;

export type JobSearchFormValues = {
  keywords: string;
  location: string;
  postedWithin: string;
  remote: boolean;
};

export type JobSearchParse =
  | { status: "idle"; values: JobSearchFormValues }
  | {
      status: "invalid";
      values: JobSearchFormValues;
      errors: Partial<Record<keyof JobSearchInput, string>>;
    }
  | { status: "valid"; values: JobSearchFormValues; input: JobSearchInput };

export function parseJobSearchParams(params: URLSearchParams): JobSearchParse {
  const raw = {
    keywords: params.get("keywords"),
    location: params.get("location") ?? undefined,
    postedWithin: params.get("postedWithin"),
    remote: params.get("remote"),
    page: params.get("page"),
  };
  const values: JobSearchFormValues = {
    keywords: raw.keywords ?? "",
    location: raw.location ?? "",
    postedWithin: raw.postedWithin ?? "7d",
    remote: raw.remote === "on" || raw.remote === "true",
  };
  if (raw.keywords === null) return { status: "idle", values };

  const parsed = jobSearchInputSchema.safeParse(raw);
  if (parsed.success) return { status: "valid", values, input: parsed.data };

  const errors: Partial<Record<keyof JobSearchInput, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in jobSearchInputSchema.shape) {
      const key = field as keyof JobSearchInput;
      errors[key] ??= issue.message;
    }
  }
  return { status: "invalid", values, errors };
}

export function jobSearchPageHref(input: JobSearchInput, page: number): string {
  const params = new URLSearchParams({
    keywords: input.keywords,
    postedWithin: input.postedWithin,
  });
  if (input.location) params.set("location", input.location);
  if (input.remote) params.set("remote", "on");
  if (page > 1) params.set("page", String(page));
  return `?${params.toString()}`;
}

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  trade: "™",
  copy: "©",
  reg: "®",
  euro: "€",
  pound: "£",
};

function isPrintableCodePoint(code: number): boolean {
  if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  if (code < 0x20) return code === 0x09 || code === 0x0a;
  return !(code >= 0x7f && code < 0xa0);
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/gi,
    (entity, body: string) => {
      if (body.startsWith("#")) {
        const hex = body[1] === "x" || body[1] === "X";
        const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        return isPrintableCodePoint(code) ? String.fromCodePoint(code) : "";
      }
      return namedEntities[body.toLowerCase()] ?? entity;
    },
  );
}

const blockTags =
  "p|div|section|article|header|footer|ul|ol|h[1-6]|tr|table|blockquote|pre";

export function htmlToPlainText(html: string): string {
  const withoutTags = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(new RegExp(`</?(?:${blockTags}|li)\\b[^>]*>`, "gi"), "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "");

  return decodeEntities(withoutTags)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/^-\n+(?=\S)/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value: string, length: number): string {
  const trimmed = value.trim();
  return trimmed.length > length
    ? `${trimmed.slice(0, length - 1).trimEnd()}…`
    : trimmed;
}

const unknownCompany = "Company not specified";

export type ListingApplication = {
  input: ApplicationInput;
  origin: { source: ApplicationSource; externalId: string };
};

export function listingToApplicationInput(
  listing: JobListing,
): ListingApplication {
  const input = applicationInputSchema.parse({
    companyName: truncate(listing.company, 160) || unknownCompany,
    position: truncate(listing.title, 160),
    location: truncate(listing.location, 160),
    jobDescription: listing.description.trim(),
    salaryMin: listing.salary?.min ?? null,
    salaryMax: listing.salary?.max ?? null,
    salaryCurrency: listing.salary?.currency ?? "USD",
    salaryPeriod: listing.salary?.period ?? "year",
    status: "saved",
    sourceUrl: linkedInJobUrl(listing.externalId),
    notes: "",
    appliedAt: "",
  });
  return {
    input,
    origin: { source: "linkedin", externalId: listing.externalId },
  };
}

export const saveListingIntents = ["save", "save-and-tailor"] as const;
export type SaveListingIntent = (typeof saveListingIntents)[number];

export const saveListingFormSchema = z.object({
  intent: z.enum(saveListingIntents),
  listing: z
    .string()
    .max(maxListingDescriptionLength * 4)
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: "custom", message: "Invalid listing." });
        return z.NEVER;
      }
    })
    .pipe(jobListingSchema),
});

export function formatPostedDate(postedAt: string | null): string | null {
  if (!postedAt) return null;
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}
