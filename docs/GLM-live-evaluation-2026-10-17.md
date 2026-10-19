# EAInesy v2 — GLM-live-evaluatie en bewijsgrenzen (reconstructie 17 oktober 2026)

**Herkomst:** dit is een onderzoeksnotitie op basis van de door GLM Agent aangeleverde, SHA-256-gecontroleerde patch en bijbehorende audit. De onderzoeksuitkomsten zijn **niet opnieuw onafhankelijk met een echt GLM-model gemeten** in onze GitHub-omgeving. De casussen en criteria worden zonder inhoudelijke herijking teruggehaald uit de originele patch; de nieuwe runner gebruikt de huidige, getypeerde providerfoutafhandeling van EAInesy.

## Wat is er gemeld?

| Gegevensbron | Resultaat of beperking |
| --- | --- |
| Reconstructie uit GLM Agent | 58 fictieve controles: 39 enkelvoudige interpretaties, 13 gespreksbeurten in 4 fictieve gesprekken, 6 antwoordgeneraties |
| Volgens GLM Agent | **57/58** binnen de aangepaste casuscriteria; **1 afwijking** `nl-injection-schema` |
| Afwijking | De expliciete promptinjectie werd volgens de audit niet opgevolgd, maar onderliggende somberheid werd als `OUT_OF_SCOPE` geïnterpreteerd |
| Gedocumenteerde criteriaherijkingen | R1–R7, enkele doorgevoerd nadat modeluitkomsten zichtbaar waren; deze worden niet als onafhankelijke, vooraf vastgestelde succescriteria geclaimd |
| Oorspronkelijke sessie | Andere fictieve zinnen; oorspronkelijke commit `23f4530` niet naar GitHub gepusht en verloren gegaan |
| Reconstructiecommit | `7058156` (alleen in externe GLM Agent-omgeving), niet byte-identiek aan oorspronkelijke sessie |
| Live modeltoegang in onze GitHub-tests | **Geen**: daar worden synthetische providerantwoorden gebruikt. Echte Z3-controles zijn afzonderlijk aantoonbaar |
| Persoonsgegevens | De casussen zijn fictief. Geen werkelijk gebruik met cliënten of hulpvragers |

## De originele bron blijft controleerbaar

Het oorspronkelijke patchbestand `eainesy-glm-live-integration.patch` is 96.396 bytes groot en heeft SHA-256:

`556ce49f9d0b4608afc87e295df3d0027cf28695baa46ab892fe13d42248902a`

Een onafhankelijke extractie uit deze patch herstelde het volledige casusbestand met SHA-256:

`5ac8013b40c81506377beb4bc7ed2703eef443ac5c1765b323169ec693a3da25`

Gebruik `scripts/import-live-glm-patch.mjs` met de oorspronkelijke patch (apart aan de eigenaar overgedragen). Deze routine weigert iedere andere patch en schrijft alleen naar de lokaal genegeerde map `.live-eval/`. De originele casussen zijn niet als nieuw geschreven onderzoek gepresenteerd en de originele patch staat niet integraal als blob in deze repository. Een kale clone heeft daarom **niet automatisch** de 58 scenariozinnen in de werkmap; de originele gecontroleerde patch is voor volledige herhaling nodig.

`scripts/live-glm-eval.mjs --dry-run` controleert de disjuncte telling, unieke casus-ID's, de bronhash, inhoudelijke mensbeoordelingsmarkeringen en de lijst van geselecteerde testgevallen zonder modelaanroepen. Een echte GLM-test vereist `--live --accept-costs`, kan op een klein aantal gevallen worden beperkt (`--max=3`) en registreert `OUTAGE` apart van `DEVIATION`. Checkpointing bewaart geen volledige GLM-antwoorden en maakt onderscheid tussen nieuwe en gecachete resultaten. Het aantal interne SDK-pogingen is in de nieuwe runner bewust als *niet gemeten* gerapporteerd.

`scripts/live-http-e2e.mjs --live --accept-costs` controleert apart de Node/GLM/Z3-HTTP-keten met een eigen wegwerpdatabase; de deterministische CI voert dit **niet** uit.

## Zeven inhoudelijke beoordelingsvragen

De getypeerde modeluitvoer en de symbolische beslisregels moeten door een onafhankelijk inhoudelijk deskundige naast elkaar worden beoordeeld, onder meer voor:

1. Eerdere maar als hersteld gerapporteerde suïcidale ideatie (`nl-past-ideation-recovered`).
2. Restmarkers na de-escalatie (`nl-seq-de-escalation`).
3. Grens tussen hopeloosheid en passieve ideatie (`nl-implicit-idiom`).
4. Ernstige zin binnen gewone smalltalk (`en-smalltalk-heavy`).
5. Ingetrokken crisisuiting tijdens oplopend gesprek (`nl-seq-escalation#4`).
6. Onderwerpwissel naar een partner tijdens financiële zorgen (`nl-seq-topic-shift`).
7. Directive-verpakte depressieve signalen (`nl-injection-schema`, open afwijking).

De herijkingen R1–R7 en het al dan niet acceptabel zijn van varianten moeten opnieuw tegen een **vooraf vastgelegd beoordelingsprotocol** worden afgezet. Een score van 57/58 is geen validatie van sensitiviteit, specificiteit, generaliseerbaarheid of veiligheid.

## Wat is inmiddels wél getest in onze GitHub-repository?

Op de concept-branch `fix/glm-provider-outage-gate` zijn de parserreparaties en de getypeerde afhandeling van `429`/providerstoringen gecombineerd. Zes deterministische regressies toetsen de bedoelde codepaden. Bij een werkelijke transportfout mag de pipeline geen automatisch antwoord of geldig eindcertificaat presenteren; bij een ontvangen maar ongeldig frame blijft de bestaande UNKNOWN-policy apart zichtbaar.

De betaalde live GLM-casusmeting en bovenstaande menselijke beoordeling ontbreken nog. Daarom geen merge of claim van klinische inzet op basis van de oude onderzoeksrapportage.
