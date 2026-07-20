// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BASE_SHAPES,
  buildBaseShapeOverlaySvg,
  buildBaseShapePaperSvg,
  buildBaseShapeSvg,
  buildFrontImageBackSvg,
  buildFrontImageOverlaySvg,
  buildImageColorOverlaySvg,
  buildWindowsImageBackSvg,
  buildWindowsPaperSvg,
  buildWindowsShineSvg,
  getBaseShapeMask,
  getFrontMask,
  getWindowsFrontMask,
  isFrontImage,
  isWindowsFrontImage,
  MAC_COLOR_PROFILES,
  macColorProfileName,
  macDerivedTabColor,
  toShapeColorState,
  windowsDerivedTabColor,
} from "@/lib/export/baseShapes";
import { getHex, hexToHsv } from "@/lib/color";
import { createEmptyDocument } from "@/types/document";
import type { FolderDocument } from "@/types/document";
import type { Gradient } from "@/types/gradient";

const gradient: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
  ],
};

function doc(patch: Partial<FolderDocument>): FolderDocument {
  return { ...createEmptyDocument(), ...patch };
}

describe("toShapeColorState", () => {
  it("derives HSV from a solid hex", () => {
    expect(toShapeColorState("#ff0000")).toEqual({
      mode: "solid",
      hue: 0,
      sat: 1,
      bri: 1,
      stops: [],
      gradType: "linear",
      gradAngle: 0,
    });
  });

  it("passes through gradient kind/angle/stops", () => {
    const cs = toShapeColorState(gradient);
    expect(cs.mode).toBe("gradient");
    expect(cs.gradType).toBe("linear");
    expect(cs.gradAngle).toBe(90);
    expect(cs.stops).toHaveLength(2);
  });
});

describe("buildBaseShapeSvg — simple (template) shapes", () => {
  it("substitutes a solid color and removes both placeholders", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: "#ff0000" }));
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).not.toContain("__COLOR__");
    expect(svg).not.toContain("__DEFS__");
  });

  it("injects a <defs> gradient and url(#fg) fill for a gradient fill", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: gradient }));
    expect(svg).toContain("<defs>");
    expect(svg).toContain('id="fg"');
    expect(svg).toContain("url(#fg)");
    expect(svg).not.toContain("__DEFS__");
    expect(svg).not.toContain("__COLOR__");
  });
});

describe("buildBaseShapeSvg — complex (generator) shapes", () => {
  it("windows solid fill emits front + back gradients and the shine", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ff0000" }));
    // Base color is the front gradient's deep stop.
    expect(svg).toContain('offset="1" stop-color="#ff0000"');
    expect(svg).toContain("url(#wg)");
    // Back panel has its own darker gradient (tab / top strip / bottom rim).
    expect(svg).toContain("url(#wbg)");
    // Top-edge shine: white stroke fading left→right, clipped to the front.
    expect(svg).toContain("url(#wsh)");
    expect(svg).toContain('clip-path="url(#wfc)"');
  });

  it("windows back panel is darker than the base color", () => {
    // Teal base #0098a5 → official-style back darkens hard (low sat headroom).
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#0098a5" }));
    const back = /id="wbg"[^>]*><stop stop-color="(#[0-9a-f]{6})"/.exec(svg);
    expect(back).not.toBeNull();
    // The tab top's HSV value (max RGB channel) must be visibly darker than
    // the base's (0xa5), no matter where the hue shift puts the max channel.
    const channels = [1, 3, 5].map((i) => parseInt(back![1].slice(i, i + 2), 16));
    expect(Math.max(...channels)).toBeLessThan(0xa5 * 0.85);
  });

  it("windows gradient fill emits front + back gradients and the shine", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: gradient }));
    expect(svg).toContain('<linearGradient id="wg"');
    expect(svg).toContain("url(#wg)");
    expect(svg).toContain("url(#wbg)");
    expect(svg).toContain("url(#wsh)");
  });

  it("file-folder solid renders its layered paths", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "file-folder", folderColor: "#3366cc" }));
    expect(svg).toContain('fill="#3366cc"');
    expect(svg).toContain('fill-opacity="0.05"');
  });
});

describe("unknown base shape falls back to the first (classic)", () => {
  it("buildBaseShapeSvg uses classic for an unknown id", () => {
    const unknown = buildBaseShapeSvg(doc({ baseShape: "does-not-exist", folderColor: "#ff0000" }));
    const classic = buildBaseShapeSvg(doc({ baseShape: "classic", folderColor: "#ff0000" }));
    expect(unknown).toBe(classic);
  });

  it("getBaseShapeMask returns a white silhouette and falls back for unknowns", () => {
    expect(getBaseShapeMask("classic")).toContain('fill="white"');
    expect(getBaseShapeMask("nope")).toBe(getBaseShapeMask("classic"));
  });
});

