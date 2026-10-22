import { useEffect, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useFetcher,
  useNavigation,
} from "react-router";
import {
  LinkedInBadge,
  LinkedInPostingLink,
} from "../components/application-card";
import { Button, ButtonLink, textLinkClass } from "../components/ui/button";
import { fieldClass } from "../components/ui/field";
import { PageHeader, Sheet } from "../components/ui/sheet";
import { Stamp } from "../components/ui/stamp";
import { formatSalaryRange } from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import {
  evidenceTools,
  formatPostedDate,
  type JobListing,
  type JobSearchPage,
  type JobSearchParse,
  jobListingsPageSize,
  jobSearchPageHref,
  listingToApplicationInput,
  listingToolOverlap,
  parseJobSearchParams,
  postedWithinLabels,
  postedWithinOptions,
  saveListingFormSchema,
} from "../lib/job-listings";
import {
  getJobListingProvider,
  JobListingProviderError,
} from "../lib/job-listings.server";
import {
  listExperiences,
  listSavedListingIds,
  saveListingApplication,
} from "../lib/repositories.server";
import type { Route } from "./+types/job-search";

export function meta() {
  return [{ title: "Find jobs | Resume Fit" }];
}

type SearchState = {
  configured: boolean;
  search: JobSearchParse;
  results: JobSearchPage | null;
  saved: Record<string, string>;
  overlap: Record<string, string[]>;
  selectedListing: string | null;
  error: string | null;
};

const searchUnavailable =
  "Job search is unavailable right now. Nothing was saved. Try again in a few minutes.";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const url = new URL(request.url);
  const search = parseJobSearchParams(url.searchParams);
  const provider = getJobListingProvider();
  const state: SearchState = {
    configured: provider !== null,
    search,
    results: null,
    saved: {},
    overlap: {},
    selectedListing: url.searchParams.get("listing"),
    error: null,
  };
  if (!provider || search.status !== "valid") return state;

  try {
    const results = await provider.search(search.input);
    const [saved, experienceList] = await Promise.all([
      listSavedListingIds(
        user.id,
        results.listings.map((listing) => listing.externalId),
      ),
      listExperiences(user.id),
    ]);
    const tools = evidenceTools(experienceList.map((item) => item.markdown));
    const overlap = Object.fromEntries(
      results.listings.map((listing) => [
        listing.externalId,
        listingToolOverlap(`${listing.title}\n${listing.description}`, tools),
      ]),
    );
    return { ...state, results, saved: Object.fromEntries(saved), overlap };
  } catch (error) {
    if (!(error instanceof JobListingProviderError)) throw error;
    return data({ ...state, error: searchUnavailable }, { status: 502 });
  }
}

export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod === "POST" && currentUrl.href === nextUrl.href) return false;
  return defaultShouldRevalidate;
}

type SaveResult =
  | {
      ok: true;
      externalId: string;
      applicationId: string;
      created: boolean;
    }
  | { ok: false; error: string };

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const parsed = saveListingFormSchema.safeParse({
    intent: formData.get("intent"),
    listing: formData.get("listing"),
  });
  const mapped = parsed.success
    ? listingToApplicationInput(parsed.data.listing)
    : null;
  if (!parsed.success || !mapped) {
    return data<SaveResult>(
      {
        ok: false,
        error: "This listing could not be saved. Search again and retry.",
      },
      { status: 400 },
    );
  }

  const saved = await saveListingApplication(
    user.id,
    mapped.input,
    mapped.origin.externalId,
  );
  if (!saved) {
    return data<SaveResult>(
      { ok: false, error: "This listing could not be saved. Try again." },
      { status: 409 },
    );
  }
  if (parsed.data.intent === "save-and-tailor") {
    return redirect(`/applications/${saved.applicationId}/tailor`);
  }
  return data<SaveResult>({
    ok: true,
    externalId: mapped.origin.externalId,
    applicationId: saved.applicationId,
    created: saved.created,
  });
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-[0.8125rem] text-danger">
      {message}
    </p>
  );
}

