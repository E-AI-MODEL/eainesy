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

`bun run build` plaatst de Z3-childworker plus de vanuit `src/lib/eainesy/z3cert.ts` gegenereerde controlecode in `.next/standalone/`. Voor elke live-controle start de server een apart afbreekbaar Node-proces; maximaal **vier** mogen tegelijk actief zijn per serverproces. De deadline is **vijf seconden**. Onbeschikbaarheid, crashes, onleesbare berichten, volle capaciteit en tegenstrijdige solveruitslagen blokkeren automatische antwoorden met `ABSTAIN_HITL`; dit is **geen actieve menselijke reviewwachtrij** (`humanReviewQueued=false`).

De gewone Bun-tests mocken Z3 bewust. Echte checks draaien in GitHub Actions:
[Z3-procesfouten en belasting](https://github.com/E-AI-MODEL/eainesy/actions/runs/38970336471) en
[standalone-API met 12 gelijktijdige gespreksaanvragen](https://github.com/E-AI-MODEL/eainesy/actions/runs/38970521481).
Een nieuwe lokale Bun-devserver zonder vooraf gebouwde Z3-worker kan voor live-chat geen geldig solvercertificaat krijgen en zal dan antwoorden tegenhouden; dit is verwacht fail-closed gedrag.

Dit is een **reproduceerbaar softwareonderzoek**, niet een aantoonbaar veilige gespreksdienst. De Z3-bewijsgrens is numerieke consistentie van de vastgelegde regels. Zie [Z3-integratie-audit](docs/Z3-audit-2026-10-16.md).

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
