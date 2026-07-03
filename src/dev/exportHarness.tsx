/**
 * Dev-only harness for the Phase-3 canvas/export engine. Reached at
 * `?harness=export` (wired in main.tsx). jsdom can't rasterize SVG, so this is
 * how the orchestrator is verified — in a real browser (Chrome MCP): it builds a
 * sample document exercising every element type + base shape + texture + clip,
 * renders it via `buildExportCanvas`, and offers PNG/SVG/ICO/ZIP downloads.
 *
 * Icon bodies are stubbed inline (no Iconify network dependency — that's Phase 6).
 * This file ships only in dev builds and is removed/ignored at the Phase-4 UI cutover.
 */

import { useEffect, useRef, useState } from "react";
import { createEmptyDocument } from "@/types/document";
import type { FolderDocument } from "@/types/document";
import type { Gradient } from "@/types/gradient";
import {
  createDrawElement,
  createIconElement,
  createImageElement,
  createShapeElement,
  createTextElement,
} from "@/lib/elementFactories";
import { buildExportCanvas } from "@/lib/export/renderCanvas";
import type { RenderDeps } from "@/lib/export/renderCanvas";
import type { IconBody } from "@/lib/export/elementSvg";
import {
  batchExportZip,
  downloadBlob,
  exportIco,
  exportPng,
  exportSvg,
} from "@/lib/export/exporters";

/** A five-point star that honors `currentColor`, standing in for an Iconify body. */
const STUB_ICON_BODY: IconBody = {
  width: 256,
  height: 256,
  body: '<path fill="currentColor" d="M128 24l30 62 68 10-49 48 12 68-61-32-61 32 12-68-49-48 68-10z"/>',
};

const stubDeps: RenderDeps = {
  getIconBody: () => STUB_ICON_BODY,
};

const fillGradient: Gradient = {
  kind: "linear",
  angle: 45,
  stops: [
    { id: "a", pos: 0, hue: 190, sat: 0.9, bri: 0.95 },
    { id: "b", pos: 1, hue: 320, sat: 0.85, bri: 0.9 },
  ],
};

const baseGradient: Gradient = {
  kind: "linear",
  angle: 180,
  stops: [
    { id: "a", pos: 0, hue: 45, sat: 0.9, bri: 0.98 },
    { id: "b", pos: 1, hue: 25, sat: 0.95, bri: 0.85 },
  ],
};

/** A tiny inline image (data URL) so the image element needs no network. */
const SAMPLE_IMAGE_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" rx="12" fill="#4ecdc4"/><circle cx="60" cy="40" r="24" fill="#12151a"/></svg>',
  );

function buildSampleDocument(): FolderDocument {
  const doc = createEmptyDocument();
  doc.baseShape = "windows";
  doc.folderColor = baseGradient;
  doc.clipToFolder = true;
  doc.texture = { ...doc.texture, id: "dots", color: "#ffffff", opacity: 0.4, scale: 1, seed: 7 };

  const shape = createShapeElement("star", "Star");
  shape.x = 10;
  shape.y = 10;
  shape.width = 90;
  shape.height = 90;
  shape.fill = { color: fillGradient, enabled: true };
  shape.stroke = { color: "#12151a", enabled: true, width: 3, position: "outside" };

  const icon = createIconElement({
    iconName: "star",
    iconVariant: "regular",
    iconCacheKey: "stub:star",
    color: "#ffd166",
  });
  icon.x = 150;
  icon.y = 20;

  const text = createTextElement("Label");
  text.text = "Folder";
  text.x = 60;
  text.y = 130;
  text.width = 180;
  text.fontSize = 28;
  text.color = "#12151a";
  text.underline = true;

  const draw = createDrawElement({
    x: 30,
    y: 90,
    width: 120,
    height: 60,
    origWidth: 120,
    origHeight: 60,
    svgPath: "M0 50 Q30 0 60 30 T120 10",
    strokeColor: "#ff6b6b",
    strokeSize: 6,
    linecap: "round",
  });

  const image = createImageElement(SAMPLE_IMAGE_SRC, 120, 80, "Image");
  image.x = 160;
  image.y = 120;

  doc.elements = [shape, image, draw, text, icon];
  doc.textureLayerZ = 2; // texture sits above shape+image, below draw/text/icon
  return doc;
}

const SIZES = [64, 128, 256, 512] as const;

export function ExportHarness() {
  const [size, setSize] = useState<number>(256);
  const [status, setStatus] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<FolderDocument>(buildSampleDocument());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus("Rendering…");
      const canvas = await buildExportCanvas(docRef.current, size, stubDeps);
      if (cancelled) return;
      canvas.style.width = "256px";
      canvas.style.height = "256px";
      canvas.style.imageRendering = "pixelated";
      canvas.style.border = "1px solid #333";
      canvas.style.background =
        "repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 / 20px 20px";
      const el = containerRef.current;
      if (el) {
        el.replaceChildren(canvas);
      }
      setStatus(`Rendered ${size}×${size}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [size]);

  const doc = docRef.current;

  async function run(label: string, fn: () => Promise<void>) {
    try {
      setStatus(`${label}…`);
      await fn();
      setStatus(`${label} ✓`);
    } catch (err) {
      setStatus(`${label} failed: ${String(err)}`);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#e5e5e5", background: "#12151a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Export Harness</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        Phase-3 canvas/export verification. Every element type, gradient base shape,
        seeded texture, and clip-to-folder are exercised below.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <span>Size:</span>
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #444",
              background: s === size ? "#4ecdc4" : "transparent",
              color: s === size ? "#12151a" : "#e5e5e5",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div ref={containerRef} style={{ marginBottom: 16 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => void run("PNG", async () => downloadBlob(await exportPng(doc, size, stubDeps), `harness-${size}.png`))}>
          Download PNG
        </button>
        <button onClick={() => void run("SVG", async () => downloadBlob(await exportSvg(doc, size, stubDeps), `harness-${size}.svg`))}>
          Download SVG
        </button>
        <button onClick={() => void run("ICO", async () => downloadBlob(await exportIco(doc, size, stubDeps), `harness-${size}.ico`))}>
          Download ICO
        </button>
        <button
          onClick={() =>
            void run("ZIP", async () =>
              downloadBlob(
                await batchExportZip(doc, [64, 128, 256, 512], ["png", "svg", "ico"], stubDeps),
                "harness-batch.zip",
              ),
            )
          }
        >
          Download batch ZIP
        </button>
      </div>

      <p style={{ fontSize: 13, opacity: 0.8 }}>{status}</p>
    </div>
  );
}
