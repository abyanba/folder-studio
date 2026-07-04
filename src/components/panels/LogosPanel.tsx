/**
 * Logos panel: brand logos in mono (tinted simple-icons bodies) or full color
 * (the `logos` icon set, falling back to a brand-color-tinted mono body).
 * Mono logos are added as tintable icon elements (`iconVariant: "logo"`);
 * color logos become SVG-data-URL image elements, matching the legacy
 * `addLogoToCanvas`.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import {
  BRAND_COLORS,
  LOGO_CATEGORIES,
  LOGO_NAMES,
  logoDisplayName,
} from "@/data/logos";
import {
  getColorLogoBody,
  getIconBody,
  requestColorLogos,
  requestMonoLogos,
  useIconCacheVersion,
} from "@/lib/iconify";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

function logoSvgHtml(body: { body: string; width?: number; height?: number }, tint?: string): string {
  const vw = body.width ?? 24;
  const vh = body.height ?? 24;
  const inner = tint ? body.body.replace(/currentColor/g, tint) : body.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:100%;height:100%">${inner}</svg>`;
}

export function LogosPanel() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(LOGO_CATEGORIES[0]);
  const logoMode = useUiStore((s) => s.logoMode);
  const setLogoMode = useUiStore((s) => s.setLogoMode);
  const logoColor = useUiStore((s) => s.logoColor);
  const setLogoColor = useUiStore((s) => s.setLogoColor);
  const addIcon = useDocumentStore((s) => s.addIcon);
  const addImage = useDocumentStore((s) => s.addImage);
  const select = useSelectionStore((s) => s.select);
  useIconCacheVersion();

  const q = search.trim().toLowerCase();
  const names = useMemo(() => {
    if (q) {
      const all = [...new Set(Object.values(LOGO_NAMES).flat())];
      return all.filter((n) => n.includes(q) || logoDisplayName(n).toLowerCase().includes(q));
    }
    return LOGO_NAMES[category] ?? [];
  }, [q, category]);

  useEffect(() => {
    if (!names.length) return;
    // Color mode needs the mono bodies too, as the tinted fallback.
    void requestMonoLogos(names);
    if (logoMode === "color") void requestColorLogos(names);
  }, [names, logoMode]);

  const addLogo = (name: string) => {
    if (logoMode === "color") {
      const colorBody = getColorLogoBody(name);
      if (colorBody) {
        const vw = colorBody.width ?? 24;
        const vh = colorBody.height ?? 24;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">${colorBody.body}</svg>`;
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const id = addImage(src, vw, vh, logoDisplayName(name));
        select(id);
        return;
      }
      // Fallback: mono body tinted with the brand color.
      const id = addIcon({
        iconName: name,
        iconVariant: "logo",
        iconCacheKey: `logo:${name}`,
        color: BRAND_COLORS[name] ?? "#ffffff",
        name: logoDisplayName(name),
      });
      select(id);
      return;
    }
    const id = addIcon({
      iconName: name,
      iconVariant: "logo",
      iconCacheKey: `logo:${name}`,
      color: logoColor,
      name: logoDisplayName(name),
    });
    select(id);
  };

  return (
    <div>
      <PanelHeader title="Logos" />
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="flex-1"
            value={logoMode}
            onValueChange={(v) => {
              if (v) setLogoMode(v as "mono" | "color");
            }}
          >
            <ToggleGroupItem value="mono" className="flex-1 text-xs">
              Mono
            </ToggleGroupItem>
            <ToggleGroupItem value="color" className="flex-1 text-xs">
              Color
            </ToggleGroupItem>
          </ToggleGroup>
          {logoMode === "mono" && (
            <>
              <ColorField
                value={logoColor}
                onChange={(v) => {
                  if (typeof v === "string") setLogoColor(v);
                }}
                ariaLabel="Mono logo color"
              />
              {logoColor !== "#ffffff" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Reset mono logo color"
                  onClick={() => setLogoColor("#ffffff")}
                >
                  <RotateCcw className="size-3" />
                </Button>
              )}
            </>
          )}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logos…"
          className="h-7 px-2 text-xs"
          aria-label="Search logos"
        />

        {!q && (
          <div className="flex flex-wrap gap-1">
            {LOGO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                  cat === category
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {names.map((name) => {
            const colorBody = logoMode === "color" ? getColorLogoBody(name) : null;
            const monoBody = getIconBody(name, "logo");
            const body = colorBody ?? monoBody;
            const tint = colorBody
              ? undefined
              : logoMode === "color"
                ? (BRAND_COLORS[name] ?? "#ffffff")
                : logoColor;
            return (
              <button
                key={name}
                type="button"
                title={logoDisplayName(name)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-muted/40 p-2 transition-colors hover:border-border hover:bg-muted"
                onClick={() => addLogo(name)}
              >
                {body ? (
                  <div
                    className="size-7"
                    dangerouslySetInnerHTML={{ __html: logoSvgHtml(body, tint) }}
                  />
                ) : (
                  <div className="size-7 animate-pulse rounded bg-muted" />
                )}
                <span className="max-w-full truncate text-[9px] leading-tight text-muted-foreground">
                  {logoDisplayName(name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
