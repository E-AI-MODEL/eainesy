/** Four-status verification contract. Synthetic certificates test the gate;
 * the separate Node audit uses real Z3, and HTTP smoke exercises real SAT.
 */
import { describe, expect, test } from 'bun:test';
import { assertVerificationGate, VerificationHalt } from '../src/lib/eainesy/verification-gate';
import type { Z3Certificate } from '../src/lib/eainesy/z3cert';

function certificate(result: Z3Certificate['result'], available = result !== 'skipped'): Z3Certificate {
  return { result, available, detail: 'synthetic verification fixture', ms: 0 };
}

describe('mandatory verification gate', () => {
  test('SAT + successful finite modelcheck allows response', () => {
    expect(() => assertVerificationGate(true, certificate('sat'))).not.toThrow();
  });
  for (const [result, reason] of [
    ['unsat', 'z3_inconsistent'],
    ['unknown', 'z3_inconclusive'],
    ['skipped', 'z3_unavailable'],
  ] as const) {
    test(`${result} blocks automatic generation without a crisis classification`, () => {
      try {
        assertVerificationGate(true, certificate(result));
        throw new Error('Should have halted');
      } catch (e) {
        expect(e).toBeInstanceOf(VerificationHalt);
        expect((e as VerificationHalt).reason).toBe(reason);
        expect((e as VerificationHalt).z3?.result).toBe(result);
      }
    });
  }
  test('reported SAT without an available solver is not a valid certificate', () => {
    expect(() => assertVerificationGate(true, certificate('sat', false))).toThrow(VerificationHalt);
  });
  test('missing certificate cannot authorize an answer', () => {
    expect(() => assertVerificationGate(true, null)).toThrow(VerificationHalt);
  });
  test('failed modelcheck rejects response even if Z3 reports SAT', () => {
    try {
      assertVerificationGate(false, certificate('sat'));
      throw new Error('Should have halted');
    } catch(e) {
      expect(e).toBeInstanceOf(VerificationHalt);
      expect((e as VerificationHalt).reason).toBe('modelcheck_failed');
      expect((e as VerificationHalt).modelCheckPass).toBe(false);
    }
  });
});
