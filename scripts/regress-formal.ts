/**
 * Task 01 — permanente regressietests voor de formele beslisverificatie.
 * Gebruikt uitsluitend productielogica (geen parallelle implementatie).
 * Run: bun scripts/regress-formal.ts
 *
 * Dekking:
 *  R1  PREGNANCY_POSTNATAL × ε — pin van het ontworpen gedrag (F8 > F11-order)
 *  R2  stijlschaling blijft in de bewezen INV-21-envelop [4,8]
 *  R3  canned fail-safe antwoorden passeren het eigen outputbeleid
 *  R4  conformal verlaagt de band slechts, hoogstens één stap (élke ε)
 *  R5  volledige modelcheck: heel het rooster (21.600 sinds v2) × alle invarianten PASS
 *  R6  max-fusie consistent met score→niveau-drempels
 *  R7  OP-1 precisie: labels vangen, gewone ondersteunende taal niet
 *  R8  Z3-UNSAT fail-closed override: contract + certificaat-rapportage
 *  R9  taal-fallback (fail-closed pad): score-based, gedeelde tokens tellen niet
 *  R10 Task 21 normen: O1 veiligheidsfamilie op élke band; O2 ACUTE-nood-erkenning
 *      (P66); P20-pin; crisisplan-fit
 *  R11 Task 23 N5-herstel: lexicon vangt de vier gemeten NL-noodfrases;
 *      ontkenningen/onschuldige contexten blijven marker-loos
 */
import {
  enumerateControllerInputs,
  CONFIDENCE_BANDS,
  LATTICE_STATES,
  type ControllerInput,
} from '../src/lib/eainesy/types';
import { STEER_EPSILON, REPLY_STYLES, styleMaxSentences } from '../src/lib/eainesy/steer';
import { conformalCheck } from '../src/lib/eainesy/conformal';
import { decide, DECISION_RULES, crisisOverridePlanTemplate } from '../src/lib/eainesy/controller';
import { runModelCheck } from '../src/lib/eainesy/modelchecker';
import { applyZ3Fallback, guessLanguage } from '../src/lib/eainesy/orchestrator';
import { scoreToRiskLevel, collectLexicalMarkers, collectProtective, lexicalRiskScore } from '../src/lib/eainesy/lexicon';
import { verifyOutput, CANNED_REPLIES, cannedReplyFor } from '../src/lib/eainesy/outputpolicy';
import { CONFIDENCE_BAND_THRESHOLDS } from '../src/lib/eainesy/z3cert';
import type { Plan } from '../src/lib/eainesy/types';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  —  ${detail}` : ''}`);
  if (!ok) failures++;
}
function bandOf(c: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  return c >= CONFIDENCE_BAND_THRESHOLDS.HIGH ? 'HIGH' : c >= CONFIDENCE_BAND_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';
}
const PREGNANCY_BASE = {
  riskLevel: 'NONE',
  frameValidity: 'VALID',
  distressLevel: 'ELEVATED',
  piiState: 'CLEAN',
  novelty: 'KNOWN',
  intent: 'PREGNANCY_POSTNATAL',
} as const;

// R1 — pin het ontworpen ε-gedrag (regelorder F8 boven F11 is bewust; elke
// stille verschuiving in drempels of regelorder breekt deze test).
{
  const cfStd = conformalCheck('MEDIUM', 0.47, STEER_EPSILON.standard);
  const dStd = decide({ ...PREGNANCY_BASE, confidenceBand: cfStd.band } as ControllerInput);
  check('R1a conf 0,47 + ε=0,15 → P57/SAFETY_RESPONSE', cfStd.band === 'MEDIUM' && dStd.ruleId === 'P57' && dStd.action === 'SAFETY_RESPONSE');
  const cfStr = conformalCheck('MEDIUM', 0.47, STEER_EPSILON.strict);
  const dStr = decide({ ...PREGNANCY_BASE, confidenceBand: cfStr.band } as ControllerInput);
  check('R1b conf 0,47 + ε=0,30 → P20/CLARIFY (humility-first, gedocumenteerd)', cfStr.band === 'LOW' && dStr.ruleId === 'P20' && dStr.action === 'CLARIFY');
  const dHigh = decide({ ...PREGNANCY_BASE, confidenceBand: 'HIGH' } as ControllerInput);
  check('R1c hoge band → P57 ongeacht ε', dHigh.ruleId === 'P57');
}

