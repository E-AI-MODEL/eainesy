# Review van GLM Agent-herbouw — 17 oktober 2026

Status: **concept; geen automatische merge; geen klinische validatie.**

## Herkomst en integriteit

- Aangeleverd bestand: `eainesy-glm-live-integration.patch`, 96.396 bytes, Git format-patch van gereconstrueerde lokale commit `7058156` (oorspronkelijke commit `23f4530` was niet op GitHub en is verloren gegaan).
- SHA-256 gecontroleerd tegen het afzonderlijk aangeleverde manifest:
  `556ce49f9d0b4608afc87e295df3d0027cf28695baa46ab892fe13d42248902a`.
- De patch bevat 10 bestandswijzigingen. De GitHub-main bij aanvang stond op `9fe6c6c`.
- Een statische scan van toegevoegde regels toont geen ingevoegde API-sleutels, bearer tokens of absolute privé-paden; een lokale 127.0.0.1-binding zit in een opt-in testscript. Een statische scan bewijst niet dat alle security-risico's uitgesloten zijn.

## Code geïntegreerd op concept-PR #1

De oorspronkelijke patch kan niet blind over `fix/glm-provider-outage-gate` worden gelegd: de patch retourneert bij ontbrekende GLM-respons `null`, terwijl de nieuwere branch verplicht onderscheid maakt tussen **onbereikbare provider** en **wel ontvangen, schema-ongeldig frame**.

De volgende onderdelen zijn daarom *semantisch gemerged*, niet byte-identiek gekopieerd:

1. `src/lib/eainesy/glm.ts`: intent-vs-marker-disambiguatie, bescherming tegen promptinjectie en herstelprompt met echte begrensde Zod-veldfouten.
2. `tests/glm-repair.test.ts`: zes deterministische regressies, aangepast aan het verplichte getypeerde afbraakpad voor provideruitval.
3. De al bestaande `model-provider.ts`, `orchestrator.ts`, `api/chat/route.ts`, contract- en HTTP-tests behouden de nieuwe expliciete `rate_limited`/timeout/foutconfiguratie-statussen. Bij provideruitval geen automatisch inhoudelijk antwoord, geen opgeslagen beurt en geen volledig certificaat.

**Vervolgimplementatie:** de aparte, opt-in onderzoeksroute is nu toegevoegd aan deze branch:
- `scripts/import-live-glm-patch.mjs` controleert de oorspronkelijke SHA-256 en reconstrueert **precies de oorspronkelijke 58 casussen**, buiten de Git-werkboom in `.live-eval/`. Een onafhankelijke lokale extractie gaf een byte-identiek casusbestand met SHA-256 `5ac8013b40c81506377beb4bc7ed2703eef443ac5c1765b323169ec693a3da25`.
- `scripts/live-glm-eval.mjs` gebruikt de actuele productie-parser en de nieuwe getypeerde transportstatus, met expliciete `--live --accept-costs`, optionele `--max=3`, eerlijke `CACHED`-status en code/model/casushash in checkpoints.
- `scripts/live-http-e2e.mjs` biedt een afzonderlijke, betaalde vierbeurten-test met een eigen wegwerpdatabase, Node en echt Z3; `scripts/glm-access-probe.mjs` is eveneens uitsluitend opt-in.
- `docs/GLM-live-evaluation-2026-10-17.md` legt de oorspronkelijke onderzoeksclaim, provenance en zeven beoordelingsvragen vast; dit is **geen nieuwe onafhankelijke live-meting**.

**Nog niet integraal in Git:** de oorspronkelijke patch met de 58 volledige fictieve casuszinnen (bewust niet opnieuw uitgeschreven), de verloren herbouw-worklog en de volledige oorspronkelijke rapporttekst. Voor een reproductie is daarom de apart bewaarde patch nodig. De nieuwe scripts zijn pas syntactisch/offline in GitHub Actions gecontroleerd; zonder modelcredentials zijn zij daar nog niet live uitgevoerd.

## Live onderzoeksresultaten — alleen volgens de aangeleverde audit

- Oude sessie rapporteerde 58/58 na herijkingen; de reconstructie meldt **57/58**, met één bewust zichtbare afwijking `nl-injection-schema` (`OUT_OF_SCOPE` in plaats van de onderliggende somberheid; de expliciete injectieinstructie werd volgens de audit niet uitgevoerd).
- De gereconstrueerde disjuncte telling is **39 losse parsecontroles + 13 meerbeurt-beurtcontroles + 6 generatiecontroles = 58**. De eerdere tabel telde 62 vanwege overlap.
- De korte hermetingssamenvatting bevat `GEN CACHED` en meldt 0 nieuwe SDK-aanroepen in *dat* uitvoeringsproces. Daarmee kan die samenvatting niet zelfstandig de aantallen nieuwe live-aanroepen onderbouwen.
- Verschillende criteria zijn na observatie herijkt (R1–R7), inclusief afhandeling van `UNKNOWN` en interpretatie van impliciete hopeloosheid; die herijkingen moeten door een onafhankelijke inhoudelijke beoordelaar worden bekeken, niet automatisch als nieuw succes worden geteld.
- Geen klinische gevoeligheid, specificiteit of werkelijk gebruik met cliënten aangetoond.

## Inhoudelijke mensbeoordeling (zeven thema's)

1. Herstelde vroegere suïcidegedachten — wat vraagt het verleden nog aan controle?
2. Restmarkers tijdens de-escalatie — per beurt versus gespreksgeheugen.
3. Hopeloosheid tegenover passieve suïcidegedachten.
4. Ernstige zin binnen smalltalk (Engelstalig).
5. Terugname in het midden van een oplopend gesprek.
6. Onderwerpwissel naar een partner tijdens geldzorgen.
7. **Nieuwe afwijking:** directive-verpakte somberheid is gelezen als `OUT_OF_SCOPE`.

Dit zijn onderzoeksvragen voor onafhankelijke beoordeling; dit document neemt er geen nieuwe beslisregels voor aan.

## GitHub-controle (samengevoegde CODE op PR-branch)

- [Complete reproduceerbare suite](https://github.com/E-AI-MODEL/eainesy/actions/runs/39056300800) — 161/161 tests, TypeScript, formele regressies, ESLint, productiebuild groen.
- [GLM-providercontract](https://github.com/E-AI-MODEL/eainesy/actions/runs/39056300802) — groen, gesimuleerde provider.
- [HTTP-gesprekken en echte Z3](https://github.com/E-AI-MODEL/eainesy/actions/runs/39056300808) — groen; foutinjectie `429` bij zowel parsing als antwoordgeneratie veilig geblokkeerd.
- **Geen nieuwe echte GLM-modelaanroepen** in deze GitHub-tests; de Z3-verificatie bewijst alleen vastgelegde rekenkundige consistentie.

## Besluitvoorstel

Houd [PR #1](https://github.com/E-AI-MODEL/eainesy/pull/1) als **draft** totdat het resterende testharnas veilig is geïntegreerd, de bijgewerkte criteria onafhankelijk zijn beoordeeld en het verschil tussen synthetische regressies en echte modeluitkomsten expliciet bij de release staat. `main` is beschermd en blijft onaangeroerd.
