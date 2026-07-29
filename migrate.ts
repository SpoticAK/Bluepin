import { BIOMARKER_REGISTRY } from './src/lib/registry/biomarkers';
import fs from 'fs';

const mapProfile = (cat: string) => {
  if (cat === 'Thyroid Profile') return 'Thyroid Function';
  return cat;
};

const mapReportTypes = (types: any[]) => {
  return types.map(t => {
    switch (t) {
      case 'CBC': return 'Complete Blood Count';
      case 'LFT': return 'Liver Function Test';
      case 'KFT': return 'Kidney Function Test';
      case 'LIPID': return 'Lipid Profile';
      case 'URINE_ROUTINE': return 'Urine Analysis';
      case 'THYROID': return 'Thyroid Profile';
      case 'GLUCOSE': return 'Glucose Profile';
      case 'VITAMINS': return 'Vitamins';
      case 'UNKNOWN': return 'Others';
      default: return t;
    }
  });
};

const newFormat = BIOMARKER_REGISTRY.map(b => {
  // Try to infer valueType
  let valueType = 'numeric';
  if (b.expectedUnits.some(u => u.toLowerCase() === 'negative' || u.toLowerCase() === 'positive' || u.toLowerCase() === 'trace')) {
    valueType = 'positive_negative';
  }
  
  return {
    id: b.id,
    canonicalName: b.name,
    profile: mapProfile(b.category),
    aliases: b.aliases,
    expectedSections: mapReportTypes(b.reportTypes),
    units: b.expectedUnits,
    valueType: valueType,
    commonOcrMistakes: b.searchTerms
  };
});

let output = `export type BiomarkerProfile =
  | "Blood Profile"
  | "Glucose Profile"
  | "Lipid Profile"
  | "Kidney Function"
  | "Liver Function"
  | "Thyroid Function"
  | "Vitamins"
  | "Urine Analysis"
  | "Others";

export interface BiomarkerDefinition {
  id:string;
  canonicalName:string;
  profile:BiomarkerProfile;
  aliases:string[];
  expectedSections:string[];
  units:string[];
  valueType:"numeric"|"positive_negative"|"text";
  commonOcrMistakes?:string[];
}

export const biomarkerRegistry: BiomarkerDefinition[] = ${JSON.stringify(newFormat, null, 2)};
`;

fs.writeFileSync('src/lib/registry/biomarkerRegistry.ts', output);
