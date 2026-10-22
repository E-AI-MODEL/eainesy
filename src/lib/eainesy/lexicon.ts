/**
 * Symbolic lexical scanner — runs INDEPENDENTLY of GLM.
 *
 * Role in the safety story: the neural parser can be wrong, jailbroken, or down.
 * This scanner is deterministic, inspectable, and its output is fused with
 * the neural risk assessment via max-fusion (the safer of the two wins).
 * This is the layer that would have caught evai v30's greeting-path bypass.
 *
 * Includes a negation window so "ik ga me NIET pijn doen" does not fire
 * SELF_HARM — one of the classic red-team traps.
 */
import type { RiskLevel, RiskMarker, DistressLevel, PiiState } from './types';

interface LexicalRule {
  /** Stable id — referenced from the support core (implemented_by). */
  id: string;
  type: RiskMarker['type'];
  weight: number;
  patterns: RegExp[];
}

export const MARKER_WEIGHTS: Record<RiskMarker['type'], number> = {
  AGENCY_PLAN: 5.0,
  SUICIDAL_IDEATION: 5.0,
  HARM_OTHERS: 5.0,
  ABUSE_MARK: 3.5,
  SELF_HARM: 4.0,
  // Joiner (2005): perceived burdensomeness is one of the two proximal
  // components of suicidal desire — on its own it is a HIGH-level signal.
  BURDENSOMENESS: 3.5,
  HOPELESSNESS: 2.5,
  ISOLATION: 1.0,
  SUBSTANCE: 1.5,
};

/**
 * Marker types whose weight protective factors may never dilute. A person
 * who says "I want to die, even though my kids love me" is still expressing
 * suicidal ideation; protective factors lower ACCUMULATED low-level signals
 * only (see lexicalRiskScore).
 */
export const ACUTE_MARKER_TYPES: RiskMarker['type'][] = ['SUICIDAL_IDEATION', 'AGENCY_PLAN', 'HARM_OTHERS', 'SELF_HARM', 'BURDENSOMENESS'];

/** Risk thresholds — SMT-verified invariants reference these constants. */
export const RISK_THRESHOLDS = {
  CRISIS: 5.0,
  HIGH: 3.5,
  ELEVATED: 1.5,
} as const;

/**
 * Negators. Negation only counts inside the SAME clause as the match (see
 * isNegated): "eigenlijk niet, ik wil niet meer leven" is NOT a negated
 * ideation — the comma closes the first clause. That exact sentence (RT-01)
 * slipped through the old 40-character window.
 */
const NEGATORS = /\b(niet|geen|nooit|not|never|no|don't|dont|won't|wont|isn't|wasn't)\b/i;

/**
 * Clause boundaries: punctuation, dashes and the coordinating/turning words
 * that start a new proposition in NL/EN ("maar", "en", "want", "but", "and").
 */
const CLAUSE_BOUNDARY = /[.!?;,:()\n—–]|\s-\s|\b(maar|en|want|omdat|dus|eigenlijk|alleen|toch|but|and|because|so|though|however|actually)\b/gi;

