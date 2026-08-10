# Quality-Loop Inventory — Round 1 Triage & Fixer Routing

Baseline: `b1de679a91`. Panel: 6 read-only Sol-medium lenses. Raw findings live
in `findings-<lens>.md` beside this file — fixers read their assigned findings
IN FULL there. This file is the triage layer: dedupes, reclassifications,
fix-direction rulings, and wave routing.

Totals: 24 findings → 22 blocking as reported; after triage: **20 accepted
blocking (2 merged as duplicates), 1 reclassified backlog+docs, 3 non-blocking
accepted for fixing**.

## Triage rulings (reviewer verdicts adjusted by the judge)

1. **MERGE**: pg correctness-4 (duplicate enum labels) ≡ core correctness-6
   (duplicate literals → invalid enum DDL). One defect. Fix at the shared core
   literal-collection point: **dedupe values order-preservingly** (set semantics
   is what an enum is; duplicates carry no meaning) — document in the enum
   combinator docs.
2. **RULING on sqlite correctness-2 (NUL enum literals)**: fix by LOUD REJECTION
   at the shared collection point — enum values containing NUL (U+0000) raise a
   tagged error at combinator time on BOTH dialects. No hex-CAST machinery
   (honest-ambiguity doctrine over heroics). Keep the existing escaping for
   representable values. Same shared-collection fix location as ruling 1.
3. **RECLASSIFY core correctness-7 (self-ref junctions)**: the distinct-targets
   junction rule was a documented round-5 design decision, not an oversight.
   → `backlog` (graduation agenda: self-referential through-relations need a
   naming design). BLOCKING remainder: make the limitation LOUD — a Gotchas
   note in the junction/assembly docs stating self-referential junctions emit
   direct+reverse relations only.
4. **RULING on core correctness-3 (bigint versions)**: restrict rather than
   support — `version()` requires a number-encoded integer-family column at
   type level AND runtime on both dialects (bigint rejected loudly). Optimistic
   versions do not need 2^53. Document in version() docs.
5. **RULING on core correctness-2 (version × VariantField)**: reject the
   combination — `version()` on an explicit VariantSchema.Field input is a
   type error and a runtime tagged error (BSL owns version variant policy;
   author-owned variants conflict by construction).
6. **RULING on core correctness-5 (columnName vs repositories)**: floor =
   repository construction REJECTS models carrying any `columnName` override
   with a tagged error naming the field (silent wrong SQL is the worst
   outcome); stretch = full logical↔physical key mapping inside the repository
   for all operations. Fixer attempts the stretch ONLY if it can keep
   `SqlModel.makeRepository` reuse or replace it cleanly; otherwise ship the
   floor and record the stretch as backlog.
7. **RULING on pg correctness-8 (registry key vs physical name)**: runtime
   resolution becomes: exact registry-key match, else UNIQUE physical-name
   match, else tagged error (ambiguity = two candidates is an error). The full
   type/runtime unification via literal `Statics.tableName` stays on the
   graduation agenda — document the boundary in assembly docs.
8. **RULING on pg correctness-5 (char padding)**: `char(n)` switches to
   exact-length semantics — derive mode requires an exact `isLength` check;
   explicit `char(n)` verifies/injects exact length, not maxLength; padding
   behavior documented in a Gotcha. (Blank-pad round-trip alteration is
   unacceptable for an encoded-side-faithful design.)
9. All other findings: accepted as filed.
10. Non-blocking accepted for this loop: perf-1 (28× merge win), sqlite
    correctness-4 (per-run temp db), plus jsdoc items ride their wave.

## Fixer waves (SEQUENTIAL — surfaces overlap too much for parallel)

### Wave A — correctness: derivation, variants, version, repository, guards
Findings: core-1, core-2 (ruling 5), core-3 (ruling 4), core-4, core-5
(ruling 6), sqlite-1, sqlite-3, pg-1, pg-2.
Surfaces: src/core/{classification,repository}.ts, src/pg/{model,derive,
combinators,Column}.ts, src/sqlite/{model,Column,combinators}.ts + tests.

### Wave B — assembly, enums, naming, char
Findings: pg-3 (FK target uniqueness), merged enum-values fix (rulings 1+2:
core-6/pg-4/sqlite-2), pg-5 (ruling 8), pg-6 (duplicate physical table names →
SchemaAssemblyError), pg-7 (enum/table export-key collision), pg-8 (ruling 7),
core-7 docs-note (ruling 3).
Surfaces: src/core/{literals,assembly}.ts, src/pg/{schema,combinators}.ts,
src/sqlite/{schema,table,combinators}.ts + tests.