describe("windows anchored color algorithm", () => {
  const at = (color: string) => buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: color }));

  it("reproduces the official Default.ico palette exactly at #ffc430", () => {
    const svg = at("#ffc430");
    expect(svg).toContain(`stop-color="${getHex(45, 0.38, 1)}"`); // front light
    expect(svg).toContain(`stop-color="${getHex(43, 0.906, 1)}"`); // back tab
    expect(svg).toContain(`stop-color="${getHex(41, 0.826, 0.902)}"`); // back rim
  });

  it("reproduces the official Green.ico palette (within rounding) at its input color", () => {
    // The input hue round-trips hex→hsv as 185.1° (not exactly 185°), so the
    // green anchor overwhelmingly but not infinitely dominates the IDW blend.
    const svg = at(getHex(185, 1, 0.647));
    const near = (want: string, got: string | undefined) => {
      expect(got).toBeDefined();
      const ch = (x: string, i: number) => parseInt(x.slice(i, i + 2), 16);
      for (const i of [1, 3, 5]) expect(Math.abs(ch(want, i) - ch(got!, i))).toBeLessThanOrEqual(4);
    };
    const light = /offset="0.234375" stop-color="(#[0-9a-f]{6})"/.exec(svg);
    const tab = /id="wbg"[^>]*><stop stop-color="(#[0-9a-f]{6})"/.exec(svg);
    near(getHex(157, 0.746, 0.788), light?.[1]); // front light
    near(getHex(162, 0.962, 0.51), tab?.[1]); // back tab
  });

  it("interpolates between anchors for a non-reference color (no exact anchor match)", () => {
    // Pure magenta sits between red and (achromatic) anchors — a blended,
    // still-plausible palette, not any single anchor's values.
    const svg = at("#c000c0");
    expect(svg).toContain("url(#wbg)");
    expect(svg).toContain("url(#wg)");
    expect(svg).toContain("url(#wsh)");
  });
});

