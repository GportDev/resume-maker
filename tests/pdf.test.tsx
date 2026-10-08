import { inflateSync } from "node:zlib";

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { CoverLetterPdfDocument } from "../app/components/cover-letter-pdf";
import { ResumePdfDocument } from "../app/components/resume-pdf";
import type { CoverLetterContent } from "../app/lib/cover-letter";
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

const coverLetter: CoverLetterContent = {
  recipient: "Hiring team at Globex",
  opening:
    "I am applying for the Senior Engineer role at Globex to build reliable services.",
  bodyParagraphs: [
    {
      text: "At Acme I built reliable services for business-critical workflows.",
      sourceExperienceIds: ["11111111-1111-4111-8111-111111111111"],
    },
  ],
  closing: "Thank you for your time and consideration.",
};

function extractText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const chunks: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = Buffer.from(match[1] ?? "", "latin1");
    const isZlib = body[0] === 0x78;
    chunks.push((isZlib ? inflateSync(body) : body).toString("latin1"));
  }
  const content = chunks.join("\n");
  const hexRuns = [...content.matchAll(/<([0-9a-fA-F]+)>/g)].map((run) =>
    Buffer.from(run[1] ?? "", "hex").toString("latin1"),
  );
  const literalRuns = [...content.matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(
    (run) => run[1] ?? "",
  );
  return [...hexRuns, ...literalRuns].join("");
}

describe("cover letter PDF", () => {
  it("renders selectable letter text", async () => {
    const buffer = await renderToBuffer(
      <CoverLetterPdfDocument
        content={coverLetter}
        sender={{
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          phone: "",
          location: "London",
        }}
        date="January 1, 2026"
        title="Cover letter: Senior Engineer at Globex"
      />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    const text = extractText(buffer);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Hiring team at Globex");
    expect(text).toContain("business-critical workflows");
    expect(text).toContain("Thank you for your time");
  });
});

describe("resume PDF", () => {
  it("renders a valid PDF document", async () => {
    const buffer = await renderToBuffer(
      <ResumePdfDocument content={content} />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1_000);
  });
});
