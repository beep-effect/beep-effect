# Provisional deterministic recovery measurement — 2026-10-28

**Stop-at-measurement condition triggered. Strict recovery is 0/538 selected claims (0%).** The frozen deterministic implementation does not recover the independently annotated claim structures. GOAL.md and SPEC.md Appetite say to stop at the measurement when the floor is poor; no parser tuning, reference changes, scope expansion or production-readiness claim follows this run.

## What was measured

All 60 source-qualified USPTO families and all 538 selected claims were replayed. The runner verifies all 18 frozen P2 source hashes plus every selected XML, reference, canonical claim, extractor and critic receipt before predictions. The three freeze digests were independently recomputed and matched before execution. The real `@beep/uspto` driver, `UsptoClaimsLive` adapter and `ClaimSelfCheck.checkPublished` ran with a closed offline HTTP replay. Native claim XML is exact; metadata download URLs are explicit synthetic transport aliases, not live download evidence. For each successful family the adapter claim text matched the independently saved canonical claim text.

References remain provisional: actual attorney agreement is absent, and 21 claims in three convention-held families remain in the primary denominator. The separate 517 current-convention agent-accepted claims also recover 0/517. Neither annotation drafts nor this run establish legal correctness. Original pre-prediction freeze files are immutable historical records; their false prediction flags describe freeze time and are superseded for current execution status by the new run receipt.

## Primary results

| Stage | Selected claims |
| --- | ---: |
| Input normalization failed | 186 |
| No decomposition tree | 8 |
| Decomposed, structurally unequal | 344 |
| Strict structural equality | 0 |
| Total | 538 |

Twenty families failed full native claim-set normalization. Their selected claims remain failures; the runner did not filter canceled claims, repair unsupported dependency transitions, shorten text or substitute hand-normalized claims. This is offline input coverage, not an ODP authentication or fetching failure. Forty families reached the checker.

| CPC | Selected claims | Strict matches | Input failures | Undecomposed | Structural mismatch |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 78 | 0 | 50 | 0 | 28 |
| B | 147 | 0 | 73 | 0 | 74 |
| E | 15 | 0 | 0 | 0 | 15 |
| F | 71 | 0 | 29 | 0 | 42 |
| G | 131 | 0 | 17 | 0 | 114 |
| H | 96 | 0 | 17 | 8 | 71 |

## Declared overlapping groups

Every nonempty group has zero strict matches. A claim can belong to several groups; these counts must not be added to estimate corpus size.

| Gold determiner or feature | Selected claims | Strict matches |
| --- | ---: | ---: |
| a | 403 | 0 |
| an | 167 | 0 |
| at-least-one | 50 | 0 |
| bare | 343 | 0 |
| plurality-of | 24 | 0 |
| said | 150 | 0 |
| the | 524 | 0 |
| functional | 521 | 0 |
| nested | 538 | 0 |

| Checker rule activation | Selected claims | Strict matches |
| --- | ---: | ---: |
| chain-through-undecomposed | 0 | 0 |
| chain-unresolvable | 0 | 0 |
| chain-work-limit | 19 | 0 |
| definite-without-introduction | 284 | 0 |
| determiner-number-mismatch | 21 | 0 |
| multiple-introductions | 43 | 0 |
| ordinal-variants | 7 | 0 |
| outside-chain | 83 | 0 |
| tree-without-claim | 0 | 0 |
| unsupported-determiner | 24 | 0 |

No-finding processed claims: 40. Zero-activation groups have no measurable conditional rate. Rule activation describes where a rule fired; it is not a finding-correctness score.

## Diagnostic edge recovery and scorer controls

Typed directed edges: 240 matched / 6,910 reference / 1,505 predicted, giving precision 15.95%, recall 3.47%, F1 5.70%. These are diagnostics; they do not replace exact per-claim equality. Functional part ordering, lexical heads, determiners and exact spans remain required.

Eight scorer tests pass, including a full-corpus positive control: all 538 reference trees pass when compared against themselves. Other controls cover path/producer invariance, head/span changes, missing edges/predictions, cross-claim donor identity, ordered functional parts and ambiguous node identities. No runtime mapping precondition failed on this benchmark.

A concrete mismatch occurs in `12360911-root-1`, claim 1: both sides contain five elements, and the preamble term agrees exactly (`An X-ray CT apparatus` / `x-ray ct apparatus`), but only one complete node matches; 16 reference edges versus nine predicted edges have zero exact typed-edge matches. The failure is not a blanket inability to compare a reference to itself.

## Remaining evidence and limits

The 200 allowed sets / 3,184 source claims remain frozen; their previous coverage replay processed 180 sets / 2,841 claims and retained 20 failures / 343 claims. Its 8,147 raw findings are **not** an adjudicated false-positive rate. No attorney adjudication or interval is invented. The separate MIT IPRally non-US smoke ran one mechanical token reconstruction and produced one tree / 61 unreviewed findings; it provides coverage evidence only.

Actual attorney spot-check agreement, convention decisions, adjudicated false-positive interval, a mergeable Yeet PR, final closeout and reflection remain incomplete. This report invokes the explicit poor-floor stop condition; it does not declare the full goal complete. Any subsequent deterministic redesign or broader approach needs a new direction and a fresh held-out evaluation strategy.

## Reproduction and receipts

Run from the repository root with its installed dependencies:

```sh
CLAIM_EVALUATION_OUTPUT=.beep/positive-evaluation-reproduction \
  bun packages/law-practice/server/test/evaluation/positive.main.ts
python3 goals/claim-element-antecedent-check/research/summarize-positive.py \
  .beep/positive-evaluation-reproduction/results.json
```

[Per-claim results](2026-10-28-positive-evaluation.json), [grouped metrics](2026-10-28-positive-evaluation-summary.json), and [run receipt](2026-10-28-positive-run-receipt.json) preserve the versioned denominator and hashes. Prediction report hashes are in the receipt; the runner regenerates the reports. This is the first positive prediction run on this reference baseline.

Verification: runner typecheck passed; the focused scorer suite passed 8 tests. Final full law-practice-server package verification passed: audit (44.0 seconds) and docgen (15.7 seconds).
