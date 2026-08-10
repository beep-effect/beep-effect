# BSL round two implementation report

## Outcome

All six settled work items are implemented against the installed `effect@4.0.0-beta.104` and
`drizzle-orm@1.0.0-rc.4-fb12281` APIs. The final scoped proof is:

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false` — exit 0,
  zero output.
- `zsh -ic 'bun test scratchpad/bsl/bsl.test.ts'` — 12 pass, 0 fail, 61 assertions.
- `fixtures.ts` contains 38 named `@ts-expect-error` assertions, exceeding the requested 25.

## 1. SQL identity witness

`PgColumn.Spec` now carries a PostgreSQL-only `ident` literal separate from its TypeScript
carrier. The vocabulary includes ordinary SQL identities and
``entityId<"${TableName}">`` domains; `IdentOf` and bidirectional `IdentEquals` are the public
comparison surface (`PgColumn.ts:15-32`, `PgColumn.ts:101-125`). `CarrierOf` remains a separate
projection, with `carrierTag` as its runtime mirror (`PgColumn.ts:130-175`).

Both bare EntityId derivation and explicit `pg.integer()` preserve the EntityId table literal
instead of collapsing it to ordinary `integer` (`derive.ts:94-103`, `derive.ts:201-208`,
`pg.ts:43-64`). This was necessary because identity columns commonly spell `pg.integer()`
before `pg.identity()`.

`schema` uses `IdentEquals` first and bidirectional carrier equality second when validating a
reference (`schema.ts:51-77`). The negative fixtures reject uuid-to-text and organization-id to
user-id references (`fixtures.ts:263-281`).

Decision: `serial` uses the `integer` identity because PostgreSQL `serial` stores an integer and
must remain reference-compatible with integer keys. Timestamp identity distinguishes
`timestamp` from `timestamptz`; its driver `date|string` mode remains a carrier concern.

## 2. Typed defaults, generated expressions, and the state table

`Meta.defaultSql` was replaced by tagged `Meta.Default` and `Meta.Generated` algebras
(`Meta.ts:29-70`, `Meta.ts:76-99`). Typed expressions use Drizzle's installed `SQL<Carrier>` as
the phantom carrier rather than creating a second SQL-expression wrapper. Public combinators
are:

- `pg.default(value)` for encoded literal values;
- `pg.defaultExpr(SQL<Carrier>)` for typed SQL expressions;
- `pg.defaultNow()` constrained to an explicit timestamp column;
- `pg.generated(SQL<Carrier>)` for typed stored generated expressions;
- `pg.unsafeDefaultSql(string)` and `pg.unsafeGeneratedSql(string)` as explicit raw escape
  hatches (`pg.ts:198-263`).

The deprecated `pg.defaultSql` alias remains for source compatibility, but points directly at
`unsafeDefaultSql` so new code has an honest name (`pg.ts:238-247`). Default/generated and
identity state transitions reject conflicts at the second combinator; model construction also
rejects a suppressed or hand-built conflicting state (`pg.ts:163-196`, `factory.ts:251-256`).

The truth table is implemented twice from the same resolved meta:

- Drizzle brands apply default, generated, and identity independently (`table.ts:101-127`).
- Plain Effect schemas become BSL variant fields: generated members omit insert and update,
  defaulted members make insert optional, and all ordinary update members are optional
  (`factory.ts:82-107`, `factory.ts:194-212`).

Identity-always records generated state without default state; identity-by-default records
default state and remains present in update (`pg.ts:171-196`). Runtime and type tests prove
identity-always omission, default optionality, identity-by-default presence, and explicit
`VariantSchema.Field` preservation (`fixtures.ts:96-118`, `bsl.test.ts:87-126`).

Decision: an author-provided `VariantSchema.Field` remains authoritative and is not rewritten,
even when SQL meta says generated. This is the brief's explicit override rule and is covered by
`ExplicitVariantModel` (`fixtures.ts:81-86`).

## 3. Foreign keys and relations

`schema(models)` is the cross-table assembly step. `ValidateSchema` resolves literal reference
targets through the model-record keys and rejects missing tables, missing fields, identity
mismatches, and carrier mismatches (`schema.ts:39-100`, `schema.ts:206-210`). Runtime edge
collection mirrors those checks and throws `SchemaAssemblyError.make(...)` with source, field,
and target context (`schema.ts:26-37`, `schema.ts:147-204`).

Assembly builds all tables first and installs lazy array-form extra config. Each edge emits the
installed rc4 `foreignKey({ columns, foreignColumns })` builder with referential actions, so
self-references are safe (`schema.ts:213-234`). The same edge inventory produces an installed
`defineRelations` callback with explicit `from`, `to`, stable alias, and `optional` derived from
the FK schema's encoded nullability (`schema.ts:239-276`).

Runtime coverage proves direct user-to-organization FKs, an organization self-FK, referential
actions, successful `defineRelations`, and nullable/non-nullable relation optionality
(`bsl.test.ts:128-161`).

Decision: round two emits the forward `one` relation for each FK. Reverse `many` edges are not
synthesized because they require naming/collision policy beyond the settled acceptance criteria.

## 4. Table-level constraint and index nodes

The model factory's existing second parameter now accepts either the existing annotations
object or a typed extras callback. A function is stored as extras, so `ValidateFields<F>` and all
existing annotation calls retain their shape (`factory.ts:140-165`, `factory.ts:214-227`). This
was smaller and more compatible than adding a separate mutable `Bsl.table(Model, ...)` wrapper.

The callback receives a mapped `BoundColumns<F>` record and returns tagged nodes for composite
unique, composite primary key, index, typed check, or unsafe check SQL
(`TableExtras.ts:17-67`). Index options support the installed PostgreSQL `.using(...)` and
`.where(...)` surfaces; checks accept `SQL<boolean>` only unless `unsafeCheckSql` is named
explicitly (`TableExtras.ts:69-108`). Exhaustive emission targets Drizzle's array-form
extra-config builders (`TableExtras.ts:110-127`, `table.ts:241-269`).

Fixtures prove callback field names, minimum composite arity, typed check/partial predicates,
and a composite membership primary key (`fixtures.ts:67-79`, `fixtures.ts:181-196`). Runtime
metadata proves indexes, method/predicate, unique constraints, checks, and composite PK columns
(`bsl.test.ts:69-84`). Multiple inline `pg.primaryKey()` declarations remain rejected; callers
use `Table.compositePrimaryKey` instead (`factory.ts:125-131`, `factory.ts:277-282`).

## 5. varchar corroboration

The installed check representation was verified as `effect/schema/isMaxLength` with payload
`{ maxLength }`. `maxLengths` walks every check in each visited layer, nested filter groups,
encoded links, unions, suspensions, and declaration parameters (`derive.ts:232-269`). The
incompatible fixture deliberately puts another check after `isMaxLength`, proving the scan is
not a last-check lookup (`fixtures.ts:242-246`).

At model construction, every declared max above `varchar(n)` throws tagged
`ModelInvariantError`; compatible and unbounded schemas pass without mutation
(`factory.ts:257-268`, `fixtures.ts:249-261`, `bsl.test.ts:164-170`).

Decision: this is VERIFY mode. An absent maxLength is allowed because BSL is corroborating an
author-declared schema constraint, not silently injecting a new domain rule. Effect v4 check
payloads are runtime data rather than type-visible schema parameters, so enforcement is
intentionally runtime-only.

## 6. Negative fixture matrix

The matrix has 38 `@ts-expect-error` sites. It covers every carrier-sensitive exported column
combinator, typed default/generated expressions, `defaultNow`, identity family, nullable and
double inline PKs, both default/generated orders, generated insert/update shapes, unknown extras
fields, composite arity, typed checks/predicates, uuid/text FK identity, EntityId-domain FK
identity, and missing target tables (`fixtures.ts:128-240`, `fixtures.ts:263-288`).

Model-level cases with runtime mirrors are thunked and asserted in the runtime suite: ambiguous
derivation, nullable/double PK, both default/generated orders, varchar incompatibility, missing
targets, and both FK mismatch families (`fixtures.ts:198-288`, `bsl.test.ts:157-199`).

## Audited assertion census

There are 17 assertion sites containing 24 `as` tokens. Import/export renames such as
`import * as S` and `export { default_ as default }` are syntax aliases, not type assertions,
and are not counted.

1. `Field.ts:61-63` — three assertions normalize a generic input after the `Field` brand guard,
   or pair a bare schema with `Meta.empty`. This is the existing `Field.from` seam.
2. `Meta.ts:145` — `next as Merge<M, P>` is the existing keywise meta-merge seam; runtime
   coalescing mirrors the mapped type.
3. `factory.ts:43` — `as const` preserves the fixed VariantSchema family tuple; no runtime claim.
4. `factory.ts:290-295` — five assertions form the existing dynamic class boundary: the keywise
   schema record, optional annotations, statics attachment, and conditional class return.
5. `pg.ts:60-63` — two assertions restore the generic EntityId table literal after the runtime
   `isEntityIdLike` guard.
6. `pg.ts:185-195` — two assertions correlate the runtime identity branch with its conditional
   `always | byDefault` patch type.
7. `table.ts:253-269` — five assertions cover the existing builder-record projection plus bound
   extra-config keys, the contravariant callback lower bound, and final `TableOf<M>` projection.
8. `schema.ts:222-224` — the target column assertion follows prior table/field resolution.
9. `schema.ts:236-238` — the tables-record assertion restores one `TableOf` per model key.
10. `schema.ts:240-243` — two assertions expose installed `defineRelations` helpers to the
    already-validated dynamic edge inventory.
11. `schema.ts:267-269` — the config assertion follows construction exclusively through installed
    `r.one` factories with matching source/target columns.

Every non-legacy site has an adjacent `// Audited boundary:` comment stating the runtime proof.

