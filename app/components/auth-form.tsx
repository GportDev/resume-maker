import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient } from "../lib/auth-client";
import { Button } from "./ui/button";
import { Field, fieldClass } from "./ui/field";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <main id="main" className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-xl font-extrabold tracking-[-0.02em]">
          Resume<span className="text-exhibit">&nbsp;Fit</span>
        </p>
        <nav aria-label="Account" className="flex gap-1 px-3">
          {(
            [
              ["/sign-in", "Sign in", !isSignUp],
              ["/sign-up", "Create account", isSignUp],
            ] as const
          ).map(([to, label, active]) => (
            <Link
              key={to}
              to={{ pathname: to, search: searchParams.toString() }}
              aria-current={active ? "page" : undefined}
              className={`-mb-px rounded-t-control border border-b-0 px-4 pt-2 pb-2.5 text-sm font-medium ${
                active
                  ? "border-rule-strong/60 bg-sheet text-ink"
                  : "border-transparent text-ink-2 hover:bg-sheet/50 hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <section className="rounded-sheet border border-rule-strong/60 bg-sheet p-7 shadow-sheet">
          <h1 className="text-[1.5rem] font-bold tracking-[-0.015em]">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            File your work history once. Every tailored resume cites it.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isSignUp ? (
              <Field id="auth-name" label="Name">
                <input
                  id="auth-name"
                  className={fieldClass}
                  name="name"
                  autoComplete="name"
                  required
                />
              </Field>
            ) : null}
            <Field id="auth-email" label="Email">
              <input
                id="auth-email"
                className={fieldClass}
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            <Field
              id="auth-password"
              label="Password"
              hint={isSignUp ? "At least 8 characters." : undefined}
            >
              <div className="relative">
                <input
                  id="auth-password"
                  className={`${fieldClass} pr-11`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  aria-describedby={isSignUp ? "auth-password-hint" : undefined}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 my-auto grid size-8 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4" />
                  )}
                </button>
              </div>
            </Field>
            {error ? (
              <p
                className="rounded-control border border-danger/40 bg-danger-tint p-3 text-sm text-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              pending={pending}
              className="h-10 w-full"
            >
              {pending
                ? isSignUp
                  ? "Creating account…"
                  : "Signing in…"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
