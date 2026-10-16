/**
 * Task 21 — vervolgcontrole formele verificatie: onderzoek vóór herstel.
 * Gebruikt uitsluitend productiefuncties (geen parallelle implementatie).
 * Run: bun scripts/task21-onderzoek.ts
 *
 * Deel A — punt 1: alle band-overgangen in het beslisrooster, norm-check.
 * Deel B — punt 2a: Gemengd plan bij Z3-override — faalt het canned
 *          crisis-antwoord op het plan van de oorspronkelijke regel?
 */
import { enumerateControllerInputs, type ControllerInput } from '../src/lib/eainesy/types';
import { decide, DECISION_RULES } from '../src/lib/eainesy/controller';
import { verifyOutput, CANNED_REPLIES } from '../src/lib/eainesy/outputpolicy';
import type { Plan } from '../src/lib/eainesy/types';

// ── Deel A · punt 1 — beleid bij veranderende onzekerheid ──────────────────
// Norm (eerst geformuleerd, daarna getoetst):
//   O1  risk ≥ ELEVATED ⇒ action ∈ {CRISIS_PROTOCOL, SAFETY_RESPONSE} op élke band
//       (spiegel van INV-1/2/3; hier onafhankelijk via decide() afgeleid)
//   O2  LOW + risk=NONE ⇒ humble {CLARIFY, ABSTAIN_HITL}, behalve crisis/abuse-etiket
//       (spiegel van INV-5)
//   O3  (nieuw, te beoordelen) acute nood mag bij band-daling nooit leiden tot een
//       antwoord zonder erkenning of zorg-signaling
type Band = ControllerInput['confidenceBand'];
const BANDS: Band[] = ['HIGH', 'MEDIUM', 'LOW'];

interface StateKey { [k: string]: unknown }
const sansBand = (i: ControllerInput): StateKey => {
  const { confidenceBand, ...rest } = i;
  return rest as unknown as StateKey;
};
const key = (i: StateKey) => JSON.stringify(i);

const actions = new Map<string, Record<Band, { action: string; rule: string }>>();
for (const input of enumerateControllerInputs()) {
  const k = key(sansBand(input));
  const d = decide(input);
  if (!actions.has(k)) actions.set(k, { HIGH: null, MEDIUM: null, LOW: null } as never);
  actions.get(k)![input.confidenceBand] = { action: d.action, rule: d.ruleId };
}

let o1Violations = 0;
let o2Violations = 0;
const transitions = new Map<string, number>();
const acuteLowCells: string[] = [];

for (const [k, per] of actions) {
  const s = JSON.parse(k) as Omit<ControllerInput, 'confidenceBand'>;
  const prev: { action: string; rule: string } | null = per.HIGH ?? per.MEDIUM;
  const low = per.LOW;
  // O1 — onafhankelijke herleiding van INV-1/2/3
  if (s.riskLevel === 'CRISIS' && low.action !== 'CRISIS_PROTOCOL') o1Violations++;
  if ((s.riskLevel === 'HIGH' || s.riskLevel === 'ELEVATED')
    && !['CRISIS_PROTOCOL', 'SAFETY_RESPONSE'].includes(low.action)) o1Violations++;
  // O2 — spiegel van INV-5 (CLEAN alleen; PII-pad wijkt bewust af via F7)
  if (s.confidenceBand === undefined && s.piiState === 'CLEAN' && s.riskLevel === 'NONE'
    && !['CLARIFY', 'ABSTAIN_HITL', 'CRISIS_PROTOCOL', 'SAFETY_RESPONSE'].includes(low.action)
    && !(s.intent === 'ABUSE_DISCLOSURE')) o2Violations++;
  // overgangen door band-daling (wat er écht verandert)
  const tops = [per.HIGH, per.MEDIUM].filter(Boolean) as { action: string; rule: string }[];
  for (const t of tops) {
    if (t.action !== low.action) {
      const label = `${t.action}→${low.action} | risk=${s.riskLevel} distress=${s.distressLevel} (${t.rule}→${low.rule})`;
      transitions.set(label, (transitions.get(label) ?? 0) + 1);
    }
  }
  // O3-kandidaten: acuut nood + bekende grond + schone invoer + LOW-band
  if (s.distressLevel === 'ACUTE' && s.riskLevel === 'NONE' && s.frameValidity === 'VALID'
    && s.piiState === 'CLEAN' && s.novelty === 'KNOWN'
    && !['CRISIS_SIGNAL', 'ABUSE_DISCLOSURE'].includes(s.intent)
    && low.action === 'CLARIFY' && low.rule === 'P20') {
    acuteLowCells.push(`${s.intent} (MEDIUM: ${per.MEDIUM?.action}/${per.MEDIUM?.rule})`);
  }
}

console.log('══ Deel A · band-overgangen in het rooster ══');
console.log(`states (zonder band): ${actions.size}`);
console.log(`O1-schendingen (risk≥ELEVATED verlaat veiligheidsfamilie): ${o1Violations}`);
console.log(`O2-schendingen (LOW+NONE verlaat humble zonder uitzondering): ${o2Violations}`);
console.log(`\nalle actie-overgangen door band-daling:`);
for (const [label, n] of [...transitions.entries()].sort()) console.log(`  ${n}×  ${label}`);
console.log(`\nO3-kandidaten — ACUTE nood → blote P20-CLARIFY bij LOW-band (${acuteLowCells.length} intent-cellen):`);
for (const c of [...new Set(acuteLowCells)].sort()) console.log(`  ${c}`);

// ── Deel B · punt 2a — gemengd plan bij Z3-override ────────────────────────
// Bij UNSAT overschrijft de orchestrator de actie naar CRISIS_PROTOCOL maar
// bouwt vandaag het plan uit decision.planTemplate (de oorspronkelijke regel).
// Demonstreer met productiefuncties wat het canned crisis-antwoord dan over-
// komt bij élk regel-sjabloon.
console.log('\n══ Deel B · canned CRISIS-antwoord op elk vreemd plan-sjabloon ══');
let mixedFails = 0;
const perRule = new Map<string, string[]>();
for (const rule of DECISION_RULES) {
  for (const lang of ['nl', 'en'] as const) {
    const plan: Plan = {
      action: 'CRISIS_PROTOCOL',
      tone: rule.plan.tone,
      language: lang,
      allowedMoves: [...rule.plan.allowedMoves],
      forbiddenMoves: [...rule.plan.forbiddenMoves],
      kgCitations: [],
      crisisResources: ['113 Zelfmoordpreventie — bel 113 of 0800-0113 (NL) / 1813 (BE)', 'Huisarts(enpost)'],
      mustInclude: [...rule.plan.mustInclude],
      maxSentences: rule.plan.maxSentences,
    };
    const v = verifyOutput(CANNED_REPLIES.CRISIS_PROTOCOL[lang], plan);
    if (!v.pass) {
      mixedFails++;
      const list = perRule.get(rule.id) ?? [];
      list.push(`${lang}: ${v.violations.map((x) => x.ruleId).join(',')}`);
      perRule.set(rule.id, list);
    }
  }
}
console.log(`combinaties waar het canned crisis-antwoord het eigen beleid faalt: ${mixedFails} van ${DECISION_RULES.length * 2}`);
for (const [id, list] of [...perRule.entries()].sort()) console.log(`  ${id} → ${list.join(' | ')}`);
