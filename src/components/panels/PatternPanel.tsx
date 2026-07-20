/**
 * Pattern panel: a searchable grid of the baked Hero Patterns, and an adjust
 * view (foreground + background color and opacity, scale, rotation, and whether
 * the pattern spans the whole folder or just its front panel). Clicking the
 * active pattern again opens adjust, matching the legacy flow.
 *
 * Previews render through the same `buildPatternSvg` the workspace and both
 * export paths use, so the grid can't drift from the result.
 *
 * Hero Patterns © Steve Schoger, CC BY 4.0.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { PATTERN_CATALOG } from "@/data/patterns";
import { buildPatternSvg } from "@/lib/export/patterns";
import {
  getPatternBody,
  loadPatternBodies,
  patternBodiesVersion,
  subscribePatternBodies,
} from "@/lib/patternBodies";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { useDocumentStore } from "@/store/documentStore";
import type { PatternSettings, PatternSpan } from "@/types/document";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

/** Base shapes with a front/back split — the only ones where span is meaningful. */
const SPLIT_SHAPES = ["windows", "macos"];

function tileBackground(id: string, settings: PatternSettings): string | undefined {
  const body = getPatternBody(id);
  if (!body) return undefined;
  return `url("${toSvgDataUrl(buildPatternSvg({ ...settings, id }, body))}")`;
}

export function PatternPanel() {
  const pattern = useDocumentStore((s) => s.doc.pattern);
  const baseShape = useDocumentStore((s) => s.doc.baseShape);
  const setPattern = useDocumentStore((s) => s.setPattern);
  const [view, setView] = useState<"grid" | "adjust">("grid");
  const [search, setSearch] = useState("");

  // Previews need the lazy chunk; re-render once it lands.
  useSyncExternalStore(subscribePatternBodies, patternBodiesVersion);
  useEffect(() => {
    void loadPatternBodies();
  }, []);

  if (view === "adjust" && pattern.id !== "none") {
    return (
      <div>
        <PanelHeader title="Adjust Pattern" onBack={() => setView("grid")} />
        <div className="space-y-4 p-3">
          <div
            className="h-24 w-full rounded-lg border bg-muted/40"
            style={{
              backgroundImage: tileBackground(pattern.id, pattern),
              // The tile itself carries the background rect, so nothing to
              // paint behind it here.
            }}
          />

          <PanelSection title="Foreground">
            <div className="flex items-center gap-2">
              <ColorField
                value={pattern.fgColor}
                onChange={(v) => {
                  if (typeof v === "string") setPattern({ fgColor: v });
                }}
                ariaLabel="Pattern color"
              />
              <SliderField
                label="Opacity"
                className="flex-1"
                value={pattern.fgOpacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setPattern({ fgOpacity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </PanelSection>

          {/* No "clear" action: the background defaults to black at 0% and
              transparency is just the opacity slider, so there's no separate
              transparent state to enter or leave. */}
          <PanelSection title="Background">
            <div className="flex items-center gap-2">
              <ColorField
                value={pattern.bgColor}
                onChange={(v) => {
                  if (typeof v === "string") setPattern({ bgColor: v });
                }}
                ariaLabel="Pattern background color"
              />
              <SliderField
                label="Opacity"
                className="flex-1"
                value={pattern.bgOpacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setPattern({ bgOpacity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </PanelSection>

          <SliderField
            label="Scale"
            value={pattern.scale}
            min={0.25}
            max={4}
            step={0.05}
            onChange={(v) => setPattern({ scale: v })}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <SliderField
            label="Rotation"
            value={pattern.rotation}
            min={0}
            max={360}
            onChange={(v) => setPattern({ rotation: v })}
            format={(v) => `${v}°`}
          />

          {SPLIT_SHAPES.includes(baseShape) && (
            <PanelSection title="Pattern span">
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                className="w-full"
                value={pattern.span}
                onValueChange={(v) => {
                  if (v) setPattern({ span: v as PatternSpan });
                }}
              >
                <ToggleGroupItem value="full" className="h-7 flex-1 text-xs">
                  Whole folder
                </ToggleGroupItem>
                <ToggleGroupItem value="front" className="h-7 flex-1 text-xs">
                  Front only
                </ToggleGroupItem>
              </ToggleGroup>
            </PanelSection>
          )}
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = PATTERN_CATALOG.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <div>
      <PanelHeader title="Pattern" />
      <div className="space-y-3 p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patterns…"
          className="h-7 px-2 text-xs"
          aria-label="Search patterns"
          data-panel-search
        />
        <div className="grid grid-cols-3 gap-1.5">
          <PatternTile
            name="None"
            active={pattern.id === "none"}
            onClick={() => setPattern({ id: "none" })}
          />
          {shown.map((p) => (
            <PatternTile
              key={p.key}
              name={p.name}
              active={pattern.id === p.key}
              background={tileBackground(p.key, { ...pattern, fgColor: "#9a9a9a", fgOpacity: 1 })}
              onClick={() => {
                if (pattern.id === p.key) setView("adjust");
                else setPattern({ id: p.key });
              }}
            />
          ))}
        </div>
        {pattern.id !== "none" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => setView("adjust")}
          >
            <Settings2 className="size-3" /> Adjust pattern
          </Button>
        )}
        <p className="text-[10px] leading-snug text-muted-foreground">
          Patterns by{" "}
          <a
            href="https://heropatterns.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            Hero Patterns
          </a>{" "}
          © Steve Schoger, licensed{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            CC BY 4.0
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function PatternTile({
  name,
  active,
  background,
  onClick,
}: {
  name: string;
  active: boolean;
  background?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={name}
      onClick={onClick}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border p-1 transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-transparent bg-muted/40 hover:border-border hover:bg-muted",
      )}
    >
      {background ? (
        <div className="w-full flex-1 rounded" style={{ backgroundImage: background }} />
      ) : (
        <div className="flex w-full flex-1 items-center justify-center text-[10px] text-muted-foreground">
          Ø
        </div>
      )}
      <span
        className={cn(
          "max-w-full truncate text-[9px] leading-tight",
          active ? "font-semibold text-primary" : "text-muted-foreground",
        )}
      >
        {name}
      </span>
    </button>
  );
}
