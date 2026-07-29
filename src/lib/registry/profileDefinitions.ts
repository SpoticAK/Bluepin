import type { BiomarkerProfile } from "./biomarkerRegistry";

export interface ProfileDefinition {
  id: string;
  displayName: BiomarkerProfile;
  description: string;
}

export const profileDefinitions: ProfileDefinition[] = [
  {
    id: "blood",
    displayName: "Blood Profile",
    description: "Complete blood count and iron studies."
  },
  {
    id: "glucose",
    displayName: "Glucose Profile",
    description: "Blood glucose and HbA1c related biomarkers."
  },
  {
    id: "lipid",
    displayName: "Lipid Profile",
    description: "Cholesterol and triglyceride measurements."
  },
  {
    id: "kidney",
    displayName: "Kidney Function",
    description: "Renal function and electrolyte markers."
  },
  {
    id: "liver",
    displayName: "Liver Function",
    description: "Liver enzymes and proteins."
  },
  {
    id: "thyroid",
    displayName: "Thyroid Function",
    description: "Thyroid hormone assessment."
  },
  {
    id: "vitamins",
    displayName: "Vitamins",
    description: "Vitamin deficiency markers."
  },
  {
    id: "urine",
    displayName: "Urine Analysis",
    description: "Urine physical, chemical and microscopic examination."
  },
  {
    id: "others",
    displayName: "Others",
    description: "Miscellaneous biomarkers not belonging to another profile."
  }
];
