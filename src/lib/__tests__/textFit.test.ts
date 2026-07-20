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

  it("accounts for letter spacing when a line must stay unbroken", () => {
    // "ab" on one line: 2ch × s/2 + 1 gap × 10 ≤ 100 → s ≤ 90. Height is the
    // binding constraint here (2 lines × s ≤ 100 → s ≤ 50), so wrapping to two
    // single-char lines can't beat the 90 one-liner.
    const el = makeText({ text: "ab", width: 100, height: 100, lineHeight: 1, letterSpacing: 10 });
    expect(autoFitSize(el, fakeMeasure)).toBe(90);
  });

  it("re-fits on explicit newlines instead of measuring one long line", () => {
    // Two lines × size × lineHeight 1 ≤ height 40 → size ≤ 20 (the one-line
    // measurement used to allow 40 here and overflow the box).
    const el = makeText({ text: "ab\ncd", width: 1000, height: 40, lineHeight: 1, letterSpacing: 0 });
    expect(autoFitSize(el, fakeMeasure)).toBe(20);
  });

  it("counts word-wrapped lines toward the height", () => {
    // "aaaa bbbb" is 9 chars → stays one line while 9 × s/2 ≤ 100 (s ≤ 22).
    // At 23 it wraps to 2 lines and 2 × 23 > height 40, so 22 wins. Without the
    // wrap-aware height check the one-line measurement would have allowed 40.
    const el = makeText({ text: "aaaa bbbb", width: 100, height: 40, lineHeight: 1, letterSpacing: 0 });
    expect(autoFitSize(el, fakeMeasure)).toBe(22);
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
