import { data, Form, Link, useNavigation } from "react-router";
import { z } from "zod";
import { requireUser } from "../lib/auth.server";
import {
  applyCoverLetterEdits,
  coverLetterContentSchema,
  coverLetterEditSchema,
  formatLetterDate,
  resolveCoverLetterSender,
} from "../lib/cover-letter";
import {
  getCoverLetter,
  getProfile,
  updateCoverLetter,
} from "../lib/repositories.server";
import { firstFormError } from "../lib/validation";
import type { Route } from "./+types/cover-letter-editor";

function notFound() {
  return new Response("Cover letter not found.", { status: 404 });
}

async function requireCoverLetter(userId: string, coverLetterId: string) {
  if (!z.uuid().safeParse(coverLetterId).success) throw notFound();
  const coverLetter = await getCoverLetter(userId, coverLetterId);
  if (!coverLetter) throw notFound();
  return coverLetter;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.coverLetter.title ?? "Cover letter"} | Resume Fit`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [coverLetter, profile] = await Promise.all([
    requireCoverLetter(user.id, params.coverLetterId),
    getProfile(user.id),
  ]);
  return {
    coverLetter: {
      id: coverLetter.id,
      title: coverLetter.title,
      applicationId: coverLetter.applicationId,
      analysisId: coverLetter.analysisId,
      updatedAt: coverLetter.updatedAt,
    },
    content: coverLetterContentSchema.parse(coverLetter.content),
    sender: resolveCoverLetterSender(profile, user),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const coverLetter = await requireCoverLetter(user.id, params.coverLetterId);
  const content = coverLetterContentSchema.parse(coverLetter.content);
  const formData = await request.formData();
  const parsed = coverLetterEditSchema.safeParse({
    title: formData.get("title"),
    recipient: formData.get("recipient"),
    opening: formData.get("opening"),
    paragraphs: formData.getAll("paragraph"),
    closing: formData.get("closing"),
  });
  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  const { title, ...edits } = parsed.data;
  await updateCoverLetter(user.id, coverLetter.id, {
    title,
    content: applyCoverLetterEdits(content, edits),
  });
  return data({ saved: true as const });
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-6 outline-none focus:border-cyan-400";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-300">
      {message}
    </p>
  ) : null;
}

export default function CoverLetterEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { coverLetter, content, sender } = loaderData;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const back = coverLetter.applicationId
    ? { to: `/applications/${coverLetter.applicationId}`, label: "application" }
    : { to: `/analyses/${coverLetter.analysisId}`, label: "analysis" };
  const contact = [sender.email, sender.phone, sender.location].filter(Boolean);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={back.to}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to {back.label}
        </Link>
        <a
          href={`/cover-letters/${coverLetter.id}/pdf`}
          className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Download PDF
        </a>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-2">
        <Form
          key={coverLetter.updatedAt.toString()}
          method="post"
          className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Cover letter editor
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{coverLetter.title}</h1>
          </div>
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={coverLetter.title}
              required
              maxLength={160}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "title-error" : undefined}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
            <FieldError id="title-error" message={errors.title} />
          </div>
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium">
              Greeting
            </label>
            <input
              id="recipient"
              name="recipient"
              defaultValue={content.recipient}
              required
              maxLength={200}
              aria-invalid={errors.recipient ? true : undefined}
              aria-describedby={
                errors.recipient ? "recipient-error" : undefined
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
            <FieldError id="recipient-error" message={errors.recipient} />
          </div>
          <div>
            <label htmlFor="opening" className="block text-sm font-medium">
              Opening
            </label>
            <textarea
              id="opening"
              name="opening"
              defaultValue={content.opening}
              required
              minLength={20}
              maxLength={1_200}
              aria-invalid={errors.opening ? true : undefined}
              aria-describedby={errors.opening ? "opening-error" : undefined}
              className={`${inputClass} min-h-28`}
            />
            <FieldError id="opening-error" message={errors.opening} />
          </div>
          <fieldset className="space-y-4 rounded-xl border border-slate-800 p-4">
            <legend className="px-2 font-medium">Body paragraphs</legend>
            <p className="text-xs text-slate-500">
              Each paragraph keeps its link to the experience it was written
              from.
            </p>
            {content.bodyParagraphs.map((paragraph, index) => (
              <div
                key={`${paragraph.sourceExperienceIds.join(":")}:${paragraph.text}`}
              >
                <label
                  htmlFor={`paragraph-${index}`}
                  className="block text-xs text-slate-400"
                >
                  Paragraph {index + 1}
                </label>
                <textarea
                  id={`paragraph-${index}`}
                  name="paragraph"
                  defaultValue={paragraph.text}
                  required
                  minLength={40}
                  maxLength={1_500}
                  className={`${inputClass} min-h-32 text-sm`}
                />
              </div>
            ))}
            <FieldError id="paragraphs-error" message={errors.paragraphs} />
          </fieldset>
          <div>
            <label htmlFor="closing" className="block text-sm font-medium">
              Closing
            </label>
            <textarea
              id="closing"
              name="closing"
              defaultValue={content.closing}
              required
              minLength={10}
              maxLength={800}
              aria-invalid={errors.closing ? true : undefined}
              aria-describedby={errors.closing ? "closing-error" : undefined}
              className={`${inputClass} min-h-24`}
            />
            <FieldError id="closing-error" message={errors.closing} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-950 hover:bg-white disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <span role="status" className="text-sm text-emerald-300">
              {actionData && "saved" in actionData ? "Saved." : ""}
            </span>
          </div>
        </Form>

        <section aria-labelledby="preview-heading">
          <p
            id="preview-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500"
          >
            Preview
          </p>
          <article className="min-h-[60rem] bg-white p-12 text-[0.95rem] leading-7 text-slate-900 shadow-2xl">
            <h2 className="text-3xl font-bold">{sender.fullName}</h2>
            {contact.length ? (
              <p className="mt-1 text-xs text-slate-600">
                {contact.join(" | ")}
              </p>
            ) : null}
            <p className="mt-8">{formatLetterDate(coverLetter.updatedAt)}</p>
            <p className="mt-6">{content.recipient}</p>
            <p className="mt-4">{content.opening}</p>
            {content.bodyParagraphs.map((paragraph) => (
              <p
                key={`${paragraph.sourceExperienceIds.join(":")}:${paragraph.text}`}
                className="mt-4"
              >
                {paragraph.text}
              </p>
            ))}
            <p className="mt-4">{content.closing}</p>
            <p className="mt-6 font-bold">{sender.fullName}</p>
          </article>
        </section>
      </div>
    </main>
  );
}
