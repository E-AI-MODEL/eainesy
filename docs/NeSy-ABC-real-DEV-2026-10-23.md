# NeSy P0 versus A, B en C — echte ontwikkelproef (23 oktober 2026)

**Vooraf geregistreerd vóór de eerste modelrun; uitgevoerd op 23 oktober 2026. Status: PASS_EXPLORATORY_WIRING_ONLY, geen inhoudelijke winnaar.**

## Waarom deze test volgt op P0

De vooraf uitgevoerde [P0-nulmeting](NeSy-P0-independent-baseline-2026-10-23.md) gebruikte 14 fictieve beurten, GPT-5 mini en echte Z3: 14/14 technisch geslaagd, maar slechts 10/14 vooraf geformuleerde engineering-verwachtingen gehaald. De afwijkingen betroffen actuele versus ontkende/historische markers en een medicatievraag die door de generieke regel `P21` eerder wordt opgepakt dan de verwijsregel `P52`. Dit onderzoek **past P0 niet aan** en claimt niet dat extra reviewers zulke upstream-fouten kunnen oplossen.

## Vier onderzoeksarmen, écht één en hetzelfde startpunt per casus

- **P0:** de bestaande, ongewijzigde Next.js `processTurn` van NeSy; GPT-5 mini parse en genereert werkelijk; Node/Z3 verifieert het actuele besluit. Werkelijk modelantwoord en certificaat worden alleen tijdelijk in de lokale CI-database verwerkt.
- **A:** de huidige deterministische gedeelde-bewijsruimte en dialoogmixer. Nul extra LLM-calls. Voorstellen kunnen uitsluitend binnen de bestaande veiligheidsgrens geldig zijn.
- **B:** één echte GPT-5-mini-supervisorcall die het **werkelijke P0-concept** achteraf beoordeelt, behoudt, veto geeft of een kandidaatrevisie voorstelt. De kandidaat wordt nooit automatisch verstuurd of gecertificeerd.
- **C:** de gedeelde A-ruimte met uitsluitend bij T1/T2/T3/T4 één echte GPT-5-mini-metabeoordeling vóór een eventueel ander gesprekvoorstel. Ook dit voorstel wordt nooit automatisch toegepast.

Voor **iedere casus** krijgen A, B en C dezelfde, onveranderde P0-waarneming, inclusief dezelfde echte frame, lexicale markers, verificatiecertificaat, gespreksgeschiedenis, plan en conceptantwoord. Dus **geen per-arm herhaalde parse** en geen verwarring door verschillend getrokken P0-signalen. De drie architecturen worden alleen **in read-only onderzoeksmodus** aangeroepen. Alle veiligheidsgrenzen blijven gelden. Een veiligheidsgeblokkeerd voorstel is geen mislukte modelcall; vermeld die afzonderlijk.

De productie-ABC-shadow staat expliciet uit. Er worden geen productie-API's, regels, prompttemplates, modelnamen of veiligheidsinstellingen gewijzigd. In de testomgeving worden SeedCandidate-items tussen casussen gewist om kruisbesmetting door eerder geleerd geheugen tegen te gaan.

## DEV-corpus en bewijsgrens

De **24 bestaande, zichtbare, fictieve DEV-casussen** in `research/nesy-abc/dev-pilot-p01.json` (U = 8, R = 8, D = 8) zijn vastgezet voordat de live-evaluatie start. Hierin staat per casus voorafgaand **gescript verleden**. Dat verleden is dus **niet** werkelijk met OpenAI en Z3 tot stand gebracht. Uitsluitend de **huidige P0-beurt** gebruikt een echt model én de echte geïsoleerde Node/Z3-worker.

`research/nesy-abc/abc-dev-move-expectations-v1.json` fixeert een **auteurgekozen, zichtbare gespreksstapheuristiek** voor 16 R/D-casussen vóór uitvoering. De acht U-casussen zijn op gesprekstapniveau nadrukkelijk **niet te scoren**: daarvoor is inhoudelijk begrip nodig. Scoren doe je alleen bij **toegestane** voorstellen en je telt veiligheidsgeblokkeerde beurten apart. Een match met een van die toegestane gespreksstappen is **geen** bewijs dat de inhoud van een antwoord juist of veilig is.