describe("windows custom back color", () => {
  it("solid: a custom tab overrides the derived back, front unchanged", () => {
    const auto = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ffc430" }));
    const custom = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderBackColor: "#3a7bd5" }),
    );
    // Front light stop is identical (front is untouched)…
    expect(custom).toContain(`stop-color="${getHex(45, 0.38, 1)}"`);
    // …but the tab is exactly the picked color, not the official yellow tab.
    expect(custom).toContain('id="wbg"');
    expect(custom).toContain('stop-color="#3a7bd5"');
    expect(custom).not.toContain(`stop-color="${getHex(43, 0.906, 1)}"`);
    expect(custom).not.toBe(auto);
  });

  it("solid: the tab keeps its own subtle darkening; the rim stays front-derived", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderBackColor: "#3a7bd5" }),
    );
    // Tab (top) = picked color, then a slightly darker mid stop (its own depth).
    const m = /id="wbg"[^>]*><stop stop-color="#3a7bd5"\/><stop offset="0.24" stop-color="(#[0-9a-f]{6})"\/><stop offset="0.85" stop-color="(#[0-9a-f]{6})"/.exec(svg);
    expect(m).not.toBeNull();
    const maxOf = (h: string) => Math.max(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    expect(maxOf(m![1])).toBeLessThan(maxOf("#3a7bd5")); // mid stop darker than the tab
    // The rim (last stop) is the FRONT's anchored rim (grouped with the front),
    // NOT derived from the blue tab.
    expect(m![2]).toBe(getHex(41, 0.826, 0.902));
  });

  it("the rim is identical whether the tab is Auto or Custom (rim follows the front)", () => {
    const rimOf = (svg: string) =>
      /<stop offset="0.85" stop-color="(#[0-9a-f]{6})"/.exec(svg)?.[1];
    const auto = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ffc430" }));
    const custom = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderBackColor: "#3a7bd5" }),
    );
    expect(rimOf(custom)).toBe(rimOf(auto));
    expect(rimOf(custom)).toBe(getHex(41, 0.826, 0.902));
  });

  it("gradient tab: the user's gradient plays across the tab", () => {
    const tabGrad = {
      kind: "linear" as const,
      angle: 90,
      stops: [
        { id: "t0", pos: 0, hue: 210, sat: 0.7, bri: 0.9 },
        { id: "t1", pos: 1, hue: 280, sat: 0.8, bri: 0.5 },
      ],
    };
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderBackColor: tabGrad }),
    );
    expect(svg).toContain(`stop-color="${getHex(210, 0.7, 0.9)}"`); // tab gradient start
    expect(svg).toContain(`stop-color="${getHex(280, 0.8, 0.5)}"`); // tab gradient end
    expect(svg).toContain(`stop-color="${getHex(41, 0.826, 0.902)}"`); // rim still front-derived
  });

  it("gradient tab: the angle rotates the tab axis (clipped to the top strip)", () => {
    const tabAt = (angle: number) =>
      buildBaseShapeSvg(
        doc({
          baseShape: "windows",
          folderColor: "#ffc430",
          folderBackColor: {
            kind: "linear" as const,
            angle,
            stops: [
              { id: "t0", pos: 0, hue: 210, sat: 0.7, bri: 0.9 },
              { id: "t1", pos: 1, hue: 280, sat: 0.8, bri: 0.5 },
            ],
          },
        }),
      );
    const axisOf = (svg: string) => /id="wtg" (x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+")/.exec(svg)?.[1];
    // The tab rides its own `wtg` gradient, clipped to the top strip, and the
    // axis changes with the angle (the bug: it used to be hardcoded).
    const h = tabAt(90);
    expect(h).toContain('clip-path="url(#wtc)"');
    expect(axisOf(h)).not.toBe(axisOf(tabAt(0)));
    expect(axisOf(h)).not.toBe(axisOf(tabAt(45)));
  });

  it("gradient tab: radial is never emitted (tab is always linear)", () => {
    const svg = buildBaseShapeSvg(
      doc({
        baseShape: "windows",
        folderColor: "#ffc430",
        folderBackColor: {
          kind: "radial" as const,
          angle: 90,
          stops: [
            { id: "t0", pos: 0, hue: 210, sat: 0.7, bri: 0.9 },
            { id: "t1", pos: 1, hue: 280, sat: 0.8, bri: 0.5 },
          ],
        },
      }),
    );
    expect(svg).toContain('<linearGradient id="wtg"');
    expect(svg).not.toContain("radialGradient");
  });

  it("gradient front + custom tab: front stays the user's gradient", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: gradient, folderBackColor: "#3a7bd5" }),
    );
    expect(svg).toContain('<linearGradient id="wg"'); // user gradient front
    expect(svg).toContain('stop-color="#3a7bd5"'); // custom tab
    expect(svg).toContain("url(#wsh)"); // shine kept
  });

  it("buildWindowsImageBackSvg overrides only the tab; rim derives from the adaptive color", () => {
    const custom = buildWindowsImageBackSvg("#0098a5", "#3a7bd5");
    expect(custom).toContain('stop-color="#3a7bd5"'); // tab exactly as picked
    const auto = buildWindowsImageBackSvg("#0098a5");
    // The rim (0.85 stop) is the same in both — it comes from the adaptive color.
    const rimOf = (s: string) => /<stop offset="0.85" stop-color="(#[0-9a-f]{6})"/.exec(s)?.[1];
    expect(rimOf(custom)).toBe(rimOf(auto));
  });

  it("windowsDerivedTabColor returns a tab color for solid, gradient and image fills", () => {
    expect(windowsDerivedTabColor(doc({ baseShape: "windows", folderColor: "#ffc430" }))).toBe(
      getHex(43, 0.906, 1),
    );
    // Gradient → derived from the deepest stop; image → from the adaptive color.
    expect(windowsDerivedTabColor(doc({ baseShape: "windows", folderColor: gradient }))).toMatch(
      /^#[0-9a-f]{6}$/,
    );
    expect(
      windowsDerivedTabColor(
        doc({ baseShape: "windows", folderFillMode: "image", folderBgImage: "x", folderBgImageColor: "#0098a5" }),
      ),
    ).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("windows folder state (paper peek)", () => {
  it("defaults to empty and emits no paper", () => {
    expect(createEmptyDocument().folderState).toBe("empty");
    const svg = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#ffc430" }));
    expect(svg).not.toContain("wpp");
  });

  it("contents adds the paper sheet between the back and the front", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderState: "contents" }),
    );
    // The default paper is a white sheet gradient (`wpp`)…
    expect(svg).toContain('id="wpp"');
    expect(svg).toContain('fill="url(#wpp)"');
    // …painted after the back panel and before the front panel (`wg`).
    const paperIdx = svg.indexOf('fill="url(#wpp)"');
    const frontIdx = svg.indexOf('fill="url(#wg)"');
    const backIdx = svg.indexOf('fill="url(#wbg)"');
    expect(backIdx).toBeGreaterThanOrEqual(0);
    expect(backIdx).toBeLessThan(paperIdx);
    expect(paperIdx).toBeLessThan(frontIdx);
  });

  it("works on a gradient fill too (paper independent of the fill)", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: gradient, folderState: "contents" }),
    );
    expect(svg).toContain('fill="url(#wpp)"');
    expect(svg).toContain('<linearGradient id="wg"'); // user gradient front kept
  });

  it("a custom solid paper color overrides the white sheet", () => {
    const svg = buildBaseShapeSvg(
      doc({
        baseShape: "windows",
        folderColor: "#ffc430",
        folderState: "contents",
        folderPaperColor: "#7ec8ff",
      }),
    );
    expect(svg).toContain('fill="#7ec8ff"'); // solid paper, no gradient def
    expect(svg).not.toContain("wpp");
  });

  it("a custom gradient paper is linear and angle-respecting (radial never emitted)", () => {
    const paper = {
      kind: "radial" as const, // radial should be ignored → linear
      angle: 90,
      stops: [
        { id: "p0", pos: 0, hue: 0, sat: 0, bri: 1 },
        { id: "p1", pos: 1, hue: 210, sat: 0.5, bri: 0.9 },
      ],
    };
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", folderState: "contents", folderPaperColor: paper }),
    );
    expect(svg).toContain('<linearGradient id="wpp"');
    expect(svg).not.toContain("radialGradient");
  });

  it("macOS supports the paper peek too (self-clipped, recolorable, gradient linear)", () => {
    // Empty → no paper on macOS either.
    expect(buildBaseShapeSvg(doc({ baseShape: "macos", folderState: "empty" }))).not.toContain("mpp");
    // Contents solid fill → white sheet (`mpp`) masked to the tab strip (`mpm`).
    const solid = buildBaseShapeSvg(doc({ baseShape: "macos", folderState: "contents" }));
    expect(solid).toContain('id="mpp"');
    expect(solid).toContain('mask="url(#mpm)"');
    // Contents on a gradient fill works too.
    const grad = buildBaseShapeSvg(doc({ baseShape: "macos", folderColor: gradient, folderState: "contents" }));
    expect(grad).toContain('mask="url(#mpm)"');
    // Custom solid paper overrides the white sheet; custom gradient is linear.
    const custom = buildBaseShapeSvg(
      doc({ baseShape: "macos", folderState: "contents", folderPaperColor: "#ffd34e" }),
    );
    expect(custom).toContain('fill="#ffd34e"');
    expect(custom).not.toContain("mpp");
    const gradPaper = buildBaseShapeSvg(
      doc({
        baseShape: "macos",
        folderState: "contents",
        folderPaperColor: {
          kind: "radial" as const, // radial ignored → linear
          angle: 45,
          stops: [
            { id: "p0", pos: 0, hue: 0, sat: 0, bri: 1 },
            { id: "p1", pos: 1, hue: 45, sat: 0.6, bri: 1 },
          ],
        },
      }),
    );
    expect(gradPaper).toContain('<linearGradient id="mpp"');
    expect(gradPaper).not.toContain("radialGradient");
  });

  it("buildBaseShapePaperSvg dispatches per shape (windows/macos), else null", () => {
    expect(buildBaseShapePaperSvg("windows", "contents")).toContain('mask="url(#wpm)"');
    expect(buildBaseShapePaperSvg("macos", "contents")).toContain('mask="url(#mpm)"');
    expect(buildBaseShapePaperSvg("macos", "empty")).toBeNull();
    expect(buildBaseShapePaperSvg("glass", "contents")).toBeNull();
  });

  it("buildWindowsPaperSvg is a self-clipped layer (for image fills), or null when N/A", () => {
    // Not windows, or not contents → null (no layer to composite).
    expect(buildWindowsPaperSvg("macos", "contents")).toBeNull();
    expect(buildWindowsPaperSvg("windows", "empty")).toBeNull();
    // Contents → a masked paper layer (mask = back minus front = the peek gap).
    const white = buildWindowsPaperSvg("windows", "contents");
    expect(white).toContain('mask="url(#wpm)"');
    expect(white).toContain('id="wpp"'); // default white sheet gradient
    // Custom solid overrides the white sheet.
    const custom = buildWindowsPaperSvg("windows", "contents", "#111111");
    expect(custom).toContain('fill="#111111"');
    expect(custom).not.toContain("wpp");
  });
});

