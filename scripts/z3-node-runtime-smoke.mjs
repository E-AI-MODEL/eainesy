// Executes the real Z3 WASM solver in Node, never a mocked solver.
// Solver health check only; does not certify the semantic safety of model responses.
import { init } from 'z3-solver';

const { Context } = await init();
const { Solver, Int } = new Context('eainesy-ci-smoke');
const x = Int.const('x');
const solver = new Solver();
solver.add(x.eq(Int.val(1)));
const sat = await solver.check();
if (sat !== 'sat') throw new Error(`Expected SAT, got ${sat}`);
solver.add(x.eq(Int.val(2)));
const unsat = await solver.check();
if (unsat !== 'unsat') throw new Error(`Expected UNSAT, got ${unsat}`);
console.log('Actual Z3 solver: SAT and UNSAT verified under Node');
