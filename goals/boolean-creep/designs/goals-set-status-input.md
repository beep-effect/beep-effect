# Instance

- id: `goals-set-status-input`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts:463`
- symbol: `SetStatusInput`
- members: `migrate`, `preview`, `write`
- evidence: E2 at `SetStatus.ts:471-495` — migrate rejects the per-slug
  preview flag and owns the write/dry-run axis; per-slug transition owns
  preview and forbids missing slug/status payload.

# Current shape

The five-field bag mixes two command cases: a fleet migration carrying
`write`, or a per-slug transition carrying `slug`, `status`, and `preview`.

# Cardinality gap

Eight boolean triples are representable before payload coherence; only the two
case families are meaningful.

# Target schema

Define `GoalStatusMigrationInput` (`mode: S.tag("migration")`, `write`) and
`GoalStatusTransitionInput` (`mode: S.tag("transition")`, required `slug`,
required decoded status, `preview`), then `S.toTaggedUnion("mode")`. The CLI
adapter validates raw arguments and constructs one case. It preserves the
existing migrate/preview conflict and missing/invalid status errors before
application execution.

# Migration inventory

- `SetStatus.ts:463-481` — replace `SetStatusInput` and `runMigrateMode` with
  named cases; migration owns only `write`.
- `SetStatus.ts:483-496` — match once; transition owns slug/status/preview so
  Option and migrate guards disappear downstream.
- `SetStatus.ts:512-516` — retain current parser flags and optional arguments,
  validate them at the adapter, and construct a case.
- Preserve `setStatusForSlug`, `runGoalsMigration`, and portfolio-index writes.

# Guard-deletion accounting

Delete `if (input.migrate)`, the application-layer migrate/preview conflict,
both slug/status Option guards, and boolean fields that do not belong to the
selected case. Boundary validation remains for user input.

# Encoded-side impact

none (internal). CLI spellings, messages, preview no-write, migration dry-run,
and status/manifest/event encodings remain stable.

# Test impact

Table-test migration dry-run/write, illegal migration preview, illegal
slug/status with migration, transition preview/write, missing arguments, and
invalid status. Retain canonical Goals index assertions. Run full repo-CLI
verification.

# Risk and sequencing

Land in Tier 1E. This command is the final closeout writer, so preserve CAS
event planning, ignored Goals-index projection behavior, and exact errors.
