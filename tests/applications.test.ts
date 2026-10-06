import { describe, expect, it } from "vitest";

import {
  type ApplicationStatus,
  applicationInputSchema,
  applyPendingMove,
  computeSortOrder,
  formatSalaryRange,
  groupApplicationsByStatus,
  needsRebalance,
  parseMoveFormData,
  planMove,
  sortOrderStep,
} from "../app/lib/applications";

const validInput = {
  companyName: "Acme",
  position: "Staff Engineer",
};

const uuid = (digit: number) =>
  `${String(digit).repeat(8)}-${String(digit).repeat(4)}-4${String(digit).repeat(3)}-8${String(digit).repeat(3)}-${String(digit).repeat(12)}`;

describe("applicationInputSchema", () => {
  it("applies defaults for optional fields", () => {
    expect(applicationInputSchema.parse(validInput)).toEqual({
      companyName: "Acme",
      position: "Staff Engineer",
      location: "",
      jobDescription: "",
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      status: "saved",
      sourceUrl: null,
      notes: "",
      appliedAt: null,
    });
  });

  it("requires company name and position", () => {
    const result = applicationInputSchema.safeParse({
      companyName: "  ",
      position: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "companyName",
      "position",
    ]);
  });

  it("parses form salary strings, including separators", () => {
    const result = applicationInputSchema.parse({
      ...validInput,
      salaryMin: "120,000",
      salaryMax: " 150000 ",
    });
    expect(result.salaryMin).toBe(120_000);
    expect(result.salaryMax).toBe(150_000);
  });

  it("treats blank salary fields as empty", () => {
    const result = applicationInputSchema.parse({
      ...validInput,
      salaryMin: "",
      salaryMax: "",
    });
    expect(result.salaryMin).toBeNull();
    expect(result.salaryMax).toBeNull();
  });

  it("rejects a minimum above the maximum", () => {
    const result = applicationInputSchema.safeParse({
      ...validInput,
      salaryMin: "200000",
      salaryMax: "100000",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["salaryMax"]);
  });

  it("allows equal minimum and maximum", () => {
    expect(
      applicationInputSchema.safeParse({
        ...validInput,
        salaryMin: "90000",
        salaryMax: "90000",
      }).success,
    ).toBe(true);
  });

  it.each(["-1", "12.5", "abc", "100000001"])(
    "rejects invalid salary %s",
    (salaryMin) => {
      expect(
        applicationInputSchema.safeParse({ ...validInput, salaryMin }).success,
      ).toBe(false);
    },
  );

  it("uppercases a valid currency code", () => {
    expect(
      applicationInputSchema.parse({ ...validInput, salaryCurrency: "eur" })
        .salaryCurrency,
    ).toBe("EUR");
  });

  it.each(["US", "DOLLARS", "U$D", ""])("rejects currency %s", (code) => {
    expect(
      applicationInputSchema.safeParse({ ...validInput, salaryCurrency: code })
        .success,
    ).toBe(false);
  });

  it("rejects unknown status and period values", () => {
    expect(
      applicationInputSchema.safeParse({ ...validInput, status: "ghosted" })
        .success,
    ).toBe(false);
    expect(
      applicationInputSchema.safeParse({ ...validInput, salaryPeriod: "week" })
        .success,
    ).toBe(false);
  });

  it("accepts http(s) source links and rejects other schemes", () => {
    expect(
      applicationInputSchema.parse({
        ...validInput,
        sourceUrl: "https://jobs.example.com/1",
      }).sourceUrl,
    ).toBe("https://jobs.example.com/1");
    expect(
      applicationInputSchema.safeParse({
        ...validInput,
        sourceUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("validates applied date", () => {
    expect(
      applicationInputSchema.parse({ ...validInput, appliedAt: "2026-09-30" })
        .appliedAt,
    ).toBe("2026-09-30");
    expect(
      applicationInputSchema.safeParse({ ...validInput, appliedAt: "30/09" })
        .success,
    ).toBe(false);
  });
});

describe("formatSalaryRange", () => {
  it("returns null without salary values", () => {
    expect(formatSalaryRange(null, null, "USD", "year")).toBeNull();
  });

  it("formats a full range", () => {
    expect(formatSalaryRange(120_000, 150_000, "USD", "year")).toBe(
      "$120,000–$150,000/yr",
    );
  });

  it("formats a single value when min equals max", () => {
    expect(formatSalaryRange(8_000, 8_000, "EUR", "month")).toBe("€8,000/mo");
  });

  it("formats open-ended ranges", () => {
    expect(formatSalaryRange(60, null, "GBP", "hour")).toBe("From £60/hr");
    expect(formatSalaryRange(null, 95_000, "CAD", "year")).toBe(
      "Up to CA$95,000/yr",
    );
  });

  it("uses currency code for currencies without a symbol", () => {
    expect(formatSalaryRange(1_000, 2_000, "XYZ", "month")).toContain("XYZ");
  });
});

describe("computeSortOrder", () => {
  it("starts an empty column at one step", () => {
    expect(computeSortOrder()).toBe(sortOrderStep);
  });

  it("appends after the last card", () => {
    expect(computeSortOrder(3_000)).toBe(3_000 + sortOrderStep);
  });

  it("prepends before the first card", () => {
    expect(computeSortOrder(undefined, 1_000)).toBe(1_000 - sortOrderStep);
  });

  it("uses the midpoint between neighbours", () => {
    expect(computeSortOrder(1_000, 2_000)).toBe(1_500);
  });
});

describe("needsRebalance", () => {
  it("is false at column edges", () => {
    expect(needsRebalance(undefined, 1)).toBe(false);
    expect(needsRebalance(1, undefined)).toBe(false);
  });

  it("is false with a usable gap", () => {
    expect(needsRebalance(1, 2)).toBe(false);
  });

  it("is true when the gap is exhausted", () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(5, 5)).toBe(true);
  });

  it("stays false for many repeated midpoint insertions before exhaustion", () => {
    let after = 2;
    let insertions = 0;
    while (!needsRebalance(1, after)) {
      after = computeSortOrder(1, after);
      insertions += 1;
    }
    expect(insertions).toBeGreaterThan(15);
  });
});

describe("planMove", () => {
  const column = [
    { id: "a", sortOrder: 1_000 },
    { id: "b", sortOrder: 2_000 },
    { id: "c", sortOrder: 3_000 },
  ];

  it("appends without placement", () => {
    expect(planMove(column, "x", {})).toEqual({
      kind: "place",
      sortOrder: 3_000 + sortOrderStep,
    });
  });

  it("places before the after-neighbour", () => {
    expect(planMove(column, "x", { afterId: "b" })).toEqual({
      kind: "place",
      sortOrder: 1_500,
    });
  });

  it("places after the before-neighbour", () => {
    expect(planMove(column, "x", { beforeId: "c" })).toEqual({
      kind: "place",
      sortOrder: 3_000 + sortOrderStep,
    });
  });

  it("moves to the top", () => {
    expect(planMove(column, "c", { afterId: "a" })).toEqual({
      kind: "place",
      sortOrder: 1_000 - sortOrderStep,
    });
  });

  it("ignores the moving card when reordering within a column", () => {
    expect(planMove(column, "a", { beforeId: "b", afterId: "c" })).toEqual({
      kind: "place",
      sortOrder: 2_500,
    });
  });

  it("rejects unknown or inconsistent neighbours", () => {
    expect(planMove(column, "x", { afterId: "zzz" })).toEqual({
      kind: "invalid",
    });
    expect(planMove(column, "x", { beforeId: "zzz" })).toEqual({
      kind: "invalid",
    });
    expect(planMove(column, "x", { beforeId: "c", afterId: "a" })).toEqual({
      kind: "invalid",
    });
  });

  it("rebalances the column when neighbours have no gap", () => {
    const crowded = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 1 + 1e-9 },
    ];
    expect(planMove(crowded, "x", { beforeId: "a", afterId: "b" })).toEqual({
      kind: "rebalance",
      orders: [
        { id: "a", sortOrder: sortOrderStep },
        { id: "x", sortOrder: 2 * sortOrderStep },
        { id: "b", sortOrder: 3 * sortOrderStep },
      ],
    });
  });
});

type Card = { id: string; status: ApplicationStatus; sortOrder: number };

describe("groupApplicationsByStatus", () => {
  it("creates every column and orders cards by sort order", () => {
    const columns = groupApplicationsByStatus<Card>([
      { id: "late", status: "applied", sortOrder: 3 },
      { id: "early", status: "applied", sortOrder: 1 },
      { id: "s", status: "saved", sortOrder: 1 },
    ]);
    expect(Object.keys(columns)).toEqual([
      "saved",
      "applied",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ]);
    expect(columns.applied.map((card) => card.id)).toEqual(["early", "late"]);
    expect(columns.offer).toEqual([]);
  });
});

describe("applyPendingMove", () => {
  const columns = groupApplicationsByStatus<Card>([
    { id: "a", status: "saved", sortOrder: 1 },
    { id: "b", status: "saved", sortOrder: 2 },
    { id: "c", status: "applied", sortOrder: 1 },
  ]);

  it("moves a card to another column at the requested position", () => {
    const next = applyPendingMove(columns, {
      id: "a",
      status: "applied",
      afterId: "c",
    });
    expect(next.saved.map((card) => card.id)).toEqual(["b"]);
    expect(next.applied.map((card) => card.id)).toEqual(["a", "c"]);
    expect(next.applied[0]?.status).toBe("applied");
  });

  it("appends when no neighbour is given", () => {
    const next = applyPendingMove(columns, { id: "a", status: "applied" });
    expect(next.applied.map((card) => card.id)).toEqual(["c", "a"]);
  });

  it("reorders within a column", () => {
    const next = applyPendingMove(columns, {
      id: "a",
      status: "saved",
      beforeId: "b",
    });
    expect(next.saved.map((card) => card.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input and ignores unknown cards", () => {
    applyPendingMove(columns, { id: "a", status: "offer" });
    expect(columns.saved.map((card) => card.id)).toEqual(["a", "b"]);
    expect(applyPendingMove(columns, { id: "zzz", status: "offer" })).toBe(
      columns,
    );
  });
});

describe("parseMoveFormData", () => {
  it("parses a valid move and drops blank neighbours", () => {
    const formData = new FormData();
    formData.set("id", uuid(1));
    formData.set("status", "interviewing");
    formData.set("beforeId", "");
    formData.set("afterId", uuid(2));
    expect(parseMoveFormData(formData)).toEqual({
      id: uuid(1),
      status: "interviewing",
      beforeId: undefined,
      afterId: uuid(2),
    });
  });

  it("rejects invalid ids and statuses", () => {
    const badId = new FormData();
    badId.set("id", "1; drop table");
    badId.set("status", "saved");
    expect(parseMoveFormData(badId)).toBeNull();

    const badStatus = new FormData();
    badStatus.set("id", uuid(1));
    badStatus.set("status", "hired");
    expect(parseMoveFormData(badStatus)).toBeNull();
  });
});
