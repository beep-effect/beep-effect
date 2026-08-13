# Round 7 Brief — The SQLite Dialect: Proving the Architecture

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Protocol as always:
only `scratchpad/bsl/`, proofs green with unmasked exits, write
`research/round7-report.md`, do not commit.

Read first: `research/publishing-standards.md` (style law — everything this round
is born in published style: named imports, natives-where-equivalent),
`research/round6-report.md`, `research/round5-report.md` §B, and the current
sources. Round-3 laws still bind (zero runtime type assertions,
overload-with-broad-impl, both-sides invariants, titled-Example JSDoc).

## Locked decisions

1. **Core-owned `SQL<T>`** — `Meta`'s expression typing does not change. Dialect
   kits own the vocabulary of safe constructors; sqlite gets its own
   `defaultNow()`-style constructors rendering dialect-correct SQL.
2. **No portable IR.** sqlite is a sibling of pg under `src/sqlite/`, importing
   core freely, never imported by core, never touching `src/pg/` (and vice
   versa).
3. **Absent capability = missing export.** sqlite has no arrays: the sqlite
   namespace exports no `array`; nothing else simulates it.
4. **sqlite timestamps = text ISO.** `Model.DateTimeInsert`/`DateTimeUpdate`
   work identically on both dialects — same fields, same Overrideable stamping,
   text-affinity storage. No integer-epoch mode this round.
5. **Enum degrades to mechanism, not vocabulary**: the same enum authoring
   (values derived from the encoded literal union) compiles to `text` plus a
   `CHECK (col IN (...))` table extra. No cross-table registry (nothing is
   shared at the DDL level in sqlite); note the consequence in the report.

## Deliverables (priority order)

### A. The sqlite dialect module (`src/sqlite/`)

Verify every drizzle fact against installed `drizzle-orm/sqlite-core` source
with file:line citations before designing types — column modes, builder brands,
autoincrement semantics, extras surface, `drizzle-kit/api-sqlite` shape.

- **Spec algebra** (Data.TaggedEnum, colocated compilers, mirroring `src/pg`
  structure): the storage classes — `text` (+ json mode), `integer`
  (number/boolean/timestamp modes as the installed rc defines them), `real`,
  `blob` (modes per source), `numeric`. Idents are sqlite-vocabulary; carrier
  witnesses mirror pg's.
- **Combinators** `sqlite.*`: column setters for the classes above; the shared
  core modifiers (`primaryKey`, `unique`, `default`, `references`, `columnName`,
  `version`) re-exported; sqlite-owned safe expression constructors
  (`defaultNow` rendering sqlite-correct current-time); `enum` per lock #5
  (reuse core literal collection); the **db-assigned key** combinator mapping
  drizzle's `integer().primaryKey({ autoIncrement })` — design its name and
  whether it models one or both of pg's always/byDefault postures, but the
  variant truth table MUST land in the same core policy states (absent from
  insert and/or update-as-locator) with fixtures proving `$inferInsert` and the
  update variant agree. Justify the design from sqlite's actual rowid semantics.
- **Derivation adapter**: carrier family → sqlite default spec (string→text,
  boolean→integer-boolean, object→text-json; decide number→? against pg's
  precedent of "bare number derives the widest lossless type" and state the
  policy; ambiguity still errors loudly).
- **Projector** onto sqlite-core builders with drizzle's own brand types (the
  sqlite `Set*`/build equivalents — cite them), delegating to real
  `sqliteTable`; extras (composite pk/unique, check, index with `where`; no
  `using`).
- **Kit**: `make({ dialect: "sqlite", ... })` — grow the `Dialect` domain, the
  config union, and `make`'s overloads; returns the sqlite vocabulary
  (`Entity`/`Model`/`Table`/`Repository`/`schema`/`toSqliteTable`). Audit
  defaults in fixtures use the SAME `DateTimeInsert`/`DateTimeUpdate`/version
  fields as the pg kit — that symmetry is the demo.
- **Assembly**: reuse the core FK/reverse/through algorithm with the sqlite
  projector; drizzle `defineRelations` is dialect-generic — prove it wires.

### B. The spec-family invariant (the architecture's acceptance test)

A descriptor from one dialect must be impossible to smuggle into the other:

- Type level: a field carrying a pg spec fails a sqlite `Entity`/`Model` at the
  offending key with a readable `~effect-drizzle.error` (and vice versa).
  Design where this lives (spec-union membership validation in each dialect's
  model factory / `ValidateFields`) — but it must be per-key and callsite-legible.
- Runtime mirror: model construction rejects foreign-family specs with a tagged
  error; suppressed-type fixtures prove it.
- Arrays: `dimensions > 0` metadata reaching the sqlite projector is rejected
  loudly (type + runtime), and the sqlite namespace simply lacks `array`.
- Extend `test/import-boundary.test.ts` to three edges: `core` imports neither
  dialect; `pg` and `sqlite` never import each other.

### C. The live sqlite gauntlet (mirror of round 4)

Substrate: `bun:sqlite` via `drizzle-orm/bun-sqlite` for drizzle-side work and
`@effect/sql-sqlite-bun` for the `SqlClient` side (verify the v4-compat surface
against installed source; the pglite harness pattern — camel/snake view,
one-scope lifecycle — is the template; document whatever parser/transform
boundaries sqlite does or does not need).

Proofs, all against a real database:

1. `drizzle-kit/api-sqlite` pushSchema (or its working equivalent — record the
   exact path) applying BSL-projected DDL, then the **no-op regeneration**.
2. Repository CRUD through `SqlModel.makeRepository`: db-assigned key,
   Overrideable-stamped timestamps stored and decoded, `OptionFromNullOr`
   `none ⇄ NULL ⇄ some` round-trip.
3. The optimistic repository: happy-path increment, stale-writer
   `VersionConflictError`, two-writers-one-wins.
4. Enum CHECK enforcement: valid value round-trips; out-of-domain value is
   rejected BY SQLITE (not merely by the schema layer).
5. Relations: at least forward + reverse + through `findMany({ with })` queries
   returning correct rows.

### D. Cross-dialect symmetry fixture

One shared set of dialect-free domain schemas (EntityIds, audit fields, a
literal-union status, an Option field) declared against BOTH kits, producing
both table families — demonstrating "domain shared, binding per-dialect."
Negative side per B. This fixture is future README material; keep it clean.

### E. README + report

- README: sqlite in quickstart (a short second-kit example), status section
  updated (PostgreSQL + SQLite; remaining open boundaries list refreshed).
- `research/round7-report.md`: decisions with source citations (autoincrement
  design, number-derivation policy, enum-CHECK shape, sqlite client surface),
  live-gauntlet outcomes and any driver boundaries found, spec-family invariant
  design, assertion census, perf fixture re-run (same commands; note deltas),
  and the graduation-grill agenda as it now stands.

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Unmasked exits; every pg suite still green untouched; negative fixtures grow
(74 floor + the new cross-dialect matrix); zero runtime type assertions;
three-edge import boundary passing. Blocked items: finish the rest, document
precisely — no silent degradation.
