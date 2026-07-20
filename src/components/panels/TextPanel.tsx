/**
 * Text panel: add-text plus the full typography editor for the selected text
 * element — content, font (options rendered in their own family), size with
 * auto-fit, bold/italic/underline, alignment, gradient-capable color, stroke
 * (position + 0.5-step width), shadow, letter-spacing + fit, line-height +
 * fit, and transform. Auto-fit ports the legacy binary-search helpers.
 */

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color/ColorField";
import { PanelSection } from "@/components/controls/PanelSection";
import { MaterialControls } from "@/components/controls/MaterialControls";
import { ShadowControls } from "@/components/controls/ShadowControls";
import { SliderField } from "@/components/controls/SliderField";
import { StrokeControls } from "@/components/controls/StrokeControls";
import { TransformFields } from "@/components/controls/TransformFields";
import { FONTS } from "@/lib/constants";
import { autoFitLineHeight, autoFitSize, autoFitSpacing } from "@/lib/textFit";
import {
  beginDocPreview,
  endDocPreview,
  useDocumentStore,
} from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { TextAlign, TextElement } from "@/types/element";
import { PanelHeader } from "./PanelHeader";

/**
 * Content editor that drafts locally inside one preview transaction (ST-04): the
 * canvas still updates live per keystroke, but the whole edit session collapses
 * to a single undo entry on blur — mirroring the NumberField idiom. Escape
 * restores the pre-edit text.
 */
