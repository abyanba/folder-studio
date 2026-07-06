/**
 * Gallery persistence: addItem returns whether the snapshot survived a
 * localStorage write. A quota failure (mocked setItem throw) must report false
 * so the UI can surface an error instead of claiming a phantom save (ST-07).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "@/store/documentStore";
import { useGalleryStore } from "@/store/galleryStore";

beforeEach(() => {
  localStorage.clear();
  useGalleryStore.setState({ items: [] });
});

afterEach(() => vi.restoreAllMocks());

describe("galleryStore.addItem", () => {
  it("returns true and persists on a successful write", () => {
    const doc = useDocumentStore.getState().doc;
    const ok = useGalleryStore.getState().addItem("data:image/png;base64,x", doc);
    expect(ok).toBe(true);
    expect(useGalleryStore.getState().items).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("fs_gallery")!)).toHaveLength(1);
  });

  it("returns false when localStorage is over quota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    const doc = useDocumentStore.getState().doc;
    const ok = useGalleryStore.getState().addItem("data:image/png;base64,x", doc);
    expect(ok).toBe(false);
  });

  it("refuses a save projected past the storage budget without mutating state (ST-07)", () => {
    const doc = useDocumentStore.getState().doc;
    const huge = "d".repeat(5 * 1024 * 1024); // > 4.5 MB thumbnail
    const ok = useGalleryStore.getState().addItem(huge, doc);
    expect(ok).toBe(false);
    expect(useGalleryStore.getState().items).toHaveLength(0);
  });
});
