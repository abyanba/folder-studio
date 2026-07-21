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
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import {
  BRAND_COLORS,
  LOGO_CATEGORIES,
  LOGO_NAMES,
  logoDisplayName,
} from "@/data/logos";
import { MONO_LOGO_NAMES } from "@/data/generated/monoLogoNames";
import { COLOR_LOGO_DARK_NAMES } from "@/data/generated/colorLogoDarkNames";
import type { IconBody } from "@/lib/export/elementSvg";
import {
  getColorLogoBody,
  getColorLogoDarkBody,
  getIconBody,
  iconCacheKey,
  requestColorLogos,
  requestColorLogosDark,
  requestMonoLogos,
  useIconCacheVersion,
} from "@/lib/iconify";
import { useCustomAssetsStore, type CustomAsset } from "@/store/customAssetsStore";
import { isLogoElement, type ImageElement } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { PanelHeader } from "./PanelHeader";
import { AddAssetTile } from "./AddAssetTile";
import { SelectedIconEditor } from "./IconPanel";
import { SelectedImageEditor } from "./ImagePanel";

const monoSet = new Set(MONO_LOGO_NAMES);
const darkVariantSet = new Set(COLOR_LOGO_DARK_NAMES);

/** Small heading above a filter dropdown. */
const FILTER_LABEL = "block text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

/** Category sentinel: show every logo across all categories. */
const ALL_CATEGORY = "All";
/** Category bucket for user-added logos. */
const CUSTOM_CATEGORY = "Custom";

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
/** SVG data-URL for a color-logo body at its intrinsic size. */
function colorBodySrc(body: IconBody): string {
  const iw = body.width ?? 24;
  const ih = body.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}" viewBox="0 0 ${iw} ${ih}">${body.body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * A color logo's default body: the DARK-theme variant when svgl ships one
 * (falling back to light), so it reads on the dark folders these are usually
 * dropped onto. Returns null until the body has loaded.
 */
function preferredColorBody(name: string): { body: IconBody; variant: "light" | "dark" } | null {
  if (darkVariantSet.has(name)) {
    const dark = getColorLogoDarkBody(name);
    if (dark) return { body: dark, variant: "dark" };
  }
  const light = getColorLogoBody(name);
  return light ? { body: light, variant: "light" } : null;
}

function colorLogoSrc(name: string): { src: string; vw: number; vh: number } | null {
  const pref = preferredColorBody(name);
  if (!pref) return null;
  const iw = pref.body.width ?? 24;
  const ih = pref.body.height ?? 24;
  const k = LOGO_SPAWN_SIZE / Math.max(iw, ih);
  return {
    src: colorBodySrc(pref.body),
    vw: Math.round(iw * k),
    vh: Math.round(ih * k),
  };
}

/**
 * Light/Dark toggle for a placed color logo that ships both svgl variants.
 * Swaps the element's src in place (keeping its box); dark is the default.
 */
