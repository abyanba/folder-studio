/**
 * RTL wiring tests for the 5a control/color components (jsdom): SliderField
 * commit behavior via keyboard, PresetRow persistence, and ColorField's
 * solid↔gradient conversion.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SliderField } from "@/components/controls/SliderField";
import { ColorField } from "@/components/color/ColorField";
import { PresetRow } from "@/components/color/PresetRow";
import { usePresetsStore } from "@/store/presetsStore";
import { DEFAULT_PRESETS } from "@/lib/constants";
import { isGradient, type ColorValue, type Gradient } from "@/types/gradient";

beforeEach(() => {
  localStorage.clear();
  usePresetsStore.setState({
    defaultPresets: [...DEFAULT_PRESETS],
    customPresets: [],
    savedGradients: [],
    hiddenGradPresets: [],
  });
});

describe("SliderField", () => {
  it("renders label + formatted value and commits keyboard steps", () => {
    const onChange = vi.fn();
    render(
      <SliderField
        label="Opacity"
        value={0.5}
        min={0.05}
        max={1}
        step={0.05}
        onChange={onChange}
        format={(v) => `${Math.round(v * 100)}%`}
      />,
    );
    expect(screen.getByText("Opacity")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    const thumb = screen.getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(expect.closeTo(0.55, 5));
  });
});

describe("PresetRow", () => {
  it("picks a default swatch and removes one persistently", async () => {
    const user = userEvent.setup();
    const onPickSolid = vi.fn();
    render(<PresetRow onPickSolid={onPickSolid} />);

    await user.click(screen.getByRole("button", { name: DEFAULT_PRESETS[0] }));
    expect(onPickSolid).toHaveBeenCalledWith(DEFAULT_PRESETS[0]);

    await user.click(
      screen.getByRole("button", { name: `Remove ${DEFAULT_PRESETS[0]}` }),
    );
    expect(usePresetsStore.getState().defaultPresets).not.toContain(DEFAULT_PRESETS[0]);
    expect(JSON.parse(localStorage.getItem("fs_default_presets")!)).not.toContain(
      DEFAULT_PRESETS[0],
    );
  });

  it("saves the current color once", async () => {
    const user = userEvent.setup();
    render(<PresetRow onPickSolid={() => {}} currentHex="#123456" />);
    await user.click(screen.getByRole("button", { name: "Save color" }));
    expect(usePresetsStore.getState().customPresets).toEqual(["#123456"]);
  });
});

describe("ColorField", () => {
  it("converts solid → gradient via the tab and back", async () => {
    const user = userEvent.setup();
    let value: ColorValue = "#ff0000";
    const onChange = vi.fn((v: ColorValue) => {
      value = v;
    });

    const { rerender } = render(
      <ColorField value={value} onChange={onChange} allowGradient ariaLabel="Fill color" />,
    );

    await user.click(screen.getByRole("button", { name: "Fill color" }));
    await user.click(screen.getByRole("tab", { name: "Gradient" }));

    expect(onChange).toHaveBeenCalled();
    if (!isGradient(value)) throw new Error("expected a gradient value");
    const grad: Gradient = value;
    expect(grad.stops).toHaveLength(2);
    expect(grad.stops[0].hue).toBeCloseTo(0);

    rerender(
      <ColorField value={value} onChange={onChange} allowGradient ariaLabel="Fill color" />,
    );
    await user.click(screen.getByRole("tab", { name: "Solid" }));
    expect(typeof value).toBe("string");
    expect(value).toBe("#ff0000");
  });

  it("hides the gradient tab when gradients aren't allowed", async () => {
    const user = userEvent.setup();
    render(<ColorField value="#00ff00" onChange={() => {}} ariaLabel="Stroke color" />);
    await user.click(screen.getByRole("button", { name: "Stroke color" }));
    expect(screen.queryByRole("tab", { name: "Gradient" })).toBeNull();
    // Solid picker + format input render.
    expect(screen.getByRole("textbox", { name: "Color value" })).toBeInTheDocument();
  });
});