## Deviations and remaining round-three gaps

- No installed-version blocker was encountered; all requested rc4/beta.104 APIs existed under
  the verified names.
- `SQL<Carrier>` is used for typed expressions instead of a bespoke `{ sql, carrier }` phantom.
  It is the installed Drizzle witness and avoids a parallel expression abstraction.
- Compile-time reference resolution currently expects schema record keys to match the literal
  `References.tableName`. Runtime resolution also accepts a model's physical `bsl.tableName`, but
  `Statics.tableName` is presently widened to `string`, so that fallback is not type-visible.
- Relations currently synthesize forward `one` edges only. Reverse `many`, composite FKs,
  multiple-edge naming customization, and through/junction relations remain round-three work.
- `Assembly.relations` has Drizzle's broad `ReturnType<typeof defineRelations>` because dynamic
  relation names are not retained in a literal mapped return type. `relationsConfig` itself is
  typed and reusable.
- The overloaded second model argument supports annotations or extras, not both simultaneously.
  A future options object can combine them if a concrete use appears.
- `char(n)` was not added; it was optional in the brief. The verified `varchar(n)` path covers
  the settled acceptance criterion.

## Post-review additions (Fable)

Reviewed 2026-08-08: independent proofs re-run (tsgo clean; tests green), audited-assertion
census spot-checked against source, schema.ts/pg.ts/derive.ts/factory.ts read in full or at the
correctness-critical regions. No review-blocking defects found. Two agreed-in-conversation
extensions were layered on top (they postdate the brief):

1. **varchar tri-mode** (`pg.ts`): `pg.varchar()` DERIVES the length from the schema's
   `isMaxLength` check (tightest bound; loud error when absent); `pg.varchar(n)` VERIFIES when a
   bound exists (Sol's factory check) and INJECTS `S.check(S.isMaxLength(n))` into unbounded
   plain schemas so domain validation and DDL always agree, authored once. Variant-field inputs
   stay verify-only. One new audited cast (`AST.Check<unknown>` contravariance after the
   string-encoded parameter proof).
2. **Option paved-road proof** (`bsl.test.ts`): `S.OptionFromNullOr` and effect
   `Model.FieldOption` classify to nullable text — encoded `null`, decoded `Option`, no metadata
   declaration — locking the operator's preferred nullable-field style as a tested contract.

Round-three queue inherits Sol's listed gaps (reverse `many` relations, composite FKs,
through-relations, literal `Statics.tableName`, combined annotations+extras) plus: a BSL-native
`FieldOption`-style combinator that also plays the round-2 truth table, and check-derived SQL
`CHECK` constraints from numeric-bound payloads.
