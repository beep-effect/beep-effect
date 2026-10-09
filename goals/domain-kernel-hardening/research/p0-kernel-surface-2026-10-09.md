# P0 kernel surface reconciliation — 2026-10-09

Status: complete. Both corrected candidate measurements finished; the prototype
was reverted before PR 1. The selected shape is below.

## Prerequisites and tier map

| Historical prerequisite | Live evidence | Outcome |
| --- | --- | --- |
| Exploration grounding | `explorations/domain-layer-hardening/BRIEF.md`; `DECISIONS.md:116-130`; `MAP.md`; syntheses 10 and 19 | Present; read by reference. G1/G2/G12 require recoverable attributable records, not filtering here. |
| Shared/rich/error laws | `standards/architecture/02-shared-kernel.md:95,184`; `04-rich-domain-model.md:128`; `09-errors-across-boundaries.md:7` | Present; extend the promoted contract and use direct TaggedError role files. |
| ProductEntity persisted base | `packages/shared/domain/src/entity/ProductEntity.ts:34,57`; `EntityKit.ts` column packs | Present but rewritten: kit metadata replaces persisted descriptors. |
| Rich Principal | `packages/shared/domain/src/entity/Principal.ts:75,229` | Present: User, ServiceAccount, Agent, ConnectorAccount, System. |
| EntitySchema.persist descriptor | #720 `1e9d946750`; `.changeset/housekeeping-entity-stack.md` | Deleted; replacement is effect-drizzle Pg metadata and Model variant fields. |
| DomainModel retirement | `git show 1e9d946750 -- packages/foundation/modeling/schema/src/DomainModel.ts`; housekeeping changeset | Already satisfied. Remaining category vocabulary and a stale detector regex are outside scope. |
| TaggedErrorClass | `packages/shared/domain/src/entity/EntityRef.ts:25`; error standard | Retired in favor of direct S.TaggedError; kernel invariant is still private in EntityRef.ts. |
| Resume condition | Orchestrator brief ruling 2026-10-09; `docs/ROADMAP.md` Corpus gate | Ruled met by practice-kg bundle v2. Roadmap rows are orchestrator-owned. |
| Packet CLI and reflection | Successful adopt plan, set-status preview, reflection lint; packet reflection template | Present; owner commands generate events and trace. |
| Migration machinery | `packages/_internal/db-admin/AGENTS.md`; desktop codegen scripts | Drizzle-kit generates additive nullable columns; no live DB use. |

| Tier | Live composition | Proposed soft-delete coverage |
| --- | --- | --- |
| Base | `BaseEntity.ts:28` uses baseColumns | No; timestamps and row version only. |
| Audit | `AuditEntity.ts:28` extends Base with withAudit | Yes, canonical audit pack. |
| Org | `OrgEntity.ts:26` extends Audit with withOrg | Yes. |
| Product | `ProductEntity.ts:34` shares Org kit; fields spreads base/audit/org | Yes. |

## Packet materialization evidence

- Initial `goals adopt domain-kernel-hardening --plan --json`: 12 entries,
  conflicts empty; 10 retain, 1 preserve, 1 report (research/SOURCES.md).
- `goals set-status ... active --preview`: paused to active, event 2 status-set,
  derived revision 2 and stage P0; preview wrote nothing.
- Owner-command activation appended event 2 and regenerated trace.
- After SOURCES authoring and researchReports registration: no report rows and
  conflicts empty. Manifest is edited in place; unmodeled keys remain intact.

## Candidate encodings

The installed `effect/schema/Model` declarations and local Effect reference
source agree:

- `GeneratedByApp(OptionFromNullOr(codec).pipe(withConstructorDefault(succeedNone)))`
  has select/insert/update/json variants, omits JSON writes, and permits omitted
  deletion fields in constructors. A runtime probe confirms constructor omission
  yields Option.none. Timestamp codec is DateTimeUtcFromMillis with Pg.bigint
  number metadata; principal codec is Principal with Pg.jsonb metadata.
- `FieldOption(codec)` maps database variants to OptionFromNullOr and exposes
  json/jsonCreate/jsonUpdate optional-option variants. Its outer Option wrapper
  does not inherit a constructor default. It also exposes audit fields to JSON
  writes. The dependent measurement must establish the practical blast radius.

No paired-nullness CHECK is planned: this packet models the field pair, and the
migration contract permits only additive nullable columns. Enforcement belongs
to later work.

## Measured blast radius

Pending: `beep-heavy bunx turbo run check --filter=...@beep/shared-domain` with
the GeneratedByApp candidate. The first invocation failed before admission
because the shell lacked user-bus environment; retry includes that environment
and is queued. No compiler diagnostic is inferred from the admission wait.

