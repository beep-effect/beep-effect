## PostgreSQL invariant classification

| Area | Classification | Evidence |
|---|---|---|
| Positive integral `varchar`/`char` length | validated | Zero, negative, and fractional lengths throw `ColumnInvariantError`. |
| PostgreSQL maximum character length | SILENT-GAP → v2-pg-5 | `varchar(10485761)` reaches PGlite and is rejected. |
| Numeric positive precision/nonnegative scale | validated, conservatively | Zero precision and negative scale are rejected before projection. |
| Numeric PostgreSQL upper bounds | SILENT-GAP → v2-pg-5 | Precision `1001` and scale `1001` reach PGlite and fail. |
| Enum finite/nonempty set, duplicate values, NUL | validated | BSL deduplicates, requires at least one value, and rejects NUL. |
| Empty enum label | validated | PGlite applied `ENUM('', 'ok')`. |
| Enum label 63-byte limit | SILENT-GAP → v2-pg-4 | A 64-byte label reaches `CREATE TYPE` and fails. |
| Identifier nonempty/NUL/63-byte rules | SILENT-GAP → v2-pg-1 | Empty and NUL names fail; long names silently truncate. |
| Post-normalization/truncation uniqueness | SILENT-GAP → v2-pg-2 | `userId` + `user_id` becomes one column; long names collide. |
| SQL object-name namespaces | SILENT-GAP → v2-pg-3 | Cross-table duplicate index names fail; duplicate extras disappear. |
| Quoted string defaults | validated | Apostrophe-bearing text default applied correctly. |
| Bigint literal defaults | validated | `9223372036854775807n` applied correctly. |
| Real special-value and bytea defaults | SILENT-GAP → v2-pg-6 | `Infinity`, `NaN`, and `Uint8Array` generate invalid DDL. |
| Composite minimum arity | validated | Composite keys require at least two columns; indexes require one. |
| Duplicate composite members | SILENT-GAP → v2-pg-7 | PostgreSQL rejects `PRIMARY KEY(a,a)` and `UNIQUE(a,a)`. |
| Multiple/same-named extras | SILENT-GAP → v2-pg-8 | Drizzle-kit silently retained only the first descriptor. |
| Nullable composite unique | validated | PostgreSQL accepted duplicate `(NULL,NULL)` rows. |
| Nullable composite primary key | SILENT-GAP → v2-pg-9 | PostgreSQL silently makes members `NOT NULL`; BSL insert accepts null. |
| FK target uniqueness/type/carrier | validated | Assembly rejects missing, nonunique, or incompatible targets. |
| FK action feasibility | SILENT-GAP → v2-pg-10 | `SET NULL` on a non-null source applies at DDL but fails on delete. |
| Typed CHECK parameters | validated | Drizzle inlines literals; no database parameter remains. |
| CHECK/generated/index expression legality | SILENT-GAP → v2-pg-11 | Subqueries, volatility, and generated-column chaining reach PostgreSQL. |
| Integer and semantic scalar domains | SILENT-GAP → v2-pg-12 | BSL schemas accept values PostgreSQL rejects for integer, UUID, date, and numeric. |
| Array depth 1–5 | validated | Within PostgreSQL’s supported dimensional ceiling. |
| Multidimensional rectangularity | SILENT-GAP → v2-pg-13 | BSL accepts ragged nested arrays; PostgreSQL rejects them. |
| Zero-field model | validated | `CREATE TABLE "zero_field" ();` applied. |
| Generated-only model | validated | A constant generated-only table applied. |
| 32-index-key/1600-column ceilings | SILENT-GAP → v2-pg-14 | PGlite rejected 33-key indexes/uniques and a 1601-column table. |
| Raw `unsafe*` SQL surfaces | deferred-loudly | Their JSDoc explicitly assigns SQL validity and escaping to the caller. |
| PostgreSQL enum arrays | deferred-loudly | Existing documented PGlite parameter-serialization boundary. |
| Literal relation-name preservation | deferred-loudly | Existing documented assembly/RQB boundary. |

