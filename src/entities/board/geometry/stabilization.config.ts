const DEFAULT_STABILIZATION_STRENGTH = 65;

const PROFILES = {
  light: { minCutoff: 12, beta: 0.06, maxDeviation: 1.5 },
  strong: { minCutoff: 6, beta: 0.04, maxDeviation: 3 },
} as const;

const DERIVATIVE_CUTOFF = 1;

const FALLBACK_DT = 1 / 120;

export const StabilizationConfig = {
  PROFILES,
  FALLBACK_DT,
  DERIVATIVE_CUTOFF,
  DEFAULT_STABILIZATION_STRENGTH,
};
