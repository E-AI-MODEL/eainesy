/**
 * Task 24 — rapportinhoud (NL). Structuur: meta + body-items.
 * Item-types: h1, h2, p, note, table {caption, headers, rows}, imgPair, img.
 */

export const meta = {
  title: 'EAInesy \u2014 Task 24: UI/UX-audit en gerichte verfijning',
  subtitle: 'Onafhankelijke audit van de demonstrator zoals een nieuwe gebruiker die ervaart, gevolgd door gerichte, aantoonbaar nuttige verbeteringen \u2014 met behoud van alle technische diepgang en bewijsgrenzen.',
  englishLabel: 'UI UX AUDIT AND REFINEMENT',
  metaLines: [
    'Opdracht: Task 24 \u2014 UI/UX-audit en gerichte verfijning',
    'Uitgangspunt: Task 23 (commit c0c32c1) met releaseadvies READY WITH LIMITATIONS',
    'Uitvoering: commit 019b1c2 \u2014 16 oktober 2026',
    'Oordeel: UI/UX READY WITH LIMITATIONS',
  ],
  footerLeft: 'EAInesy \u2014 neuro-symbolische onderzoeksdemonstrator',
  footerRight: 'Task 24 \u00b7 2026',
};

export const body = [

  // ── 1. Samenvatting ──────────────────────────────────────────────────────
  { h1: '1. Samenvatting en oordeel' },
  { p: 'Task 24 heeft EAInesy visueel en functioneel geauditeerd zoals een nieuwe gebruiker de applicatie ervaart, en heeft daarna uitsluitend gerichte, laag-risico verbeteringen doorgevoerd. De audit bestreek alle negen secties, de onboarding in drie stappen, de handleiding en de disclaimer, op drie viewports (1440, 768 en 390 px) en in beide interfacetalen. Twee live gespreksbeurten (Piekergedrag en Eerlijke grenzen) zijn end-to-end door de productiepijplijn getest, inclusief het redeningsspoor en het beslis-certificaat.' },
  { p: 'De centrale vraag van de opdracht luidt of EAInesy voor een nieuwe gebruiker begrijpelijk, prettig en professioneel vormgegeven is, terwijl de technische werking en bewijsgrenzen toegankelijk en eerlijk zichtbaar blijven. Het antwoord is bevestigend. De bestaande interface bleek verrassend volwassen: de driestaps-onboarding legt eerlijk uit wat de demo wel en niet doet, het gespreksscherm houdt de prim\u00e8re interactie rustig, en de Verificatie-pagina framet de bewijsgrens expliciet met de banner "Wat dit bewijst \u2014 en wat niet". De audit vond geen structurele of architecturale problemen; de bevindingen waren beperkt tot twee responsieve lay-outfouten, drie feitelijk verwarrende labels, twee typografische fouten, ontbrekende foutstaten en vier kleine kwaliteitspunten.' },
  { p: 'Alle vijf A-items en vier B-items zijn gecorrigeerd, na-gecontroleerd in de browser en technisch gevalideerd. Negen ontwerpkeuzes zijn bewust behouden en in hoofdstuk 5 beargumenteerd. Het oordeel luidt: UI/UX READY WITH LIMITATIONS. De resterende beperkingen (hoofdstuk 9) zijn gedocumenteerd, beperkt van omvang en gerechtvaardigd binnen de opdrachtgrenzen; geen enkele be\u00efnvloedt de betrouwbaarheid van de getoonde bewijzen.' },

  // ── 2. Methodiek ─────────────────────────────────────────────────────────
  { h1: '2. Auditmethodiek en dekking' },
  { p: 'De audit is uitgevoerd met een headless browser tegen de draaiende dev-server, v\u00f3\u00f3r dat enige wijziging was doorgevoerd. De eerste indruk is beoordeeld met een schone browserprofil: de onboarding verscheen en alle drie de stappen zijn doorlopen. Daarna zijn alle negen secties (Dashboard, Chat, Verificatie, Red-team, Review, Kennis, Logboek, Over, Bijsturen) op desktop bezocht, gevolgd door het gespreksscherm met twee live GLM-beurten, de pipeline-sheet, info-tips en het toetsenbordnavigatiepad.' },
  { p: 'Vervolgens zijn dezelfde schermen op tablet (768 px) en mobiel (390 px) beoordeeld, inclusief de mobiele bottomnavigatie, het menu-sheet, de "Laatste pipeline"-balk en beide dialogen. De taalschakelaar NL/EN is op beide talen doorlopen; de taalvoorkeur bleef correct bewaard tussen herladingen. In totaal zijn 46 screenshots vastgelegd als auditbewijs (screenshots/task24/).' },
  { note: 'Omgevingsnotitie: bij de eerste auditronde gaven alle API-endpunten 500, omdat de Prisma-cli\u00ebnt in deze werkomgeving niet was gegenereerd. Dit is een omgevingskwestie, geen codefout; na prisma generate (versie 6.11.1, reeds als devDependency gedeclareerd) waren alle controles normaal beloopbaar. Dit incident leidde wel tot A5: de UI mocht bij een falende status-API nooit oneindig skeletons tonen.' },

  // ── 3. Bevindingen ───────────────────────────────────────────────────────
  { h1: '3. Belangrijkste auditbevindingen' },
  { p: 'De bevindingen zijn volgens opdracht in drie categorie\u00ebn gedeeld: A (direct verbeteren \u2014 aantoonbare problemen), B (kleine kwaliteitsverbeteringen) en C (bewust behouden \u2014 gerechtvaardigde keuzes). Tabel 1 toont de vijf A-items. Twee ervan zijn klassieke grid-blowouts: een knop of rij zonder minimale breedtebeperking dwingt de kolom breder dan de viewport, waardoor inhoud onzichtbaar buiten beeld valt. \u00c9\u00e9n ervan (A1) trof de basiscomponent voor alle dialogen en daarmee de handleiding \u2014 het eerste scherm dat een nieuwe gebruiker ziet.' },
  { table: {
    caption: 'Tabel 1 \u2014 A-items (aantoonbare UI/UX-problemen)',
    headers: ['Nr', 'Bevinding', 'Gevolg voor de gebruiker'],
    rows: [
      ['A1', 'DialogContent-basis is een grid zonder kolomdefinitie; de implicit-track volgt de min-content-breedte van de driestaps-flow (392 px).', 'In de handleiding op 390 px liep de volledige bodytekst symmetrisch buiten de dialoog \u2014 op het eerste kennismakingsscherm.'],
      ['A2', 'De kaartrij "Waar start ik?" ontbrak min-w-0 op de grid-knoppen.', 'Op mobiel was de rij 424 px breed in een 366 px-container; teksten en chevrons vielen buiten beeld.'],
      ['A3', 'Drie teksten noemden de modelcheck "afgecheckt tegen 26 veiligheidsregels" (nl+en).', '26 is het aantal invarianten; beslisregels zijn er 66. De Verificatie-pagina zelf gebruikte de correcte begrippen \u2014 de tellen die de begrensde bewijsclaim dragen, waren inconsistent.'],
      ['A4', 'Typografische fouten in het Logboek: "Kettings controle" en "Ketening GEBROKEN".', 'Oprofessionele indruk in het paneel dat juist de integriteitscontrole toont.'],
      ['A5', 'Dashboard-KPI\u2019s bleven bij een falende status-API eeuwig skeletons tonen.', 'De UI logde dat de status "aan het laden" was, terwijl de bron onbereikbaar was \u2014 in strijd met de eis dat de UI de werkelijke systeemstatus toont.'],
    ],
  } },
  { p: 'Daarnaast leverde een gerichte scan van alle numerieke claims in beide taalbestanden \u00e9\u00e9n nieuwe verouderde telling op van dezelfde klasse die Task 23 voor "65 \u2192 66" corrigeerde: de Engelse kaart "I want to test the safety" noemde nog 50 voorafgemaakte aanvallen, terwijl de suite 58 probes telt. Dit is samen met de A-items gecorrigeerd.' },

  // ── 4. Verbeterd ─────────────────────────────────────────────────────────
  { h1: '4. Wat is verbeterd en waarom' },
  { p: 'Alle correcties zijn lokale, gerichte ingrepen in UI-componenten en i18n-teksten. Beslisregels, invarianten, Z3-, conformal-, lexicon- en risicologica, GLM-prompts en antwoordbeleid zijn onaangetast; het certificaat is geen veld gewijzigd. Tabel 2 somt de uitgevoerde correcties met de onderbouwing.' },
  { table: {
    caption: 'Tabel 2 \u2014 Uitgevoerde correcties (A + B)',
    headers: ['Nr', 'Correctie', 'Waarom'],
    rows: [
      ['A1', 'DialogContent (ui/dialog.tsx): [grid-template-columns:minmax(0,1fr)] toegevoegd.', '\u00c9\u00e9n principi\u00eble regel op de basiscomponent lost alle dialogen tegelijk op; getest op handleiding NL/EN en disclaimer op 390 px (nu exact sw356/cw356).'],
      ['A2', 'min-w-0 op de drie "Waar start ik?"-knoppen (dashboard-panel.tsx).', 'Standaard grid-fix: items mogen krimpen, de truncate-tekst doet de rest; kaartrij nu sw366/cw366 op mobiel.'],
      ['A3', '"26 veiligheidsregels" \u2192 "26 invarianten \u2014 de kerngaranties van de 66 beslisregels" op drie plekken per taal.', 'De bewijsclaim wordt daarmee exact zo precies geformuleerd als op de Verificatie-pagina; consistentie tussen onboarding, dashboard en verificatie.'],
      ['A4', '"Kettingcontrole" en "Ketting GEBROKEN" (nl.ts).', 'Correct Nederlands in het integriteitspaneel.'],
      ['A5', 'Nieuwe loaded-state: na afgeronde fetch tonen lege KPI\u2019s en health-rijen "niet beschikbaar \u2014 bron onbereikbaar" (KpiUnavailable) i.p.v. skeleton.', 'Eerlijke systeemstatus: kortdurend laden mag een skeleton zijn, permanente onbereikbaarheid niet. Getest door /api/verify te blokkeren en weer vrij te geven.'],
      ['Bonus', 'en.ts: "50 pre-built attacks" \u2192 "58".', 'Zelfde klasse als Task 23\u2019s 65\u219266: de telling moet overal de werkelijke suitergrootte volgen.'],
      ['B1', 'Desktop-tabbalk toont een subtiele witte fade rechts zolang er tabs buiten beeld vallen (meting via scrollWidth, hermeet bij resize en scroll).', 'Op 768 px verdwenen "Over" en "Bijsturen" zonder enkele hint; de fade geeft een herkenbare scroll-affordance zonder ruis.'],
      ['B2', 'Onzichtbare hitzone van de "?"-info-tips vergroot (after:-inset-1.5; visueel onveranderd).', 'Raakvlak groeit van 15 px naar ~30 px \u2014 betere mobiele bediening van de zelfverklarende UI, het kernkanaal van niveau 1.'],
      ['B3', 'Flow-labels in de hero en handleiding wrapen nu i.p.v. truncatie.', '"Symbolische kern" brak af tot "Symboli\u2026"; afbreken op woordgrens is rustiger en leesbaarder dan afkappen.'],
      ['B4', 'Red-team/eval-intro (attackClasses) van text-stone-400 naar text-stone-500.', 'Contrast steeg van \u22482,4:1 naar \u22484,7:1 op wit en passeert daarmee WCAG AA voor deze alineatekst.'],
    ],
  } },

  // ── 5. Behouden ──────────────────────────────────────────────────────────
  { h1: '5. Wat bewust behouden is' },
  { p: 'Volgens opdracht is niet automatisch alles aangepast wat opvalt. De volgende keuzes zijn beoordeeld en bewust behouden, telkens met het argument wat de gebruiker er bij een wijziging zou winnen. In alle negen gevallen woog dat de huidige oplossing functioneel gerechtvaardigd is en een wijziging churn of risico zou toevoegen zonder meetbare winst.' },
  { table: {
    caption: 'Tabel 3 \u2014 Bewust behouden (categorie C)',
    headers: ['Keuze', 'Onderbouwing'],
    rows: [
      ['Engelse technische subregels in het redeningsspoor (bijv. "PASS \u00b7 17280 states \u00b7 26 invariants").', 'Dit zijn machine-logregels uit de productiepijplijn (orchestrator.ts), taalonafhankelijk zoals logregels dat zijn; stapnamen, badges, filters en legenda zijn w\u00e9l vertaald. Vertalen zou productiecode en de inhoud van het auditlogboek raken voor puur cosmetische winst.'],
      ['Ruwe duur ("12607 ms") bij het antwoord.', 'Eerlijk bewijsstatement, visueel gedempt en met uitleg-tip; hoort bij het onderzoeksdoel.'],
      ['Redeningsspoor leeg tijdens verwerking.', 'Het spoor verschijnt compleet na afronding; op mobiel vangt de inklapbare "Laatste pipeline"-balk dit op. Geen half-geladen spoor tonen is rustiger dan een spinner per stap.'],
      ['Gesprekken niet gepersisteerd na herlading.', 'Demo-scope: elke beurt staat hash-geketend in het auditlogboek; chatgeschiedenis is client-staat. Persistente gesprekken zou nieuwe opslag betekenen (buiten opdracht).'],
      ['Twee-koloms Verificatie met lege linkeronderhoek.', 'Inhoudsgedreven indeling: de linker kolom (model check) is nu eenmaal korter dan de regellijst rechts; herstructurering is churn zonder leesbaarheidswinst.'],
      ['Amber bewijsgrens-banner "Wat dit bewijst \u2014 en wat niet".', 'Voorbeeldige eerlijke framing; exact wat de opdracht vraagt. Behouden en onveranderd.'],
      ['Skeletons tijdens de eerste laadbeurt.', 'Kortdurend laden is een legitieme skeleton-use-case; alleen de permanent-foute staat is gecorrigeerd (A5).'],
      ['Tweetalige input-placeholder ("Schrijf in het Nederlands of English\u2026").', 'Bewuste verwelkoming van beide doeltalen; consistent met de taalagnostische input.'],
      ['Kleine, hoofdletter-labels van KPI-kaarten in stone-400.', 'Secundaire micro-labels boven grote, sterke waarden; verhogen naar stone-500 zou de hi\u00ebrarchie vlakken. De alineatekst waar AA telt, is w\u00e9l gecorrigeerd (B4).'],
    ],
  } },

  // ── 6. Screenshots ───────────────────────────────────────────────────────
  { h1: '6. Voor-en-na-screenshots' },
  { p: 'De drie duidelijkste paren zijn opgenomen; alle 46 auditbeelden staan in screenshots/task24/. Elk paar toont dezelfde weergave v\u00f3\u00f3r en n\u00e1 de correctie, zonder overige wijzigingen.' },
  { imgPair: { left: '38-mobiel-handleiding.png', right: '41-fix-dialoog-mobiel.png', w: 390, h: 844, caption: 'Figuur 1 \u2014 Handleiding op 390 px, stap 1 (EN). Links: bodytekst loopt buiten de dialoog (A1). Rechts: na de grid-fix wrapt alle tekst binnen de dialoog en breekt "Symbolic core" netjes af (B3).' } },
  { imgPair: { left: '27-mobiel-dashboard.png', right: '42-fix-kaartrij-mobiel.png', w: 390, h: 844, caption: 'Figuur 2 \u2014 Dashboard op 390 px (NL/EN). Links: de kaartrij "Waar start ik?" loopt buiten beeld en de chevrons zijn onzichtbaar (A2). Rechts: de rij past exact (sw366/cw366) en toont bovendien de gecorrigeerde labels "26 invarianten" en "58 pre-built attacks".' } },
  { imgPair: { left: '32-tablet-dashboard.png', right: '43-fix-tabbalk-tablet.png', w: 768, h: 1024, caption: 'Figuur 3 \u2014 Dashboard op 768 px (EN). Links: de tabbalk loopt na "Ledger" af zonder hint. Rechts: subtiele fade rechts markeert de scrollbare tabbalk (B1).' } },
  { p: 'De KPI-foutstaat (A5) is gevalideerd door /api/verify tijdens de test kunstmatig te blokkeren: de betreffende kaart en health-rij tonen dan "unavailable \u2014 source unreachable" in gedempte stijl, terwijl de overige KPI\u2019s normaal laden; na het opheffen van de blokkade herstelde de volledige status. Deze staat is bewust geen screenshot-paar waard omdat het "voor"-beeld een omgevingsfout was, geen ontwerptoestand.' },

  // ── 7. Bestanden ─────────────────────────────────────────────────────────
  { h1: '7. Gewijzigde bestanden en commit' },
  { p: 'De implementatie is als \u00e9\u00e9n commit vastgelegd op 019b1c2 ("Task 24: UI/UX-audit + gerichte verfijning \u2026"), elf bestanden, 183 toevoegingen en 91 verwijderingen, waarvan de tooling-bestanden (package.json/bun.lock) alleen de installatie van de reeds gedeclareerde prisma-devDependency registreren. Geen enkel bestand onder src/lib/eainesy is gewijzigd \u2014 de symbolische kern is byte-identiek gebleven.' },
  { table: {
    caption: 'Tabel 4 \u2014 Gewijzigde bronbestanden',
    headers: ['Bestand', 'Wijziging'],
    rows: [
      ['src/components/ui/dialog.tsx', 'A1: kolomdefinitie [grid-template-columns:minmax(0,1fr)] op DialogContent-basis.'],
      ['src/components/eainesy/dashboard-panel.tsx', 'A2: min-w-0 op start-kaarten; A5: loaded-state, KpiUnavailable, HealthRow-foutstaat.'],
      ['src/lib/i18n/nl.ts', 'A3 (3\u00d7), A4 (2\u00d7), nieuw label statusUnavailable.'],
      ['src/lib/i18n/en.ts', 'A3 (3\u00d7), 50\u219258, nieuw label statusUnavailable.'],
      ['src/app/page.tsx', 'B1: tabbalk-fade met meetlogica (resize + scroll).'],
      ['src/components/eainesy/info-tip.tsx', 'B2: hitzone after:-inset-1.5.'],
      ['src/components/eainesy/signal-flow.tsx', 'B3: labels wrapen i.p.v. truncatie.'],
      ['src/components/eainesy/eval-panel.tsx', 'B4: contrast stone-400 \u2192 stone-500.'],
      ['worklog.md', 'Auditfase en implementatiefase gedocumenteerd (Task ID 24).'],
    ],
  } },

  // ── 8. Controles ─────────────────────────────────────────────────────────
  { h1: '8. Technische en visuele controles' },
  { p: 'Tabel 5 rapporteert de werkelijk uitgevoerde controles na implementatie. De formele controles zijn ongewijzigd groen: de UI-wijzigingen raken de kern niet, en dat is gemeten, niet aangenomen.' },
  { table: {
    caption: 'Tabel 5 \u2014 Uitgevoerde controles',
    headers: ['Controle', 'Resultaat'],
    rows: [
      ['TypeScript (tsc --noEmit, gefilterd op src/)', '0 fouten. (Foutmeldingen onder analysis/v20/ behoren tot een ander, meegeleverd referentieproject en zijn niet-EAInesy.)'],
      ['ESLint (src, --max-warnings=0)', 'Schoon \u2014 geen fouten of warnings.'],
      ['Productiebuild (bun run build)', 'Geslaagd; 9 routes (4 static, 5 dynamic API).'],
      ['Regressiesuite (scripts/regress-formal.ts)', '28/28 PASS, inclusief R11a\u2013c lexiconpinnen en R8-contractpinnen.'],
      ['Model check via /api/verify', 'PASS: 17.280 toestanden \u00d7 26 invarianten in 26,9 ms; 66 regels in 16 families.'],
      ['Audit-ledger via /api/ledger?verify=1', 'Intact: 10.856 vermeldingen, keten geverifieerd.'],
      ['Fast red-team via dashboard', '58/58 probes geslaagd (laatste run, live getoond).'],
      ['Visuele browsercontrole', 'Uitgevoerd op 1440, 768 en 390 px in NL en EN: dashboard, chat met live beurt, verificatie, red-team, review, kennis, logboek, over, bijsturen, onboarding, handleiding, disclaimer, menu-sheet, focusringen; 46 screenshots (screenshots/task24/).'],
      ['KPI-foutstaat (A5)', 'Gevalideerd door /api/verify te blokkeren: eerlijke foutstaat, correct herstel na opheffen.'],
      ['Live GLM-beurten', 'Twee end-to-end (NL): Piekergedrag \u2192 THERAPEUTIC_DIALOG (conf 94%, z3 sat, 17.280 \u00d7 26, outputPolicy pass) en Eerlijke grenzen \u2192 PSYCHOEDUCATION (conf 65%, alle controles groen).'],
    ],
  } },
  { note: 'Niet uitgevoerd: z3-certificering onder de bun-CLI (bekende omgevingsbeperking; Z3 is in server-runtime w\u00e9l gevalideerd en zichtbaar in de live beurten); een aparte, extra full-GLM red-team run (de bestaande runhistorie is ongewijzigd groen); screenshot-gebaseerde controles op fysieke apparaten \u2014 de mobiele controles zijn emulatie op 390\u00d7844.' },

  // ── 9. Beperkingen ───────────────────────────────────────────────────────
  { h1: '9. Resterende UI/UX-beperkingen' },
  { p: 'De volgende beperkingen zijn bewust aanvaard en gedocumenteerd. Ten eerste: de Engelse subregels in het redeningsspoor blijven taaltechnisch gemengd; dit is een bewuste scheiding tussen vertaalde UI-labels en taalonafhankelijke logregels, en voor een onderzoeker is de Engelse notatie juist herkenbaar. Ten tweede: op 390 px trunceren enkele secundaire subregels (zoals de hero-subtitel per stap) \u2014 leesbaarheidsverlies is er niet, want de volledige tekst staat in de handleiding en info-tips.' },
  { p: 'Ten derde: de KPI-micro-labels blijven in de gedempte kleur; de hi\u00ebrarchie is bewust zo gekozen. Ten vierde: gesprekken verdwijnen bij herlading \u2014 het auditlogboek blijft de volledige, verifieerbare historie dragen. Ten vijfde: de twee-koloms verificatiepagina laat onderin links witruimte; dit is inhoudsgedreven en cosmetisch. Geen van deze beperkingen verhult resultaten, suggereert sterker bewijs dan aanwezig, of belemmert niveau 1 (begrijpen en gebruiken) dan wel niveau 2 (onderzoeken en verifi\u00ebren).' },

  // ── 10. Oordeel ──────────────────────────────────────────────────────────
  { h1: '10. Oordeel' },
  { p: 'De centrale vraag is bevestigend beantwoord. EAInesy is voor een nieuwe gebruiker begrijpelijk: de onboarding legt in drie stappen uit wat de demo doet, wat niet, en waarom antwoorden te vertrouwen zijn; het gesprek houdt de prim\u00e8re interactie rustig met \u00e9\u00e9n regel uitleg per antwoord en een pipeline-knop voor de volledige onderbouwing. De vormgeving is professioneel en rustig: consistent emerald/teal/stone, geen neon, geen zware vlakken behalve de gedragen hero, geen overbodige animatie.' },
  { p: 'De technische werking en bewijsgrenzen zijn toegankelijk en eerlijk zichtbaar: sat/unsat/unknown/skipped, invarianten, conformal-banden en de hash-keten zijn elk met info-tips uitgelegd, en de bewijsgrens ("het bewijs gaat over het hek eromheen, niet over de black box zelf") staat letterlijk in de onboarding. De correcties van Task 24 hebben de interface op de punten waar zij werkelijk scheef was, gericht rechtgezet \u2014 gemeten, gepind in de bestaande controles, en zonder \u00e9\u00e9n Regel of bewijsclaim te raken.' },
  { p: 'Oordeel: UI/UX READY WITH LIMITATIONS \u2014 klaar als neuro-symbolische onderzoeksdemonstrator, met de in hoofdstuk 9 gedocumenteerde, bewust aanvaarde beperkingen.' },
];
