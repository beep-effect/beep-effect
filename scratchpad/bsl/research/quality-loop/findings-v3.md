### v3-sqlite-1: Physical column names can collide or contain SQLite-invalid NUL bytes

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §Lens V3; live `bun:sqlite` identifier probes
- `affectedFiles`: scratchpad/bsl/src/sqlite/model.ts:356; scratchpad/bsl/src/sqlite/table.ts:187; scratchpad/bsl/src/sqlite/combinators.ts:626
- `evidence`: BSL accepted `userId` plus `user_id` and projected both as `user_id`; SQLite rejected the resulting shape with `duplicate column name: user_id`. BSL likewise accepted physical names `foo` plus `FOO`, which SQLite treats as duplicates, and accepted `columnName("nul\u0000name")`, while SQLite rejected the identifier with `unrecognized token`.
- `impact`: Valid BSL models can fail during migration because physical-name uniqueness is neither checked after snake-casing nor compared using SQLite’s case-insensitive identifier semantics.
- `suggestedFix`: Validate every derived/overridden physical name at model construction, reject NUL, and reject case-folded collisions after snake-casing. Apply the Wave-D cheap type-level name rules with a complete runtime mirror.
- `acceptanceCommands`: add positive and compile/runtime-negative fixtures, then run `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### v3-sqlite-2: NUMERIC string and bigint modes do not preserve their encoded carriers

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: installed `drizzle-orm/sqlite-core/columns/numeric.js`; verification charter §SQLite type-affinity surprises; live BSL/Drizzle/`bun:sqlite` round-trip
- `affectedFiles`: scratchpad/bsl/src/sqlite/combinators.ts:160; scratchpad/bsl/src/sqlite/Column.ts:266
- `evidence`: BSL projected `String.pipe(numeric())` as `string numeric` and `BigInt.pipe(numeric({ mode: "bigint" }))` as `bigint int64`. Inserting `"3.0e+5"` through the projected Drizzle table stored SQLite integer `300000`, losing the original string. Inserting `9223372036854775809n` stored REAL `9223372036854776000`; selecting through Drizzle then failed with `SyntaxError: Failed to parse String to BigInt`.
- `impact`: The API’s stated decimal-string precision preservation is false, and bigint values can be corrupted before reads fail.
- `suggestedFix`: Do not advertise NUMERIC affinity as representation-preserving. Use TEXT for exact decimal strings; bound bigint mode to SQLite’s signed 64-bit range with type/runtime documentation and live boundary tests, or remove that mode.
- `acceptanceCommands`: add live round-trips for exponent strings, leading zeros, fractional precision, signed-64-bit boundaries, and overflow; run `bun test scratchpad/bsl/test/sqlite-live.test.ts scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

