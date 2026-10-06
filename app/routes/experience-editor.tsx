import { redirect } from "react-router";
import type { Route } from "./+types/experience-editor";

export function loader({ request, params }: Route.LoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(
    `/contributions/${encodeURIComponent(params.experienceId)}${search}`,
    301,
  );
}
