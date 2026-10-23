# NeSy C2 - meaning and uncertainty research (23 October 2026)

C2 is an isolated, **research-only** candidate observer; it is not a replacement for A, B, C or P0. Its purpose is to test whether a neural interpretation can name a specific unresolved alternative, contradiction or missing fact, with an exact source quotation. A source match proves only the quote is present, not that the hypothesis is true.

- Each candidate has one kind and a source span from the current user or a previous user/assistant turn.
- Every accepted candidate is explicitly `unverified_model_claim`, `weight:0`, `authority:false`.
- An optional question is only an experiment artifact, **never** an automatic user-facing question.
- No LLM call, production import, safety change, controller change, Z3 change, session write, stored seed, or output modification. Only small, explicit JSON structures for controlled synthetic testing.
- Reject missing evidence, unsupported kinds, duplicate claims and malformed envelopes. Keep rejected counts rather than pretending an empty response proves understanding.
- Test semantic appropriateness and impact with blind review later. Quotation anchoring, an accepted schema and technical CI success do **not** establish semantic correctness.

## Separate recognition hardening

`hitl-seeds.ts` now only reuses normalized **exact** utterances in the live seed-authority route. Previously 60% token-overlap could map an approved `Ik wil tips` pattern to `Ik wil geen tips`. Because the resulting match can carry influence, the approximate match was removed from this decision path. The old behavior remains a historical source, not a claim of semantic similarity. This intentionally loses some paraphrase recall. There are no new model calls.

## Evaluation next

Compare unmodified P0/A/C against separately recorded C2 observations on frozen new cases, including negation, past/current, speaker/reference, contradictory quotations and unsupported explanations. Rate whether candidate hypotheses are atomic, grounded and genuinely useful. Keep false positives, abstentions and no-opportunity cases. A second, separately approved experiment can investigate whether source-supported alternatives improve decisions without weakening the existing verification gate. Do not relabel existing 24 public DEV fixtures as independent confirmation.

Run offline with `node --test research/nesy-abc/c2-uncertainty.test.mjs`.
