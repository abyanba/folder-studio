import { describe, expect, it } from "vitest";
import { encodeIco } from "@/lib/export/ico";

/** Build a 2×2 RGBA buffer with distinct, easy-to-track channel values. */
function make2x2(): Uint8ClampedArray {
  // (x,y): (0,0),(1,0),(0,1),(1,1) — each [R,G,B,A]
  return new Uint8ClampedArray([
    10, 20, 30, 40, // (0,0)
    50, 60, 70, 80, // (1,0)
    90, 100, 110, 120, // (0,1)
    130, 140, 150, 160, // (1,1)
  ]);
}

describe("encodeIco", () => {
  it("produces a buffer of length 62 + w*h*4", () => {
    const buf = encodeIco(make2x2(), 2);
    expect(buf.byteLength).toBe(62 + 2 * 2 * 4); // 78
  });

  it("writes the ICONDIR / ICONDIRENTRY / BITMAPINFOHEADER fields", () => {
    const dv = new DataView(encodeIco(make2x2(), 2));
    // ICONDIR
    expect(dv.getUint16(0, true)).toBe(0); // reserved
    expect(dv.getUint16(2, true)).toBe(1); // type = icon
    expect(dv.getUint16(4, true)).toBe(1); // count
    // ICONDIRENTRY
    expect(dv.getUint8(6)).toBe(2); // width
    expect(dv.getUint8(7)).toBe(2); // height
    expect(dv.getUint16(12, true)).toBe(32); // bpp
    expect(dv.getUint32(14, true)).toBe(40 + 2 * 2 * 4); // bytes in resource
    expect(dv.getUint32(18, true)).toBe(22); // pixel-data offset
    // BITMAPINFOHEADER
    expect(dv.getUint32(22, true)).toBe(40); // header size
    expect(dv.getInt32(26, true)).toBe(2); // width
    expect(dv.getInt32(30, true)).toBe(4); // height doubled (XOR+AND)
    expect(dv.getUint16(36, true)).toBe(32); // bpp
    expect(dv.getUint32(38, true)).toBe(0); // BI_RGB
    expect(dv.getUint32(42, true)).toBe(2 * 2 * 4); // image size
  });

  it("stores rows bottom-up in BGRA order", () => {
    const dv = new DataView(encodeIco(make2x2(), 2));
    // First stored pixel is bottom-left = source (0,1) = R90,G100,B110,A120 → BGRA
    expect([dv.getUint8(62), dv.getUint8(63), dv.getUint8(64), dv.getUint8(65)]).toEqual([
      110, 100, 90, 120,
    ]);
    // Then (1,1) = R130,G140,B150,A160 → BGRA
    expect([dv.getUint8(66), dv.getUint8(67), dv.getUint8(68), dv.getUint8(69)]).toEqual([
      150, 140, 130, 160,
    ]);
    // Top row last: (0,0) = R10,G20,B30,A40 → BGRA
    expect([dv.getUint8(70), dv.getUint8(71), dv.getUint8(72), dv.getUint8(73)]).toEqual([
      30, 20, 10, 40,
    ]);
  });

  it("encodes width/height 0 for a 256px icon (0 means 256)", () => {
    const px = new Uint8ClampedArray(256 * 256 * 4);
    const dv = new DataView(encodeIco(px, 256));
    expect(dv.getUint8(6)).toBe(0);
    expect(dv.getUint8(7)).toBe(0);
    expect(dv.getInt32(26, true)).toBe(256);
    expect(dv.getInt32(30, true)).toBe(512);
  });
});
