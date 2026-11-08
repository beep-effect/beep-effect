# Closest-match repair and fixed-reference comparison — 2026-10-28

**Strict recovery is now 11/538 (2.04%), up from 0/538.** The same reference labels, scorer and full denominator are retained. The 10-match intermediate checkpoint is committed at `11e26d0acb`; final v6 retains all ten and adds another complete match. This is development-set remediation after inspecting errors, not independent validation or a full-goal completion claim.

## Why the score stayed at zero before this repair

The nearest v4 case (`13070851-root-1`, claim 7) had both nodes exactly correct and four of five edges correct. It failed only because the source-defined phrase `a linked downlink (DL) CC` was not retained as one phrase or recognized as the explicit abbreviation behind `the DL CC`. Full strict equality makes that one missing edge decisive.

Several other nearest claims also had all of their own nodes correct, but a donor node in an earlier claim had been merged with a neighbouring clause. An edge can print the same referring and introducing quote and still fail: the scorer aligns its owner nodes by claim number, kind and exact full span. Fixing the ancestor clause boundary repaired downstream edges without changing path-mapping rules or relaxing equality.

Other recurring gaps were dependency scaffolding treated as noun phrases, references appearing in the claim body rather than its preamble, bare dependent subjects, and entity-level limitations represented only by a root-to-root dependency.

## Honest comparison

| Run | Strict matches | Input failures | Undecomposed | Structural mismatches | Matched edges | Edge precision | Edge recall | Edge F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original | 0/538 | 186 | 8 | 344 | 240 | 15.95% | 3.47% | 5.70% |
| Previous repair v4 | 0/538 | 58 | 0 | 480 | 1191 | 29.96% | 17.24% | 21.88% |
| Closest checkpoint v5 | 10/538 | 58 | 0 | 470 | 1496 | 29.93% | 21.65% | 25.12% |
| Final v6 | 11/538 | 58 | 0 | 469 | 1565 | 30.46% | 22.65% | 25.98% |

Every run uses 60 families / 538 selected claims / 6,910 reference edges. Final v6 predicts 5,138 selected edges, of which 1,565 match exactly. All 11 strict matches are in the 517 current-convention agent-accepted claims; none comes from the 21 attorney-held claims. Human agreement and adjudicated false-positive rates remain absent.

| CPC | Strict matches | Selected claims |
| --- | ---: | ---: |
| A | 0 | 78 |
| B | 0 | 147 |
| E | 0 | 15 |
| F | 2 | 71 |
| G | 3 | 131 |
| H | 6 | 96 |

## What changed

- Preserve parenthetical abbreviations inside exact noun spans, including their original punctuation. Resolve an abbreviated name only against an explicit source-defined alias; absent or ambiguous definitions do not receive a link. The checker and tree share this conservative alias rule.
- Split comma-coordinated clauses when a fresh subject/predicate or explicit action step begins. Keep inline relative clauses intact. This corrects ancestor node identities as well as the local claim structure.
- Retain partitive names such as a pair of end plates. Exclude dependency scaffolding from preamble terms while retaining the entire preamble source anchor.
- Carry explicit body claim references through the existing PatentClaim dependency shape and attach the edge to its actual source element. Add an entity-level further-limitation dependency only for a directly referenced parent, an exact subject name and a proper introduction; abbreviation/modified-name links alone do not invent it.
- Link bare dependent subjects and a unique inherited shortened subject. A unique earlier structural mention can be linked without treating a definite or bare mention as a legally valid introduction; the legal checker still reports its missing/unsupported basis.
- Treat the explicit following-steps frame as organization, keep the steps as root-level source elements, retain compound assembly nouns and prenominal adverbial modifiers, and keep by-means-of / side-by-side idioms in functional connecting text.

Ten new synthetic regressions exercise these behaviours, including ambiguity, absent aliases, reference numerals, relative clauses, inherited subjects, exact element locations and legal-warning preservation. Original synthetic fixtures and their policy expectations remain intact through their explicit legacy test projection; the 538-claim evaluator receives the complete unprojected current trees. No patent/family ids or expected-tree contents are embedded in production rules.

## Complete matches

| Family | Claim | Matched nodes | Matched edges |
| --- | ---: | ---: | ---: |
| 15958729-root-1 | 3 | 2 | 5 |
| 15958729-root-1 | 5 | 2 | 5 |
| 13275397-root-1 | 6 | 2 | 7 |
| 13062032-root-1 | 3 | 2 | 5 |
| 13062032-root-1 | 11 | 2 | 7 |
| 13070851-root-1 | 1 | 3 | 6 |
| 13070851-root-1 | 7 | 2 | 5 |
| 18547866-root-1 | 20 | 2 | 4 |
| 13822885-root-1 | 5 | 2 | 5 |
| 13822885-root-1 | 9 | 2 | 6 |
| 13822885-root-1 | 14 | 2 | 4 |

The complete independent claim is `13070851-root-1`, claim 1: all three elements and six typed edges match, including all ordered terms and functional parts. Strict structural recovery does not mean that its four advisory findings are legally adjudicated.

## What remains unresolved

The result remains poor: 469 selected claims are structurally unequal and 58 remain normalization failures. Broader source segmentation, element-kind decisions, coordinated/bare phrase interpretation and context-sensitive dependency resolution still differ. No successful claim is substituted for a failed family and no near match is counted as a complete match.

Some nearest cases differ by only one body dependency edge, with differing reference conventions: `13062032-root-1` claims 4 and 5 omit a body dependency on their directly modified leading-body introduction, while `13275397-root-1` claim 5 requires a dependency through the bottom-cap phrase rather than its first subject. `16628033-root-1` labels pure includes clauses as limitations, whereas other families label comparable composition clauses as functional relations. These are unresolved interpretation/convention questions; this report does not certify the references wrong. The code is not changed with per-case exceptions to manufacture agreement, and the labels remain frozen.

[Twenty nearest remaining diagnostics](2026-10-28-closest-remaining.json) retain exact source text, reference/prediction trees, owner-node identities and reference hashes. The ranking is a post-result symmetric-difference proxy for inspection, not a replacement metric or a new selected denominator. All mismatches still count in the primary score.

## Verification and reproduction

The final source passes full package verification for domain (audit 9.7s / docgen 9.5s), use-cases (audit 7.8s / docgen 8.4s), and server (audit 34.9s / docgen 10.4s). The focused domain suite passes 67 tests. The scorer and full-corpus reference/self-comparison controls are unchanged. Original and previous results, all 60 reference families and the PatentClaim model are checked byte-for-byte against their retained commits; source anchors are verified against the exact UTF-16 claim text.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v6-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-v6-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-v6-reproduction/results.json
```

- [Original 0/538](2026-10-28-positive-evaluation.md)
- [Previous repair comparison](2026-10-28-repair-comparison.md)
- [Committed 10-match checkpoint](2026-10-28-repair-v5-checkpoint.md)
- [Final per-claim results](2026-10-28-repair-v6-evaluation.json)
- [Final grouped metrics](2026-10-28-repair-v6-summary.json)
- [Final implementation freeze](../research/implementation-repair-v6-freeze.json)
- [Version and prediction receipts](2026-10-28-closest-comparison-receipt.json)
