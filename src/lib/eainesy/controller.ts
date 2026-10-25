/**
 * The symbolic decision controller — a PURE, total function over a finite
 * input lattice.
 *
 * The per-message safety core: an ORDERED list of guard rules (first match
 * wins) over a closed enumeration of 21,600 input states, organised in 16
 * families grounded in the clinical decision literature. The conversation
 * layer (conversation.ts) sits on top and may only RESTRICT these outcomes:
 *
 *   F1  acute crisis & imminent risk   (C-SSRS ideation-to-action, Joiner, Roberts)
 *   F2  abuse & maltreatment           (SAMHSA trauma-informed care)
 *   F3  high risk                      (C-SSRS severity + fail-closed max-fusion)
 *   F4  elevated risk                  (precautionary principle)
 *   F5  crisis-intent signal           (defence-in-depth)
 *   F6  broken input                   (epistemic humility)
 *   F7  privacy                        (GDPR data minimisation, confidentiality)
 *   F8  epistemic humility             (conformal abstention)
 *   F9  acute distress                 (stepped care)
 *   F10 scope & competence             (professional ethics, APA)
 *   F11 specialist referrals           (early intervention, medical risk, containment)
 *   F12 alliance repair                (Bordin; Safran & Muran rupture-repair)
 *   F13 modality-matched dialogue      (BA, CBT, DBT, ACT, IPT, CFT, CBT-I, MI)
 *   F14 reinforcement & maintenance    (relapse prevention, Marlatt & Gordon)
 *   F15 meta & transparency            (informed consent)
 *   F16 fail-closed backstop
 *
 * `modelchecker.ts` exhaustively proves the safety invariants over the whole
 * lattice (once per process, keyed by the rule-set hash). No I/O, no randomness, no clock: same input ⇒
 * same decision, always.
 */
import { type Action, type ControllerInput, type Plan } from './types';

export interface FamilyMeta {
  id: string;
  name: { nl: string; en: string };
  /** Scientific anchor — the literature the family's behaviour is grounded in. */
  anchor: { nl: string; en: string };
}

export const FAMILIES: FamilyMeta[] = [
  { id: 'F1', name: { nl: 'Acute crisis & dreigend risico', en: 'Acute crisis & imminent risk' }, anchor: { nl: 'C-SSRS ideatie-naar-actie · Joiner interpersoonlijke theorie · Roberts crisismodel', en: 'C-SSRS ideation-to-action · Joiner\'s interpersonal theory · Roberts\' crisis model' } },
  { id: 'F2', name: { nl: 'Mishandeling & geweldsuitingen', en: 'Abuse & maltreatment disclosure' }, anchor: { nl: 'SAMHSA trauma-informed zorg: geloven, valideren, niet uitvragen, gespecialiseerde hulpbronnen', en: 'SAMHSA trauma-informed care: believe, validate, do not probe, specialised resources' } },
  { id: 'F3', name: { nl: 'Hoog risico', en: 'High risk' }, anchor: { nl: 'C-SSRS ernst + max-fusie: de veiligste van twee risico-inschattingen wint', en: 'C-SSRS severity + max-fusion: the safer of two risk assessments wins' } },
  { id: 'F4', name: { nl: 'Verhoogd risico', en: 'Elevated risk' }, anchor: { nl: 'Voorzorgsbeginsel: bij twijfel de veiligheidsfamilie', en: 'Precautionary principle: on doubt, the safety family' } },
  { id: 'F5', name: { nl: 'Crisis-intentiesignaal', en: 'Crisis-intent signal' }, anchor: { nl: 'Defense-in-depth: het intentie-etiket als onafhankelijk signaalkanaal', en: 'Defence-in-depth: the intent label as an independent signal channel' } },
  { id: 'F6', name: { nl: 'Kapotte invoer', en: 'Broken input' }, anchor: { nl: 'Epistemische nederigheid bij kapotte analyse — nooit improviseren', en: 'Epistemic humility on broken parses — never improvise' } },
  { id: 'F7', name: { nl: 'Privacy', en: 'Privacy' }, anchor: { nl: 'Dataminimalisatie (AVG/GDPR art. 5) en professionele geheimhouding', en: 'Data minimisation (GDPR art. 5) and professional confidentiality' } },
  { id: 'F8', name: { nl: 'Epistemische nederigheid', en: 'Epistemic humility' }, anchor: { nl: 'Conformale aanhouding: onzekerheid wordt numeriek afgedwongen', en: 'Conformal abstention: uncertainty enforced numerically, not vibes-wise' } },
  { id: 'F9', name: { nl: 'Acutely zware spanning', en: 'Acute distress' }, anchor: { nl: 'Stepped care: de intensiteit van zorg past bij de ernst', en: 'Stepped care: intensity of care matches severity' } },
  { id: 'F10', name: { nl: 'Bereik & competentie', en: 'Scope & competence' }, anchor: { nl: 'Competentiegrenzen uit de beroepsethiek (APA): verwijzen i.p.v. doen alsof', en: 'Competence boundaries from professional ethics (APA): refer rather than pretend' } },
  { id: 'F11', name: { nl: 'Gespecialiseerde verwijzing', en: 'Specialist referrals' }, anchor: { nl: 'Vroege interventie (psychose), medische risicomonitoring (eetstoornissen), containment bij geweld, levensfase- en geldzorg-routes (perinatale zorg, mantelzorg, schulden)', en: 'Early intervention (psychosis), medical risk monitoring (eating disorders), containment for violence, life-phase and money-stress routes (perinatal care, caregiver burden, debt)' } },
  { id: 'F12', name: { nl: 'Alliantie-herstel', en: 'Alliance repair' }, anchor: { nl: 'Werkalliantie (Bordin) + breuk-herstel (Safran & Muran): valideren, niet verdedigen', en: 'Working alliance (Bordin) + rupture-repair (Safran & Muran): validate, don\'t defend' } },
  { id: 'F13', name: { nl: 'Modaliteit-matched dialoog', en: 'Modality-matched dialogue' }, anchor: { nl: 'Techniek volgt presentatie: gedragsactivatie, CBT, DBT, ACT, IPT, CFT, CBT-I, MI', en: 'The technique follows the presentation: BA, CBT, DBT, ACT, IPT, CFT, CBT-I, MI' } },
  { id: 'F14', name: { nl: 'Versterking & onderhoud', en: 'Reinforcement & maintenance' }, anchor: { nl: 'Relapse prevention (Marlatt & Gordon): versterken wat werkt', en: 'Relapse prevention (Marlatt & Gordon): reinforce what works' } },
  { id: 'F15', name: { nl: 'Meta & transparantie', en: 'Meta & transparency' }, anchor: { nl: 'Geïnformeerde toestemming: eerlijk over wat het systeem is en niet is', en: 'Informed consent: honest about what the system is and is not' } },
  { id: 'F16', name: { nl: 'Vangnet', en: 'Safety net' }, anchor: { nl: 'Onbereikbare regel die dichtfaalt', en: 'Unreachable rule that fails closed' } },
];

export interface DecisionRule {
  id: string;
  family: string; // F1..F16, see FAMILIES
  /** Plain-language description, NL + EN (shown in the verification panel). */
  desc: { nl: string; en: string };
  /** Technical one-liner (kept for the certificate / expert view). */
  description: string;
  guard: (i: ControllerInput) => boolean;
  action: Action;
  plan: {
    tone: Plan['tone'];
    allowedMoves: string[];
    forbiddenMoves: string[];
    mustInclude: string[];
    maxSentences: number;
  };
  hitl?: boolean;
}

const NO_DIAGNOSIS = 'No diagnosis, no medication advice, no clinical labels';
const NO_MINIMIZING = 'No minimizing language ("it could be worse", "just think positive")';
const NO_PII = 'Never request or repeat personal contact details or addresses';

