# BSL Round 6 Brief — Publication Shape: @beep/effect-drizzle Inside the Scratchpad

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Same protocol as rounds 2–5:
implement ONLY in `scratchpad/bsl/`, prove everything green (unmasked exit codes),
write `research/round6-report.md`, do **not** commit.

Read first: `research/round5-report.md`, then the round-3 brief's laws (zero runtime
type assertions, overload-with-broad-impl, effect helper modules, both-sides
invariants, JSDoc titled examples — all still binding), then current sources.

## Context and operator decisions (locked)

The module is being shaped for eventual npm publication as **`@beep/effect-drizzle`**
("define your domain in effect/Schema once; derive your drizzle tables, DDL, and
repositories from it" — the inverse of the old drizzle→effect direction). Locked:

1. **One package, dialect subpath exports** (`.`, `./pg`, later `./sqlite`) —
   drizzle-orm's own topology. This round cuts the internal layout to match.
2. **Zero runtime dependencies; `effect` and `drizzle-orm` as peers.** All
   `@beep/schema`, `@beep/utils`, `@beep/identity` imports leave `src` code.
   The live-test harness may keep `@beep/pglite` — it is test-side substrate.
3. **Schema-is-truth is scoped to boundaries.** The *product* stays schema-first
   (fields are schemas, variants are schemas, derivation reads schema ASTs). The
   *internal descriptor machinery* (column specs, default/generated algebras,
   table-extra nodes, edges) migrates to `Data.taggedEnum` / plain typed records —
   it never crosses a boundary and must stop paying codec-typing freight.
4. **No "bsl" in any public-facing surface.** The joke retires to git history.
5. Everything stays inside `scratchpad/bsl/` — no `package.json`, no workspace
   registration, nothing outside the directory. Graduation is a later, separate
   decision process.

## Deliverables (priority order)

### A. Package-shaped restructure

Target layout (adjust filenames sensibly; keep this shape):

```
scratchpad/bsl/
  src/
    index.ts        — the future package-root surface (core + kit dispatcher)
    internal/       — inlined helpers (string casing, statics assign, guards)
    core/           — Field, Meta, classification, variant factory, assembly
                      algorithm, optimistic repository, shared modifiers
    pg/
      index.ts      — the future "./pg" subpath surface
      …             — column specs+compilers, pg combinators, projector,
                      pg extras, enum registry, pg kit
  test/             — all test files + live harness support
  research/         — unchanged
  README.md         — deliverable F
  tsconfig.json     — updated for the new layout
```

Rules:
- **`core/` must not import from `pg/`** — the dialect seam is real. Add an
  executable proof: a test that walks `src/core` imports and fails on any `../pg`
  (and any `@beep/*`) specifier. `pg/` imports core freely.
- Public-surface curation: `src/index.ts` and `src/pg/index.ts` export what a
  consumer needs; deep machinery stays internal. Statics property on generated
  model classes renames from `bsl` to a neutral public name — proposal: `sql`
  (`User.sql.tableName`, `User.sql.columns`); if you choose differently, justify
  in the report. `TypeId` symbols and error identifiers adopt
  `@beep/effect-drizzle/...` naming.

### B. Dependency diet

Remove every `@beep/schema` / `@beep/utils` / `@beep/identity` import from `src/`
(and from fixtures insofar as they demonstrate public API — fixtures should read
like consumer code). Substitution map to validate against installed v4 source
(cite file:line in the report for each; never assume from priors):

- `SchemaUtils.withStatics`/`withCodecStatics` → internal typed `Object.assign`
  wrapper.
- `TaggedErrorClass` → effect's own tagged error constructor. Requirement: typed
  errors usable in Effect error channels with `catchTag`, structurally equal, with
  `.make`-style construction or documented constructor convention. Check what v4
  offers (`Data.TaggedError`, Schema error classes) and pick with rationale.
- `LiteralKit` → `Data.taggedEnum` where members are structs; plain literal unions
  plus small derived guards where they are bare literals (Dialect, IdentityMode,
  CarrierTag, FkAction). Keep `.is`-style guard ergonomics where call sites use
  them.
- `Str.*` → `effect/String` where it exists; inline `snakeCase`/`camelCase` (and
  anything else missing) in `internal/` (~15 lines).
- `Struct.evolve`/`entries`/`keys` → `effect/Struct` / `effect/Record`.
- `thunkTrue`/`thunkFalse` → `constTrue`/`constFalse` from `effect/Function`.
- `UnknownRecord` → local guard.
- `$ScratchpadId` → plain string identifiers/descriptions in annotations.

End state: `src/` imports only `effect`, `drizzle-orm`, and relative paths.

### C. Data.TaggedEnum migration of internal machinery

Migrate the internal descriptor algebra off Schema codecs:

- `PgColumn` specs, `Meta.Default`, `Meta.Generated`, `TableExtras.Node`,
  assembly `Edge`, `References` → `Data.taggedEnum` unions (with `$match`/`$is`)
  or plain readonly records with guards where a tagged enum does not fit.
- Compiler statics (`toDrizzleBuilder` etc.) stay colocated with their
  descriptors — colocated dispatch is a design feature, only the typing substrate
  changes.
- Author-input seams keep runtime validation, downgraded from codec decode to
  cheap tag/shape guards: the extras-callback result check, hand-built node
  checks, the Timestamp ident/withTimezone correlation (moves into its
  constructor/combinator), enum value collection.
- **Behavior is invariant**: every existing test and negative fixture survives
  (import paths aside). If a check existed at `.make` time, it must still exist
  somewhere — enumerate the relocations in the report.
- The user-facing surface does NOT migrate: fields-are-schemas, variant schemas,
  and tagged errors remain exactly as schema-first as today.

### D. Type-performance baseline

Add a consumer-shaped fixture (several models of realistic width + kit + schema
assembly + repository types) and measure it BEFORE and AFTER the C migration:

- `tsc --extendedDiagnostics` (installed typescript) — instantiations, types,
  memory, check time; plus tsgo wall time.
- Record both sets of numbers in the report as the standing budget baseline.
- Do not hand-optimize conditional types this round unless the numbers convict a
  specific egregious site; callsite error quality is product — note candidates
  instead.

### E. Public naming pass

`Bsl.make` → the package's `make` (root export). Rename anything public-facing
that says `bsl`/`Bsl` (namespaces, JSDoc, module headers, symbols, error ids,
statics property per A). Internal file/dir names may keep whatever is clearest.
`README`/JSDoc refer to the package as `@beep/effect-drizzle`.

### F. README.md

Public-grade, written for an effect-community reader who has never seen this repo:

- The one-liner and the problem statement (parallel-map drift; encoded-side
  corroboration; why effect/Schema is the richer place for the domain).
- Quickstart: model definition, pipe combinators, kit with audit defaults +
  write strategies, `schema()` assembly, `toPgTable`, optimistic repository.
- "What the type system rejects" — showcase the negative matrix (this is the
  differentiator; sell it).
- Status: experimental; PostgreSQL now, SQLite next; effect v4 beta +
  drizzle-orm 1.0 rc peers; honest open-boundaries list (enum arrays, literal
  relation names).
- Design principles: schema-is-truth at boundaries, zero runtime type
  assertions, dialect-as-kit (no portable IR), derivation-first with explicit
  intent combinators.
- Keep claims verifiable against the test suite; no vaporware features.

### G. Report

`research/round6-report.md`: per-deliverable outcomes; the substitution table with
v4 citations; check-relocation inventory from C; before/after perf numbers;
naming decisions; assertion census; anything discovered that belongs on the
round-7 (sqlite) or graduation-grill agenda.

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Fully green, unmasked exit codes; zero runtime type assertions; the import-boundary
test from A passing; negative-fixture count not reduced (68 minimum). Blocked
items: finish the rest, document precisely.
