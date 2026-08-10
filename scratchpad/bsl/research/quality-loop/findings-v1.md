### v1-bundle-size-1: Dialect-local kit entrypoints

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: triage Wave C; publishing import-boundary law
- `affectedFiles`: `scratchpad/bsl/src/pg/kit.ts:182`; `scratchpad/bsl/src/sqlite/kit.ts:179`; `scratchpad/bsl/src/pg/index.ts:12`; `scratchpad/bsl/src/sqlite/index.ts:12`
- `evidence`: Both subpaths export dialect-local `make`; the import-closure test proves neither reaches its sibling dialect. Root `make` remains the documented convenience dispatcher. Import-boundary suite passed: 4 tests, 11 expectations.
- `impact`: Bundle-sensitive consumers can isolate one dialect as ruled.
- `suggestedFix`: none
- `acceptanceCommands`: `bun test scratchpad/bsl/test/import-boundary.test.ts` — exit 0
- `status`: verified

### v1-bundle-size-2: Fine-grained descriptor DCE

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: triage Wave C; publishing bundle law
- `affectedFiles`: `scratchpad/bsl/src/core/Meta.ts`; `scratchpad/bsl/src/pg/Column.ts:505`; `scratchpad/bsl/src/sqlite/Column.ts:239`
- `evidence`: Current tree contains 51 `@__PURE__` annotations; PostgreSQL fixed descriptors are independent initializers. The Bun bundle probe excludes custom, timestamp, and SQLite `timestamp_ms` families.
- `impact`: Selective dialect imports are tree-shakable without introducing lazy machinery.
- `suggestedFix`: none
- `acceptanceCommands`: import-boundary bundle probe — exit 0; BSL typecheck — exit 0
- `status`: verified

### v1-core-correctness-1: Suspended nullable classification

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: standing type/runtime mirror law
- `affectedFiles`: `scratchpad/bsl/src/core/classification.ts:67`; `scratchpad/bsl/test/unit.test.ts:558`; `scratchpad/bsl/test/sqlite-unit.test.ts:93`
- `evidence`: `flattenEncoded` recursively expands suspensions and unions with cycle detection before null stripping. PostgreSQL and SQLite tests construct suspended nullable models and derive nullable text columns.
- `impact`: Runtime classification now matches the previously accepted encoded type.
- `suggestedFix`: none
- `acceptanceCommands`: focused unit/PG-live run — exit 0
- `status`: verified

### v1-core-correctness-2: Version with explicit VariantSchema.Field

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 5
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:1397`; `scratchpad/bsl/src/pg/model.ts:529`; `scratchpad/bsl/src/sqlite/combinators.ts:520`; `scratchpad/bsl/src/sqlite/model.ts:442`
- `evidence`: Both combinators reject explicit variant fields through readable type errors and tagged runtime errors. Both model constructors repeat the runtime guard for bypassed metadata. Negative fixtures are consumed by the passing typecheck.
- `impact`: No static/runtime variant-membership disagreement remains.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and both unit suites — exit 0
- `status`: verified

### v1-core-correctness-3: Bigint optimistic versions

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 4
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:1348`; `scratchpad/bsl/src/pg/model.ts:231`
- `evidence`: Version types admit only integer, smallint, and number-mode bigint; runtime uses `PgColumn.isNumberInteger`. Native bigint has a compile-negative fixture and tagged runtime-negative test.
- `impact`: Every accepted version carrier is compatible with repository integer incrementing.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and PostgreSQL unit suite — exit 0
- `status`: verified

### v1-core-correctness-4: Repository locator uniqueness

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: optimistic repository atomicity contract
- `affectedFiles`: `scratchpad/bsl/src/core/repository.ts:61`; `scratchpad/bsl/src/core/repository.ts:238`
- `evidence`: `LocatorKey` excludes version fields and admits only inline primary-key or unique fields. `validateRepositoryModel` mirrors both checks at runtime. Compile-negative and tagged runtime tests pass.
- `impact`: A repository cannot typecheck or construct with a locator capable of updating multiple rows.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and PostgreSQL unit suite — exit 0
- `status`: verified

