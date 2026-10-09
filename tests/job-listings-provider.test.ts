import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvForTests } from "../app/lib/env.server";
import type { JobSearchInput } from "../app/lib/job-listings";
import {
  buildFantasticJobsUrl,
  createFantasticJobsProvider,
  fantasticJobsHost,
  getJobListingProvider,
  JobListingProviderError,
  parseFantasticJobsResponse,
} from "../app/lib/job-listings.server";

const fixture: unknown = JSON.parse(
  readFileSync(
    new URL("./fixtures/fantastic-jobs-active-jb.json", import.meta.url),
    "utf8",
  ),
);

const input: JobSearchInput = {
  keywords: "frontend engineer",
  location: "",
  postedWithin: "7d",
  remote: false,
  page: 1,
};

const now = new Date("2026-10-08T12:00:00Z");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(respond: (url: URL, init?: RequestInit) => Promise<Response>) {
  const logger = { error: vi.fn(), warn: vi.fn() };
  const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) =>
    respond(new URL(String(url)), init),
  );
  const provider = createFantasticJobsProvider({
    apiKey: "rapid-secret-key",
    fetch: fetchMock as typeof fetch,
    logger,
    now: () => now,
  });
  return { provider, fetchMock, logger };
}

describe("parseFantasticJobsResponse", () => {
  const parsed = parseFantasticJobsResponse(fixture);

  it("keeps rows with a LinkedIn ID, drops invalid and duplicate rows", () => {
    expect(parsed.rowCount).toBe(8);
    expect(parsed.listings.map((listing) => listing.externalId)).toEqual([
      "4012345678",
      "4099999999",
      "4011111111",
      "4022222222",
    ]);
    expect(parsed.dropped).toBe(4);
  });

  it("normalizes a full row to plain text", () => {
    expect(parsed.listings[0]).toEqual({
      externalId: "4012345678",
      title: "Senior Frontend Engineer & Design Systems",
      company: "Globex",
      location: "Berlin, Berlin, Germany",
      description:
        "Build TypeScript & React apps.\n\n- Own the design system\n- Ship accessible UI <fast>",
      salary: { min: 80_000, max: 95_000, currency: "EUR", period: "year" },
      postedAt: "2026-10-06T09:30:00.000Z",
      workArrangement: "Remote OK",
    });
  });

  it("reads the ID from a LinkedIn URL and marks telecommute jobs remote", () => {
    expect(parsed.listings[1]).toMatchObject({
      externalId: "4099999999",
      location: "Remote",
      description: "Run Terraform\nand Kubernetes.",
      salary: { min: 60, max: 60, currency: "USD", period: "hour" },
      postedAt: "2026-10-05T12:00:00.000Z",
      workArrangement: "Remote Solely",
    });
  });

  it("drops unsupported salary units, inverted ranges, bad dates, and unknown arrangements", () => {
    expect(parsed.listings[2]).toMatchObject({
      salary: null,
      postedAt: null,
      workArrangement: null,
    });
    expect(parsed.listings[3]?.salary).toBeNull();
  });

  it("rejects a non-array body", () => {
    expect(() => parseFantasticJobsResponse({ jobs: [] })).toThrow();
  });
});

describe("buildFantasticJobsUrl", () => {
  it("maps filters to Fantastic.jobs parameters", () => {
    const url = buildFantasticJobsUrl(
      {
        keywords: "data engineer",
        location: "Berlin, Germany",
        postedWithin: "24h",
        remote: true,
        page: 3,
      },
      now,
    );
    expect(url.origin + url.pathname).toBe(
      `https://${fantasticJobsHost}/active-jb`,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      time_frame: "24h",
      title: "data engineer",
      location: "Berlin, Germany",
      ai_work_arrangement: "Remote OK,Remote Solely",
      description_format: "html",
      limit: "25",
      offset: "50",
    });
  });

  it("uses the 6m window with a posted-date floor for 30 days", () => {
    const url = buildFantasticJobsUrl(
      { ...input, postedWithin: "30d" },
      now,
      "http://127.0.0.1:4010",
    );
    expect(url.origin).toBe("http://127.0.0.1:4010");
    expect(url.searchParams.get("time_frame")).toBe("6m");
    expect(url.searchParams.get("date_posted_gte")).toBe("2026-09-08T12:00:00");
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("ai_work_arrangement")).toBe(false);
  });
});