Het formele [P01-protocol voor A/B/C](EAInesy-architecture-ABC-preregistered-protocol-2026-10-23.md) verlangt voor een **confirmatoire winnaar** 300 nieuwe, afgeschermde casussen, externe en geblindeerde beoordelingen en bij gevoelige gevallen een geschikte onafhankelijke veiligheidsbeoordelaar. Die voorwaarden zijn **niet** vervuld. Deze run is uitdrukkelijk alleen een echte **technische en exploratieve ontwikkelvergelijking**. Niet claimen dat een methode 'wint'.

## Wat wordt daadwerkelijk gemeten?

- 24 P0-current-turn-uitkomsten, daadwerkelijke `sat` Node/Z3-certificaten, modelcheck en uitvoercontrole, plus persisterende opslag van iedere huidige beurt.
- Per arm/casus: oorspronkelijke gesprekbeweging, voorgestelde en geselecteerde beweging, geblokkeerd/toegelaten, B-reviewuitkomst, C-triggercodes T1–T4, extra modelcalls, valide/onvalide bronverankering en kandidaatrevisie **niet gecertificeerd**.
- Voor de 16 R/D-casussen: uitsluitend DEV-heuristiek over gesprekbewegingen, met **de noemer van werkelijk toegestane voorstellen**. Rapportage per arm en per afzonderlijke suite; geen geaggregeerde 'correctheidswinst' van inhoud.
- Gemeten tokengebruik en HTTP-aantallen per fase: `P0_PARSE`, `P0_GENERATE`, `B`, `C`. Geen tokens schatten of modelreviewclaims voor onafhankelijke validatie aanzien.
- Kosten zijn achteraf uit actuele tarieven te **berekenen**, maar de API levert hier geen betrouwbare factuur/€-kostenwaarde; gemeten tokens worden dus primair gerapporteerd.
- Geen ruwe fictieve gespreksberichten, modelsamenvattingen, gegenereerde tekst of sleutel in het log of artifact.

## Begrenzing

Werkelijke OpenAI-verzoeken lopen alleen via dezelfde afgeschermde lokaal gebonden proxy als de geslaagde P0-test. GitHub Environment en secret heten beiden `nesy`. Model: `gpt-5-mini`; Chat Completions, `store:false`. Totaalmaximum **128 betaalde upstream HTTP-pogingen**, inclusief **alle** retries van P0 en **alle** B/C-reviewcalls. Generator/parsing maximaal **1.600 completion tokens per request**, reviewers maximaal **800**; maximaal één reviewerrequest per toegestane arm/casus. De proxy telt calls vóór het verzenden; geen onbeperkte retries. Dit is een **aanroeplimiet, geen hard geldplafond**.

De gebruiker heeft één live-DEV-uitvoering aangevraagd; de voor deze uitvoering gebruikte eenmalige `push`-trigger is inmiddels verwijderd. Nieuwe betaalde runs vereisen uitsluitend `workflow_dispatch` met expliciet `YES`. PR-validaties blijven gratis en zonder sleutel.

## Werkelijke resultaten van de enige live-DEV-run