const RULES: LexicalRule[] = [
  {
    id: 'LX-SI',
    type: 'SUICIDAL_IDEATION',
    weight: MARKER_WEIGHTS.SUICIDAL_IDEATION,
    patterns: [
      // explicit wish to die / not to live (NL) — adverbs allowed in between.
      // Optional subject slot covers verb-first word order ("soms wil ik niet
      // meer leven", "eigenlijk wil ik dood") next to subject-first order.
      /\bwil\s+(?:(?:ik|jij|je|hij|zij|ze|wij|we|u|jullie)\s+)?((echt|gewoon|eigenlijk|liever|zo|al|nu|soms|vaak)\s+){0,2}(niet\s+meer\s+(leven|bestaan)|dood(gaan)?\b|er\s+niet\s+meer\s+zijn|weg\s+zijn\s+voor\s+altijd)/i,
      /\bwil\s+de\s+(wereld\s+)?uit/i,
      /\b(zelfmoord|zelfdoding|suïcid\w*|suicid\w*)/i,
      /\b(er\s+)?een\s+eind(e)?\s+aan\s+(maken|te\s+maken|mijn\s+leven|m'n\s+leven|het\s+leven|alles)\b/i,
      /\b(mijn|m'n)\s+leven\s+(be)?ëindigen/i,
      /\b(me|mezelf)\s+(van\s+kant\s+(te\s+)?maken|op\s+(te\s+)?hangen|ophangen|dood\s*(te\s+)?maken|om\s+het\s+leven\s+(te\s+)?brengen)/i,
      /\bvan\s+kant\s+(te\s+)?maken\b/i,
      /\b(wenste?|wens)\s+(dat\s+ik\s+)?(dood|er\s+niet\s+meer)/i,
      /\bliever\s+dood\b/i,
      // passive ideation: invisibility / not waking up / being gone
      /\bniemand\s+zou\s+het\s+merken\s+als\s+ik\s+er\s+niet/i,
      /\bniemand\s+(zou|zal)\s+(me|mij)\s+missen/i,
      /\bals\s+ik\s+er\s+niet\s+meer\s+(was|ben|word|zou\s+zijn)/i,
      /\ber\s+liever\s+niet\s+meer/i,
      /\bliever\s+niet\s+meer\s+(was|hier|levend|wakker)/i,
      /\b(wil|hoef)\s+(ook\s+)?niet\s+(meer\s+)?wakker\s+(te\s+)?worden/i,
      // Passive death wish without "wil": "soms hoop ik dat ik niet meer wakker word".
      /\b(?:hoop|wens)\s+ik\s+(?:soms\s+)?dat\s+ik\s+niet\s+(?:meer\s+)?wakker\s+(?:te\s+)?word/i,
      // Conditional/passive wish variants (2026-10-19 generalisation repair,
      // fictional live probes): "soms zou ik willen dat ik gewoon niet meer
      // wakker word" and preoccupation "ik denk er vaak aan om niet meer
      // wakker te worden". Bounded: "niet meer wakker" with an explicit
      // wish/preposition frame, never a bare sleep complaint.
      /\bzou\s+(?:ik\s+)?(?:graag\s+)?(?:willen|wensen)\s+dat\s+ik\s+(?:gewoon\s+|liever\s+|liefst\s+)?niet\s+meer\s+wakker/i,
      /\baan\s+om\s+niet\s+meer\s+wakker/i,
      /\bhoeft?\s+(voor\s+mij\s+)?niet\s+meer\s+wakker/i,
      /\bhet\s+hoeft\s+(voor\s+mij\s+)?(allemaal\s+)?niet\s+meer\b/i,
      /(rustig|fijn|beter|kalm|vredig|prettig|mooi)\s+zijn\s+als\s+ik\s+er\s+((?!even\b)\w+\s+)?niet\s+meer\s+(was|ben|word)/i,
      /(denk|droom|overweeg|plan)\w*\s+(ik\s+)?(er)?over\s+om\s+niet\s+meer\s+terug\s+te\s+komen\b(?!\s+(bij|op|in|naar|voor|over)\b)/i,
      // Joiner: "better off without me" is passive ideation framed as burden
      /\bbeter\s+af\s+(zijn\s+)?zonder\s+mij\b/i,
      // EN
      /\b(kill(ing)?|end(ing)?)\s+(myself|my\s+life|it\s+all)\b/i,
      /\bwant(ed)?\s+to\s+die\b/i,
      /\b(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
      /\b(don'?t|do\s+not)\s+want\s+to\s+be\s+here\s+any\s*more\b/i,
      /\bbetter\s+off\s+(dead|without\s+me)\b/i,
      /\bnobody\s+would\s+(notice|miss\s+me)\b.{0,30}\b(gone|dead|die|wasn'?t\s+here)?/i,
      /\bwouldn'?t\s+mind\s+(if\s+i\s+)?(just\s+)?(didn'?t|not)\s+wak/i,
      /\b(wish|hope)\s+i\s+(would\s+not|wouldn'?t|won'?t|didn'?t)\s+wake\s+up/i,
      // Allow adverbs ("I wish I just would not wake up").
      /\b(?:wish|hope)\s+i\s+(?:just\s+)?(?:would\s+not|wouldn't|won't|didn't)\s+wake\s+up/i,
      // Present-tense EN passive wish with a finality marker ("Some nights I
      // hope I simply do not wake up anymore"). The finality word (anymore /
      // again / never) excludes plain sleep-in talk ("hope I do not wake up
      // early"), the trailing lookahead excludes transitive uses
      // ("hope I do not wake up my neighbors").
      /\b(?:wish|hoping|hope)\s+i\s+(?:\w+\s+){0,3}(?:do\s+not|don'?t)\s+wake\s+up\s+(?:any\s*more|again)\b(?!\s+(?:my|the|him|her|them|anyone|anybody)\b)/i,
      /\b(?:wish|hoping|hope)\s+i\s+(?:\w+\s+){0,3}never\s+wake\s+up\b(?!\s+(?:my|the|him|her|them|anyone|anybody)\b)/i,
      /\bno\s+reason\s+to\s+(wake|live|go\s+on)/i,
    ],
  },
  {
    id: 'LX-SH',
    type: 'SELF_HARM',
    weight: MARKER_WEIGHTS.SELF_HARM,
    patterns: [
      /\b(me|mezelf|mij)\s+(weer\s+|nog\s+)?pijn\s+(doen|toebrengen|doen\s+willen)/i,
      /\b(snij|snijd|snijden|kras|krassen|brand|branden)\s+(weer\s+|nog\s+|vaak\s+|soms\s+)?(in\s+)?(me|mezelf|mijn\s+(arm|armen|pols|polsen|been|benen|huid))\b/i,
      /\bmezelf\s+(snijden|krassen|beschadigen|verwonden|branden|slaan)/i,
      /\bzelf(verminking|beschadig\w*)/i,
      /\bsla\s+mezelf/i,
      /\b(cut(ting)?|burn(ing)?|hurt(ing)?|harm(ing)?)\s+myself\b/i,
      /\bself[- ]?harm\w*/i,
    ],
  },
  {
    id: 'LX-PLAN',
    type: 'AGENCY_PLAN',
    weight: MARKER_WEIGHTS.AGENCY_PLAN,
    patterns: [
      /\bpillen\s+(geslagen|geslikt|ingemaakt|ingepakt|gespaard|verzameld|opgespaard|klaargelegd|klaarliggen)/i,
      /\b(heb|heeft)\s+(al\s+)?(de\s+)?(pillen|een\s+touw|een\s+mes|alles)\s+(gekocht|klaar(gelegd|liggen)?|liggen|geregeld)/i,
      /\bplan\s+gemaakt\s+voor/i,
      /\bheeft\s+een\s+plan/i,
      /\bhoe\s+ik\s+het\s+ga\s+doen/i,
      /\bafscheid\s+genomen/i,
      /\bafscheidsbrie(f|ven)/i,
      /\bmorgen\s+is\s+het\s+voorbij/i,
      /\bvanavond\s+nog\b/i,
      /\bbinnenkast|in\s+de\s+kast\s+gelegd/i,
      /\bvan\s+(een|de)\s+(brug|flat|toren|gebouw|dak)\s+(af\s+)?(te\s+)?springen/i,
      /\bvoor\s+(de|een)\s+trein\s+(te\s+)?(springen|gaan\s+staan|lopen)/i,
      /\b(overdosis|overdose)\b/i,
      /\bhow\s+to\s+do\s+it\b/i,
      /\b(saved\s+up|stockpil\w*|collected)\s+(my\s+|the\s+)?(pills|meds|medication)/i,
      /\bjump(ing)?\s+(off|from)\s+(a|the)\s+(bridge|building|roof)/i,
      /\bin\s+front\s+of\s+a\s+train\b/i,
      /\b(goodbye|suicide)\s+(letter|note)\b/i,
    ],
  },
  {
    id: 'LX-BURDEN',
    type: 'BURDENSOMENESS',
    weight: MARKER_WEIGHTS.BURDENSOMENESS,
    patterns: [
      // Joiner's perceived burdensomeness — risk signal, NOT ideation itself
      /\bik\s+ben\s+(alleen\s+maar\s+|gewoon\s+|echt\s+)?(een\s+)?(last|blok\s+aan\s+het\s+been)(\s+voor\s+(iedereen|anderen|jullie|mijn\s+\w+))?\b/i,
      /\b(iedereen|ze|jullie|mijn\s+(familie|ouders|kinderen|vrienden|partner))\s+(zou|zouden|is|zijn)\s+(echt\s+|veel\s+)?beter\s+af\b/i,
      /\bi'?m\s+(just\s+|only\s+)?(a|such\s+a)\s+burden\b/i,
      /\b(everyone|they|my\s+(family|parents|kids|friends))\s+(would\s+be|are|is)\s+better\s+off\b/i,
    ],
  },
  {
    id: 'LX-HOPE',
    type: 'HOPELESSNESS',
    weight: MARKER_WEIGHTS.HOPELESSNESS,
    patterns: [
      /\b(zie|zag)\s+het\s+((echt|helemaal|gewoon)\s+)?niet\s+meer\s+zitten/i,
      /\bkomt\s+nooit\s+(meer\s+)?goed/i,
      /\bgeen\s+zin\s+meer\b/i,
      /\bzinloos/i,
      /\bhopeloos|hooploos|geen\s+hoop/i,
      /\bno\s+(point|hope|way\s+out)\b/i,
      /\bhopeless/i,
      /\bhet\s+komt\s+toch\s+niet\s+goed/i,
      /\bde\s+zon\s+komt\s+voor\s+mij\s+niet\s+meer\s+op/i,
      /\bleeg\s+van\s+binnen/i,
      /\bnumb\s+inside/i,
      /\bik\s+kan\s+(het\s+)?niet\s+meer\b/i,
      /\bi\s+can'?t\s+(do\s+this|go\s+on|take\s+it)\s+any\s*more/i,
      /\bwil\s+(gewoon\s+)?verdwijnen\b|\bwant\s+to\s+disappear\b/i,
      // NL idiom "(ik zie) geen uitweg" — bounded gap, the gap may contain no negator
      /\bzie[tf]?\s+((?!\b(niet|geen|nooit)\b)\w+\s+){0,2}geen\s+uitweg\b/i,
    ],
  },
  {
    id: 'LX-ISO',
    type: 'ISOLATION',
    weight: MARKER_WEIGHTS.ISOLATION,
    patterns: [
      /\bheel\s+alleen|zo\s+alleen/i,
      /\bniemand\s+(die|om)\b/i,
      /\bkijk\s+ergens\s+meer\s+naar\s+op/i,
      /\bso\s+(lonely|alone)/i,
      /\bnobody\s+(cares|would\s+notice)/i,
      /\bniemand\s+zou\s+het\s+merken/i,
      /\bcompletely\s+(alone|isolated)/i,
      /\bheel\s+even\s+geen\s+eenzame\s+straat/i,
      /\bhoor\s+(er\s+)?nergens\s+bij\b|\bdon'?t\s+belong\s+anywhere\b/i,
    ],
  },
  {
    id: 'LX-SUB',
    type: 'SUBSTANCE',
    weight: MARKER_WEIGHTS.SUBSTANCE,
    patterns: [
      /\bdrink\s+(elke\s+dag|te\s+veel)/i,
      /\bpillen\s+slikken/i,
      /\bdrinking\s+every\s+day/i,
      /\bgebruik\s+weer/i,
      /\bcoke\b|\bwiet\s+elke\s+dag/i,
      /\bdrinken\s+om\s+te\s+(kunnen\s+)?slapen/i,
      /\bdrink\s+(tegenwoordig\s+)?elke\s+(dag|avond|nacht)\s+om\s+te\b/i,
      /\bblowt?\s+elke\s+dag/i,
      // zelfmedicatie: drankwoord verplicht, dus thee/koffie/melk vallen buiten
      /\bdrink\s+(tegenwoordig\s+)?elke\s+(avond|nacht)[^.!?\n]{0,24}\b(wijn|alcohol|bier|drank|fles)\b/i,
    ],
  },
  {
    id: 'LX-HARM',
    type: 'HARM_OTHERS',
    weight: MARKER_WEIGHTS.HARM_OTHERS,
    patterns: [
      /\bvermoord\w*/i,
      /\bmensen\s+doden/i,
      /\b(hem|haar|hen|ze)\s+(slaan|doden|pijn\s+doen|iets\s+aandoen|vermoorden)/i,
      /\bkill(ing)?\s+(him|her|them|someone|somebody|people)/i,
      /\bhurt(ing)?\s+(him|her|them|someone|somebody)/i,
      /\bwraak/i,
      /\bget\s+back\s+at/i,
      /\bieder(een)?\s+die\s+(mij|dit)\s+(heeft\s+)?aangedaan/i,
    ],
  },
  {
    id: 'LX-ABUSE',
    type: 'ABUSE_MARK',
    weight: MARKER_WEIGHTS.ABUSE_MARK,
    patterns: [
      /\b(slaat|sloeg|slaan)\s+(mij|me|mijn)\b/i,
      /\bmishandel\w*/i,
      /\bmisbruikt?\s+(mij|me|mijn)/i,
      /\bdwingt?\s+(mij|me)\b/i,
      /\b(thuis|huis)\s*geweld|geweld\s+(thuis|in\s+huis)/i,
      /\bbeats?\s+me\b/i,
      /\bhits?\s+me\b/i,
      /\b(he|she|they)\s+(forced|hurt|hit)\s+me\b/i,
      /\bforced\s+me\s+to/i,
      /\bnot\s+safe\s+at\s+home/i,
      /\bniet\s+veilig\s+(thuis|in\s+huis)/i,
      // stalking / coercive contact
      /\bbelt\s+(me|mij)\s+steeds/i,
      /\bsteeds\s+(opgebeld|gebeld|contact)/i,
      /\bkeeps\s+(calling|messaging|texting|contacting)/i,
      /\bachtervolg\w*/i,
      /\bfollows?\s+me\s+(everywhere|around|home)/i,
    ],
  },
];

/** Lexical rule ids (resolved by the support-core reference check). */
export const LEXICAL_RULE_IDS = RULES.map((r) => r.id);

// Panic vocabulary feeds the distress estimator (bodily alarm = distress),
// not the risk-marker space: panic alone is never a harm signal.
const PANIC_VOCAB = [
  /paniekaanval/i, /paniek\b/i, /hyperventil\w*/i, /hart\s+(bonkt|ras\w*|gaat\s+snel)/i,
  /panic\s+attack/i, /can'?t\s+breathe/i, /lucht\s+krijg/i, /doordraait/i, /blijf\s+maar\s+gaan/i,
];

const PROTECTIVE = [
  /steun\s+van/i, /praat\s+met\s+(mijn|een)/i, /mijn\s+therapeut/i, /mijn\s+huisarts/i,
  /support\s+from/i, /talk(ed)?\s+to\s+(my|a)/i, /my\s+therapist/i, /looking\s+forward\s+to/i,
  /kijk\s+uit\s+naar/i, /mijn\s+kinderen/i, /mijn\s+partner/i, /vriend(in)?\s+helpt/i,
];

const INTENSIFIERS = /\b(heel|erg|zo|enorm|totaal|compleet|very|so|extremely|completely)\b/i;

const NEGATIVE_EMOTIONS = [
  'somber', 'verdrietig', 'angstig', 'bang', 'paniek', 'gespannen', 'moe', 'uitgeput',
  'schuldig', 'schaamte', 'boos', 'geïrriteerd', 'onzeker', 'waardeloos', 'mist', 'mis',
  'overweldig', 'eenzaam', 'leeg', 'wanhopig', 'frustr', 'ziek van',
  'sad', 'anxious', 'scared', 'panic', 'tense', 'exhausted', 'tired', 'guilty',
  'ashamed', 'angry', 'insecure', 'worthless', 'lonely', 'overwhelmed', 'lost',
  'hopeless', 'empty', 'drained', 'numb', 'can\'t sleep',
];

/**
 * Four-step distress ladder (LOW → MODERATE → ELEVATED → ACUTE) computed from
 * un-negated negative-emotion hits and intensifiers. Feeds the controller's
 * distress dimension and the KG chain rules.
 */
export function estimateDistress(text: string): DistressLevel {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of NEGATIVE_EMOTIONS) {
    const idx = lower.indexOf(w);
    if (idx >= 0 && !isNegated(lower, idx)) hits += 1;
  }
  const intensified = INTENSIFIERS.test(lower) && hits > 0;
  const panicHit = PANIC_VOCAB.some((p) => p.test(text));
  if (panicHit) hits += 1; // panic vocabulary is bodily distress in itself
  if (hits >= 4) return 'ACUTE';
  if (hits >= 3) return intensified ? 'ACUTE' : 'ELEVATED';
  if (hits >= 2) return intensified ? 'ELEVATED' : 'MODERATE';
  if (hits === 1) return 'MODERATE';
  return 'LOW';
}

const PII_PATTERNS: RegExp[] = [
  /(\+31|06)[- ]?\d{8}/,               // NL phone
  /\d{3}[- ]?\d{3}[- ]?\d{4}/,          // US phone
  /[\w.+-]+@[\w-]+\.[\w.]+/,            // email
  /\b\d{9}\b/,                          // BSN-like
  /\b[A-Z]\d{4}\s?\d{4}\b/,             // postal code + house number style
  /\b(telefoonnummer|phone number|e-?mailadres)\b/i, // solicitation targets
];

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.CRISIS) return 'CRISIS';
  if (score >= RISK_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= RISK_THRESHOLDS.ELEVATED) return 'ELEVATED';
  return 'NONE';
}

/**
 * True if the match at `index` is negated: a negator occurs in the SAME
 * clause, before the match, within 30 characters. Clause boundaries are
 * punctuation and turning/coordinating words (CLAUSE_BOUNDARY) — so
 * "eigenlijk niet, ik wil niet meer leven" stays an affirmed ideation, while
 * "ik ga me niet pijn doen" / "ik denk niet aan zelfmoord" stay negated.
 * The pattern's own words never count (the window ends at the match start).
 */
export function isNegated(text: string, index: number): boolean {
  const before = text.slice(0, index);
  let clauseStart = 0;
  for (const m of before.matchAll(CLAUSE_BOUNDARY)) {
    clauseStart = (m.index ?? 0) + m[0].length;
  }
  const clause = before.slice(clauseStart);
  const negMatches = [...clause.matchAll(new RegExp(NEGATORS.source, 'gi'))];
  if (negMatches.length === 0) return false;
  const lastNeg = negMatches[negMatches.length - 1];
  const distance = clause.length - (lastNeg.index ?? 0);
  return distance <= 30;
}

/**
 * Narrow evidence scoping for a resolved historical mention of ideation.
 * Not a general clinical temporality classifier. Requires a PAST-time anchor
 * in the same clause as the bare suicide term, an explicit RESOLUTION closure
 * within 100 characters after it, and NO recurrence or current-risk language
 * afterwards (any later risk word voids the exception — fail toward
 * detection). Current wishes still match normally.
 */
function isResolvedHistoricalIdeation(text: string, index: number, evidence: string): boolean {
  if (!/^(zelfmoord|zelfdoding|suïcid\w*|suicid\w*)$/i.test(evidence)) return false;
  const before = text.slice(0, index);
  const clause = before.split(/[.!?;,:\n]|\bmaar\b/i).at(-1) ?? '';
  const pastAnchorNl = /\b(vroeger|voorheen|destijds|eerder|geleden|verleden|toen)\b/i;
  const pastAnchorEn = /\b(years?\s+ago|in\s+the\s+past|back\s+then|used\s+to|when\s+i\s+was\s+(?:younger|a\s+teenager))\b/i;
  if (!pastAnchorNl.test(clause) && !pastAnchorEn.test(clause)) return false;
  const after = text.slice(index + evidence.length);
  const closures = [
    /\bmaar\s+(?:dat\s+)?(?:ligt|is)\s+(?:al\s+)?(?:[\w-]+\s+){0,7}achter\s+me\b/i,
    /\b(?:inmiddels|nu|dat|dit)\s+is\s+(?:dat\s+|dit\s+)?(?:helemaal\s+|volledig\s+|al\s+|lang\s+)?over\b/i,
    /\b(?:dat|dit)\s+ligt\s+(?:al\s+)?(?:[\w-]+\s+){0,7}achter\s+(?:me|mij)\b/i,
    /\b(?:behandeling|therapie|hulp)\s+(?:heeft\s+geholpen|hielp)\b/i,
    /\bdaar\s+ben\s+ik\s+(?:overheen|doorheen)\b/i,
    /\bik\s+(?:ben|voel\s+me)\s+(?:inmiddels\s+|nu\s+|weer\s+)?(?:goed|beter|weer\s+op\s+de\s+rails)\b/i,
    /\btreatment\s+(?:has\s+)?helped\b/i,
    /\bthat'?s\s+behind\s+me\b/i,
    /\b(?:i\s+(?:am|feel)|i'?ve\s+been)\s+(?:fine|well|better|recovered)\b/i,
    /\bi'?ve\s+been\s+doing\s+well\b/i,
  ];
  let closed: { index: number; end: number } | null = null;
  for (const re of closures) {
    const m = after.match(re);
    if (m && m.index !== undefined && m.index <= 100 &&
        (closed === null || m.index < closed.index)) {
      closed = { index: m.index, end: m.index + m[0].length };
    }
  }
  if (!closed) return false;
  const remainder = after.slice(closed.end);
  // Recurrence guard (original) — time cue plus return word.
  if (/\b(?:nu|vandaag|momenteel|tegenwoordig|now|again)\b.{0,60}\b(?:weer|opnieuw|terug|suïcidaal|suicid|dood|pillen|suicidal|depressed|dead|dying)\b/i.test(remainder)
    || /\b(?:toch\s+weer|weer\s+terug|opnieuw)\b/i.test(remainder)) return false;
  // Post-closure risk-language guard (2026-10-19): ANY explicit suicide/die
  // language after the resolution voids the historical exception.
  if (/\b(?:suïcid\w*|suicid\w*|zelfmoord|zelfdoding|dood(?:gaan)?|eind\s+aan\s+(?:mijn\s+'?n?\s+)?(?:leven|alles)|niet\s+meer\s+wakker|er\s+niet\s+meer\s+(?:zijn|ben|was)|niet\s+meer\s+(?:leven|bestaan)|suicidal|ending\s+(?:it|my\s+life)|not\s+wake\s+up|taking\s+my\s+life)\b/i.test(remainder)) return false;
  return true;
}

/** A schema marker label does not itself establish an experienced symptom. */
function isSchemaMarkerName(evidence: string): boolean {
  return evidence.toUpperCase() === 'SUICIDAL_IDEATION';
}

export function collectLexicalMarkers(text: string): { markers: RiskMarker[]; negated: number } {
  const markers: RiskMarker[] = [];
  let negated = 0;
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (isNegated(text, m.index)) {
          negated += 1;
          continue;
        }
        if (rule.type === 'SUICIDAL_IDEATION' &&
            (isSchemaMarkerName(m[0]) || isResolvedHistoricalIdeation(text, m.index, m[0]))) {
          continue;
        }
        markers.push({ type: rule.type, evidence: m[0].slice(0, 120) });
        // One match per *pattern*. Keep distinct evidence fragments, even
        // when they share a type; scoring below counts each type only once.
        break;
      }
    }
  }
  return { markers, negated };
}

export function collectProtective(text: string): string[] {
  const found: string[] = [];
  for (const p of PROTECTIVE) {
    const m = text.match(p);
    if (m) found.push(m[0].slice(0, 80));
  }
  return found.slice(0, 3);
}

export function detectPii(text: string): PiiState {
  for (const p of PII_PATTERNS) {
    if (p.test(text)) return 'PII_DETECTED';
  }
  return 'CLEAN';
}

/**
 * Calculate risk from DISTINCT marker categories, never regex-match counts.
 *
 * The lexical scanner intentionally retains multiple evidence fragments of
 * one type for research/review. Counting those fragments as independent
 * categories could turn two HOPELESSNESS phrases (2 × 2.5) into CRISIS.
 * The neural path in orchestrator.ts already uses one weight per type.
 *
 * This removes accidental same-type inflation, NOT genuine context errors:
 * source speaker, time and polarity still require review.
 */
export function lexicalRiskScore(markers: RiskMarker[], protectiveCount: number): number {
  const types = [...new Set(markers.map((m) => m.type))];
  const raw = types.reduce((sum, type) => sum + MARKER_WEIGHTS[type], 0);
  // Protective factors lower accumulated low-level signals only — never
  // below the strongest acute marker (ideation, plan, self-harm, harm to
  // others, burdensomeness). See ACUTE_MARKER_TYPES.
  const acuteFloor = types
    .filter((type) => ACUTE_MARKER_TYPES.includes(type))
    .reduce((mx, type) => Math.max(mx, MARKER_WEIGHTS[type]), 0);
  return Math.max(acuteFloor, raw - Math.min(2, protectiveCount), 0);
}
