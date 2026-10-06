import { markdown } from "@codemirror/lang-markdown";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useMemo } from "react";

export type CodeMirrorMarkdownProps = {
  name: string;
  value: string;
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  onReady: (view: EditorView) => void;
};

export default function CodeMirrorMarkdown({
  name,
  value,
  labelId,
  describedBy,
  invalid,
  onChange,
  onReady,
}: CodeMirrorMarkdownProps) {
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        "aria-labelledby": labelId,
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      }),
    ],
    [labelId, describedBy, invalid],
  );

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <CodeMirror
        value={value}
        onChange={onChange}
        onCreateEditor={(view) => onReady(view)}
        extensions={extensions}
        theme="dark"
        minHeight="24rem"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        className="overflow-hidden rounded-xl border border-slate-700 text-sm"
      />
    </>
  );
}
