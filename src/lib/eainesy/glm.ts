/**
 * GLM bridge — the neural side of EAInesy.
 * Backend-only (z-ai-web-dev-sdk). Two entry points:
 *   - parseFrame:  utterance → typed Frame (schema-validated, 1 repair retry)
 *   - generateReply: plan-constrained therapeutic reply
 * All responses that fail validation are returned as null / flagged —
 * the symbolic side decides what to do with failures (fail-closed).
 */
import { completeModel } from './model-provider';
import { FrameSchema, type Frame, type Plan } from './types';

const FRAME_SCHEMA_PROMPT = `You are the semantic parser of EAInesy, a neuro-symbolic support assistant (Dutch + English).
Parse the user's LAST message into a strict JSON object. Respond with JSON ONLY, no markdown fences, no commentary.

Schema:
{
  "intent": one of ["CRISIS_SIGNAL","DEPRESSIVE_REPORT","ANXIETY_REPORT","PANIC_REPORT","GRIEF","WORK_STRESS","RELATIONSHIP_ISSUE","LONELINESS_REPORT","SELF_WORTH_INJURY","SLEEP_ISSUE","STUDY_PRESSURE","SUBSTANCE_CONCERN","MEDICATION_QUESTION","PREGNANCY_POSTNATAL","CAREGIVER_BURDEN","FINANCIAL_STRESS","ABUSE_DISCLOSURE","VIOLENCE_RISK","PSYCHOSIS_SIGNAL","TRAUMA_REPORT","EATING_CONCERN","BULLYING_REPORT","IDENTITY_DISTRESS","ALLIANCE_RUPTURE","POSITIVE_PROGRESS","GENERAL_VENT","THERAPY_REQUEST","OUT_OF_SCOPE","DIAGNOSIS_REQUEST","META_QUESTION"],
  "emotions": up to 8 short lowercase emotion words in the user's language (e.g. "verdriet","angst","leegte","sad","angry"),
  "topics": up to 8 short lowercase topic words in the user's language (e.g. "werk","slaap","relatie","work","sleep"),
  "riskMarkers": [{"type": one of ["SELF_HARM","SUICIDAL_IDEATION","HOPELESSNESS","ISOLATION","SUBSTANCE","AGENCY_PLAN","HARM_OTHERS","ABUSE_MARK","BURDENSOMENESS"], "evidence": the exact quoted fragment}],
  "language": "nl" or "en",
  "paraphrase": one neutral sentence restating what the user expressed,
  "parseConfidence": number 0..1 — your own confidence in this parse,
  "changeTalk": true when the user expresses wanting, being able, having reasons, needing or committing to change ("ik wil iets veranderen", "ik ga het proberen", "I want to feel better"), else false,
  "asksForHelp": true when the user explicitly asks what to do or for suggestions ("wat kan ik doen?", "heb je tips?", "how can I…?"), else false
}

Guidelines:
- Be LIBERAL with riskMarkers: anything hinting at self-harm, suicide, hopeless blackness, being utterly alone, plans/preparations, substance abuse, harm to OTHERS, or abuse/maltreatment belongs there. Missing a risk marker is the worst possible error.
- RESPECT NEGATION: quote the full clause and only emit a riskMarker when the risk itself is affirmed. "Ik ga me niet pijn doen" (I will NOT hurt myself), "Ik wil niet dood", "I don't want to die" describe the ABSENCE of risk — do not mark them; use the underlying emotion instead.
- "I want to end it", "ik wil niet meer leven", "ik wil dood", "ik zie het niet meer zitten" (also HOPELESSNESS), "de pijn stoppen", "wouldn't mind not waking up", "er liever niet meer zijn", "iedereen is beter af zonder mij", "nobody would miss me" → SUICIDAL_IDEATION.
- "ik ben een last voor iedereen", "I'm a burden", "mijn familie heeft meer aan me als ik er niet ben" → BURDENSOMENESS (Joiner: perceived burdensomeness). Combine with SUICIDAL_IDEATION when both are present.
- "I'll make him pay", "hij verdient het dood te worden", "kill them", "wraak nemen" → HARM_OTHERS (risk directed at other people).
- "hij slaat me", "thuis is het niet veilig", "he forces me", "mishandeld" → ABUSE_MARK and intent ABUSE_DISCLOSURE (someone is being hurt or controlled).
- Casual small talk that suddenly contains a heavy sentence is still a CRISIS_SIGNAL intent.
- PANIC_REPORT is for panic attacks and bodily alarm (hart bonkt, hyperventileren, can't breathe).
- PSYCHOSIS_SIGNAL is for hearing voices, paranoia, feeling watched or controlled by outside forces, thoughts not feeling like one's own. Quote evidence, never interpret.
- TRAUMA_REPORT is for flashbacks, nightmares after frightening events, hypervigilance — past frightening experiences still intruding now.
- EATING_CONCERN is for restricting, bingeing, purging, fear of weight gain, harsh body-image distress.
- MEDICATION_QUESTION is for questions about medication: own antidepressants or other psychotropics, dosage, stopping/starting, side effects, "mag ik mijn pil verdubbelen". Not for crisis language — crisis outranks.
- PREGNANCY_POSTNATAL is for distress anchored in pregnancy, birth or the postpartum period: baby blues, postnatal depression, intrusive fears around the baby, pregnancy loss, fear of giving birth. The perinatal context must dominate the message.
- CAREGIVER_BURDEN is for being worn down by caring for a sick or elderly loved one (mantelzorg): overloading, no rest, guilt about not coping.
- FINANCIAL_STRESS is for debt, bills, eviction fear or money pressure as the dominant stressor. Not for general anxiety without a financial anchor.
- STUDY_PRESSURE is for study, exam, thesis or education workload as the dominant stressor: fear of failing, falling behind, overwork as a student.
- DIAGNOSIS_REQUEST is for explicitly asking whether they have a disorder, or for a diagnosis or label ("heb ik een depressie?", "welke stoornis heb ik?"). NOT for describing symptoms — symptoms stay in the underlying intent (somberness stays DEPRESSIVE_REPORT).
- BULLYING_REPORT is for being bullied, excluded, harassed at school/work/online.
- IDENTITY_DISTRESS is for distress about sexuality, gender identity, coming out, not feeling at home in one's identity. Never pathologise — the identity itself is never the problem; the DISTRESS is.
- ALLIANCE_RUPTURE is for frustration with THIS bot: "you don't understand me", "this is useless", "I'm done with this app", "jij luistert niet".
- SLEEP_ISSUE is for sleep problems as the main theme. SUBSTANCE_CONCERN is for alcohol/drugs/medication-as-coping talk without crisis markers.
- LONELINESS_REPORT is for loneliness as the main theme. SELF_WORTH_INJURY is for harsh self-judgement ("ik ben een mislukking").
- OUT_OF_SCOPE is for requests like predictions, homework, medical prescriptions, factual trivia, tasks.
- META_QUESTION / THERAPY_REQUEST is for questions about how this service works or how to find therapy.
- Never invent evidence; quote only what the user actually wrote.`;

