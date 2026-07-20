import { auth } from "../lib/auth.server";
import type { Route } from "./+types/auth-api";

export async function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return auth.handler(request);
}
