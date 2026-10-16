/**
 * Knowledge-graph DATA — pure, bilingual (NL/EN), importable from client and
 * server code (no db import here; see kg.ts for the runtime).
 *
 * Ontology: Emotion, Topic, Technique, Resource nodes; weighted relations;
 * forward-chaining rules whose derived facts are logged into the audit ledger.
 * Techniques suggested to the user MUST be reachable through this graph —
 * the generator cannot invent them (output rule OP-7).
 */

export interface KGNodeData {
  nl: string;
  en: string;
  prompt?: string;   // grounding prompt a technique may offer
  detail?: string;   // for resources: the actual handoff info
}

export interface KGNodeDef {
  key: string;
  type: 'Emotion' | 'Topic' | 'Technique' | 'Resource';
  nl: string;
  en: string;
  data: KGNodeData;
}

export interface KGEdgeDef {
  from: string;
  to: string;
  rel: 'ADDRESSES' | 'RELATES' | 'COVERS' | 'SUPPORTS';
  weight?: number;
}

export interface ChainContext {
  intent: string;
  emotions: string[];   // keys, e.g. "emotion:angst"
  topics: string[];     // keys, e.g. "topic:werk"
  distress: string;     // DistressLevel
  turnCount: number;
  riskLevel: string;
}

export interface ChainRuleDef {
  id: string;
  desc: { nl: string; en: string };
  when: (ctx: ChainContext) => boolean;
  addTopics?: string[];
  addEmotions?: string[];
  addTechniques?: string[];
  addResources?: string[];
  derived: string;
}

// ---------------------------------------------------------------------------
// Nodes — 78
// ---------------------------------------------------------------------------

