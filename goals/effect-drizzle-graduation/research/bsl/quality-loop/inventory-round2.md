# Quality-Loop Inventory — Round 2 (Verification Panel) Triage & Routing

V1: 26/26 round-1 fixes verified, 0 regressed. V2 (pg): 14 blocking. V3
(sqlite): 8 blocking. Raw findings in `findings-v2.md` / `findings-v3.md`.
This is the exhaustiveness harvest the operator directed — every finding has a
live reproduction.

## Triage rulings

1. **Name/identifier findings form ONE system** (v2-pg-1, v2-pg-2, v2-pg-3,
   v2-pg-4, v3-sqlite-1, v3-sqlite-7): fixed together as the operator-directed
   Wave D name-invariant system (see `verification-charter.md` §Wave D + the
   REFINED seed). Type level = the refined cheap-prefix sketch on every naming
   surface. Runtime = the COMPLETE check: NUL/empty rejection, PG 63-BYTE
   limits (identifiers AND enum labels), post-normalization collision
   detection (snake-case collisions, dialect case-folding collisions,
   PG truncation-prefix collisions), and assembly-level schema-global
   namespace validation (index/constraint/table/enum-type names share PG's and
   SQLite's schema namespaces — cross-table uniqueness enforced with tagged
   errors). Empty-string enum LABELS remain allowed (v2-pg-4 proved PG
   accepts them).
2. **Parameterized schema expressions are structurally rejectable**
   (v3-sqlite-3 + the parameterized aspect of v2-pg-11): a drizzle `SQL`
   carrying bound parameters into CHECK / partial-index WHERE / generated /
   default positions is detectable from the SQL object at projection time —
   reject loudly on BOTH dialects (PG inlines CHECK params today, but the
   other positions and SQLite all break; uniform rejection is the honest
   contract — note the PG CHECK inlining change in docs).
3. **Deeper expression semantics are deferred-loudly, not analyzed**
   (v2-pg-11 remainder, v3-sqlite-4): immutability, subqueries,
   generated-column chaining, non-deterministic functions — BSL is not a SQL
   semantic analyzer. Fix = Gotchas on `generated`/`defaultExpr`/
   `Table.check`/partial-index docs + live negative probes committed as tests
   DOCUMENTING the boundary + graduation-agenda entry. Reviewer's own
   recommendation; adopted.
4. **Value domains** (v2-pg-12): integer-family bounds are closed rules —
   INJECT/verify range checks (smallint/integer and sqlite integer modes)
   exactly like varchar's inject mode. String-format domains (uuid, date,
   numeric strings): inject where effect v4 ships the check (verify against
   source); otherwise document carrier-only posture per type in Gotchas.
   No hand-rolled format validators.
5. **Array rectangularity** (v2-pg-13): runtime-injectable — dims≥2 array
   fields gain a rectangularity check on the decoded side (type level cannot
   express it; both-sides law satisfied by runtime completeness + docs).
6. **SQLite numeric-mode fidelity** (v3-sqlite-2): data corruption is
   disqualifying. Fixer probes which modes round-trip faithfully on the
   installed stack and RESTRICTS `sqlite.numeric` to those; broken modes are
   removed or rejected loudly with the evidence documented. No silent
   affinity coercion survives.
7. **Defaults value validation** (v2-pg-6, v3-sqlite-8): literal defaults
   validate beyond carrier — finite numbers for float columns, NUL-free
   strings; bytea/blob literal defaults either render correctly (verified
   live) or are rejected with `unsafeDefaultSql` as the documented escape.
8. **Composites & referential actions** (v2-pg-7, v2-pg-8, v2-pg-9,
   v2-pg-10, v3-sqlite-6): duplicate columns in a composite = error; at most
   ONE primary key total (inline + composite) = error; extras names unique
   within the table = error; composite-PK members require non-null encoded
   schemas (tuple-level typing + runtime, mirroring the inline-PK rule);
   `SET NULL` requires nullable source and `SET DEFAULT` requires a declared
   default — both dialects, assembly-time tagged errors.
9. **Bounds & cardinality** (v2-pg-5, v2-pg-14, v3-sqlite-5): varchar ≤
   10485760; numeric precision ≤ 1000 and scale bounds (per PG docs incl.
   the valid scale>precision case the probe confirmed); PG index/unique ≤ 32
   columns; PG table ≤ 1600 columns; SQLite ≤ 2000; zero-field models
   rejected both dialects; SQLite generated-only tables rejected. Runtime
   checks with tagged errors (counts are not type-level territory).

