# BSL Round 6 Report — Publication Shape

Date: 2026-08-10  
Scope: `scratchpad/bsl/**` only  
Commit: none

## Outcome

Round 6 reshaped the experiment as the future `@beep/effect-drizzle` package while keeping it entirely in the scratchpad. The result has a curated root surface, a PostgreSQL subpath surface, a one-way core/dialect dependency seam, no workspace runtime imports, lightweight internal descriptors, and the existing schema-first user surface.

All existing behavior and negative fixtures survived. The final fixture has 74 `@ts-expect-error` cases, up from the required floor of 68, because the round also added suppressed-type runtime proofs for hand-built descriptor seams.

## A. Package-shaped restructure

The source now has these ownership boundaries:

```text
src/index.ts             package root: make, model/variant API, errors, repository
src/internal/            casing, typed static assignment, unknown-record guard
src/core/                Field, Meta, classification, variant factory, assembly naming,
                         dialect-neutral model/repository contracts
src/pg/                  PostgreSQL descriptors, combinators, derivation adapter,
                         projector, extras, assembly, and public subpath
test/                    consumer fixtures, unit/live suites, import boundary, perf fixture
```

`src/index.ts` is intentionally curated rather than a barrel over internals. `src/pg/index.ts` is the future `./pg` surface and exposes PostgreSQL combinators, `Table`, `schema`, and `toPgTable`.

The core import boundary is executable. `test/import-boundary.test.ts` walks every TypeScript file under `src/core` and rejects either `../pg` or `@beep/*` module specifiers. PostgreSQL imports core freely; core never imports PostgreSQL.

The former generated-model static was renamed to `sql`: for example, `User.sql.tableName` and `User.sql.columns`. `sql` describes the data without baking the current PostgreSQL implementation into the model-facing name and leaves room for later dialects.

## B. Dependency diet

The installed Effect v4 source was inspected rather than relying on prior API knowledge.

| Removed facility | Round-6 substitution | Installed-source evidence |
|---|---|---|
| `SchemaUtils.withStatics` / `withCodecStatics` | Internal overload with broad `Object.assign` implementation | `src/internal/statics.ts:1-14`; the overload keeps the intersection type while the implementation returns `object` |
| `TaggedErrorClass` | `Schema.TaggedError` | `node_modules/effect/src/Schema.ts:14765-14793` describes schema-backed yieldable tagged errors; `14853-14858` returns an Effect `Cause.YieldableError` class; the schema base exposes `.make` at `190-213` |
| struct-shaped `LiteralKit` domains | `Data.TaggedEnum` | `node_modules/effect/src/Data.ts:580-601` specifies constructors, `$is`, `$match`, plain objects, and the tag-only guard boundary |
| bare `LiteralKit` domains | literal unions plus small guards | Dialect, identity mode, carrier tags, and foreign-key actions do not need constructor objects or codecs |
| `Str.*` | `effect/String` behind the internal casing seam | `node_modules/effect/src/String.ts:1714-1717` exports `camelCase`; `1799-1801` exports `snakeCase`; `440` exports `isNonEmpty` |
| `Struct.evolve`, entries, and keys | `effect/Struct` and `effect/Record` | `node_modules/effect/src/Struct.ts:421-432` (`assign`) and `525-537` (`evolve`); `node_modules/effect/src/Record.ts:460-463` (`toEntries`) and `1478-1479` (`keys`) |
| `thunkTrue` / `thunkFalse` | `constTrue` / `constFalse` | `node_modules/effect/src/Function.ts:458` and `478` |
| workspace `UnknownRecord` | Local readonly-record type and `Predicate.isObject` guard | `node_modules/effect/src/Predicate.ts:1216-1218`; local seam at `src/internal/guards.ts:4-8` |
| ad-hoc property/tag checks | `Predicate.hasProperty` and generated `$is` guards | `node_modules/effect/src/Predicate.ts:1314-1326` and `Data.ts:591-601` |
| `$ScratchpadId` | Plain package-qualified annotation identifiers | All identifiers now use `@beep/effect-drizzle/...` strings |

