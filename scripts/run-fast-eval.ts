/* In-process fast eval — validates all probes against the symbolic stack.
 * Run: bun --preload ./tests/support/preload.ts scripts/run-fast-eval.ts */
import { runEval } from '../src/lib/eainesy/redteam';

async function main() {
  const out = await runEval('fast');
  console.log(`FAST EVAL: ${out.passed}/${out.total} passed in ${out.ms}ms`);
  for (const r of out.results.filter((x) => !x.pass)) {
    console.log(`  ✗ ${r.id} ${r.name}: got ${r.action}, ${r.reason}`);
  }
  process.exit(out.passed === out.total ? 0 : 1);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
