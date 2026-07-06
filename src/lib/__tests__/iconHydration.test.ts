// @vitest-environment node
/**
 * Document-driven icon hydration (ST-11): the document, not panel browsing,
 * decides which icon bodies to request. iconify is mocked so we assert the
 * request fan-out without touching the baked asset chunks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderDocument } from "@/types/document";
import type { FolderElement, IconVariant } from "@/types/element";

const mocks = vi.hoisted(() => ({
  requestPhosphorIcons: vi.fn(async () => undefined),
  requestMonoLogos: vi.fn(async () => undefined),
}));
vi.mock("@/lib/iconify", () => mocks);

import { collectIconRequests, hydrateDocumentIcons } from "@/lib/iconHydration";

function icon(name: string, variant: IconVariant): FolderElement {
  return { type: "icon", iconName: name, iconVariant: variant } as unknown as FolderElement;
}

const elements: FolderElement[] = [
  icon("star", "regular"),
  icon("heart", "bold"),
  icon("star", "regular"), // duplicate → deduped
  icon("github", "logo"), // mono logo
  { type: "text", text: "hi" } as unknown as FolderElement, // non-icon ignored
];

beforeEach(() => {
  mocks.requestPhosphorIcons.mockClear();
  mocks.requestMonoLogos.mockClear();
});

describe("collectIconRequests", () => {
  it("buckets phosphor by variant (deduped) and separates mono logos", () => {
    const { phosphor, monoLogos } = collectIconRequests(elements);
    expect(phosphor.get("regular")).toEqual(["star"]);
    expect(phosphor.get("bold")).toEqual(["heart"]);
    expect(monoLogos).toEqual(["github"]);
  });

  it("returns empty buckets when there are no icons", () => {
    const { phosphor, monoLogos } = collectIconRequests([
      { type: "text" } as unknown as FolderElement,
    ]);
    expect(phosphor.size).toBe(0);
    expect(monoLogos).toEqual([]);
  });
});

describe("hydrateDocumentIcons", () => {
  it("requests each phosphor variant group and the mono logos", async () => {
    await hydrateDocumentIcons({ elements } as FolderDocument);
    expect(mocks.requestPhosphorIcons).toHaveBeenCalledWith(["star"], "regular");
    expect(mocks.requestPhosphorIcons).toHaveBeenCalledWith(["heart"], "bold");
    expect(mocks.requestMonoLogos).toHaveBeenCalledWith(["github"]);
  });

  it("makes no requests for a document with no icons", async () => {
    await hydrateDocumentIcons({ elements: [] } as unknown as FolderDocument);
    expect(mocks.requestPhosphorIcons).not.toHaveBeenCalled();
    expect(mocks.requestMonoLogos).not.toHaveBeenCalled();
  });
});
