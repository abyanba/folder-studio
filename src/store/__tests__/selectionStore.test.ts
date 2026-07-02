import { beforeEach, describe, expect, it } from "vitest";
import { useSelectionStore } from "@/store/selectionStore";

const sel = () => useSelectionStore.getState();

beforeEach(() => sel().clear());

describe("selectionStore", () => {
  it("selects a single element", () => {
    sel().select("a");
    expect(sel().selectedId).toBe("a");
    expect(sel().selectedIds).toEqual(["a"]);
  });

  it("clears when selecting null", () => {
    sel().select("a");
    sel().select(null);
    expect(sel().selectedId).toBeNull();
    expect(sel().selectedIds).toEqual([]);
  });

  it("toggles ids in and out of the multi-selection", () => {
    sel().select("a");
    sel().toggle("b");
    expect(sel().selectedIds).toEqual(["a", "b"]);
    expect(sel().selectedId).toBe("b");
    sel().toggle("a");
    expect(sel().selectedIds).toEqual(["b"]);
    expect(sel().selectedId).toBe("b");
  });

  it("replaces the selection with setMany, focusing the last id", () => {
    sel().setMany(["x", "y", "z"]);
    expect(sel().selectedIds).toEqual(["x", "y", "z"]);
    expect(sel().selectedId).toBe("z");
  });

  it("clear empties everything", () => {
    sel().setMany(["x", "y"]);
    sel().clear();
    expect(sel().selectedIds).toEqual([]);
    expect(sel().selectedId).toBeNull();
  });
});
