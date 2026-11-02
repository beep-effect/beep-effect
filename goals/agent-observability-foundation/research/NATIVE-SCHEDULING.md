# Durable native delivery scheduling

The worker now exposes a bounded `tick` that selects work from accepted native
receipts. No caller needs to remember a receipt or attempt identifier to send
new events. The worker still starts paused and does not start a timer, listener,
or production service. Production cadence and enrollment remain open.

## Selection and recovery

One checksummed singleton stores a traversal position and binds the policy,
host, namespace and target. Each tick visits at most 32 events, admits one tick
at a time without waiting, and has a cooperative deadline. It claims one event
immediately before I/O. Claiming a whole batch before processing its first item
would let recurring deadlines skip that batch's tail indefinitely.

The scan joins canonical native events to retained payload pages. Disposed
payloads cannot be scheduled. Within a pass, bounded duplicate tracking prevents
a wrap from visiting the same event twice. Advancing this position never changes
an event's delivery state. The original receipts, checksummed attempts and
visibility facts remain authoritative.

Explicit retryable replies permit a fresh deterministic, epoch-scoped attempt
after capped exponential backoff. Permanent refusals and verified visible events
are held. Accepted or ambiguous attempts go through exact metadata read-back;
missing or mismatched data never authorizes a blind resend. Query failures remain
failures rather than absence. Clock regression holds work until its recorded
attempt time is reached. Ambiguous missing events need a later explicit replay
policy; this implementation does not promise eventual delivery through every
failure. Single-event export is a current throughput tradeoff, not a bulk-load
performance qualification.

Existing multi-event attempts are reconstructed from their exact canonical event
slice for read-back. The scheduler's default policy is 8 events per tick, a
1-second initial retry/query delay, a 60-second maximum retry delay and a
10-second tick deadline. Scheduling shares the worker's admission and pause/drain
boundary. Hard ownership, resource limits, bounded runtime cadence and health
reporting are still deployment responsibilities.

## Verification scope

The focused scheduler tests cover reconstruction against the same durable SQL
store, accepted-to-missing read-back without resend, retry delay and new attempt
identity, permanent-refusal fairness, interrupted first-event fairness, concurrent
admission and release, and cursor checksum/policy drift refusal. Worker tests
verify paused ticks refuse work and pause drains an admitted tick.

A separate Bun process test kills the fixture worker after the loopback backend
accepts a span but before its result is committed. A new process opens the same
SQLite file, sends the next event, then wraps and queries the uncertain first
event without resending it. The journal passes integrity checking. This is a
process-crash proof, not power-loss or actual-Phoenix crash recovery proof.

The disposable collector/Phoenix fixture passed with automatic selection and
reconciliation for all three provider-usage cases. Exact identities, nanosecond
metadata and usage reconcile; private canaries remain absent from journal, queue
and backend. The full package gate passed (audit 237.7s, docgen 17.0s). See
`ops/native-scheduling-verification.json` and its linked actual-backend receipt.

## Rollback and remaining work

Before enrollment, leave the scheduler and worker uncomposed; preserve the held
forwarder and all historical data. Do not edit old journal identities or delete
the singleton to bypass a policy mismatch. Physical backup includes the owned
scheduler table. The refreshed actual resource/backup fixture passed with a
151552-byte independent snapshot, controlled stop/restart, exact receipt replay
and all four owned worker/proxy units inactive. No deliberate OOM was run.
This qualifies the disposable fixture, not the production launcher.

Remaining acceptance includes the production runtime/cadence, source and event
lag health, source/host/task identity and coverage denominators, reconstructed
stream delivery, metric privacy, backup lifecycle, actual CLI/desktop proof,
bounded canary/rollback, independent panel, and repository delivery. This report
does not close the full SPEC.

### Verification resource observation

The first full package run at the corrected type-check state reached its
300-second deadline during linting. The owned job had zero OOM events and a
5.05 GiB peak; its soft ceiling was raised from 4 to 5 GiB within an unchanged
6 GiB hard ceiling after observing reclaim stalls. This run is not a pass.
The retry limits lint worker concurrency with RAYON_NUM_THREADS=2 and
BIOME_THREADS=2, preserving all package checks and the hard resource ceiling.
The supported Rayon control is described by the Biome maintainer in
https://github.com/biomejs/biome/discussions/8948; local execution remains the
authority for its resource effect. No global application setting was changed.

The concurrency-limited retry still reached its 5 GiB soft ceiling during lint.
The settings were confirmed in the actual linter environment. After increasing
that owned job to a 7 GiB soft / 8 GiB hard ceiling, the unchanged full gate
completed inside its original 300-second deadline. No OOM occurred. Therefore
thread limits alone are not established as a memory remedy. Worker/proxy and
collector-route fixture jobs now join agent-runs.slice; their own smaller hard
limits remain unchanged. Whole-workstation admission remains separate work.
