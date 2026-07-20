// @vitest-environment node
/**
 * Choosing which @font-face the SVG export embeds.
 *
 * The bug this exists to prevent: requiring an exact weight match meant a
 * single-weight display family set to anything but 400 embedded NOTHING, and
 * the exported SVG fell back to a serif — while the editor and the PNG export
 * looked correct, because browsers do nearest-weight matching.
 */

import { describe, expect, it } from "vitest";
import { faceGroup, pickFace, weightDistance } from "@/lib/export/fontMatch";
import type { FaceDescriptor } from "@/lib/export/fontMatch";

const face = (family: string, weight: string, style = "normal"): FaceDescriptor => ({
  family,
  weight,
  style,
});

describe("weightDistance", () => {
  it("is zero for an exact hit and for anywhere inside a range", () => {
    expect(weightDistance("400", "400")).toBe(0);
    expect(weightDistance("100 900", "600")).toBe(0);
    expect(weightDistance("400 700", "700")).toBe(0);
  });

  it("measures to the nearest end of the range", () => {
    expect(weightDistance("400", "600")).toBe(200);
    expect(weightDistance("700", "600")).toBe(100);
    expect(weightDistance("400 500", "800")).toBe(300);
  });
});

describe("pickFace", () => {
  it("embeds the only available weight rather than nothing — the Bungee case", () => {
    // Bungee ships 400 only. The document asked for 600, the old exact match
    // found no rule, and the SVG shipped with no @font-face at all.
    const bungee = face("Bungee", "400");
    expect(pickFace([bungee], face("Bungee", "600"))).toBe(bungee);
  });

  it("prefers the closest weight when a family ships several", () => {
    const faces = [face("Inter", "400"), face("Inter", "500"), face("Inter", "700")];
    expect(pickFace(faces, face("Inter", "700"))!.weight).toBe("700");
    expect(pickFace(faces, face("Inter", "420"))!.weight).toBe("400");
  });

  it("breaks an exact tie by direction, the way CSS does", () => {
    // 600 is 100 from both 500 and 700. CSS searches heavier first at 400+, so
    // a semibold request must not quietly render as medium.
    const faces = [face("Inter", "500"), face("Inter", "700")];
    expect(pickFace(faces, face("Inter", "600"))!.weight).toBe("700");
    // Below 400 the search runs the other way.
    const light = [face("Inter", "200"), face("Inter", "400")];
    expect(pickFace(light, face("Inter", "300"))!.weight).toBe("200");
  });

  it("matches a family case-insensitively but never substitutes another", () => {
    expect(pickFace([face("bungee", "400")], face("Bungee", "400"))).not.toBeNull();
    // Silently swapping in a different family would change the design.
    expect(pickFace([face("Inter", "600")], face("Bungee", "600"))).toBeNull();
  });

  it("keeps the requested style even when another style has a nearer weight", () => {
    const faces = [face("Inter", "400", "italic"), face("Inter", "600", "normal")];
    expect(pickFace(faces, face("Inter", "600", "italic"))!.style).toBe("italic");
  });

  it("falls back across style rather than embedding nothing", () => {
    const only = face("Lobster", "400", "normal");
    expect(pickFace([only], face("Lobster", "400", "italic"))).toBe(only);
  });

  it("covers a variable font's whole range from one face", () => {
    const variable = face("Recursive", "300 1000");
    expect(pickFace([variable], face("Recursive", "900"))).toBe(variable);
  });
});

describe("faceGroup", () => {
  // @fontsource splits ONE weight across unicode-range subsets and lists them
  // vietnamese, latin-ext, latin — with latin LAST. Embedding only the rule
  // pickFace lands on shipped a font with no basic Latin glyphs, so every
  // Latin character in every exported SVG fell back to a serif.
  const subsets = [
    { family: "Bungee", weight: "400", style: "normal", id: "vietnamese" },
    { family: "Bungee", weight: "400", style: "normal", id: "latin-ext" },
    { family: "Bungee", weight: "400", style: "normal", id: "latin" },
  ];

  it("returns every subset of the matched face, not just the first", () => {
    const hit = pickFace(subsets, { family: "Bungee", weight: "600", style: "normal" })!;
    expect(hit.id).toBe("vietnamese"); // first zero-distance rule wins…
    expect(faceGroup(subsets, hit).map((f) => f.id)).toEqual([
      "vietnamese",
      "latin-ext",
      "latin", // …but latin must travel with it or Latin text has no glyphs
    ]);
  });

  it("does not drag in other weights or styles", () => {
    const mixed = [
      ...subsets,
      { family: "Bungee", weight: "700", style: "normal", id: "other-weight" },
      { family: "Bungee", weight: "400", style: "italic", id: "other-style" },
      { family: "Inter", weight: "400", style: "normal", id: "other-family" },
    ];
    const hit = pickFace(mixed, { family: "Bungee", weight: "400", style: "normal" })!;
    expect(faceGroup(mixed, hit).map((f) => f.id)).toEqual([
      "vietnamese",
      "latin-ext",
      "latin",
    ]);
  });
});