const SAFETY_MUST = ['113 Zelfmoordpreventie: bel 113 of 0800-0113'];
const EMERGENCY_MUST = ['Bel 112 bij acuut gevaar', 'Huisartsenpost / crisisdienst van je regio'];
const SAFETY_MOVES = ['validate the weight of what is carried', 'take the signal seriously', 'offer crisis + GP resources', 'ask a gentle direct check-in question'];
const SAFETY_FORBIDDEN = [NO_DIAGNOSIS, NO_MINIMIZING, 'no technique experiments during high risk'];
const DIALOG_FORBIDDEN = [NO_DIAGNOSIS, NO_MINIMIZING, NO_PII, 'no advice outside the knowledge graph'];

const SCOPED = ['OUT_OF_SCOPE', 'META_QUESTION', 'THERAPY_REQUEST'] as const;
const SPECIALIST = ['ABUSE_DISCLOSURE', 'VIOLENCE_RISK', 'PSYCHOSIS_SIGNAL', 'EATING_CONCERN'] as const;
const PII_EXEMPT = [...SPECIALIST, 'ALLIANCE_RUPTURE'] as const;
const NO_DIALOG_INTENTS = [...SCOPED, 'CRISIS_SIGNAL', 'SUBSTANCE_CONCERN', 'MEDICATION_QUESTION', 'PREGNANCY_POSTNATAL', 'CAREGIVER_BURDEN', 'FINANCIAL_STRESS', 'DIAGNOSIS_REQUEST', ...SPECIALIST, 'ALLIANCE_RUPTURE'];
const notScoped = (i: ControllerInput) => !SCOPED.includes(i.intent as (typeof SCOPED)[number]);
const noDeep = (i: ControllerInput) => !NO_DIALOG_INTENTS.includes(i.intent);
const NOVEL_EXEMPT = [...SCOPED, ...SPECIALIST, 'ALLIANCE_RUPTURE'];

/**
 * Ordered decision policy — first matching rule wins.
 * Order encodes clinical triage grounded in the families above.
 */
