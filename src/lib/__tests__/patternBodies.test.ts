// @vitest-environment node
/**
 * The lazy pattern-body cache. `getPatternBody` has to stay synchronous (the
 * render paths are sync) while the generated chunk loads asynchronously, so the
 * null-before-loaded contract and the subscribe/version handshake that triggers
 * a re-render once it lands are what matter here.
 */

import { describe, expect, it } from "vitest";
import {
  getPatternBody,
  loadPatternBodies,
  patternBodiesVersion,
  subscribePatternBodies,
} from "@/lib/patternBodies";
import { PATTERN_CATALOG } from "@/data/patterns";

const known = PATTERN_CATALOG[0].key;

describe("patternBodies", () => {
  it("returns null before the chunk is loaded rather than throwing", () => {
    // Render paths call this synchronously on first paint, before the import
    // has resolved — it must degrade to "draw nothing", not blow up.
    expect(getPatternBody(known)).toBeNull();
  });

  it("notifies subscribers and resolves bodies once loaded", async () => {
    let calls = 0;
    const unsubscribe = subscribePatternBodies(() => {
      calls++;
    });
    const before = patternBodiesVersion();

    await loadPatternBodies();

    expect(calls).toBe(1);
    expect(patternBodiesVersion()).toBeGreaterThan(before);
    const body = getPatternBody(known);
    expect(body).not.toBeNull();
    expect(body!.svg).toContain("{{FG}}");
    expect(body!.w).toBeGreaterThan(0);
    expect(body!.defaultScale).toBeGreaterThan(0);

    unsubscribe();
  });

  it("is idempotent — a second load neither refetches nor re-notifies", async () => {
    let calls = 0;
    const unsubscribe = subscribePatternBodies(() => {
      calls++;
    });
    const version = patternBodiesVersion();

    await loadPatternBodies();

    expect(calls).toBe(0);
    expect(patternBodiesVersion()).toBe(version);
    unsubscribe();
  });

  it("treats 'none', empty and unknown ids as no pattern", () => {
    expect(getPatternBody("none")).toBeNull();
    expect(getPatternBody("")).toBeNull();
    // A retired hand-written motif id from an old gallery snapshot.
    expect(getPatternBody("herringbone")).toBeNull();
  });

  it("stops notifying after unsubscribe", async () => {
    let calls = 0;
    const unsubscribe = subscribePatternBodies(() => {
      calls++;
    });
    unsubscribe();
    await loadPatternBodies();
    expect(calls).toBe(0);
  });
});
