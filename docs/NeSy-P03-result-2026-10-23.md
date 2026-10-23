# NeSy P03 — resultaat van de echte GPT-5-betekenisproef

**23 oktober 2026 · Protocol `EAINESY-P03-2026-10-23`**

Bron: [GitHub Actions-run #39895702021](https://github.com/E-AI-MODEL/eainesy/actions/runs/39895702021), [beoordelingsartifact #12476044929](https://github.com/E-AI-MODEL/eainesy/actions/runs/39895702021/artifacts/12476044929). De bronrun hoort bij mergecommit `a1f08b326850756cb1256901c2d1aa609e12a76a`, met de vooraf vastgelegde fictieve cases. De job eindigde **success**.

## Wat hebben we werkelijk uitgevoerd?

| Vastgelegd | Uitkomst |
| --- | ---: |
| Fictieve semantische gevallen | 14 |
| Geplande en echte S2-herbeoordelingen | 8 / 8 |
| Gevallen zonder modelcall (negatieve controles) | 6 / 6 |
| Verschillende voorgestelde vervolgstappen S1 vs. S2 | 4 |
| S1 komt overeen met vooraf geschreven auteursetiket | 10 / 14 |
| S2 komt overeen met vooraf geschreven auteursetiket | 14 / 14 |
| Volledige A/B-antwoordparen ter latere blinde beoordeling | 4 |
| Werkelijk voltooide onafhankelijke menselijke beoordelingen | 0 |
| Externe GPT-5-aanroepen totaal | 16 |
| Door provider gerapporteerde inputtokens | 5.255 |
| Door provider gerapporteerde outputtokens | 999 |

Van de acht extra S2-controles ontstonden vier `PROPOSE_CONTINUE`-voorstellen bij gevallen waarin een persoon of datum expliciet al was gegeven (P03-01, 03, 05 en 07). Vier andere controles behielden `KEEP_CLARIFY` bij onvoldoende specificatie (P03-02, 04, 06 en 08). Bij alle zes negatieve controles (P03-09 t/m P03-14) was er geen extra modelaanroep.

## Wat zegt dit en wat niet?

Het is een **daadwerkelijke, complete modelproef met GPT-5**, niet slechts een gescripte test. S2 onderscheidde de acht ontwerpgevallen op een wijze die in deze zichtbare DEV-set overeenkwam met de vooraf geschreven verwachtingen. Het geeft een concreet positief onderzoekssignaal voor taakgerichte, eindige neuro-symbolische herbeoordeling.

Maar de verwachte zetten zijn **door de onderzoekers zelf vastgesteld**, de casussen zijn vooraf zichtbaar en de inhoud van de vier daadwerkelijke antwoordparen is **nog niet blind en onafhankelijk beoordeeld**. De 14/14 is dus **geen objectieve nauwkeurigheidsscore**, geen onafhankelijke winnaar en geen bewijs dat NeSy in echte gesprekken beter werkt.

De sandbox gebruikte opzettelijk **gesimuleerde** SAT-, risicovrije en controller-statussen om puur de samenwerkingslogica te onderzoeken. Er werd geen echte P0-controller of Z3-validator aangeroepen. Deze synthetische statussen verschaffen geen geldige toestemming om dezelfde route in productie te gebruiken. De originele veiligheidsgates en productieantwoorden bleven ongewijzigd.

Ook een geldig broncitaat kan een onjuiste interpretatie ondersteunen. De beperkte meetset heeft geen echte gebruikerscontext, geen onafhankelijke externe cases en geen statistische grond voor generalisatie.

## Vervolg, zonder verborgen aannames

De vier **gemaskeerde antwoordparen** liggen in het artifact als `blind-human-review.json`, met hun armtoewijzing **apart** in `unblind-after-review.json`. Voor een onafhankelijke beoordeling moeten beoordelaars eerst de A/B-antwoorden beoordelen, zonder de mapping of ontwerpverwachtingen te zien. Laat hen vervolgens vastleggen wanneer een vraag noodzakelijk was, wanneer S2 een onnodige vraag wegnam, of antwoorden details verzonnen en of de relevante taak daadwerkelijk werd uitgevoerd.

Pas daarna kunnen we onderscheiden: (1) juiste volgende zet, (2) daadwerkelijke kwaliteit van het antwoord, (3) de kosten van acht extra modelcalls en (4) de mate waarin dit buiten de kunstmatige sandbox reproduceert.

## Sleutel, kosten en workflow

Deze run gebruikte het **bestaande** GitHub Environment `nesy` en secret `nesy`; er is geen secret gewijzigd en er staat geen sleuteltekst in de repo. De eurokosten zijn niet rechtstreeks gemeten. De eenmalige betaalde `push`-trigger wordt na deze succesvolle run verwijderd; latere GPT-5-runs kunnen alleen via handmatige `workflow_dispatch` met een expliciete `YES`-keuze worden gestart.

**Kort:** de P03-run beantwoordt voor deze veertien fictieve gevallen eindelijk de vraag of S1/S2 technisch én met echte modelantwoorden kan samenwerken. Er is een positief, maar nog **niet onafhankelijk bevestigd** kwaliteitssignaal. Dit is geen medische/veiligheidsvalidatie en geen productie-release.
