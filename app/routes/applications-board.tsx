import { useEffect, useMemo, useState } from "react";
import {
  data,
  Form,
  useFetchers,
  useNavigation,
  useSubmit,
} from "react-router";
import { z } from "zod";
import {
  ApplicationBoard,
  moveFetcherKey,
} from "../components/application-board";
import { Button, ButtonLink } from "../components/ui/button";
import { fieldClass } from "../components/ui/field";
import {
  type ApplicationCardData,
  applyPendingMove,
  filterApplications,
  groupApplicationsByStatus,
  type PendingMove,
  parseMoveFormData,
  toApplicationDocuments,
} from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import {
  deleteApplication,
  listApplicationDocumentSummaries,
  listApplications,
  placeApplication,
} from "../lib/repositories.server";
import type { Route } from "./+types/applications-board";

const maxQueryLength = 100;

export function meta() {
  return [{ title: "Applications | Resume Fit" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const q = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, maxQueryLength);
  const [rows, summaries] = await Promise.all([
    listApplications(user.id),
    listApplicationDocumentSummaries(user.id),
  ]);
  const applications: ApplicationCardData[] = rows.map((row) => ({
    id: row.id,
    companyName: row.companyName,
    position: row.position,
    location: row.location,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod,
    status: row.status,
    sortOrder: row.sortOrder,
    source: row.source,
    externalId: row.externalId,
    documents: toApplicationDocuments(summaries.get(row.id)),
  }));
  return { applications, q };
}

function notFound() {
  return data({ error: "Application not found." }, { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "move") {
    const move = parseMoveFormData(formData);
    if (!move) {
      return data({ error: "Choose a valid status." }, { status: 400 });
    }
    const result = await placeApplication(user.id, move.id, move.status, {
      beforeId: move.beforeId,
      afterId: move.afterId,
    });
    if (result === "not-found") return notFound();
    if (result === "invalid") {
      return data(
        { error: "The board changed. Refresh and try again." },
        { status: 409 },
      );
    }
    return data({ ok: true });
  }

  if (intent === "delete") {
    const id = z.uuid().safeParse(formData.get("id"));
    if (!id.success) return notFound();
    if (formData.get("confirm") !== "yes") {
      return data(
        { error: "Confirm that you want to delete this application." },
        { status: 400 },
      );
    }
    const deleted = await deleteApplication(user.id, id.data);
    if (!deleted) return notFound();
    return data({ ok: true });
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

function usePendingBoardChanges() {
  const fetchers = useFetchers();
  return useMemo(() => {
    const moves: PendingMove[] = [];
    const deletedIds = new Set<string>();
    for (const fetcher of fetchers) {
      const formData = fetcher.formData;
      if (!formData) continue;
      const intent = formData.get("intent");
      if (intent === "move") {
        const move = parseMoveFormData(formData);
        if (move) moves.push(move);
      } else if (intent === "delete") {
        const id = formData.get("id");
        if (typeof id === "string") deletedIds.add(id);
      }
    }
    return { moves, deletedIds };
  }, [fetchers]);
}

export default function ApplicationsBoard({
  loaderData,
}: Route.ComponentProps) {
  const { applications, q } = loaderData;
  const submit = useSubmit();
  const navigation = useNavigation();
  const { moves, deletedIds } = usePendingBoardChanges();

  const [query, setQuery] = useState(q);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => setQuery(q), [q]);
  const filtered = useMemo(
    () => filterApplications(applications, query),
    [applications, query],
  );

  function onQueryChange(value: string) {
    setQuery(value);
    // Keep the filter in the URL without re-running the loader.
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  const columns = useMemo(() => {
    const visible = filtered.filter((card) => !deletedIds.has(card.id));
    return moves.reduce(
      (current, move) => applyPendingMove(current, move),
      groupApplicationsByStatus(visible),
    );
  }, [filtered, moves, deletedIds]);

  function handleMove(move: PendingMove) {
    const formData = new FormData();
    formData.set("intent", "move");
    formData.set("id", move.id);
    formData.set("status", move.status);
    if (move.beforeId) formData.set("beforeId", move.beforeId);
    if (move.afterId) formData.set("afterId", move.afterId);
    submit(formData, {
      method: "post",
      navigate: false,
      fetcherKey: moveFetcherKey(move.id),
    });
  }

  const searching =
    navigation.state === "loading" &&
    navigation.location.pathname === "/applications";

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.015em]">
            Applications
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Drag cards between columns as each process moves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Form method="get" role="search" className="flex items-center gap-2">
            <label htmlFor="application-filter" className="sr-only">
              Filter applications
            </label>
            <input
              id="application-filter"
              type="search"
              name="q"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              maxLength={maxQueryLength}
              placeholder="Filter by company, role, location"
              className={`${fieldClass} w-64 py-1.5`}
            />
            {hydrated ? null : (
              <Button type="submit" pending={searching}>
                Filter
              </Button>
            )}
            {query.trim() ? (
              hydrated ? (
                <Button variant="ghost" onClick={() => onQueryChange("")}>
                  Clear
                </Button>
              ) : (
                <ButtonLink to="/applications" variant="ghost">
                  Clear
                </ButtonLink>
              )
            ) : null}
          </Form>
          <ButtonLink to="/jobs">Find jobs</ButtonLink>
          <ButtonLink to="/applications/new" variant="primary">
            New application
          </ButtonLink>
        </div>
      </header>

      <div className="mt-8">
        {filtered.length === 0 ? (
          query.trim() ? (
            <div className="rounded-sheet border border-dashed border-rule-strong bg-sheet/60 p-10 text-center">
              <p className="font-medium">
                No applications match “{query.trim()}”.
              </p>
              <ButtonLink
                to="/applications"
                className="mt-4"
                onClick={(event) => {
                  event.preventDefault();
                  onQueryChange("");
                }}
              >
                Clear filter
              </ButtonLink>
            </div>
          ) : (
            <div className="rounded-sheet border border-dashed border-rule-strong bg-sheet/60 p-10 text-center">
              <p className="font-medium">No applications yet.</p>
              <p className="mt-2 text-sm text-ink-3">
                Add a job you are considering. Move it across columns as the
                process advances.
              </p>
              <ButtonLink
                to="/applications/new"
                variant="primary"
                className="mt-5"
              >
                Add first application
              </ButtonLink>
            </div>
          )
        ) : (
          <>
            {query.trim() ? (
              <p className="mb-3 text-sm text-ink-2" role="status">
                Showing {filtered.length} of {applications.length} matching “
                {query.trim()}”.
              </p>
            ) : null}
            <ApplicationBoard columns={columns} onMove={handleMove} />
          </>
        )}
      </div>
    </main>
  );
}
