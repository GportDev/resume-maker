import { Link } from "react-router";
import { z } from "zod";
import { AnalysisSummary, FitScore } from "../components/analysis-summary";
import { ButtonLink, textLinkClass } from "../components/ui/button";
import { PageHeader, Sheet } from "../components/ui/sheet";
import { jobAnalysisSchema, scoreBreakdownSchema } from "../lib/analysis";
import { requireUser } from "../lib/auth.server";
import { exhibitNumbers } from "../lib/contributions";
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
  const exhibits = exhibitNumbers(experienceList);
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
      exhibit: exhibits.get(id) ?? null,
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
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <Sheet className="rounded-t-none">
        <PageHeader
          back={
            <Link to="/" className={textLinkClass}>
              ← Home
            </Link>
          }
          title={record.jobTitle}
          meta={`${record.companyName || "Company not specified"} · ${analysis.seniority || "Seniority not specified"}`}
        />
        <AnalysisSummary
          analysis={analysis}
          score={score}
          keywordMatch={keywordMatch}
          positions={positions}
        />
      </Sheet>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:pt-6">
        <FitScore score={score}>
          <div className="mt-5 border-t border-rule pt-4">
            {record.applicationId ? (
              <ButtonLink
                to={`/applications/${record.applicationId}/tailor`}
                variant="primary"
                className="w-full"
              >
                Open tailoring
              </ButtonLink>
            ) : (
              <p className="text-sm text-ink-2">
                Read-only. To write documents, paste this job on the{" "}
                <Link to="/" className={textLinkClass}>
                  home page
                </Link>{" "}
                and save it to an application.
              </p>
            )}
          </div>
        </FitScore>
        {documents.resumes.length || documents.coverLetters.length ? (
          <nav
            aria-label="Documents from this analysis"
            className="rounded-sheet bg-sheet p-5 text-sm shadow-sheet"
          >
            <h2 className="font-semibold">Documents</h2>
            <ul className="mt-3 space-y-2">
              {documents.resumes.map((resume) => (
                <li key={resume.id}>
                  <Link to={`/resumes/${resume.id}`} className={textLinkClass}>
                    Resume: {resume.title}
                  </Link>
                </li>
              ))}
              {documents.coverLetters.map((coverLetter) => (
                <li key={coverLetter.id}>
                  <Link
                    to={`/cover-letters/${coverLetter.id}`}
                    className={textLinkClass}
                  >
                    {coverLetter.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </aside>
    </main>
  );
}
