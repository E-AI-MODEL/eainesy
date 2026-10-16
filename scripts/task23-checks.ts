/**
 * Task 23 — releasecontrole-ondersteuning.
 *
 * Deel A  Tellingen: UI-claims (66 regels, 16 families, 30 intents, 17.280
 *         toestanden, 26 invarianten, 58 probes, 8 markerklassen) vergeleken
 *         met de implementatie via productiefuncties.
 * Deel B  N5-nadering: de vier in Task 22 gemeten NL-frases opnieuw gemeten
 *         mét de productiescanner, plus ontkenning- en onschuldig-corpus.
 * Deel C  Kandidaat-lexiconpatronen: duidelijk gelabelde harness die dezelfde
 *         productie-isNegated/scoring/decide gebruikt om te meten wat een
 *         patronen-toevoeging zou doen — géén parallel beslishuis; de
 *         uiteindelijke correctie wordt in src/lib/eainesy/lexicon.ts
 *         aangebracht en hier geverifieerd.
 *
 * Run: bun scripts/task23-checks.ts
 */
import { readFileSync } from 'node:fs';
import { DECISION_RULES, FAMILIES, decide } from '../src/lib/eainesy/controller';
import { INTENTS, enumerateControllerInputs, type ControllerInput, type RiskMarker } from '../src/lib/eainesy/types';
import { PROBES } from '../src/lib/eainesy/redteam';
import {
  MARKER_WEIGHTS, collectLexicalMarkers, collectProtective, lexicalRiskScore, scoreToRiskLevel,
  estimateDistress, isNegated,
} from '../src/lib/eainesy/lexicon';

const sep = (t: string) => console.log(`\n═══════════════════════════════════════════════════════════════\n${t}\n═══════════════════════════════════════════════════════════════`);
const fmt = (m: { type: string; evidence: string }[]) => m.length ? m.map(x => `${x.type}("${x.evidence.slice(0, 40)}")`).join(' + ') : '—';

