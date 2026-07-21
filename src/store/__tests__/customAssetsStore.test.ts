/**
 * Custom-assets store: tintable assets seed the icon cache (so editor + export
 * resolve them like baked bodies) and eviction on remove; color assets carry a
 * self-contained src and touch no cache.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useCustomAssetsStore } from "@/store/customAssetsStore";
import { useDocumentStore } from "@/store/documentStore";
import { __resetIconCacheForTests, getIconBody } from "@/lib/iconify";

beforeEach(() => {
  __resetIconCacheForTests();
  localStorage.clear();
  // Drop any assets a previous case added (singleton store); snapshot the ids
  // first so removing mid-iteration can't skip entries.
  for (const id of useCustomAssetsStore.getState().assets.map((a) => a.id)) {
    useCustomAssetsStore.getState().remove(id);
  }
});

describe("customAssetsStore", () => {
  it("seeds a tintable icon into the cache and evicts it on remove", () => {
    const a = useCustomAssetsStore.getState().add({
      target: "icon",
      kind: "tintable",
      name: "Acme",
      category: "Custom",
      width: 24,
      height: 24,
      body: '<path fill="currentColor" d="M0 0h24v24H0z"/>',
    });
    // Custom icons resolve under the "custom" variant.
    expect(getIconBody(a.id, "custom")?.body).toContain("currentColor");

    useCustomAssetsStore.getState().remove(a.id);
    expect(getIconBody(a.id, "custom")).toBeNull();
    expect(useCustomAssetsStore.getState().assets).toHaveLength(0);
  });

  it("seeds a tintable mono logo under the logo variant", () => {
    const a = useCustomAssetsStore.getState().add({
      target: "logo",
      kind: "tintable",
      name: "Acme logo",
      category: "Custom",
      width: 24,
      height: 24,
      body: '<path fill="currentColor" d="M0 0h1v1H0z"/>',
    });
    expect(getIconBody(a.id, "logo")).not.toBeNull();
  });

  it("removes placed copies of a tintable asset when its library entry is deleted", () => {
    const a = useCustomAssetsStore.getState().add({
      target: "icon",
      kind: "tintable",
      name: "Acme",
      category: "Custom",
      width: 24,
      height: 24,
      body: '<path fill="currentColor" d="M0 0h24v24H0z"/>',
    });
    const elId = useDocumentStore.getState().addIcon({
      iconName: a.id,
      iconVariant: "custom",
      iconCacheKey: `${a.id}-custom`,
      color: "#fff",
    });
    expect(useDocumentStore.getState().doc.elements.some((e) => e.id === elId)).toBe(true);

    useCustomAssetsStore.getState().remove(a.id);
    expect(useDocumentStore.getState().doc.elements.some((e) => e.id === elId)).toBe(false);
  });

  it("stores a color asset self-contained, with no cached body", () => {
    const a = useCustomAssetsStore.getState().add({
      target: "logo",
      kind: "color",
      name: "Rainbow",
      category: "Custom",
      width: 24,
      height: 24,
      src: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
    });
    expect(a.src).toContain("data:image/svg+xml");
    expect(getIconBody(a.id, "logo")).toBeNull();
  });
});
