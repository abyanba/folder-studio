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
import { ChevronDown, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradientEditor } from "@/components/color/GradientEditor";
import { PresetRow } from "@/components/color/PresetRow";
import { SolidColorPicker } from "@/components/color/SolidColorPicker";
import { ColorField, gradientFromHex } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { FolderMaterialSection } from "@/components/controls/FolderMaterialSection";
import { SliderField } from "@/components/controls/SliderField";
import {
  MAC_COLOR_PROFILES,
  macDerivedTabColor,
  WINDOWS_GRADIENT_ALGOS,
  WINDOWS_IMAGE_MODES,
  windowsDerivedTabColor,
  windowsImageModeName,
} from "@/lib/export/baseShapes";
import { Switch } from "@/components/ui/switch";
import { getHex } from "@/lib/color";
import { dominantImageColors } from "@/lib/imageColor";
import { computeImagePan } from "@/lib/imagePan";
import {
  beginDocPreview,
  endDocPreview,
  useDocumentStore,
} from "@/store/documentStore";
import { useUiStore } from "@/store/uiStore";
import { isGradient, type GradientStop } from "@/types/gradient";
import type { WindowsImageMode } from "@/types/document";
import { notify } from "@/store/toastStore";
import { importImageFile } from "@/lib/importImage";
import { PanelHeader } from "./PanelHeader";

type FillMode = "solid" | "gradient" | "image";

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

/**
 * A "Color profile" dropdown with hover live-preview. Shared by all four folder
 * profile pickers (Windows/macOS × solid/gradient); each supplies its options,
 * current value, commit setter, and preview setter.
 */
