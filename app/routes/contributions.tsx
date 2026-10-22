import type { KeyboardEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { requireUser } from "../lib/auth.server";
import {
  formatRoleDates,
  groupExperiencesByCompany,
} from "../lib/contributions";
import { listCompanies, listExperiences } from "../lib/repositories.server";
import type { Route } from "./+types/contributions";

export function meta() {
  return [{ title: "Contributions | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [companyList, experienceList] = await Promise.all([
    listCompanies(user.id),
    listExperiences(user.id),
  ]);
  const folders = groupExperiencesByCompany(experienceList, companyList).map(
    (folder) => ({
      id: folder.company.id,
      name: folder.company.name,
      hasCurrentRole: folder.hasCurrentRole,
      positions: folder.positions.map((position) => ({
        id: position.id,
        position: position.position,
        dates: formatRoleDates(position),
      })),
    }),
  );
  return { folders };
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "autosave") return false;
  return defaultShouldRevalidate;
}

function moveTreeFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("[data-tree-item]"),
  ).filter((item) => item.offsetParent !== null);
  if (!items.length) return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  const last = items.length - 1;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowDown"
          ? Math.min(current + 1, last)
          : Math.max(current - 1, 0);
  items[next]?.focus();
}

const fileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive
      ? "bg-sheet-sunk text-exhibit-deep"
      : "text-ink-2 hover:bg-sheet-sunk hover:text-ink"
  }`;

export default function Contributions({ loaderData }: Route.ComponentProps) {
  const { folders } = loaderData;

  return (
    <main
      id="main"
      className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <aside className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-exhibit">
            Evidence library
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Contributions</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/contributions/new"
            className="rounded-lg bg-exhibit px-3 py-2 text-sm font-semibold text-sheet hover:bg-exhibit-deep"
          >
            New position
          </Link>
          <Link
            to="/contributions/companies/new"
            className="rounded-lg border border-rule-strong px-3 py-2 text-sm hover:border-exhibit"
          >
            New company
          </Link>
        </div>

        {folders.length ? (
          <nav
            aria-label="Contribution files"
            onKeyDown={moveTreeFocus}
            className="space-y-2"
          >
            {folders.map((folder) => (
              <details
                key={folder.id}
                open
                className="rounded-xl border border-rule bg-sheet-sunk p-2"
              >
                <summary
                  data-tree-item
                  className="cursor-pointer rounded-lg px-2 py-1.5 text-sm font-semibold"
                >
                  {folder.name}
                  {folder.hasCurrentRole ? (
                    <span className="ml-2 rounded bg-ok-tint px-1.5 py-0.5 text-xs font-normal text-ok">
                      Current
                    </span>
                  ) : null}
                </summary>
                <ul className="mt-1 space-y-1">
                  {folder.positions.map((position) => (
                    <li key={position.id}>
                      <NavLink
                        data-tree-item
                        to={`/contributions/${position.id}`}
                        className={fileLinkClass}
                      >
                        <span className="block font-medium">
                          {position.position}
                        </span>
                        <span className="block text-xs text-ink-3">
                          {position.dates}
                        </span>
                      </NavLink>
                    </li>
                  ))}
                  {folder.positions.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-ink-3">
                      No positions yet.
                    </li>
                  ) : null}
                </ul>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-3 pb-1 text-xs">
                  <Link
                    data-tree-item
                    to={`/contributions/new?companyId=${folder.id}`}
                    className="text-exhibit hover:text-exhibit-deep"
                  >
                    New position here
                  </Link>
                  <NavLink
                    data-tree-item
                    to={`/contributions/companies/${folder.id}`}
                    className={({ isActive }) =>
                      isActive
                        ? "text-exhibit-deep"
                        : "text-ink-2 hover:text-ink"
                    }
                  >
                    Company settings
                  </NavLink>
                </div>
              </details>
            ))}
          </nav>
        ) : (
          <div className="rounded-xl border border-dashed border-rule-strong p-5 text-sm">
            <p className="font-medium">No companies yet.</p>
            <p className="mt-2 text-ink-3">
              Add a company, then write one contribution file per position you
              held there.
            </p>
          </div>
        )}
        {folders.length ? (
          <p className="text-xs text-ink-3">
            Arrow keys, Home, and End move between files.
          </p>
        ) : null}
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </main>
  );
}
