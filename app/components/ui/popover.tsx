import { type ReactNode, type ToggleEvent, useCallback, useRef } from "react";

/**
 * Native popover (light dismiss, Escape, top layer) anchored under its
 * trigger. Scales in from the trigger's edge; works without JavaScript too,
 * only unpositioned.
 */
export function Popover({
  id,
  trigger,
  triggerLabel,
  triggerClassName = "",
  align = "end",
  className = "",
  children,
}: {
  id: string;
  trigger: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const position = useCallback(
    (event: ToggleEvent<HTMLDivElement>) => {
      if (event.newState !== "open") return;
      const button = triggerRef.current;
      const panel = event.currentTarget;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      panel.style.top = `${rect.bottom + 6}px`;
      if (align === "end") {
        panel.style.left = "auto";
        panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
        panel.style.setProperty("--pop-origin", "top right");
      } else {
        panel.style.right = "auto";
        panel.style.left = `${Math.max(8, rect.left)}px`;
        panel.style.setProperty("--pop-origin", "top left");
      }
    },
    [align],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        id={id}
        popover="auto"
        onBeforeToggle={position}
        className={`pop fixed m-0 min-w-56 rounded-control border border-rule bg-sheet p-1.5 text-ink shadow-lifted ${className}`}
      >
        {children}
      </div>
    </>
  );
}

export const popoverItemClass =
  "flex w-full items-center gap-2 rounded-[4px] px-2.5 py-2 text-left text-sm text-ink hover:bg-sheet-sunk";
