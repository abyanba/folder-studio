// @vitest-environment node
/**
 * Auto-fit math with an injected measurer (jsdom canvas can't measure text).
 * The fake measurer makes each character `size * 0.5` px wide.
 */

import { describe, expect, it } from "vitest";
import { autoFitLineHeight, autoFitSize, autoFitSpacing, cssFont } from "@/lib/textFit";
import { createTextElement } from "@/lib/elementFactories";
import type { TextElement } from "@/types/element";

const fakeMeasure = (text: string, font: string): number => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 0);
  return text.length * size * 0.5;
};

function makeText(patch: Partial<TextElement>): TextElement {
  return { ...createTextElement(), ...patch };
}

describe("cssFont", () => {
  it("builds the canvas font string incl. italic", () => {
    const el = makeText({ fontStyle: "italic", fontWeight: "700", fontFamily: "Outfit" });
    expect(cssFont(el, 20)).toBe('italic 700 20px "Outfit"');
  });
});

describe("autoFitSize", () => {
  it("finds the largest size fitting width and height", () => {
    // 4 chars × size × 0.5 ≤ width=100 → size ≤ 50; height=40, lineHeight 1 → size ≤ 40.
    const el = makeText({ text: "abcd", width: 100, height: 40, lineHeight: 1, letterSpacing: 0 });
    expect(autoFitSize(el, fakeMeasure)).toBe(40);
  });

  it("accounts for letter spacing", () => {
    // width term: 2ch × s/2 + 1 gap × 10 ≤ 100 → s ≤ 90; height 200/1.3 → not binding below 96.
    const el = makeText({ text: "ab", width: 100, height: 200, lineHeight: 1, letterSpacing: 10 });
    expect(autoFitSize(el, fakeMeasure)).toBe(90);
  });
});

describe("autoFitSpacing", () => {
  it("spreads leftover width across gaps in 0.5 steps", () => {
    // tw = 4 × 18 × 0.5 = 36; (100−36)/3 = 21.33 → clamped to 20.
    const el = makeText({ text: "abcd", width: 100, fontSize: 18 });
    expect(autoFitSpacing(el, fakeMeasure)).toBe(20);
    // (50−36)/3 = 4.67 → 4.5 after 0.5-rounding.
    expect(autoFitSpacing(makeText({ text: "abcd", width: 50, fontSize: 18 }), fakeMeasure)).toBe(4.5);
  });

  it("returns null for single-character text", () => {
    expect(autoFitSpacing(makeText({ text: "a" }), fakeMeasure)).toBeNull();
  });
});

describe("autoFitLineHeight", () => {
  it("fills the box height across lines, min 0.5, 0.1 steps", () => {
    const el = makeText({ text: "a\nb", fontSize: 20, height: 60 });
    expect(autoFitLineHeight(el)).toBe(1.5); // 60 / (2 × 20)
    expect(autoFitLineHeight(makeText({ text: "a", fontSize: 96, height: 10 }))).toBe(0.5);
  });
});
