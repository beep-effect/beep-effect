# Ship velocity metrics closeout

Date: 2026-08-27

This receipt separates implementation proof from the representative post-merge week required by
the initiative completion gate. Synthetic tests and pre-merge measurements establish that the
measurement surfaces work; they do not establish that the outcome targets have been met.

## Implementation receipts

| Gate | Current evidence | Closeout state |
| --- | --- | --- |
| Attached-session backpressure p95 under 60 seconds | The watch stream polls every 10 seconds; synthetic first-red tests deliver on the observing tick. Hook adapters inject or deny at the next tool boundary. | Instrumented; representative week pending. |
| Dead-owner takeover under 5 minutes | The installed watcher polls every 30 seconds and the lease stale threshold is 240 seconds, bounding detection at 270 seconds. CAS ownership and zombie fencing are tested. | Bound proven; representative incidents pending. |
| Zero recurring locally catchable required-check failures | `research/parity-ledger.md` is the versioned divergence ledger. The local proof now plans the same 17 required contexts, including coverage, test-file typecheck, docgen, codegen, Desktop IPC, commitlint range, and base-pinned gitleaks. | Instrumented; post-merge entries pending. |
| Every sibling checkout reads the remote cache | `research/cache-proof.md` records a successful main-push write/read sequence, a remote-enabled hosted build, restoration probes, and the first-touch dashboard contract. Configuration fails closed when the read quad or 1Password references are unavailable. | Capability proven; representative checkout sampling pending. |
| Two concurrent verifies under admission without OOM | Weighted leases, adaptive concurrency, visible queue progress, starttime fencing, and RSS receipts are implemented and unit-tested. | Live dual-verify trial required before final closeout. |
| Hot-file conflicts no longer force PR rework | `goals/INDEX.md` and `explorations/ATLAS.md` are ignored local projections; publication refuses staged copies. Atlas now renders wholesale from normalized D3 state, regenerates marked README Stage/Status regions, and fails on underivable streams, README drift, or any extra local Atlas content. Focused tests cover manifest adoption, loop-back stream derivation, and invalid-stream refusal. Derived auto-heal is allowlisted and contention leases serialize only intersecting families. | Projection mechanism proven; representative conflict week pending. |
| Final PR mergeable | PR #874 reached zero unresolved threads, Greptile `5/5`, and green required contexts before merge. | Merged as `d324544d3a3` at `2026-08-30T02:39:33Z`. |

## Representative-week protocol

The observation window starts only after this implementation PR lands on `main`. For seven
consecutive days:

1. collect watch-event-to-inbox and takeover timestamps without user or secret payloads;
2. classify every required-check red against the parity ledger and count recurring locally
   catchable causes;
3. sample the cache dashboard across active sibling checkouts, excluding forced and disabled
   runs from the locked first-touch denominator;
4. retain admission and peak-RSS receipts for overlapping full verifies and record any OOM;
5. count publish retries whose cause is INDEX, ATLAS, or another declared contention family.

The first candidate interval and its Day 1 findings are recorded in
`research/metrics-observation-2026-08-30.md`. A recurring required-check parity defect means that
interval cannot satisfy the completion gate; the packet remains active while the repair and a
fresh full interval are pending.

For the Atlas family, a retry counts only when the source change is a tracked
manifest/event/README-prose edit. The ignored `explorations/ATLAS.md` itself is
never a GitHub artifact or authoritative conflict target.

Only after the full window satisfies every manifest condition should P5, the lifecycle, and the
initiative status flip to `complete`, with the final observation receipt and closeout reflection
in the same PR.
