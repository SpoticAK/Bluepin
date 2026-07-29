export const getHealthScoreTheme = (score: number | null) => {
  if (score === null) return { hueRotate: 155, hueRotateDark: -25, brightness: 0.85, opacity: 0.75, glowColor: '#8b5cf6' };
  
  if (score >= 90) {
    // 90-100 — Excellent: deep premium violet -> luminous purple/lavender
    return { hueRotate: 130, hueRotateDark: -50, brightness: 1.05, opacity: 0.95, glowColor: '#7c3aed' }; // Violet 600
  }
  if (score >= 75) {
    // 75-89 — Good: rich lavender -> vibrant violet
    return { hueRotate: 155, hueRotateDark: -25, brightness: 1.0, opacity: 0.90, glowColor: '#8b5cf6' }; // Violet 500
  }
  if (score >= 60) {
    // 60-74 — Fair: warm mauve -> dusty lavender
    return { hueRotate: 185, hueRotateDark: 5, brightness: 0.95, opacity: 0.85, glowColor: '#b382c8' };
  }
  // Below 60 — Needs Attention: muted dusty rose -> soft mauve
  return { hueRotate: 215, hueRotateDark: 35, brightness: 0.90, opacity: 0.80, glowColor: '#c8828f' };
};