function ProfileDropdown<T extends string>({
  value,
  options,
  onSelect,
  onPreview,
}: {
  value: T;
  options: ReadonlyArray<{ id: T; name: string }>;
  onSelect: (id: T) => void;
  onPreview: (id: T | null) => void;
}) {
  const name = options.find((o) => o.id === value)?.name ?? value;
  return (
    <PanelSection title="Color profile">
      <DropdownMenu onOpenChange={(open) => !open && onPreview(null)}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs">
            {name}
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {options.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              className="text-xs"
              onMouseEnter={() => onPreview(opt.id)}
              onMouseLeave={() => onPreview(null)}
              onSelect={() => {
                onPreview(null);
                onSelect(opt.id);
              }}
            >
              {opt.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </PanelSection>
  );
}

/** Windows gradient-fill color profile (tab/back + shine treatment). */
function WindowsGradientProfile() {
  const algo = useDocumentStore((s) => s.doc.windowsGradientAlgo);
  const setAlgo = useDocumentStore((s) => s.setWindowsGradientAlgo);
  const setPreview = useUiStore((s) => s.setWindowsGradientPreview);
  return (
    <ProfileDropdown value={algo} options={WINDOWS_GRADIENT_ALGOS} onSelect={setAlgo} onPreview={setPreview} />
  );
}

/** Windows solid-fill color profile (authentic vs popped vs flat, etc.). */
function WindowsSolidProfile() {
  const profile = useDocumentStore((s) => s.doc.windowsColorProfile);
  const setProfile = useDocumentStore((s) => s.setWindowsColorProfile);
  const setPreview = useUiStore((s) => s.setWindowsColorProfilePreview);
  return (
    <ProfileDropdown value={profile} options={MAC_COLOR_PROFILES} onSelect={setProfile} onPreview={setPreview} />
  );
}

/** macOS solid-fill color profile (authentic vs popped vs flat, etc.). */
function MacColorProfile() {
  const profile = useDocumentStore((s) => s.doc.macColorProfile);
  const setProfile = useDocumentStore((s) => s.setMacColorProfile);
  const setPreview = useUiStore((s) => s.setMacColorProfilePreview);
  return (
    <ProfileDropdown value={profile} options={MAC_COLOR_PROFILES} onSelect={setProfile} onPreview={setPreview} />
  );
}

/** macOS gradient-fill color profile (front + tab treatment). */
function MacGradientProfile() {
  const algo = useDocumentStore((s) => s.doc.macGradientAlgo);
  const setAlgo = useDocumentStore((s) => s.setMacGradientAlgo);
  const setPreview = useUiStore((s) => s.setMacGradientPreview);
  return (
    <ProfileDropdown value={algo} options={WINDOWS_GRADIENT_ALGOS} onSelect={setAlgo} onPreview={setPreview} />
  );
}

/**
 * Windows-only: whether an image fill spans the whole folder or just the front
 * panel (with an adaptive tab/back derived from the image).
 */
function ImageSpan() {
  const baseShape = useDocumentStore((s) => s.doc.baseShape);
  const isMac = baseShape === "macos";
  const mode = useDocumentStore((s) => (isMac ? s.doc.macImageMode : s.doc.windowsImageMode));
  const setWinMode = useDocumentStore((s) => s.setWindowsImageMode);
  const setMacMode = useDocumentStore((s) => s.setMacImageMode);
  const setMode = isMac ? setMacMode : setWinMode;
  const bgImage = useDocumentStore((s) => s.doc.folderBgImage);
  const bgColor = useDocumentStore((s) => s.doc.folderBgImageColor);
  const setFolderFill = useDocumentStore((s) => s.setFolderFill);

  const pick = (m: WindowsImageMode) => {
    // Front mode needs the adaptive color(s); compute for images captured before
    // the palette was stored.
    if (m === "front" && !bgColor && bgImage) {
      dominantImageColors(bgImage).then(({ primary, secondary }) =>
        setFolderFill({ folderBgImageColor: primary, folderBgImageColor2: secondary }),
      );
    }
    setMode(m);
  };

  return (
    <PanelSection title="Image span">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs">
            {windowsImageModeName(mode)}
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {WINDOWS_IMAGE_MODES.map((opt) => (
            <DropdownMenuItem key={opt.id} className="text-xs" onSelect={() => pick(opt.id)}>
              {opt.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </PanelSection>
  );
}

/** Solid color tint over the background image, with an opacity slider. */
function ImageOverlayControls() {
  const color = useDocumentStore((s) => s.doc.folderBgOverlayColor);
  const opacity = useDocumentStore((s) => s.doc.folderBgOverlayOpacity);
  const setOverlay = useDocumentStore((s) => s.setFolderBgOverlay);
  return (
    <PanelSection title="Overlay">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Tint color</span>
        <ColorField
          value={color}
          onChange={(v) => setOverlay({ folderBgOverlayColor: v as string })}
          ariaLabel="Overlay color"
        />
      </div>
      <SliderField
        label="Overlay opacity"
        value={opacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => setOverlay({ folderBgOverlayOpacity: v })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
    </PanelSection>
  );
}

/**
 * Color the TAB/back independently from the front (solid or gradient), for the
 * Windows and macOS shapes. Auto (default) derives it from the front. Disabled
 * in full-image mode, where the image covers the tab.
 */
function BackTabColor() {
  const doc = useDocumentStore((s) => s.doc);
  const setBackColor = useDocumentStore((s) => s.setFolderBackColor);
  const backColor = doc.folderBackColor;
  const custom = backColor != null;
  const isMac = doc.baseShape === "macos";
  const imageMode = isMac ? doc.macImageMode : doc.windowsImageMode;
  const disabled = doc.folderFillMode === "image" && imageMode === "full";
  const derived = isMac ? macDerivedTabColor(doc) : windowsDerivedTabColor(doc);
  return (
    <PanelSection
      title="Back (tab)"
      action={
        <Switch
          size="sm"
          checked={custom}
          disabled={disabled}
          aria-label="Custom back color"
          onCheckedChange={(on) => setBackColor(on ? derived : null)}
        />
      }
    >
      {disabled ? (
        <p className="text-[11px] text-muted-foreground">
          Set Image span to “Front only” to color the tab.
        </p>
      ) : custom ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tab color</span>
          <ColorField
            value={backColor}
            onChange={setBackColor}
            allowGradient
            linearOnly
            ariaLabel="Back tab color"
          />
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Auto — derived from the front.</p>
      )}
    </PanelSection>
  );
}

/**
 * Recolor the "with contents" paper sheet independently (windows/macOS). White by
 * default (regardless of folder color); Custom accepts a solid or linear gradient.
 */
function PaperColorSection() {
  const paperColor = useDocumentStore((s) => s.doc.folderPaperColor);
  const setPaperColor = useDocumentStore((s) => s.setFolderPaperColor);
  const custom = paperColor != null;
  return (
    <PanelSection
      title="Paper"
      action={
        <Switch
          size="sm"
          checked={custom}
          aria-label="Custom paper color"
          onCheckedChange={(on) => setPaperColor(on ? "#ffffff" : null)}
        />
      }
    >
      {custom ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Paper color</span>
          <ColorField
            value={paperColor}
            onChange={setPaperColor}
            allowGradient
            linearOnly
            ariaLabel="Paper color"
          />
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">White — independent of the folder color.</p>
      )}
    </PanelSection>
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
      importImageFile(file)
        .then(async ({ dataUrl, scaled }) => {
          // Capture the adaptive palette up front so the front-only image mode
          // has it ready (and the SVG export, which can't sample pixels).
          const { primary, secondary } = await dominantImageColors(dataUrl);
          setFolderFill({
            folderBgImage: dataUrl,
            folderFillMode: "image",
            folderBgImageColor: primary,
            folderBgImageColor2: secondary,
          });
          if (scaled) notify.info("Image resized to 1024px for performance");
        })
        .catch((err) =>
          notify.error(`Couldn't read ${file.name}`, err instanceof Error ? err.message : undefined),
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

        {mode === "solid" && (
          <>
            <SolidColorPicker hex={hex} onChange={setFolderColor} />
            <SliderField
              label="Opacity"
              value={doc.folderOpacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setFolderOpacity}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            {doc.baseShape === "windows" && <WindowsSolidProfile />}
            {doc.baseShape === "macos" && <MacColorProfile />}
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
            {doc.baseShape === "windows" && <WindowsGradientProfile />}
            {doc.baseShape === "macos" && <MacGradientProfile />}
            <PresetRow
              onPickSolid={setFolderColor}
              onPickGradientStops={pickGradientStops}
              currentStops={grad.stops}
            />
          </>
        )}

        {mode === "image" && (
          <>
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
          {(doc.baseShape === "windows" || doc.baseShape === "macos") && doc.folderBgImage && (
            <ImageSpan />
          )}
          {doc.folderBgImage && <ImageOverlayControls />}
          </>
        )}

        <FolderMaterialSection />

        {(doc.baseShape === "windows" || doc.baseShape === "macos") && <BackTabColor />}
        {(doc.baseShape === "windows" || doc.baseShape === "macos") &&
          doc.folderState === "contents" && <PaperColorSection />}
      </div>
    </div>
  );
}
