/**
 * Minimal ICO encoder: one or more 32bpp BGRA BMPs wrapped in an ICONDIR.
 * Ported from the legacy hand-rolled encoder (public/legacy.html L970-975) and
 * generalized to a multi-resolution container (EXP: Phase-8 roadmap item 2).
 *
 * `pixels` is RGBA canvas image data (top-to-bottom); ICO stores BGRA rows
 * bottom-to-top, which this handles.
 *
 * Each DIB doubles its declared height to carry a XOR colour bitmap plus a 1bpp
 * AND (transparency) mask. That mask is actually written — all-zero (fully
 * opaque; real transparency comes from the 32bpp alpha channel) with each row
 * padded to a 32-bit boundary — and counted in the resource/image sizes, so
 * strict parsers accept the file (EXP-09).
 */

/** One resolution to pack into a (possibly multi-size) ICO. */
export interface IcoImage {
  size: number;
  pixels: Uint8ClampedArray;
}

/** Encode one resolution's DIB (BITMAPINFOHEADER + XOR colour + AND mask). */
function encodeDib(pixels: Uint8ClampedArray, size: number): Uint8Array {
  const xorSize = size * size * 4;
  // AND mask: 1 bit per pixel, each row padded up to a 4-byte boundary.
  const maskStride = Math.ceil(size / 8 / 4) * 4;
  const maskSize = maskStride * size;
  const bmpSize = 40 + xorSize + maskSize;
  const buf = new ArrayBuffer(bmpSize);
  const dv = new DataView(buf);

  // BITMAPINFOHEADER
  dv.setUint32(0, 40, true); // header size
  dv.setInt32(4, size, true); // width
  dv.setInt32(8, size * 2, true); // height (doubled: XOR + AND masks)
  dv.setUint16(12, 1, true); // planes
  dv.setUint16(14, 32, true); // bpp
  dv.setUint32(16, 0, true); // compression (BI_RGB)
  dv.setUint32(20, xorSize + maskSize, true); // image size (XOR + AND)

  // XOR colour data: bottom-up rows, BGRA.
  let o = 40;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      dv.setUint8(o, pixels[si + 2]); // B
      dv.setUint8(o + 1, pixels[si + 1]); // G
      dv.setUint8(o + 2, pixels[si]); // R
      dv.setUint8(o + 3, pixels[si + 3]); // A
      o += 4;
    }
  }
  // AND mask follows: `maskSize` bytes, already zero-initialized (0 = "use the
  // colour pixel", i.e. fully opaque). No writes needed.
  return new Uint8Array(buf);
}

/** Pack one or more resolutions into a single multi-size ICO container. */
export function encodeIcoMulti(images: IcoImage[]): ArrayBuffer {
  const sorted = [...images].sort((a, b) => a.size - b.size);
  const dibs = sorted.map((im) => encodeDib(im.pixels, im.size));
  const n = sorted.length;
  const dirSize = 6 + 16 * n; // ICONDIR + N × ICONDIRENTRY
  const total = dirSize + dibs.reduce((s, d) => s + d.length, 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // ICONDIR
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: 1 = icon
  dv.setUint16(4, n, true); // image count

  let offset = dirSize;
  sorted.forEach((im, i) => {
    const e = 6 + i * 16; // this ICONDIRENTRY
    const size = im.size;
    dv.setUint8(e, size >= 256 ? 0 : size); // width (0 means 256)
    dv.setUint8(e + 1, size >= 256 ? 0 : size); // height
    dv.setUint8(e + 2, 0); // color count
    dv.setUint8(e + 3, 0); // reserved
    dv.setUint16(e + 4, 1, true); // color planes
    dv.setUint16(e + 6, 32, true); // bits per pixel
    dv.setUint32(e + 8, dibs[i].length, true); // bytes in resource (incl. AND mask)
    dv.setUint32(e + 12, offset, true); // offset to this image's data
    bytes.set(dibs[i], offset);
    offset += dibs[i].length;
  });
  return buf;
}

/** Encode a single-resolution ICO (thin wrapper over {@link encodeIcoMulti}). */
export function encodeIco(pixels: Uint8ClampedArray, size: number): ArrayBuffer {
  return encodeIcoMulti([{ size, pixels }]);
}
