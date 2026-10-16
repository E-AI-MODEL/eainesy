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

## Live GLM and build checks

`src/lib/eainesy/glm.ts` currently initializes `z-ai-web-dev-sdk` through `ZAI.create()`. The repository does **not** contain portable credentials or a provider-neutral adapter. Live GLM calls require the compatible hosting environment and its documented SDK authentication. No credentials should be committed. Tests that need a live provider **must be labelled as such** and must not be presented as equivalent to the deterministic suite.

```bash
bunx tsc --noEmit
bunx eslint src --max-warnings=0
bun run build
```

Note: `next.config.ts` currently has `typescript.ignoreBuildErrors: true`; therefore, a successful `bun run build` **does not** prove type correctness. The original research scripts may have pre-existing TypeScript errors; report the full compiler output rather than claiming a clean whole-project typecheck. The production build requires Prisma client generation first.

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
