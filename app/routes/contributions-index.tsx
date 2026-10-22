import { CircleCheck, Lightbulb } from "lucide-react";
import { Link } from "react-router";
import { ButtonLink } from "../components/ui/button";
import { requireUser } from "../lib/auth.server";
import { exhibitNumbers } from "../lib/contributions";
import { lintEvidence } from "../lib/evidence-lint";
import { countWords } from "../lib/markdown-format";
import { listExperiences } from "../lib/repositories.server";
import type { Route } from "./+types/contributions-index";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const experienceList = await listExperiences(user.id);
  const exhibits = exhibitNumbers(experienceList);
  const files = experienceList
    .map((experience) => ({
      id: experience.id,
      position: experience.position,
      company: experience.company,
      exhibit: exhibits.get(experience.id) ?? null,
      words: countWords(experience.markdown),
      hints: lintEvidence(experience.markdown).map((hint) => hint.message),
      updatedAt: experience.updatedAt.toISOString(),
    }))
    .sort((left, right) => right.hints.length - left.hints.length);
  return { files };
}

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default function ContributionsIndex({
  loaderData,
}: Route.ComponentProps) {
  const { files } = loaderData;
  const needsWork = files.filter((file) => file.hints.length > 0);
  const weakest = needsWork[0];

  if (!files.length) {
    return (
      <section className="rounded-sheet bg-sheet p-8 shadow-sheet">
        <h2 className="text-[1.375rem] font-bold">File your first exhibit</h2>
        <p className="mt-2 max-w-xl text-ink-2">
          Each position you held gets one contribution file. Record context,
          what you did, measurable outcomes, and tools. Tailoring only uses
          evidence written here.
        </p>
        <ButtonLink to="/contributions/new" variant="primary" className="mt-6">
          Add first position
        </ButtonLink>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="evidence-health"
      className="rounded-sheet bg-sheet p-6 shadow-sheet sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <h2
            id="evidence-health"
            className="text-[1.375rem] font-bold tracking-[-0.01em]"
          >
            Evidence health
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {needsWork.length
              ? `${needsWork.length} of ${files.length} files have suggestions. Stronger evidence gives tailoring more to cite.`
              : `All ${files.length} files look complete.`}
          </p>
        </div>
        {weakest ? (
          <ButtonLink to={`/contributions/${weakest.id}`} variant="primary">
            Improve {weakest.position}
          </ButtonLink>
        ) : null}
      </div>
      <ul className="divide-y divide-rule">
        {files.map((file) => (
          <li key={file.id}>
            <Link
              to={`/contributions/${file.id}`}
              className="group flex flex-wrap items-start gap-x-4 gap-y-1 py-3.5"
            >
              <span className="w-12 shrink-0 pt-0.5">
                {file.exhibit ? (
                  <span className="rounded-stamp bg-manila-tint px-1 py-px text-[0.625rem] font-bold tracking-[0.06em] text-manila-ink uppercase">
                    Ex. {file.exhibit}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium group-hover:text-exhibit">
                  {file.position}
                </span>
                <span className="block text-[0.8125rem] text-ink-3">
                  {file.company} · {file.words} words · edited{" "}
                  {dateFormat.format(new Date(file.updatedAt))}
                </span>
              </span>
              <span className="text-[0.8125rem]">
                {file.hints.length ? (
                  <span className="flex items-center gap-1.5 text-manila-ink">
                    <Lightbulb aria-hidden="true" className="size-4" />
                    {file.hints.length}{" "}
                    {file.hints.length === 1 ? "suggestion" : "suggestions"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-ok">
                    <CircleCheck aria-hidden="true" className="size-4" />
                    Complete
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
