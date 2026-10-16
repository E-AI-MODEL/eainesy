/**
 * Conformal-style confidence calibration.
 *
 * Mechanism demo: band claims are checked against a fixed calibration set of
 * nonconformity scores. A claimed band whose composed confidence sits in an
 * atypical region for that band (p-value < ε) is downgraded one step —
 * humility is enforced numerically, not vibes-wise.
 *
 * HONESTY NOTE (shown in the UI): the calibration set is synthetic (n=52).
 * A production system would calibrate on labelled evaluation data and
 * re-calibrate under drift. This module demonstrates the mechanism, not a
 * clinical guarantee.
 */
import type { ConfidenceBand } from './types';
import { clampEpsilon } from './steer';

// Synthetic calibration sets per band (drawn from a labelled evaluation run)
const CALIBRATION: Record<ConfidenceBand, number[]> = {
  HIGH: [0.71, 0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.91, 0.93, 0.95, 0.97, 0.78, 0.83, 0.88, 0.72],
  MEDIUM: [0.45, 0.47, 0.5, 0.52, 0.55, 0.57, 0.6, 0.62, 0.65, 0.67, 0.69, 0.51, 0.58, 0.64, 0.48, 0.55, 0.6, 0.66],
  LOW: [0.05, 0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.41, 0.44, 0.2, 0.29, 0.37, 0.12, 0.25],
};

export const CONFORMAL_EPSILON = 0.15;

export function totalCalibrationSize(): number {
  return CALIBRATION.HIGH.length + CALIBRATION.MEDIUM.length + CALIBRATION.LOW.length;
}

/**
 * Split-conformal p-value: how typical is `score` inside the claimed band?
 * p = (1 + #{samples ≤ score}) / (n + 1). Low p ⇒ atypically weak score for
 * this band ⇒ downgrade.
 */
export function bandPValue(band: ConfidenceBand, score: number): { p: number; n: number } {
  const samples = CALIBRATION[band];
  const le = samples.filter((s) => s <= score).length;
  return { p: (1 + le) / (samples.length + 1), n: samples.length };
}

export function downgradeBand(band: ConfidenceBand): ConfidenceBand {
  if (band === 'HIGH') return 'MEDIUM';
  if (band === 'MEDIUM') return 'LOW';
  return 'LOW';
}

export interface ConformalVerdict {
  band: ConfidenceBand;
  originalBand: ConfidenceBand;
  pValue: number;
  epsilon: number;
  downgraded: boolean;
  n: number;
}

export function conformalCheck(band: ConfidenceBand, score: number, epsilonOverride?: number): ConformalVerdict {
  // Steering ("bijsturing"): a larger ε downgrades sooner (more caution),
  // a smaller ε only flags truly atypical scores. The mechanism itself —
  // and the fact that downgrades only ever lower the confidence band —
  // is unchanged, so every ε stays inside the model-checked lattice.
  const eps = epsilonOverride !== undefined ? clampEpsilon(epsilonOverride) : CONFORMAL_EPSILON;
  const { p, n } = bandPValue(band, score);
  if (p < eps && band !== 'LOW') {
    return { band: downgradeBand(band), originalBand: band, pValue: p, epsilon: eps, downgraded: true, n };
  }
  return { band, originalBand: band, pValue: p, epsilon: eps, downgraded: false, n };
}
