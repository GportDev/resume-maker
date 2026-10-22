import { syntaxTree } from "@codemirror/language";
import { type Range, RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import {
  activeLinesFor,
  livePreviewDecorations,
  type PreviewDecoration,
} from "../../lib/live-preview-ranges";

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-bullet";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-rule";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly toggleAt: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.toggleAt === this.toggleAt;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task-box";
    box.checked = this.checked;
    box.setAttribute("aria-label", this.checked ? "Done" : "To do");
    box.addEventListener("mousedown", (event) => event.preventDefault());
    box.addEventListener("click", (event) => {
      event.preventDefault();
      view.dispatch({
        changes: {
          from: this.toggleAt,
          to: this.toggleAt + 1,
          insert: this.checked ? " " : "x",
        },
        userEvent: "input.toggle-task",
      });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const hide = Decoration.replace({});

function toRange(item: PreviewDecoration): Range<Decoration> | null {
  switch (item.type) {
    case "hide":
      return item.from < item.to ? hide.range(item.from, item.to) : null;
    case "bullet":
      return bullet.range(item.from, item.to);
    case "rule":
      return rule.range(item.from, item.to);
    case "checkbox":
      return Decoration.replace({
        widget: new CheckboxWidget(item.checked, item.toggleAt),
      }).range(item.from, item.to);
    case "line":
      return Decoration.line({ class: item.className }).range(item.from);
    case "mark":
      if (item.from >= item.to) return null;
      return Decoration.mark({
        class: item.className,
        attributes: item.href ? { "data-href": item.href } : undefined,
      }).range(item.from, item.to);
  }
}

function build(view: EditorView): {
  decorations: DecorationSet;
  atomic: DecorationSet;
} {
  const { state } = view;
  const active = view.hasFocus
    ? activeLinesFor(state.doc, state.selection.ranges)
    : new Set<number>();
  const items = livePreviewDecorations(
    syntaxTree(state),
    state.doc,
    active,
    view.visibleRanges,
  );
  const ranges: Range<Decoration>[] = [];
  const replaced: Range<Decoration>[] = [];
  for (const item of items) {
    const range = toRange(item);
    if (!range) continue;
    ranges.push(range);
    if (item.type !== "line" && item.type !== "mark") replaced.push(range);
  }
  return {
    decorations: RangeSet.of(ranges, true),
    atomic: RangeSet.of(replaced, true),
  };
}

/** Renders Markdown in place; markers reappear on lines being edited. */
export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomic: DecorationSet;
    constructor(view: EditorView) {
      ({ decorations: this.decorations, atomic: this.atomic } = build(view));
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.focusChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        ({ decorations: this.decorations, atomic: this.atomic } = build(
          update.view,
        ));
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    // Hidden markers behave as atoms so arrow keys step over them.
    provide: (plugin) =>
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.atomic ?? Decoration.none,
      ),
  },
);
