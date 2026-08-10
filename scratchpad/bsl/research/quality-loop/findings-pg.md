### correctness-1: Explicit column combinators lack runtime carrier corroboration

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: review-context standing law “every compile-time invariant has a runtime mirror”; README “Encoded-side derivation” and runtime-mirror claims
- `affectedFiles`: scratchpad/bsl/src/pg/combinators.ts:95, scratchpad/bsl/src/pg/model.ts:525, scratchpad/bsl/src/pg/Column.ts:921
- `evidence`: `Finite.pipe(pg.text())` is a compile-time error, but Bun can execute it and `Model` accepts the resulting descriptor because construction checks only `PgColumn.isSpec`. `toPgTable` then emits a `text` column for a number-encoded schema. Reproduction printed the accepted text descriptor and SQL type `text`.
- `impact`: Type-suppressed or dynamically assembled fields can produce schemas whose encoded carrier disagrees with Drizzle’s driver carrier, causing invalid writes or select decoding failures.
- `suggestedFix`: Add one central model-construction corroboration check comparing the encoded schema carrier and array depth with `PgColumn.carrier`; exempt only the explicitly unsafe custom-column surface.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts`; add runtime-negative tests for representative string, number, date, byte, object, mode, and array mismatches, then run `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-2: Object type derivation admits declarations that runtime derivation rejects

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: scratchpad/bsl/src/pg/derive.ts policy lines 14–15; review-context standing law requiring type/runtime invariant parity
- `affectedFiles`: scratchpad/bsl/src/pg/derive.ts:122
- `evidence`: `DeriveFromEncoded<E>` maps every remaining `object` carrier to `Jsonb`, after special-casing only `Date` and `Uint8Array`. Consequently schemas such as `instanceOf(RegExp)` have a non-`never` type-level derivation even though runtime `fromSchemaAST` rejects their `Declaration` AST. Runtime reproduction failed with `DeriveColumnError: Encoded AST node 'Declaration' does not derive a column`.
- `impact`: The public model signature claims declaration-backed object schemas are derivable, but construction throws for code accepted by that type policy.
- `suggestedFix`: Narrow type-level JSON derivation to structurally JSON-compatible records and arrays, or otherwise exclude non-plain declaration carriers while retaining Struct/Array derivation.
- `acceptanceCommands`: Add a negative type fixture for `instanceOf(RegExp)` and positive Struct/Array fixtures; run `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false && bun test scratchpad/bsl/test/unit.test.ts`
- `status`: open

### correctness-3: Foreign keys may target non-unique columns

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README claim that invalid foreign keys are rejected; PostgreSQL foreign-key semantics; live `pushSchema` reproduction
- `affectedFiles`: scratchpad/bsl/src/pg/schema.ts:171, scratchpad/bsl/src/pg/schema.ts:448
- `evidence`: Compile-time and runtime validation compare only storage identity, carrier, and dimensions. A target model with plain non-unique `id: Int.pipe(pg.integer())` and a compatible referencing source is accepted and projected. `pushSchema` generated the FK, but PGlite rejected `ALTER TABLE "source" ... REFERENCES "target"("id")`.
- `impact`: A schema can pass construction and unit projection yet fail during migration because PostgreSQL requires the referenced column set to be unique or primary.
- `suggestedFix`: Require single-column FK targets to carry inline `primaryKey` or `unique` metadata at both type and runtime validation boundaries.
- `acceptanceCommands`: Add compile-time and runtime negatives for non-unique targets plus a live `pushSchema(...).apply()` proof; run `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts`
- `status`: open

### correctness-4: PostgreSQL enums accept duplicate labels

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README enum-validity claims; live `pushSchema` reproduction
- `affectedFiles`: scratchpad/bsl/src/pg/derive.ts:309, scratchpad/bsl/src/pg/Column.ts:349, scratchpad/bsl/src/pg/Column.ts:679
- `evidence`: `Literals(["a", "a"]).pipe(pg.enum("dupe"))` produces `values: ["a","a"]`; neither `Enum.make` nor `isSpec` checks uniqueness. Drizzle generated `CREATE TYPE "dupe" AS ENUM('a', 'a')`, which PGlite rejected.
- `impact`: A normal, non-hand-built schema declaration passes model and enum-registry assembly but produces unusable DDL.
- `suggestedFix`: Reject duplicate labels in `Enum.make` and `isSpec`, or normalize schema-derived labels once while preserving first-occurrence order.
- `acceptanceCommands`: Add unit tests for schema-derived and hand-built duplicates plus a live DDL application test; run `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts`
- `status`: open

