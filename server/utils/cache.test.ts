import { describe, expect, it } from "vitest";
import { createLruCache, hashBuffer } from "./cache";

describe("hashBuffer", () => {
  it("returns a 64-char hex sha256", () => {
    expect(hashBuffer(Buffer.from("hello"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and content-sensitive", () => {
    const a = hashBuffer(Buffer.from("report-bytes"));
    expect(hashBuffer(Buffer.from("report-bytes"))).toBe(a);
    expect(hashBuffer(Buffer.from("report-bytes!"))).not.toBe(a);
  });
});

describe("createLruCache", () => {
  it("stores and retrieves values", () => {
    const c = createLruCache<number>();
    expect(c.get("missing")).toBeUndefined();
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.size()).toBe(1);
  });

  it("evicts the least-recently-used entry past maxSize", () => {
    const c = createLruCache<string>(2);
    c.set("a", "A");
    c.set("b", "B");
    c.get("a"); // a is now most-recently-used
    c.set("c", "C"); // evicts b
    expect(c.get("a")).toBe("A");
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe("C");
    expect(c.size()).toBe(2);
  });

  it("re-setting a key refreshes recency without growing", () => {
    const c = createLruCache<string>(2);
    c.set("a", "A1");
    c.set("b", "B");
    c.set("a", "A2"); // refresh a
    c.set("c", "C"); // evicts b, not a
    expect(c.get("a")).toBe("A2");
    expect(c.get("b")).toBeUndefined();
    expect(c.size()).toBe(2);
  });

  it("defaults to 100 entries", () => {
    const c = createLruCache<number>();
    for (let i = 0; i < 150; i++) c.set(`k${i}`, i);
    expect(c.size()).toBe(100);
    expect(c.get("k0")).toBeUndefined();
    expect(c.get("k149")).toBe(149);
  });
});
