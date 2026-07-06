// @vitest-environment node
/**
 * Toast store reducer: push appends and returns an id, dismiss removes by id,
 * clear empties, and the `notify` helper routes to the right kind.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { notify, useToastStore } from "@/store/toastStore";

beforeEach(() => useToastStore.getState().clear());

describe("toastStore", () => {
  it("push appends a toast and returns its id", () => {
    const id = useToastStore.getState().push("info", "hello", "detail");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, kind: "info", message: "hello", detail: "detail" });
  });

  it("push mints unique, increasing ids", () => {
    const a = useToastStore.getState().push("info", "a");
    const b = useToastStore.getState().push("info", "b");
    expect(b).toBeGreaterThan(a);
  });

  it("dismiss removes only the matching toast", () => {
    const a = useToastStore.getState().push("success", "a");
    useToastStore.getState().push("error", "b");
    useToastStore.getState().dismiss(a);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("b");
  });

  it("clear empties the stack", () => {
    useToastStore.getState().push("info", "a");
    useToastStore.getState().push("info", "b");
    useToastStore.getState().clear();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("notify helper sets the kind", () => {
    notify.success("ok");
    notify.error("bad", "why");
    const toasts = useToastStore.getState().toasts;
    expect(toasts.map((t) => t.kind)).toEqual(["success", "error"]);
    expect(toasts[1].detail).toBe("why");
  });
});
