# NeSy P03 — semantische samenwerking als afgeschermd experiment

**23 oktober 2026, protocol vooraf vastgelegd.** `EAINESY-P03-2026-10-23`

## Waarom een aparte sandbox?

P02 had 10/10 technisch geldige P0-beurten met echte Z3-SAT, maar **nul** S1/S2-toegestane beurten. Er was dus geen vergelijkingsresultaat. De bestaande NeSy-controller staat voor dit experiment niet open voor algemene schrijf- en betekenisvragen. P03 verandert geen enkele regel van die controller.

P03 hergebruikt de S1/S2-onderzoekslogica in een **losstaande fictieve betekenissandbox**. Het S1/S2-contract krijgt *gesimuleerde* `THERAPEUTIC_DIALOG`- en `sat`-velden, omdat de onderzoeksfunctie anders geen voorstel kan doen. Deze waarden zijn geen echte controller- of Z3-besluiten. Alle resultaten vermelden `realP0:false`, `realZ3:false`. Er wordt geen productiecode geïmporteerd of aangepast.

## Onderzoeksvraag en toetsopzet

Kan één gerichte neurale herbeoordeling achter een symbolische relevantietoets beter onderscheiden tussen **noodzakelijk doorvragen** en **een al opgelost gegeven**? En hoeveel extra calls kost dat?

De bevroren fictieve DEV-set bevat **14 cases**:
- acht gevallen met een taakafhankelijke persoons-/tijdsonzekerheid; vier zijn in de laatste gebruikerszin al opgelost, vier nog niet;
- zes negatieve controles: direct antwoord, luisteren, stoppen, herstellen, geciteerde injectie, geen expliciete taak.

De casussen en auteursetiketten zijn vóór de eerste live-run gecommit in `research/nesy-cooperative/p03-sandbox-corpus-v1.json`. Die etiketten zijn **niet onafhankelijk geverifieerd**. De verplichte gratis voorcontrole verifieert dat S1 op precies acht gevallen één ticket aan S2 aanbiedt en op de overige zes geen model hercontrole vraagt.

S1 werkt symbolisch en zonder extra GPT-call. S2 gebruikt dezelfde input maar mag **hoogstens één** GPT-5-recheck uitvoeren bij een taakblokkerend persoons-/tijdsvraagstuk. De bestaande bron- en schema-controle blijft intact; een letterlijk citaat bewijst de betekenis niet. Modeluitval, ongeldig resultaat of abstentie mogen geen aanvullende model-cyclus activeren.

Wanneer de voorgestelde gesprekszet verschilt, wordt onder **dezelfde antwoordinstructie en dezelfde fictieve context** voor beide zetten een voorbeeldantwoord gemaakt. Een A/B-reviewbestand verbergt de modelarm; een aparte mapping wordt alleen na beoordeling gebruikt. **Geen GPT-jury** beoordeelt de eigen resultaten. De menselijke review wordt voorbereid, **niet uitgevoerd of gefingeerd**.

## Uitkomsten die we afzonderlijk rapporteren

1. Acht mogelijke S2-calls; echte calls, providerfouten, ongeldige uitvoer, abstentie.
2. S1-/S2-voorgestelde gesprekszetten; verschillen en overeenkomsten met auteursetiketten voor opgeloste en onopgeloste onduidelijkheden.
3. Onnodig verduidelijken versus noodzakelijke verduidelijking missen, volgens die **voorlopige** auteursetiketten.
4. Exact GPT-5-tokenverbruik en eventuele fouten (geen gemeten eurobedrag).
5. Aantal volledige, gemaskeerde conceptantwoordparen voor latere onafhankelijke beoordeling op taaktrouw, persoons-/tijdsverwijzing en onnodig doorvragen.

De set is klein, openbaar en door dezelfde onderzoeker samengesteld. Overeenstemming met auteursetiketten is **engineeringbewijs**, geen onpartijdig prestatieresultaat. Een gunstige uitkomst kan geen veiligheidsvrijgave, klinisch nut of algemene AI-begripswinst bewijzen.

## Technische en financiële grenzen

- **Model GPT-5** (niet mini), maximaal **16 HTTP-calls** totaal: acht herbeoordelingen en maximaal acht voorbeeldantwoorden. Eén request per call, geen retries of redirects, geen tools, `store:false`, JSON-output.
- De bestaande sleutel blijft uitsluitend in GitHub Environment **`nesy`**, secret **`nesy`**. Nooit een nieuwe sleutel of secretaanpassing.
- Alleen fictieve niet-medische gesprekken; geen echte leerling-/patiëntgegevens, geen toegang tot P0-sessies of database.
- Eén nauw omschreven push-trigger start na groene CI de eerste poging; die trigger wordt direct daarna verwijderd. Betaalde herhalingen worden alleen handmatig gestart met `confirm_api_costs=YES`.
- Bij fouten: zichtbaar rapporteren, niet opportunistisch cases aanpassen en niet ongemerkt dezelfde betaalde proef herhalen.

**Falsificatie:** als S2 het reeds gegeven detail niet herkent, andere betekenis verzint, onnodig doorvraagt of voornamelijk kosten toevoegt, telt dat als negatief resultaat. Symbolische regels en neurale output zijn niet vanzelf juist.

## Reproduceerbaar zonder sleutel

`node --test research/nesy-cooperative/*.test.mjs`

`node scripts/nesy-p03-sandbox-gpt5.mjs --preflight`

De vorige P02 blijft expliciet een mislukte S1/S2-vergelijking. P03 kan hoogstens een semantisch signaal aantonen in een niet-productieve NeSy-onderzoekssandbox; integratie zou een **apart** project met echte veiligheidscontrole en onafhankelijke beoordeling vergen.