### v2-pg-1: PostgreSQL identifier validity and 63-byte truncation are unchecked

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter identifier candidate; `src/pg/model.ts:425`; `src/pg/table.ts:302`; `src/pg/combinators.ts:300`; installed Drizzle builders preserve names verbatim
- `affectedFiles`: `scratchpad/bsl/src/pg/model.ts:425`, `scratchpad/bsl/src/pg/table.ts:302`, `scratchpad/bsl/src/pg/combinators.ts:300`, `scratchpad/bsl/src/pg/extras.ts:258`
- `evidence`: BSL accepted a 76-byte table name, 77-byte column name, 75-byte enum name, and long index/constraint names. PGlite applied them after silently truncating every catalog name to 63 bytes. BSL also accepted `Model("")`, whose DDL failed with `zero-length delimited identifier`, and `columnName("bad\\0name")`, which failed at the wire/database boundary.
- `impact`: BSL metadata and generated SQL can name objects differently from PostgreSQL’s catalog, breaking migrations, references, introspection, and later diffs.
- `suggestedFix`: Add one PostgreSQL runtime name validator covering nonempty, no NUL, and UTF-8 byte length ≤63, and apply it to model/table, column, enum, constraint, index, and generated-name surfaces. Add the cheap Wave-D type-level subset.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "PostgreSQL identifiers"; bun test scratchpad/bsl/test/live.test.ts -t "identifier"`
- `status`: open

### v2-pg-2: Physical names are not checked for collisions after normalization or PostgreSQL truncation

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter snake-case collision candidate; `src/internal/case.ts:6`; `src/pg/table.ts:302`; `src/core/assembly.ts:99`
- `affectedFiles`: `scratchpad/bsl/src/pg/model.ts:519`, `scratchpad/bsl/src/pg/table.ts:302`, `scratchpad/bsl/src/core/assembly.ts:99`
- `evidence`: A model with logical fields `userId` and `user_id` was accepted, but drizzle-kit emitted only one `"user_id"` column. Two distinct 64-byte table names sharing their first 63 bytes passed BSL’s full-string table-name check; PGlite truncated the first and rejected the second as an existing relation. Distinct enum names behaved identically.
- `impact`: Fields may silently disappear, while apparently distinct tables or enum types become deployment-time collisions.
- `suggestedFix`: Resolve every physical name before projection and reject duplicate normalized names per table. Assembly should compare PostgreSQL-canonical byte-limited names across tables, enum types, and schema-global objects.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "physical name collision"; bun test scratchpad/bsl/test/live.test.ts -t "truncation collision"`
- `status`: open

### v2-pg-3: Constraint and index namespaces are neither validated nor preserved exhaustively

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: installed `drizzle-orm/pg-core/indexes.js:102`; installed `primary-keys.js:35`; installed `unique-constraint.js:8`; `src/pg/extras.ts:258`
- `affectedFiles`: `scratchpad/bsl/src/pg/extras.ts:258`, `scratchpad/bsl/src/pg/extras.ts:480`, `scratchpad/bsl/src/pg/schema.ts:583`
- `evidence`: Two tables each declaring `Table.index("same_index_name", ...)` passed BSL, but PGlite rejected the second with `relation "same_index_name" already exists`. A primary-key constraint named the same as its table also collided with the backing index relation.
- `impact`: Locally valid models can produce schema-global relation collisions only during migration.
- `suggestedFix`: During assembly, inventory explicit and generated relation-backed names—tables, indexes, PK/unique backing indexes—and reject namespace collisions using PostgreSQL canonical names.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "PostgreSQL name namespace"; bun test scratchpad/bsl/test/live.test.ts -t "duplicate index name"`
- `status`: open

### v2-pg-4: PostgreSQL enum labels longer than 63 bytes pass BSL

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter enum-label candidate; `src/core/literals.ts`; `src/pg/Column.ts:381`; installed `drizzle-orm/pg-core/columns/enum.js:61`
- `affectedFiles`: `scratchpad/bsl/src/core/literals.ts`, `scratchpad/bsl/src/pg/Column.ts:381`, `scratchpad/bsl/src/pg/combinators.ts:300`
- `evidence`: `Literals(["x".repeat(64), "ok"]).pipe(pg.enum("enum_long_label"))` was accepted and emitted `CREATE TYPE`; PGlite rejected the 64-byte label. The empty-string label applied successfully and must remain allowed.
- `impact`: A schema-valid finite literal domain can make migrations undeployable.
- `suggestedFix`: At the shared literal collection seam, reject enum labels whose UTF-8 length exceeds 63 bytes while continuing to allow empty labels and reject NUL.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "enum label byte length"; bun test scratchpad/bsl/test/live.test.ts -t "enum labels"`
- `status`: open

