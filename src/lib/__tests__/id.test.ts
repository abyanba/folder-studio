import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetIdCounterForTests,
  createId,
  idSuffix,
  maxIdSuffix,
  reseedIds,
} from "@/lib/id";

describe("id", () => {
  beforeEach(() => __resetIdCounterForTests());

  it("produces unique, monotonic string ids", () => {
    const a = createId();
    const b = createId();
    expect(a).toBe("el1");
    expect(b).toBe("el2");
    expect(a).not.toBe(b);
  });

  it("respects a custom prefix", () => {
    expect(createId("layer")).toBe("layer1");
  });

  it("extracts numeric suffixes", () => {
    expect(idSuffix("el12")).toBe(12);
    expect(idSuffix("nope")).toBe(0);
    expect(maxIdSuffix(["el3", "el17", "el2"])).toBe(17);
  });

  it("reseeds so future ids never collide with a loaded set", () => {
    reseedIds(maxIdSuffix(["el5", "el9"]));
    expect(createId()).toBe("el10");
  });
});
