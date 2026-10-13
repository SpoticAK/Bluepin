import { describe, expect, it } from "vitest";
import {
  getBiomarkerByAlias,
  getBiomarkerById,
  getBiomarkersForProfile,
  matchBiomarker,
} from "./biomarkerLookup";

describe("registry indexes", () => {
  it("resolves every id back to a definition", () => {
    const hba1c = getBiomarkerById("hba1c");
    expect(hba1c?.canonicalName).toMatch(/hba1c|hemoglobin a1c/i);
    expect(getBiomarkerById("no_such_biomarker_xyz")).toBeUndefined();
  });

  it("builds alias and profile indexes from the same registry", () => {
    const hba1c = getBiomarkerById("hba1c")!;
    expect(getBiomarkersForProfile(hba1c.profile)).toContainEqual(hba1c);
    expect(getBiomarkersForProfile("No Such Profile" as never)).toEqual([]);
  });

  it("alias lookup is case/format-insensitive", () => {
    const lower = getBiomarkerByAlias("hba1c");
    const upper = getBiomarkerByAlias("HbA1c");
    expect(lower.length).toBeGreaterThan(0);
    expect(upper).toEqual(lower);
    expect(getBiomarkerByAlias("zzz_not_a_biomarker")).toEqual([]);
  });
});

describe("matchBiomarker — glucose/HbA1c regex fast paths", () => {
  it.each([
    ["Fasting Blood Sugar", "glucose_fasting"],
    ["Fasting Glucose", "glucose_fasting"],
    ["Post Prandial Blood Sugar", "glucose_pp"],
    ["Random Blood Sugar", "glucose_random"],
    ["HbA1c", "hba1c"],
    ["Glycosylated Hemoglobin", "hba1c"],
    ["eAG", "eag"],
  ])("matches %s → %s with High confidence", (input, id) => {
    const m = matchBiomarker(input);
    expect(m.biomarkerId).toBe(id);
    expect(m.confidence).toBe("High");
    expect(m.matchedBy).toBe("regex_pattern");
  });
});

describe("matchBiomarker — disambiguation", () => {
  it("uses the section's expected list (High, section)", () => {
    const m = matchBiomarker("Bilirubin", { section: "Urine Analysis" });
    expect(m).toMatchObject({
      biomarkerId: "bilirubin_urine",
      confidence: "High",
      matchedBy: "section",
    });
  });

  it("falls back to profile-name matching (High, profile_name)", () => {
    const m = matchBiomarker("Bilirubin", { section: "Liver Function" });
    expect(m).toMatchObject({
      biomarkerId: "bilirubin_total",
      confidence: "High",
      matchedBy: "profile_name",
    });
  });

  it("uses a distinguishing unit (Medium, unit)", () => {
    const m = matchBiomarker("Bilirubin", { unit: "µmol/L" });
    expect(m).toMatchObject({
      biomarkerId: "bilirubin_total",
      confidence: "Medium",
      matchedBy: "unit",
    });
  });

  it("uses qualitative value type when the unit matches neither candidate", () => {
    const m = matchBiomarker("Glucose", { unit: "trace" });
    expect(m).toMatchObject({
      biomarkerId: "glucose_urine",
      confidence: "Medium",
      matchedBy: "value_type",
    });
  });

  it("resolves OCR mistakes (Medium, ocr_mistake)", () => {
    const m = matchBiomarker("A1c");
    expect(m).toMatchObject({
      biomarkerId: "hba1c",
      confidence: "Medium",
      matchedBy: "ocr_mistake",
    });
  });

  it("returns Low-confidence first-candidate when nothing disambiguates", () => {
    const m = matchBiomarker("Glucose", { unit: "mg/dL" });
    expect(m).toMatchObject({ confidence: "Low", matchedBy: "ambiguous_fallback" });
  });
});

describe("matchBiomarker — fallback", () => {
  it("returns a None-confidence fallback preserving the raw name", () => {
    const raw = "Xyzzy Not A Biomarker 123";
    const m = matchBiomarker(raw);
    expect(m).toMatchObject({
      biomarkerId: null,
      canonicalName: raw,
      confidence: "None",
      matchedBy: "fallback",
    });
  });
});
