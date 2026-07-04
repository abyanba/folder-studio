/**
 * Iconify cache behavior with a mocked fetch: batch dedupe, pending marking,
 * error eviction (failed names retry later), and the legacy cache-key scheme.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetIconCacheForTests,
  getColorLogoBody,
  getIconBody,
  isIconPending,
  phCacheKey,
  requestMonoLogos,
  requestPhosphorIcons,
  requestColorLogos,
} from "@/lib/iconify";

const fetchMock = vi.fn();

beforeEach(() => {
  __resetIconCacheForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(icons: Record<string, { body: string; width?: number; height?: number }>) {
  return {
    json: async () => ({ icons, width: 256, height: 256 }),
  };
}

describe("phCacheKey", () => {
  it("suffixes non-regular variants only", () => {
    expect(phCacheKey("house", "regular")).toBe("house");
    expect(phCacheKey("house", "bold")).toBe("house-bold");
  });
});

describe("requestPhosphorIcons", () => {
  it("fetches uncached names once and fills the cache", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ house: { body: "<p/>" }, star: { body: "<s/>" } }));
    await requestPhosphorIcons(["house", "star"], "regular");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("ph.json?icons=house,star");
    expect(getIconBody("house", "regular")).toEqual({ body: "<p/>", width: 256, height: 256 });

    // Second request for the same names → no new fetch.
    await requestPhosphorIcons(["house", "star"], "regular");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks names pending during flight and evicts failures for retry", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const p = requestPhosphorIcons(["ghost"], "bold");
    expect(isIconPending("ghost-bold")).toBe(true);

    resolve(okResponse({})); // API returned nothing for the name
    await p;
    expect(isIconPending("ghost-bold")).toBe(false);
    expect(getIconBody("ghost", "bold")).toBeNull();

    // Evicted → a later request retries.
    fetchMock.mockResolvedValueOnce(okResponse({ "ghost-bold": { body: "<g/>" } }));
    await requestPhosphorIcons(["ghost"], "bold");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getIconBody("ghost", "bold")?.body).toBe("<g/>");
  });

  it("survives a network error and allows retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await requestPhosphorIcons(["cloud"], "regular");
    expect(getIconBody("cloud", "regular")).toBeNull();
    expect(isIconPending("cloud")).toBe(false);

    fetchMock.mockResolvedValueOnce(okResponse({ cloud: { body: "<c/>" } }));
    await requestPhosphorIcons(["cloud"], "regular");
    expect(getIconBody("cloud", "regular")?.body).toBe("<c/>");
  });
});

describe("logo caches", () => {
  it("mono logos live under logo: keys and resolve via variant 'logo'", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ github: { body: "<gh/>", width: 24, height: 24 } }));
    await requestMonoLogos(["github"]);
    expect(fetchMock.mock.calls[0][0]).toContain("simple-icons.json?icons=github");
    expect(getIconBody("github", "logo")?.body).toBe("<gh/>");
  });

  it("color logos map through LOGO_COLOR_KEYS and skip unmapped names", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({ "github-icon": { body: "<ghc/>", width: 24, height: 24 } }),
    );
    await requestColorLogos(["github", "nike"]); // nike has no color mapping
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("logos.json?icons=github-icon");
    expect(getColorLogoBody("github")?.body).toBe("<ghc/>");
    expect(getColorLogoBody("nike")).toBeNull();
  });
});
