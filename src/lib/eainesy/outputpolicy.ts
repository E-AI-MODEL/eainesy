/**
 * Output policy — symbolic verification of GENERATED text.
 *
 * The generator is neural and therefore untrusted. Before anything reaches
 * the user, the reply is checked against the plan and the global safety
 * policy (17 rules). Violations trigger one constrained regeneration; a
 * second failure degrades to a canned, human-written safe response (fail-closed).
 */
import type { Plan, OutputViolation, SupportStrategy } from './types';

interface OutputRule {
  id: string;
  description: string;
  applies: (plan: Plan) => boolean;
  check: (text: string, plan: Plan) => OutputViolation | null;
}

/** Count of distinct matches — used to avoid false positives on quoted user words. */
function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * Check whether a helpline is actually offered as a contact option.
 * This is deliberately a bounded syntax guard, NOT a semantic guarantee.
 * Unlike a bare digit check it rejects a number cited as trivia, quoted
 * as a refusal, or explicitly discouraged in the same sentence.
 */
function hasActionableContact(text: string, resource: '113' | '112' | '0800-2000'): boolean {
  const numbers: Record<typeof resource, RegExp> = {
    '113': /\b(?:113|0800[\s-]?0113)\b/gi,
    '112': /\b112\b/gi,
    '0800-2000': /\b0800[\s-]?2000\b/gi,
  };
  const invitation = /\b(?:bel|bellen|telefoneren|contact(?:eer|eren)?|neem contact op|praat met|bereikbaar|hulplijn|call|dial|phone|contact|reach|reachable|talk to|speak to)\b/i;
  const discouragement = /\b(?:bel|bellen|call|contact|dial)\s+(?:vooral\s+)?(?:niet|nooit|never|not)\b|\b(?:do not|don't|never|niet|nooit)\s+(?:naar\s+)?(?:bel|bellen|call|contact|dial)\b|\b(?:hoef|hoeft|moet|must)\s+(?:je\s+|you\s+)?(?:niet|not)\s+(?:te\s+)?(?:bel|bellen|call|contact)\b|\b(?:bel|call|contact|dial)\s+(?:113|112|0800[\s-]?2000|0800[\s-]?0113)\s+(?:niet|never|not)\b|\b(?:113|112|0800[\s-]?2000|0800[\s-]?0113)\s+(?:niet|never|not)\s+(?:bellen|call|contact)\b|\b(?:niet|nooit|never|not)\s+(?:naar\s+|to\s+)?(?:113|112|0800[\s-]?2000|0800[\s-]?0113)\b/i;
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (discouragement.test(sentence)) continue;
    for (const match of sentence.matchAll(numbers[resource])) {
      const at = match.index ?? 0;
      const preceding = sentence.slice(Math.max(0, at - 85), at);
      const following = sentence.slice(at + match[0].length, at + match[0].length + 35);
      if (invitation.test(preceding) ||
          /^(?:\s+|[\s,(:;-]+)(?:is\s+)?(?:bereikbaar|reachable|available)\b/i.test(following)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Require the *closing* question to check on immediate wellbeing, support or
 * continued contact. Not just any '?' in the reply.
 * Intentionally language-bounded. Human review is still needed for meaning.
 */
function hasClosingCheckIn(text: string, language: 'nl' | 'en'): boolean {
  const trimmed = text.trim();
  if (!trimmed.endsWith('?')) return false;
  const question = trimmed.split(/(?<=[.!?])\s+/).at(-1) ?? '';
  if (language === 'nl') {
    return /\b(?:hoe\s+(?:gaat|voel|veilig|is)|ben\s+je\s+(?:(?:nu|op\s+dit\s+moment)\s+)?veilig|heb\s+je\s+(?:(?:op\s+dit\s+moment|nu)\s+)?iemand|is\s+er\s+iemand|kun\s+je\s+iemand|kan\s+je\s+iemand|wil\s+je\s+(?:vertellen|delen|even\s+samen\s+een\s+pauze|in\s+je\s+eigen\s+woorden)|blijf\s+je\s+(?:even\s+)?bij\s+me|wat\s+(?:heb|helpt|zou)|wie\s+kan)\b/i.test(question) &&
      /\b(?:je|jou|jij|iemand|steun|veilig|hulp|bij\s+me|nu|moment|voelt|gaat)\b/i.test(question);
  }
  return /\b(?:how\s+(?:are|do|safe|is)|are\s+you\s+safe|do\s+you\s+have\s+someone|is\s+there\s+someone|can\s+you\s+(?:reach|contact|tell)|would\s+you\s+(?:tell|share)|stay\s+with\s+me|who\s+can|what\s+would\s+help)\b/i.test(question) &&
    /\b(?:you|your|someone|safe|support|help|feel|now|with\s+me)\b/i.test(question);
}

const RULES: OutputRule[] = [
  {
    id: 'OP-1',
    description: 'No clinical labels or diagnoses applied to the user',
    applies: () => true,
    check: (text) => {
      // Requires a clinical complement: bare "je hebt …" / "you have …"
      // (e.g. "je hebt het goed dat je het zegt", "do you have someone
      // around you?") is normal supportive language, not a label.
      const m = text.match(/\b(je (hebt|lijdt aan) (een |de )?(depressie|burn-?out|ptsd|angststoornis)|you (have|suffer from) (a |an )?(depression|ptsd|adhd|anxiety disorder)|dat is (ongetwijfeld )?(depressie|een burn-?out|ptsd|angststoornis)|that('s| is) (clearly )?(depression|ptsd|adhd|an anxiety disorder))\b/i);
      return m ? { ruleId: 'OP-1', description: 'diagnostic label detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-2',
    description: 'No medication advice',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b((neem|gebruik|take|try|ask( for)?|vraag om) (een |some )?(antidepress|medicijn|medication|ssri|pillen|pills))|((antidepressiva|medicatie|medication) (helpt|helps|zou helpen|would help))/i);
      return m ? { ruleId: 'OP-2', description: 'medication advice detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-3',
    description: 'Crisis/safety responses must carry the 113 resource',
    applies: (plan) => plan.action === 'CRISIS_PROTOCOL' || plan.action === 'SAFETY_RESPONSE',
    check: (text) => {
      return hasActionableContact(text, '113')
        ? null
        : { ruleId: 'OP-3', description: 'no actionable 113 referral in safety response', excerpt: text.slice(0, 60) };
    },
  },
  {
    id: 'OP-4',
    description: 'No minimizing / toxic-positivity language',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b(kan erger|could be worse|gewoon positief|just think positive|valt wel mee|denk positief|look on the bright side|er zijn altijd mensen die het slechter hebben)\b/i);
      return m ? { ruleId: 'OP-4', description: 'minimizing language detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-5',
    description: 'Never request personal contact details',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b((je|jouw|your) (telefoonnummer|phone number|adres|address|e-?mail)|(geef|give) (me )?(je|us|your) (nummer|email|address))\b/i);
      return m ? { ruleId: 'OP-5', description: 'PII request detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-6',
    description: 'Never promise secrecy about self-harm',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b(ons geheim|keep this (secret|between us)|vertel het niet (verder|aan iemand)|won't tell anyone|niets vertrouwen)\b/i);
      return m ? { ruleId: 'OP-6', description: 'secrecy promise detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-7',
    description: 'Techniques mentioned must come from the knowledge graph grounding',
    applies: (plan) => plan.action === 'THERAPEUTIC_DIALOG' || plan.action === 'PSYCHOEDUCATION',
    check: (text, plan) => {
      const TRIGGERS: [RegExp, string][] = [
        [/adem(haling|ruimte)?|breathing/i, 'tech:ademruimte'],
        [/5[- ]4[- ]3[- ]2[- ]1|gronding|grounding/i, 'tech:gronding'],
        [/gedachtekaart|thought record/i, 'tech:gedachtekaart'],
        [/activiteiten(planning|plan)|activity planning|kleine activiteit|small activity/i, 'tech:activiteitenplanning'],
        [/sociale kaart|support map/i, 'tech:sociale-kaart'],
        [/slaap(hygiëne|hygiene)|sleep hygiene/i, 'tech:slaaphygiene'],
        [/slaaprestrictie|sleep restriction/i, 'tech:slaaprestrictie'],
        [/stimuluscontrole|stimulus control/i, 'tech:stimuluscontrole'],
        [/zelfcompassie|self-compassion/i, 'tech:zelfcompassie'],
        [/waardenkompas|values compass/i, 'tech:waardenkompas'],
        [/zorguitstel|worry postponement/i, 'tech:zorguitstel'],
        [/4-7-8/i, 'tech:adem-478'],
        [/lichaamsscan|body scan/i, 'tech:lichaamsscan'],
        [/coping-?kaart|coping card/i, 'tech:coping-kaart'],
        [/veiligheidsplan|safety plan/i, 'tech:veiligheidsplan'],
        [/energiebudget|energy budget/i, 'tech:energiebudget'],
        [/piekeronderbreker|rumination interrupt/i, 'tech:piekerinterruptie'],
        [/drie goede dingen|three good things/i, 'tech:dankbaarheid'],
        [/spierontspanning|muscle relaxation/i, 'tech:spierspanning'],
        [/probleemoplossing|problem-?solving/i, 'tech:probleemoplossing'],
      ];
      for (const [re, key] of TRIGGERS) {
        if (re.test(text) && !plan.kgCitations.includes(key)) {
          return { ruleId: 'OP-7', description: `technique "${key}" is not grounded in the knowledge graph`, excerpt: (text.match(re) ?? [''])[0] };
        }
      }
      return null;
    },
  },
  {
    id: 'OP-8',
    description: 'Reply length respects the plan bound (+1 sentence tolerance)',
    applies: () => true,
    check: (text, plan) => {
      const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0).length;
      return sentences <= plan.maxSentences + 1
        ? null
        : { ruleId: 'OP-8', description: `reply too long (${sentences} > ${plan.maxSentences + 1})`, excerpt: '' };
    },
  },
  {
    id: 'OP-9',
    description: 'No self-harm method instructions, quantities or timelines',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b(hoeveel pillen|hoe diep (moet|snijd)|hoe lang voordat|most effective way|how many pills|lethal dose|dodelijke dosis|efficiëntste manier)\b/i);
      return m ? { ruleId: 'OP-9', description: 'method instruction detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-10',
    description: 'No promises of cure, outcomes or guarantees',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b((ik )?(beloof|garandeer|zweer)|guarantee|it will (all )?be (fine|okay)|het wordt (zeker|bepaald) (beter|goed)|alles komt goed)\b/i);
      return m ? { ruleId: 'OP-10', description: 'outcome guarantee detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-11',
    description: 'Reply language must match the plan language',
    applies: () => true,
    check: (text, plan) => {
      if (plan.language === 'nl') {
        const hits = countMatches(text, /\b(you|your|we're|don't|i'm|it's|feel free)\b/gi);
        if (hits >= 2) return { ruleId: 'OP-11', description: 'English reply on a Dutch plan', excerpt: (text.match(/\b(you|your|don't|i'm)\b/i) ?? [''])[0] };
      } else {
        const hits = countMatches(text, /\b(je |jouw|ons |ik ben het|niet waar|heel even)\b/gi);
        if (hits >= 3) return { ruleId: 'OP-11', description: 'Dutch reply on an English plan', excerpt: (text.match(/\b(je |jouw)\b/i) ?? [''])[0] };
      }
      return null;
    },
  },
  {
    id: 'OP-12',
    description: 'Crisis-family replies must end with an explicit check-in question',
    applies: (plan) => plan.action === 'CRISIS_PROTOCOL' || plan.action === 'SAFETY_RESPONSE',
    check: (text, plan) => {
      return hasClosingCheckIn(text, plan.language)
        ? null
        : { ruleId: 'OP-12', description: 'safety reply lacks a closing wellbeing/support check-in', excerpt: text.slice(-80) };
    },
  },
  {
    id: 'OP-13',
    description: 'No diagnostic questions posed to the user',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b((heb|heeft) je (depressie|adhd|autisme|ptsd|een angststoornis|een burn-?out)|(do|does) you have (depression|adhd|ptsd|autism|an anxiety disorder))\b/i);
      return m ? { ruleId: 'OP-13', description: 'diagnostic question detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-14',
    description: 'No claims of storing personal data — data is never stored',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b(ik sla (je |het |de )(nummer|adres|gegevens|telefoon) op|i will (store|save) your)\b/i);
      return m ? { ruleId: 'OP-14', description: 'data-storage claim detected', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-15',
    description: 'Every help line the plan requires (113 / 112 / Veilig Thuis) appears in the reply — for every action, not only crisis',
    applies: (plan) => plan.mustInclude.some((m) => /113|112|0800-2000/.test(m)),
    check: (text, plan) => {
      for (const res of requiredResources(plan)) {
        const resource = res.label === '113' ? '113' : res.label === '112' ? '112' : '0800-2000';
        if (!hasActionableContact(text, resource)) {
          return { ruleId: 'OP-15', description: `required help line ${res.label} not offered as a contact option`, excerpt: '' };
        }
      }
      return null;
    },
  },
  {
    id: 'OP-16',
    description: 'No advice or suggestions unless this turn\'s strategy is a suggestion (Hill/ESConv: understand before acting) — covers opening, exploring and focus',
    applies: (plan) => plan.action === 'THERAPEUTIC_DIALOG' && !!plan.strategy && !['SUGGESTION', 'INFORMATION', 'AFFIRMATION'].includes(plan.strategy),
    check: (text) => {
      const m = text.match(/\b(je (zou|moet) (eens |misschien )?(moeten |kunnen )?(proberen|beginnen|stoppen)|mijn advies|ik raad (je )?aan|probeer (eens|dan)|you should (try|start|stop)|my advice|i (would )?recommend|try to (start|stop|do))\b/i);
      return m ? { ruleId: 'OP-16', description: 'advice given while the strategy is not a suggestion (understand first)', excerpt: m[0] } : null;
    },
  },
  {
    id: 'OP-17',
    description: 'No invented self-disclosure — the assistant has no own life story (honesty)',
    applies: () => true,
    check: (text) => {
      const m = text.match(/\b(dat heb ik (zelf )?ook (gehad|meegemaakt)|toen ik (zelf )?(jong|student|depressief|ziek) was|ik ken dat gevoel uit eigen ervaring|i('ve| have) been (there|through that) (myself|too)|when i was (young|a student|depressed)|from my own experience)\b/i);
      return m ? { ruleId: 'OP-17', description: 'invented personal experience (self-disclosure) detected', excerpt: m[0] } : null;
    },
  },
];

interface RequiredResource { label: string; present: RegExp; line: { nl: string; en: string } }

const RESOURCE_LINES: { needle: RegExp; res: RequiredResource }[] = [
  {
    needle: /113/,
    res: {
      label: '113',
      present: /113|0800-0113|1813/,
      line: {
        nl: 'Gaat het om je veiligheid of wil je niet meer leven: bel 113 of 0800-0113, gratis, dag en nacht.',
        en: 'If this is about your safety or not wanting to live: call 113 or 0800-0113, free, day and night.',
      },
    },
  },
  {
    needle: /112/,
    res: { label: '112', present: /112/, line: { nl: 'Bij acuut gevaar: bel 112.', en: 'In acute danger: call 112.' } },
  },
  {
    needle: /0800-2000/,
    res: {
      label: 'Veilig Thuis 0800-2000',
      present: /0800-2000/,
      line: { nl: 'Veilig Thuis is bereikbaar via 0800-2000, gratis en anoniem.', en: 'Veilig Thuis (the Dutch domestic-violence line) is reachable at 0800-2000, free and anonymous.' },
    },
  },
];

/** The help lines a plan obliges the reply to carry. */
export function requiredResources(plan: Pick<Plan, 'mustInclude'>): RequiredResource[] {
  return RESOURCE_LINES.filter((r) => plan.mustInclude.some((m) => r.needle.test(m))).map((r) => r.res);
}

/** Number of output-policy rules (for the verification dashboard). */
export const OUTPUT_POLICY_RULE_COUNT = RULES.length;
/** Output-policy rule ids (resolved by the support-core reference check). */
export const OUTPUT_POLICY_RULE_IDS = RULES.map((r) => r.id);

export function verifyOutput(text: string, plan: Plan): { pass: boolean; violations: OutputViolation[] } {
  const violations: OutputViolation[] = [];
  for (const rule of RULES) {
    if (!rule.applies(plan)) continue;
    const v = rule.check(text, plan);
    if (v) violations.push(v);
  }
  return { pass: violations.length === 0, violations };
}

export function violationFeedback(violations: OutputViolation[], lang: 'nl' | 'en'): string[] {
  return violations.map((v) =>
    lang === 'nl' ? `${v.description} (regel ${v.ruleId}${v.excerpt ? `, gevonden: "${v.excerpt}"` : ''})` : `${v.description} (rule ${v.ruleId}${v.excerpt ? `, found: "${v.excerpt}"` : ''})`,
  );
}

/** Human-written fail-safe replies, per action family, NL + EN. */
export const CANNED_REPLIES: Record<string, { nl: string; en: string }> = {
  CRISIS_PROTOCOL: {
    nl: 'Wat je nu draagt is zwaar, en je hebt het goed dat je het zegt. Dit verdient echte menselijke steun — nu. Bel 113 Zelfmoordpreventie via 113 of 0800-0113, gratis, dag en nacht. Je ertoe zetten om te bellen is geen zwakte; het is een stap naar mensen die hier écht voor zijn opgeleid. Blijf je even bij me in de chat terwijl je eraan denkt?',
    en: "What you're carrying right now is heavy, and you did well to say it. This deserves real human support — now. Call 113 Suicide Prevention at 113 or 0800-0113, free, day and night. Reaching out is not weakness; it's a step towards people trained exactly for this. Stay with me in chat while you think about it?",
  },
  SAFETY_RESPONSE: {
    nl: 'Ik neem serieus wat je net zei. Zulke gedachten verdienen meer dan een chatvenster — praat met iemand: je huisarts, of 113 via 113 of 0800-0113. Mag ik je vragen: heb je op dit moment iemand in de buurt bij wie je terecht kunt?',
    en: "I take seriously what you just said. Thoughts like these deserve more than a chat window — talk to someone: your GP, or 113 at 113 or 0800-0113. May I ask: do you have someone around you right now you could turn to?",
  },
  REFERRAL: {
    nl: 'Wat je beschrijft klinkt als iets dat al lang op je drukt. Dat verdient zorg die verder gaat dan wat ik kan bieden. Je huisarts is een goede eerste stap — die kan meedenken over wat past. En hier mag je verder vertellen; ik luister.',
    en: "What you describe sounds like something that has been weighing on you for a long time. It deserves care beyond what I can offer. Your GP is a good first step — they can help figure out what fits. And you can keep telling me things here; I'm listening.",
  },
  THERAPEUTIC_DIALOG: {
    nl: 'Bedankt dat je dit deelt. Ik hoor verdriet en vermoeidheid in je woorden, en dat mag er gewoon zijn. Soms helpt het om één klein ding te doen dat richting geeft — een korte wandeling, of even iemand een berichtje sturen. Hoe klinkt dat in jouw situatie?',
    en: 'Thank you for sharing this. I hear sadness and tiredness in your words, and that is allowed to be there. Sometimes it helps to do one small thing that gives direction — a short walk, or texting one person. How does that land in your situation?',
  },
  PSYCHOEDUCATION: {
    nl: 'Goede vraag. Ik ben een demonstrator van een neuro-symbolisch systeem: een taalmodel dat alleen mag antwoorden binnen een symbolisch beslishuis dat wiskundig geverifieerd wordt. Ik ben geen therapeut en stel geen diagnoses. Wat zou je graag willen weten over hoe dat werkt?',
    en: 'Good question. I am a demonstrator of a neuro-symbolic system: a language model allowed to answer only inside a mathematically verified symbolic decision house. I am not a therapist and do not diagnose. What would you like to know about how that works?',
  },
  CLARIFY: {
    nl: 'Ik wil je goed begrijpen, en ik ben er nog niet helemaal. Zou je in je eigen woorden kunnen vertellen wat er het zwaarst weegt op dit moment?',
    en: "I want to understand you well, and I'm not quite there yet. Could you tell me in your own words what weighs the most right now?",
  },
  ABSTAIN_HITL: {
    nl: 'Bedankt voor je vertrouwen. Ik moet eerlijk zijn: ik weet niet zeker genoeg wat hier het beste past, en dit is te belangrijk om te gokken. Dit soort berichten zet ik apart, zodat een mens later kan beoordelen hoe ik ermee om moet gaan — dat gebeurt niet nu meteen. Als het nu echt zwaar is: 113 is er dag en nacht (bel 113 of 0800-0113). Mag je meer vertellen?',
    en: 'Thank you for trusting me with this. To be honest: I am not confident enough about what fits best here, and this matters too much to guess. I set messages like this aside so a human can later judge how I should handle them — that does not happen right now. If things are truly heavy right now: 113 is there day and night (call 113 or 0800-0113). Could you tell me more?',
  },
  BOUNDARY_REFUSAL: {
    nl: 'Dat kan ik niet doen — het valt buiten waar ik voor sta, en contactgegevens heb ik ook niet nodig (en sla ik nooit op). Waar het om gaat is jij. Wat speelt er vandaag echt in jou?',
    en: "I can't do that — it's outside what I stand for, and I don't need your contact details either (and never store them). What matters is you. What's really going on for you today?",
  },
};

/**
 * Rule-specific fail-safe replies — used when a rule's situation differs
 * enough from its action family that the family reply would say something
 * untrue (P67: we did NOT read the message, so "I take seriously what you
 * said" would be a false claim).
 */
/** Fail-safe reply for disclosed abuse/violence at home (trauma-informed: believe, not your fault, Veilig Thuis). */
export const CANNED_ABUSE = {
  nl: 'Ik geloof je, en het is goed dat je dit vertelt. Wat er met je gebeurt is niet jouw schuld. Veilig Thuis is bereikbaar via 0800-2000, gratis en anoniem, dag en nacht; bij acuut gevaar bel je 112. Als het jou zelf te veel wordt, kun je 113 bellen via 0800-0113. Wil je vertellen hoe veilig je je op dit moment voelt?',
  en: "I believe you, and it's good that you tell me this. What is happening to you is not your fault. Veilig Thuis (the Dutch domestic-violence line) is reachable at 0800-2000, free and anonymous, day and night; in acute danger call 112. If it gets too much for you, you can call 113 (0800-0113). Would you tell me how safe you feel right now?",
};

export const CANNED_BY_RULE: Record<string, { nl: string; en: string }> = {
  C02: {
    nl: 'Fijn dat je verder vertelt. Ik denk nog even terug aan wat je eerder in ons gesprek zei, en 113 blijft er dag en nacht voor je (bel 113 of 0800-0113). Hoe gaat het nu met je, vergeleken met daarnet?',
    en: "I'm glad you keep telling me. I'm still thinking of what you said earlier in our conversation, and 113 stays there for you day and night (call 113 or 0800-0113). How are you doing now, compared to earlier?",
  },
  P03: {
    nl: 'Ik hoor hoeveel woede en spanning er nu in je zit, en het is goed dat je het hier zegt. Is er acuut gevaar voor jou of iemand anders: bel nu 112. De crisisdienst of huisartsenpost van je regio kan ook direct meedenken, en je kunt 113 bellen via 0800-0113 als het jou zelf te veel wordt. Ben je op dit moment veilig?',
    en: "I can hear how much anger and tension is in you right now, and it's good that you say it here. If there is acute danger for you or someone else: call 112 now. The crisis service or out-of-hours GP in your region can help straight away, and you can call 113 (0800-0113) if it gets too much for you. Are you safe right now?",
  },
  P67: {
    nl: 'Ik kon je bericht net niet goed genoeg lezen, en ik wil niet gokken bij iets wat belangrijk kan zijn. Als het gaat om je veiligheid of als je niet meer wilt leven: bel 113 of 0800-0113, gratis, dag en nacht. Wil je in je eigen woorden nog eens vertellen wat er speelt?',
    en: "I couldn't read your message reliably just now, and I don't want to guess about something that may matter. If this is about your safety or not wanting to live: call 113 or 0800-0113, free, day and night. Would you tell me again, in your own words, what is going on?",
  },
};

/**
 * Strategy-specific fail-safe replies for the dialogue family: the family
 * reply offers a small step, which in the explore phase would itself break
 * the plan (OP-16). These follow the conversation layer's strategy instead.
 */
export const CANNED_BY_STRATEGY: Partial<Record<SupportStrategy, { nl: string; en: string }>> = {
  QUESTION: {
    nl: 'Fijn dat je dit hier deelt. Ik wil graag goed begrijpen wat er bij je speelt. Wat houdt je op dit moment het meest bezig?',
    en: "Thank you for sharing this here. I'd like to understand well what is going on for you. What is on your mind most right now?",
  },
  RESTATEMENT: {
    nl: 'Als ik je goed begrijp, speelt er op dit moment iets dat veel van je vraagt. Klopt dat, of zit het anders?',
    en: 'If I understand you right, something is going on right now that asks a lot of you. Is that right, or is it different?',
  },
  REFLECTION: {
    nl: 'Het klinkt alsof dit veel van je vraagt, en dat het je echt raakt. Wil je er wat meer over vertellen?',
    en: 'It sounds like this asks a lot of you, and that it really touches you. Would you tell me a bit more about it?',
  },
  SUMMARY: {
    nl: 'Je hebt al een paar dingen gedeeld die zwaar wegen. Als je ze naast elkaar legt: wat is nu het belangrijkste om samen naar te kijken?',
    en: "You've shared a few things that weigh heavily. If you put them side by side: what matters most to look at together now?",
  },
  AFFIRMATION: {
    nl: 'Wat goed dat je dit zo onder woorden brengt en dat je ermee bezig bent — dat vraagt moeite. Wat wil je hieruit meenemen voor de komende dagen?',
    en: "It's good that you put this into words and that you're working on it — that takes effort. What would you like to take from this into the coming days?",
  },
  REPAIR: {
    nl: 'Je hebt gelijk dat dit niet goed liep, en het is begrijpelijk dat je daar gefrustreerd over bent. Dat ligt aan mij, niet aan jou. Wat zou je nu het meest helpen?',
    en: "You're right that this didn't go well, and it makes sense that you're frustrated about it. That's on me, not on you. What would help you most right now?",
  },
};

/**
 * The human-written fail-safe reply for a concrete plan. Starts from the
 * rule-specific or action-family text and inserts every help line the plan
 * requires but the text lacks (before the closing question, so OP-12 keeps
 * holding). Single production source for canned replies.
 */
export function cannedReplyFor(plan: Pick<Plan, 'action' | 'mustInclude' | 'language'> & { ruleId?: string; strategy?: SupportStrategy }): string {
  const lang = plan.language;
  const byStrategy = plan.strategy && (plan.action === 'THERAPEUTIC_DIALOG' || plan.strategy === 'REPAIR') ? CANNED_BY_STRATEGY[plan.strategy]?.[lang] : undefined;
  const abuse = (plan.action === 'SAFETY_RESPONSE' || plan.action === 'CRISIS_PROTOCOL') && plan.mustInclude.some((m) => /0800-2000/.test(m)) ? CANNED_ABUSE[lang] : undefined;
  const base = (plan.ruleId && CANNED_BY_RULE[plan.ruleId]?.[lang])
    ?? abuse
    ?? byStrategy
    ?? CANNED_REPLIES[plan.action]?.[lang]
    ?? CANNED_REPLIES.SAFETY_RESPONSE[lang];
  const missing = requiredResources(plan).filter((r) => !r.present.test(base)).map((r) => r.line[lang]);
  if (missing.length === 0) return base;
  // Insert before the last sentence when it is a question; else append.
  const parts = base.match(/[^.!?]+[.!?]+/g) ?? [base];
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last.trim().endsWith('?')) {
    return [...parts.slice(0, -1).map((p) => p.trim()), ...missing, last.trim()].join(' ');
  }
  return [base.trim(), ...missing].join(' ');
}
