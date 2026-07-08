/**
 * Image panel: multi-file upload plus the selected-image editor — blend mode
 * (with hover live-preview via `uiStore.blendPreview`), stroke, shadow, and
 * transform. Upload clamps to ≤55% of the content rect via the image factory.
 */

import { useRef, type ChangeEvent } from "react";
import { ChevronDown, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PanelSection } from "@/components/controls/PanelSection";
import { ShadowControls } from "@/components/controls/ShadowControls";
import { StrokeControls } from "@/components/controls/StrokeControls";
import { TransformFields } from "@/components/controls/TransformFields";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { notify } from "@/store/toastStore";
import { importImageFile } from "@/lib/importImage";
import type { BlendMode, ImageElement } from "@/types/element";
import { PanelHeader } from "./PanelHeader";

const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
];

function blendLabel(mode: BlendMode): string {
  return mode
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function UploadButton({ label = "Upload images" }: { label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addImage = useDocumentStore((s) => s.addImage);
  const select = useSelectionStore((s) => s.select);

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      // Downscale oversized uploads before they enter the document (PF-08).
      importImageFile(file)
        .then(({ dataUrl, width, height, scaled }) => {
          const id = addImage(dataUrl, width, height);
          select(id);
          if (scaled) notify.info("Image resized to 1024px for performance");
        })
        .catch((err) =>
          notify.error(`Couldn't load ${file.name}`, err instanceof Error ? err.message : undefined),
        );
    });
    e.target.value = "";
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-20 w-full border-dashed text-xs text-muted-foreground"
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-4" /> {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label={label}
        onChange={onFiles}
      />
    </>
  );
}

export function SelectedImageEditor({ el }: { el: ImageElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  const setBlendPreview = useUiStore((s) => s.setBlendPreview);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img
          src={el.src}
          alt=""
          className="size-14 shrink-0 rounded-md border object-contain p-1"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{el.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {Math.round(el.width)} × {Math.round(el.height)}
          </p>
        </div>
      </div>

      <PanelSection title="Blend mode">
        <DropdownMenu onOpenChange={(open) => !open && setBlendPreview(null)}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs">
              {blendLabel(el.blendMode ?? "normal")}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            {BLEND_MODES.map((mode) => (
              <DropdownMenuItem
                key={mode}
                className="text-xs"
                onMouseEnter={() => setBlendPreview(mode)}
                onMouseLeave={() => setBlendPreview(null)}
                onSelect={() => {
                  setBlendPreview(null);
                  updateElement(el.id, { blendMode: mode });
                }}
              >
                {blendLabel(mode)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </PanelSection>

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

      <ShadowControls
        shadow={el.dropShadow}
        onChange={(shadow) => updateElement(el.id, { dropShadow: shadow ?? undefined })}
      />

      <TransformFields el={el} />
    </div>
  );
}

export function ImagePanel() {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const el = useDocumentStore((s) =>
    s.doc.elements.find((e) => e.id === selectedId && e.type === "image"),
  ) as ImageElement | undefined;

  return (
    <div>
      <PanelHeader title="Image" />
      <div className="space-y-4 p-3">
        <UploadButton />
        {el ? (
          <SelectedImageEditor el={el} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Upload an image, or select one on the folder to edit it.
          </p>
        )}
      </div>
    </div>
  );
}
