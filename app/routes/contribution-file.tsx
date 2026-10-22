import {
  CircleCheck,
  Download,
  FileUp,
  Lightbulb,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  data,
  Form,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useBeforeUnload,
  useBlocker,
  useFetcher,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { MarkdownEditor } from "../components/markdown-editor";
import { Button, ButtonLink, buttonClass } from "../components/ui/button";
import { ConfirmDialog, openDialog } from "../components/ui/confirm-dialog";
import { Popover, popoverItemClass } from "../components/ui/popover";
import { requireUser } from "../lib/auth.server";
import {
  contributionTemplate,
  exhibitNumbers,
  type ImportMode,
  mergeImportedMarkdown,
} from "../lib/contributions";
import { lintEvidence } from "../lib/evidence-lint";
import {
  createExperience,
  deleteExperience,
  getExperience,
  listCompanies,
  listExperiences,
  resolveExperienceCompany,
  updateExperience,
} from "../lib/repositories.server";
import { experienceInputSchema, firstFormError } from "../lib/validation";
import type { Route } from "./+types/contribution-file";

const autosaveDelayMs = 1200;
const maxImportBytes = 200_000;
const notFound = () =>
  new Response("Contribution file not found.", { status: 404 });

export function meta({ loaderData }: Route.MetaArgs) {
  const experience = loaderData?.experience;
  return [
    {
      title: `${experience ? `${experience.position} at ${experience.company}` : "New position"} | Resume Fit`,
    },
  ];
}

function requireExperienceId(experienceId: string): string {
  if (!z.uuid().safeParse(experienceId).success) throw notFound();
  return experienceId;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUser(request);
  const [companyList, experienceList] = await Promise.all([
    listCompanies(user.id),
    listExperiences(user.id),
  ]);
  const companyOptions = companyList.map(({ id, name }) => ({ id, name }));

  if (params.experienceId === "new") {
    const requested = new URL(request.url).searchParams.get("companyId") ?? "";
    const preselected = companyOptions.some((item) => item.id === requested)
      ? requested
      : (companyOptions[0]?.id ?? "");
    return {
      experience: null,
      exhibit: null,
      companies: companyOptions,
      initialCompanyId: preselected,
      initialMarkdown: contributionTemplate(),
    };
  }

  const experienceId = requireExperienceId(params.experienceId);
  if (new URL(request.url).searchParams.get("download") === "1") {
    throw redirect(`/contributions/${experienceId}/download`);
  }
  const experience = await getExperience(user.id, experienceId);
  if (!experience) throw notFound();

  return {
    experience,
    exhibit: exhibitNumbers(experienceList).get(experience.id) ?? null,
    companies: companyOptions,
    initialCompanyId: experience.companyId,
    initialMarkdown: experience.markdown,
  };
}

function readExperienceForm(formData: FormData) {
  return experienceInputSchema.safeParse({
    companyId: formData.get("companyId") ?? "",
    newCompanyName: formData.get("newCompanyName") ?? "",
    position: formData.get("position"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    markdown: formData.get("markdown"),
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const isNew = params.experienceId === "new";

  if (intent === "delete") {
    if (isNew) throw notFound();
    if (formData.get("confirm") !== "yes") {
      return data(
        {
          errors: { delete: "Confirm that you want to delete this position." },
        },
        { status: 400 },
      );
    }
    const deleted = await deleteExperience(
      user.id,
      requireExperienceId(params.experienceId),
    );
    if (!deleted) throw notFound();
    return redirect("/contributions");
  }

  const parsed = readExperienceForm(formData);

  if (intent === "autosave") {
    if (isNew) throw notFound();
    if (!parsed.success) {
      return data(
        { autosaveErrors: firstFormError(parsed.error) },
        { status: 400 },
      );
    }
    const { company: choice, ...fields } = parsed.data;
    // Autosave never creates companies; a new company needs an explicit save.
    if (choice.kind !== "existing") {
      return data(
        { autosaveErrors: { companyId: "Save to create the new company." } },
        { status: 400 },
      );
    }
    const company = await resolveExperienceCompany(user.id, choice);
    if (!company) {
      return data(
        { autosaveErrors: { companyId: "Choose one of your companies." } },
        { status: 400 },
      );
    }
    const updated = await updateExperience(
      user.id,
      requireExperienceId(params.experienceId),
      { ...fields, companyId: company.id },
    );
    if (!updated) throw notFound();
    return data({ autosaved: true as const });
  }

  if (!parsed.success) {
    return data({ errors: firstFormError(parsed.error) }, { status: 400 });
  }

  const { company: companyChoice, ...fields } = parsed.data;
  const company = await resolveExperienceCompany(user.id, companyChoice);
  if (!company) {
    return data(
      { errors: { companyId: "Choose one of your companies." } },
      { status: 400 },
    );
  }

  if (isNew) {
    const created = await createExperience(user.id, {
      ...fields,
      companyId: company.id,
    });
    if (!created) throw new Error("Position could not be created.");
    return redirect(`/contributions/${created.id}`);
  }

  const updated = await updateExperience(
    user.id,
    requireExperienceId(params.experienceId),
    { ...fields, companyId: company.id },
  );
  if (!updated) throw notFound();
  return data({ saved: true as const });
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formData?.get("intent") === "autosave") return false;
  return defaultShouldRevalidate;
}

type AutosaveResult =
  | { autosaved: true }
  | { autosaveErrors: Record<string, string> };
type PendingImport = { texts: string[]; names: string[] };
type Details = {
  companyId: string;
  newCompanyName: string;
  position: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};
type Snapshot = Details & { markdown: string };

export default function ContributionFile({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <ContributionEditor
      key={loaderData.experience?.id ?? "new"}
      loaderData={loaderData}
      actionData={actionData}
    />
  );
}

function sameSnapshot(left: Snapshot, right: Snapshot) {
  return (Object.keys(left) as (keyof Snapshot)[]).every(
    (key) => left[key] === right[key],
  );
}

function snapshotForm(snapshot: Snapshot) {
  const form: Record<string, string> = {
    intent: "autosave",
    companyId: snapshot.companyId,
    newCompanyName: snapshot.newCompanyName,
    position: snapshot.position,
    startDate: snapshot.startDate,
    endDate: snapshot.isCurrent ? "" : snapshot.endDate,
    markdown: snapshot.markdown,
  };
  if (snapshot.isCurrent) form.isCurrent = "on";
  return form;
}

const propertyLabel = "pt-1.5 text-[0.8125rem] text-ink-3";
const propertyField =
  "rounded-[4px] border border-transparent bg-transparent px-1.5 py-1 text-[0.9375rem] text-ink hover:border-rule focus:border-exhibit focus:bg-field focus-visible:outline-none aria-invalid:border-danger";

function ContributionEditor({
  loaderData,
  actionData,
}: Pick<Route.ComponentProps, "loaderData" | "actionData">) {
  const { experience, exhibit, companies, initialCompanyId, initialMarkdown } =
    loaderData;
  const isNew = !experience;
  const initial: Snapshot = {
    companyId: initialCompanyId,
    newCompanyName: "",
    position: experience?.position ?? "",
    startDate: experience?.startDate ?? "",
    endDate: experience?.endDate ?? "",
    isCurrent: experience?.isCurrent ?? false,
    markdown: initialMarkdown,
  };

  const [current, setCurrent] = useState<Snapshot>(initial);
  const [saved, setSaved] = useState<Snapshot>(initial);
  const [failed, setFailed] = useState<Snapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null,
  );
  const [importError, setImportError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const autosave = useFetcher<AutosaveResult>();
  const submittedRef = useRef<Snapshot | null>(null);
  const submittingRef = useRef(false);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  const importDialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigation = useNavigation();

  const dirty = !sameSnapshot(current, saved);
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";
  const formErrors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};
  const autosaveErrors =
    autosave.data && "autosaveErrors" in autosave.data && failed
      ? autosave.data.autosaveErrors
      : {};
  const errors = { ...autosaveErrors, ...formErrors };
  const hints = lintEvidence(current.markdown);

  function update<K extends keyof Snapshot>(key: K, value: Snapshot[K]) {
    setCurrent((previous) => ({ ...previous, [key]: value }));
  }

  useEffect(() => setHydrated(true), []);

  // Refresh "Saved · 2 min ago" once a minute.
  useEffect(() => {
    if (!lastSavedAt) return;
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [lastSavedAt]);

  useEffect(() => {
    if (navigation.state === "idle") submittingRef.current = false;
  }, [navigation.state]);

  useEffect(() => {
    if (!autosave.data || autosave.state !== "idle") return;
    const submitted = submittedRef.current;
    if (!submitted) return;
    if ("autosaved" in autosave.data) {
      setSaved(submitted);
      setFailed(null);
      setLastSavedAt(Date.now());
    } else {
      setFailed(submitted);
    }
    submittedRef.current = null;
  }, [autosave.data, autosave.state]);

  const submitAutosave = autosave.submit;
  const saveNowRef = useRef<() => void>(() => {});
  saveNowRef.current = () => {
    if (isNew) {
      formRef.current?.requestSubmit();
      return;
    }
    if (!dirty || autosave.state !== "idle" || current.companyId === "") return;
    submittedRef.current = current;
    submitAutosave(snapshotForm(current), { method: "post" });
  };

  useEffect(() => {
    if (isNew || !dirty || autosave.state !== "idle") return;
    if (current.companyId === "") return;
    if (failed && sameSnapshot(current, failed)) return;
    const timer = window.setTimeout(
      () => saveNowRef.current(),
      autosaveDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [isNew, dirty, autosave.state, current, failed]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || autosave.state !== "idle") &&
      !submittingRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (!dialog) return;
    if (blocker.state === "blocked" && !dialog.open) dialog.showModal();
    if (blocker.state !== "blocked" && dialog.open) dialog.close();
  }, [blocker.state]);

  useEffect(() => {
    const dialog = importDialogRef.current;
    if (!dialog) return;
    if (pendingImport && !dialog.open) dialog.showModal();
    if (!pendingImport && dialog.open) dialog.close();
  }, [pendingImport]);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [dirty],
    ),
  );

  async function importFiles(files: File[]) {
    setImportError("");
    if (!files.length) return;
    const tooLarge = files.find((file) => file.size > maxImportBytes);
    if (tooLarge) {
      setImportError(`${tooLarge.name} is larger than 200 KB.`);
      return;
    }
    try {
      const texts = await Promise.all(files.map((file) => file.text()));
      const untouchedTemplate = isNew && current.markdown === initialMarkdown;
      if (current.markdown.trim() && !untouchedTemplate) {
        setPendingImport({ texts, names: files.map((file) => file.name) });
      } else {
        update("markdown", mergeImportedMarkdown("", texts, "replace"));
      }
    } catch (error) {
      console.warn("Markdown import failed", error);
      setImportError("Files could not be read. Try plain .md or .txt files.");
    }
  }

  function onImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    void importFiles(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      /\.(md|markdown|txt)$/i.test(file.name),
    );
    if (!files.length) {
      setImportError("Drop .md, .markdown, or .txt files.");
      return;
    }
    void importFiles(files);
  }

  function confirmImport(mode: ImportMode) {
    if (!pendingImport) return;
    update(
      "markdown",
      mergeImportedMarkdown(current.markdown, pendingImport.texts, mode),
    );
    setPendingImport(null);
  }

  const firstAutosaveError = Object.values(autosaveErrors)[0];
  const savedAgo = lastSavedAt
    ? Math.round((Date.now() - lastSavedAt) / 60_000)
    : null;
  const status = isNew
    ? "Not saved yet. Create the position to start autosaving."
    : autosave.state !== "idle"
      ? "Saving…"
      : firstAutosaveError && failed && sameSnapshot(current, failed)
        ? `Couldn't save: ${firstAutosaveError}`
        : current.companyId === ""
          ? "Save to create the new company"
          : dirty
            ? "Unsaved changes"
            : savedAgo === null
              ? "All changes saved"
              : savedAgo < 1
                ? "Saved just now"
                : `Saved · ${savedAgo} min ago`;
  const statusTone = status.startsWith("Couldn't")
    ? "text-danger"
    : dirty
      ? "text-warn"
      : "text-ink-3";

  const describe = (name: string) =>
    errors[name] ? `${name}-error` : undefined;
  const fieldError = (name: string) =>
    errors[name] ? (
      <p
        id={`${name}-error`}
        className="mt-1 px-1.5 text-[0.8125rem] text-danger"
      >
        {errors[name]}
      </p>
    ) : null;

  return (
    <div className="space-y-4">
      <Form
        ref={formRef}
        method="post"
        onSubmit={() => {
          submittingRef.current = true;
        }}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: file drop is a pointer shortcut; the Import menu item is the keyboard path. */}
        <div
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }
            setDragging(false);
          }}
          onDrop={onDrop}
          className="writing-sheet relative rounded-sheet bg-sheet px-5 pt-6 shadow-sheet sm:pr-10 sm:pl-20"
        >
          <div
            aria-hidden="true"
            data-show={dragging || undefined}
            className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-sheet border-2 border-dashed border-exhibit bg-exhibit-tint/85 text-sm font-medium text-exhibit opacity-0 transition-opacity duration-150 data-show:opacity-100"
          >
            Drop .md files to import
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-3">
            {exhibit ? (
              <span className="rounded-stamp bg-manila-tint px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.06em] text-manila-ink uppercase">
                Ex. {exhibit}
              </span>
            ) : null}
            <span>
              {experience ? experience.company : "New contribution file"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {experience ? (
                <Popover
                  id="file-menu"
                  align="end"
                  triggerLabel="More actions for this position"
                  triggerClassName={buttonClass({
                    variant: "ghost",
                    size: "sm",
                  })}
                  trigger={
                    <MoreHorizontal aria-hidden="true" className="size-4" />
                  }
                >
                  <a
                    href={`/contributions/${experience.id}/download`}
                    download
                    className={popoverItemClass}
                  >
                    <Download
                      aria-hidden="true"
                      className="size-4 text-ink-3"
                    />
                    Export saved Markdown
                  </a>
                  <button
                    type="button"
                    className={popoverItemClass}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp aria-hidden="true" className="size-4 text-ink-3" />
                    Import .md files
                  </button>
                  <button
                    type="button"
                    className={`${popoverItemClass} text-danger`}
                    onClick={() => openDialog("delete-position")}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Delete position
                  </button>
                </Popover>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp aria-hidden="true" className="size-4" />
                  Import .md
                </Button>
              )}
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                tabIndex={-1}
                aria-label="Import Markdown files"
                multiple
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={onImport}
              />
            </div>
          </div>

          <label htmlFor="position" className="sr-only">
            Position
          </label>
          <textarea
            id="position"
            name="position"
            rows={1}
            value={current.position}
            onChange={(event) =>
              update("position", event.target.value.replace(/\n/g, " "))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            required
            maxLength={160}
            placeholder="Position title"
            aria-invalid={errors.position ? true : undefined}
            aria-describedby={describe("position")}
            className="-mx-1.5 mt-2 block w-[calc(100%+0.75rem)] resize-none overflow-hidden rounded-[4px] border border-transparent bg-transparent px-1.5 text-[1.75rem] font-bold leading-tight tracking-[-0.015em] text-ink [field-sizing:content] placeholder:text-ink-3/70 hover:border-rule focus:border-exhibit focus-visible:outline-none"
          />
          {fieldError("position")}

          <dl
            data-position-details
            className="mt-4 grid max-w-2xl grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1"
          >
            <dt className={propertyLabel}>
              <label htmlFor="companyId">Company</label>
            </dt>
            <dd>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="companyId"
                  name="companyId"
                  value={current.companyId}
                  onChange={(event) => update("companyId", event.target.value)}
                  aria-invalid={errors.companyId ? true : undefined}
                  aria-describedby={describe("companyId")}
                  className={`${propertyField} max-w-full`}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                  <option value="">New company…</option>
                </select>
                {current.companyId === "" || !hydrated ? (
                  <>
                    <label htmlFor="newCompanyName" className="sr-only">
                      New company name
                    </label>
                    <input
                      id="newCompanyName"
                      name="newCompanyName"
                      value={current.newCompanyName}
                      onChange={(event) =>
                        update("newCompanyName", event.target.value)
                      }
                      maxLength={160}
                      placeholder={
                        hydrated
                          ? "New company name"
                          : "New company name (if “New company…”)"
                      }
                      className={`${propertyField} border-rule bg-field`}
                    />
                  </>
                ) : null}
              </div>
              {fieldError("companyId")}
            </dd>

            <dt className={propertyLabel}>Dates</dt>
            <dd>
              <div className="flex flex-wrap items-center gap-1.5">
                <label htmlFor="startDate" className="sr-only">
                  Start date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={current.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                  required
                  aria-invalid={errors.startDate ? true : undefined}
                  aria-describedby={describe("startDate")}
                  className={`${propertyField} tabular`}
                />
                <span aria-hidden="true" className="text-ink-3">
                  –
                </span>
                {current.isCurrent && hydrated ? (
                  <span className="px-1.5 py-1 text-[0.9375rem] text-ink-2">
                    Present
                  </span>
                ) : (
                  <>
                    <label htmlFor="endDate" className="sr-only">
                      End date
                    </label>
                    <input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={current.endDate}
                      onChange={(event) =>
                        update("endDate", event.target.value)
                      }
                      aria-invalid={errors.endDate ? true : undefined}
                      aria-describedby={describe("endDate")}
                      className={`${propertyField} tabular`}
                    />
                  </>
                )}
                <label className="ml-2 inline-flex items-center gap-2 rounded-[4px] px-1.5 py-1 text-[0.875rem] text-ink-2 hover:bg-sheet-sunk">
                  <input
                    name="isCurrent"
                    type="checkbox"
                    checked={current.isCurrent}
                    onChange={(event) =>
                      update("isCurrent", event.target.checked)
                    }
                    className="size-4 accent-exhibit"
                  />
                  Current role
                </label>
              </div>
              {fieldError("startDate")}
              {fieldError("endDate")}
            </dd>
          </dl>

          <div className="mt-5 border-t border-rule pt-6">
            <MarkdownEditor
              id="markdown"
              name="markdown"
              label="Contribution evidence (Markdown)"
              value={current.markdown}
              onChange={(value) => update("markdown", value)}
              template={contributionTemplate()}
              describedBy={errors.markdown ? "markdown-error" : "markdown-hint"}
              invalid={Boolean(errors.markdown)}
              onSaveShortcut={() => saveNowRef.current()}
              status={<span className={statusTone}>{status}</span>}
              footerExtra={<EvidenceHints hints={hints} />}
            />
            {errors.markdown ? (
              <p
                id="markdown-error"
                className="pb-2 text-[0.8125rem] text-danger"
              >
                {errors.markdown}
              </p>
            ) : (
              <p id="markdown-hint" className="sr-only">
                {isNew
                  ? "Create the position once; after that, everything saves automatically."
                  : "Changes save automatically."}
              </p>
            )}
            {importError ? (
              <p role="alert" className="pb-3 text-[0.8125rem] text-danger">
                {importError}
              </p>
            ) : null}
          </div>
        </div>

        {isNew || !hydrated ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              name="intent"
              value="save"
              variant="primary"
              pending={isSaving}
            >
              {isNew ? "Create position" : "Save position"}
            </Button>
            <ButtonLink to="/contributions" variant="ghost">
              Cancel
            </ButtonLink>
            {errors.form ? (
              <p role="alert" className="text-sm text-danger">
                {errors.form}
              </p>
            ) : null}
          </div>
        ) : null}
      </Form>

      {experience ? (
        <div className={hydrated ? "" : "rounded-sheet bg-sheet p-5"}>
          <ConfirmDialog
            dialogId="delete-position"
            hideTrigger
            triggerLabel="Delete position"
            title={`Delete ${experience.position}?`}
            description="This permanently deletes the contribution file. Tailored documents that cited it keep their text."
            confirmLabel="Delete position"
            fields={{ intent: "delete" }}
            error={errors.delete}
          />
        </div>
      ) : null}

      <dialog
        ref={importDialogRef}
        aria-labelledby="import-title"
        onCancel={(event) => {
          event.preventDefault();
          setPendingImport(null);
        }}
        className="dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sheet bg-sheet p-6 text-ink shadow-lifted"
      >
        <h2 id="import-title" className="text-lg font-semibold">
          Import {pendingImport?.names.join(", ")}?
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Append adds the files after your current text. Replace discards the
          current text in the editor.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => confirmImport("replace")}>
            Replace
          </Button>
          <Button
            variant="primary"
            autoFocus
            onClick={() => confirmImport("append")}
          >
            Append
          </Button>
        </div>
      </dialog>

      <dialog
        ref={leaveDialogRef}
        aria-labelledby="leave-title"
        onCancel={(event) => {
          event.preventDefault();
          blocker.reset?.();
        }}
        className="dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sheet bg-sheet p-6 text-ink shadow-lifted"
      >
        <h2 id="leave-title" className="text-lg font-semibold">
          Leave with unsaved changes?
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Changes that have not been saved will be lost.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            Leave
          </Button>
          <Button variant="primary" autoFocus onClick={() => blocker.reset?.()}>
            Stay
          </Button>
        </div>
      </dialog>
    </div>
  );
}

function EvidenceHints({ hints }: { hints: ReturnType<typeof lintEvidence> }) {
  if (!hints.length) {
    return (
      <span className="flex items-center gap-1.5 px-1.5 text-ok">
        <CircleCheck aria-hidden="true" className="size-4" />
        Evidence looks complete
      </span>
    );
  }
  return (
    <Popover
      id="evidence-hints"
      align="end"
      triggerLabel={`${hints.length} evidence suggestions`}
      triggerClassName="pressable flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-manila-ink hover:bg-manila-tint"
      trigger={
        <>
          <Lightbulb aria-hidden="true" className="size-4" />
          {hints.length} {hints.length === 1 ? "suggestion" : "suggestions"}
        </>
      }
      className="w-80"
    >
      <ul className="space-y-2 p-2 text-[0.8125rem] leading-snug text-ink-2">
        {hints.map((hint) => (
          <li key={hint.id} className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-manila"
            />
            {hint.message}
          </li>
        ))}
      </ul>
      <p className="border-t border-rule px-2 pt-2 pb-1 text-[0.75rem] text-ink-3">
        Suggestions never block saving.
      </p>
    </Popover>
  );
}
