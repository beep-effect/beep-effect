# BSL Round 3 Brief — Kit Factory, Write-Strategy Invariants, Repository Compatibility

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Same protocol as round 2:
implement in `scratchpad/bsl/`, prove everything green, write
`research/round3-report.md`, do **not** commit — the reviewer commits after review.

## Context

Rounds 1–2.5 shipped a zero-assertion Effect v4 + drizzle-rc SQL DSL: pipeable
`Field<Schema, Meta>` nodes, schema-defined `Meta`/`PgColumn.Spec`/`TableExtras`
algebras with colocated `toDrizzleBuilder` compilers, a six-variant `Model` factory,
`toPgTable` projection onto rc4 `Set*` brands, and `Bsl.schema()` assembly with FK
DDL + RQBv2 relations + EntityId auto-references. Read `research/round2-report.md`
and the source before writing anything. All prior conventions stand:

- **Zero runtime type assertions.** No `as`, no `!`, no `satisfies`-laundering. The
  canon seam is overload-with-broad-impl (`export function x(...): Precise;
  export function x(...): unknown { ... }`) plus a runtime guard mirroring the type.
- `TaggedErrorClass` errors constructed with `.make()`, never `new`.
- `LiteralKit` for literal domains; `$ScratchpadId` (`$I`) identity composers +
  `$I.annoteSchema` on every schema; `SchemaUtils.withStatics`/`withCodecStatics`.
- Effect helper modules (`A`, `O`, `R`, `P`, `Str`, `Match`, `flow`, `dual`) over
  native loops/conditionals; `P.hasProperty` (v4 schemas are callable — `P.isObject`
  is FALSE for them).
- JSDoc on every export: titled `**Example** (Title)` blocks, `@category`, `@since`.
  Match the density of the existing files exactly.
- Type-level and runtime policy must be the same algorithm (the v3 experiment died
  of divergence). Every compile-time invariant gets a runtime mirror and vice versa.

## Verified source facts (do NOT re-derive; cite paths if you need more)

- `effect/unstable/schema/VariantSchema.Field` extends `Pipeable`
  (`node_modules/effect/src/unstable/schema/VariantSchema.ts:105`), so
  `Model.DateTimeUpdate.pipe(pg.timestamp())` is legal input to BSL combinators.
- `effect/unstable/schema/Model.ts`:
  - `DateTimeInsert` = `Field({ select: DateTimeUtcFromString, insert: DateTimeWithNow,
    json })` — **no update member**: createdAt is un-updatable by construction.
  - `DateTimeUpdate` = `Field({ select, insert: WithNow, update: WithNow, json })` —
    stamped on both writes via `VariantSchema.Overrideable(..., { defaultValue:
    Effect })` — the write-strategy executes at payload construction, in the schema.
  - `GeneratedByDb` exists in installed beta.104 (`Model.ts:204/226`) — check its
    exact variant membership and align (expected: absent from insert, present in
    update as row locator, present in select/json).
- `effect/unstable/sql/SqlModel.makeRepository(Model, { tableName, spanPrefix,
  idColumn, softDeleteColumn? })` (`SqlModel.ts:33`): requires
  `Id extends keyof S["Type"] & keyof S["update"]["Type"] & keyof S["fields"]`, and
  its update statement is `sql.update(request, [idColumn])` — **idColumn is excluded
  from SET but read from the payload for WHERE**. Consequences below.
- drizzle: installed `1.0.0-rc.4-fb12281` is the newest published build; all `Set*`
  brands BSL projects onto are unchanged on the rc5 branch. rc5 adds
  `SetHasRuntimeDefault` (client-side `$default`) — do not model it this round; the
  Overrideable schema path replaces it for our use cases.

## Deliverables (priority order — finish A–E; F as capacity allows; G is design-only)

### A. Truth-table fix: identity-always must survive into the update variant

Round 2 treats every `generated !== false` field identically (absent from insert AND
update). That is wrong for `identityAlways` and breaks the module's own
compatibility target: `SqlModel.makeRepository(User, { idColumn: "id" })` is
currently unsatisfiable because `"id" ∉ keyof User.update.Type`.

Fix the split, in `PlainVariants` (type) and `effectiveSchema` (runtime) together:

- `generated: { _tag: "identityAlways" }` → select, **update**, json (align with
  `Model.GeneratedByDb` membership; verify in source). Absent from insert.
- `generated: { _tag: "sqlExpr" | "unsafeSql" }` → select/json only (unchanged —
  anything present in the update variant would be SET by `sql.update`).

