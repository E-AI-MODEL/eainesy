// Deep contract test of the *production* Z3 certificate with the real solver.
// The TypeScript production module is transpiled by Bun but executed with Node,
// avoiding Bun's Z3/WASM pthread issue. No mocks; no real user/model data.
import assert from 'node:assert/strict';
import { certifyDecision, CONFIDENCE_BAND_THRESHOLDS } from '../.z3-audit/z3cert.mjs';

const level = (score) => score >= 5 ? 'CRISIS' : score >= 3.5 ? 'HIGH' : score >= 1.5 ? 'ELEVATED' : 'NONE';
const ordinal = { NONE: 0, ELEVATED: 1, HIGH: 2, CRISIS: 3 };
const maxLevel = (a,b) => ordinal[a] >= ordinal[b] ? a : b;
const band = (confidence) => confidence >= CONFIDENCE_BAND_THRESHOLDS.HIGH ? 'HIGH' : confidence >= CONFIDENCE_BAND_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';
let passed = 0;
let elapsed = 0;
let skipped = 0;
async function test(name, params, expected) {
  const cert = await certifyDecision(params);
  elapsed += cert.ms;
  if (cert.result === 'skipped') skipped++;
  assert.equal(cert.available, true, name + ': solver unavailable; ' + cert.detail);
  assert.equal(cert.result, expected, name + ': ' + cert.detail);
  console.log('PASS ' + name + ': ' + cert.result + ' (' + cert.ms.toFixed(1) + 'ms)');
  passed++;
  return cert;
}
function good(neuralScore, lexicalScore, confidence) {
  const neuralLevel=level(neuralScore),lexicalLevel=level(lexicalScore);
  return {
    riskScore: Math.max(neuralScore, lexicalScore),
    claimedLevel: maxLevel(neuralLevel,lexicalLevel),
    neuralLevel,lexicalLevel,
    fusedLevel: maxLevel(neuralLevel,lexicalLevel),
    confidence, numericBand: band(confidence),
  };
}
// Boundaries, both fusion directions, equal levels, confidence thresholds.
for (const [n,l] of [[0,0],[1.49,0],[0,1.5],[3.49,0],[0,3.5],[4.99,0],[0,5],[6,5],[3.5,5],[5,3.5],[2,4],[4,2]]) {
  for(const conf of [0,0.4499999,0.45,0.6999999,0.7,1]) {
    await test('valid n='+n+' l='+l+' conf='+conf,good(n,l,conf),'sat');
  }
}
// Mutation tests: each asserted independent constraint must reject bad data.
await test('wrong risk threshold', {...good(0,0,0.8),claimedLevel:'CRISIS'},'unsat');
await test('wrong maximum fusion', {...good(5,1.5,0.8),fusedLevel:'ELEVATED'},'unsat');
await test('wrong confidence band', {...good(0,0,0.2),numericBand:'HIGH'},'unsat');
await test('confidence below 0', {...good(0,0,0.2),confidence:-0.01},'unsat');
await test('confidence above 1', {...good(0,0,0.8),confidence:1.01},'unsat');
await test('risk boundary off by epsilon', {...good(3.49,0,0.8),claimedLevel:'HIGH'},'unsat');
await test('policy downgrade is distinct from numeric band', {...good(0,0,0.7),policyBand:'MEDIUM'},'sat');
console.log('Z3 DEEP AUDIT PASS: '+passed+' real production-certificate checks; skipped='+skipped+'; accumulated solver ms='+elapsed.toFixed(1));
