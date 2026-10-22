import type { ReactNode } from "react";

export const fieldClass =
  "block w-full rounded-control border border-rule-strong bg-field px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-3 outline-none transition-[border-color] duration-150 focus:border-exhibit focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-exhibit aria-invalid:border-danger disabled:bg-sheet-sunk disabled:opacity-60";

export function describedBy(
  id: string,
  error?: string,
  hint?: boolean,
): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
