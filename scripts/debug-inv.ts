import { runModelCheck } from '../src/lib/eainesy/modelchecker';
const r = runModelCheck();
for (const inv of r.invariants) {
  if (!inv.pass && inv.firstViolation) {
    console.log(inv.id, 'firstViolation:', JSON.stringify(inv.firstViolation.input), '→', inv.firstViolation.action);
  }
}
