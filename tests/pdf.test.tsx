import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { ResumePdfDocument } from "../app/components/resume-pdf";
import type { ResumeContent } from "../app/lib/resume";

const content: ResumeContent = {
  targetTitle: "Software Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "London",
    website: "",
    linkedin: "",
  },
  summary:
    "Software engineer delivering reliable systems and measurable results.",
  skills: ["TypeScript"],
  experiences: [
    {
      experienceId: "11111111-1111-4111-8111-111111111111",
      company: "Acme",
      position: "Engineer",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      bullets: [
        {
          text: "Built reliable services for business-critical workflows.",
          sourceExperienceIds: ["11111111-1111-4111-8111-111111111111"],
        },
      ],
    },
  ],
};

describe("resume PDF", () => {
  it("renders a valid PDF document", async () => {
    const buffer = await renderToBuffer(
      <ResumePdfDocument content={content} />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1_000);
  });
});
