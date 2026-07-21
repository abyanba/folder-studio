/**
 * Toast overlay for the {@link useToastStore} channel (AR-04). Bottom-center
 * stack; every toast auto-dismisses (errors linger longer so they're readable)
 * and pops out to the bottom on exit. Each kind is a self-contained rich card —
 * dark tinted background with a faint bottom gradient, a colored hairline
 * outline, and a matching icon — so info/success/error read at a glance while
 * staying in shadcn character. No portal library — a fixed-position container
 * is enough at this app's scale.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type Toast, type ToastKind } from "@/store/toastStore";

/** Errors get longer than the transient info/success so they can be read. */
const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  info: 4000,
  success: 4000,
  error: 8000,
};

/** Must match the `animate-out` duration below so the row leaves after it plays. */
const EXIT_MS = 200;

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const ICON_COLOR: Record<ToastKind, string> = {
  info: "text-blue-400",
  success: "text-emerald-400",
  error: "text-red-400",
};

/**
 * Per-kind rich styling: a near-black base tinted toward the kind's hue, a
 * touch more saturated at the bottom (the "lil gradient"), a colored hairline
 * border, and light text. Committed dark like Sonner's rich colors, so it reads
 * the same in either app theme.
 */
const STYLE: Record<ToastKind, React.CSSProperties> = {
  info: {
    background: "linear-gradient(to bottom, #0b1220, #122340)",
    borderColor: "rgba(96,165,250,0.40)",
    color: "#dbeafe",
  },
  success: {
    background: "linear-gradient(to bottom, #08150f, #0d2419)",
    borderColor: "rgba(52,211,153,0.40)",
    color: "#d1fae5",
  },
  error: {
    background: "linear-gradient(to bottom, #190d0d, #2c1417)",
    borderColor: "rgba(248,113,113,0.45)",
    color: "#fee2e2",
  },
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [open, setOpen] = useState(true);
  const Icon = ICONS[toast.kind];

  const close = useCallback(() => setOpen(false), []);

  // Auto-dismiss: start the exit after the kind's lifetime.
  useEffect(() => {
    const timer = setTimeout(close, AUTO_DISMISS_MS[toast.kind]);
    return () => clearTimeout(timer);
  }, [toast.kind, close]);

  // Once closing, actually drop it from the store after the exit animation.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => dismiss(toast.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, toast.id, dismiss]);

  return (
    <div
      role="status"
      style={STYLE[toast.kind]}
      className={cn(
        "pointer-events-auto flex w-80 items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg duration-200",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2",
      )}
      data-state={open ? "open" : "closed"}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_COLOR[toast.kind])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
        {toast.detail && (
          <p className="mt-0.5 text-xs leading-snug opacity-70">{toast.detail}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100"
        onClick={close}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}
