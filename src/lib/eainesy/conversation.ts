/**
 * EAInesy conversation layer — the "orchestra" on top of the per-message
 * safety core.
 *
 * Triage order (EAI Core 0.5.4 triage_protocol, applied to support talk):
 *   0. minimum context        → frame valid? (else risk UNKNOWN, see orchestrator)
 *   1. acute interrupt        → the per-message controller (controller.ts) decides
 *                               safety FIRST; this layer can never undo that
 *   2. phase                  → where is this conversation? (OPENING … CLOSE)
 *   3–5. target & regulation  → readiness, change talk, who leads
 *   6. phase route            → which support strategy fits this phase
 *   7. non-compensating gates → risk memory, rupture, stabilisation
 *   8. profile + trace        → the decision is recorded in the certificate
 *
 * Grounding (see core/eainesy_support_core.json for source → claim → rule):
 *  - phases: Hill's helping-skills model (exploration → insight/comforting →
 *    action) as operationalised for text support in ESConv (Liu et al. 2021);
 *    stage order and "understand first, then problem-solve" from 80k crisis-
 *    line conversations (Althoff, Clark & Leskovec 2016); MI's processes
 *    (engaging → focusing → evoking → planning; Miller & Rollnick 2013).
 *  - strategies: the ESConv per-turn strategy set, minus self-disclosure
 *    (an assistant has no life story — honesty), plus REPAIR.
 *  - risk memory: a crisis signal does not vanish on the next message
 *    (C-SSRS: recency of ideation matters; Joiner 2005).
 *  - rupture: Safran & Muran (2000) — repair before technique.
 *  - change talk as readiness signal: MI (DARN-CAT).
 *
 * Design rule: this layer may only RESTRICT. It never turns a safety answer
 * into anything else, never makes an answer "deeper" than the per-message
 * core allowed, and the model checker proves both over its whole lattice.
 *
 * PURE: no I/O, no clock, no randomness. Same input ⇒ same decision.
 */
import {
  type Action,
  type ConfidenceBand,
  type ConversationPhase,
  type Frame,
  type Plan,
  type RiskAssessment,
  type RiskMemory,
  type RuptureState,
  type SupportStrategy,
  CONVERSATION_PHASES,
  RISK_MEMORY_STATES,
  RUPTURE_STATES,
} from './types';

// ---------------------------------------------------------------------------
// State carried between turns (persisted in each turn's certificate).
// ---------------------------------------------------------------------------
export interface ConversationState {
  phase: ConversationPhase;
  riskMemory: RiskMemory;
  rupture: RuptureState;
  resourcesGiven: boolean;
  /** Turns spent in the current phase (drives the readiness fallback). */
  turnsInPhase: number;
  /** Consecutive turns without a risk signal since the last one (memory decay). */
  calmTurns: number;
  /** Highest ordinal risk seen in this conversation (memory floor). */
  peakRisk: 'NONE' | 'ELEVATED' | 'HIGH' | 'CRISIS';
  /** KG topic/emotion keys seen so far (topic-shift detection, focus). */
  themes: string[];
  /** Agreed focus once the conversation reached FOCUS (prompt context). */
  focus: string[];
  /** Total turns so far. */
  turn: number;
}

export const INITIAL_CONVERSATION_STATE: ConversationState = {
  phase: 'OPENING',
  riskMemory: 'NONE',
  rupture: 'NONE',
  resourcesGiven: false,
  turnsInPhase: 0,
  calmTurns: 0,
  peakRisk: 'NONE',
  themes: [],
  focus: [],
  turn: 0,
};

/** Memory decay (turns without risk signal). */
export const MEMORY_POLICY = {
  /** ACTIVE → RECENT after this many calm turns. */
  activeCalmTurns: 2,
  /** RECENT → NONE after this many further calm turns (unless the floor applies). */
  recentCalmTurns: 4,
} as const;

/** Readiness fallback: after this many turns in EXPLORE the focus step is offered. */
export const EXPLORE_TURNS_BEFORE_FOCUS = 2;
/** FOCUS → ACT needs change talk or a help request; time alone moves only after this many turns. */
export const FOCUS_TURNS_BEFORE_ACT = 3;

// ---------------------------------------------------------------------------
// Per-turn signals (deterministic; lexical + frame)
// ---------------------------------------------------------------------------
export interface TurnSignals {
  /** MI change talk: desire, ability, reasons, need, commitment. */
  changeTalk: boolean;
  /** Explicit request for suggestions / what to do. */
  asksForHelp: boolean;
  /** The person is wrapping up (thanks, will try, goodbye). */
  closure: boolean;
  /** Frustration with the assistant itself (rupture marker, 3RS confrontation). */
  rupture: boolean;
  /** New TOPICS disjoint from every topic discussed so far (emotions shift naturally; topics mark a new theme). */
  topicShift: boolean;
}

