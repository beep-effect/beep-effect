# Discourse-role repair with explicit 21-claim retention — 2026-10-28

**Final strict recovery is 29/538 (5.39%), retaining all 21 baseline complete matches.** Eight new complete matches are gained and none of the baseline passes is lost. Reference labels, the strict scorer, the denominator and every prior result remain unchanged. This is development-set remediation after error inspection, not independent validation or full-goal completion.

## Comparison

| Run | Strict matches | Baseline passes retained | Input failures | Structural mismatches | Matched edges | Edge precision | Edge recall | Edge F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 21/538 | 21/21 | 58 | 459 | 1767 | 34.33% | 25.57% | 29.31% |
| Preserved trial | 25/538 | 17/21 | 58 | 455 | 1809 | 33.35% | 26.18% | 29.33% |
| Final | 29/538 | 21/21 | 58 | 451 | 1802 | 33.32% | 26.08% | 29.26% |

All runs use 60 families / 538 selected claims / 6,910 reference edges. Final v10 predicts 5,408 selected edges with 1,802 exact matches. There are no selected undecomposed claims. The full-match gain is real under the same strict metric, but diagnostic edge F1 declines slightly (29.31% to 29.26%) and precision declines (34.33% to 33.32%) while recall improves (25.57% to 26.08%). Additional structural links do not justify claiming improvement on every measure.

The initial trial v9 reached 25 complete matches but lost four baseline passes because inherited-subject canonicalization widened root-level assertions. Its complete source and results are preserved at `828e34b258`. Final v10 limits canonicalization to body-reference candidates and preserves the previous conservative root policy; it restores the four baseline cases and retains the eight trial gains. [The machine-readable paired gate](2026-10-28-v10-retention.json) lists every retained and gained claim and has an empty lost list.

## Recurring source gaps repaired

- Inherited indefinite subjects in dependent preambles are not counted again as fresh introductions for body references. The checker likewise excludes the repeated subject from introduction candidates without adding a new legal query for an indefinite preamble. Root-level linking remains conservative.
- Alternative dependency scaffolding such as of any of claims and of any one of claims remains in the complete preamble anchor but is excluded from entity terms.
- Finite display/extend/mesh forms are recognized as predicates in context. Determiner-led homographs remain names, and nominal compounds such as lateral support strips remain intact; to support strips still contains a predicate and its object.
- A unique local name ending in a source letter-number designator can be referenced without its designator. Multiple matching designators and bare numbers do not receive a guessed link. A structural relation to an earlier definite mention does not create legal antecedent basis; missing-introduction findings remain.
- A first noun phrase that is an action object is not automatically a limiting subject. An introduced spatial part with an explicit of-owner can depend on the immediate-parent entity it further limits. These rules repair actual grammatical roles rather than using patent-specific exceptions.

Eight new synthetic regressions cover these behaviours, ambiguity controls and the root-linking regression. The focused domain suite passes 85 tests. No reference content or patent ids are embedded in production rules.

## Newly complete claims

| Family | Claim |
| --- | ---: |
| 12360911-root-1 | 9 |
| 12447956-root-7 | 13 |
| 12749812-root-1 | 7 |
| 13070851-root-1 | 5 |
| 13070851-root-1 | 6 |
| 13275397-root-1 | 5 |
| 13468456-root-1 | 6 |
| 14262251-root-1 | 3 |

## Remaining work

**451 selected structural mismatches and 58 input failures remain.** Nearest unresolved cases still include interpretation of body-level dependency edges, source node ownership/kinds, complex coordination and contextual antecedents. [Twenty current nearest diagnostics](2026-10-28-discourse-remaining.json) preserve reference/prediction structures, full source text and node identities. The post-result ranking is only an inspection aid; no case is waived or removed from the primary denominator. Human reference agreement and adjudicated false-positive estimates remain absent.

## Verification and reproduction

Final full package verification passed for domain (audit 8.2s / docgen 11.7s), use-cases (audit 12.3s / docgen 10.2s), and server (audit 38.3s / docgen 10.6s). The final integrity audit compares all prior measured artifacts to retained commits, every frozen family annotation/canonical claim/receipt to the original hashes, the unchanged model/scorer/first-slice fixtures, regenerated summaries, the 21-claim set inclusion gate, source hashes and exact UTF-16 prediction anchors. No PR publication is part of this bounded repair.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v10-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-v10-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-v10-reproduction/results.json
```

- [Original 0/538](2026-10-28-positive-evaluation.md)
- [21-match baseline](2026-10-28-next-closest-comparison.md)
- [Trial v9 results](2026-10-28-repair-v9-evaluation.json)
- [Final v10 results](2026-10-28-repair-v10-evaluation.json)
- [Final grouped metrics](2026-10-28-repair-v10-summary.json)
- [Version and prediction receipts](2026-10-28-discourse-receipt.json)
