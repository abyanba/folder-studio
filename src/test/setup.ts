import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees after every test to keep the DOM clean between cases.
afterEach(() => {
  cleanup();
});

// jsdom lacks ResizeObserver; Radix Slider (and friends) require it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