### v2-pg-5: PostgreSQL varchar and numeric upper bounds are missing

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter length/numeric candidate; `src/pg/Column.ts:345`; `src/pg/Column.ts:436`; installed `varchar.js:27`; installed `numeric.js:29`
- `affectedFiles`: `scratchpad/bsl/src/pg/Column.ts:345`, `scratchpad/bsl/src/pg/Column.ts:436`, `scratchpad/bsl/src/pg/combinators.ts:244`, `scratchpad/bsl/src/pg/combinators.ts:400`
- `evidence`: BSL correctly rejected zero/negative lengths and zero precision, but accepted `varchar(10485761)`, `numeric(1001)`, and `numeric(10,1001)`; PGlite rejected every emitted DDL statement. `numeric(1,2)` applied and must remain valid.
- `impact`: Positive-integer validation appears complete but admits values outside PostgreSQL’s legal ranges.
- `suggestedFix`: Add PostgreSQL maximum checks: character length ≤10,485,760, numeric precision ≤1,000, and legal PostgreSQL scale bounds. Mirror cheap numeric literal checks at the type boundary without recursive validation.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "PostgreSQL type bounds"; bun test scratchpad/bsl/test/live.test.ts -t "numeric bounds"`
- `status`: open

### v2-pg-6: Typed literal defaults are not safely rendered for every advertised carrier

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter default-rendering candidate; `src/pg/combinators.ts:1171`; `src/pg/table.ts:324`; installed `drizzle-orm/pg-core/columns/common.js:60`; installed `drizzle-kit/api-postgres.js:61`
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:1171`, `scratchpad/bsl/src/pg/table.ts:324`
- `evidence`: BSL accepted `real().pipe(default(Infinity))`, `default(NaN)`, and `bytea().pipe(default(new Uint8Array([0,39,255])))`. Drizzle-kit emitted `DEFAULT Infinity`, `DEFAULT NaN`, and `DEFAULT 0,39,255`; PGlite rejected all three. Apostrophe-bearing text and maximum bigint defaults applied correctly.
- `impact`: Carrier-correct defaults can still make generated migrations invalid.
- `suggestedFix`: Either implement dialect-specific literal encoding for every supported carrier or loudly reject `default()` for carriers lacking proven DDL serialization and require `defaultExpr`/explicit unsafe SQL.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "literal default rendering"; bun test scratchpad/bsl/test/live.test.ts -t "literal defaults"`
- `status`: open

### v2-pg-7: Composite constraints accept duplicate columns

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter duplicate-composite candidate; `src/pg/extras.ts:261`; `src/pg/extras.ts:361`; `src/pg/extras.ts:387`
- `affectedFiles`: `scratchpad/bsl/src/pg/extras.ts:261`, `scratchpad/bsl/src/pg/extras.ts:361`, `scratchpad/bsl/src/pg/extras.ts:387`
- `evidence`: BSL accepted `compositePrimaryKey("dup_pk", [c.a,c.a])` and `compositeUnique("dup_uq", [c.a,c.a])`. PGlite rejected them with `column "a" appears twice in primary key constraint` and `column "a" appears twice in unique constraint`.
- `impact`: The tuple arity contract does not establish the actual database invariant of distinct members.
- `suggestedFix`: Reject repeated physical columns in composite PK, unique, and index nodes at the callback runtime seam and, where literal tuples permit, at the type boundary.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "duplicate composite columns"; bun test scratchpad/bsl/test/live.test.ts -t "duplicate composite"`
- `status`: open