### v1-core-correctness-5: Repository column-name overrides

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 6, floor option
- `affectedFiles`: `scratchpad/bsl/src/core/repository.ts:111`; `scratchpad/bsl/src/core/repository.ts:238`
- `evidence`: The shipped floor is ruling-faithful: `ValidateColumnNames` rejects override-bearing models statically, and repository construction throws a tagged error naming the field. Full logical/physical mapping was not falsely implemented.
- `impact`: Repositories fail loudly instead of emitting SQL against the wrong physical column.
- `suggestedFix`: none; stretch mapping remains backlog
- `acceptanceCommands`: BSL typecheck and `_repositoryColumnNameOverride` test — exit 0
- `status`: verified

### v1-core-correctness-6: Duplicate enum literals

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 1
- `affectedFiles`: `scratchpad/bsl/src/core/literals.ts:71`; `scratchpad/bsl/test/unit.test.ts:324`
- `evidence`: Shared literal collection applies order-preserving `dedupe`; both dialect tests assert `["draft", "active"]`. PostgreSQL live migration coverage includes the deduplicated enum.
- `impact`: Schema enum set semantics now produce valid DDL.
- `suggestedFix`: none
- `acceptanceCommands`: PostgreSQL unit/live tests — exit 0
- `status`: verified

### v1-core-correctness-7: Self-referential junction limitation

- `label`: note
- `blockingStatus`: non-blocking
- `severity`: P2-medium
- `sourceRefs`: triage ruling 3
- `affectedFiles`: `scratchpad/bsl/src/pg/schema.ts:598`; `scratchpad/bsl/src/sqlite/schema.ts:558`
- `evidence`: Both assembly Gotchas explicitly state that self-referential junctions emit direct and reverse relations only and defer through-name design. Existing self-reference relation tests pass.
- `impact`: The intentional limitation is loud while the feature remains graduation backlog.
- `suggestedFix`: none
- `acceptanceCommands`: both unit suites — exit 0
- `status`: verified

### v1-jsdoc-1: Entrypoint-unreachable exports

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: `@internal` publication convention
- `affectedFiles`: `scratchpad/bsl/src/**`
- `evidence`: Independent TypeScript-checker reachability traversal found 214 unreachable declaration facets and zero missing `@internal` tags, including overload facets and internal modules.
- `impact`: Declaration generation can distinguish the intended public surface.
- `suggestedFix`: none
- `acceptanceCommands`: independent checker census; BSL typecheck — exit 0
- `status`: verified

### v1-jsdoc-2: Dialect documentation ownership

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: measured JSDoc grammar
- `affectedFiles`: `scratchpad/bsl/src/kit.ts:31`
- `evidence`: The unused runtime guard object is gone. The substantive prose and example now belong to public `export type Dialect`, categorized `type-level`.
- `impact`: Generated documentation describes the actual public declaration.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck — exit 0
- `status`: verified

### v1-performance-1: Metadata merge allocation

- `label`: suggestion
- `blockingStatus`: non-blocking
- `severity`: P3-low
- `sourceRefs`: accepted Wave C performance item
- `affectedFiles`: `scratchpad/bsl/src/core/Meta.ts:195`
- `evidence`: `merge` directly constructs the eleven-field record; Option/Struct imports and per-call closures are absent. A fresh nine-sample, 500,000-call comparison was record-equivalent and measured 5.30 ms versus 262.84 ms median, approximately 49.57× faster.
- `impact`: Model-definition metadata composition no longer incurs avoidable closure allocation.
- `suggestedFix`: none
- `acceptanceCommands`: fresh alternating benchmark; BSL typecheck — exit 0
- `status`: verified

### v1-pg-correctness-1: Explicit carrier corroboration

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: standing both-sides law
- `affectedFiles`: `scratchpad/bsl/src/pg/model.ts:553`; `scratchpad/bsl/src/pg/derive.ts:359`
- `evidence`: Model construction compares schema carrier tag/depth with descriptor carrier, exempting only documented `unsafeCustom`. Runtime tests cover string, number, date, byte, object, mode, and array mismatches; compile-negative combinator fixtures pass.
- `impact`: Safe explicit descriptors cannot silently disagree with encoded schemas.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and PostgreSQL unit suite — exit 0
- `status`: verified

### v1-pg-correctness-2: Declaration-backed object derivation

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: standing type/runtime mirror law
- `affectedFiles`: `scratchpad/bsl/src/pg/derive.ts:122`; `scratchpad/bsl/test/fixtures.ts:829`
- `evidence`: Type-level JSON derivation is limited to arrays and string-keyed structural records. `instanceOf(RegExp)` is compile-negative and throws `DeriveColumnError`; Struct and Array remain positive.
- `impact`: Type-level derivability matches the AST-family runtime policy.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and PostgreSQL unit suite — exit 0
- `status`: verified

