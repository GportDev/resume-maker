import { describe, expect, it } from "vitest";

import {
  formatPostedDate,
  htmlToPlainText,
  type JobListing,
  jobSearchPageHref,
  linkedInJobUrl,
  linkedInJobUrlOrNull,
  listingToApplicationInput,
  parseJobSearchParams,
  saveListingFormSchema,
} from "../app/lib/job-listings";

const listing: JobListing = {
  externalId: "4012345678",
  title: "Senior Frontend Engineer",
  company: "Globex",
  location: "Berlin, Germany",
  description: "Build TypeScript services.",
  salary: { min: 80_000, max: 95_000, currency: "EUR", period: "year" },
  postedAt: "2026-10-06T09:30:00.000Z",
  workArrangement: "Remote OK",
};

describe("htmlToPlainText", () => {
  it("strips tags, keeps paragraph and list breaks", () => {
    expect(
      htmlToPlainText(
        "<p>Build <strong>apps</strong>.</p><ul><li>One</li><li><p>Two</p></li></ul><p>End<br>line</p>",
      ),
    ).toBe("Build apps.\n\n- One\n- Two\n\nEnd\nline");
  });

  it("drops script, style, and comments with their content", () => {
    expect(
      htmlToPlainText(
        "<style>p{color:red}</style>Safe<script type='x'>alert(1)</script><!-- hidden --> text",
      ),
    ).toBe("Safe text");
  });

  it("decodes named and numeric entities exactly once", () => {
    expect(
      htmlToPlainText(
        "Tom &amp; Jerry &lt;b&gt; &#39;quoted&#39; &#x2014; &euro;5&nbsp;k &amp;lt;tag&amp;gt;",
      ),
    ).toBe("Tom & Jerry <b> 'quoted' — €5 k &lt;tag&gt;");
  });

  it("drops invalid code points and keeps unknown entities", () => {
    expect(htmlToPlainText("a&#0;b&#xD800;c&#1;d &bogus; &#x1F600;")).toBe(
      "abcd &bogus; 😀",
    );
  });

  it("leaves bare comparison text alone and collapses whitespace", () => {
    expect(htmlToPlainText("  salary < 100k\t\tand  3 > 2\n\n\n\nnext ")).toBe(
      "salary < 100k and 3 > 2\n\nnext",
    );
  });
});

describe("linkedInJobUrl", () => {
  it("builds the canonical job view URL from a numeric ID", () => {
    expect(linkedInJobUrl("4012345678")).toBe(
      "https://www.linkedin.com/jobs/view/4012345678",
    );
  });

  it.each(["", "abc", "12a", "../1", " 123", "123/../../evil", "1".repeat(21)])(
    "rejects %j",
    (id) => {
      expect(() => linkedInJobUrl(id)).toThrow(RangeError);
      expect(linkedInJobUrlOrNull(id)).toBeNull();
    },
  );

  it("returns null for missing IDs", () => {
    expect(linkedInJobUrlOrNull(null)).toBeNull();
    expect(linkedInJobUrlOrNull(undefined)).toBeNull();
  });
});

describe("parseJobSearchParams", () => {
  it("is idle without keywords", () => {
    expect(parseJobSearchParams(new URLSearchParams())).toMatchObject({
      status: "idle",
      values: { keywords: "", postedWithin: "7d", remote: false },
    });
  });

  it("applies defaults", () => {
    expect(
      parseJobSearchParams(new URLSearchParams({ keywords: "  engineer  " })),
    ).toEqual({
      status: "valid",
      values: {
        keywords: "  engineer  ",
        location: "",
        postedWithin: "7d",
        remote: false,
      },
      input: {
        keywords: "engineer",
        location: "",
        postedWithin: "7d",
        remote: false,
        page: 1,
      },
    });
  });

  it("parses every filter", () => {
    const result = parseJobSearchParams(
      new URLSearchParams({
        keywords: "data engineer",
        location: "Berlin, Germany",
        postedWithin: "30d",
        remote: "on",
        page: "3",
      }),
    );
    expect(result).toMatchObject({
      status: "valid",
      input: {
        location: "Berlin, Germany",
        postedWithin: "30d",
        remote: true,
        page: 3,
      },
    });
  });

  it.each([
    [{ keywords: "a" }, "keywords", "Enter at least 2 characters."],
    [{ keywords: "x".repeat(121) }, "keywords", "Use 120 characters or fewer."],
    [
      { keywords: "dev", location: "y".repeat(121) },
      "location",
      "Use 120 characters or fewer.",
    ],
    [
      { keywords: "dev", postedWithin: "90d" },
      "postedWithin",
      "Choose a posting window.",
    ],
    [{ keywords: "dev", page: "0" }, "page", "Choose a valid page."],
    [{ keywords: "dev", page: "1.5" }, "page", "Choose a valid page."],
    [{ keywords: "dev", page: "abc" }, "page", "Choose a valid page."],
    [{ keywords: "dev", page: "21" }, "page", "Results stop at page 20."],
  ])("reports %j as invalid", (params, field, message) => {
    expect(parseJobSearchParams(new URLSearchParams(params))).toMatchObject({
      status: "invalid",
      errors: { [field]: message },
    });
  });
});