// R2 — stijlschaling binnen de bewezen envelop (INV-21 dekt nu stijl mee)
{
  const bases = [...new Set(DECISION_RULES.map((r) => r.plan.maxSentences))];
  let bad = 0;
  for (const b of bases) for (const st of REPLY_STYLES) {
    const v = styleMaxSentences(b, st);
    if (v < 4 || v > 8) bad++;
  }
  check('R2 alle sjabloon-bounds × 3 stijlen binnen [4,8]', bad === 0, `${bases.join(',')} × concise/normal/elaborate`);
}

// R3 — canned fail-safe antwoorden passeren het outputbeleid — per REGEL,
// met het echte plan van die regel (sinds v2: cannedReplyFor voegt elke door
// het plan vereiste hulplijn in; P67 heeft een eigen, eerlijke tekst).
{
  let bad = 0; let n = 0; const det: string[] = [];
  for (const rule of DECISION_RULES) {
    for (const st of REPLY_STYLES) {
      for (const lang of ['nl', 'en'] as const) {
        const plan: Plan = {
          action: rule.action, ruleId: rule.id, tone: rule.plan.tone, language: lang,
          allowedMoves: rule.plan.allowedMoves, forbiddenMoves: rule.plan.forbiddenMoves, kgCitations: [], crisisResources: [],
          mustInclude: rule.plan.mustInclude, maxSentences: styleMaxSentences(rule.plan.maxSentences, st),
        };
        n++;
        const res = verifyOutput(cannedReplyFor(plan), plan);
        if (!res.pass) { bad++; det.push(`${rule.id}/${lang}/${st}:${res.violations.map((v) => v.ruleId).join(',')}`); }
      }
    }
  }
  check('R3 elk canned antwoord passeert het outputbeleid van zijn eigen regel', bad === 0, bad ? det.slice(0, 6).join(' | ') : `${n} combinaties groen`);
}

// R4 — conformal: band daalt hoogstens één stap, stijgt nooit, blijft in het rooster
{
  let bad = 0;
  const scores = [0, 0.05, 0.1, 0.2, 0.3, 0.44, 0.45, 0.46, 0.47, 0.5, 0.6, 0.69, 0.7, 0.85, 1];
  const epsilons = [0.02, 0.06, 0.15, 0.3, 0.45];
  for (const band of CONFIDENCE_BANDS) {
    for (const score of scores) {
      for (const eps of epsilons) {
        const cf = conformalCheck(band, score, eps);
        const bi = CONFIDENCE_BANDS.indexOf(cf.band);
        const ri = CONFIDENCE_BANDS.indexOf(band);
        if (bi < 0 || bi > ri || ri - bi > 1) bad++;
      }
    }
  }
  check('R4 conformal monotone afwaardering (max 1 stap, blijft in rooster)', bad === 0, `${bad} overtredingen over ${CONFIDENCE_BANDS.length * scores.length * epsilons.length} combinaties`);
}

// R5 — volledige modelcheck
{
  const mc = runModelCheck();
  const failing = mc.invariants.filter((x) => !x.pass).map((x) => `${x.id}×${x.violations}`).join(',');
  check(`R5 modelcheck PASS · ${LATTICE_STATES} berichttoestanden + ${mc.layers.conversation.statesChecked} gesprekstoestanden × ${mc.invariantsChecked} invarianten · ${DECISION_RULES.length} + ${mc.conversationRuleCount} regels`, mc.pass && mc.layers.base.statesChecked === LATTICE_STATES && mc.layers.conversation.pass && mc.invariantsChecked >= 43 && mc.ruleCount === DECISION_RULES.length, `${mc.statesChecked} × ${mc.invariantsChecked} · ${mc.ms.toFixed(1)} ms${failing ? ' · FAIL ' + failing : ''}`);
}

