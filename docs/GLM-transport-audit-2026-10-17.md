# GLM-transportaudit — 17 oktober 2026

Status: **providerinterface technisch getest; geen externe live-GLM-kwaliteitsclaim**.

## Technische wijziging

- `src/lib/eainesy/model-provider.ts` is de server-only modeltransportgrens. `src/lib/eainesy/glm.ts` blijft verantwoordelijk voor promptopbouw, FrameSchema-validatie, maximaal één herstelpoging en de plan-gebonden antwoordgeneratie.
- Standaardbackend: de oorspronkelijke Z.ai-web-dev-SDK (bestaande onderzoeksomgeving). Expliciet alternatief: een OpenAI-compatibele `chat/completions`-aanroep met `EAINESY_MODEL_BACKEND=openai-compatible`, een HTTPS-endpoint, een model-ID en een sleutel uit de serveromgeving.
- Bij een ongeldige configuratie of onbruikbare providerrespons wordt de modeluitkomst `null`. Dat staat los van de verplichting van een echt Z3-`sat` bij automatische chatantwoorden; Z3 valideert de rekenrelaties en bewijst niet dat het model het bericht goed begrepen heeft.
- Serverinstellingen worden nooit uit de inkomende chatrequest genomen. De compatibele HTTP-verbinding staat geen redirects toe en begrenst responsspecificaties. Een localhost-HTTP-testendpoint wordt uitsluitend geaccepteerd met `CI=true`. De Z.ai-SDK heeft nog geen gegarandeerd afbreekbare SDK-aanroep.

## Aangetoond in GitHub Actions

1. [Transportcontract](https://github.com/E-AI-MODEL/eainesy/actions/runs/39025242061): 9 positieve/negatieve testcondities tegen een lokale nep-provider; onder meer schema-validatie, één reparatiepoging, HTTP 429 en foutafhandeling, lokaal Bearer-headergebruik, geen externe modelaanvragen.
2. [Complete Next.js-chat-API met gesimuleerde GLM en echte Z3](https://github.com/E-AI-MODEL/eainesy/actions/runs/39025327484): twee fictieve gesprekken; `parseFrame` en `generateReply` riepen de lokale compatibele provider aan; beide leverden een echt geïsoleerd Z3-`sat`, een geslaagde modelcheck en een geslaagd uitvoerbeleid op. Eén gesimuleerde modelframefout herstelde na een tweede parse-aanroep.
3. [Z3-soak](https://github.com/E-AI-MODEL/eainesy/actions/runs/39025139432): de numerieke verificatie draait afzonderlijk van de modelprovider en heeft 1.592 echte consistentiecontroles doorlopen in 180 seconden.

## Nog niet aangetoond

- De herkenningskwaliteit van een **echt GLM-model** voor open, meertalige en risicovolle taal.
- Provider-specifieke API-compatibiliteit, modelversies en stabiliteit buiten de lokale mock.
- Systeemgedrag onder echte providerlatenties, tokenlimieten, storing, kosten en gelijktijdige externe aanvragen.
- Betrouwbaarheid en veiligheid bij gesprekken met werkelijke personen. De gebruikte synthetische scenario's rechtvaardigen geen inzet in een zorgomgeving.
- Onafhankelijke menselijke beoordeling en kwaliteitsmeting van de semantische interpretaties en gegenereerde antwoorden.

## Gecontroleerde eerste live-stap

De handmatig uitvoerbare workflow `.github/workflows/manual-live-glm.yml` is voorbereid. **Deze wordt niet automatisch gestart**, en er zijn geen API-sleutels opgenomen. De repository-eigenaar moet eerst zelf drie secrets configureren (`EAINESY_MODEL_ENDPOINT`, `EAINESY_MODEL_NAME`, `EAINESY_MODEL_API_KEY`). Daarna volgt `Run workflow`. Dit voert vijf fictieve Nederlandstalige voorbeelden uit, waaronder expliciete risicotaal en ontkenning. Het rapport toont uitsluitend intentie, markertypen en aantallen, niet de modeluitvoer of credentials. Een geslaagd resultaat is hoogstens een smoke-test, geen sensitiviteits- of specificiteitsonderzoek.