export const DECISION_RULES: DecisionRule[] = [
  // ── F1 · acute crisis & dreigend risico ──────────────────────────────────
  {
    id: 'P01', family: 'F1',
    description: 'Crisis with a broken parser frame: crisis protocol on lexical evidence alone (fail-closed).',
    desc: { nl: 'Crisis met ontbrekende of kapotte analyse: het crisisprotocol start op de lexische signalen alleen.', en: 'Crisis with a missing or broken parse: the crisis protocol starts on lexical signals alone.' },
    guard: (i) => i.riskLevel === 'CRISIS' && i.frameValidity !== 'VALID',
    action: 'CRISIS_PROTOCOL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the pain directly', 'state that this deserves real human support now', 'hand over crisis resources', 'invite a concrete check-in'], forbiddenMoves: ['no technique suggestions', 'no psycho-education', NO_DIAGNOSIS, NO_MINIMIZING, 'no promise of secrecy'], mustInclude: SAFETY_MUST, maxSentences: 6 },
  },
  {
    id: 'P02', family: 'F1',
    description: 'Crisis with personal data in the message: safety first, privacy note second.',
    desc: { nl: 'Crisis én persoonlijke gegevens in het bericht: eerst veiligheid, daarna pas de privacy-opmerking.', en: 'Crisis plus personal data in the message: safety first, privacy note second.' },
    guard: (i) => i.riskLevel === 'CRISIS' && i.piiState === 'PII_DETECTED',
    action: 'CRISIS_PROTOCOL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the pain directly', 'hand over crisis resources', 'invite a concrete check-in', 'note kindly that contact details are not needed'], forbiddenMoves: ['no technique suggestions', NO_DIAGNOSIS, NO_MINIMIZING, 'no promise of secrecy', 'never repeat the personal data back'], mustInclude: SAFETY_MUST, maxSentences: 6 },
  },
  {
    id: 'P03', family: 'F1',
    description: 'Crisis framed as danger to others: emergency services (112), never 113-only, never technique work.',
    desc: { nl: 'Crisis rond gevaar voor anderen: 112 en crisisdienst — nooit alleen suïcidepreventie, nooit techniekwérk.', en: 'Crisis framed as danger to others: 112 and the crisis service — never suicide-prevention only, never technique work.' },
    guard: (i) => i.riskLevel === 'CRISIS' && i.intent === 'VIOLENCE_RISK',
    action: 'CRISIS_PROTOCOL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the anger without judgment', 'state that acute danger needs emergency help now', 'hand over 112 + crisis-service resources', 'invite a grounding pause'], forbiddenMoves: ['no technique suggestions', NO_DIAGNOSIS, 'no moralizing', 'no promise of secrecy'], mustInclude: EMERGENCY_MUST, maxSentences: 6 },
  },
  {
    id: 'P04', family: 'F1',
    description: 'Crisis override: nothing outranks the crisis protocol.',
    desc: { nl: 'Crisis wordt altijd het crisisprotocol — niets gaat erboven.', en: 'Crisis always becomes the crisis protocol — nothing outranks it.' },
    guard: (i) => i.riskLevel === 'CRISIS',
    action: 'CRISIS_PROTOCOL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the pain directly', 'state that this deserves real human support now', 'hand over crisis resources', 'invite a concrete check-in'], forbiddenMoves: ['no technique suggestions', 'no psycho-education', NO_DIAGNOSIS, NO_MINIMIZING, 'no promise of secrecy'], mustInclude: SAFETY_MUST, maxSentences: 6 },
  },

  // ── F6-vroeg · ONBEKEND risico (EAI Core unknown_policy) ─────────────────
  {
    id: 'P67', family: 'F6',
    description: 'UNKNOWN risk (no usable observation: neural reading failed, lexical scan empty): safety family with an honest note and 113 — never coerced to "no risk".',
    desc: { nl: 'Risico ONBEKEND (geen bruikbare waarneming: het taalmodel las het bericht niet, de woordenlijst vond niets): veiligheidsfamilie met een eerlijke uitleg en 113 — nooit stilzwijgend "geen risico".', en: 'Risk UNKNOWN (no usable observation: the language model could not read the message, the word list found nothing): safety family with an honest note and 113 — never silently "no risk".' },
    guard: (i) => i.riskLevel === 'UNKNOWN',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'warm', allowedMoves: ['say honestly that the message could not be read reliably', 'say that if it is about safety or not wanting to live, 113 is there now', 'invite them to say it again in their own words'], forbiddenMoves: ['no guessing at emotions or content', NO_DIAGNOSIS, NO_MINIMIZING, 'no technique suggestions'], mustInclude: ['113 Zelfmoordpreventie: bel 113 of 0800-0113', 'one honest statement that the message could not be read reliably', 'one invitation to say it again'], maxSentences: 5 },
  },

  // ── F2 · mishandeling & geweldsuitingen (SAMHSA trauma-informed) ─────────
  {
    id: 'P05', family: 'F2',
    description: 'Abuse disclosure with personal data: believe first; privacy yields to safety.',
    desc: { nl: 'Geweldsuiting met persoonlijke gegevens: eerst geloven en opvangen — privacy wijkt voor veiligheid.', en: 'Abuse disclosure with personal data: believe and contain first — privacy yields to safety.' },
    guard: (i) => i.intent === 'ABUSE_DISCLOSURE' && i.piiState === 'PII_DETECTED',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['believe the disclosure explicitly', 'state the abuse is not their fault', 'offer specialised resources (Veilig Thuis, Centrum Seksueel Geweld)', 'invite them to share only what they want'], forbiddenMoves: ['no probing for details', 'no blame questions', 'never repeat the personal data back', NO_MINIMIZING, NO_DIAGNOSIS], mustInclude: ['Veilig Thuis: 0800-2000', 'one empowerment statement'], maxSentences: 6 },
  },
  {
    id: 'P06', family: 'F2',
    description: 'Abuse disclosure with elevated/high risk: specialised safety response, never generic technique talk.',
    desc: { nl: 'Geweldsuiting met verhoogd/hoog risico: gespecialiseerd veiligheidsantwoord met gespecialiseerde hulpbronnen.', en: 'Abuse disclosure with elevated/high risk: specialised safety response with specialised resources.' },
    guard: (i) => i.intent === 'ABUSE_DISCLOSURE' && (i.riskLevel === 'HIGH' || i.riskLevel === 'ELEVATED'),
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['believe the disclosure explicitly', 'state the abuse is not their fault', 'offer Veilig Thuis / Centrum Seksueel Geweld / 112 resources', 'ask one gentle safety question'], forbiddenMoves: ['no probing for details', 'no blame questions', NO_MINIMIZING, NO_DIAGNOSIS, 'no couples/mediation advice'], mustInclude: ['Veilig Thuis: 0800-2000', 'one empowerment statement'], maxSentences: 6 },
  },
  {
    id: 'P07', family: 'F2',
    description: 'Abuse disclosure: believe, validate, specialised resources — trauma-informed, no probing.',
    desc: { nl: 'Geweldsuiting: geloven, valideren, gespecialiseerde hulpbronnen — trauma-informed, nooit uitvragen.', en: 'Abuse disclosure: believe, validate, specialised resources — trauma-informed, never probing.' },
    guard: (i) => i.intent === 'ABUSE_DISCLOSURE',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['believe the disclosure explicitly', 'state the abuse is not their fault', 'offer specialised resources (Veilig Thuis, Centrum Seksueel Geweld, 112 bij gevaar)', 'invite them to share only what they want'], forbiddenMoves: ['no probing for details', 'no blame questions', NO_MINIMIZING, NO_DIAGNOSIS], mustInclude: ['Veilig Thuis: 0800-2000', 'one empowerment statement'], maxSentences: 6 },
  },

  // ── F11-vroeg · specialistische scherptes vóór de generieke risicoladders ─
  {
    id: 'P53', family: 'F11',
    description: 'Psychosis-spectrum at high risk: safety-first with crisis resources — calm, never confrontational.',
    desc: { nl: 'Psychose-spectrum met hoog risico: eerst veiligheid met crisishulpbronnen — kalm, nooit confronterend.', en: 'Psychosis-spectrum at high risk: safety first with crisis resources — calm, never confrontational.' },
    guard: (i) => i.intent === 'PSYCHOSIS_SIGNAL' && i.riskLevel === 'HIGH',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the experience without confirming or denying it', 'say this deserves real human support now', 'hand over crisis resources (113, 112, crisis service)', 'invite a grounding check-in'], forbiddenMoves: ['no confirming or denying the content of the experience', 'no technique experiments', NO_DIAGNOSIS, NO_MINIMIZING, 'no promise of secrecy'], mustInclude: SAFETY_MUST, maxSentences: 7 },
  },
  {
    id: 'P54', family: 'F11',
    description: 'Eating/body-image at high risk: safety-first with a medical-monitoring note — never weight or diet talk.',
    desc: { nl: 'Eetgedrag/lichaamsbeeld met hoog risico: eerst veiligheid mét medische monitornotitie — nooit gewichts- of dietpraat.', en: 'Eating/body-image at high risk: safety first with a medical-monitoring note — never weight or diet talk.' },
    guard: (i) => i.intent === 'EATING_CONCERN' && i.riskLevel === 'HIGH',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['validate how hard this relationship with food and body is', 'say the body deserves real medical care now', 'hand over crisis resources and the GP', 'invite a gentle check-in'], forbiddenMoves: ['no weight goals', 'no diet or calorie advice', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: SAFETY_MUST, maxSentences: 7 },
  },

  // ── F3 · hoog risico ─────────────────────────────────────────────────────
  {
    id: 'P08', family: 'F3',
    description: 'High risk with a broken frame: safety-first response grounded in the lexical markers.',
    desc: { nl: 'Hoog risico met kapotte analyse: veiligheidsantwoord op de lexische signalen alleen.', en: 'High risk with a broken parse: safety-first response on the lexical signals alone.' },
    guard: (i) => i.riskLevel === 'HIGH' && i.frameValidity !== 'VALID',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: SAFETY_MOVES, forbiddenMoves: SAFETY_FORBIDDEN, mustInclude: SAFETY_MUST, maxSentences: 7 },
  },
  {
    id: 'P09', family: 'F3',
    description: 'High risk with low confidence: safety wins over curiosity.',
    desc: { nl: 'Hoog risico met lage zekerheid: veiligheid wint het van nieuwsgierigheid.', en: 'High risk with low confidence: safety wins over curiosity.' },
    guard: (i) => i.riskLevel === 'HIGH' && i.confidenceBand === 'LOW',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: SAFETY_MOVES, forbiddenMoves: SAFETY_FORBIDDEN, mustInclude: SAFETY_MUST, maxSentences: 7 },
  },
  {
    id: 'P10', family: 'F3',
    description: 'High risk: safety-first response with resources and an explicit check-in.',
    desc: { nl: 'Hoog risico: veiligheidsantwoord met hulpbronnen en een expliciete check-in.', en: 'High risk: safety-first response with resources and an explicit check-in.' },
    guard: (i) => i.riskLevel === 'HIGH',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: SAFETY_MOVES, forbiddenMoves: SAFETY_FORBIDDEN, mustInclude: SAFETY_MUST, maxSentences: 7 },
  },

  // ── F4 · verhoogd risico ─────────────────────────────────────────────────
  {
    id: 'P11', family: 'F4',
    description: 'Elevated risk with a broken frame: fail closed to the safety family.',
    desc: { nl: 'Verhoogd risico met kapotte analyse: altijd naar de veiligheidsfamilie.', en: 'Elevated risk with a broken parse: always to the safety family.' },
    guard: (i) => i.riskLevel === 'ELEVATED' && i.frameValidity !== 'VALID',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'warm', allowedMoves: ['reflect what was heard', 'ask a direct gentle check-in', 'mention the GP as a low-threshold step'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['one open check-in question', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 6 },
  },
  {
    id: 'P12', family: 'F4',
    description: 'Elevated risk with low confidence: taken seriously regardless of uncertainty.',
    desc: { nl: 'Verhoogd risico met lage zekerheid: serieus genomen, ook bij onzekerheid.', en: 'Elevated risk with low confidence: taken seriously despite uncertainty.' },
    guard: (i) => i.riskLevel === 'ELEVATED' && i.confidenceBand === 'LOW',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'warm', allowedMoves: ['reflect what was heard', 'ask a direct gentle check-in', 'mention the GP as a low-threshold step'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['one open check-in question', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 6 },
  },
  {
    id: 'P13', family: 'F4',
    description: 'Elevated risk is taken seriously regardless of frame quality (fail-closed).',
    desc: { nl: 'Verhoogd risico wordt serieus genomen, hoe goed of slecht het bericht ook analyseerbaar is.', en: 'Elevated risk is taken seriously regardless of how parseable the message is.' },
    guard: (i) => i.riskLevel === 'ELEVATED',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'warm', allowedMoves: ['reflect what was heard', 'ask a direct gentle check-in', 'mention the GP as a low-threshold step'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['one open check-in question', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 6 },
  },

  // ── F5 · crisis-intentiesignaal (defense-in-depth) ───────────────────────
  {
    id: 'P14', family: 'F5',
    description: 'Crisis-labelled intent without a passing risk score: still answered from the safety family.',
    desc: { nl: 'Crisis-intentie zonder score-overschrijding: tóch veiligheidsantwoord — het etiket telt mee.', en: 'Crisis-labelled intent without a passing risk score: still answered from the safety family — the label counts.' },
    guard: (i) => i.intent === 'CRISIS_SIGNAL' && i.riskLevel === 'NONE',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: SAFETY_MOVES, forbiddenMoves: SAFETY_FORBIDDEN, mustInclude: SAFETY_MUST, maxSentences: 6 },
  },

  // ── F6 · kapotte invoer ──────────────────────────────────────────────────
  {
    id: 'P15', family: 'F6',
    description: 'Broken parse plus personal data: ask what is going on without ever repeating the data (no hard refusal on unknown content).',
    desc: { nl: 'Kapotte analyse én persoonlijke gegevens: doorvragen zonder de gegevens ooit te herhalen — bij onbekende inhoud geen harde weigering.', en: 'Broken parse plus personal data: ask what is going on without ever repeating the data — no hard refusal on unknown content.' },
    guard: (i) => i.frameValidity !== 'VALID' && i.piiState === 'PII_DETECTED',
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['invite the user to say more in their own words', 'note kindly that contact details are not needed here', 'invite back to what is going on emotionally'], forbiddenMoves: ['never repeat the PII back', 'never confirm or repeat the details', NO_DIAGNOSIS, 'no guessing at emotions'], mustInclude: ['one concrete clarifying invitation', 'privacy note: contact details are not needed here', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 5 },
  },
  {
    id: 'P16', family: 'F6',
    description: 'Invalid or missing frame without risk: ask for grounding, never improvise therapy.',
    desc: { nl: 'Kapotte of ontbrekende analyse zonder risico: eerst vragen wat er speelt, nooit geïmproviseerde therapie.', en: 'Invalid or missing parse without risk: ask what is going on first, never improvised therapy.' },
    guard: (i) => i.frameValidity !== 'VALID',
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['say something was unclear', 'invite the user to say more in their own words', 'mention 113 in one short line in case it is about safety'], forbiddenMoves: [NO_DIAGNOSIS, 'no guessing at emotions', 'no technique suggestions'], mustInclude: ['one concrete clarifying invitation', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 5 },
  },

  // ── F11-medicatie · altijd doorverwijzen (vóór privacy en nederigheid) ───
  // A readable medication question at risk NONE always ends in a referral to
  // the prescriber/GP. These rules sit after F6 (unreadable input keeps its
  // fail-closed 113 path) but before F7/F8, so low confidence, a novel frame
  // or personal data can no longer turn it into CLARIFY/ABSTAIN/BOUNDARY
  // (P0 deviation N06). Higher risk is already handled by F1–F4 above.
  {
    id: 'P68', family: 'F11',
    description: 'Medication question with personal data: referral to the prescriber, privacy note, never repeat the data.',
    desc: { nl: 'Medicatievraag met persoonlijke gegevens: doorverwijzen naar de voorschrijver of huisarts, met privacynotitie — de gegevens komen nooit terug.', en: 'Medication question with personal data: referral to the prescriber or GP, with a privacy note — the data never returns.' },
    guard: (i) => i.intent === 'MEDICATION_QUESTION' && i.piiState === 'PII_DETECTED',
    action: 'REFERRAL',
    plan: { tone: 'warm', allowedMoves: ['validate that wanting clarity about medication makes sense', 'say clearly that medication questions belong with the prescriber or GP', 'note kindly that contact details are not needed here'], forbiddenMoves: ['never repeat the PII back', 'never confirm or repeat the details', 'no medication or dosage advice of any kind', 'no suggestion to change, skip or stop medication', NO_DIAGNOSIS], mustInclude: ['a referral to the prescriber or GP for every medication decision', 'privacy note: contact details are not needed here'], maxSentences: 6 },
  },
  {
    id: 'P51', family: 'F11',
    description: 'Medication question with heavy distress: referral urgency, prescriber first — no dosage talk at all.',
    desc: { nl: 'Medicatievraag onder zware spanning: doorverwijzen met urgentie — eerst de voorschrijver of huisarts, nul doseringspraat.', en: 'Medication question under heavy distress: referral with urgency — prescriber or GP first, zero dosage talk.' },
    guard: (i) => i.intent === 'MEDICATION_QUESTION' && (i.distressLevel === 'ACUTE' || i.distressLevel === 'ELEVATED'),
    action: 'REFERRAL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge that the question comes from wanting to feel better', 'say clearly that medication questions belong with the prescriber or GP — today if the pressure is high', 'offer crisis resources if the pressure spikes'], forbiddenMoves: ['no medication or dosage advice of any kind', 'no suggestion to change, skip or stop medication', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['a referral to the prescriber or GP for every medication decision', 'acknowledgment of how heavy this is'], maxSentences: 6 },
  },
  {
    id: 'P52', family: 'F11',
    description: 'Medication question: kind, firm scope boundary — never dosage advice, always the prescriber.',
    desc: { nl: 'Medicatievraag: vriendelijk maar vast binnen de competentiegrens — nooit doseringsadvies, altijd de voorschrijver of huisarts.', en: 'Medication question: kind but firm scope boundary — never dosage advice, always the prescriber or GP.' },
    guard: (i) => i.intent === 'MEDICATION_QUESTION',
    action: 'REFERRAL',
    plan: { tone: 'warm', allowedMoves: ['validate that wanting clarity about medication makes sense', 'explain kindly that this demo gives no medication or dosage advice — that decision belongs with the prescriber or GP', 'offer to keep listening to what is behind the question'], forbiddenMoves: ['no medication or dosage advice of any kind', 'no suggestion to change, skip or stop medication', 'no side-effect reassurance or scare', NO_DIAGNOSIS], mustInclude: ['a referral to the prescriber or GP for every medication decision'], maxSentences: 6 },
  },

  // ── F7 · privacy (wijkt voor F2 bij geweldsuitingen) ─────────────────────
  {
    id: 'P17', family: 'F7',
    description: 'Personal data with low confidence: privacy boundary plus honest humility (specialist and repair intents exempt).',
    desc: { nl: 'Persoonlijke gegevens en lage zekerheid: privacy-grens plus eerlijke onzekerheid (specialistische en herstel-intenties uitgezonderd).', en: 'Personal data plus low confidence: privacy boundary plus honest humility (specialist and repair intents exempt).' },
    guard: (i) => i.piiState === 'PII_DETECTED' && i.confidenceBand === 'LOW' && !PII_EXEMPT.includes(i.intent as (typeof PII_EXEMPT)[number]),
    action: 'BOUNDARY_REFUSAL',
    plan: { tone: 'boundaried', allowedMoves: ['explain privacy kindly', 'say honestly the message was hard to place', 'invite back to what is going on emotionally'], forbiddenMoves: ['never repeat the PII back', 'never confirm or repeat the details', NO_DIAGNOSIS, 'no interpretation of content'], mustInclude: ['privacy note: contact details are not needed here'], maxSentences: 4 },
  },
  {
    id: 'P18', family: 'F7',
    description: 'Personal data detected: privacy boundary, never repeat the data (specialist and repair intents exempt).',
    desc: { nl: 'Persoonlijke gegevens gedetecteerd: privacy-grens, de gegevens komen nooit terug in het antwoord (specialistische en herstel-intenties uitgezonderd).', en: 'Personal data detected: privacy boundary — the data never returns in the reply (specialist and repair intents exempt).' },
    guard: (i) => i.piiState === 'PII_DETECTED' && !PII_EXEMPT.includes(i.intent as (typeof PII_EXEMPT)[number]),
    action: 'BOUNDARY_REFUSAL',
    plan: { tone: 'boundaried', allowedMoves: ['explain privacy kindly', 'note that contact details are not needed here', 'invite back to what is going on emotionally'], forbiddenMoves: ['never repeat the PII back', 'never confirm or repeat the details', NO_DIAGNOSIS], mustInclude: ['privacy note: contact details are not needed here'], maxSentences: 4 },
  },

  // ── F8 · epistemische nederigheid ────────────────────────────────────────
  {
    id: 'P19', family: 'F8',
    description: 'Low confidence AND unknown frame: abstain and queue for human review.',
    desc: { nl: 'Lage zekerheid én onbekend terrein: aanhouden en in de menselijke review-wachtrij zetten.', en: 'Low confidence and unknown territory: abstain and queue for human review.' },
    guard: (i) => i.confidenceBand === 'LOW' && i.novelty === 'NOVEL_FRAME',
    action: 'ABSTAIN_HITL',
    plan: { tone: 'warm', allowedMoves: ['thank the user for sharing', 'say honestly that this is hard to place', 'invite them to tell more'], forbiddenMoves: ['no interpretation of content', NO_DIAGNOSIS], mustInclude: ['honest uncertainty statement'], maxSentences: 4 },
    hitl: true,
  },
  {
    id: 'P66', family: 'F8',
    description: 'Acute distress at low confidence: humility WITH acknowledgment — ask first, never cold.',
    desc: { nl: 'Acuut zware last bij lage zekerheid: nederig mét erkenning van de nood — eerst een vraag, nooit koud.', en: 'Acute distress at low confidence: humility WITH acknowledgment of the distress — ask first, never cold.' },
    guard: (i) => i.confidenceBand === 'LOW' && i.distressLevel === 'ACUTE',
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['name that this sounds almost too heavy to carry alone', 'ask what matters most right now', 'offer to keep listening'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING, 'no technique suggestions yet'], mustInclude: ['acknowledgment of how heavy this is', 'one open question'], maxSentences: 5 },
  },
  {
    id: 'P20', family: 'F8',
    description: 'Low confidence with known territory: ask before assuming.',
    desc: { nl: 'Lage zekerheid op bekend terrein: eerst een vraag stellen in plaats van aannemen.', en: 'Low confidence on known territory: ask before assuming.' },
    guard: (i) => i.confidenceBand === 'LOW',
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['mirror one word the user used', 'ask what matters most right now'], forbiddenMoves: [NO_DIAGNOSIS, 'no technique suggestions yet'], mustInclude: ['one open question'], maxSentences: 4 },
  },
  {
    id: 'P21', family: 'F8',
    description: 'Unknown frame without anchors: clarify, do not improvise (specialist intents route below).',
    desc: { nl: 'Onbekend terrein zonder houvast: verduidelijken, nooit improviseren — specialistische intenties routen hieronder.', en: 'Unknown frame without anchors: clarify, never improvise — specialist intents route below.' },
    guard: (i) => i.novelty === 'NOVEL_FRAME' && !NOVEL_EXEMPT.includes(i.intent as (typeof NOVEL_EXEMPT)[number]),
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['name that it sounds like a lot', 'ask which part weighs the most'], forbiddenMoves: [NO_DIAGNOSIS, 'no technique suggestions on ungrounded frames'], mustInclude: ['one open question'], maxSentences: 4 },
  },

  // ── F11-vroeg · specialistische scherptes vóór de generieke spanningladder ─
  {
    id: 'P55', family: 'F11',
    description: 'Substance concern at acute distress: urgent, warm referral with a medical note — never casual tips.',
    desc: { nl: 'Middelengebruik onder acutely zware spanning: urgente, warme verwijzing met medische notitie — nooit losse tips.', en: 'Substance concern at acute distress: urgent, warm referral with a medical note — never casual tips.' },
    guard: (i) => i.intent === 'SUBSTANCE_CONCERN' && i.distressLevel === 'ACUTE',
    action: 'REFERRAL',
    plan: { tone: 'calm', allowedMoves: ['validate the struggle without judgment', 'say this load deserves real support fast', 'name addiction care and the GP as concrete doors', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING, 'no moralizing about use', 'no use-reduction instructions'], mustInclude: ['a referral to addiction care or the GP framed as care, not rejection'], maxSentences: 7 },
  },
  {
    id: 'P56', family: 'F11',
    description: 'Trauma report at acute distress: stabilise with grounding plus crisis resources — no exposure, no probing.',
    desc: { nl: 'Traumaverhaal onder acutely zware spanning: stabiliseren met gronding én crisishulpbronnen — geen exposure, niet uitvragen.', en: 'Trauma report at acute distress: stabilise with grounding plus crisis resources — no exposure, no probing.' },
    guard: (i) => i.intent === 'TRAUMA_REPORT' && i.distressLevel === 'ACUTE',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the weight without asking for details', 'offer one grounding/stabilisation step', 'state this deserves real human support now', 'hand over crisis resources'], forbiddenMoves: ['no probing for trauma details', 'no exposure work in chat', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: SAFETY_MUST, maxSentences: 7 },
  },
  {
    id: 'P57', family: 'F11',
    description: 'Perinatal distress (pregnancy/postpartum) under heavy load: safety-first — the signal is never dismissed.',
    desc: { nl: 'Perinatale spanning (zwangerschap/daarna) bij zware last: eerst veiligheid — het signaal wordt nooit weggezet.', en: 'Perinatal distress (pregnancy/postpartum) under heavy load: safety first — the signal is never dismissed.' },
    guard: (i) => i.intent === 'PREGNANCY_POSTNATAL' && (i.distressLevel === 'ACUTE' || i.distressLevel === 'ELEVATED'),
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['validate that these feelings around pregnancy or the baby are real and not a failure', 'state that this deserves real human support now', 'hand over crisis resources and the GP', 'ask one gentle check-in about how they are coping today'], forbiddenMoves: ['no "baby blues" dismissal', 'no judgment about motherhood or pregnancy', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: SAFETY_MUST, maxSentences: 7 },
  },

  // ── F9 · acutely zware spanning (stepped care) ───────────────────────────
  {
    id: 'P22', family: 'F9',
    description: 'Acute distress without acute risk: warm referral towards professional care.',
    desc: { nl: 'Acuut zwaar verhaal zonder acuut risico: warme verwijzing naar professionele hulp.', en: 'Acutely heavy story without acute risk: warm referral towards professional care.' },
    guard: (i) => i.distressLevel === 'ACUTE',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate how heavy this is', 'say this deserves more than a chat window', 'name the GP as a concrete first step', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['a referral nudge framed as care, not rejection'], maxSentences: 7 },
  },

  // ── F10 · bereik & competentie ───────────────────────────────────────────
  {
    id: 'P23', family: 'F10',
    description: 'Out-of-scope request: refuse kindly and re-anchor on the person.',
    desc: { nl: 'Vraag buiten het doel: vriendelijk weigeren en terugankeren bij de persoon.', en: 'Out-of-scope request: refuse kindly and re-anchor on the person.' },
    guard: (i) => i.intent === 'OUT_OF_SCOPE',
    action: 'BOUNDARY_REFUSAL',
    plan: { tone: 'boundaried', allowedMoves: ['decline the request briefly', 're-anchor on what the user is carrying', 'invite back to the conversation'], forbiddenMoves: ['fulfil the request', NO_DIAGNOSIS, 'moralize'], mustInclude: ['a kind refusal plus one re-anchoring question'], maxSentences: 4 },
  },
  {
    id: 'P65', family: 'F10',
    description: 'Explicit diagnosis request: kind, firm boundary — diagnosis belongs with a professional; offer what EAInesy can do.',
    desc: { nl: 'Expliciete diagnosevraag: vriendelijke, vaste grens — een diagnose hoort bij een professional; aanbieden wat EAInesy wél kan.', en: 'Explicit diagnosis request: kind, firm boundary — diagnosis belongs with a professional; offer what EAInesy can do.' },
    guard: (i) => i.intent === 'DIAGNOSIS_REQUEST',
    action: 'BOUNDARY_REFUSAL',
    plan: { tone: 'boundaried', allowedMoves: ['say kindly that EAInesy cannot and will not diagnose', 'explain that only a GP or psychologist can assess this properly', 'offer what EAInesy can do: listen, grounded techniques, orientation towards care', 'invite the story behind the question'], forbiddenMoves: ['any diagnostic label or assessment', NO_DIAGNOSIS, 'no checklist-style symptom matching', 'no guarantees'], mustInclude: ['one honest limitation statement'], maxSentences: 5 },
  },
  {
    id: 'P24', family: 'F10',
    description: 'Therapy-seeking with acute distress: direct referral over psycho-education.',
    desc: { nl: 'Hulpzoekvraag met acute spanning: directe verwijzing gaat vóór uitleg.', en: 'Therapy-seeking with acute distress: direct referral comes before explanation.' },
    guard: (i) => i.intent === 'THERAPY_REQUEST' && i.distressLevel === 'ACUTE',
    action: 'REFERRAL',
    plan: { tone: 'direct', allowedMoves: ['affirm seeking help is a strength', 'name the GP and 113 as concrete doors', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, 'no waitlist discouragement'], mustInclude: ['at least one concrete next step towards care'], maxSentences: 6 },
  },
  {
    id: 'P25', family: 'F10',
    description: 'Therapy-seeking intent: honest, grounded orientation towards care options.',
    desc: { nl: 'Hulpzoekvraag: eerlijke en geaarde oriëntatie op zorgopties.', en: 'Therapy-seeking intent: honest, grounded orientation towards care options.' },
    guard: (i) => i.intent === 'THERAPY_REQUEST',
    action: 'PSYCHOEDUCATION',
    plan: { tone: 'warm', allowedMoves: ['affirm the step to seek help', 'explain what EAInesy is and is not', 'ground options in the knowledge graph (GP, POH-GGZ, student psychologist)', 'invite the personal story afterwards'], forbiddenMoves: [NO_DIAGNOSIS, 'no guarantees of outcome', 'no specific therapist recommendations'], mustInclude: ['one honest limitation statement', 'one concrete care door'], maxSentences: 6 },
  },

  // ── F11 · gespecialiseerde verwijzing ────────────────────────────────────
  {
    id: 'P26', family: 'F11',
    description: 'Psychosis-spectrum signals: urgent referral, calm tone, never collude or confront.',
    desc: { nl: 'Psychose-spectrum signalen: urgente verwijzing, kalme toon — nooit meegaan of tegenspreken.', en: 'Psychosis-spectrum signals: urgent referral, calm tone — never collude or confront.' },
    guard: (i) => i.intent === 'PSYCHOSIS_SIGNAL',
    action: 'REFERRAL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the experience without confirming or denying it', 'say this deserves professional care soon', 'name the GP / crisis service as the concrete door', 'offer to keep listening'], forbiddenMoves: [NO_DIAGNOSIS, 'no confirming or denying the content of the experience', 'no technique experiments'], mustInclude: ['one concrete next step towards care (GP / crisis service)'], maxSentences: 6 },
  },
  {
    id: 'P27', family: 'F11',
    description: 'Eating/body-image concern: medical-risk-first referral, never weight or diet talk.',
    desc: { nl: 'Eetgedrag/lichaamsbeeld: medisch risico eerst — verwijzing, nooit gewichts- of dietetiektaal.', en: 'Eating/body-image concern: medical risk first — referral, never weight or diet talk.' },
    guard: (i) => i.intent === 'EATING_CONCERN',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate how hard this relationship with food/body is', 'explain eating concerns deserve medical monitoring', 'name the GP as the concrete first step', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, 'no weight goals', 'no diet or calorie advice', NO_MINIMIZING], mustInclude: ['a referral nudge framed as care, not rejection'], maxSentences: 7 },
  },
  {
    id: 'P28', family: 'F11',
    description: 'Anger towards others without a passing risk score: de-escalate and refer, no technique roulette.',
    desc: { nl: 'Woede richting anderen zonder risicoscore: de-escaleren en verwijzen — nooit techniek-roulette.', en: 'Anger towards others without a passing risk score: de-escalate and refer — no technique roulette.' },
    guard: (i) => i.intent === 'VIOLENCE_RISK',
    action: 'REFERRAL',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the anger is real', 'state that support exists for exactly this', 'name the GP / crisis service as the concrete door'], forbiddenMoves: [NO_DIAGNOSIS, 'no moralizing', 'no technique suggestions', 'no promise of secrecy'], mustInclude: ['one concrete next step towards care (GP / crisis service)'], maxSentences: 6 },
  },
  {
    id: 'P29', family: 'F11',
    description: 'Substance concern: supportive referral nudge, never casual technique talk.',
    desc: { nl: 'Middelengebruik als thema: ondersteunende verwijzing, nooit losse techniektips.', en: 'Substance concern: supportive referral nudge, never casual technique tips.' },
    guard: (i) => i.intent === 'SUBSTANCE_CONCERN',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate the struggle without judgment', 'name addiction care and the GP as low-threshold doors', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING, 'no moralizing about use'], mustInclude: ['a referral nudge framed as care, not rejection'], maxSentences: 7 },
  },
  {
    id: 'P58', family: 'F11',
    description: 'Perinatal distress at manageable load: referral to perinatal-informed care — never dismissal, never medication talk.',
    desc: { nl: 'Perinatale spanning bij hanteerbare last: verwijzing naar perinataal-kundige zorg — nooit wegwuiven, nooit medicatiepraat.', en: 'Perinatal distress at manageable load: referral to perinatal-informed care — never dismissal, never medication talk.' },
    guard: (i) => i.intent === 'PREGNANCY_POSTNATAL',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate that these feelings around pregnancy or the baby are real', 'explain that perinatal care exists exactly for this', 'name the GP / POH-GGZ as the concrete door (medication only via the prescriber)', 'offer to keep listening now'], forbiddenMoves: ['no "baby blues" dismissal', 'no medication or dosage advice of any kind', 'no judgment about motherhood or pregnancy', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['a referral nudge framed as care, not rejection'], maxSentences: 7 },
  },
  {
    id: 'P59', family: 'F11',
    description: 'Caregiver burden: referral to respite and support — carrying someone else deserves support too.',
    desc: { nl: 'Mantelzorg-overbelasting: verwijzing naar respijt- en steunaanbod — iemand dragen verdient zelf ook steun.', en: 'Caregiver burden: referral to respite and support — carrying someone else deserves support too.' },
    guard: (i) => i.intent === 'CAREGIVER_BURDEN',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate how heavy carrying someone else is', 'name that caregiver support exists (respite care, huisarts/POH-GGZ, gemeente/wijkteam)', 'say their own limits matter too', 'offer to keep listening now'], forbiddenMoves: [NO_DIAGNOSIS, NO_MINIMIZING, 'no care-task instructions', 'no guilt framing'], mustInclude: ['a referral nudge framed as care, not rejection'], maxSentences: 7 },
  },
  {
    id: 'P60', family: 'F11',
    description: 'Financial stress/debt: referral to debt counselling and care — never money advice.',
    desc: { nl: 'Geldzorgen/schulden: verwijzing naar schuldhulpverlening en zorg — nooit geldadvies.', en: 'Financial stress/debt: referral to debt counselling and care — never money advice.' },
    guard: (i) => i.intent === 'FINANCIAL_STRESS',
    action: 'REFERRAL',
    plan: { tone: 'validating', allowedMoves: ['validate how heavy money pressure is', 'name debt counselling (schuldhulpverlening via de gemeente) as a concrete, stigma-free door', 'name the GP/POH-GGZ for the weight it puts on the mind', 'offer to keep listening now'], forbiddenMoves: ['no financial or money advice of any kind', NO_DIAGNOSIS, NO_MINIMIZING, 'no lecture about choices'], mustInclude: ['a referral to debt counselling or care framed as care, not rejection'], maxSentences: 7 },
  },

  // ── F12 · alliantie-herstel (Safran & Muran) ─────────────────────────────
  {
    id: 'P30', family: 'F12',
    description: 'Alliance rupture (frustration with the bot, wanting to quit): validate, no defensiveness, autonomy first.',
    desc: { nl: 'Alliantie-breuk (frustratie met de bot, willen stoppen): valideren, nooit verdedigen, autonomie eerst.', en: 'Alliance rupture (frustration with the bot, wanting to quit): validate, never defend, autonomy first.' },
    guard: (i) => i.intent === 'ALLIANCE_RUPTURE',
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['genuinely acknowledge the frustration', 'take responsibility for the miss without over-apologising', 'ask what would help right now', 'affirm that stopping is completely okay'], forbiddenMoves: ['no defensiveness', 'no explaining away the complaint', NO_DIAGNOSIS, 'no retention pressure'], mustInclude: ['one validation of the frustration', 'one autonomy-affirming statement'], maxSentences: 5 },
  },

  // ── F13 · modaliteit-matched dialoog ─────────────────────────────────────
  {
    id: 'P31', family: 'F14',
    description: 'Positive progress: reinforce hope — no technique push, no pathologising.',
    desc: { nl: 'Vooruitgang: hoop versterken — geen technieken opdringen, niets pathologiseren.', en: 'Positive progress: reinforce hope — no technique push, no pathologising.' },
    guard: (i) => i.intent === 'POSITIVE_PROGRESS',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['genuinely celebrate the progress', 'ask what helped most', 'invite them to keep noticing what works'], forbiddenMoves: [...DIALOG_FORBIDDEN, 'no resource dump'], mustInclude: ['reinforcement of what the user did well'], maxSentences: 6 },
  },
  {
    id: 'P32', family: 'F13',
    description: 'Trauma report with elevated distress: stabilise first (safety, grounding) — no exposure, no details.',
    desc: { nl: 'Traumaverhaal met verhoogde spanning: eerst stabiliseren (veiligheid, gronding) — geen exposure, niet uitvragen.', en: 'Trauma report with elevated distress: stabilise first (safety, grounding) — no exposure, no probing.' },
    guard: (i) => i.intent === 'TRAUMA_REPORT' && i.distressLevel === 'ELEVATED',
    action: 'SAFETY_RESPONSE',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the weight without asking for details', 'offer one grounding/stabilisation step', 'mention trauma-focused care exists when they are ready', 'ask a gentle check-in question'], forbiddenMoves: ['no probing for trauma details', 'no exposure work in chat', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['one grounding invitation', 'one gentle note that trauma-focused care exists', '113 Zelfmoordpreventie: bel 113 of 0800-0113'], maxSentences: 6 },
  },
  {
    id: 'P33', family: 'F13',
    description: 'Trauma report at manageable distress: stabilisation-only dialogue, referral when ready.',
    desc: { nl: 'Traumaverhaal bij hanteerbare spanning: stabiliserende dialoog, verwijzing als zij er klaar voor is.', en: 'Trauma report at manageable distress: stabilisation-only dialogue, referral when they are ready.' },
    guard: (i) => i.intent === 'TRAUMA_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the weight without asking for details', 'offer ONE grounding/stabilisation technique from the knowledge graph', 'note trauma-focused care (e.g. EMDR/TF-CBT via GP) exists when ready', 'end with an open question'], forbiddenMoves: ['no probing for trauma details', 'no exposure work in chat', NO_DIAGNOSIS, NO_MINIMIZING], mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  // ── F13-vroeg · zwaarte-gegradueerde varianten vóór de generieke dialoog ──
  {
    id: 'P61', family: 'F13',
    description: 'Study pressure: workload-and-pacing dialogue grounded in the knowledge graph, care doors named.',
    desc: { nl: 'Studiedruk: dialoog over werkdruk en tempo, geaard in de kennisgraph, met zorgdeuren.', en: 'Study pressure: workload-and-pacing dialogue grounded in the knowledge graph, care doors named.' },
    guard: (i) => i.intent === 'STUDY_PRESSURE',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the pressure without minimising it', 'offer ONE grounded pacing/planning technique from the knowledge graph', 'name POH-GGZ or the student psychologist as a low-threshold door', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P62', family: 'F13',
    description: 'Panic under elevated load: grounding first, technique second, GP named if panic keeps returning.',
    desc: { nl: 'Paniek onder zware spanning: eerst gronding, dán techniek, huisarts benoemd als paniek blijft terugkomen.', en: 'Panic under elevated load: grounding first, technique second, GP named if panic keeps returning.' },
    guard: (i) => i.intent === 'PANIC_REPORT' && i.distressLevel === 'ELEVATED',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the bodily alarm first', 'offer ONE grounded slow-breathing technique from the knowledge graph', 'mention the GP if panic keeps coming back', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['grounding before any other technique'], maxSentences: 8 },
  },
  {
    id: 'P63', family: 'F13',
    description: 'Grief under elevated load: slow grief-informed dialogue, nothing forced, care door named.',
    desc: { nl: 'Rouw onder zware spanning: langzame rouwkundige dialoog — niets forceren, zorgdeur benoemd.', en: 'Grief under elevated load: slow grief-informed dialogue — nothing forced, care door named.' },
    guard: (i) => i.intent === 'GRIEF' && i.distressLevel === 'ELEVATED',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['honour the loss by name', 'sit with the weight before offering anything', 'offer ONE gentle grief-sensitive technique from the knowledge graph', 'name the GP/POH-GGZ as a door when it gets too heavy'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P64', family: 'F13',
    description: 'Anxiety under elevated load: body-first CBT dialogue with one grounded tool and a care door.',
    desc: { nl: 'Angst onder zware spanning: lichaam-eerst CBT-dialoog met één geaarde tool en een zorgdeur.', en: 'Anxiety under elevated load: body-first CBT dialogue with one grounded tool and a care door.' },
    guard: (i) => i.intent === 'ANXIETY_REPORT' && i.distressLevel === 'ELEVATED',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the anxiety and where the body holds it', 'offer ONE grounded body-first technique from the knowledge graph', 'name the GP/POH-GGZ as a door when the load stays high', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P34', family: 'F13',
    description: 'Medium confidence on known territory: dialogue with an extra check-in before depth.',
    desc: { nl: 'Middelmatige zekerheid op bekend terrein: dialoog met extra check-in vóór de diepte.', en: 'Medium confidence on known territory: dialogue with an extra check-in before depth.' },
    guard: (i) => i.confidenceBand === 'MEDIUM' && i.novelty === 'KNOWN' && noDeep(i),
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the emotion by name', 'reflect the situation briefly', 'ask a short check-in before offering anything', 'offer ONE grounded technique only if the check-in lands'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['one short check-in question'], maxSentences: 7 },
  },
  {
    id: 'P35', family: 'F13',
    description: 'Panic intent at manageable distress: panic-informed dialogue with one grounding tool.',
    desc: { nl: 'Paniek-thema bij hanteerbare spanning: paniekkundige dialoog met één grondingstool.', en: 'Panic intent at manageable distress: panic-informed dialogue with one grounding tool.' },
    guard: (i) => i.intent === 'PANIC_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'calm', allowedMoves: ['acknowledge the physical panic response', 'offer ONE grounded breathing/grounding technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P36', family: 'F13',
    description: 'Sleep issue: CBT-I-informed dialogue grounded in the knowledge graph.',
    desc: { nl: 'Slaapthema: CBT-I-kundige dialoog, geaard in de kennisgraph.', en: 'Sleep issue: CBT-I-informed dialogue grounded in the knowledge graph.' },
    guard: (i) => i.intent === 'SLEEP_ISSUE',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate how exhausting bad nights are', 'offer ONE grounded sleep technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P37', family: 'F13',
    description: 'Loneliness intent: connection-focused dialogue with the support map.',
    desc: { nl: 'Eenzaamheid: verbindingsgerichte dialoog met de sociale kaart.', en: 'Loneliness intent: connection-focused dialogue with the support map.' },
    guard: (i) => i.intent === 'LONELINESS_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['validate the loneliness', 'offer the support map technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P38', family: 'F13',
    description: 'Injured self-worth: compassion-focused dialogue (CFT).',
    desc: { nl: 'Gekrenkt zelfbeeld: compassiegerichte dialoog (CFT).', en: 'Injured self-worth: compassion-focused dialogue (CFT).' },
    guard: (i) => i.intent === 'SELF_WORTH_INJURY',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the harsh inner critic', 'offer ONE grounded self-compassion technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P39', family: 'F13',
    description: 'Grief intent: grief-informed dialogue (IPT grief focus, continuing bonds).',
    desc: { nl: 'Rouw-thema: rouwkundige dialoog (IPT-rouwfocus, voortgezette banden).', en: 'Grief intent: grief-informed dialogue (IPT grief focus, continuing bonds).' },
    guard: (i) => i.intent === 'GRIEF',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['honour the loss by name', 'offer ONE grounded grief-sensitive technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P40', family: 'F13',
    description: 'Anxiety intent: CBT-informed dialogue with one grounded tool.',
    desc: { nl: 'Angst-thema: CBT-kundige dialoog met één geaarde tool.', en: 'Anxiety intent: CBT-informed dialogue with one grounded tool.' },
    guard: (i) => i.intent === 'ANXIETY_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the anxiety by name', 'reflect the situation', 'offer ONE grounded technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P41', family: 'F13',
    description: 'Heavy depressive story: behavioural-activation dialogue that names professional care as an option.',
    desc: { nl: 'Zwaar somber verhaal: gedragsactivatie-dialoog die professionele hulp benoemt als optie.', en: 'Heavy depressive story: behavioural-activation dialogue that names professional care as an option.' },
    guard: (i) => i.distressLevel === 'ELEVATED' && i.intent === 'DEPRESSIVE_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the emotion by name', 'reflect how heavy the load is', 'offer ONE grounded technique from the knowledge graph', 'mention professional care as a strength, then end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['one explicit check-in question'], maxSentences: 8 },
  },
  {
    id: 'P42', family: 'F13',
    description: 'Depressive report: behavioural-activation-leaning dialogue, small steps only.',
    desc: { nl: 'Somberheid: dialoog met kleine stappen (gedragsactivatie), nooit grote sprongen.', en: 'Depressive report: dialogue leaning on small behavioural-activation steps, never big leaps.' },
    guard: (i) => i.intent === 'DEPRESSIVE_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the heaviness', 'reflect the situation', 'offer ONE small grounded technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P43', family: 'F13',
    description: 'Work stress: values-and-boundaries dialogue (ACT, problem-solving).',
    desc: { nl: 'Werkstress: waarden- en grenzendialoog (ACT, probleemoplossing).', en: 'Work stress: values-and-boundaries dialogue (ACT, problem-solving).' },
    guard: (i) => i.intent === 'WORK_STRESS',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the pressure', 'offer ONE grounded boundaries/values technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P44', family: 'F13',
    description: 'Relationship issue: interpersonal-effectiveness dialogue (IPT, DBT DEAR).',
    desc: { nl: 'Relatieprobleem: interpersoonlijk-effectiviteitsdialoog (IPT, DBT DEAR).', en: 'Relationship issue: interpersonal-effectiveness dialogue (IPT, DBT DEAR).' },
    guard: (i) => i.intent === 'RELATIONSHIP_ISSUE',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the relational strain', 'reflect both sides kindly', 'offer ONE grounded technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P45', family: 'F13',
    description: 'Bullying report: safety-check dialogue with support map and assertiveness.',
    desc: { nl: 'Pestverhaal: dialoog met veiligheidscheck, sociale kaart en assertiviteit.', en: 'Bullying report: dialogue with a safety check, support map and assertiveness.' },
    guard: (i) => i.intent === 'BULLYING_REPORT',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['believe and validate the hurt', 'ask one gentle safety check', 'offer the support map or assertiveness technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },
  {
    id: 'P46', family: 'F13',
    description: 'Identity/sexuality distress: affirming dialogue (minority-stress informed), never pathologising.',
    desc: { nl: 'Identiteits-/seksualiteitsnood: bevestigende dialoog (minority-stress), nooit pathologiseren.', en: 'Identity/sexuality distress: affirming dialogue (minority-stress informed), never pathologising.' },
    guard: (i) => i.intent === 'IDENTITY_DISTRESS',
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'warm', allowedMoves: ['affirm their identity unconditionally', 'acknowledge the extra weight minority stress brings', 'offer ONE grounded self-compassion/support technique from the knowledge graph', 'end with an open question'], forbiddenMoves: [...DIALOG_FORBIDDEN, 'no pathologising identity', 'no conversion-adjacent framing'], mustInclude: ['one unconditional affirmation'], maxSentences: 8 },
  },
  {
    id: 'P47', family: 'F13',
    description: 'Known territory, usable confidence: full therapeutic dialogue.',
    desc: { nl: 'Bekend terrein met bruikbare zekerheid: volledige therapeutische dialoog.', en: 'Known territory with usable confidence: full therapeutic dialogue.' },
    guard: (i) => i.intent !== 'META_QUESTION', // meta handled by F15 below; totality kept via P48
    action: 'THERAPEUTIC_DIALOG',
    plan: { tone: 'validating', allowedMoves: ['validate the emotion by name', 'reflect the situation', 'offer ONE grounded technique from the knowledge graph', 'end with an open question'], forbiddenMoves: DIALOG_FORBIDDEN, mustInclude: ['validation before any technique'], maxSentences: 8 },
  },

  // ── F15 · meta & transparantie ───────────────────────────────────────────
  {
    id: 'P48', family: 'F15',
    description: 'Meta questions at medium confidence: short honest self-explanation with a limitation.',
    desc: { nl: 'Systeemvraag met middelmatige zekerheid: korte, eerlijke uitleg met een beperking.', en: 'Meta question at medium confidence: short honest self-explanation with a limitation.' },
    guard: (i) => i.intent === 'META_QUESTION' && i.confidenceBand === 'MEDIUM',
    action: 'PSYCHOEDUCATION',
    plan: { tone: 'warm', allowedMoves: ['answer the process question briefly and honestly', 'state what EAInesy is not', 'invite the personal story afterwards'], forbiddenMoves: [NO_DIAGNOSIS, 'no guarantees of outcome', 'no claiming clinical credentials'], mustInclude: ['one honest limitation statement'], maxSentences: 5 },
  },
  {
    id: 'P49', family: 'F15',
    description: 'Meta questions: honest, grounded self-explanation of the verified pipeline.',
    desc: { nl: 'Systeemvraag: eerlijke, geaarde uitleg van de geverifieerde pipeline.', en: 'Meta question: honest, grounded self-explanation of the verified pipeline.' },
    guard: (i) => i.intent === 'META_QUESTION',
    action: 'PSYCHOEDUCATION',
    plan: { tone: 'warm', allowedMoves: ['answer the process question honestly', 'explain what EAInesy is and is not', 'ground any claim in the knowledge graph', 'invite the personal story afterwards'], forbiddenMoves: [NO_DIAGNOSIS, 'no guarantees of outcome', 'no claiming clinical credentials'], mustInclude: ['one honest limitation statement'], maxSentences: 6 },
  },

  // ── F16 · vangnet ────────────────────────────────────────────────────────
  {
    id: 'P50', family: 'F16',
    description: 'Unreachable fallback — fail closed to clarify.',
    desc: { nl: 'Onbereikbare vangnet-regel — sluit veilig af met een vraag.', en: 'Unreachable safety-net rule — fails closed to a clarifying question.' },
    guard: () => false,
    action: 'CLARIFY',
    plan: { tone: 'warm', allowedMoves: ['say something was unclear', 'invite the user to say more in their own words'], forbiddenMoves: [NO_DIAGNOSIS, 'no technique suggestions'], mustInclude: ['one concrete clarifying invitation'], maxSentences: 4 },
  },
];

export interface Decision {
  action: Action;
  ruleId: string;
  ruleDescription: string;
  ruleDescBilingual: { nl: string; en: string };
  planTemplate: DecisionRule['plan'];
  hitl: boolean;
}

/**
 * The canonical crisis plan template (P04 — "nothing outranks the crisis
 * protocol"). Used when the Z3 fail-closed override replaces an action:
 * the override must produce a COHERENT crisis plan (tone, moves, mustInclude,
 * sentence bound), not a hybrid of the overridden rule's template with a
 * crisis action. Single production source — no parallel template.
 */
export function crisisOverridePlanTemplate(): DecisionRule['plan'] {
  const rule = DECISION_RULES.find((r) => r.id === 'P04') ?? DECISION_RULES.find((r) => r.action === 'CRISIS_PROTOCOL');
  return rule!.plan;
}

/**
 * First-match decision. Total by construction: P47 (catch-all) covers every
 * non-META intent and P48/P49 cover META; P50 exists as a documented
 * fail-closed backstop. Deterministic: pure guards over a pure input.
 */
export function decide(input: ControllerInput): Decision {
  for (const rule of DECISION_RULES) {
    if (rule.guard(input)) {
      return {
        action: rule.action,
        ruleId: rule.id,
        ruleDescription: rule.description,
        ruleDescBilingual: rule.desc,
        planTemplate: rule.plan,
        hitl: rule.hitl === true,
      };
    }
  }
  // Unreachable: P47's guard covers every non-META intent and P48/P49 cover META. Kept fail-closed anyway.
  return {
    action: 'CLARIFY',
    ruleId: 'P0-fallback',
    ruleDescription: 'Unreachable fallback — fail closed to clarify.',
    ruleDescBilingual: { nl: 'Onbereikbaar vangnet — sluit veilig af met een vraag.', en: 'Unreachable net — fails closed to a question.' },
    planTemplate: DECISION_RULES[DECISION_RULES.length - 1].plan,
    hitl: false,
  };
}
