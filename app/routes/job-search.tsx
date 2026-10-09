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
import { formatSalaryRange } from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import {
  formatPostedDate,
  type JobListing,
  type JobSearchPage,
  type JobSearchParse,
  jobSearchPageHref,
  listingToApplicationInput,
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
  error: string | null;
};

const searchUnavailable =
  "Job search is unavailable right now. Nothing was saved. Try again in a few minutes.";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const search = parseJobSearchParams(new URL(request.url).searchParams);
  const provider = getJobListingProvider();
  const state: SearchState = {
    configured: provider !== null,
    search,
    results: null,
    saved: {},
    error: null,
  };
  if (!provider || search.status !== "valid") return state;

  try {
    const results = await provider.search(search.input);
    const saved = await listSavedListingIds(
      user.id,
      results.listings.map((listing) => listing.externalId),
    );
    return { ...state, results, saved: Object.fromEntries(saved) };
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

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400 aria-[invalid=true]:border-red-400";
const primaryButtonClass =
  "rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60";
const secondaryButtonClass =
  "rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400 disabled:opacity-60";
const textLinkClass = "text-cyan-400 hover:text-cyan-300";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-300">
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
      className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-[2fr_2fr_1fr_auto]"
      aria-label="Search job listings"
    >
      <div>
        <label htmlFor="keywords" className="text-sm font-medium">
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
          placeholder="Senior frontend engineer"
          aria-invalid={errors.keywords ? true : undefined}
          aria-describedby={errors.keywords ? "keywords-error" : undefined}
          className={`mt-1 ${inputClass}`}
        />
        <FieldError id="keywords-error" message={errors.keywords} />
      </div>
      <div>
        <label htmlFor="location" className="text-sm font-medium">
          Location
        </label>
        <input
          id="location"
          name="location"
          type="text"
          maxLength={120}
          defaultValue={values.location}
          placeholder="Berlin, Germany"
          aria-invalid={errors.location ? true : undefined}
          aria-describedby={
            errors.location ? "location-error location-hint" : "location-hint"
          }
          className={`mt-1 ${inputClass}`}
        />
        <p id="location-hint" className="mt-1 text-xs text-slate-500">
          Use full names, like United States, not US.
        </p>
        <FieldError id="location-error" message={errors.location} />
      </div>
      <div>
        <label htmlFor="postedWithin" className="text-sm font-medium">
          Posted
        </label>
        <select
          id="postedWithin"
          name="postedWithin"
          defaultValue={values.postedWithin}
          aria-invalid={errors.postedWithin ? true : undefined}
          aria-describedby={
            errors.postedWithin ? "postedWithin-error" : undefined
          }
          className={`mt-1 ${inputClass}`}
        >
          {postedWithinOptions.map((option) => (
            <option key={option} value={option}>
              {postedWithinLabels[option]}
            </option>
          ))}
        </select>
        <FieldError id="postedWithin-error" message={errors.postedWithin} />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="remote"
            defaultChecked={values.remote}
            className="size-4 accent-cyan-400"
          />
          Remote only
        </label>
      </div>
      <div className="self-start md:pt-6">
        <button
          type="submit"
          disabled={searching}
          className={`w-full ${primaryButtonClass}`}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {errors.page ? (
        <p className="text-sm text-red-300 md:col-span-4" role="alert">
          {errors.page}
        </p>
      ) : null}
    </Form>
  );
}

function SavedLinks({
  applicationId,
  created,
}: {
  applicationId: string;
  created?: boolean;
}) {
  return (
    <p className="text-sm text-emerald-300" role="status">
      {created === false
        ? "Already on your board."
        : created
          ? "Saved to your board."
          : "On your board."}{" "}
      <Link to={`/applications/${applicationId}`} className={textLinkClass}>
        Open card
      </Link>
      {" · "}
      <Link
        to={`/applications/${applicationId}/tailor`}
        className={textLinkClass}
      >
        Tailor
      </Link>
    </p>
  );
}