describe("windows gradient treatment tweak (temporary)", () => {
  const gradientAt = (algo: FolderDocument["windowsGradientAlgo"]) =>
    buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: gradient, windowsGradientAlgo: algo }));

  it("defaults to 'echo' and every treatment emits a front, back and shine", () => {
    expect(createEmptyDocument().windowsGradientAlgo).toBe("echo");
    for (const algo of ["current", "lit", "echo", "best"] as const) {
      const svg = gradientAt(algo);
      expect(svg, algo).toContain("url(#wg)");
      expect(svg, algo).toContain("url(#wbg)");
      expect(svg, algo).toContain("url(#wsh)");
    }
  });

  it("the four treatments render differently from each other", () => {
    const out = new Set(
      (["current", "lit", "echo", "best"] as const).map(gradientAt),
    );
    expect(out.size).toBe(4);
  });

  it("keeps the user's gradient on the front except in 'lit' mode", () => {
    // The two-stop test gradient is red→blue; a verbatim front carries #ff0000.
    expect(gradientAt("current")).toContain('stop-color="#ff0000"');
    expect(gradientAt("echo")).toContain('stop-color="#ff0000"');
    expect(gradientAt("best")).toContain('stop-color="#ff0000"');
    // 'lit' recolors the front through the anchored envelope, so the raw stop
    // color no longer appears verbatim.
    expect(gradientAt("lit")).not.toContain('stop-color="#ff0000"');
  });

  it("'current' uses a uniform (2-stop) back; 'echo'/'best' echo the whole gradient", () => {
    const backStops = (svg: string) =>
      (/id="wbg"[^>]*>((?:<stop[^>]*>)+)<\/linearGradient>/.exec(svg)?.[1].match(/<stop/g) || []).length;
    expect(backStops(gradientAt("current"))).toBe(2); // top + rim only
    expect(backStops(gradientAt("echo"))).toBe(2); // 2-stop gradient echoed → 2
    // Solid fills never carry the gradient field's effect.
    const solid = buildBaseShapeSvg(
      doc({ baseShape: "windows", folderColor: "#ffc430", windowsGradientAlgo: "echo" }),
    );
    expect(solid).toContain(`stop-color="${getHex(43, 0.906, 1)}"`); // official tab, unaffected
  });
});