### v1-pg-correctness-3: Foreign-key target uniqueness

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: PostgreSQL FK semantics; both-sides law
- `affectedFiles`: `scratchpad/bsl/src/pg/schema.ts:198`; `scratchpad/bsl/src/pg/schema.ts:478`; `scratchpad/bsl/src/sqlite/schema.ts:196`
- `evidence`: Type validation and runtime assembly require the target column to be inline primary-key or unique on both dialects. Negative fixtures throw tagged assembly errors; PG live coverage proves a unique target and rejects a missing value.
- `impact`: Accepted single-column references produce database-valid foreign keys.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck, unit suites, and PG live suite — exit 0
- `status`: verified

### v1-pg-correctness-4: PostgreSQL duplicate enum labels

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: merged triage ruling 1
- `affectedFiles`: `scratchpad/bsl/src/core/literals.ts:71`; `scratchpad/bsl/src/pg/combinators.ts:276`
- `evidence`: This duplicate was fixed at the ruled shared collection point, not by dialect-local rejection. First-occurrence order is preserved and the live migration applies.
- `impact`: PostgreSQL never receives duplicate labels from schema-derived enums.
- `suggestedFix`: none
- `acceptanceCommands`: PostgreSQL unit/live tests — exit 0
- `status`: verified

### v1-pg-correctness-5: Exact-width char semantics

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 8
- `affectedFiles`: `scratchpad/bsl/src/pg/combinators.ts:146`; `scratchpad/bsl/src/pg/model.ts:607`
- `evidence`: Derive mode requires `isLengthBetween(n,n)`; explicit mode verifies or injects the exact check; model construction mirrors exact-length metadata validation. Tests cover all modes, and PG live coverage demonstrates blank padding while valid exact-width input remains unchanged.
- `impact`: Valid encoded values survive `char(n)` round trips unchanged.
- `suggestedFix`: none
- `acceptanceCommands`: PostgreSQL unit/live tests — exit 0
- `status`: verified

### v1-pg-correctness-6: Duplicate physical table names

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: accepted assembly ruling
- `affectedFiles`: `scratchpad/bsl/src/core/assembly.ts:100`; `scratchpad/bsl/src/pg/schema.ts:628`; `scratchpad/bsl/src/sqlite/schema.ts:587`
- `evidence`: Shared pre-projection validation rejects duplicate physical names with each dialect’s tagged `SchemaAssemblyError`. Both dialect unit tests exercise the collision.
- `impact`: Drizzle-kit cannot silently merge distinct models into one table.
- `suggestedFix`: none
- `acceptanceCommands`: both unit suites — exit 0
- `status`: verified

### v1-pg-correctness-7: Enum/table export-key collision

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: accepted Wave B fix
- `affectedFiles`: `scratchpad/bsl/src/pg/schema.ts:692`; `scratchpad/bsl/test/unit.test.ts:496`
- `evidence`: Assembly builds `drizzleSchema` using distinct `enum:<name>` and `table:<key>` keys. Unit assertions and the live migration exercise a same-name enum/table pair.
- `impact`: Supported migration exports retain both database objects.
- `suggestedFix`: none
- `acceptanceCommands`: PostgreSQL unit/live tests — exit 0
- `status`: verified

### v1-pg-correctness-8: Registry-key and physical-name resolution

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 7
- `affectedFiles`: `scratchpad/bsl/src/pg/schema.ts:359`; `scratchpad/bsl/src/sqlite/schema.ts:353`
- `evidence`: Runtime resolution performs exact registry-key lookup first, then unique physical-name fallback, otherwise a tagged error. Tests prove exact-key precedence and physical fallback on both dialects. The runtime-only physical-name boundary is documented as ruled.
- `impact`: References cannot silently redirect through conflated namespaces.
- `suggestedFix`: none
- `acceptanceCommands`: BSL typecheck and both unit suites — exit 0
- `status`: verified

