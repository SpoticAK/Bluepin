import { describe, expect, it } from "vitest";
import {
  calculateStatus,
  hydrateBiomarker,
  isCoreBiomarkerPresent,
} from "./biomarkerUtils";

describe("isCoreBiomarkerPresent", () => {
  it("checks membership", () => {
    expect(isCoreBiomarkerPresent("hba1c", ["hba1c", "ldl"])).toBe(true);
    expect(isCoreBiomarkerPresent("hba1c", ["ldl"])).toBe(false);
  });
});

describe("calculateStatus — pure lab-range logic (unknown id, no registry def)", () => {
  const ID = "not_a_real_biomarker_xyz";

  it("grades inside range as Healthy", () => {
    expect(calculateStatus(ID, 100, 70, 140).status).toBe("Healthy");
  });

  it("grades far outside range as Needs Attention", () => {
    expect(calculateStatus(ID, 50, 70, 140).status).toBe("Needs Attention");
    expect(calculateStatus(ID, 200, 70, 140).status).toBe("Needs Attention");
  });

  it("grades just outside range as Borderline (15% margin)", () => {
    // range 70-140 → margin 10.5 → 62 is Borderline, 140.1 is Borderline
    expect(calculateStatus(ID, 65, 70, 140).status).toBe("Borderline");
    expect(calculateStatus(ID, 145, 70, 140).status).toBe("Borderline");
  });

  it("parses textual reference ranges", () => {
    expect(calculateStatus(ID, 90, undefined, undefined, undefined, "70 - 140").status).toBe(
      "Healthy",
    );
    expect(calculateStatus(ID, 90, undefined, undefined, undefined, "< 100").status).toBe(
      "Healthy",
    );
    expect(calculateStatus(ID, 150, undefined, undefined, undefined, "< 100").status).toBe(
      "Needs Attention",
    );
  });

  it("maps providedStatus when no range exists", () => {
    expect(calculateStatus(ID, "abc", undefined, undefined, "High").status).toBe("Needs Attention");
    expect(calculateStatus(ID, "abc", undefined, undefined, "normal").status).toBe("Healthy");
    expect(calculateStatus(ID, "abc", undefined, undefined, "borderline").status).toBe(
      "Borderline",
    );
  });

  it("defaults to Healthy when nothing is known", () => {
    expect(calculateStatus(ID, "abc").status).toBe("Healthy");
  });

  it("extracts numbers from string values", () => {
    expect(calculateStatus(ID, "102 mg/dL", 70, 140).status).toBe("Healthy");
  });
});

describe("calculateStatus — glucose profile exemption", () => {
  it("discards lab ranges in favour of clinical guidelines", () => {
    // hba1c registry: clinicalMax 5.7, ref "< 5.7". The passed lab range 4-6 is ignored.
    const r = calculateStatus("hba1c", 9.5, 4, 6);
    expect(r.refMin).toBeNull();
    expect(r.refMax).toBe(5.7);
    expect(r.refRangeText).toBe("< 5.7");
    expect(r.status).toBe("Needs Attention");
  });
});

describe("calculateStatus — clinical guideline override", () => {
  it("flags when the lab range differs from clinical guidelines", () => {
    // tsh clinical range is 0.4-4; the lab's 0.4-10 ceiling disagrees.
    const r = calculateStatus("tsh", 10, 0.4, 10);
    expect(r.status).toBe("Needs Attention");
    expect(r.info).toMatch(/general clinical guidelines/);
  });

  it("suppresses the guideline note for glucose-profile biomarkers", () => {
    // hba1c applies clinicalMax 5.7 but drops the info note (UI explains glucose separately).
    const r = calculateStatus("hba1c", 8, undefined, 7);
    expect(r.status).toBe("Needs Attention");
    expect(r.refMax).toBe(5.7);
    expect(r.info).toBeUndefined();
  });
});

describe("hydrateBiomarker", () => {
  it("resolves a glucose alias to registry id + profile", () => {
    const out = hydrateBiomarker({ name: "Fasting Blood Sugar", unit: "mg/dL" });
    expect(out.biomarkerId).toBe("glucose_fasting");
    expect(out.category).toBe("Glucose Profile");
    expect(out.originalName).toBe("Fasting Blood Sugar");
  });

  it("keeps an explicit category and falls back gracefully on unknown names", () => {
    const out = hydrateBiomarker({
      name: "Xyzzy Not A Biomarker",
      category: "Liver Function",
    });
    expect(out.biomarkerId).toBeUndefined();
    expect(out.category).toBe("Liver Function");
  });
});