describe("windows front-only image mode", () => {
  it("isWindowsFrontImage is true only for windows + image + front", () => {
    expect(isWindowsFrontImage("windows", "image", "front")).toBe(true);
    expect(isWindowsFrontImage("windows", "image", "full")).toBe(false);
    expect(isWindowsFrontImage("windows", "color", "front")).toBe(false);
    expect(isWindowsFrontImage("macos", "image", "front")).toBe(false);
  });

  it("buildWindowsImageBackSvg derives a darker back gradient from the adaptive color", () => {
    // Teal input → anchored back is visibly darker than the source value.
    const svg = buildWindowsImageBackSvg("#0098a5");
    const back = /id="wbg"[^>]*><stop stop-color="(#[0-9a-f]{6})"/.exec(svg);
    expect(back).not.toBeNull();
    const channels = [1, 3, 5].map((i) => parseInt(back![1].slice(i, i + 2), 16));
    expect(Math.max(...channels)).toBeLessThan(0xa5 * 0.9);
  });

  it("getWindowsFrontMask is the front-panel silhouette only", () => {
    const mask = getWindowsFrontMask();
    expect(mask).toContain('fill="white"');
    // One path (the front WIN_B), not the two-path full silhouette.
    expect((mask.match(/<path/g) || []).length).toBe(1);
  });

  it("buildWindowsShineSvg emits the clipped top-edge shine and no back fill", () => {
    const svg = buildWindowsShineSvg();
    expect(svg).toContain("url(#wsh)");
    expect(svg).toContain('clip-path="url(#wfc)"');
    expect(svg).not.toContain("wbg");
  });
});

describe("buildImageColorOverlaySvg — image color tint", () => {
  it("returns null when the overlay is off (opacity 0)", () => {
    expect(buildImageColorOverlaySvg("windows", "#000000", 0)).toBeNull();
    expect(buildImageColorOverlaySvg("windows", "#000000", -1)).toBeNull();
  });

  it("emits a colored rect masked to the folder silhouette at the given opacity", () => {
    const svg = buildImageColorOverlaySvg("windows", "#123456", 0.4);
    expect(svg).not.toBeNull();
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill-opacity="0.400"');
    expect(svg).toContain('mask="url(#ovm)"');
  });

  it("clamps opacity to 1 and works for any base shape", () => {
    const svg = buildImageColorOverlaySvg("classic", "#ffffff", 5);
    expect(svg).toContain('fill-opacity="1.000"');
  });
});

