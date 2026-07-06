// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/importImage";

describe("fitWithin (PF-08)", () => {
  it("leaves an image at or under the cap untouched", () => {
    expect(fitWithin(800, 400, 1024)).toEqual({ width: 800, height: 400, scaled: false });
    expect(fitWithin(1024, 1024, 1024)).toEqual({ width: 1024, height: 1024, scaled: false });
  });

  it("downscales the longest side to the cap, preserving aspect", () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768, scaled: true });
    expect(fitWithin(2000, 4000, 1024)).toEqual({ width: 512, height: 1024, scaled: true });
  });

  it("never upscales and tolerates degenerate sizes", () => {
    expect(fitWithin(100, 100, 1024).scaled).toBe(false);
    expect(fitWithin(0, 0, 1024)).toEqual({ width: 0, height: 0, scaled: false });
  });
});
