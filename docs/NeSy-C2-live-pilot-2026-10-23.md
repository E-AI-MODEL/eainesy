# NeSy C2: one-shot genuine model-candidate generation, P02 exploratory

**Status:** configured; results must be read from an actual GitHub Actions live job.
This is separate from the 24-case NeSy A/B/C shared-P0 DEV test and from Shadowseed Pro.

## Research question

Can the model independently propose small, source-anchored doubts about an interpretation, unclear time/person, negation, a contradiction, or missing information in an unfamiliar fictional conversation? Does it also refrain from making unnecessary suggestions? Source quotation is a syntax/provenance gate, not semantic validation.

Ten new, public, fictional cases in research/nesy-abc/c2-live-pilot-input-v1.json.
Neither the model prompt nor the input includes prewritten hypothesis labels or expected outputs. This remains visible author-generated DEV material, not an independently blinded holdout.

## Invocation and cost

The one-shot push activation was used only for GitHub Actions run 39890442472 at merge commit 956c9db741f89583009a6895e1e8e855fa302e82. The workflow no longer accepts paid push activation: later model calls require a manual workflow_dispatch with confirm_api_costs = YES. Pull requests run the key-free offline suite only.

One call per case, hard maximum 10 HTTP attempts to the exact OpenAI Chat Completions endpoint. gpt-5-mini, reasoning_effort=minimal, max_completion_tokens=1600, max 12 KB input per request; no retries, redirects, tools, extra models or storage (store:false). The key comes exclusively from GitHub Environment nesy secret nesy and is never logged. Billing total is not measured in currency; provider-reported token counts are saved.

## Output and evidence limits

Model outputs remain unverified. They cannot influence P0/A/B/C, Z3, certificates, risk or the conversation. A generated claim may cite exact words and still assert the wrong meaning. Every structurally accepted candidate has weight zero.

Summary.json stores technical counts; independent-review-packet.json holds only fictional messages, quotes and hypotheses without quality verdicts. Reviewers must assess semantic support, specificity, atomicity, and usefulness. Until reviewed, do not claim increased comprehension or a winning arm.

Offline: node --test research/nesy-abc/c2-live-client.test.mjs; node scripts/nesy-c2-live-one-shot.mjs --dry-run.

The pilot does not rerun or alter the existing P0/A/B/C decision logic.
