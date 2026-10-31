# Independent claim-store disaster rehearsal

## Recovery authority

The collector journal and independent launch claims have different recovery rules.
A collector backup may be restored into a fresh destination with its exact trusted
receipt, while surviving independent claims continue preventing duplicate starts.
An old claim-store snapshot is **not safe launch authority**: it can omit a launch
that occurred after capture. Checksums establish which bytes were retained; they
do not establish that no later launch happened.

Missing, torn or uncertain claim storage therefore requires a launch hold and
external reconciliation. Do not call initialize-claims to repair a missing fence,
replace it with an older snapshot, select a fresh fence, or change owner generation
to bypass an unresolved attempt. Historical backup files remain evidence.
No automatic claim-store restore or hold-release operation is implemented.

## Actual command proof

The existing actual-worker verifier now takes a synthetic cold anchor snapshot
immediately after explicit initialization/enrollment and before the first child
launch. The real serve command subsequently starts and closes one synthetic Codex
protocol child and retains four lifecycle facts. A separate recovery command
recovers all four acknowledgments after collector restart.

After the producer has exited, the verifier fingerprints the resulting claim store
and preserves it under a distinct fixture-owned path. Three fresh command processes
then exercise these conditions:

1. Configured claim directory is missing.
2. Configured path links to a quarantined stale snapshot (read-only directory).
3. Configured path contains a copied store with a deliberately torn claim.

Each invokes the actual registered serve, status, reconcile and population commands.
Each must fail specifically at the claim-integrity boundary, not at argument parsing
or unrelated setup. The watched process spawner must record zero children. Missing
storage stays missing, the quarantined snapshot stays untouched, and torn storage
is not silently repaired. Fingerprints prove the retained original outbox survives.

The snapshot contains zero claims; the later original contains one. This reproduces
the recovery-point gap without installing the stale snapshot as writable authority.
The proof retains sixteen collector facts, starts no real provider session and
stops all thirteen owned service processes. See
`ops/history/claim-store-disaster-worker-verification.json` and the scoped verification
receipt. This is not proof of device loss, power-loss durability, off-device backup,
or automatic safe reconstruction after a complete loss of independent claims.

## Operational runbook

- Stop new launches through the owned supervisor before changing storage. Identify
  active children separately; a receipt or Finished fact is not current liveness.
- Keep the affected enrollment, original path, fence and error evidence. Do not
  erase or overwrite the uncertain store. Preserve the old collector recovery hold.
- Keep surviving claims outside collector restoration and evidence retirement.
  Restoring the collector must not replace, roll back or recreate those claims.
- If independent claims are missing or rolled back, keep the affected route held.
  Quarantine old snapshots as read-only reconciliation evidence. A checksum alone
  is insufficient to authorize new launches.
- Reconcile original attempt IDs with independently retained supervisor/provider
  evidence. Any unresolved start remains unknown. Starting a new attempt is an
  explicit operational decision, not an automatic retry disguised by a new ID.
- Record backup owner, generation/capacity limits, storage failure domain and an
  independently retained receipt before production enrollment. Those deployment
  responsibilities are still open; this rehearsal does not qualify them.

Synthetic artifacts were left for inspection. Historical archives and production
services were not changed. The former forwarder service/timer remain held.