function ListingRow({
  listing,
  savedApplicationId,
}: {
  listing: JobListing;
  savedApplicationId: string | undefined;
}) {
  const fetcher = useFetcher<SaveResult>({
    key: `save-listing-${listing.externalId}`,
  });
  const result = fetcher.data;
  const pendingIntent =
    fetcher.state === "idle" ? null : fetcher.formData?.get("intent");
  const salary = listing.salary
    ? formatSalaryRange(
        listing.salary.min,
        listing.salary.max,
        listing.salary.currency,
        listing.salary.period,
      )
    : null;
  const posted = formatPostedDate(listing.postedAt);
  const label = `${listing.title} at ${listing.company || "unknown company"}`;
  const savedId =
    result?.ok === true ? result.applicationId : savedApplicationId;
  const headingId = `listing-${listing.externalId}`;

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold">
              {listing.title}
            </h2>
            <p className="text-sm text-slate-300">
              {listing.company || "Company not specified"}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              {listing.location ? (
                <div>
                  <dt className="sr-only">Location</dt>
                  <dd>{listing.location}</dd>
                </div>
              ) : null}
              {listing.workArrangement ? (
                <div>
                  <dt className="sr-only">Work arrangement</dt>
                  <dd>{listing.workArrangement}</dd>
                </div>
              ) : null}
              {salary ? (
                <div>
                  <dt className="sr-only">Salary range</dt>
                  <dd>{salary}</dd>
                </div>
              ) : null}
              {posted ? (
                <div>
                  <dt className="sr-only">Posted</dt>
                  <dd>Posted {posted}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="flex items-center gap-2">
            <LinkedInBadge />
            <LinkedInPostingLink
              externalId={listing.externalId}
              label={label}
              className={`text-sm ${textLinkClass}`}
            >
              View on LinkedIn
            </LinkedInPostingLink>
          </div>
        </div>

        {listing.description ? (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-slate-300 hover:text-slate-100">
              Job description
            </summary>
            <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-950 p-3 text-slate-300">
              {listing.description}
            </p>
          </details>
        ) : null}

        <div className="mt-4">
          {savedId ? (
            <SavedLinks
              applicationId={savedId}
              created={result?.ok === true ? result.created : undefined}
            />
          ) : (
            <fetcher.Form method="post" className="flex flex-wrap gap-2">
              <input
                type="hidden"
                name="listing"
                value={JSON.stringify(listing)}
              />
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={pendingIntent !== null}
                aria-label={`Save ${label} to board`}
                className={secondaryButtonClass}
              >
                {pendingIntent === "save" ? "Saving…" : "Save to board"}
              </button>
              <button
                type="submit"
                name="intent"
                value="save-and-tailor"
                disabled={pendingIntent !== null}
                aria-label={`Save ${label} and tailor`}
                className={primaryButtonClass}
              >
                {pendingIntent === "save-and-tailor"
                  ? "Opening tailor…"
                  : "Save and tailor"}
              </button>
            </fetcher.Form>
          )}
          {result?.ok === false ? (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {result.error}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function Results({
  search,
  results,
  saved,
}: {
  search: Extract<JobSearchParse, { status: "valid" }>;
  results: JobSearchPage;
  saved: Record<string, string>;
}) {
  const page = search.input.page;
  if (!results.listings.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
        <p className="font-medium">
          {page > 1 ? "No more listings." : "No listings match this search."}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Try broader keywords, a full location name, or a longer posting
          window.
        </p>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-slate-400" role="status">
        Page {page}: {results.listings.length} listing
        {results.listings.length === 1 ? "" : "s"}
      </p>
      <ol className="space-y-4">
        {results.listings.map((listing) => (
          <ListingRow
            key={listing.externalId}
            listing={listing}
            savedApplicationId={saved[listing.externalId]}
          />
        ))}
      </ol>
      <nav
        aria-label="Search result pages"
        className="mt-6 flex items-center justify-between text-sm"
      >
        {page > 1 ? (
          <Link
            to={jobSearchPageHref(search.input, page - 1)}
            className={textLinkClass}
          >
            ← Previous page
          </Link>
        ) : (
          <span />
        )}
        {results.hasMore ? (
          <Link
            to={jobSearchPageHref(search.input, page + 1)}
            className={textLinkClass}
          >
            Next page →
          </Link>
        ) : null}
      </nav>
    </>
  );
}

export default function JobSearch({ loaderData }: Route.ComponentProps) {
  const { configured, search, results, saved, error } = loaderData;
  const navigation = useNavigation();
  const searching =
    navigation.state === "loading" && navigation.location.pathname === "/jobs";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Find jobs</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Search LinkedIn listings, save the ones worth pursuing to your board,
        and tailor your resume to them.
      </p>

      {!configured ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-10 text-center">
          <p className="font-medium">
            Job search is not set up on this server.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            You can still add applications by hand and paste their job
            descriptions.
          </p>
          <Link
            to="/applications/new"
            className={`mt-5 inline-block ${primaryButtonClass}`}
          >
            Add application
          </Link>
        </div>
      ) : (
        <>
          <SearchForm search={search} searching={searching} />
          <section
            aria-label="Search results"
            aria-busy={searching}
            className={`mt-8 ${searching ? "opacity-60" : ""}`}
          >
            {error ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200"
              >
                {error}
              </p>
            ) : search.status === "valid" && results ? (
              <Results search={search} results={results} saved={saved} />
            ) : search.status === "idle" ? (
              <p className="text-sm text-slate-500">
                Enter keywords to search listings from the past week, or pick
                another posting window.
              </p>
            ) : null}
          </section>
          <p className="mt-10 text-xs text-slate-500">
            Listings come from LinkedIn through the licensed Fantastic.jobs API.
            Saving a listing copies its details to your board without another
            search.
          </p>
        </>
      )}
    </main>
  );
}
