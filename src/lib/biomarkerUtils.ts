import { matchBiomarker, getBiomarkerById } from './registry/biomarkerLookup';
import { BiomarkerProfile } from './registry/biomarkerRegistry';

export const CATEGORIES = [
  'Blood Profile', 'Glucose Profile', 'Lipid Profile', 
  'Kidney Function', 'Liver Function', 'Thyroid Function', 
  'Vitamins', 'Urine Analysis', 'Others'
];

export const TIER_1 = [
  'hba1c', 'cholesterol_total', 'ldl', 'hdl', 'triglycerides', 
  'ast', 'alt', 'creatinine', 'urea', 'uric_acid', 'tsh', 
  'vitamind', 'vitaminb12', 'hemoglobin'
];

export function getCoreBiomarkersByCategory(): Record<string, string[]> {
  return {
    "Glucose Profile": ["hba1c", "glucose_fasting"],
    "Lipid Profile": ["cholesterol_total", "ldl", "hdl", "triglycerides"],
    "Kidney Function": ["creatinine", "urea", "egfr"],
    "Urine Analysis": ["microalbumin"],
    "Liver Function": ["ast", "alt"],
    "Blood Profile": [
      "hemoglobin", "wbc_blood", "rbc_blood", "platelet_count", 
      "mcv", "mch", "mchc", "neutrophils", "lymphocytes", 
      "monocytes", "eosinophils", "basophils"
    ],
    "Thyroid Function": ["total_t3", "tsh", "total_t4"],
    "Vitamins": ["vitamind", "vitaminb12"]
  };
}

export function isCoreBiomarkerPresent(coreId: string, availableIds: string[]) {
  return availableIds.includes(coreId);
}

