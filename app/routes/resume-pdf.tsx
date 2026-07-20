import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdfDocument } from "../components/resume-pdf";
import { requireUser } from "../lib/auth.server";
import { getResume } from "../lib/repositories.server";
import { resumeContentSchema } from "../lib/resume";
import type { Route } from "./+types/resume-pdf";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const resume = await getResume(user.id, params.resumeId);
  if (!resume) {
    throw new Response("Resume not found.", { status: 404 });
  }

  const content = resumeContentSchema.parse(resume.content);
  const buffer = await renderToBuffer(<ResumePdfDocument content={content} />);
  const fileName = `${content.contact.fullName}-${content.targetTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName || "resume"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