- Uitvoering: [GitHub Actions-run 39886784855](https://github.com/E-AI-MODEL/eainesy/actions/runs/39886784855), commit `5eda9f6`, workflow **completed/success**.
- Bronbestanden voor de proef: DEV-corpus SHA-256 `5f089cd6f54a348363f90768f7cfb66be2d40c497c30449f5ea0f5451ed58d1c`; vooraf gekozen beperkte R/D-gesprekstapheuristiek SHA-256 `938558d37b747744c9ffffd8e3b5406c0c07c7d0d3b6de3a2b95f041d8a6e276`.
- Volledig [GitHub-artifact 12473336453](https://github.com/E-AI-MODEL/eainesy/actions/runs/39886784855), `nesy-abc-real-shared-p0-dev-metadata`, met `summary.json` en `proxy-summary.json`, zonder berichttekst of modelantwoorden.
- 24/24 actuele P0-beurten verwerkten een **echt** GPT-5-mini-model, **echt geïsoleerd Node/Z3** (`sat`), modelcheck, OutputPolicy en het echt opgeslagen laatste beurtcertificaat. **24/24** P0-waarnemingen waren als onveranderd snapshot beschikbaar voor P0/A/B/C.
- P0 is in alle vier armen exact dezelfde waarneming: **A/B/C zijn niet live als gebruikersantwoord uitgevoerd**. Het verleden in deze 24 DEV-casussen is vooraf **gescript, niet met Z3 geverifieerd**. Deze proef meet geen klinische veiligheid of behandelkwaliteit.

### Echt gemeten OpenAI-gebruik per laag

| Laag | HTTP 200 / verzoeken | Inputtokens | Outputtokens | Totaal |
| --- | ---: | ---: | ---: | ---: |
| P0-parser | 24/24 | 43.877 | 2.771 | 46.648 |
| P0-generator | 24/24 | 7.819 | 1.386 | 9.205 |
| A (deterministisch) | 0 | 0 | 0 | 0 |
| B-supervisor achteraf | 23/23 | 13.500 | 3.948 | 17.448 |
| C-orchestrator op trigger | 6/6 | 3.299 | 887 | 4.186 |
| **Totaal** | **77/77** | **68.495** | **8.992** | **77.487** |

Geen HTTP-fouten, geen budgetoverschrijding (limiet 128), geen niet-geautoriseerde modellen, geen extra providerretries waargenomen. Deze tokenwaarden komen rechtstreeks uit de providerresponsen. Modelrekening/tarief is niet in dit artifact aangetoond. De test heeft geen per-arm end-to-end p95-vertraging en niet de kosten van echt gewijzigde, opnieuw gegenereerde antwoorden gemeten.

### Werkelijk verschil tussen de vier architecturen

| Maatstaf (DEV) | P0 | A | B | C |
| --- | ---: | ---: | ---: | ---: |
| Bestaande veiligheid liet voorstel toe | 23/24 | 23/24 | 23/24 | 23/24 |
| **Geselecteerde** gesprekstap anders dan P0 | 0 | 10 | 0 | 10 |
| Echte extra model-reviewcalls | 0 | 0 | 23 | 6 |
| Match met vooraf vastgezette *auteurheuristiek*, op 15 toegestane R/D-casussen | **2/15** | **10/15** | **2/15** | **10/15** |
| Door validator geaccepteerde supervisie-*wijzigingen* | niet van toepassing | niet van toepassing | **0** | **0** |
| Afgewezen modelreviews | niet van toepassing | niet van toepassing | **8** | **3** |

Er zijn **16** bekende R/D-heuristiekgevallen, waarvan **één** (`DEV-D05`, P0-action `ABSTAIN_HITL`) door de al bestaande safety lock is uitgesloten. De bovenstaande 15 vormen géén onafhankelijke gold labels. Alle acht U-casussen (betrokkene/tijd/inhoud) zijn *niet* met deze gespreksstapheuristiek gescoord.

De tien door A geselecteerde aanpassingen betroffen onder meer `REPAIR` bij uitgesproken correcties, `REFLECTION` bij het weigeren van tips en `INFORMATION` bij een expliciet gevraagd voorbeeld. Dat is een mogelijke ontwikkelindicatie, **geen gemeten winst in antwoordbetekenis of zelfstandig menselijk oordeel**.

De B-reviewer werd 23 keer echt aangeroepen, maar gaf geen enkele gevalideerde `REVISE` of `VETO`. **15** reviews resulteerden in geaccepteerd `KEEP` en **8** werden door het verplichte reviewcontract afgewezen: **6** ongeldige issue/reason, **1** ontbrekende bronverankering in de gebruikerszin en **1** kandidaatrevisie zonder verplichte planinhoud. Geen review leidde tot een toegestane andere stap.

C kreeg slechts **6** aanvullende calls: **vijf** gevallen met trigger `T2` (expliciete correctie) en **één** met `T4` (gesprek heropenen). Triggers `T1` en `T3` kwamen hier niet als extra call voor en zijn daardoor niet inhoudelijk geëvalueerd. C gaf **3** gevalideerde `KEEP`-beoordelingen en **3** afgewezen reviews (twee ongeankerde bewijsfragmenten, één ongeldig issue/reason). De werkelijk geselecteerde C-bewegingen waren in **alle 24 gevallen identiek aan A**, dus voor deze proef is **geen marginale winst van de extra zes modelcalls aangetoond**.

### Rapportconsistentie en beperkingen

Een veldenverschil in de twee onderzoeksrapporten verdient vermelding: `summary.json` bevestigt **`persistedIsolated: 24`** en `PASS_EXPLORATORY_WIRING_ONLY`. In hetzelfde artifact vermeldt de proxy `persistedCertificatesVerified: false`, omdat de naar de ouder doorgestuurde **samenvattingsregel** het veld `persistedIsolated` niet bevatte. Dit is een **metadata-overdrachtsfout**, geen vastgesteld ontbrekend certificaat: de kindrunner heeft wel 24 opgeslagen certificaten gecontroleerd en de volledige technische run is geslaagd. De transmissie wordt voor **volgende** runs gecorrigeerd door dat getal ook in de logsamenvatting op te nemen; er is **geen betaalde herhaling** uitgevoerd om het oude artifact mooier te maken.

We zagen uitsluitend bestaande **zichtbare DEV-fixtures**, opgesteld voor de huidige A/B/C-labontwikkeling. Geen geblindeerde onafhankelijke beoordelaars, geen 300-casus confirmatoire corpus, geen gebalanceerde gegenereerde/uitgevoerde eindantwoorden per arm en geen klinische validatie. P0 was oorspronkelijk gebouwd voor een andere veiligheidstaak; de huidige onderzoeksvoorstellen gaan alleen over **volgende gesprekbewegingen** en mogen de P0-fusie/risicoregel niet veranderen. De vier semantische problemen uit de onafhankelijke P0-nulmeting zijn hier dus **niet** gerepareerd of formeel weerlegd.

**Onderzoeksconclusie:** A heeft in deze ontwikkelset het sterkste *signaal voor verdere toetsing* per extra token: tien vooraf passende bewegingen zonder extra modelcall. B toont hier geen geaccepteerd netto-effect ondanks 23 betaalde reviews. C volgt A exact, met zes extra calls zonder bewezen winst. Dat is **geen formele winnaar**: geen enkele architectuur is op basis van deze proef vrijgegeven, noch mogen nu automatisch P0-antwoorden door A/B/C worden vervangen.

## Vooraf gespecificeerde interpretatie

- **PASS_EXPLORATORY_WIRING_ONLY:** 24 echte P0-beurten met Z3, gedeeld ongewijzigd snapshot voor A/B/C, dezelfde oorspronkelijke veilige beslissing, reviewerbegrenzing gerespecteerd. **Geen inhoudelijke winnaar.**
- **PARTIAL_REVIEW_FAILURE:** P0 kan werken maar er zijn B/C-providerproblemen, ongeldige reviewers of andere observerfouten. Niet als inhoudelijke verbetering interpreteren.
- **INCOMPLETE_TECHNICAL:** minder dan 24 geldige echte P0-beurten, ontbrekende Z3, opslag of onvergelijkbare armen. Niet verbloemen met alleen een groen aantal reviewer-calls.
- **Geen verbetering waarneembaar:** een kandidaat die bij veiligheidsgevoelige P0-casussen wordt tegengehouden kan de foutieve P0-marker niet zelfstandig repareren. De geconstateerde P0-semantiek kan alleen met afzonderlijke correctie-/evaluatieproeven opnieuw worden vastgesteld.

De externe modeloutput wordt uitsluitend als **voorstel** beschouwd, nooit als oordeel over een mens. De volgende fase na deze DEV-run hangt af van de werkelijk gevonden gaten: onderzoek naar onafhankelijke, geblindeerde beoordeling en passende nieuwe data, of eerst reparatie/heldere taakafbakening in de bestaande keten.
