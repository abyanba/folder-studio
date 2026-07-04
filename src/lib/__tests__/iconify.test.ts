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
  getIconBody,
  isIconPending,
  phCacheKey,
  requestColorLogos,
  requestMonoLogos,
  requestPhosphorIcons,
} from "@/lib/iconify";
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

  it("evicts failed fallback names so they can retry, and dedupes cached ones", async () => {
    await requestPhosphorIcons(["ghost"], "regular"); // fetch throws
    expect(getIconBody("ghost", "regular")).toBeNull();
    expect(isIconPending("ghost")).toBe(false);

    fetchMock.mockReset();
    await requestPhosphorIcons(["house"], "regular"); // baked
    await requestPhosphorIcons(["house"], "regular"); // cached → no work
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(MONO_LOGO_NAMES).not.toContain("microsoft");
    await requestMonoLogos(["microsoft", "adobephotoshop"]);
    expect(getIconBody("microsoft", "logo")).toBeNull();
    expect(isIconPending("logo:microsoft")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("baked color logos (thesvg, offline)", () => {
  it("covers the whole catalog, including simple-icons removals", async () => {
    await requestColorLogos(["github", "microsoft", "amazon", "adobephotoshop", "windows11"]);
    for (const name of ["github", "microsoft", "amazon", "adobephotoshop", "windows11"]) {
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
});
