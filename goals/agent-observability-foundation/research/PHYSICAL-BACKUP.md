# Independent physical journal backup — 2026-10-28

Implemented in `observation-backup.ts` and composed through `worker.backup(policy, directory)`. The worker permits capture only under paused, drained, exclusive maintenance and leaves admission paused afterward. Source configuration, owned table names, page size, DELETE/EXTRA settings and byte budget are checked. A reserved SQLite connection creates a separate VACUUM INTO database, then independent integrity/configuration checks, byte hashing and filesystem synchronization precede manifest publication. Existing destinations are refused; a private canonical parent directory is required.

The caller retains an external receipt binding the manifest and database digests. Restoration verifies that receipt and uses a dedicated in-memory SQLite verification connection, so it does not require a healthy original journal. It writes a fresh destination, checks SQLite integrity and source identity, and publishes restore.json last. It never overwrites an existing database, rewinds later observations, selects a live route or resumes collection. Failed or interrupted attempts can leave a new incomplete or unacknowledged artifact; they preserve the preceding generation. Deployment must use the completion marker and trusted receipt, and reconcile the snapshot's recovery-point gap before selecting it.

The policy caps a single snapshot at 1–32 MiB. Hashing holds one bounded database buffer; this is not streaming backup. SQLite work is synchronous, so a JavaScript timeout is not claimed as a hard execution ceiling. Generation retention, aggregate disk quota/headroom, off-device replication, production scheduling and power-loss qualification remain separate requirements.

Six SQLite scenarios cover preserved original receipts/cursors and newer source observations; existing/exposed/foreign destinations or sources; modified bytes and caller receipt; oversized source and retained previous generation; recovery after closing and damaging the original; and publication failure. Four actual Bun SIGKILL scenarios cover capture and restore before/after publication. A worker composition scenario proves pause/maintenance admission. The combined focused run passed 14 tests including existing worker scenarios. Full ai-metrics package verification passed: audit 44.7s, docgen 8.8s.

The resource-limited actual worker also captured a 147,456-byte physical snapshot under its 512 MiB/zero-swap/50%-CPU limits. An independent Python SQLite reader verified integrity and the receipt population; the snapshot survived the later deliberate worker OOM. This is evidence for the tested snapshot size, not maximum-size throughput or device-loss recovery. See ops/worker-resource-oom-verification.json. The deliberately induced OOM caused a KDE notification; routine resource runs now omit that scenario unless explicitly requested with --exercise-oom.

All data in these tests was synthetic. The original masked forwarder and historical archives remain untouched. The full foundation SPEC and repository delivery are still open.

## Recovering a consumed maintenance backup slot

The private maintenance route has four create-only destinations, `backup-0`
through `backup-3`. A timeout or lost response is uncertain: synchronous SQLite
work may have completed, and a partial directory still consumes its slot. Never
retry against the same occupied destination, infer a completed backup from a
503/timeout, or weaken the slot ceiling to make it fit.

The journal custodian first pauses and drains intake, then stops the exact owned
worker and confirms its process has exited before touching a slot. Inventory all
slot files and the independently retained backup receipts. Classify each slot as
verified complete, incomplete, or uncertain; a manifest without the independent
trusted receipt is insufficient authority for restore. Preserve the last verified
backup and all unresolved artifacts.

Reclaim a slot only through explicit offline archival: provision a private,
separately budgeted archive on the same filesystem, check its available capacity,
record the source file inventory and hashes, and atomically rename the entire slot
directory into a new, never-overwritten archive generation. Sync the affected
parent directories and verify the archived inventory and hashes. Preserve the
original external receipt; do not manufacture restore authority from an uncertain
artifact. A verified complete generation also requires a successful fresh-destination
restore rehearsal before any later disposal. Incomplete generations stay retained
for reconciliation. This archival path is an operator/custodian procedure, not an
automatic API deletion or rotation policy; archive bytes have a separate explicit
quota and retention owner.

With the original slot name absent, restart the same owned configuration in its
paused state, read the new maintenance owner context, and request a backup into
that slot. Retain its returned receipt independently and verify the new snapshot.
If any archive, ownership, capacity, restore or identity check is uncertain, keep
collection paused and the occupied slot intact. Historical forwarder stores and
queues are outside this procedure and remain held.
