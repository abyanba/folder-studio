import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Dev-only export-engine harness (Phase 3). Reached at `?harness=export`;
// lazy-loaded so it never lands in the production bundle. Removed at the Phase-4 cutover.
const harness =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get("harness");

async function render() {
  if (harness === "export") {
    const { ExportHarness } = await import("./dev/exportHarness.tsx");
    return <ExportHarness />;
  }
  return <App />;
}

render().then((node) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{node}</StrictMode>,
  );
});