### v2-pg-8: Multiple primary keys and duplicate-named extras are silently discarded

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: `src/pg/model.ts:643`; `src/pg/extras.ts:512`; installed drizzle-kit PostgreSQL serialization
- `affectedFiles`: `scratchpad/bsl/src/pg/model.ts:643`, `scratchpad/bsl/src/pg/table.ts:458`, `scratchpad/bsl/src/pg/extras.ts:512`
- `evidence`: A model declaring two differently named composite primary keys was accepted, but generated DDL contained only the first. Two composite uniques with the same name were also accepted and reduced to one DDL constraint.
- `impact`: Authored schema intent disappears without either a BSL error or PostgreSQL error.
- `suggestedFix`: Validate the complete emitted extras set before passing it to Drizzle: at most one total PK across inline and composite forms, and unique descriptor names within the owning table.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "multiple primary keys"; bun test scratchpad/bsl/test/live.test.ts -t "extras preservation"`
- `status`: open

### v2-pg-9: Composite primary keys permit nullable schema members

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter nullable-composite candidate; `src/pg/combinators.ts:1049`; `src/pg/extras.ts:387`
- `affectedFiles`: `scratchpad/bsl/src/pg/extras.ts:387`, `scratchpad/bsl/src/pg/model.ts:564`
- `evidence`: BSL’s insert schema accepted `{a:null,b:1}` for nullable fields used in a composite PK. PGlite applied the DDL but silently marked both catalog attributes `attnotnull=true`; inserting the BSL-valid value then failed with a not-null violation.
- `impact`: The Effect insert contract is wider than the resulting database contract.
- `suggestedFix`: Require every composite-PK member to have a non-null encoded schema, with both tuple-level typing and a runtime mirror.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "nullable composite primary key"; bun test scratchpad/bsl/test/live.test.ts -t "composite primary key nullability"`
- `status`: open