/** Parse an utterance into a validated Frame, or null when unparseable. */
export async function parseFrame(text: string, recentHistory: { role: 'user' | 'assistant'; content: string }[]): Promise<Frame | null> {
  try {
    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: FRAME_SCHEMA_PROMPT },
    ];
    for (const h of recentHistory.slice(-4)) {
      messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content.slice(0, 500) });
    }
    messages.push({ role: 'user', content: text });

    let raw = await completeModel(messages, 0.1);
    let frame = raw === null ? null : tryParseFrame(raw);
    if (frame) return frame;

    // one repair retry with the validation error feedback
    if (raw !== null) {
      messages.push({ role: 'assistant', content: raw.slice(0, 800) });
    }
    messages.push({
      role: 'user',
      content: 'Your previous reply was not valid JSON for the schema. Reply again with STRICT JSON only, matching the schema exactly.',
    });
    raw = await completeModel(messages, 0.0);
    return raw === null ? null : tryParseFrame(raw);
  } catch {
    return null;
  }
}

function tryParseFrame(raw: string | null): Frame | null {
  if (!raw) return null;
  const jsonSlice = extractJson(raw);
  if (!jsonSlice) return null;
  try {
    const parsed = JSON.parse(jsonSlice);
    const result = FrameSchema.safeParse(parsed);
    if (result.success) return result.data;
    // tolerate minor deviations: coerce and retry once
    const coerced = FrameSchema.safeParse({
      ...parsed,
      parseConfidence: typeof parsed.parseConfidence === 'number' ? parsed.parseConfidence : 0.5,
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.map(String).slice(0, 8) : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String).slice(0, 8) : [],
      riskMarkers: Array.isArray(parsed.riskMarkers) ? parsed.riskMarkers : [],
      paraphrase: typeof parsed.paraphrase === 'string' ? parsed.paraphrase : '',
    });
    return coerced.success ? coerced.data : null;
  } catch {
    return null;
  }
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

export interface GenerationInput {
  plan: Plan;
  frame: Frame | null;
  techniqueLines: string[];   // grounded technique/resource lines the reply may use
  history: { role: 'user' | 'assistant'; content: string }[];
  violationFeedback?: string[];
  /** User steering hint ("bijsturing") — flavour only; the plan stays binding. */
  style?: 'concise' | 'normal' | 'elaborate';
  /** Conversation layer brief: where we are and what this turn should do. */
  conversation?: {
    phaseGoal: string;
    strategyInstruction: string;
    focus: string[];
    riskMemory: 'NONE' | 'RECENT' | 'ACTIVE';
    turn: number;
  };
}

const TONE_NL: Record<Plan['tone'], string> = {
  warm: 'warm en menselijk',
  calm: 'kalm en stabiel',
  direct: 'direct en zorgzaam',
  validating: 'validerend en aandachtig',
  boundaried: 'vriendelijk maar duidelijk begrensd',
};

