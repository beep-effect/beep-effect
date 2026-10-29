# Durable lifecycle outbox and exact acknowledgment recovery

The independent claim owner now retains lifecycle observations before transport.
`appendObservation` accepts only metadata for an existing claim's exact host,
namespace, epoch and launch ID. Prepared is already durable in the claim; Started,
SessionBound and Finished each have one exclusive, checksummed file. Exact repeats
are re-synced; a different fact for the same phase is refused. SessionBound and a
successful Finished require an observed Started. Completion is never invented from
a consumed claim, process absence, missing telemetry, or a restored database.

`readOutbox` returns the original claim, immutable submissions and historical
acknowledgments. `reconcile` replays at most four exact submissions in lifecycle
order, with a ten-second deadline and no queued local contention. It has only a
delivery callback, no process-start callback. It verifies destination, fact, receipt
identity and any previous complete receipt before retaining acknowledgments. A
failed send or lost response leaves the observation available for explicit recovery.
A changed receipt, retired epoch or torn file refuses reconciliation; no automatic
retargeting, replacement epoch, launch retry or file deletion exists.

## Bounds and ownership

The same private claim directory contains at most eight owned slots per claim:
one claim, three subsequent observations and four receipts, each at most 8192 bytes.
There is one additional anchor of at most 8192 bytes. With 256 maximum claims the
logical file-content ceiling is 16,785,408 bytes; filesystem overhead and aggregate
host disk admission remain deployment responsibilities. No directory enumeration,
retention reset or hidden queue was added. Observations are supplied by one owning
controller; checksums are integrity checks, not signatures against that owner.

Both observations and receipts sync the file and directory before acknowledgment.
Exact retries re-sync retained files so a previous sync failure cannot become an
unearned durable acknowledgment. Interruption can leave a torn slot; it is preserved
and held rather than silently repaired from uncertain data. Restoring the collector
never restores or resets this separate store. Claim-store loss/rollback remains a
recovery hold requiring independent reconciliation.

## Proof

Six focused outbox tests use real SQLite journals and private filesystem stores.
They cover lost acknowledgment after a committed Started fact; recovery by a fresh
owner; exact replay and lifecycle continuation; changed epoch, conflicting phase,
unclaimed and impossible observations; changed or misattributed receipts; torn
records; and bounded timeout with local contention. An actual producer process is
also killed after persisting Started, and a fresh owner reads the retained metadata
while a repeat operation remains refused.

The existing actual SQLite restore test now retains an original acknowledgment,
restores a pre-claim backup and advances the clock. Relaunch remains refused. A
replay into the restored collector returns a new recorded-at value and is explicitly
reported as a receipt conflict; the original producer acknowledgment is preserved.
The newly accepted collector row is not undone or falsely reported as absent.
This surfaces recovery discontinuity rather than rewriting historical evidence.

The actual worker proof launches one synthetic Codex-protocol child, records and
joins its session, and closes it. It deliberately loses the final acknowledgment
only after the real worker has returned its committed receipt. The first producer
ends with four observations and three retained acknowledgments. After a controlled
worker restart, a new producer recovers all four original receipts while its launch
claim still refuses a second process. The worker remains at 12 lifecycle rows;
all eight owned units stop. No provider executable or model request is involved.

Source fingerprints and current package/entrypoint proof are in
`ops/launch-outbox-verification.json` and
`ops/launch-outbox-entrypoint-verification.json`.

## Next production integration

Connect this sink to the existing managed `agent-message serve` owner rather than
creating another generic launcher. Its current `sessions.open(profile)` call is the
concrete integration point. Enrollment must bind stable host/root/route/task/attempt
metadata and the private store separately from the collector. Local durable callbacks
should preserve observations without making normal agent progress depend on backend
latency; reconciliation belongs to an explicitly bounded owned activity. On failure,
conservative process closure must use actual owned-child evidence and preserve an
unresolved outcome when evidence is insufficient. Test that path with synthetic
protocol peers before a real disposable CLI/desktop canary.

Real producers, independent population reporting, service installation, aggregate
recovery policy, external health publication, bounded live canaries, the final panel
and repository delivery remain open. Historical stores and held units are untouched.
