import { describe, expect, it } from "vitest";
import { sanitizeSvgSource, svgTextToFile } from "@/lib/pasteImage";

const svg = (inner: string, attrs = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe("sanitizeSvgSource", () => {
  it("accepts SVG source with an xml prolog, comments or a doctype first", () => {
    expect(sanitizeSvgSource(svg("<rect/>"))).toContain("<svg");
    expect(sanitizeSvgSource(`<?xml version="1.0"?>${svg("<rect/>")}`)).toContain("<svg");
    expect(sanitizeSvgSource(`<!-- svgl.app -->\n${svg("<rect/>")}`)).toContain("<svg");
  });

  it("rejects anything that isn't really an SVG", () => {
    expect(sanitizeSvgSource("https://example.com/logo.svg")).toBeNull();
    expect(sanitizeSvgSource("<div>hello</div>")).toBeNull();
    expect(sanitizeSvgSource("just some copied text")).toBeNull();
    expect(sanitizeSvgSource("")).toBeNull();
    // Well-formed prefix but broken markup: the parser must catch it.
    expect(sanitizeSvgSource("<svg><rect></svg>")).toBeNull();
  });

  it("strips scripts, event handlers and remote references", () => {
    const dirty = sanitizeSvgSource(
      svg(
        `<script>alert(1)</script>` +
          `<rect onload="alert(2)" onclick="alert(3)" fill="red"/>` +
          `<image href="https://evil.test/pixel.png"/>` +
          `<use xlink:href="https://evil.test/x.svg#a"/>` +
          `<rect fill="url(//evil.test/p.svg#g)"/>`,
        'viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"',
      ),
    );
    expect(dirty).not.toContain("script");
    expect(dirty).not.toContain("onload");
    expect(dirty).not.toContain("onclick");
    expect(dirty).not.toContain("evil.test");
    // Legitimate content survives.
    expect(dirty).toContain('fill="red"');
  });

  it("keeps same-document and inline references", () => {
    const clean = sanitizeSvgSource(
      svg(`<use href="#star"/><rect fill="url(#grad)"/>`),
    );
    expect(clean).toContain('href="#star"');
    expect(clean).toContain("url(#grad)");
  });

  it("fills in intrinsic size from the viewBox when width/height are missing", () => {
    // Icon sets commonly ship a viewBox only; without a real width/height the
    // importer decodes it at the browser default and pastes the wrong aspect.
    const out = sanitizeSvgSource(svg("<rect/>", 'viewBox="0 0 64 32"'));
    expect(out).toContain('width="64"');
    expect(out).toContain('height="32"');
  });

  it("fills in intrinsic size when width/height are percentages", () => {
    const out = sanitizeSvgSource(svg("<rect/>", 'viewBox="0 0 10 20" width="100%" height="100%"'));
    expect(out).toContain('width="10"');
    expect(out).toContain('height="20"');
  });

  it("leaves an explicit pixel size alone", () => {
    const out = sanitizeSvgSource(svg("<rect/>", 'viewBox="0 0 24 24" width="48" height="48"'));
    expect(out).toContain('width="48"');
    expect(out).toContain('height="48"');
  });
});

describe("svgTextToFile", () => {
  it("wraps valid source as an image/svg+xml File", () => {
    const file = svgTextToFile(svg("<rect/>"));
    expect(file).not.toBeNull();
    expect(file?.type).toBe("image/svg+xml");
  });

  it("returns null for non-SVG text so a normal text paste isn't hijacked", () => {
    expect(svgTextToFile("hello world")).toBeNull();
  });
});
