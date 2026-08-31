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
| Every sibling checkout reads the remote cache | All 11 active checkout roots carry a git-ignored, reference-only remote-read quad. Five `.env` files were provisioned and six blank team references were repaired without resolving, printing, or writing a secret value. The 1Password MCP was unavailable and `op whoami` remained signed out, so the cache plan correctly degraded to local-only. | Open: an authorized `op signin` session must produce a fresh remote-read observation from every active root. No new references are required. |
| Two concurrent verifies under admission without OOM | Two independent same-origin full proofs overlapped for 48 minutes 49.201 seconds under `scheduler-origin-concurrency/v1`. Both terminal verdicts passed every lane at exit 0; their pre-push peaks were 17,966,264 and 18,001,708 KiB. Capacity contracted during pressure and recovered without hard-floor, dead-lease, quarantine, or OOM state. | Satisfied by terminal live receipts. |
| Hot-file conflicts no longer force PR rework | Across the 17 merged pull requests from #874 through the snapshot, only #874 touched `goals/INDEX.md` or `explorations/ATLAS.md`; the next 16 touched neither, and no sampled publish failure named a projection or contention-family path. | Satisfied for the sampled event volume. |
| Final PR mergeable | PR #874 reached zero unresolved threads, Greptile `5/5`, and green required contexts before merge. The parity repair also passed every required context and merged as #892. | Open for the concurrency repair and final closeout branch: publish through Yeet and reach `merge-ready: yes`. |

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

P5, lifecycle, and initiative status remain active until the authenticated remote-read sample and
the final closeout PR gate are both satisfied. The status flip and closeout reflection must land
in the same PR as the last remaining evidence.