const CHANGE_TALK = /\b(ik wil (graag |echt |wel )?(iets )?(veranderen|anders|beter (worden|slapen|voelen)|ermee aan de slag|het (aan|op)pakken|stoppen met)|ik zou (graag )?willen (dat|leren|kunnen)|ik moet (echt )?iets (veranderen|doen)|ik ga (het )?(proberen|doen|oefenen)|ik kan (dat|het) (wel|best)|ik heb (er )?zin (in|om)|i (really )?want to (change|feel better|sleep better|do something|stop)|i('d| would) like to (change|learn|be able)|i need to (change|do something)|i('ll| will) (try|do it|give it a (try|go))|i can do (that|it))\b/i;
const ASKS_FOR_HELP = /\b(wat (kan|moet|zou) ik (dan |nu |daaraan |eraan )?(doen|proberen)|heb je (tips|een tip|ideeën|advies)|hoe (kan|moet) ik|wat raad je|help me|kun je me helpen|wat helpt|what (can|should) i do|any (tips|ideas|advice)|how (can|do|should) i|what helps|can you help me|help me)\b/i;
const CLOSURE = /\b(dank( je| u)?( wel)?|bedankt|thanks|thank you|ik ga (het |dat )?(proberen|doen)|i('ll| will) (try|give it a try)|tot (de )?volgende( keer)?|tot morgen|doei|dag!|bye|goodbye|fijn gesprek|dit hielp|this helped|ik laat het (hierbij|even rusten))\b/i;
const RUPTURE = /\b(je (luistert|begrijpt) (me )?niet|je snapt het niet|dit (helpt|werkt) (echt )?niet|dit slaat nergens op|je bent (maar )?een (robot|computer|bot)|wat heb ik hier(aan)?|zinloos (gesprek|ding)|you (don'?t|do not) (understand|listen|get it)|this (is useless|doesn'?t help|isn'?t helping)|you'?re (just )?a (bot|robot|machine)|waste of time)\b/i;

export function detectSignals(text: string, frame: Frame | null, state: ConversationState, themesNow: string[]): TurnSignals {
  const t = text.toLowerCase();
  const isTopic = (k: string) => k.startsWith('topic:');
  const prior = new Set(state.themes.filter(isTopic));
  const topicsNow = themesNow.filter(isTopic);
  const topicShift = state.turn > 0 && prior.size > 0 && topicsNow.length > 0 && topicsNow.every((k) => !prior.has(k));
  return {
    changeTalk: CHANGE_TALK.test(t) || frame?.changeTalk === true,
    asksForHelp: ASKS_FOR_HELP.test(t) || frame?.asksForHelp === true,
    closure: CLOSURE.test(t),
    rupture: RUPTURE.test(t) || frame?.intent === 'ALLIANCE_RUPTURE',
    topicShift,
  };
}

// ---------------------------------------------------------------------------
// The conversation controller's FINITE input (model-checked)
// ---------------------------------------------------------------------------
export interface ConversationInput {
  /** Action the per-message core decided (after the Z3 fail-closed step). */
  baseAction: Action;
  /** Base rule is a stabilisation rule (grounding may come before exploration). */
  stabilise: boolean;
  risk: RiskAssessment;
  confidence: ConfidenceBand;
  phase: ConversationPhase;
  riskMemory: RiskMemory;
  rupture: RuptureState;
  resourcesGiven: boolean;
  /** Phase-specific readiness to move on (see readinessFor). */
  ready: boolean;
  /** First turn in the current phase (drives strategy variety; no repetition loops). */
  fresh: boolean;
  closure: boolean;
  topicShift: boolean;
}

/** Base rules whose technique is stabilisation (panic, trauma): regulation before exploration. */
export const STABILISE_RULES = ['P33', 'P35', 'P62'] as const;

export const DEEP_ACTIONS: Action[] = ['THERAPEUTIC_DIALOG', 'PSYCHOEDUCATION'];
export const SAFE_ACTIONS: Action[] = ['CRISIS_PROTOCOL', 'SAFETY_RESPONSE'];

export function readinessFor(phase: ConversationPhase, state: ConversationState, s: TurnSignals): boolean {
  switch (phase) {
    case 'OPENING': return true; // one opening turn, then exploring
    case 'EXPLORE': return s.asksForHelp || s.changeTalk || state.turnsInPhase >= EXPLORE_TURNS_BEFORE_FOCUS;
    case 'FOCUS': return s.asksForHelp || s.changeTalk || state.turnsInPhase >= FOCUS_TURNS_BEFORE_ACT;
    case 'ACT': return s.changeTalk; // commitment: reinforce and make it concrete
    case 'CLOSE': return false;
  }
}

// ---------------------------------------------------------------------------
// Strategy guide — what each strategy means for the generator (ESConv defs).
// ---------------------------------------------------------------------------
export interface StrategyGuide {
  label: { nl: string; en: string };
  /** One-line instruction for the generator. */
  instruction: { nl: string; en: string };
  allowedMoves: string[];
  forbiddenMoves: string[];
  mustInclude: string[];
}

const NO_TECHNIQUE_YET = 'no techniques, tips or advice yet — first understand (explore phase)';

export const STRATEGY_GUIDE: Record<SupportStrategy, StrategyGuide> = {
  QUESTION: {
    label: { nl: 'Open vraag', en: 'Open question' },
    instruction: { nl: 'Stel één open vraag die de persoon uitnodigt meer te vertellen; geef eerst kort terug wat je hoort.', en: 'Ask one open question that invites the person to tell more; first briefly reflect what you hear.' },
    allowedMoves: ['briefly reflect what was heard', 'ask ONE open question about what is going on'],
    forbiddenMoves: [NO_TECHNIQUE_YET, 'no closed yes/no interrogation'],
    mustInclude: ['one open question'],
  },
  RESTATEMENT: {
    label: { nl: 'Herformuleren', en: 'Restatement' },
    instruction: { nl: 'Vat in eigen woorden samen wat de persoon zei, zodat die kan zeggen of je het goed begrijpt.', en: 'Restate in your own words what the person said, so they can tell whether you understood.' },
    allowedMoves: ['restate the situation in own words', 'check whether the restatement fits'],
    forbiddenMoves: [NO_TECHNIQUE_YET, 'no interpretation beyond what was said'],
    mustInclude: ['one restatement in own words', 'one check whether it fits'],
  },
  REFLECTION: {
    label: { nl: 'Gevoel reflecteren', en: 'Reflection of feelings' },
    instruction: { nl: 'Benoem het gevoel dat je hoort, voorzichtig ("het klinkt alsof…"), en nodig uit om verder te vertellen.', en: 'Name the feeling you hear, tentatively ("it sounds like…"), and invite them to say more.' },
    allowedMoves: ['name the feeling tentatively', 'invite them to say more'],
    forbiddenMoves: [NO_TECHNIQUE_YET, 'no feeling stated as fact ("you are depressed")'],
    mustInclude: ['one tentative reflection of feeling'],
  },
  AFFIRMATION: {
    label: { nl: 'Bevestigen', en: 'Affirmation' },
    instruction: { nl: 'Erken concreet wat de persoon deed of probeerde; versterk wat werkt, zonder te overdrijven.', en: 'Concretely acknowledge what the person did or tried; reinforce what works, without overdoing it.' },
    allowedMoves: ['acknowledge a concrete effort or strength', 'reinforce what worked'],
    forbiddenMoves: ['no empty praise', 'no new technique push'],
    mustInclude: ['one concrete affirmation'],
  },
  SUMMARY: {
    label: { nl: 'Samenvatten en focus kiezen', en: 'Summary and focus' },
    instruction: { nl: 'Vat kort samen wat er tot nu toe gedeeld is en vraag wat nu het belangrijkste is om samen naar te kijken.', en: 'Briefly summarise what has been shared so far and ask what matters most to look at together now.' },
    allowedMoves: ['summarise the main threads briefly', 'ask which thread matters most now'],
    forbiddenMoves: [NO_TECHNIQUE_YET.replace('explore phase', 'focus phase'), 'no deciding the focus for them'],
    mustInclude: ['one short summary', 'one question about what matters most'],
  },
  SUGGESTION: {
    label: { nl: 'Eén suggestie', en: 'One suggestion' },
    instruction: { nl: 'Bied één kleine, geaarde techniek uit de kennisgraph aan als uitnodiging, niet als opdracht, en vraag hoe die landt.', en: 'Offer ONE small grounded technique from the knowledge graph as an invitation, not an order, and ask how it lands.' },
    allowedMoves: ['offer ONE grounded technique from the knowledge graph as an invitation', 'ask how it lands'],
    forbiddenMoves: ['no more than one technique', 'no orders ("you must")'],
    mustInclude: ['one question how the suggestion lands'],
  },
  INFORMATION: {
    label: { nl: 'Informatie', en: 'Information' },
    instruction: { nl: 'Geef korte, geaarde informatie en zeg eerlijk wat je niet weet.', en: 'Give short grounded information and say honestly what you do not know.' },
    allowedMoves: ['give short grounded information', 'state one honest limitation'],
    forbiddenMoves: ['no information outside the knowledge graph'],
    mustInclude: ['one honest limitation statement'],
  },
  REPAIR: {
    label: { nl: 'Herstel van de werkrelatie', en: 'Alliance repair' },
    instruction: { nl: 'Erken de frustratie zonder je te verdedigen, neem je deel van de misser, en vraag wat nu zou helpen.', en: 'Acknowledge the frustration without defending, own your part of the miss, and ask what would help now.' },
    allowedMoves: ['acknowledge the frustration', 'own the miss without over-apologising', 'ask what would help now'],
    forbiddenMoves: ['no defensiveness', 'no techniques during repair'],
    mustInclude: ['one validation of the frustration'],
  },
  SAFETY: {
    label: { nl: 'Veiligheid', en: 'Safety' },
    instruction: { nl: 'Veiligheid gaat voor: volg het veiligheidsplan van deze beurt.', en: 'Safety comes first: follow this turn’s safety plan.' },
    allowedMoves: [],
    forbiddenMoves: [],
    mustInclude: [],
  },
  BOUNDARY: {
    label: { nl: 'Grens', en: 'Boundary' },
    instruction: { nl: 'Trek vriendelijk de grens en keer terug naar de persoon.', en: 'Draw the boundary kindly and return to the person.' },
    allowedMoves: [], forbiddenMoves: [], mustInclude: [],
  },
  REFERRAL: {
    label: { nl: 'Verwijzing', en: 'Referral' },
    instruction: { nl: 'Wijs warm de weg naar passende zorg en blijf luisteren.', en: 'Point warmly to fitting care and keep listening.' },
    allowedMoves: [], forbiddenMoves: [], mustInclude: [],
  },
  CLARIFY: {
    label: { nl: 'Verduidelijken', en: 'Clarify' },
    instruction: { nl: 'Vraag eerst wat er speelt; niet invullen.', en: 'Ask what is going on first; do not fill in.' },
    allowedMoves: [], forbiddenMoves: [], mustInclude: [],
  },
};

/** Phase goals, shown to the generator and in the UI. */
export const PHASE_GOAL: Record<ConversationPhase, { nl: string; en: string }> = {
  OPENING: { nl: 'Contact maken: welkom heten en uitnodigen om te vertellen.', en: 'Engaging: welcome and invite the story.' },
  EXPLORE: { nl: 'Verkennen: begrijpen wat er speelt en hoe het voelt — nog geen oplossingen.', en: 'Exploring: understand what is going on and how it feels — no solutions yet.' },
  FOCUS: { nl: 'Focus kiezen: samen bepalen wat nu het belangrijkste is.', en: 'Focusing: decide together what matters most now.' },
  ACT: { nl: 'Actie: één kleine, haalbare stap verkennen die de persoon zelf kiest.', en: 'Acting: explore one small feasible step the person chooses.' },
  CLOSE: { nl: 'Afronden: samenvatten, versterken wat helpt, de deur openhouden.', en: 'Closing: summarise, reinforce what helps, keep the door open.' },
};

const CHECK_IN_MUST = 'one brief, warm check-in on how they are doing compared to earlier in this conversation';
/** Merged into referral/boundary answers while a rupture is open (repair without dropping the referral). */
export const RUPTURE_ACK_MUST = 'one validation of the frustration with this conversation';
const RESOURCE_MUST = '113 Zelfmoordpreventie: bel 113 of 0800-0113';

// ---------------------------------------------------------------------------
// Conversation rules (ordered; first match wins)
// ---------------------------------------------------------------------------
export interface ConversationDecision {
  ruleId: string;
  action: Action;
  strategy: SupportStrategy;
  nextPhase: ConversationPhase;
  /** Replace the base plan entirely (only the risk-memory check-in does this). */
  replacePlan?: Pick<Plan, 'tone' | 'allowedMoves' | 'forbiddenMoves' | 'mustInclude' | 'maxSentences'>;
  /** Strip technique-offering moves from the base plan (not yet the phase for it). */
  stripTechniques: boolean;
  addMustInclude: string[];
  /** This turn answers an open rupture (REPAIR strategy, or a frustration acknowledgment merged in). */
  repairs: boolean;
}

export interface ConversationRule {
  id: string;
  desc: { nl: string; en: string };
  guard: (c: ConversationInput) => boolean;
  decide: (c: ConversationInput) => Omit<ConversationDecision, 'ruleId' | 'addMustInclude' | 'repairs'> & { addMustInclude?: string[] };
}

const forward = (p: ConversationPhase): ConversationPhase =>
  p === 'OPENING' ? 'EXPLORE' : p === 'EXPLORE' ? 'FOCUS' : p === 'FOCUS' ? 'ACT' : p === 'ACT' ? 'ACT' : 'CLOSE';

/** The phase after a non-dialogue turn: an opening turn always opens exploration; otherwise stay. */
const holdPhase = (p: ConversationPhase): ConversationPhase => (p === 'OPENING' ? 'EXPLORE' : p);

export const CONVERSATION_RULES: ConversationRule[] = [
  {
    id: 'C01',
    desc: { nl: 'De veiligheidskern besliste crisis of veiligheid: dat blijft zo, en het gesprek gaat daarna terug naar verkennen.', en: 'The safety core decided crisis or safety: that stands, and the conversation then returns to exploring.' },
    guard: (c) => SAFE_ACTIONS.includes(c.baseAction),
    decide: (c) => ({ action: c.baseAction, strategy: 'SAFETY', nextPhase: 'EXPLORE', stripTechniques: false }),
  },
  {
    id: 'C02',
    desc: { nl: 'Kort na een risicosignaal in dit gesprek: geen diepe dialoog of uitleg, maar een warme check-in met de hulplijn binnen bereik.', en: 'Shortly after a risk signal in this conversation: no deep dialogue or teaching, but a warm check-in with the help line in reach.' },
    guard: (c) => c.riskMemory === 'ACTIVE' && DEEP_ACTIONS.includes(c.baseAction),
    decide: () => ({
      action: 'SAFETY_RESPONSE',
      strategy: 'SAFETY',
      nextPhase: 'EXPLORE',
      stripTechniques: true,
      replacePlan: {
        tone: 'warm',
        allowedMoves: ['respond warmly to what they say now', 'refer gently to what was shared earlier', 'ask how they are doing right now compared to earlier', 'say that 113 stays available'],
        forbiddenMoves: ['no technique experiments shortly after a risk signal', 'no psycho-education', 'No diagnosis, no medication advice, no clinical labels', 'No minimizing language ("it could be worse", "just think positive")'],
        mustInclude: [CHECK_IN_MUST, RESOURCE_MUST],
        maxSentences: 5,
      },
    }),
  },
  {
    id: 'C03',
    desc: { nl: 'Grens, verwijzing of verduidelijking uit de kern: dat blijft; een openingsbeurt opent wel het verkennen. Bij een open breuk komt er een erkenning van de frustratie bij.', en: 'Boundary, referral or clarification from the core: it stands; an opening turn does open exploration. With an open rupture, an acknowledgment of the frustration is added.' },
    guard: (c) => c.baseAction === 'BOUNDARY_REFUSAL' || c.baseAction === 'REFERRAL' || ((c.baseAction === 'CLARIFY' || c.baseAction === 'ABSTAIN_HITL') && c.rupture === 'NONE'),
    decide: (c) => ({
      action: c.baseAction,
      strategy: c.baseAction === 'BOUNDARY_REFUSAL' ? 'BOUNDARY' : c.baseAction === 'REFERRAL' ? 'REFERRAL' : 'CLARIFY',
      nextPhase: holdPhase(c.phase),
      stripTechniques: false,
      addMustInclude: c.rupture === 'ACTIVE' ? [RUPTURE_ACK_MUST] : [],
    }),
  },
  {
    id: 'C04',
    desc: { nl: 'Breuk in de werkrelatie (frustratie met de bot): eerst herstel, geen techniek — daarna weer verkennen (Safran & Muran).', en: 'Rupture in the working relationship (frustration with the bot): repair first, no technique — then explore again (Safran & Muran).' },
    guard: (c) => c.rupture === 'ACTIVE',
    decide: (c) => ({ action: c.baseAction, strategy: 'REPAIR', nextPhase: 'EXPLORE', stripTechniques: true }),
  },
  {
    id: 'C05',
    desc: { nl: 'Uitleg (systeem- of hulpzoekvraag): informatie geven, de gespreksfase blijft staan.', en: 'Explanation (system or help-seeking question): give information, the conversation phase stays.' },
    guard: (c) => c.baseAction === 'PSYCHOEDUCATION',
    decide: (c) => ({ action: 'PSYCHOEDUCATION', strategy: 'INFORMATION', nextPhase: holdPhase(c.phase), stripTechniques: false }),
  },
  // ── THERAPEUTIC_DIALOG from here on ─────────────────────────────────────
  {
    id: 'C06',
    desc: { nl: 'De persoon rondt af (bedankt, gaat het proberen): bevestigen wat hielp en afronden — de deur blijft open.', en: 'The person is wrapping up (thanks, will try): affirm what helped and close — the door stays open.' },
    guard: (c) => c.closure && (c.phase === 'FOCUS' || c.phase === 'ACT' || c.phase === 'CLOSE'),
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'AFFIRMATION', nextPhase: 'CLOSE', stripTechniques: true }),
  },
  {
    id: 'C07',
    desc: { nl: 'Er komt een heel nieuw thema op na de verkenning: terug naar verkennen in plaats van doorhollen.', en: 'A whole new theme comes up after exploration: back to exploring instead of rushing on.' },
    guard: (c) => c.topicShift && (c.phase === 'FOCUS' || c.phase === 'ACT' || c.phase === 'CLOSE'),
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'REFLECTION', nextPhase: 'EXPLORE', stripTechniques: true }),
  },
  {
    id: 'C08',
    desc: { nl: 'Paniek of trauma (stabilisatie): één gronding mag vóór het verkennen — regulatie eerst.', en: 'Panic or trauma (stabilisation): one grounding step may come before exploring — regulation first.' },
    guard: (c) => c.stabilise && c.riskMemory !== 'ACTIVE',
    decide: (c) => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'SUGGESTION', nextPhase: c.phase === 'OPENING' ? 'EXPLORE' : c.phase, stripTechniques: false }),
  },
  {
    id: 'C09',
    desc: { nl: 'Opening: contact maken met een open vraag — nog geen tips.', en: 'Opening: make contact with an open question — no tips yet.' },
    guard: (c) => c.phase === 'OPENING',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'QUESTION', nextPhase: 'EXPLORE', stripTechniques: true }),
  },
  {
    id: 'C10',
    desc: { nl: 'Verkennen, en er is genoeg begrip of de persoon vraagt wat te doen: samenvatten en samen een focus kiezen (vóór er tips komen).', en: 'Exploring, and there is enough understanding or the person asks what to do: summarise and choose a focus together (before any tips).' },
    guard: (c) => c.phase === 'EXPLORE' && c.ready,
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'SUMMARY', nextPhase: 'FOCUS', stripTechniques: true }),
  },
  {
    id: 'C11',
    desc: { nl: 'Verkennen: gevoel reflecteren, bij twijfel eerst herformuleren, en afwisselen met een open vervolgvraag — nog geen tips.', en: 'Exploring: reflect feelings, restate first when unsure, and alternate with an open follow-up question — no tips yet.' },
    guard: (c) => c.phase === 'EXPLORE',
    decide: (c) => ({ action: 'THERAPEUTIC_DIALOG', strategy: c.confidence === 'MEDIUM' ? 'RESTATEMENT' : c.fresh ? 'REFLECTION' : 'QUESTION', nextPhase: 'EXPLORE', stripTechniques: true }),
  },
  {
    id: 'C16',
    desc: { nl: 'Focus staat, de persoon is er klaar voor (verandertaal of hulpvraag), geen actief risicosignaal en hoge zekerheid: nu één suggestie — het gesprek gaat naar actie (na een eerder risico mét check-in).', en: 'Focus is set, the person is ready (change talk or request for help), no active risk signal and high confidence: now one suggestion — the conversation moves to action (after an earlier risk, with a check-in).' },
    guard: (c) => c.phase === 'FOCUS' && c.ready && c.riskMemory !== 'ACTIVE' && c.confidence === 'HIGH',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'SUGGESTION', nextPhase: 'ACT', stripTechniques: false }),
  },
  {
    id: 'C17',
    desc: { nl: 'Focus: eerst samenvatten en samen kiezen wat het belangrijkst is, daarna bij die focus blijven met reflectie; door naar actie pas als de persoon er klaar voor is en er geen actief risicosignaal is.', en: 'Focus: first summarise and choose together what matters most, then stay with that focus through reflection; on to action only when the person is ready and no risk signal is active.' },
    guard: (c) => c.phase === 'FOCUS',
    decide: (c) => ({ action: 'THERAPEUTIC_DIALOG', strategy: c.fresh ? 'SUMMARY' : 'REFLECTION', nextPhase: c.ready && c.riskMemory !== 'ACTIVE' ? 'ACT' : 'FOCUS', stripTechniques: true }),
  },
  {
    id: 'C18',
    desc: { nl: 'Actie, en de persoon legt zich vast ("dat ga ik proberen"): bevestigen en concreet maken — geen tweede techniek erbovenop.', en: 'Action, and the person commits ("I will try that"): affirm and make it concrete — no second technique on top.' },
    guard: (c) => c.phase === 'ACT' && c.ready,
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'AFFIRMATION', nextPhase: 'ACT', stripTechniques: true }),
  },
  {
    id: 'C12',
    desc: { nl: 'Na een eerder risicosignaal: in de actiefase geen tweede techniek op eigen initiatief — eerst vragen hoe het gaat en wat welkom is.', en: 'After an earlier risk signal: in the action phase no second technique on own initiative — first ask how it is going and what is welcome.' },
    guard: (c) => c.phase === 'ACT' && c.riskMemory === 'RECENT',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'QUESTION', nextPhase: 'ACT', stripTechniques: true, addMustInclude: [CHECK_IN_MUST] }),
  },
  {
    id: 'C13',
    desc: { nl: 'Actie met hoge zekerheid: één geaarde suggestie als uitnodiging, en vragen hoe die landt.', en: 'Action with high confidence: one grounded suggestion as an invitation, and ask how it lands.' },
    guard: (c) => c.phase === 'ACT' && c.confidence === 'HIGH',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'SUGGESTION', nextPhase: 'ACT', stripTechniques: false }),
  },
  {
    id: 'C14',
    desc: { nl: 'Actie met middelmatige zekerheid: eerst vragen of een suggestie welkom is.', en: 'Action with medium confidence: first ask whether a suggestion is welcome.' },
    guard: (c) => c.phase === 'ACT',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'QUESTION', nextPhase: 'ACT', stripTechniques: true }),
  },
  {
    id: 'C15',
    desc: { nl: 'Afronden: bevestigen wat hielp; wie verder wil praten, opent het gesprek weer.', en: 'Closing: affirm what helped; whoever wants to keep talking reopens the conversation.' },
    guard: (c) => c.phase === 'CLOSE',
    decide: () => ({ action: 'THERAPEUTIC_DIALOG', strategy: 'AFFIRMATION', nextPhase: 'CLOSE', stripTechniques: true }),
  },
  {
    id: 'C99',
    desc: { nl: 'Onbereikbaar vangnet: verkennen met een open vraag.', en: 'Unreachable safety net: explore with an open question.' },
    guard: () => true,
    decide: (c) => ({ action: c.baseAction, strategy: 'QUESTION', nextPhase: holdPhase(c.phase), stripTechniques: true }),
  },
];

