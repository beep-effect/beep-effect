# Managed child and validated-session evidence

The managed driver now accepts an explicit optional observer on `open`. The
stdio adapter (Codex, Grok and Cursor) and Claude adapter call `started` only
after the platform returns an actual OS child handle. The public service calls
`bound` after adapter initialization and policy validation. The existing
policyEvidence field remains authoritative: launch-enforced Claude policy is not
relabeled as runtime-reported verification.

The observer receives a narrow read-only process port (PID, running check and
exit-code observation) and the existing validated session identity. It receives
no argv, environment, prompt, stdout, stderr or kill handle. The driver imports no
metrics tooling. PID alone is not a durable process identity; the controller must
bind an independent launch occurrence before hashing/exporting it. Process exit is
not evidence of task correctness or quality.

Each observation executes once with a five-second cooperative deadline and no
retry. A callback may commit before its response fails. The error therefore calls
for reconciliation; it does not imply non-acceptance. Typed callback failures are
mapped to content-free errors, preserving the operation but not callback payloads.
A child scope owns initialization and the returned session. On failure or
interruption it is closed before open returns, even when the caller catches the
error and keeps its own scope alive. Explicit session.close also closes that child
scope. Ordinary existing callers can continue to omit the observer.

## Proof

The driver suite passes 55 tests, including six new scenarios covering all four
adapters, failures after spawn and after identity binding, rejected runtime policy,
observation timeout and interruption. Tests use actual subprocesses speaking
synthetic native protocols; no provider executable or paid inference is launched.
They assert the child is stopped while the caller scope remains alive, and assert
one callback invocation rather than silently retrying.

The actual-worker verifier additionally runs the synthetic Codex peer inside an
owned systemd group with a 1 GiB memory ceiling, zero swap, bounded CPU/tasks and
20-second lifetime. A private client submits Prepared, then driver callbacks submit
Started and SessionBound. After explicit child closure and a negative isRunning
check it submits Finished(cancelled), not succeeded. The same existing salted
source-session hash is used by native intake; the exported OTLP payload contains
the matching session hash.

That sequence joins the prior CLI/desktop-marked fixtures for 12 committed launch
facts. A controlled worker restart and exact client/raw HTTP retries preserve all
12 original receipts without new rows. All seven owned units have MainPID=0 after
cleanup; four are deliberate startup-refusal cases. This proof is distinct from a
live Codex session or an independent fleet launch denominator. Package results
and source fingerprints are recorded in ops/history/managed-observer-verification.json.

## Launch claim follow-through

The independent claim implementation and actual child/restart proof now address
the duplicate-launch gap described by the original managed-observer receipt.
See [claim recovery evidence](LAUNCH-CLAIM-RECOVERY.md). The claim is kept outside
the collector journal because restoring a pre-launch database otherwise erases
permission history. The actual SQLite restore test demonstrates this boundary.

Production controllers still need immutable lifecycle outbox/reconciliation and
an explicit unresolved outcome. Claims are not process-start evidence and do not
make production enrollment complete. The original receipt remains historical;
current claim fingerprints and results are recorded separately.