### correctness-5: `char(n)` reuses varchar max-length semantics despite PostgreSQL padding

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README schema-truth and encoded-side corroboration principles; PostgreSQL/PGlite live behavior
- `affectedFiles`: scratchpad/bsl/src/pg/combinators.ts:102, scratchpad/bsl/src/pg/combinators.ts:414, scratchpad/bsl/src/pg/model.ts:583, scratchpad/bsl/test/unit.test.ts:337
- `evidence`: Derive, verify, and inject modes for `char` use only `isMaxLength`, so `String.check(isMaxLength(4)).pipe(pg.char())` accepts `"x"`. PGlite returned that stored value as `"x   "` from `char(4)` (`octet_length = 4`), changing the encoded value across a database round trip.
- `impact`: Short valid inputs are silently blank-padded into different selected values, violating the schema-as-storage-truth guarantee and potentially breaking literals, identifiers, equality, or decoding.
- `suggestedFix`: Give `char` an exact-width policy using `isLengthBetween(n, n)` or equivalent: derive only from exact bounds, verify exact compatibility, and inject an exact-length check for plain schemas. Keep varchar’s existing max-length tri-mode separate.
- `acceptanceCommands`: Add unit coverage for all three exact-width char modes and a PGlite short-value round-trip; run `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts`
- `status`: open

### correctness-6: Duplicate physical table names are silently merged by drizzle-kit

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README claim that schema assembly projects independently derived tables; live `pushSchema` reproduction
- `affectedFiles`: scratchpad/bsl/src/pg/model.ts:421, scratchpad/bsl/src/pg/schema.ts:581
- `evidence`: Models identified as `alpha/User` and `beta/User` both derive physical table name `user`. `schema({ a: A, b: B })` accepts both. Drizzle-kit then generated one `"user"` table containing the union of both models’ columns and applied it successfully, while each runtime Drizzle table object still exposes only its own field set.
- `impact`: Migration shape, query shape, model codecs, and repositories disagree without any assembly error; unrelated models can be collapsed into one physical table.
- `suggestedFix`: Validate physical table-name uniqueness before collecting edges or projecting tables and raise `SchemaAssemblyError` identifying both registry entries.
- `acceptanceCommands`: Add an assembly-negative unit test and assert no migration is generated for duplicate physical names; run `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts`
- `status`: open

### correctness-7: Enum and table export-key collisions produce missing enum DDL

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README/status DDL claims; current live-suite export assembly; live `pushSchema` reproduction
- `affectedFiles`: scratchpad/bsl/src/pg/schema.ts:351, scratchpad/bsl/src/pg/schema.ts:649, scratchpad/bsl/test/live.test.ts:77
- `evidence`: The supported live path spreads `enums` and `tables` into one Drizzle export object. If enum name and table registry key are both `status`, the table overwrites the enum export. Drizzle-kit generated only `CREATE TABLE "status" ("value" "status" NOT NULL)` and PGlite rejected it because the enum type was never created.
- `impact`: Valid PostgreSQL naming—where a table and type may share a name—can make the advertised DDL workflow fail through a JavaScript record-key collision.
- `suggestedFix`: Expose a collision-safe combined Drizzle schema/export record using distinct internal export keys, and make the live suite exercise that surface.
- `acceptanceCommands`: Add a table/enum same-name live migration case; run `bun test scratchpad/bsl/test/live.test.ts`
- `status`: open

### correctness-8: Reference lookup conflates registry keys with physical table names

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: `ModelRecord` documentation that registry keys and model table names are independent; review-context type/runtime parity law
- `affectedFiles`: scratchpad/bsl/src/pg/schema.ts:177, scratchpad/bsl/src/pg/schema.ts:394
- `evidence`: Type validation resolves `reference.tableName` exclusively as `keyof Models`, while runtime lookup selects the first entry whose registry key or physical table name matches. A registry key equal to another model’s physical name can therefore redirect an EntityId reference to the wrong model; aliases also produce compile/runtime disagreement.
- `impact`: Foreign keys and relations can bind to a different table than the EntityId’s physical target, or valid runtime assemblies can be rejected only by the type layer.
- `suggestedFix`: Choose one namespace for reference identity. Prefer resolving strictly by unique physical table name after adding duplicate-name validation, and make type-level validation follow the same policy; otherwise require registry-key identity consistently and remove physical-name fallback.
- `acceptanceCommands`: Add tests covering aliased registry keys and a registry-key/physical-name cross-collision, asserting the FK target and relation target; run `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false && bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts`
- `status`: open

8 total findings, 8 blocking.
