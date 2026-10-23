# EAInesy — beperkte end-to-end proef met echt OpenAI en echte Z3

Status vóór uitvoering: **niet aangetoond**. De eerdere NeSy-sandbox (2 echte reviewer-aanroepen) gebruikte één fictieve casus en een **gesimuleerde SAT-status**, geen werkelijke NeSy-verificatie.

## Onderzoeksvraag

Kan de bestaande, ongewijzigde NeSy-keten de vaste vier fictieve casussen verwerken met:
1. de **werkelijke** Next.js `/api/chat`-route;
2. de bestaande GLM-parser en -generator met echte OpenAI-API-uitvoer;
3. de bestaande beslisregels, afzonderlijke **Node/Z3**-worker en geldige certificaten;
4. output-policy-verificatie en registratie in een **wegwerp-SQLite-database**?

Dit onderzoekt technische integratie, **niet** onafhankelijk bewezen inhoudelijke kwaliteit, betrouwbaarheid van risicodetectie of klinische veiligheid.

## Technische uitvoering

- Bestaand testscript: `scripts/live-http-e2e.mjs --live --accept-costs`.
- Aparte, eenmalige, beschermde runner: `scripts/nesy-full-chain-live-once.mjs`.
- Workflow: `.github/workflows/nesy-real-openai-z3.yml`.
- GitHub Environment: `nesy`; secret: `nesy`.
- Model: `gpt-5-mini`, zoals bij de eerder geslaagde B/C-connectie. Het gewone NeSy-providerprotocol gebruikt Chat Completions; daarom vertaalt een **lokale** begrenzer het verzoek naar de modelcompatibele parameters (geen ongeoorloofde temperatuur).
- API: `https://api.openai.com/v1/chat/completions`, `store:false`.
- Maximaal **12 HTTP-aanroeppogingen**, inclusief retries; maximaal **1.600 completion tokens per poging**; begrensde invoer en responsen; geen automatische oneindige retries.
- De echte sleutel blijft in de parent-proxy in het GitHub-jobproces. Het Next.js-proces ontvangt uitsluitend een kunstmatig lokaal testtoken.
- Alleen fictieve gesprekken. Geen bestanden, screenshots, volledige prompts, volledige modelantwoorden of sleutels in de artifact-metadata.
- Op elke uitgevoerde beurt moet de bestaande API een echt Z3-resultaat `sat` met certificaat, modelcheck en output-policy-resultaat opleveren; provideruitval of weigering blijft zichtbaar als FAIL of fail-closed.

Een HTTP-aanroeplimiet is **geen absolute geldlimiet**; kosten hangen ook af van inputtokens en tarieven. Voor deze ene proef autoriseert de gebruiker expliciet de uitvoering. De tijdelijke push-activatie wordt na de run weer verwijderd; daaropvolgende uitvoeringen uitsluitend met `workflow_dispatch` en expliciete keuze `YES`.

## Interpretatie

- **Technische PASS:** alle vier de bestaande fictieve beurten komen door de live route, voldoen aan de vooraf bestaande checks, Z3 is daadwerkelijk beschikbaar, en de certificaten zijn opgeslagen.
- **FAIL:** elke ontbrekende modelverbinding, niet-gevalideerde uitvoer, ongeldige Z3-check, onjuiste inhoudelijke verwachting of niet-bereikbare server. Een fail-closed beslissing is een nuttige veiligheidsobservatie, maar geen PASS voor dit succescriterium.
- **Geen kwaliteitsconclusie:** vier zichtbare, fictieve testgevallen zijn geen geblindeerde of representatieve benchmark. Een geslaagde Z3-check bewijst uitsluitend de vastgelegde symbolische constraints, **niet** dat de oorspronkelijke taalmodelinterpretatie juist was.

Meld de status van de werkelijk uitgevoerde workflow pas ná inspectie van de GitHub-log en metadata.
