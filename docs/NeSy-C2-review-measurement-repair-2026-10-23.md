# C2: measured outcomes and candidate retention (post-run change)

Live pilot #39890442472 was already completed before this change. **Do not reinterpret its archived data as if rejected proposal texts were available.**

Observed in the original pilot: ten calls, nine model proposals, five source-/schema-accepted, four rejected (three exact-source mismatches, one invalid shape), three genuine zero-proposal responses, three cases where *all* proposals were rejected, and one mixed case.

The original summary also counted six cases with no **accepted** candidate. This is correct as a filter count but misleading if read as six **model abstentions**.

For **future, separately manually authorized** runs only, the updated research runner:
- records `generatedCandidateCount`, `explicitModelNoProposalCases`, `casesAllProposalsRejected`, and `casesWithBothAcceptedAndRejected`;
- retains legacy `noCandidateCases` with an explicit meaning note;
- saves all model-generated proposals in a separate `all-model-proposals-for-review.json`, without gate verdicts, so reviewers can examine potential false rejections before seeing acceptance decisions;
- keeps every candidate untrusted and weightless, never modifies NeSy's live decision path, never includes genuine user data;
- does not rerun the old known ten cases automatically or make paid model calls.

This is **trace/measurement repair**, not an improvement in semantic comprehension. It does not grant C2 new permissions. Reusing the known DEV prompts cannot turn this into blinded or confirmatory evidence.
