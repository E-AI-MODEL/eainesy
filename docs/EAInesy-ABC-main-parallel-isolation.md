# NeSy P0/A/B/C: parallel research modules on main

**Date:** 2026-10-23
**Purpose:** Keep architecture A intact and add B and C alongside it on main,
without replacing the existing NeSy chat pipeline or merging the unrelated
live model-provider changes still open in PR #5.

## Parallel architecture

| Arm | Research implementation | Authority over live response |
| --- | --- | --- |
| P0 | Existing production NeSy, unchanged | Existing controller / model checker / Z3 / output policy |
| A | Shared evidence and deterministic content mixer, architecture-lab.mjs | None |
| B | One-call post-draft content supervisor, content-supervisor.mjs | None |
| C | Triggered pre-answer orchestrator on A evidence, reusing B review interface | None |

The selector takes an explicit arm identifier: P0, A, B, or C.
A remains available and is NOT replaced by B or C. The current production
path continues using P0 with no new import, feature toggle or route.

## Contents permitted on main

- Independent modules under research/nesy-abc and their Node tests.
- Pre-registered protocol, dated DEV-only amendment, fictional cases.
- A new self-contained Node-only CI workflow and reports.
- No modifications to src/, production API routes, Prisma, live prompts,
  provider wiring, credentials, output policy or stored conversation state.

## Dependency separation

Research PR #6 is based on PR #5 and contains further parser-related
changes and a Bun processTurn test runner. Those are not included here.
The main workflow tests the independent A/B/C modules and also
performs two DEVELOPMENT-ONLY modes:
1. A separate 24-case Node-only neutral/scripted research replay without
   importing the app.
2. Offline Bun tests and a 24-case replay through the REAL NeSy processTurn,
   loading actual stored plan, certificate and history with the read-only
   A/B/C bridge. The Bun test preload mocks Z3 and all model calls and
   marks verification SKIPPED, which blocks every architecture proposal.

The scripted claims are authored fixtures, not measured LLM judgments.
These tests do not use a real Z3 solver, live model providers, independent
expert raters or a clinical safety assessment. They do not demonstrate
better answer quality. The existing response is never replaced.

The PR #6 branch also contains an OPTIONAL dialogue-observation addition
to the live parser prompt and Frame schema. This is NOT in this main
integration: changing the production parser needs its own targeted
safety evaluation. Closing PR #6 as superseded leaves that code as
historical source, with its status recorded in issue #8.


## Preconditions before production activation

A separate PR must add the app-level integration with review and real
safety regression. A B-produced replacement must pass the real output
policy and safety checks before delivery; C must respect the one-call
limit and trigger restrictions. Production remains P0 until explicit
approval, irrespective of these research modules existing on main.

## PR housekeeping (23 October 2026)

- PR #7: merged to main; A, B and C research modules preserved.
- PR #5: closed without merge; model routing and other independent changes inventoried in issue #8.
- PR #6: superseded by this safe isolated integration of the remaining processTurn tests;
  no live parser/schema change, production routing or altered risk scoring is included.
- Ending with zero open PRs is an administrative state, not a claim that every
  planned or experimental feature is ready for actual users.
