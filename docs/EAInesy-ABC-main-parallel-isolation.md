# NeSy P0 / A / B / C: parallel architectures with opt-in shadow observation

**Updated:** 2026-10-23
**Operating principle:** Keep A intact, retain independent B and C,
and do not replace the current production P0 response pipeline.

## Four parallel routes

| Arm | Role | Shipped reply authority |
| --- | --- | --- |
| P0 | Existing NeSy controller, model checker, real isolated Z3, output policy | Existing runtime only |
| A | Evidence workspace and deterministic mixer | None: research proposal |
| B | Separate one-call post-draft content supervisor (injected callback tests) | None: research proposal |
| C | Conditional pre-answer orchestrator built on A evidence and B-style reviewer interface | None: research proposal |

The research selector takes an explicit P0/A/B/C arm argument.
A remains available; B and C do not replace it.
The live response continues to be constructed by P0.

## Opt-in read-only shadow mode

The runtime includes a **disabled-by-default** observer at
src/lib/eainesy/abc-shadow.ts.

Activate it only through explicit **server-side** configuration:

    EAINESY_ABC_SHADOW_ENABLED=true

Every other value, including the absence of the setting, disables it.

With the setting enabled, *after* a turn's reply and safety certificate have
already been finalized and persisted, NeSy computes **read-only** comparisons
against A, B and C. No proposal is used to change the reply, risk assessment,
plan, Z3 certificate, conversation state or output policy. The A/B/C code
receives the existing frame, lexical evidence, plan, source certificate and
up to three previous turns already loaded by the original pipeline.

This shadow mode **does not call an LLM reviewer**. B's post-draft reviewer
and C's conditional external reviewer are not invoked; their standalone
behavior remains covered by dependency-injected, offline tests. Therefore
B/C shadow observations are *not evidence of superior model reasoning*.

If enabled, a small local computation and ONE metadata-only audit event
(turn.abc_shadow) are added for a successfully observed turn. The audit
records fixed arm labels, proposed move categories, whether they differ
from P0, C trigger codes, verifier statuses and local observer latency.
**No raw user utterance, conversation history, quotations, draft replies,
session identifiers or API secrets are added to the shadow audit payload.**
The existing turn record and its original audit data remain unchanged.
When shadow observation fails, the response is still returned as originally
approved and a generic turn.abc_shadow_error audit event is attempted.

The eval origin deliberately skips shadow audit entirely to preserve
historical evaluation behavior. Synthetic scenario tests may opt in via
their controlled test process. There is no user-facing toggle and no
background polling.

### How to turn the observer off again

Remove the server-side environment variable or set
EAINESY_ABC_SHADOW_ENABLED=false, then apply the standard server
configuration/restart procedure. This does not alter stored user turns.

## What the CI verifies

- The independent P0/A/B/C modules: Node tests and 24 known fictional DEV cases.
- The REAL processTurn path with preset frames, an in-memory fake database
  and **mocked Z3 (SKIPPED)**: integration checks and two 24-case replays.
- The disabled default and opt-in observer: P0 reply unchanged, no extra
  LLM calls, separate metadata-only audit, prior-turn correction trigger,
  no extra work for the eval origin, failure without blocking response.
- The existing production safety and formal verification suite, including
  a separate **real isolated Z3** test, and the production build.

These are DEV and engineering checks, NOT independent evidence for better
conversation understanding, clinical safety, answer quality or costs from
live LLM providers. The synthetic parser-claim fixtures are deliberately
authored from the visible DEV set, not genuine model observations.

## Next laboratory: real reviewer calls, still read-only (P02 DEV)

The main CI now automatically invokes actual source-aware B and C reviewer
**callbacks** through a localhost HTTP transport on all 24 public DEV cases.
The default CI provider is a deterministic rule-based **stub, not an LLM**.
B checks an **artificial** draft on every turn, C performs one review only
where the shared evidence workspace triggers it, and P0/A use no reviews.
The report exposes B/C calls, skipped C calls, candidate creation, response
validation, HTTP errors, measured HTTP latency and optional provider-reported
token counts. It is uploaded to the CI artifact folder
.research-output/nesy-abc-review-lab/ and the Actions job summary.

**Important controls:** the research process creates a deliberately *virtual*
SAT verification snapshot only to exercise B/C callbacks offline. It is
never accepted as a real Z3 certificate, passed to processTurn, or reused
for production. Baseline drafts and parser claims are hand-written. The
CI results establish engineering/call-budget behavior only; they **do not**
establish that A, B or C understands conversations, is clinically safe,
or generates better answers.

An actual local model can be tried **only by an explicit manual command**
on a machine where that model is already available. For example, with
an Ollama OpenAI-compatible local endpoint:

    node scripts/run-nesy-abc-review-lab.mjs --endpoint http://127.0.0.1:11434/v1/chat/completions --model llama3.2:3b

The adapter accepts **only literal 127.0.0.1 / ::1 HTTP endpoints**,
blocks all redirects, requires a model identifier, limits each request
to one call with bounded size and timeout, and reads **no API keys** or
production data. The default command does NOT call a model; it requires
an explicit --ci-stub or --endpoint ... --model ... choice. No
cloud-provider or paid LLM route is configured here.

A real local model's results still require frozen evidence snapshots,
an explicit sample/provider record, and independent blinded judgment
before they can count toward the P01 confirmatory research. A model
replacement candidate is **never sent to a user** by this lab.

## Historical PR boundaries

- PR #7: merged isolated A/B/C research modules into main.
- PR #9: merged offline processTurn integration and automatic reports.
- PR #5: closed without merge; unique provider and safety modifications
  inventoried in issue #8.
- PR #6: closed without merge; original live parser-extension proposal
  remains historical research. The live parser prompt and core Frame schema
  remain unchanged in this integration.
- This opt-in observer is a distinct engineering step and **does not**
  authorize activation of a new response-making architecture.

## Activation requires separate evidence

Before letting A, B or C alter a response:
1. Independently validate each candidate under real controller, output
   policy, Z3 and risk-memory checks (including dangerous near misses).
2. Recheck all B replacement text against the binding plan and output
   policy; the reviewer cannot self-certify.
3. Measure latency/tokens and content quality under frozen provider
   configurations and blinded assessments.
4. Keep P0 and A available as independent controls and preserve the
   preregistered P01 safety admission gate.

Merely including code in main or observing it in shadow mode is not
permission to change production answers.
