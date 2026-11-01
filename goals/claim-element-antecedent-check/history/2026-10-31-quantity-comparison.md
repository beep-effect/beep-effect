# Quantity and predicate-context repair with 31-claim retention

Date: 2026-10-31

**Strict recovery is 34/538 (6.32%), retaining all 31 baseline complete matches.** Three new complete matches are gained and none is lost. The same 60 families, 538 selected claims, 6,910 reference edges and strict scorer are used. All reference labels, previous results and human review packets remain intact. This is development-set remediation after inspection, not independent validation or actual attorney acceptance.

The user explicitly authorized further worktree repairs while attorney review is unavailable. That authorizes this bounded structural repair and rerun; it does not supply the human evidence missing from the broader goal.

## Same-evaluation comparison

| Metric | Baseline v13 | New v14 |
| --- | ---: | ---: |
| Exact claim structures | 31/538 | 34/538 |
| Baseline passes retained | 31/31 | 31/31 |
| Structural mismatches | 449 | 446 |
| Input failures | 58 | 58 |
| Selected undecomposed claims | 0 | 0 |
| Exact matched edges | 1,805 | 1,824 |
| Predicted edges | 5,408 | 5,422 |
| Edge precision | 33.3765% | 33.6407% |
| Edge recall | 26.1216% | 26.3965% |
| Edge F1 | 29.3067% | 29.5816% |

[The paired gate](2026-10-31-v14-retention.json) lists every retained claim, three gains and an empty lost set. All historical complete-match sets are subsets of the final v14 set, including the earlier 21- and 29-claim baselines. The original 0/538 and every intermediate measurement remain unchanged.

## Nearest recurring gaps repaired

Several nearest one-edge mismatches still concern unresolved body-level dependency conventions. This wave does not add patent-specific exceptions, change those labels or resolve the attorney-held questions. The next clear grammatical gaps were:

- **Predicate forms and entity boundaries.** Include/incorporate and their finite forms now use the existing context-sensitive predicate handling. Both final-s and final-es alternatives are checked against the small explicit verb set, avoiding the earlier loss of include's final e. Determiner-led names and nominal-compound safeguards remain in force.
- **Responsive to.** Responsive followed by to is connecting predicate text rather than the tail of an entity name. A responsive panel remains a nominal phrase.
- **Passive purpose context.** A participle following be and preceding for remains connecting text, as in allowed to be embedded for each packet type. A source modifier embedded inside an entity name remains part of that entity.
- **Explicit number-of introductions.** A unique introduction such as a specified number of packets can resolve a later exact reference to the packets while retaining the full introductory source span and head. The tree and policy share this compatibility rule. It handles only the explicit number-of wrapper and a small set of source quantity modifiers; it does not erase substantive grouping nouns, guess among multiple introductions or silently equate singular and plural heads.

Three new synthetic tests exercise interacting grammar, exact introductory spans, shared tree/policy resolution, ambiguous quantity introductions and nominal/grouping controls. The focused domain suite passes **94 tests**. No family ids or expected structures are consulted by production rules. PatentClaim, its normalizer, the structural scorer and evaluation runner are unchanged.

## Newly exact claims

| Family | Claim | Repaired blocking gaps |
| --- | ---: | --- |
| 12749812-root-1 | 3 | Responsive-to phrase boundary and reference to a specified number of embedded flits. |
| 12749812-root-1 | 5 | Include was absorbed into the settings head; embedded in passive purpose text became a spurious entity. |
| 12749812-root-1 | 10 | Responsive-to phrase boundary and the same explicit quantity-introduction reference pattern. |

The three complete gains occur in one family; the production changes are source-grammar rules and diagnostic edge gains are measured across the full unchanged corpus. No broader generalization claim is made from those three cases.

## Preservation and verification

- All 217 historical evidence/freeze/scorer/model files checked against baseline bede3a848d remain byte-identical. Every family annotation, canonical claim and extractor/critic receipt matches the original 240 reference hashes; all 60 native XML hashes verify.
- The same 20 runtime paths are frozen before prediction. The [v14 implementation freeze](../research/implementation-repair-v14-freeze.json) and [comparison receipt](2026-10-31-quantity-receipt.json) bind the current source, raw result and all 55 successful family prediction files. The public formatted result is semantically equal to the raw replay.
- All 31 v13 strict matches remain strict; every earlier historical passing set is retained. No failure or mismatch is omitted from the denominator.
- 70,954 prediction-anchor occurrences, including functional parts and finding references, match exact UTF-16 source slices.
- Full package verification passes for domain (audit 18.6s / docgen 24.4s), use-cases (18.5s / 23.3s), and server (79.0s / 24.3s). The focused 94-test domain run passes.

## Remaining limits and review version boundary

**446 structural mismatches and 58 input failures remain.** The [twenty nearest remaining diagnostics](2026-10-31-quantity-remaining.json) preserve source text, exact reference/prediction trees, complete family owner identities and held-question status. Their post-result ranking is only an inspection aid; no case is waived and no alternate denominator is used. Remaining cases include element-kind/owner mismatches, nested/overlapping clauses, enumeration boundaries, contextual references and unresolved dependency conventions.

Attorney review remains unavailable. No human verdict or adjudicated false-positive estimate is claimed. The existing allowed results and 30-claim attorney packet remain **v13 evidence**, preserved unchanged; this task reruns the requested positive structural evaluation only. V13 allowed findings or future v13 judgments must not be presented as v14 accuracy. Any current-implementation allowed measurement/adjudication requires its own version-bound replay and review handling. The prior 50-claim reference agreement and convention questions likewise remain pending.

Nothing is pushed, published or merged. The broader goal remains incomplete; this requested worktree repair is saved independently of the actual-human acceptance hold.

## Reproduction

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v14-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-v14-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-v14-reproduction/results.json
```

Choose a new output directory; never overwrite a previous run.

- [Baseline 31/538 and coverage repair](2026-10-31-implicit-dependent-comparison.md)
- [Original 0/538](2026-10-28-positive-evaluation.md)
- [V14 per-claim results](2026-10-31-repair-v14-evaluation.json)
- [V14 grouped metrics](2026-10-31-repair-v14-summary.json)
