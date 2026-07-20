/**
 * FolderBase rendering: the colored base-shape SVG, the image-fill path with
 * its shading overlay, and the Windows gradient color-profile hover preview
 * (uiStore.windowsGradientPreview overrides the doc's profile without
 * committing it).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FolderBase } from "@/components/workspace/FolderBase";
import { useUiStore } from "@/store/uiStore";
import { createEmptyDocument } from "@/types/document";
import type { FolderDocument } from "@/types/document";
import type { Gradient } from "@/types/gradient";

const gradient: Gradient = {
  kind: "linear",
  angle: 90,
  stops: [
    { id: "a", pos: 0, hue: 0, sat: 1, bri: 1 },
    { id: "b", pos: 1, hue: 240, sat: 1, bri: 1 },
  ],
};

function doc(patch: Partial<FolderDocument>): FolderDocument {
  return { ...createEmptyDocument(), ...patch };
}

beforeEach(() => {
  useUiStore.setState({ windowsGradientPreview: null });
});

describe("FolderBase", () => {
  it("renders the colored base-shape SVG for a color fill", () => {
    const { container } = render(<FolderBase doc={doc({ folderColor: "#ff0000" })} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders the masked image plus the shading overlay for a full image fill", () => {
    const { container } = render(
      <FolderBase
        doc={doc({
          folderFillMode: "image",
          folderBgImage: "data:image/png;base64,x",
          folderOpacity: 0.5,
          windowsImageMode: "full",
        })}
      />,
    );
    // Masked bg div + the windows overlay svg (dark back mask).
    const masked = container.querySelector('div[style*="mask"]');
    expect(masked).not.toBeNull();
    expect(container.innerHTML).toContain("wvm");
  });

  it("renders an adaptive back + front-masked image for a front-only image fill", () => {
    const { container } = render(
      <FolderBase
        doc={doc({
          folderFillMode: "image",
          folderBgImage: "data:image/png;base64,x",
          folderBgImageColor: "#0098a5",
          windowsImageMode: "front",
        })}
      />,
    );
    // Adaptive back gradient (wbg) + shine (wsh); NOT the full-mode dark mask (wvm).
    expect(container.innerHTML).toContain("wbg");
    expect(container.innerHTML).toContain("wsh");
    expect(container.innerHTML).not.toContain("wvm");
  });

  it("live-previews the hovered gradient color profile without a commit", () => {
    const d = doc({ folderColor: gradient, windowsGradientAlgo: "best" });
    const { container, rerender } = render(<FolderBase doc={d} />);
    const baseline = container.querySelector("div[aria-hidden]")?.innerHTML;

    // Hovering "current" in the panel sets the preview → base re-renders differently.
    useUiStore.getState().setWindowsGradientPreview("current");
    rerender(<FolderBase doc={d} />);
    const previewed = container.querySelector("div[aria-hidden]")?.innerHTML;
    expect(previewed).not.toBe(baseline);

    // Clearing the preview restores the doc's own profile.
    useUiStore.getState().setWindowsGradientPreview(null);
    rerender(<FolderBase doc={d} />);
    expect(container.querySelector("div[aria-hidden]")?.innerHTML).toBe(baseline);
  });

  it("ignores the preview for a non-Windows base shape", () => {
    const d = doc({ baseShape: "macos", folderColor: gradient });
    const { container, rerender } = render(<FolderBase doc={d} />);
    const before = container.querySelector("div[aria-hidden]")?.innerHTML;
    useUiStore.getState().setWindowsGradientPreview("echo");
    rerender(<FolderBase doc={d} />);
    expect(container.querySelector("div[aria-hidden]")?.innerHTML).toBe(before);
  });
});
