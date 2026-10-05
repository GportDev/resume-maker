import { z } from "zod";
import { requireUser } from "../lib/auth.server";
import { markdownFileName } from "../lib/contributions";
import { getExperience } from "../lib/repositories.server";
import type { Route } from "./+types/contribution-download";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const experienceId = z.uuid().safeParse(params.experienceId);
  const experience = experienceId.success
    ? await getExperience(user.id, experienceId.data)
    : undefined;
  if (!experience) {
    throw new Response("Contribution file not found.", { status: 404 });
  }
  return new Response(experience.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${markdownFileName(experience.company, experience.position)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
