import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees after every test to keep the DOM clean between cases.
afterEach(() => {
  cleanup();
});

// jsdom lacks pointer capture; the draw/gradient drag handlers call it.
// (Guarded: pure lib tests run in the node environment with no HTMLElement.)
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
}

// jsdom lacks scrollIntoView; Radix Select calls it when opening.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom lacks ResizeObserver; Radix Slider (and friends) require it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
