import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useNavigate,
} from "react-router";
import { Toaster } from "../components/ui/toast";
import { requireUser } from "../lib/auth.server";
import { authClient } from "../lib/auth-client";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireUser(request);
  return { user: session.user };
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "autosave") return false;
  return defaultShouldRevalidate;
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <div className="min-h-screen bg-field text-ink">
      <header className="border-b border-rule bg-board backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6">
          <Link to="/" className="mr-auto text-lg font-semibold tracking-tight">
            Resume <span className="text-exhibit">Fit</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {[
              ["/", "Analyze"],
              ["/applications", "Applications"],
              ["/jobs", "Find jobs"],
              ["/contributions", "Contributions"],
              ["/profile", "Profile"],
              ["/settings/ai", "AI settings"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-sheet-sunk text-exhibit-deep"
                      : "text-ink-2 hover:text-ink"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{loaderData.user.name}</p>
            <p className="text-xs text-ink-3">{loaderData.user.email}</p>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={signOut}
            className="rounded-lg border border-rule-strong px-3 py-2 text-sm text-ink-2 hover:border-ink-3 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <Outlet />
      <Toaster />
    </div>
  );
}
