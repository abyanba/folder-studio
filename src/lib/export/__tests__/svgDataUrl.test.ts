// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";

describe("toSvgDataUrl", () => {
  it("prefixes the SVG mime type and URI-encodes the body", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#ff0000"/></svg>';
    expect(toSvgDataUrl(svg)).toBe(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    );
  });

  it("escapes characters that would break a data URL (# and spaces)", () => {
    const url = toSvgDataUrl('<svg fill="#abc def"/>');
    expect(url).not.toContain("#abc");
    expect(url).toContain("%23abc");
    expect(url).not.toContain(" def");
  });
});
