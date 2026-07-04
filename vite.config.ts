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
