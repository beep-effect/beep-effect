# Next closest-match repair — 2026-10-28

**Strict recovery improves from 11/538 to 21/538 (3.90%), retaining every previous complete match.** This is the same fixed 60-family development set, reference labels and unchanged strict scorer. It is not independent validation or full-goal acceptance.

## Comparison

| Run | Strict matches | Input failures | Undecomposed | Structural mismatch | Matched edges | Edge precision | Edge recall | Edge F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original | 0/538 | 186 | 8 | 344 | 240 | 15.95% | 3.47% | 5.70% |
| Previous v6 | 11/538 | 58 | 0 | 469 | 1565 | 30.46% | 22.65% | 25.98% |
| Intermediate v7 | 19/538 | 58 | 0 | 461 | 1765 | 34.29% | 25.54% | 29.28% |
| Final v8 | 21/538 | 58 | 0 | 459 | 1767 | 34.33% | 25.57% | 29.31% |

The denominator is always 538 selected claims and 6,910 reference edges. Final v8 has 1,767 matched / 5,147 predicted edges. All 21 complete matches are in the 517 current-convention accepted claims. The same 21 attorney-held claims remain in the primary denominator, with no complete matches. Actual attorney agreement and an adjudicated false-positive rate are still absent.

The intermediate v7 source and 19-match result are preserved at commit `007427078c`. It gained nine complete matches but regressed one earlier match by merging a multi-select at-least-one list. V8 fixes that general cardinality distinction and a nominal-further regression. It restores the earlier match and adds another; no trial result is overwritten.

## Recurring gaps repaired

1. An explicit defining clause can follow incidental having/wherein language. Prefer that explicit characterization when the earlier candidate is ambiguous, while preserving an earlier unambiguous comprising transition. Include is/being in the source transition and map to existing canonical values without changing PatentClaim. This corrects the full owner-node identity used by downstream edges.
2. Further comprising is a transition wrapper, not part of the claimed subject. Further still belongs to a noun phrase such as at least one further component. The legacy public-slice file is unchanged; its test projects only the obsolete further boundary to the corrected canonical preamble. That compatibility view is never used in the 538-claim evaluator.
3. Infinitive/finite action words such as provide, support and triggering belong in functional connecting language. A determiner-led participial phrase such as the received pulse echo remains a complete noun phrase.
4. A bare predicative material complement such as is formed of animal hair remains descriptive connecting text. An explicit entity such as a fibrous layer is retained. This is source grammar, not chemical or Markush modelling.
5. In association with and at least before a determiner are connecting language rather than invented entity names.
6. Shared-head ordinal coordination and ordinary exclusive selector lists preserve complete lexical spans. Multi-select at-least-one lists retain separate named members. Separate determiner-bearing objects remain separate, and through hole remains a noun phrase.
7. A unique shortened prior mention can receive a structural reference even if its earlier bare/definite wording does not establish legal antecedent basis. The legal checker continues to issue missing/unsupported warnings; no clean legal conclusion is inferred from graph identity.

Ten new synthetic regressions cover these changes and counterexamples. The focused domain suite passes 77 tests. No patent ids or expected trees are embedded in production code, and no reference annotation, scorer or former result is edited.

## Newly complete claims

| Family | Claim |
| --- | ---: |
| 12838228-root-1 | 9 |
| 12838228-root-1 | 10 |
| 13062032-root-1 | 10 |
| 13062032-root-1 | 12 |
| 13275397-root-1 | 3 |
| 13275397-root-1 | 4 |
| 15752303-root-1 | 6 |
| 15958729-root-1 | 4 |
| 15958729-root-1 | 6 |
| 16135952-root-20 | 23 |

## Remaining work

The final result still has **459 structurally unequal claims and 58 input failures**. The nearest one-edge dependency convention cases remain unresolved rather than being patched with per-claim exceptions. Element-kind choices, semantic ownership, more complex clause grouping and contextual antecedents remain broader gaps. [Twenty next-nearest diagnostics](2026-10-28-next-closest-remaining.json) preserve source text, reference/prediction trees, owner identities and version hashes. This post-result ranking is an inspection aid, not a replacement denominator or scoring rule.

## Verification and reproduction

Full package verification passed for domain (audit 8.5s / docgen 13.7s), use-cases (audit 10.3s / docgen 9.9s), and server (audit 35.5s / docgen 16.0s). The focused suite passes 77 tests. The final evidence check verifies all prior artifacts against their retained commits, all 60 reference families against the original reference freeze, unchanged scorer/model bytes, regenerated summaries, implementation hashes and exact UTF-16 prediction anchors. No PR is published by this bounded repair.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v8-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-v8-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-v8-reproduction/results.json
```

- [Original 0/538](2026-10-28-positive-evaluation.md)
- [Previous 11-match comparison](2026-10-28-closest-comparison.md)
- [Intermediate v7 results](2026-10-28-repair-v7-evaluation.json)
- [Final per-claim results](2026-10-28-repair-v8-evaluation.json)
- [Final grouped metrics](2026-10-28-repair-v8-summary.json)
- [Version and prediction receipts](2026-10-28-next-closest-receipt.json)
