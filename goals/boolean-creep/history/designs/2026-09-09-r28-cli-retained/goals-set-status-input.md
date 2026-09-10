# Instance

- id: `goals-set-status-input`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
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

The inventory's six legal boolean tuples are exact: migration permits
`write=false|true` only when preview is false; transition permits
`preview=false|true` and currently accepts either write value because `write`
is ignored outside migration. The two migrate-plus-preview tuples are invalid.
Payload coherence further constrains both families.

# Target schema

Define `GoalStatusMigrationInput` (`mode: S.tag("migration")`, `write`) and
`GoalStatusTransitionInput` (`mode: S.tag("transition")`, required `slug`,
required decoded status, `preview`), then `S.toTaggedUnion("mode")`. The CLI
adapter validates raw arguments and constructs one case. It preserves the
existing migrate/preview conflict and missing/invalid status errors before
application execution.

At the raw CLI adapter, preserve current ordered validation. For migration,
reject any slug/status first, then reject preview, then construct the migration
case with `write`. For transition, reject missing slug/status, then invalid
status, then construct the transition case and deliberately discard the raw
`write` flag. Transition-plus-write is accepted legacy CLI behavior, not a new
error and not decoded domain state.

# Migration inventory

- `SetStatus.ts:450-481` — retain all three raw CLI flags and defaults. Replace
  `SetStatusInput` and `runMigrateMode` with named cases; migration owns only
  `write`. Preserve slug/status-before-preview error precedence.
- `SetStatus.ts:483-496` — match once; transition owns slug/status/preview so
  Option and migrate guards disappear downstream.
- `SetStatus.ts:512-516` — retain current parser flags and optional arguments,
  validate them in the order above, and construct a case. Accept and discard
  transition `--write` exactly as today.
- Preserve `setStatusForSlug`, `runGoalsMigration`, and portfolio-index writes.

# Guard-deletion accounting

Delete `if (input.migrate)`, the application-layer migrate/preview conflict,
both slug/status Option guards, and boolean fields that do not belong to the
selected case. Boundary validation remains for user input.

# Encoded-side impact

none (internal). CLI spellings, defaults, messages, preview no-write, migration dry-run,
and status/manifest/event encodings remain stable.

# Test impact

Table-test all eight raw boolean triples with coherent payloads where possible:
migration dry-run/write, both migrate-plus-preview failures, and all four
transition preview/write combinations. Separately test migration slug/status
precedence, transition missing arguments, invalid status, preview no-write,
and ignored transition `--write`. Retain canonical Goals index assertions.

# Risk and sequencing

Land in Tier 1E. This command is the final closeout writer, so preserve CAS
event planning, ignored Goals-index projection behavior, exact errors, and the
currently tolerated transition `--write` input.
