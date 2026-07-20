/**
 * Pattern panel: a searchable 3-column pattern grid, and an adjust view
 * (opacity/scale/rotation, seeded randomize for scatter patterns, foreground +
 * background colors). Clicking the active pattern again opens adjust, matching
 * the legacy flow. Previews render each tile via the same `buildPatternSvg`
 * the workspace/export use.
 */

import { useState } from "react";
import { Dices, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { SEEDED_IDS, PATTERNS, buildPatternSvg } from "@/lib/export/patterns";
import { toSvgDataUrl } from "@/lib/export/svgDataUrl";
import { useDocumentStore } from "@/store/documentStore";
import type { PatternSettings } from "@/types/document";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

const randomSeed = () => Math.floor(Math.random() * 0xffffffff) || 1;

function tileBackground(settings: PatternSettings): string | undefined {
  const svg = buildPatternSvg(settings);
  return svg ? `url("${toSvgDataUrl(svg)}")` : undefined;
}

function PreviewTile({
  settings,
  className,
}: {
  settings: PatternSettings;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border bg-muted/40", className)}
      style={{
        backgroundImage: tileBackground(settings),
        backgroundColor: settings.bg !== "transparent" ? settings.bg : undefined,
      }}
    />
  );
}

export function PatternPanel() {
  const pattern = useDocumentStore((s) => s.doc.pattern);
  const setPattern = useDocumentStore((s) => s.setPattern);
  const [view, setView] = useState<"grid" | "adjust">("grid");
  const [search, setSearch] = useState("");

  const canRandomize = SEEDED_IDS.includes(pattern.id);

  if (view === "adjust" && pattern.id !== "none") {
    return (
      <div>
        <PanelHeader title="Adjust Pattern" onBack={() => setView("grid")} />
        <div className="space-y-4 p-3">
          <PreviewTile settings={pattern} className="h-24 w-full" />
          <SliderField
            label="Opacity"
            value={pattern.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => setPattern({ opacity: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderField
            label="Scale"
            value={pattern.scale}
            min={0.5}
            max={6}
            step={0.25}
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

          {canRandomize && (
            <PanelSection title="Scatter">
              <div className="flex gap-1.5">
                <Button
                  variant={pattern.seed ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={() => setPattern({ seed: pattern.seed ? 0 : randomSeed() })}
                >
                  <Dices className="size-3" />
                  {pattern.seed ? "Randomized" : "Randomize"}
                </Button>
                {pattern.seed !== 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    aria-label="Reroll random layout"
                    onClick={() => setPattern({ seed: randomSeed() })}
                  >
                    <RefreshCw className="size-3" />
                  </Button>
                )}
              </div>
            </PanelSection>
          )}

          <PanelSection title="Colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ColorField
                  value={pattern.color}
                  onChange={(v) => {
                    if (typeof v === "string") setPattern({ color: v });
                  }}
                  ariaLabel="Pattern color"
                />
                <span className="text-xs text-muted-foreground">Pattern</span>
              </div>
              <div className="flex items-center gap-2">
                {pattern.bg === "transparent" ? (
                  <button
                    type="button"
                    aria-label="Pattern background (transparent)"
                    className="size-7 shrink-0 rounded-md border shadow-sm [background:repeating-conic-gradient(#8883_0%_25%,transparent_0%_50%)_0_0/8px_8px]"
                    onClick={() => setPattern({ bg: "#000000" })}
                  />
                ) : (
                  <ColorField
                    value={pattern.bg}
                    onChange={(v) => {
                      if (typeof v === "string") setPattern({ bg: v });
                    }}
                    ariaLabel="Pattern background color"
                  />
                )}
                <span className="text-xs text-muted-foreground">Background</span>
              </div>
              {pattern.bg !== "transparent" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setPattern({ bg: "transparent" })}
                >
                  Clear
                </Button>
              )}
            </div>
          </PanelSection>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = PATTERNS.filter((t) => !q || t.name.toLowerCase().includes(q));

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
          {shown.map((t) => {
            const active = pattern.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.name}
                onClick={() => {
                  if (active && t.id !== "none") setView("adjust");
                  else setPattern({ id: t.id });
                }}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border p-1 transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent bg-muted/40 hover:border-border hover:bg-muted",
                )}
              >
                {t.svg ? (
                  <div
                    className="w-full flex-1 rounded"
                    style={{
                      backgroundImage: `url("${toSvgDataUrl(t.svg("#9a9a9a", "transparent"))}")`,
                    }}
                  />
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
                  {t.name}
                </span>
              </button>
            );
          })}
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
      </div>
    </div>
  );
}
