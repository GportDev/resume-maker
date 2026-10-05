import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { analyzeJob } from "../lib/ai.server";
import {
  logProviderError,
  NoAiKeyError,
  resolveLanguageModel,
} from "../lib/ai-provider.server";
import { type AiProvider, aiProviderDetails } from "../lib/ai-providers";
import {
  calculateAtsScore,
  sanitizeAnalysisExperienceIds,
} from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import {
  createAnalysis,
  getProfile,
  listAnalyses,
  listExperiences,
} from "../lib/repositories.server";
import type { Route } from "./+types/home";

const jobDescriptionSchema = z.string().trim().min(200).max(30_000);

export function meta() {
  return [
    { title: "Analyze a job | Resume Fit" },
    {
      name: "description",
      content: "Create an evidence-based resume tailored to a job.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [experienceList, analysisList] = await Promise.all([
    listExperiences(user.id),
    listAnalyses(user.id),
  ]);
  return { experienceList, analysisList };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const parsed = jobDescriptionSchema.safeParse(formData.get("jobDescription"));
  if (!parsed.success) {
    return data(
      { error: "Paste a job description with at least 200 characters." },
      { status: 400 },
    );
  }

  const [profile, experienceList] = await Promise.all([
    getProfile(user.id),
    listExperiences(user.id),
  ]);
  if (!experienceList.length) {
    return data(
      { error: "Add at least one work experience before analyzing a job." },
      { status: 400 },
    );
  }

  let provider: AiProvider | undefined;
  try {
    const resolved = await resolveLanguageModel(user.id);
    provider = resolved.provider;
    const rawAnalysis = await analyzeJob({
      model: resolved.model,
      jobDescription: parsed.data,
      profile,
      experiences: experienceList,
    });
    const analysis = sanitizeAnalysisExperienceIds(
      rawAnalysis,
      new Set(experienceList.map((experience) => experience.id)),
    );
    const profileValues = profile
      ? [
          profile.fullName,
          profile.headline,
          profile.email,
          profile.phone,
          profile.location,
          profile.website,
          profile.linkedin,
        ]
      : [];
    const score = calculateAtsScore({
      analysis,
      experienceText: experienceList
        .map(
          (experience) =>
            `${experience.position} ${experience.company} ${experience.markdown}`,
        )
        .join("\n"),
      profileFieldsCompleted: profileValues.filter(Boolean).length,
      profileFieldCount: 7,
    });
    const saved = await createAnalysis(user.id, {
      jobDescription: parsed.data,
      jobTitle: analysis.jobTitle,
      companyName: analysis.companyName,
      analysis,
      score,
    });
    return redirect(`/analyses/${saved.id}`);
  } catch (error) {
    if (error instanceof NoAiKeyError) {
      return data({ error: error.message }, { status: 400 });
    }
    logProviderError("analyze-job", provider, error);
    const label = provider ? aiProviderDetails[provider].label : "AI";
    return data(
      { error: `Analysis failed. Check your ${label} API key and try again.` },
      { status: 502 },
    );
  }
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isAnalyzing = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
        New application
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Turn your real experience into a focused resume.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-400">
        Paste a job description to see evidence-backed matches, gaps, and an
        editable ATS-friendly resume.
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
            minLength={200}
            maxLength={30_000}
            required
            className="mt-3 min-h-[28rem] w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-7 outline-none focus:border-cyan-400"
            placeholder="Paste the complete role description here…"
          />
          {actionData?.error ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {loaderData.experienceList.length} experience
              {loaderData.experienceList.length === 1 ? "" : "s"} available
            </p>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
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
            {!loaderData.experienceList.length ? (
              <Link
                to="/profile"
                className="mt-5 inline-block text-sm font-semibold text-cyan-400"
              >
                Add experience first
              </Link>
            ) : null}
          </div>

          <section className="mt-6">
            <h2 className="font-semibold">Recent analyses</h2>
            <div className="mt-3 space-y-3">
              {loaderData.analysisList.slice(0, 5).map((analysis) => (
                <Link
                  key={analysis.id}
                  to={`/analyses/${analysis.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
                >
                  <p className="font-medium">{analysis.jobTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {analysis.companyName || "Company not specified"}
                  </p>
                </Link>
              ))}
              {!loaderData.analysisList.length ? (
                <p className="text-sm text-slate-500">No analyses yet.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
