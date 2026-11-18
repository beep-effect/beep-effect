---
title: "SCHE-06 live port behind default-off backfill and fairness gates; journal A/B finds no tail-wait gain on today's uniform workload"
date: 2026-11-18
lane: "t3/local-proof-backfill-self-may-attempt"
reversal: "Leave both protocol keys off (the default) or run `quality scheduler protocol --backfill off --fairness off`; delete the SCHE-06 section of QualityScheduler.ts and QualityScheduler.schemas.ts and the gated branch of selfMayAttempt to remove the code."
---

Slice 12 ports the slice 11 verdict into the live scheduler and measures it on the recorded admission journal. Recommendation: keep both gates off. On the recorded workload backfill never fires, and fairness alone lengthens the tail.

**The port.** The SCHE-06 section of `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` (`admissionAttemptVerdict`, `admissionBackfillOrder`, `admissionConditionalDeadline`) is `attemptVerdict`, the protected order, the projected head start and the conditional bound, written against the live ticket and lease records. The schemas (`AdmissionBackfillPolicy`, `AdmissionBackfillView`, `AdmissionAttemptVerdict`, the two mode kits) are in `QualityScheduler.schemas.ts`. The port lives in existing files on purpose: a new module in the repo-run closure changes the policy-tools fingerprint, whose regeneration rewrites `turbo.json`, which this lane may not touch during window 5. The lab model and the port are deliberately mirrored, so `Policy.ts` and `JournalReplay.ts` in the lab carry a file-level `fallow-ignore-file code-duplication` with an exit: import the live verdict once a shared scheduler-policy module exists that both packages depend on. `selfMayAttempt` calls the verdict only while the admission protocol's new `backfill` (`off | easy`) or `fairness` (`off | origin-checkout`) key is on. Both keys are additive and default `off`, like `units` and `pressure`. With both off, the scheduler runs its deployed loop unchanged. The verdict runs after the deployed skippable checks (same-checkout lease, legacy origin owner, origin stamp, review-fix class cap): a skippable ticket leaves the line before the verdict reads it. The QualityScheduler contract gains `setBackfillProtocol` and `setFairnessProtocol`, and `quality scheduler protocol` gains `--backfill` and `--fairness`.

Under `easy`:
- A new ticket declares `etaMillis`: the p90 of its kind's last 200 recorded holds, once five exist. Its lease copies the value.
- When the ticket has waited 120 s, its owner stamps `deadlineMillis` on it in the next heartbeat rewrite.

Under `origin-checkout`, each scan folds the journal history into the released intervals of the last 30 minutes. With both gates off, no ticket, lease or journal row changes by a byte. The existing origin/main byte fixtures pass unchanged.

**Mixed revisions.** An older checkout ignores the new keys. It keeps the head-of-line rule and the overshoot rollback, so capacity holds whatever mix of revisions is running. Only checkouts at this revision or later can backfill or reorder.

**Fidelity to the model.** `test/quality-scheduler-backfill.test.ts` has 14 cases:
- the verdict's routes and wait reasons;
- the head start projected across several leases;
- backfill in queue order, never shortest-job-first;
- a breached bound disables backfill;
- protected order and fairness order;
- the bound's arithmetic;
- the journal-derived ETA and fairness intervals;
- 400 seeded queues on which the gated rule with both modes off equals the deployed rule for every contender;
- gate independence, ETA declaration only under the gate, and the 125 s bound stamped once on a waiting ticket under TestClock.

The SCHE-06 section of `QualityScheduler.ts` and the lab's `JournalReplay.ts` are at 100% line, branch and function coverage.

**The A/B harness.** `apps/labs/ciops/src/backfill/JournalReplay.ts` and `scripts/backfill-ab.ts` replay a journal root (archive day segments, then the live file). The replay:
- joins each nonce's admitted and released rows into an arrival with its recorded enqueue instant, weight, priority, origin, checkout and true hold;
- declares a causal ETA from holds already released when the unit enqueued, so it never reads the future;
- runs each arm through the slice 11 simulator;
- prints counts and nearest-rank quantiles only.

`test/backfill-journal-replay.test.ts` shows the harness finds a gain when one exists. On a mixed stream (9-token hold, 10-token head, 1-token fix), EASY admits the fix by backfill and the maximum wait drops from 498 s to 199 s. On a uniform stream every arm is identical.

**Measured, workstation journal, 2026-11-09 to 2026-11-18 (202 h):** 377 complete chains; 4 nonces skipped (withdrawn or evicted); 371 declared an ETA. All but a handful are 3-token full proofs. The recorded waits were p50 53 ms, p90 5.4 s, p95 27.4 s, p99 181.6 s and max 433.9 s, with 12 over a minute.

| Capacity | Arm (backfill / fairness) | p95 | p99 | max | mean | over 1 min | backfills | breaches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | off / off | 0 | 24.8 s | 351.7 s | 1.3 s | 2 | 0 | 1 |
| 10 | easy / off, off / fair, easy / fair | identical to off / off | | | | | 0 | 1 |
| 8 | off / off | 43.2 s | 399.1 s | 536.0 s | 9.6 s | 16 | 0 | 0 |
| 8 | easy / off | identical to off / off | | | | | 0 | 0 |
| 8 | off / fair and easy / fair | 43.2 s | 415.3 s | 646.6 s | 10.4 s | 16 | 0 | 0 |
| 6 | off / off and easy / off | 70.4 s | 399.1 s | 536.0 s | 10.8 s | 19 | 0 | 0 |
| 6 | off / fair and easy / fair | 68.9 s | 415.3 s | 646.6 s | 11.6 s | 19 | 0 | 0 |
| 5 | every arm | 940.2 s | 2102.9 s | 2338.3 s | 132.6 to 132.8 s | 87 to 88 | 0 | 7 |

The pressure-stamped window since 2026-11-17T23:46:54Z holds only 12 chains. Their recorded maximum wait is 91 ms, and every arm matches at capacity 10, and at capacity 5 (max 16.8 s). That window is too short to rank the arms, so the full journal is the evidence.

**Reading.**
- *Backfill admitted zero units in every arm.* Backfill helps only a unit smaller than a blocked head, and this machine's heavy work is one 3-token kind: whenever the head is blocked, nothing behind it fits either.
- *Fairness reordered unprotected proofs* among the journal's 144 checkouts in two origins. It raised p99 by 4% and max by 21% at capacity 8 and 6, and it lowered p95 at capacity 6 by 2%. The tail cost outweighs that.
- *The constant-capacity replay is not the live machine.* At capacity 10 it predicts p99 24.8 s against 181.6 s recorded, because the live capacity follows MemAvailable, and the skippable checks and the review-fix cap sit outside the model. Arm-to-arm differences are the measurement; absolute values are not.

**Recommendation to the driver.** Leave both gates off. Re-run the A/B (`bun run scripts/backfill-ab.ts <admission-root>` in `apps/labs/ciops`) once SCHE-02 (slice 13) admits final-check gates per step and lane or package units mix weights on the queue. That is the workload backfill exists for. Turn `--backfill easy` on only if that run shows a lower p99 with zero breaches. Leave fairness off unless a run shows it does not lengthen the tail.