// R6 — fusie-monotonie
{
  const ORDER = ['NONE', 'ELEVATED', 'HIGH', 'CRISIS'] as const;
  const scores = [0, 0.5, 1.4, 1.5, 1.6, 3.4, 3.5, 4.9, 5, 6, 12];
  let bad = 0;
  for (const a of scores) for (const b of scores) {
    const byScore = scoreToRiskLevel(Math.max(a, b));
    const byLevels = ORDER[Math.max(ORDER.indexOf(scoreToRiskLevel(a)), ORDER.indexOf(scoreToRiskLevel(b)))];
    if (byScore !== byLevels) bad++;
  }
  check('R6 max-fusie consistent met drempels', bad === 0);
}

// R7 — OP-1 precisie
{
  const mustFlag = [
    'Je hebt depressie, denk ik.', 'dat is ongetwijfeld een burn-out', 'you have depression',
    'You suffer from PTSD', 'je lijdt aan een angststoornis', "that's clearly ADHD",
  ];
  const mustPass = [
    'Je hebt het goed dat je het zegt.',
    'do you have someone around you right now?',
    'Je hebt dit goed gedaan.',
    'You have been carrying this for a long time.',
    'dat is fijn om te horen',
  ];
  const flag = (t: string) => verifyOutput(t, {
    action: 'THERAPEUTIC_DIALOG', tone: 'warm', language: 'nl',
    allowedMoves: ['x'], forbiddenMoves: ['y'], kgCitations: [], crisisResources: [],
    mustInclude: ['z'], maxSentences: 6,
  }).violations.some((v) => v.ruleId === 'OP-1');
  const missed = mustFlag.filter((t) => !flag(t));
  const falseHits = mustPass.filter((t) => flag(t));
  check('R7 OP-1 vangt klinische labels', missed.length === 0, missed.join(' | '));
  check('R7b OP-1 vangt geen gewone ondersteunende taal', falseHits.length === 0, falseHits.join(' | '));
}

// R8 — Z3 fail-closed override (één productiedefinitie: applyZ3Fallback,
// exact de tak die processTurn uitvoert). Vangt stille wijzigingen in het
// veiligste-actie-beleid, in de 4-statige rapportage (sat/unsat/unknown/
// skipped) en in de coherentie van het crisisplan.
{
  const templateOf = (id: string) => DECISION_RULES.find((r) => r.id === id)!.plan;
  const fbUnsat = applyZ3Fallback('unsat', { action: 'CLARIFY', planTemplate: templateOf('P20') });
  check('R8a unsat → actie CRISIS_PROTOCOL (fail-closed)', fbUnsat.action === 'CRISIS_PROTOCOL');
  check('R8b unsat → certificaat rapporteert override expliciet (from/to/reden)',
    fbUnsat.override?.from === 'CLARIFY' && fbUnsat.override?.to === 'CRISIS_PROTOCOL' && typeof fbUnsat.override?.reason === 'string' && fbUnsat.override.reason.length > 0);
  check('R8c sat/skipped → regelactie en -sjabloon onaangetast, geen override-veld',
    (() => { const s = applyZ3Fallback('sat', { action: 'REFERRAL', planTemplate: templateOf('P22') }); const k = applyZ3Fallback('skipped', { action: 'THERAPEUTIC_DIALOG', planTemplate: templateOf('P34') }); return s.action === 'REFERRAL' && s.planTemplate === templateOf('P22') && !s.override && k.action === 'THERAPEUTIC_DIALOG' && k.planTemplate === templateOf('P34') && !k.override; })());
  check('R8d override levert het coherente crisisplan (P04-sjabloon, geen hybride)',
    fbUnsat.planTemplate === crisisOverridePlanTemplate() && fbUnsat.planTemplate === templateOf('P04') && fbUnsat.planTemplate.tone === 'calm');
  const fbUnknown = applyZ3Fallback('unknown', { action: 'CLARIFY', planTemplate: templateOf('P20') });
  check('R8e unknown → óók fail-closed, reden meldt expliciet "onbeslist"',
    fbUnknown.action === 'CRISIS_PROTOCOL' && fbUnknown.planTemplate === crisisOverridePlanTemplate() && (fbUnknown.override?.reason ?? '').includes('onbeslist'));
}

