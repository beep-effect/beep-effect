# Allowed-claim replay and pending adjudication — 2026-10-31

The current v12 implementation checks **188/200 frozen allowed sets**, covering **2,951/3,184 source claims**. Twelve sets / 233 claims fail normalization and remain explicit unknowns. No source is repaired or replaced. The positive benchmark implementation is unchanged: its retained result remains 31/538 with every previous 29 passing claim retained.

**There is no adjudicated false-positive estimate or interval.** The replay emits 20,807 unreviewed advisory findings. Allowed status does not prove antecedent correctness; raw finding counts are not false positives. This report supplies current implementation coverage and a version-bound path to actual attorney adjudication.

## Coverage and raw output

| Measure | Earlier retained coverage | v12 |
| --- | ---: | ---: |
| Selected sets | 200 | 200 |
| Source claims | 3,184 | 3,184 |
| Checked sets | 180 | 188 |
| Checked claims | 2,841 | 2,951 |
| Input-failed sets | 20 | 12 |
| Input-failed source claims | 343 | 233 |
| Undecomposed checked claims | 0 | 0 |
| Raw advisory findings | 8,147 | 20,807 |

The earlier receipt predates the structural repairs. Increased findings accompany expanded checking and changed decomposition/rules; they do not establish increased or decreased legal correctness. Earlier source/coverage/results remain untouched. Current counts by kind:

| Finding kind | Count |
| --- | ---: |
| Pattern not covered | 14,553 |
| Missing antecedent | 5,120 |
| Ambiguous antecedent | 628 |
| Antecedent outside dependency chain | 290 |
| Number mismatch | 216 |

All 200 native XML hashes and all 20 implementation file hashes are checked before any prediction. The replay uses the real USPTO driver, server adapter and ClaimSelfCheck with closed offline HTTP responses and explicit synthetic metadata aliases. It needs no credentials and makes no live-download claim. All selected failures remain in the source denominator. The new runner refuses an existing output directory.

## Review sample declared before this replay

[The sampling freeze](../research/allowed-adjudication-v1-freeze.json) declares a simple random sample without replacement of 30 claims from the complete 3,184-claim frame. A recorded random seed drives SHA-256 priorities. Selection does not depend on predictions, finding counts, success or legal judgment. The fixed source cohort itself is CPC-stratified; the claim review sample is a simple random sample within that fixed cohort, not an estimate of all-USPTO prevalence. It has no E claim by chance; no replacement or quota adjustment is made after seeing that outcome.

The estimand is the fraction of this fixed allowed cohort receiving at least one erroneous emitted advisory finding. It includes coverage statements as statements to be judged, not as automatic legal defects. It is distinct from finding-level precision or specificity conditional on independently established clean claims.

The selected sample contains 28 checked claims and two input failures. Its review packet contains all 103 emitted findings and five no-finding confirmations (108 questions). All verdicts start blank. The two failed claims have no substituted clean output and cannot be adjudicated as zero. Even after all readable claims are reviewed, those two unknown outcomes prevent a complete-sample point estimate unless coverage is resolved under an explicitly versioned implementation/replay. Missingness is never removed through a resolved-only denominator.

The planned interval is a 95% Wilson binomial approximation to claim-level simple random sampling without replacement (30/3,184; no finite-population correction). It is conditional on all sampled outcomes being ascertainable and adjudicated. A 30-claim review cannot provide the precision of adjudicating the entire cohort. Until then, summaries expose pending counts and identification bounds rather than a fabricated point estimate or confidence interval.

## Actual attorney workflow

Open [the self-contained review interface](allowed-review-v1/index.html). It shows source claims, full claim-set context, exact referring quotes, rules, dependency chains and candidate spans. Choose right, wrong or uncertain; wrong/uncertain judgments require a reason. A no-finding confirmation concerns the recorded output, not an assertion that the claim is legally clean. Answers remain in browser-local storage scoped to the packet digest. Export downloads a version-bound JSON file and sends nothing to a server.

This review shares the SPEC's **at-most-two-hour attorney budget** with the original reference spot-check and convention questions. Stop at the remaining budget and export partial answers; incomplete adjudication stays pending. No agent fills attorney judgments or treats an interface preview as acceptance. Existing positive-reference review packets remain unchanged.

The read-only summarizer accepts a real export only against its matching packet:

