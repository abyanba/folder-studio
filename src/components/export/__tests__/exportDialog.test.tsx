/**
 * ExportDialog wiring (Phase 7): single-mode exporter dispatch with the
 * chosen size/format, batch-mode size/format toggles incl. the min-one-format
 * guard. The Phase-3 exporters are mocked — their own logic is covered by the
 * export test suites; renderCanvas is browser-only.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "@/components/export/ExportDialog";
import { useDocumentStore } from "@/store/documentStore";

const mocks = vi.hoisted(() => ({
  ICO_SIZES: [16, 32, 48, 64, 128, 256],
  exportPng: vi.fn(async (_doc: unknown, _size: number) => ({ blob: new Blob(["png"]), skipped: [] })),
  exportSvg: vi.fn(async (_doc: unknown, _size: number) => ({ blob: new Blob(["svg"]), skipped: [] })),
  exportIcoMulti: vi.fn(async (_doc: unknown, _sizes: number[]) => ({ blob: new Blob(["ico"]), skipped: [] })),
  batchExportZip: vi.fn(
    async (_doc: unknown, _sizes: number[], _formats: string[]) => ({
      blob: new Blob(["zip"]),
      skipped: [],
    }),
  ),
  downloadBlob: vi.fn(),
}));

vi.mock("@/lib/export/exporters", () => mocks);

beforeEach(() => {
  useDocumentStore.getState().reset();
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function") (m as { mockClear: () => void }).mockClear();
  });
});

async function openDialog() {
  const user = userEvent.setup();
  render(<ExportDialog />);
  await user.click(screen.getByRole("button", { name: "Export" }));
  return user;
}

describe("single export", () => {
  it("downloads a PNG at the default 256", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(mocks.exportPng).toHaveBeenCalledTimes(1);
    expect(mocks.exportPng.mock.calls[0][1]).toBe(256);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "folder-icon-256.png");
  });

  it("respects the chosen size and format", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("combobox", { name: /size/i }));
    await user.click(screen.getByRole("option", { name: "512×512" }));
    await user.click(screen.getByRole("combobox", { name: /format/i }));
    await user.click(screen.getByRole("option", { name: "SVG" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(mocks.exportSvg).toHaveBeenCalledTimes(1);
    expect(mocks.exportSvg.mock.calls[0][1]).toBe(512);
    expect(mocks.exportPng).not.toHaveBeenCalled();
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "folder-icon-512.svg");
  });

  it("exports ICO as one multi-resolution file (EXP-08 / Phase 8)", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("combobox", { name: /format/i }));
    await user.click(screen.getByRole("option", { name: "ICO" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(mocks.exportIcoMulti).toHaveBeenCalledTimes(1);
    // Packs the standard set of resolutions (all ≤256) into a single .ico.
    expect(mocks.exportIcoMulti.mock.calls[0][1]).toEqual([16, 32, 48, 64, 128, 256]);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "folder-icon.ico");
  });
});

describe("batch export", () => {
  it("passes the toggled sizes and formats to batchExportZip", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("tab", { name: /batch/i }));

    // Drop 64, add SVG alongside the default PNG. (Format labels are
    // lowercase in the DOM — the uppercase is CSS.)
    await user.click(screen.getByRole("button", { name: "64" }));
    await user.click(screen.getByRole("button", { name: /^svg$/i }));
    await user.click(screen.getByRole("button", { name: "Export .zip" }));

    expect(mocks.batchExportZip).toHaveBeenCalledTimes(1);
    const [, sizes, formats] = mocks.batchExportZip.mock.calls[0];
    expect(sizes).toEqual([128, 256, 512]);
    expect(formats).toEqual(["png", "svg"]);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "folder-icons.zip");
  });

  it("cannot deselect the last format", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("tab", { name: /batch/i }));
    await user.click(screen.getByRole("button", { name: /^png$/i })); // last one → ignored
    await user.click(screen.getByRole("button", { name: "Export .zip" }));
    const [, , formats] = mocks.batchExportZip.mock.calls[0];
    expect(formats).toEqual(["png"]);
  });

  it("disables export when no size is selected", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("tab", { name: /batch/i }));
    for (const s of ["64", "128", "256", "512"]) {
      await user.click(screen.getByRole("button", { name: s }));
    }
    expect(screen.getByRole("button", { name: "Export .zip" })).toBeDisabled();
    expect(mocks.batchExportZip).not.toHaveBeenCalled();
  });
});