describe("buildBaseShapeOverlaySvg — image-fill shading overlay", () => {
  it("windows gets a shading mask (back minus front) plus the shine", () => {
    const svg = buildBaseShapeOverlaySvg("windows");
    expect(svg).not.toBeNull();
    expect(svg).toContain('mask="url(#wvm)"');
    expect(svg).toContain('stroke="url(#wsh)"');
    // Shading is a black gradient, not a flat fill.
    expect(svg).toContain('stop-color="#000000"');
  });

  it("macos gets a tab-darkening mask plus the emboss/fold structure", () => {
    const svg = buildBaseShapeOverlaySvg("macos");
    expect(svg).not.toBeNull();
    expect(svg).toContain('mask="url(#mvm)"');
    expect(svg).toContain('stop-color="#000000"');
    // The two rim lines + fold seam are opacity overlays.
    expect(svg).toContain('fill="#ffffff" fill-opacity="0.16"');
  });

  it("shapes without an overlay treatment return null", () => {
    expect(buildBaseShapeOverlaySvg("classic")).toBeNull();
    expect(buildBaseShapeOverlaySvg("does-not-exist")).toBeNull();
  });
});

describe("macOS color profiles", () => {
  it("exposes the four profiles with names", () => {
    expect(MAC_COLOR_PROFILES.map((p) => p.id)).toEqual(["best", "official", "popped", "flat"]);
    expect(macColorProfileName("official")).toBe("Authentic");
    expect(macColorProfileName("flat")).toBe("Flat");
    // Unknown ids fall back to the raw id.
    expect(macColorProfileName("nope" as never)).toBe("nope");
  });

  it("the default (best) paints a tab + face gradient and no white rim lines", () => {
    const svg = buildBaseShapeSvg(doc({ baseShape: "macos", macColorProfile: "best" }));
    expect(svg).toContain('id="mgt"'); // tab gradient
    expect(svg).toContain('id="mgf"'); // face gradient (with baked emboss)
    // The old white rim overlay is gone; the emboss lives in the face gradient.
    expect(svg).not.toContain('fill="white" fill-opacity="0.35"');
  });

  it("official reproduces the authentic recolor envelope for a saturated hue", () => {
    // A fully saturated blue (S≥0.35 → fully chromatic) must yield the measured
    // official front-face body: (H, 0.54, 0.98).
    const blue = getHex(199, 1, 1);
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "official", folderColor: blue }),
    );
    const cs = toShapeColorState(blue);
    expect(svg).toContain(`stop-color="${getHex(cs.hue, 0.54, 0.98)}"`); // body
    expect(svg).toContain(`stop-color="${getHex(cs.hue, 0.89, 0.98 * 0.82)}"`); // tab base
  });

  it("official keeps neutrals neutral (no saturation injected into the tab)", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "official", folderColor: "#808080" }),
    );
    // A gray folder's tab must stay gray (S=0), only darker.
    expect(svg).toContain(`stop-color="${getHex(0, 0, 0.5 * 0.82)}"`);
  });

  it("flat is a flat front color but keeps the tab, rim lines and fold shadow", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "flat", folderColor: "#3388ff" }),
    );
    // The front face is a single flat fill (no gradient anywhere).
    expect(svg).not.toContain("linearGradient");
    expect(svg).toContain('fill="#3388ff"'); // flat front
    expect(svg).toContain("stroke-opacity"); // the fold shadow under the tab
    // The two bottom rim lines are still drawn (adaptive, not white).
    expect(svg).toContain(`d="${"M10.5 204H245.5V208.5H10.5V204Z"}"`);
    expect(svg).toContain(`d="${"M10.5 213.25H245.5V217.75H10.5V213.25Z"}"`);
    expect(svg).not.toContain('fill="white" fill-opacity="0.35"');
    // The tab is a distinct deeper shade, not the same flat front color.
    const front = "#3388ff";
    const tabFills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(tabFills.some((c) => c !== front)).toBe(true);
  });

  it("a black solid fill never reaches true black (floored per profile)", () => {
    // official floor 0.14 → the front face body stop is that floored value.
    const official = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "official", folderColor: "#000000" }),
    );
    expect(official).not.toContain("#000000");
    expect(official).toContain(`stop-color="${getHex(0, 0, 0.14)}"`);
    // best is floored higher-contrast-wise lower (0.12); popped lowest (0.10).
    const best = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "best", folderColor: "#000000" }),
    );
    const popped = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "popped", folderColor: "#000000" }),
    );
    expect(best).toContain(`stop-color="${getHex(0, 0, 0.12)}"`);
    expect(popped).toContain(`stop-color="${getHex(0, 0, 0.1)}"`);
    expect(best).not.toContain("#000000");
    expect(popped).not.toContain("#000000");
  });

  it("pure black is reachable via the flat profile and via a gradient", () => {
    const flat = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "flat", folderColor: "#000000" }),
    );
    expect(flat).toContain('fill="#000000"'); // flat front is exactly black
    const blackGrad: Gradient = {
      kind: "linear",
      angle: 90,
      stops: [
        { id: "a", pos: 0, hue: 0, sat: 0, bri: 0 },
        { id: "b", pos: 1, hue: 0, sat: 0, bri: 0 },
      ],
    };
    const grad = buildBaseShapeSvg(
      doc({ baseShape: "macos", macColorProfile: "best", folderColor: blackGrad }),
    );
    expect(grad).toContain("#000000"); // gradient front keeps the black stops
  });

  it("profiles produce distinct output for the same color", () => {
    const base = { baseShape: "macos" as const, folderColor: "#c0392b" };
    const best = buildBaseShapeSvg(doc({ ...base, macColorProfile: "best" }));
    const popped = buildBaseShapeSvg(doc({ ...base, macColorProfile: "popped" }));
    const official = buildBaseShapeSvg(doc({ ...base, macColorProfile: "official" }));
    expect(best).not.toBe(popped);
    expect(best).not.toBe(official);
    expect(popped).not.toBe(official);
  });

  it("gradient fill derives an adaptive tab + rim (never pure white)", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", folderColor: gradient, macColorProfile: "best" }),
    );
    expect(svg).toContain('id="mgt"'); // derived tab
    expect(svg).toContain('id="mgf"'); // user gradient on the face
    // Rim lines are painted, but tinted (not the old white overlay).
    expect(svg).toContain(`d="${"M10.5 204H245.5V208.5H10.5V204Z"}"`);
    expect(svg).not.toContain('fill="white" fill-opacity="0.35"');
  });

  it("flat + gradient fill falls back to the derived tab + rim (flat has no gradient meaning)", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", folderColor: gradient, macColorProfile: "flat" }),
    );
    // A gradient front can't be flat, so it renders like Refined: derived tab.
    expect(svg).toContain('id="mgf"'); // user gradient on the face
    expect(svg).toContain('id="mgt"'); // derived tab
    expect(svg).not.toContain('fill="white" fill-opacity="0.35"');
  });
});

