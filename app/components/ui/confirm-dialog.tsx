import { type ReactNode, useEffect, useRef, useState } from "react";
import { Form, useFetcher } from "react-router";
import { Button, type ButtonVariant } from "./button";

type ConfirmDialogProps = {
  /** Text on the button that opens the dialog. */
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Hidden fields posted with the confirmation; `confirm=yes` is added. */
  fields: Record<string, string>;
  /** Submit through a keyed fetcher instead of a navigation. */
  fetcherKey?: string;
  action?: string;
  error?: string;
};

/**
 * Destructive confirmation on a native <dialog>. Before hydration (or without
 * JavaScript) it renders the checkbox form, so intent stays explicit either way.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? (
    <HydratedConfirm {...props} />
  ) : (
    <FallbackConfirm {...props} />
  );
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function FallbackConfirm({
  triggerLabel,
  title,
  description,
  confirmLabel,
  fields,
  action,
  error,
}: ConfirmDialogProps) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-danger">{triggerLabel}</summary>
      <Form method="post" action={action} className="mt-3 space-y-3">
        <HiddenFields fields={fields} />
        <p className="font-medium">{title}</p>
        <div className="text-ink-2">{description}</div>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="confirm"
            value="yes"
            required
            className="mt-0.5 size-4 accent-danger"
          />
          I understand this cannot be undone.
        </label>
        <Button type="submit" variant="danger" size="sm">
          {confirmLabel}
        </Button>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
      </Form>
    </details>
  );
}

function HydratedConfirm({
  triggerLabel,
  triggerVariant = "danger",
  triggerClassName,
  title,
  description,
  confirmLabel,
  fields,
  fetcherKey,
  action,
  error,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fetcher = useFetcher<{ error?: string }>({ key: fetcherKey });
  const titleId = `confirm-${Object.values(fields).join("-")}-title`;
  const fetcherError = fetcherKey ? fetcher.data?.error : undefined;
  const pending = fetcherKey ? fetcher.state !== "idle" : false;

  useEffect(() => {
    if (fetcherKey && fetcher.state === "idle" && fetcher.data) {
      if (!fetcher.data.error) dialogRef.current?.close();
    }
  }, [fetcherKey, fetcher.state, fetcher.data]);

  const body = (
    <>
      <HiddenFields fields={{ ...fields, confirm: "yes" }} />
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 text-sm text-ink-2">{description}</div>
      {fetcherError || error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {fetcherError ?? error}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          Cancel
        </Button>
        <Button type="submit" variant="destructive" pending={pending}>
          {confirmLabel}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Button
        ref={triggerRef}
        variant={triggerVariant}
        size="sm"
        className={triggerClassName}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        className="dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sheet bg-sheet p-6 text-ink shadow-lifted"
      >
        {fetcherKey ? (
          <fetcher.Form method="post" action={action}>
            {body}
          </fetcher.Form>
        ) : (
          <Form method="post" action={action}>
            {body}
          </Form>
        )}
      </dialog>
    </>
  );
}
