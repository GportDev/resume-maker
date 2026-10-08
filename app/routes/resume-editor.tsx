import { data, Form, Link, useNavigation } from "react-router";
import { z } from "zod";
import { requireUser } from "../lib/auth.server";
import { getResume, updateResume } from "../lib/repositories.server";
import { applyResumeEdits, resumeContentSchema } from "../lib/resume";
import type { Route } from "./+types/resume-editor";

const editSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(20).max(1_200),
  skills: z.array(z.string().trim().min(1).max(100)).min(1).max(40),
  bullets: z.array(z.string().trim().min(10).max(500)).min(1).max(96),
});

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.resume.title ?? "Resume"} | Resume Fit` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const resume = await getResume(user.id, params.resumeId);
  if (!resume) {
    throw new Response("Resume not found.", { status: 404 });
  }
  return { resume, content: resumeContentSchema.parse(resume.content) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const resume = await getResume(user.id, params.resumeId);
  if (!resume) {
    throw new Response("Resume not found.", { status: 404 });
  }
  const content = resumeContentSchema.parse(resume.content);
  const formData = await request.formData();
  const parsed = editSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
    bullets: formData.getAll("bullet"),
  });
  if (!parsed.success) {
    return data(
      { error: parsed.error.issues[0]?.message ?? "Invalid resume content." },
      { status: 400 },
    );
  }

  try {
    const edited = applyResumeEdits(content, parsed.data);
    await updateResume(user.id, resume.id, {
      title: parsed.data.title,
      content: edited,
    });
    return data({ saved: true });
  } catch {
    return data(
      { error: "Resume content could not be saved." },
      { status: 400 },
    );
  }
}

function displayDate(value: string | null, current = false): string {
  if (current) return "Present";
  if (!value) return "";
  return value.slice(0, 7);
}

export default function ResumeEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { resume, content } = loaderData;
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={
            resume.applicationId
              ? `/applications/${resume.applicationId}`
              : `/analyses/${resume.analysisId}`
          }
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to {resume.applicationId ? "application" : "analysis"}
        </Link>
        <a
          href={`/resumes/${resume.id}/pdf`}
          className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Download PDF
        </a>
      </div>

      <Form method="post" className="mt-7 grid gap-8 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Resume editor
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{resume.title}</h1>
          </div>
          <label className="block text-sm font-medium">
            Target title
            <input
              name="title"
              defaultValue={content.targetTitle}
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block text-sm font-medium">
            Summary
            <textarea
              name="summary"
              defaultValue={content.summary}
              required
              className="mt-2 min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-6 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block text-sm font-medium">
            Skills, comma separated
            <textarea
              name="skills"
              defaultValue={content.skills.join(", ")}
              required
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-6 outline-none focus:border-cyan-400"
            />
          </label>
          {content.experiences.map((experience) => (
            <fieldset
              key={experience.experienceId}
              className="rounded-xl border border-slate-800 p-4"
            >
              <legend className="px-2 font-medium">
                {experience.position} · {experience.company}
              </legend>
              <div className="mt-2 space-y-3">
                {experience.bullets.map((bullet, index) => (
                  <label
                    key={`${bullet.sourceExperienceIds.join(":")}:${bullet.text}`}
                    className="block text-xs text-slate-500"
                  >
                    Bullet {index + 1}
                    <textarea
                      name="bullet"
                      defaultValue={bullet.text}
                      required
                      className="mt-1 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {actionData && "error" in actionData ? (
            <p className="text-sm text-red-300" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            {actionData && "saved" in actionData ? (
              <span role="status" className="text-sm text-emerald-300">
                Saved.
              </span>
            ) : null}
          </div>
        </section>

        <section>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            ATS-safe preview
          </p>
          <article className="min-h-[70rem] bg-white p-10 text-sm leading-6 text-slate-900 shadow-2xl">
            <h2 className="text-3xl font-bold">{content.contact.fullName}</h2>
            <p className="mt-1 text-base">{content.targetTitle}</p>
            <p className="mt-2 text-xs text-slate-600">
              {[
                content.contact.email,
                content.contact.phone,
                content.contact.location,
                content.contact.website,
                content.contact.linkedin,
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
            <h3 className="mt-7 border-b border-slate-400 pb-1 font-bold uppercase">
              Professional Summary
            </h3>
            <p className="mt-2">{content.summary}</p>
            <h3 className="mt-7 border-b border-slate-400 pb-1 font-bold uppercase">
              Skills
            </h3>
            <p className="mt-2">{content.skills.join(" • ")}</p>
            <h3 className="mt-7 border-b border-slate-400 pb-1 font-bold uppercase">
              Experience
            </h3>
            {content.experiences.map((experience) => (
              <section key={experience.experienceId} className="mt-4">
                <div className="flex justify-between gap-4 font-bold">
                  <p>
                    {experience.position} | {experience.company}
                  </p>
                  <p className="shrink-0">
                    {displayDate(experience.startDate)} –{" "}
                    {displayDate(experience.endDate, experience.isCurrent)}
                  </p>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {experience.bullets.map((bullet) => (
                    <li
                      key={`${bullet.sourceExperienceIds.join(":")}:${bullet.text}`}
                    >
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        </section>
      </Form>
    </main>
  );
}
