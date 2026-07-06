/**
 * Working-doc autosave (ST-06): restore skips empty/corrupt state, and writes
 * are debounced and suppressed mid-gesture.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWorkingDoc, loadWorkingDoc, startAutosave } from "@/lib/autosave";
import { beginDocPreview, endDocPreview, useDocumentStore } from "@/store/documentStore";
import { createEmptyDocument } from "@/types/document";

const KEY = "fs_workingdoc";

beforeEach(() => {
  localStorage.clear();
  useDocumentStore.getState().reset();
  useDocumentStore.temporal.getState().clear();
});

afterEach(() => vi.useRealTimers());

describe("loadWorkingDoc", () => {
  it("returns null when nothing is saved", () => {
    expect(loadWorkingDoc()).toBeNull();
  });

  it("returns null for a pristine (empty) saved doc", () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, doc: createEmptyDocument() }));
    expect(loadWorkingDoc()).toBeNull();
  });

  it("restores a doc that has real content", () => {
    const doc = createEmptyDocument();
    doc.baseShape = "macos";
    localStorage.setItem(KEY, JSON.stringify({ v: 1, doc }));
    expect(loadWorkingDoc()?.baseShape).toBe("macos");
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadWorkingDoc()).toBeNull();
  });
});

describe("startAutosave", () => {
  it("debounces a write of the committed doc", () => {
    vi.useFakeTimers();
    const stop = startAutosave();
    useDocumentStore.getState().addShape("rect");
    expect(localStorage.getItem(KEY)).toBeNull(); // not yet — still debouncing
    vi.advanceTimersByTime(800);
    expect(localStorage.getItem(KEY)).toContain('"v":1');
    stop();
  });

  it("does not write while a preview gesture is active", () => {
    vi.useFakeTimers();
    const stop = startAutosave();
    beginDocPreview();
    useDocumentStore.getState().addShape("rect");
    vi.advanceTimersByTime(800);
    expect(localStorage.getItem(KEY)).toBeNull();
    endDocPreview();
    stop();
  });
});

describe("clearWorkingDoc", () => {
  it("removes the saved doc", () => {
    localStorage.setItem(KEY, "x");
    clearWorkingDoc();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