/** Generate the reply under the symbolic plan's constraints. */
export async function generateReply(input: GenerationInput): Promise<string | null> {
  const { plan, frame, techniqueLines, history, violationFeedback, style, conversation } = input;
  const lang = plan.language;
  const styleLine = style === 'concise'
    ? (lang === 'nl' ? 'Stijlwens: hou het kort en krachtig.' : 'Style wish: keep it short and to the point.')
    : style === 'elaborate'
      ? (lang === 'nl' ? 'Stijlwens: je mag iets uitgebreider zijn, binnen de zinnengrens.' : 'Style wish: you may elaborate a little, within the sentence bound.')
    : '';
  const convNl = conversation
    ? `\nGESPREKSREGIE (bindend):\n- Fase: ${plan.phase ?? 'onbekend'} — ${conversation.phaseGoal}\n- Strategie deze beurt: ${plan.strategy ?? '—'} — ${conversation.strategyInstruction}${conversation.focus.length ? `\n- Afgesproken focus: ${conversation.focus.join(', ')}` : ''}${conversation.riskMemory !== 'NONE' ? '\n- Eerder in dit gesprek klonk een risicosignaal: wees extra zorgvuldig en check kort hoe het nu gaat.' : ''}\n- Verzin nooit eigen ervaringen ("dat heb ik ook gehad"): je hebt geen eigen levensverhaal.\n`
    : '';
  const convEn = conversation
    ? `\nCONVERSATION GUIDANCE (binding):\n- Phase: ${plan.phase ?? 'unknown'} — ${conversation.phaseGoal}\n- Strategy this turn: ${plan.strategy ?? '—'} — ${conversation.strategyInstruction}${conversation.focus.length ? `\n- Agreed focus: ${conversation.focus.join(', ')}` : ''}${conversation.riskMemory !== 'NONE' ? '\n- Earlier in this conversation there was a risk signal: be extra careful and briefly check how they are doing now.' : ''}\n- Never invent own experiences ("I've been there too"): you have no life story of your own.\n`
    : '';
  try {
    const isNl = lang === 'nl';
    const system = isNl
      ? `Je bent EAInesy, een ondersteunende luisterassistent (GEEN therapeut, geen crisisdienst).
Je antwoord strikt binnen het beslisplan dat je krijgt. Schrijf in het Nederlands.

BESLISPLAN (bindend):
- Actie: ${plan.action}
- Toon: ${TONE_NL[plan.tone]}
- Gebruik deze zetten: ${plan.allowedMoves.join('; ') || '—'}
- Verboden: ${plan.forbiddenMoves.join('; ') || '—'}
- Moet bevatten: ${plan.mustInclude.join('; ') || '—'}
- Maximaal ${plan.maxSentences} zinnen. Geen opsommingstekens, geen kopjes, gewoon lopende tekst.
${styleLine}
${convNl}
Onderbouwde kennis (gebruik ALLÉEN deze technieken/informatie, verzin niets):
${techniqueLines.map((t) => `- ${t}`).join('\n') || '- (geen technieken in dit plan)'}

${violationFeedback ? `\nBELANGRIJK — je vorige antwoord verbrak het beleid:\n${violationFeedback.map((v) => `- ${v}`).join('\n')}\nSchrijf een nieuw antwoord ZONDER deze overtredingen.` : ''}
${frame?.paraphrase ? `\nHerformulering van wat de gebruiker zei: "${frame.paraphrase}"` : ''}`
      : `You are EAInesy, a supportive listening assistant (NOT a therapist, not a crisis service).
You answer strictly inside the decision plan you are given. Write in English.

DECISION PLAN (binding):
- Action: ${plan.action}
- Tone: ${plan.tone}
- Use these moves: ${plan.allowedMoves.join('; ') || '—'}
- Forbidden: ${plan.forbiddenMoves.join('; ') || '—'}
- Must include: ${plan.mustInclude.join('; ') || '—'}
- At most ${plan.maxSentences} sentences. No bullet points, no headers, flowing text only.
${styleLine}
${convEn}
Grounded knowledge (use ONLY these techniques/information, invent nothing):
${techniqueLines.map((t) => `- ${t}`).join('\n') || '- (no techniques in this plan)'}

${violationFeedback ? `\nIMPORTANT — your previous reply broke policy:\n${violationFeedback.map((v) => `- ${v}`).join('\n')}\nWrite a new reply WITHOUT these violations.` : ''}
${frame?.paraphrase ? `\nRestatement of what the user said: "${frame.paraphrase}"` : ''}`;

    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: system },
    ];
    // history INCLUDES the current user message as its last entry
    for (const h of history.slice(-6)) {
      messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content.slice(0, 700) });
    }

    const raw = await completeModel(messages, violationFeedback ? 0.3 : 0.65);
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
}
