/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves this project at https://abyanba.github.io/folder-studio/
// so assets must be resolved under the /folder-studio/ base path.
export default defineConfig({
  base: "/folder-studio/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    /**
     * The default `threads` pool silently DROPS test files here — successive
     * runs reported 42, 47, 49 and 50 of the 50 files, all exiting 0, so a run
     * could "pass" having skipped a fifth of the suite and coverage thresholds
     * would swing several points between runs for no code change.
     *
     * `forks` is stable across repeated runs and keeps file parallelism, so it
     * costs nothing but a little process startup. Do not switch back without
     * checking `Test Files N passed (N)` is the same N several runs running.
     */
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/data/generated/**", // baked assets
        "src/components/ui/**", // vendored shadcn primitives
        "src/dev/**", // dev-only harness
        "src/test/**",
        "src/**/*.test.*",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/types/**", // type declarations (trivial guards only)
        // Browser-only canvas pipeline: jsdom can't rasterize SVG→Image.
        // Verified in real Chrome via the dev harness + Phase-8 QA instead.
        "src/lib/export/renderCanvas.ts",
        "src/lib/export/exporters.ts",
        "src/lib/export/exportPrep.ts", // browser-only (document.fonts)
        "src/lib/export/svgFonts.ts", // browser-only (stylesheet inspection + fetch)
        "src/lib/importImage.ts", // browser-only (canvas raster) — fitWithin is tested in importImage.test
        "src/lib/imageColor.ts", // browser-only (Image decode + canvas pixel sampling)
        "src/lib/projectActions.ts", // browser-only glue (download + File.text) — parseProject/serializeProject are tested
        "src/lib/compose-refs.ts", // vendored (diceui sortable dependency)
      ],
      // Thresholds are enforced so coverage regressions fail the run;
      // values set from the Phase-7 baseline (see the migration plan).
      thresholds: {
        lines: 75,
        functions: 75,
        statements: 75,
        branches: 65,
        "src/lib/**": { lines: 90, statements: 90 },
        "src/store/**": { lines: 90, statements: 90 },
      },
    },
  },
});