export function decideConversation(c: ConversationInput): ConversationDecision {
  for (const rule of CONVERSATION_RULES) {
    if (rule.guard(c)) {
      const d = rule.decide(c);
      const add = [...(d.addMustInclude ?? [])];
      // CI-8: after any risk signal, a help line must have been given at least once.
      if (c.riskMemory !== 'NONE' && !c.resourcesGiven && !SAFE_ACTIONS.includes(d.action) && !d.replacePlan) add.push(RESOURCE_MUST);
      if (c.riskMemory === 'RECENT' && d.action === 'THERAPEUTIC_DIALOG' && !add.includes(CHECK_IN_MUST)) add.push(CHECK_IN_MUST);
      const repairs = d.strategy === 'REPAIR' || add.includes(RUPTURE_ACK_MUST);
      return { ruleId: rule.id, ...d, addMustInclude: add, repairs };
    }
  }
  /* istanbul ignore next — C99 is total */
  return { ruleId: 'C99', action: c.baseAction, strategy: 'QUESTION', nextPhase: c.phase, stripTechniques: true, addMustInclude: [], repairs: false };
}

// ---------------------------------------------------------------------------
// Plan merge: the conversation decision applied to the base rule's template.
// ---------------------------------------------------------------------------
const TECHNIQUE_MOVE = /\b(offer\s+(ONE|one)\b.*\btechnique|technique\b.*\bfrom the knowledge graph|grounded technique|grounding\/stabilisation technique)/i;

