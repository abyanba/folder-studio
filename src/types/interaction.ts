/**
 * Types for the canvas interaction state machine. These mirror the legacy
 * `drag.type` union. Phase 2 defines the types and the pure math that backs
 * them (see `src/lib/geometry.ts`); the event-wired `useInteraction` hook that
 * produces/consumes these lands in Phase 4 alongside the canvas.
 */

import type { FolderElement } from "./element";

export interface Point {
  x: number;
  y: number;
}

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type DragState =
  | {
      type: "move";
      sx: number;
      sy: number;
      el: FolderElement;
      movingEls: FolderElement[];
    }
  | { type: "resize"; handle: ResizeHandle; sx: number; sy: number; el: FolderElement }
  | { type: "rotate"; el: FolderElement }
  | { type: "drawing" }
  | { type: "erasing" }
  | { type: "shaping"; startX: number; startY: number }
  | { type: "marquee"; sx: number; sy: number; wsL: number; wsT: number }
  | { type: "gradStop"; stopId: string }
  | { type: "fpGradStop"; stopId: string }
  | {
      type: "imgCrop";
      sx: number;
      sy: number;
      startX: number;
      startY: number;
      w: number;
      h: number;
    }
  | { type: "layerSort"; fromId: string; overDropIdx: number | null };