### v3-sqlite-3: Parameterized typed SQL is accepted for schema expressions that prohibit parameters

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §CHECK expression restrictions; live `SQLiteDialect.sqlToQuery` and `bun:sqlite` probes
- `affectedFiles`: scratchpad/bsl/src/sqlite/combinators.ts:407; scratchpad/bsl/src/sqlite/combinators.ts:574; scratchpad/bsl/src/sqlite/extras.ts:353; scratchpad/bsl/src/sqlite/extras.ts:378
- `evidence`: BSL accepted typed CHECK and partial-index expressions containing `${0}`. The installed dialect rendered each as `"table"."a" > ?` with `params: [0]`. SQLite rejected them with `parameters prohibited in CHECK constraints` and `parameters prohibited in partial index WHERE clauses`. Parameterized generated expressions were rejected with `parameters prohibited in generated columns`; parameterized defaults were rejected as non-constant.
- `impact`: Ordinary, typed Drizzle interpolation produces migrations SQLite cannot apply.
- `suggestedFix`: At projection, render every typed schema expression through `SQLiteDialect.sqlToQuery` and raise a tagged error whenever `params.length !== 0`. Cover defaults, generated columns, CHECKs, and partial indexes.
- `acceptanceCommands`: add runtime-negative fixtures for all four surfaces, then run `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

### v3-sqlite-4: Typed expression carrier checks do not cover SQLite’s schema-expression grammar

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §generated/CHECK restrictions; live `bun:sqlite` DDL probes
- `affectedFiles`: scratchpad/bsl/src/sqlite/combinators.ts:387; scratchpad/bsl/src/sqlite/combinators.ts:553; scratchpad/bsl/src/sqlite/extras.ts:334; scratchpad/bsl/src/sqlite/extras.ts:359
- `evidence`: BSL accepted `generated(sql\`random()\`)`, while SQLite rejected it with `non-deterministic functions prohibited in generated columns`. BSL accepted `defaultExpr(sql\`a + 1\`)`, while SQLite rejected the column-referencing default as non-constant. SQLite also rejected subqueries and non-deterministic functions in CHECK and partial-index predicates, but the typed BSL surfaces currently classify only the TypeScript carrier.
- `impact`: “Typed SQL” can be carrier-correct yet illegal SQLite DDL, without rejection or documented deferral.
- `suggestedFix`: Reject reliably detectable prohibited constructs and document the remaining SQLite expression grammar as a loud boundary in each affected API’s Gotchas and the README. Add representative live negative tests.
- `acceptanceCommands`: run new expression-legality fixtures with `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

### v3-sqlite-5: Invalid SQLite table cardinalities pass model construction

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §zero-field/only-generated models; live `PRAGMA compile_options` and DDL probes
- `affectedFiles`: scratchpad/bsl/src/sqlite/model.ts:425; scratchpad/bsl/src/sqlite/table.ts:325
- `evidence`: BSL accepted and projected a zero-field model, while SQLite rejected `CREATE TABLE ... ()` with a syntax error. BSL accepted a table containing only a stored generated column, while SQLite rejected it with `must have at least one non-generated column`. BSL also projected 2,001 columns; this `bun:sqlite` reports `MAX_COLUMN=2000` and rejected the table with `too many columns`.
- `impact`: Structurally valid BSL models can be uncreatable on the supported live database.
- `suggestedFix`: Reject empty models and models with no ordinary column at construction. Enforce the supported 2,000-column ceiling and document that custom SQLite builds may impose a lower runtime limit.
- `acceptanceCommands`: add 0-column, generated-only, 2,000-column, and 2,001-column fixtures; run `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

### v3-sqlite-6: Referential actions are not checked against source nullability/default policy

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §FK referential-action constraints; live assembled-BSL and `bun:sqlite` action probe
- `affectedFiles`: scratchpad/bsl/src/sqlite/combinators.ts:655; scratchpad/bsl/src/sqlite/schema.ts:629
- `evidence`: BSL assembled a non-null `pid` foreign key with `onDelete: "set null"`; Drizzle config confirmed `sourceNotNull: true` and `onDelete: "set null"`. SQLite accepted the DDL but deleting the parent failed at action time with `NOT NULL constraint failed: c.pid`.
- `impact`: Assembly reports success for a referential action that cannot complete, turning a declared cascade policy into a production-time write failure.
- `suggestedFix`: Reject `SET NULL` unless the source schema is nullable. Reject `SET DEFAULT` unless a database default exists, and document that the default must reference a live parent when the action executes.
- `acceptanceCommands`: add live delete/update action cases for nullable/non-null and defaulted/non-defaulted sources; run `bun test scratchpad/bsl/test/sqlite-live.test.ts scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

### v3-sqlite-7: Explicit index names are not unique across SQLite’s schema namespace

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §name invariants; live BSL assembly and `bun:sqlite` index probe
- `affectedFiles`: scratchpad/bsl/src/sqlite/extras.ts:353; scratchpad/bsl/src/sqlite/schema.ts:586
- `evidence`: BSL assembled two tables that each declared `Table.index("shared_idx", ...)`. Both projected successfully. SQLite created the first index and rejected the second with `index shared_idx already exists`.
- `impact`: Independently valid model extras can collide only at migration time because SQLite index names are schema-global rather than table-local.
- `suggestedFix`: During assembly, inventory explicit index names case-insensitively across every table and reject duplicate names and relevant table/index namespace collisions with `SchemaAssemblyError`.
- `acceptanceCommands`: add cross-table duplicate and case-folded index-name fixtures, then run `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

### v3-sqlite-8: Literal defaults are carrier-checked but not valid encoded or SQLite values

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter §default-value validity; installed drizzle-kit default rendering; live BSL and `bun:sqlite` probes
- `affectedFiles`: scratchpad/bsl/src/sqlite/combinators.ts:380; scratchpad/bsl/src/sqlite/table.ts:196
- `evidence`: `Finite.pipe(real(), defaultValue(...))` accepted `NaN`, positive infinity, and negative infinity because `default()` checks only the `number` carrier. SQLite stored `NaN` and `Infinity` defaults as TEXT despite the REAL column, while negative infinity produced invalid DDL. BSL also accepts NUL-containing string defaults, whose rendered SQL literal is rejected by SQLite.
- `impact`: A default can violate the owning Effect schema, silently return the wrong carrier, or prevent migration.
- `suggestedFix`: Validate literal defaults against the field’s encoded schema and SQLite representability during model construction; explicitly reject non-finite numeric defaults and NUL-containing text defaults.
- `acceptanceCommands`: add compile/runtime/live cases for quoted strings, NUL, finite bounds, `NaN`, and both infinities; run `bun test scratchpad/bsl/test/sqlite-unit.test.ts scratchpad/bsl/test/sqlite-live.test.ts`
- `status`: open

Summary: 8 required findings (8 blocking, 0 non-blocking).


