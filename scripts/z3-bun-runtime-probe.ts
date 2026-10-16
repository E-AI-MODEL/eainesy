// Runs the real production cert under the product's Bun runtime.
// Unlike deterministic tests, MUST NOT mock z3-solver.
// Failure is evidence of a deployment/runtime integration defect.
import { certifyDecision } from '../src/lib/eainesy/z3cert';
const cert = await certifyDecision({
  riskScore: 5, claimedLevel: 'CRISIS', neuralLevel: 'CRISIS',
  lexicalLevel: 'ELEVATED', fusedLevel: 'CRISIS',
  confidence: 0.8, numericBand: 'HIGH',
});
console.log('BUN_REAL_Z3_RESULT', JSON.stringify(cert));
if (cert.result !== 'sat' || !cert.available) process.exitCode = 1;
