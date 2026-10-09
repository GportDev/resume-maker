import { useMemo } from "react";
import {
  data,
  Form,
  Link,
  useFetchers,
  useNavigation,
  useSubmit,
} from "react-router";
import { z } from "zod";
import {
  ApplicationBoard,
  moveFetcherKey,
} from "../components/application-board";
import {
  type ApplicationCardData,
  applyPendingMove,
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
    listApplications(user.id, { q }),
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

  const columns = useMemo(() => {
    const visible = applications.filter((card) => !deletedIds.has(card.id));
    return moves.reduce(
      (current, move) => applyPendingMove(current, move),
      groupApplicationsByStatus(visible),
    );
  }, [applications, moves, deletedIds]);

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
    <main className="mx-auto max-w-[110rem] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Job search
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Applications</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Form method="get" role="search" className="flex items-center gap-2">
            <label htmlFor="application-filter" className="sr-only">
              Filter applications
            </label>
            <input
              id="application-filter"
              type="search"
              name="q"
              defaultValue={q}
              key={q}
              maxLength={maxQueryLength}
              placeholder="Filter by company, role, location"
              className="w-64 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400"
            >
              {searching ? "Filtering…" : "Filter"}
            </button>
            {q ? (
              <Link
                to="/applications"
                className="text-sm text-slate-400 hover:text-slate-100"
              >
                Clear
              </Link>
            ) : null}
          </Form>
          <Link
            to="/jobs"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium hover:border-cyan-400"
          >
            Find jobs
          </Link>
          <Link
            to="/applications/new"
            className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            New application
          </Link>
        </div>
      </div>

      <div className="mt-8">
        {applications.length === 0 ? (
          q ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
              <p className="font-medium">No applications match “{q}”.</p>
              <Link
                to="/applications"
                className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
              >
                Clear filter
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
              <p className="font-medium">No applications yet.</p>
              <p className="mt-2 text-sm text-slate-500">
                Add a job you are considering. Move it across columns as the
                process advances.
              </p>
              <Link
                to="/applications/new"
                className="mt-5 inline-block rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Add first application
              </Link>
            </div>
          )
        ) : (
          <>
            {q ? (
              <p className="mb-3 text-sm text-slate-400" role="status">
                Showing {applications.length} matching “{q}”.
              </p>
            ) : null}
            <ApplicationBoard columns={columns} onMove={handleMove} />
          </>
        )}
      </div>
    </main>
  );
}
