/**
 * Custom-SVG ingest: mono/color detection, currentColor normalization for the
 * tintable path, and rejection of non-SVG input.
 */

import { describe, expect, it } from "vitest";
import { ingestSvg } from "@/lib/customSvg";

describe("ingestSvg", () => {
  it("detects a single-color SVG as mono and forces currentColor", () => {
    const r = ingestSvg('<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h24v24H0z"/></svg>');
    expect(r).not.toBeNull();
    expect(r!.detected).toBe("mono");
    expect(r!.monoBody).toContain("currentColor");
    expect(r!.monoBody).not.toContain("#ff0000");
    expect(r!.width).toBe(24);
    expect(r!.height).toBe(24);
  });

  it("keeps an explicit currentColor SVG as mono and reads px dimensions", () => {
    const r = ingestSvg('<svg width="16" height="16"><path fill="currentColor" d="M0 0h1v1H0z"/></svg>');
    expect(r!.detected).toBe("mono");
    expect(r!.width).toBe(16);
  });

  it("detects a multi-color SVG as color and exposes a data-URL", () => {
    const r = ingestSvg(
      '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h12v24H0z"/><path fill="#0000ff" d="M12 0h12v24H12z"/></svg>',
    );
    expect(r!.detected).toBe("color");
    expect(r!.colorSrc.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("normalizes paint set via the style attribute", () => {
    const r = ingestSvg('<svg viewBox="0 0 24 24"><path style="fill:#00aa00" d="M0 0h24v24H0z"/></svg>');
    expect(r!.detected).toBe("mono");
    expect(r!.monoBody).toContain("currentColor");
    expect(r!.monoBody).not.toContain("#00aa00");
  });

  it("treats gradients as color", () => {
    const r = ingestSvg(
      '<svg viewBox="0 0 24 24"><defs><linearGradient id="g"><stop stop-color="#f00"/></linearGradient></defs><rect fill="url(#g)" width="24" height="24"/></svg>',
    );
    expect(r!.detected).toBe("color");
  });

  it("uses the viewBox (not width/height) as the coordinate box", () => {
    // Phosphor's non-raw copy: 68×68 display size, 256-unit coordinate space.
    const r = ingestSvg('<svg width="68" height="68" viewBox="0 0 256 256"><path fill="#000" d="M0 0h256v256H0z"/></svg>');
    expect(r!.width).toBe(256);
    expect(r!.height).toBe(256);
  });

  it("makes a fill-less shape tintable (default black → currentColor)", () => {
    // Phosphor "fill" raw / raw simple-icons: path with no fill defaults to black.
    const r = ingestSvg('<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>');
    expect(r!.detected).toBe("mono");
    expect(r!.monoBody).toContain('fill="currentColor"');
  });

  it("leaves an explicit fill=none alone", () => {
    const r = ingestSvg(
      '<svg viewBox="0 0 24 24"><rect fill="none" width="24" height="24"/><path fill="currentColor" d="M2 2h20v20H2z"/></svg>',
    );
    expect(r!.monoBody).toContain('fill="none"');
  });

  it("flattens a gradient body to currentColor when forced to mono (no defs left)", () => {
    const r = ingestSvg(
      '<svg viewBox="0 0 64 64"><defs><linearGradient id="g"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><path fill="url(#g)" d="M0 0h64v64H0z"/></svg>',
    );
    // Detection still flags it as color, but the tintable body must be usable.
    expect(r!.detected).toBe("color");
    expect(r!.monoBody).toContain("currentColor");
    expect(r!.monoBody).not.toContain("url(");
    expect(r!.monoBody).not.toContain("linearGradient");
  });

  it("returns null for non-SVG input", () => {
    expect(ingestSvg("hello, not an svg")).toBeNull();
  });
});
