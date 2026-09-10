# Instance

- id: `goals-packet-migration-kind`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration.ts:349`
- symbol: `GoalPacketMigration`
- members: `isBackfill`, `parked`, `manifestText`, `readmeText`, `edits`
- evidence: E1 at `Migration.ts:365-389,573-607` — parked, backfill, and four mechanical output patterns are constructed from the same edit accumulator; E2 at `SetStatus.ts:109-119` consumes kind and output presence.

# Current shape

The schema mechanically accepts `isBackfill` as absent, false, or true and independently accepts an optional parked question. Production omits the boolean for mechanical and parked plans and writes true for backfills. No documentation, fixture, writer, decoder call, or persisted input establishes explicit false as supported. `processGoalMigration` checks parked first, so its fallback comparisons consume every schema-permitted crossed tuple and cannot selectively prove false/no-parked. `manifestText`, `readmeText`, and `edits` carry the exact planned edits.

# Cardinality gap

Optional-boolean state (absent/false/true), three presence bits, and edit-list emptiness represent 48 tuples. Six are legal: parked with no texts and empty edits; backfill with manifest text, no README text, and nonempty edits; and four mechanical cases (neither output/empty edits, manifest only/nonempty, README only/nonempty, or both/nonempty). Every mechanical manifest mutation appends an edit at lines 573-578 and is exposed only when text changed at line 605; every README output is appended with its edit at lines 591-598. Explicit false and crossed kind/payload tuples are unsupported.

# Target schema

Define `GoalPacketMigrationKind` with `unchanged`, `manifest-change`, `readme-change`, `manifest-and-readme-change`, `backfill`, and `parked`, and make `GoalPacketMigration` a tagged union. Parked alone owns a nonempty question. Backfill owns manifest text and a nonempty edit sequence. The changed mechanical cases own exactly their corresponding texts and nonempty ordered edits; unchanged owns neither and has no edits. Migrate all constructors and readers atomically; do not retain the broad optionals or an explicit-false case.

# Migration inventory

- `Migration.ts:325-355` — replace the five-field cluster with the named cases; retain `slug`, exact edit strings/order, and output texts.
- `Migration.ts:365-389` — construct parked and backfill cases directly; keep every parked question and generated manifest byte unchanged.
- `Migration.ts:547-607` — select one of the four mechanical cases while preserving JSONC edit order and exact output texts.
- `SetStatus.ts:104-120` — exhaustively match kind; preserve parked logging, write behavior, and the same four counters.
- `test/goals-command.test.ts:108-210` — migrate ordinary, backfill, and parked assertions; add rejection coverage for explicit false and parked/boolean cases.
- Whole-source search found no additional reader or writer of `isBackfill` or `parked`.

# Guard-deletion accounting

Delete the `parked !== undefined`, `isBackfill === true`, `isBackfill !== true`, manifest/readme presence coordination, edit-emptiness coordination, and all writes of those optionals. Replace them with exhaustive matches. Keep the edit accumulator while planning because it preserves exact ordered descriptions before selecting the final case.

# Encoded-side impact

There is no encoded boundary: this is an internal transient plan. Preserve generated manifest/README bytes and edit ordering while migrating decoded constructors atomically. Explicit false is only syntactically admitted by the old broad schema and has no compatibility evidence.

# Test impact

Add schema-derived construction coverage for all six cases. Retain malformed/unmapped parking questions, P0 backfill bytes, JSONC comment/format preservation, status/phase/supersession edits, README rewriting, no-change behavior, dry-run output, and counter tests.

# Risk and sequencing

Land in the serial Tier 1 packet-model batch. Do not infer compatibility from broad schema acceptance or the parked-first reader. Preserve every generated text byte and ordered edit description in its exact case.