The brief requested inline casing only when Effect lacked it. The installed v4 source has both casing operations, so the internal seam delegates to Effect instead of copying an implementation.

`Schema.TaggedError` was selected over `Data.TaggedError` because the errors remain user-facing schema boundaries, are yieldable in Effect programs, inherit `.make`, and keep schema metadata. The runtime suite proves `.make`, structural `Equal.equals`, and `Effect.catchTag` recovery.

Source import census: `src/**` module specifiers are only `effect`, `drizzle-orm`, or relative paths. Test code has the one allowed workspace dependency, `@beep/pglite`, in the live harness.

Accordingly, the future manifest needs no runtime dependency bucket: `effect` and `drizzle-orm` are the two peers, while `@beep/pglite` remains test-only substrate. Package metadata itself remains deliberately out of scope for this round.

## C. Internal descriptor migration

The schema-facing product model did not change: fields and variants remain Effect schemas, derivation reads the encoded schema AST, and public errors remain schema-backed. Only closed internal compiler data moved:

- PostgreSQL column specifications are one `Data.TaggedEnum` with colocated constructors, guards, AST classification, and Drizzle compiler dispatch.
- `Meta.Default` and `Meta.Generated` are `Data.TaggedEnum` values.
- table extras are a `Data.TaggedEnum` with colocated Drizzle emitters.
- assembly edges and junction descriptions are readonly records because no tagged construction behavior is needed.
- references are readonly records with a cheap author-boundary guard.
- generic encoded-AST classification lives in core and receives PostgreSQL behavior through an adapter; PostgreSQL-specific EntityId and column details remain under `pg`.

### Check relocation inventory

| Former codec-time check | Round-6 location |
|---|---|
| full PostgreSQL spec decode | `PgColumn.isSpec` at the hand-built field/model boundary (`src/pg/Column.ts:608-679`, `src/pg/model.ts:463-478`) |
| positive `varchar` / `char` length | descriptor constructor `requireLength`, with the same schema max-length corroboration at model construction |
| numeric precision/scale correlation | numeric constructor, then mirrored by `PgColumn.isSpec` for hand-built values |
| enum name/identity and non-empty string values | enum constructor plus `PgColumn.isSpec`; assembly still rejects incompatible value sets sharing a name |
| custom name/identity correlation | custom constructor plus `PgColumn.isSpec` |
| timestamp `ident` / `withTimezone` correlation | `Timestamp.make` and `PgColumn.isSpec`; a suppressed-type runtime fixture proves the constructor failure |
| default/generated tag construction | `Data.taggedEnum` constructors; combinators remain the only normal authoring route |
| reference record shape and foreign-key actions | `Meta.isReferences` at model resolution (`src/core/Meta.ts:40-51`, `src/pg/model.ts:375-390`) |
| extras callback result decode | array plus `TableExtras.isNode` after callback invocation (`src/pg/extras.ts:68-102`, `src/pg/table.ts:345-364`) |
| nullable primary key, duplicate PK/version, identity/version/generated conflicts | unchanged whole-model construction checks, still mirrored by compile-time validators |
| schema-assembly target presence, SQL identity compatibility, and relation collisions | unchanged assembly checks over the new readonly edge records |

The new tests deliberately hand-build an invalid column, invalid reference, mismatched timestamp, and malformed extras result. Each reaches the runtime guard after its type error is acknowledged with `@ts-expect-error`.

## D. Type-performance baseline

`test/perf.consumer.ts` contains four realistic-width models, kit-provided audit fields, enum/array/JSON fields, table extras, schema assembly, a projected table, and repository/variant consumer types. The same fixture shape was measured immediately before and after the descriptor migration.

### TypeScript extended diagnostics

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Files | 1,240 | 1,249 | +9 |
| Lines | 545,796 | 544,795 | -1,001 |
| Identifiers | 414,588 | 415,116 | +528 |
| Symbols | 1,218,979 | 1,144,788 | -74,191 |
| Types | 614,920 | 591,802 | -23,118 (-3.8%) |
| Instantiations | 2,608,847 | 2,376,293 | -232,554 (-8.9%) |
| Memory | 780,514 K | 739,166 K | -41,348 K (-5.3%) |
| Check time | 0.757 s | 1.018 s | +0.261 s |
| Total time | 0.821 s | 1.123 s | +0.302 s |

