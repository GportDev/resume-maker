import { describe, expect, it } from "vitest";

import { experienceInputSchema } from "../app/lib/validation";

const validExperience = {
  company: "Acme",
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
});
