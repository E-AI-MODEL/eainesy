# P02 failed-study postmortem — NOT a successful S1/S2 experiment

**23 October 2026. Source:** [Actions run #39893997337](https://github.com/E-AI-MODEL/eainesy/actions/runs/39893997337), [artifact #12476480215](https://github.com/E-AI-MODEL/eainesy/actions/runs/39893997337/artifacts/12476480215). Source merge commit: `8e0e154780ff8819f3ca785b5f89ddfc6e397e98`.

## What actually happened?

- Ten paid, genuine P0 turns passed technical tests, **with real isolated Z3 SAT and passed output policies**. These used 20 GPT-5 HTTP requests (ten parser, ten generation), 21,653 input and 1,808 output tokens.
- **Zero** of the ten P0 final actions were `THERAPEUTIC_DIALOG`, the only action allowed to enter the existing S1/S2 research-selection function. The final actions were six `BOUNDARY_REFUSAL`, three `CLARIFY`, one `ABSTAIN_HITL`.
- All ten cases reached `safe_skip`, neither S2 rechecks nor S1/S2 research replies were generated, and the blind review packet was empty.
- **No outcome for S2 versus S1** can be calculated. `P0 success` here only means that NeSy and the formal checker executed as configured, not that the task or response was semantically correct.

This failure did **not** involve a changed or invalid API secret, an outage, or a failed Z3 calculation. The study corpus was authored for general writing and scheduling tasks, while P0 is a specialized system with early privacy, novelty and humility gates. We cannot establish the exact per-case reason for the boundary decisions because the archived metadata did not retain the decision rule ID and relevant PII/novelty facts. Do not claim the P0 decisions were correct either.

## Why this is a design failure

The eligibility rule in `research/nesy-cooperative/coordinator.mjs` requires all of these: the P0 action `THERAPEUTIC_DIALOG`, no assessed risk or active risk memory, real verified SAT and output policy, and no lexical or neural risk markers. The trial first bought all ten P0 decisions without a gate-yield preflight.

We must **not** turn `CLARIFY`, `ABSTAIN_HITL` or `BOUNDARY_REFUSAL` into eligible actions as a quick fix. They may represent privacy, uncertain understanding, or a genuine reason to keep the reviewer out.

## Repairs for any future authorized run

- First classify P0 scope and actual rule gates, **before** authorizing additional research replies.
- During a costly pilot, **stop after the first three verified P0 turns** if all three are outside the research route. This is a predefined efficiency stop, **not** a conclusion about cases four through ten. The original failed run is historical and will not be re-run automatically.
- Keep reason counts separate: `P0 technical` ≠ `P0 action eligible` ≠ `S1/S2 model-call completed` ≠ `useful dialogue move` ≠ `independently reviewed`.
- Draft a new corpus that is explicitly within NeSy's dialogue domain, or else test general-task semantics in a *separate, purely research-only sandbox* whose proposals cannot bypass any live controller. Neither route should silently change P0's safety requirements.
- **No paid retry** is authorized by this postmortem. The paid P02 workflow remains manual-only via `confirm_api_costs=YES`.
- Before claiming improvement, independently judge both usefulness of uncertainty detection **and** whether the assistant should actually ask another question.

## What does this establish?

It establishes that the guard is effective at keeping ineligible cases out. It does **not** establish that NeSy's P0 decisions were semantically appropriate, or that S2 is better or worse than S1. In scientific terms this P02 run **failed to answer the research question**. Preserve it as a negative study-design result.
