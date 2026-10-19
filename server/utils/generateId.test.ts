import { describe, expect, it, vi } from "vitest";
import { generateId } from "./generateId";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a v4 UUID shape", () => {
    expect(generateId()).toMatch(UUID_V4);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });

  it("falls back to Math.random when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    try {
      expect(generateId()).toMatch(UUID_V4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
