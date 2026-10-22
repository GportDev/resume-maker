import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

const visibleMs = 3200;
const exitMs = 150;
let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Show a short confirmation. Callable from anywhere on the client. */
export function toast(message: string, tone: ToastTone = "success") {
  items = [...items.slice(-2), { id: nextId++, message, tone }];
  emit();
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emptyItems: ToastItem[] = [];

/** Fires a toast once each time `message` becomes a new non-empty value. */
export function useToast(
  message: string | null | undefined,
  key: unknown,
  tone: ToastTone = "success",
) {
  const shown = useRef<unknown>(undefined);
  useEffect(() => {
    if (!message || shown.current === key) return;
    shown.current = key;
    toast(message, tone);
  }, [message, key, tone]);
}

export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => emptyItems,
  );
  return (
    <section
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {current.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </section>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remaining = useRef(visibleMs);

  // Pause while hovered or while the tab is hidden; resume where it stopped.
  useEffect(() => {
    if (leaving || hovered) return;
    let started = Date.now();
    let timer = window.setTimeout(() => setLeaving(true), remaining.current);
    function onVisibility() {
      if (document.hidden) {
        window.clearTimeout(timer);
        remaining.current -= Date.now() - started;
      } else {
        started = Date.now();
        timer = window.setTimeout(() => setLeaving(true), remaining.current);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [leaving, hovered]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => dismiss(item.id), exitMs);
    return () => window.clearTimeout(timer);
  }, [leaving, item.id]);

  const Icon = item.tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      data-leaving={leaving || undefined}
      className="toast pointer-events-auto flex items-center gap-2 rounded-control bg-ink px-3.5 py-2.5 text-sm text-sheet shadow-lifted"
    >
      <Icon
        aria-hidden="true"
        className={`size-4 ${item.tone === "success" ? "text-[#9fd3b0]" : "text-[#f1a99f]"}`}
      />
      {item.message}
    </div>
  );
}
