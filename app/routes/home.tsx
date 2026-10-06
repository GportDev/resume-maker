import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import {
  jobDescriptionInputSchema,
  jobDescriptionMaxLength,
  jobDescriptionMinLength,
} from "../lib/analysis";
import { applicationStatusLabels } from "../lib/applications";
import { requireUser } from "../lib/auth.server";
import {
  listAnalyses,
  listApplicationOptions,
  listExperiences,
} from "../lib/repositories.server";
import {
  describeTailoringFailure,
  runQuickTailoring,
} from "../lib/tailoring.server";
import type { Route } from "./+types/home";

const newApplication = "new";

const applicationChoiceSchema = z.union([
  z.literal(newApplication).transform(() => undefined),
  z.uuid(),
]);

export function meta() {
  return [
    { title: "Tailor a job | Resume Fit" },
    {
      name: "description",
      content: "Create an evidence-based resume and cover letter for a job.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [experienceList, applicationOptions, analysisList] = await Promise.all([
    listExperiences(user.id),
    listApplicationOptions(user.id),
    listAnalyses(user.id),
  ]);
  const selected = new URL(request.url).searchParams.get("application");
  return {
    experienceCount: experienceList.length,
    applicationOptions,
    selectedApplication:
      applicationOptions.find((option) => option.id === selected)?.id ??
      newApplication,
    recentAnalyses: analysisList.slice(0, 5).map((analysis) => ({
      id: analysis.id,
      jobTitle: analysis.jobTitle,
      companyName: analysis.companyName,
      applicationId: analysis.applicationId,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const jobDescription = jobDescriptionInputSchema.safeParse(
    formData.get("jobDescription"),
  );
  if (!jobDescription.success) {
    return data(
      {
        error:
          jobDescription.error.issues[0]?.message ?? "Paste a job description.",
      },
      { status: 400 },
    );
  }
  const application = applicationChoiceSchema.safeParse(
    formData.get("applicationId") ?? newApplication,
  );
  if (!application.success) {
    return data({ error: "Choose an application." }, { status: 400 });
  }

  const result = await runQuickTailoring(user.id, {
    applicationId: application.data,
    jobDescription: jobDescription.data,
  });
  if (!result.ok) {
    const { status, message } = describeTailoringFailure(result, "analysis");
    return data({ error: message }, { status });
  }
  return redirect(`/applications/${result.applicationId}/tailor`);
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const {
    experienceCount,
    applicationOptions,
    selectedApplication,
    recentAnalyses,
  } = loaderData;
  const navigation = useNavigation();
  const isAnalyzing = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
        Quick tailor
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Turn your real experience into a focused resume.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-400">
        Paste a job description to see which positions match its keywords, then
        write a tailored resume and cover letter saved on the application.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Form
          method="post"
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <label htmlFor="jobDescription" className="text-sm font-medium">
            Job description
          </label>
          <textarea
            id="jobDescription"
            name="jobDescription"
            minLength={jobDescriptionMinLength}
            maxLength={jobDescriptionMaxLength}
            required
            aria-invalid={actionData?.error ? true : undefined}
            aria-describedby={actionData?.error ? "home-error" : undefined}
            className="mt-3 min-h-[24rem] w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-7 outline-none focus:border-cyan-400"
            placeholder="Paste the complete role description here…"
          />
          <label
            htmlFor="applicationId"
            className="mt-5 block text-sm font-medium"
          >
            Save to application
          </label>
          <select
            id="applicationId"
            name="applicationId"
            defaultValue={selectedApplication}
            aria-describedby="applicationId-hint"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
          >
            <option value={newApplication}>
              Create a new application from this job
            </option>
            {applicationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.position} at {option.companyName} (
                {applicationStatusLabels[option.status]})
              </option>
            ))}
          </select>
          <p id="applicationId-hint" className="mt-1 text-xs text-slate-500">
            New applications take position and company from the analysis and
            start in Saved. Choosing an existing one replaces its job
            description.
          </p>
          {actionData?.error ? (
            <p
              id="home-error"
              className="mt-3 text-sm text-red-300"
              role="alert"
            >
              {actionData.error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {experienceCount} experience
              {experienceCount === 1 ? "" : "s"} available
            </p>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {isAnalyzing ? "Analyzing…" : "Analyze job"}
            </button>
          </div>
        </Form>

        <aside>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Before you analyze</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li>Use complete job text, including requirements.</li>
              <li>Keep experience evidence factual and specific.</li>
              <li>Score is a fit heuristic, not hiring probability.</li>
            </ul>
            {!experienceCount ? (
              <Link
                to="/contributions"
                className="mt-5 inline-block text-sm font-semibold text-cyan-400"
              >
                Add experience first
              </Link>
            ) : null}
          </div>

          <section className="mt-6">
            <h2 className="font-semibold">Recent analyses</h2>
            <div className="mt-3 space-y-3">
              {recentAnalyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  to={
                    analysis.applicationId
                      ? `/applications/${analysis.applicationId}/tailor`
                      : `/analyses/${analysis.id}`
                  }
                  className="block rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
                >
                  <p className="font-medium">{analysis.jobTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {analysis.companyName || "Company not specified"}
                  </p>
                </Link>
              ))}
              {!recentAnalyses.length ? (
                <p className="text-sm text-slate-500">No analyses yet.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
