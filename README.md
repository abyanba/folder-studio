# Folder Studio

**Live:** https://abyanba.github.io/folder-studio/

A browser-based folder icon creator. Design custom folder icons with colors, gradients, images, text, shapes, textures, and drawings — then export as PNG, SVG, or ICO.

**Live app:** `project/index-standalone.html` — open it directly in any browser, no server needed.

## Features

- **Color** — solid colors or multi-stop gradients (Figma-style drag handles), 12 built-in presets, save custom gradients
- **Image** — upload raster images or pick from a built-in SVG icon library (Documents, Media, Dev, Games)
- **Text** — full typography controls: font family, size, weight, spacing, stroke, shadow, alignment
- **Draw** — freehand pen, eraser, line, and arc tools with Chaikin smoothing
- **Shapes** — rectangle, ellipse, triangle, star, hexagon with fill/stroke controls
- **Texture** — 15 pattern overlays (stripes, dots, grid, chevron, waves, etc.) with opacity/scale
- **Layers** — drag-to-reorder, visibility toggle, lock, rename
- **Gallery** — save and restore design snapshots (persists in localStorage)
- **Export** — PNG/SVG/ICO at 64/128/256/512px, batch ZIP export

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+V | Copy / Paste selected element |
| Backspace / Delete | Remove selected element |
| Escape | Deselect |

## Files

```
project/
  index-standalone.html   ← USE THIS — fully self-contained, no dependencies
  index.html              ← same app but requires folder-base.png alongside it
  folder-base.png         ← base folder image (used by index.html)
```

## Deployment

### GitHub Pages
1. Go to repo **Settings → Pages**
2. Set source to branch `main`, folder `/project`
3. Your app will be at `https://<user>.github.io/folder-studio/index-standalone.html`

### Anywhere else
Just upload `project/index-standalone.html` — it's a single file with no dependencies.
