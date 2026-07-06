/**
 * Selection chrome: a bounding box around each selected element plus 8 resize
 * handles and a rotate handle on the primary selection. Rendered above the
 * elements in the content-rect stack. Ported from public/legacy.html L1216-1235.
 */

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { ResizeHandle } from "@/types/interaction";

export interface EffectiveRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Hidden elements get ghosted/dashed chrome (IN-04). */
  hidden?: boolean;
}

interface Props {
  selected: EffectiveRect[];
  primaryId: string | null;
  onResizeDown: (e: ReactPointerEvent, handle: ResizeHandle) => void;
  onRotateDown: (e: ReactPointerEvent) => void;
}

const ACCENT = "var(--primary)";
const HS = 8;
const ROTATE_OFFSET = -28;
const CORNERS: ResizeHandle[] = ["nw", "ne", "sw", "se"];
const EDGES: ResizeHandle[] = ["n", "s", "e", "w"];

function handleStyle(pos: ResizeHandle): CSSProperties {
  const st: CSSProperties = {
    position: "absolute",
    width: HS,
    height: HS,
    background: "#fff",
    border: `2px solid ${ACCENT}`,
    borderRadius: 2,
    pointerEvents: "auto",
    zIndex: 20,
  };
  if (pos.length === 2) {
    if (pos[0] === "n") st.top = -HS / 2;
    if (pos[0] === "s") st.bottom = -HS / 2;
    if (pos[1] === "w") st.left = -HS / 2;
    if (pos[1] === "e") st.right = -HS / 2;
    st.cursor = `${pos}-resize`;
  } else if (pos === "n" || pos === "s") {
    st[pos === "n" ? "top" : "bottom"] = -HS / 2;
    st.left = "50%";
    st.transform = "translateX(-50%)";
    st.cursor = "ns-resize";
  } else {
    st[pos === "e" ? "right" : "left"] = -HS / 2;
    st.top = "50%";
    st.transform = "translateY(-50%)";
    st.cursor = "ew-resize";
  }
  return st;
}

export function SelectionOverlay({ selected, primaryId, onResizeDown, onRotateDown }: Props) {
  return (
    <>
      {selected.map((el) => {
        const isPrimary = el.id === primaryId;
        return (
          <div
            key={`sel-${el.id}`}
            style={{
              position: "absolute",
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
              transform: `rotate(${el.rotation}deg)`,
              transformOrigin: "center",
              pointerEvents: "none",
              zIndex: 15,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -1,
                border: `1.5px ${el.hidden ? "dashed" : "solid"} ${ACCENT}`,
                borderRadius: 1,
                opacity: el.hidden ? 0.7 : 1,
                pointerEvents: "none",
              }}
            />
            {isPrimary &&
              [...CORNERS, ...EDGES].map((p) => (
                <div key={p} style={handleStyle(p)} onPointerDown={(e) => onResizeDown(e, p)} />
              ))}
            {isPrimary && (
              <>
                <div
                  style={{
                    position: "absolute",
                    top: ROTATE_OFFSET,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 1,
                    height: Math.abs(ROTATE_OFFSET),
                    background: ACCENT,
                    pointerEvents: "none",
                  }}
                />
                <div
                  onPointerDown={onRotateDown}
                  style={{
                    position: "absolute",
                    top: ROTATE_OFFSET - 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    border: `2px solid ${ACCENT}`,
                    cursor: "grab",
                    pointerEvents: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round">
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