function SearchForm({
  search,
  searching,
}: {
  search: JobSearchParse;
  searching: boolean;
}) {
  const errors = search.status === "invalid" ? search.errors : {};
  const values = search.values;
  return (
    <Form
      method="get"
      aria-label="Search job listings"
      className="flex flex-wrap items-start gap-3"
    >
      <div className="min-w-56 flex-[2]">
        <label htmlFor="keywords" className="sr-only">
          Keywords
        </label>
        <input
          id="keywords"
          name="keywords"
          type="search"
          required
          minLength={2}
          maxLength={120}
          defaultValue={values.keywords}
          placeholder="Job title, e.g. Senior backend engineer"
          aria-invalid={errors.keywords ? true : undefined}
          aria-describedby={errors.keywords ? "keywords-error" : undefined}
          className={fieldClass}
        />
        <FieldError id="keywords-error" message={errors.keywords} />
      </div>
      <div className="min-w-48 flex-[2]">
        <label htmlFor="location" className="sr-only">
          Location
        </label>
        <input
          id="location"
          name="location"
          type="text"
          maxLength={120}
          defaultValue={values.location}
          placeholder="Location, e.g. Lisbon, Portugal"
          aria-invalid={errors.location ? true : undefined}
          aria-describedby={
            errors.location ? "location-error location-hint" : "location-hint"
          }
          className={fieldClass}
        />
        <FieldError id="location-error" message={errors.location} />
      </div>
      <div className="w-40">
        <label htmlFor="postedWithin" className="sr-only">
          Posted within
        </label>
        <select
          id="postedWithin"
          name="postedWithin"
          defaultValue={values.postedWithin}
          aria-invalid={errors.postedWithin ? true : undefined}
          aria-describedby={
            errors.postedWithin ? "postedWithin-error" : undefined
          }
          className={fieldClass}
        >
          {postedWithinOptions.map((option) => (
            <option key={option} value={option}>
              {postedWithinLabels[option]}
            </option>
          ))}
        </select>
        <FieldError id="postedWithin-error" message={errors.postedWithin} />
      </div>
      <label className="flex h-[2.4rem] items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          name="remote"
          defaultChecked={values.remote}
          className="size-4 accent-exhibit"
        />
        Remote only
      </label>
      <Button
        type="submit"
        variant="primary"
        pending={searching}
        className="h-[2.4rem]"
      >
        {searching ? "Searching…" : "Search"}
      </Button>
      <p id="location-hint" className="basis-full text-[0.8125rem] text-ink-3">
        Use full place names, like United States, not US. Each search uses one
        paid request; saving does not.
      </p>
      {errors.page ? (
        <p className="basis-full text-sm text-danger" role="alert">
          {errors.page}
        </p>
      ) : null}
    </Form>
  );
}

function useListingSave(listing: JobListing, savedApplicationId?: string) {
  const fetcher = useFetcher<SaveResult>({
    key: `save-listing-${listing.externalId}`,
  });
  const result = fetcher.data;
  const pendingIntent =
    fetcher.state === "idle" ? null : fetcher.formData?.get("intent");
  const savedId =
    result?.ok === true ? result.applicationId : savedApplicationId;
  return { fetcher, result, pendingIntent, savedId };
}