export const KG_NODES: KGNodeDef[] = [
  // ── Emotions (16) ────────────────────────────────────────────────────────
  { key: 'emotion:verdriet', type: 'Emotion', nl: 'verdriet', en: 'sadness', data: { nl: 'Verdriet en somberheid', en: 'Sadness and low mood' } },
  { key: 'emotion:angst', type: 'Emotion', nl: 'angst', en: 'anxiety', data: { nl: 'Angst en spanning', en: 'Anxiety and tension' } },
  { key: 'emotion:paniek', type: 'Emotion', nl: 'paniek', en: 'panic', data: { nl: 'Paniek en lichamelijke onrust', en: 'Panic and bodily alarm' } },
  { key: 'emotion:boosheid', type: 'Emotion', nl: 'boosheid', en: 'anger', data: { nl: 'Boosheid en irritatie', en: 'Anger and irritation' } },
  { key: 'emotion:leegte', type: 'Emotion', nl: 'leegte', en: 'emptiness', data: { nl: 'Leegte en doelloosheid', en: 'Emptiness and purposelessness' } },
  { key: 'emotion:schaamte', type: 'Emotion', nl: 'schaamte', en: 'shame', data: { nl: 'Schaamte en schuld', en: 'Shame and guilt' } },
  { key: 'emotion:onzekerheid', type: 'Emotion', nl: 'onzekerheid', en: 'insecurity', data: { nl: 'Onzekerheid en zelfbeeld', en: 'Insecurity and self-image' } },
  { key: 'emotion:eenzaamheid', type: 'Emotion', nl: 'eenzaamheid', en: 'loneliness', data: { nl: 'Eenzaamheid', en: 'Loneliness' } },
  { key: 'emotion:hoop', type: 'Emotion', nl: 'hoop', en: 'hope', data: { nl: 'Hoop en vooruitzicht', en: 'Hope and forward pull' } },
  { key: 'emotion:opluchting', type: 'Emotion', nl: 'opluchting', en: 'relief', data: { nl: 'Opluchting en trots', en: 'Relief and pride' } },
  { key: 'emotion:verlies', type: 'Emotion', nl: 'rouw / verlies', en: 'grief / loss', data: { nl: 'Rouw en verlies', en: 'Grief and loss' } },
  { key: 'emotion:overweldiging', type: 'Emotion', nl: 'overweldiging', en: 'overwhelm', data: { nl: 'Overweldigd zijn door alles tegelijk', en: 'Being overwhelmed by everything at once' } },
  { key: 'emotion:moeheid', type: 'Emotion', nl: 'uitputting', en: 'exhaustion', data: { nl: 'Vermoeidheid en leegloop', en: 'Tiredness and burnout feelings' } },
  { key: 'emotion:frustratie', type: 'Emotion', nl: 'frustratie', en: 'frustration', data: { nl: 'Frustratie en vastlopen', en: 'Frustration and stuckness' } },
  { key: 'emotion:wanhoop', type: 'Emotion', nl: 'wanhoop', en: 'hopelessness', data: { nl: 'Wanhoop: het voelt alsof het nooit meer goed komt', en: 'Hopelessness: it feels like it will never get better' } },
  { key: 'emotion:rust', type: 'Emotion', nl: 'rust', en: 'calm', data: { nl: 'Rust en evenwicht', en: 'Calm and balance' } },

  // ── Topics (22) ──────────────────────────────────────────────────────────
  { key: 'topic:werk', type: 'Topic', nl: 'werk', en: 'work', data: { nl: 'Werk en drukte', en: 'Work and pressure' } },
  { key: 'topic:relatie', type: 'Topic', nl: 'relatie', en: 'relationship', data: { nl: 'Relaties en familie', en: 'Relationships and family' } },
  { key: 'topic:slaap', type: 'Topic', nl: 'slaap', en: 'sleep', data: { nl: 'Slaap en rust', en: 'Sleep and rest' } },
  { key: 'topic:zelfbeeld', type: 'Topic', nl: 'zelfbeeld', en: 'self-image', data: { nl: 'Zelfbeeld en waardering', en: 'Self-image and worth' } },
  { key: 'topic:verlies', type: 'Topic', nl: 'verlies', en: 'loss', data: { nl: 'Verlies en afscheid', en: 'Loss and farewell' } },
  { key: 'topic:toekomst', type: 'Topic', nl: 'toekomst', en: 'future', data: { nl: 'Toekomst en richting', en: 'Future and direction' } },
  { key: 'topic:gezondheid', type: 'Topic', nl: 'gezondheid', en: 'health', data: { nl: 'Gezondheid en lichaam', en: 'Health and body' } },
  { key: 'topic:studie', type: 'Topic', nl: 'studie', en: 'studies', data: { nl: 'Studie en presteren', en: 'Study and performing' } },
  { key: 'topic:eenzaamheid', type: 'Topic', nl: 'sociaal netwerk', en: 'social network', data: { nl: 'Vrienden, contacten, sociale gronding', en: 'Friends, contacts, social grounding' } },
  { key: 'topic:financien', type: 'Topic', nl: 'geldzorgen', en: 'money worries', data: { nl: 'Financiën en zekerheid', en: 'Finances and security' } },
  { key: 'topic:midelen', type: 'Topic', nl: 'middelengebruik', en: 'substance use', data: { nl: 'Alcohol, drugs, medicijngebruik als coping', en: 'Alcohol, drugs, medication use as coping' } },
  { key: 'topic:identiteit', type: 'Topic', nl: 'identiteit', en: 'identity', data: { nl: 'Wie ben ik, wat past bij mij', en: 'Who am I, what fits me' } },
  { key: 'topic:zorg', type: 'Topic', nl: 'zorgen voor anderen', en: 'caring for others', data: { nl: 'Mantelzorg, ouderschap, zorgen voor anderen', en: 'Caregiving, parenthood, caring for others' } },
  { key: 'topic:paniek', type: 'Topic', nl: 'paniekaanvallen', en: 'panic attacks', data: { nl: 'Paniekaanvallen en vluchtreacties', en: 'Panic attacks and flight responses' } },
  { key: 'topic:wonen', type: 'Topic', nl: 'wonen', en: 'housing', data: { nl: 'Woonsituatie en thuisgevoel', en: 'Living situation and feeling at home' } },
  { key: 'topic:vrijetijd', type: 'Topic', nl: 'vrije tijd', en: 'leisure', data: { nl: 'Ontspanning en hobby’s', en: 'Relaxation and hobbies' } },
  { key: 'topic:lichaam', type: 'Topic', nl: 'lichaam en spanning', en: 'body and tension', data: { nl: 'Spanning in het lichaam: hart, adem, schouders', en: 'Tension in the body: heart, breath, shoulders' } },
  { key: 'topic:gedachten', type: 'Topic', nl: 'piekergedachten', en: 'worry thoughts', data: { nl: 'Gedachten die blijven terugkomen', en: 'Thoughts that keep coming back' } },
  { key: 'topic:rouw', type: 'Topic', nl: 'rouwproces', en: 'grieving', data: { nl: 'Het verwerken van een verlies', en: 'Processing a loss' } },
  { key: 'topic:hoop', type: 'Topic', nl: 'vooruitzicht', en: 'outlook', data: { nl: 'Wat er wél goed gaat en richting geeft', en: 'What IS going well and gives direction' } },

  // ── Techniques (30) ──────────────────────────────────────────────────────
  { key: 'tech:ademruimte', type: 'Technique', nl: 'ademruimte', en: 'breathing space', data: { nl: 'Ademruimte: 4 tellen in, 6 uit, drie rondes.', en: 'Breathing space: count 4 in, 6 out, three rounds.', prompt: 'Zullen we samen een ademruimte van een minuut doen?' } },
  { key: 'tech:gronding', type: 'Technique', nl: 'grondingsoefening', en: 'grounding exercise', data: { nl: '5-4-3-2-1: noem 5 dingen die je ziet, 4 die je hoort, 3 die je voelt.', en: '5-4-3-2-1: name 5 things you see, 4 you hear, 3 you feel.', prompt: 'Gronden we even met 5-4-3-2-1?' } },
  { key: 'tech:gedachtekaart', type: 'Technique', nl: 'gedachtekaart', en: 'thought record', data: { nl: 'Gedachtekaart: situatie, gedachte, gevoel, alternatief.', en: 'Thought record: situation, thought, feeling, alternative.', prompt: 'Zullen we samen een gedachtekaart maken van dat moment?' } },
  { key: 'tech:activiteitenplanning', type: 'Technique', nl: 'activiteitenplanning', en: 'activity planning', data: { nl: 'Kies één kleine, haalbare activiteit voor morgen.', en: 'Pick one small, doable activity for tomorrow.', prompt: 'Zullen we één kleine activiteit voor morgen plannen?' } },
  { key: 'tech:sociale-kaart', type: 'Technique', nl: 'sociale kaart', en: 'support map', data: { nl: 'Wie is er? Wie zou je kunnen aanspreken?', en: 'Who is around? Who could you reach out to?', prompt: 'Helpt het om samen in kaart te brengen bij wie je terecht kunt?' } },
  { key: 'tech:slaaphygiene', type: 'Technique', nl: 'slaaphygiëne', en: 'sleep hygiene', data: { nl: 'Vaste tijden, schermen uit, rustige laatste uur.', en: 'Fixed times, screens off, calm last hour.', prompt: 'Zullen we naar je laatste uur voor het slapen kijken?' } },
  { key: 'tech:zelfcompassie', type: 'Technique', nl: 'zelfcompassie', en: 'self-compassion', data: { nl: 'Spreek jezelf aan zoals je een vriend zou toespreken.', en: 'Speak to yourself as you would to a friend.', prompt: 'Probeer die zin eens te herformuleren alsof je tegen een vriend praat — doen we?' } },
  { key: 'tech:waardenkompas', type: 'Technique', nl: 'waardenkompas', en: 'values compass', data: { nl: 'Wat doet er toe? Kies een kleine stap die richting geeft.', en: 'What matters? Pick one small step that points that way.', prompt: 'Zullen we één waarde pakken en een kleine stap daarnaartoe vinden?' } },
  { key: 'tech:zorguitstel', type: 'Technique', nl: 'zorguitstel', en: 'worry postponement', data: { nl: 'Zorgen krijgen een vaste plek: noteer ze en geef ze later 15 minuten aandacht.', en: 'Give worries a fixed slot: jot them down, give them 15 minutes later.', prompt: 'Zullen we je zorgen even parkeren voor een vast moment vanavond?' } },
  { key: 'tech:spierspanning', type: 'Technique', nl: 'progressieve spierontspanning', en: 'progressive muscle relaxation', data: { nl: 'Span de spieren 5 seconden aan, laat los, merk het verschil — van voeten naar gezicht.', en: 'Tense muscles 5 seconds, release, notice the difference — feet to face.', prompt: 'Zullen we de spierontspanning van voeten naar gezicht doorlopen?' } },
  { key: 'tech:adem-478', type: 'Technique', nl: '4-7-8-ademhaling', en: '4-7-8 breathing', data: { nl: 'Adem 4 in, houd 7 vast, adem 8 uit — vier rondes.', en: 'Breathe in 4, hold 7, out 8 — four rounds.', prompt: 'Doen we samen vier rondes 4-7-8-ademhaling?' } },
  { key: 'tech:lichaamsscan', type: 'Technique', nl: 'lichaamsscan', en: 'body scan', data: { nl: 'Loop met aandacht van je tenen naar je hoofd; niets veranderen, alleen opmerken.', en: 'Move attention from toes to head; change nothing, just notice.', prompt: 'Zullen we een korte lichaamsscan doen?' } },
  { key: 'tech:gedachte-diffusie', type: 'Technique', nl: 'gedachte-diffusie', en: 'cognitive defusion', data: { nl: 'Zeg "ik merk de gedachte dat…" in plaats van de gedachte als feiten.', en: 'Say "I notice the thought that…" instead of treating thoughts as facts.', prompt: 'Zullen we die gedachte eens herkaderen als "ik merk dat ik denk dat…”?' } },
  { key: 'tech:pijl-naar-beneden', type: 'Technique', nl: 'pijl-oefening', en: 'downward arrow', data: { nl: 'Vraag telkens: "wat zou dat dan betekenen?" tot de kerngedachte zichtbaar wordt.', en: 'Ask repeatedly "what would that mean?" until the core belief shows.', prompt: 'Zullen we samen met de pijl-oefening naar de kern van die gedachte kijken?' } },
  { key: 'tech:gedragsexperiment', type: 'Technique', nl: 'gedragsexperiment', en: 'behavioural experiment', data: { nl: 'Toets een voorspelling: wat denk je dat er gebeurt, en wat gebeurt er echt?', en: 'Test a prediction: what do you expect, and what actually happens?', prompt: 'Zullen we een klein experiment ontwerpen om die voorspelling te toetsen?' } },
  { key: 'tech:beloningsmenu', type: 'Technique', nl: 'prettige-activiteitenmenu', en: 'pleasant events menu', data: { nl: 'Maak een lijst van 10 dingen die energie geven; kies er één voor vandaag.', en: 'List 10 things that give you energy; pick one for today.', prompt: 'Zullen we je energiemenu samen opstellen en er één kiezen?' } },
  { key: 'tech:sociale-ritme', type: 'Technique', nl: 'sociaal ritme', en: 'social rhythm', data: { nl: 'Vaste ankers op een dag: opstaan, eten, contact, naar bed.', en: 'Daily anchors: getting up, meals, contact, bedtime.', prompt: 'Zullen we drie vaste dagankers kiezen?' } },
  { key: 'tech:slaaprestrictie', type: 'Technique', nl: 'slaaprestrictie', en: 'sleep restriction', data: { nl: 'Beperk bedtijd tijdelijk tot je werkelijke slaapuur, breid daarna uit.', en: 'Temporarily limit time in bed to your actual sleep hours, then expand.', prompt: 'Zullen we je bedtijd eens naast je echte slaapuur leggen?' } },
  { key: 'tech:stimuluscontrole', type: 'Technique', nl: 'stimuluscontrole', en: 'stimulus control', data: { nl: 'Bed = slapen. Na 20 minuten wakker: uit bed, rustige activiteit, terug als je slaperig bent.', en: 'Bed = sleep. Awake after 20 minutes: get up, calm activity, return when sleepy.', prompt: 'Zullen we de bed-slaap-koppeling herstellen met stimuluscontrole?' } },
  { key: 'tech:paniek-expliciet', type: 'Technique', nl: 'paniek psycho-educatie', en: 'panic psycho-education', data: { nl: 'Een paniekaanval piekt binnen 10 minuten en is niet gevaarlijk; de golf eb terug.', en: 'A panic attack peaks within ~10 minutes and is not dangerous; the wave recedes.', prompt: 'Leg ik nog eens uit hoe een paniekgolf verloopt, zodat je hem kunt laten komen en gaan?' } },
  { key: 'tech:coping-kaart', type: 'Technique', nl: 'coping-kaart', en: 'coping card', data: { nl: 'Vooraf geschreven kaart: "dit is paniek, dit heeft mij al eerder geholpen: …".', en: 'Pre-written card: "this is panic, this helped me before: …".', prompt: 'Zullen we samen een coping-kaart schrijven voor het volgende moment?' } },
  { key: 'tech:veiligheidsplan', type: 'Technique', nl: 'veiligheidsplan', en: 'safety plan', data: { nl: 'Signalen, afleidingsstappen, mensen en nummers — één plan, bij de hand.', en: 'Warning signs, distraction steps, people and numbers — one plan, at hand.', prompt: 'Zullen we een kort veiligheidsplan opstellen?' } },
  { key: 'tech:probleemoplossing', type: 'Technique', nl: 'probleemoplossing in stappen', en: 'problem-solving steps', data: { nl: 'Definieer het probleem, bedenk 3 opties, kies er één, plan een eerste mini-stap.', en: 'Define the problem, brainstorm 3 options, pick one, plan a mini-step.', prompt: 'Zullen we het probleem opdelen in een stap die vandaag kan?' } },
  { key: 'tech:assertiviteit', type: 'Technique', nl: 'bekrachtig-nee-zeggen', en: 'assertive refusal', data: { nl: 'Oefen een grens: "ik zie je graag, maar dit lukt me niet" — kort, kalm, vast.', en: 'Practise a boundary: short, calm, firm — without over-explaining.', prompt: 'Zullen we die grens eens in twee zinnen oefenen?' } },
  { key: 'tech:energiebudget', type: 'Technique', nl: 'energiebudget', en: 'energy budget', data: { nl: 'Verdeel je energie als geld: wat kost de dag, wat levert op, waar wil je het aan uitgeven?', en: 'Spend energy like money: what costs, what gives, where to invest?', prompt: 'Zullen we je dag als energiebudget doorrekenen?' } },
  { key: 'tech:piekerinterruptie', type: 'Technique', nl: 'piekeronderbreker', en: 'rumination interrupt', data: { nl: 'Zet een timer; bij de bel: verplaats je — andere ruimte, water, korte wandeling.', en: 'Set a timer; on the bell: relocate — other room, water, short walk.', prompt: 'Zullen we een piekeronderbreker instellen die bij je past?' } },
  { key: 'tech:dankbaarheid', type: 'Technique', nl: 'drie goede dingen', en: 'three good things', data: { nl: 'Schrijf elke avond drie dingen die goed gingen, hoe klein ook.', en: 'Each evening, note three things that went okay, however small.', prompt: 'Zullen we vanavond starten met drie goede dingen?' } },
  { key: 'tech:waardering-herformuleren', type: 'Technique', nl: 'zelfbeeld-herformulering', en: 'self-worth reframe', data: { nl: 'Vervang "ik ben een mislukking" door "ik heb iets gedaan dat niet lukte" — feiten boven oordelen.', en: 'Swap "I am a failure" for "I did something that failed" — facts over verdicts.', prompt: 'Zullen we die oordeelszin omzetten naar een feitelijke zin?' } },
  { key: 'tech:mindful-wandelen', type: 'Technique', nl: 'mindful wandelen', en: 'mindful walking', data: { nl: '10 minuten wandelen met aandacht voor voeten, adem en geluid.', en: '10 minutes walking with attention to feet, breath and sound.', prompt: 'Zullen we een mindful wandeling van 10 minuten inplannen?' } },
  { key: 'tech:valeistap', type: 'Technique', nl: 'kleine waardenstap', en: 'small values step', data: { nl: 'Eén stap van 5 minuten in de richting van wat telt, ook als het gevoel niet meewerkt.', en: 'One 5-minute step towards what matters, even when the feeling resists.', prompt: 'Zullen we één 5-minutenstap richting je waarde kiezen?' } },
  { key: 'tech:veilige-plek', type: 'Technique', nl: 'veilige-plek-oefening', en: 'safe-place exercise', data: { nl: 'Stabilisatie: sluit je ogen en bouw een plek op waar je je veilig voelt; details, kleur, geluid.', en: 'Stabilisation: close your eyes and build a place where you feel safe; details, colour, sound.', prompt: 'Zullen we samen een veilige plek opbouwen als anker?' } },
  { key: 'tech:stop-oefening', type: 'Technique', nl: 'STOP-oefening', en: 'STOP skill', data: { nl: 'DBT: S top, T neem een stap terug, O bekijk wat er gebeurt, P ga bewust verder.', en: 'DBT: S top, T ake a step back, O bserve what is happening, P roceed mindfully.', prompt: 'Zullen we de STOP-oefening samen doorlopen?' } },

  // ── Resources (17) ───────────────────────────────────────────────────────
  { key: 'res:113', type: 'Resource', nl: '113 Zelfmoordpreventie', en: '113 Suicide Prevention', data: { nl: 'Bel 113 of 0800-0113 (NL), of 1813 (BE). Gratis en dag en nacht bereikbaar.', en: 'Call 113 or 0800-0113 (NL), or 1813 (BE). Free, day and night.', detail: '113 Zelfmoordpreventie — bel 113 of 0800-0113' } },
  { key: 'res:113-chat', type: 'Resource', nl: '113 chat', en: '113 chat', data: { nl: 'Liever chatten dan bellen: www.113.nl — anoniem, dag en nacht.', en: 'Prefer chat over calling: www.113.nl — anonymous, day and night.', detail: '113 online chat — www.113.nl' } },
  { key: 'res:huisarts', type: 'Resource', nl: 'huisarts(enpost)', en: 'GP (out-of-hours)', data: { nl: 'Je huisarts of huisartsenpost is de juiste eerste stap bij aanhoudende klachten.', en: 'Your GP or out-of-hours GP service is the right first step for persistent complaints.', detail: 'Huisarts / huisartsenpost' } },
  { key: 'res:crisisdienst', type: 'Resource', nl: 'crisisdienst regio', en: 'regional crisis service', data: { nl: 'Bij acute crisis buiten kantooruren: huisartsenpost → crisisdienst van je regio.', en: 'In acute crisis outside office hours: GP out-of-hours → regional crisis service.', detail: 'Crisisdienst (via huisartsenpost)' } },
  { key: 'res:vertrouwenspersoon', type: 'Resource', nl: 'vertrouwenspersoon', en: 'trusted person', data: { nl: 'Eén persoon die je vertrouwt mag je weten wat er is.', en: 'One trusted person may want to know what is going on.', detail: 'Vertrouwenspersoon in je omgeving' } },
  { key: 'res:mind-korrelatie', type: 'Resource', nl: 'MIND Korrelatie', en: 'MIND Korrelatie', data: { nl: 'Luisterlijn voor gesprekken bij somberheid: korrelatie.nl / 0900-1450.', en: 'Listening line for low mood: korrelatie.nl / 0900-1450.', detail: 'MIND Korrelatie — korrelatie.nl' } },
  { key: 'res:jellinek', type: 'Resource', nl: 'verslavingszorg (Jellinek)', en: 'addiction care (Jellinek)', data: { nl: 'Vragen over alcohol of drugs: Jellinek en vergelijkbare zorg bieden anonieme voorlichting en hulp.', en: 'Questions about alcohol or drugs: Jellinek and similar services offer anonymous guidance.', detail: 'Verslavingszorg — Jellinek.nl' } },
  { key: 'res:studentenpsycholoog', type: 'Resource', nl: 'studentenpsycholoog', en: 'student psychologist', data: { nl: 'Student? Veel hogescholen en universiteiten hebben gratis korte-traject psychologen.', en: 'A student? Many universities offer free short-track psychologists.', detail: 'Studentenpsycholoog via je instelling' } },
  { key: 'res:poh-ggz', type: 'Resource', nl: 'praktijkondersteuner huisarts (POH-GGZ)', en: 'practice nurse mental health', data: { nl: 'Bij de huisarts staat vaak een POH-GGZ: laagdrempelig, gratis, korte lijn.', en: 'Many GP practices have a mental-health practice nurse: low threshold, short line.', detail: 'POH-GGZ via de huisarts' } },
  { key: 'res:sensoor', type: 'Resource', nl: 'Sensoor luisterlijn', en: 'Sensoor listening line', data: { nl: 'Even je hart luchten bij een opgeleide vrijwilliger: bel 0800-0767 (NL), dagelijks bereikbaar.', en: 'Talk it through with a trained volunteer: call 0800-0767 (NL), available daily.', detail: 'Sensoor — 0800-0767' } },
  { key: 'res:veilig-thuis', type: 'Resource', nl: 'Veilig Thuis', en: 'Veilig Thuis (Safe at Home)', data: { nl: 'Advies en steun bij huiselijk geweld en kindermishandeling: 0800-2000, gratis en anoniem.', en: 'Advice and support for domestic violence and child abuse: 0800-2000 (NL), free and anonymous.', detail: 'Veilig Thuis — 0800-2000' } },
  { key: 'res:csg', type: 'Resource', nl: 'Centrum Seksueel Geweld', en: 'Sexual Assault Centre', data: { nl: 'Na seksueel geweld: medische zorg, bewijs en psychische opvang op één plek — 0800-0188.', en: 'After sexual violence: medical care, evidence and psychological support in one place — 0800-0188 (NL).', detail: 'Centrum Seksueel Geweld — 0800-0188' } },
  { key: 'res:112', type: 'Resource', nl: '112 (acuut gevaar)', en: '112 (acute danger)', data: { nl: 'Levensgevaar of acuut gevaar? Bel direct 112 — politie, brandweer of ambulance.', en: 'Life-threatening or acute danger? Call 112 immediately — police, fire or ambulance.', detail: 'Alarmnummer — 112' } },
  { key: 'res:kindertelefoon', type: 'Resource', nl: 'DE Kindertelefoon', en: 'Children\'s Helpline', data: { nl: 'Gratis en anoniem chatten of bellen voor kinderen en jongeren: 0800-0432.', en: 'Free and anonymous chat or call for children and young people: 0800-0432 (NL).', detail: 'DE Kindertelefoon — 0800-0432' } },
  { key: 'res:transvisie', type: 'Resource', nl: 'Transvisie', en: 'Transvisie', data: { nl: 'Voor transgender personen en naasten: lotgenotencontact, voorlichting en doorverwijzing.', en: 'For transgender people and loved ones: peer contact, education and referral.', detail: 'Transvisie — transvisie.nl' } },
  { key: 'res:coc', type: 'Resource', nl: 'COC Nederland', en: 'COC Netherlands', data: { nl: 'Voor lhbt+ personen: lokale groepen, lotgenotencontact en hulp bij uit de kast komen.', en: 'For LGBT+ people: local groups, peer contact and coming-out support.', detail: 'COC Nederland — coc.nl' } },
  { key: 'res:pestweb', type: 'Resource', nl: 'Pestweb', en: 'Pestweb', data: { nl: 'Over pesten: tips, verhalen en anonieme hulp voor jongeren die gepest worden (of pesten).', en: 'About bullying: tips, stories and anonymous help for young people who are bullied (or bully).', detail: 'Pestweb — pestweb.nl' } },
];

