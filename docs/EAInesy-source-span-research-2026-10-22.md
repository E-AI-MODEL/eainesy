# Source-span/overlap research aid (22 October 2026)

This review-only helper records **literal evidence positions** in the user's final message, not whether the marker is correct. The implementation does **not** change the schema, lexical risk score, neural maximum fusion, controller, default replies, or the production API.

- `src/lib/eainesy/context-evidence-shadow.ts` reports UTF-16 half-open coordinates, repeated source candidates, and possible/unavoidable overlap between markers of the **same type**.
- A valid occurrence is **not** proof of a live first-person disclosure: the text may be quoted, negated, historical, third-person, hypothetical or a prompt injection.
- Two different text ranges of the same type remain two markers in the observation; even overlapping ranges are **not** automatically deduplicated.
- No source message or quoted evidence is returned in the diagnostic record. This function makes no network calls and writes no logs or records.
- `tests/context-evidence-shadow.test.ts` contains fictional regression cases for unique/repeated source ranges, overlap, non-overlap, unknown scope, and invalid offsets.

**Release gate:** independent reviewer agreement, false-positive/false-negative analysis, and explicit authorization are required before any production change to `RiskMarkerSchema`, classification, max-fusion, Z3 binding, or crisis routing. The observation code is *not called* by production flow.
