import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { CoverLetterPdfDocument } from "../components/cover-letter-pdf";
import { requireUser } from "../lib/auth.server";
import {
  coverLetterContentSchema,
  formatLetterDate,
  resolveCoverLetterSender,
} from "../lib/cover-letter";
import { getCoverLetter, getProfile } from "../lib/repositories.server";
import type { Route } from "./+types/cover-letter-pdf";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  if (!z.uuid().safeParse(params.coverLetterId).success) {
    throw new Response("Cover letter not found.", { status: 404 });
  }
  const [coverLetter, profile] = await Promise.all([
    getCoverLetter(user.id, params.coverLetterId),
    getProfile(user.id),
  ]);
  if (!coverLetter) {
    throw new Response("Cover letter not found.", { status: 404 });
  }

  const content = coverLetterContentSchema.parse(coverLetter.content);
  const sender = resolveCoverLetterSender(profile, user);
  const buffer = await renderToBuffer(
    <CoverLetterPdfDocument
      content={content}
      sender={sender}
      date={formatLetterDate(coverLetter.updatedAt)}
      title={coverLetter.title}
    />,
  );
  const fileName = `${sender.fullName}-${coverLetter.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName || "cover-letter"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
