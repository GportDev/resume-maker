import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  drawSelection,
  dropCursor,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo, useRef } from "react";
import { formattingKeymap, slashCompletions } from "./editor/commands";
import { writingHighlight, writingTheme } from "./editor/editor-theme";
import { livePreview } from "./editor/live-preview";

export type SelectionAnchor = {
  top: number;
  bottom: number;
  left: number;
} | null;

export type CodeMirrorMarkdownProps = {
  name: string;
  value: string;
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
  placeholderText: string;
  onChange: (value: string) => void;
  onReady: (view: EditorView) => void;
  onSave: () => void;
  onSelectionAnchor: (anchor: SelectionAnchor) => void;
};

function selectionAnchor(view: EditorView): SelectionAnchor {
  const { main } = view.state.selection;
  if (main.empty) return null;
  const start = view.coordsAtPos(main.from);
  const end = view.coordsAtPos(main.to);
  if (!start || !end) return null;
  return {
    top: Math.min(start.top, end.top),
    bottom: Math.max(start.bottom, end.bottom),
    left: start.top === end.top ? (start.left + end.right) / 2 : start.left,
  };
}

export default function CodeMirrorMarkdown({
  name,
  value,
  labelId,
  describedBy,
  invalid,
  placeholderText,
  onChange,
  onReady,
  onSave,
  onSelectionAnchor,
}: CodeMirrorMarkdownProps) {
  // Latest callbacks without rebuilding the extension list on every render.
  const callbacks = useRef({ onSave, onSelectionAnchor });
  callbacks.current = { onSave, onSelectionAnchor };

  const extensions = useMemo(
    () => [
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, addKeymap: true }),
      keymap.of([
        ...formattingKeymap(() => callbacks.current.onSave()),
        ...completionKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      autocompletion({
        override: [slashCompletions],
        icons: false,
        closeOnBlur: true,
      }),
      placeholder(placeholderText),
      livePreview,
      writingTheme,
      writingHighlight,
      EditorView.contentAttributes.of({
        "aria-labelledby": labelId,
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      }),
      EditorView.domEventHandlers({
        mousedown(event) {
          if (!(event.metaKey || event.ctrlKey)) return false;
          const target = event.target as HTMLElement | null;
          const href =
            target?.closest<HTMLElement>("[data-href]")?.dataset.href;
          if (!href) return false;
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        },
        mouseup(_event, view) {
          requestAnimationFrame(() =>
            callbacks.current.onSelectionAnchor(selectionAnchor(view)),
          );
          return false;
        },
      }),
      EditorView.updateListener.of((update) => {
        const byPointer = update.transactions.some((tr) =>
          tr.isUserEvent("select.pointer"),
        );
        if (
          update.docChanged ||
          (update.selectionSet && !byPointer) ||
          (update.focusChanged && !update.view.hasFocus)
        ) {
          callbacks.current.onSelectionAnchor(null);
        }
      }),
    ],
    [labelId, describedBy, invalid, placeholderText],
  );

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <CodeMirror
        value={value}
        onChange={onChange}
        onCreateEditor={(view) => onReady(view)}
        extensions={extensions}
        theme="none"
        basicSetup={false}
        className="writing-surface"
      />
    </>
  );
}