describe("jobSearchPageHref", () => {
  it("keeps filters and omits page 1", () => {
    const input = {
      keywords: "frontend engineer",
      location: "Berlin, Germany",
      postedWithin: "24h" as const,
      remote: true,
      page: 2,
    };
    expect(jobSearchPageHref(input, 3)).toBe(
      "?keywords=frontend+engineer&postedWithin=24h&location=Berlin%2C+Germany&remote=on&page=3",
    );
    expect(
      jobSearchPageHref({ ...input, location: "", remote: false }, 1),
    ).toBe("?keywords=frontend+engineer&postedWithin=24h");
  });
});

describe("listingToApplicationInput", () => {
  it("maps a listing to a saved LinkedIn application", () => {
    expect(listingToApplicationInput(listing)).toEqual({
      input: {
        companyName: "Globex",
        position: "Senior Frontend Engineer",
        location: "Berlin, Germany",
        jobDescription: "Build TypeScript services.",
        salaryMin: 80_000,
        salaryMax: 95_000,
        salaryCurrency: "EUR",
        salaryPeriod: "year",
        status: "saved",
        sourceUrl: "https://www.linkedin.com/jobs/view/4012345678",
        notes: "",
        appliedAt: null,
      },
      origin: { source: "linkedin", externalId: "4012345678" },
    });
  });

  it("truncates long fields and fills a missing company", () => {
    const mapped = listingToApplicationInput({
      ...listing,
      title: "T".repeat(300),
      company: "",
      location: "L".repeat(300),
      salary: null,
    });
    expect(mapped?.input.position).toHaveLength(160);
    expect(mapped?.input.position.endsWith("…")).toBe(true);
    expect(mapped?.input.location).toHaveLength(160);
    expect(mapped?.input).toMatchObject({
      companyName: "Company not specified",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "USD",
      salaryPeriod: "year",
    });
  });

  it("refuses a non-numeric LinkedIn ID", () => {
    expect(
      listingToApplicationInput({ ...listing, externalId: "../evil" }),
    ).toBeNull();
  });
});

describe("saveListingFormSchema", () => {
  it("parses the posted listing JSON", () => {
    expect(
      saveListingFormSchema.parse({
        intent: "save-and-tailor",
        listing: JSON.stringify(listing),
      }),
    ).toEqual({ intent: "save-and-tailor", listing });
  });

  it.each([
    ["broken JSON", { intent: "save", listing: "{" }],
    [
      "tampered ID",
      {
        intent: "save",
        listing: JSON.stringify({ ...listing, externalId: "1 OR 1=1" }),
      },
    ],
    [
      "inverted salary",
      {
        intent: "save",
        listing: JSON.stringify({
          ...listing,
          salary: { ...listing.salary, min: 100_000, max: 1 },
        }),
      },
    ],
    ["unknown intent", { intent: "delete", listing: JSON.stringify(listing) }],
    ["missing listing", { intent: "save", listing: null }],
  ])("rejects %s", (_label, input) => {
    expect(saveListingFormSchema.safeParse(input).success).toBe(false);
  });
});

describe("formatPostedDate", () => {
  it("formats in UTC and ignores invalid dates", () => {
    expect(formatPostedDate("2026-10-06T23:30:00.000Z")).toBe("Oct 6, 2026");
    expect(formatPostedDate(null)).toBeNull();
    expect(formatPostedDate("nope")).toBeNull();
  });
});
