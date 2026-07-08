/**
 * Decorative editor backdrop (ported/improved from the legacy grid + glow): a
 * static 40px line grid, plus an accent-tinted grid layer revealed through a
 * soft radial mask that eases toward the cursor and fades in/out on
 * enter/leave. Purely a workspace-pane backdrop behind the folder — pointer
 * transparent and never part of the export.
 */

import { useEffect, useRef, useState } from "react";

const GLOW_RADIUS = 260;
const CELL = 40;

export function WorkspaceGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: -1, y: -1, o: 0 });

  useEffect(() => {
    const pane = ref.current?.parentElement;
    if (!pane) return;
    const target = { x: 0, y: 0, in: false };
    const cur = { x: 0, y: 0, o: 0 };

    const onMove = (e: MouseEvent) => {
      const r = pane.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      target.in = true;
    };
    const onLeave = () => {
      target.in = false;
    };
    pane.addEventListener("mousemove", onMove);
    pane.addEventListener("mouseleave", onLeave);

    let raf = 0;
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.12;
      cur.y += (target.y - cur.y) * 0.12;
      const tgtO = target.in ? 1 : 0;
      cur.o += (tgtO - cur.o) * (target.in ? 0.1 : 0.04);
      if (cur.o < 0.005 && !target.in) cur.o = 0;
      setGlow({ x: cur.x, y: cur.y, o: Number(cur.o.toFixed(3)) });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      pane.removeEventListener("mousemove", onMove);
      pane.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full text-foreground/[0.07]" aria-hidden>
        <defs>
          <pattern id="wsGrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wsGrid)" />
      </svg>
      <svg
        className="absolute inset-0 h-full w-full text-primary"
        style={{ opacity: glow.o }}
        aria-hidden
      >
        <defs>
          <radialGradient id="wsGlowMask" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="wsGlowCircle">
            <rect width="100%" height="100%" fill="black" />
            <rect
              x={glow.x - GLOW_RADIUS}
              y={glow.y - GLOW_RADIUS}
              width={GLOW_RADIUS * 2}
              height={GLOW_RADIUS * 2}
              rx={GLOW_RADIUS}
              fill="url(#wsGlowMask)"
            />
          </mask>
          <pattern id="wsGlowGrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="currentColor" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wsGlowGrid)" mask="url(#wsGlowCircle)" />
      </svg>
    </div>
  );
}