export interface PlanTemplate {
  tone: Plan['tone'];
  allowedMoves: string[];
  forbiddenMoves: string[];
  mustInclude: string[];
  maxSentences: number;
}

export function mergePlan(base: PlanTemplate, d: ConversationDecision): PlanTemplate {
  if (d.replacePlan) return { ...d.replacePlan, mustInclude: [...d.replacePlan.mustInclude, ...d.addMustInclude.filter((m) => !d.replacePlan!.mustInclude.includes(m))] };
  const guide = STRATEGY_GUIDE[d.strategy];
  const keepBase = SAFE_ACTIONS.includes(d.action) || d.strategy === 'BOUNDARY' || d.strategy === 'REFERRAL' || d.strategy === 'CLARIFY';
  if (keepBase) {
    return { ...base, mustInclude: dedupe([...base.mustInclude, ...d.addMustInclude]) };
  }
  const baseMoves = d.stripTechniques ? base.allowedMoves.filter((m) => !TECHNIQUE_MOVE.test(m)) : base.allowedMoves;
  const baseMust = d.stripTechniques ? base.mustInclude.filter((m) => !/technique/i.test(m)) : base.mustInclude;
  return {
    tone: base.tone,
    allowedMoves: dedupe([...guide.allowedMoves, ...baseMoves]).slice(0, 6),
    forbiddenMoves: dedupe([...base.forbiddenMoves, ...guide.forbiddenMoves]),
    mustInclude: dedupe([...guide.mustInclude, ...baseMust, ...d.addMustInclude]),
    maxSentences: base.maxSentences,
  };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

// ---------------------------------------------------------------------------
// State transition (pure)
// ---------------------------------------------------------------------------
const ORD = { NONE: 0, ELEVATED: 1, HIGH: 2, CRISIS: 3 } as const;

export function nextConversationState(
  state: ConversationState,
  d: ConversationDecision,
  turnRisk: RiskAssessment,
  signals: TurnSignals,
  themesNow: string[],
  replyHadResources: boolean,
): ConversationState {
  // Risk memory: HIGH/CRISIS → ACTIVE; ELEVATED → at least RECENT; UNKNOWN → no evidence either way.
  let riskMemory = state.riskMemory;
  let calmTurns = state.calmTurns;
  let peakRisk = state.peakRisk;
  if (turnRisk === 'HIGH' || turnRisk === 'CRISIS') {
    riskMemory = 'ACTIVE';
    calmTurns = 0;
  } else if (turnRisk === 'ELEVATED') {
    riskMemory = riskMemory === 'ACTIVE' ? 'ACTIVE' : 'RECENT';
    calmTurns = 0;
  } else if (turnRisk === 'NONE') {
    calmTurns += 1;
    if (riskMemory === 'ACTIVE' && calmTurns >= MEMORY_POLICY.activeCalmTurns) {
      riskMemory = 'RECENT';
      calmTurns = 0;
    } else if (riskMemory === 'RECENT' && calmTurns >= MEMORY_POLICY.recentCalmTurns) {
      // Floor: after HIGH or CRISIS in this conversation, memory never drops to NONE.
      riskMemory = ORD[peakRisk] >= ORD.HIGH ? 'RECENT' : 'NONE';
      calmTurns = 0;
    }
  }
  if (turnRisk !== 'UNKNOWN' && ORD[turnRisk] > ORD[peakRisk]) peakRisk = turnRisk;

  // Rupture (3RS): a repair is "owed" while a rupture marker is open and no
  // REPAIR turn has answered it yet (e.g. safety had to go first).
  const rupture: RuptureState = (signals.rupture || state.rupture === 'ACTIVE') && !d.repairs ? 'ACTIVE' : 'NONE';

  const phaseChanged = d.nextPhase !== state.phase;
  const themes = [...new Set([...state.themes, ...themesNow])].slice(-24);
  const focus = d.nextPhase === 'FOCUS' && state.phase !== 'FOCUS' ? themesNow.length ? themesNow.slice(0, 3) : state.themes.slice(-3) : state.focus;

  return {
    phase: d.nextPhase,
    riskMemory,
    rupture,
    resourcesGiven: state.resourcesGiven || replyHadResources,
    turnsInPhase: phaseChanged ? 0 : state.turnsInPhase + 1,
    calmTurns,
    peakRisk,
    themes,
    focus,
    turn: state.turn + 1,
  };
}

/** Parse a persisted state defensively (older turns have none). */
export function parseConversationState(raw: unknown): ConversationState {
  if (!raw || typeof raw !== 'object') return { ...INITIAL_CONVERSATION_STATE };
  const r = raw as Partial<ConversationState>;
  const phase = CONVERSATION_PHASES.includes(r.phase as ConversationPhase) ? (r.phase as ConversationPhase) : 'OPENING';
  const riskMemory = RISK_MEMORY_STATES.includes(r.riskMemory as RiskMemory) ? (r.riskMemory as RiskMemory) : 'NONE';
  const rupture = RUPTURE_STATES.includes(r.rupture as RuptureState) ? (r.rupture as RuptureState) : 'NONE';
  const peak = (['NONE', 'ELEVATED', 'HIGH', 'CRISIS'] as const).includes(r.peakRisk as ConversationState['peakRisk']) ? (r.peakRisk as ConversationState['peakRisk']) : 'NONE';
  return {
    phase,
    riskMemory,
    rupture,
    resourcesGiven: r.resourcesGiven === true,
    turnsInPhase: Number.isFinite(r.turnsInPhase) ? Math.max(0, r.turnsInPhase as number) : 0,
    calmTurns: Number.isFinite(r.calmTurns) ? Math.max(0, r.calmTurns as number) : 0,
    peakRisk: peak,
    themes: Array.isArray(r.themes) ? r.themes.filter((x) => typeof x === 'string').slice(-24) : [],
    focus: Array.isArray(r.focus) ? r.focus.filter((x) => typeof x === 'string').slice(0, 3) : [],
    turn: Number.isFinite(r.turn) ? Math.max(0, r.turn as number) : 0,
  };
}
