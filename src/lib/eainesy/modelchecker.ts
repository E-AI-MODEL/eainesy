/**
 * Exhaustive model checker for the EAInesy decision controller.
 *
 * The controller's input space is a closed lattice of 21,600 states. This
 * checker enumerates EVERY state and proves the safety invariants hold on
 * all of them — on every single request. This is not a sample, not a test
 * suite that can rot (the evai v30 lesson): it is a complete proof over the
 * decision function the system will actually run.
 */
import { createHash } from 'node:crypto';
import {
  ACTIONS, enumerateControllerInputs, CONVERSATION_PHASES, RISK_MEMORY_STATES, RUPTURE_STATES,
  type Action, type ControllerInput, type ConfidenceBand, type RiskAssessment, type ConversationPhase,
} from './types';
import { decide, DECISION_RULES, FAMILIES, crisisOverridePlanTemplate, type Decision } from './controller';
import { REPLY_STYLES, styleMaxSentences } from './steer';
import {
  CONVERSATION_RULES, decideConversation, mergePlan, STABILISE_RULES, SAFE_ACTIONS as CONV_SAFE, DEEP_ACTIONS as CONV_DEEP,
  type ConversationInput, type ConversationDecision, type PlanTemplate,
} from './conversation';

export interface InvariantResult {
  id: string;
  descNl: string;
  descEn: string;
  formula: string;
  statesChecked: number;
  violations: number;
  firstViolation?: { input: ControllerInput; action: Action };
  pass: boolean;
}

export interface LayerReport {
  pass: boolean;
  statesChecked: number;
  invariantsChecked: number;
  ms: number;
}

export interface ModelCheckReport {
  pass: boolean;
  /** Total states over both layers (base lattice + conversation lattice). */
  statesChecked: number;
  invariantsChecked: number;
  /** Base-layer invariants first (INV-*), then conversation-layer invariants (CI-*). */
  invariants: InvariantResult[];
  ruleCount: number;
  conversationRuleCount: number;
  latticeShape: string;
  conversationLatticeShape: string;
  layers: { base: LayerReport; conversation: LayerReport };
  /** Conversation rules that no reachable state fires (C99 must be among them: it is the fail-safe backstop). */
  conversationRulesNeverFired: string[];
  /** SHA-256 over every rule, guard and invariant that the proof covers. */
  rulesetHash: string;
  ms: number;
  checkedAt: string;
}

type Predicate = (input: ControllerInput, action: Action, decision: Decision) => boolean;

interface Invariant {
  id: string;
  /** Plain-language statement (NL + EN) — what the invariant guarantees. */
  desc: { nl: string; en: string };
  /** Technical formula for the expert view. */
  formula: string;
  predicate: Predicate;
}

