/**
 * Toast notifications — the app's single failure/success channel (finding AR-04).
 * A pure Zustand reducer: `push` appends, `dismiss` removes, `clear` empties.
 * Auto-dismiss timing lives in the `<Toaster/>` component so this store stays
 * trivially unit-testable and side-effect free.
 *
 * Use the `notify` helper from non-React code (stores, export pipeline); use the
 * hook in components.
 */

import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";

/** Inline call-to-action button (e.g. "Undo"); running it dismisses the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional second line with remediation guidance. */
  detail?: string;
  action?: ToastAction;
}

export interface ToastStore {
  toasts: Toast[];
  /** Append a toast and return its id (so callers can dismiss it early). */
  push: (kind: ToastKind, message: string, detail?: string, action?: ToastAction) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (kind, message, detail, action) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, detail, action }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Fire-and-forget notification API usable from anywhere (no hook required). */
export const notify = {
  info: (message: string, detail?: string, action?: ToastAction) =>
    useToastStore.getState().push("info", message, detail, action),
  success: (message: string, detail?: string, action?: ToastAction) =>
    useToastStore.getState().push("success", message, detail, action),
  error: (message: string, detail?: string, action?: ToastAction) =>
    useToastStore.getState().push("error", message, detail, action),
  /** Removal confirmation with an inline Undo (preset/swatch deletions). */
  undoable: (message: string, undo: () => void) =>
    useToastStore.getState().push("info", message, undefined, { label: "Undo", run: undo }),
};
