// @vitest-environment node
/**
 * Local-first icon resolution (Phase 6): Phosphor / mono-logo / color-logo
 * bodies resolve from the baked asset modules with NO network — fetch is
 * mocked to throw to prove it. The REST fallback only fires for Phosphor
 * names outside the baked subset.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetIconCacheForTests,
  getColorLogoBody,
  getColorLogoDarkBody,
  getIconBody,
  iconStatus,
  isIconPending,
  phCacheKey,
  requestColorLogos,
  requestColorLogosDark,
  requestMonoLogos,
  requestPhosphorIcons,
  retryIcon,
} from "@/lib/iconify";
import { COLOR_LOGO_DARK_NAMES } from "@/data/generated/colorLogoDarkNames";
import { MONO_LOGO_NAMES } from "@/data/generated/monoLogoNames";

const fetchMock = vi.fn();

beforeEach(() => {
  __resetIconCacheForTests();
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("offline — no network allowed"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("phCacheKey", () => {
  it("suffixes non-regular variants only", () => {
    expect(phCacheKey("house", "regular")).toBe("house");
    expect(phCacheKey("house", "bold")).toBe("house-bold");
  });
});

describe("baked Phosphor icons (offline)", () => {
  it("resolves catalog names in every variant without touching the network", async () => {
    await requestPhosphorIcons(["house", "star"], "regular");
    await requestPhosphorIcons(["house"], "duotone");

    expect(getIconBody("house", "regular")?.body).toContain("<path");
    expect(getIconBody("house", "regular")?.width).toBe(256);
    expect(getIconBody("star", "regular")).not.toBeNull();
    expect(getIconBody("house", "duotone")).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the fixed catalog names (legacy dead entries)", async () => {
    await requestPhosphorIcons(
      ["wifi-high", "stack-simple", "diamonds-four", "frame-corners", "tag-simple", "currency-eur", "currency-btc", "map-trifold"],
      "regular",
    );
    expect(getIconBody("wifi-high", "regular")).not.toBeNull();
    expect(getIconBody("map-trifold", "regular")).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the REST API only for names outside the subset", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ icons: { ghost: { body: "<g/>" } }, width: 256, height: 256 }),
    });
    await requestPhosphorIcons(["ghost"], "regular");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("ph.json?icons=ghost");
    expect(getIconBody("ghost", "regular")?.body).toBe("<g/>");
  });

  it("marks an unresolved fallback name failed (not evicted), sticky until retryIcon", async () => {
    await requestPhosphorIcons(["ghost"], "regular"); // fetch throws → failed
    expect(getIconBody("ghost", "regular")).toBeNull();
    expect(isIconPending("ghost")).toBe(false);
    expect(iconStatus("ghost", "regular")).toBe("failed"); // ST-10: distinct state

    // A plain re-request is a no-op — "failed" is sticky, no forever-retry loop.
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("still offline"));
    await requestPhosphorIcons(["ghost"], "regular");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(iconStatus("ghost", "regular")).toBe("failed");

    // Explicit retry clears the marker and fetches again — now succeeding.
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ icons: { ghost: { body: "<g/>" } }, width: 256, height: 256 }),
    });
    await retryIcon("ghost", "regular");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getIconBody("ghost", "regular")?.body).toBe("<g/>");
    expect(iconStatus("ghost", "regular")).toBe("ready");
  });

  it("iconStatus reports idle → ready across a baked resolve", async () => {
    expect(iconStatus("house", "regular")).toBe("idle"); // never requested
    await requestPhosphorIcons(["house"], "regular");
    expect(iconStatus("house", "regular")).toBe("ready");
  });
});

describe("baked mono logos (simple-icons, offline)", () => {
  it("resolves covered brands via variant 'logo'", async () => {
    await requestMonoLogos(["github", "figma"]);
    expect(getIconBody("github", "logo")?.body).toContain('fill="currentColor"');
    expect(getIconBody("github", "logo")?.width).toBe(24);
    expect(getIconBody("figma", "logo")).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("brands removed from simple-icons resolve to null (color-only), never fetch", async () => {
    expect(MONO_LOGO_NAMES).not.toContain("microsoft-word");
    await requestMonoLogos(["microsoft-word", "photoshop"]);
    expect(getIconBody("microsoft-word", "logo")).toBeNull();
    expect(isIconPending("logo:microsoft-word")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("baked color logos (svgl, offline)", () => {
  it("covers the whole catalog, including simple-icons removals", async () => {
    await requestColorLogos(["github", "microsoft-word", "photoshop", "windows"]);
    for (const name of ["github", "microsoft-word", "photoshop", "windows"]) {
      const body = getColorLogoBody(name);
      expect(body, name).not.toBeNull();
      expect(body!.width).toBeGreaterThan(0);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unknown names resolve to null without fetching", async () => {
    await requestColorLogos(["not-a-brand"]);
    expect(getColorLogoBody("not-a-brand")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves dark-theme variants for brands that ship one", async () => {
    const name = COLOR_LOGO_DARK_NAMES[0];
    await requestColorLogosDark([name]);
    expect(getColorLogoDarkBody(name), name).not.toBeNull();
    // A brand with no dark variant stays null.
    await requestColorLogosDark(["not-a-brand"]);
    expect(getColorLogoDarkBody("not-a-brand")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
