/**
 * Logos panel: brand logos in mono (tinted simple-icons bodies) or full color
 * (the `logos` icon set, falling back to a brand-color-tinted mono body).
 * Mono logos are added as tintable icon elements (`iconVariant: "logo"`);
 * color logos become SVG-data-URL image elements tagged with `logoName`,
 * matching the legacy `addLogoToCanvas`.
 *
 * When a placed logo is selected the panel hosts the *same* editor the element
 * would normally get — the icon editor for mono logos, the image editor for
 * color logos — so a selected logo never yanks focus to the Icons/Image panel
 * (P1 routing fix).
 */

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import {
  BRAND_COLORS,
  LOGO_CATEGORIES,
  LOGO_NAMES,
  logoDisplayName,
} from "@/data/logos";
import { MONO_LOGO_NAMES } from "@/data/generated/monoLogoNames";
import {
  getColorLogoBody,
  getIconBody,
  requestColorLogos,
  requestMonoLogos,
  useIconCacheVersion,
} from "@/lib/iconify";
import { isLogoElement } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";
import { SelectedIconEditor } from "./IconPanel";
import { SelectedImageEditor } from "./ImagePanel";

const monoSet = new Set(MONO_LOGO_NAMES);

function logoSvgHtml(body: { body: string; width?: number; height?: number }, tint?: string): string {
  const vw = body.width ?? 24;
  const vh = body.height ?? 24;
  const inner = tint ? body.body.replace(/currentColor/g, tint) : body.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:100%;height:100%">${inner}</svg>`;
}

/** Longest side a freshly added color logo gets, so every brand spawns alike. */
const LOGO_SPAWN_SIZE = 96;

/**
 * Build the SVG data-URL src for a color logo, or null if its body isn't cached.
 * `vw`/`vh` are the *spawn* box: the intrinsic sizes differ wildly per brand
 * (facebook 666², x 24²), so they're normalized to a common longest side with
 * the aspect ratio preserved.
 */
function colorLogoSrc(name: string): { src: string; vw: number; vh: number } | null {
  const body = getColorLogoBody(name);
  if (!body) return null;
  const iw = body.width ?? 24;
  const ih = body.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}" viewBox="0 0 ${iw} ${ih}">${body.body}</svg>`;
  const k = LOGO_SPAWN_SIZE / Math.max(iw, ih);
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    vw: Math.round(iw * k),
    vh: Math.round(ih * k),
  };
}

function LogoLibrary() {
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
    const base = q
      ? [...new Set(Object.values(LOGO_NAMES).flat())].filter(
          (n) => n.includes(q) || logoDisplayName(n).toLowerCase().includes(q),
        )
      : (LOGO_NAMES[category] ?? []);
    // Mono bodies come exclusively from simple-icons; brands it no longer
    // carries (trademark removals) are color-only.
    return logoMode === "mono" ? base.filter((n) => monoSet.has(n)) : base;
  }, [q, category, logoMode]);

  useEffect(() => {
    if (!names.length) return;
    // Color mode needs the mono bodies too, as the tinted fallback.
    void requestMonoLogos(names);
    if (logoMode === "color") void requestColorLogos(names);
  }, [names, logoMode]);

  const addLogo = (name: string) => {
    if (logoMode === "color") {
      const cl = colorLogoSrc(name);
      if (cl) {
        select(addImage(cl.src, cl.vw, cl.vh, logoDisplayName(name), name));
        return;
      }
      // Fallback: mono body tinted with the brand color (still a logo icon).
      select(
        addIcon({
          iconName: name,
          iconVariant: "logo",
          iconCacheKey: `logo:${name}`,
          color: BRAND_COLORS[name] ?? "#ffffff",
          name: logoDisplayName(name),
        }),
      );
      return;
    }
    select(
      addIcon({
        iconName: name,
        iconVariant: "logo",
        iconCacheKey: `logo:${name}`,
        color: logoColor,
        name: logoDisplayName(name),
      }),
    );
  };

  return (
    <div className="space-y-3">
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
          <ColorField
            value={logoColor}
            onChange={(v) => {
              if (typeof v === "string") setLogoColor(v);
            }}
            ariaLabel="Mono logo color"
          />
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search logos…"
        className="h-7 px-2 text-xs"
        aria-label="Search logos"
        data-panel-search
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
          // Color bodies render as isolated <img> data-URLs (same as on canvas)
          // — inlining many of them in one DOM let their internal ids/CSS
          // collide, which is what made thumbnails show the wrong colors.
          const colorSrc = logoMode === "color" ? colorLogoSrc(name)?.src : null;
          const monoBody = colorSrc ? null : getIconBody(name, "logo");
          const tint = logoMode === "color" ? (BRAND_COLORS[name] ?? "#ffffff") : logoColor;
          return (
            <button
              key={name}
              type="button"
              title={logoDisplayName(name)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-muted/40 p-2 transition-colors hover:border-border hover:bg-muted"
              onClick={() => addLogo(name)}
            >
              {colorSrc ? (
                <img src={colorSrc} alt="" draggable={false} className="size-7 object-contain" />
              ) : monoBody ? (
                <div
                  className="size-7"
                  dangerouslySetInnerHTML={{ __html: logoSvgHtml(monoBody, tint) }}
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
  );
}

export function LogosPanel() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const elements = useDocumentStore((s) => s.doc.elements);

  // The single selected logo element, if exactly one logo is selected. Mono
  // logos are `icon` elements, color logos `image` elements — each gets the
  // native editor for its kind, hosted here instead of the Icons/Image panel.
  const selectedLogo = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedIds[0]);
    return el && isLogoElement(el) ? el : null;
  }, [elements, selectedIds]);

  return (
    <div>
      <PanelHeader title="Logos" />
      <div className="p-3">
        {selectedLogo?.type === "icon" ? (
          <SelectedIconEditor el={selectedLogo} />
        ) : selectedLogo?.type === "image" ? (
          <SelectedImageEditor el={selectedLogo} />
        ) : (
          <LogoLibrary />
        )}
      </div>
    </div>
  );
}
