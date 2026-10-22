import { ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useNavigate,
} from "react-router";
import { buttonClass } from "../components/ui/button";
import { Popover, popoverItemClass } from "../components/ui/popover";
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

const tabs = [
  { to: "/", label: "Home", end: true },
  { to: "/jobs", label: "Find jobs" },
  { to: "/applications", label: "Applications" },
  { to: "/contributions", label: "Contributions" },
  { to: "/profile", label: "Profile" },
] as const;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const { user } = loaderData;

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-exhibit px-3 py-2 text-sheet focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="border-b border-rule-strong/60 bg-board-deep/70">
        <div className="mx-auto flex max-w-[90rem] items-end gap-4 px-4 pt-3 sm:px-6">
          <Link
            to="/"
            className="mr-2 mb-2.5 shrink-0 text-[1.0625rem] font-extrabold tracking-[-0.02em]"
          >
            Resume<span className="text-exhibit">&nbsp;Fit</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="-mb-px hidden items-end gap-1 md:flex"
          >
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={"end" in tab}
                className={({ isActive }) =>
                  `rounded-t-control border border-b-0 px-3.5 pt-2 pb-2.5 text-sm font-medium ${
                    isActive
                      ? "border-rule-strong/60 bg-sheet text-ink shadow-[0_-1px_0_0_var(--color-sheet)_inset]"
                      : "border-transparent text-ink-2 hover:bg-sheet/50 hover:text-ink"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="mb-2 ml-auto flex items-center gap-2">
            <Popover
              id="main-menu"
              align="end"
              triggerLabel="Open navigation menu"
              triggerClassName={`${buttonClass({ variant: "secondary", size: "sm" })} md:hidden`}
              trigger={
                <>
                  <Menu aria-hidden="true" className="size-4" />
                  Menu
                </>
              }
            >
              <nav aria-label="Main navigation (compact)">
                {tabs.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={"end" in tab}
                    className={({ isActive }) =>
                      `${popoverItemClass} ${isActive ? "font-semibold text-exhibit" : ""}`
                    }
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
            </Popover>
            <Popover
              id="account-menu"
              align="end"
              triggerLabel={`Account menu for ${user.name}`}
              triggerClassName="pressable flex items-center gap-1.5 rounded-full py-0.5 pr-1.5 pl-0.5 text-ink-2 hover:bg-sheet/60 hover:text-ink"
              trigger={
                <>
                  <span
                    aria-hidden="true"
                    className="grid size-8 place-items-center rounded-full bg-exhibit text-xs font-bold text-sheet"
                  >
                    {initials(user.name)}
                  </span>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </>
              }
            >
              <div className="border-b border-rule px-2.5 pt-1.5 pb-2.5">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[0.8125rem] text-ink-3">
                  {user.email}
                </p>
              </div>
              <div className="pt-1.5">
                <Link to="/settings/ai" className={popoverItemClass}>
                  <KeyRound aria-hidden="true" className="size-4 text-ink-3" />
                  AI settings
                </Link>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={signOut}
                  className={popoverItemClass}
                >
                  <LogOut aria-hidden="true" className="size-4 text-ink-3" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </Popover>
          </div>
        </div>
      </header>
      <Outlet />
      <Toaster />
    </div>
  );
}
