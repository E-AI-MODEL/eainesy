/*
 * Conversation-level evaluation from the command line.
 *   fast (no GLM, deterministic):  bun --preload ./tests/support/preload.ts scripts/run-scenarios.ts
 *   full (live GLM, deployment):   bun scripts/run-scenarios.ts full
 */
import { runScenarios } from '../src/lib/eainesy/scenarios';

async function main() {
  const mode = process.argv[2] === 'full' ? 'full' : 'fast';
  const out = await runScenarios(mode);
  console.log(`SCENARIOS (${mode}): ${out.passed}/${out.total} passed in ${out.ms}ms`);
  for (const r of out.results) {
    const m = r.metrics;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id} ${r.name.nl}  ·  turns=${m.turns} focus@${m.turnsToFocus ?? '—'} act=${Math.round(m.actShare * 100)}% safety=${m.safetyTurns}`);
    for (const f of r.failures) console.log(`      ✗ ${f}`);
  }
  process.exit(out.passed === out.total ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
