import { describe, expect, it, vi } from "vitest";
import { safeParseJSON } from "./jsonparse";

describe("safeParseJSON", () => {
  it("parses clean JSON as-is", () => {
    expect(safeParseJSON('{"a":1,"b":[1,2]}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("repairs trailing commas and unquoted-adjacent damage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = safeParseJSON('{"sections": [{"name": "CBC",},],}');
    expect(result.sections[0].name).toBe("CBC");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("recovers a partial result from truncated Gemini output", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const truncated =
      '{"sections": [{"name": "CBC", "items": [{"name": "Hb", "value": 13.5}, {"name": "WBC", "value":';
    const result = safeParseJSON(truncated);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].name).toBe("CBC");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("recovers by trimming trailing garbage back to the last complete object", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // jsonrepair chokes on the trailing "{{{ garbage", so the bracket-closing
    // fallback trims back to the last "}," and closes from there.
    const raw =
      '{"sections": [{"name": "CBC"}, {"name": "WBC"}], "x": 1 {{{ garbage';
    const result = safeParseJSON(raw);
    expect(result.sections.map((s: { name: string }) => s.name)).toEqual(["CBC"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("truncated"));
    warn.mockRestore();
  });

  it("throws a contextual error on unrecoverable garbage", () => {
    expect(() => safeParseJSON("definitely not json {{{")).toThrow(
      /JSON parse failed after repair attempt/,
    );
  });

  it("throws on empty input", () => {
    expect(() => safeParseJSON("")).toThrow();
  });
});
