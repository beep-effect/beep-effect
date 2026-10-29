# Complete journal ownership inventory

During managed-launch integration discovery, both journal reopening and backup
capture were found to query at most 20 application tables. The fully composed
observation worker already creates 20 owned tables. An unexpected table created
after those 20 was invisible to the check. A disposable full-worker reproduction
confirmed that both reopening and backup capture incorrectly succeeded.

The limit now derives from the canonical owned-table list plus one sentinel row.
Any returned name outside that list, or more names than the owned population,
causes refusal. This remains bounded and automatically follows an explicitly
reviewed addition to the owned-table list. It does not silently accept the 21st
table or rely on table creation order.

The snapshot inspector now applies the same boundary to the copied database,
including restoration. A second reproduction modeled a digest-valid snapshot
from an older permissive capture implementation. Restoration previously published
a success marker despite its unexpected table; it now refuses with integrity
failure before publishing that marker. The caller's retained checksum proves the
snapshot bytes are expected, but does not override the current ownership boundary.

## Proof

- Before repair, both full-worker late-table regressions failed because the
  operations incorrectly succeeded (`/tmp/foundation-table-boundary-red.log`).
- Before snapshot-inspector repair, the digest-valid historical-snapshot
  regression also failed because restoration incorrectly succeeded
  (`/tmp/foundation-restore-boundary-red.log`).
- After repair, 26 tests across worker, intake, independent backup and backup crash
  suites passed (`/tmp/foundation-ownership-boundary-green.log`): 6.387s service
  runtime, 518.9 MiB peak memory, zero additional swap.
- Final package verification is recorded in
  `ops/journal-ownership-verification.json`; do not infer its status from the
  focused suite alone.

The capture check refuses before creating its backup destination. A restore that
passes the checksum checks but fails semantic inspection can retain a new private
partial destination for inspection; it never publishes `restore.json`, overwrites
an existing destination or deletes the source/backup. Tests verify the original
source and supplied backup bytes remain unchanged. Real historical stores were
not inspected or modified, and the forwarder recovery hold remains in force.

## Managed launch work

No launch table or launch writer was added in this repair. The design still needs
preparation, observed start, verified session binding and completion as distinct
facts. A prepared-but-unconfirmed launch cannot count as an observed start. The
existing shared journal, ownership lock, worker admission and physical backup
boundaries are the intended integration points. Its launch retention and replay
rules must be designed explicitly alongside the current evidence-epoch recovery;
a new table must not silently escape retention, backup or rollback checks.

## Reuse findings for the resumed launch implementation

- `observation-inventory.ts` already supplies separate evidence-backed repository,
  clone and worktree identity, explicit unknowns, host namespace, harness and
  surface domains. Reuse these rather than a free-form launch attribute map.
- `session-lease.ts` is a hook-derived liveness/tombstone projection. Its existence
  does not establish a process launch or independent known-launch population.
- `flight-record.ts` has an objective-content digest. Equal objective text is not
  the same task execution or attempt, so that digest cannot stand in for either ID.
- The older `AgentTask` model includes a free-form title and broad strings; do not
  admit it wholesale through the new positive metadata boundary.
- The managed provider driver exposes verified session identity and terminal
  evidence, and the tooling CLI already depends on that driver. Integration belongs
  at the controller boundary; the driver need not depend on the tooling metrics
  library or accept arbitrary inherited OTEL variables.
- A launch fact table must be included deliberately in ownership and physical
  backup. Its retention semantics must also account for source identity joins and
  the existing evidence recovery descriptors; simply appending a table to the
  allowlist would not establish lifecycle correctness.

Final package verification passed: audit 112.5s, docgen 11.4s, total runtime
130.755s, peak 5.7 GiB and zero additional swap. Source fingerprints and exact
regression receipts are recorded in ops/journal-ownership-verification.json.
