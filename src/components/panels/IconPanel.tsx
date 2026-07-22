/**
 * Icons panel (Phosphor via Iconify). Library view: default color, variant
 * picker, search across all categories, category tabs, 3-col grid with
 * skeleton placeholders while bodies fetch (effect-driven — the legacy
 * fetched during render). Selected view: preview, gradient-capable color,
 * variant switch (refetches the new variant), shadow + transform.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { MaterialControls } from "@/components/controls/MaterialControls";
import { DEFAULT_INNER_SHADOW, ShadowControls } from "@/components/controls/ShadowControls";
import { StrokeControls } from "@/components/controls/StrokeControls";
import { TransformFields } from "@/components/controls/TransformFields";
import { ICON_CATEGORIES, ICON_NAMES } from "@/data/iconNames";
import {
  getIconBody,
  iconCacheKey,
  iconStatus,
  phCacheKey,
  requestPhosphorIcons,
  retryIcon,
  useIconCacheVersion,
} from "@/lib/iconify";
import { useCustomAssetsStore } from "@/store/customAssetsStore";
import { getHex } from "@/lib/color";
import { isGradient, type ColorValue } from "@/types/gradient";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import type { IconElement, IconVariant } from "@/types/element";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";
import { AddAssetTile } from "./AddAssetTile";

const VARIANTS: IconVariant[] = ["regular", "bold", "thin", "light", "fill", "duotone"];

/** Small heading above a filter dropdown. */
const FILTER_LABEL = "block text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

/** Category sentinel: show every icon across all categories. */
const ALL_CATEGORY = "All";
/** Category bucket for user-added icons. */
const CUSTOM_CATEGORY = "Custom";

function iconTint(color: ColorValue): string {
  if (isGradient(color)) {
    const first = [...color.stops].sort((a, b) => a.pos - b.pos)[0];
    return first ? getHex(first.hue, first.sat, first.bri) : "#c8c8c8";
  }
  return color;
}

function IconGlyph({
  name,
  variant,
  tint = "#c8c8c8",
  className,
}: {
  name: string;
  variant: IconVariant | string;
  tint?: string;
  className?: string;
}) {
  const body = getIconBody(name, variant);
  if (!body) {
    // Failed reads as a static dashed box; still-loading keeps pulsing (ST-10).
    if (iconStatus(name, variant) === "failed") {
      return (
        <div
          title="Icon unavailable offline"
          className={cn(
            "flex items-center justify-center rounded border border-dashed text-muted-foreground",
            className,
          )}
        >
          ?
        </div>
      );
    }
    return <div className={cn("animate-pulse rounded bg-muted", className)} />;
  }
  const vw = body.width ?? 256;
  const vh = body.height ?? 256;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:100%;height:100%">${body.body.replace(/currentColor/g, tint)}</svg>`,
      }}
    />
  );
}