### Wave C — bundle, perf, docs, hygiene
Findings: bundle-1 (dialect-local kit constructors on subpaths; root `make`
stays as documented convenience), bundle-2 (pure annotations, split `fixed`
aggregates, bundle probe), perf-1 (direct merge construction, benchmark
re-run), jsdoc-1 (the full `@internal` inventory — recompute reachability,
tag everything unreachable), jsdoc-2 (Dialect doc block), sqlite-4 (per-run
temp db path).
Surfaces: src/kit.ts, src/{pg,sqlite}/index.ts, src/core/Meta.ts, descriptor
modules (annotations only), JSDoc everywhere, test harness files.

## Loop mechanics

After each wave: full proofs (tsgo unmasked + `bun test scratchpad/bsl/`),
reviewer-law census (zero assertions), then the next wave. After Wave C: a
verification re-review pass over the diff, then commit. Every fix must keep
both-sides parity (type + runtime) — several findings ARE one-sided checks;
do not fix one side only.

## Wave A fixer report

### core-1 — fixed

- Changed files: `src/core/classification.ts`, `src/pg/derive.ts`,
  `src/sqlite/derive.ts`, `test/unit.test.ts`, `test/sqlite-unit.test.ts`.
- New tests: suspended nullable schemas now construct PostgreSQL and SQLite
  models, derive text storage, and preserve runtime nullability.
- Residual risk: cyclic suspensions are rejected loudly; no known silent path
  remains.

### core-2 — fixed

- Changed files: `src/pg/combinators.ts`, `src/pg/model.ts`,
  `src/sqlite/combinators.ts`, `src/sqlite/model.ts`, `test/fixtures.ts`,
  `test/sqlite-fixtures.ts`, `test/unit.test.ts`, `test/sqlite-unit.test.ts`.
- New tests: both dialects have compile-negative fixtures and runtime tagged
  failures for `version()` on explicit `VariantSchema.Field` inputs.
- Residual risk: none known; model construction also rejects hand-built
  version metadata on explicit variant fields.

### core-3 — fixed

- Changed files: `src/pg/Column.ts`, `src/pg/combinators.ts`,
  `src/pg/model.ts`, `test/fixtures.ts`, `test/unit.test.ts`.
- New tests: native-bigint `pg.bigint("bigint")` versions fail at the type
  boundary and throw a tagged runtime error when types are suppressed.
- Residual risk: number-mode bigint retains JavaScript safe-integer limits,
  matching the triage ruling.

### core-4 — fixed

- Changed files: `src/core/repository.ts`, `test/fixtures.ts`,
  `test/perf.consumer.ts`, `test/unit.test.ts`.
- New tests: version and non-unique locator keys are compile-negative and
  synchronously rejected at runtime; the performance consumer locator now
  declares its intended primary-key invariant.
- Residual risk: composite locators remain unsupported and are rejected by the
  single-field locator contract.

### core-5 — floor-shipped

- Changed files: `src/core/repository.ts`, `test/fixtures.ts`,
  `test/unit.test.ts`.
- New tests: a model carrying `columnName("legacy_name")` is compile-negative
  for optimistic repository construction and throws a tagged error naming
  `displayName` at runtime.
- Residual risk: full logical-to-physical repository key mapping is not
  implemented; it remains graduation backlog per ruling 6.

### sqlite-1 — fixed

- Changed files: `src/sqlite/Column.ts`, `test/sqlite-fixtures.ts`,
  `test/sqlite-unit.test.ts`.
- New tests: tag/kind mismatches and enum descriptors missing `values` are
  compile-negative model fixtures and both reach the tagged model-error
  boundary without raw property-access failures.
- Residual risk: extra inert object properties remain tolerated, matching the
  existing author-seam guard posture.

### sqlite-3 — fixed

- Changed files: `src/sqlite/model.ts`, `test/sqlite-fixtures.ts`,
  `test/sqlite-unit.test.ts`.
- New tests: plain number-mode `INTEGER PRIMARY KEY` ids are optional in both
  Effect and Drizzle insert types, and the runtime Effect insert schema accepts
  omission without `AUTOINCREMENT`.
- Residual risk: none known; `autoIncrement()` still exclusively controls the
  SQLite `AUTOINCREMENT` reuse policy.

### pg-1 — fixed

- Changed files: `src/pg/derive.ts`, `src/pg/model.ts`, `test/fixtures.ts`,
  `test/unit.test.ts`.
- New tests: string, number, date, byte, object, mode, and array carrier
  mismatches are compile-negative at their combinators and now throw tagged
  model errors when executed with suppressed types.
- Residual risk: `unsafeCustom()` remains deliberately exempt, as its public
  contract explicitly owns no carrier validation.

### pg-2 — fixed

