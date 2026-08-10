# BSL Round 7 Report — SQLite as an Architecture Proof

Date: 2026-08-10  
Scope: `scratchpad/bsl/**` only  
Commit: none

## Outcome

Round 7 adds SQLite as a real sibling dialect without introducing a portable SQL IR. The root
factory now overloads `make` for `dialect: "pg" | "sqlite"`; `src/sqlite/` owns its descriptor
algebra, combinators, projector, extras, models, and assembly adapter. Core owns the shared
EntityId/literal helpers and the direct/reverse/through relation constructor. Core imports neither
dialect, and the dialect directories do not import each other.

The live suite applies BSL-projected SQLite DDL to a real file, proves a second no-op push, and
runs native and optimistic Effect SQL repositories plus Drizzle RQBv2 relations. PostgreSQL's
existing unit and live suites remain green.

## A. Installed-source audit and dialect design

The exact installed versions are Drizzle ORM `1.0.0-rc.4-fb12281`, drizzle-kit
`1.0.0-rc.4-ca0f029`, and `@effect/sql-sqlite-bun` `4.0.0-beta.104`
(`node_modules/drizzle-orm/package.json:1-4`, `node_modules/drizzle-kit/package.json:1-4`,
`node_modules/@effect/sql-sqlite-bun/package.json:1-4`). Design followed these sources:

| Fact verified before projection | Installed source |
|---|---|
| `text` has text/JSON modes; text also carries a non-empty enum tuple | `node_modules/drizzle-orm/sqlite-core/columns/text.d.ts:8-18`, `:31-57` |
| `integer` has number, boolean, timestamp, and timestamp-ms modes | `node_modules/drizzle-orm/sqlite-core/columns/integer.d.ts:30-90` |
| integer `primaryKey({ autoIncrement })` returns `IsPrimaryKey<HasDefault<NotNull<...>>>` | `node_modules/drizzle-orm/sqlite-core/columns/integer.d.ts:10-28` |
| runtime `primaryKey` records `autoIncrement` and always records `hasDefault` | `node_modules/drizzle-orm/sqlite-core/columns/integer.js:7-24` |
| `blob` modes are buffer, JSON, and bigint; installed Drizzle recommends text JSON for SQLite JSON functions | `node_modules/drizzle-orm/sqlite-core/columns/blob.d.ts:7-20`, `:22-59` |
| `numeric` modes are string, number, and bigint | `node_modules/drizzle-orm/sqlite-core/columns/numeric.d.ts:7-52` |
| `real` is the number-double builder | `node_modules/drizzle-orm/sqlite-core/columns/real.d.ts:6-18` |
| generic brands are `$Type`, `NotNull`, `HasDefault`, `IsPrimaryKey`, `HasGenerated`, and `BuildColumns<..., "sqlite">` | `node_modules/drizzle-orm/column-builder.d.ts:102-145`, `:213-224` |
| `sqliteTable`'s current extras callback is an array of index/check/FK/PK/unique builders | `node_modules/drizzle-orm/sqlite-core/table.d.ts:14-34` |
| SQLite indexes expose `where` for partial indexes and no PostgreSQL-style `using` | `node_modules/drizzle-orm/sqlite-core/indexes.d.ts:7-30` |
| composite PK, unique, check, and FK constructors use SQLite columns | `node_modules/drizzle-orm/sqlite-core/primary-keys.d.ts:6-13`, `node_modules/drizzle-orm/sqlite-core/unique-constraint.d.ts:6-17`, `node_modules/drizzle-orm/sqlite-core/checks.d.ts:6-24`, `node_modules/drizzle-orm/sqlite-core/foreign-keys.d.ts:6-51` |
| `defineRelations` is generic over a schema rather than tied to PostgreSQL | `node_modules/drizzle-orm/relations.d.ts:365-379` |

### Descriptor and derivation policy