describe("Windows solid color profiles", () => {
  const winSolid = (profile: FolderDocument["windowsColorProfile"], color = "#3a7bd5") =>
    buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: color, windowsColorProfile: profile }));

  it("official is byte-identical to the default anchored render", () => {
    // official preserves the historically chosen Windows look exactly.
    const official = winSolid("official");
    const baseline = buildBaseShapeSvg(doc({ baseShape: "windows", folderColor: "#3a7bd5" }));
    expect(official).toBe(baseline);
  });

  it("popped, best and flat each diverge from official", () => {
    const official = winSolid("official");
    expect(winSolid("popped")).not.toBe(official);
    expect(winSolid("best")).not.toBe(official);
    expect(winSolid("flat")).not.toBe(official);
  });

  it("flat paints a single flat front (front gradient stops equal) but keeps the tab", () => {
    const svg = winSolid("flat", "#3a7bd5");
    // The front gradient (wg) light and deep stops are the same flat color.
    const wg = svg.match(/id="wg"[^>]*>(.*?)<\/linearGradient>/s)?.[1] ?? "";
    const stops = [...wg.matchAll(/stop-color="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(new Set(stops).size).toBe(1); // flat front
    expect(stops[0]).toBe("#3a7bd5");
    // The tab/back gradient (wbg) is still present (structure kept).
    expect(svg).toContain('id="wbg"');
  });
});

describe("macOS gradient profiles", () => {
  const macGrad = (algo: FolderDocument["macGradientAlgo"]) =>
    buildBaseShapeSvg(doc({ baseShape: "macos", folderColor: gradient, macGradientAlgo: algo }));

  it("all four algos render and mutually differ", () => {
    const best = macGrad("best");
    const current = macGrad("current");
    const echo = macGrad("echo");
    const lit = macGrad("lit");
    const all = [best, current, echo, lit];
    expect(new Set(all).size).toBe(4);
    for (const svg of all) {
      expect(svg).toContain('id="mgt"'); // a tab def
      expect(svg).toContain('id="mgf"'); // a front def
    }
  });

  it("lit remaps the front through the authentic envelope; others keep it verbatim", () => {
    // The user's gradient runs red→blue at full sat/val. best keeps those stops;
    // lit washes them toward the official bright/desaturated face.
    expect(macGrad("best")).toContain(`stop-color="${getHex(0, 1, 1)}"`);
    expect(macGrad("lit")).not.toContain(`stop-color="${getHex(0, 1, 1)}"`);
  });
});

