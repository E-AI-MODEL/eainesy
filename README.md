# EAInesy v2

**Neuro-symbolic research demonstrator** (Next.js, Bun, Prisma/SQLite, GLM, Z3). This is a software research environment using synthetic scenarios from a deliberately demanding human-interaction domain. It is **not** a clinically validated intervention, crisis service, or suitable for use with real people seeking care.

The published code is a snapshot of the demonstrator. Historical demo runs, older EvAI versions, screenshots, and original Git development history are archived separately; they are not required to start a new demo instance. The formal checks concern defined symbolic actions and invariants, **not** the quality of a language model's interpretation or clinical safety.

## Reproduce locally without a language-model connection

Prerequisites: [Bun](https://bun.sh/) (with the version compatible with `bun.lock`), a runtime supported by Next.js 16, and a local shell. Commands below run from the repository root.

```bash
bun install --frozen-lockfile
bun test
bun --preload ./tests/support/preload.ts scripts/regress-formal.ts
bun --preload ./tests/support/preload.ts scripts/run-fast-eval.ts
bun --preload ./tests/support/preload.ts scripts/run-scenarios.ts
```

`bun test` uses `bunfig.toml` to preload `tests/support/preload.ts`: a **fake, in-memory database** and a GLM stub. Its knowledge graph comes from the versioned definitions in `src/lib/eainesy/kg-data.ts`; the original 30 MB demo database is **not** needed. These tests demonstrate specified behaviour under controlled inputs. In particular, the fast evaluation does not validate the live model's ability to recognize risky messages.

## Start a fresh local instance

```bash
cp .env.example .env
bun install --frozen-lockfile
bun run db:generate
bun run db:push
bun scripts/seed-kg.ts
bun run dev
```

The example `DATABASE_URL="file:./dev.db"` is resolved by Prisma relative to `prisma/schema.prisma` and creates a new, local SQLite database. `db:push` in this project's package scripts has `--accept-data-loss`: **use it for a new demo database only**, never for an existing database without a backup and a migration plan. `seed-kg.ts` upserts versioned graph nodes and replaces graph edges; it does not import historical conversations or evaluation runs.

Open `http://localhost:3000`. UI pages and deterministic tests can be examined without a live GLM connection; live chat will require the provider environment described below.

## Node-runtime, Z3-procesisolatie en grenzen

De **automatische live-chatcontrole vereist een echt Z3-certificaat**. Bun wordt gebruikt als pakketbeheerder, builder en deterministische testrunner, maar **Node** moet de gebouwde standalone-server uitvoeren. `z3-solver` is onder Bun 1.3.4 aantoonbaar instabiel (WASM/pthreads).

```bash
bun run db:generate
bun run db:push
bun run build
bun run start
```

`bun run build` plaatst de Z3-childworker plus de vanuit `src/lib/eainesy/z3cert.ts` gegenereerde controlecode in `.next/standalone/`. Voor elke live-controle start de server een apart afbreekbaar Node-proces. Er kunnen maximaal **vier** processen tegelijk draaien en **acht** aanvragen wachten in een FIFO-wachtrij (maximaal **twee seconden**). Per worker geldt daarna een uitvoerdeadline van **vijf seconden**. Onbeschikbaarheid, crashes, onleesbare berichten, volle wachtrij, wachttijdoverschrijding en tegenstrijdige solveruitslagen blokkeren automatische antwoorden met `ABSTAIN_HITL`; dit is **geen actieve menselijke reviewwachtrij** (`humanReviewQueued=false`).

De gewone Bun-tests mocken Z3 bewust. Echte checks draaien in GitHub Actions:
[FIFO-wachtrij, 160 echte Z3-verzoeken en procesgeheugen](https://github.com/E-AI-MODEL/eainesy/actions/runs/39024303976) en
[standalone-API met 12/12 gelijktijdig gecertificeerde gesprekken](https://github.com/E-AI-MODEL/eainesy/actions/runs/39024160778).
In de nieuwe GitHub-duurtest slaagden **160/160** echte Z3-verzoeken. De grootste gemeten som van resident geheugen voor het Node-hoofdproces en directe Z3-children was **311 MiB** op de CI-runner. Dit is een momentopname en optelling van RSS (gedeelde pagina's kunnen dubbel meetellen), geen garantie voor iedere deployment. De wachtrij is per serverproces, niet globaal over meerdere replicas.

Een nieuwe lokale Bun-devserver zonder vooraf gebouwde Z3-worker kan voor live-chat geen geldig solvercertificaat krijgen en zal dan antwoorden tegenhouden; dit is verwacht fail-closed gedrag.

Dit is een **reproduceerbaar softwareonderzoek**, niet een aantoonbaar veilige gespreksdienst. De Z3-bewijsgrens is numerieke consistentie van de vastgelegde regels. Zie [Z3-integratie-audit](docs/Z3-audit-2026-10-16.md).

## GLM-modelproviders en bewijsgrenzen

EAInesy houdt de semantische GLM-koppeling gescheiden van de symbolische controle, Z3 en de uitvoercontrole. De standaardbackend `zai-sdk` behoudt de oorspronkelijke `z-ai-web-dev-sdk`-aanroep. Als alternatief ondersteunt `src/lib/eainesy/model-provider.ts` een **expliciet geconfigureerd OpenAI-compatibel HTTP-endpoint**. De provider wordt uitsluitend via de serveromgeving gekozen; de chatgebruiker mag niet een eigen endpoint instellen.

Voor een compatibel endpoint zijn de volgende serverinstellingen nodig (gebruik een secret store; commit geen API-sleutel):

```dotenv
EAINESY_MODEL_BACKEND=openai-compatible
EAINESY_MODEL_ENDPOINT=https://<provider-host>/v1/chat/completions
EAINESY_MODEL_NAME=<jouw-model-id>
EAINESY_MODEL_API_KEY=<alleen-via-secrets>
```

Een ontbrekende sleutel, ongeldig endpoint, onjuiste backend, ongeldige respons of serverfout leidt tot `null`; er volgt **geen stille modelwissel**. De adapter staat alleen HTTPS toe, met een beperkte localhost-HTTP-uitzondering voor `CI=true`. Redirects worden geweigerd. De HTTP-aanroep heeft een timeout van 20 seconden; de bestaande Z.ai-SDK wordt niet door een nieuwe HTTP-timeout afgebroken.

**Getest zonder echte GLM-credentials:**
- [Transportcontract](https://github.com/E-AI-MODEL/eainesy/actions/runs/39025242061): schemareparatie, retries, antwoordgeneratie, authentificatie en ongeldige configuratie tegen een lokale nep-provider
- [Volledige HTTP-keten](https://github.com/E-AI-MODEL/eainesy/actions/runs/39025327484): twee fictieve gespreksverzoeken door Next.js, parser, symbolische beslisregels, echte Z3, generator en uitvoercontrole; beide geslaagd

**Optionele echte providerproef:** de workflow [Manual live GLM synthetic check](https://github.com/E-AI-MODEL/eainesy/actions/workflows/manual-live-glm.yml) draait *niet automatisch*. Configureer in GitHub Actions Secrets `EAINESY_MODEL_ENDPOINT`, `EAINESY_MODEL_NAME` en `EAINESY_MODEL_API_KEY`. Start daarna handmatig `Run workflow`. Er worden vijf fictieve Nederlandse tekstvoorbeelden voor herkenning gebruikt; de provider kan hiervoor kosten in rekening brengen. Deze workflow is nog niet met een externe provider uitgevoerd. De uitkomst zou uitsluitend een eerste modeldiagnose zijn, **geen onderbouwde veiligheids- of klinische validatie**.

Zie [GLM-transportaudit](docs/GLM-transport-audit-2026-10-17.md).

## Live GLM and build checks

`src/lib/eainesy/glm.ts` currently initializes `z-ai-web-dev-sdk` through `ZAI.create()`. The repository does **not** contain portable credentials or a provider-neutral adapter. Live GLM calls require the compatible hosting environment and its documented SDK authentication. No credentials should be committed. Tests that need a live provider **must be labelled as such** and must not be presented as equivalent to the deterministic suite.

```bash
bunx tsc --noEmit
bunx eslint src --max-warnings=0
bun run build
```

Note: `next.config.ts` currently has `typescript.ignoreBuildErrors: true`; therefore, a successful `bun run build` **does not** prove type correctness. GitHub Actions voert ook een afzonderlijke TypeScript-controle uit. Het optionele WebSocket-voorbeeld is bewust uitgesloten van het applicatie-TypeScript-project, omdat zijn eigen afhankelijkheden niet in de applicatie zijn opgenomen. The production build requires Prisma client generation first.

## Optional environment and historical artifacts

The former Z.ai hosting environment had platform-specific build helpers. Two portable helpers are retained under `scripts/infra/`; their contract tests are:

```bash
bash tests/database-runtime-build.sh
bash tests/python-runtime-build.sh
```

The database contract test uses a fake `bun` executable and does not alter your real database. The Python helper test needs `uv` installed. The Docker test (`tests/python-runtime-container.sh`) additionally needs Docker and a compatible `z-ai-python-deploy-runner:test` image: **it cannot run on an ordinary clean clone without that image**. The other original platform scripts were intentionally not imported because they hard-code the previous hosting environment.

Historical report generators in `scripts/task22*` through `scripts/task25*` also reference local `/home/z/my-project/...` paths and material outside this repository. They are included for reference, **not claimed independently reproducible**. The original audit images, reports, old revisions and demo database belong in a separate research archive. See `docs/V2-GESPREKSREGIE.md` for design context.

## Integration and evidence boundaries

Future model-independent API/MCP adapters must preserve independent lexical risk checks, symbolically chosen actions, output-policy enforcement, audit semantics and separation between evaluation memory and live HITL review. Changes should be tested against the deterministic regression suite **and** independent live-model evaluation. These are different evidence classes.
