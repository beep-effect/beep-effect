# Ship velocity metrics closeout

Date: 2026-08-30

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
| Every sibling checkout reads the remote cache | The original repair covered 11 roots, but that set was historical by closeout. A fleet scan at `2026-08-31T02:45:59Z` classified 16 roots as live; four overlapped the historical set and nine of the current roots lacked one or more cache fields. The sanctioned helper provisioned only missing fields from an existing reference-only source, after which all 16 had a git-ignored `https`/`op://`/nonblank-team/read-only quad. On 2026-08-31, an output-suppressed `op run --env-file=.env -- true` preflight resolved the references, but the cache canary returned `Remote caching unavailable (Authentication failed)`. Sanitized metadata showed that the AWS read-token parameter changed on 2026-08-12 while the referenced 1Password item was last updated in February. No secret value or reference path was printed. | Open: the operator must update the existing 1Password mirror with the current read token. After `op signin`, rescan liveness and produce a fresh authenticated remote-hit observation from every root in that frozen snapshot. The reference path does not need to change. |
| Two concurrent verifies under admission without OOM | Two independent same-origin full proofs overlapped for 48 minutes 49.201 seconds under `scheduler-origin-concurrency/v1`. Both terminal verdicts passed every lane at exit 0; their pre-push peaks were 17,966,264 and 18,001,708 KiB. Capacity contracted during pressure and recovered without hard-floor, dead-lease, quarantine, or OOM state. | Satisfied by terminal live receipts. |
| Hot-file conflicts no longer force PR rework | Across the 17 merged pull requests from #874 through the snapshot, only #874 touched `goals/INDEX.md` or `explorations/ATLAS.md`; the next 16 touched neither, and no sampled publish failure named a projection or contention-family path. | Satisfied for the sampled event volume. |
| Final PR mergeable | PR #929 reached Yeet `merge-ready: yes` at head `019be8a8c21cbdde0dac7d5263f7dd6252f26e9a`, with zero unresolved review threads and Greptile `5/5`. It merged on 2026-08-31 as `e76c4db079e62155b1c03e8b77a8b210cac6e1d2`. | Satisfied. |

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

PR #929 satisfied the final closeout PR gate. P5, lifecycle, and initiative status remain active
until the operator repairs the stale 1Password mirror and the authenticated remote-read sample is
complete. The status flip and closeout reflection must land in the same PR as that last remaining
evidence.