Update fixtures (`_variantUpdateIdAbsent` becomes its inverse), tests, and drizzle
brand projection if affected (`$inferInsert` exclusion for identity-always must NOT
change — drizzle's OptionalKeyOnly semantics stay as-is).

Then add the compatibility proof fixture:

```ts
const userRepository = SqlModel.makeRepository(User, {
  tableName: User.bsl.tableName,
  spanPrefix: "User",
  idColumn: "id",
})
```

This must typecheck (BSL `ModelClass` structurally satisfying `Model.Any` — if it
does not, closing that gap IS part of this deliverable). Constructing/executing it
needs a `SqlClient` — execution is round 4's job; this round proves the types and,
if cheap, `Effect`-constructs it against a stub client in a test. Document precisely
what round 4 must add for `rowVersion` increment (custom update wrapping — note
`sql.update(request, [idColumn])` SETs everything else in the payload, so a
rowVersion in the update variant would be author-supplied, not incremented; the
derived-repo story for `incrementedOnWrite` likely needs a BSL-layer custom update.
Analyze and write it up; do not build the custom repo this round).

### B. `Bsl.make` kit factory

New module (suggest `kit.ts`), exported from `index.ts` as `make`:

```ts
const { pg, Model, Entity, Table, schema, toPgTable } = Bsl.make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: Model.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: Model.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: PosInt.pipe(pg.integer(), pg.default(1)),
  }),
  defaultExtras: (columns) => [ /* TableExtras nodes applied to every Entity table */ ],
})
```

Requirements:

- `dialect: "pg"` is the only member of a `LiteralKit` dialect domain; the config
  and return types are written so a second dialect is a new kit config, not a
  refactor. The returned `pg` is the existing combinator namespace (re-exported
  through the kit; no duplication).
- `Model` = the existing bare factory, unchanged, returned through the kit.
- `Entity<Self>(identifier)(ownFields, annotationsOrExtras?)` = defaults-injected
  factory: the effective field record is `defaultColumns ∪ ownFields`.
  - **Collision is an error, not an override**: a key present in both produces
    `BslTypeError<"'<key>' is a kit default column — remove it or use Model">` on
    the offending key (ValidateFields-style intersection) AND a runtime
    `ModelInvariantError`. Invariant fields being invariant is the point.
  - `defaultExtras` concat with per-model extras through the existing
    `toPgTable`/`AdditionalExtras` seam; ordering: defaults first, model extras after.
  - Statics (`bsl.fields`, `bsl.columns`) and variants cover the merged record;
    `ColumnsOf`, `ValidateFields`, `Bsl.schema` FK validation, and auto-references
    all operate on the merged record exactly as if hand-written.
- Type-level fixtures: an `Entity` model's select variant includes the default
  fields with correct types; collision negative; a junction table on bare `Model`
  showing the opt-out path.

### C. Write-strategy paved road (fixtures + tests over B)

Using the kit from B with `DateTimeInsert`/`DateTimeUpdate` defaults:

- Classification: both derive `timestamp` columns (string carrier, timestamptz)
  through the existing variant-field select-schema path.
- Tests: `createdAt` absent from the update variant (type + runtime keys);
  `updatedAt` present in insert and update; constructing an insert payload without
  `createdAt`/`updatedAt` succeeds and the Overrideable stamps a value (find the
  construction path in VariantSchema/Model source — likely the class constructor or
  `S.decode` on the insert variant; prove whichever is real, and document it).
- Doctrine (record in report): app clock (Overrideable) is the single time source;
  kit defaults must NOT also apply `pg.defaultNow()` (two-clock hazard).
- Encoded-side note: `DateTimeInsert` family is ISO-string encoded → `pg.timestamp()`
  string mode. The millis-encoded family (`*FromNumber`) does not fit a timestamp
  column; do not add a millis mode this round — record it in the report as a
  BaseEntity-parity decision for round 4.

### D. LiteralKit → pgEnum

A string-literal field should be expressible as a real PostgreSQL enum, deriving
its values from the schema instead of restating them:

- `pg.enum(name?)` combinator: valid only on schemas whose encoded type is a union
  of string literals (ValidateEncoded-style constraint; runtime mirror walks the
  encoded AST to collect the literal values — reuse/extend the existing AST
  walkers). Explicit `name`, or derive from the field at model construction
  (document the rule). Spec member: `{ kind: "enum", ident: `enum<${name}>`,
  name, values }` with literal-preserving `values`.
- Emission: drizzle `pgEnum(name, values)` objects must be **shared instances** —
  one per enum name across the whole assembly. Design the ownership accordingly
  (assembly-level, like FKs — `Bsl.schema()` returns an `enums` record so
  drizzle-kit can see them; a standalone `toPgTable` on a model with enum columns
  should either create a table-local enum or fail loudly — pick one and document).
- Validation: two enum specs with the same name and different values =
  `SchemaAssemblyError` (+ type error if tractable). FK ident equality for enum
  columns compares `enum<name>` idents; carrier is string.
- Fixture: a `status`/`source`-style LiteralKit field, positive + mismatch negative,
  `getTableConfig` proof that the column's SQL type is the enum.

### E. customType escape hatch

`pg.unsafeCustom(sqlType: string)` → spec `{ kind: "custom", ident:
`custom<${sqlType}>`, sqlType }`, compiled via drizzle's `customType` with
`dataType: () => sqlType`. No carrier validation (it is explicitly unsafe — the
`unsafe` prefix is the contract, same doctrine as `unsafeDefaultSql`). FK equality
by ident. One fixture (e.g. `tsvector`), `getSQLType()` proof.

### F. Mechanical column kinds (capacity permitting, in this order)

`numeric(precision?, scale?)` (string carrier — drizzle returns strings), `date`
(string/date modes), `char(n)` (reuse the varchar maxLength tri-mode machinery),
`json` (distinct ident from jsonb), `real`, `bigserial`/`smallserial`. Each is one
descriptor + one compiler + one combinator + fixture coverage, per the PgColumn.ts
header contract. Skip time/interval/network/geo/vector entirely.

### G. `.array()` — design only, no implementation

One section in the report: dims-slot-on-every-descriptor vs wrapper-spec vs
combinator-brand, interaction with `SetDimensions`, FK/carrier equality for array
columns, and a recommendation. Nothing in src.

## Proofs (all must pass before writing the report)

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/bsl.test.ts
```

Grow the negative matrix with every new invariant (kit collision, enum non-literal
input, enum value mismatch, write-strategy membership). Zero `as`/`!` assertions —
run the census and report it. If a deliverable turns out to be impossible against
installed versions, stop that deliverable, finish the others, and document the
blocker precisely (what you tried, exact errors) in the report — do not ship a
degraded version silently.

## Report

`research/round3-report.md`: per-deliverable outcomes, design decisions with
rationale, assertion census, construction-path findings for Overrideable, the
rowVersion/round-4 analysis, `.array()` design, open questions, round-4 queue.