The SQLite `Data.TaggedEnum` algebra has `text`, `enum`, `integer`, `real`, `blob`, and `numeric`
members. Each member carries `dialect: "sqlite"`, a SQLite-vocabulary storage identity, its
installed mode where applicable, carrier witnesses, and a colocated Drizzle builder compiler.

Bare encoded carriers derive as follows:

- string → text;
- boolean → integer/boolean;
- bigint → blob/bigint;
- number → real;
- object or array → text/JSON;
- number-encoded EntityId → integer with its entity storage identity.

REAL is the bare-number policy because its installed builder is explicitly a number-double
carrier. INTEGER is narrower and remains explicit for integers, keys, and versions. Date and
`Uint8Array` remain loud ambiguities requiring an explicit mode. As in PostgreSQL, encoded null
members determine nullability rather than choosing a column.

SQLite arrays are absent rather than simulated: the subpath has no `array` export, model typing
rejects nonzero dimensions, and both model construction and the projector mirror that rejection.

### Db-assigned keys and variant posture

`sqlite.autoIncrement()` maps exactly to number-mode `integer().primaryKey({ autoIncrement:
true })`. It marks core metadata as primary key, `identity: "byDefault"`, and `hasDefault: true`.
The choice is intentionally not PostgreSQL's `always` posture: an SQLite `INTEGER PRIMARY KEY` is
the ROWID alias, omission asks SQLite to choose the value, but callers may still supply an explicit
ROWID. `AUTOINCREMENT` changes reuse/monotonicity, not that explicit-insert capability. The SQLite
documentation records those semantics in its [AUTOINCREMENT reference](https://www.sqlite.org/autoinc.html).

Consequently the field is optional in both Drizzle `$inferInsert` and the Effect insert variant;
it remains optional in the general update variant, while repository update operations still
require the configured locator at their runtime boundary. Compile-time symmetry fixtures prove
the Drizzle and variant states, and the live repository proves database assignment.

### Timestamps, expressions, and enums

The shared `EffectModel.DateTimeInsert` and `DateTimeUpdate` schemas bind to SQLite text columns.
Overrideable application stamping is unchanged across dialects, so no parser override is needed.
The SQLite-owned `defaultNow()` compiles core `Default.now` metadata to
`strftime('%Y-%m-%dT%H:%M:%fZ','now')`; a projector test renders and checks the real Drizzle SQL.

`sqlite.enum()` reuses the core encoded-literal collector. Projection emits text plus one
table-local `CHECK (column IN (...))`. Literal SQL is escaped and inlined because SQLite prohibits
parameters in CHECK constraints—a failure first exposed by the real CLI push. There is no enum
registry, so using the same domain in two tables deliberately creates two independent checks and
no shared DDL vocabulary.

## B. Spec-family and assembly invariants

Core `ColumnSpec` now requires a dialect marker. Every PostgreSQL descriptor was migrated to
`dialect: "pg"`; SQLite descriptors use `dialect: "sqlite"`. Each model factory performs per-key
family membership validation and emits a readable `~effect-drizzle.error` at the offending field.
Its runtime mirror uses the dialect descriptor guard and raises `ModelInvariantError` for an
invalid or foreign descriptor. Suppressed-type fixtures exercise PG-in-SQLite and
SQLite-in-PostgreSQL construction.

The relation graph records, deterministic names, collision checks, and the direct/reverse/through
constructor now live in `src/core/assembly.ts`. PostgreSQL and SQLite supply their own storage
compatibility checks, concrete table projector, column guard, and FK builder, then call the same
core relation constructor. The live forward/reverse/through queries and the existing PostgreSQL
relation suite exercise both adapters.

`test/import-boundary.test.ts` now proves three edges:

1. core imports neither dialect;
2. PostgreSQL never imports SQLite;
3. SQLite never imports PostgreSQL.

## C. Live SQLite gauntlet

### Driver surface

The installed Bun Drizzle driver accepts a `bun:sqlite` `Database` client and generic relations
(`node_modules/drizzle-orm/bun-sqlite/driver.d.ts:8-40`). The Effect driver opens `bun:sqlite`,
serializes access, enables WAL unless disabled, and documents streaming and `updateValues` as
unsupported (`node_modules/@effect/sql-sqlite-bun/src/SqliteClient.ts:1-8`, `:48-62`,
`:106-135`, `:165-196`). Its concrete layer provides both `SqliteClient` and generic `SqlClient`
(`node_modules/@effect/sql-sqlite-bun/src/SqliteClient.ts:235-269`).

The harness therefore creates one scoped Effect layer for the file, with `snakeCase` query names
and `camelCase` result names, and closes it once after the serial suite. SQLite text timestamps
already reach the schema decoder as strings; unlike the PGlite timestamp harness, no parser pin is
needed.

### DDL path and RC boundary

The installed `drizzle-kit/api-sqlite` exports only `startStudioServer`, not `pushSchema`
(`node_modules/drizzle-kit/api-sqlite.d.ts:14-25`). The working equivalent is the installed CLI:

```text
./node_modules/.bin/drizzle-kit push --dialect sqlite \
  --schema scratchpad/bsl/test/sqlite-drizzle-schema.ts \
  --url /tmp/effect-drizzle-round7-live.sqlite --force --verbose
```

There is an independently pinned RC symbol mismatch: drizzle-kit constructs
`SQLiteSyncDialect` (`node_modules/drizzle-kit/bin.cjs:91054-91064`), while the installed ORM
exports `SQLiteDialect` (`node_modules/drizzle-orm/sqlite-core/index.js:18-35`). The unmodified CLI
fails with `SQLiteSyncDialect is not a constructor`. The live suite preloads
`test/drizzle-kit-sqlite-rc-compat.cjs`, which aliases that one missing constructor name for the
child process without editing installed packages. `script -q -e` supplies a PTY so the CLI's
verbose apply/no-op evidence remains capturable while preserving the child exit code.

### Executed outcomes

Against one real file-backed database, the suite proves:

- projected tables, FKs, enum/version checks, partial index, and `AUTOINCREMENT` apply through the
  CLI; the second identical push reports `No changes detected`;
- `SqlModel.makeRepository` performs insert/find/update/delete with a database-assigned key,
  Overrideable timestamps stored and decoded, and `OptionFromNullOr` none → NULL → some;
- the optimistic repository increments `rowVersion`, returns `VersionConflictError` for a stale
  snapshot, and an unbounded pair of same-version writers produces exactly one success;
- a valid enum round-trips and a raw out-of-domain update fails as a SQLite `SqlError`, proving the
  database CHECK rather than only schema decoding;
- Drizzle RQBv2 returns correct forward, reverse, and through rows.

## D. Cross-dialect symmetry fixture

`test/sqlite-fixtures.ts` declares one dialect-free set of EntityId statics, finite status values,
plain/Option text schemas, and the shared Effect audit schemas. PostgreSQL and SQLite kits bind
that domain independently. Both entities expose the same application audit fields while producing
their own Drizzle table families. The same fixture contains the family-smuggling, dimensions, and
missing-`sqlite.array` negatives.

The negative census is now 78 `@ts-expect-error` directives: the round-6 floor of 74 plus the four
cross-dialect/absent-capability cases.

## E. README, publication style, and proof

The README now contains a short SQLite kit quickstart, describes both implemented dialects, and
lists the remaining boundaries. New source uses named Effect imports and native array/record
operations where equivalent. The public SQLite combinators received Effect-style titled Examples,
categories, and `@since 0.0.0` metadata.

Final proof commands ran with unmasked exits:

```text
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
exit 0

bun test scratchpad/bsl/
56 pass, 0 fail, 241 expect() calls
exit 0
```

Additional proof:

- AST assertion census across all 41 source/test TypeScript files: 0 `as`, angle-bracket
  assertion, `satisfies`, or non-null assertion expressions;
- 78 negative fixtures;
- three-edge import-boundary suite passing;
- zero Effect namespace imports or root `effect` imports in source/test executable imports;
- source has no `@beep/*` or Node-builtin runtime imports; the Node compatibility preload is
  test-only and isolated to the drizzle-kit RC bridge;
- `git diff --check -- scratchpad/bsl`: clean;
- no commit was created.

## Performance fixture rerun

The round-6.5 sample remains the comparison baseline. This run used the same full scratchpad
project, including `test/perf.consumer.ts`, with installed `tsc --extendedDiagnostics`, followed
by an isolated `/usr/bin/time` run around tsgo.

| Metric | Round 6.5 | Round 7 | Delta |
|---|---:|---:|---:|
| Files | 1,249 | 1,285 | +36 |
| Lines | 544,083 | 548,548 | +4,465 |
| Identifiers | 414,343 | 423,512 | +9,169 |
| Symbols | 1,139,805 | 1,142,479 | +2,674 (+0.2%) |
| Types | 588,264 | 592,968 | +4,704 (+0.8%) |
| Instantiations | 2,358,347 | 2,420,390 | +62,043 (+2.6%) |
| Memory | 737,958 K | 747,036 K | +9,078 K (+1.2%) |
| Check time | 0.919 s | 0.796 s | -0.123 s |
| Total time | 1.002 s | 0.854 s | -0.148 s |
| tsgo wall | 1.00 s | 1.18 s | +0.18 s |
| tsgo maximum RSS | 861,960 K | 850,780 K | -11,180 K (-1.3%) |

The expected second dialect increases the graph modestly; instantiations grew 2.6% while type and
memory growth stayed near 1%. The opposing timing/RSS movements remain noise-sensitive single
samples, not thresholds.

## Graduation-grill agenda

1. Align the Drizzle ORM and drizzle-kit RC hashes and remove the SQLite CLI preload; require an
   official SQLite programmatic push API before depending on one as package API.
2. Decide the final root/subpath export map, peer ranges, stability tags, semantic-version policy,
   and deep-import policy for `.`, `./pg`, and `./sqlite`.
3. Create the package-local tstyche lane and pin exact per-key diagnostic messages across supported
   TypeScript versions without restoring repo-global tstyche.
4. Resolve or explicitly defer PostgreSQL enum arrays and preservation of literal relation names
   through the complete relation API.
5. Compile README examples as package consumers once real package metadata exists.
6. Give the package family explicit Biome, docgen, coverage, node-builtin, dependency, and
   instantiation-budget lanes; scratchpad remains intentionally outside several repo-wide gates.
7. Repeat performance samples under a pinned machine state before setting an instantiation or RSS
   budget.
8. Remove the deterministic-service-key fixture suppression after graduation gives the code its
   final package path.
9. Decide whether any schema-expression semantic analyzer belongs in the graduated package. Until
   then, preserve zero-parameter structural rejection, loud API Gotchas, and the PostgreSQL/SQLite
   negative live probes; the databases remain authoritative for deeper expression legality.

No round-7 deliverable is blocked. The SQLite API/CLI RC skew is handled only in the test harness
and remains an explicit graduation blocker rather than a silent production shim.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0, `bun test scratchpad/bsl/` exit 0
(56/56, 241 assertions across 5 files), census clean over 41 files, 78 negatives,
three-edge boundary test read and passing. The rc-compat preload was read in
full and is exactly as described — a test-only `Module._load` alias adding the
renamed constructor when absent, no behavior patching, correctly listed as a
graduation blocker. The `autoIncrement()`-as-byDefault posture is endorsed on
the cited rowid semantics. The dialect-marker requirement on core's spec
contract with both-direction smuggling negatives satisfies the architecture's
acceptance test as briefed. The enum-CHECK inline-escaping discovery (SQLite
prohibits parameters in CHECK) is the kind of live-boundary fact only this
gauntlet finds. No reviewer changes were needed. This also lands the parallel
research artifact `research/effect-jsdoc-conventions.md` (896 lines) governing
round 7.5.
