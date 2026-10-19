# GLM-transportaudit — 17 oktober 2026

Status: **providerinterface technisch getest; geen externe live-GLM-kwaliteitsclaim**.

## Technische wijziging

- `src/lib/eainesy/model-provider.ts` is de server-only modeltransportgrens. `src/lib/eainesy/glm.ts` blijft verantwoordelijk voor promptopbouw, FrameSchema-validatie, maximaal één herstelpoging en de plan-gebonden antwoordgeneratie.
- Standaardbackend: de oorspronkelijke Z.ai-web-dev-SDK (bestaande onderzoeksomgeving). Expliciet alternatief: een OpenAI-compatibele `chat/completions`-aanroep met `EAINESY_MODEL_BACKEND=openai-compatible`, een HTTPS-endpoint, een model-ID en een sleutel uit de serveromgeving.
- De legacy-generator kan nog een `null`-respons teruggeven, maar de veiligheidsrelevante parser gebruikt op deze branch een **getypeerde transportstatus**: `ok` of `unavailable` met uitsluitend een generieke reden (`rate_limited`, `timeout`, `provider_error`, `invalid_configuration` of `invalid_response`). Een geleverd maar ongeldig frame blijft apart een **schema-/interpretatiefout**. Bij provideruitval blokkeert een echt live-gesprek voordat de symbolische/Z3-keten een incompleet neuronaal resultaat kan behandelen als een geldige volledige analyse.
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


## Conceptwijziging in review: GLM-provideruitval als aparte blokkade

Op de branch `fix/glm-provider-outage-gate` (nog **niet** samengevoegd in `main`) wordt het onderscheid tussen transportuitval en onleesbare GLM-inhoud daadwerkelijk gemaakt. Dit is onafhankelijk van de lokale reparaties van GLM Agent, die eerst nog als patch moeten worden ontvangen en beoordeeld.

- Bij HTTP 429 na retries, een time-out, ongeldige providerinstellingen of ontbrekend bruikbaar protocolresultaat ontstaat een getypeerde `ModelProviderUnavailable`. Foutmeldingen, API-sleutels, prompts en volledige inhoud worden niet in audits opgenomen.
- De parser herprobeert uitsluitend een **werkelijk ontvangen** maar niet-schema-geldig antwoord; een `429` wordt niet met een tekstprompt 'repareerd'.
- De live orchestrator stopt bij een transportfout tijdens **parse én generatie**, registreert alleen `phase` en `reason` in `turn.model_unavailable`, en slaat geen nieuwe chatbeurt op.
- De API retourneert `failClosed=true`, `action=ABSTAIN_HITL`, `verification.reason=model_unavailable`, `verification.providerReason` en `humanReviewQueued=false`. De route maakt geen compleet verificatiecertificaat aan, ook als een rekenkundige Z3-berekening eerder in die beurt wel is uitgevoerd.
- Een geleverd maar ongeldig GLM-frame blijft onder de bestaande expliciete UNKNOWN-policy vallen. Dat is **niet** hetzelfde als provideruitval en is geen bewijs dat inhoudelijke signalen betrouwbaar herkend zijn.
- De automatische regressies zijn ingericht voor een localhost-nepprovider en testen geen echte GLM, geen klinische nauwkeurigheid en geen herstel van de door GLM Agent lokaal ontdekte prompt- of schemavergissingen.
- De oorspronkelijke `zai-sdk` ondersteunt nog geen harde cancelbare transportdeadline. De HTTP-compatibele transportaanroep is begrensd op 20 seconden per poging, afgezien van retries. De productiehosting dient daarnaast een requestdeadline en resourcegrenzen te hebben.
