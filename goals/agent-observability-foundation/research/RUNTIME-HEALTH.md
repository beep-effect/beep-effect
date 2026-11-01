# Native runtime cadence and health

The runtime composes the verified worker's native scheduling tick into one
explicitly started loop. Construction starts no activity and never resumes
intake. Each cycle completes before a configured delay; slow work cannot create
an overlapping or catch-up queue. A second loop owner is refused without waiting.
A cooperative cycle deadline bounds ordinary work; hard process limits remain
necessary for uninterruptible storage/finalizer activity.

Stopping/interruption marks the loop stopped and pauses/drains the worker.
Unexpected defects terminate the loop. Expected operation errors and deadlines
produce a bounded content-free observation and allow a later delayed attempt.
The durable journal and delivery ledger, rather than these volatile observations,
remain the authority for committed progress.

## Interpreting health

- `stopped`: this runtime has no running cadence owner.
- `starting`: it has started but has not completed a cycle.
- `paused`: worker admission was paused at the latest observation.
- `idle`: the latest completed native pass observed no retained native candidate.
  This does not assert that every source was captured or that every historical
  event was delivered.
- `active`: the latest pass observed native candidates without an adverse result.
  Transport acceptance still does not mean backend visibility.
- `degraded`: failed/deadline cycle, failed operation, missing/mismatched read-back,
  refusal, exhausted attempt budget or observed clock regression in scheduling.
- `stale`: a running loop's last cycle/start observation exceeds the freshness
  policy. A freshness policy must exceed the cycle deadline plus cadence delay.
- `clock-regression`: wall time went backward relative to the recorded cycle.
  A negative age is never clamped to a healthy zero.

The latest cycle records start/completion times and a tagged result. Failed or
deadline cycles contain no fabricated zero counts: some durable work may already
have committed. Completed passes report observation counts, not unique-event
populations. Retained page/byte/occurrence totals were read at the beginning of
the pass and include reconstructed pages and duplicate occurrences. They are not
an undelivered-event count. Source coverage remains explicitly unknown.

Health resets on process reconstruction and is not a new durable event store.
The metric renderer emits only fixed names, numeric values and an enumerated
phase label. It omits missing counts, uses gauges for latest-pass observations,
and exposes observation/cycle timestamps. No path, host identifier, event ID,
model, endpoint, prompt or exception becomes a metric label. An external monitor
must combine scrape availability with timestamp freshness; an old text file
cannot establish current process health. Exporter installation, alert delivery
and source/event-lag accounting remain separate work.

## Verification and remaining acceptance

Focused tests cover stopped/paused/idle transitions without implicit enrollment,
nonqueued ownership, no overlapping/catch-up work after a deadline, unknown
progress after storage failure, recovery on a later cycle, stale/regressed clocks,
missing read-back and blocked work, metadata-only metric projection and cleanup
after an unexpected defect. The actual worker/socket test accepts a synthetic
native event after explicit resume, delivers it on runtime cadence and verifies
HTTP intake is refused again after runtime interruption.

Seven runtime tests and seven worker/socket tests passed in the full package
gate (audit 120.8s, documentation generation 12.9s). The actual renderer produced
a 2914-byte synthetic completed-cycle sample accepted by promtool 3.15.1. This
checks exposition syntax, not the deployed Prometheus version or live alerting.
Current proof results and hashes are in ops/runtime-health-verification.json.
This is native runtime library and socket-composition proof. It does not establish
a production daemon/listener, cross-process runtime ownership, source discovery
cadence, reconstructed-stream delivery, fleet identity/coverage, source/event-lag
alerts, physical disk pressure, live CLI/desktop/canary or complete SPEC acceptance.
Production installation must use the already-qualified resource/ownership boundary
and expose freshness to an independently running observer.

Before enrollment, rollback is leaving the new runtime uncomposed. The old
forwarder service and timer remain masked; no historical archive or journal is
migrated by this change.
