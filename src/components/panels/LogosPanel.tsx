/**
 * Logos panel: brand logos in mono (tinted simple-icons bodies) or full color
 * (the `logos` icon set, falling back to a brand-color-tinted mono body).
 * Mono logos are added as tintable icon elements (`iconVariant: "logo"`);
 * color logos become SVG-data-URL image elements tagged with `logoName`,
 * matching the legacy `addLogoToCanvas`.
 *
 * When a placed logo is selected the panel switches to an edit view: recolor
 * (mono) and "Change logo" (swap in place, same kind), per the P1 routing fix.
 */

import { useEffect, useMemo, useState } from "react";
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
import { MONO_LOGO_NAMES } from "@/data/generated/monoLogoNames";
import {
  getColorLogoBody,
  getIconBody,
  requestColorLogos,
  requestMonoLogos,
  useIconCacheVersion,
} from "@/lib/iconify";
import { isLogoElement, logoElementName } from "@/types/element";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

const monoSet = new Set(MONO_LOGO_NAMES);

function logoSvgHtml(body: { body: string; width?: number; height?: number }, tint?: string): string {
  const vw = body.width ?? 24;
  const vh = body.height ?? 24;
  const inner = tint ? body.body.replace(/currentColor/g, tint) : body.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:100%;height:100%">${inner}</svg>`;
}

/** Build the SVG data-URL src for a color logo, or null if its body isn't cached. */
function colorLogoSrc(name: string): { src: string; vw: number; vh: number } | null {
  const body = getColorLogoBody(name);
  if (!body) return null;
  const vw = body.width ?? 24;
  const vh = body.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">${body.body}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, vw, vh };
}

export function LogosPanel() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(LOGO_CATEGORIES[0]);
  const [swapping, setSwapping] = useState(false);
  const logoMode = useUiStore((s) => s.logoMode);
  const setLogoMode = useUiStore((s) => s.setLogoMode);
  const logoColor = useUiStore((s) => s.logoColor);
  const setLogoColor = useUiStore((s) => s.setLogoColor);
  const addIcon = useDocumentStore((s) => s.addIcon);
  const addImage = useDocumentStore((s) => s.addImage);
  const updateElement = useDocumentStore((s) => s.updateElement);
  const elements = useDocumentStore((s) => s.doc.elements);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const select = useSelectionStore((s) => s.select);
  useIconCacheVersion();

  // The single selected logo element, if exactly one logo is selected.
  const selectedLogo = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const el = elements.find((e) => e.id === selectedIds[0]);
    return el && isLogoElement(el) ? el : null;
  }, [elements, selectedIds]);

  // Leaving the swap picker whenever the selected logo changes.
  useEffect(() => setSwapping(false), [selectedLogo?.id]);

  const editing = selectedLogo != null;
  // A placed color logo is an image; a mono logo is a tintable icon.
  const editKind: "mono" | "color" = selectedLogo?.type === "image" ? "color" : "mono";
  // The grid shows the selected logo's kind while swapping, else the add toggle.
  const gridMode = editing ? editKind : logoMode;
  const showGrid = !editing || swapping;

  const q = search.trim().toLowerCase();
  const names = useMemo(() => {
    const base = q
      ? [...new Set(Object.values(LOGO_NAMES).flat())].filter(
          (n) => n.includes(q) || logoDisplayName(n).toLowerCase().includes(q),
        )
      : (LOGO_NAMES[category] ?? []);
    // Mono bodies come exclusively from simple-icons; brands it no longer
    // carries (trademark removals) are color-only.
    return gridMode === "mono" ? base.filter((n) => monoSet.has(n)) : base;
  }, [q, category, gridMode]);

  useEffect(() => {
    if (!names.length) return;
    // Color mode needs the mono bodies too, as the tinted fallback.
    void requestMonoLogos(names);
    if (gridMode === "color") void requestColorLogos(names);
  }, [names, gridMode]);

  // Also make sure the selected logo's own body is fetched for the edit preview.
  useEffect(() => {
    const name = selectedLogo ? logoElementName(selectedLogo) : null;
    if (!name) return;
    void requestMonoLogos([name]);
    if (editKind === "color") void requestColorLogos([name]);
  }, [selectedLogo, editKind]);

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

  // Swap the selected logo for another of the same kind, in place (one undo
  // entry; position/size/rotation are untouched).
  const swapLogo = (name: string) => {
    if (!selectedLogo) return;
    if (editKind === "color") {
      const cl = colorLogoSrc(name);
      updateElement(selectedLogo.id, {
        ...(cl ? { src: cl.src } : {}),
        logoName: name,
        name: logoDisplayName(name),
      });
    } else {
      updateElement(selectedLogo.id, {
        iconName: name,
        iconCacheKey: `logo:${name}`,
        name: logoDisplayName(name),
      });
    }
    setSwapping(false);
  };

  // Preview markup for the currently-selected logo in the edit card.
  const editName = selectedLogo ? logoElementName(selectedLogo) : null;
  const monoColor =
    selectedLogo?.type === "icon" && typeof selectedLogo.color === "string"
      ? selectedLogo.color
      : "#ffffff";

  return (
    <div>
      <PanelHeader title="Logos" />
      <div className="space-y-3 p-3">
        {editing && selectedLogo && editName && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-background p-2">
                {editKind === "color" ? (
                  <img
                    src={selectedLogo.type === "image" ? selectedLogo.src : ""}
                    alt=""
                    className="size-full object-contain"
                  />
                ) : (
                  <MonoPreview name={editName} tint={monoColor} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{logoDisplayName(editName)}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{editKind} logo</div>
              </div>
            </div>

            {editKind === "mono" && (
              <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                Color
                <ColorField
                  value={monoColor}
                  onChange={(v) => {
                    if (typeof v === "string") updateElement(selectedLogo.id, { color: v });
                  }}
                  ariaLabel="Logo color"
                />
              </label>
            )}

            <Button
              size="sm"
              variant={swapping ? "secondary" : "outline"}
              className="w-full"
              onClick={() => setSwapping((v) => !v)}
            >
              {swapping ? "Cancel" : "Change logo"}
            </Button>
          </div>
        )}

        {/* Mono/Color toggle only when adding a new logo (kind is fixed on swap). */}
        {!editing && (
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
        )}

        {showGrid && (
          <>
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
                const colorBody = gridMode === "color" ? getColorLogoBody(name) : null;
                const monoBody = getIconBody(name, "logo");
                const body = colorBody ?? monoBody;
                const tint = colorBody
                  ? undefined
                  : gridMode === "color"
                    ? (BRAND_COLORS[name] ?? "#ffffff")
                    : logoColor;
                return (
                  <button
                    key={name}
                    type="button"
                    title={logoDisplayName(name)}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-transparent bg-muted/40 p-2 transition-colors hover:border-border hover:bg-muted"
                    onClick={() => (swapping ? swapLogo(name) : addLogo(name))}
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
          </>
        )}
      </div>
    </div>
  );
}

/** Mono-logo body rendered at a given tint (for the edit-card preview). */
function MonoPreview({ name, tint }: { name: string; tint: string }) {
  const body = getIconBody(name, "logo");
  if (!body) return <div className="size-full animate-pulse rounded bg-muted" />;
  return <div className="size-full" dangerouslySetInnerHTML={{ __html: logoSvgHtml(body, tint) }} />;
}
