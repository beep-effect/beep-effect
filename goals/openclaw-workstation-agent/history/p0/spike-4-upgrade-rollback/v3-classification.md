## Assertion 3 — migration classification

### `2026.6.33 -> 2026.7.1-2`: rollback-benign / reversible

For the exercised shared database, this migration class is rollback-benign
and reversible in place. Running `2026.7.1-2` leaves `PRAGMA user_version=1`,
and `2026.6.33` then starts cleanly against that touched state without a
snapshot restore.

Evidence:

- `logs/v2-sequence.log:27-29` — archived stamp and clean old-binary start.
- `logs/v3-classification-sequence.log` — `additive hop` and
  `6.33 starts cleanly ... WITHOUT restore` assertions from the rerun.

This classification is limited to the databases and transition exercised by
the harness; it is not a claim that every migration between those releases is
universally reversible.

### `2026.7.1-2 -> 2026.7.2-beta.4`: in-place downgrade-incompatible

This migration class is irreversible for in-place rollback and therefore
snapshot-required: B stamps the shared database `1 -> 5` and the per-agent
database `1 -> 14`; A refuses that migrated state. Rollback to A succeeds only
after restoring the stopped-state snapshot.

Evidence:

- `logs/v2-sequence.log:14-15,19-26` — archived stamp transitions, A refusal,
  snapshot restore, and clean A restart.
- `logs/v2-refusal-journal.log:51-60` — archived causal schema-version refusal.
- `logs/v3-classification-sequence.log` — rerun migration/refusal assertions
  plus `gen-B healthy against still-migrated state` and the shared=5/agent=14
  forward-recovery stamp assertions.
- `logs/v3-refusal-journal.log` — rerun raw refusal journal.

### Operator gate

Do not activate B unless the service is stopped and a snapshot of every
database and WAL sidecar exists and has been verified restorable. Do not
permit A to start against B-migrated state.

### Forward recovery

If snapshot restore is unavailable or rejected, keep A stopped. Select B, or
a newer generation compatible with shared schema 5 and per-agent schema 14,
start that generation against the migrated state, and run acceptance. Preserve
the failed state and snapshot for operator diagnosis. The rerun's intermediate
B-health leg proves the compatibility premise before the harness performs its
normal snapshot restore and A rollback.
