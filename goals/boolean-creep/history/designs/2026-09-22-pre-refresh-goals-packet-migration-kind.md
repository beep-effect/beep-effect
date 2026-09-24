# R28 P2 design: goals-packet-migration-kind

Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Native P2 source/design proof is bound by `data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md` and the original bytes are archived by `data/r28-cli-retained-integration.json`. Independent replacement P3 design review remains pending; no prior review approval is transferred and no product implementation or test acceptance is claimed. Preserve the complete decoded API, public schema/method/test-kit exports, full payloads and encoded outputs described below. Raw request defaults, typed diagnostics and their ordering remain supported contracts; their D1 owners are not implementation targets of this returned-state migration.

# Instance

- id: `goals-packet-migration-kind`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source SHA: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration.ts:349`
- symbol: `GoalPacketMigration`
- members: `isBackfill`, `parked`, `manifestText`, `readmeText`
- evidence: E1 at `Migration.ts:365-389,573-607` — parked, backfill, and four mechanical output patterns are constructed from the same edit accumulator; E2 at `SetStatus.ts:109-119` consumes kind and output presence.

# Current shape

GoalPacketMigration343–355 is the exported pure planner's returned class.
isBackfill is an optional Boolean with absent/false/true; parked,
manifestText and readmeText are independently optional strings. Edits is a
required ordered string array and slug is required text. Production parked365
omits the Boolean and texts, backfill384 writes true plus manifest, and
mechanical602 omits the Boolean and owns either/both/neither text. Generic
.make acceptance does not establish a supported explicitfalse operation;
no live constructor/decoder fixture does so.

# Cardinality gap

Actual members [isBackfill,parked,manifestText,readmeText] represent
3 ×2 ×2 ×2 = **24** combinations. **6** are supported: parked; backfill;
mechanical unchanged, manifest-only, README-only, both. Required edit-array
emptiness is not an extra Boolean axis. Keep the array's exact contents/order
and correspondence to changed text as payload invariants, including empty
edits on unchanged/parked and nonempty descriptions for changes.

# Target schema

Define `GoalPacketMigrationKind` with `unchanged`, `manifest-change`, `readme-change`, `manifest-and-readme-change`, `backfill`, and `parked`, and make `GoalPacketMigration` a tagged union. Parked alone owns a nonempty question. Backfill owns manifest text and a nonempty edit sequence. The changed mechanical cases own exactly their corresponding texts and nonempty ordered edits; unchanged owns neither and has no edits. Migrate all constructors and readers atomically; do not retain the broad optionals or an explicit-false case.

# Migration inventory

- `Migration.ts:325-355` — replace the four finite members and preserve the required ordered edits payload; use named cases and retain `slug`, exact edit strings/order, and output texts.
- `Migration.ts:365-389` — construct parked and backfill cases directly; keep every parked question and generated manifest byte unchanged.
- `Migration.ts:547-607` — select one of the four mechanical cases while preserving JSONC edit order and exact output texts.
- `SetStatus.ts:104-120` — exhaustively match kind; preserve parked logging, write behavior, and the same four counters.
- `test/goals-command.test.ts:108-210` — migrate ordinary, backfill, and parked assertions; add rejection coverage for explicit false and parked/boolean cases.
- Whole-source search found no additional reader or writer of `isBackfill` or `parked`.

# Guard-deletion accounting

Replace SetStatus109 parked presence branch and116–118 backfill/text
coordination with exact case matches. applyMigrationPlan65–84 no longer needs
optional output reconstruction to know which output is owned by the case;
write permission and filesystem creation/writes remain at the same times.
Delete all three constructors' optional kind/payload spreads and isBackfill
assignments. Preserve the edit accumulator and every edit description; no
invented required-array Boolean guard is counted. Schema-derived case guards
replace manual cases; raw command usage validators remain unchanged.

# Encoded-side impact

The plan itself has no live encode/decode or persisted boundary. It is a
public exported planner/class via Goals and the test kit, so every known
constructor/example/caller migrates atomically. Generated JSONC manifest and
README text are the actual output boundary and must stay byte-identical,
including comments, newlines, parked messages, edit order and counters.
Required text arrays do not become an encoded presence tag.

# Test impact

Add schema-derived construction coverage for all six cases. Retain malformed/unmapped parking questions, P0 backfill bytes, JSONC comment/format preservation, status/phase/supersession edits, README rewriting, no-change behavior, dry-run output, and counter tests.

# Risk

Tier1 with the packet planning batch. Do not change P0 backfill decisions,
status normalization, human parking questions, output omission, generated
bytes or dry-run/write behavior. OptionalBoolean false is a representable
third value; it is counted as such and excluded from target operations only
on complete writer/fixture/consumer evidence, not callback-produced truthiness.

Local Effect v4 schema APIs: `.repos/effect/packages/effect/src/Schema.ts:6105`
provides S.toTaggedUnion;6255 provides S.TaggedUnion. Use existing LiteralKit
values for discriminants, named schema classes/cases and derived S.is guards.
No hand-rolled literal-union replacement or opaque always-true validator.

Landing: use the ordered Tier 1E internal tooling subsystem batches, not singleton PRs per Tier 1 record. Coordinate the Goals packet planner, transition plan and transition outcome in one subsystem batch. Plan precedes outcome in their shared PacketTransitionWriter.ts, with SetStatus/SetRiskTier and migration consumer edits applied serially; each guard deletion has one owner. The D1 Goals request validators remain intact.
