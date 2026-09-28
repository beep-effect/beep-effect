# CLI predicate assertion migration

The batch replaces 190 `expect(Exit|Result.isFailure|isSuccess(subject)).toBe(true)`
assertions in 49 CLI test files with `assertTrue` over the identical predicate.
Import provenance and shadowing were checked before preparing the edits. Test
subjects, predicate polarity, registrations, retry budgets and timeouts are
preserved. The preparation receipt proves that unrelated non-import text was
unchanged before formatting.

Both runtimes pass the same 1,509 file/title registrations before and after,
including multiplicities. There are no failed, skipped or pending tests. Every
run records stable CLI source hashes, runtime versions, load averages,
CPU/memory/IO pressure and resource limits.

| Runtime | Before seconds | After seconds | Tests before / after |
| --- | ---: | ---: | ---: |
| Node | 250.8781 | 254.6525 | 1509 / 1509 |
| Bun | 149.6554 | 170.9251 | 1509 / 1509 |

These are whole-command observations, without a numerical correction for load
or a causal performance claim. Full CLI package verification ran concurrently
with the after measurements. The baseline context's inherited concurrency
label is stale: the earlier full Yeet proof was already terminal when these
repaired before measurements ran; the captured pressure/load values are the
measurement evidence.

The initial, unrepaired Node baseline had 1,508 passes and a 30-second timeout
in the AI metrics forwarder test. Its report remains preserved. An isolated
rerun passed, which does not establish a cause. A separate deterministic
control reproduced the native OTLP polling helper's virtual-clock stall.
The helper now uses `TestClock.withLive` for native HTTP arrival polling,
retaining its existing 200 retries and 25-millisecond delay. The entire AI
metrics file passed all 45 tests on Node and Bun before the fresh comparison.
This proves the polling repair and the repaired comparison; it does not
conclusively attribute the original forwarder timeout.

The detector reports 4,489 current findings, zero introduced and 525 resolved
historical findings. This batch removed 180 detected assertion findings; the
190 source replacements also include predicates not separately classified by
the detector. The first ratchet run flagged 100 changed statement identities.
Running the actual detector on HEAD and the changed source matched every one
to an existing finding and preserved every non-EV006 file/rule/class/symbol
group's count and traversal order. Only those 100 occurrence hashes and four
associated evidence excerpts were updated in the historical baseline. No
finding status was changed or exception added by that reconciliation.

Private receipts: `cli-predicate-batch-proposal.json`,
`cli-predicate-batch-parity.json`, `cli-predicate-batch-anchor-review.json`,
`cli-predicate-batch-before-clock-repaired-{node,bun}` and
`cli-predicate-batch-after-{node,bun}` reports and context files,
`cli-predicate-batch-ratchet-final.log`, and the preserved original failed
baseline and ratchet logs. Full CLI package verification passed: audit 672.9 seconds and docgen 19.8
seconds. These results do not establish final repository proof or goal completion.


After saving the batch in `8140304195`, main commit `980b4cd44c` merged without
conflicts. The overlapping `quality-tasks.test.ts` suite passes all 254 tests
under Node (11.26 seconds) and Bun (7.10 seconds). The post-merge ratchet still
reports 4,489 findings, zero introduced and 525 resolved. These focused checks
supplement the pre-merge package proof; final merged-branch proof remains open.

The historical CLI detector ledger closes 162 exact matches using file, rule,
occurrence, evidence and duplicate ordinal, citing the batch commit. Eighteen
other removed current findings lack an exact historical match and remain for
explicit reconciliation. All 3,421 ledger rows retain unique IDs and pass the
strict finding schema.
