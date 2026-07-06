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

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional second line with remediation guidance. */
  detail?: string;
}

export interface ToastStore {
  toasts: Toast[];
  /** Append a toast and return its id (so callers can dismiss it early). */
  push: (kind: ToastKind, message: string, detail?: string) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (kind, message, detail) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, detail }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Fire-and-forget notification API usable from anywhere (no hook required). */
export const notify = {
  info: (message: string, detail?: string) =>
    useToastStore.getState().push("info", message, detail),
  success: (message: string, detail?: string) =>
    useToastStore.getState().push("success", message, detail),
  error: (message: string, detail?: string) =>
    useToastStore.getState().push("error", message, detail),
};
