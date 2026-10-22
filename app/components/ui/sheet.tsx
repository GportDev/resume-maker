import type { ReactNode } from "react";

/** The one working surface of a page (DESIGN.md: The One Sheet Rule). */
export function Sheet({
  children,
  className = "",
  as: Tag = "div",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  labelledBy?: string;
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={`rounded-sheet bg-sheet p-5 shadow-sheet sm:p-8 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  meta,
  actions,
  back,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule pb-5">
      <div className="min-w-0">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-[-0.015em]">
          {title}
        </h1>
        {meta ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** A section inside a sheet, separated by a hairline rather than a panel. */
export function SheetSection({
  title,
  description,
  actions,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={`border-t border-rule pt-6 first:border-t-0 first:pt-0 ${className}`}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 id={id} className="text-lg font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-ink-3">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