### v1-sqlite-correctness-1: Correlated SQLite descriptor guard

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: closed-shape runtime mirror law
- `affectedFiles`: `scratchpad/bsl/src/sqlite/Column.ts:294`; `scratchpad/bsl/src/sqlite/model.ts:448`
- `evidence`: `isSpec` correlates every tag with its exact kind, identity, required values, and valid modes before property access. Forged tag/kind and missing-enum-values fixtures now reach tagged model errors.
- `impact`: Malformed descriptors cannot corrupt identity checks or escape through raw property errors.
- `suggestedFix`: none
- `acceptanceCommands`: SQLite unit suite and BSL typecheck — exit 0
- `status`: verified

### v1-sqlite-correctness-2: NUL enum literals

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: triage ruling 2
- `affectedFiles`: `scratchpad/bsl/src/core/literals.ts:77`; `scratchpad/bsl/src/pg/combinators.ts:276`; `scratchpad/bsl/src/sqlite/combinators.ts:225`
- `evidence`: Shared literal collection raises tagged `DeriveColumnError` for U+0000 before either dialect projects SQL. Both dialect tests assert loud rejection; no overridden hex-CAST mechanism was introduced.
- `impact`: Unrepresentable SQLite literals fail at combinator time consistently across dialects.
- `suggestedFix`: none
- `acceptanceCommands`: both unit suites — exit 0
- `status`: verified

### v1-sqlite-correctness-3: Plain INTEGER PRIMARY KEY inserts

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: installed Drizzle SQLite semantics; both-sides law
- `affectedFiles`: `scratchpad/bsl/src/sqlite/model.ts:116`; `scratchpad/bsl/src/sqlite/model.ts:399`
- `evidence`: Type-level and runtime variant construction make number-mode `INTEGER PRIMARY KEY` optional on insert independently of `AUTOINCREMENT`. The Effect insert-schema test accepts omission; the passing typecheck verifies Drizzle/Effect insert fixtures.
- `impact`: Both public insert surfaces agree with SQLite rowid behavior.
- `suggestedFix`: none
- `acceptanceCommands`: SQLite unit suite and BSL typecheck — exit 0
- `status`: verified

### v1-sqlite-correctness-4: Per-run live database ownership

- `label`: issue
- `blockingStatus`: non-blocking
- `severity`: P2-medium
- `sourceRefs`: accepted Wave C harness fix
- `affectedFiles`: `scratchpad/bsl/test/sqlite-live.test.ts:175`
- `evidence`: Each process calls `FileSystem.makeTempDirectory`, stores `live.sqlite` inside it, and recursively removes only that owned directory. The fixer report records two simultaneous 5-test/23-expectation passes. In this read-only verification sandbox, the current rerun reached 60 passing tests before failing with `EROFS` at `mkdtemp`; no product assertion failed.
- `impact`: Concurrent writable-environment runs no longer share or delete a global database.
- `suggestedFix`: none
- `acceptanceCommands`: current full run environment-blocked only by read-only `/tmp`; source ownership proof confirmed
- `status`: verified

### v1-standing-census-1: Runtime type assertions

- `label`: note
- `blockingStatus`: note
- `severity`: P3-low
- `sourceRefs`: standing zero-assertion law
- `affectedFiles`: `scratchpad/bsl/src/**`; `scratchpad/bsl/test/**`
- `evidence`: Independent TypeScript AST traversal scanned 44 `.ts`/`.tsx` files and found zero `AsExpression`, `TypeAssertionExpression`, `SatisfiesExpression`, or `NonNullExpression` nodes.
- `impact`: The zero-runtime-assertion invariant remains intact.
- `suggestedFix`: none
- `acceptanceCommands`: AST census — `assertions=0`
- `status`: verified

### v1-standing-census-2: Import boundary

- `label`: note
- `blockingStatus`: note
- `severity`: P3-low
- `sourceRefs`: publishing import and bundle law
- `affectedFiles`: `scratchpad/bsl/test/import-boundary.test.ts`
- `evidence`: Core remains dialect/workspace independent; dialects do not import each other; local kit closures exclude sibling dialects; focused Bun bundle drops unrelated families.
- `impact`: The package boundary and bundle-isolation fixes introduce no backedges.
- `suggestedFix`: none
- `acceptanceCommands`: `bun test scratchpad/bsl/test/import-boundary.test.ts` — 4 pass, 0 fail
- `status`: verified

Summary: 26 verified, 0 incomplete, 0 regressed; 0 required findings.