function ContentTextarea({ el }: { el: TextElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  const [draft, setDraft] = useState(el.text);
  const original = useRef(el.text);
  const active = useRef(false);

  // Sync when the text changes from outside (selection change, undo) — but not
  // while we're mid-edit, or we'd clobber the user's draft.
  useEffect(() => {
    if (!active.current) setDraft(el.text);
  }, [el.text]);

  // Flush an open transaction if the panel unmounts before blur.
  useEffect(
    () => () => {
      if (active.current) {
        active.current = false;
        endDocPreview(true);
      }
    },
    [],
  );

  const begin = () => {
    if (active.current) return;
    active.current = true;
    original.current = el.text;
    beginDocPreview();
  };
  const end = (commit: boolean) => {
    if (!active.current) return;
    active.current = false;
    endDocPreview(commit);
  };

  return (
    <Textarea
      value={draft}
      rows={2}
      className="min-h-14 text-xs"
      aria-label="Text content"
      onFocus={begin}
      onChange={(e) => {
        begin();
        setDraft(e.target.value);
        updateElement(el.id, { text: e.target.value });
      }}
      onBlur={() => end(draft !== original.current)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(original.current);
          updateElement(el.id, { text: original.current });
          end(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function FitButton({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 shrink-0 px-2 text-[10px] font-semibold"
      title={label}
      onClick={onClick}
    >
      Fit
    </Button>
  );
}

function SelectedTextEditor({ el }: { el: TextElement }) {
  const updateElement = useDocumentStore((s) => s.updateElement);
  const setFontPreview = useUiStore((s) => s.setFontPreview);

  return (
    <div className="space-y-4">
      <PanelSection title="Content">
        <ContentTextarea el={el} />
      </PanelSection>

      <PanelSection title="Typography">
        <Select
          value={el.fontFamily}
          onValueChange={(v) => {
            setFontPreview(null);
            updateElement(el.id, { fontFamily: v });
          }}
          onOpenChange={(open) => {
            if (!open) setFontPreview(null);
          }}
        >
          <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label="Font family">
            <SelectValue />
          </SelectTrigger>
          {/* Anchor below the trigger (not item-aligned) so the list doesn't
              recenter on the selected font and shift up/down as you browse. */}
          <SelectContent position="popper" side="bottom" sideOffset={4}>
            {FONTS.map((f) => (
              <SelectItem
                key={f}
                value={f}
                className="text-xs"
                style={{ fontFamily: f }}
                // Live-preview the hovered font on the canvas (uiStore.fontPreview),
                // same as the image panel's blend-mode hover. Keyboard focus
                // previews too, so arrowing through the list works the same.
                onPointerEnter={() => setFontPreview(f)}
                onPointerLeave={() => setFontPreview(null)}
                onFocus={() => setFontPreview(f)}
              >
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-end gap-2">
          <SliderField
            label="Size"
            value={el.fontSize}
            min={8}
            max={96}
            onChange={(v) => updateElement(el.id, { fontSize: v })}
            className="flex-1"
          />
          <FitButton
            label="Auto-fit text size to container"
            onClick={() => updateElement(el.id, { fontSize: autoFitSize(el) })}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Toggle
            size="sm"
            className="size-7 p-0 font-bold"
            pressed={el.fontWeight === "700"}
            aria-label="Bold"
            onPressedChange={(on) => updateElement(el.id, { fontWeight: on ? "700" : "400" })}
          >
            B
          </Toggle>
          <Toggle
            size="sm"
            className="size-7 p-0 italic"
            pressed={el.fontStyle === "italic"}
            aria-label="Italic"
            onPressedChange={(on) =>
              updateElement(el.id, { fontStyle: on ? "italic" : "normal" })
            }
          >
            I
          </Toggle>
          <Toggle
            size="sm"
            className="size-7 p-0 underline"
            pressed={el.underline}
            aria-label="Underline"
            onPressedChange={(on) => updateElement(el.id, { underline: on })}
          >
            U
          </Toggle>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={el.align}
            onValueChange={(v) => {
              if (v) updateElement(el.id, { align: v as TextAlign });
            }}
          >
            <ToggleGroupItem value="left" aria-label="Align left" className="size-7 p-0">
              <AlignLeft className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center" className="size-7 p-0">
              <AlignCenter className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right" className="size-7 p-0">
              <AlignRight className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="ml-auto">
            <ColorField
              value={el.color}
              onChange={(v) => updateElement(el.id, { color: v })}
              allowGradient
              ariaLabel="Text color"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <SliderField
            label="Letter spacing"
            value={el.letterSpacing}
            min={-2}
            max={10}
            step={0.5}
            onChange={(v) => updateElement(el.id, { letterSpacing: v })}
            className="flex-1"
          />
          <FitButton
            label="Auto-fit letter spacing"
            onClick={() => {
              const spacing = autoFitSpacing(el);
              if (spacing !== null) updateElement(el.id, { letterSpacing: spacing });
            }}
          />
        </div>

        <div className="flex items-end gap-2">
          <SliderField
            label="Line height"
            value={el.lineHeight}
            min={0.8}
            max={2.5}
            step={0.1}
            onChange={(v) => updateElement(el.id, { lineHeight: v })}
            className="flex-1"
          />
          <FitButton
            label="Auto-fit line height"
            onClick={() => updateElement(el.id, { lineHeight: autoFitLineHeight(el) })}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Clip to box</span>
          <Switch
            checked={el.clip ?? false}
            aria-label="Clip text to box"
            onCheckedChange={(v) => updateElement(el.id, { clip: v })}
          />
        </div>
      </PanelSection>

      <StrokeControls
        enabled={(el.stroke?.width ?? 0) > 0}
        width={el.stroke?.width ?? 2}
        color={el.stroke?.color ?? "#000000"}
        position={el.stroke?.position ?? "outside"}
        widthMin={0.5}
        widthMax={8}
        widthStep={0.5}
        onChange={(patch) => {
          if (patch.enabled === false) {
            updateElement(el.id, { stroke: undefined });
            return;
          }
          updateElement(el.id, {
            stroke: {
              width: patch.width ?? el.stroke?.width ?? 2,
              color: patch.color ?? el.stroke?.color ?? "#000000",
              position: patch.position ?? el.stroke?.position ?? "outside",
            },
          });
        }}
      />

      <ShadowControls
        shadow={el.shadow}
        onChange={(shadow) => updateElement(el.id, { shadow: shadow ?? undefined })}
      />

      <MaterialControls el={el} />

      <TransformFields el={el} />
    </div>
  );
}

export function TextPanel() {
  const addText = useDocumentStore((s) => s.addText);
  const select = useSelectionStore((s) => s.select);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const el = useDocumentStore((s) =>
    s.doc.elements.find((e) => e.id === selectedId && e.type === "text"),
  ) as TextElement | undefined;

  return (
    <div>
      <PanelHeader title="Text" />
      <div className="space-y-4 p-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs"
          onClick={() => select(addText())}
        >
          <Plus className="size-3.5" /> Add Text Element
        </Button>
        {el ? (
          <SelectedTextEditor el={el} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Add a text element, or select one on the folder to edit it.
          </p>
        )}
      </div>
    </div>
  );
}
