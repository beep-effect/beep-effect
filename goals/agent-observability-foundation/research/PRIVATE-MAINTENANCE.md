# Private worker maintenance

The installed worker now routes owner requests through its existing paused
maintenance boundary. This closes the missing access path to library retention
and recovery operations; it does not authorize production enrollment or release
historical recovery holds.

Use `POST /maintenance` on the owned Unix socket with `application/json` and an
exact `observation-maintenance/v1` request: `hostId`, `namespaceId`, `targetId`,
`ownerInstanceId`, and `command`. First explicitly select the intended worker's
context through private `GET /maintenance`; verify its configured target. A fresh
random instance identifier distinguishes workers with identical host, salt and
policies, and changes on every restart. Stale POST requests are refused after
restart. Re-selecting a fresh context is an explicit new selection, not automatic
permission to replay an uncertain action. These identifiers are an accidental-
destination guard, not authentication or a persisted journal identity: filesystem
ownership and socket permissions remain the access boundary. Public GET and POST
requests are 404.

| Command tag | Arguments | Result and eligibility |
| --- | --- | --- |
| Window | none | Current evidence window; informational and immediately stale. |
| Pages | afterSequence | At most 32 receipt summaries, ordered by sequence; paused only. Continue after the last returned sequence. |
| Reclaim | receiptId | Verified disposition or null when ineligible; paused, backend visibility and age/quiet checks apply. |
| Expire | receiptId | Expiry disposition or null; paused and the configured expiry policy must permit it. Never converts uncertainty into success. |
| Backup | slot 0–3 | Independent snapshot receipt; paused. Fixed `backup-N` directory, create-only, occupied/partial slots refuse. |
| Seal | epoch | Retirement record plus digest, or null when empty/young/undisposed; paused. Exact epoch and quiet-period checks apply. |
| RestoreEvidence | digest | Latest logical retirement restored, or already-restored; paused, exact digest and empty successor required. |

All mutating operations leave the worker paused, including errors and deadlines.
An operator resumes only through the separate existing control route. A null
result is a held operation, not successful disposal. Refusals are content-free;
no request body, arbitrary file path, model input or credential is retained.

One admitted request, a 4096-byte streaming allocation, one-second body deadline
and cooperative 30-second operation deadline bound resource use. Synchronous
SQLite work is not preempted by an Effect timeout; installed hard process, memory,
file and task limits remain required. Concurrent requests receive
503 without a queue. Malformed/schema input is 400, oversized bodies 413,
unsupported media 415 and incomplete body timeout 408. Wrong destination is 409.
An operation refusal is 503 and must be inspected rather than blindly retried.

Four backups consume at most four configured journal ceilings (128 MiB at the
largest supported deployment), plus small manifests. No rotation silently deletes
recovery data. An interrupted backup can leave a partial slot: inspect and retain
it until the owner establishes its disposition. Store each returned receipt
outside its generation, and replicate snapshots independently for device/host
loss. Physical restore remains the existing offline fresh-destination workflow;
this HTTP route only restores logical retirement evidence.

## Verification status

Focused actual-HTTP tests exercise active refusal, namespace/target/process mismatch,
excess fields/bytes, slot bounds, young-page holds, immutable backup retry, and
fixed-clock expiry/retirement/exact restoration. Current evidence:

- `ops/maintenance-package-verification.json`: full AI-metrics package audit and
  docgen passed, bound to 165 source/test hashes. This also re-verifies the
  permanent-refusal scheduler correction.
- `ops/maintenance-cli-verification.json`: both scoped compilers and 29 CLI tests
  passed. This is not the still-required whole CLI package gate.
- `ops/history/maintenance-installed-verification.json`: actual installed worker and
  frontend, 82 source hashes, public GET/POST denial, 4096-byte/UTF-8 refusal,
  stalled-body 408, concurrent-operation 503, paused backup, occupied slot
  preservation, and stale process context refusal after an actual restart.
  The independent health scrape/stopped-worker alert and credential refusals
  were refreshed in this same bounded run. Owned resources were removed.
- `ops/maintenance-proof-archive.json`: verified, fsynced same-host archive of
  22 fixture artifacts including the backup and its receipt. The bundle was
  intentionally modified for integrity-refusal proof; do not execute it.

The installed proof checks held empty-window retirement; it does not accelerate
the real clock or claim actual age-based expiry. Age-dependent mutation is
qualified by the fixed-clock actual-HTTP test and existing storage/crash tests.
No real source, production policy, historical unit or data was changed. The
historical forwarder service and timer were rechecked masked/inactive. Production
rollout remains false. Independent panel acceptance and every remaining SPEC gate
are separately required for goal closeout.

The independent Astra delta review accepted the destination-binding correction and
matched all 82 installed, 165 package and six scoped-CLI source fingerprints. It
closed F7/F8 at their documented scope and found no further concrete maintenance
defect in this pass. Full-goal acceptance remains held; see review-panel-astra.md.
