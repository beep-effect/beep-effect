# Repair and unchanged-reference comparison — 2026-10-28

**The requested gaps are addressed in the deterministic implementation, but complete strict recovery remains 0/538.** Input coverage and diagnostic edge recovery improve substantially. The original result, all reference annotations and the scorer remain unchanged. This is a development-set comparison after inspecting the first result, not independent validation.

## Comparison

All runs retain 60 families / 538 selected claims and 6,910 reference edges. Original actual attorney agreement is still absent; the same 21 convention-held claims stay in the primary denominator.

| Run | Strict matches | Input failures | Undecomposed | Structural mismatch | Matched edges | Edge precision | Edge recall | Edge F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original | 0/538 | 186 | 8 | 344 | 240 | 15.95% | 3.47% | 5.70% |
| Repair v2 | 0/538 | 58 | 0 | 480 | 1170 | 30.52% | 16.93% | 21.78% |
| Repair v3 | 0/538 | 58 | 0 | 480 | 1191 | 29.96% | 17.24% | 21.88% |
| Final v4 | 0/538 | 58 | 0 | 480 | 1191 | 29.96% | 17.24% | 21.88% |

Original normalization reached 40 families; final normalization reaches 55. The final implementation produces 480 selected trees, up from 344. All eight previously undecomposed selected claims now produce trees. Strict equality still requires every element kind, phrase, exact span, functional part and typed edge to match, so these gains do not produce any whole-claim matches.

The first repair emits 810 functional edges and 1,018 cross-claim antecedent edges among selected claims. The final repair retains 810 functional edges and emits 1,132 cross-claim antecedent edges. Those counts describe implementation coverage, not verified correctness; the exact edge metric above is stricter. V3 aligns lexical linking and dependent subjects; V4 only corrects an internal helper documentation import. V3 and V4 have identical per-family results. All intermediate metrics and source hash lists are retained.

## Changes and regression evidence

- Functional-relation elements now emit ordered term references and exact connecting source spans. A synthetic regression asserts the full list of parts and reconstructs the relation byte-for-byte.
- Noun phrases no longer have a five-token cap. Participial names such as detecting units and scanning conditions remain intact; explicit bare mentions are retained. Predicate/context heuristics still delimit phrases, so this remains a limited deterministic grammar rather than complete syntactic understanding.
- Antecedent edges can resolve into dependency ancestors. Alternative dependency routes use common ancestry, so an introduction on only one alternative is not silently asserted for every route. Exact matches take priority; a unique one-modifier introduction uses the same shared rule as the antecedent policy. Ambiguous matches are withheld. Repeated dependent-preamble subjects can link to their inherited subject even when phrased with an indefinite article.
- Source transition aliases include characterized/characterised in that, characterized by the fact that, where/in which, comprises and includes. They map to existing canonical transition values while preserving original claim text and the PatentClaim shape. The decomposer locates the body in the original text and validates the intervening transition surface, avoiding the uppercase Wherein failure. Fabricated transition gaps still fail.
- The evaluation runner accepts a separate implementation-freeze path and refuses to overwrite an existing result directory. Default behaviour still selects the original freeze; reproducing the repair requires the explicit final freeze below.

Seven new synthetic regressions cover long/participial names, exact functional parts, ancestor-versus-unrelated introductions, alternative dependency safety, source transition variants, dependent subject/one-modifier links and ambiguous alternatives, and malformed self-dependencies/fabricated transitions. The original synthetic rule fixtures are unchanged; exact assertions remain on their legacy projection, with new structure checked separately. The immutable public first-slice fixture is retained as an exact anchor/term/edge subset test. These compatibility views are test-only and **never** used by the 538-claim evaluator.

## Remaining limitations

Five families still fail full-set normalization, retaining 58 selected failures:

| Family | Reason |
| --- | --- |
| 11670278-root-61 | Claim 00066 contains an invalid parent-claim reference. |
| 18643465-root-1 | Claim 00009 contains an invalid parent-claim reference. |
| 12451999-root-15 | Claim 00014 must have a positive number and a supported transition phrase. |
| 14659462-root-1 | Claim 00013 must have a positive number and a supported transition phrase. |
| 13846690-root-15 | Claim 00035 must have a positive number and a supported transition phrase. |

The remaining source cases include malformed parent references and phrasing that cannot be represented by the existing supported transition contract. Source text and dependencies were not repaired, and failed families were not filtered. The 480 successful selected claims still differ in some combination of semantic segmentation, element kind, noun-phrase interpretation and source-specific antecedent resolution. Bare mentions are retained structurally, but the checker still explicitly abstains on unsupported bare determiners.

No legal false-positive improvement is claimed: allowed-claim findings are not adjudicated, and actual attorney agreement/convention decisions remain pending. No schema change to PatentClaim, LLM decomposition, corpus-label mutation or runtime access to expected trees was added. No PR publication or merge is part of this repair. The broader goal remains incomplete.

## Verification and reproduction

Final package verification passed for domain (audit 10.9s / docgen 12.1s), use-cases (audit 13.3s / docgen 13.7s), and server (audit 43.0s / docgen 13.8s). Checks include the new regressions, original rule-policy expectations, the public adapter/review integration and the unchanged strict scorer/reference controls.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v4-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-repair-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-repair-reproduction/results.json
```

To reproduce the original implementation, use its retained commit `8ee7429e2f` and original freeze/runner; do not substitute the revised source into that historical freeze.

- [Original result](2026-10-28-positive-evaluation.md)
- [Final per-claim results](2026-10-28-repair-v4-evaluation.json)
- [Final grouped metrics](2026-10-28-repair-v4-summary.json)
- [Comparison and prediction-hash receipt](2026-10-28-repair-comparison-receipt.json)
- [Final implementation freeze](../research/implementation-repair-v4-freeze.json)
