/**
 * Minimal single-image ICO encoder: a 32bpp BGRA BMP wrapped in an ICONDIR.
 * Ported from the legacy hand-rolled encoder (docs/index.html L970-975).
 *
 * `pixels` is RGBA canvas image data (top-to-bottom); ICO stores BGRA rows
 * bottom-to-top, which this handles.
 */
export function encodeIco(pixels: Uint8ClampedArray, size: number): ArrayBuffer {
  const bmpSize = 40 + size * size * 4;
  const total = 6 + 16 + bmpSize; // ICONDIR + ICONDIRENTRY + DIB
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);

  // ICONDIR
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: 1 = icon
  dv.setUint16(4, 1, true); // image count

  // ICONDIRENTRY
  dv.setUint8(6, size >= 256 ? 0 : size); // width (0 means 256)
  dv.setUint8(7, size >= 256 ? 0 : size); // height
  dv.setUint8(8, 0); // color count
  dv.setUint8(9, 0); // reserved
  dv.setUint16(10, 1, true); // color planes
  dv.setUint16(12, 32, true); // bits per pixel
  dv.setUint32(14, bmpSize, true); // bytes in resource
  dv.setUint32(18, 22, true); // offset to image data (6 + 16)

  // BITMAPINFOHEADER
  dv.setUint32(22, 40, true); // header size
  dv.setInt32(26, size, true); // width
  dv.setInt32(30, size * 2, true); // height (doubled: XOR + AND masks)
  dv.setUint16(34, 1, true); // planes
  dv.setUint16(36, 32, true); // bpp
  dv.setUint32(38, 0, true); // compression (BI_RGB)
  dv.setUint32(42, size * size * 4, true); // image size

  // Pixel data: bottom-up rows, BGRA.
  let o = 62;
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
  return buf;
}
