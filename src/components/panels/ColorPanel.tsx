/**
 * Folder-fill panel: solid / gradient / image modes plus folder opacity.
 *
 * The mode is derived from the document (`folderFillMode` + the color's type)
 * rather than kept as local state, so undo/redo and gallery loads keep the UI
 * in sync. Image mode ports the legacy square crop preview: drag to pan
 * (`imgCrop` sensitivity math, one undo entry per pan), zoom 1–3, reset/
 * replace/remove.
 */

import { useRef, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradientEditor } from "@/components/color/GradientEditor";
import { PresetRow } from "@/components/color/PresetRow";
import { SolidColorPicker } from "@/components/color/SolidColorPicker";
import { gradientFromHex } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { SliderField } from "@/components/controls/SliderField";
import { getHex } from "@/lib/color";
import { computeImagePan } from "@/lib/imagePan";
import {
  beginDocPreview,
  endDocPreview,
  useDocumentStore,
} from "@/store/documentStore";
import { isGradient, type GradientStop } from "@/types/gradient";
import { PanelHeader } from "./PanelHeader";

type FillMode = "solid" | "gradient" | "image";

function readFileAsDataUrl(file: File, onLoad: (dataUrl: string) => void): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    if (typeof e.target?.result === "string") onLoad(e.target.result);
  };
  reader.readAsDataURL(file);
}

function ImageCropPreview() {
  const doc = useDocumentStore((s) => s.doc);
  const setFolderBg = useDocumentStore((s) => s.setFolderBg);
  const dragStart = useRef<{ sx: number; sy: number; startX: number; startY: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Background image crop preview — drag to pan"
      className="aspect-square w-full cursor-grab touch-none overflow-hidden rounded-lg border active:cursor-grabbing"
      style={{
        backgroundImage: `url("${doc.folderBgImage}")`,
        backgroundSize: `${(doc.folderBgZoom || 1) * 100}%`,
        backgroundPosition: `${doc.folderBgX ?? 50}% ${doc.folderBgY ?? 50}%`,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStart.current = {
          sx: e.clientX,
          sy: e.clientY,
          startX: doc.folderBgX ?? 50,
          startY: doc.folderBgY ?? 50,
        };
        beginDocPreview();
      }}
      onPointerMove={(e) => {
        const d = dragStart.current;
        const rect = ref.current?.getBoundingClientRect();
        if (!d || !rect || !(e.buttons & 1)) return;
        const { x, y } = computeImagePan({
          dx: e.clientX - d.sx,
          dy: e.clientY - d.sy,
          width: rect.width,
          height: rect.height,
          zoom: doc.folderBgZoom || 1,
          startX: d.startX,
          startY: d.startY,
        });
        setFolderBg({ folderBgX: x, folderBgY: y });
      }}
      onPointerUp={() => {
        dragStart.current = null;
        endDocPreview();
      }}
      onPointerCancel={() => {
        dragStart.current = null;
        endDocPreview();
      }}
    />
  );
}

export function ColorPanel() {
  const doc = useDocumentStore((s) => s.doc);
  const setFolderColor = useDocumentStore((s) => s.setFolderColor);
  const setFolderFill = useDocumentStore((s) => s.setFolderFill);
  const setFolderOpacity = useDocumentStore((s) => s.setFolderOpacity);
  const setFolderBg = useDocumentStore((s) => s.setFolderBg);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const grad = isGradient(doc.folderColor) ? doc.folderColor : null;
  const hex: string = grad
    ? getHex(grad.stops[0]?.hue ?? 0, grad.stops[0]?.sat ?? 0, grad.stops[0]?.bri ?? 1)
    : (doc.folderColor as string);
  const mode: FillMode =
    doc.folderFillMode === "image" ? "image" : grad ? "gradient" : "solid";

  const switchMode = (m: string) => {
    if (m === mode) return;
    if (m === "image") {
      setFolderFill({ folderFillMode: "image" });
      if (!doc.folderBgImage) fileInputRef.current?.click();
    } else if (m === "gradient") {
      setFolderFill({
        folderFillMode: "color",
        folderColor: grad ?? gradientFromHex(hex),
      });
    } else {
      setFolderFill({ folderFillMode: "color", folderColor: hex });
    }
  };

  const pickGradientStops = (stops: GradientStop[]) =>
    setFolderFill({
      folderFillMode: "color",
      folderColor: { kind: grad?.kind ?? "linear", angle: grad?.angle ?? 90, stops },
    });

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileAsDataUrl(file, (dataUrl) =>
        setFolderFill({ folderBgImage: dataUrl, folderFillMode: "image" }),
      );
    }
    e.target.value = "";
  };

  return (
    <div>
      <PanelHeader title="Folder Color" />
      <div className="space-y-4 p-3">
        <Tabs value={mode} onValueChange={switchMode}>
          <TabsList className="h-7 w-full">
            <TabsTrigger value="solid" className="flex-1 text-xs">
              Solid
            </TabsTrigger>
            <TabsTrigger value="gradient" className="flex-1 text-xs">
              Gradient
            </TabsTrigger>
            <TabsTrigger value="image" className="flex-1 text-xs">
              Image
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <SliderField
          label="Folder opacity"
          value={doc.folderOpacity}
          min={0.05}
          max={1}
          step={0.05}
          onChange={setFolderOpacity}
          format={(v) => `${Math.round(v * 100)}%`}
        />

        {mode === "solid" && (
          <>
            <SolidColorPicker hex={hex} onChange={setFolderColor} />
            <PresetRow
              onPickSolid={setFolderColor}
              onPickGradientStops={pickGradientStops}
              currentHex={hex}
            />
          </>
        )}

        {mode === "gradient" && grad && (
          <>
            <GradientEditor value={grad} onChange={setFolderColor} />
            <PresetRow
              onPickSolid={setFolderColor}
              onPickGradientStops={pickGradientStops}
              currentStops={grad.stops}
            />
          </>
        )}

        {mode === "image" && (
          <PanelSection title="Background image">
            {doc.folderBgImage ? (
              <div className="space-y-2.5">
                <ImageCropPreview />
                <SliderField
                  label="Zoom"
                  value={doc.folderBgZoom || 1}
                  min={1}
                  max={3}
                  step={0.05}
                  onChange={(v) => setFolderBg({ folderBgZoom: v })}
                  format={(v) => `${v.toFixed(2)}×`}
                />
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={() => setFolderBg({ folderBgX: 50, folderBgY: 50, folderBgZoom: 1 })}
                  >
                    <RotateCcw className="size-3" /> Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="size-3" /> Replace
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    aria-label="Remove background image"
                    onClick={() =>
                      setFolderFill({ folderBgImage: null, folderFillMode: "color" })
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="h-20 w-full border-dashed text-xs text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Upload image
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload background image"
              onChange={onUpload}
            />
          </PanelSection>
        )}
      </div>
    </div>
  );
}
