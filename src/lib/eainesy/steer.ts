/**
 * Steering ("bijsturing") — the user-facing knobs of the demo.
 *
 * What steering MAY change (all in the fail-safe direction or cosmetic):
 *  - strictness: how fast the conformal gate downgrades confidence
 *    (larger ε ⇒ downgrades sooner ⇒ more clarifying questions/caution).
 *    Any ε keeps the controller inside the proven lattice: a downgrade can
 *    only LOWER the confidence band, and the lattice was verified for all
 *    bands. Steering therefore never leaves proven behaviour.
 *  - style: a hint on reply length, applied by scaling the plan's
 *    maxSentences bound — the output policy (OP-8) still enforces it.
 *  - replyLang: force the reply language (the output policy OP-11 still
 *    verifies language/plan consistency).
 *
 * What steering NEVER changes: the decision rules, the conversation rules, the invariants,
 * the model check, the output policy rules, the audit chain.
 */

export const STRICTNESS = ['relaxed', 'standard', 'strict'] as const;
export type Strictness = (typeof STRICTNESS)[number];

export const REPLY_STYLES = ['concise', 'normal', 'elaborate'] as const;
export type ReplyStyle = (typeof REPLY_STYLES)[number];

export const REPLY_LANGS = ['auto', 'nl', 'en'] as const;
export type ReplyLang = (typeof REPLY_LANGS)[number];

export interface SteerSettings {
  strictness: Strictness;
  style: ReplyStyle;
  replyLang: ReplyLang;
}

export const DEFAULT_STEER: SteerSettings = {
  strictness: 'standard',
  style: 'normal',
  replyLang: 'auto',
};

/** Conformal ε per strictness. Larger ε = downgrade sooner = more caution. */
export const STEER_EPSILON: Record<Strictness, number> = {
  relaxed: 0.06,
  standard: 0.15,
  strict: 0.3,
};

export const EPSILON_FLOOR = 0.02;
export const EPSILON_CEIL = 0.45;

/** Scale the plan's sentence bound by reply style — clamped to the proven
 *  INV-21 envelope [4, 8] so steering can never leave the verified range. */
export function styleMaxSentences(base: number, style: ReplyStyle): number {
  if (style === 'concise') return Math.max(4, base - 2);
  if (style === 'elaborate') return Math.min(8, base + 3);
  return base;
}

export function clampEpsilon(eps: number): number {
  return Math.min(EPSILON_CEIL, Math.max(EPSILON_FLOOR, eps));
}

/** Accept partial/unknown input (API or localStorage) → safe SteerSettings. */
export function normalizeSteer(input: unknown): SteerSettings {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const strictness = STRICTNESS.includes(raw.strictness as Strictness)
    ? (raw.strictness as Strictness)
    : DEFAULT_STEER.strictness;
  const style = REPLY_STYLES.includes(raw.style as ReplyStyle)
    ? (raw.style as ReplyStyle)
    : DEFAULT_STEER.style;
  const replyLang = REPLY_LANGS.includes(raw.replyLang as ReplyLang)
    ? (raw.replyLang as ReplyLang)
    : DEFAULT_STEER.replyLang;
  return { strictness, style, replyLang };
}

export function isDefaultSteer(s: SteerSettings): boolean {
  return s.strictness === DEFAULT_STEER.strictness && s.style === DEFAULT_STEER.style && s.replyLang === DEFAULT_STEER.replyLang;
}