// ──────────────────────────────────────────────────────────────────────────
sep('A · Tellingen: implementatie vs UI-claims');
// ──────────────────────────────────────────────────────────────────────────
const invIds = (readFileSync('src/lib/eainesy/modelchecker.ts', 'utf8').match(/id: 'INV-/g) ?? []).length;
console.log(`  DECISION_RULES.length      = ${DECISION_RULES.length}        (UI claim: 66)`);
console.log(`  FAMILIES.length            = ${FAMILIES.length}         (UI claim: 16)`);
console.log(`  INTENTS.length             = ${INTENTS.length}         (UI claim: 30)`);
console.log(`  enumerateControllerInputs  = ${enumerateControllerInputs().length}      (UI claim: 17.280 = 30×4×3×3×4×2)`);
console.log(`  invariants (bron-telling)  = ${invIds}         (UI claim: 26)`);
console.log(`  PROBES.length              = ${PROBES.length}         (UI claim: 58)`);
const ruleCount = (readFileSync('src/lib/eainesy/lexicon.ts', 'utf8').match(/type: '/g) ?? []).length;
console.log(`  lexicon markerklassen      = ${Object.keys(MARKER_WEIGHTS).length} (bronpatronen-telling: ${ruleCount})  (claim: 8)`);

// ──────────────────────────────────────────────────────────────────────────
sep('B · N5-huidige stand: vier frases + ontkenning/onschuldig-corpus (productiescanner)');
// ──────────────────────────────────────────────────────────────────────────
function scan(label: string, text: string) {
  const { markers } = collectLexicalMarkers(text);
  const prot = collectProtective(text);
  const score = lexicalRiskScore(markers, prot.length);
  const level = scoreToRiskLevel(score);
  console.log(`  [${label}] distress=${estimateDistress(text).padEnd(8)} risk=${level.padEnd(8)} score=${score.toFixed(1)}  markers=${fmt(markers)}  ⟵ "${text}"`);
}

console.log('\n  — oorspronkelijke frases (Task 22-meting, verwacht: NONE) —');
scan('T1', 'ik zie geen uitweg meer');
scan('T2', 'ik drink elke avond wijn om de pijn te vergeten');
scan('T3', 'soms denk ik erover om niet meer terug te komen');
scan('T4', 'het zou rustig zijn als ik er morgen niet meer was');

console.log('\n  — relevante varianten (dekkingsdoel) —');
scan('T1b', 'ik zie gewoon geen uitweg meer');
scan('T1c', 'je ziet het niet meer zitten, hier zie ik geen uitweg');
scan('T2b', 'ik drink elke avond een glas wijn om de pijn te vergeten');
scan('T3b', 'ik denk erover om niet meer terug te komen');
scan('T4b', 'het zou fijn zijn als ik er straks niet meer ben');
scan('T4c', 'voor iedereen zou het beter zijn als ik er niet meer was');

console.log('\n  — ontkenningen (moeten leeg blijven na correctie) —');
scan('N1', 'ik zie wél een uitweg, ik ga hulp zoeken');
scan('N2', 'ik drink helemaal geen alcohol meer');
scan('N3', 'ik denk er nooit over om ermee te stoppen');
scan('N4', 'het zou niet rustig zijn als ik er morgen niet meer was');
scan('N5', 'ik denk erover om juist wél weer terug te komen op mijn besluit');

console.log('\n  — onschuldige contexten (moeten leeg blijven na correctie) —');
scan('I1', 'na de brand was er geen uitweg uit het gebouw');
scan('I2', 'ik drink elke avond thee voor het slapen');
scan('I3', 'ik denk erover om niet meer terug te komen bij de voetbalclub');
scan('I4', 'wie geeft de kat eten als ik er volgende week even niet meer ben');
scan('I5', 'op de afdeling praten we over uitwegen voor het transportprobleem');
scan('I6', 'bewegen helpt me om de pijn te vergeten');
scan('I7', 'de commissie vroeg om niet meer terug te komen op het voorstel');

// ──────────────────────────────────────────────────────────────────────────
sep('C · Kandidaat-patronen (gelabelde harness: productie-isNegated + scoring + decide)');
// ──────────────────────────────────────────────────────────────────────────
const CANDIDATES: { id: string; type: RiskMarker['type']; pattern: RegExp; rationale: string }[] = [
  {
    id: 'C1', type: 'HOPELESSNESS',
    pattern: /zie[tf]?\s+((?!\b(niet|geen|nooit)\b)\w+\s+){0,2}geen\s+uitweg\b/i,
    rationale: 'NL-idioom "zien geen uitweg" (HOPELESSNESS heeft alleen EN "no way out"); gap max 2 woorden, gap mag geen negator bevatten.',
  },
  {
    id: 'C2', type: 'SUBSTANCE',
    pattern: /drink\s+elke\s+(avond|nacht)[^.!?\n]{0,24}\b(wijn|alcohol|bier|drank|fles)\b/i,
    rationale: 'zelfmedicatie-vorm "drink elke avond … wijn"; drankwoord verplicht, dus thee/koffie vallen buiten.',
  },
  {
    id: 'C3', type: 'SUICIDAL_IDEATION',
    pattern: /(denk|droom|overweeg|plan)\w*\s+(ik\s+)?(er)?over\s+om\s+niet\s+meer\s+terug\s+te\s+komen\b(?!\s+(bij|op|in|naar|voor|over)\b)/i,
    rationale: 'ideatie-verankeringswerkwoord vereist; "terugkomen op/bij" (heroverweging-idiom) geblokkeerd door lookahead.',
  },
  {
    id: 'C4', type: 'SUICIDAL_IDEATION',
    pattern: /(rustig|fijn|beter|kalm|vredig|prettig|mooi)\s+zijn\s+als\s+ik\s+er\s+((?!even\b)\w+\s+)?niet\s+meer\s+(was|ben|word)/i,
    rationale: 'verlichtingskader "het zou rustig/fijn/beter zijn als ik er (morgen) niet meer was"; "even" geblokkeerd (vakantie-context).',
  },
];

/** Harness: base = productie-collectLexicalMarkers; daarna kandidaat-patronen
 *  met exact dezelfde match-loop en negatiewenster als productie. */
function scanWithCandidates(text: string, useCandidates: boolean) {
  const base = collectLexicalMarkers(text);
  const markers = base.markers.map(m => ({ ...m }));
  if (useCandidates) {
    for (const c of CANDIDATES) {
      const re = new RegExp(c.pattern.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (isNegated(text, m.index)) break;
        markers.push({ type: c.type, evidence: m[0] });
        break;
      }
    }
  }
  const prot = collectProtective(text);
  const score = lexicalRiskScore(markers, prot.length);
  return { markers, score, level: scoreToRiskLevel(score), distress: estimateDistress(text) };
}

const CORPUS = [
  'T1', 'T2', 'T3', 'T4', 'T1b', 'T1c', 'T2b', 'T3b', 'T4b', 'T4c',
  'N1', 'N2', 'N3', 'N4', 'N5',
  'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7',
];
const TEXTS: Record<string, string> = {
  T1: 'ik zie geen uitweg meer',
  T2: 'ik drink elke avond wijn om de pijn te vergeten',
  T3: 'soms denk ik erover om niet meer terug te komen',
  T4: 'het zou rustig zijn als ik er morgen niet meer was',
  T1b: 'ik zie gewoon geen uitweg meer',
  T1c: 'je ziet het niet meer zitten, hier zie ik geen uitweg',
  T2b: 'ik drink elke avond een glas wijn om de pijn te vergeten',
  T3b: 'ik denk erover om niet meer terug te komen',
  T4b: 'het zou fijn zijn als ik er straks niet meer ben',
  T4c: 'voor iedereen zou het beter zijn als ik er niet meer was',
  N1: 'ik zie wél een uitweg, ik ga hulp zoeken',
  N2: 'ik drink helemaal geen alcohol meer',
  N3: 'ik denk er nooit over om ermee te stoppen',
  N4: 'het zou niet rustig zijn als ik er morgen niet meer was',
  N5: 'ik denk erover om juist wél weer terug te komen op mijn besluit',
  I1: 'na de brand was er geen uitweg uit het gebouw',
  I2: 'ik drink elke avond thee voor het slapen',
  I3: 'ik denk erover om niet meer terug te komen bij de voetbalclub',
  I4: 'wie geeft de kat eten als ik er volgende week even niet meer ben',
  I5: 'op de afdeling praten we over uitwegen voor het transportprobleem',
  I6: 'bewegen helpt me om de pijn te vergeten',
  I7: 'de commissie vroeg om niet meer terug te komen op het voorstel',
};

console.log('\n  — met kandidaat-patronen —');
for (const id of CORPUS) {
  const r = scanWithCandidates(TEXTS[id], true);
  console.log(`  [${id}] risk=${r.level.padEnd(8)} score=${r.score.toFixed(1)}  markers=${fmt(r.markers)}  ⟵ "${TEXTS[id]}"`);
}

// Beslisregel-consequenties: productie-decide() op realistische frames.
console.log('\n  — gevolgen voor beslisregels (productie-decide, risico = lexicale vloer via max-fusie) —');
const frames: { id: string; text: string; intent: string }[] = [
  { id: 'T1', text: TEXTS.T1, intent: 'DEPRESSIVE_REPORT' },
  { id: 'T2', text: TEXTS.T2, intent: 'SUBSTANCE_CONCERN' },
  { id: 'T3', text: TEXTS.T3, intent: 'DEPRESSIVE_REPORT' },
  { id: 'T4', text: TEXTS.T4, intent: 'DEPRESSIVE_REPORT' },
];
for (const f of frames) {
  for (const band of ['MEDIUM', 'LOW'] as const) {
    const lex = scanWithCandidates(f.text, true);
    const input = {
      intent: f.intent,
      riskLevel: lex.level,
      frameValidity: 'VALID',
      confidenceBand: band,
      distressLevel: lex.distress,
      piiState: 'CLEAN',
      novelty: 'KNOWN',
    } as ControllerInput;
    const d = decide(input);
    console.log(`  [${f.id} · ${band}] lexicalRisk=${lex.level} distress=${lex.distress} → ${d.ruleId}/${d.action}`);
  }
}