- Changed files: `src/pg/derive.ts`, `test/fixtures.ts`, `test/unit.test.ts`.
- New tests: `instanceOf(RegExp)` is a compile-negative bare model field and a
  runtime `DeriveColumnError`; structurally encoded `Struct` and `Array`
  schemas remain positive JSONB derivations.
- Residual risk: structurally JSON-compatible typing cannot prove JSON
  serializability of every nested runtime value; runtime derivation remains
  intentionally AST-family based.

Final Wave A proof: `tsgo` exit 0; `bun test scratchpad/bsl/` exit 0 with
59 tests and 263 expectations; AST assertion census across `src` and `test`
found zero runtime type assertions.

## Wave B fixer report

### pg-3 — fixed

- Changed files: `src/pg/schema.ts`, `src/sqlite/schema.ts`,
  `test/fixtures.ts`, `test/sqlite-fixtures.ts`, `test/unit.test.ts`,
  `test/sqlite-unit.test.ts`, `test/live.test.ts`.
- New tests: compile-negative and tagged runtime failures reject non-unique
  targets on both dialects; the live PostgreSQL proof accepts a unique target
  and rejects a missing referenced value at execution.
- Residual risk: validation covers the supported single-column inline
  `primaryKey()` / `unique()` target metadata; composite target keys remain
  outside the single-column reference contract.

### merged enum-values fix (core-6 / pg-4 / sqlite-2) — fixed

- Changed files: `src/core/literals.ts`, `src/pg/derive.ts`,
  `src/pg/combinators.ts`, `src/sqlite/combinators.ts`, `test/fixtures.ts`,
  `test/sqlite-fixtures.ts`, `test/unit.test.ts`, `test/sqlite-unit.test.ts`,
  `test/live.test.ts`.
- New tests: both dialects preserve first-occurrence order while deduplicating
  literals and throw tagged `DeriveColumnError` values for NUL; the live
  PostgreSQL migration applies the deduplicated enum DDL.
- Residual risk: none known for finite string literal schemas; NUL remains an
  intentional loud rejection rather than a SQL encoding feature.

### pg-5 — fixed

- Changed files: `src/pg/derive.ts`, `src/pg/combinators.ts`,
  `src/pg/model.ts`, `test/fixtures.ts`, `test/unit.test.ts`,
  `test/live.test.ts`.
- New tests: derive requires `isLengthBetween(n, n)`, explicit length verifies
  or injects the exact check, hand-built metadata fails the model runtime
  mirror, and PGlite demonstrates blank-padding while exact valid values round
  trip unchanged.
- Residual risk: Effect checks are not visible in TypeScript types, so exact
  width is enforced at combinator/model runtime rather than by a type-level
  check predicate.

### pg-6 — fixed

- Changed files: `src/core/assembly.ts`, `src/pg/schema.ts`,
  `src/sqlite/schema.ts`, `test/fixtures.ts`, `test/sqlite-fixtures.ts`,
  `test/unit.test.ts`, `test/sqlite-unit.test.ts`.
- New tests: duplicate physical names on both dialects throw the dialect's
  tagged `SchemaAssemblyError` before projection.
- Residual risk: physical table-name literals are runtime statics, so this
  invariant is runtime-only.

### pg-7 — fixed

- Changed files: `src/pg/schema.ts`, `test/fixtures.ts`,
  `test/unit.test.ts`, `test/live.test.ts`.
- New tests: `drizzleSchema` retains both `enum:record_status` and
  `table:record_status`; the collision-bearing combined export applies through
  drizzle-kit and includes both enum and table DDL.
- Residual risk: callers that manually spread the legacy `enums` and `tables`
  records can still recreate the JavaScript key collision; the assembly-owned
  migration surface is collision-proof.

### pg-8 — fixed per ruling 7

- Changed files: `src/pg/schema.ts`, `src/sqlite/schema.ts`,
  `test/fixtures.ts`, `test/sqlite-fixtures.ts`, `test/unit.test.ts`,
  `test/sqlite-unit.test.ts`.
- New tests: both dialects prove exact registry-key precedence and unique
  physical-name fallback; missing targets and duplicate physical names remain
  tagged errors.
- Residual risk: compile-time validation still recognizes registry keys only;
  the documented physical-name fallback is runtime-only until model statics
  preserve literal table names.

### core-7 docs-note — fixed; feature remains backlog

- Changed files: `src/pg/schema.ts`, `src/sqlite/schema.ts`.
- New tests: none; existing direct/reverse self-reference relation tests remain
  green.
- Residual risk: self-referential junctions intentionally emit direct and
  reverse relations only; disambiguated through-relations remain graduation
  backlog per ruling 3.

