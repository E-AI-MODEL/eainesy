/**
 * Task 25 — rapport-inhoud (NL). Vorm: compact opleveringsrapport.
 * Verbruikt door task25-report.mjs.
 */
export const meta = {
  title: 'EAInesy — Task 25: UI/UX & branding (EAI Humanizor)',
  subtitle: 'Visuele verfijning op basis van het officiële EAInesy-logo — met behoud van functionaliteit en de neuro-symbolische kern',
  englishLabel: 'EAINESY · UI/UX & BRANDING',
  metaLines: [
    'Opdracht: Task 25 — EAI Humanizor · UI/UX & Branding',
    'Uitgangspunt: Task 24 afgerond (UI/UX READY WITH LIMITATIONS)',
    'Commit: 5dc8cfc',
    'Datum: 16 oktober 2026',
  ],
  footerLeft: 'EAInesy — neuro-symbolische onderzoeksdemo',
  footerRight: 'Task 25 · 2026',
};

export const body = [
  { h1: '1. Samenvatting' },
  { p: 'EAInesy is in deze taak visueel, redactioneel en qua merkbeleving verfijnd tot een volwassen, zorgvuldig vormgegeven product zonder dat er ook maar één functionele of formele eigenschap is gewijzigd. Het uitgangspunt was de nakende status na Task 24 (UI/UX READY WITH LIMITATIONS): de interface was functioneel en verzorgd, maar droeg nog de visuele restanten van de oude "kwast"-identiteit — een smaragdgroene accentkleur, een verfkwast-icoon in de header en een extern Z.ai-placeholder-favicon. De officiële EAInesy-identiteit (het geüploade Identity Board) is blauw/violet/cyaan op navy; die identiteit zit nu in elk scherm.' },
  { p: 'De EAI Humanizor is conform de opdracht eerst opgezocht, niet verzonnen: een doorlichting van src/, de vier EvAI-voorgangerprojecten in analysis/ (v20, v21, v24, v30), het werklog en alle documentatie leverde géén enkele specificatie of implementatie op die onder deze naam bekend staat. Er is daarom geen eigen definitie geconstrueerd; dit wordt hier expliciet gemeld. Wél zijn de wél gedocumenteerde principes van het project toegepast: de eerlijkheids- en bewijsgrens-framing uit Task 22–24 (groen betekent alleen "geslaagde controle"; het bewijs gaat over de beslisarchitectuur, niet over het taalmodel), de EAA-beginselen uit de voorgangers en de bewust-behouden keuzes uit de Task 24-audit.' },
  { p: 'Het officiële logo was wél beschikbaar en is volwaardig geïntegreerd. De mark is pixelgetrouw gevectoriseerd uit het Identity Board (per kleurzone, met gradiënten) en leeft nu als SVG-asset in de applicatie: in de header, het mobiele menu, de chat-leegstaat, het dashboard-hero-watermerk en als favicon/app-icoon. Het wordmark volgt de officiële driekleur: "EAI" in navy, "nes" in blauw, "y" in violet.' },

  { h1: '2. Ontwerpkeuzes' },
  { h2: '2.1 Palet en kleurrollen' },
  { p: 'Het palet is rechtstreeks uit het logo bemonsterd en als vaste rollen ingesteld. De kern van het ontwerp is een scherpere kleurdiscipline die de informatiewaarde van kleur verhoogt in plaats van alleen de sfeer: merk, toestand en categorie kregen elk hun eigen hue-familie, zodat kleur overal hetzelfde betekent.' },
  { table: { caption: 'Tabel 1 — EAI-palet en kleurrollen', headers: ['Kleur', 'Rol', 'Voorbeelden'], rows: [
    ['Navy #0b1238', 'Merkanker', 'Header-L4-badge, accentblokjes, hero-gradiënt, app-icoon-achtergrond'],
    ['Blauw #0d6ff5', 'Merkaccent + symbolische kern', 'Tabs/actieve navigatie, user-bubble, verzendknop, fase "symbolisch", family-badges'],
    ['Cyaan #22d3ee', 'Bewijsstempel / verificatie', 'Fase "verificatie", KG-hulpbronnen (incl. 112/113), antwoordstempel-flow'],
    ['Violet #7c3af5', 'Neuraal (GLM)', 'Flow-kaart GLM, trace-fase "neuraal (GLM)", wordmark-y'],
    ['Groen (emerald)', 'Uitsluitend: geslaagde controle', 'PASS-badge, ✓ 17.280 toestanden, health-dots, goedgekeurde reviews'],
    ['Amber / roos / oranje', 'Waarschuwing / faal / HITL-categorie', 'Onveranderd — semantiek uit Task 24'],
  ] } },
  { p: 'De belangrijkste consequentie: groen was voorheen zowel de merkkleur als de toestandskleur; groen betekent nu nog uitsluitend "een controle geslaagd". Daarmee verdwijnt een subtiele dubbelzinnigheid uit de vorige versie — een groene user-bubble "voelde" als een goedkeuring, terwijl het alleen de merkkleur was.' },
  { h2: '2.2 Logo-integratie' },
  { p: 'De mark is gevectoriseerd met een eigen pipeline (HSV-kleurclassificatie in vier zones, contour-extractie per zone, gradiëntvulling, plus een silhouet-basislaag tegen haarlijn-gaten). Het resultaat is bij kleine maten (favicon, 28–40 px in de UI) visueel niet te onderscheiden van het origineel. Vier assets zijn gegenereerd: logo-mark.svg (UI), favicon.svg, favicon.png (48 px) en apple-touch-icon.png (180 px, navy achtergrond) — allen geregistreerd in layout.tsx; het externe Z.ai-favicon is hiermee vervangen.' },
  { h2: '2.3 Neutralen, hero\'s en rust' },
  { p: 'De warme stone-neutralen zijn omgezet naar het koelere slate, passend bij het blauwe merk; alle AA-contrastafspraken uit Task 24 blijven overeind (slate-500 ≈ 4,7:1 op wit). De dashboard- en Over-hero\'s dragen nu een navy→blauw EAI-gradiënt met de mark als stille watermerk (15% dekking); de flow-kaarten daarin volgen de kleurrollen (violet → blauw → cyaan). Alle categorische accentblokjes ("Waar start ik?", panelen-overzicht, handleiding-stap 3) zijn geharmoniseerd naar één navy-blok in plaats van zes verschillende kleuren — rust en samenhang boven decoratie. De focusring is merkblauw geworden, zodat ook toetsenbordnavigatie de identiteit draagt.' },
  { h2: '2.4 Redactionele correcties (NL/EN)' },
  { p: 'Een heuristische doorlichting van beide woordenboeken (dubbele spaties en punctuatie, kruis-taal-lekken, hardnekkige typefouten) leverde één echte correctie op: "her berekend" → "herberekend" (nl.ts:324). De gemelde Engelstalige fragmenten in het Nederlandse woordenboek bleken valse positieven: de auteursnaam "de Moura" (Z3-artikel) en Engelse brontitels in de referentielijst zijn correct. De soft-hyphens in "onderzoeks­demo" zijn bewuste typografische afbreek-hulpmiddelen. De metadata (titel + beschrijving) is naar het Nederlands vertaald en consistent met de UI.' },

  { h1: '3. Voor en na' },
  { p: 'De onderstaande paren zijn op dezelfde viewports en in dezelfde toestand opgenomen als de Task 24-audit (1440 px desktop, 390 px mobiel, NL tenzij anders vermeld).' },
  { imgPair: { left: 'before/01-dashboard-desktop.png', right: 'after/01-dashboard-desktop.png', w: 1440, h: 900, caption: 'Figuur 1 — Dashboard desktop 1440 px: kwast-icoon en smaragd → EAI-mark, driekleurig wordmark, navy-hero met watermerk, blauwe actieve tab.' } },
  { imgPair: { left: 'before/05-chat-leeg.png', right: 'after/03-chat-leeg.png', w: 1440, h: 900, caption: 'Figuur 2 — Chat-leegstaat 1440 px: verfkwast-embleem → officieel logo; de verzendknop en hovers volgen het merkblauw.' } },
  { imgPair: { left: 'before/08-mobiel-dashboard.png', right: 'after/02-dashboard-mobiel.png', w: 390, h: 844, caption: 'Figuur 3 — Dashboard mobiel 390 px: identiteit schaalt mee; watermerk, flow-kaarten en bottomnavigatie in de nieuwe rollen.' } },
  { imgPair: { left: 'before/02-onboarding-stap1.png', right: 'after/05-onboarding.png', w: 1440, h: 900, caption: 'Figuur 4 — Onboarding, stap 1: de flow-uitleg in de EAI-gradiënt; stippaden en knoppen in merkblauw.' } },
  { singleShot: { file: 'after/04-chat-glm-beurt.png', w: 1440, h: 900, caption: 'Figuur 5 — Live GLM-beurt: de kleurrollen in actie — user-bubble blauw, fase-badges violet (neuraal) en blauw (symbolisch), PASS-chips groen (geslaagde controle), fase-stapper groen (status).' } },

  { h1: '4. Bewust behouden' },
  { p: 'De informatiearchitectuur (negen secties, dezelfde navigatie) is onveranderd gelaten: Task 24 heeft deze inhoudsgedreven indeling geaudit en geen structureel probleem aangetroffen; herstructurering zou churn zonder aantoonbaar voordeel betekenen. De verkeerslicht-semantiek (groen/amber/roos) en de uitleg daarvan in de handleiding zijn onaangetast. De Engelstalige machine-subregels in de pipeline-trace blijven Engelstalig (logregels, taalonafhankelijk). De demo-badge blijft amber omrand: een bewuste eerlijkheidsmarkering, geen stijlkeuze. De tweetalige invoer-placeholder ("Schrijf in het Nederlands of English…") is een bewuste verwelkoming en blijft staan.' },

  { h1: '5. Controles' },
  { table: { caption: 'Tabel 2 — uitgevoerde controles en resultaten', headers: ['Controle', 'Resultaat'], rows: [
    ['eslint (src)', 'schoon — 0 fouten, 0 warnings'],
    ['tsc --noEmit', '0 fouten in src; alleen de bekende, niet-EAInesy-fouten van analysis/'],
    ['bun run build (productie)', 'geslaagd — 9 routes'],
    ['Formele regressiesuite', '28/28 PASS (incl. R11-lexiconpins)'],
    ['/api/verify', 'PASS — 17.280 toestanden × 26 invarianten, 66 regels in 16 families'],
    ['/api/ledger?verify=1', 'keten intact — 10.863 vermeldingen'],
    ['Live GLM-beurt (NL)', 'THERAPEUTIC_DIALOG, conf 94%, model check ✓, Z3 ✓ — met nieuwe kleurrollen'],
    ['Browsercontrole', 'dashboard/chat/onboarding/verificatie/red-team/bijsturen/over/kennis/logboek/review op 1440 en 390 px, NL en EN; focusring geverifieerd; 4 logo-assets HTTP 200'],
    ['Kern-integriteit', 'git-diff: src/lib/eainesy en formele scripts onaangetast — wijzigingen uitsluitend UI-laag, i18n, layout/globals en public-assets'],
  ] } },

  { h1: '6. Bestanden en commit' },
  { p: 'Commit-ID: 5dc8cfc (Task 25). Gewijzigde bronbestanden: src/app/page.tsx, src/app/layout.tsx, src/app/globals.css, alle dertien componenten onder src/components/eainesy/, src/components/language-provider.tsx en src/lib/i18n/nl.ts. Nieuw: src/components/eainesy/logo.tsx (merkcomponenten), public/logo-mark.svg, public/favicon.svg, public/favicon.png, public/apple-touch-icon.png en scripts/task25-vectorize-logo.py (de vectorisatie-pipeline, reproduceerbaar). Screenshot-materiaal: screenshots/task25/before en /after. Het werklog bevat het volledige Task 25-blok.' },

  { h1: '7. Beperkingen' },
  { p: 'Drie beperkingen zijn expliciet gemeld. Ten eerste: de EAI Humanizor is niet teruggevonden in de beschikbare code of documentatie; de opdrachtregel "verzin geen eigen definitie" is gevolgd en het ontwerp leunt op de wél gedocumenteerde principes van het project. Ten tweede: de rendering van het favicon in een echte browser-tab (donkere/lichte tabbladen, various DPI) is in deze headless omgeving niet screenshot-verifieerbaar; de assets zelf serveren correct en zijn in metadata geregistreerd — een visuele spot-check op een fysiek toestel blijft aanbevolen. Ten derde: de mark-vectorisatie benadert het origineel binnen een paar procent; op grote afdrukformaten (> 400 px) blijft het officiële rasterbestand de bron van waarheid. Geen van deze beperkingen raakt functionaliteit, bewijsgrenzen of de neuro-symbolische kern.' },
];