describe("createFantasticJobsProvider", () => {
  it("sends RapidAPI headers and returns normalized listings", async () => {
    const { provider, fetchMock } = setup(async () => jsonResponse(fixture));

    const page = await provider.search(input);

    expect(page.listings).toHaveLength(4);
    expect(page.hasMore).toBe(false);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      "x-rapidapi-key": "rapid-secret-key",
      "x-rapidapi-host": fantasticJobsHost,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports more pages only for a full page below the page cap", async () => {
    const row = {
      id: 1,
      title: "Engineer",
      linkedin_id: 4000000000,
    };
    const fullPage = Array.from({ length: 25 }, (_, index) => ({
      ...row,
      id: index,
      linkedin_id: 4000000000 + index,
    }));
    const { provider } = setup(async () => jsonResponse(fullPage));
    await expect(provider.search(input)).resolves.toMatchObject({
      hasMore: true,
    });
    await expect(
      provider.search({ ...input, page: 20 }),
    ).resolves.toMatchObject({ hasMore: false });
  });

  it.each([401, 403, 429, 500])(
    "turns HTTP %i into a generic error and logs only the status",
    async (status) => {
      const { provider, logger } = setup(
        async () => new Response("upstream body with user data", { status }),
      );

      const error = await provider.search(input).catch((caught) => caught);

      expect(error).toBeInstanceOf(JobListingProviderError);
      expect(error.message).toBe("Job listing search failed.");
      expect(error.status).toBe(status);
      expect(logger.error).toHaveBeenCalledWith("Job listing search failed", {
        provider: "fantastic_jobs",
        status,
      });
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        "upstream body",
      );
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        "rapid-secret-key",
      );
    },
  );

  it("wraps network failures", async () => {
    const { provider, logger } = setup(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await provider.search(input).catch((caught) => caught);
    expect(error).toBeInstanceOf(JobListingProviderError);
    expect(error.status).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("Job listing search failed", {
      provider: "fantastic_jobs",
      status: null,
    });
  });

  it("times out slow responses", async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const provider = createFantasticJobsProvider({
      apiKey: "rapid-secret-key",
      logger,
      timeoutMs: 20,
      fetch: ((_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        })) as typeof fetch,
    });

    const error = await provider.search(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(JobListingProviderError);
    expect((error.cause as Error).name).toBe("TimeoutError");
  });

  it.each([
    ["non-JSON", new Response("<html>", { status: 200 })],
    ["non-array", jsonResponse({ data: [] })],
  ])("rejects a %s body", async (_label, response) => {
    const { provider } = setup(async () => response);
    await expect(provider.search(input)).rejects.toBeInstanceOf(
      JobListingProviderError,
    );
  });

  it("warns with only a count when rows are skipped", async () => {
    const { provider, logger } = setup(async () => jsonResponse(fixture));
    await provider.search(input);
    expect(logger.warn).toHaveBeenCalledWith("Job listing rows skipped", {
      provider: "fantastic_jobs",
      dropped: 4,
    });
  });
});

describe("getJobListingProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvForTests();
  });

  function stubBaseEnv(rapidApiKey: string) {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/test");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:5173");
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "key");
    vi.stubEnv("RAPIDAPI_KEY", rapidApiKey);
    resetEnvForTests();
  }

  it("is not configured without a RapidAPI key", () => {
    stubBaseEnv("");
    expect(getJobListingProvider()).toBeNull();
  });

  it("builds the Fantastic.jobs provider with a key", () => {
    stubBaseEnv("rapid-secret-key");
    expect(getJobListingProvider()?.id).toBe("fantastic_jobs");
  });
});