export function SelectedIconEditor({ el }: { el: IconElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  useIconCacheVersion();

  const switchVariant = (variant: IconVariant) => {
    updateElement(el.id, {
      iconVariant: variant,
      iconCacheKey: phCacheKey(el.iconName, variant),
    });
    void requestPhosphorIcons([el.iconName], variant);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-md border p-2"
          style={
            isGradient(el.color) ? { color: iconTint(el.color) } : { color: el.color as string }
          }
        >
          <IconGlyph
            name={el.iconName}
            variant={el.iconVariant}
            tint={iconTint(el.color)}
            className="size-10"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{el.name}</p>
          <p className="text-[10px] text-muted-foreground">{el.iconVariant}</p>
        </div>
        <div className="ml-auto">
          <ColorField
            value={el.color}
            onChange={(v) => updateElement(el.id, { color: v })}
            allowGradient
            ariaLabel="Icon color"
          />
        </div>
      </div>

      {iconStatus(el.iconName, el.iconVariant) === "failed" && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-muted-foreground">
          <span className="flex-1">This icon isn’t available offline.</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => retryIcon(el.iconName, el.iconVariant)}
          >
            <RotateCw className="size-3.5" /> Retry
          </Button>
        </div>
      )}

      {el.iconVariant !== "logo" && el.iconVariant !== "custom" && (
        <PanelSection title="Style">
          <Select value={el.iconVariant} onValueChange={(v) => switchVariant(v as IconVariant)}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Icon style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4}>
              {VARIANTS.map((v) => (
                <SelectItem key={v} value={v} className="text-xs capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelSection>
      )}

      {el.iconVariant === "logo" && (
        <StrokeControls
          enabled={el.stroke?.enabled ?? false}
          width={el.stroke?.width ?? 2}
          color={el.stroke?.color ?? "#000000"}
          onChange={(patch) =>
            updateElement(el.id, {
              stroke: {
                enabled: patch.enabled ?? el.stroke?.enabled ?? false,
                width: patch.width ?? el.stroke?.width ?? 2,
                color: patch.color ?? el.stroke?.color ?? "#000000",
              },
            })
          }
        />
      )}

      <ShadowControls
        shadow={el.dropShadow}
        onChange={(shadow) => updateElement(el.id, { dropShadow: shadow ?? undefined })}
      />

      <ShadowControls
        title="Inner shadow"
        defaultShadow={DEFAULT_INNER_SHADOW}
        shadow={el.innerShadow}
        onChange={(shadow) => updateElement(el.id, { innerShadow: shadow ?? undefined })}
      />

      <MaterialControls el={el} />

      <TransformFields el={el} />
    </div>
  );
}

function IconLibrary() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [variant, setVariant] = useState<IconVariant>("regular");
  const iconDefaults = useDocumentStore((s) => s.doc.iconDefaults);
  const setIconDefaults = useDocumentStore((s) => s.setIconDefaults);
  const addIcon = useDocumentStore((s) => s.addIcon);
  const select = useSelectionStore((s) => s.select);
  useIconCacheVersion();

  const customAssets = useCustomAssetsStore((s) => s.assets);
  const removeCustom = useCustomAssetsStore((s) => s.remove);

  const q = search.trim().toLowerCase();
  const names = useMemo(() => {
    const all = [...new Set(Object.values(ICON_NAMES).flat())];
    if (q) return all.filter((n) => n.includes(q));
    if (category === ALL_CATEGORY) return all;
    return ICON_NAMES[category] ?? [];
  }, [q, category]);

  const customIcons = useMemo(() => {
    const mine = customAssets.filter((a) => a.target === "icon");
    if (q) return mine.filter((a) => a.name.toLowerCase().includes(q));
    if (category === ALL_CATEGORY) return mine;
    return mine.filter((a) => a.category === category);
  }, [customAssets, q, category]);

  useEffect(() => {
    if (names.length) void requestPhosphorIcons(names, variant);
  }, [names, variant]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons…"
          className="h-7 flex-1 px-2 text-xs"
          aria-label="Search icons"
          data-panel-search
        />
        <ColorField
          value={iconDefaults.color}
          onChange={(v) => setIconDefaults({ color: v })}
          allowGradient
          ariaLabel="Default icon color"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className={FILTER_LABEL}>Style</span>
          <Select value={variant} onValueChange={(v) => setVariant(v as IconVariant)}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Icon style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4}>
              {VARIANTS.map((v) => (
                <SelectItem key={v} value={v} className="text-xs capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className={FILTER_LABEL}>Category</span>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Icon category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4}>
              <SelectItem value={ALL_CATEGORY} className="text-xs">
                {ALL_CATEGORY}
              </SelectItem>
              <SelectItem value={CUSTOM_CATEGORY} className="text-xs">
                {CUSTOM_CATEGORY}
              </SelectItem>
              {ICON_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <AddAssetTile target="icon" categories={ICON_CATEGORIES} />

        {customIcons.map((a) => (
          <div key={a.id} className="group relative">
            <button
              type="button"
              title={a.name}
              className="flex aspect-square w-full items-center justify-center rounded-lg border border-transparent bg-muted/40 p-2.5 transition-colors hover:border-border hover:bg-muted"
              onClick={() => {
                const id = addIcon({
                  iconName: a.id,
                  iconVariant: "custom",
                  iconCacheKey: iconCacheKey(a.id, "custom"),
                  color: iconDefaults.color,
                  name: a.name,
                });
                select(id);
              }}
            >
              <IconGlyph
                name={a.id}
                variant="custom"
                tint={iconTint(iconDefaults.color)}
                className="size-7"
              />
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
        ))}

        {names.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            className="flex aspect-square items-center justify-center rounded-lg border border-transparent bg-muted/40 p-2.5 transition-colors hover:border-border hover:bg-muted"
            onClick={() => {
              const id = addIcon({
                iconName: name,
                iconVariant: variant,
                iconCacheKey: phCacheKey(name, variant),
                color: iconDefaults.color,
              });
              select(id);
            }}
          >
            <IconGlyph
              name={name}
              variant={variant}
              tint={iconTint(iconDefaults.color)}
              className="size-7"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconPanel() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const clear = useSelectionStore((s) => s.clear);
  const el = useDocumentStore((s) =>
    s.doc.elements.find((e) => e.id === selectedId && e.type === "icon"),
  ) as IconElement | undefined;

  return (
    <div>
      <PanelHeader title="Icons" onBack={el ? clear : undefined} />
      <div className="p-3">{el ? <SelectedIconEditor el={el} /> : <IconLibrary />}</div>
    </div>
  );
}