// R9 — taal-fallback op het fail-closed pad (parse mislukt + replyLang=auto).
// Oude code: één los (en dubbelzinnig) woord klapte de taal om — een NL-bericht
// zonder functiewoorden eindigde Engels en "I met her" werd NL. Nieuwe code:
// score met eenduidige markers; gedeelde tokens (is/me/want/was/we/die) tellen
// voor geen van beide; geen signaal → nl (producttaal).
{
  check('R9a NL zonder functiewoorden → nl (was: en)',
    guessLanguage('Zit vast, alles voelt zwaar, niemand die luistert.') === 'nl');
  check('R9b EN met NL-klinkende token ("met", "Ben") → en (was: nl)',
    guessLanguage('I met Ben today and we talked for hours.') === 'en');
  check('R9c EN crisisbericht → en',
    guessLanguage("I can't sleep, I feel hopeless and alone.") === 'en');
  check('R9d NL crisisbericht → nl',
    guessLanguage('Ik kan niet meer slapen, alles is zwaar.') === 'nl');
  check('R9e geen signaal → nl (producttaal)',
    guessLanguage('...') === 'nl' && guessLanguage('12345') === 'nl');
  check('R9f gedeelde tokens (is/me/want/die/we) tellen voor geen van beide',
    guessLanguage('want') === 'nl' && guessLanguage('die') === 'nl'
    && guessLanguage('you and I') === 'en' && guessLanguage('ik en jij') === 'nl');
}

// R10 — Task 21, punt 1: normen bij veranderende onzekerheid, onafhankelijk
// via decide() over het héle rooster herleid (niet uit de invarianten
// overgenomen, maar naast hen gecontroleerd):
//  O1  onzekerheid mag het risicosignaal nooit wegnemen: risk ≥ ELEVATED ⇒
//      {CRISIS_PROTOCOL, SAFETY_RESPONSE} op élke band (spiegel INV-1/2/3);
//  O2  ACUTE nood mag bij band-daling nooit uitmonden in een blote vraag
//      zonder erkenning: P66 garandeert erkenning, P20 blijft voor rustige
//      invoer; crisis/abuse-etiketten worden al eerder afgehandeld.
//  Bewijsgrens (eerlijk): O2 is regelboek-order + deze pin — plandinhoud
//  zit níet in het formele rooster (het rooster ziet alleen acties).
{
  const SAFE: string[] = ['CRISIS_PROTOCOL', 'SAFETY_RESPONSE'];
  let o1 = 0, o2 = 0, o2cells = 0;
  for (const input of enumerateControllerInputs()) {
    const d = decide(input);
    if ((input.riskLevel === 'HIGH' || input.riskLevel === 'ELEVATED') && !SAFE.includes(d.action)) o1++;
    if (input.riskLevel === 'CRISIS' && d.action !== 'CRISIS_PROTOCOL') o1++;
    if (input.confidenceBand === 'LOW' && input.riskLevel === 'NONE' && input.frameValidity === 'VALID'
      && input.piiState === 'CLEAN' && input.novelty === 'KNOWN' && input.distressLevel === 'ACUTE'
      && !['CRISIS_SIGNAL', 'ABUSE_DISCLOSURE'].includes(input.intent)) {
      o2cells++;
      if (d.ruleId !== 'P66' || !d.planTemplate.mustInclude.includes('acknowledgment of how heavy this is')) o2++;
    }
  }
  check('R10a O1: risk ≥ ELEVATED blijft in de veiligheidsfamilie op élke band', o1 === 0, `${o1} schendingen over ${enumerateControllerInputs().length} roosterpunten`);
  check('R10b O2: ACUTE nood bij LOW-band → P66 met erkenning, nooit blote P20', o2 === 0, `${o2cells} ACUTE-cellen gecontroleerd`);
  const r1b = decide({ ...PREGNANCY_BASE, confidenceBand: 'LOW' } as ControllerInput);
  check('R10c P20 blijft de blote vraag voor niet-acute invoer (R1-pin onaangetast)',
    r1b.ruleId === 'P20' && r1b.action === 'CLARIFY');
  const crisisPlan = crisisOverridePlanTemplate();
  const fitOk = (['nl', 'en'] as const).every((lang) => verifyOutput(CANNED_REPLIES.CRISIS_PROTOCOL[lang], {
    action: 'CRISIS_PROTOCOL', tone: crisisPlan.tone, language: lang,
    allowedMoves: [...crisisPlan.allowedMoves], forbiddenMoves: [...crisisPlan.forbiddenMoves],
    kgCitations: ['res:113', 'res:huisarts'],
    crisisResources: ['113 Zelfmoordpreventie — bel 113 of 0800-0113 (NL) / 1813 (BE)', 'Huisarts(enpost)'],
    mustInclude: [...crisisPlan.mustInclude], maxSentences: crisisPlan.maxSentences,
  }).pass);
  check('R10d canned crisis-antwoord past op het eigen P04-crisisplan (nl+en)', fitOk);
}

