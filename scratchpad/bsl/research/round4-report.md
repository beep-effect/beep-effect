# BSL round four implementation report

## Outcome

Deliverables A through F are implemented under `scratchpad/bsl/`. The final scoped proof is:

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false` — exit 0,
  zero output.
- `bun test scratchpad/bsl/` — exit 0, 34 pass, 0 fail, 147 assertions across two files.
- `fixtures.ts` contains 57 named `@ts-expect-error` assertions.
- A TypeScript-AST census over all 16 top-level `scratchpad/bsl/*.ts` files found zero
  `AsExpression`, angle-bracket assertion, `SatisfiesExpression`, or non-null assertion nodes.

No installed-version blocker prevented a deliverable. The shipped drizzle-kit path needed no
fallback, but two PGlite/rc boundary details had to be made explicit and are recorded below.

## A. Execution substrate

`live.test-support.ts` owns one closeable scope per Bun suite. The exact Effect v4 construction is:

```ts
const scope = yield* Scope.make()
const context = yield* Layer.buildWithScope(PgliteTestLayer, scope)
// suite effects run with Effect.provide(effect, context)
yield* Scope.close(scope, Exit.void)
```

The live suite acquires that support once in `beforeAll`, runs serially with `describe.serial`, and
closes the scope in `afterAll`. Both the generic `SqlClient` and the raw PGlite client therefore
share one database and one lifecycle.

`PgliteTestLayer` deliberately has no query/result name transforms. BSL model keys are camel case
while projected physical names are snake case, so the support builds one additional scoped
`@effect/sql-pglite` client view over the same caller-owned PGlite instance with
`Str.snakeCase`/`Str.camelCase`. Repository effects use that view; DDL uses the original
`@beep/pglite` context. This is not a second database.

PGlite's default parsers decode PostgreSQL timestamp OIDs 1114 and 1184 to JavaScript `Date`
objects. The locked BSL carrier is ISO string, so the support replaces those two parser entries
with the identity parser before queries run. Storage remains `timestamptz`; selected values remain
the string carrier required by `Model.DateTimeInsert` and `Model.DateTimeUpdate`.

## B. DDL path and drizzle-kit round trip

The shipped path is the installed `drizzle-kit/api-postgres` `pushSchema` API:

1. Build one export object from `bslSchema.enums` and `bslSchema.tables`.
2. Narrow the Effect driver's raw `PGliteInterface` to the concrete `PGlite` instance with an
   `instanceof` runtime guard; drizzle-orm rc.4's PGlite adapter requires the concrete class type.
3. Wrap it with `drizzle({ client })`.
4. Call `pushSchema(exports, db)`, verify the returned SQL list is non-empty, and execute its
   `apply()` function.
5. Call `pushSchema(exports, db)` again against the applied live database and require
   `sqlStatements` to equal `[]`.

The executed DDL is therefore the live introspection diff derived from BSL-projected Drizzle tables
and enums. No table, enum, or constraint DDL is handwritten. The second call proves database state,
not merely equality between two in-memory snapshots, which is why `pushSchema` was preferred over
`generateDrizzleJson` plus `generateMigration` for this round.

No drizzle-kit entry point failed, so no fallback shipped. The rc-specific friction was the adapter
type boundary above: Effect exposes the live client as `PGliteInterface`, while
`drizzle-orm/pglite` requires `PGlite`. The runtime class guard closes that gap without a type
assertion.

The locked enum policy is unchanged. Shared enums use explicit names (`record_status` in the live
fixture); omitted enum names remain derived from the exact declaring field key.

## C. Installed repository execution

The round-three `User` fixture now takes the audit kit's invariant defaults and remains the model
passed to `SqlModel.makeRepository`. It has database-assigned identity `id`, application-clock
`createdAt`/`updatedAt`, defaulted `rowVersion`, and a `nickname` field using
`S.OptionFromNullOr(S.String)`. Its status uses the shared PostgreSQL enum.

The live proof executes the installed repository through the transformed view of the same PGlite
client:

- insert returns a decoded row with a generated identity;
- the exact `createdAt` and `updatedAt` produced by `SchemaParser.makeEffect(User.insert)` survive
  storage and selection;
- `findById` returns the inserted row;
- native update reads `id` as its locator, returns the updated row, and preserves the identity;
- delete removes the row and a following lookup returns `Option.none()`;
- `Option.none()` encodes to SQL `NULL` and decodes back to `None`; updating to
  `Option.some("round-four")` stores and decodes `Some`.

The constructor step is intentional. `Overrideable` timestamps stamp during
`SchemaParser.makeEffect` construction; `SqlModel` then encodes the constructed value for SQL.
There is no database timestamp default and therefore no second clock.

## D. Optimistic version repository

### Marker algebra

`pg.version()` adds the literal `version: true` intent to `Meta`. It requires an explicitly selected
integer-family column and is mutually exclusive with identity and generated-column semantics in
both combinator orders. Model validation mirrors those rules and rejects a second marked field.

The synthesized variants use one matching truth table:

- insert: optional, preserving the SQL default;
- update: required, representing the expected version;
- select, json, jsonCreate, and jsonUpdate: present.

Type fixtures and runtime negative fixtures cover non-integer versions, both identity/version
orders, both generated/version orders, and multiple version fields. The live kit default is
`PosInt.pipe(pg.integer(), pg.default(1), pg.version())`.

### Repository

`repository.ts` exports `makeRepository`, `Repository`, and `VersionConflictError`; `index.ts`
re-exports them, and every PostgreSQL kit returns the builder as `Repository`.

The builder discovers the marked version key from model metadata. It reuses
`SqlModel.makeRepository` for insert, insert-void, find-by-id, and delete, but does not expose the
native update/update-void paths. Its update encodes through `Model.update`, removes id and version
from author SET fields, and executes one statement equivalent to:

```sql
UPDATE <table>
SET <author fields>, <version> = <expected> + 1
WHERE <id> = <id> AND <version> = <expected>
RETURNING *
```

The version assignment remains valid when no optional author field is present. Constructing the
update variant still stamps `updatedAt`; the returned live row proves the stamped value was stored.

A zero-row result becomes `VersionConflictError` with `table`, `id`, and `expectedVersion`.
Missing-row and stale-version cases are intentionally not disambiguated. A follow-up select would
cost another round trip and introduce a time-of-check/time-of-use race; callers receive one stable
optimistic-conflict contract for both.

The live proof starts at version 1, returns version 2 for the first writer, and submits a second
writer from the same version-1 snapshot. The second writer receives `VersionConflictError`, and a
fresh read confirms the first writer's row and version 2 remain current.

## E. Enum execution proof

The enum DDL applied in B is exercised through `User.status`. A valid `draft` value inserts and
round-trips through the model. A direct SQL attempt to write an out-of-domain value is rejected by
PostgreSQL, and the failure satisfies `SqlError.isSqlError`; there is no silent success or
schema-only rejection standing in for the database proof.

## F. Assertion census and round-five queue

The AST census found:

- `as` expressions: 0;
- angle-bracket assertions: 0;
- `satisfies` expressions: 0;
- non-null assertions: 0.

Round five should carry forward:

1. Implement `.array()` through round three's metadata-owned dimensions design, including exact
   `SetDimensions`, carrier depth, and foreign-key identity checks.
2. Add reverse `many` and `through` relation projection.
3. Decide and execute the BaseEntity migration plan now that timestamptz/string and optimistic
   version behavior are proven live.
4. Move the timestamp parser and camel/snake repository view into the eventual shared SQL harness
   so adopters do not reproduce test-support wiring.
5. Generalize the optimistic builder beyond service-free model codecs if a real BSL repository
   needs schema encoding or decoding services; all round-four models and proofs are service-free.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0 and `bun test scratchpad/bsl/` exit 0
(34/34, 147 assertions), both unmasked; full-line census confirms zero runtime type
assertions (remaining ` as ` hits are import aliases and prose). `repository.ts`
reviewed in full: identifiers rendered via `sql(...)`, values parameterized, the
update request is encoded through `Model.update` before execute (so Overrideable
`updatedAt` stamps on the optimistic path), and the version key is enforced at both
type level and runtime. The single-error conflict contract (no missing-vs-stale
disambiguation) is accepted with its TOCTOU rationale. The pushSchema no-op proof
runs against live database state, which is stronger than the brief required. No
reviewer changes were needed this round.
