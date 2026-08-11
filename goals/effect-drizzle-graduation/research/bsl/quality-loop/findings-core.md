### correctness-1: Suspended nullable schemas are type-derivable but fail runtime classification

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: round6-brief.md §C; standing law that compile-time and runtime invariants must mirror
- `affectedFiles`: scratchpad/bsl/src/core/classification.ts:55, scratchpad/bsl/test/unit.test.ts:478
- `evidence`: `suspend(() => NullOr(String))` has encoded type `string | null`, so type-level derivation accepts it as text. Both PostgreSQL and SQLite model construction instead throw `DeriveColumnError: Encoded AST node 'Suspend' does not derive a column`. `classify` only splits a top-level `Union`; after receiving a top-level `Suspend`, the dialect walker unwraps it to a union that it cannot classify.
- `impact`: Valid lazy schemas contradict their accepted model types and cannot be used without unnecessary explicit column metadata. Nullability is also never discovered through the suspension.
- `suggestedFix`: Make the shared classifier recursively unwrap `Suspend` nodes before absence/null stripping, with cycle protection, so union and nullability handling occur at every traversed level.
- `acceptanceCommands`: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false && bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

### correctness-2: Version metadata overrides explicit VariantField membership only at runtime

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: round6-brief.md §C; pg/model.ts and sqlite/model.ts explicit-variant membership contract
- `affectedFiles`: scratchpad/bsl/src/pg/model.ts:197, scratchpad/bsl/src/pg/model.ts:455, scratchpad/bsl/src/sqlite/model.ts:163, scratchpad/bsl/src/sqlite/model.ts:374, scratchpad/bsl/test/unit.test.ts:234
- `evidence`: `EffectiveSchema` returns an explicit `VariantSchema.Field` unchanged before considering metadata. Runtime `effectiveSchema` checks `meta.version` first. A field authored as `VariantField({ select: Int, update: Int }).pipe(integer(), default(1), version())` is therefore typed as select/update-only but runtime exposes it in all six variants: `select`, `insert`, `update`, `json`, `jsonCreate`, and `jsonUpdate`.
- `impact`: Static payload types disagree with the schemas used for decoding and encoding. Properties can be accepted or required at runtime while being absent from the declared variant type.
- `suggestedFix`: Choose one ordering and apply it on both sides. The documented minimum is to check `VariantSchema.isField(schema)` before `meta.version` at runtime; alternatively reject `version()` on explicit variant fields consistently.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/sqlite-unit.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-3: PostgreSQL bigint versions are accepted but every optimistic update rejects them

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: round6-brief.md §C; repository contract requiring accepted version models to update atomically
- `affectedFiles`: scratchpad/bsl/src/pg/combinators.ts:1286, scratchpad/bsl/src/core/repository.ts:203, scratchpad/bsl/src/core/repository.ts:296, scratchpad/bsl/src/core/repository.ts:317
- `evidence`: `version()` accepts every PostgreSQL `IdentityKind`, including `BigInt.pipe(pg.bigint("bigint"), pg.default(1n), pg.version())`; model construction succeeds. `requireVersion`, however, accepts only `Schema.Int` numbers. A correctly typed bigint update therefore throws `ModelInvariantError` before SQL execution. `VersionConflictError.expectedVersion` is likewise fixed to `Int`.
- `impact`: A publicly accepted version configuration produces a repository whose update operation can never succeed.
- `suggestedFix`: Either reject bigint-mode columns in the compile-time and runtime `version()` validation, or make repository version extraction, incrementing, tracing, and `VersionConflictError` consistently support `number | bigint`.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-4: The version field can be selected as the repository id and update multiple rows

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: repository.ts atomic compare-and-increment contract; README.md optimistic repository claim
- `affectedFiles`: scratchpad/bsl/src/core/repository.ts:69, scratchpad/bsl/src/core/repository.ts:274, scratchpad/bsl/src/core/repository.ts:288
- `evidence`: `IdKey<M>` includes the version field, so `{ idColumn: "rowVersion" }` typechecks. Generated SQL then becomes effectively `WHERE row_version = expected AND row_version = expected`; every row sharing that version is updated and incremented. `findOne` returns only the first result, hiding the additional updated rows. The same broad id constraint also permits any non-unique update field.
- `impact`: A type-approved repository configuration can silently mutate multiple rows while reporting one successful optimistic update.
- `suggestedFix`: Exclude `VersionKey<M>` from `IdKey`, mirror that check at repository construction, and require the locator metadata to be primary-key or unique. Reject unsupported composite locators explicitly.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts scratchpad/bsl/test/sqlite-live.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-5: Repositories ignore resolved physical column names

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: README.md schema-first repository claim; round6-brief.md §C behavior-invariant requirement
- `affectedFiles`: scratchpad/bsl/src/core/repository.ts:283, scratchpad/bsl/src/core/repository.ts:288, scratchpad/bsl/src/core/repository.ts:297, scratchpad/bsl/test/live.test-support.ts:58
- `evidence`: Repository SQL uses logical model keys for `idColumn`, `versionColumn`, and every `authorFields` entry instead of `model.sql.columns[key].columnName`. Existing live tests conceal the mismatch with a camel-to-snake `SqlClient` transform explicitly described as required. A valid override such as `displayName.pipe(columnName("legacy_name"))` still queries `displayName`/`display_name`, never `legacy_name`.
- `impact`: CRUD and optimistic updates fail against tables produced by the same model whenever an explicit physical name is not exactly the client’s global naming transform. The package’s projection and repository surfaces disagree about the table they own.
- `suggestedFix`: Build one logical-to-physical name map from resolved metadata and apply it to insert/update keys, id/version predicates, deletes, lookups, and returned-row decoding. Add live coverage using a non-snake-case-equivalent override.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/live.test.ts scratchpad/bsl/test/sqlite-live.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-6: Duplicate Effect literals produce invalid PostgreSQL enum DDL

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: round6-brief.md §C runtime validation requirement; README.md enum derivation claims
- `affectedFiles`: scratchpad/bsl/src/core/literals.ts:47, scratchpad/bsl/src/core/literals.ts:68, scratchpad/bsl/test/unit.test.ts:290
- `evidence`: `Literals(["a", "a"])` is a valid Effect schema. `stringLiteralValues` preserves both occurrences, and PostgreSQL assembly produces `enumValues: ["a", "a"]`. Executing the corresponding DDL in PGlite fails with `duplicate key value violates unique constraint "pg_enum_typid_label_index"`.
- `impact`: A valid finite schema passes model construction and assembly but generates unappliable migrations.
- `suggestedFix`: Deduplicate collected string values in first-occurrence order before enforcing non-emptiness and constructing dialect enum descriptors. Add a PostgreSQL DDL regression test.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/live.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
- `status`: open

