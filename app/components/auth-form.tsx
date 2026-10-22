import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { authClient } from "../lib/auth-client";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const redirectTo = searchParams.get("redirectTo");
    const safeRedirect =
      redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
        ? redirectTo
        : "/";

    const result = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Authentication failed.");
      return;
    }

    navigate(safeRedirect, { replace: true });
  }

  return (
    <main
      id="main"
      className="grid min-h-screen place-items-center bg-field px-4 py-12 text-ink"
    >
      <section className="w-full max-w-md rounded-3xl border border-rule bg-sheet p-8 shadow-2xl shadow-sheet">
        <Link to="/" className="text-sm font-semibold text-exhibit">
          Resume Fit
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {isSignUp
            ? "Build evidence-based resumes for every application."
            : "Continue tailoring your next application."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label className="block text-sm font-medium">
              Name
              <input
                className="mt-2 w-full rounded-xl border border-rule-strong bg-field px-4 py-3 outline-none focus:border-exhibit"
                name="name"
                autoComplete="name"
                required
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-2 w-full rounded-xl border border-rule-strong bg-field px-4 py-3 outline-none focus:border-exhibit"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-2 w-full rounded-xl border border-rule-strong bg-field px-4 py-3 outline-none focus:border-exhibit"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          {error ? (
            <p
              className="rounded-xl border border-danger/40 bg-danger-tint p-3 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-xl bg-exhibit px-4 py-3 font-semibold text-sheet transition hover:bg-exhibit-deep disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-2">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <Link
            className="font-medium text-exhibit hover:text-exhibit-deep"
            to={isSignUp ? "/sign-in" : "/sign-up"}
          >
            {isSignUp ? "Sign in" : "Create account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
