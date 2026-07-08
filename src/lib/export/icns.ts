/**
 * Minimal Apple Icon Image (.icns) encoder. Modern macOS (10.7+) reads PNG data
 * for the sized icon OSTypes, so we pack one PNG per size behind the right type
 * code — no legacy RLE/ARGB paths needed.
 *
 * Container layout: 'icns' magic + big-endian total length, then a run of
 * entries, each `[4-byte OSType][4-byte big-endian length incl. the 8-byte
 * header][PNG bytes]`.
 */

/** PNG-capable OSType per icon edge size (the standard iconset sizes). */
const ICNS_TYPE_BY_SIZE: Record<number, string> = {
  16: "icp4",
  32: "icp5",
  64: "icp6",
  128: "ic07",
  256: "ic08",
  512: "ic09",
  1024: "ic10",
};

/** Sizes we know how to pack, largest last. */
export const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024];

/** True when `size` maps to a known .icns OSType. */
export function isIcnsSize(size: number): boolean {
  return size in ICNS_TYPE_BY_SIZE;
}

export interface IcnsImage {
  size: number;
  /** Encoded PNG bytes for this resolution. */
  png: Uint8Array;
}

/** Pack one PNG per size into a single .icns container. */
export function encodeIcns(images: IcnsImage[]): ArrayBuffer {
  const entries = images
    .filter((im) => ICNS_TYPE_BY_SIZE[im.size])
    .map((im) => ({ type: ICNS_TYPE_BY_SIZE[im.size], png: im.png }));

  const bodyLen = entries.reduce((sum, e) => sum + 8 + e.png.length, 0);
  const total = 8 + bodyLen;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Magic "icns" + big-endian total file length.
  bytes[0] = 0x69; // i
  bytes[1] = 0x63; // c
  bytes[2] = 0x6e; // n
  bytes[3] = 0x73; // s
  dv.setUint32(4, total, false);

  let off = 8;
  for (const e of entries) {
    for (let i = 0; i < 4; i++) bytes[off + i] = e.type.charCodeAt(i);
    dv.setUint32(off + 4, 8 + e.png.length, false); // entry length incl. header
    bytes.set(e.png, off + 8);
    off += 8 + e.png.length;
  }
  return buf;
}
