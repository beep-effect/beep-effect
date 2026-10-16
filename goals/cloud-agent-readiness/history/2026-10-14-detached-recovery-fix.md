# Detached-job recovery repair — 2026-10-14

The prior live proof exposed a dead runner whose loaded failed unit kept its
record running after the finalizer was starved. Recovery now handles both an
absent unit and a decoded loaded terminal observation. It requires failed/failed
or inactive/dead state, zero main/control PIDs, no remaining cgroup tasks (or
no cgroup), a dead recorded identity and no conflicting invocation ID.

Recovery preserves observed systemd result, exit code/status and invocation.
An exit-zero unit without a recorded proof outcome remains terminated; it never
becomes a fabricated green verdict. Publication uses the existing locked,
idempotent finalization/inbox path. Active, stopping, ambiguous, malformed,
occupied and mismatched-invocation observations refuse recovery.

The worker launcher routes job/status/inbox/proof-report observations into a
separate control slice with a 1 GiB hard ceiling, 64 MiB swap ceiling, one CPU
and 128 tasks. Proof workload budgets are unchanged. This prevents observation
from sharing the pressure ceiling it is meant to inspect. The original finalizer
still runs in its proof unit; terminal recovery no longer depends on that
finalizer completing. It must never race an active finalizer.

104 proof-job tests pass, including 16 new recovery/guard regressions.
Package quick lint/type verification passes. A real-worker controlled manager
fixture qualified failed-loaded recovery without running heavy gates or
creating a PR. It deliberately timed out a sleep workload and its sleep
finalizer; it tests recovery, not repository quality.

## Worker proof

At d0d865431e plus the tested sentinel correction, a clean disposable worktree
created a controlled transient service with RuntimeMaxSec=4, a sleep finalizer
that exceeded TimeoutStopSec=1, and a schema-encoded fixture record carrying the
real main PID/start identity and invocation ID. No existing job record was
edited. The service remained loaded/failed after both processes were gone.

The first bounded read exposed a native wire detail absent from the original
fixtures: systemd returns TasksCurrent=[not set] after ControlGroup disappears.
That first read timed out and is not counted as successful proof. The decoder
now accepts that sentinel; recovery accepts it only when ControlGroup is empty,
with zero main/control PIDs and a dead recorded identity. A nonempty cgroup
with unavailable task accounting still refuses recovery. Added both regressions.

The same genuine failed-loaded unit then recovered through the canonical
worker job wait, without reset-failed or unit unloading first. Wait returned 3;
phase is terminated, reason is timeout, systemd result is timeout, exit code
killed, status 15, and the real invocation ID is preserved. Outcome remains
absent. The normal idempotent inbox publication and job-wait acknowledgement
were written. [Sanitized receipt](../research/2026-10-14-detached-recovery.json)
records the result. Unit cleanup occurs only after this recovery proof.

The control slice is independent of agent-runs.slice. This isolates observer
memory from proof memory; it does not move ExecStopPost into another service
or claim that the original finalizer can never be starved. Active finalizers
and remaining tasks are deliberately left alone. Recovery remains conservative
when systemd observations are missing, malformed or from another invocation.

No heavy-gate rerun, artificial OOM stress, hosted CI or publication was needed.
A live timeout fixture and mocked OOM regression are separate evidence. Full
green proof, workload sizing, direct-SSH detection and reboot behavior remain
other readiness acceptance items.

A fresh end-to-end fixture with the final source also passed (fixture exit 0).
It recovered while the unit remained loaded/failed, preserving timeout, killed
status 15 and invocation identity. Cleanup reset only the owned fixture unit
after the assertions succeeded. A contradictory positive task count with an
absent cgroup now refuses recovery as well.
