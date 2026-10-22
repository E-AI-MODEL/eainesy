# EAInesy v2 | Geobserveerde contextgrenzen op 22 oktober 2026

**Resultaat van een deterministische lexicale waarneming, geen onafhankelijke klinische toets, geen live GLM-meting.**

## Reproduceerbaarheid en herkomst

- Repository: `E-AI-MODEL/eainesy`, reviewbranch `sync/glm-research-2026-10-19`.
- Uitgevoerde broncommit: `23cee01a84b4303329dc1b8dc51f9db319b9a147`.
- GitHub Actions: [clean reproducibility-run 39848489021](https://github.com/E-AI-MODEL/eainesy/actions/runs/39848489021), 22 oktober 2026.
- Proef: `tests/context-boundary-observation.test.ts`. De achttien teksten zijn gebaseerd op de eerder beschreven A01–A18-casussen uit `docs/EAInesy-independent-review-protocol-2026-10-21.md`.
- Resultaat uit de logregel `EAINESY_CONTEXT_OBSERVATIONS_V1`, zonder gebruikersberichten of tekstfragmenten in die log.
- Dit is **niet** een toets van de totale orchestrator, het generatiemodel, promptinjectie-afweer of het uiteindelijke antwoord.

## Uitkomst

- **18/18** casussen zijn door de observatiecode verwerkt.
- `CRISIS`: **10**, `ELEVATED`: **2**, `NONE`: **6**, `HIGH`: **0**.
- **1** casus heeft hetzelfde markertype tweemaal.
- GitHub-CI bij deze run: **228 geslaagde unit-/integratietests, 0 mislukt**; fast-eval 58/58 en scenario's 12/12. Dit betreft de synthetische/fixtureproeven, niet de externe GLM-claims.

| Casus | Contrast (onderzoeksdoel, geen gold label) | Lexicaal niveau | Markertypen | Negatie-teller | Dubbel type |
|---|---|---|---|---:|---|
| A01 | self-current | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A02 | other-current | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A03 | mixed-self-other | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A04 | other-past-resolved | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A05 | self-past-resolved | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A06 | self-recurrence | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A07 | quoted-fiction | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A08 | self-explicit | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A09 | self-negated | NONE | geen | 0 | nee |
| A10 | self-affirmed | CRISIS | SUICIDAL_IDEATION | 0 | nee |
| A11 | hypothetical | NONE | geen | 0 | nee |
| A12 | other-now-help | NONE | geen | 0 | nee |
| A13 | other-english | NONE | geen | 0 | nee |
| A14 | self-english | CRISIS | SUICIDAL_IDEATION, SUICIDAL_IDEATION | 0 | ja |
| A15 | self-mixed-language | ELEVATED | HOPELESSNESS | 0 | nee |
| A16 | self-english-short | ELEVATED | HOPELESSNESS | 0 | nee |
| A17 | quoted-schema | NONE | geen | 0 | nee |
| A18 | injection-distress | NONE | geen | 0 | nee |

## Inhoudelijke interpretatie (voorlopige systeemdiagnose)

**1. Eén risicowoord, heel verschillende situaties.** A01, A02, A04, A05 en A07 worden allemaal `CRISIS` op basis van `SUICIDAL_IDEATION`. Daaronder vallen in deze fictieve set een actuele eigen ervaring, een melding over een broer, een afgesloten gebeurtenis en een romancitaat. De lexicale scan onderscheidt die omstandigheden in deze formuleringen niet.

**2. Andere indirecte meldingen blijven leeg.** A12 en A13 leveren geen lexicaal risicosignaal. De woorden beschrijven in de test een hulpvraag over een ander. Dat is geen bewijs dat het gehele systeem deze gevallen negeert: een succesvolle neurale parse kan alsnog signalen toevoegen. Het wijst wel op inconsistente lexicale dekking.

**3. Eén type kan dubbel voorkomen.** A14 produceert tweemaal `SUICIDAL_IDEATION`. De implementatie van `collectLexicalMarkers` loopt over meerdere patronen binnen één regel en kan per patroon een marker toevoegen. Dit verdient een afzonderlijke impactanalyse voordat de scorelogica wordt veranderd; met name optellen van gewichten en het verschil tussen meerdere aanwijzingen en meerdere patronen voor dezelfde uitspraak.

**4. Emotionele inhoud zonder risicowoord.** A18 (promptinjectietekst naast somberheid) levert `NONE` in de lexicale scanner. Dit is op zichzelf geen bewijs van een fout: een neutrale emotionele melding hoeft geen risicomarker te geven en het model kan `DEPRESSIVE_REPORT` bepalen. Wel mag `NONE` niet als bewijs voor afwezigheid van ervaren problemen worden gepresenteerd.

**5. Brontrace bewijst geen endorsement.** De lexicale bewijsfragmenten van deze markerregels worden rechtstreeks uit de onderzochte tekst gehaald. Daarom leveren ze hier telkens `exact_last_user` op. Die uitkomst kan niet bewijzen wie de woorden uitsprak, of ze geautoriseerd, actueel of niet-ontkend zijn.

## Onafhankelijke beoordeling: strikt gescheiden

Het blanco bestand `docs/EAInesy-independent-review-blank-v1.tsv` bevat uitsluitend de achttien fictieve berichten, zonder systeemniveaus, contrastaanduidingen of voorgestelde labels.

Laat twee geschikte beoordelaars het formulier **afzonderlijk** invullen vóór het tonen van dit rapport of de modeluitvoer. Leg vooraf een codeboek vast voor de categorieën en een route voor onenigheid. Een onbesliste casus blijft als onbeslist staan. Gebruik geen algemene accuracyscore zonder een door mensen beoordeelde referentie.

## Besluit voor PR #5

- Laat de originele 58 fictieve casussen, 14 probes en geregistreerde criteria ongewijzigd.
- Bewaar de onafhankelijke formulieren buiten publieke GitHub als beoordelaarsnamen of andere herleidbare gegevens worden ingevuld; voeg hier geen persoonsgegevens toe.
- Wijzig **nog niet** het schema, de crisisroute of de max-fusie op basis van deze achttien observaties alleen.
- Plan een apart ontwerp voor onderwerp/tijd/polariteit plus een impactmeting van dubbele markers. Daarna pas een nieuwe blinde test en eventueel codewijziging op een reviewbranch.
- Geen merge, release of claim over klinische veiligheid op basis van deze run.
