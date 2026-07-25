// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildBaseShapeSvg } from "@/lib/export/baseShapes";
import { createEmptyDocument } from "@/types/document";

/** Every named color in docs/beautydream-folder-color.md: pick → the two tones. */
const BASE_REFS: Array<[name: string, pick: string, far: string]> = [
  ["lavender", "#2e4afa", "#8e9eff"],
  ["orange", "#fd5900", "#ffde00"],
  ["magenta", "#a93aff", "#ff81ff"],
  ["peach", "#dc3282", "#fe7970"],
  ["pink", "#fe39ff", "#fea9ff"],
  ["cyan", "#62e8af", "#b3fbdc"],
  ["green", "#9be862", "#c8ff9f"],
  ["blue", "#22b4fa", "#7ddcff"],
  ["light orange", "#ff8860", "#fbd92c"],
  ["purple", "#a056ff", "#c59afd"],
  ["light blue", "#1cb5ff", "#80ddff"],
  ["light green", "#4ee6a6", "#abffdb"],
];
const ALT_REFS: Array<[name: string, pick: string, far: string]> = [
  ["blue", "#0075ff", "#4deaff"],
  ["green", "#02aa93", "#67ff80"],
  ["peach", "#dc3282", "#fe7970"],
];

const doc = (over: object) => ({ ...createEmptyDocument(), baseShape: "beautydream", ...over });
const hexes = (svg: string) => (svg.match(/#[0-9a-f]{6}/g) ?? []);

describe("beautydream authentic reproduces the color guide from a SOLID pick", () => {
  it.each(BASE_REFS)("base %s", (_n, pick, far) => {
    const svg = buildBaseShapeSvg(doc({ folderColor: pick }));
    // The guide's angle -120 is this app's 60: bottom-left → top-right.
    expect(svg).toContain('x1="6.7%" y1="75.0%" x2="93.3%" y2="25.0%"');
    const got = hexes(svg);
    expect(got[0]).toBe(pick);
    expect(got[1]).toBe(far);
  });

  it.each(ALT_REFS)("alternate %s", (_n, pick, far) => {
    const svg = buildBaseShapeSvg(doc({ folderColor: pick, beautydreamVariant: "alternate" }));
    const front = svg.slice(svg.indexOf('id="bd_front"'), svg.indexOf('id="bd_tab"'));
    expect(front).toContain('x1="6.7%" y1="75.0%" x2="93.3%" y2="25.0%"');
    expect(front).toContain(pick);
    expect(front).toContain(far);
    // The tab sweeps at the same 60°, with the stops reversed — so it runs
    // opposite the front, the way the folder-alter-*.svg references do.
    const tab = svg.slice(svg.indexOf('id="bd_tab"'));
    expect(tab).toContain('x1="6.7%" y1="75.0%" x2="93.3%" y2="25.0%"');
    expect(tab.indexOf(far)).toBeLessThan(tab.indexOf(pick));
  });
});

describe("authentic and flat are genuinely different", () => {
  it.each(BASE_REFS)("flat %s paints the pick alone", (_n, pick, far) => {
    const svg = buildBaseShapeSvg(doc({ folderColor: pick, beautydreamColorProfile: "flat" }));
    expect(svg).not.toContain("linearGradient");
    expect(svg).toContain(`fill="${pick}"`);
    expect(svg).not.toContain(far);
  });
});