### v2-pg-10: Referential actions are not checked against source nullability/defaults

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter FK-action candidate; `src/core/Meta.ts:30`; `src/pg/schema.ts:427`; `src/pg/schema.ts:629`
- `affectedFiles`: `scratchpad/bsl/src/pg/schema.ts:427`, `scratchpad/bsl/src/pg/schema.ts:629`, `scratchpad/bsl/src/pg/combinators.ts:1542`
- `evidence`: A non-null integer FK with `onDelete:"set null"` passed assembly and its DDL applied. After inserting a target/source pair, deleting the target failed with `null value in column "target_id" ... violates not-null constraint`.
- `impact`: The declared action exists but cannot execute, leaving deletion/update failures in production.
- `suggestedFix`: Reject `SET NULL` unless the source schema is nullable. Reject `SET DEFAULT` unless a compatible database default is declared; document that referential validity of arbitrary SQL defaults remains database-checked.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "referential action compatibility"; bun test scratchpad/bsl/test/live.test.ts -t "set null"`
- `status`: open

### v2-pg-11: Typed SQL expressions imply safety that PostgreSQL does not validate until migration

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: verification charter generated-expression candidate; `src/pg/combinators.ts:1447`; `src/pg/extras.ts:448`; `src/pg/extras.ts:416`
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:1447`, `scratchpad/bsl/src/pg/extras.ts:416`, `scratchpad/bsl/src/pg/extras.ts:448`
- `evidence`: BSL accepted a generated `random()` expression, a generated column referencing another generated column, a CHECK containing a subquery, and a partial-index predicate using `random()`. PGlite rejected them respectively for non-immutability, generated-column chaining, forbidden CHECK subqueries, and non-immutable index predicates. A parameterized typed CHECK was correctly inlined and applied.
- `impact`: `SQL<T>` proves only carrier typing, while the public “typed” surfaces leave material PostgreSQL legality rules silent.
- `suggestedFix`: At minimum make this boundary deferred-loudly in `generated`, `Table.check`, and partial-index Gotchas and the graduation agenda, backed by negative live probes. Add structural rejection only where Drizzle’s SQL AST exposes a dependable rule.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/live.test.ts -t "PostgreSQL expression restrictions"; bun run docgen:local`
- `status`: open

### v2-pg-12: Safe column combinators model carriers but not PostgreSQL value domains

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: verification charter accepted-input definition; README schema-truth claims; `src/pg/combinators.ts:427`, `src/pg/combinators.ts:632`, `src/pg/combinators.ts:666`, `src/pg/combinators.ts:695`
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:427`, `scratchpad/bsl/src/pg/combinators.ts:632`, `scratchpad/bsl/src/pg/combinators.ts:666`, `scratchpad/bsl/src/pg/combinators.ts:695`
- `evidence`: Generated insert schemas accepted `32768` for `smallint`, `2147483648` for `integer`, `"not-a-uuid"` for `uuid`, `"not-a-date"` for string-mode `date`, and `"not-a-number"` for `numeric`. After applying BSL-generated tables, PGlite rejected every insert with the corresponding range or syntax error.
- `impact`: “Schema truth at boundaries” does not hold for ordinary safe scalar combinators; application validation succeeds for values the database refuses.
- `suggestedFix`: Inject or verify appropriate Effect checks for bounded integers and semantic string types, as already done for varchar/char. If a domain cannot be represented reliably, document it as carrier-only and require an author-supplied validating schema.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "PostgreSQL value domains"; bun test scratchpad/bsl/test/live.test.ts -t "value domains"`
- `status`: open

### v2-pg-13: Multidimensional arrays do not enforce PostgreSQL rectangularity

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: verification charter “and beyond”; `src/pg/combinators.ts:945`; `src/pg/table.ts:312`
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:945`, `scratchpad/bsl/src/pg/table.ts:312`
- `evidence`: The BSL insert schema accepted `[["a"],["b","c"]]` for a declared `text[][]` field. PGlite rejected it as a malformed multidimensional array; a direct probe reported `multidimensional arrays must have array expressions with matching dimensions`.
- `impact`: BSL-valid nested arrays can fail at insertion even though element type and declared depth match.
- `suggestedFix`: For dimensions greater than one, inject a rectangular-shape schema check or loudly document ragged arrays as rejected at the BSL boundary.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "rectangular array"; bun test scratchpad/bsl/test/live.test.ts -t "ragged array"`
- `status`: open

### v2-pg-14: PostgreSQL structural ceilings are not mirrored

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: verification charter exhaustiveness directive; `src/pg/extras.ts:261`; `src/pg/model.ts:520`; installed `drizzle-orm/pg-core/indexes.js:12`
- `affectedFiles`: `scratchpad/bsl/src/pg/model.ts:520`, `scratchpad/bsl/src/pg/extras.ts:261`, `scratchpad/bsl/src/pg/extras.ts:416`
- `evidence`: BSL accepted a 33-column index and composite unique; PGlite rejected both with `cannot use more than 32 columns in an index`. BSL also accepted a dynamically constructed 1601-field model; PGlite rejected its DDL with `tables can have at most 1600 columns`.
- `impact`: Large but structurally valid BSL models fail only at deployment.
- `suggestedFix`: Add runtime mirrors for PostgreSQL’s 1,600-column table ceiling and 32-key index-backed constraint ceiling. Tuple-based extras can also receive a bounded type-level check.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts -t "PostgreSQL structural limits"; bun test scratchpad/bsl/test/live.test.ts -t "structural limits"`
- `status`: open

Summary: 14 required findings, 0 non-blocking findings.


