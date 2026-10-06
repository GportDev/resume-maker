import { describe, expect, it } from "vitest";

import {
  companyInputSchema,
  experienceInputSchema,
  experienceMarkdownSchema,
} from "../app/lib/validation";

const companyId = "11111111-1111-4111-8111-111111111111";

const validExperience = {
  companyId,
  newCompanyName: "",
  position: "Engineer",
  startDate: "2024-01-01",
  endDate: "2025-01-01",
  isCurrent: false,
  markdown: "Built a reliable system that reduced processing time by 30%.",
};

describe("experience validation", () => {
  it("rejects an end date before start date", () => {
    const result = experienceInputSchema.safeParse({
      ...validExperience,
      endDate: "2023-12-01",
    });
    expect(result.success).toBe(false);
  });

  it("requires an end date for a past role", () => {
    const result = experienceInputSchema.safeParse({
      ...validExperience,
      endDate: "",
    });
    expect(result.success).toBe(false);
  });

  it("clears the end date for a current role", () => {
    const result = experienceInputSchema.parse({
      ...validExperience,
      isCurrent: true,
    });
    expect(result.endDate).toBeNull();
  });

  it("requires useful evidence content", () => {
    const result = experienceInputSchema.safeParse({
      ...validExperience,
      markdown: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("maps a selected company to an existing-company choice", () => {
    const result = experienceInputSchema.parse(validExperience);
    expect(result.company).toEqual({ kind: "existing", id: companyId });
    expect(result).not.toHaveProperty("companyId");
  });

  it("prefers the selected company over a typed new name", () => {
    const result = experienceInputSchema.parse({
      ...validExperience,
      newCompanyName: "Ignored Inc",
    });
    expect(result.company).toEqual({ kind: "existing", id: companyId });
  });

  it("maps a trimmed new company name when no company is selected", () => {
    const result = experienceInputSchema.parse({
      ...validExperience,
      companyId: "",
      newCompanyName: "  Globex  ",
    });
    expect(result.company).toEqual({ kind: "new", name: "Globex" });
  });

  it("requires a company selection or a new company name", () => {
    const result = experienceInputSchema.safeParse({
      ...validExperience,
      companyId: "",
      newCompanyName: "   ",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["companyId"]);
  });

  it("rejects a company id that is not a UUID", () => {
    const result = experienceInputSchema.safeParse({
      ...validExperience,
      companyId: "acme",
    });
    expect(result.success).toBe(false);
  });
});

describe("experience Markdown validation", () => {
  it("trims and accepts evidence of useful length", () => {
    expect(
      experienceMarkdownSchema.parse("  Shipped billing migration safely.  "),
    ).toBe("Shipped billing migration safely.");
  });

  it("rejects whitespace-padded short evidence", () => {
    expect(
      experienceMarkdownSchema.safeParse(`   short${" ".repeat(30)}`).success,
    ).toBe(false);
  });

  it("rejects evidence above the size limit", () => {
    expect(experienceMarkdownSchema.safeParse("a".repeat(50_001)).success).toBe(
      false,
    );
  });
});

describe("company validation", () => {
  it("trims the name and defaults optional fields", () => {
    expect(companyInputSchema.parse({ name: "  Acme  " })).toEqual({
      name: "Acme",
      website: "",
      location: "",
    });
  });

  it("requires a non-blank name", () => {
    expect(companyInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an invalid website", () => {
    expect(
      companyInputSchema.safeParse({ name: "Acme", website: "not a url" })
        .success,
    ).toBe(false);
  });
});
