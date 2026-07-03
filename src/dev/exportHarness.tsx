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
import type { FolderDocument } from "@/types/document";
import { buildExportCanvas } from "@/lib/export/renderCanvas";
import type { RenderDeps } from "@/lib/export/renderCanvas";
import { getIconBodyStub } from "@/lib/iconBodyStub";
import { buildSampleDocument } from "@/dev/sampleDocument";
import {
  batchExportZip,
  downloadBlob,
  exportIco,
  exportPng,
  exportSvg,
} from "@/lib/export/exporters";

const stubDeps: RenderDeps = {
  getIconBody: getIconBodyStub,
};

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
