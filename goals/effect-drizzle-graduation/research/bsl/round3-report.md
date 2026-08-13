# BSL round three implementation report

## Outcome

Deliverables A through F are implemented under `scratchpad/bsl/`; G remains design-only as
required. The final scoped proof is:

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false` — exit 0,
  zero output.
- `bun test scratchpad/bsl/bsl.test.ts` — 30 pass, 0 fail, 113 assertions.
- `fixtures.ts` contains 50 named `@ts-expect-error` assertions.
- A TypeScript-AST census over every top-level `scratchpad/bsl/*.ts` source found zero
  `AsExpression`, angle-bracket assertion, `SatisfiesExpression`, or non-null assertion nodes.

No installed-version blocker prevented a deliverable. One verified-source expectation in the
brief differs from the installed source; it is documented under A rather than hidden.

## A. Identity-always update membership and repository compatibility

`PlainVariants` and `effectiveSchema` now implement the same three-way generated policy
(`factory.ts:265`, `factory.ts:496`):

- ordinary/defaulted fields retain insert and optional update behavior;
- identity-always fields are absent from insert, required in update, and present in select/json;
- SQL-expression and unsafe-SQL generated fields are select/json-only.

The required update membership is a row-locator contract, not permission to SET the identity.
`SqlModel.makeRepository` excludes `idColumn` from `sql.update(request, [idColumn])` and reads it
for the `WHERE` predicate. `userRepository` proves the BSL `User` model structurally satisfies
the installed `Model.Any` constraint with `idColumn: "id"` (`fixtures.ts:196`). Constructing that
repository yields an `Effect` requiring `SqlClient`; database execution remains intentionally
out of scope.

The runtime and type fixtures now prove identity-always update presence and requiredness,
insert absence, generated-expression write absence, and generated-expression `jsonCreate`
absence. The Drizzle `$inferInsert` exclusion for identity-always did not change.

### Installed `GeneratedByDb` discrepancy

The brief expected installed `Model.GeneratedByDb` to include update. In beta.104 it does not:
`node_modules/effect/src/unstable/schema/Model.ts:204-230` defines only select and json and its
documentation explicitly says update is omitted. BSL therefore cannot literally align with
that helper while also satisfying `SqlModel.makeRepository`'s id constraint. The implemented
identity-always policy follows the deliverable's repository-compatibility requirement and uses
a custom variant set. This is also consistent with upstream's `GeneratedByDb` documentation,
which directs update-row-locator keys to a custom field set.

### rowVersion and round four

The kit's `rowVersion` is insert-defaulted to `1`, but the ordinary update variant makes it an
optional author field. The installed repository would SET any supplied non-id `rowVersion`;
it cannot derive `row_version = row_version + 1` from the schema.

Round four needs a BSL-layer update wrapper. The minimum non-optimistic form should remove
`rowVersion` from the author SET record, append the SQL increment expression, retain the id as
the `WHERE` locator, and return the incremented row. If optimistic concurrency is desired,
`rowVersion` should instead be required as an expected value used in `WHERE`, removed from SET,
and incremented atomically. That policy decision must precede the custom repository API because
the two payload contracts differ.

## B. `Bsl.make` kit factory

`kit.ts` adds a literal `Dialect` domain with only `"pg"`, an explicit `PgKitConfig`, and an
explicit `PgKit` return contract (`kit.ts:59-124`). Adding a dialect is an additional config/kit
branch rather than a rewrite of the PostgreSQL types.

The returned surface is `{ pg, Model, Entity, Table, schema, toPgTable }`:

- `pg`, bare `Model`, `Table`, `schema`, and `toPgTable` are the existing implementations;
- `Entity` evaluates `defaultColumns` once, checks collisions, merges defaults with own fields,
  and delegates class construction to the same `makeModelClass` runtime seam as bare `Model`
  (`factory.ts:535`, `kit.ts:144-203`);
- the type-side collision validator places
  `'<key>' is a kit default column — remove it or use Model` on the offending key;
- the runtime mirror raises `ModelInvariantError.make(...)` before merging;
- kit extras are composed before model extras and stored in the existing model extras seam, so
  both standalone `toPgTable` and cross-model `schema` apply them in the same order.

`AuditedRecord` proves default fields appear in variants, `bsl.fields`, `bsl.columns`, and table
projection. `BareJunction` uses the returned bare `Model` and proves the opt-out path has none of
the kit defaults. The suppressed collision fixture is also exercised at runtime.

One round-two type bug surfaced while doing this: `EffectiveSchema` tested a concrete generic
`VariantSchema.Field<Config>`, whose invariance lost exact upstream field types. It now checks
the field marker existential (`VariantSchema.Field.Any`), preserving `DateTimeInsert` and
`DateTimeUpdate` types without an assertion.

## C. Write-strategy paved road

The PostgreSQL kit fixture uses:

```ts
createdAt: Model.DateTimeInsert.pipe(pg.timestamp())
updatedAt: Model.DateTimeUpdate.pipe(pg.timestamp())
rowVersion: PosInt.pipe(pg.integer(), pg.default(1))
```

Both timestamps classify through their select schemas as string-carried `timestamptz` columns.
Runtime and type proofs establish that `createdAt` is absent from update, while `updatedAt` is
present in insert and update.

The real construction path is `SchemaParser.makeEffect(AuditedRecord.insert)(input)`
(`bsl.test.ts:203-215`). An input with neither timestamp succeeds and receives both values from
the Effect `Overrideable` constructor defaults. This is construction, not decoding: upstream's
own beta.104 test also distinguishes `SchemaParser.makeEffect` defaults from a decoder, which
still requires encoded fields.

Doctrine: the application clock inside `Overrideable` is the single time source. Kit timestamp
defaults deliberately do not add `pg.defaultNow()`, avoiding divergent application and database
clocks.

The `DateTimeInsert`/`DateTimeUpdate` family encodes ISO strings and therefore uses timestamp
string mode. The `*FromNumber` family encodes epoch milliseconds, which is not a PostgreSQL
timestamp carrier. No millis mode was added; round four should either retain millis as a numeric
column or select a timestamp transformation explicitly as part of BaseEntity parity.

## D. Literal schemas to PostgreSQL enums

`pg.enum(name?)` accepts only finite encoded string-literal unions at compile time and runtime
(`pg.ts:219-262`). The runtime mirror extends the existing encoded-AST walking approach across
string literals, enum nodes, unions, nullable members, and suspensions. Broad strings, template
literals, mixed literal families, and empty results fail loudly.

`PgColumn.Enum` stores `{ kind, ident, name, values }` with literal-preserving values
(`PgColumn.ts:322`). Naming rules are:

- an explicit non-empty name is used verbatim;
- an omitted name resolves to the exact declaring model field key at model construction;
- the resolved identity is `enum<name>`.

`Bsl.schema()` collects enum specs before table construction, creates one Drizzle `pgEnum`
instance per name, and supplies that registry to every table (`schema.ts:208`,
`schema.ts:264-303`). The returned `enums` record is available for drizzle-kit exports. Tests
prove two tables' status columns reference the same instance and emit the named SQL type.

A standalone `toPgTable` creates a table-local enum instance. This keeps standalone projection
useful; cross-table sharing and mismatch validation belong to assembly. Within assembly, the same
name with a different ordered value tuple raises `SchemaAssemblyError`. This mismatch is runtime
only: a useful compile-time comparison was not tractable through the current dynamic model-record
assembly without widening the public assembly types, so no degraded fake type check was added.
PostgreSQL enum order is semantic, hence exact ordered-tuple equality rather than set equality.

## E. `unsafeCustom`

`pg.unsafeCustom(sqlType)` carries `custom<sqlType>` identity and compiles with Drizzle
`customType({ dataType: () => sqlType })` (`pg.ts:276-289`). It performs no encoded-carrier
validation by design. `tsvector` projection is proven through `getSQLType()`.

Foreign-key compatibility for custom columns is identity-led. Their carrier tag is `unknown`, so
matching custom identities can reference each other without pretending BSL knows a codec; a
different custom SQL identity still fails the normal identity comparison.

## F. Mechanical column kinds

All capacity-ordered kinds were completed:

1. `numeric(precision?, scale?)` uses Drizzle string mode and a `numeric` identity.
2. `date()` uses string mode; `date({ mode: "date" })` uses the JavaScript `Date` carrier.
3. `char(n)` shares the varchar derive/verify/inject implementation and model-level maxLength
   corroboration.
4. `json()` is distinct from `jsonb()` in descriptor identity and emitted SQL type.
5. `real()` uses the number carrier.
6. `bigserial("number" | "bigint")` and `smallserial()` preserve Drizzle's carrier/default
   behavior and make insert keys optional through BSL metadata.

`MechanicalColumns` and the runtime suite prove every emitted SQL type, numeric/date/bigserial
carrier inference, serial default brands, and char's missing-bound refusal.

## G. `.array()` design only

### Options considered

| Design | Benefit | Cost |
| --- | --- | --- |
| `dimensions` slot on every descriptor | Each spec is self-contained | Repeats one orthogonal concern across every member and every constructor; adding a column kind repeats array plumbing |
| Wrapper spec `{ kind: "array", element, dimensions }` | Models SQL array identity explicitly and supports recursive arrays | Makes every compiler/type projection recursive, complicates tagged-union dispatch, and duplicates Drizzle's builder-modifier shape |
| Combinator brand/metadata | Mirrors Drizzle's `.array()` and centralizes `SetDimensions` application | Requires derived array identity/carrier helpers beside the base spec |

### Recommendation

Use a combinator-owned dimensions value in field metadata, not a slot on every descriptor and not
a wrapper spec. `pg.array(dimensions?)` should apply after the base column combinator. Projection
can compile the base builder once, call its array modifier, and apply Drizzle's `SetDimensions`
brand in the same centralized type pipeline as `SetNotNull` and `SetHasDefault`.

Array compatibility must include both the base identity and dimensions. A derived identity such
as `array<baseIdent,dims>` prevents scalar/array and one-/two-dimensional foreign keys from
matching. The type carrier becomes recursively readonly-array-shaped to the declared depth; the
runtime mirror should compare an array carrier record containing depth plus the base carrier tag.
Unspecified dimensions need one canonical meaning matching Drizzle's installed `SetDimensions`
default before implementation begins.

This design adds one metadata member, one combinator, one centralized compiler step, and one
centralized builder-brand step. New descriptors remain unaware of arrays.

## Assertion census

The round-three implementation adds no runtime type assertions. The AST census found:

- `as` expressions: 0;
- angle-bracket assertions: 0;
- `satisfies` expressions: 0;
- non-null assertions: 0.

Import/export renames such as `import { PgColumn as DrizzlePgColumn }` and
`export { enum_ as enum }` are syntax aliases, not assertion nodes. The existing
`VariantSchema.Field<any>` existential in `Field.ts` is a type argument matching Effect's erased
field boundary, not a runtime assertion.

## Open questions and round-four queue

1. Choose row-version semantics (blind increment versus optimistic expected-version check), then
   implement the BSL-layer custom update path and database execution tests with a real `SqlClient`.
2. Decide BaseEntity storage for millis-encoded Effect date-time fields instead of silently
   treating milliseconds as timestamps.
3. Decide whether implicit enum names should remain field-key-global or gain a table prefix. The
   current field-key rule is type/runtime-identical and intentionally exposes accidental
   cross-model name conflicts during assembly.
4. Decide whether standalone table-local enums should be exposed alongside the table for
   drizzle-kit convenience; assembled schemas already expose the canonical enum registry.
5. Implement `.array()` through the recommended metadata/combinator design, with exact
   `SetDimensions`, carrier-depth, and FK mismatch fixtures.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0 (unmasked), 30/30 tests, 113 assertions,
full-line `as`/`!`/`satisfies` census confirms zero runtime type assertions. The
`GeneratedByDb` divergence note was checked against installed beta.104 source and is
accurate — the custom identity-always variant set is the correct call.

Reviewer changes applied after Sol's handoff:

1. `kit.ts` collision detection now compares against precomputed `R.keys(defaults)`
   via `A.contains` instead of `P.hasProperty(defaults, key)` — the latter walks the
   prototype chain, so an own field named e.g. `toString` would spuriously collide.
2. `PgKitConfig.defaultExtras` is now optional (the brief's intent); the kit extras
   composition handles its absence, so minimal kits no longer write `() => []`.
3. `pg.unsafeCustom`'s object-literal spec construction was evaluated for
   `Custom.make` consistency and deliberately kept: the schema constructor widens
   `ident` to `custom<${string}>`, destroying the `SqlType` literal the combinator
   exists to preserve. A code comment now records the reasoning.
