import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  data,
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useBeforeUnload,
  useBlocker,
  useFetcher,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { MarkdownEditor } from "../components/markdown-editor";
import { requireUser } from "../lib/auth.server";
import {
  contributionTemplate,
  type ImportMode,
  markdownFileName,
  mergeImportedMarkdown,
} from "../lib/contributions";
import {
  createExperience,
  deleteExperience,
  getExperience,
  listCompanies,
  resolveExperienceCompany,
  updateExperience,
  updateExperienceMarkdown,
} from "../lib/repositories.server";
import {
  experienceInputSchema,
  experienceMarkdownSchema,
  firstFormError,
} from "../lib/validation";
import type { Route } from "./+types/contribution-file";

const autosaveDelayMs = 1500;
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
  const companyList = await listCompanies(user.id);
  const companyOptions = companyList.map(({ id, name }) => ({ id, name }));

  if (params.experienceId === "new") {
    const requested = new URL(request.url).searchParams.get("companyId") ?? "";
    const preselected = companyOptions.some((item) => item.id === requested)
      ? requested
      : (companyOptions[0]?.id ?? "");
    return {
      experience: null,
      companies: companyOptions,
      initialCompanyId: preselected,
      initialMarkdown: contributionTemplate(),
    };
  }

  const experience = await getExperience(
    user.id,
    requireExperienceId(params.experienceId),
  );
  if (!experience) throw notFound();

  if (new URL(request.url).searchParams.get("download") === "1") {
    return new Response(experience.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${markdownFileName(experience.company, experience.position)}"`,
      },
    });
  }

  return {
    experience,
    companies: companyOptions,
    initialCompanyId: experience.companyId,
    initialMarkdown: experience.markdown,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUser(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");
  const isNew = params.experienceId === "new";

  if (intent === "autosave") {
    if (isNew) throw notFound();
    const parsed = experienceMarkdownSchema.safeParse(formData.get("markdown"));
    if (!parsed.success) {
      return data(
        {
          autosaveError: parsed.error.issues[0]?.message ?? "Invalid Markdown.",
        },
        { status: 400 },
      );
    }
    const updated = await updateExperienceMarkdown(
      user.id,
      requireExperienceId(params.experienceId),
      parsed.data,
    );
    if (!updated) throw notFound();
    return data({ autosaved: true as const });
  }

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

  const parsed = experienceInputSchema.safeParse({
    companyId: formData.get("companyId") ?? "",
    newCompanyName: formData.get("newCompanyName") ?? "",
    position: formData.get("position"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    markdown: formData.get("markdown"),
  });
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

type AutosaveResult = { autosaved: true } | { autosaveError: string };
type PendingImport = { texts: string[]; names: string[] };

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

function fieldError(errors: Record<string, string>, name: string) {
  return errors[name] ? (
    <p id={`${name}-error`} className="mt-1 text-xs text-red-300">
      {errors[name]}
    </p>
  ) : null;
}

function ContributionEditor({
  loaderData,
  actionData,
}: Pick<Route.ComponentProps, "loaderData" | "actionData">) {
  const { experience, companies, initialCompanyId, initialMarkdown } =
    loaderData;
  const isNew = !experience;
  const errors: Record<string, string> =
    actionData && "errors" in actionData ? actionData.errors : {};

  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [savedMarkdown, setSavedMarkdown] = useState(initialMarkdown);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [isCurrent, setIsCurrent] = useState(experience?.isCurrent ?? false);
  const [hydrated, setHydrated] = useState(false);
  const [failedMarkdown, setFailedMarkdown] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null,
  );
  const [importError, setImportError] = useState("");

  const autosave = useFetcher<AutosaveResult>();
  const autosavedMarkdownRef = useRef("");
  const submittedMarkdownRef = useRef("");
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigation = useNavigation();

  const markdownDirty = markdown !== savedMarkdown;
  const dirty = markdownDirty || detailsDirty;
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (navigation.state === "idle") submittingRef.current = false;
  }, [navigation.state]);

  useEffect(() => {
    if (actionData && "saved" in actionData) {
      setSavedMarkdown(submittedMarkdownRef.current);
      setDetailsDirty(false);
      setFailedMarkdown(null);
    }
  }, [actionData]);

  useEffect(() => {
    if (!autosave.data) return;
    if ("autosaved" in autosave.data) {
      setSavedMarkdown(autosavedMarkdownRef.current);
      setFailedMarkdown(null);
    } else {
      setFailedMarkdown(autosavedMarkdownRef.current);
    }
  }, [autosave.data]);

  const submitAutosave = autosave.submit;
  useEffect(() => {
    if (isNew || !markdownDirty || autosave.state !== "idle") return;
    if (markdown === failedMarkdown) return;
    const timer = window.setTimeout(() => {
      autosavedMarkdownRef.current = markdown;
      submitAutosave({ intent: "autosave", markdown }, { method: "post" });
    }, autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    isNew,
    markdown,
    markdownDirty,
    failedMarkdown,
    autosave.state,
    submitAutosave,
  ]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !submittingRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (blocker.state === "blocked" && !dialog.open) dialog.showModal();
    if (blocker.state !== "blocked" && dialog.open) dialog.close();
  }, [blocker.state]);

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

  function markSubmitting() {
    submittingRef.current = true;
  }

  function onSave() {
    submittedMarkdownRef.current = markdown;
    markSubmitting();
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    setImportError("");
    if (!files.length) return;
    const tooLarge = files.find((file) => file.size > maxImportBytes);
    if (tooLarge) {
      setImportError(`${tooLarge.name} is larger than 200 KB.`);
      return;
    }
    try {
      const texts = await Promise.all(files.map((file) => file.text()));
      const untouchedTemplate = isNew && markdown === initialMarkdown;
      if (markdown.trim() && !untouchedTemplate) {
        setPendingImport({ texts, names: files.map((file) => file.name) });
      } else {
        setMarkdown(mergeImportedMarkdown("", texts, "replace"));
      }
    } catch (error) {
      console.warn("Markdown import failed", error);
      setImportError("Files could not be read. Try plain .md or .txt files.");
    }
  }

  function confirmImport(mode: ImportMode) {
    if (!pendingImport) return;
    setMarkdown(mergeImportedMarkdown(markdown, pendingImport.texts, mode));
    setPendingImport(null);
  }

  const autosaveError =
    autosave.data && "autosaveError" in autosave.data
      ? autosave.data.autosaveError
      : "";
  const status = isNew
    ? dirty
      ? "Not saved yet"
      : "New position"
    : autosave.state !== "idle"
      ? "Saving…"
      : autosaveError && markdown === failedMarkdown
        ? `Autosave failed: ${autosaveError}`
        : dirty
          ? markdownDirty
            ? "Unsaved changes"
            : "Unsaved position details"
          : "All changes saved";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            {experience ? experience.company : "New contribution file"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            {experience ? experience.position : "New position"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p
            role="status"
            className={`text-sm ${
              status.startsWith("Autosave failed")
                ? "text-red-300"
                : dirty
                  ? "text-amber-300"
                  : "text-slate-400"
            }`}
          >
            {status}
          </p>
          {experience ? (
            <a
              href="?download=1"
              download
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400"
            >
              Export saved Markdown
            </a>
          ) : null}
        </div>
      </div>

      <Form
        method="post"
        onSubmit={onSave}
        onChange={(event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.closest("[data-position-details]")
          ) {
            setDetailsDirty(true);
          }
        }}
        className="space-y-6"
      >
        <section
          data-position-details
          aria-label="Position details"
          className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="companyId" className="block text-sm font-medium">
              Company
            </label>
            <select
              id="companyId"
              name="companyId"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              aria-invalid={errors.companyId ? true : undefined}
              aria-describedby={
                errors.companyId ? "companyId-error" : undefined
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
              <option value="">New company…</option>
            </select>
            {fieldError(errors, "companyId")}
          </div>
          {companyId === "" || !hydrated ? (
            <div>
              <label
                htmlFor="newCompanyName"
                className="block text-sm font-medium"
              >
                New company name
              </label>
              <input
                id="newCompanyName"
                name="newCompanyName"
                maxLength={160}
                aria-describedby="newCompanyName-hint"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />
              <p
                id="newCompanyName-hint"
                className="mt-1 text-xs text-slate-500"
              >
                Used when “New company…” is selected.
              </p>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label htmlFor="position" className="block text-sm font-medium">
              Position
            </label>
            <input
              id="position"
              name="position"
              defaultValue={experience?.position ?? ""}
              required
              maxLength={160}
              aria-invalid={errors.position ? true : undefined}
              aria-describedby={errors.position ? "position-error" : undefined}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
            />
            {fieldError(errors, "position")}
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium">
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={experience?.startDate ?? ""}
              required
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={
                errors.startDate ? "startDate-error" : undefined
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            />
            {fieldError(errors, "startDate")}
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium">
              End date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={experience?.endDate ?? ""}
              disabled={hydrated && isCurrent}
              aria-invalid={errors.endDate ? true : undefined}
              aria-describedby={errors.endDate ? "endDate-error" : undefined}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 disabled:opacity-40"
            />
            {fieldError(errors, "endDate")}
          </div>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input
              name="isCurrent"
              type="checkbox"
              checked={isCurrent}
              onChange={(event) => setIsCurrent(event.target.checked)}
              className="size-4 accent-cyan-400"
            />
            I currently work here
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <MarkdownEditor
            id="markdown"
            name="markdown"
            label="Contribution evidence (Markdown)"
            value={markdown}
            onChange={setMarkdown}
            template={contributionTemplate()}
            describedBy={errors.markdown ? "markdown-error" : "markdown-hint"}
            invalid={Boolean(errors.markdown)}
          />
          {errors.markdown ? (
            fieldError(errors, "markdown")
          ) : (
            <p id="markdown-hint" className="text-xs text-slate-500">
              {isNew
                ? "Save the position once; after that, Markdown changes autosave."
                : "Markdown changes autosave. Save position to update details."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-xs hover:border-cyan-400 focus-within:outline-2 focus-within:outline-cyan-400">
              Import .md files
              <input
                className="sr-only"
                type="file"
                multiple
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={onImport}
              />
            </label>
            {importError ? (
              <p role="alert" className="text-xs text-red-300">
                {importError}
              </p>
            ) : null}
          </div>

          {pendingImport ? (
            <fieldset className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
              <legend className="px-1 text-sm font-medium">
                Import {pendingImport.names.join(", ")}?
              </legend>
              <p className="mt-1 text-xs text-slate-400">
                Append adds the files after your current text. Replace discards
                the current text in the editor.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => confirmImport("append")}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white"
                >
                  Append
                </button>
                <button
                  type="button"
                  onClick={() => confirmImport("replace")}
                  className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:border-slate-500"
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={isSaving}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : isNew ? "Create position" : "Save position"}
          </button>
          <Link
            to="/contributions"
            className="text-sm text-slate-400 hover:text-slate-100"
          >
            Back to contributions
          </Link>
          {errors.form ? (
            <p role="alert" className="text-sm text-red-300">
              {errors.form}
            </p>
          ) : null}
        </div>
      </Form>

      {experience ? (
        <details className="rounded-2xl border border-red-950 bg-slate-900 p-6">
          <summary className="cursor-pointer text-sm font-semibold text-red-300">
            Delete position
          </summary>
          <Form
            method="post"
            onSubmit={markSubmitting}
            className="mt-4 space-y-3"
          >
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="confirm"
                value="yes"
                required
                className="size-4 accent-red-400"
              />
              I understand this permanently deletes this contribution file.
            </label>
            <button
              type="submit"
              name="intent"
              value="delete"
              className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:border-red-600"
            >
              Delete position
            </button>
            {errors.delete ? (
              <p role="alert" className="text-sm text-red-300">
                {errors.delete}
              </p>
            ) : null}
          </Form>
        </details>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="leave-title"
        onCancel={(event) => {
          event.preventDefault();
          blocker.reset?.();
        }}
        className="m-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 backdrop:bg-slate-950/70"
      >
        <h2 id="leave-title" className="text-lg font-semibold">
          Leave with unsaved changes?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Changes that have not been saved will be lost.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => blocker.reset?.()}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={() => blocker.proceed?.()}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:border-red-600"
          >
            Leave
          </button>
        </div>
      </dialog>
    </div>
  );
}