## Routing (sequential)

### Wave D — the identifier/name invariant system (ruling 1)
Charter: `verification-charter.md` §Wave D including the REFINED seed and the
Exclude/cache-key mechanics. Surfaces: naming combinators, model factories,
TableExtras constructors, both assemblies, core name module (new, likely
`src/core/names.ts`). Perf fixture re-measured after — instantiation growth
must be proportionate (record numbers).

### Wave E — value/structure validation (rulings 2–9)
Everything else above. Surfaces: combinators (both dialects), model
factories, TableExtras, assemblies, repository untouched. Live probes become
tests where rulings demand them.

### Final: V4 verification (fix-verification of D+E) → closing commit.

## Addendum to ruling 1/Wave E docs (operator reaction to empty enum labels)

Empty-string enum labels stay projectable (they are domain VALUES, not
identifiers — faithful projection of a valid schema is the point), but the
smell is real: `""` as an enum member almost always models absence. Wave E
adds an earned Gotcha to `enum()` on both dialects: empty labels are legal
and projected faithfully; if `""` means "no value", model absence as
`OptionFromNullOr` (encoded NULL) instead of an empty label.

## Wave D fixer report

### Finding status

- `v2-pg-1`: fixed. PostgreSQL table, column, enum-type, index, and constraint
  identifiers reject empty/NUL/invalid names and names over 63 UTF-8 bytes.
- `v2-pg-2`: fixed. Model construction rejects physical-column collisions
  after snake-case and case-fold normalization; assembly rejects table/enum
  collisions using PostgreSQL's 63-byte truncation prefix.
- `v2-pg-3`: fixed. PostgreSQL assembly inventories table, enum-type, index,
  primary-key, unique, check, and foreign-key names and rejects collisions with
  `SchemaAssemblyError`.
- `v2-pg-4`: fixed. PostgreSQL enum labels reject NUL and values over 63 UTF-8
  bytes while preserving the valid empty-string label.
- `v3-sqlite-1`: fixed. SQLite table/column names reject empty/NUL/invalid
  identifiers, snake-case duplicates, and case-folded duplicates.
- `v3-sqlite-7`: fixed. SQLite assembly inventories table, index, primary-key,
  unique, check, and foreign-key names and rejects schema-global collisions
  with `SchemaAssemblyError`.

### Files

- Added `src/core/names.ts` for the cached message-free `IsValidSqlName`, the
  O(1) per-surface diagnostic shell, UTF-8 byte checks, dialect canonical keys,
  and shared tagged runtime errors.
- Wired type/runtime validation through `src/{pg,sqlite}/combinators.ts`,
  `extras.ts`, `model.ts`, and `kit.ts`.
- Added canonical physical-table and complete schema-namespace validation in
  `src/core/assembly.ts` and both dialect `schema.ts` assemblers.
- Added type-negative and runtime-negative fixtures/tests in `test/fixtures.ts`,
  `test/sqlite-fixtures.ts`, `test/unit.test.ts`, and
  `test/sqlite-unit.test.ts`.

