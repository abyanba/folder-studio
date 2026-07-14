/**
 * Folder-panel behaviors (5b): base-shape defaults as one undo entry, fill
 * mode switching that preserves the uploaded image, texture selection/adjust,
 * and the image-pan math.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShapePanel } from "@/components/panels/ShapePanel";
import { TexturePanel } from "@/components/panels/TexturePanel";
import { ColorPanel } from "@/components/panels/ColorPanel";
import { useDocumentStore } from "@/store/documentStore";
import { useUiStore } from "@/store/uiStore";
import { computeImagePan } from "@/lib/imagePan";
import { getHex } from "@/lib/color";
import { isGradient } from "@/types/gradient";

const temporal = () => useDocumentStore.temporal.getState();

beforeEach(() => {
  useDocumentStore.getState().reset();
  temporal().clear();
  useUiStore.setState({ windowsGradientPreview: null });
});

describe("ShapePanel", () => {
  it("applies a shape with its defaults as one undo entry", async () => {
    const user = userEvent.setup();
    render(<ShapePanel />);
    const baseline = temporal().pastStates.length;

    await user.click(screen.getByRole("button", { name: /macOS/i }));

    const doc = useDocumentStore.getState().doc;
    expect(doc.baseShape).toBe("macos");
    expect(doc.clipToFolder).toBe(true);
    expect(doc.folderColor).toBe(getHex(203, 0.6, 0.86));
    expect(temporal().pastStates.length).toBe(baseline + 1);

    // Windows applies its own defaults (the picker is trimmed to Windows/macOS).
    await user.click(screen.getByRole("button", { name: /Windows/i }));
    expect(useDocumentStore.getState().doc.baseShape).toBe("windows");
    expect(useDocumentStore.getState().doc.folderColor).toBe(getHex(43, 0.81, 1));
  });
});

describe("ColorPanel fill modes", () => {
  it("switches solid → gradient → solid, preserving a sensible color", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />);

    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    let doc = useDocumentStore.getState().doc;
    expect(isGradient(doc.folderColor)).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Solid" }));
    doc = useDocumentStore.getState().doc;
    expect(doc.folderColor).toBe("#f5c542"); // first stop = the original solid
  });

  it("shows a Windows solid color-profile dropdown (Authentic default) that commits + previews", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />);

    // Windows solid default profile is Authentic (official).
    expect(screen.getByText("Color profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Authentic/ }));

    const popped = screen.getByRole("menuitem", { name: "Popped" });
    fireEvent.mouseEnter(popped);
    expect(useUiStore.getState().windowsColorProfilePreview).toBe("popped");
    expect(useDocumentStore.getState().doc.windowsColorProfile).toBe("official"); // not committed
    fireEvent.mouseLeave(popped);
    expect(useUiStore.getState().windowsColorProfilePreview).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Flat" }));
    expect(useDocumentStore.getState().doc.windowsColorProfile).toBe("flat");
  });

  it("shows the Windows gradient color-profile dropdown (Refined default) on a gradient fill", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />);

    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    expect(screen.getByText("Color profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refined/ }));

    // Hovering an option live-previews it (without committing).
    const echoItem = screen.getByRole("menuitem", { name: "Echo" });
    fireEvent.mouseEnter(echoItem);
    expect(useUiStore.getState().windowsGradientPreview).toBe("echo");
    expect(useDocumentStore.getState().doc.windowsGradientAlgo).toBe("best"); // not committed
    fireEvent.mouseLeave(echoItem);
    expect(useUiStore.getState().windowsGradientPreview).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Deep tab" }));
    expect(useDocumentStore.getState().doc.windowsGradientAlgo).toBe("current");
    expect(useUiStore.getState().windowsGradientPreview).toBeNull(); // cleared on commit
  });

  it("offers the macOS color-profile dropdown (its own options) on a solid fill", async () => {
    const user = userEvent.setup();
    useDocumentStore.getState().setBaseShape("macos");
    render(<ColorPanel />);

    // macOS shows its profile dropdown even in solid mode, defaulting to Refined.
    expect(screen.getByText("Color profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Refined/ }));

    // Hovering live-previews via the macOS preview slot (not the Windows one).
    const authentic = screen.getByRole("menuitem", { name: "Authentic" });
    fireEvent.mouseEnter(authentic);
    expect(useUiStore.getState().macColorProfilePreview).toBe("official");
    expect(useDocumentStore.getState().doc.macColorProfile).toBe("best"); // not committed
    fireEvent.mouseLeave(authentic);
    expect(useUiStore.getState().macColorProfilePreview).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: "Flat" }));
    expect(useDocumentStore.getState().doc.macColorProfile).toBe("flat");
    expect(useUiStore.getState().macColorProfilePreview).toBeNull(); // cleared on commit
  });

  it("offers the Windows Image-span dropdown for an image fill and switches to front-only", async () => {
    const user = userEvent.setup();
    // An image already present (with its adaptive color captured).
    useDocumentStore.getState().setFolderFill({
      folderBgImage: "data:image/png;base64,x",
      folderFillMode: "image",
      folderBgImageColor: "#0098a5",
    });
    render(<ColorPanel />);

    expect(screen.getByText("Image span")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Full folder/ }));
    await user.click(screen.getByRole("menuitem", { name: "Front only" }));
    expect(useDocumentStore.getState().doc.windowsImageMode).toBe("front");
  });

  it("shows the image overlay controls and adjusts the tint opacity", async () => {
    const user = userEvent.setup();
    useDocumentStore.getState().setFolderFill({
      folderBgImage: "data:image/png;base64,x",
      folderFillMode: "image",
    });
    render(<ColorPanel />);

    expect(screen.getByText("Overlay")).toBeInTheDocument();
    // Type a value into the opacity readout (click-to-edit) and commit.
    await user.click(screen.getByRole("button", { name: "0%" }));
    const input = screen.getByRole("spinbutton", { name: "Overlay opacity value" });
    await user.clear(input);
    await user.type(input, "0.5");
    await user.keyboard("{Enter}");
    expect(useDocumentStore.getState().doc.folderBgOverlayOpacity).toBe(0.5);
  });

  it("toggles the Windows custom back color on and off (seeding from Auto)", async () => {
    const user = userEvent.setup();
    render(<ColorPanel />); // default base shape is windows, solid fill
    expect(screen.getByText("Back (tab)")).toBeInTheDocument();
    expect(useDocumentStore.getState().doc.folderBackColor).toBeNull();

    await user.click(screen.getByRole("switch", { name: "Custom back color" }));
    // Turning Custom on seeds a concrete tab color (not null).
    expect(useDocumentStore.getState().doc.folderBackColor).toMatch(/^#[0-9a-f]{6}$/i);

    await user.click(screen.getByRole("switch", { name: "Custom back color" }));
    expect(useDocumentStore.getState().doc.folderBackColor).toBeNull();
  });

  it("disables the back-color switch in full image mode", () => {
    useDocumentStore.getState().setFolderFill({
      folderBgImage: "data:image/png;base64,x",
      folderFillMode: "image",
    });
    useDocumentStore.getState().setWindowsImageMode("full");
    render(<ColorPanel />);
    expect(screen.getByRole("switch", { name: "Custom back color" })).toBeDisabled();
    expect(screen.getByText(/Front only/)).toBeInTheDocument();
  });

  it("keeps the uploaded image when leaving image mode", () => {
    const { setFolderFill } = useDocumentStore.getState();
    setFolderFill({ folderBgImage: "data:image/png;base64,x", folderFillMode: "image" });
    setFolderFill({ folderFillMode: "color", folderColor: "#112233" });

    const doc = useDocumentStore.getState().doc;
    expect(doc.folderBgImage).toBe("data:image/png;base64,x");
    expect(doc.folderFillMode).toBe("color");
  });
});

describe("TexturePanel", () => {
  it("selects a texture, then opens adjust on second click", async () => {
    const user = userEvent.setup();
    render(<TexturePanel />);

    await user.click(screen.getByRole("button", { name: "Polka Dots" }));
    expect(useDocumentStore.getState().doc.texture.id).toBe("dots");

    await user.click(screen.getByRole("button", { name: "Polka Dots" }));
    expect(screen.getByText("Adjust Texture")).toBeInTheDocument();

    // Scatter texture → randomize toggles a non-zero seed, reroll changes it.
    await user.click(screen.getByRole("button", { name: /Randomize/i }));
    const seed1 = useDocumentStore.getState().doc.texture.seed;
    expect(seed1).not.toBe(0);
  });

  it("search filters the grid", async () => {
    const user = userEvent.setup();
    render(<TexturePanel />);
    await user.type(screen.getByRole("textbox", { name: "Search textures" }), "zig");
    expect(screen.getByRole("button", { name: "Zigzag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Polka Dots" })).toBeNull();
  });
});

describe("computeImagePan", () => {
  it("is inert at zoom 1", () => {
    expect(
      computeImagePan({ dx: 50, dy: 50, width: 200, height: 200, zoom: 1, startX: 50, startY: 50 }),
    ).toEqual({ x: 50, y: 50 });
  });

  it("pans opposite the pointer delta and clamps to 0..100", () => {
    const r = computeImagePan({
      dx: 100,
      dy: -100,
      width: 200,
      height: 200,
      zoom: 2,
      startX: 50,
      startY: 50,
    });
    expect(r.x).toBe(0); // 50 - (100/200)*100*(1/2)*2 = 0
    expect(r.y).toBe(100);

    const clamped = computeImagePan({
      dx: 1000,
      dy: 0,
      width: 200,
      height: 200,
      zoom: 2,
      startX: 50,
      startY: 50,
    });
    expect(clamped.x).toBe(0);
  });
});
