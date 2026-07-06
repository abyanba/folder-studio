/**
 * Export skip-list contract (EXP-12): when an element's image can't be loaded,
 * `buildExportCanvas` skips it and reports its label in `skipped` instead of
 * throwing. renderCanvas is browser-only, so we inject fake `loadImage` and
 * `createCanvas` deps rather than rasterize for real.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildExportCanvas, type RenderDeps } from "@/lib/export/renderCanvas";
import { useDocumentStore } from "@/store/documentStore";

/** Minimal 2D-context stand-in: records nothing, tolerates every call. */
function fakeContext(size: number) {
  return new Proxy(
    {
      getImageData: () => ({ data: new Uint8ClampedArray(size * size * 4) }),
      createPattern: () => ({}),
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        // Any other method is a no-op; any property read returns undefined.
        return () => undefined;
      },
      set() {
        return true; // absorb globalAlpha / fillStyle / shadow* assignments
      },
    },
  );
}

function fakeCanvasFactory(): NonNullable<RenderDeps["createCanvas"]> {
  return (width, height) =>
    ({ width, height, getContext: () => fakeContext(width) }) as unknown as HTMLCanvasElement;
}

const OK_IMAGE = { naturalWidth: 10, naturalHeight: 10 } as unknown as HTMLImageElement;

beforeEach(() => {
  useDocumentStore.getState().reset();
  useDocumentStore.temporal.getState().clear();
});

describe("buildExportCanvas skip list", () => {
  it("skips an image whose source fails to load and reports its label", async () => {
    const id = useDocumentStore.getState().addImage("bad-src://broken", 100, 100);
    const doc = useDocumentStore.getState().doc;
    const el = doc.elements.find((e) => e.id === id)!;

    const deps: RenderDeps = {
      getIconBody: () => null,
      createCanvas: fakeCanvasFactory(),
      // Everything loads except the broken image source.
      loadImage: async (src) => (src.startsWith("bad-src://") ? null : OK_IMAGE),
    };

    const result = await buildExportCanvas(doc, 64, deps);
    expect(result.skipped).toContain(el.name);
  });

  it("reports an empty skip list when every source loads", async () => {
    useDocumentStore.getState().addImage("data:image/png;base64,good", 100, 100);
    const doc = useDocumentStore.getState().doc;

    const deps: RenderDeps = {
      getIconBody: () => null,
      createCanvas: fakeCanvasFactory(),
      loadImage: async () => OK_IMAGE,
    };

    const result = await buildExportCanvas(doc, 64, deps);
    expect(result.skipped).toEqual([]);
  });
});
