# P3 evidence — real-model OA candidate-claims batch over the demo inputs

Date: 2026-07-28 · Phase: P3 OA candidate claims · Scope: workstation batch
with a real Anthropic LanguageModel layer over the out-of-repo demo-inputs
directory, persisting into the live practice KG bundle.

## What ran

```sh
# workstation only; key injected via `op read`, never stored in the repo
BEEP_LANGEXTRACT_ALLOW_REMOTE=true \
bun run apps/practice-kg-mcp/src/claims.ts \
  --inputs <corpus-root>/staging/oppold-demo-inputs \
  --bundle-out <corpus-root>/staging/practice-kg-bundle
```

Duration ~54 minutes, sequential (concurrency 1).

## Results

| Metric | Count |
| --- | --- |
| Input files | 102 |
| Skipped (no docket in filename) | 5 (patent fulltext references) |
| Docketed files attempted | 97 |
| Extracted with all required labels + aligned spans | 16 |
| Extraction failures (tolerated per file, logged) | 81 |
| Candidate claims persisted | 16 |
| Evidence rows persisted | 16 (1:1 with claims) |

Claims span 3 docket families across 12+ dockets (10008 / 10011 / 10013
series, including EP, JP, CN, AU, CA, and US members).

## AC-3 verification

- Every persisted claim has `lifecycle = candidate` and a matching evidence
  row with an aligned span; nothing shipped without grounding.
- Served end-to-end over stdio: `kg_candidate_claims { docket: "10013EP01" }`
  returns the row with `epistemic_status: "candidate-unreviewed"`.
- The 81 failures are the strict quality bar working as intended (R2): most
  demo files are assignments, retainers, letters, or amended claims rather
  than office actions, and extractions missing required labels or failing
  span alignment are rejected, not shipped.

## Egress posture evidence

The first batch attempt failed with "Remote LangExtract generation denied by
policy" until `BEEP_LANGEXTRACT_ALLOW_REMOTE=true` was set explicitly — the
deny-by-default egress gate held on the workstation exactly as designed
(AC-5 supporting evidence; Tom's machine never runs extraction).

## Defects found and fixed by this batch (all merged)

- #496 — document-text join regex over-escape (empty `document_text`).
- #497 — join compared bare operation ids against prefixed `operationId`.
- #498 — docket extraction anchored to filename start; docketless inputs and
  non-OA extraction failures aborted the whole batch.

Each fix landed with fixture shapes corrected to mirror the real corpus, so
the synthetic suite now exercises the true data contracts.
