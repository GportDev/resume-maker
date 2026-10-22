import type { EditorView } from "@uiw/react-codemirror";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Keyboard,
  Link2,
  type LucideIcon,
} from "lucide-react";
import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { countWords, type FormatAction } from "../lib/markdown-format";
import type { SelectionAnchor } from "./codemirror-markdown";
import { runFormat, shortcutHelp } from "./editor/commands";
import { Popover } from "./ui/popover";

const CodeMirrorMarkdown = lazy(() => import("./codemirror-markdown"));

const selectionActions: {
  action: FormatAction;
  label: string;
  Icon: LucideIcon;
}[] = [
  { action: "bold", label: "Bold", Icon: Bold },
  { action: "italic", label: "Italic", Icon: Italic },
  { action: "code", label: "Inline code", Icon: Code },
  { action: "link", label: "Link", Icon: Link2 },
  { action: "heading", label: "Heading", Icon: Heading2 },
];

const placeholderText = "Type / for sections, or start writing…";

/**
 * Notion-style Markdown writing surface: Markdown renders in place, raw
 * markers show only on the line being edited. Before hydration it is a plain
 * textarea that submits the same field.
 */
export function MarkdownEditor({
  id,
  name,
  label,
  value,
  onChange,
  template,
  describedBy,
  invalid,
  status,
  onSaveShortcut,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  template: string;
  describedBy?: string;
  invalid?: boolean;
  status?: ReactNode;
  onSaveShortcut?: () => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [anchor, setAnchor] = useState<SelectionAnchor>(null);
  const viewRef = useRef<EditorView | null>(null);
  const labelId = `${id}-label`;
  const words = countWords(value);

  useEffect(() => setHydrated(true), []);

  // The toolbar is fixed to the viewport; scrolling moves the text under it.
  useEffect(() => {
    if (!anchor) return;
    const hide = () => setAnchor(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [anchor]);

  const toolbarAbove = anchor ? anchor.top - 44 >= 8 : true;

  function format(action: FormatAction, text = "") {
    const view = viewRef.current;
    if (view?.dom.isConnected) runFormat(view, action, text);
  }

  const textarea = (
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      placeholder={placeholderText}
      className="block min-h-[60vh] w-full max-w-[68ch] resize-y bg-transparent font-serif text-[1.0625rem] leading-[1.7] text-ink outline-none placeholder:text-ink-3 placeholder:italic"
    />
  );

  return (
    <div className="relative">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {hydrated ? (
        <Suspense fallback={textarea}>
          <CodeMirrorMarkdown
            name={name}
            value={value}
            labelId={labelId}
            describedBy={describedBy}
            invalid={invalid}
            placeholderText={placeholderText}
            onChange={onChange}
            onReady={(view) => {
              viewRef.current = view;
            }}
            onSave={() => onSaveShortcut?.()}
            onSelectionAnchor={setAnchor}
          />
        </Suspense>
      ) : (
        <label htmlFor={id} className="block">
          <span className="sr-only">{label}</span>
          {textarea}
        </label>
      )}

      {anchor ? (
        <div
          role="toolbar"
          aria-label="Format selection"
          style={{
            top: toolbarAbove ? anchor.top - 44 : anchor.bottom + 8,
            left: anchor.left,
          }}
          className={`pop fixed z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-control bg-ink p-1 text-sheet shadow-lifted ${
            toolbarAbove
              ? "[--pop-origin:bottom_center]"
              : "[--pop-origin:top_center]"
          }`}
        >
          {selectionActions.map(({ action, label: actionLabel, Icon }) => (
            <button
              key={action}
              type="button"
              aria-label={actionLabel}
              title={actionLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                format(action);
                setAnchor(null);
              }}
              className="pressable grid size-8 place-items-center rounded-[4px] hover:bg-sheet/15"
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule bg-sheet/95 py-2.5 text-[0.8125rem] text-ink-3 backdrop-blur-[2px]">
        <div className="min-w-0" role="status">
          {status}
        </div>
        <span className="tabular" aria-live="off">
          {words} {words === 1 ? "word" : "words"}
        </span>
        {hydrated && !value.trim() ? (
          <button
            type="button"
            onClick={() => format("template", template)}
            className="font-medium text-exhibit hover:text-exhibit-deep"
          >
            Insert starter template
          </button>
        ) : null}
        <div className="ml-auto">
          <Popover
            id={`${id}-shortcuts`}
            align="end"
            triggerLabel="Keyboard shortcuts"
            triggerClassName="pressable flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 hover:bg-sheet-sunk hover:text-ink"
            trigger={
              <>
                <Keyboard aria-hidden="true" className="size-4" />
                Shortcuts
              </>
            }
            className="w-72"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 p-2 text-[0.8125rem]">
              {shortcutHelp.map((item) => (
                <div key={item.label} className="contents">
                  <dt className="font-mono text-[0.75rem] whitespace-nowrap text-ink-2">
                    {item.keys}
                  </dt>
                  <dd className="text-ink">{item.label}</dd>
                </div>
              ))}
            </dl>
          </Popover>
        </div>
      </div>
    </div>
  );
}
