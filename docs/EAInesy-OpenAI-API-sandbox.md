# EAInesy — afgeschermde OpenAI API-sandbox

Status: voorbereide, handmatig te activeren research-sandbox. De standaardmodus
maakt geen netwerk- of API-verzoeken. De echte verbinding is nog NIET getest
zolang er geen apart projectsecret en expliciete handmatige uitvoering zijn.

## Wat er is

- GitHub Actions workflow: .github/workflows/nesy-openai-sandbox.yml
- Researchclient: research/nesy-abc/openai-sandbox-client.mjs
- Fictieve, vaste proef: scripts/run-nesy-openai-sandbox.mjs
- Vier afzonderlijke onderzoeksroutes P0/A/B/C blijven bestaan.
- Alleen B en C doen in connect-modus ieder maximaal EEN echte modelaanroep.
- Model voorlopig vastgepind: gpt-5-mini; alleen de officiële OpenAI
  Responses API op https://api.openai.com/v1/responses.
- Output wordt vergeleken als ongetoetste kandidaat; nooit als daadwerkelijk
  NeSy-antwoord, Z3-oordeel, veiligheids- of crisisbeslissing.
- Geen import in productieroutes, geen productie-DB, geen echte gesprekken,
  geen output naar gebruikers.
- Alleen fictieve casus DEV-R01 en reeds bekende, vooraf geschreven observaties.
- De scriptfixture simuleert SAT uitsluitend om een B/C-reviewpad te testen.
  Dit is uitdrukkelijk GEEN bewijs van een echte veiligheidsverificatie.

## Eerst de sleutel veilig toevoegen — NIET in ChatGPT of een issue

1. Open de OpenAI API-console en maak bij voorkeur een afzonderlijk
   project aan, bijvoorbeeld EAInesy Sandbox, met een laag bestedingsbudget
   en bijbehorende project-API-sleutel.
   https://platform.openai.com/api-keys
2. Open in de repository:
   https://github.com/E-AI-MODEL/eainesy/settings/environments
3. Maak een environment met PRECIES deze naam:

   nesy-openai-sandbox

4. Voeg binnen die environment (dus geen repository-breed secret) een
   Environment secret toe met PRECIES deze naam:

   NESY_OPENAI_API_KEY

   De GitHub Actions-workflow en het onderzoeksprogramma gebruiken allebei
   direct NESY_OPENAI_API_KEY. Er is geen tweede naam of interne alias.
   Je hoeft de sleutel niet opnieuw op te slaan.

5. Plak de OpenAI-projectsleutel uitsluitend in het Secret value-veld van
   GitHub en sla het secret op. Deel de sleutel niet via chat, PR, issue,
   code, screenshots of logs.
6. Indien beschikbaar: beperk deployment branches tot main en stel
   benodigde goedkeuring in voor toegang tot de environment. Beperk de
   API-projectrechten en monitor het werkelijke verbruik bij OpenAI.

Zonder deze stappen is de betaalde verbinding niet bruikbaar. Als de secretnaam ontbreekt, toont de workflow voortaan een foutmelding zonder de waarde uit te schrijven. De huidige
GitHub-connector heeft geen actie om een environment-secret veilig namens
een gebruiker aan te maken of om het secret in deze chat aan te nemen.

## Gratis testen (geen sleutel of API-gebruik)

De automatische NeSy research-CI draait het volgende sleutelloze commando:

    node scripts/run-nesy-openai-sandbox.mjs --dry-run

Dit controleert de P0/A/B/C-integratie op één fictief gesprek met een lokale
testbeoordelaar; geen extern model. Ook zes client-unit-tests controleren
de vaste URL, requestvorm, store:false, maximale twee calls, foute
antwoorden en veilige foutmeldingen.

## De echte verbinding testen (na het opslaan van het secret)

1. Open:
   https://github.com/E-AI-MODEL/eainesy/actions/workflows/nesy-openai-sandbox.yml
2. Kies Run workflow en branch main.
3. Kies mode = dry_run om de workflow eerst zonder sleutel en zonder kosten
   te proberen. De bevestiging mag op NO blijven.
4. Kies daarna alleen wanneer je het echt wilt: mode = connect en
   confirm_api_costs = YES. Hiermee geef je per uitvoering expliciet
   toestemming voor MAXIMAAL TWEE doorbelastbare OpenAI-API-verzoeken.
5. Open het run-resultaat en het artifact nesy-openai-sandbox-metadata.
   De rapporten bevatten gespreksbewegingen, validatie, latentie en
   (indien beschikbaar) tokens, geen API-sleutel, modeltekst of klantdata.

Een grens van twee verzoeken per run is GEEN absolute geldlimiet.
GitHub-runs kunnen handmatig opnieuw worden gestart; bewaak daarom
ook het afzonderlijke OpenAI-projectbudget. Er zijn geen automatische
of terugkerende betaalde modelaanroepen.

## Technische beveiliging

- Alleen handmatige workflow_dispatch; geen cron, push of PR die het
  OpenAI-secret kan lezen of de betaalde flow kan starten.
- environment = nesy-openai-sandbox; read-only GITHUB_TOKEN;
  checkout zonder opgeslagen Git-credentials.
- Het API-secret wordt pas in de ene betaalde uitvoerstap als environment
  variable geïnjecteerd. In dry-run wordt het niet gebruikt.
- De workflow vereist mode connect EN bevestiging YES; de scriptcode
  controleert daarnaast een aparte consent-parameter.
- Het model is vastgepind op gpt-5-mini en de URL is onveranderlijk.
- HTTPS zonder redirects, maximaal twee requests, maximaal 800
  outputtokens per request, beperkte invoer, responsegrootte en timeout.
- store:false in de OpenAI Responses-aanroep; geen toolcalls of bijlagen.
- Geen aanroep naar endpoints buiten api.openai.com en geen API-key
  in argumenten, gecommitte bestanden, artifacts of auditpayloads.
- API-responsinhoud en fouten worden niet in het rapport opgenomen;
  het bestaande onderzoekscontract valideert exacte bewijsfragmenten.
- Bij mislukte model-/outputvalidatie is het resultaat FAIL, zonder retries
  en zonder vrijgave van het conceptantwoord.

## Wetenschappelijke betekenis

Een geslaagde verbinding bewijst uitsluitend dat B en C op één fictieve
DEV-casus afzonderlijk een modelbeoordeling kunnen opvragen, de uitvoer
binnen bestaande contracten kunnen controleren en de extra calls kunnen
meten. Het meet GEEN onafhankelijke gesprekskwaliteit en bewijst niets
over klinische veiligheid. Voor dat oordeel blijft de vooraf vastgelegde
P01-beoordeling met onafhankelijke testset en beoordelaars nodig.

Let op: modelgebruik via deze API wordt apart gefactureerd van een
ChatGPT-abonnement.
