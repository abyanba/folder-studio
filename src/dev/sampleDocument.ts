/**
 * A sample FolderDocument exercising every element type + gradient base shape +
 * seeded pattern + clip. Shared by the export harness (Phase 3) and the Phase-4
 * dev "seed sample" button so the workspace/interaction can be driven before the
 * real element-creation panels exist (Phase 5).
 */

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

export function buildSampleDocument(): FolderDocument {
  const doc = createEmptyDocument();
  doc.baseShape = "windows";
  doc.folderColor = baseGradient;
  doc.clipToFolder = true;

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
  doc.patternLayerZ = 2; // reserved pattern slot; nothing renders into it today
  return doc;
}
