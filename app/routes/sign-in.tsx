import { redirect } from "react-router";
import { AuthForm } from "../components/auth-form";
import { getSession } from "../lib/auth.server";
import type { Route } from "./+types/sign-in";

export function meta() {
  return [{ title: "Sign in | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSession(request)) {
    throw redirect("/");
  }
  return null;
}

export default function SignIn() {
  return <AuthForm mode="sign-in" />;
}
