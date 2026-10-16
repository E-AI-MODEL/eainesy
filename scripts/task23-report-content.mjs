/**
 * Task 23 — inhoudsmodule voor het afrondingsrapport (Nederlands).
 * DSL: { h1 } { h2 } { p } { note } { table }
 * Alle feiten zijn in deze omgeving gemeten (commands zie hoofdstuk 3) of
 * zijn directe gevolgen van de aangebrachte correcties. Onderscheid
 * feit/interpretatie/aanname is aangegeven waar relevant.
 */

export const meta = {
  title: 'Laatste correcties en releasecontrole',
  subtitle: 'EAInesy · Task 23 — afrondingsrapport bij Task 22 (commit 11be56f)',
  englishLabel: 'TASK 23',
  metaLines: [
    'Repository: EAInesy — neuro-symbolische onderzoeksdemo (Next.js · GLM · Z3)',
    'Uitgangspunt: Task 22, commit 11be56f, en het onafhankelijke verificatierapport',
    'Omvang: beperkte correcties, volledige releasecontrole, releaseadvies',
    'Datum: 16 oktober 2026',
  ],
  footerLeft: 'EAInesy — Task 23',
  footerRight: 'Afrondingsrapport',
};

export const body = [
  // ════════════════════════════════════ 1 ════════════════════════════════════
  { h1: '1. Samenvatting en releaseadvies' },
  { p: 'Deze opdracht rondt EAInesy technisch af als neuro-symbolische onderzoeksdemonstrator. Er zijn drie groepen correcties uitgevoerd: de zes verouderde "65 beslisregels"-vermeldingen in de gebruikersinterface en de twee bijbehorende code-commentaren zijn naar 66 gecorrigeerd; de werklog bevat een correctienotitie over de werkelijke omvang van de regressiesuite; en het risicolexicon is uitgebreid met vier meerwoordige Nederlandse noodfrases die Task 22 als gemist had gemeten, elk onderbouwd met herkennings-, ontkenning- en fout-positief-tests en vastgelegd in nieuwe regressiepins. Verder zijn geen functionele wijzigingen aangebracht: de beslisregels, invarianten, onzekerheidsberekening en uitvoerbeleid zijn onaangeroerd gebleven.' },
  { p: 'De volledige releasecontrole is groen: regressiesuite 28/28 PASS, modelchecker PASS over 17.280 toestanden \u00d7 26 invarianten met 66 regels, Z3 op server-runtime sat, fast-evaluatie 58/58, TypeScript nul fouten in src, lint schoon, productiebuild geslaagd en de auditledger intact met 10.834 vermeldingen. \u00c9\u00e9n beperkte live GLM-beurt (Nederlands, werkstress) verliep end-to-end correct: THERAPEUTIC_DIALOG via P43, Z3-certificaat sat zonder override, uitvoerbeleid zonder aantekening. Wat niet kon worden uitgevoerd, wordt uitdrukkelijk in hoofdstuk 3 vermeld.' },
  { p: 'Releaseadvies: READY WITH LIMITATIONS. De demo is na de beperkte correcties betrouwbaar en controleerbaar genoeg om als neuro-symbolische onderzoeksdemonstrator te worden afgerond. De resterende beperkingen (hoofdstuk 5) zijn gedocumenteerd, begrensd en sturen — waar ze doorslaan — steeds in veilige richting; ze vragen om een normbeslissing of vervolgonderzoek, niet om direct herstel. Hiermee is de centrale releasevraag bevestigd: neurale flexibiliteit en expliciete, controleerbare beslislogica werken in deze architectuur aantoonbaar samen.' },
  { note: 'Feit/interpretatie: alle cijfers in dit rapport zijn in deze omgeving gemeten; de beoordeling "veilig richting" volgt uit de gepegde gedragingen (R1b, R10, R11) en is deels interpretatie van planniveau.' },

  // ════════════════════════════════════ 2 ════════════════════════════════════
  { h1: '2. Uitgevoerde correcties' },
  { h2: '2.1 Verouderde aantallen (A / N6)' },
  { p: 'Zes gebruikerszichtbare teksten noemden nog "65 beslisregels" terwijl de regelbasis sinds P66 uit Task 21 er 66 telt: nl.ts regel 214 (Verificatiepaneel), 413 (regel van toom) en 550 (eerlijkheidsblok bijsturing), plus de engelse tegenhangers en.ts regel 208, 400 en 537. Daarnaast vermeldden twee code-commentaren het oude aantal: controller.ts regel 5 ("an ORDERED list of 65 guard rules") en steer.ts regel 15 ("What steering NEVER changes"). Alle acht zijn gecorrigeerd naar 66.' },
  { p: 'De overige getalclaims in de interface zijn systematisch tegen de implementatie gecontroleerd met productiefuncties en bronreading (scripts/task23-checks.ts, deel A) en zijn allemaal juist: 66 beslisregels (DECISION_RULES.length), 16 families (FAMILIES), 30 intenties (INTENTS), 17.280 toestanden (enumerateControllerInputs: 30\u00d74\u00d73\u00d73\u00d74\u00d72), 26 invarianten (bron-telling INV-id\u2019s en live verify), 58 probes (PROBES), 8 markerklassen (MARKER_WEIGHTS), \u03b5 = 0,15/0,30 (STEER_EPSILON), kalibratie n = 52, en de koppelingen "P51/P52 \u2192 invariant 25" en "P53\u2013P65 \u2192 invariant 26" in de referentieteksten. Er zijn verder geen verkeerde aantallen gevonden.' },
  { h2: '2.2 Werklog (B / N7)' },
  { p: 'De werklog van Task 21 noteerde "regress 24/24 PASS", terwijl de regressiesuite op dat commitpunt (b1160f4) in werkelijkheid 25 checks telde \u2014 bevestigd door telling van de check()-aanroepen op zowel b1160f4 als 11be56f (beide 25). In de werklog is tussen de Task 21- en Task 22-blokken een correctienotitie toegevoegd die dit feit vastlegt; de historische Task 21-rapportage is ongewijzigd behouden. De notitie vermeldt tevens de 65\u219266-correctie en de huidige suitemvang na de Task 23-pins (28 checks).' },
  { h2: '2.3 Lexiconherstel (I / N5) \u2014 zie hoofdstuk 3' },
  { p: 'Vier meerwoordige Nederlandse noodfrases zijn toegevoegd aan het symbolische lexicon in src/lib/eainesy/lexicon.ts, verdeeld over drie markerklassen: HOPELESSNESS ("(ik) zie \u2026 geen uitweg"), SUBSTANCE ("drink elke avond/nacht \u2026 wijn/alcohol/bier/drank/fles") en SUICIDAL_IDEATION (twee patronen: het ideatie-verankeringspatroon "denk/droom/overweeg/plan \u2026 om niet meer terug te komen" en het verlichtingskader "rustig/fijn/beter/kalm/vredig/prettig/mooi zijn als ik er (tussenwoord) niet meer was/ben/word"). De bestaande patronen, gewichten, drempels en alle beslisregels zijn onaangeroerd gebleven; de escalatie loopt uitsluitend via de bestaande max-fusie. Drie nieuwe regressiechecks (R11a/b/c) pinnen het gedrag; daarmee telt de suite 28 checks.' },
  { note: 'Wijzigingen per bestand: src/lib/i18n/nl.ts (3 tekstregels), src/lib/i18n/en.ts (3), src/lib/eainesy/controller.ts (commentaar, 1), src/lib/eainesy/steer.ts (commentaar, 1), src/lib/eainesy/lexicon.ts (13 toegevoegde regels: 4 patronen + commentaar), scripts/regress-formal.ts (R11, header + 48 regels), werklog.md (correctienotitie), plus de nieuwe onderzoekscripts scripts/task23-checks.ts en de rapportpipeline. Wijziging C, D, E en J uit Task 22 zijn conform opdracht niet uitgevoerd.' },

  // ════════════════════════════════════ 3 ════════════════════════════════════
  { h1: '3. Onderzoek gemiste signalen (N5)' },
  { p: 'Task 22 mat vier Nederlandstalige noodfrases die het lexicon volledig miste (marker-loos, risiconiveau NONE). Voor elke formulering is met uitsluitend productiefuncties getest: herkenning van de oorspronkelijke uitspraak, ontkenningen, onschuldige contexten, het risico op fout-positieve herkenning en de gevolgen voor de bestaande beslisregels. De kandidaatpatronen zijn eerst in een duidelijk gelabelde testharness gemeten (zelfde productie-isNegated, scoring en decide()), daarna pas in de productiebron geplaatst en daar opnieuw geverifieerd (scripts/task23-checks.ts, delen B en C).' },
  { table: {
      caption: 'Tabel 1 \u2014 Per formulering: besluit en onderbouwing',
      headers: ['Formulering (gemeten miss)', 'Kandidaatpatroon en klasse', 'Tests', 'Besluit'],
      rows: [
        ['"ik zie geen uitweg meer"', 'zie[tf]? + gap \u2264 2 woorden + "geen uitweg" \u2192 HOPELESSNESS (2,5 \u2192 ELEVATED)', 'herkend; varianten "gewoon/hier" herkend; onpersoonlijke vorm "er was geen uitweg uit het gebouw" en meervoud "uitwegen" blijven schoon', 'toegevoegd'],
        ['"ik drink elke avond wijn om de pijn te vergeten"', 'drink elke avond/nacht + drankwoord binnen 24 tekens \u2192 SUBSTANCE (1,5 \u2192 ELEVATED)', 'herkend, ook "een glas wijn"; thee/koffie-contexten en "geen alcohol meer" blijven schoon', 'toegevoegd'],
        ['"soms denk ik erover om niet meer terug te komen"', 'ideatiewerkwoord (denk/droom/overweeg/plan) + volledige clausule \u2192 SUICIDAL_IDEATION (5,0 \u2192 CRISIS)', 'herkend; heroverweging-idiom "terugkomen op/bij/in/naar/voor/over" (voetbalclub, voorstel, besluit) geblokkeerd', 'toegevoegd'],
        ['"het zou rustig zijn als ik er morgen niet meer was"', 'verlichtingskader (rustig/fijn/beter/\u2026 zijn als ik er \u2026 niet meer) \u2192 SUICIDAL_IDEATION (5,0 \u2192 CRISIS)', 'herkend, ook "straks"/"beter voor iedereen"; ontkenning "niet rustig" en vakantieformulering met "even" blijven schoon', 'toegevoegd'],
      ],
  }},
  { p: 'Gevolgen voor de bestaande beslisregels zijn met productie-decide() gemeten: de twee ELEVATED-frases monden bij lexicale vloer uit in de veiligheidsfamilie (P12/P13, SAFETY_RESPONSE), de twee CRISIS-frases in het crisisprotocol (P04) \u2014 precies de bedoelde gestaffelde zorg. Er is géén automatische escalatie op losse trefwoorden toegevoegd: elk patroon is meerwoordig, semantisch verankerd en getest tegen ontkenning en onschuldige contexten. Ontkenningen werken via het bestaande negatiewenster (30 tekens vóór de match); bij het verlichtingskader vangt het venster ook "het zou níet rustig zijn \u2026" af.' },
  { p: 'Bewust níet gewijzigd (beperking gedocumenteerd): de blote frase "om de pijn te vergeten" is niet als marker opgenomen, omdat zij in coping-taal vaker onschuldig voorkomt ("bewegen helpt me om de pijn te vergeten") en dan een fout-positieve verwijzing zou veroorzaken; de gemeten zin wordt wél gevangen via het drankpatroon. Verder blijven onherkend: onpersoonlijke vormen ("er is geen uitweg"), "van plan om niet meer terug te komen", tussenruimtes van meer dan twee woorden ("als ik er volgende week niet meer ben" \u2014 bewust, wegens de vakantie-fout-positief) en uitspraken waarin het negatiewenster een eerder "niet" binnen 30 tekens telt ("je ziet het niet meer zitten, hier zie ik geen uitweg"). Dit is de bekende niet-formele laag; de miss-rate daarbuiten is niet gemeten.' },

  // ════════════════════════════════════ 4 ════════════════════════════════════
  { h1: '4. Volledige releasecontrole \u2014 werkelijke resultaten' },
  { table: {
      caption: 'Tabel 2 \u2014 Uitgevoerde controles (16 oktober 2026, deze omgeving)',
      headers: ['Controle', 'Commando', 'Werkelijk resultaat'],
      rows: [
        ['Regressiesuite', 'bun scripts/regress-formal.ts', '28/28 PASS (25 bestaand + nieuw R11a/b/c), 0 FAIL'],
        ['Modelchecker', 'GET /api/verify', 'PASS: 17.280 toestanden \u00d7 26 invarianten, ruleCount 66, 0 schendingen'],
        ['Z3 (server-runtime)', 'live GLM-beurt via POST /api/chat', 'available: true, result: sat (363 ms), géén override-sleutel in het certificaat'],
        ['Fast-evaluatie', 'GET /api/eval?mode=fast', '58/58 PASS (nieuwste run, 0 mislukte probes)'],
        ['TypeScript', 'bunx tsc --noEmit', 'src: 0 fouten; scripts: uitsluitend 3 bekende, pre-existente fouten (task01-repro TS2867, task21-onderzoek TS2339, task22-audit TS2305); 0 nieuwe'],
        ['Lint', 'bunx eslint src --max-warnings=0', 'schoon (exit 0)'],
        ['Productiebuild', 'bun run build', 'geslaagd; 9 routes, 5/5 statische pagina\u2019s'],
        ['Auditledger', 'GET /api/ledger?verify=1', 'verification ok: true \u2014 10.834 vermeldingen, geen ketenbreuk'],
        ['Live GLM (1 beurt)', 'POST /api/chat, Nederlands, werkstress', 'THERAPEUTIC_DIALOG via P43; conf 0,877, band HIGH, risk NONE; modelCheck 17.280\u00d726 PASS; outputPolicy pass, geen reparatie; conformal p = 0,63 > \u03b5 = 0,15 (n = 52); KG-gegronde ademruimte-techniek'],
      ],
  }},
  { p: 'Uitdrukkelijk niet uitgevoerd: (1) Z3 onder de bun-CLI \u2014 de z3-solver loopt daar structureel op NOT RUN; dit is een bekende omgevingsbeperking en de server-runtime is wél gevalideerd (live sat-certificaat). (2) Het live triggeren van z3-unsat/unknown via productievoeding \u2014 die toestanden zijn by design onbereikbaar; het functiecontract is gepind in R8a\u2013e inclusief de unknown-pin. (3) Meer dan de \u00e9\u00e9n gevraagde live GLM-beurt, en grootschaliger gedragsevaluatie \u2014 beide buiten de opdracht.' },

  // ════════════════════════════════════ 5 ════════════════════════════════════
  { h1: '5. Besluiten over N1\u2013N11' },
  { p: 'Beoordelingskader: per bevinding is de balans gewogen tussen menselijke proceslogica, technische uitvoerbaarheid, betrouwbaarheid, gesprekskwaliteit en complexiteit \u2014 niet de oorspronkelijke ontwerpfilosofie als absolute norm. Concreet is per geval gevraagd: veroorzaakt het gedrag een aantoonbaar veiligheidsrisico (dan correctie), alleen een gesprekskwaliteitsverlies in een zeldzame zone (dan beperking documenteren), of is het gedrag expliciet beargumenteerd beleid (dan ontwerpkeuze). Wijzigingen C, D, E en J uit Task 22 zijn conform opdracht functioneel onaangetast gebleven.' },
  { table: {
      caption: 'Tabel 3 \u2014 Classificatie N1\u2013N11',
      headers: ['Bevinding', 'Classificatie', 'Onderbouwing'],
      rows: [
        ['N1 band-incoherentie (204 roosterpunten)', 'Bekende beperking van de demonstrator', 'Geen veiligheidsrisico: LOW-band antwoordt humility-first (P20-vraag); de erkenningseis uitbreiden is een normbeslissing (C) die de opdracht bewust openlaat; de enige gepegde kasus (PREGNANCY+ELEVATED) is als ontworpen gedocumenteerd (R1b)'],
        ['N2 ABSTAIN-tak zonder verplichte nood-erkenning', 'Bekende beperking van de demonstrator', 'Canned ABSTAIN-tekst noemt 113 wél; alleen de generatorinstructie niet; herstel (D) wacht op dezelfde normbeslissing als N1'],
        ['N3 privacy-tak gaat vóór ACUTE-erkenning', 'Bewuste en verdedigbare ontwerpkeuze', 'Privacy-eerst is beargumenteerd beleid (AVG-art. 5, F7); Task 22 stelde de prioriteit zelf niet ter discussie; de ontbrekende erkenning in de canned BOUNDARY_REFUSAL blijft als beperking gedocumenteerd'],
        ['N4 smalle ACUTE-poort (distress ziet geen risicomarkers)', 'Nog te onderzoeken', 'Het gedrag is gedemonstreerd, de normvraag ("moet zwaar risicoverhaal zonder emotiewoorden ACUTE tellen?") is niet onderzocht; J vergt eigen normonderzoek en raakt meerdere families'],
        ['N5 lexicon mist vier NL-noodfrases', 'Gecorrigeerd', 'Vier meerwoordige frases toegevoegd over 3 klassen, getest op herkenning/ontkenning/fout-positieven, gepind in R11a\u2013c; restdekking als beperking gedocumenteerd (hoofdstuk 3)'],
        ['N6 zes "65"-claims + twee comments', 'Gecorrigeerd', 'Alle acht gecorrigeerd naar 66; overige getalclaims gecontroleerd en juist bevonden'],
        ['N7 "24/24" in Task 21-werklog', 'Gecorrigeerd', 'Correctienotitie toegevoegd: suite bevatte 25 checks op b1160f4; historische rapportage bewaard; suite telt na R11 28 checks'],
        ['N8 conformal.n-semantiek (52 totaal vs band-n)', 'Bekende beperking van de demonstrator', 'De waarden zelf kloppen (p-waarde correct band-specifiek); alleen de veldbetekenis is vervagend; hertoelichting is cosmetisch en viel buiten de genoemde correcties'],
        ['N9 dode waarde "HIGH" in HEAVY_DISTRESS', 'Bekende beperking van de demonstrator', 'Dode code, onschuldig: INV-14/15 werken via ELEVATED en ACUTE; verwijdering is cosmetisch en viel buiten de genoemde correcties'],
        ['N10 steer-veld altijd gevuld', 'Bewuste en verdedigbare ontwerpkeuze', 'Het certificaat toont de actieve bijsturing ook bij standaardwaarden \u2014 informatiever dan het commentaar belooft; leeglaten (H) zou transparantie verminderen'],
        ['N11 eval bereikt de LOW-band niet', 'Bekende beperking van de demonstrator', 'Dekkinskaart-observatie: de LOW-paden (P19/P20/P66) zijn gedekt door regressiepins (R1b, R10b/c), niet door eval-probes; uitbreiding (E) is bewust niet uitgevoerd'],
      ],
  }},
  { note: 'Interpretatiekader: bij N1\u2013N3 is bewust niet het "nooit koud"-beginsel als absolute maat genomen, maar de vraag of het huidige antwoord in veilige richting blijft en of herstel de complexiteit en het regressierisico rechtvaardigt. Bij N8\u2013N10 woog doorzicht tegen cosmetische drift in de releasefase.' },

  // ════════════════════════════════════ 6 ════════════════════════════════════
  { h1: '6. Bekende beperkingen (definitief)' },
  { p: 'Bij release zijn de volgende beperkingen gedocumenteerd en bewust aanwezig. (1) Plandekking: de 204 roosterpunten uit N1, de ABSTAIN- en privacy-takken uit N2/N3 \u2014 herstel vraagt een normbeslissing van de opdrachtgever. (2) Herkenningsbreedte: het lexicon blijft een niet-formele laag met bekende residuen (hoofdstuk 3); de distress-poort uit N4 is nog niet onderzocht. (3) Rapportagedetails: N8/N9/N10 zoals in Tabel 3. (4) Eval-dekking: de LOW-band is alleen via regressiepins gedekt (N11). (5) Omgeving: z3-solver onder de bun-CLI blijft NOT RUN; server-runtime is de gevalideerde route. (6) Buiten het formele bewijs blijven, zoals Task 22 al vastlegde: het taalmodel zelf (GLM), de KG-inhoud, de kalibratievaliditeit en de planinhoud \u2014 het bewijs gaat over het hek eromheen, niet over de black box.' },
  { p: 'Geen van deze beperkingen impliceert onveilig gedrag in de gepegde paden: alle gepinde normen (R1\u2013R11) zijn groen, en waar onzekerheid of herkenning faalt, valt het systeem fail-closed terug op canned veilige antwoorden, HITL of het crisisprotocol.' },
];
