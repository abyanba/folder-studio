# Folder Studio

**Live:** https://abyanba.github.io/folder-studio/

A browser-based folder icon creator. Design custom folder icons with colors, gradients, images, icons, logos, text, shapes, textures, and freehand drawings — then export as PNG, SVG, or ICO. Fully offline once loaded: icon artwork and fonts are bundled, nothing is fetched at runtime.

## Features

- **Base shapes** — 11 folder silhouettes (Windows, macOS, glass, file, and more), each with tuned default colors
- **Color** — solid colors or multi-stop linear/radial gradients, preset palettes, save custom colors and gradients
- **Images** — upload raster images with blend modes, stroke, and drop shadow; use one as the folder fill with crop/zoom
- **Icons** — 200+ Phosphor icons in 6 styles, tintable with solid colors or gradients
- **Logos** — brand logos in mono (tinted) or full color
- **Text** — full typography: 20 bundled font families, size/spacing/line-height with auto-fit, stroke, shadow, gradient fill
- **Draw** — freehand pen, line, and arc tools with Chaikin smoothing, plus an eraser
- **Shapes** — rectangle, ellipse, triangle, star, hexagon with fill/stroke/shadow controls
- **Texture** — 30+ pattern overlays with opacity/scale/rotation and seeded randomization
- **Layers** — drag-to-reorder (texture layer included), visibility, lock, rename
- **Multi-select** — marquee or shift-click, then edit shared properties at once
- **Gallery** — save and restore design snapshots (localStorage; designs from the legacy app still load)
- **Export** — PNG/SVG/ICO at 64–1024px, batch ZIP export of any size/format combination

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+V | Copy / Paste selected element |
| Ctrl+D | Duplicate selected element |
| Arrow keys | Nudge selection (Shift = ×10) |
| Backspace / Delete | Remove selected element |
| Escape | Deselect / cancel drawing |

## Development

Vite + React + TypeScript, state in Zustand (undo/redo via zundo), UI on shadcn/ui + Tailwind.

```sh
npm install
npm run dev             # dev server at http://localhost:5173/folder-studio/
npm test                # Vitest + React Testing Library
npm run test:coverage   # coverage-gated test run (CI uses this)
npm run build           # type-check + production build into dist/
npx oxlint src scripts  # lint
npm run generate:icons  # re-bake icon/logo assets into src/data/generated/
```

## Deployment

Pushes to `main` run CI (lint, tests with coverage thresholds, build) and deploy `dist/` to GitHub Pages via GitHub Actions — see `.github/workflows/ci.yml`.

The previous single-file version of the app is archived at [`/legacy.html`](https://abyanba.github.io/folder-studio/legacy.html) (`public/legacy.html` in the repo).