### tsgo process measurement

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Wall time | 0.87 s | 1.01 s | +0.14 s |
| Maximum RSS | 910,572 K | 841,936 K | -68,636 K (-7.5%) |

The descriptor migration materially reduced types, instantiations, symbols, and memory in this single-run baseline. The wall/check timings regressed despite the reduced type graph and are short enough to be noise-sensitive; they should be sampled repeatedly before blaming a conditional type. No call-site error types were weakened or hand-optimized this round.

## E. Public naming

The public factory is the root `make` export. All public module headers, documentation, statics, type-error keys, symbols, error identifiers, annotations, test span names, and fixture service identifiers use `@beep/effect-drizzle` or neutral SQL language. A case-insensitive source/test/README census finds no remaining `bsl` text.

The codec-service consumer fixture locally disables the repository's `deterministicKeys` diagnostic. In the scratchpad that diagnostic derives `@beep/scratchpad/bsl/...`; retaining that machine path would violate the locked publication identity. The explicit `@beep/effect-drizzle/test/...` key is deterministic for the future package and the suppression can disappear when the code graduates to its real package path.

Key identities include:

- field marker: `@beep/effect-drizzle/Field`;
- diagnostic property: `~effect-drizzle.error`;
- error identifiers: `@beep/effect-drizzle/<ErrorName>`;
- model statics: `.sql`.

## F. README

`README.md` now presents the package to an Effect-community reader without repository context. It covers the encoded-side drift problem, a model/kit/assembly/table/repository quickstart, the negative type matrix, design principles, experimental compatibility status, and the two explicit open boundaries: PostgreSQL enum arrays and literal relation-name preservation.

## G. Proof and census

Final proof commands are recorded with unmasked exit codes:

```text
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
exit 0

bun test scratchpad/bsl/
44 pass, 0 fail
```

Additional proof:

- AST assertion census across all 26 `src` and `test` TypeScript files: 0 `as`, angle-bracket assertion, `satisfies`, or non-null assertion expressions.
- negative fixture census: 74 `@ts-expect-error` directives (minimum: 68).
- core import-boundary test: passing.
- source dependency census: no `@beep/schema`, `@beep/utils`, or `@beep/identity`; only allowed module-specifier families.
- `git diff --check -- scratchpad/bsl`: clean.

## Round 7 and graduation-grill agenda

1. Build the SQLite kit and compiler against the now-real core seam; do not introduce a portable SQL IR.
2. Decide SQLite defaults/identity/version behavior from the dialect's actual constraints and mirror them in call-site diagnostics.
3. Close or explicitly defer PostgreSQL enum-array support and literal relation-name preservation.
4. Run a publication API grill before creating package metadata: exact root/subpath export maps, peer ranges, stability tags, semantic-version policy, and deep-import policy.
5. Compile README examples as consumer fixtures once a real workspace package/export map exists.
6. Repeat the performance fixture several times under a pinned machine state and establish a variance-aware budget rather than treating one timing sample as a threshold.
7. Decide whether `Meta`'s typed Drizzle `SQL` expression should remain core-wide or move behind a dialect-neutral expression parameter before adding SQLite.
8. Remove the fixture's `deterministicKeys` suppression once its filesystem package path and public service-key prefix agree.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0, `bun test scratchpad/bsl/` exit 0 (44/44,
192 assertions), census clean, 74 negatives, no `@beep/*` import specifiers in src
(remaining hits are JSDoc examples showing future package paths — correct), no
`bsl` on public surfaces, the import-boundary test executes the core/pg seam.
`Schema.TaggedError` over `Data.TaggedError` is endorsed — errors are user-facing
boundaries, so schema-backing is the doctrine, not an exception. The perf baseline
is accepted as recorded (instantiations −8.9%, memory −5.3%, timing flagged
noise-sensitive pending repeated sampling). The local `deterministicKeys`
suppression with its graduation-removal note is accepted. No reviewer changes
were needed.
