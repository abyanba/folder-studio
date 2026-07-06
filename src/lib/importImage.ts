/**
 * Upload pipeline (PF-08): downscale oversized images to a sane ceiling before
 * they enter the document, so a 20 MP phone photo doesn't become a ~27 MB data
 * URL that bloats every gallery save and export decode. 1024px is lossless for
 * every offered export size (export tops out at a 1024 canvas).
 *
 * The browser `importImageFile` is excluded from jsdom coverage (canvas raster);
 * the pure `fitWithin` math is unit-tested.
 */

export interface FitDimensions {
  width: number;
  height: number;
  scaled: boolean;
}

/** Largest width/height ≤ `maxDim` preserving aspect ratio; no upscaling. */
export function fitWithin(natW: number, natH: number, maxDim: number): FitDimensions {
  if (natW <= 0 || natH <= 0) return { width: natW, height: natH, scaled: false };
  const longest = Math.max(natW, natH);
  if (longest <= maxDim) return { width: natW, height: natH, scaled: false };
  const k = maxDim / longest;
  return { width: Math.round(natW * k), height: Math.round(natH * k), scaled: true };
}

export interface ImportedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** True when the source was downscaled (worth telling the user). */
  scaled: boolean;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    reader.onload = (e) => {
      const result = (e?.target as FileReader | undefined)?.result ?? reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error(`Couldn't read ${file.name}`));
    };
    reader.readAsDataURL(file);
  });
}

/** Intrinsic size, falling back to the width/height attributes for test stubs. */
function naturalSize(img: HTMLImageElement): { w: number; h: number } {
  return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unsupported or corrupt image"));
    img.src = src;
  });
}

/**
 * Read `file` to a data URL, downscaling to `maxDim` when larger. SVGs stay as
 * their vector data URL (small, lossless). Raster with alpha re-encodes as PNG,
 * otherwise JPEG q≈0.85.
 */
export async function importImageFile(file: File, maxDim = 1024): Promise<ImportedImage> {
  const dataUrl = await readAsDataUrl(file);
  if (file.type === "image/svg+xml") {
    const img = await decode(dataUrl).catch(() => null);
    const s = img ? naturalSize(img) : { w: 0, h: 0 };
    return { dataUrl, width: s.w, height: s.h, scaled: false };
  }

  const img = await decode(dataUrl);
  const { w: natW, h: natH } = naturalSize(img);
  const fit = fitWithin(natW, natH, maxDim);
  if (!fit.scaled) return { dataUrl, width: natW, height: natH, scaled: false };

  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl, width: natW, height: natH, scaled: false };
  ctx.drawImage(img, 0, 0, fit.width, fit.height);
  const hasAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  const out = hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  return { dataUrl: out, width: fit.width, height: fit.height, scaled: true };
}
