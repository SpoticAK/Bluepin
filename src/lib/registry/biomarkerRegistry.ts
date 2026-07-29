export type BiomarkerProfile =
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
  isCore?:boolean;
  isTier1?:boolean;
  clinicalMin?:number;
  clinicalMax?:number;
  clinicalRefText?:string;
  clinicalReasoning?:string;
  calculateStatus?: (value: number) => 'Healthy' | 'Borderline' | 'Needs Attention';
}

export const biomarkerRegistry: BiomarkerDefinition[] = [
  {
    "id": "hemoglobin",
    "canonicalName": "Hemoglobin",
    "profile": "Blood Profile",
    "aliases": [
      "Hb",
      "Hgb"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "g/dL",
      "g/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Haemoglobin",
      "Heamoglobin"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMin": 12,
    "clinicalRefText": ">= 12",
    "clinicalReasoning": "Hemoglobin >= 12 g/dL is generally considered healthy. 10-11.9 g/dL is mild anemia (borderline), and < 10 g/dL is moderate to severe anemia."
  },
  {
    "id": "rbc_blood",
    "canonicalName": "RBC Count",
    "profile": "Blood Profile",
    "aliases": [
      "Red Blood Cell Count",
      "Erythrocyte Count"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "millions/µL",
      "10^6/µL"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "RBC",
      "R.B.C"
    ],
    "isCore": true
  },
  {
    "id": "wbc_blood",
    "canonicalName": "WBC Count",
    "profile": "Blood Profile",
    "aliases": [
      "White Blood Cell Count",
      "Leukocyte Count",
      "Total Leukocyte Count",
      "TLC"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "thou/µL",
      "10^3/µL"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "WBC",
      "W.B.C",
      "Total WBC"
    ],
    "isCore": true
  },
  {
    "id": "platelet_count",
    "canonicalName": "Platelet Count",
    "profile": "Blood Profile",
    "aliases": [
      "Platelets"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "thou/µL",
      "10^3/µL",
      "lakhs/cumm"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "PLT"
    ],
    "isCore": true
  },
  {
    "id": "mcv",
    "canonicalName": "MCV",
    "profile": "Blood Profile",
    "aliases": [
      "Mean Corpuscular Volume"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "fL"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "mch",
    "canonicalName": "MCH",
    "profile": "Blood Profile",
    "aliases": [
      "Mean Corpuscular Hemoglobin"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "pg"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "mchc",
    "canonicalName": "MCHC",
    "profile": "Blood Profile",
    "aliases": [
      "Mean Corpuscular Hemoglobin Concentration"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      "g/dL",
      "%"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "neutrophil_lymphocyte_ratio",
    "canonicalName": "Neutrophil-Lymphocyte Ratio (NLR)",
    "profile": "Blood Profile",
    "aliases": [
      "Neutrophil to Lymphocyte Ratio",
      "NLR",
      "Neutrophil Lymphocyte Ratio"
    ],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [
      ""
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "N/L Ratio",
      "Neutro/Lympho Ratio"
    ]
  },
  {
    "id": "hba1c",
    "canonicalName": "HbA1c",
    "profile": "Glucose Profile",
    "aliases": [
      "Hemoglobin A1c",
      "Glycosylated Hemoglobin"
    ],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [
      "%"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "A1c",
      "HBA1C"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 5.7,
    "clinicalRefText": "< 5.7",
    "clinicalReasoning": "HbA1c < 5.7% is normal. 5.7-6.4% is prediabetes (borderline), and >= 6.5% is diabetes based on clinical guidelines."
  },
  {
    "id": "glucose_fasting",
    "canonicalName": "Fasting Blood Glucose",
    "profile": "Glucose Profile",
    "aliases": [
      "Glucose",
      "Blood Glucose",
      "Blood Sugar",
      "Fasting Blood Sugar",
      "FBS",
      "FBG",
      "Fasting Sugar"
    ],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Fasting Glucose"
    ],
    "isCore": true,
    "clinicalMax": 99,
    "clinicalRefText": "< 100",
    "clinicalReasoning": "Fasting glucose < 100 mg/dL is normal. 100-125 mg/dL is prediabetes (borderline), and >= 126 mg/dL is diabetes based on clinical guidelines."
  },
  {
    "id": "glucose_pp",
    "canonicalName": "PPBS",
    "profile": "Glucose Profile",
    "aliases": [
      "Post Prandial Blood Sugar",
      "Glucose Post Prandial",
      "Postprandial Glucose"
    ],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "PP Glucose"
    ],
    "clinicalMax": 139,
    "clinicalRefText": "< 140",
    "clinicalReasoning": "Post-prandial glucose < 140 mg/dL is normal. 140-199 mg/dL is prediabetes (borderline), and >= 200 mg/dL is diabetes based on clinical guidelines."
  },
  {
    "id": "glucose_random",
    "canonicalName": "Random Blood Sugar",
    "profile": "Glucose Profile",
    "aliases": [
      "Random Blood Glucose",
      "RBS",
      "Random Glucose"
    ],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "eag",
    "canonicalName": "eAG",
    "profile": "Glucose Profile",
    "aliases": [
      "Estimated Average Glucose"
    ],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "clinicalMax": 116,
    "clinicalRefText": "< 117",
    "clinicalReasoning": "eAG < 117 mg/dL is normal. 117-137 mg/dL is prediabetes range (borderline), and >= 140 mg/dL is diabetes range based on clinical guidelines."
  },
  {
    "id": "cholesterol_total",
    "canonicalName": "Total Cholesterol",
    "profile": "Lipid Profile",
    "aliases": [
      "Cholesterol",
      "Cholesterol Total",
      "Serum Cholesterol"
    ],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Cholesterol"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 199,
    "clinicalRefText": "< 200",
    "clinicalReasoning": "Total cholesterol < 200 is desirable, 200-239 is borderline high, and >= 240 is high according to clinical guidelines."
  },
  {
    "id": "ldl",
    "canonicalName": "LDL",
    "profile": "Lipid Profile",
    "aliases": [
      "LDL Cholesterol",
      "Low Density Lipoprotein",
      "Direct LDL"
    ],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "LDL-C",
      "LDLC"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 99,
    "clinicalRefText": "< 100",
    "clinicalReasoning": "LDL < 100 is optimal. 100-159 is near/above optimal to borderline high, and >= 160 is high based on standard clinical guidelines."
  },
  {
    "id": "hdl",
    "canonicalName": "HDL",
    "profile": "Lipid Profile",
    "aliases": [
      "HDL Cholesterol",
      "High Density Lipoprotein",
      "Direct HDL"
    ],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "HDL-C",
      "HDLC"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMin": 60,
    "clinicalRefText": ">= 60",
    "clinicalReasoning": "HDL >= 60 is optimal. 40-59 is acceptable/borderline, and < 40 is considered low based on clinical guidelines."
  },
  {
    "id": "triglycerides",
    "canonicalName": "Triglycerides",
    "profile": "Lipid Profile",
    "aliases": [
      "TG",
      "Triglyceride"
    ],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Trigs"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 149,
    "clinicalRefText": "< 150",
    "clinicalReasoning": "Triglycerides < 150 is normal, 150-199 is borderline high, and >= 200 is high based on clinical guidelines."
  },
  {
    "id": "ast",
    "canonicalName": "AST",
    "profile": "Liver Function",
    "aliases": [
      "Aspartate Aminotransferase",
      "SGOT"
    ],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [
      "U/L",
      "IU/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "SGOT/AST",
      "AST/SGOT"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 40,
    "clinicalRefText": "<= 40",
    "clinicalReasoning": "AST <= 40 U/L is generally considered normal. 41-80 U/L is mildly elevated (borderline), and > 80 U/L is elevated."
  },
  {
    "id": "alt",
    "canonicalName": "ALT",
    "profile": "Liver Function",
    "aliases": [
      "Alanine Aminotransferase",
      "SGPT"
    ],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [
      "U/L",
      "IU/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "SGPT/ALT",
      "ALT/SGPT"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 40,
    "clinicalRefText": "<= 40",
    "clinicalReasoning": "ALT <= 40 U/L is generally considered normal. 41-80 U/L is mildly elevated (borderline), and > 80 U/L is elevated."
  },
  {
    "id": "bilirubin_total",
    "canonicalName": "Total Bilirubin",
    "profile": "Liver Function",
    "aliases": [
      "Bilirubin",
      "Bilirubin Total",
      "T Bilirubin",
      "Total Bilirubin (TBIL)"
    ],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [
      "mg/dL",
      "µmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "T. Bil",
      "T.Bil",
      "TBIL",
      "Tot Bil"
    ]
  },
  {
    "id": "bilirubin_direct",
    "canonicalName": "Direct Bilirubin",
    "profile": "Liver Function",
    "aliases": [
      "Bilirubin Direct",
      "Conjugated Bilirubin",
      "Direct Bilirubin (DBIL)"
    ],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [
      "mg/dL",
      "µmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "D. Bil",
      "D.Bil",
      "DBIL",
      "Dir Bil"
    ]
  },
  {
    "id": "albumin_blood",
    "canonicalName": "Albumin",
    "profile": "Liver Function",
    "aliases": [
      "Serum Albumin",
      "Albumin Serum",
      "Alb"
    ],
    "expectedSections": [
      "Liver Function"
    ],
    "units": [
      "g/dL",
      "g/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Albumi"
    ]
  },
  {
    "id": "protein_total_blood",
    "canonicalName": "Total Protein",
    "profile": "Liver Function",
    "aliases": [
      "Protein",
      "Serum Protein"
    ],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [
      "g/dL",
      "g/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Protein Total",
      "T. Protein"
    ]
  },
  {
    "id": "creatinine",
    "canonicalName": "Creatinine",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Creatinine"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "µmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Creat"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMax": 1.2,
    "clinicalRefText": "<= 1.2",
    "clinicalReasoning": "Creatinine <= 1.2 mg/dL is typical normal. 1.3-1.5 mg/dL is borderline high, and > 1.5 mg/dL is high."
  },
  {
    "id": "bun",
    "canonicalName": "Blood Urea Nitrogen (BUN)",
    "profile": "Kidney Function",
    "aliases": [
      "Blood Urea Nitrogen",
      "BUN"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Blod Urea Nitrogen"
    ]
  },
    {
    "id": "urea",
    "canonicalName": "Urea",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Urea"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isTier1": true,
    "isCore": true
  },
  {
    "id": "uric_acid",
    "canonicalName": "Uric Acid",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Uric Acid"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "µmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isTier1": true,
    "clinicalMax": 7,
    "clinicalRefText": "<= 7.0",
    "clinicalReasoning": "Uric acid <= 7.0 mg/dL is standard. 7.1-8.0 mg/dL is borderline high, and > 8.0 mg/dL is high."
  },
  {
    "id": "sodium",
    "canonicalName": "Sodium",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Sodium",
      "Na"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mEq/L",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Na+"
    ]
  },
  {
    "id": "potassium",
    "canonicalName": "Potassium",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Potassium",
      "K"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mEq/L",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "K+"
    ]
  },
  {
    "id": "chloride",
    "canonicalName": "Chloride",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Chloride",
      "Cl"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mEq/L",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Cl-"
    ]
  },
  {
    "id": "calcium",
    "canonicalName": "Calcium",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Calcium",
      "Ca"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Ca2+"
    ]
  },
  {
    "id": "phosphorus",
    "canonicalName": "Phosphorus",
    "profile": "Kidney Function",
    "aliases": [
      "Serum Phosphorus",
      "PO4"
    ],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [
      "mg/dL",
      "mmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Phosphate"
    ]
  },
  {
    "id": "tsh",
    "canonicalName": "TSH",
    "profile": "Thyroid Function",
    "aliases": [
      "Thyroid Stimulating Hormone"
    ],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [
      "µIU/mL",
      "mIU/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isTier1": true,
    "isCore": true,
    "clinicalMin": 0.4,
    "clinicalMax": 4,
    "clinicalRefText": "0.4 - 4.0",
    "clinicalReasoning": "TSH 0.4-4.0 mIU/L is typical normal. Values slightly outside this range may be subclinical (borderline), while larger deviations need attention."
  },
  {
    "id": "ft3",
    "canonicalName": "Free T3",
    "profile": "Thyroid Function",
    "aliases": [
      "Free Triiodothyronine",
      "FT3"
    ],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [
      "pg/mL",
      "pmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "FT3"
    ]
  },
  {
    "id": "ft4",
    "canonicalName": "Free T4",
    "profile": "Thyroid Function",
    "aliases": [
      "Free Thyroxine",
      "FT4"
    ],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [
      "ng/dL",
      "pmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "FT4"
    ]
  },
  {
    "id": "protein_urine",
    "canonicalName": "Protein",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Protein",
      "Albumin"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "mg/dL",
      "Trace",
      "Negative",
      "+",
      "++",
      "+++"
    ],
    "valueType": "positive_negative",
    "commonOcrMistakes": [
      "Prot"
    ]
  },
  {
    "id": "glucose_urine",
    "canonicalName": "Glucose",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Glucose",
      "Sugar",
      "Urine Sugar"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "mg/dL",
      "Negative",
      "+",
      "++",
      "+++"
    ],
    "valueType": "positive_negative",
    "commonOcrMistakes": []
  },
  {
    "id": "cells_urine",
    "canonicalName": "Cells",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Cells",
      "Epithelial Cells",
      "Pus Cells",
      "RBCs",
      "WBCs"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "/HPF"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "casts_urine",
    "canonicalName": "Casts",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Casts"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "/LPF"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ph_urine",
    "canonicalName": "pH",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine pH",
      "Reaction"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      ""
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "specific_gravity_urine",
    "canonicalName": "Specific Gravity",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Specific Gravity",
      "SG"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      ""
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ketones_urine",
    "canonicalName": "Ketones",
    "profile": "Urine Analysis",
    "aliases": [
      "Urine Ketones"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "mg/dL",
      "Negative",
      "Trace",
      "+"
    ],
    "valueType": "positive_negative",
    "commonOcrMistakes": []
  },
  {
    "id": "bilirubin_urine",
    "canonicalName": "Urine Bilirubin",
    "profile": "Urine Analysis",
    "aliases": [
      "Bilirubin"
    ],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [
      "mg/dL",
      "Negative",
      "+",
      "++",
      "+++"
    ],
    "valueType": "positive_negative",
    "commonOcrMistakes": [
      "Urine Bilirubin",
      "Urobilinogen"
    ]
  },
  {
    "id": "vitamind",
    "canonicalName": "Vitamin D",
    "profile": "Vitamins",
    "aliases": [
      "25(OH) Vitamin D",
      "Vitamin D3",
      "25-Hydroxy Vitamin D"
    ],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [
      "ng/mL",
      "nmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Vit D",
      "25OHD"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMin": 30,
    "clinicalRefText": ">= 30",
    "clinicalReasoning": "Vitamin D >= 30 ng/mL is sufficient. 20-29 ng/mL is insufficient (borderline), and < 20 ng/mL is deficient."
  },
  {
    "id": "vitaminb12",
    "canonicalName": "Vitamin B12",
    "profile": "Vitamins",
    "aliases": [
      "Cobalamin",
      "Cyanocobalamin",
      "B12"
    ],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [
      "pg/mL",
      "pmol/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": [
      "Vit B12"
    ],
    "isTier1": true,
    "isCore": true,
    "clinicalMin": 300,
    "clinicalRefText": ">= 300",
    "clinicalReasoning": "Vitamin B12 >= 300 pg/mL is normal. 200-299 pg/mL is borderline, and < 200 pg/mL is deficient."
  },
  {
    "id": "crp",
    "canonicalName": "CRP",
    "profile": "Others",
    "aliases": [
      "C-Reactive Protein",
      "hs-CRP"
    ],
    "expectedSections": [
      "Others"
    ],
    "units": [
      "mg/L"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "esr",
    "canonicalName": "ESR",
    "profile": "Blood Profile",
    "aliases": [
      "Erythrocyte Sedimentation Rate"
    ],
    "expectedSections": [
      "Others"
    ],
    "units": [
      "mm/hr"
    ],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "hematocrit",
    "canonicalName": "Hematocrit",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "packed_cell_volume",
    "canonicalName": "Packed Cell Volume",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "neutrophils",
    "canonicalName": "Neutrophils",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "lymphocytes",
    "canonicalName": "Lymphocytes",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "monocytes",
    "canonicalName": "Monocytes",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "eosinophils",
    "canonicalName": "Eosinophils",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "basophils",
    "canonicalName": "Basophils",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "neutrophil_absolute_count",
    "canonicalName": "Neutrophil Absolute Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lymphocyte_absolute_count",
    "canonicalName": "Lymphocyte Absolute Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "monocyte_absolute_count",
    "canonicalName": "Monocyte Absolute Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "eosinophil_absolute_count",
    "canonicalName": "Eosinophil Absolute Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "basophil_absolute_count",
    "canonicalName": "Basophil Absolute Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "rdw",
    "canonicalName": "RDW",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "rdwcv",
    "canonicalName": "RDW-CV",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "rdwsd",
    "canonicalName": "RDW-SD",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "mpv",
    "canonicalName": "MPV",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "pdw",
    "canonicalName": "PDW",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "pct",
    "canonicalName": "PCT",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "reticulocyte_count",
    "canonicalName": "Reticulocyte Count",
    "profile": "Blood Profile",
    "aliases": [],
    "expectedSections": [
      "Complete Blood Count"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "glycated_hemoglobin",
    "canonicalName": "Glycated Hemoglobin",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "estimated_hba1c",
    "canonicalName": "Estimated HbA1c",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "fasting_plasma_glucose",
    "canonicalName": "Fasting Plasma Glucose",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "glucose_fasting_plasma",
    "canonicalName": "Glucose Fasting Plasma",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "post_prandial_blood_glucose",
    "canonicalName": "Post Prandial Blood Glucose",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "post_prandial_plasma_glucose",
    "canonicalName": "Post Prandial Plasma Glucose",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "glucose_post_prandial_plasma",
    "canonicalName": "Glucose Post Prandial Plasma",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ogtt_fasting",
    "canonicalName": "OGTT Fasting",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ogtt_1_hour",
    "canonicalName": "OGTT 1 Hour",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ogtt_2_hour",
    "canonicalName": "OGTT 2 Hour",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ogtt_3_hour",
    "canonicalName": "OGTT 3 Hour",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "glucose_challenge_test",
    "canonicalName": "Glucose Challenge Test",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "fructosamine",
    "canonicalName": "Fructosamine",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "glycated_albumin",
    "canonicalName": "Glycated Albumin",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "fasting_insulin",
    "canonicalName": "Fasting Insulin",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "post_prandial_insulin",
    "canonicalName": "Post Prandial Insulin",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "insulin",
    "canonicalName": "Insulin",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cpeptide",
    "canonicalName": "C-Peptide",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "homair",
    "canonicalName": "HOMA-IR",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "homab",
    "canonicalName": "HOMA-B",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "quicki",
    "canonicalName": "QUICKI",
    "profile": "Glucose Profile",
    "aliases": [],
    "expectedSections": [
      "Glucose Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vldl",
    "canonicalName": "VLDL",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "nonhdl_cholesterol",
    "canonicalName": "Non-HDL Cholesterol",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "total_cholesterolhdl_ratio",
    "canonicalName": "Total Cholesterol/HDL Ratio",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cholesterolhdl_ratio",
    "canonicalName": "Cholesterol/HDL Ratio",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ldlhdl_ratio",
    "canonicalName": "LDL/HDL Ratio",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "tchdl_ratio",
    "canonicalName": "TC/HDL Ratio",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "apoa1",
    "canonicalName": "ApoA1",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "apolipoprotein_a1",
    "canonicalName": "Apolipoprotein A1",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "apob",
    "canonicalName": "ApoB",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "apolipoprotein_b",
    "canonicalName": "Apolipoprotein B",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "apobapoa1_ratio",
    "canonicalName": "ApoB/ApoA1 Ratio",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lipoproteina",
    "canonicalName": "Lipoprotein(a)",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lpa",
    "canonicalName": "Lp(a)",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "small_dense_ldl",
    "canonicalName": "Small Dense LDL",
    "profile": "Lipid Profile",
    "aliases": [],
    "expectedSections": [
      "Lipid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "blood_urea",
    "canonicalName": "Blood Urea",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "egfr",
    "canonicalName": "eGFR",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "creatinine_clearance",
    "canonicalName": "Creatinine Clearance",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cystatin_c",
    "canonicalName": "Cystatin C",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "bicarbonate",
    "canonicalName": "Bicarbonate",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "magnesium",
    "canonicalName": "Magnesium",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "inorganic_phosphorus",
    "canonicalName": "Inorganic Phosphorus",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "serum_osmolality",
    "canonicalName": "Serum Osmolality",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "anion_gap",
    "canonicalName": "Anion Gap",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "microalbumin",
    "canonicalName": "Microalbumin",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "urine_microalbumin",
    "canonicalName": "Urine Microalbumin",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "albumin_creatinine_ratio",
    "canonicalName": "Albumin Creatinine Ratio",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "acr",
    "canonicalName": "ACR",
    "profile": "Kidney Function",
    "aliases": [],
    "expectedSections": [
      "Kidney Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "indirect_bilirubin",
    "canonicalName": "Indirect Bilirubin",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "alkaline_phosphatase",
    "canonicalName": "Alkaline Phosphatase",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "alp",
    "canonicalName": "ALP",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "gamma_glutamyl_transferase",
    "canonicalName": "Gamma Glutamyl Transferase",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ggt",
    "canonicalName": "GGT",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "globulin",
    "canonicalName": "Globulin",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "albuminglobulin_ratio",
    "canonicalName": "Albumin/Globulin Ratio",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ag_ratio",
    "canonicalName": "A/G Ratio",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ldh",
    "canonicalName": "LDH",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lactate_dehydrogenase",
    "canonicalName": "Lactate Dehydrogenase",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "serum_ammonia",
    "canonicalName": "Serum Ammonia",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "bile_acids",
    "canonicalName": "Bile Acids",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cholinesterase",
    "canonicalName": "Cholinesterase",
    "profile": "Liver Function",
    "aliases": [],
    "expectedSections": [
      "Liver Function Test"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "total_t3",
    "canonicalName": "Total T3",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "total_t4",
    "canonicalName": "Total T4",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": [],
    "isCore": true
  },
  {
    "id": "reverse_t3",
    "canonicalName": "Reverse T3",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "anti_tpo",
    "canonicalName": "Anti TPO",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "tpo_antibody",
    "canonicalName": "TPO Antibody",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "anti_thyroglobulin",
    "canonicalName": "Anti Thyroglobulin",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "thyroglobulin",
    "canonicalName": "Thyroglobulin",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "tsh_receptor_antibody",
    "canonicalName": "TSH Receptor Antibody",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "trab",
    "canonicalName": "TRAb",
    "profile": "Thyroid Function",
    "aliases": [],
    "expectedSections": [
      "Thyroid Profile"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "color",
    "canonicalName": "Color",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "appearance",
    "canonicalName": "Appearance",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "blood",
    "canonicalName": "Blood",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "urobilinogen",
    "canonicalName": "Urobilinogen",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "nitrite",
    "canonicalName": "Nitrite",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "leukocyte_esterase",
    "canonicalName": "Leukocyte Esterase",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "rbc",
    "canonicalName": "RBC",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "urine_rbc",
    "canonicalName": "Urine RBC",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "wbc",
    "canonicalName": "WBC",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "urine_wbc",
    "canonicalName": "Urine WBC",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "squamous_epithelial_cells",
    "canonicalName": "Squamous Epithelial Cells",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "transitional_epithelial_cells",
    "canonicalName": "Transitional Epithelial Cells",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "renal_tubular_epithelial_cells",
    "canonicalName": "Renal Tubular Epithelial Cells",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "hyaline_casts",
    "canonicalName": "Hyaline Casts",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "granular_casts",
    "canonicalName": "Granular Casts",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "rbc_casts",
    "canonicalName": "RBC Casts",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "wbc_casts",
    "canonicalName": "WBC Casts",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "crystals",
    "canonicalName": "Crystals",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "calcium_oxalate_crystals",
    "canonicalName": "Calcium Oxalate Crystals",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "uric_acid_crystals",
    "canonicalName": "Uric Acid Crystals",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "triple_phosphate_crystals",
    "canonicalName": "Triple Phosphate Crystals",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "bacteria",
    "canonicalName": "Bacteria",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "yeast",
    "canonicalName": "Yeast",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "mucus",
    "canonicalName": "Mucus",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "spermatozoa",
    "canonicalName": "Spermatozoa",
    "profile": "Urine Analysis",
    "aliases": [],
    "expectedSections": [
      "Urine Analysis"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "folate",
    "canonicalName": "Folate",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "folic_acid",
    "canonicalName": "Folic Acid",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ferritin",
    "canonicalName": "Ferritin",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "iron",
    "canonicalName": "Iron",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "serum_iron",
    "canonicalName": "Serum Iron",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "tibc",
    "canonicalName": "TIBC",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "uibc",
    "canonicalName": "UIBC",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "transferrin",
    "canonicalName": "Transferrin",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "transferrin_saturation",
    "canonicalName": "Transferrin Saturation",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_a",
    "canonicalName": "Vitamin A",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_e",
    "canonicalName": "Vitamin E",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_k",
    "canonicalName": "Vitamin K",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_b1",
    "canonicalName": "Vitamin B1",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_b2",
    "canonicalName": "Vitamin B2",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_b6",
    "canonicalName": "Vitamin B6",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "vitamin_c",
    "canonicalName": "Vitamin C",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "zinc",
    "canonicalName": "Zinc",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "copper",
    "canonicalName": "Copper",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "selenium",
    "canonicalName": "Selenium",
    "profile": "Vitamins",
    "aliases": [],
    "expectedSections": [
      "Vitamins"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "procalcitonin",
    "canonicalName": "Procalcitonin",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ddimer",
    "canonicalName": "D-Dimer",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "troponin_i",
    "canonicalName": "Troponin I",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "troponin_t",
    "canonicalName": "Troponin T",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "bnp",
    "canonicalName": "BNP",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ntprobnp",
    "canonicalName": "NT-proBNP",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "homocysteine",
    "canonicalName": "Homocysteine",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lactate",
    "canonicalName": "Lactate",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cpk",
    "canonicalName": "CPK",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cpk_total",
    "canonicalName": "CPK Total",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "creatine_kinase",
    "canonicalName": "Creatine Kinase",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ck",
    "canonicalName": "CK",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ckmb",
    "canonicalName": "CK-MB",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "psa",
    "canonicalName": "PSA",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "psa_total",
    "canonicalName": "PSA Total",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "free_psa",
    "canonicalName": "Free PSA",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cea",
    "canonicalName": "CEA",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "afp",
    "canonicalName": "AFP",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ca125",
    "canonicalName": "CA-125",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ca_199",
    "canonicalName": "CA 19-9",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "ca_153",
    "canonicalName": "CA 15-3",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "beta_hcg",
    "canonicalName": "Beta hCG",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "cortisol",
    "canonicalName": "Cortisol",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "acth",
    "canonicalName": "ACTH",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "fsh",
    "canonicalName": "FSH",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "lh",
    "canonicalName": "LH",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "estradiol",
    "canonicalName": "Estradiol",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "progesterone",
    "canonicalName": "Progesterone",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "testosterone",
    "canonicalName": "Testosterone",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "free_testosterone",
    "canonicalName": "Free Testosterone",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "prolactin",
    "canonicalName": "Prolactin",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  },
  {
    "id": "dheas",
    "canonicalName": "DHEAS",
    "profile": "Others",
    "aliases": [],
    "expectedSections": [
      "Others"
    ],
    "units": [],
    "valueType": "numeric",
    "commonOcrMistakes": []
  }
];

export function normalizeAlias(value:string){
  return value.toLowerCase().replace(/[().,%]/g,"").replace(/\s+/g," ").trim();
}
