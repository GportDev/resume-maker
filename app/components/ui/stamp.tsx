import type { ReactNode } from "react";

export type StampTone =
  | "manila"
  | "exhibit"
  | "violet"
  | "ok"
  | "danger"
  | "warn"
  | "neutral";

const tones: Record<StampTone, string> = {
  manila: "border-manila-ink/60 bg-manila-tint text-manila-ink",
  exhibit: "border-exhibit/60 bg-exhibit-tint text-exhibit",
  violet: "border-violet/60 bg-violet-tint text-violet",
  ok: "border-ok/60 bg-ok-tint text-ok",
  danger: "border-danger/60 bg-danger-tint text-danger",
  warn: "border-warn/60 bg-warn-tint text-warn",
  neutral: "border-ink-3/50 bg-sheet-sunk text-ink-3",
};

/** Rubber-stamp mark: uppercase ink in a thin frame. */
export function Stamp({
  tone,
  children,
  className = "",
}: {
  tone: StampTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-stamp border-[1.5px] px-1.5 py-[3px] text-[0.6875rem] font-bold uppercase leading-none tracking-[0.06em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