```sh
python3 goals/claim-element-antecedent-check/research/summarize-allowed-verdicts.py \
  goals/claim-element-antecedent-check/history/allowed-review-v1/packet.json \
  actual-attorney-export.json
```

It verifies packet content digest and export version bindings, rejects duplicate/unknown verdict ids and incomplete exports falsely marked complete, and requires reasons for wrong/uncertain answers. Uncertain, missing, failed and undecomposed claims do not become clean observations. A confirmed erroneous finding establishes a positive claim outcome even if another finding remains uncertain. Otherwise every relevant finding must be reviewed right to establish no erroneous emitted finding. Identification bounds are explicitly distinct from confidence intervals.

Five synthetic boundary tests prove missing/partial/uncertain handling, nonzero interval uncertainty after an all-right synthetic sample, and rejection controls. They are synthetic tests, not human verdicts.

## Same non-US sample, current implementation

The same pinned IPRally sample KR-100380121-B1 (KR / F15 / 523 tokens) returns one claim, one tree, 78 unreviewed findings, zero undecomposed claims and 16 pattern-not-covered findings under v12. [The new receipt](2026-10-31-iprally-v12-smoke.json) retains implementation/input hashes and the original pinned source identity. The earlier 61-finding result remains intact. This is explicitly non-US, non-gold coverage evidence; no teacher-graph conversion, training or structural accuracy claim is made. Raw external data remains outside the repository.

## Verification and reproduction

Full server package verification passes: audit 45.5s, docgen 23.0s. The new runner passes server source/test type checks and formatter/lint checks. Actual negative executions reject a bad implementation hash before creating output and reject overwriting an existing run. All original positive/reference/source freezes and historical results remain intact. The runtime files in the v12 implementation freeze remain unchanged, so the 31/538 positive measurement is still bound to current implementation.

```sh
CLAIM_IMPLEMENTATION_FREEZE=goals/claim-element-antecedent-check/research/implementation-repair-v12-freeze.json \
CLAIM_ALLOWED_OUTPUT=.beep/allowed-v12-reproduction \
  bun packages/law-practice/server/test/evaluation/allowed.main.ts
python3 goals/claim-element-antecedent-check/research/test-allowed-verdicts.py
```

Choose a fresh output directory. [Public results](2026-10-31-allowed-v12-results.json) preserve the full result as formatted JSON; the review packet binds the raw replay's byte hash. The [receipt](2026-10-31-allowed-v12-receipt.json) records both serializations and confirms semantic equality, along with all prediction hashes. Raw predictions are retained in the private local evaluation cache; sampled claims/findings/context are included in the public review packet.

## Completion audit

| Requirement | Current evidence and limit |
| --- | --- |
| P0 schema and P1 contracts | Existing merged contracts and current passing package checks; no PatentClaim shape change in this continuation. |
| Deterministic implementation / first slice / USPTO adapter | Implemented and exercised through fixed positive and allowed offline adapter replays; offline evidence does not claim current live ODP access. |
| About 60 labelled families | All 60 / 538 reference/source hashes remain fixed; 57 families / 517 claims have agent acceptance, three families / 21 claims retain human convention questions. |
| About 10% attorney spot-check agreement | Original six-family / 50-claim packet retained; no accepted actual human agreement receipt exists in this packet. Incomplete. |
| About 200 allowed sets | All 200 sets / 3,184 native source claims retained. Current coverage and failures now version-bound. |
| Read-only claim-finding review tool and verdict projection | Existing implementation/integration tests remain covered by full passing server verification. |
| Strict structural evaluation | Retained v12 score 31/538, all baseline 29 retained; remains poor and development-set based. |
| Adjudicated allowed false-positive interval | New probability sample/review/import machinery prepared; no actual human verdicts, point estimate or interval. Incomplete. |
| Non-US IPRally smoke | Same sample rerun under current implementation; explicitly non-gold. |
| Advisory-only / scope exclusions | No production policy, PatentClaim model, gate, MCP write tool, LLM decomposer, training or external-data adapter added. |
| Yeet mergeable PR / closeout reflection | Not performed in this worktree continuation; acceptance prerequisites remain incomplete. |

The broader goal remains active and incomplete. Human adjudication is a genuine acceptance requirement, while further deterministic/source-coverage work remains possible independently. This progress does not justify marking the goal complete or blocked.
