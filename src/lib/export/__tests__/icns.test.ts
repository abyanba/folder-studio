// @vitest-environment node
import { describe, expect, it } from "vitest";
import { encodeIcns, isIcnsSize } from "@/lib/export/icns";

/** Read a big-endian uint32. */
function u32(bytes: Uint8Array, off: number): number {
  return (
    ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0
  );
}
const ascii = (bytes: Uint8Array, off: number, n: number) =>
  String.fromCharCode(...bytes.slice(off, off + n));

describe("encodeIcns", () => {
  const png16 = new Uint8Array([1, 2, 3, 4]);
  const png256 = new Uint8Array([9, 8, 7, 6, 5]);

  it("writes the icns magic, big-endian total length, and one typed entry per size", () => {
    const buf = encodeIcns([
      { size: 16, png: png16 },
      { size: 256, png: png256 },
    ]);
    const bytes = new Uint8Array(buf);

    expect(ascii(bytes, 0, 4)).toBe("icns");
    // total = 8 header + (8 + 4) + (8 + 5) = 33.
    expect(u32(bytes, 4)).toBe(33);
    expect(bytes.length).toBe(33);

    // First entry: icp4 (16px), length 12, then the 4 PNG bytes.
    expect(ascii(bytes, 8, 4)).toBe("icp4");
    expect(u32(bytes, 12)).toBe(12);
    expect(Array.from(bytes.slice(16, 20))).toEqual([1, 2, 3, 4]);

    // Second entry: ic08 (256px), length 13.
    expect(ascii(bytes, 20, 4)).toBe("ic08");
    expect(u32(bytes, 24)).toBe(13);
    expect(Array.from(bytes.slice(28, 33))).toEqual([9, 8, 7, 6, 5]);
  });

  it("drops sizes without a known OSType", () => {
    const buf = encodeIcns([
      { size: 100, png: new Uint8Array([1]) }, // no type → dropped
      { size: 32, png: new Uint8Array([2, 2]) },
    ]);
    const bytes = new Uint8Array(buf);
    // Only the 32px (icp5) entry survives: 8 + (8 + 2) = 18.
    expect(bytes.length).toBe(18);
    expect(ascii(bytes, 8, 4)).toBe("icp5");
  });

  it("recognizes the standard iconset sizes", () => {
    expect(isIcnsSize(16)).toBe(true);
    expect(isIcnsSize(512)).toBe(true);
    expect(isIcnsSize(100)).toBe(false);
  });
});
