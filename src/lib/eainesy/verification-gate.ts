/** Mandatory proof gate for automatic responses. No clinical classification is inferred from solver errors. */
import type { Z3Certificate } from './z3cert';
export type VerificationReason = 'modelcheck_failed'|'z3_inconsistent'|'z3_inconclusive'|'z3_unavailable';
export class VerificationHalt extends Error {
  constructor(public readonly reason: VerificationReason, public readonly z3: Z3Certificate | null, public readonly modelCheckPass: boolean) {
    super(`Verification interrupted: ${reason}`);
    this.name = 'VerificationHalt';
  }
}
export function assertVerificationGate(modelCheckPass: boolean, z3: Z3Certificate | null): void {
  if (!modelCheckPass) throw new VerificationHalt('modelcheck_failed', z3, false);
  if (!z3 || z3.result === 'skipped' || !z3.available) throw new VerificationHalt('z3_unavailable', z3, true);
  if (z3.result === 'unknown') throw new VerificationHalt('z3_inconclusive', z3, true);
  if (z3.result === 'unsat') throw new VerificationHalt('z3_inconsistent', z3, true);
  if (z3.result !== 'sat') throw new VerificationHalt('z3_inconclusive', z3, true);
}