export function calculateStatus(id: string, val: any, minVal?: any, maxVal?: any, providedStatus?: string, refRangeText?: string): { status: 'Healthy'|'Needs Attention'|'Borderline', info?: string, refMin?: number | null, refMax?: number | null, refRangeText?: string | null } {
  const value = Number(val);
  let min = minVal !== undefined && minVal !== null && minVal !== '' ? Number(minVal) : null;
  let max = maxVal !== undefined && maxVal !== null && maxVal !== '' ? Number(maxVal) : null;
  
  let labStatus: 'Healthy'|'Needs Attention'|'Borderline'|undefined = undefined;
  if (!isNaN(value)) {
      if (min !== null && max !== null) {
          if (value >= min && value <= max) labStatus = 'Healthy';
          else {
              const range = max - min;
              const margin = range * 0.15;
              if ((value >= min - margin && value < min) || (value <= max + margin && value > max)) {
                  labStatus = 'Borderline';
              } else {
                  labStatus = 'Needs Attention';
              }
          }
      } else if (min !== null) {
          if (value >= min) labStatus = 'Healthy';
          else if (value >= min * 0.85) labStatus = 'Borderline';
          else labStatus = 'Needs Attention';
      } else if (max !== null) {
          if (value <= max) labStatus = 'Healthy';
          else if (value <= max * 1.15) labStatus = 'Borderline';
          else labStatus = 'Needs Attention';
      }
  }

  let clinicalStatus: 'Healthy'|'Needs Attention'|'Borderline'|undefined = undefined;
  let clinicalMin: number | undefined = undefined;
  let clinicalMax: number | undefined = undefined;
  let clinicalRefText: string | undefined = undefined;
  let clinicalReasoning: string | undefined = undefined;

  const def = getBiomarkerById(id);
  if (def && (def.clinicalMin !== undefined || def.clinicalMax !== undefined)) {
      clinicalMin = def.clinicalMin;
      clinicalMax = def.clinicalMax;
      clinicalRefText = def.clinicalRefText;
      clinicalReasoning = def.clinicalReasoning;

      
      if (def.calculateStatus) {
        clinicalStatus = def.calculateStatus(value);
      } else {
          if (!isNaN(value)) {
              if (clinicalMin !== undefined && clinicalMax !== undefined) {
                  if (value >= clinicalMin && value <= clinicalMax) clinicalStatus = 'Healthy';
                  else {
                      const range = clinicalMax - clinicalMin;
                      const margin = range * 0.15;
                      if ((value >= clinicalMin - margin && value < clinicalMin) || (value <= clinicalMax + margin && value > clinicalMax)) {
                          clinicalStatus = 'Borderline';
                      } else {
                          clinicalStatus = 'Needs Attention';
                      }
                  }
              } else if (clinicalMin !== undefined) {
                  if (value >= clinicalMin) clinicalStatus = 'Healthy';
                  else if (value >= clinicalMin * 0.85) clinicalStatus = 'Borderline';
                  else clinicalStatus = 'Needs Attention';
              } else if (clinicalMax !== undefined) {
                  if (value <= clinicalMax) clinicalStatus = 'Healthy';
                  else if (value <= clinicalMax * 1.15) clinicalStatus = 'Borderline';
                  else clinicalStatus = 'Needs Attention';
              }
          }
      }

  }

  let finalStatus = clinicalStatus || labStatus;
  
  if (!finalStatus) {
      if (providedStatus) {
          const ps = providedStatus.toLowerCase();
          if (ps === 'normal' || ps === 'healthy') finalStatus = 'Healthy';
          else if (ps === 'borderline') finalStatus = 'Borderline';
          else if (ps === 'high' || ps === 'low' || ps === 'abnormal' || ps === 'needs attention' || ps === 'critical') finalStatus = 'Needs Attention';
      }
      if (!finalStatus) finalStatus = 'Healthy';
  }

  let info: string | undefined = undefined;
  if (clinicalStatus && labStatus && clinicalStatus !== labStatus) {
      info = `This biomarker was graded as ${clinicalStatus} based on general clinical guidelines, which differs from the laboratory report's reference range. ${clinicalReasoning}`;
  }
  
  const result: { status: 'Healthy'|'Needs Attention'|'Borderline', info?: string, refMin?: number | null, refMax?: number | null, refRangeText?: string | null } = { 
    status: finalStatus as 'Healthy'|'Needs Attention'|'Borderline',
    refMin: min,
    refMax: max,
    refRangeText: refRangeText || null
  };

  const isMissingOrZero = (min === null && max === null && !refRangeText) ||
                          (min === 0 && max === 0);
  
  if (clinicalRefText !== undefined || clinicalMin !== undefined || clinicalMax !== undefined) {
      result.refMin = clinicalMin !== undefined ? clinicalMin : null;
      result.refMax = clinicalMax !== undefined ? clinicalMax : null;
      result.refRangeText = clinicalRefText !== undefined ? clinicalRefText : null;
      
      let fileHasDifferentRange = false;
      if (!isMissingOrZero) {
          if (clinicalMin !== undefined && min !== null && Math.abs(min - clinicalMin) > 0.01) {
              fileHasDifferentRange = true;
          }
          if (clinicalMax !== undefined && max !== null && Math.abs(max - clinicalMax) > 0.01) {
              fileHasDifferentRange = true;
          }
      }
      
      if (!info) {
          if (isMissingOrZero) {
              info = `Reference range not provided in report. Using general clinical guidelines${clinicalReasoning ? ': ' + clinicalReasoning : '.'}`;
          } else if (fileHasDifferentRange) {
              info = `Using general clinical guidelines for optimal reference range, which may differ from the laboratory report's reference range${clinicalReasoning ? '. ' + clinicalReasoning : '.'}`;
          }
      }
  } else if (isMissingOrZero) {
      result.refMin = null;
      result.refMax = null;
      result.refRangeText = null;
  }

  if (info) {
    result.info = info.trim();
  }
  return result as any;
}

export function hydrateBiomarker(b: any): any {
  if (b.category && b.category !== 'Others' && b.biomarkerId) return b;
  const match = matchBiomarker(b.name || '', { unit: b.unit, section: b.category });
  
  let finalCategory = b.category;
  if (!finalCategory || finalCategory === 'Others') {
    finalCategory = match.profile !== 'Others' ? match.profile : (finalCategory || 'Others');
  }

  return {
    ...b,
    biomarkerId: b.biomarkerId || match.biomarkerId,
    category: finalCategory,
    confidence: b.confidence || match.confidence,
    matchedBy: b.matchedBy || match.matchedBy,
    name: match.canonicalName || b.name,
    originalName: b.originalName || b.name
  };
}