### Proof and performance

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`: pass.
- `bun test scratchpad/bsl/`: pass, 69 tests and 324 assertions.
- The requested spelling `bun test scratchpad/bsl/.` exits nonzero under Bun
  1.3.14 because the literal dotted filter matches no test files; no exit was
  masked. Removing only the terminal dot runs the complete five-file suite
  reported above.
- Perf fixture command: `./node_modules/.bin/tsc -p scratchpad/bsl/tsconfig.json
  --noEmit --pretty false --extendedDiagnostics`.
- Before: 2,495,244 instantiations. After: 2,540,189 instantiations. Growth:
  44,945 instantiations (1.80%), proportionate to the added dialect surfaces and
  negative fixtures.
- No recursive character-walking types and no new runtime type assertions.

### Residual risk

- The type-level check is deliberately only the charter's cheap prefix. Dynamic
  or widened strings defer to the complete runtime validator; UTF-8 byte length,
  full character-set validation, and normalized collision detection remain
  runtime-only by design.
- Namespace inventory relies on the installed Drizzle `getTableConfig` object
  shape; the existing release-candidate compatibility boundary still requires
  revalidation when the Drizzle pin changes.

## Wave E fixer report

### Per-ruling status

2. Fixed. PostgreSQL and SQLite render typed defaults, generated expressions,
   CHECKs, and partial-index predicates through the installed dialect and throw
   tagged `SqlExpressionError` values when any bound parameter remains.
3. Fixed as ruled. No SQL semantic analyzer was added. All four typed expression
   APIs carry loud Gotchas, both live suites retain representative database
   rejections, and the boundary is on the graduation-grill agenda.
4. Fixed. PostgreSQL `smallint` and `integer`, plus SQLite integer modes, inject
   their closed numeric domains into plain and variant schemas. PostgreSQL UUID
   and numeric strings use the checks shipped by installed Effect v4; string
   date mode is documented carrier-only because the installed date support is a
   transformation rather than a reusable encoded-string check.
5. Fixed. PostgreSQL arrays validate scalar element domains at runtime and
   dimensions two through five reject ragged shapes at the schema boundary.
6. Fixed. Live `bun:sqlite`/Drizzle probes demonstrate NUMERIC affinity rewriting
   exponent, leading-zero, and high-precision strings. SQLite NUMERIC now exposes
   only finite-number and signed-64-bit bigint modes; string mode is rejected and
   callers needing exact decimal spelling are directed to TEXT.
7. Fixed. Literal defaults are validated against the complete encoded schema,
   then against dialect representation rules. Non-finite numbers, NUL strings,
   and unproven PostgreSQL `bytea`/SQLite BLOB literals fail with tagged model
   errors; `unsafeDefaultSql` is the explicit escape.
8. Fixed. Both dialects reject duplicate composite members, nullable composite
   primary-key members, more than one total primary key, duplicate table-extra
   names, `SET NULL` on non-null sources, and `SET DEFAULT` without a declared
   database default. Literal tuples and reference options receive type-level
   diagnostics; runtime mirrors remain complete.
9. Fixed. Tagged runtime errors enforce PostgreSQL varchar/numeric bounds, the
   32-column index-backed constraint ceiling, the 1,600-column table ceiling,
   SQLite's 2,000-column ceiling, non-empty models, and SQLite's requirement for
   at least one non-generated column.

The empty-enum-label addendum is applied to both dialect docs: `""` remains a
legal domain value, while absence points to `OptionFromNullOr(...)` and encoded
`NULL`.

### Files and tests

- Shared parameter rejection lives in `src/core/Meta.ts`; dialect projection is
  wired in `src/{pg,sqlite}/table.ts` and `extras.ts`.
- Value-domain, expression-boundary, enum, array, and reference docs/behavior are
  in `src/{pg,sqlite}/combinators.ts` and `src/{pg,sqlite}/Column.ts`.
- Default, cardinality, composite, primary-key, and assembly validation is in
  `src/{pg,sqlite}/model.ts`, `extras.ts`, and `schema.ts`.
- Compile-negative and runtime-negative fixtures are in `test/fixtures.ts` and
  `test/sqlite-fixtures.ts`; unit coverage is in `test/unit.test.ts` and
  `test/sqlite-unit.test.ts`.
- `test/live.test.ts` and `test/sqlite-live.test.ts` retain negative expression,
  value-domain, default, referential-action, bounds/cardinality, rectangularity,
  and NUMERIC round-trip probes.
- Deferred semantics are also recorded in `README.md` and
  `research/round7-report.md`.

### Proof

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`:
  pass.
- `bun test scratchpad/bsl/`: pass, 83 tests and 383 assertions across five
  files.
- As already observed in Wave D, Bun 1.3.14 treats the requested literal
  `bun test scratchpad/bsl/.` as a non-matching filter and exits nonzero with no
  tests. That exit is not masked; removing only the terminal dot executes the
  complete suite above.
- The added runtime implementation and tests contain no type-assertion syntax.

### Residual risk

- SQL volatility, subqueries, generated-column chaining, and other deeper
  expression grammar remain database-checked by design; committed live probes
  guard that documented boundary.
- PostgreSQL string date syntax remains carrier-only until Effect ships a
  reusable encoded-side check. Trusted raw SQL escape hatches necessarily bypass
  BSL carrier and semantic checks.
- SQLite builds may advertise a lower column limit than the installed
  `MAX_COLUMN=2000`; the supported stack's ceiling is enforced here, while a
  differently compiled engine remains an environment compatibility boundary.
