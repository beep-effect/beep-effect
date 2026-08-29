### correctness-1: SQLite descriptor guard accepts malformed same-family specs and can throw raw errors

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: standing module law requiring closed-shape runtime mirrors; round7-brief.md §B spec-family invariant
- `affectedFiles`: scratchpad/bsl/src/sqlite/Column.ts:260; scratchpad/bsl/src/sqlite/model.ts:425
- `evidence`: `SqliteColumn.isSpec({_tag:"text", dialect:"sqlite", kind:"blob", ident:"forged", mode:"text"})` returns `true`; model construction preserves the forged identity while projection emits a TEXT column. An enum-tagged object missing `values` can instead throw from `value.values.length`. The PostgreSQL guard validates tag-correlated shape and identities, but the SQLite guard only checks that `kind` and `ident` are strings.
- `impact`: Suppressed or dynamically authored metadata can corrupt FK storage compatibility or escape the promised tagged `ModelInvariantError` boundary with a raw `TypeError`.
- `suggestedFix`: Validate each tag’s exact `kind`, `ident`, required properties, and modes; validate enum `values` as a non-empty string array before reading it and validate EntityId identifier syntax.
- `acceptanceCommands`: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`; `bun test scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

### correctness-2: Enum CHECK generation cannot represent NUL-containing schema literals

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: round7-brief.md locked decision 5 and §C.4; README.md claim that enum values derive from the encoded domain and are enforced by SQLite
- `affectedFiles`: scratchpad/bsl/src/sqlite/table.ts:268
- `evidence`: A model using `Literals(["safe", "nul\0value"]).pipe(sqlite.enum())` renders `"status" in ('safe', 'nul\u0000value')`. Executing equivalent DDL against `bun:sqlite` fails with `unrecognized token: "\"nul"`. By contrast, `CAST(X'6e756c0076616c7565' AS TEXT)` creates successfully and accepts the same bound string.
- `impact`: A valid finite string-literal schema can produce unusable DDL, contradicting the enum mechanism’s advertised domain coverage.
- `suggestedFix`: Emit enum literals as UTF-8 hexadecimal text expressions such as `CAST(X'…' AS TEXT)`, then add apostrophe, Unicode, and embedded-NUL unit/live cases.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

### correctness-3: Plain INTEGER primary keys disagree between Effect inserts and installed Drizzle semantics

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: installed `drizzle-orm/sqlite-core/columns/integer.d.ts:14-21`; installed `integer.js:13-16`; standing both-sides invariant
- `affectedFiles`: scratchpad/bsl/src/sqlite/model.ts:114; scratchpad/bsl/src/sqlite/model.ts:390; scratchpad/bsl/src/sqlite/table.ts:78; scratchpad/bsl/src/sqlite/table.ts:190
- `evidence`: For `Int.pipe(sqlite.integer(), sqlite.primaryKey())`, the installed builder and projected Drizzle column set `hasDefault: true`, making `$inferInsert.id` optional even without `AUTOINCREMENT`; `is(Model.insert)({ name: "x" })` returns `false` because the Effect insert variant still requires `id`. The projected column reports `autoIncrement: false`.
- `impact`: The two public insert boundaries disagree about a valid SQLite rowid omission, so code accepted by Drizzle cannot pass the schema-owned insert boundary.
- `suggestedFix`: Treat every number-mode SQLite `INTEGER PRIMARY KEY` as insert-optional in both type-level and runtime variant construction; keep `autoIncrement()` responsible only for the `AUTOINCREMENT` reuse policy and identity metadata.
- `acceptanceCommands`: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`; `bun test scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

### correctness-4: Live SQLite tests share and unconditionally delete one global database path

- `label`: issue
- `blockingStatus`: non-blocking
- `severity`: P2-medium
- `sourceRefs`: live-gauntlet harness inspection
- `affectedFiles`: scratchpad/bsl/test/sqlite-live.test.ts:83; scratchpad/bsl/test/sqlite-live.test.ts:140
- `evidence`: Every invocation uses `/tmp/effect-drizzle-round7-live.sqlite` and unconditionally deletes that file plus its WAL/SHM siblings before and after execution. Concurrent invocations can delete or mutate each other’s database.
- `impact`: Parallel local or CI reviews can produce false migration, locking, no-op, or cleanup failures; an existing file at that fixed path is also destroyed.
- `suggestedFix`: Allocate a per-run temporary directory/database, retain its explicit resolved path, and remove only that owned directory during cleanup.
- `acceptanceCommands`: Run two concurrent `bun test scratchpad/bsl/test/sqlite-live.test.ts` processes and require both to pass independently.
- `status`: open

4 total findings, 3 blocking.
