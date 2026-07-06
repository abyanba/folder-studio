/**
 * Toast overlay for the {@link useToastStore} channel (AR-04). Bottom-center
 * stack; info/success auto-dismiss after 4s, errors stay until dismissed. No
 * portal library — a fixed-position container is enough at this app's scale.
 */

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type Toast, type ToastKind } from "@/store/toastStore";

const AUTO_DISMISS_MS = 4000;

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const ACCENT: Record<ToastKind, string> = {
  info: "text-foreground",
  success: "text-emerald-500",
  error: "text-destructive",
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICONS[toast.kind];

  useEffect(() => {
    if (toast.kind === "error") return; // errors are sticky
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.kind, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-80 items-start gap-2.5 rounded-lg border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2"
      data-state="open"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", ACCENT[toast.kind])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
        {toast.detail && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{toast.detail}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => dismiss(toast.id)}
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
