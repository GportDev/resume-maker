import { z } from "zod";

import type { SalaryPeriod } from "./applications";
import { getServerEnv } from "./env.server";
import {
  htmlToPlainText,
  isLinkedInJobId,
  type JobListing,
  type JobSearchInput,
  type JobSearchPage,
  jobListingSalarySchema,
  jobListingSchema,
  jobListingsPageSize,
  maxListingDescriptionLength,
  maxSearchPage,
  type PostedWithin,
} from "./job-listings";

export type JobListingProviderId = "fantastic_jobs";

export type JobListingProvider = {
  id: JobListingProviderId;
  search(input: JobSearchInput): Promise<JobSearchPage>;
};

export class JobListingProviderError extends Error {
  readonly status?: number;

  constructor(status?: number, options?: ErrorOptions) {
    super("Job listing search failed.", options);
    this.name = "JobListingProviderError";
    this.status = status;
  }
}

type Logger = Pick<Console, "error" | "warn">;

export type FantasticJobsOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  logger?: Logger;
  now?: () => Date;
  timeoutMs?: number;
};

export const fantasticJobsHost = "linkedin-job-search-api.p.rapidapi.com";
const fantasticJobsTimeoutMs = 10_000;
const dayMs = 24 * 60 * 60 * 1000;

const timeFrames: Record<PostedWithin, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "6m",
};

const optionalText = z.string().nullish();
const optionalNumber = z.number().nullish();

export const fantasticJobRowSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  organization: optionalText,
  url: optionalText,
  date_posted: optionalText,
  locations_derived: z.array(z.string()).nullish(),
  location_type: optionalText,
  description_html: optionalText,
  description_text: optionalText,
  ai_salary_currency: optionalText,
  ai_salary_value: optionalNumber,
  ai_salary_min_value: optionalNumber,
  ai_salary_max_value: optionalNumber,
  ai_salary_unit_text: optionalText,
  ai_work_arrangement: optionalText,
  linkedin_id: z.union([z.number().int().nonnegative(), z.string()]).nullish(),
});

export type FantasticJobRow = z.infer<typeof fantasticJobRowSchema>;

