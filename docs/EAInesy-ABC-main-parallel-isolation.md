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
The main workflow tests the same independent A/B/C modules plus a
DEV-only neutral/scripted evidence replay, without importing the app.
This preserves PR #5 and avoids accidentally pulling unrelated live code.

The scripted claims are authored fixtures, not measured LLM judgments.
The main workflow does not exercise the actual NeSy processTurn,
a real Z3 solver or live model providers. It does not demonstrate
answer quality, clinical safety or the superiority of any architecture.
Safety remains binding; all research proposals are read-only.

## Preconditions before production activation

A separate PR must add the app-level integration with review and real
safety regression. A B-produced replacement must pass the real output
policy and safety checks before delivery; C must respect the one-call
limit and trigger restrictions. Production remains P0 until explicit
approval, irrespective of these research modules existing on main.
