# Implicit dependent limitations: coverage repair with full retention

**Allowed coverage improves from 2,951 to 3,108 of 3,184 source claims. All 30 claims in the fixed attorney review sample are now readable.** The same strict positive evaluation remains **31/538 (5.76%)**, retaining every baseline complete match with identical per-claim scores. All old results, labels, source selections, sampling selections and review packets remain intact.

This is development-set repair after inspecting v12 input failures. It is not independent validation or an adjudicated legal result. No human verdicts, false-positive estimate or confidence interval have been produced.

## Recurring source gap

Some dependent claims express a limitation directly after a comma, without an explicit transition word: for example, The fixture of claim 1, the support being formed as a cone. The previous normalizer rejected the entire claim set if any claim lacked a supported transition phrase.

The new fallback recognizes a comma only when:

- No supported explicit transition is present anywhere in that claim. Explicit transitions remain authoritative.
- The source immediately before the comma ends in a numbered parent-claim reference, including a comma-separated parent list.
- The following source begins with a supported determiner or operating and contains a supported predication such as being, is, are, operating, operative, corresponding or performing.

The comma records the logical dependent-limitation role in the existing canonical transition field as wherein. It does not insert wherein into the claim text. Preamble/body and all element/term anchors remain exact source substrings. The decomposer accepts the source comma only for a dependent claim whose canonical transition is wherein. The PatentClaim model/shape is unchanged. Independent clauses without a supported transition and non-predicative dependent fragments still fail explicitly. No family ids or expected structures participate in the rule.

Four new synthetic regressions cover exact source preservation, comma-separated parent references, explicit-transition precedence, and withholding unsupported independent/dependent fragments. The focused domain suite now passes 91 tests.

## Paired results

| Measure | Baseline v12 | New v13 |
| --- | ---: | ---: |
| Positive strict structures | 31/538 | 31/538 |
| Positive baseline passes retained | 31/31 | 31/31 |
| Positive input failures | 58 | 58 |
| Positive structural mismatches | 449 | 449 |
| Positive exact matched edges | 1,805 | 1,805 |
| Positive edge F1 | 29.3067% | 29.3067% |
| Allowed sets checked | 188/200 | 196/200 |
| Allowed source claims checked | 2,951/3,184 | 3,108/3,184 |
| Allowed input-failed claims | 233 | 76 |
| Allowed checked undecomposed claims | 0 | 0 |
| Raw unreviewed findings | 20,807 | 21,938 |
| Readable fixed review-sample claims | 28/30 | 30/30 |

[The paired retention gate](2026-10-31-v13-retention.json) has all 31 claims retained, no gains and no losses. Every positive per-family/per-claim score is identical between versions. All **188 previously successful allowed prediction reports are byte-identical**; the extra 1,131 findings come from the newly readable sets, not changed outputs for earlier successes. Raw findings are not false positives or accuracy evidence. Of the 21,938 current findings, 15,390 are pattern-not-covered statements.

Eight whole allowed sets are recovered:

| Patent | Source claims |
| --- | ---: |
| 12507761 | 22 |
| 12420230 | 20 |
| 12494574 | 15 |
| 12469187 | 26 |
| 12498959 | 18 |
| 12507313 | 20 |
| 12485779 | 16 |
| 12470072 | 20 |

The four remaining failed sets (76 claims) stay in the denominator: 12485985, 12485663, 12505205 and 12500909. They include product-by-process or storing-instructions independent phrasing, a parent reference followed by combination language before its comma, and further nonstandard dependent framing. These are not repaired by inventing a transition or excluding the source. Their exact failure messages are retained in [v13 allowed results](2026-10-31-allowed-v13-results.json).

## Review version 2: same claims, no unreadable sample outcomes

[The new blank packet](allowed-review-v2/index.html) retains precisely the same 30 sampled claim identities and initial random priorities. [Its v2 freeze](../research/allowed-adjudication-v2-freeze.json) binds the new implementation before v13 replay and discloses prior v12 error inspection. The new review has **111 findings and five no-finding confirmations**, with every answer blank. Original v1 packets, source/sample hashes, failures and any browser-local v1 answers remain independent and intact; no verdict is copied automatically across versions.

Use version 2 for current adjudication. The existing import tool rejects cross-version exports through the bundle, sample, result and implementation bindings. The interface now includes the shared two-hour attorney budget and exports filenames containing the bundle digest to distinguish versions. The builder accepts an explicit sample-freeze argument while preserving v1 as its default. The current packet reproduces from the frozen replay and current builder/template; no new random sample was drawn.

All 30 outcomes can now be reviewed without the previous two normalization unknowns. This removes an input-coverage obstacle to the planned interval; it does not supply the actual attorney judgments. Unanswered or uncertain claims remain unknown. Neither a point estimate nor interval may be calculated from a resolved-only subset. The original six-family positive-reference spot-check and convention decisions also remain pending actual attorney evidence. All review work shares the original at-most-two-hour human budget.

## Verification and retained evidence

Full package verification passes for domain (audit 16.5s / docgen 15.8s), use-cases (audit 14.2s / docgen 13.5s) and server (audit 59.5s / docgen 17.5s). Five synthetic review-boundary tests remain green. Full fixed positive and allowed replays verify the pinned inputs and implementation before prediction. All prior history artifacts and freezes are checked against retained commit 8cfcf0eb6e, all positive annotation/source hashes remain fixed, and source-anchor integrity is checked on current predictions. The new [receipt](2026-10-31-implicit-dependent-receipt.json) binds source, results, packet and prediction hashes.

The same non-US/non-gold smoke sample is also rerun under v13, returning one claim/tree, 78 unreviewed findings and 16 pattern-not-covered statements; [the receipt](2026-10-31-iprally-v13-smoke.json) preserves its identity and current implementation binding. No teacher-graph accuracy is claimed.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v13-freeze.json \
CLAIM_EVALUATION_OUTPUT=.beep/positive-v13-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v13-freeze.json \
CLAIM_ALLOWED_OUTPUT=.beep/allowed-v13-reproduction \
  bun packages/law-practice/server/test/evaluation/allowed.main.ts
python3 goals/claim-element-antecedent-check/research/build-allowed-review.py \
  .beep/allowed-v13-reproduction .beep/allowed-review-v2-reproduction \
  goals/claim-element-antecedent-check/research/allowed-adjudication-v2-freeze.json
```

Always use fresh output directories. Public formatted result files are semantically identical to their raw replay files; packet result hashes bind the retained raw replay. The receipt records both serializations. No existing measurement is overwritten.

The broader goal remains active and incomplete: actual human agreement/adjudication, the adjudicated interval, Yeet publication/readiness and final reflection/closeout remain absent. Nothing is pushed or merged in this worktree repair.