const linkedInViewUrlPattern =
  /^https:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d+)\/?(?:[?#].*)?$/i;

function linkedInIdFromRow(row: FantasticJobRow): string | null {
  const direct =
    row.linkedin_id === null || row.linkedin_id === undefined
      ? ""
      : String(row.linkedin_id).trim();
  if (isLinkedInJobId(direct)) return direct;
  const fromUrl = row.url?.match(linkedInViewUrlPattern)?.[1];
  return fromUrl && isLinkedInJobId(fromUrl) ? fromUrl : null;
}

const salaryUnits: Record<string, SalaryPeriod> = {
  YEAR: "year",
  MONTH: "month",
  HOUR: "hour",
};

function salaryAmount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function salaryFromRow(row: FantasticJobRow): JobListing["salary"] {
  const period = salaryUnits[row.ai_salary_unit_text?.toUpperCase() ?? ""];
  if (!period) return null;
  const single = salaryAmount(row.ai_salary_value);
  const parsed = jobListingSalarySchema.safeParse({
    min: salaryAmount(row.ai_salary_min_value) ?? single,
    max: salaryAmount(row.ai_salary_max_value) ?? single,
    currency: row.ai_salary_currency?.trim().toUpperCase() ?? "",
    period,
  });
  return parsed.success ? parsed.data : null;
}

const utcOffsetPattern = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

function postedAtFromRow(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const date = new Date(
    utcOffsetPattern.test(trimmed) ? trimmed : `${trimmed}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const workArrangements = new Set([
  "On-site",
  "Hybrid",
  "Remote OK",
  "Remote Solely",
]);

function singleLine(value: string): string {
  return htmlToPlainText(value).replace(/\s+/g, " ").trim();
}

function locationFromRow(row: FantasticJobRow): string {
  const locations = [
    ...new Set(
      (row.locations_derived ?? []).map((location) => singleLine(location)),
    ),
  ].filter(Boolean);
  if (locations.length) return locations.join("; ").slice(0, 500);
  return row.location_type === "TELECOMMUTE" ? "Remote" : "";
}

function descriptionFromRow(row: FantasticJobRow): string {
  const text = row.description_html
    ? htmlToPlainText(row.description_html)
    : (row.description_text ?? "").replace(/\r\n?/g, "\n").trim();
  return text.slice(0, maxListingDescriptionLength);
}

export function toJobListing(row: FantasticJobRow): JobListing | null {
  const externalId = linkedInIdFromRow(row);
  if (!externalId) return null;
  const arrangement = row.ai_work_arrangement?.trim() ?? "";
  const parsed = jobListingSchema.safeParse({
    externalId,
    title: singleLine(row.title).slice(0, 500),
    company: singleLine(row.organization ?? "").slice(0, 500),
    location: locationFromRow(row),
    description: descriptionFromRow(row),
    salary: salaryFromRow(row),
    postedAt: postedAtFromRow(row.date_posted),
    workArrangement: workArrangements.has(arrangement) ? arrangement : null,
  });
  return parsed.success ? parsed.data : null;
}

export function parseFantasticJobsResponse(json: unknown): {
  listings: JobListing[];
  rowCount: number;
  dropped: number;
} {
  const rows = z.array(z.unknown()).parse(json);
  const listings: JobListing[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = fantasticJobRowSchema.safeParse(row);
    const listing = parsed.success ? toJobListing(parsed.data) : null;
    if (!listing || seen.has(listing.externalId)) continue;
    seen.add(listing.externalId);
    listings.push(listing);
  }
  return {
    listings,
    rowCount: rows.length,
    dropped: rows.length - listings.length,
  };
}

export function buildFantasticJobsUrl(input: JobSearchInput, now: Date): URL {
  const url = new URL(`https://${fantasticJobsHost}/active-jb`);
  const params = url.searchParams;
  params.set("time_frame", timeFrames[input.postedWithin]);
  if (input.postedWithin === "30d") {
    params.set(
      "date_posted_gte",
      new Date(now.getTime() - 30 * dayMs).toISOString().slice(0, 19),
    );
  }
  params.set("title", input.keywords);
  if (input.location) params.set("location", input.location);
  if (input.remote)
    params.set("ai_work_arrangement", "Remote OK,Remote Solely");
  params.set("description_format", "html");
  params.set("limit", String(jobListingsPageSize));
  params.set("offset", String((input.page - 1) * jobListingsPageSize));
  return url;
}

export function createFantasticJobsProvider(
  options: FantasticJobsOptions,
): JobListingProvider {
  const fetchImpl = options.fetch ?? fetch;
  const logger = options.logger ?? console;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? fantasticJobsTimeoutMs;

  function fail(status?: number, cause?: unknown): never {
    logger.error("Job listing search failed", {
      provider: "fantastic_jobs",
      status: status ?? null,
    });
    throw new JobListingProviderError(
      status,
      cause === undefined ? undefined : { cause },
    );
  }

  return {
    id: "fantastic_jobs",
    async search(input) {
      let response: Response;
      try {
        response = await fetchImpl(buildFantasticJobsUrl(input, now()), {
          method: "GET",
          headers: {
            "x-rapidapi-key": options.apiKey,
            "x-rapidapi-host": fantasticJobsHost,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        return fail(undefined, error);
      }

      if (!response.ok) {
        await response.body?.cancel();
        return fail(response.status);
      }

      let parsed: ReturnType<typeof parseFantasticJobsResponse>;
      try {
        parsed = parseFantasticJobsResponse(await response.json());
      } catch (error) {
        return fail(response.status, error);
      }
      if (parsed.dropped > 0) {
        logger.warn("Job listing rows skipped", {
          provider: "fantastic_jobs",
          dropped: parsed.dropped,
        });
      }
      return {
        listings: parsed.listings,
        hasMore:
          parsed.rowCount >= jobListingsPageSize && input.page < maxSearchPage,
      };
    },
  };
}

export function isJobListingsConfigured(): boolean {
  return Boolean(getServerEnv().RAPIDAPI_KEY);
}

export function getJobListingProvider(): JobListingProvider | null {
  const env = getServerEnv();
  if (!env.RAPIDAPI_KEY) return null;
  switch (env.JOB_LISTINGS_PROVIDER) {
    case "fantastic_jobs":
      return createFantasticJobsProvider({ apiKey: env.RAPIDAPI_KEY });
  }
}