describe("macOS back (tab) + front-only image", () => {
  it("a custom solid back color overrides the derived tab", () => {
    const svg = buildBaseShapeSvg(
      doc({ baseShape: "macos", folderColor: "#3388ff", folderBackColor: "#123456" }),
    );
    expect(svg).toContain('stop-color="#123456"'); // custom tab paint
  });

  it("macDerivedTabColor seeds a plausible tab hex from the folder color", () => {
    expect(macDerivedTabColor(doc({ baseShape: "macos", folderColor: "#3388ff" }))).toMatch(
      /^#[0-9a-f]{6}$/,
    );
  });

  it("isFrontImage is true only for windows/macos + image + front", () => {
    const base = { folderFillMode: "image" as const };
    expect(isFrontImage(doc({ ...base, baseShape: "macos", macImageMode: "front" }))).toBe(true);
    expect(isFrontImage(doc({ ...base, baseShape: "macos", macImageMode: "full" }))).toBe(false);
    expect(isFrontImage(doc({ ...base, baseShape: "windows", windowsImageMode: "front" }))).toBe(true);
    expect(isFrontImage(doc({ baseShape: "macos", folderFillMode: "color", macImageMode: "front" }))).toBe(
      false,
    );
  });

  it("getFrontMask returns the front panel per shape", () => {
    expect(getFrontMask("macos")).toContain("M10.5 93.3"); // MAC_B
    expect(getFrontMask("windows")).toContain("fill=\"white\"");
  });

  it("buildFrontImageBackSvg paints the macOS tab from the image color (custom back overrides)", () => {
    const auto = buildFrontImageBackSvg("macos", "#0098a5");
    expect(auto).toContain('id="mgt"');
    // Back layer is the full macOS silhouette (MAC_F) filled with the tab paint.
    expect(auto).toContain('fill="url(#mgt)"');
    expect(auto).toContain('d="M39.3 228.5'); // MAC_F path
    const custom = buildFrontImageBackSvg("macos", "#0098a5", "#654321");
    expect(custom).toContain('stop-color="#654321"');
  });

  it("mutes the macOS front-image tab (photo dominant) instead of the vivid solid-fill tab", () => {
    // Deriving from a saturated photo blue must land a restrained tab (Windows
    // register), not the boosted solid-color palette that turns it electric.
    const svg = buildFrontImageBackSvg("macos", "#2b3fd0");
    const stop = svg.match(/id="mgt"[\s\S]*?stop-color="(#[0-9a-f]{6})"/);
    expect(stop).not.toBeNull();
    const [, sat] = hexToHsv(stop![1]);
    expect(sat).toBeLessThan(0.55);
  });

  it("buildFrontImageOverlaySvg gives the macOS rim/shadow structure, windows the shine", () => {
    expect(buildFrontImageOverlaySvg("macos")).toContain("fill-opacity");
    expect(buildFrontImageOverlaySvg("windows")).toContain('stroke="url(#wsh)"');
  });
});

describe("front-only image adaptive gradient tab (Smart Auto)", () => {
  it("windows: two distinct dominants derive a gradient tab; one dominant stays single", () => {
    const grad = buildWindowsImageBackSvg("#d81e1e", null, "#1e4dd8");
    expect(grad).toContain('id="wtg"'); // angle-gradient custom-tab path
    const single = buildWindowsImageBackSvg("#d81e1e", null, null);
    expect(single).not.toContain('id="wtg"');
  });

  it("macos: two distinct dominants derive a gradient tab distinct from the single tab", () => {
    const grad = buildFrontImageBackSvg("macos", "#d81e1e", null, "#1e4dd8");
    const single = buildFrontImageBackSvg("macos", "#d81e1e", null, null);
    expect(grad).not.toBe(single);
    expect(grad).toContain('id="mgt"');
  });

  it("a custom back color still overrides the auto gradient (both shapes)", () => {
    // Windows solid custom back → painted verbatim, not the two-dominant gradient.
    const win = buildWindowsImageBackSvg("#d81e1e", "#333333", "#1e4dd8");
    expect(win).not.toContain('id="wtg"');
    expect(win).toContain("#333333");
    // macOS custom back overrides the auto gradient too.
    const macCustom = buildFrontImageBackSvg("macos", "#d81e1e", "#333333", "#1e4dd8");
    const macAuto = buildFrontImageBackSvg("macos", "#d81e1e", null, "#1e4dd8");
    expect(macCustom).not.toBe(macAuto);
    expect(macCustom).toContain('stop-color="#333333"');
  });
});

describe("BASE_SHAPES ordering", () => {
  it("lists the solid-treatment shapes first", () => {
    expect(BASE_SHAPES[0].id).toBe("windows");
    expect(BASE_SHAPES.map((s) => s.id)).toContain("macos");
    // Temporarily trimmed to the two focus bases.
    expect(BASE_SHAPES.map((s) => s.id)).toEqual(["windows", "macos"]);
  });
});