// ---------------------------------------------------------------------------
// Edges — 168
// ---------------------------------------------------------------------------

export const KG_EDGES: KGEdgeDef[] = [
  // emotions → techniques (ADDRESSES)
  { from: 'emotion:angst', to: 'tech:ademruimte', rel: 'ADDRESSES' },
  { from: 'emotion:angst', to: 'tech:gronding', rel: 'ADDRESSES' },
  { from: 'emotion:angst', to: 'tech:zorguitstel', rel: 'ADDRESSES' },
  { from: 'emotion:angst', to: 'tech:lichaamsscan', rel: 'ADDRESSES' },
  { from: 'emotion:paniek', to: 'tech:adem-478', rel: 'ADDRESSES' },
  { from: 'emotion:paniek', to: 'tech:paniek-expliciet', rel: 'ADDRESSES' },
  { from: 'emotion:paniek', to: 'tech:gronding', rel: 'ADDRESSES' },
  { from: 'emotion:paniek', to: 'tech:coping-kaart', rel: 'ADDRESSES' },
  { from: 'emotion:verdriet', to: 'tech:activiteitenplanning', rel: 'ADDRESSES' },
  { from: 'emotion:verdriet', to: 'tech:zelfcompassie', rel: 'ADDRESSES' },
  { from: 'emotion:verdriet', to: 'tech:dankbaarheid', rel: 'ADDRESSES' },
  { from: 'emotion:verdriet', to: 'tech:mindful-wandelen', rel: 'ADDRESSES' },
  { from: 'emotion:leegte', to: 'tech:activiteitenplanning', rel: 'ADDRESSES' },
  { from: 'emotion:leegte', to: 'tech:waardenkompas', rel: 'ADDRESSES' },
  { from: 'emotion:leegte', to: 'tech:beloningsmenu', rel: 'ADDRESSES' },
  { from: 'emotion:leegte', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },
  { from: 'emotion:boosheid', to: 'tech:gronding', rel: 'ADDRESSES' },
  { from: 'emotion:boosheid', to: 'tech:spierspanning', rel: 'ADDRESSES' },
  { from: 'emotion:boosheid', to: 'tech:assertiviteit', rel: 'ADDRESSES' },
  { from: 'emotion:schaamte', to: 'tech:zelfcompassie', rel: 'ADDRESSES' },
  { from: 'emotion:schaamte', to: 'tech:gedachte-diffusie', rel: 'ADDRESSES' },
  { from: 'emotion:onzekerheid', to: 'tech:gedachtekaart', rel: 'ADDRESSES' },
  { from: 'emotion:onzekerheid', to: 'tech:zelfcompassie', rel: 'ADDRESSES' },
  { from: 'emotion:onzekerheid', to: 'tech:pijl-naar-beneden', rel: 'ADDRESSES' },
  { from: 'emotion:onzekerheid', to: 'tech:gedragsexperiment', rel: 'ADDRESSES' },
  { from: 'emotion:eenzaamheid', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'emotion:eenzaamheid', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },
  { from: 'emotion:verlies', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'emotion:verlies', to: 'tech:zelfcompassie', rel: 'ADDRESSES' },
  { from: 'emotion:verlies', to: 'tech:lichaamsscan', rel: 'ADDRESSES' },
  { from: 'emotion:overweldiging', to: 'tech:gronding', rel: 'ADDRESSES' },
  { from: 'emotion:overweldiging', to: 'tech:energiebudget', rel: 'ADDRESSES' },
  { from: 'emotion:overweldiging', to: 'tech:probleemoplossing', rel: 'ADDRESSES' },
  { from: 'emotion:moeheid', to: 'tech:energiebudget', rel: 'ADDRESSES' },
  { from: 'emotion:moeheid', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },
  { from: 'emotion:moeheid', to: 'tech:activiteitenplanning', rel: 'ADDRESSES' },
  { from: 'emotion:frustratie', to: 'tech:piekerinterruptie', rel: 'ADDRESSES' },
  { from: 'emotion:frustratie', to: 'tech:probleemoplossing', rel: 'ADDRESSES' },
  { from: 'emotion:frustratie', to: 'tech:valeistap', rel: 'ADDRESSES' },
  { from: 'emotion:wanhoop', to: 'tech:veiligheidsplan', rel: 'ADDRESSES' },
  { from: 'emotion:wanhoop', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'emotion:wanhoop', to: 'tech:valeistap', rel: 'ADDRESSES' },
  { from: 'emotion:rust', to: 'tech:dankbaarheid', rel: 'ADDRESSES' },
  { from: 'emotion:rust', to: 'tech:mindful-wandelen', rel: 'ADDRESSES' },

  // topics → emotions (RELATES)
  { from: 'topic:werk', to: 'emotion:angst', rel: 'RELATES', weight: 0.8 },
  { from: 'topic:werk', to: 'emotion:moeheid', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:werk', to: 'emotion:frustratie', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:studie', to: 'emotion:angst', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:studie', to: 'emotion:overweldiging', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:relatie', to: 'emotion:verdriet', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:relatie', to: 'emotion:boosheid', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:relatie', to: 'emotion:eenzaamheid', rel: 'RELATES', weight: 0.4 },
  { from: 'topic:slaap', to: 'emotion:verdriet', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:slaap', to: 'emotion:moeheid', rel: 'RELATES', weight: 0.8 },
  { from: 'topic:slaap', to: 'emotion:angst', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:zelfbeeld', to: 'emotion:onzekerheid', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:zelfbeeld', to: 'emotion:schaamte', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:verlies', to: 'emotion:verlies', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:rouw', to: 'emotion:verlies', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:rouw', to: 'emotion:leegte', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:toekomst', to: 'emotion:leegte', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:hoop', to: 'emotion:hoop', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:hoop', to: 'emotion:rust', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:gezondheid', to: 'emotion:angst', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:gezondheid', to: 'emotion:moeheid', rel: 'RELATES', weight: 0.4 },
  { from: 'topic:eenzaamheid', to: 'emotion:eenzaamheid', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:eenzaamheid', to: 'emotion:leegte', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:financien', to: 'emotion:angst', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:financien', to: 'emotion:overweldiging', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:midelen', to: 'emotion:schaamte', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:midelen', to: 'emotion:leegte', rel: 'RELATES', weight: 0.4 },
  { from: 'topic:identiteit', to: 'emotion:onzekerheid', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:identiteit', to: 'emotion:leegte', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:zorg', to: 'emotion:overweldiging', rel: 'RELATES', weight: 0.8 },
  { from: 'topic:zorg', to: 'emotion:moeheid', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:paniek', to: 'emotion:paniek', rel: 'RELATES', weight: 0.9 },
  { from: 'topic:paniek', to: 'emotion:angst', rel: 'RELATES', weight: 0.7 },
  { from: 'topic:paniek', to: 'emotion:overweldiging', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:wonen', to: 'emotion:frustratie', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:wonen', to: 'emotion:angst', rel: 'RELATES', weight: 0.4 },
  { from: 'topic:vrijetijd', to: 'emotion:rust', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:vrijetijd', to: 'emotion:leegte', rel: 'RELATES', weight: 0.4 },
  { from: 'topic:lichaam', to: 'emotion:paniek', rel: 'RELATES', weight: 0.5 },
  { from: 'topic:lichaam', to: 'emotion:angst', rel: 'RELATES', weight: 0.6 },
  { from: 'topic:gedachten', to: 'emotion:angst', rel: 'RELATES', weight: 0.8 },
  { from: 'topic:gedachten', to: 'emotion:frustratie', rel: 'RELATES', weight: 0.5 },

  // topics → techniques (ADDRESSES, direct)
  { from: 'topic:slaap', to: 'tech:slaaphygiene', rel: 'ADDRESSES' },
  { from: 'topic:slaap', to: 'tech:slaaprestrictie', rel: 'ADDRESSES' },
  { from: 'topic:slaap', to: 'tech:stimuluscontrole', rel: 'ADDRESSES' },
  { from: 'topic:gedachten', to: 'tech:zorguitstel', rel: 'ADDRESSES' },
  { from: 'topic:gedachten', to: 'tech:piekerinterruptie', rel: 'ADDRESSES' },
  { from: 'topic:gedachten', to: 'tech:gedachtekaart', rel: 'ADDRESSES' },
  { from: 'topic:gedachten', to: 'tech:gedachte-diffusie', rel: 'ADDRESSES' },
  { from: 'topic:paniek', to: 'tech:paniek-expliciet', rel: 'ADDRESSES' },
  { from: 'topic:paniek', to: 'tech:adem-478', rel: 'ADDRESSES' },
  { from: 'topic:paniek', to: 'tech:coping-kaart', rel: 'ADDRESSES' },
  { from: 'topic:lichaam', to: 'tech:spierspanning', rel: 'ADDRESSES' },
  { from: 'topic:lichaam', to: 'tech:lichaamsscan', rel: 'ADDRESSES' },
  { from: 'topic:werk', to: 'tech:energiebudget', rel: 'ADDRESSES' },
  { from: 'topic:werk', to: 'tech:assertiviteit', rel: 'ADDRESSES' },
  { from: 'topic:werk', to: 'tech:probleemoplossing', rel: 'ADDRESSES' },
  { from: 'topic:studie', to: 'tech:probleemoplossing', rel: 'ADDRESSES' },
  { from: 'topic:studie', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },
  { from: 'topic:zorg', to: 'tech:energiebudget', rel: 'ADDRESSES' },
  { from: 'topic:zorg', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'topic:zelfbeeld', to: 'tech:waardering-herformuleren', rel: 'ADDRESSES' },
  { from: 'topic:identiteit', to: 'tech:waardenkompas', rel: 'ADDRESSES' },
  { from: 'topic:verlies', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'topic:rouw', to: 'tech:sociale-kaart', rel: 'ADDRESSES' },
  { from: 'topic:rouw', to: 'tech:zelfcompassie', rel: 'ADDRESSES' },
  { from: 'topic:eenzaamheid', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },
  { from: 'topic:vrijetijd', to: 'tech:beloningsmenu', rel: 'ADDRESSES' },
  { from: 'topic:vrijetijd', to: 'tech:mindful-wandelen', rel: 'ADDRESSES' },
  { from: 'topic:toekomst', to: 'tech:waardenkompas', rel: 'ADDRESSES' },
  { from: 'topic:toekomst', to: 'tech:valeistap', rel: 'ADDRESSES' },
  { from: 'topic:financien', to: 'tech:probleemoplossing', rel: 'ADDRESSES' },
  { from: 'topic:midelen', to: 'tech:slaaphygiene', rel: 'ADDRESSES' },
  { from: 'topic:wonen', to: 'tech:sociale-ritme', rel: 'ADDRESSES' },

  // resources cover emotions / topics
  { from: 'res:113', to: 'emotion:leegte', rel: 'COVERS' },
  { from: 'res:113', to: 'emotion:wanhoop', rel: 'COVERS' },
  { from: 'res:113-chat', to: 'emotion:wanhoop', rel: 'COVERS' },
  { from: 'res:113-chat', to: 'emotion:eenzaamheid', rel: 'COVERS' },
  { from: 'res:huisarts', to: 'emotion:verdriet', rel: 'COVERS' },
  { from: 'res:huisarts', to: 'topic:slaap', rel: 'COVERS' },
  { from: 'res:crisisdienst', to: 'emotion:wanhoop', rel: 'COVERS' },
  { from: 'res:crisisdienst', to: 'emotion:paniek', rel: 'COVERS' },
  { from: 'res:vertrouwenspersoon', to: 'emotion:eenzaamheid', rel: 'COVERS' },
  { from: 'res:vertrouwenspersoon', to: 'emotion:verlies', rel: 'COVERS' },
  { from: 'res:mind-korrelatie', to: 'emotion:verdriet', rel: 'COVERS' },
  { from: 'res:mind-korrelatie', to: 'emotion:eenzaamheid', rel: 'COVERS' },
  { from: 'res:jellinek', to: 'topic:midelen', rel: 'COVERS' },
  { from: 'res:studentenpsycholoog', to: 'topic:studie', rel: 'COVERS' },
  { from: 'res:studentenpsycholoog', to: 'emotion:angst', rel: 'COVERS' },
  { from: 'res:poh-ggz', to: 'topic:gezondheid', rel: 'COVERS' },
  { from: 'res:poh-ggz', to: 'emotion:angst', rel: 'COVERS' },
  { from: 'res:sensoor', to: 'emotion:overweldiging', rel: 'COVERS' },
  { from: 'res:sensoor', to: 'emotion:eenzaamheid', rel: 'COVERS' },
  // safety plan is supported by crisis resources (SUPPORTS)
  { from: 'tech:veiligheidsplan', to: 'res:113', rel: 'SUPPORTS' },
  { from: 'tech:veiligheidsplan', to: 'res:vertrouwenspersoon', rel: 'SUPPORTS' },

  // specialist resources cover emotions / topics (abuse, violence, psychosis, identity, bullying)
  { from: 'res:veilig-thuis', to: 'emotion:angst', rel: 'COVERS' },
  { from: 'res:veilig-thuis', to: 'emotion:overweldiging', rel: 'COVERS' },
  { from: 'res:csg', to: 'emotion:schaamte', rel: 'COVERS' },
  { from: 'res:csg', to: 'emotion:angst', rel: 'COVERS' },
  { from: 'res:112', to: 'emotion:paniek', rel: 'COVERS' },
  { from: 'res:112', to: 'emotion:wanhoop', rel: 'COVERS' },
  { from: 'res:kindertelefoon', to: 'emotion:eenzaamheid', rel: 'COVERS' },
  { from: 'res:kindertelefoon', to: 'emotion:verdriet', rel: 'COVERS' },
  { from: 'res:transvisie', to: 'topic:identiteit', rel: 'COVERS' },
  { from: 'res:coc', to: 'topic:identiteit', rel: 'COVERS' },
  { from: 'res:pestweb', to: 'emotion:verdriet', rel: 'COVERS' },
  { from: 'res:pestweb', to: 'topic:eenzaamheid', rel: 'COVERS' },
  { from: 'res:crisisdienst', to: 'topic:gedachten', rel: 'COVERS' },
  // stabilisation techniques (trauma fase-1, DBT distress tolerance)
  { from: 'emotion:wanhoop', to: 'tech:veilige-plek', rel: 'ADDRESSES' },
  { from: 'emotion:overweldiging', to: 'tech:veilige-plek', rel: 'ADDRESSES' },
  { from: 'emotion:paniek', to: 'tech:veilige-plek', rel: 'ADDRESSES' },
  { from: 'emotion:boosheid', to: 'tech:stop-oefening', rel: 'ADDRESSES' },
  { from: 'emotion:frustratie', to: 'tech:stop-oefening', rel: 'ADDRESSES' },
  { from: 'emotion:overweldiging', to: 'tech:stop-oefening', rel: 'ADDRESSES' },
  { from: 'res:veilig-thuis', to: 'tech:veiligheidsplan', rel: 'SUPPORTS' },
];

// ---------------------------------------------------------------------------
// Forward-chaining rules — 20
// ---------------------------------------------------------------------------

const has = (list: string[], key: string) => list.includes(key);

export const CHAIN_RULES: ChainRuleDef[] = [
  {
    id: 'CR-01',
    desc: { nl: 'Slaapthema + aanhoudend lage stemming → slaaphygiëne + activiteitenplanning', en: 'Sleep topic + sustained low mood → sleep hygiene + activity planning' },
    when: (c) => has(c.topics, 'topic:slaap') && c.turnCount >= 2 && c.distress !== 'LOW',
    addTechniques: ['tech:slaaphygiene', 'tech:activiteitenplanning'],
    derived: 'slaap + aanhoudende spanning ⇒ slaaphygiëne + activiteitenplanning',
  },
  {
    id: 'CR-02',
    desc: { nl: 'Werk/studie + angst → gronding + waardenkompas', en: 'Work/study topic + anxiety → grounding + values compass' },
    when: (c) => (has(c.topics, 'topic:werk') || has(c.topics, 'topic:studie')) && has(c.emotions, 'emotion:angst'),
    addTechniques: ['tech:gronding', 'tech:waardenkompas'],
    derived: 'werk/studie + angst ⇒ gronding + waardenkompas',
  },
  {
    id: 'CR-03',
    desc: { nl: 'Rouw-intentie → sociale kaart + zelfcompassie', en: 'Grief intent → support map + self-compassion' },
    when: (c) => c.intent === 'GRIEF',
    addTechniques: ['tech:sociale-kaart', 'tech:zelfcompassie'],
    addEmotions: ['emotion:verlies'],
    derived: 'rouw ⇒ sociale kaart + zelfcompassie',
  },
  {
    id: 'CR-04',
    desc: { nl: 'Eenzaamheid → sociale kaart', en: 'Loneliness emotion or topic → support map' },
    when: (c) => has(c.emotions, 'emotion:eenzaamheid') || has(c.topics, 'topic:eenzaamheid'),
    addTechniques: ['tech:sociale-kaart'],
    derived: 'eenzaamheid ⇒ sociale kaart',
  },
  {
    id: 'CR-05',
    desc: { nl: 'Vooruitgang → hoop versterken, geen technieken opdringen', en: 'Positive progress → reinforce hope, no technique push' },
    when: (c) => c.intent === 'POSITIVE_PROGRESS',
    addEmotions: ['emotion:hoop', 'emotion:opluchting'],
    addTopics: ['topic:hoop'],
    derived: 'vooruitgang ⇒ hoop versterken',
  },
  {
    id: 'CR-06',
    desc: { nl: 'Risico ≥ ELEVATED → 113 + huisarts gegrond', en: 'Any risk ≥ ELEVATED → 113 + GP resources grounded' },
    when: (c) => c.riskLevel === 'ELEVATED' || c.riskLevel === 'HIGH' || c.riskLevel === 'CRISIS',
    addResources: ['res:113', 'res:huisarts'],
    derived: 'risico ≥ ELEVATED ⇒ 113 + huisarts gegrond',
  },
  {
    id: 'CR-07',
    desc: { nl: 'Paniekaanval genoemd → paniek-uitleg + 4-7-8-ademhaling', en: 'Panic attack mentioned → panic psycho-education + 4-7-8 breathing' },
    when: (c) => c.intent === 'PANIC_REPORT' || has(c.topics, 'topic:paniek') || has(c.emotions, 'emotion:paniek'),
    addTechniques: ['tech:paniek-expliciet', 'tech:adem-478'],
    derived: 'paniek ⇒ paniek psycho-educatie + 4-7-8',
  },
  {
    id: 'CR-08',
    desc: { nl: 'Slaapprobleem als kern → slaaprestrictie + stimuluscontrole bij aanhoudende klachten', en: 'Core sleep issue → sleep restriction + stimulus control when persistent' },
    when: (c) => c.intent === 'SLEEP_ISSUE' && c.turnCount >= 2,
    addTechniques: ['tech:slaaprestrictie', 'tech:stimuluscontrole'],
    derived: 'slaapprobleem (aanhoudend) ⇒ slaaprestrictie + stimuluscontrole',
  },
  {
    id: 'CR-09',
    desc: { nl: 'Gekrenkt zelfbeeld → zelfbeeld-herformulering + zelfcompassie', en: 'Self-worth injury → self-worth reframe + self-compassion' },
    when: (c) => c.intent === 'SELF_WORTH_INJURY' || has(c.emotions, 'emotion:onzekerheid') || has(c.emotions, 'emotion:schaamte'),
    addTechniques: ['tech:waardering-herformuleren', 'tech:zelfcompassie'],
    derived: 'zelfbeeld ⇒ herformulering + zelfcompassie',
  },
  {
    id: 'CR-10',
    desc: { nl: 'Middelen als coping → slaap-ankers + verslavingszorg-resource', en: 'Substance coping → sleep anchors + addiction-care resource' },
    when: (c) => c.intent === 'SUBSTANCE_CONCERN' || has(c.topics, 'topic:midelen'),
    addTechniques: ['tech:sociale-ritme'],
    addResources: ['res:jellinek'],
    derived: 'middelen ⇒ sociaal ritme + verslavingszorg-resource',
  },
  {
    id: 'CR-11',
    desc: { nl: 'Overweldiging → energiebudget + probleemoplossing', en: 'Overwhelm → energy budget + problem-solving steps' },
    when: (c) => has(c.emotions, 'emotion:overweldiging'),
    addTechniques: ['tech:energiebudget', 'tech:probleemoplossing'],
    derived: 'overweldiging ⇒ energiebudget + probleemoplossing',
  },
  {
    id: 'CR-12',
    desc: { nl: 'Piekergedachten → zorguitstel + piekeronderbreker', en: 'Worry thoughts → worry postponement + rumination interrupt' },
    when: (c) => has(c.topics, 'topic:gedachten') && c.turnCount >= 1,
    addTechniques: ['tech:zorguitstel', 'tech:piekerinterruptie'],
    derived: 'piekergedachten ⇒ zorguitstel + piekeronderbreker',
  },
  {
    id: 'CR-13',
    desc: { nl: 'Acute spanning (≥ ELEVATED) → gronding + lichaamsscan eerst, pas daarna inhoud', en: 'Acute distress (≥ ELEVATED) → grounding + body scan first, content later' },
    when: (c) => c.distress === 'ELEVATED' || c.distress === 'ACUTE',
    addTechniques: ['tech:gronding', 'tech:lichaamsscan'],
    derived: 'acute spanning ⇒ gronding + lichaamsscan',
  },
  {
    id: 'CR-14',
    desc: { nl: 'Verlies-thema → verlies-emotie + dankbaarheid voor wat was', en: 'Loss topic → grief emotion + three-good-things anchoring' },
    when: (c) => has(c.topics, 'topic:verlies') || has(c.topics, 'topic:rouw'),
    addEmotions: ['emotion:verlies'],
    addTechniques: ['tech:dankbaarheid'],
    derived: 'verlies ⇒ rouw-emotie + drie goede dingen',
  },
  {
    id: 'CR-15',
    desc: { nl: 'Eenzaamheid + meerdere beurten → sociale kaart + luisterlijn-resource', en: 'Loneliness across turns → support map + listening-line resource' },
    when: (c) => (has(c.emotions, 'emotion:eenzaamheid') || has(c.topics, 'topic:eenzaamheid')) && c.turnCount >= 3,
    addTechniques: ['tech:sociale-ritme'],
    addResources: ['res:mind-korrelatie'],
    derived: 'eenzaamheid (aanhoudend) ⇒ sociaal ritme + luisterlijn',
  },
  {
    id: 'CR-16',
    desc: { nl: 'Werkstress + uitputting → energiebudget + sociale ritme', en: 'Work stress + exhaustion → energy budget + social rhythm' },
    when: (c) => (has(c.topics, 'topic:werk') || has(c.topics, 'topic:zorg')) && has(c.emotions, 'emotion:moeheid'),
    addTechniques: ['tech:energiebudget', 'tech:sociale-ritme'],
    derived: 'werk/zorg + uitputting ⇒ energiebudget + sociaal ritme',
  },
  {
    id: 'CR-17',
    desc: { nl: 'Toekomstthema zonder richting → waardenkompas + kleine waardenstap', en: 'Future topic without direction → values compass + small values step' },
    when: (c) => has(c.topics, 'topic:toekomst') && has(c.emotions, 'emotion:leegte'),
    addTechniques: ['tech:waardenkompas', 'tech:valeistap'],
    derived: 'toekomst + leegte ⇒ waardenkompas + kleine stap',
  },
  {
    id: 'CR-18',
    desc: { nl: 'Hoop waargenomen → versterken via drie goede dingen', en: 'Hope observed → reinforce via three-good-things' },
    when: (c) => has(c.emotions, 'emotion:hoop') || has(c.emotions, 'emotion:rust'),
    addTechniques: ['tech:dankbaarheid'],
    derived: 'hoop ⇒ drie goede dingen',
  },
  {
    id: 'CR-19',
    desc: { nl: 'Studiedruk + paniekachtige spanning → probleemoplossing + coping-kaart', en: 'Study pressure + panic-like tension → problem-solving + coping card' },
    when: (c) => has(c.topics, 'topic:studie') && (has(c.emotions, 'emotion:paniek') || c.distress === 'HIGH' || c.distress === 'ACUTE'),
    addTechniques: ['tech:probleemoplossing', 'tech:coping-kaart'],
    addResources: ['res:studentenpsycholoog'],
    derived: 'studiedruk + spanning ⇒ probleemoplossing + coping-kaart + studentenpsycholoog',
  },
  {
    id: 'CR-20',
    desc: { nl: 'Crisis of wanhoop → veiligheidsplan + 113-chat als zachte aanvulling', en: 'Crisis or hopelessness → safety plan + 113-chat as gentle addition' },
    when: (c) => c.riskLevel === 'CRISIS' || has(c.emotions, 'emotion:wanhoop'),
    addTechniques: ['tech:veiligheidsplan'],
    addResources: ['res:113-chat', 'res:crisisdienst'],
    derived: 'crisis/wanhoop ⇒ veiligheidsplan + 113-chat + crisisdienst',
  },
  {
    id: 'CR-21',
    desc: { nl: 'Geweldsuiting → Veilig Thuis + Centrum Seksueel Geweld + sociale kaart (trauma-informed: nooit uitvragen)', en: 'Abuse disclosure → Veilig Thuis + Sexual Assault Centre + support map (trauma-informed: never probing)' },
    when: (c) => c.intent === 'ABUSE_DISCLOSURE',
    addTechniques: ['tech:sociale-kaart', 'tech:veilige-plek'],
    addResources: ['res:veilig-thuis', 'res:csg', 'res:112'],
    derived: 'geweldsuiting ⇒ Veilig Thuis + CSG + 112 + sociale kaart + veilige plek',
  },
  {
    id: 'CR-22',
    desc: { nl: 'Traumaverhaal → stabilisatie eerst: veilige plek + gronding (geen exposure in chat)', en: 'Trauma report → stabilisation first: safe place + grounding (no exposure in chat)' },
    when: (c) => c.intent === 'TRAUMA_REPORT',
    addTechniques: ['tech:veilige-plek', 'tech:gronding'],
    addResources: ['res:huisarts'],
    derived: 'trauma ⇒ veilige plek + gronding + huisarts (trauma-focused care later)',
  },
  {
    id: 'CR-23',
    desc: { nl: 'Eetgedrag/lichaamsbeeld → medische monitoring via huisarts + zelfcompassie (nooit dietetiektaal)', en: 'Eating/body-image concern → medical monitoring via GP + self-compassion (never diet talk)' },
    when: (c) => c.intent === 'EATING_CONCERN',
    addTechniques: ['tech:zelfcompassie'],
    addResources: ['res:huisarts'],
    derived: 'eetgedrag ⇒ huisarts (medische monitoring) + zelfcompassie',
  },
  {
    id: 'CR-24',
    desc: { nl: 'Identiteitsnood → bevestiging + COC/Transvisie + zelfcompassie (minority-stress informed)', en: 'Identity distress → affirmation + COC/Transvisie + self-compassion (minority-stress informed)' },
    when: (c) => c.intent === 'IDENTITY_DISTRESS',
    addTechniques: ['tech:zelfcompassie', 'tech:sociale-kaart'],
    addResources: ['res:coc', 'res:transvisie'],
    derived: 'identiteit ⇒ COC + Transvisie + zelfcompassie + sociale kaart',
  },
  {
    id: 'CR-25',
    desc: { nl: 'Pestverhaal → sociale kaart + assertiviteit + Pestweb (+ Kindertelefoon voor jongeren)', en: 'Bullying report → support map + assertiveness + Pestweb (+ Children\'s Helpline for youth)' },
    when: (c) => c.intent === 'BULLYING_REPORT',
    addTechniques: ['tech:sociale-kaart', 'tech:assertiviteit'],
    addResources: ['res:pestweb', 'res:kindertelefoon'],
    derived: 'pesten ⇒ sociale kaart + assertiviteit + Pestweb + Kindertelefoon',
  },
  {
    id: 'CR-26',
    desc: { nl: 'Psychose-spectrum → vroege interventie: huisarts + crisisdienst (nooit meegaan in de beleving)', en: 'Psychosis-spectrum → early intervention: GP + crisis service (never colluding with the experience)' },
    when: (c) => c.intent === 'PSYCHOSIS_SIGNAL',
    addResources: ['res:huisarts', 'res:crisisdienst'],
    derived: 'psychose-signaal ⇒ huisarts + crisisdienst (vroege interventie)',
  },
  {
    id: 'CR-27',
    desc: { nl: 'Woede richting anderen → de-escalatie: STOP-oefening + crisisdienst (containment)', en: 'Anger towards others → de-escalation: STOP skill + crisis service (containment)' },
    when: (c) => c.intent === 'VIOLENCE_RISK',
    addTechniques: ['tech:stop-oefening'],
    addResources: ['res:crisisdienst', 'res:112'],
    derived: 'gewelddadigheid ⇒ STOP + crisisdienst + 112 (containment)',
  },
];

// ---------------------------------------------------------------------------
// Lexical hints — word → node key (NL + EN), used to ground a Frame.
// ---------------------------------------------------------------------------

export const EMOTION_HINTS: Record<string, string> = {
  verdriet: 'emotion:verdriet', somber: 'emotion:verdriet', sad: 'emotion:verdriet', misser: 'emotion:verdriet',
  treurig: 'emotion:verdriet', down: 'emotion:verdriet', depressief: 'emotion:verdriet',
  angst: 'emotion:angst', angstig: 'emotion:angst', anxious: 'emotion:angst', spanning: 'emotion:angst',
  gespannen: 'emotion:angst', nerveus: 'emotion:angst', nervous: 'emotion:angst', benauwd: 'emotion:angst',
  paniek: 'emotion:paniek', paniekaanval: 'emotion:paniek', panic: 'emotion:paniek', hyperventileer: 'emotion:paniek', hart: 'emotion:paniek',
  boos: 'emotion:boosheid', boosheid: 'emotion:boosheid', kwaad: 'emotion:boosheid', angry: 'emotion:boosheid',
  irritated: 'emotion:boosheid', geïrriteerd: 'emotion:boosheid', gefrustreerd: 'emotion:frustratie',
  leeg: 'emotion:leegte', leegte: 'emotion:leegte', empty: 'emotion:leegte', doelloos: 'emotion:leegte',
  schaam: 'emotion:schaamte', schuld: 'emotion:schaamte', shame: 'emotion:schaamte', guilty: 'emotion:schaamte', schuldig: 'emotion:schaamte',
  onzeker: 'emotion:onzekerheid', insecure: 'emotion:onzekerheid', waardeloos: 'emotion:onzekerheid', worthless: 'emotion:onzekerheid',
  mislukt: 'emotion:onzekerheid', failure: 'emotion:onzekerheid',
  alleen: 'emotion:eenzaamheid', lonely: 'emotion:eenzaamheid', eenzaam: 'emotion:eenzaamheid', alone: 'emotion:eenzaamheid',
  hoop: 'emotion:hoop', hope: 'emotion:hoop', beter: 'emotion:hoop', better: 'emotion:hoop',
  trots: 'emotion:opluchting', proud: 'emotion:opluchting', opluchting: 'emotion:opluchting', relief: 'emotion:opluchting',
  rouw: 'emotion:verlies', verlies: 'emotion:verlies', grief: 'emotion:verlies', loss: 'emotion:verlies',
  overleden: 'emotion:verlies', died: 'emotion:verlies', begraven: 'emotion:verlies', weggevallen: 'emotion:verlies',
  overweldig: 'emotion:overweldiging', overwhelmed: 'emotion:overweldiging', 'te veel': 'emotion:overweldiging', drowning: 'emotion:overweldiging',
  moe: 'emotion:moeheid', uitgeput: 'emotion:moeheid', exhausted: 'emotion:moeheid', burnout: 'emotion:moeheid', leegloop: 'emotion:moeheid',
  wanhopig: 'emotion:wanhoop', wanhoop: 'emotion:wanhoop', hopeless: 'emotion:wanhoop', uitzichtloos: 'emotion:wanhoop', zinloos: 'emotion:wanhoop',
  rustig: 'emotion:rust', calm: 'emotion:rust', kalm: 'emotion:rust',
};

export const TOPIC_HINTS: Record<string, string> = {
  werk: 'topic:werk', work: 'topic:werk', baas: 'topic:werk', job: 'topic:werk', collega: 'topic:werk', deadline: 'topic:werk', sollicitatie: 'topic:werk', ontslag: 'topic:werk',
  relatie: 'topic:relatie', partner: 'topic:relatie', vriend: 'topic:relatie', vriendin: 'topic:relatie', familie: 'topic:relatie', relationship: 'topic:relatie', scheiding: 'topic:relatie', ruzie: 'topic:relatie',
  slaap: 'topic:slaap', slapen: 'topic:slaap', sleep: 'topic:slaap', insomnia: 'topic:slaap', wakker: 'topic:slaap', nacht: 'topic:slaap', inslapen: 'topic:slaap',
  zelfbeeld: 'topic:zelfbeeld', spiegel: 'topic:zelfbeeld', zelfvertrouwen: 'topic:zelfbeeld', mirror: 'topic:zelfbeeld',
  verlies: 'topic:verlies', loss: 'topic:verlies', overlijden: 'topic:verlies', funeral: 'topic:verlies', afscheid: 'topic:verlies',
  rouw: 'topic:rouw', grief: 'topic:rouw', gedenken: 'topic:rouw',
  toekomst: 'topic:toekomst', future: 'topic:toekomst', richting: 'topic:toekomst', aims: 'topic:toekomst', zin: 'topic:toekomst',
  gezondheid: 'topic:gezondheid', health: 'topic:gezondheid', lichaam: 'topic:gezondheid', pijn: 'topic:gezondheid', dokter: 'topic:gezondheid',
  studie: 'topic:studie', study: 'topic:studie', school: 'topic:studie', tentamen: 'topic:studie', examen: 'topic:studie', uni: 'topic:studie', college: 'topic:studie',
  alleen: 'topic:eenzaamheid', eenzaam: 'topic:eenzaamheid', lonely: 'topic:eenzaamheid', niemand: 'topic:eenzaamheid', nobody: 'topic:eenzaamheid', vrienden: 'topic:eenzaamheid',
  geld: 'topic:financien', schuld: 'topic:financien', huur: 'topic:financien', money: 'topic:financien', debt: 'topic:financien', rekeningen: 'topic:financien',
  drink: 'topic:midelen', alcohol: 'topic:midelen', wiet: 'topic:midelen', drugs: 'topic:midelen', blowen: 'topic:midelen', drinken: 'topic:midelen',
  identiteit: 'topic:identiteit', 'wie ben ik': 'topic:identiteit', mezelf: 'topic:identiteit', identity: 'topic:identiteit',
  mantelzorg: 'topic:zorg', 'zorgen voor': 'topic:zorg', kinderen: 'topic:zorg', moeder: 'topic:zorg', vader: 'topic:zorg', dementie: 'topic:zorg', opa: 'topic:rouw', oma: 'topic:rouw',
  zwanger: 'topic:gezondheid', bevallen: 'topic:gezondheid', baby: 'topic:zorg', kraambed: 'topic:gezondheid',
  paniekaanval: 'topic:paniek', paniek: 'topic:paniek', hyperventilatie: 'topic:paniek', hartkloppingen: 'topic:lichaam', hart: 'topic:lichaam', adem: 'topic:lichaam',
  thuis: 'topic:wonen', woning: 'topic:wonen', kamer: 'topic:wonen', huis: 'topic:wonen',
  hobby: 'topic:vrijetijd', sporten: 'topic:vrijetijd', weekend: 'topic:vrijetijd',
  pieker: 'topic:gedachten', piekeren: 'topic:gedachten', gedachten: 'topic:gedachten', worry: 'topic:gedachten', rumineer: 'topic:gedachten', hoofd: 'topic:gedachten',
};
