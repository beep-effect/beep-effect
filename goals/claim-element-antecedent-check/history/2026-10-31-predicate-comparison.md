# Contextual predicate repair with 29-claim retention — 2026-10-31

**Strict recovery is 31/538 (5.76%), retaining all 29 baseline complete matches.** Two new complete matches are gained and none is lost. All reference labels, source claims, prior results, the strict scorer and the full denominator remain unchanged. This is development-set remediation after inspection, not independent validation or full-goal acceptance.

## Same-evaluation comparison

| Metric | Baseline v10 | Final v12 |
| --- | ---: | ---: |
| Strict structures | 29/538 | 31/538 |
| Baseline complete claims retained | 29/29 | 29/29 |
| Structural mismatches | 451 | 449 |
| Input failures | 58 | 58 |
| Selected undecomposed claims | 0 | 0 |
| Exact matched edges | 1802 | 1805 |
| Predicted edges | 5408 | 5408 |
| Edge precision | 33.3210% | 33.3765% |
| Edge recall | 26.0781% | 26.1216% |
| Edge F1 | 29.2580% | 29.3067% |

Both runs use 60 families, 538 selected claims and 6,910 reference edges. The [paired retention gate](2026-10-31-v12-retention.json) lists every retained claim, two gains and an empty lost set. All historical complete-match sets are also subsets of this final passing set. The original 0/538 measurement and every prior run remain available.

## Repairs grounded in the nearest source mismatches

The nearest one-edge differences include unresolved body-dependency conventions, so this wave does not add per-patent exceptions for those. The next clear recurring errors concern grammatical roles inside functional clauses:

- A purpose participle followed by for ends the preceding entity phrase. A source-defined parenthetical acronym remains part of the entity, while used for remains functional connecting text. Determiner-led nominal phrases such as a used bracket remain entities.
- The in response to idiom stays in connecting text. It no longer creates a bare response entity; a response unit still remains an entity.
- Embed and its finite forms are recognized as predicates through the existing context-sensitive verb handling. A to embed phrase no longer enlarges the following entity name, and nominal-compound safeguards remain in force.

Two new synthetic regressions exercise the interacting positive cases and nominal counterexamples. No family ids, expected structures or reference data are consulted by production rules. Neither PatentClaim nor the scorer changes.

## Newly complete claims

| Family | Claim | Previously blocking gap |
| --- | ---: | --- |
| 12749812-root-1 | 4 | Embed was included in the ETE flits entity name. |
| 13070851-root-1 | 3 | Used was included in the channel name and response was emitted as an entity inside in response to. |

The first measured source and result are preserved at checkpoint `4046f1178d` as v11. Its package check found formatting errors; v12 applies only formatter changes and reruns the full evaluation under a new source freeze. Every per-family/per-claim score is identical between v11 and v12. The failed formatting check is not reported as a pass.

## Preservation and verification

- All 180 historical evidence/freeze/scorer/model files compared against baseline eec7f5f2d1 are byte-identical. All 240 family annotation/canonical/extractor/critic hashes and 60 native XML source hashes pass.
- Both measured implementations have verified 20-file source freezes; v11 binds the retained checkpoint, v12 binds final source. Prediction hashes and versioned results are retained in the [receipt](2026-10-31-predicate-receipt.json).
- 59,635 prediction anchor occurrences, including edge endpoints and functional parts, match exact UTF-16 source slices.
- The focused domain suite passes 87 tests. Full domain package verification passes (audit 9.5s / docgen 10.3s), use-cases passes (audit 13.5s / docgen 10.8s), and server passes (audit 70.5s / docgen 11.8s). Final formatter changes are reverified by the complete domain package check.

## Remaining evidence and limits

449 structural mismatches and 58 input failures remain. [Twenty nearest remaining diagnostics](2026-10-31-predicate-remaining.json) preserve source text, exact trees and full-family owner identities. The ranking is an inspection aid; it neither changes the denominator nor waives any mismatch. Recurring remaining gaps include ancestor element kind/span ownership, overlapping preamble clauses, enumeration markers, nested segmentation, context-sensitive antecedents and body-level dependency interpretation. Frozen human-convention questions remain pending; no reference is declared incorrect or rewritten.

The measurement is still poor. Actual attorney agreement and adjudicated false-positive intervals remain absent. No PR publication or merge occurred in this bounded worktree repair, and the broader goal remains active and incomplete.

## Reproduce the final evaluation

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v12-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-v12-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-v12-reproduction/results.json
```

Use a new output directory; never overwrite a previous measurement.

- [Original 0/538](2026-10-28-positive-evaluation.md)
- [Baseline 29/538](2026-10-28-discourse-comparison.md)
- [Final per-claim result](2026-10-31-repair-v12-evaluation.json)
- [Final grouped metrics](2026-10-31-repair-v12-summary.json)
- [Final source freeze](../research/implementation-repair-v12-freeze.json)
