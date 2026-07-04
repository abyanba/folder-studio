/**
 * Layers panel: top-first list of elements with the texture as a pseudo-row,
 * drag-sortable via the DiceUI/dnd-kit Sortable. Dropping applies the whole
 * order (elements + textureLayerZ) as one undo entry through
 * `applyLayerOrder`. Rows support click/ctrl/shift selection, double-click
 * rename, visibility/lock toggles, and delete — ported from the legacy layers
 * panel (docs/index.html L1710-1813).
 */

import { useState, type MouseEvent } from "react";
import { Eye, EyeOff, GripVertical, Lock, LockOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/components/ui/sortable";
import { buildDrawSvg, buildShapeSvg } from "@/lib/export/elementSvg";
import { getIconBody, useIconCacheVersion } from "@/lib/iconify";
import { getHex } from "@/lib/color";
import { TEXTURES } from "@/lib/export/textures";
import { isGradient } from "@/types/gradient";
import { useDocumentStore } from "@/store/documentStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { FolderElement } from "@/types/element";
import { cn } from "@/lib/utils";
import { PanelHeader } from "./PanelHeader";

const TEXTURE_KEY = "__texture__";

export function getElementLabel(el: FolderElement): string {
  if (el.type === "text") {
    const t = el.text.trim();
    if (el.name === "Text" && t) return t.slice(0, 18);
  }
  return el.name;
}

function LayerThumb({ el }: { el: FolderElement }) {
  useIconCacheVersion();
  const cls = "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40";
  if (el.type === "image") {
    return <img src={el.src} alt="" className={cn(cls, "object-contain")} />;
  }
  if (el.type === "text") {
    return <div className={cn(cls, "text-[11px] font-bold text-muted-foreground")}>T</div>;
  }
  if (el.type === "shape") {
    return (
      <div className={cls} dangerouslySetInnerHTML={{ __html: buildShapeSvg(el, 22, 22) }} />
    );
  }
  if (el.type === "draw") {
    return (
      <div className={cls} dangerouslySetInnerHTML={{ __html: buildDrawSvg(el, 22, 22) }} />
    );
  }
  const body = getIconBody(el.iconName, el.iconVariant);
  if (!body) return <div className={cls} />;
  const tint = isGradient(el.color)
    ? getHex(el.color.stops[0]?.hue ?? 0, el.color.stops[0]?.sat ?? 0, el.color.stops[0]?.bri ?? 1)
    : el.color;
  const vw = body.width ?? 256;
  const vh = body.height ?? 256;
  return (
    <div
      className={cls}
      dangerouslySetInnerHTML={{
        __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="width:16px;height:16px">${body.body.replace(/currentColor/g, tint)}</svg>`,
      }}
    />
  );
}

function ElementRow({ el, displayKeys }: { el: FolderElement; displayKeys: string[] }) {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selected = selectedIds.includes(el.id);
  const editing = useUiStore((s) => s.editingLayerName === el.id);
  const [draft, setDraft] = useState(el.name);

  const onRowClick = (e: MouseEvent) => {
    const sel = useSelectionStore.getState();
    if (e.ctrlKey || e.metaKey) {
      sel.toggle(el.id);
      return;
    }
    if (e.shiftKey && sel.selectedId) {
      const keys = displayKeys.filter((k) => k !== TEXTURE_KEY);
      const a = keys.indexOf(sel.selectedId);
      const b = keys.indexOf(el.id);
      if (a !== -1 && b !== -1) {
        sel.setMany(keys.slice(Math.min(a, b), Math.max(a, b) + 1));
        return;
      }
    }
    sel.select(el.id);
  };

  const commitRename = () => {
    useUiStore.getState().setEditingLayerName(null);
    const name = draft.trim();
    if (name && name !== el.name) {
      useDocumentStore.getState().updateElement(el.id, { name });
    }
  };

  return (
    <div
      className={cn(
        "group flex h-9 items-center gap-1.5 rounded-md border px-1.5 text-xs transition-colors",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-transparent bg-muted/30 hover:bg-muted/60",
      )}
      onClick={onRowClick}
    >
      <SortableItemHandle
        className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
        aria-label={`Reorder ${getElementLabel(el)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </SortableItemHandle>
      <LayerThumb el={el} />
      {editing ? (
        <Input
          autoFocus
          value={draft}
          className="h-6 flex-1 px-1 text-xs"
          aria-label="Layer name"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") {
              setDraft(el.name);
              useUiStore.getState().setEditingLayerName(null);
            }
          }}
        />
      ) : (
        <span
          className={cn("min-w-0 flex-1 truncate", el.visible === false && "opacity-50")}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(el.name);
            useUiStore.getState().setEditingLayerName(el.id);
          }}
        >
          {getElementLabel(el)}
        </span>
      )}
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 data-show:opacity-100" data-show={selected || el.locked || el.visible === false || undefined}>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={el.visible === false ? "Show layer" : "Hide layer"}
          onClick={(e) => {
            e.stopPropagation();
            useDocumentStore.getState().toggleVisible(el.id);
          }}
        >
          {el.visible === false ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={el.locked ? "Unlock layer" : "Lock layer"}
          onClick={(e) => {
            e.stopPropagation();
            useDocumentStore.getState().toggleLock(el.id);
          }}
        >
          {el.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive"
          aria-label={`Delete ${getElementLabel(el)}`}
          onClick={(e) => {
            e.stopPropagation();
            useDocumentStore.getState().removeElements([el.id]);
            useSelectionStore.getState().clear();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function TextureRow({ textureId }: { textureId: string }) {
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const name = TEXTURES.find((t) => t.id === textureId)?.name ?? textureId;
  return (
    <div
      className="group flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border/60 bg-muted/20 px-1.5 text-xs hover:bg-muted/50"
      onClick={() => setActivePanel("texture")}
    >
      <SortableItemHandle
        className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground"
        aria-label="Reorder texture layer"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </SortableItemHandle>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{name}</span>
      <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
        base
      </Badge>
    </div>
  );
}

export function LayersPanel() {
  const doc = useDocumentStore((s) => s.doc);
  const applyLayerOrder = useDocumentStore((s) => s.applyLayerOrder);

  const hasTexture = doc.texture.id !== "none";
  const tz = Math.min(doc.textureLayerZ, doc.elements.length);
  const topFirst = [...doc.elements].reverse();
  const keys: string[] = topFirst.map((e) => e.id);
  if (hasTexture) keys.splice(doc.elements.length - tz, 0, TEXTURE_KEY);
  const byId = new Map(doc.elements.map((e) => [e.id, e]));

  return (
    <div>
      <PanelHeader title="Layers" />
      <div className="p-3">
        {keys.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No layers yet — add images, icons, text, or shapes.
          </p>
        ) : (
          <Sortable
            value={keys}
            onValueChange={(next) => applyLayerOrder(next)}
            orientation="vertical"
          >
            <SortableContent className="flex flex-col gap-1">
              {keys.map((key) => (
                <SortableItem key={key} value={key}>
                  {key === TEXTURE_KEY ? (
                    <TextureRow textureId={doc.texture.id} />
                  ) : (
                    <ElementRow el={byId.get(key)!} displayKeys={keys} />
                  )}
                </SortableItem>
              ))}
            </SortableContent>
          </Sortable>
        )}
      </div>
    </div>
  );
}
