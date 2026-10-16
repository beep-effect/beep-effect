# Worker-aware cheap-gate concurrency — 2026-10-14

The ten-minute worker run demonstrated concurrent repository-wide scans
stalling at the proof slice's soft memory threshold. Added a schema-decoded
BEEP_QUALITY_CHEAP_GATE_CONCURRENCY setting accepting 1, 2, 3 or 4. Missing
or malformed values retain the four-lane default. Pre-push remains serial,
wave ordering and required gate coverage remain unchanged. The setting is
read at call time rather than captured when the module loads.

The worker launcher explicitly selects one cheap-gate lane. BEEP_ forwarding
already carries this non-secret setting into detached services; Turbo's
pass-through declaration now includes it as well. This selects a worker budget
without guessing capabilities from hostnames or changing other machines.
The existing 7 GiB soft / 8 GiB hard / 256 MiB swap and two-CPU limits remain.

Tests exercise accepted widths, absent/invalid settings, call-time environment
changes, unchanged pre-push serialization and the detached service's exact
environment argument and recorded forwarded-variable name. Package lint/type
verification passes. The relevant quality/proof suites pass 361 tests. The final detached-forwarding
assertions also pass all 104 proof-job tests. Commit hooks pass.

## Actual worker rerun

At b54d6becdf, a fresh owned worktree installed the frozen lockfile and submitted
job ab46f014-63e0-4b26-8641-6dfb8ed19c6b with --base HEAD and a ten-minute ceiling.
The live runner environment contained the width=1 setting and no SSH_AUTH_SOCK.
The service ran after the submitter exited. Existing worker configuration edits
were preserved byte-for-byte. No PR or publication was performed.

The early checks completed, then only the import-law scan ran. Memory initially
peaked around 1.9 GiB; the scan grew to roughly 7 GiB and kept doing CPU work with
near-zero recent memory pressure for part of the run. Later it exceeded the
soft threshold and pressure returned, reaching about 85 percent avg10. The
service peaked at 8,004,046,848 bytes (about 7.45 GiB). Serialization removes
cross-lane overlap, but this individual scan still needs memory-bounded work.
A complete green cheap-gate verdict remains unqualified.

The runtime deadline stopped the main process. The finalizer timed out, leaving
39 tasks in the memory-high throttle path. Guarded recovery refused those live
tasks. Raising only the runtime soft threshold to the unchanged 8 GiB hard
ceiling released cleanup; restored 7 GiB immediately. Job wait then returned 3
and published terminated/finalizer-missing after systemd collected the unit.
The independently observed systemd timeout remains separate from the durable
unknown service result. No job JSON was edited and no reset-failed was used.

[Sanitized receipt](../research/2026-10-14-cheap-gate-concurrency.json) retains
this boundary. Raw job logs, inbox/ack records and Turbo summaries were archived
on the worker in ~/.cache/beep/yeet-serial-proof/evidence.tgz and compared with
the originals before clean-worktree removal. Available host memory returned to
about 11 GiB. Next: bound the import-law scan's per-run memory, and separately
make shutdown/finalization independent of proof-slice memory throttling.
