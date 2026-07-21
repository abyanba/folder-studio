/**
 * The "+ Add" tile (always cell #1 of the Icons/Logos grids) and its add-custom
 * dialog. Replaces the old buried "search for more" footer: a popover offers
 * "Paste SVG code" plus NAMED external sources, and the dialog ingests pasted
 * SVG into the custom-asset library (see {@link useCustomAssetsStore}).
 *
 * Icons are tintable-only; a multicolor paste offers a one-click hand-off to the
 * Logos library as a color logo (with "add anyway", which flattens to one color).
 * Logos auto-detect mono vs color, user-overridable.
 */

import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ingestSvg } from "@/lib/customSvg";
import { useCustomAssetsStore, type CustomTarget } from "@/store/customAssetsStore";
import { notify } from "@/store/toastStore";

const SOURCES: Record<CustomTarget, Array<{ label: string; href: string }>> = {
  icon: [{ label: "Phosphor", href: "https://phosphoricons.com" }],
  logo: [
    { label: "Simple Icons", href: "https://simpleicons.org" },
    { label: "SVGL", href: "https://svgl.app" },
  ],
};

const CUSTOM_CATEGORY = "Custom";

function svgHtml(body: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" style="width:100%;height:100%">${body}</svg>`;
}

function AddDialog({
  target,
  categories,
  open,
  onOpenChange,
}: {
  target: CustomTarget;
  categories: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useCustomAssetsStore((s) => s.add);
  const [svg, setSvg] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CUSTOM_CATEGORY);
  // Logo type override (null = follow detection). Icons are always tintable.
  const [typeOverride, setTypeOverride] = useState<"mono" | "color" | null>(null);

  const ingest = useMemo(() => (svg.trim() ? ingestSvg(svg) : null), [svg]);
  const invalid = svg.trim().length > 0 && !ingest;
  const isColorLogo =
    target === "logo" && (typeOverride ?? ingest?.detected ?? "mono") === "color";
  const iconWantsColor = target === "icon" && ingest?.detected === "color";

  const reset = () => {
    setSvg("");
    setName("");
    setCategory(CUSTOM_CATEGORY);
    setTypeOverride(null);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };

  const commit = (t: CustomTarget, kind: "tintable" | "color") => {
    if (!ingest) return;
    const trimmed = name.trim() || "Untitled";
    if (kind === "color") {
      add({
        target: t,
        kind: "color",
        name: trimmed,
        category,
        width: ingest.width,
        height: ingest.height,
        src: ingest.colorSrc,
      });
    } else {
      add({
        target: t,
        kind: "tintable",
        name: trimmed,
        category,
        width: ingest.width,
        height: ingest.height,
        body: ingest.monoBody,
      });
    }
    notify.success(`Added ${trimmed} to your ${t === "icon" ? "icons" : "logos"}`);
    close();
  };

  const onAdd = () => {
    if (target === "logo") commit("logo", isColorLogo ? "color" : "tintable");
    else commit("icon", "tintable"); // icons: tintable (flattened if color art)
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Add custom {target === "icon" ? "icon" : "logo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted/30 p-2 text-foreground">
              {ingest ? (
                isColorLogo ? (
                  <img src={ingest.colorSrc} alt="" className="size-full object-contain" />
                ) : (
                  <div
                    className="size-full"
                    dangerouslySetInnerHTML={{
                      __html: svgHtml(ingest.monoBody, ingest.width, ingest.height),
                    }}
                  />
                )
              ) : (
                <span className="text-[10px] text-muted-foreground">Preview</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                SVG code
              </label>
              <Textarea
                value={svg}
                onChange={(e) => setSvg(e.target.value)}
                placeholder="<svg …>"
                // field-sizing-fixed: the primitive defaults to sizing-content,
                // which lets one long unbreakable path stretch the whole dialog.
                className="h-20 w-full resize-none overflow-auto break-all font-mono text-[11px] [field-sizing:fixed]"
                aria-label="SVG code"
                autoFocus
              />
            </div>
          </div>
          {invalid && (
            <p className="text-xs text-destructive">
              That doesn’t look like a valid SVG. Make sure you copied the whole
              {" "}
              <code>&lt;svg&gt;…&lt;/svg&gt;</code>.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {target === "icon" ? (
              <>On Phosphor use “Copy SVG (raw)” so it stays tintable and centered — or paste any .svg file’s contents.</>
            ) : (
              <>
                Paste an SVG — copy one from{" "}
                {SOURCES[target].map((s, i) => (
                  <span key={s.href}>
                    {i > 0 && ", "}
                    {s.label}
                  </span>
                ))}
                , or any .svg file’s contents.
              </>
            )}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme mark"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger size="sm" className="h-7 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={CUSTOM_CATEGORY} className="text-xs">
                    {CUSTOM_CATEGORY}
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {target === "logo" && ingest && (
            <div className="space-y-1">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={isColorLogo ? "color" : "mono"}
                onValueChange={(v) => v && setTypeOverride(v as "mono" | "color")}
                className="w-full"
              >
                <ToggleGroupItem value="mono" className="flex-1 text-xs">
                  Mono (tintable)
                </ToggleGroupItem>
                <ToggleGroupItem value="color" className="flex-1 text-xs">
                  Full color
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}

          {iconWantsColor && (
            <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-[11px] text-muted-foreground">
              This SVG has multiple colors, so it works better as a logo.{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2"
                onClick={() => commit("logo", "color")}
              >
                Add to Logos as color
              </button>{" "}
              — or add it here anyway (it’ll flatten to one color when tinted).
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="text-xs" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs" disabled={!ingest} onClick={onAdd}>
            {iconWantsColor ? "Add anyway" : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddAssetTile({
  target,
  categories,
}: {
  target: CustomTarget;
  categories: string[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={`Add custom ${target}`}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-5" />
            <span className="text-[9px] leading-tight">Add</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-1">
          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted"
            onClick={() => {
              setMenuOpen(false);
              setDialogOpen(true);
            }}
          >
            Paste SVG code…
          </button>
          <div className="my-1 border-t" />
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Browse online
          </p>
          {SOURCES[target].map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted"
            >
              {s.label} <ExternalLink className="size-3" />
            </a>
          ))}
        </PopoverContent>
      </Popover>

      <AddDialog
        target={target}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
