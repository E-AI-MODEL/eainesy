import { DECISION_RULES, FAMILIES } from '../src/lib/eainesy/controller';
const ids = new Set(DECISION_RULES.map((r) => r.id));
const fams = new Set(FAMILIES.map((f) => f.id));
console.log('rules:', DECISION_RULES.length, 'unique ids:', ids.size);
console.log('all families valid:', DECISION_RULES.every((r) => fams.has(r.family)));
const bad = DECISION_RULES.filter((r) => !fams.has(r.family));
console.log('bad family rules:', bad.map((r) => r.id + ':' + r.family));
console.log('has P47:', ids.has('P47'), 'has P50:', ids.has('P50'));
