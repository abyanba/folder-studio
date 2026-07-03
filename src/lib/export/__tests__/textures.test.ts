import { describe, expect, it } from "vitest";
import { buildTextureSvg } from "@/lib/export/textures";
import type { TextureSettings } from "@/types/document";

function tex(patch: Partial<TextureSettings>): TextureSettings {
  return {
    id: "none",
    opacity: 0.35,
    scale: 1,
    rotation: 0,
    color: "#123456",
    bg: "transparent",
    seed: 0,
    ...patch,
  };
}

describe("buildTextureSvg", () => {
  it("returns null for 'none'", () => {
    expect(buildTextureSvg(tex({ id: "none" }))).toBeNull();
  });

  it("returns null for an unknown texture id", () => {
    expect(buildTextureSvg(tex({ id: "not-a-texture" }))).toBeNull();
  });

  it("renders a static generator with the configured color and bg", () => {
    const svg = buildTextureSvg(tex({ id: "dots", color: "#abcdef", bg: "#000000" }));
    expect(svg).toContain('fill="#abcdef"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain("<circle");
  });

  it("defaults bg to transparent when empty", () => {
    const svg = buildTextureSvg(tex({ id: "dots", bg: "" }));
    expect(svg).toContain('fill="transparent"');
  });

  it("ignores the seed for non-scatter patterns (grid stays static)", () => {
    expect(buildTextureSvg(tex({ id: "grid-tex", seed: 999 }))).toBe(
      buildTextureSvg(tex({ id: "grid-tex", seed: 0 })),
    );
  });
});

describe("buildTextureSvg — seeded scatter patterns", () => {
  it("produces a 64×64 randomized tile when seeded", () => {
    const svg = buildTextureSvg(tex({ id: "dots", seed: 12345 }))!;
    expect(svg).toContain('width="64" height="64"');
  });

  it("is deterministic for a fixed seed", () => {
    const a = buildTextureSvg(tex({ id: "confetti", seed: 42 }));
    const b = buildTextureSvg(tex({ id: "confetti", seed: 42 }));
    expect(a).toBe(b);
  });

  it("differs across seeds", () => {
    const a = buildTextureSvg(tex({ id: "stars", seed: 1 }));
    const b = buildTextureSvg(tex({ id: "stars", seed: 2 }));
    expect(a).not.toBe(b);
  });

  it("seeded scatter differs from the static tile", () => {
    const seeded = buildTextureSvg(tex({ id: "dots", seed: 7 }));
    const staticTile = buildTextureSvg(tex({ id: "dots", seed: 0 }));
    expect(seeded).not.toBe(staticTile);
  });
});
