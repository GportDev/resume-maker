import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import {
  ExhibitCitation,
  type PositionLabel,
} from "../components/analysis-summary";
import { PaperPreview } from "../components/paper-preview";
import { SkillInput } from "../components/skill-input";
import { Button, buttonClass, textLinkClass } from "../components/ui/button";
import { Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import { useToast } from "../components/ui/toast";
import { UnsavedChangesGuard } from "../components/unsaved-guard";
import { requireUser } from "../lib/auth.server";
import { exhibitNumbers } from "../lib/contributions";
import {
  getResume,
  listExperiences,
  updateResume,
} from "../lib/repositories.server";
import {
  applyResumeEdits,
  type ResumeContent,
  ResumeEditError,
  readBulletFields,
  resumeContentSchema,
  resumeEditSchema,
} from "../lib/resume";
import type { Route } from "./+types/resume-editor";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.resume.title ?? "Resume"} | Resume Fit` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [resume, experienceList] = await Promise.all([
    getResume(user.id, params.resumeId),
    listExperiences(user.id),
  ]);
  if (!resume) {
    throw new Response("Resume not found.", { status: 404 });
  }
  const exhibits = exhibitNumbers(experienceList);
  return {
    resume,
    content: resumeContentSchema.parse(resume.content),
    positions: experienceList.map(({ id, position, company }) => ({
      id,
      position,
      company,
      exhibit: exhibits.get(id) ?? null,
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const resume = await getResume(user.id, params.resumeId);
  if (!resume) {
    throw new Response("Resume not found.", { status: 404 });
  }
  const content = resumeContentSchema.parse(resume.content);
  const formData = await request.formData();
  const parsed = resumeEditSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    skills: String(formData.get("skills") ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
    bullets: readBulletFields(
      formData.getAll("bulletRef"),
      formData.getAll("bullet"),
    ),
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
  } catch (error) {
    return data(
      {
        error:
          error instanceof ResumeEditError
            ? error.message
            : "Resume content could not be saved.",
      },
      { status: 400 },
    );
  }
}

function displayDate(value: string | null, current = false): string {
  if (current) return "Present";
  if (!value) return "";
  return value.slice(0, 7);
}

type BulletItem = {
  key: string;
  sourceIndex: number;
  text: string;
  savedText: string;
  sources: string[];
};

type Draft = {
  title: string;
  summary: string;
  skills: string[];
  bullets: BulletItem[][];
};

function draftFrom(content: ResumeContent): Draft {
  return {
    title: content.targetTitle,
    summary: content.summary,
    skills: content.skills,
    bullets: content.experiences.map((experience, experienceIndex) =>
      experience.bullets.map((bullet, sourceIndex) => ({
        key: `${experienceIndex}:${sourceIndex}`,
        sourceIndex,
        text: bullet.text,
        savedText: bullet.text,
        sources: bullet.sourceExperienceIds,
      })),
    ),
  };
}

function serialize(draft: Draft) {
  return JSON.stringify({
    ...draft,
    bullets: draft.bullets.map((list) =>
      list.map(({ sourceIndex, text }) => [sourceIndex, text]),
    ),
  });
}

const iconButton =
  "grid size-7 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink disabled:opacity-30";

export default function ResumeEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const downloadAfterSave = useRef(false);
  const navigation = useNavigation();
  const saved = Boolean(actionData && "saved" in actionData);
  useToast(saved ? "Resume saved." : null, actionData);

  useEffect(() => {
    if (actionData && "error" in actionData) downloadAfterSave.current = false;
  }, [actionData]);

  useEffect(() => {
    if (saved && navigation.state === "idle" && downloadAfterSave.current) {
      downloadAfterSave.current = false;
      window.location.assign(`/resumes/${loaderData.resume.id}/pdf`);
    }
  }, [saved, navigation.state, loaderData.resume.id]);

  return (
    <ResumeForm
      key={loaderData.resume.updatedAt.toString()}
      loaderData={loaderData}
      error={actionData && "error" in actionData ? actionData.error : undefined}
      onSaveAndDownload={() => {
        downloadAfterSave.current = true;
      }}
    />
  );
}

function ResumeForm({
  loaderData,
  error,
  onSaveAndDownload,
}: {
  loaderData: Route.ComponentProps["loaderData"];
  error?: string;
  onSaveAndDownload: () => void;
}) {
  const { resume, content, positions } = loaderData;
  const initial = useRef(draftFrom(content));
  const [draft, setDraft] = useState<Draft>(initial.current);
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const isSaving = navigation.state === "submitting";
  const dirty = serialize(draft) !== serialize(initial.current);
  const labels = new Map<string, PositionLabel>(
    positions.map((position) => [position.id, position]),
  );
  const pdfHref = `/resumes/${resume.id}/pdf`;

  useEffect(() => {
    if (navigation.state === "idle") submittingRef.current = false;
  }, [navigation.state]);

  function updateBullets(
    experienceIndex: number,
    change: (list: BulletItem[]) => BulletItem[],
  ) {
    setDraft((previous) => ({
      ...previous,
      bullets: previous.bullets.map((list, index) =>
        index === experienceIndex ? change(list) : list,
      ),
    }));
  }

  function moveBullet(experienceIndex: number, index: number, offset: number) {
    updateBullets(experienceIndex, (list) => {
      const target = index + offset;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [
        next[target] as BulletItem,
        next[index] as BulletItem,
      ];
      return next;
    });
  }

  return (
    <main
      id="main"
      className="mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <Sheet className="rounded-t-none pb-0 sm:pb-0">
        <Form
          ref={formRef}
          method="post"
          onSubmit={() => {
            submittingRef.current = true;
          }}
        >
          <PageHeader
            back={
              <Link
                to={
                  resume.applicationId
                    ? `/applications/${resume.applicationId}`
                    : `/analyses/${resume.analysisId}`
                }
                className={textLinkClass}
              >
                ← Back to {resume.applicationId ? "application" : "analysis"}
              </Link>
            }
            title="Resume"
            meta={resume.title}
          />

          <SheetSection title="Headline" id="headline-heading">
            <div className="grid gap-5">
              <Field id="title" label="Target title">
                <input
                  id="title"
                  name="title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  required
                  maxLength={160}
                  className={fieldClass}
                />
              </Field>
              <Field id="summary" label="Summary">
                <textarea
                  id="summary"
                  name="summary"
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft({ ...draft, summary: event.target.value })
                  }
                  required
                  maxLength={1_200}
                  className={`${fieldClass} min-h-28 leading-6 [field-sizing:content]`}
                />
              </Field>
              <div>
                <label
                  htmlFor="skills-input"
                  className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2"
                >
                  Skills
                </label>
                <SkillInput
                  id="skills-input"
                  name="skills"
                  skills={draft.skills}
                  onChange={(skills) => setDraft({ ...draft, skills })}
                />
              </div>
            </div>
          </SheetSection>

          {content.experiences.map((experience, experienceIndex) => {
            const list = draft.bullets[experienceIndex] ?? [];
            return (
              <SheetSection
                key={experience.experienceId}
                title={experience.position}
                description={experience.company}
              >
                <ol className="space-y-3">
                  {list.map((bullet, index) => {
                    const label = `bullet ${index + 1} of ${experience.position}`;
                    return (
                      <li key={bullet.key} className="group/bullet">
                        <input
                          type="hidden"
                          name="bulletRef"
                          value={`${experienceIndex}:${bullet.sourceIndex}`}
                        />
                        <div className="flex items-start gap-1.5">
                          <label
                            htmlFor={`bullet-${bullet.key}`}
                            className="sr-only"
                          >
                            {label}
                          </label>
                          <textarea
                            id={`bullet-${bullet.key}`}
                            name="bullet"
                            value={bullet.text}
                            onChange={(event) =>
                              updateBullets(experienceIndex, (items) =>
                                items.map((item) =>
                                  item.key === bullet.key
                                    ? { ...item, text: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            required
                            maxLength={500}
                            className={`${fieldClass} min-h-16 text-sm leading-6 [field-sizing:content]`}
                          />
                          <div className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              aria-label={`Move ${label} up`}
                              disabled={index === 0}
                              onClick={() =>
                                moveBullet(experienceIndex, index, -1)
                              }
                              className={iconButton}
                            >
                              <ArrowUp aria-hidden="true" className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${label} down`}
                              disabled={index === list.length - 1}
                              onClick={() =>
                                moveBullet(experienceIndex, index, 1)
                              }
                              className={iconButton}
                            >
                              <ArrowDown
                                aria-hidden="true"
                                className="size-4"
                              />
                            </button>
                          </div>
                          <div className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              aria-label={`Remove ${label}`}
                              title={
                                list.length === 1
                                  ? "Each position keeps at least one bullet"
                                  : "Remove bullet"
                              }
                              disabled={list.length === 1}
                              onClick={() =>
                                updateBullets(experienceIndex, (items) =>
                                  items.filter(
                                    (item) => item.key !== bullet.key,
                                  ),
                                )
                              }
                              className={iconButton}
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Revert ${label} to saved text`}
                              title="Revert to saved text"
                              disabled={bullet.text === bullet.savedText}
                              onClick={() =>
                                updateBullets(experienceIndex, (items) =>
                                  items.map((item) =>
                                    item.key === bullet.key
                                      ? { ...item, text: item.savedText }
                                      : item,
                                  ),
                                )
                              }
                              className={iconButton}
                            >
                              <RotateCcw
                                aria-hidden="true"
                                className="size-4"
                              />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                          <span>Cites</span>
                          {bullet.sources.map((id) => {
                            const position = labels.get(id);
                            return position ? (
                              <ExhibitCitation key={id} position={position} />
                            ) : null;
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </SheetSection>
            );
          })}

          <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-rule bg-sheet/95 px-5 py-3 backdrop-blur-[2px] sm:-mx-8 sm:px-8">
            <p
              role="status"
              className={`mr-auto text-sm ${error ? "text-danger" : dirty ? "text-warn" : "text-ink-3"}`}
            >
              {error ?? (dirty ? "Unsaved changes" : "All changes saved")}
            </p>
            <Button type="submit" variant="primary" pending={isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
            {dirty ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isSaving}
                onClick={() => {
                  onSaveAndDownload();
                  formRef.current?.requestSubmit();
                }}
              >
                Save and download PDF
              </Button>
            ) : (
              <a
                href={pdfHref}
                className={buttonClass({ variant: "secondary" })}
              >
                Download PDF
              </a>
            )}
          </div>
        </Form>
        <UnsavedChangesGuard dirty={dirty} submittingRef={submittingRef} />
      </Sheet>

      <div className="lg:sticky lg:top-4 lg:self-start lg:pt-6">
        <PaperPreview label="Resume preview">
          <ResumePaper content={content} draft={draft} />
        </PaperPreview>
      </div>
    </main>
  );
}

function ResumePaper({
  content,
  draft,
}: {
  content: ResumeContent;
  draft: Draft;
}) {
  const heading =
    "mt-5 border-b border-[#999] pb-0.5 text-[12px] font-bold tracking-[0.04em] uppercase";
  return (
    <article>
      <h2 className="text-[26px] leading-tight font-bold">
        {content.contact.fullName}
      </h2>
      <p className="mt-0.5 text-[14px]">{draft.title}</p>
      <p className="mt-1.5 text-[11px] text-[#444]">
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
      <h3 className={heading}>Professional Summary</h3>
      <p className="mt-1.5">{draft.summary}</p>
      <h3 className={heading}>Skills</h3>
      <p className="mt-1.5">{draft.skills.join(" • ")}</p>
      <h3 className={heading}>Experience</h3>
      {content.experiences.map((experience, experienceIndex) => (
        <section key={experience.experienceId} className="mt-3">
          <div className="flex justify-between gap-4 font-bold">
            <p>
              {experience.position} | {experience.company}
            </p>
            <p className="shrink-0">
              {displayDate(experience.startDate)} –{" "}
              {displayDate(experience.endDate, experience.isCurrent)}
            </p>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {(draft.bullets[experienceIndex] ?? []).map((bullet) => (
              <li key={bullet.key}>{bullet.text}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
