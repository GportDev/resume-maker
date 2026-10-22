import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import { z } from "zod";
import {
  ExhibitCitation,
  type PositionLabel,
} from "../components/analysis-summary";
import { PaperPreview } from "../components/paper-preview";
import { Button, buttonClass, textLinkClass } from "../components/ui/button";
import { describedBy, Field, fieldClass } from "../components/ui/field";
import { PageHeader, Sheet, SheetSection } from "../components/ui/sheet";
import { useToast } from "../components/ui/toast";
import { UnsavedChangesGuard } from "../components/unsaved-guard";
import { requireUser } from "../lib/auth.server";
import { exhibitNumbers } from "../lib/contributions";
import {
  applyCoverLetterEdits,
  type CoverLetterContent,
  coverLetterContentSchema,
  coverLetterEditSchema,
  formatLetterDate,
  readParagraphFields,
  resolveCoverLetterSender,
} from "../lib/cover-letter";
import {
  getCoverLetter,
  getProfile,
  listExperiences,
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
  const [coverLetter, profile, experienceList] = await Promise.all([
    requireCoverLetter(user.id, params.coverLetterId),
    getProfile(user.id),
    listExperiences(user.id),
  ]);
  const exhibits = exhibitNumbers(experienceList);
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
  const coverLetter = await requireCoverLetter(user.id, params.coverLetterId);
  const content = coverLetterContentSchema.parse(coverLetter.content);
  const formData = await request.formData();
  const parsed = coverLetterEditSchema.safeParse({
    title: formData.get("title"),
    recipient: formData.get("recipient"),
    opening: formData.get("opening"),
    paragraphs: readParagraphFields(
      formData.getAll("paragraphRef"),
      formData.getAll("paragraph"),
    ),
    closing: formData.get("closing"),
  });
  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  const { title, ...edits } = parsed.data;
  let edited: ReturnType<typeof applyCoverLetterEdits>;
  try {
    edited = applyCoverLetterEdits(content, edits);
  } catch {
    return data(
      {
        errors: {
          form: "A paragraph no longer matches its source. Reload and try again.",
        },
      },
      { status: 400 },
    );
  }
  await updateCoverLetter(user.id, coverLetter.id, { title, content: edited });
  return data({ saved: true as const });
}

type ParagraphItem = {
  key: string;
  sourceIndex: number;
  text: string;
  savedText: string;
  sources: string[];
};

type LetterDraft = {
  title: string;
  recipient: string;
  opening: string;
  paragraphs: ParagraphItem[];
  closing: string;
};

function letterDraft(title: string, content: CoverLetterContent): LetterDraft {
  return {
    title,
    recipient: content.recipient,
    opening: content.opening,
    closing: content.closing,
    paragraphs: content.bodyParagraphs.map((paragraph, index) => ({
      key: String(index),
      sourceIndex: index,
      text: paragraph.text,
      savedText: paragraph.text,
      sources: paragraph.sourceExperienceIds,
    })),
  };
}

function serializeLetter(draft: LetterDraft) {
  return JSON.stringify({
    ...draft,
    paragraphs: draft.paragraphs.map(({ sourceIndex, text }) => [
      sourceIndex,
      text,
    ]),
  });
}

const iconButton =
  "grid size-7 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink disabled:opacity-30";

export default function CoverLetterEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const downloadAfterSave = useRef(false);
  const navigation = useNavigation();
  const saved = Boolean(actionData && "saved" in actionData);
  useToast(saved ? "Cover letter saved." : null, actionData);

  useEffect(() => {
    if (actionData && "errors" in actionData) downloadAfterSave.current = false;
  }, [actionData]);

  useEffect(() => {
    if (saved && navigation.state === "idle" && downloadAfterSave.current) {
      downloadAfterSave.current = false;
      window.location.assign(`/cover-letters/${loaderData.coverLetter.id}/pdf`);
    }
  }, [saved, navigation.state, loaderData.coverLetter.id]);

  return (
    <LetterForm
      key={loaderData.coverLetter.updatedAt.toString()}
      loaderData={loaderData}
      errors={actionData && "errors" in actionData ? actionData.errors : {}}
      onSaveAndDownload={() => {
        downloadAfterSave.current = true;
      }}
    />
  );
}

