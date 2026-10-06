import type { EditorView } from "@uiw/react-codemirror";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  applyTextChange,
  type FormatAction,
  formatMarkdown,
  type TextChange,
} from "../lib/markdown-format";

const CodeMirrorMarkdown = lazy(() => import("./codemirror-markdown"));

type ViewMode = "write" | "split" | "preview";

const toolbarActions: { action: FormatAction; label: string; text: string }[] =
  [
    { action: "heading", label: "Toggle heading", text: "H2" },
    { action: "bullet", label: "Toggle bullet list", text: "• List" },
    { action: "bold", label: "Bold", text: "B" },
    {
      action: "template",
      label: "Insert contribution template",
      text: "Template",
    },
  ];

const viewModes: { mode: ViewMode; label: string }[] = [
  { mode: "write", label: "Write" },
  { mode: "split", label: "Split" },
  { mode: "preview", label: "Preview" },
];

export function MarkdownEditor({
  id,
  name,
  label,
  value,
  onChange,
  template,
  describedBy,
  invalid,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  template: string;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ViewMode>("split");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const labelId = `${id}-label`;

  useEffect(() => setHydrated(true), []);

  function applyToTextarea(textarea: HTMLTextAreaElement, change: TextChange) {
    onChange(applyTextChange(textarea.value, change));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(change.selection.start, change.selection.end);
    });
  }

  function runAction(action: FormatAction) {
    if (mode === "preview") setMode("split");
    const view = viewRef.current;
    if (view?.dom.isConnected) {
      const main = view.state.selection.main;
      const change = formatMarkdown(
        view.state.doc.toString(),
        { start: main.from, end: main.to },
        action,
        template,
      );
      view.dispatch({
        changes: { from: change.from, to: change.to, insert: change.insert },
        selection: {
          anchor: change.selection.start,
          head: change.selection.end,
        },
        scrollIntoView: true,
      });
      view.focus();
      return;
    }
    const textarea = textareaRef.current;
    if (!textarea) return;
    applyToTextarea(
      textarea,
      formatMarkdown(
        textarea.value,
        { start: textarea.selectionStart, end: textarea.selectionEnd },
        action,
        template,
      ),
    );
  }

  const textarea = (
    <textarea
      ref={textareaRef}
      id={id}
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      className="min-h-96 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm leading-6 outline-none focus:border-cyan-400"
    />
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label id={labelId} htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <fieldset className="flex rounded-lg border border-slate-700 p-0.5">
          <legend className="sr-only">Editor layout</legend>
          {viewModes.map((item) => (
            <button
              key={item.mode}
              type="button"
              aria-pressed={mode === item.mode}
              onClick={() => setMode(item.mode)}
              className={`rounded-md px-3 py-1 text-xs ${
                mode === item.mode
                  ? "bg-slate-800 text-cyan-300"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
      </div>

      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="mt-3 flex flex-wrap gap-2"
      >
        {toolbarActions.map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            disabled={!hydrated}
            onClick={() => runAction(item.action)}
            className={`rounded-lg border border-slate-700 px-3 py-1.5 text-xs hover:border-cyan-400 ${
              item.action === "bold" ? "font-bold" : ""
            }`}
          >
            {item.text}
          </button>
        ))}
      </div>

      <div
        className={`mt-3 grid gap-4 ${mode === "split" ? "xl:grid-cols-2" : ""}`}
      >
        <div className={mode === "preview" ? "hidden" : undefined}>
          {hydrated ? (
            <Suspense fallback={textarea}>
              <CodeMirrorMarkdown
                name={name}
                value={value}
                labelId={labelId}
                describedBy={describedBy}
                invalid={invalid}
                onChange={onChange}
                onReady={(view) => {
                  viewRef.current = view;
                }}
              />
            </Suspense>
          ) : (
            textarea
          )}
        </div>
        <section
          aria-label="Markdown preview"
          className={`min-h-96 rounded-xl border border-slate-800 bg-slate-950/60 p-4 ${
            mode === "write" ? "hidden" : ""
          }`}
        >
          {value.trim() ? (
            <div className="markdown-preview">
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Preview appears here. Include outcomes, metrics, tools, ownership,
              and project scope.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
