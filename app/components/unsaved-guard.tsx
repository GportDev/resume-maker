import { type RefObject, useCallback, useEffect, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { Button } from "./ui/button";

/**
 * Asks before leaving with unsaved edits, in-app (dialog) and on tab close.
 * Set `submittingRef.current = true` while a save is in flight so its own
 * redirect is not blocked.
 */
export function UnsavedChangesGuard({
  dirty,
  submittingRef,
}: {
  dirty: boolean;
  submittingRef: RefObject<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !submittingRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (blocker.state === "blocked" && !dialog.open) dialog.showModal();
    if (blocker.state !== "blocked" && dialog.open) dialog.close();
  }, [blocker.state]);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [dirty],
    ),
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="unsaved-title"
      onCancel={(event) => {
        event.preventDefault();
        blocker.reset?.();
      }}
      className="dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sheet bg-sheet p-6 text-ink shadow-lifted"
    >
      <h2 id="unsaved-title" className="text-lg font-semibold">
        Leave with unsaved changes?
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        Edits that have not been saved will be lost.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="danger" onClick={() => blocker.proceed?.()}>
          Leave
        </Button>
        <Button variant="primary" autoFocus onClick={() => blocker.reset?.()}>
          Stay
        </Button>
      </div>
    </dialog>
  );
}