function LetterForm({
  loaderData,
  errors,
  onSaveAndDownload,
}: {
  loaderData: Route.ComponentProps["loaderData"];
  errors: Record<string, string>;
  onSaveAndDownload: () => void;
}) {
  const { coverLetter, content, sender, positions } = loaderData;
  const initial = useRef(letterDraft(coverLetter.title, content));
  const [draft, setDraft] = useState(initial.current);
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const isSaving = navigation.state === "submitting";
  const dirty = serializeLetter(draft) !== serializeLetter(initial.current);
  const labels = new Map<string, PositionLabel>(
    positions.map((position) => [position.id, position]),
  );
  const firstError = Object.values(errors)[0];
  const contact = [sender.email, sender.phone, sender.location].filter(Boolean);

  useEffect(() => {
    if (navigation.state === "idle") submittingRef.current = false;
  }, [navigation.state]);

  function updateParagraphs(
    change: (list: ParagraphItem[]) => ParagraphItem[],
  ) {
    setDraft((previous) => ({
      ...previous,
      paragraphs: change(previous.paragraphs),
    }));
  }

  function move(index: number, offset: number) {
    updateParagraphs((list) => {
      const target = index + offset;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [
        next[target] as ParagraphItem,
        next[index] as ParagraphItem,
      ];
      return next;
    });
  }

  const text = (name: "title" | "recipient" | "opening" | "closing") => ({
    id: name,
    name,
    value: draft[name],
    onChange: (event: { target: { value: string } }) =>
      setDraft({ ...draft, [name]: event.target.value }),
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describedBy(name, errors[name]),
  });

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
                  coverLetter.applicationId
                    ? `/applications/${coverLetter.applicationId}`
                    : `/analyses/${coverLetter.analysisId}`
                }
                className={textLinkClass}
              >
                ← Back to{" "}
                {coverLetter.applicationId ? "application" : "analysis"}
              </Link>
            }
            title="Cover letter"
            meta={coverLetter.title}
          />

          <SheetSection title="Letter" id="letter-heading">
            <div className="grid gap-5">
              <Field
                id="title"
                label="Title (not printed)"
                error={errors.title}
              >
                <input
                  {...text("title")}
                  required
                  maxLength={160}
                  className={fieldClass}
                />
              </Field>
              <Field id="recipient" label="Recipient" error={errors.recipient}>
                <input
                  {...text("recipient")}
                  required
                  maxLength={200}
                  className={fieldClass}
                />
              </Field>
              <Field id="opening" label="Opening" error={errors.opening}>
                <textarea
                  {...text("opening")}
                  required
                  maxLength={1_200}
                  className={`${fieldClass} min-h-20 leading-6 [field-sizing:content]`}
                />
              </Field>
            </div>
          </SheetSection>

          <SheetSection
            title="Body paragraphs"
            id="body-heading"
            description="Each paragraph keeps its link to the evidence it was written from. Reorder or remove; new paragraphs can't be added."
          >
            {errors.paragraphs ? (
              <p className="mb-3 text-[0.8125rem] text-danger">
                {errors.paragraphs}
              </p>
            ) : null}
            <ol className="space-y-4">
              {draft.paragraphs.map((paragraph, index) => {
                const label = `paragraph ${index + 1}`;
                return (
                  <li key={paragraph.key}>
                    <input
                      type="hidden"
                      name="paragraphRef"
                      value={paragraph.sourceIndex}
                    />
                    <div className="flex items-start gap-1.5">
                      <label
                        htmlFor={`paragraph-${paragraph.key}`}
                        className="sr-only"
                      >
                        Body {label}
                      </label>
                      <textarea
                        id={`paragraph-${paragraph.key}`}
                        name="paragraph"
                        value={paragraph.text}
                        onChange={(event) =>
                          updateParagraphs((items) =>
                            items.map((item) =>
                              item.key === paragraph.key
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                        maxLength={1_500}
                        className={`${fieldClass} min-h-24 font-serif text-[0.9375rem] leading-7 [field-sizing:content]`}
                      />
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          aria-label={`Move ${label} up`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className={iconButton}
                        >
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${label} down`}
                          disabled={index === draft.paragraphs.length - 1}
                          onClick={() => move(index, 1)}
                          className={iconButton}
                        >
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${label}`}
                          title={
                            draft.paragraphs.length === 1
                              ? "Keep at least one paragraph"
                              : "Remove paragraph"
                          }
                          disabled={draft.paragraphs.length === 1}
                          onClick={() =>
                            updateParagraphs((items) =>
                              items.filter(
                                (item) => item.key !== paragraph.key,
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
                          disabled={paragraph.text === paragraph.savedText}
                          onClick={() =>
                            updateParagraphs((items) =>
                              items.map((item) =>
                                item.key === paragraph.key
                                  ? { ...item, text: item.savedText }
                                  : item,
                              ),
                            )
                          }
                          className={iconButton}
                        >
                          <RotateCcw aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      <span>Cites</span>
                      {paragraph.sources.map((id) => {
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

          <SheetSection title="Closing" id="closing-heading">
            <Field id="closing" label="Closing" error={errors.closing}>
              <textarea
                {...text("closing")}
                required
                maxLength={800}
                className={`${fieldClass} min-h-16 leading-6 [field-sizing:content]`}
              />
            </Field>
          </SheetSection>

          <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center gap-3 border-t border-rule bg-sheet/95 px-5 py-3 backdrop-blur-[2px] sm:-mx-8 sm:px-8">
            <p
              role="status"
              className={`mr-auto text-sm ${firstError ? "text-danger" : dirty ? "text-warn" : "text-ink-3"}`}
            >
              {firstError ?? (dirty ? "Unsaved changes" : "All changes saved")}
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
                href={`/cover-letters/${coverLetter.id}/pdf`}
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
        <PaperPreview label="Cover letter preview">
          <article className="font-serif text-[14px] leading-[1.6]">
            <h2 className="font-sans text-[24px] leading-tight font-bold">
              {sender.fullName}
            </h2>
            {contact.length ? (
              <p className="mt-1 font-sans text-[11px] text-[#444]">
                {contact.join(" | ")}
              </p>
            ) : null}
            <p className="mt-8">{formatLetterDate(coverLetter.updatedAt)}</p>
            <p className="mt-6">{draft.recipient}</p>
            <p className="mt-4">{draft.opening}</p>
            {draft.paragraphs.map((paragraph) => (
              <p key={paragraph.key} className="mt-4">
                {paragraph.text}
              </p>
            ))}
            <p className="mt-4">{draft.closing}</p>
            <p className="mt-6 font-bold">{sender.fullName}</p>
          </article>
        </PaperPreview>
      </div>
    </main>
  );
}
