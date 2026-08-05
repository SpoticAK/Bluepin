import {
  biomarkerRegistry,
  normalizeAlias,
  type BiomarkerDefinition,
  type BiomarkerProfile
} from "./biomarkerRegistry";

export const biomarkerById = new Map<string, BiomarkerDefinition>();
export const biomarkerByAlias = new Map<string, BiomarkerDefinition[]>();
export const biomarkersByProfile = new Map<BiomarkerProfile, BiomarkerDefinition[]>();
export const biomarkerByOcrMistake = new Map<string, BiomarkerDefinition[]>();

for (const biomarker of biomarkerRegistry) {
  biomarkerById.set(biomarker.id, biomarker);

  const addAlias = (alias: string) => {
    const norm = normalizeAlias(alias);
    const list = biomarkerByAlias.get(norm) ?? [];
    if (!list.find(b => b.id === biomarker.id)) list.push(biomarker);
    biomarkerByAlias.set(norm, list);
  };

  addAlias(biomarker.canonicalName);
  for (const alias of biomarker.aliases) {
    addAlias(alias);
  }

  if (biomarker.commonOcrMistakes) {
    for (const mistake of biomarker.commonOcrMistakes) {
      const norm = normalizeAlias(mistake);
      const list = biomarkerByOcrMistake.get(norm) ?? [];
      if (!list.find(b => b.id === biomarker.id)) list.push(biomarker);
      biomarkerByOcrMistake.set(norm, list);
    }
  }

  const list = biomarkersByProfile.get(biomarker.profile) ?? [];
  list.push(biomarker);
  biomarkersByProfile.set(biomarker.profile, list);
}

export function getBiomarkerByAlias(alias: string) {
  return biomarkerByAlias.get(normalizeAlias(alias)) ?? [];
}

export function getBiomarkersForProfile(profile: BiomarkerProfile) {
  return biomarkersByProfile.get(profile) ?? [];
}

export function getBiomarkerById(id: string) {
  return biomarkerById.get(id);
}

export type MatchContext = {
  section?: string;
  unit?: string;
  nearbyBiomarkers?: string[];
  reportType?: string;
};

export function matchBiomarker(name: string, context: MatchContext = {}) {
  const normalized = normalizeAlias(name);

  // Custom Regex pattern matching for Glucose variations
  if (/fasting/.test(normalized) && /(glucose|sugar)/.test(normalized)) {
    const candidate = biomarkerById.get('glucose_fasting');
    if (candidate) {
      return { biomarkerId: candidate.id, canonicalName: candidate.canonicalName, profile: candidate.profile, confidence: 'High', matchedBy: 'regex_pattern' };
    }
  }

  if (/post[\s-]*prandial/.test(normalized) && /(glucose|sugar)/.test(normalized)) {
    const candidate = biomarkerById.get('glucose_pp');
    if (candidate) {
      return { biomarkerId: candidate.id, canonicalName: candidate.canonicalName, profile: candidate.profile, confidence: 'High', matchedBy: 'regex_pattern' };
    }
  }

  if (/random/.test(normalized) && /(glucose|sugar)/.test(normalized)) {
    const candidate = biomarkerById.get('glucose_random');
    if (candidate) {
      return { biomarkerId: candidate.id, canonicalName: candidate.canonicalName, profile: candidate.profile, confidence: 'High', matchedBy: 'regex_pattern' };
    }
  }

  if (/hba1c|hemoglobin\s*a1c|glycosylated\s*hemoglobin/.test(normalized)) {
    const candidate = biomarkerById.get('hba1c');
    if (candidate) {
      return { biomarkerId: candidate.id, canonicalName: candidate.canonicalName, profile: candidate.profile, confidence: 'High', matchedBy: 'regex_pattern' };
    }
  }

  if (/eag|estimated\s*average\s*glucose/.test(normalized)) {
    const candidate = biomarkerById.get('eag');
    if (candidate) {
      return { biomarkerId: candidate.id, canonicalName: candidate.canonicalName, profile: candidate.profile, confidence: 'High', matchedBy: 'regex_pattern' };
    }
  }

  let candidates = biomarkerByAlias.get(normalized);
  let matchedBy = 'exact_alias';

  if (!candidates || candidates.length === 0) {
    candidates = biomarkerByOcrMistake.get(normalized);
    matchedBy = 'ocr_mistake';
  }

  if (!candidates || candidates.length === 0) {
    return { biomarkerId: null, canonicalName: name, profile: 'Others' as BiomarkerProfile, confidence: 'None', matchedBy: 'fallback' };
  }

  if (candidates.length === 1) {
    return {
      biomarkerId: candidates[0].id,
      canonicalName: candidates[0].canonicalName,
      profile: candidates[0].profile,
      confidence: matchedBy === 'exact_alias' ? 'High' : 'Medium',
      matchedBy
    };
  }

  // Disambiguation
  if (context.section) {
    const sectionNorm = normalizeAlias(context.section);
    // Find candidate where expectedSections matches sectionNorm
    const sectionMatches = candidates.filter(c => 
      c.expectedSections.some(s => normalizeAlias(s) === sectionNorm)
    );
    if (sectionMatches.length === 1) {
      return { biomarkerId: sectionMatches[0].id, canonicalName: sectionMatches[0].canonicalName, profile: sectionMatches[0].profile, confidence: 'High', matchedBy: 'section' };
    }
    // Alternatively, try to match by profile name
    const profileMatches = candidates.filter(c => normalizeAlias(c.profile) === sectionNorm);
    if (profileMatches.length === 1) {
      return { biomarkerId: profileMatches[0].id, canonicalName: profileMatches[0].canonicalName, profile: profileMatches[0].profile, confidence: 'High', matchedBy: 'profile_name' };
    }
  }

  if (context.unit) {
    const unitNorm = normalizeAlias(context.unit);
    const unitMatches = candidates.filter(c => c.units.some(u => normalizeAlias(u) === unitNorm));
    if (unitMatches.length === 1) {
      return { biomarkerId: unitMatches[0].id, canonicalName: unitMatches[0].canonicalName, profile: unitMatches[0].profile, confidence: 'Medium', matchedBy: 'unit' };
    }
  }

  // Value type checking (positive/negative/trace vs numeric)
  if (context.unit) {
     const unitNorm = normalizeAlias(context.unit);
     const isQualitative = ['positive', 'negative', 'trace'].includes(unitNorm);
     if (isQualitative) {
        const qualMatches = candidates.filter(c => c.valueType === 'positive_negative');
        if (qualMatches.length === 1) {
           return { biomarkerId: qualMatches[0].id, canonicalName: qualMatches[0].canonicalName, profile: qualMatches[0].profile, confidence: 'Medium', matchedBy: 'value_type' };
        }
     }
  }

  return {
    biomarkerId: candidates[0].id,
    canonicalName: candidates[0].canonicalName,
    profile: candidates[0].profile,
    confidence: 'Low',
    matchedBy: 'ambiguous_fallback'
  };
}
