# Post-merge measurement and retained closeout

PR [#2411](https://github.com/beep-effect/beep-effect/pull/2411) merged as `3057999b3345619629e00923d94a322c62cf8d06` at 2026-11-01 00:47:14 UTC. The designated orchestrator used repository S11, with pending checks recorded and the review window explicitly forced. All seven review threads are resolved. The [delivery audit](2026-11-01-post-merge-delivery.json) preserves the exception and actual job outcomes. This is merged delivery under an operator exception, **not an all-green hosted CI claim**. The old lane and monitor are retired.

The takeover repaired dependent claims where an eligible comma precedes a component's later lexical transition. That code change had not been measured under a new freeze. v24 now binds the exact current implementation on integrated main `7ae3f01401d20f7962a9d89bb2a5cbcd745ede34`; all 21 source files were archived and hash-verified before prediction. This closeout changes no parser or scorer code.

## Fixed-reference result

The unchanged 60-family, 538-claim evaluation returns **37/538 exact structures (6.8773%)**, retaining all 34 protected and all 37 v23 matches, with no gains or losses. There are 443 structural mismatches and 58 input failures. Typed-edge F1 is **30.0170%**, with 1,854 matching, 5,443 predicted and 6,910 reference edges; v23 was 30.0454%. The small decline is retained, not hidden by the unchanged primary score. The corrected nested feature contains 79 claims, with **zero exact matches**. Recovery remains poor; this is a development-set result, not held-out validation.

New [full result](2026-11-01-repair-v24-evaluation.json), [summary](2026-11-01-repair-v24-summary.json), [retained/lost gate](2026-11-01-v24-retention.json) and [implementation freeze](../research/implementation-repair-v24-freeze.json) sit beside all older versions. No baseline labels, selections or strict comparison rules changed. The prior incorrect nesting breakdown remains preserved, with the takeover's corrected derived summaries alongside it.

## Allowed cohort and historical review identity

The fixed allowed cohort retains 200 sets and 3,184 claims. v24 checks 196 sets and 3,108 claims, with 76 input-failed claims and no undecomposed checked claim; it emits **21,576 raw findings**, compared with v23's 21,533. Ten patent reports change. Three are represented in the original random 30-claim review sample.

Every one of the sample's **115 questions/findings is identical** to the historical automated review input. All source and dependency claim texts and all **605 reviewer evidence quotes** match exactly. Four unselected context claims have changed preamble/transition/body parsing, which is disclosed in the [identity receipt](2026-11-01-v24-review-identity.json); full patent report bytes are not claimed identical. The two original input-failed sample outcomes also match. The existing two independent reviewers' judgments therefore carry forward as historical source-bound judgments. No reviewer session, new v24 adjudication or attorney judgment is invented.

The sample remains 21 claims with an agreed erroneous alert, seven negatives and two unknowns. Identification bounds remain **70–76.7%**, with a conditional conservative 95% Wilson envelope of **52.1–88.2%**. These describe the fixed allowed cohort conditional on automated adjudication and do not cover correlated model error. They are neither legal conclusions nor general USPTO reliability estimates. Independent reference review still reports 33 agree, three revise, 14 uncertain and one unresolved convention; original labels remain unchanged.

The [current non-US/non-gold smoke](2026-11-01-iprally-v24-smoke.json) matches the prior result: one tree, 523 tokens, 78 unreviewed findings, 16 coverage warnings and no undecomposed claim. Licensed raw bytes remain outside the repository.

## Evidence repair and verification

A later unrelated PR (#2438, commit `4bcd7ff7bf`) reformatted the v11 result without changing JSON values. This closeout restores its original exact bytes from preserved commit `349e52733f`, recovering SHA-256 `8863be400e9ce9b5d29305fa3eecd3717b71b9bb9dfc8d9f771ed1c2be4682dd`. Formatter-only protection now covers frozen evaluation/result files; no lint rule is disabled. All **631 original reference/history pins match** after restoration. Every other old result stays unchanged. Raw v24 results, predictions and pre-prediction source snapshots have separate durable copies.

Current domain, use-cases and server package audit/docgen verifications pass. The read-only review mapper is unchanged from the earlier tested implementation; source-quoted advisory items, typed unchecked outcomes and response-budget controls remain covered by package tests. `PatentClaim` has no change from main, findings do not gate drafting/pipelines, and no LLM decomposition, training, retrieval, write MCP, Markush, §112(f), DOCX, shared promotion or IPRally adapter enters scope.

The [verification receipt](2026-11-01-v24-verification.json) records the new source and package proof. The [closeout reflection](reflections/2026-11-01-codex.md) records the evidence failures and lessons. Attorney attendance is optional under autonomous acceptance v1; both actual-attorney flags remain false. These artifacts prepare the bounded implementation-and-measurement closeout while retaining poor accuracy, noisy alerts, unresolved review questions and the explicit S11 delivery exception. Operative lifecycle remains active until the final follow-up has canonical readiness and merge proof; no all-green or goal-complete claim is made here.
