import { type ChangeEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { requireUser } from "../lib/auth.server";
import {
  createExperience,
  getExperience,
  updateExperience,
} from "../lib/repositories.server";
import { experienceInputSchema, firstFormError } from "../lib/validation";
import type { Route } from "./+types/experience-editor";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.experience ? "Edit" : "Add"} experience | Resume Fit`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const isNew = params.experienceId === "new";
  const experience = isNew
    ? null
    : await getExperience(user.id, params.experienceId);

  if (!isNew && !experience) {
    throw new Response("Experience not found.", { status: 404 });
  }

  const url = new URL(request.url);
  if (experience && url.searchParams.get("download") === "1") {
    const fileName = `${experience.company}-${experience.position}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return new Response(experience.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName || "experience"}.md"`,
      },
    });
  }

  return { experience };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const parsed = experienceInputSchema.safeParse({
    company: formData.get("company"),
    position: formData.get("position"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    markdown: formData.get("markdown"),
  });

  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  if (params.experienceId === "new") {
    await createExperience(user.id, parsed.data);
  } else {
    if (!z.uuid().safeParse(params.experienceId).success) {
      throw new Response("Experience not found.", { status: 404 });
    }
    const updated = await updateExperience(
      user.id,
      params.experienceId,
      parsed.data,
    );
    if (!updated) {
      throw new Response("Experience not found.", { status: 404 });
    }
  }
  return redirect("/profile");
}

export default function ExperienceEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const experience = loaderData.experience;
  const [markdown, setMarkdown] = useState(experience?.markdown ?? "");
  const [isCurrent, setIsCurrent] = useState(experience?.isCurrent ?? false);
  const errors = actionData?.errors ?? {};
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMarkdown(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/profile" className="text-sm text-cyan-400 hover:text-cyan-300">
        ← Back to profile
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Evidence entry
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {experience ? "Edit experience" : "Add experience"}
          </h1>
        </div>
        {experience ? (
          <a
            href={`?download=1`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400"
          >
            Export Markdown
          </a>
        ) : null}
      </div>

      <Form method="post" className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["company", "Company", experience?.company ?? ""],
              ["position", "Position", experience?.position ?? ""],
            ].map(([name, label, value]) => (
              <label key={name} className="block text-sm font-medium">
                {label}
                <input
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                  name={name}
                  defaultValue={value}
                  required
                />
                {errors[name] ? (
                  <span className="mt-1 block text-xs text-red-300">
                    {errors[name]}
                  </span>
                ) : null}
              </label>
            ))}
            <label className="block text-sm font-medium">
              Start date
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
                name="startDate"
                type="date"
                defaultValue={experience?.startDate}
                required
              />
              {errors.startDate ? (
                <span className="mt-1 block text-xs text-red-300">
                  {errors.startDate}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              End date
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:opacity-40"
                name="endDate"
                type="date"
                defaultValue={experience?.endDate ?? ""}
                disabled={isCurrent}
              />
              {errors.endDate ? (
                <span className="mt-1 block text-xs text-red-300">
                  {errors.endDate}
                </span>
              ) : null}
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              name="isCurrent"
              type="checkbox"
              checked={isCurrent}
              onChange={(event) => setIsCurrent(event.target.checked)}
              className="size-4 accent-cyan-400"
            />
            I currently work here
          </label>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="markdown" className="text-sm font-medium">
                Work evidence in Markdown
              </label>
              <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-xs hover:border-cyan-400">
                Import .md
                <input
                  className="sr-only"
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  onChange={importMarkdown}
                />
              </label>
            </div>
            <textarea
              id="markdown"
              name="markdown"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              className="mt-2 min-h-96 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 outline-none focus:border-cyan-400"
              placeholder={
                "## Highlights\n\n- Improved checkout conversion by 18%...\n- Built..."
              }
              required
            />
            {errors.markdown ? (
              <span className="mt-1 block text-xs text-red-300">
                {errors.markdown}
              </span>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            {isSaving ? "Saving…" : "Save experience"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Preview
          </p>
          <article className="prose prose-invert mt-5 max-w-none text-slate-300">
            {markdown ? (
              <ReactMarkdown>{markdown}</ReactMarkdown>
            ) : (
              <p className="text-slate-500">
                Markdown preview appears here. Include outcomes, metrics, tools,
                ownership, and project scope.
              </p>
            )}
          </article>
        </section>
      </Form>
    </main>
  );
}
