# NeSy P0 versus A, B en C — echte ontwikkelproef (23 oktober 2026)

**Vóór de eerste live-run vastgelegd. Status: ONBEKEND.**

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

Eén expliciet door de gebruiker aangevraagde live-run mag op `main` via de exact afgebakende eenmalige merge-trigger plaatsvinden. Daarna wordt de push-trigger **verplicht verwijderd**; voortaan alleen handmatig `workflow_dispatch` met expliciet `YES`. In een PR wordt uitsluitend lokaal getest, zonder sleutel of API-kosten.

## Vooraf gespecificeerde interpretatie

- **PASS_EXPLORATORY_WIRING_ONLY:** 24 echte P0-beurten met Z3, gedeeld ongewijzigd snapshot voor A/B/C, dezelfde oorspronkelijke veilige beslissing, reviewerbegrenzing gerespecteerd. **Geen inhoudelijke winnaar.**
- **PARTIAL_REVIEW_FAILURE:** P0 kan werken maar er zijn B/C-providerproblemen, ongeldige reviewers of andere observerfouten. Niet als inhoudelijke verbetering interpreteren.
- **INCOMPLETE_TECHNICAL:** minder dan 24 geldige echte P0-beurten, ontbrekende Z3, opslag of onvergelijkbare armen. Niet verbloemen met alleen een groen aantal reviewer-calls.
- **Geen verbetering waarneembaar:** een kandidaat die bij veiligheidsgevoelige P0-casussen wordt tegengehouden kan de foutieve P0-marker niet zelfstandig repareren. De geconstateerde P0-semantiek kan alleen met afzonderlijke correctie-/evaluatieproeven opnieuw worden vastgesteld.

De externe modeloutput wordt uitsluitend als **voorstel** beschouwd, nooit als oordeel over een mens. De volgende fase na deze DEV-run hangt af van de werkelijk gevonden gaten: onderzoek naar onafhankelijke, geblindeerde beoordeling en passende nieuwe data, of eerst reparatie/heldere taakafbakening in de bestaande keten.
