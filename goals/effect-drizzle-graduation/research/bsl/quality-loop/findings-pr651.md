### PRRT_kwDOPbO_N86YAAJF scratchpad/bsl/src/sqlite/combinators.ts:131

**![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)  Restrict JSON mode to JSON-compatible encoded values**

In the SQLite path, this `object` constraint also accepts declaration-backed values such as `Date` and `Uint8Array`, so `Date.pipe(sqlite.text({ mode: "json" }))` typechecks and model construction accepts it. Drizzle serializes a `Date` to a JSON string rather than a `Date`, causing the first selected row to fail the schema decoder after data has already been persisted; narrow this to structural JSON carriers and mirror that validation at model construction.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJL scratchpad/bsl/src/sqlite/derive.ts:59

**![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)  Narrow bare SQLite JSON derivation to structural schemas**

For a bare declaration schema such as `instanceOf(RegExp)`, the encoded type satisfies `object`, so the public model signature treats the field as derivable JSON; at runtime, however, `SqliteColumn.Spec.fromSchemaAST` does not handle `Declaration`, and the same model throws `DeriveColumnError` during class construction. Limit this branch to arrays and string-keyed structural records so compile-time derivation matches the runtime AST policy.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJQ scratchpad/bsl/src/core/repository.ts:77

**![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)  Exclude nullable unique columns from repository locators**

A nullable field marked `unique()` is admitted as an `idColumn`, even though both supported databases allow multiple `NULL` values in a unique column and the optimistic update emits `where  = ${id}`. When `id` is `null`, that predicate never matches, so a type-approved update always reports a version conflict and the column cannot uniquely locate a row; require unique locators to be non-null or restrict locators to primary keys.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJY scratchpad/bsl/src/pg/combinators.ts:1567

**![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)  Reject nullable optimistic-version fields**

The PostgreSQL and SQLite `version()` constraints both accept `NullOr(Int)`, so an insert may explicitly persist a `NULL` version and the generated update schema also accepts `revision: null`. Calling the repository with that valid payload then throws synchronously from `requireVersion` because it requires an `Int`, leaving the row permanently outside the optimistic-update path; add a non-nullability check at both version combinators and their runtime model validators.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJe scratchpad/bsl/src/sqlite/Column.ts:355

**![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)  Prevent NaN from deriving to SQLite REAL**

A bare `effect/Schema.Number` field derives to a non-null SQLite `REAL` column without adding a finite/NaN guard, even though that schema accepts `NaN`. On the inspected `bun:sqlite` path, binding `NaN` converts it to SQL `NULL`, so an otherwise schema-valid insert fails the generated `NOT NULL` constraint (and a nullable field silently round-trips as `null` instead); derivation and explicit `real()` should refine the effective schema to the faithfully representable domain.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJj scratchpad/bsl/src/pg/combinators.ts:255

**![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)  Reject mixed exact widths when deriving char columns**

For a schema union whose branches have different exact lengths, such as exact-width 2 or exact-width 3 strings, derive mode collects both checks and chooses the minimum, producing `char(2)`. Model validation then accepts that result because it only looks for any matching width, even though the schema still admits three-character values that PostgreSQL cannot store in `char(2)`; derive only when every reachable exact-width constraint agrees.

