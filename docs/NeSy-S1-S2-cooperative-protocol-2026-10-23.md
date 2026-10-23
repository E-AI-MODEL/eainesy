# NeSy S1/S2: neuro-symbolische samenwerkingsregie

**Datum:** 23 oktober 2026
**Protocol:** `EAINESY-COOP-S1S2-2026-10-23-DEV-01`
**Status:** afzonderlijk, exploratief softwareonderzoek. Niet toevoegen aan P01/P0-A-B-C uitslag, geen modelwinnaar of klinische validatie.

## Waarom deze proef?

De recente C2-proef gaf vijf structureel geldige kandidaten bij tien fictieve gesprekken. Sommige signaleerden een correctie, maar andere maakten twijfel van al duidelijke verzoeken. Bronverankering betekent slechts dat de aangehaalde woorden aanwezig zijn, niet dat de interpretatie, noodzaak van doorvragen of voorgestelde handeling klopt.

**Onderzoeksvraag:** voegt gerichte samenwerking tussen een symbolische taak-/bewijscheck en een neurale herbeoordeling iets toe aan de keuze tussen beantwoorden, herstellen en verduidelijken, zonder meer onnodige vragen of verlies aan veiligheidsgrenzen?

## Twee afzonderlijke onderzoeksarmen

**S1 — symbolische regie, nul extra LLM-calls.**
- Ontvangt dezelfde P0-besliscontext en dezelfde *onbevestigde* C2-kandidaten als S2.
- Controleert of het aangehaalde tekstfragment daadwerkelijk aanwezig is.
- Controleert een expliciet geannoteerde taakclaim (bijv. direct antwoord, luisteren, sluiten, correctie, persoon/tijd nodig).
- Geeft duidelijke taken prioriteit boven niet-relevante twijfels. Een ontbrekende stijlvoorkeur blokkeert bijvoorbeeld niet automatisch een neutrale voorbeeldzin.
- Kan bij een expliciet taakafhankelijk ontbrekend gegeven **CLARIFY voorstellen**. Dat is geen bewezen juist oordeel en geen feitelijke uitvoer.

**S2 — coöperatieve NeSy-regie, maximaal één extra neurale beoordeling.**
1. Doorloopt precies dezelfde symbolische S1-controles.
2. Alleen wanneer S1 een mogelijk *materieel* ontbrekende persoon of tijd signaleert, maakt de symbolische laag één begrensd ticket: welk gegeven, welke taak, welke oorspronkelijke bronzinnen.
3. Een expliciet geïnjecteerde neurale callback beoordeelt alleen die onderzoeksvraag. Zij kan aangeven dat de informatie ontbreekt, mogelijk al beschikbaar is, of dat de beoordeling niet kan.
4. De symbolische laag controleert vorm, facet en letterlijk bronfragment nogmaals. Een neurolinguïstische claim kan hoogstens een **research-only alternatief voorstel** opleveren; geen bronmatch bewijst semantische waarheid en geen tweede oordeel krijgt zelfstandig gezag.
5. Niet uitvoeren, geen model, fout, timeout of ongeldige bron? **Behoud S1**, zonder retry of keten van nieuwe vragen.

Dit is een tweezijdige *informatie-uitwisseling* met een eindige lus, geen apart bewustzijn en geen autonoom agent die gebruikersvragen overneemt.

## Bindende grenzen

- Geen import door `processTurn`, API-route, controller, risicofusie of Z3. Geen productieantwoord of persistente gesprekstoestand wordt aangepast.
- Alleen fictieve DEV-input. De aangeleverde taakannotaties zijn **synthetische onderzoekshypotheses**, niet gevalideerde waarnemingen.
- Uitsluitend bij expliciet `riskAssessment=NONE`, `riskMemory=NONE`, `verification=sat`, geslaagde modelcheck/outputpolicy, actie `THERAPEUTIC_DIALOG`, lege lexicale en frame-risicomarkeringen kan S1 een alternatief voorstellen of S2 om feedback vragen.
- `sat` in de DEV-fixtures is een gesimuleerde status; CI claimt **geen echte Z3-uitvoering** in deze proef.
- Een S2-antwoord mag veiligheidsinformatie niet verlagen, geen gebruikersgerichte tekst leveren, geen modelcommando’s uit citaten opvolgen, geen opgeslagen kandidaten promoten en geen opvolgende modelaanroep starten.
- Alle C2-kandidaten blijven `weight=0`. Ook source-matches, taaklabels en S2-terugkoppeling zijn onbewezen inhoudelijke claims.
- Geen externe SDK, OpenAI-aanroep, API-secret, transport, automatische betaalde workflow of productiegegevens in deze fase.

## Gelijke vergelijkingsgrondslag

De twintig nieuwe fictieve DEV-cases in `research/nesy-cooperative/s1s2-dev-v1.json` bevriezen per casus:
- huidige gebruikerszin en maximaal zes eerdere fictieve chatberichten;
- P0-voorgestelde zet, risicosnapshot, taakannotatie en C2-hypotheses;
- dezelfde input voor S1 en S2;
- een gescripte S2-feedback of fout, **geen echt taalmodel**;
- vooraf door de auteur opgeschreven technische verwachte zetten en callaantallen.

De gratis CI levert een controleerbaar vergelijkingsrapport voor P0 (referentie), S1 en S2. Verwachte uitkomsten zijn van de maker van de fixtures en dus **geen onafhankelijke labels, geen blind testcorpus en geen bewijs van betere gesprekskwaliteit**. S1/S2-verschillen zijn kandidaatverschillen, geen werkelijk geleverde antwoorden.

## Vervolgonderzoek (nieuw protocol, niet terugdateren)

1. Bereid nieuwe, onafhankelijk geconstrueerde en geblindeerde fictieve gesprekken voor met **gescheiden oordelen** over brontrouw, semantische juistheid, materiële onzekerheid en noodzaak van verduidelijken.
2. Gebruik een gelijk P0-model/snapshot en precies dezelfde input voor S1 en S2. Maak S2 alleen actief op vooraf vastgelegde symbolische triggers.
3. Meet (a) juiste taakvolgende zetten, (b) gemiste noodzakelijke verduidelijkingen, (c) onnodig doorvragen, (d) context-/persoon-/tijdverwisselingen, (e) weigeringen/fouten, (f) echte extra modelcalls, tokens en latentie.
4. Laat inhoudelijke beoordelaars beoordelen **zonder modelarm en route-informatie**. Onderzoek onenigheid; wijzig de beoordelingsrubriek niet na inzage alsof deze vooraf vaststond.
5. Behoud niet-compenseerbare veiligheidsgrenzen: iedere nieuwe ernstige misser of ontbrekende Z3-/outputpolicycontrole blokkeert eventuele productieactivatie. Een reviewer- of casustelling is niet voldoende voor veiligheidsvalidatie.
6. Pas na een reproduceerbaar resultaat onderzoeken of regie mag doorwerken in een productieplan. Een afzonderlijke besluit-/vrijgaveprocedure blijft verplicht.

**Falsificatie:** als S2 extra kosten en doorvragen toevoegt zonder aantoonbaar hogere gespreksbesliskwaliteit, wint samenwerking niets. Ook S1 kan fout zitten omdat bronaanwezigheid of een task-label niet gelijkstaat aan begrip.

## Reproduceerbare engineering

`node --test research/nesy-cooperative/*.test.mjs`

`node scripts/run-nesy-s1s2-offline.mjs --dev`

GitHub Actions: `.github/workflows/nesy-s1s2-cooperative.yml`, volledig zonder provider-key of externe modelcalls.