### correctness-7: Self-referential junction tables are silently excluded from through relations

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: README.md claim that both dialects assemble RQBv2 relations; review-context.md deferred-boundary list does not defer self-junctions
- `affectedFiles`: scratchpad/bsl/src/pg/schema.ts:493, scratchpad/bsl/src/pg/schema.ts:538, scratchpad/bsl/src/sqlite/schema.ts:456, scratchpad/bsl/src/sqlite/schema.ts:501, scratchpad/bsl/src/core/assembly.ts:223
- `evidence`: A standard `user_follow` table with composite key `(followerId, followeeId)` and both foreign keys targeting `user` satisfies every junction structural check, but `collectJunctions` explicitly returns `none()` when both targets match. Runtime relations contain only `userFollowsByFollower`, `userFollowsByFollowee`, `follower`, and `followee`; neither followers nor followees through-relation is emitted.
- `impact`: Valid self many-to-many schemas silently receive a weaker relation graph than the documented junction behavior, with no error or declared limitation.
- `suggestedFix`: Retain same-target junctions and disambiguate the two through names using the edge roles, for example `followeesThroughUserFollow` and `followersThroughUserFollow`.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/unit.test.ts scratchpad/bsl/test/sqlite-unit.test.ts`
- `status`: open

7 total findings, 7 blocking.
