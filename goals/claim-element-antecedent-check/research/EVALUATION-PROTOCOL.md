# Structural evaluation protocol

Version: strict-source-map/v1. No positive benchmark predictions have been run yet. Actual attorney agreement remains pending; any measurement against this reference baseline is provisional.

## Fixed scope

`reference-freeze.json` pins every expected tree and canonical claim file before predictions. The primary end-to-end denominator is all 538 selected claims from the 60 source-qualified families. The 21 claims in three convention-held families remain explicitly identified, including in any provisional result. The 517 current-convention agent-accepted claims may be shown separately as a diagnostic; they never replace the full denominator. Input normalization failures, missing prediction trees and undecomposed claims remain selected failures and are reported by stage.

## One source-node mapping

For this fixed corpus, every reference node has a unique tuple `(claim number, element kind, exact start offset, exact end offset, exact quote)`. Every reference edge endpoint is present in its supplied family. These properties were checked across all 60 current reference families before prediction. The evaluator checks uniqueness on both sides and reference closure at runtime. A violated precondition raises a typed measurement error; it does not choose a convenient per-edge mapping or silently omit the family. A general isomorphism implementation is required if the declared unique-span precondition does not hold for actual predictions.

The tuple determines one family-wide node alignment. Ordinal path spelling and producer metadata do not contribute to accuracy. Under that alignment, a selected claim matches only when its complete element set, exact source anchors, ordered terms (anchors, determiners and lexical heads), and typed directed edge multiset are equal. Functional term/text part order and every connecting-text anchor remain exact. Edge array order is immaterial; duplicate edges retain multiplicity. Cross-claim endpoints include the introducing claim's identity, so identical quotes and offsets in different claims cannot substitute for one another. Reference content is never shortened or normalized to improve recovery.

The primary score is strict equality per selected claim, overall and in declared rule/coverage groupings. Typed-edge matched/reference/predicted counts support diagnostic precision, recall and F1 only. Edge recovery cannot make a structurally unequal claim pass. No overlap or IoU threshold participates in the primary score.

## Declared reporting groups

Report primary strict recovery overall, per CPC stratum, and in overlapping gold determiner groups `a`, `an`, `the`, `said`, `at-least-one`, `plurality-of`, `bare`, plus the presence of nested or functional elements. For checker-rule reporting, use all frozen P2 rule ids: `unsupported-determiner`, `definite-without-introduction`, `multiple-introductions`, `determiner-number-mismatch`, `ordinal-variants`, `outside-chain`, `tree-without-claim`, `chain-through-undecomposed`, `chain-unresolvable`, `chain-work-limit`. Show strict recovery among selected claims where each rule fires, explicitly labelled overlapping rule-activation strata. Include zero-activation groups with their zero denominator. These conditional diagnostics are not rule-level finding correctness; correctness requires adjudication. Input failures and no-finding claims remain in the overall denominator and receive their own coverage rows.

## Scorer verification

The checked-in scorer and synthetic regression tests are under `packages/law-practice/server/test/evaluation/Structural.ts` and `test/ClaimElement.structural-evaluation.test.ts`. Tests cover producer/path renaming invariance, lexical-head changes, exact span shifts, removed typed edges, missing predictions, cross-claim donor identity, ordered functional parts, and rejection of ambiguous node identities. Synthetic fixtures are not corpus annotations and supply no attorney agreement.

The remaining evaluation runner must replay the exact frozen native XML through the actual USPTO adapter and ClaimSelfCheck implementation, check input/version hashes before execution, retain every selected result or stage failure, and disclose provisional references. Source fetching reliability is separate from this offline replay. Allowed-claim false-positive estimates require an independently declared probability sample and actual adjudication; raw findings or allowed status alone are not an adjudicated rate. The non-US IPRally sample remains a separate non-gold smoke test.