// R11 — Task 23, N5-herstel: het lexicon vangt de vier in Task 22 gemeten
// NL-noodfrases (productiescanner), terwijl ontkenningen en onschuldige
// contexten marker-loos blijven. Geen automatische escalatie op losse
// trefwoorden: elke toevoeging is een meerwoordige, verankerde frase die
// via de bestaande max-fusie in de bestaande veiligheids-/crisisfamilie
// uitmondt — er is geen nieuwe escaliemechaniek toegevoegd.
{
  const catch_ = (t: string) => {
    const { markers } = collectLexicalMarkers(t);
    const score = lexicalRiskScore(markers, collectProtective(t).length);
    return { level: scoreToRiskLevel(score), types: markers.map((m) => m.type as string) };
  };
  const orig: [string, string, string][] = [
    ['ik zie geen uitweg meer', 'ELEVATED', 'HOPELESSNESS'],
    ['ik drink elke avond wijn om de pijn te vergeten', 'ELEVATED', 'SUBSTANCE'],
    ['soms denk ik erover om niet meer terug te komen', 'CRISIS', 'SUICIDAL_IDEATION'],
    ['het zou rustig zijn als ik er morgen niet meer was', 'CRISIS', 'SUICIDAL_IDEATION'],
  ];
  const bad = orig.filter(([t, lvl, typ]) => { const r = catch_(t); return r.level !== lvl || !r.types.includes(typ); });
  check('R11a lexicon vangt de vier gemeten noodfrases (Task 22 N5-herstel)', bad.length === 0, bad.map((b) => b[0]).join(' | '));
  const clean = [
    'ik zie wél een uitweg, ik ga hulp zoeken',
    'ik drink helemaal geen alcohol meer',
    'ik denk er nooit over om ermee te stoppen',
    'het zou niet rustig zijn als ik er morgen niet meer was',
    'ik denk erover om juist wél weer terug te komen op mijn besluit',
    'na de brand was er geen uitweg uit het gebouw',
    'ik drink elke avond thee voor het slapen',
    'ik denk erover om niet meer terug te komen bij de voetbalclub',
    'wie geeft de kat eten als ik er volgende week even niet meer ben',
    'op de afdeling praten we over uitwegen voor het transportprobleem',
    'bewegen helpt me om de pijn te vergeten',
    'de commissie vroeg om niet meer terug te komen op het voorstel',
  ];
  const dirty = clean.filter((t) => catch_(t).level !== 'NONE');
  check('R11b ontkenningen en onschuldige contexten blijven marker-loos', dirty.length === 0, dirty.join(' | '));
  const crisisDecide = decide({
    intent: 'DEPRESSIVE_REPORT', riskLevel: 'CRISIS', frameValidity: 'VALID',
    confidenceBand: 'LOW', distressLevel: 'LOW', piiState: 'CLEAN', novelty: 'KNOWN',
  } as ControllerInput);
  const elevDecide = decide({
    intent: 'DEPRESSIVE_REPORT', riskLevel: 'ELEVATED', frameValidity: 'VALID',
    confidenceBand: 'LOW', distressLevel: 'LOW', piiState: 'CLEAN', novelty: 'KNOWN',
  } as ControllerInput);
  check('R11c lexicale escalatie landt in de bestaande veiligheids-/crisisfamilie',
    crisisDecide.action === 'CRISIS_PROTOCOL' && elevDecide.action === 'SAFETY_RESPONSE',
    `${crisisDecide.ruleId}/${crisisDecide.action} · ${elevDecide.ruleId}/${elevDecide.action}`);
}

console.log('───────────────────────────────────────────────────────────────');
console.log(failures === 0 ? 'REGRESSIE: ALLE CHECKS GROEN' : `REGRESSIE: ${failures} CHECK(S) ROOD`);
process.exit(failures === 0 ? 0 : 1);