function SaveActions({
  listing,
  savedApplicationId,
}: {
  listing: JobListing;
  savedApplicationId?: string;
}) {
  const { fetcher, result, pendingIntent, savedId } = useListingSave(
    listing,
    savedApplicationId,
  );
  const label = `${listing.title} at ${listing.company || "unknown company"}`;
  return (
    <div>
      {savedId ? (
        <p
          className="fade-in flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          role="status"
        >
          <Stamp tone="ok">
            {result?.ok === true && result.created === false
              ? "Already on your board"
              : "On your board"}
          </Stamp>
          <Link to={`/applications/${savedId}`} className={textLinkClass}>
            Open card
          </Link>
          <Link
            to={`/applications/${savedId}/tailor`}
            className={textLinkClass}
          >
            Tailor
          </Link>
        </p>
      ) : (
        <fetcher.Form method="post" className="flex flex-wrap gap-2">
          <input type="hidden" name="listing" value={JSON.stringify(listing)} />
          <Button
            type="submit"
            name="intent"
            value="save"
            disabled={pendingIntent !== null}
            pending={pendingIntent === "save"}
            aria-label={`Save ${label} to board`}
          >
            Save to board
          </Button>
          <Button
            type="submit"
            name="intent"
            value="save-and-tailor"
            variant="primary"
            disabled={pendingIntent !== null}
            pending={pendingIntent === "save-and-tailor"}
            aria-label={`Save ${label} and tailor`}
          >
            {pendingIntent === "save-and-tailor"
              ? "Opening tailor…"
              : "Save and tailor"}
          </Button>
        </fetcher.Form>
      )}
      {result?.ok === false ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}

function listingMeta(listing: JobListing) {
  const salary = listing.salary
    ? formatSalaryRange(
        listing.salary.min,
        listing.salary.max,
        listing.salary.currency,
        listing.salary.period,
      )
    : null;
  return {
    salary,
    posted: formatPostedDate(listing.postedAt),
    parts: [listing.location, listing.workArrangement, salary].filter(
      (part): part is string => Boolean(part),
    ),
  };
}

function ToolOverlap({ tools }: { tools: string[] }) {
  if (!tools.length) return null;
  return (
    <span className="text-[0.8125rem] text-ok">
      Mentions {tools.length} of your tools
    </span>
  );
}

function ListingDetail({
  listing,
  savedApplicationId,
  overlap,
}: {
  listing: JobListing;
  savedApplicationId?: string;
  overlap: string[];
}) {
  const { parts, posted } = listingMeta(listing);
  const label = `${listing.title} at ${listing.company || "unknown company"}`;
  return (
    <article aria-labelledby={`detail-${listing.externalId}`}>
      <h2
        id={`detail-${listing.externalId}`}
        className="text-[1.375rem] leading-tight font-bold tracking-[-0.01em]"
      >
        {listing.title}
      </h2>
      <p className="mt-1 text-ink-2">
        {listing.company || "Company not specified"}
      </p>
      <p className="tabular mt-1 text-sm text-ink-3">
        {[...parts, posted ? `Posted ${posted}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-4">
        <SaveActions
          listing={listing}
          savedApplicationId={savedApplicationId}
        />
      </div>
      {overlap.length ? (
        <div className="mt-5 rounded-control bg-ok-tint/60 p-3 text-[0.8125rem]">
          <p className="font-medium text-ok">
            Mentions {overlap.length} tools from your evidence
          </p>
          <p className="mt-1 text-ink-2">{overlap.join(", ")}</p>
          <p className="mt-1 text-ink-3">
            A quick text match against your Tools sections, not a fit score.
          </p>
        </div>
      ) : null}
      <div className="mt-5 border-t border-rule pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Job description</h3>
          <span className="flex items-center gap-2">
            <LinkedInBadge />
            <LinkedInPostingLink
              externalId={listing.externalId}
              label={label}
              className={`text-sm ${textLinkClass}`}
            >
              View on LinkedIn
            </LinkedInPostingLink>
          </span>
        </div>
        {listing.description ? (
          <p className="mt-3 max-w-[72ch] whitespace-pre-line text-[0.9375rem] leading-7 text-ink-2">
            {listing.description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-3">
            The listing has no description. Open it on LinkedIn.
          </p>
        )}
      </div>
    </article>
  );
}

/** Stacked row: used without JavaScript and on narrow screens. */
function ListingCard({
  listing,
  savedApplicationId,
  overlap,
}: {
  listing: JobListing;
  savedApplicationId?: string;
  overlap: string[];
}) {
  const { parts, posted } = listingMeta(listing);
  const headingId = `listing-${listing.externalId}`;
  return (
    <li className="py-4">
      <article aria-labelledby={headingId}>
        <h2 id={headingId} className="font-semibold">
          {listing.title}
        </h2>
        <p className="text-sm text-ink-2">
          {listing.company || "Company not specified"}
        </p>
        <p className="tabular mt-1 text-[0.8125rem] text-ink-3">
          {[...parts, posted ? `Posted ${posted}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1">
          <ToolOverlap tools={overlap} />
        </div>
        {listing.description ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-ink-2 hover:text-ink">
              Job description
            </summary>
            <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-line rounded-control bg-sheet-sunk p-3 text-ink-2">
              {listing.description}
            </p>
          </details>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SaveActions
            listing={listing}
            savedApplicationId={savedApplicationId}
          />
          <LinkedInPostingLink
            externalId={listing.externalId}
            label={`${listing.title} at ${listing.company || "unknown company"}`}
            className={`text-sm ${textLinkClass}`}
          >
            View on LinkedIn
          </LinkedInPostingLink>
        </div>
      </article>
    </li>
  );
}

function ListingRowButton({
  listing,
  selected,
  savedApplicationId,
  tools,
  onSelect,
}: {
  listing: JobListing;
  selected: boolean;
  savedApplicationId?: string;
  tools: string[];
  onSelect: () => void;
}) {
  const { savedId } = useListingSave(listing, savedApplicationId);
  const { parts } = listingMeta(listing);
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={`block w-full rounded-control px-3 py-2.5 text-left ${
          selected ? "bg-sheet shadow-sheet" : "hover:bg-sheet/60"
        }`}
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {listing.title}
            </span>
            <span className="block truncate text-[0.8125rem] text-ink-2">
              {listing.company || "Company not specified"}
            </span>
          </span>
          {savedId ? <Stamp tone="ok">Saved</Stamp> : null}
        </span>
        <span className="tabular mt-0.5 block truncate text-xs text-ink-3">
          {parts.join(" · ")}
        </span>
        {tools.length ? (
          <span className="mt-0.5 block text-xs text-ok">
            {tools.length} of your tools
          </span>
        ) : null}
      </button>
    </li>
  );
}

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    setWide(query.matches);
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

function Results({
  search,
  results,
  saved,
  overlap,
  selectedListing,
}: {
  search: Extract<JobSearchParse, { status: "valid" }>;
  results: JobSearchPage;
  saved: Record<string, string>;
  overlap: Record<string, string[]>;
  selectedListing: string | null;
}) {
  const wide = useWideScreen();
  const listings = results.listings;
  const [selectedId, setSelectedId] = useState(
    listings.some((listing) => listing.externalId === selectedListing)
      ? selectedListing
      : (listings[0]?.externalId ?? null),
  );
  const page = search.input.page;
  const first = (page - 1) * jobListingsPageSize + 1;
  const last = first + listings.length - 1;

  function select(id: string) {
    setSelectedId(id);
    // Keep the selection shareable without re-running the paid search.
    const url = new URL(window.location.href);
    url.searchParams.set("listing", id);
    window.history.replaceState(window.history.state, "", url);
  }

  if (!listings.length) {
    return (
      <div className="rounded-sheet border border-dashed border-rule-strong p-10 text-center">
        <p className="font-medium">
          {page > 1 ? "No more listings." : "No listings match this search."}
        </p>
        <p className="mt-2 text-sm text-ink-3">
          Try broader keywords, a full location name, or a longer posting
          window.
        </p>
      </div>
    );
  }

  const selected = listings.find(
    (listing) => listing.externalId === selectedId,
  );
  const pagination = (
    <nav
      aria-label="Search result pages"
      className="mt-4 flex items-center justify-between gap-3 text-sm"
    >
      {page > 1 ? (
        <ButtonLink to={jobSearchPageHref(search.input, page - 1)} size="sm">
          ← Previous
        </ButtonLink>
      ) : (
        <span />
      )}
      {results.hasMore ? (
        <ButtonLink to={jobSearchPageHref(search.input, page + 1)} size="sm">
          Next {jobListingsPageSize} →
        </ButtonLink>
      ) : null}
    </nav>
  );

  if (!wide) {
    return (
      <>
        <p className="tabular text-sm text-ink-3" role="status">
          Results {first}–{last}
        </p>
        <ol className="divide-y divide-rule">
          {listings.map((listing) => (
            <ListingCard
              key={listing.externalId}
              listing={listing}
              savedApplicationId={saved[listing.externalId]}
              overlap={overlap[listing.externalId] ?? []}
            />
          ))}
        </ol>
        {pagination}
      </>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-6">
      <div>
        <p className="tabular mb-2 text-sm text-ink-3" role="status">
          Results {first}–{last}
        </p>
        <ol className="space-y-1" aria-label="Listings">
          {listings.map((listing) => (
            <ListingRowButton
              key={listing.externalId}
              listing={listing}
              selected={listing.externalId === selectedId}
              savedApplicationId={saved[listing.externalId]}
              tools={overlap[listing.externalId] ?? []}
              onSelect={() => select(listing.externalId)}
            />
          ))}
        </ol>
        {pagination}
      </div>
      <div className="sticky top-4 self-start rounded-sheet bg-sheet p-6 shadow-sheet">
        {selected ? (
          <ListingDetail
            key={selected.externalId}
            listing={selected}
            savedApplicationId={saved[selected.externalId]}
            overlap={overlap[selected.externalId] ?? []}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function JobSearch({ loaderData }: Route.ComponentProps) {
  const {
    configured,
    search,
    results,
    saved,
    overlap,
    selectedListing,
    error,
  } = loaderData;
  const navigation = useNavigation();
  const searching =
    navigation.state === "loading" && navigation.location.pathname === "/jobs";

  return (
    <main id="main" className="mx-auto max-w-[90rem] px-4 pb-10 sm:px-6">
      <Sheet className="rounded-t-none">
        <PageHeader
          title="Find jobs"
          meta="Search LinkedIn listings, save the ones worth pursuing, and tailor to them."
        />
        {!configured ? (
          <div className="rounded-sheet border border-dashed border-rule-strong p-10 text-center">
            <p className="font-medium">
              Job search is not set up on this server.
            </p>
            <p className="mt-2 text-sm text-ink-3">
              You can still add applications by hand and paste their job
              descriptions.
            </p>
            <ButtonLink
              to="/applications/new"
              variant="primary"
              className="mt-5"
            >
              Add application
            </ButtonLink>
          </div>
        ) : (
          <SearchForm search={search} searching={searching} />
        )}
      </Sheet>

      {configured ? (
        <section
          aria-label="Search results"
          aria-busy={searching}
          className={`mt-6 transition-opacity duration-150 ${searching ? "opacity-60" : ""}`}
        >
          {error ? (
            <p
              role="alert"
              className="rounded-sheet border border-danger/40 bg-danger-tint p-4 text-sm text-danger"
            >
              {error}
            </p>
          ) : search.status === "valid" && results ? (
            <Results
              search={search}
              results={results}
              saved={saved}
              overlap={overlap}
              selectedListing={selectedListing}
            />
          ) : search.status === "idle" ? (
            <p className="px-1 text-sm text-ink-3">
              Enter a job title to search listings from the past week, or pick
              another posting window.
            </p>
          ) : null}
          <p className="mt-10 px-1 text-xs text-ink-3">
            Listings come from LinkedIn through the licensed Fantastic.jobs API.
            Saving a listing copies its details to your board without another
            search.
          </p>
        </section>
      ) : null}
    </main>
  );
}
