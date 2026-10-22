import { Plus, Settings2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { ButtonLink } from "../components/ui/button";
import { requireUser } from "../lib/auth.server";
import {
  exhibitNumbers,
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
  const exhibits = exhibitNumbers(experienceList);
  const folders = groupExperiencesByCompany(experienceList, companyList).map(
    (folder) => ({
      id: folder.company.id,
      name: folder.company.name,
      hasCurrentRole: folder.hasCurrentRole,
      positions: folder.positions.map((position) => ({
        id: position.id,
        position: position.position,
        dates: formatRoleDates(position),
        exhibit: exhibits.get(position.id) ?? null,
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
  `group/file flex items-start gap-2 rounded-[4px] px-2 py-1.5 text-sm ${
    isActive
      ? "bg-sheet text-ink shadow-sheet"
      : "text-ink-2 hover:bg-sheet/60 hover:text-ink"
  }`;

const folderActionClass =
  "grid size-7 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/folder:opacity-100 [@media(hover:hover)]:group-focus-within/folder:opacity-100";

export default function Contributions({ loaderData }: Route.ComponentProps) {
  const { folders } = loaderData;

  return (
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
        <div>
          <h1 className="text-lg font-bold tracking-[-0.01em]">
            Contributions
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ButtonLink to="/contributions/new" variant="primary" size="sm">
              <Plus aria-hidden="true" className="size-4" />
              New position
            </ButtonLink>
            <ButtonLink
              to="/contributions/companies/new"
              variant="secondary"
              size="sm"
            >
              New company
            </ButtonLink>
          </div>
        </div>

        {folders.length ? (
          <nav
            aria-label="Contribution files"
            onKeyDown={moveTreeFocus}
            className="space-y-3"
          >
            {folders.map((folder) => (
              <details key={folder.id} open className="group/folder">
                <summary
                  data-tree-item
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1 text-[0.8125rem] font-semibold text-ink"
                >
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="tabular text-xs font-normal text-ink-3">
                    {folder.positions.length}
                  </span>
                  <Link
                    data-tree-item
                    to={`/contributions/new?companyId=${folder.id}`}
                    aria-label={`New position at ${folder.name}`}
                    title="New position here"
                    className={folderActionClass}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                  </Link>
                  <NavLink
                    data-tree-item
                    to={`/contributions/companies/${folder.id}`}
                    aria-label={`Company settings for ${folder.name}`}
                    title="Company settings"
                    className={({ isActive }) =>
                      `${folderActionClass} ${isActive ? "bg-sheet text-ink opacity-100" : ""}`
                    }
                  >
                    <Settings2 aria-hidden="true" className="size-3.5" />
                  </NavLink>
                </summary>
                <ul className="mt-0.5 space-y-0.5 border-l border-rule-strong/40 pl-1.5 ml-2">
                  {folder.positions.map((position) => (
                    <li key={position.id}>
                      <NavLink
                        data-tree-item
                        to={`/contributions/${position.id}`}
                        className={fileLinkClass}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug">
                            {position.position}
                          </span>
                          <span className="tabular block text-xs text-ink-3">
                            {position.dates}
                          </span>
                        </span>
                        {position.exhibit ? (
                          <span className="mt-0.5 shrink-0 rounded-stamp bg-manila-tint px-1 py-px text-[0.625rem] font-bold tracking-[0.06em] text-manila-ink uppercase">
                            Ex. {position.exhibit}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  ))}
                  {folder.positions.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-ink-3">
                      No positions yet.
                    </li>
                  ) : null}
                </ul>
              </details>
            ))}
          </nav>
        ) : (
          <div className="rounded-sheet border border-dashed border-rule-strong p-4 text-sm">
            <p className="font-medium">No companies yet.</p>
            <p className="mt-1 text-ink-3">
              Add a company, then write one contribution file per position you
              held there.
            </p>
          </div>
        )}
        {folders.length ? (
          <p className="px-2 text-xs text-ink-3">
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
