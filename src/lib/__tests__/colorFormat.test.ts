// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatColor, hslToRgb, parseColorInput, rgbToHsl } from "@/lib/colorFormat";

describe("rgbToHsl / hslToRgb", () => {
  it("round-trips primary colors", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50]);
    expect(rgbToHsl(0, 255, 0)).toEqual([120, 100, 50]);
    expect(rgbToHsl(0, 0, 255)).toEqual([240, 100, 50]);
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0]);
  });

  it("handles gray (no hue)", () => {
    expect(rgbToHsl(128, 128, 128)).toEqual([0, 0, 50]);
    expect(hslToRgb(0, 0, 50)).toEqual([128, 128, 128]);
  });
});

describe("formatColor", () => {
  it("formats each mode", () => {
    expect(formatColor("#ff0000", "hex")).toBe("#ff0000");
    expect(formatColor("#ff0000", "rgb")).toBe("255, 0, 0");
    expect(formatColor("#ff0000", "hsl")).toBe("0, 100, 50");
    expect(formatColor("#ff0000", "hsv")).toBe("0, 100, 100");
  });
});

describe("parseColorInput", () => {
  it("parses hex with/without #, 3- and 6-digit", () => {
    expect(parseColorInput("#a1b2c3", "hex")).toBe("#a1b2c3");
    expect(parseColorInput("A1B2C3", "hex")).toBe("#a1b2c3");
    expect(parseColorInput("#fa0", "hex")).toBe("#ffaa00");
    expect(parseColorInput("xyz", "hex")).toBeNull();
    expect(parseColorInput("#12345", "hex")).toBeNull();
  });

  it("parses rgb/hsl/hsv triples and rejects out-of-range", () => {
    expect(parseColorInput("255, 0, 0", "rgb")).toBe("#ff0000");
    expect(parseColorInput("256, 0, 0", "rgb")).toBeNull();
    expect(parseColorInput("0, 100, 50", "hsl")).toBe("#ff0000");
    expect(parseColorInput("0, 100, 100", "hsv")).toBe("#ff0000");
    expect(parseColorInput("garbage", "rgb")).toBeNull();
  });

  it("hex ↔ formatted string round-trips", () => {
    for (const hex of ["#f5c542", "#4ecdc4", "#123456"]) {
      expect(parseColorInput(formatColor(hex, "rgb"), "rgb")).toBe(hex);
    }
  });
});
