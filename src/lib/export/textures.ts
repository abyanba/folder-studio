/**
 * Texture pattern generators, ported verbatim from docs/index.html L350-383,
 * plus the seeded randomizer for the scatter patterns (L868-884).
 *
 * Each generator returns a small tileable SVG string that the canvas
 * orchestrator rasterizes and repeats as a pattern.
 */

import type { TextureSettings } from "@/types/document";

export interface TextureDef {
  id: string;
  name: string;
  svg?: (color: string, bg: string) => string;
}

export const TEXTURES: TextureDef[] = [
  { id: "none", name: "None" },
  { id: "dots", name: "Polka Dots", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${b}"/><circle cx="8" cy="8" r="3" fill="${c}"/></svg>` },
  { id: "dots-sm", name: "Mini Dots", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${b}"/><circle cx="4" cy="4" r="1.5" fill="${c}"/></svg>` },
  { id: "polka-lg", name: "Large Dots", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="${b}"/><circle cx="14" cy="14" r="7" fill="${c}"/></svg>` },
  { id: "rain", name: "Rain", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="18"><rect width="12" height="18" fill="${b}"/><circle cx="3" cy="3" r="1.5" fill="${c}"/><circle cx="9" cy="12" r="1.5" fill="${c}"/></svg>` },
  { id: "h-stripes", name: "H Stripes", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${b}"/><line x1="0" y1="5" x2="10" y2="5" stroke="${c}" stroke-width="2"/></svg>` },
  { id: "v-stripes", name: "V Stripes", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${b}"/><line x1="5" y1="0" x2="5" y2="10" stroke="${c}" stroke-width="2"/></svg>` },
  { id: "d-stripes", name: "Diagonal /", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${b}"/><line x1="0" y1="10" x2="10" y2="0" stroke="${c}" stroke-width="1.5"/></svg>` },
  { id: "d-stripes2", name: "Diagonal \\", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${b}"/><line x1="0" y1="0" x2="10" y2="10" stroke="${c}" stroke-width="1.5"/></svg>` },
  { id: "dash-h", name: "Dashes", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="16" height="8" fill="${b}"/><line x1="2" y1="4" x2="10" y2="4" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  { id: "herringbone", name: "Herringbone", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="16" height="8" fill="${b}"/><path d="M0 4L4 0L8 4L12 0L16 4" stroke="${c}" stroke-width="1.2" fill="none"/><path d="M0 8L4 4L8 8L12 4L16 8" stroke="${c}" stroke-width="1.2" fill="none"/></svg>` },
  { id: "zigzag", name: "Zigzag", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="8"><rect width="20" height="8" fill="${b}"/><path d="M0 6L5 2L10 6L15 2L20 6" stroke="${c}" stroke-width="1.5" fill="none"/></svg>` },
  { id: "zigzag-wide", name: "Wide Zigzag", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="12"><rect width="30" height="12" fill="${b}"/><path d="M0 9L7.5 3L15 9L22.5 3L30 9" stroke="${c}" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>` },
  { id: "chevron", name: "Chevron", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="12"><rect width="20" height="12" fill="${b}"/><path d="M0 12L10 0L20 12" stroke="${c}" stroke-width="1.5" fill="none"/></svg>` },
  { id: "waves", name: "Waves", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="${b}"/><path d="M0 5Q5 0 10 5T20 5" stroke="${c}" stroke-width="1.5" fill="none"/></svg>` },
  { id: "topo", name: "Topography", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><rect width="30" height="20" fill="${b}"/><path d="M0 14Q5 8 10 10T20 8T30 12" stroke="${c}" stroke-width="0.9" fill="none"/><path d="M0 19Q7 13 12 15T22 13T30 17" stroke="${c}" stroke-width="0.9" fill="none"/></svg>` },
  { id: "grid-tex", name: "Grid", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="${b}"/><line x1="0" y1="6" x2="12" y2="6" stroke="${c}" stroke-width="1"/><line x1="6" y1="0" x2="6" y2="12" stroke="${c}" stroke-width="1"/></svg>` },
  { id: "graph", name: "Graph Paper", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><line x1="0" y1="5" x2="20" y2="5" stroke="${c}" stroke-width="0.4"/><line x1="0" y1="10" x2="20" y2="10" stroke="${c}" stroke-width="0.8"/><line x1="0" y1="15" x2="20" y2="15" stroke="${c}" stroke-width="0.4"/><line x1="5" y1="0" x2="5" y2="20" stroke="${c}" stroke-width="0.4"/><line x1="10" y1="0" x2="10" y2="20" stroke="${c}" stroke-width="0.8"/><line x1="15" y1="0" x2="15" y2="20" stroke="${c}" stroke-width="0.4"/></svg>` },
  { id: "crosshatch", name: "Crosshatch", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${b}"/><line x1="0" y1="10" x2="10" y2="0" stroke="${c}" stroke-width="1"/><line x1="0" y1="0" x2="10" y2="10" stroke="${c}" stroke-width="1"/></svg>` },
  { id: "diamond", name: "Diamonds", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${b}"/><path d="M8 0L16 8L8 16L0 8Z" stroke="${c}" stroke-width="1" fill="none"/></svg>` },
  { id: "checker", name: "Checker", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><rect width="10" height="10" fill="${c}"/><rect x="10" y="10" width="10" height="10" fill="${c}"/></svg>` },
  { id: "brick", name: "Brick", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="${b}"/><rect x="0.5" y="0.5" width="19" height="9" fill="none" stroke="${c}" stroke-width="0.8"/><line x1="10" y1="0" x2="10" y2="5" stroke="${c}" stroke-width="0.8"/><line x1="0" y1="5" x2="20" y2="5" stroke="${c}" stroke-width="0.8"/></svg>` },
  { id: "plus", name: "Plus Signs", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${b}"/><path d="M8 3v10M3 8h10" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  { id: "circles", name: "Circle Rings", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><circle cx="10" cy="10" r="7" stroke="${c}" stroke-width="1" fill="none"/></svg>` },
  { id: "hexagons", name: "Hexagons", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15"><rect width="26" height="15" fill="${b}"/><polygon points="6.5,0.5 13,0.5 16.25,6.1 13,11.7 6.5,11.7 3.25,6.1" stroke="${c}" stroke-width="1" fill="none"/><polygon points="19.5,0.5 26,0.5 29.25,6.1 26,11.7 19.5,11.7 16.25,6.1" stroke="${c}" stroke-width="1" fill="none"/></svg>` },
  { id: "triangles", name: "Triangles", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="17"><rect width="20" height="17" fill="${b}"/><path d="M10 1L19 16H1z" stroke="${c}" stroke-width="1" fill="none"/></svg>` },
  { id: "stars", name: "Stars", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${b}"/><polygon points="12,2 14.2,9 21,9 15.5,13.5 17.6,20.5 12,16 6.4,20.5 8.5,13.5 3,9 9.8,9" stroke="${c}" stroke-width="1" stroke-linejoin="round" fill="none"/></svg>` },
  { id: "moroccan", name: "Moroccan", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><path d="M10 0L20 5V15L10 20L0 15V5Z" stroke="${c}" stroke-width="0.8" fill="none"/><path d="M10 4L16 7.5V13L10 16.5L4 13V7.5Z" stroke="${c}" stroke-width="0.8" fill="none"/></svg>` },
  { id: "scales", name: "Fish Scales", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="${b}"/><path d="M0 10a10 10 0 0 0 10-10A10 10 0 0 0 20 10" stroke="${c}" stroke-width="1" fill="none"/><path d="M-10 10a10 10 0 0 0 10-10A10 10 0 0 0 10 10" stroke="${c}" stroke-width="1" fill="none"/></svg>` },
  { id: "circuit", name: "Circuit", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><path d="M2 10h6M12 10h6M10 2v6M10 12v6" stroke="${c}" stroke-width="1"/><circle cx="10" cy="10" r="2" stroke="${c}" stroke-width="1" fill="none"/><circle cx="2" cy="10" r="1.2" fill="${c}"/><circle cx="18" cy="10" r="1.2" fill="${c}"/><circle cx="10" cy="2" r="1.2" fill="${c}"/><circle cx="10" cy="18" r="1.2" fill="${c}"/></svg>` },
  { id: "maze", name: "Maze", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${b}"/><path d="M0 4h8M8 4v8M8 12h8M4 0v8M12 8v8" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="square"/></svg>` },
  { id: "dot-dash", name: "Dot Dash", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"><rect width="16" height="8" fill="${b}"/><circle cx="3" cy="4" r="1.5" fill="${c}"/><line x1="7" y1="4" x2="14" y2="4" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  { id: "confetti", name: "Confetti", svg: (c, b = "transparent") => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${b}"/><rect x="3" y="2" width="3" height="1.5" rx="0.5" fill="${c}" transform="rotate(30 4.5 2.75)"/><rect x="13" y="11" width="3" height="1.5" rx="0.5" fill="${c}" transform="rotate(-20 14.5 11.75)"/><rect x="8" y="16" width="3" height="1.5" rx="0.5" fill="${c}" transform="rotate(60 9.5 16.75)"/></svg>` },
];

/** Scatter patterns that support the seeded randomizer. */
export const SEEDED_IDS = ["dots", "dots-sm", "polka-lg", "rain", "confetti", "stars", "circles"];

/**
 * Build the tile SVG for the given texture settings. Returns null for "none" or
 * an unknown id. When `seed` is set and the texture is a scatter pattern, a
 * deterministic randomized tile is generated (ported from `_getTextureSvg`).
 */
export function buildTextureSvg(settings: TextureSettings): string | null {
  if (settings.id === "none") return null;
  const def = TEXTURES.find((t) => t.id === settings.id);
  if (!def || !def.svg) return null;
  const color = settings.color;
  const bg = settings.bg || "transparent";

  if (!settings.seed || !SEEDED_IDS.includes(def.id)) {
    return def.svg(color, bg);
  }

  // Deterministic LCG so a given seed always yields the same tile.
  let sr = settings.seed;
  const rand = () => {
    sr = (sr * 1664525 + 1013904223) & 0xffffffff;
    return (sr >>> 0) / 4294967296;
  };
  const tw = 64;
  const th = 64;
  let shapes = "";
  if (def.id === "dots" || def.id === "dots-sm" || def.id === "polka-lg") {
    const maxR = def.id === "polka-lg" ? 9 : def.id === "dots" ? 4 : 2;
    const minR = maxR * 0.35;
    const n = def.id === "polka-lg" ? 5 : 10;
    for (let i = 0; i < n; i++) {
      const x = rand() * tw;
      const y = rand() * th;
      const r = minR + rand() * (maxR - minR);
      shapes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
    }
  } else if (def.id === "rain") {
    for (let i = 0; i < 14; i++) {
      const x = rand() * tw;
      const y = rand() * th;
      const r = 0.7 + rand() * 1.6;
      shapes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
    }
  } else if (def.id === "confetti") {
    for (let i = 0; i < 14; i++) {
      const x = rand() * tw;
      const y = rand() * th;
      const w2 = 1.5 + rand() * 4;
      const h2 = 0.8 + rand() * 2;
      const rot = Math.round(rand() * 360);
      shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w2.toFixed(1)}" height="${h2.toFixed(1)}" rx="0.4" fill="${color}" transform="rotate(${rot},${(x + w2 / 2).toFixed(1)},${(y + h2 / 2).toFixed(1)})"/>`;
    }
  } else if (def.id === "stars") {
    for (let i = 0; i < 5; i++) {
      const cx = rand() * tw;
      const cy = rand() * th;
      const r = 2 + rand() * 6;
      const ir = r * 0.38;
      let pts = "";
      for (let j = 0; j < 10; j++) {
        const a = (Math.PI / 5) * j - Math.PI / 2;
        const rr = j % 2 === 0 ? r : ir;
        pts += (pts ? "," : "") + (cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1);
      }
      shapes += `<polygon points="${pts}" fill="${color}"/>`;
    }
  } else if (def.id === "circles") {
    for (let i = 0; i < 7; i++) {
      const cx = rand() * tw;
      const cy = rand() * th;
      const r = 3 + rand() * 9;
      shapes += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke="${color}" stroke-width="1" fill="none"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"><rect width="${tw}" height="${th}" fill="${bg}"/>${shapes}</svg>`;
}