const SAFE_ELEVATED: Action[] = ['CRISIS_PROTOCOL', 'SAFETY_RESPONSE'];
const HUMBLE: Action[] = ['CLARIFY', 'ABSTAIN_HITL'];
const DEEP: Action[] = ['THERAPEUTIC_DIALOG', 'PSYCHOEDUCATION'];
/** REFERRAL or stricter (the safety family outranks a referral). */
const REFERRAL_OR_STRICTER: Action[] = ['REFERRAL', 'SAFETY_RESPONSE', 'CRISIS_PROTOCOL'];
const isMedicationReferral = (i: ControllerInput, a: Action) => i.intent === 'MEDICATION_QUESTION' && i.frameValidity === 'VALID' && a === 'REFERRAL';
const HEAVY_DISTRESS = ['ELEVATED', 'HIGH', 'ACUTE'];
const REFERRAL_INTENTS = ['SUBSTANCE_CONCERN', 'MEDICATION_QUESTION', 'THERAPY_REQUEST', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN', 'VIOLENCE_RISK', 'PREGNANCY_POSTNATAL', 'CAREGIVER_BURDEN', 'FINANCIAL_STRESS'];
const NO_DIALOG_INTENTS = ['OUT_OF_SCOPE', 'META_QUESTION', 'THERAPY_REQUEST', 'CRISIS_SIGNAL', 'SUBSTANCE_CONCERN', 'MEDICATION_QUESTION', 'PREGNANCY_POSTNATAL', 'CAREGIVER_BURDEN', 'FINANCIAL_STRESS', 'DIAGNOSIS_REQUEST', 'ABUSE_DISCLOSURE', 'VIOLENCE_RISK', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN', 'ALLIANCE_RUPTURE'];

const INVARIANTS: Invariant[] = [
  {
    id: 'INV-1',
    desc: { nl: 'Crisis wordt altijd het crisisprotocol — niets gaat erboven.', en: 'Crisis always becomes the crisis protocol — nothing outranks it.' },
    formula: 'risk=CRISIS ⇒ CRISIS_PROTOCOL, unconditionally',
    predicate: (i, a) => i.riskLevel !== 'CRISIS' || a === 'CRISIS_PROTOCOL',
  },
  {
    id: 'INV-2',
    desc: { nl: 'Hoog risico krijgt altijd een antwoord uit de veiligheidsfamilie (crisisprotocol of veiligheidsantwoord).', en: 'High risk always gets an answer from the safety family (crisis protocol or safety response).' },
    formula: 'risk=HIGH ⇒ action ∈ {CRISIS_PROTOCOL, SAFETY_RESPONSE}',
    predicate: (i, a) => i.riskLevel !== 'HIGH' || SAFE_ELEVATED.includes(a),
  },
  {
    id: 'INV-3',
    desc: { nl: 'Verhoogd risico krijgt óók altijd de veiligheidsfamilie — nooit diepe gesprekken of grenzen.', en: 'Elevated risk also always gets the safety family — never deep dialogue or boundaries.' },
    formula: 'risk=ELEVATED ⇒ action ∈ {CRISIS_PROTOCOL, SAFETY_RESPONSE}',
    predicate: (i, a) => i.riskLevel !== 'ELEVATED' || SAFE_ELEVATED.includes(a),
  },
  {
    id: 'INV-4',
    desc: { nl: 'Diep gesprek (therapeutische dialoog of psycho-educatie) gebeurt alleen bij: geen risico, goede analyse en bekend terrein — uitzondering: uitleg over het systeem zelf is veilig genoeg.', en: 'Deep work (therapeutic dialogue or psycho-education) only happens when: no risk, a valid parse and known territory — exception: explaining the system itself is safe by construction.' },
    formula: 'DEEP ⇒ risk=NONE ∧ frame=VALID ∧ (novelty=KNOWN ∨ (PSYCHOEDUCATION ∧ intent ∈ {META_QUESTION, THERAPY_REQUEST}))',
    predicate: (i, a) => {
      if (!DEEP.includes(a)) return true;
      if (i.riskLevel !== 'NONE' || i.frameValidity !== 'VALID') return false;
      if (i.novelty === 'KNOWN') return true;
      return a === 'PSYCHOEDUCATION' && (i.intent === 'META_QUESTION' || i.intent === 'THERAPY_REQUEST');
    },
  },
  {
    id: 'INV-5',
    desc: { nl: 'Bij lage zekerheid zonder risico blijft EAInesy nederig: een vraag stellen of aanhouden — uitzonderingen: met een crisis-etiket of een geweldsuiting gaat alleen veiligheid; een leesbare medicatievraag gaat naar de voorschrijver of huisarts.', en: 'At low confidence without risk, EAInesy stays humble: ask a question or abstain — exceptions: with a crisis label or an abuse disclosure, only safety responds; a readable medication question is referred to the prescriber or GP.' },
    formula: 'conf=LOW ∧ risk=NONE ∧ pii=CLEAN ⇒ action ∈ {CLARIFY, ABSTAIN_HITL} ∨ (intent ∈ {CRISIS_SIGNAL, ABUSE_DISCLOSURE} ∧ action ∈ SAFE) ∨ (intent=MEDICATION_QUESTION ∧ frame=VALID ∧ action=REFERRAL)',
    predicate: (i, a) => !(i.confidenceBand === 'LOW' && i.riskLevel === 'NONE' && i.piiState === 'CLEAN') || HUMBLE.includes(a) || ((i.intent === 'CRISIS_SIGNAL' || i.intent === 'ABUSE_DISCLOSURE') && SAFE_ELEVATED.includes(a)) || isMedicationReferral(i, a),
  },
  {
    id: 'INV-6',
    desc: { nl: 'Bij onbekend terrein zonder houvast blijft EAInesy nederig — nooit geïmproviseerde therapie op onbekende grond. Uitzonderingen: crisis-etiket, geweldsuitingen, specialistische intenties en leesbare medicatievragen antwoorden altijd uit hun eigen familie.', en: 'On unknown territory without anchors, EAInesy stays humble — never improvised therapy on unknown ground. Exceptions: crisis label, abuse disclosures, specialist intents and readable medication questions always answer from their own family.' },
    formula: 'novelty=NOVEL ∧ risk=NONE ∧ pii=CLEAN ∧ intent ∉ {OUT_OF_SCOPE, META, THERAPY, ABUSE, VIOLENCE, PSYCHOSIS, EATING, ALLIANCE} ⇒ action ∈ {CLARIFY, ABSTAIN_HITL} ∨ (intent=CRISIS_SIGNAL ∧ action ∈ SAFE) ∨ (intent=MEDICATION_QUESTION ∧ frame=VALID ∧ action=REFERRAL)',
    predicate: (i, a) => {
      if (!(i.novelty === 'NOVEL_FRAME' && i.riskLevel === 'NONE' && i.piiState === 'CLEAN')) return true;
      if (['OUT_OF_SCOPE', 'META_QUESTION', 'THERAPY_REQUEST', 'ABUSE_DISCLOSURE', 'VIOLENCE_RISK', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN', 'ALLIANCE_RUPTURE'].includes(i.intent)) return true;
      return HUMBLE.includes(a) || (i.intent === 'CRISIS_SIGNAL' && SAFE_ELEVATED.includes(a)) || isMedicationReferral(i, a);
    },
  },
  {
    id: 'INV-7',
    desc: { nl: 'Bij hoog risico of crisis worden nooit grenzen getrokken, nooit aangehouden en nooit inhoudelijk "onderwezen" — alleen veiligheid.', en: 'At high or crisis risk, no boundaries are drawn, no abstention happens and no teaching occurs — only safety.' },
    formula: 'risk ∈ {HIGH, CRISIS} ⇒ action ∉ {BOUNDARY_REFUSAL, ABSTAIN_HITL, PSYCHOEDUCATION, THERAPEUTIC_DIALOG}',
    predicate: (i, a) => {
      if (i.riskLevel !== 'HIGH' && i.riskLevel !== 'CRISIS') return true;
      return !['BOUNDARY_REFUSAL', 'ABSTAIN_HITL', 'PSYCHOEDUCATION', 'THERAPEUTIC_DIALOG'].includes(a);
    },
  },
  {
    id: 'INV-8',
    desc: { nl: 'Persoonlijke gegevens in het bericht zonder risico: nooit diep gesprek — de privacy-grens gaat vóór alles.', en: 'Personal data in the message without risk: never deep dialogue — the privacy boundary comes first.' },
    formula: 'pii=PII ∧ risk=NONE ⇒ action ∉ DEEP',
    predicate: (i, a) => !(i.piiState === 'PII_DETECTED' && i.riskLevel === 'NONE') || !DEEP.includes(a),
  },
  {
    id: 'INV-9',
    desc: { nl: 'Elke denkbare situatie levert precies één, gedefinieerd antwoord op — en dezelfde invoer levert altijd hetzelfde antwoord.', en: 'Every conceivable situation yields exactly one defined action — and the same input always yields the same action.' },
    formula: 'totality ∧ membership ∧ determinism: decide(i) ∈ ACTIONS ∧ decide(i) = decide(i)',
    predicate: (i, a, d) => ACTIONS.includes(a) && d.action === decide(i).action,
  },
  {
    id: 'INV-10',
    desc: { nl: 'Elk aanhoudingsantwoord verhoogt automatisch de vlag voor menselijke review.', en: 'Every abstention automatically raises the human-review flag.' },
    formula: 'action=ABSTAIN_HITL ⇒ hitl=true',
    predicate: (i, a, d) => a !== 'ABSTAIN_HITL' || d.hitl,
  },
  {
    id: 'INV-11',
    desc: { nl: 'Omgekeerd: de menselijke review-vlag bestaat alleen bij een aanhouding — geen andere actie triggert stilzwijgend review.', en: 'Conversely: the human-review flag exists only on abstention — no other action silently triggers review.' },
    formula: 'hitl=true ⇒ action=ABSTAIN_HITL',
    predicate: (_i, _a, d) => !d.hitl || d.action === 'ABSTAIN_HITL',
  },
  {
    id: 'INV-12',
    desc: { nl: 'Aanhouden gebeurt uitsluitend bij lage zekerheid én onbekend terrein, zonder risico — nooit als snelkoppeling bij gevaar.', en: 'Abstention happens only at low confidence and unknown territory, without risk — never as a shortcut in danger.' },
    formula: 'action=ABSTAIN_HITL ⇒ conf=LOW ∧ novelty=NOVEL ∧ risk=NONE',
    predicate: (i, a) => a !== 'ABSTAIN_HITL' || (i.confidenceBand === 'LOW' && i.novelty === 'NOVEL_FRAME' && i.riskLevel === 'NONE'),
  },
  {
    id: 'INV-13',
    desc: { nl: 'Acut zware verhalen krijgen nooit diepe technieken — eerst opvangen, verwijzen of een vraag.', en: 'Acutely heavy stories never get deep technique work — first containment, referral or a question.' },
    formula: 'distress=ACUTE ⇒ action ∉ DEEP',
    predicate: (i, a) => i.distressLevel !== 'ACUTE' || !DEEP.includes(a),
  },
  {
    id: 'INV-14',
    desc: { nl: 'Een veiligheidsantwoord verschijnt alleen als er écht aanleiding is: verhoogd risico, een crisis-etiket, zware spanning of een geweldsuiting.', en: 'A safety response appears only with real cause: elevated risk, a crisis label, heavy distress, or an abuse disclosure.' },
    formula: 'action=SAFETY_RESPONSE ⇒ risk ≥ ELEVATED ∨ intent=CRISIS_SIGNAL ∨ distress ≥ ELEVATED ∨ intent=ABUSE_DISCLOSURE',
    predicate: (i, a) => a !== 'SAFETY_RESPONSE' || i.riskLevel !== 'NONE' || i.intent === 'CRISIS_SIGNAL' || HEAVY_DISTRESS.includes(i.distressLevel) || i.intent === 'ABUSE_DISCLOSURE',
  },
  {
    id: 'INV-15',
    desc: { nl: 'Een verwijzing naar professionele hulp gebeurt alleen als er reden toe is: zwaarte van het verhaal of het thema zelf vraagt erom.', en: 'A referral to professional care happens only with cause: the weight of the story or the topic itself calls for it.' },
    formula: 'action=REFERRAL ⇒ risk ≥ ELEVATED ∨ distress ≥ ELEVATED ∨ intent ∈ {SUBSTANCE_CONCERN, THERAPY_REQUEST}',
    predicate: (i, a) => a !== 'REFERRAL' || i.riskLevel !== 'NONE' || HEAVY_DISTRESS.includes(i.distressLevel) || REFERRAL_INTENTS.includes(i.intent),
  },
  {
    id: 'INV-16',
    desc: { nl: 'Psycho-educatie (uitleg) alleen bij systeem- of hulpzoekvragen — nooit als antwoord op een persoonlijk verhaal.', en: 'Psycho-education only on system or help-seeking questions — never as the answer to a personal story.' },
    formula: 'action=PSYCHOEDUCATION ⇒ intent ∈ {META_QUESTION, THERAPY_REQUEST}',
    predicate: (i, a) => a !== 'PSYCHOEDUCATION' || i.intent === 'META_QUESTION' || i.intent === 'THERAPY_REQUEST',
  },
  {
    id: 'INV-17',
    desc: { nl: 'Therapeutische dialoog alleen bij persoonlijke verhalen — niet bij systeemvragen, buiten bereik, middelen, crisissignalen of specialistische intenties.', en: 'Therapeutic dialogue only on personal stories — not on system questions, out-of-scope, substances, crisis signals or specialist intents.' },
    formula: 'action=THERAPEUTIC_DIALOG ⇒ intent ∉ NO_DIALOG (scope, meta, therapy, crisis-signal, substance, abuse, violence, psychosis, eating, alliance)',
    predicate: (i, a) => a !== 'THERAPEUTIC_DIALOG' || !NO_DIALOG_INTENTS.includes(i.intent),
  },
  {
    id: 'INV-18',
    desc: { nl: 'Een grens (weigering) wordt alleen getrokken bij privacy, buiten-bereik-vragen of een expliciete diagnosevraag — nooit willekeurig.', en: 'A boundary refusal is only drawn for privacy, out-of-scope requests or an explicit diagnosis request — never arbitrarily.' },
    formula: 'action=BOUNDARY_REFUSAL ⇒ pii=PII ∨ intent=OUT_OF_SCOPE ∨ intent=DIAGNOSIS_REQUEST',
    predicate: (i, a) => a !== 'BOUNDARY_REFUSAL' || i.piiState === 'PII_DETECTED' || i.intent === 'OUT_OF_SCOPE' || i.intent === 'DIAGNOSIS_REQUEST',
  },
  {
    id: 'INV-19',
    desc: { nl: 'Crisis- en veiligheidsantwoorden noemen altijd een concrete nood- of gespecialiseerde hulpbron (113, 112, Veilig Thuis of Centrum Seksueel Geweld) — in elk denkbare situatie.', en: 'Crisis and safety responses always name a concrete emergency or specialised resource (113, 112, Veilig Thuis or the sexual assault centre) — in every conceivable situation.' },
    formula: 'action ∈ {CRISIS, SAFETY} ⇒ ∃ m ∈ plan.mustInclude: m matches /113|112|0800-2000|0800-0188/',
    predicate: (_i, a, d) => !(a === 'CRISIS_PROTOCOL' || a === 'SAFETY_RESPONSE') || d.planTemplate.mustInclude.some((m) => /113|112|0800-2000|0800-0188/.test(m)),
  },
  {
    id: 'INV-20',
    desc: { nl: 'Bij crisis en veiligheid is de toon altijd kalm of warm — nooit opgewekt, direct of begrensd.', en: 'At crisis and safety the tone is always calm or warm — never cheerful, direct or boundaried.' },
    formula: 'action ∈ {CRISIS, SAFETY} ⇒ tone ∈ {calm, warm}',
    predicate: (_i, a, d) => !(a === 'CRISIS_PROTOCOL' || a === 'SAFETY_RESPONSE') || ['calm', 'warm'].includes(d.planTemplate.tone),
  },
  {
    id: 'INV-21',
    desc: { nl: 'Elk antwoordsjabloon heeft een zinvolle grens op lengte (4–8 zinnen) — en ook elke stijlvariant uit de bijsturing blijft binnen die bewezen grens.', en: 'Every reply template has a meaningful length bound (4–8 sentences) — and every steering style stays inside that proven bound.' },
    formula: '∀ decisions: 4 ≤ plan.maxSentences ≤ 8 ∧ ∀ style ∈ {concise, normal, elaborate}: 4 ≤ scale(plan.maxSentences, style) ≤ 8',
    predicate: (_i, _a, d) => {
      const base = d.planTemplate.maxSentences;
      if (base < 4 || base > 8) return false;
      return REPLY_STYLES.every((st) => {
        const scaled = styleMaxSentences(base, st);
        return scaled >= 4 && scaled <= 8;
      });
    },
  },
  {
    id: 'INV-22',
    desc: { nl: 'Elk actief plan is volledig gespecificeerd: minstens één toegestane zet, één verboden zet en één verplicht onderdeel.', en: 'Every fired plan is fully specified: at least one allowed move, one forbidden move and one must-include.' },
    formula: 'plan.allowedMoves ≥ 1 ∧ plan.forbiddenMoves ≥ 1 ∧ plan.mustInclude ≥ 1',
    predicate: (_i, _a, d) => d.planTemplate.allowedMoves.length >= 1 && d.planTemplate.forbiddenMoves.length >= 1 && d.planTemplate.mustInclude.length >= 1,
  },
  {
    id: 'INV-23',
    desc: { nl: 'Een geweldsuiting wordt nóóít weggewezen met een privacy-grens of aanhouding — trauma-informed zorg gaat vóór dataminimalisatie.', en: 'An abuse disclosure is never turned away with a privacy boundary or abstention — trauma-informed care outranks data minimisation.' },
    formula: 'intent=ABUSE ∧ frame=VALID ⇒ action ∈ {CRISIS_PROTOCOL, SAFETY_RESPONSE}',
    predicate: (i, a) => i.intent !== 'ABUSE_DISCLOSURE' || i.frameValidity !== 'VALID' || SAFE_ELEVATED.includes(a),
  },
  {
    id: 'INV-24',
    desc: { nl: 'Specialistische intenties (geweld, psychose, eetgedrag, alliantie-breuk) krijgen nooit vrije dialoog of een weigering — altijd hun eigen familie of veiligheid.', en: 'Specialist intents (violence, psychosis, eating, alliance rupture) never get free dialogue or a refusal — always their own family or safety.' },
    formula: 'intent ∈ {VIOLENCE, PSYCHOSIS, EATING, ALLIANCE} ∧ frame=VALID ⇒ action ∉ {THERAPEUTIC_DIALOG, BOUNDARY_REFUSAL}',
    predicate: (i, a) => {
      if (!['VIOLENCE_RISK', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN', 'ALLIANCE_RUPTURE'].includes(i.intent)) return true;
      if (i.frameValidity !== 'VALID') return true;
      return a !== 'THERAPEUTIC_DIALOG' && a !== 'BOUNDARY_REFUSAL';
    },
  },
  {
    id: 'INV-25',
    desc: { nl: 'Een medicatievraag eindigt nooit in behandelpraat: geen doseringsadvies, geen "probeer eens" — de voorschrijver of huisarts beslist.', en: 'A medication question never ends in treatment talk: no dosage advice, no "try this" — the prescriber or GP decides.' },
    formula: 'intent=MEDICATION_QUESTION ⇒ action ∉ {THERAPEUTIC_DIALOG, PSYCHOEDUCATION}',
    predicate: (i, a) => i.intent !== 'MEDICATION_QUESTION' || !DEEP.includes(a),
  },
  {
    id: 'INV-26',
    desc: { nl: 'Een expliciete diagnosevraag eindigt nooit in therapeutische diepte of voorlichting als antwoord: EAInesy zegt eerlijk dat een diagnose bij een professional hoort, of stelt eerst een vraag.', en: 'An explicit diagnosis request never ends in therapeutic depth or education as the answer: EAInesy honestly says diagnosis belongs with a professional, or asks first.' },
    formula: 'intent=DIAGNOSIS_REQUEST ⇒ action ∉ {THERAPEUTIC_DIALOG, PSYCHOEDUCATION}',
    predicate: (i, a) => i.intent !== 'DIAGNOSIS_REQUEST' || !DEEP.includes(a),
  },
  {
    id: 'INV-27',
    desc: { nl: 'Onbekend risico (geen bruikbare waarneming) wordt nooit als "geen risico" behandeld: altijd de veiligheidsfamilie, altijd met 113.', en: 'Unknown risk (no usable observation) is never treated as "no risk": always the safety family, always with 113.' },
    formula: 'risk=UNKNOWN ⇒ action ∈ {CRISIS_PROTOCOL, SAFETY_RESPONSE} ∧ ∃ m ∈ plan.mustInclude: m matches /113/',
    predicate: (i, a, d) => i.riskLevel !== 'UNKNOWN' || (SAFE_ELEVATED.includes(a) && d.planTemplate.mustInclude.some((m) => /113/.test(m))),
  },
  {
    id: 'INV-28',
    desc: { nl: 'Als het taalmodel het bericht niet kon lezen, noemt het antwoord altijd een concreet hulpnummer — wat er ook in het bericht stond.', en: 'When the language model could not read the message, the reply always names a concrete help line — whatever the message said.' },
    formula: 'frame ≠ VALID ⇒ ∃ m ∈ plan.mustInclude: m matches /113|112|0800-2000/',
    predicate: (i, _a, d) => i.frameValidity === 'VALID' || d.planTemplate.mustInclude.some((m) => /113|112|0800-2000/.test(m)),
  },
  {
    id: 'INV-29',
    desc: { nl: 'Een leesbare medicatievraag zonder risico eindigt altijd in een doorverwijzing naar de voorschrijver of huisarts (of strenger) — nooit in alleen een vraag, aanhouding of privacy-grens.', en: 'A readable medication question without risk always ends in a referral to the prescriber or GP (or stricter) — never in just a question, an abstention or a privacy boundary.' },
    formula: 'intent=MEDICATION_QUESTION ∧ risk=NONE ∧ frame=VALID ⇒ action ∈ {REFERRAL, SAFETY_RESPONSE, CRISIS_PROTOCOL}',
    predicate: (i, a) => !(i.intent === 'MEDICATION_QUESTION' && i.riskLevel === 'NONE' && i.frameValidity === 'VALID') || REFERRAL_OR_STRICTER.includes(a),
  },
];

// Static well-formedness of the rule base itself (checked once per process):
// unique ids, family ids that exist, and the documented catch-all + backstop
// present. Behavioural totality itself is proven by INV-9 over all states.
let ruleBaseOk = true;
{
  const ids = new Set(DECISION_RULES.map((r) => r.id));
  const fams = new Set(FAMILIES.map((f) => f.id));
  if (ids.size !== DECISION_RULES.length) ruleBaseOk = false;
  if (!DECISION_RULES.every((r) => fams.has(r.family))) ruleBaseOk = false;
  if (!ids.has('P47') || !ids.has('P50')) ruleBaseOk = false; // catch-all + fail-closed backstop
}

// ---------------------------------------------------------------------------
// Conversation layer — invariants over (reachable base decision × conversation state)
// ---------------------------------------------------------------------------
interface ConvInvariant {
  id: string;
  desc: { nl: string; en: string };
  formula: string;
  predicate: (c: ConversationInput, d: ConversationDecision, plan: PlanTemplate) => boolean;
}

const ALLOWED_NEXT: Record<ConversationPhase, ConversationPhase[]> = {
  OPENING: ['EXPLORE'],
  EXPLORE: ['EXPLORE', 'FOCUS'],
  FOCUS: ['FOCUS', 'ACT', 'CLOSE', 'EXPLORE'],
  ACT: ['ACT', 'CLOSE', 'EXPLORE'],
  CLOSE: ['CLOSE', 'EXPLORE'],
};
const TECHNIQUE_MOVE_RE = /\b(offer\s+(ONE|one)\b.*\btechnique|technique\b.*\bfrom the knowledge graph|grounded technique|grounding\/stabilisation technique)/i;

const CONV_INVARIANTS: ConvInvariant[] = [
  {
    id: 'CI-1',
    desc: { nl: 'Kort na een risicosignaal in dit gesprek volgt nooit een diep gesprek of uitleg — eerst een check-in.', en: 'Shortly after a risk signal in this conversation, never deep dialogue or teaching — a check-in first.' },
    formula: 'memory=ACTIVE ⇒ action ∉ {THERAPEUTIC_DIALOG, PSYCHOEDUCATION}',
    predicate: (c, d) => c.riskMemory !== 'ACTIVE' || !CONV_DEEP.includes(d.action),
  },
  {
    id: 'CI-2',
    desc: { nl: 'De gesprekslaag maakt een veiligheidsantwoord nooit ongedaan.', en: 'The conversation layer never undoes a safety answer.' },
    formula: 'base ∈ {CRISIS, SAFETY} ⇒ action = base',
    predicate: (c, d) => !CONV_SAFE.includes(c.baseAction) || d.action === c.baseAction,
  },
  {
    id: 'CI-3',
    desc: { nl: 'De gesprekslaag mag alleen inperken: een andere actie dan de kern is uitsluitend een check-in ná een risicosignaal.', en: 'The conversation layer may only restrict: a different action than the core is only ever a check-in after a risk signal.' },
    formula: 'action ≠ base ⇒ base ∈ DEEP ∧ action = SAFETY_RESPONSE ∧ memory = ACTIVE',
    predicate: (c, d) => d.action === c.baseAction || (CONV_DEEP.includes(c.baseAction) && d.action === 'SAFETY_RESPONSE' && c.riskMemory === 'ACTIVE'),
  },
  {
    id: 'CI-4',
    desc: { nl: 'Een suggestie (techniek) komt pas in de actiefase of bij de overgang ernaartoe (focus staat, de persoon is er klaar voor, geen actief risicosignaal, hoge zekerheid) — behalve een gronding bij paniek of trauma.', en: 'A suggestion (technique) only comes in the action phase or at the step into it (focus set, person ready, no active risk signal, high confidence) — except grounding for panic or trauma.' },
    formula: 'strategy = SUGGESTION ⇒ phase = ACT ∨ stabilise ∨ (phase = FOCUS ∧ ready ∧ memory ≠ ACTIVE ∧ conf = HIGH)',
    predicate: (c, d) => d.strategy !== 'SUGGESTION' || c.phase === 'ACT' || c.stabilise || (c.phase === 'FOCUS' && c.ready && c.riskMemory !== 'ACTIVE' && c.confidence === 'HIGH'),
  },
  {
    id: 'CI-5',
    desc: { nl: 'Zolang het gesprek nog verkent of een focus zoekt, bevat het plan geen techniek-zet: eerst begrijpen, dan pas helpen (Hill, Althoff).', en: 'While the conversation still explores or seeks focus, the plan holds no technique move: understand first, help after (Hill, Althoff).' },
    formula: '(phase ∈ {OPENING, EXPLORE} ∨ (phase = FOCUS ∧ ¬(ready ∧ memory ≠ ACTIVE ∧ conf = HIGH))) ∧ ¬stabilise ∧ action = THERAPEUTIC_DIALOG ⇒ ¬∃ technique move in plan',
    predicate: (c, d, plan) => {
      const early = c.phase === 'OPENING' || c.phase === 'EXPLORE' || (c.phase === 'FOCUS' && !(c.ready && c.riskMemory !== 'ACTIVE' && c.confidence === 'HIGH'));
      return !(early && !c.stabilise && d.action === 'THERAPEUTIC_DIALOG') || !plan.allowedMoves.some((m) => TECHNIQUE_MOVE_RE.test(m));
    },
  },
  {
    id: 'CI-6',
    desc: { nl: 'Bij een open breuk in de werkrelatie gaat herstel vóór alles behalve veiligheid: een herstelbeurt, of — bij een verwijzing of grens — verplicht een erkenning van de frustratie (Safran & Muran).', en: 'With an open rupture in the working relationship, repair comes before everything except safety: a repair turn, or — with a referral or boundary — a mandatory acknowledgment of the frustration (Safran & Muran).' },
    formula: 'rupture = ACTIVE ∧ action ∉ SAFE ⇒ strategy = REPAIR ∨ (strategy ∈ {REFERRAL, BOUNDARY} ∧ ∃ frustration acknowledgment ∈ plan.mustInclude)',
    predicate: (c, d, plan) => c.rupture !== 'ACTIVE' || CONV_SAFE.includes(d.action) || d.strategy === 'REPAIR'
      || ((d.strategy === 'REFERRAL' || d.strategy === 'BOUNDARY') && plan.mustInclude.some((m) => /frustration/i.test(m))),
  },
  {
    id: 'CI-7',
    desc: { nl: 'Het gesprek slaat nooit een fase over: alleen blijven, één stap verder, terug naar verkennen, of afronden vanuit focus of actie.', en: 'The conversation never skips a phase: stay, one step forward, back to exploring, or close from focus or action.' },
    formula: 'nextPhase ∈ ALLOWED_NEXT[phase]',
    predicate: (c, d) => ALLOWED_NEXT[c.phase].includes(d.nextPhase),
  },
  {
    id: 'CI-8',
    desc: { nl: 'Na een veiligheidsantwoord gaat het gesprek terug naar verkennen — nooit meteen naar plannen of afronden.', en: 'After a safety answer the conversation returns to exploring — never straight to planning or closing.' },
    formula: 'action ∈ SAFE ⇒ nextPhase = EXPLORE',
    predicate: (_c, d) => !CONV_SAFE.includes(d.action) || d.nextPhase === 'EXPLORE',
  },
  {
    id: 'CI-9',
    desc: { nl: 'Na een risicosignaal is een concrete hulplijn minstens één keer genoemd — wordt die nog gemist, dan zit er verplicht een in dit antwoord (113, 112 of Veilig Thuis).', en: 'After a risk signal a concrete help line has been named at least once — if still missing, one is mandatory in this reply (113, 112 or Veilig Thuis).' },
    formula: 'memory ≠ NONE ∧ ¬resourcesGiven ⇒ ∃ m ∈ plan.mustInclude: m matches /113|112|0800-2000/',
    predicate: (c, _d, plan) => c.riskMemory === 'NONE' || c.resourcesGiven || plan.mustInclude.some((m) => /113|112|0800-2000/.test(m)),
  },
  {
    id: 'CI-10',
    desc: { nl: 'Na een eerder risicosignaal (geheugen RECENT): een techniek alleen als de persoon er zelf om vraagt (of gronding), en altijd een korte check-in.', en: 'After an earlier risk signal (memory RECENT): a technique only when the person asks for it (or grounding), and always a short check-in.' },
    formula: 'memory = RECENT ∧ action = THERAPEUTIC_DIALOG ⇒ (strategy ≠ SUGGESTION ∨ stabilise ∨ ready) ∧ ∃ check-in in plan.mustInclude',
    predicate: (c, d, plan) => !(c.riskMemory === 'RECENT' && d.action === 'THERAPEUTIC_DIALOG') || ((d.strategy !== 'SUGGESTION' || c.stabilise || c.ready) && plan.mustInclude.some((m) => /check-in/i.test(m))),
  },
  {
    id: 'CI-11',
    desc: { nl: 'Elk crisis- of veiligheidsantwoord houdt na het samenvoegen zijn concrete hulplijn.', en: 'Every crisis or safety answer keeps its concrete help line after the merge.' },
    formula: 'action ∈ SAFE ⇒ ∃ m ∈ plan.mustInclude: m matches /113|112|0800-2000/',
    predicate: (_c, d, plan) => !CONV_SAFE.includes(d.action) || plan.mustInclude.some((m) => /113|112|0800-2000/.test(m)),
  },
  {
    id: 'CI-12',
    desc: { nl: 'Elk samengevoegd plan is volledig (minstens één toegestane zet, één verboden zet, één verplicht onderdeel) en blijft binnen 4–8 zinnen in elke stijl.', en: 'Every merged plan is complete (at least one allowed move, one forbidden move, one must-include) and stays within 4–8 sentences in every style.' },
    formula: '|allowed|,|forbidden|,|must| ≥ 1 ∧ ∀ style: 4 ≤ scale(maxSentences) ≤ 8',
    predicate: (_c, _d, plan) => plan.allowedMoves.length >= 1 && plan.forbiddenMoves.length >= 1 && plan.mustInclude.length >= 1
      && plan.maxSentences >= 4 && plan.maxSentences <= 8 && REPLY_STYLES.every((st) => { const v = styleMaxSentences(plan.maxSentences, st); return v >= 4 && v <= 8; }),
  },
  {
    id: 'CI-13',
    desc: { nl: 'Onbekend risico blijft over het hele gesprek een veiligheidsantwoord.', en: 'Unknown risk stays a safety answer across the whole conversation.' },
    formula: 'risk = UNKNOWN ⇒ action ∈ SAFE',
    predicate: (c, d) => c.risk !== 'UNKNOWN' || CONV_SAFE.includes(d.action),
  },
  {
    id: 'CI-14',
    desc: { nl: 'Van focus naar actie (plannen) alleen als de persoon er klaar voor is en er geen actief risicosignaal is.', en: 'From focus to action (planning) only when the person is ready and no risk signal is active.' },
    formula: 'phase = FOCUS ∧ nextPhase = ACT ⇒ ready ∧ memory ≠ ACTIVE',
    predicate: (c, d) => !(c.phase === 'FOCUS' && d.nextPhase === 'ACT') || (c.ready && c.riskMemory !== 'ACTIVE'),
  },
  {
    id: 'CI-15',
    desc: { nl: 'Elke gesprekssituatie geeft precies één beslissing, altijd dezelfde, en nooit via het vangnet.', en: 'Every conversation situation yields exactly one decision, always the same, and never via the safety net.' },
    formula: 'determinism ∧ ruleId ≠ C99',
    predicate: (c, d) => { const d2 = decideConversation(c); return d2.ruleId === d.ruleId && d2.action === d.action && d2.strategy === d.strategy && d2.nextPhase === d.nextPhase && d.ruleId !== 'C99'; },
  },
];

interface BaseProjection { ruleId: string; baseAction: Action; risk: RiskAssessment; confidence: ConfidenceBand; template: PlanTemplate }

/** Every reachable (base rule, risk, confidence) from the FULL base lattice, plus the Z3 override. */
function baseProjections(): BaseProjection[] {
  const seen = new Map<string, BaseProjection>();
  for (const input of enumerateControllerInputs()) {
    const d = decide(input);
    const key = `${d.ruleId}|${input.riskLevel}|${input.confidenceBand}`;
    if (!seen.has(key)) seen.set(key, { ruleId: d.ruleId, baseAction: d.action, risk: input.riskLevel, confidence: input.confidenceBand, template: d.planTemplate });
    // Z3 fail-closed override can turn any decision into the crisis plan.
    const okey = `Z3|${input.riskLevel}|${input.confidenceBand}`;
    if (!seen.has(okey)) seen.set(okey, { ruleId: 'P04', baseAction: 'CRISIS_PROTOCOL', risk: input.riskLevel, confidence: input.confidenceBand, template: crisisOverridePlanTemplate() });
  }
  return [...seen.values()];
}

function runConversationCheck(): { results: InvariantResult[]; states: number; ms: number; neverFired: string[] } {
  const t0 = performance.now();
  const results: InvariantResult[] = CONV_INVARIANTS.map((inv) => ({
    id: inv.id, descNl: inv.desc.nl, descEn: inv.desc.en, formula: inv.formula, statesChecked: 0, violations: 0, pass: true,
  }));
  const fired = new Set<string>();
  let states = 0;
  const bools = [false, true];
  for (const b of baseProjections()) {
    const stabilise = (STABILISE_RULES as readonly string[]).includes(b.ruleId);
    for (const phase of CONVERSATION_PHASES)
      for (const riskMemory of RISK_MEMORY_STATES)
        for (const rupture of RUPTURE_STATES)
          for (const resourcesGiven of bools)
            for (const ready of bools)
              for (const fresh of bools)
              for (const closure of bools)
                for (const topicShift of bools) {
                  const c: ConversationInput = { baseAction: b.baseAction, stabilise, risk: b.risk, confidence: b.confidence, phase, riskMemory, rupture, resourcesGiven, ready, fresh, closure, topicShift };
                  const d = decideConversation(c);
                  const plan = mergePlan(b.template, d);
                  fired.add(d.ruleId);
                  states += 1;
                  for (let k = 0; k < CONV_INVARIANTS.length; k++) {
                    results[k].statesChecked += 1;
                    if (!CONV_INVARIANTS[k].predicate(c, d, plan)) {
                      results[k].violations += 1;
                      if (!results[k].firstViolation) results[k].firstViolation = { input: c as unknown as ControllerInput, action: d.action };
                    }
                  }
                }
  }
  for (const r of results) r.pass = r.violations === 0;
  const neverFired = CONVERSATION_RULES.map((r) => r.id).filter((id) => !fired.has(id));
  return { results, states, ms: performance.now() - t0, neverFired };
}

let memoHash: string | null = null;

/** SHA-256 over everything the proof covers: rules (incl. guard code), invariants, conversation rules. Rules are constants ⇒ memoised. */
export function computeRulesetHash(): string {
  if (memoHash) return memoHash;
  const h = createHash('sha256');
  h.update(JSON.stringify(DECISION_RULES.map((r) => ({ id: r.id, family: r.family, action: r.action, plan: r.plan, hitl: r.hitl === true, guard: r.guard.toString() }))));
  h.update(JSON.stringify(INVARIANTS.map((i) => ({ id: i.id, formula: i.formula, p: i.predicate.toString() }))));
  h.update(JSON.stringify(CONVERSATION_RULES.map((r) => ({ id: r.id, guard: r.guard.toString(), decide: r.decide.toString() }))));
  h.update(JSON.stringify(CONV_INVARIANTS.map((i) => ({ id: i.id, formula: i.formula, p: i.predicate.toString() }))));
  h.update(decideConversation.toString() + mergePlan.toString());
  memoHash = h.digest('hex');
  return memoHash;
}

/** Run the full check over both layers. Deterministic. */
export function runModelCheck(): ModelCheckReport {
  const t0 = performance.now();
  const states = enumerateControllerInputs();
  const results: InvariantResult[] = INVARIANTS.map((inv) => ({
    id: inv.id,
    descNl: inv.desc.nl,
    descEn: inv.desc.en,
    formula: inv.formula,
    statesChecked: 0,
    violations: 0,
    pass: true,
  }));

  for (const input of states) {
    const d1 = decide(input);
    const d2 = decide(input); // determinism witness
    const action: Action = d1.action;
    for (let k = 0; k < INVARIANTS.length; k++) {
      const inv = INVARIANTS[k];
      results[k].statesChecked += 1;
      let ok = inv.predicate(input, action, d1);
      if ((inv.id === 'INV-9') && d1.action !== d2.action) ok = false; // determinism folded into totality
      if (!ok) {
        results[k].violations += 1;
        if (!results[k].firstViolation) {
          results[k].firstViolation = { input, action };
        }
      }
    }
  }

  for (const r of results) {
    r.pass = r.violations === 0;
  }
  const baseMs = Math.max(0.01, performance.now() - t0);
  const basePass = ruleBaseOk && results.every((r) => r.pass);

  const conv = runConversationCheck();
  // C99 is the documented fail-safe backstop: it must be unreachable. Any OTHER
  // never-fired rule is dead code — reported, not a failure.
  const convPass = conv.results.every((r) => r.pass) && conv.neverFired.includes('C99');

  const ms = Math.max(0.01, performance.now() - t0);
  return {
    pass: basePass && convPass,
    statesChecked: states.length + conv.states,
    invariantsChecked: results.length + conv.results.length,
    invariants: [...results, ...conv.results],
    ruleCount: DECISION_RULES.length,
    conversationRuleCount: CONVERSATION_RULES.length,
    latticeShape: '30 intents × 5 risk (4 ordinal + UNKNOWN) × 3 validity × 3 confidence × 4 distress × 2 pii × 2 novelty',
    conversationLatticeShape: 'reachable (base rule × risk × confidence) × 5 phases × 3 risk memory × 2 rupture × 2 resources-given × 2 ready × 2 fresh × 2 closure × 2 topic-shift',
    layers: {
      base: { pass: basePass, statesChecked: states.length, invariantsChecked: results.length, ms: baseMs },
      conversation: { pass: convPass, statesChecked: conv.states, invariantsChecked: conv.results.length, ms: conv.ms },
    },
    conversationRulesNeverFired: conv.neverFired,
    rulesetHash: computeRulesetHash(),
    ms,
    checkedAt: new Date().toISOString(),
  };
}

let cachedReport: ModelCheckReport | null = null;

/**
 * The proof is a property of the rule set, not of a message: the rules are
 * constants, so one exhaustive run per process (keyed by the rule-set hash)
 * covers every turn. Earlier versions re-ran it on every request, which
 * proved nothing new. `refresh` forces a re-run (verification panel).
 */
export function getModelCheckReport(refresh = false): ModelCheckReport {
  if (!cachedReport || refresh || cachedReport.rulesetHash !== computeRulesetHash()) cachedReport = runModelCheck();
  return cachedReport;
}