function ColorLogoVariant({ el }: { el: ImageElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  useIconCacheVersion();
  const name = el.logoName;

  useEffect(() => {
    if (name && darkVariantSet.has(name)) {
      void requestColorLogos([name]);
      void requestColorLogosDark([name]);
    }
  }, [name]);

  if (!name || !darkVariantSet.has(name)) return null;
  // Default is dark; an untagged logo is inferred from which body its src matches.
  const darkBody = getColorLogoDarkBody(name);
  const variant =
    el.logoVariant ?? (darkBody && el.src === colorBodySrc(darkBody) ? "dark" : "light");
  const setVariant = (v: "light" | "dark") => {
    const body = v === "dark" ? darkBody : getColorLogoBody(name);
    if (!body) return;
    updateElement(el.id, { src: colorBodySrc(body), logoVariant: v });
  };

  return (
    <div className="space-y-1">
      <span className={FILTER_LABEL}>Variant</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={variant}
        onValueChange={(v) => v && setVariant(v as "light" | "dark")}
        className="w-full"
      >
        <ToggleGroupItem value="light" className="flex-1 text-xs">
          Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" className="flex-1 text-xs">
          Dark
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function LogoLibrary() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const logoMode = useUiStore((s) => s.logoMode);
  const setLogoMode = useUiStore((s) => s.setLogoMode);
  const logoColor = useUiStore((s) => s.logoColor);
  const setLogoColor = useUiStore((s) => s.setLogoColor);
  const addIcon = useDocumentStore((s) => s.addIcon);
  const addImage = useDocumentStore((s) => s.addImage);
  const select = useSelectionStore((s) => s.select);
  const customAssets = useCustomAssetsStore((s) => s.assets);
  const removeCustom = useCustomAssetsStore((s) => s.remove);
  useIconCacheVersion();

  const q = search.trim().toLowerCase();
  const names = useMemo(() => {
    const all = [...new Set(Object.values(LOGO_NAMES).flat())];
    const base = q
      ? all.filter((n) => n.includes(q) || logoDisplayName(n).toLowerCase().includes(q))
      : category === ALL_CATEGORY
        ? all
        : (LOGO_NAMES[category] ?? []);
    // Mono bodies come exclusively from simple-icons; brands it no longer
    // carries (trademark removals) are color-only.
    return logoMode === "mono" ? base.filter((n) => monoSet.has(n)) : base;
  }, [q, category, logoMode]);

  // Custom logos show in the matching mode: tintable → Mono, color → Color.
  const customLogos = useMemo(() => {
    const wantKind = logoMode === "mono" ? "tintable" : "color";
    const mine = customAssets.filter((a) => a.target === "logo" && a.kind === wantKind);
    if (q) return mine.filter((a) => a.name.toLowerCase().includes(q));
    if (category === ALL_CATEGORY) return mine;
    return mine.filter((a) => a.category === category);
  }, [customAssets, q, category, logoMode]);

  useEffect(() => {
    if (!names.length) return;
    // Color mode needs the mono bodies too, as the tinted fallback.
    void requestMonoLogos(names);
    if (logoMode === "color") {
      void requestColorLogos(names);
      // Dark is the default variant, so load it for the brands that have one.
      void requestColorLogosDark(names.filter((n) => darkVariantSet.has(n)));
    }
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

  const addCustomLogo = (a: CustomAsset) => {
    if (a.kind === "color" && a.src) {
      const k = LOGO_SPAWN_SIZE / Math.max(a.width, a.height);
      select(addImage(a.src, Math.round(a.width * k), Math.round(a.height * k), a.name, a.id));
    } else {
      select(
        addIcon({
          iconName: a.id,
          iconVariant: "logo",
          iconCacheKey: iconCacheKey(a.id, "logo"),
          color: logoColor,
          name: a.name,
        }),
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logos…"
          className="h-7 flex-1 px-2 text-xs"
          aria-label="Search logos"
          data-panel-search
        />
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

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className={FILTER_LABEL}>Style</span>
          <Select value={logoMode} onValueChange={(v) => setLogoMode(v as "mono" | "color")}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Logo style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4}>
              <SelectItem value="mono" className="text-xs">
                Mono
              </SelectItem>
              <SelectItem value="color" className="text-xs">
                Color
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className={FILTER_LABEL}>Category</span>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Logo category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4}>
              <SelectItem value={ALL_CATEGORY} className="text-xs">
                {ALL_CATEGORY}
              </SelectItem>
              <SelectItem value={CUSTOM_CATEGORY} className="text-xs">
                {CUSTOM_CATEGORY}
              </SelectItem>
              {LOGO_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <AddAssetTile target="logo" categories={LOGO_CATEGORIES} />

        {customLogos.map((a) => {
          const monoBody = a.kind === "tintable" ? getIconBody(a.id, "logo") : null;
          return (
            <div key={a.id} className="group relative">
              <button
                type="button"
                title={a.name}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-muted/40 p-2 transition-colors hover:border-border hover:bg-muted"
                onClick={() => addCustomLogo(a)}
              >
                {a.kind === "color" ? (
                  <img src={a.src} alt="" draggable={false} className="size-7 object-contain" />
                ) : monoBody ? (
                  <div
                    className="size-7"
                    dangerouslySetInnerHTML={{ __html: logoSvgHtml(monoBody, logoColor) }}
                  />
                ) : (
                  <div className="size-7 animate-pulse rounded bg-muted" />
                )}
                <span className="max-w-full truncate text-[9px] leading-tight text-muted-foreground">
                  {a.name}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                title="Remove from library"
                className="absolute -right-1 -top-1 hidden rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground group-hover:block"
                onClick={() => removeCustom(a.id)}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}

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
  const clear = useSelectionStore((s) => s.clear);
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
      <PanelHeader title="Logos" onBack={selectedLogo ? clear : undefined} />
      <div className="p-3">
        {selectedLogo?.type === "icon" ? (
          <SelectedIconEditor el={selectedLogo} />
        ) : selectedLogo?.type === "image" ? (
          <div className="space-y-4">
            <ColorLogoVariant el={selectedLogo} />
            <SelectedImageEditor el={selectedLogo} />
          </div>
        ) : (
          <LogoLibrary />
        )}
      </div>
    </div>
  );
}
