import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { requireUser } from "../lib/auth.server";
import { authClient } from "../lib/auth-client";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireUser(request);
  return { user: session.user };
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 sm:px-6">
          <Link to="/" className="mr-auto text-lg font-semibold tracking-tight">
            Resume <span className="text-cyan-400">Fit</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {[
              ["/", "Analyze"],
              ["/profile", "Profile"],
              ["/settings/api-key", "API key"],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-slate-800 text-cyan-300"
                      : "text-slate-400 hover:text-slate-100"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{loaderData.user.name}</p>
            <p className="text-xs text-slate-500">{loaderData.user.email}</p>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={signOut}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
