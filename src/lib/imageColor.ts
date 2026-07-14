/**
 * Compute a representative (average) color of an image, used as the adaptive
 * tab/back color when a Windows folder shows an image on its front panel only.
 * Browser-only (canvas pixel sampling); resolves to a neutral gray on failure.
 */

const FALLBACK = "#888888";

/** Two dominant colors are "distinct" (→ gradient tab) past this RGB distance. */
const DISTINCT_RGB_DIST = 70;

const toHex = (r: number, g: number, b: number): string => {
  const h = (x: number): string => Math.round(x).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
};

/**
 * The image's dominant color plus, when the image is colorful enough, a distinct
 * secondary — so a front-only image folder can echo it with a gradient tab
 * instead of a muddy single average. Coarse RGB quantization (3 bits/channel);
 * `secondary` is null when the top two clusters are too close to matter.
 * Browser-only; resolves to `{ primary: FALLBACK, secondary: null }` on failure.
 */
export async function dominantImageColors(
  src: string,
): Promise<{ primary: string; secondary: string | null }> {
  return new Promise((resolve) => {
    const done = (primary: string, secondary: string | null): void => resolve({ primary, secondary });
    const img = new Image();
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return done(FALLBACK, null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        // Accumulate per coarse bin: count + summed RGB (for a true mean color).
        const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 8) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); // 3 bits/channel
          const cur = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          cur.n++;
          cur.r += r;
          cur.g += g;
          cur.b += b;
          bins.set(key, cur);
        }
        const clusters = [...bins.values()]
          .map((c) => ({ n: c.n, r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }))
          .sort((a, b) => b.n - a.n);
        if (clusters.length === 0) return done(FALLBACK, null);
        const p = clusters[0];
        const primary = toHex(p.r, p.g, p.b);
        // First cluster far enough from the primary to read as a second color.
        const sec = clusters.find(
          (c) => Math.hypot(c.r - p.r, c.g - p.g, c.b - p.b) > DISTINCT_RGB_DIST,
        );
        return done(primary, sec ? toHex(sec.r, sec.g, sec.b) : null);
      } catch {
        return done(FALLBACK, null);
      }
    };
    img.onerror = () => done(FALLBACK, null);
    img.src = src;
  });
}

export async function averageImageColor(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(FALLBACK);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 8) continue; // skip near-transparent pixels
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (n === 0) return resolve(FALLBACK);
        const h = (x: number): string =>
          Math.round(x / n)
            .toString(16)
            .padStart(2, "0");
        resolve(`#${h(r)}${h(g)}${h(b)}`);
      } catch {
        // Tainted canvas (cross-origin) or no pixel access.
        resolve(FALLBACK);
      }
    };
    img.onerror = () => resolve(FALLBACK);
    img.src = src;
  });
}
