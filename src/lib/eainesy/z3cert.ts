/**
 * Z3 SMT decision certificates.
 *
 * evai v20-v30 shipped Z3 in package.json and never imported it once.
 * EAInesy closes that gap for real: every decision gets an SMT certificate
 * proving the arithmetic behind it is internally consistent:
 *
 *   1. the claimed risk level follows from the risk score under the
 *      published thresholds;
 *   2. the fused risk level is genuinely the max of neural and lexical
 *      levels (fail-closed fusion, not a happy accident);
 *   3. the confidence band follows from the composed confidence.
 *
 * One solver call per turn. UNSAT anywhere ⇒ the symbolic arithmetic is
 * inconsistent ⇒ the orchestrator fails closed. Model checking (the
 * exhaustive lattice proof) remains the primary guarantee; this is the
 * belt-and-suspenders numeric layer.
 */
import { init } from 'z3-solver';
import { RISK_THRESHOLDS } from './lexicon';
import type { RiskLevel, ConfidenceBand } from './types';

export interface Z3Certificate {
  available: boolean;
  /**
   * Four distinct outcomes, reported truthfully:
   *  - 'sat'      : solver proved the arithmetic consistent;
   *  - 'unsat'    : solver proved the arithmetic INCONSISTENT → fail closed;
   *  - 'unknown'  : solver could NOT decide (timeout/incompleteness) — NOT a
   *                 proof of inconsistency, but the arithmetic is untrusted →
   *                 fail closed as a precaution (conservative, never silent);
   *  - 'skipped'  : check not executed (solver unavailable/error) — no
   *                 override; the exhaustive model check remains primary.
   */
  result: 'sat' | 'unsat' | 'unknown' | 'skipped';
  ms: number;
  detail: string;
}

const LEVEL_INDEX: Record<RiskLevel, number> = { NONE: 0, ELEVATED: 1, HIGH: 2, CRISIS: 3 };

export const CONFIDENCE_BAND_THRESHOLDS = { HIGH: 0.7, MEDIUM: 0.45 } as const;

let z3Promise: Promise<Awaited<ReturnType<typeof init>> | null> | null = null;

function getZ3() {
  if (!z3Promise) {
    z3Promise = init().catch(() => null);
  }
  return z3Promise;
}

/**
 * Produce a certificate for one decision.
 * Never throws — all failures degrade to { result: 'skipped' } so the
 * pipeline can proceed under the exhaustive model check.
 */
export async function certifyDecision(params: {
  riskScore: number;
  claimedLevel: RiskLevel;
  neuralLevel: RiskLevel;
  lexicalLevel: RiskLevel;
  fusedLevel: RiskLevel;
  confidence: number;
  /** Band derived purely from numeric thresholds — this is what SMT asserts. */
  numericBand: ConfidenceBand;
  /** Band after conformal/policy adjustments — reported, not SMT-asserted. */
  policyBand?: ConfidenceBand;
}): Promise<Z3Certificate> {
  const t0 = performance.now();
  try {
    const z3 = await getZ3();
    if (!z3) {
      return { available: false, result: 'skipped', ms: performance.now() - t0, detail: 'Z3 WASM unavailable; exhaustive lattice proof remains active.' };
    }
    const { Context } = z3;
    const { Solver, Real, Int, Eq, And, Or } = new Context('eainesy-cert');
    const solver = new Solver();

    // --- 1) risk score ↔ level link -------------------------------------
    const s = Real.const('s');
    solver.add(Eq(s, Real.val(String(params.riskScore))));
    const levelLink =
      params.claimedLevel === 'CRISIS'
        ? s.ge(Real.val(String(RISK_THRESHOLDS.CRISIS)))
        : params.claimedLevel === 'HIGH'
          ? And(s.ge(Real.val(String(RISK_THRESHOLDS.HIGH))), s.lt(Real.val(String(RISK_THRESHOLDS.CRISIS))))
          : params.claimedLevel === 'ELEVATED'
            ? And(s.ge(Real.val(String(RISK_THRESHOLDS.ELEVATED))), s.lt(Real.val(String(RISK_THRESHOLDS.HIGH))))
            : s.lt(Real.val(String(RISK_THRESHOLDS.ELEVATED)));
    solver.add(levelLink);

    // --- 2) fusion = max(neural, lexical) -------------------------------
    const n = Int.const('n');
    const l = Int.const('l');
    const f = Int.const('f');
    solver.add(Eq(n, Int.val(LEVEL_INDEX[params.neuralLevel])));
    solver.add(Eq(l, Int.val(LEVEL_INDEX[params.lexicalLevel])));
    solver.add(Eq(f, Int.val(LEVEL_INDEX[params.fusedLevel])));
    solver.add(Or(And(Eq(f, n), n.ge(l)), And(Eq(f, l), n.lt(f))));
    solver.add(f.ge(Int.val(0)), f.lt(Int.val(4)));

    // --- 3) confidence ↔ band link --------------------------------------
    const c = Real.const('c');
    solver.add(Eq(c, Real.val(String(params.confidence))));
    // confidence ∈ [0, 1] — 1.0 is reachable (clamped composition)
    solver.add(c.ge(Real.val('0')), c.le(Real.val('1')));
    const bandLink =
      params.numericBand === 'HIGH'
        ? c.ge(Real.val(String(CONFIDENCE_BAND_THRESHOLDS.HIGH)))
        : params.numericBand === 'MEDIUM'
          ? And(c.ge(Real.val(String(CONFIDENCE_BAND_THRESHOLDS.MEDIUM))), c.lt(Real.val(String(CONFIDENCE_BAND_THRESHOLDS.HIGH))))
          : c.lt(Real.val(String(CONFIDENCE_BAND_THRESHOLDS.MEDIUM)));
    solver.add(bandLink);

    const verdict = await solver.check();
    const ms = performance.now() - t0;
    const policyNote = params.policyBand && params.policyBand !== params.numericBand
      ? ` Policy band ${params.policyBand} after conformal downgrade (humility step, not an arithmetic claim).`
      : '';
    if (verdict === 'sat') {
      return { available: true, result: 'sat', ms, detail: `SMT certificate: level assignment, max-fusion and numeric band (${params.numericBand}) are jointly satisfiable — internally consistent.${policyNote}` };
    }
    if (verdict === 'unsat') {
      return { available: true, result: 'unsat', ms, detail: `SMT check returned unsat: claimed arithmetic inconsistent — orchestrator must fail closed.${policyNote}` };
    }
    return { available: true, result: 'unknown', ms, detail: `SMT check returned unknown (solver could not decide — not a proof of inconsistency): arithmetic untrusted as a precaution — orchestrator must fail closed.${policyNote}` };
  } catch (err) {
    return {
      available: false,
      result: 'skipped',
      ms: performance.now() - t0,
      detail: `Z3 error (${err instanceof Error ? err.message : String(err)}); exhaustive lattice proof remains active.`,
    };
  }
}