The prototype will be reverted with `git checkout -- packages` before PR 1.

### First GeneratedByApp run (completed)

The initial dependent check ran 102 planned tasks with 79 successful and 49
cached, then stopped at `@beep/workspace-tables#check` (31.054 seconds of Turbo
execution after admission). It produced 8 TS2345 diagnostics in one file,
`packages/workspace/tables/test/WorkspaceTables.test.ts`, at lines 145, 159, 175,
212, 232, 234, 237 and 244. Attribution: introduced, nullable insert fields are
optional while selected rows require their explicit null values. No entity-model
edit was indicated before fail-fast; later packages were not fully measured.

A source census additionally found four explicit insert projections that need
both new fields to preserve populated deletion metadata:

- `packages/workspace/tables/src/entities/Workspace/Workspace.converters.ts`
- `packages/workspace/tables/src/entities/Turn/Turn.converters.ts`
- `packages/workspace/tables/src/entities/Thread/Thread.converters.ts`
- `packages/workspace/tables/src/entities/Message/Message.converters.ts`

These are candidate mechanical edits only, not changes made during P0. The
FieldOption comparison uses constructor defaults applied to each variant through
Model.fieldEvolve, and `--continue=always` to collect downstream failures.

A runtime probe also confirms `withDecodingDefaultKey(Effect.succeed(null))`
on the nullable codec maps omitted legacy fixture fields to Option.none while
encoding that value back to an explicit null. This can preserve legacy decode
inputs without adding fixture helpers, provided the final dependent measurement
confirms the resulting types.

## Final measured comparison and chosen design

Both corrected checks used `beep-heavy bunx turbo run check
--filter=...@beep/shared-domain --continue=always` in one admitted job. The
prototype was then reverted with `git checkout -- packages`.

| Candidate | Admitted Turbo result | Compiler blast radius |
| --- | --- | --- |
| FieldOption with concrete per-variant constructor defaults | 129/137 successful, 61 cached, 1m14.397s; exit 2 | 33 diagnostics in 9 files: 8 table test files plus WorkspaceVault.repo.ts production fixture. |
| GeneratedByApp with constructor default none and missing-key decoding default null | 131/137 successful, 61 cached, 1m13.856s; exit 1 | 32 diagnostics in 8 table test files; zero converters or entity-model compiler errors. |

| Package | Test files | Diagnostics | Entity-model/behavior changes |
| --- | --- | --- | --- |
| @beep/agents-tables | ProviderInstanceTable.test.ts | 5 | 0 |
| @beep/architecture-lab-tables | WorkerTable.test.ts | 2 | 0 |
| @beep/documents-tables | SyncConflictTable.test.ts, SyncCursorTable.test.ts, SyncItemTable.test.ts, SyncOperationTable.test.ts | 7 | 0 |
| @beep/epistemic-tables | EpistemicTables.test.ts | 10 | 0 |
| @beep/workspace-tables | WorkspaceTables.test.ts | 8 | 0 |

All 32 diagnostics concern newly nullable table select fields and insert-shaped
fixtures with absent/optional deletion fields. The four explicit workspace insert
converters additionally need two-field projection additions to preserve populated
values. Conservative bound: 36 mechanical edit sites across 12 files, below the
40-site stop threshold. Slice models and behaviors remain untouched.

The db-admin failure is introduced and expected before migration generation:
its drift preview contains exactly 52 nullable ADD COLUMN statements across the
26 audited baseline tables, exclusively deleted_at bigint and
deleted_by_principal jsonb. No backfill, rename, drop or recreate appears.

Choose GeneratedByApp with both defaults: it preserves constructors, old decode
inputs and production fixtures; excludes audit fields from JSON writes; persists
none as null. FieldOption is rejected for JSON write exposure and the extra
production fixture requirement. Mechanical table fixtures supply explicit nulls
when constructing select rows from optional insert types. Preserve populated
values in the four converters. Record a major shared-domain changeset because
external insert projections and fixtures need changes under the charter.

No paired-nullness CHECK or enforcement is introduced. D1-D8 in SPEC record
placement, scope and reversal. PR 1 activates and reconciles this contract before
PR 2 touches the named implementation/generated surfaces.

### Pre-publish main reconciliation

Main merge brought in #1566 (`2eefbb64af`), which removed historical changeset
notes under the new manifest-aware release policy. Kernel source and this packet
were unchanged. The housekeeping changeset cited above was read on disk during
P0 and is now cited as the verified local Git blob
`1e9d946750:.changeset/housekeeping-entity-stack.md`. The deletion does not undo
DomainModel retirement or alter the compiler measurement. No source package or
migration consumer changed in this merge.