AGENTS.md reference: [AGENTS.md:L10-L10](https://github.com/beep-effect/beep-effect/blob/5f46f65241f368e81000414581706360426e60f8/AGENTS.md#L10-L10)

Useful? React with 👍 / 👎.

### PRRT_kwDOPbO_N86YAAJn scratchpad/bsl/src/pg/table.ts:468

**![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)  Validate generated names in standalone PostgreSQL projection**

The standalone `toPgTable` path validates declared extra nodes but never inventories Drizzle-generated primary-key and unique-constraint names as `schema()` does. With individually valid long table and column names, generated names can exceed PostgreSQL's 63-byte limit or share a truncation prefix, so direct table projection can produce silently renamed or colliding DDL despite being the documented API for standalone models; run the same generated-name validation before returning this table.

Useful? React with 👍 / 👎.


## Triage (Fable, all seven ACCEPTED as valid fixes)

- JAJF json-mode declarations: narrow the sqlite json-mode encoded constraint to
  structural JSON carriers (reject Date/Uint8Array declarations), runtime mirror
  at model construction. Live probe: Date through json mode currently corrupts.
- JAJL bare-derivation declarations: mirror the pg Wave-A fix (DeriveFromEncoded
  declaration special-casing) on the sqlite type-level derivation so it matches
  the runtime AST policy.
- JAJQ nullable-unique locators: repository locator keys require non-null
  encoded schemas — type level (exclude nullable from IdKey) + runtime rejection.
- JAJY nullable versions: version() combinators reject nullable encoded schemas
  on both dialects (ValidateNonNullable) + runtime model validation.
- JAJe NaN→REAL on sqlite: sqlite-scoped fidelity rule (bun:sqlite binds NaN as
  NULL): derivation and explicit real() refine the effective schema to finite
  numbers on SQLITE ONLY — PostgreSQL float8 legitimately stores NaN; do not
  touch pg semantics. Live probe proves the binding behavior.
- JAJj mixed exact widths: char derive mode requires ALL reachable exact-width
  checks to agree; disagreement is a loud error, never min().
- JAJn standalone generated-name validation: toPgTable runs the same
  generated-name (pk/unique) inventory validation schema() runs; sqlite
  standalone path checked for the same parity gap.

## Wave F fixer report

### Per-finding status

- **JAJF — fixed.** SQLite `text`/`blob` JSON modes now accept only encoded
  arrays or string-keyed records at the type level, reject declaration-backed
  carriers in the combinator, and repeat the check during model construction.
  Negative fixtures cover `Date`, `Uint8Array`, and hand-built metadata. A live
  Drizzle probe proves that a `Date` is persisted as JSON text and selected as a
  string rather than a `Date`.
- **JAJL — fixed.** SQLite bare derivation now mirrors PostgreSQL's structural
  array/record conditional instead of treating every encoded object as JSON.
  `instanceOf(RegExp)` is rejected by both the model type and runtime AST
  classifier.
- **JAJQ — fixed.** Repository locator keys exclude fields whose encoded schema
  admits `null`; runtime construction resolves the original field schema and
  rejects nullable primary/unique locators. A nullable-unique fixture proves
  both paths.
- **JAJY — fixed.** PostgreSQL and SQLite `version()` add
  `ValidateNonNullable`, reject nullable schemas immediately, and repeat the
  invariant in both dialect model validators. Negative fixtures exercise the
  combinator and hand-built-metadata paths for both dialects.
- **JAJe — fixed (SQLite only).** Explicit `sqlite.real()` and bare SQLite REAL
  derivation refine effective schemas to finite numbers. A live `bun:sqlite`
  probe confirms that binding `NaN` produces SQL `NULL`. PostgreSQL
  `doublePrecision()` behavior is unchanged and a regression assertion confirms
  its schema still accepts `NaN`.
- **JAJj — fixed.** PostgreSQL `char()` derive mode now requires every reachable
  exact-width check to agree, and model construction requires every width to
  match the projected `char(n)`. Mixed-width union fixtures cover both the
  combinator and hand-built-metadata paths.
- **JAJn — fixed.** Standalone PostgreSQL and SQLite projection inventory the
  generated constraint namespace before returning. Inline generated unique
  names (and PostgreSQL inline primary-key names) are included in the same
  assembly inventory; a long standalone PostgreSQL generated unique name is
  rejected before DDL.

### Changed files

- Runtime/type-level implementation: `src/core/repository.ts`,
  `src/pg/{combinators,model,schema,table}.ts`,
  `src/sqlite/{combinators,derive,model,schema,table}.ts`.
- Negative fixtures and runtime proofs: `test/fixtures.ts`,
  `test/sqlite-fixtures.ts`, `test/unit.test.ts`,
  `test/sqlite-unit.test.ts`, `test/sqlite-live.test.ts`.

### Proofs

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`
  — exit 0.
- `bun test scratchpad/bsl/` — 86 pass, 0 fail, 402 assertions, exit 0.
- Focused live probes are in `sqlite-live.test.ts`; the focused file run passed
  10 tests and 41 assertions.
- The literal requested spelling `bun test scratchpad/bsl/.` exits 1 in Bun
  1.3.14 before discovery because the trailing `/.` is treated as a filter;
  removing only the final dot runs the complete same directory successfully.

### Residual risk

- The SQLite fidelity behavior is proven against the installed Bun 1.3.14
  `bun:sqlite` binding; another SQLite driver may bind non-finite values
  differently, but the public SQLite schema remains deliberately portable by
  rejecting values that this supported live path cannot preserve.
- PostgreSQL NaN behavior was intentionally not narrowed. This wave adds a
  schema-level regression assertion, while the existing PostgreSQL live suite
  remains the end-to-end database proof.
