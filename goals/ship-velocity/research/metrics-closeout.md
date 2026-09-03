# Ship velocity metrics closeout

Date: 2026-08-30 · final cache refresh: 2026-09-02

This receipt separates implementation proof from the production outcomes required by the
initiative completion gate. The original protocol used seven elapsed days as a proxy for a
representative sample. On 2026-08-30 the operator accepted the observed event volume instead:
24 merged pull requests in the rolling 24 hours, 16 merges after the original #874 anchor, eight
pull requests both opened and merged after that anchor, and eight main-push Check runs after the
parity repair. This ruling removes the calendar wait; it does not waive an outcome condition or
relabel the sample as a seven-day interval. Operator PR #921 later and separately superseded A4
by removing the published-PR ownership lease, watcher, takeover, and mutation fence. The receipt
below preserves the earlier implementation evidence as history; it does not report that removed
takeover path as a current success.

## Closeout receipts

| Gate | Current evidence | Closeout state |
| --- | --- | --- |
| Attached-session backpressure p95 under 60 seconds | The watch stream polls every 10 seconds and synthetic first-red tests deliver on the observing tick. Two live optional Vercel P1 rows reached the inbox on their observing timestamp. No required hosted P0 red occurred in the sample, so no production percentile is fabricated. | Satisfied for the sampled event volume by the executable bound and live delivery receipts. |
| Dead-owner ownership state | Before #921, the watcher had a 30-second poll, a 240-second stale threshold, and a 270-second detection bound backed by focused takeover tests. PR #921 then intentionally removed the lease, watcher, automatic takeover, and mutation fence while retaining P0 inbox context and the hard Stop/SubagentStop gate. | Superseded by operator cleanup. Current main cannot be stranded behind the removed ownership lease; no automatic under-five-minute takeover is claimed. |
| Zero recurring locally catchable required-check failures | Eight main-push Check runs followed the #892 parity repair: seven passed and one failed on #869's isolated T7 capacity-preflight fixture mismatch. The PR-head coverage run and the next six main-push Check runs were green; `research/parity-ledger.md` retains the event as nonrecurring. | Satisfied for the sampled event volume; the failure remains recorded. |
| Every sibling checkout reads the remote cache | Digest-only comparison retracted the mirror-drift hypothesis: the infra-vault read-only item and SSM source matched, while the checkouts pointed at a different February item that predates the AWS cache. The helper's explicit replacement mode corrected or completed 27 ignored quads. The `2026-09-03T00:11:59Z` snapshot froze six live roots. Reference coverage was 6/6; five exact wrappers resolved and returned GET 200, while one was skipped because an unrelated non-cache reference in its `.env` names a missing field. A separately labelled TURBO-only canary in that root then resolved, returned GET 200, and observed 8/8 first-touch remote hits. In total, five roots observed 8/8 first-touch remote hits and one GET-200 root was authenticated-cold at 0/8 on a revision with a different lockfile hash. The old reference's pre-repair control was 403; no repaired root was `auth-failed`. `research/cache-proof.md` retains every summary path and count. | Satisfied by the 2026-09-02 repair and frozen sample under the authorized closeout rule: the main checkout is a remote hit, every in-scope root carries the canonical read-only reference, and no cache authentication failure remains. The exact-wrapper skip and successful narrow cache canary stay separate. |
| Two concurrent verifies under admission without OOM | Two independent same-origin full proofs overlapped for 48 minutes 49.201 seconds under `scheduler-origin-concurrency/v1`. Both terminal verdicts passed every lane at exit 0; their pre-push peaks were 17,966,264 and 18,001,708 KiB. Capacity contracted during pressure and recovered without hard-floor, dead-lease, quarantine, or OOM state. | Satisfied by terminal live receipts. |
| Hot-file conflicts no longer force PR rework | Across the 17 merged pull requests from #874 through the snapshot, only #874 touched `goals/INDEX.md` or `explorations/ATLAS.md`; the next 16 touched neither, and no sampled publish failure named a projection or contention-family path. | Satisfied for the sampled event volume. |
| Final PR mergeable | PR #929 reached Yeet `merge-ready: yes` and merged as `e76c4db079e62155b1c03e8b77a8b210cac6e1d2`, completing the implementation repair. PR #937 later finished its required checks at green with Greptile `5/5` and merged as `c57f63ac76cd3f25fbc700bad3032d6ce6a06d94`, but lacked the cache outcome, status flip, and reflection. The successor final-evidence PR on branch `goals/ship-velocity-cache-auth-evidence` carries those artifacts. | Pending hosted closeout: the successor final-evidence PR must reach Yeet `merge-ready: yes`; evidence preparation does not claim that terminal receipt. |

## Evidence-volume protocol

The authoritative production receipt is
`research/metrics-observation-2026-08-30.md`. It preserves the failed first candidate interval,
the parity repair, the event-volume ruling, and every later refresh. The closeout uses these
rules:

1. collect watch-event-to-inbox and Stop-gate receipts without user or secret payloads, while
   retaining the superseded takeover evidence as historical data only;
2. classify every required-check red against the parity ledger instead of counting green totals
   alone;
3. distinguish cache reference coverage, authenticated resolution, and observed remote hits;
4. retain admission, overlap, terminal outcome, and peak-RSS receipts for both independent full
   proofs;
5. count publish retries only when INDEX, ATLAS, or another declared contention family caused
   the retry;
6. drive the final closeout pull request to Yeet `merge-ready: yes`, including required hosted
   checks, Greptile, and zero unresolved review threads.

For the Atlas family, a retry counts only when the source change is a tracked
manifest/event/README-prose edit. The ignored `explorations/ATLAS.md` itself is never a GitHub
artifact or authoritative conflict target.

PR #929 satisfied the implementation-repair merge gate. PR #937 merged without the cache outcome,
status flip, or reflection and therefore did not satisfy the final closeout PR gate. The 2026-09-02
successor work retracts the mirror-drift hypothesis, repairs the stale references, records the
frozen authenticated sample, and carries the P5/lifecycle flip plus closeout reflection. The packet
is closed pending merge of the successor final-evidence PR on branch
`goals/ship-velocity-cache-auth-evidence`; the successor PR must still reach terminal Yeet
`merge-ready: yes`.