Final Wave B proof: `tsgo` exit 0; `bun test scratchpad/bsl/` exit 0 with
63 tests and 291 expectations; AST census across `src` and `test` found zero
`as`, angle-bracket assertion, `satisfies`, or non-null assertion nodes.

## Wave C fixer report

### bundle-1 — fixed

- Changed files: `src/kit.ts`, `src/pg/kit.ts`, `src/pg/index.ts`,
  `src/sqlite/kit.ts`, `src/sqlite/index.ts`,
  `test/import-boundary.test.ts`.
- New proof: both dialect subpaths export a local `make` constructor. A
  transitive source-graph test confirms `pg/kit.ts` never reaches `src/sqlite/`
  and `sqlite/kit.ts` never reaches `src/pg/`.
- Residual risk: root `make` deliberately retains both dialects as the
  documented configuration-driven convenience API; bundle-sensitive consumers
  must use a dialect subpath.

### bundle-2 — fixed

- Changed files: `src/core/Meta.ts`, `src/core/variant.ts`,
  `src/pg/Column.ts`, `src/pg/extras.ts`, `src/sqlite/Column.ts`,
  `src/sqlite/extras.ts`, `test/bundle-pg-integer.consumer.ts`,
  `test/import-boundary.test.ts`.
- Applied 51 standard `@__PURE__` annotations to verified-pure module-scope
  descriptor, statics, matcher, and dispatcher initializers. Split the
  PostgreSQL `fixed` aggregate into ten independent annotated initializers.
- New proof: Bun bundles a consumer exporting only `pg.integer`; the output
  excludes unrelated custom/timestamp descriptor code and SQLite's
  `timestamp_ms` family marker. The source-graph proof separately excludes the
  sibling dialect.
- Residual risk: the probe covers Bun's current tree shaker and package-owned
  families; cross-bundler validation remains a graduation/package-metadata
  concern.

### perf-1 — fixed

- Changed file: `src/core/Meta.ts`.
- `Meta.Merge` and the generic `merge(meta, patch)` call signature are
  unchanged. The implementation now constructs the eleven-property result
  directly with the same undefined-preserving semantics; the Option and Struct
  imports and per-call evolver closures are gone.
- Nine alternating samples at 500,000 calls: direct median 6.302237 ms
  (12.604474 ns/call), former evolver median 219.969982 ms
  (439.939964 ns/call), 34.9035x faster. Representative records were
  Effect-equal.
- Residual risk: this remains a model-definition/startup optimization, not a
  repository query-path benchmark.

### jsdoc-1 — fixed

- Changed files: `src/core/Field.ts`, `src/core/Meta.ts`,
  `src/core/assembly.ts`, `src/core/classification.ts`,
  `src/core/entity-id.ts`, `src/core/literals.ts`, `src/core/model.ts`,
  `src/core/variant.ts`, `src/internal/case.ts`,
  `src/internal/guards.ts`, `src/internal/statics.ts`, `src/pg/Column.ts`,
  `src/pg/derive.ts`, `src/pg/model.ts`, `src/pg/table.ts`,
  `src/sqlite/Column.ts`, `src/sqlite/derive.ts`,
  `src/sqlite/model.ts`.
- Recomputed reachability through `src/index.ts`, `src/pg/index.ts`, and
  `src/sqlite/index.ts` with the TypeScript checker, recursively expanding
  namespace re-exports. Added 214 `@internal` tags across unreachable owning
  declaration facets, including overloads and every export under
  `src/internal/`; the follow-up AST audit reports zero missing declarations.
- Residual risk: future module exports require the same reachability audit until
  the graduation docs/declaration lint automates it.

### jsdoc-2 — fixed

- Changed file: `src/kit.ts`.
- Removed the unused internal runtime `Dialect` guard object. The measured
  type-focused prose and Example now document the actual public `Dialect` type
  declaration under `@category type-level`.
- Residual risk: none known.

### sqlite-4 — fixed

- Changed file: `test/sqlite-live.test.ts`.
- Each run now allocates an Effect `FileSystem.makeTempDirectory` path, places
  `live.sqlite` inside it, and recursively removes only that owned directory.
- Concurrency proof: two simultaneous `bun test
  scratchpad/bsl/test/sqlite-live.test.ts` processes both exited 0 with 5 tests
  and 23 expectations each.
- Residual risk: a hard process kill can leave its uniquely owned OS-temp
  directory behind, but cannot delete or mutate another run's database.

Final Wave C proof: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json
--noEmit --pretty false` exited 0; `bun test scratchpad/bsl/` exited 0 with 65
tests and 300 expectations; `git diff --check -- scratchpad/bsl` exited 0; the
AST assertion census across `src` and `test` found zero `as`, angle-bracket
assertion, `satisfies`, or non-null assertion nodes.
