import { Link } from "react-router";
import { z } from "zod";
import { AnalysisSummary, FitScore } from "../components/analysis-summary";
import { jobAnalysisSchema, scoreBreakdownSchema } from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import { matchKeywordsToExperiences } from "../lib/keyword-match";
import {
  getAnalysis,
  listAnalysisDocuments,
  listExperiences,
} from "../lib/repositories.server";
import type { Route } from "./+types/analysis-result";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.record.jobTitle ?? "Analysis"} | Resume Fit`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  if (!z.uuid().safeParse(params.analysisId).success) {
    throw new Response("Analysis not found.", { status: 404 });
  }
  const [record, experienceList, documents] = await Promise.all([
    getAnalysis(user.id, params.analysisId),
    listExperiences(user.id),
    listAnalysisDocuments(user.id, params.analysisId),
  ]);
  if (!record) {
    throw new Response("Analysis not found.", { status: 404 });
  }

  const analysis = jobAnalysisSchema.parse(record.analysis);
  return {
    record: {
      id: record.id,
      jobTitle: record.jobTitle,
      companyName: record.companyName,
      applicationId: record.applicationId,
      createdAt: record.createdAt,
    },
    analysis,
    score: scoreBreakdownSchema.parse(record.score),
    keywordMatch: matchKeywordsToExperiences(analysis, experienceList),
    positions: experienceList.map(({ id, position, company }) => ({
      id,
      position,
      company,
    })),
    documents,
  };
}

export default function AnalysisResult({ loaderData }: Route.ComponentProps) {
  const { record, analysis, score, keywordMatch, positions, documents } =
    loaderData;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/" className="text-sm text-cyan-400 hover:text-cyan-300">
        ← New analysis
      </Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FitScore score={score}>
            {record.applicationId ? (
              <Link
                to={`/applications/${record.applicationId}/tailor`}
                className="mt-6 block rounded-xl bg-cyan-400 px-4 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Open tailoring
              </Link>
            ) : (
              <p className="mt-6 text-sm text-slate-400">
                Read-only. To generate documents, paste this job on the{" "}
                <Link to="/" className="text-cyan-400 hover:text-cyan-300">
                  home page
                </Link>{" "}
                and save it to an application.
              </p>
            )}
          </FitScore>
          {documents.resumes.length || documents.coverLetters.length ? (
            <nav
              aria-label="Documents from this analysis"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm"
            >
              <h2 className="font-semibold">Documents</h2>
              <ul className="mt-3 space-y-2">
                {documents.resumes.map((resume) => (
                  <li key={resume.id}>
                    <Link
                      to={`/resumes/${resume.id}`}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Resume: {resume.title}
                    </Link>
                  </li>
                ))}
                {documents.coverLetters.map((coverLetter) => (
                  <li key={coverLetter.id}>
                    <Link
                      to={`/cover-letters/${coverLetter.id}`}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {coverLetter.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </aside>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Analysis
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{record.jobTitle}</h1>
          <p className="mt-2 mb-8 text-slate-400">
            {record.companyName || "Company not specified"} ·{" "}
            {analysis.seniority || "Seniority not specified"}
          </p>
          <AnalysisSummary
            analysis={analysis}
            score={score}
            keywordMatch={keywordMatch}
            positions={positions}
          />
        </div>
      </div>
    </main>
  );
}
