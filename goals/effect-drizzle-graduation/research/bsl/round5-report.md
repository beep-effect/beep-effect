# BSL round five implementation report

## Outcome

Deliverables A through F are complete under `scratchpad/bsl/`. The final scoped proof is:

- `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false` — exit 0,
  zero output.
- `bun test scratchpad/bsl/` — exit 0, 41 pass, 0 fail, 185 assertions across two files.
- `fixtures.ts` contains 68 named `@ts-expect-error` assertions.
- A TypeScript-AST census over all 16 top-level `scratchpad/bsl/*.ts` files found zero
  `AsExpression`, angle-bracket assertion, `SatisfiesExpression`, or non-null assertion nodes.
- `git diff --check -- scratchpad/bsl` — exit 0, zero output.

Text and two-dimensional text arrays, forward/reverse/self/through queries, and the unchanged
round-four repository suite all execute against `@beep/pglite`. The only observed driver boundary
is custom PostgreSQL enum-array parameter serialization; enum-array DDL remains supported and the
boundary is recorded under A rather than hidden.

## A. PostgreSQL arrays

### Installed drizzle rc.4 facts

The design was checked against the installed `drizzle-orm@1.0.0-rc.4-fb12281` declarations and
runtime before implementation:

- `node_modules/drizzle-orm/pg-core/columns/common.d.ts:11-13` defines dimensions 0 through 5,
  accepts suffixes `[]` through `[][][][][]`, and maps suffix length to depth 1 through 5.
- `common.d.ts:62` recursively wraps builder data by depth; `common.d.ts:96-100` brands the builder
  with `_.dimensions`; `common.d.ts:114-119` resolves data and driver parameters from that brand.
- `common.d.ts:251-252` makes `.array()` mean depth 1 and exposes the suffix overload for deeper
  arrays.
- `node_modules/drizzle-orm/pg-core/columns/common.js:111-114` defaults the runtime suffix to `[]`
  and stores `suffix.length / 2`; `common.js:171-183` defaults scalar depth to 0 and recursively
  maps array elements through the base column codec.

`Meta` therefore owns one orthogonal `dimensions` value while column descriptors remain scalar.
Projection compiles the base builder once, calls `.array(suffix)`, and applies installed
`SetDimensions` in the same centralized builder pipeline as nullability and defaults. The BSL
carrier is recursively readonly at the declared depth even though Drizzle's structural helper uses
mutable array syntax internally.

### Validation and authoring decision

The shipped authoring form is element-schema-as-argument:

```ts
const matrix = S.Array(S.Array(S.String)).pipe(
  pg.array(S.String.pipe(pg.text()), "[][]")
)
```

This solves the validation-order problem directly. The inner `pg.text()` sees the scalar element
schema at its own pipe call site, so its ordinary `ValidateEncoded` error remains readable. The
outer `pg.array(...)` then validates that the field is exactly a recursively readonly array of that
element's encoded carrier at the declared depth. Runtime validation strips precisely that many
homogeneous array AST layers and compares the remaining encoded AST to the element schema.

Array identity is `array<baseIdent,dimensions>`, while the runtime carrier witness stores the base
tag plus depth. Both are compared bidirectionally for foreign keys. Fixtures reject scalar-to-array
and one-to-two-dimensional references at type level and runtime.

The interaction policy is:

- `unique` is allowed and projects normally;
- `default` is allowed only when its value has the exact nested array carrier;
- primary keys, identities, and optimistic-version markers are rejected in both combinator orders;
- the element must have exactly one explicit scalar column combinator;
- an array or object schema without `pg.array` still derives `jsonb`; no existing derivation changed.

Named enum builders support `.array()` in rc.4. `EnumArrayRecord.statuses` projects
`record_status[]` through the same enum registry. A trial live parameter write exposed a PGlite
custom-enum-array boundary: the parameter serializer sent `"draft,active"`, which PostgreSQL
rejected as `malformed array literal`. The round keeps the valid generated DDL proof but does not
claim a live enum-array write. Text `[]` and `[][]` both pass generated `pushSchema` DDL, repository
insert, model decode, nested-content assertions, and delete against PGlite.

## B. Reverse and through relations

### Installed relation API

The installed API is column-oriented: `node_modules/drizzle-orm/relations.d.ts:276` exposes
`column.through(junctionColumn)`, and `relations.d.ts:347-364` accepts the resulting columns in a
`many({ from, to, alias })` relation. Runtime validation requires every through column to belong to
the same junction table (`node_modules/drizzle-orm/relations.js:31-35`), mirrors source/target
through columns when pairing reverse relations (`relations.js:52-58`), and constructs the
junction-column wrapper in `relations.js:512-513`.

### Names, aliases, and collisions

Every forward edge keeps its field-derived name, such as `org` or `parentOrg`, and receives alias
`<sourceKey>_<sourceField>_<targetKey>`. Its reverse `many` uses the same alias. Reverse names are:

- pluralized camel-case source model key for an unambiguous edge: `users`;
- `child<RelationSuffix>s` for a self-reference beginning with `parent`: `childOrgs`;
- `<pluralSource>By<ForwardRelation>` when the same source has multiple FKs to the same target:
  `dualOrgLinksByPrimaryOrg` and `dualOrgLinksBySecondaryOrg`.

Insertion checks both existing model fields and already-emitted relation names. Any collision raises
`SchemaAssemblyError.make(...)`; `_reverseRelationCollision` proves a target field cannot be
silently overwritten.

The adopted junction rule is intentionally narrow: exactly one two-column composite primary key,
both columns must be resolved FK edges, and the two edges must target distinct models. This matches
`Membership` without accidentally treating payload tables or same-target composites as junctions.
Each endpoint receives `<pluralOtherEndpoint>Through<PascalJunction>`, yielding
`organizationsThroughMembership` and `usersThroughMembership`. Both sides specify
`fromEndpoint.through(junctionFk)`, `toEndpoint.through(junctionFk)`, and a shared alias.

The live RQBv2 proof seeds parent/child organizations, a direct user, a second user, and one
Membership row. Actual `drizzle({ client, relations }).query.*.findMany({ with: ... })` calls assert:

- forward one: direct user to its organization;
- reverse many: organization to its direct users;
- self relation: child to `parentOrg` and parent to `childOrgs`;
- through in both directions: organization to member user and user to member organization.

Because dynamic relation names still widen `Assembly.relations`, the test invokes `findMany`
through a runtime method guard and decodes the unknown rows with explicit Effect schemas. No type
assertion was introduced; retaining literal query result types remains a graduation item.

## C. Repository codec services

The optimistic repository now accepts `EffectModel.Any & AnyModel`; the previous
`ServiceFreeCodec` constraint is gone. Its method contract carries
`M["DecodingServices"] | M["update"]["EncodingServices"]`, matching the encode/update/decode path
used by the installed SQL model repository. There is no runtime behavior change, and the entire
round-four live suite remains green unchanged.

`ServiceCodecRecord` uses an Effect schema transform whose decode and encode both require
`CodecService`. A type fixture extracts the repository insert Effect requirements and proves
`CodecService` is present. Execution with a supplied service remains deliberately outside this
round and is listed in the migration plan as a promotion gate.

## D. Promotion-ready live harness

`live.test-support.ts` now exports two independently usable, documented constructors:

- `pinStringTimestampParsers(client)` pins PostgreSQL timestamp OIDs 1114 and 1184 to the string
  parser required by BSL's ISO carrier;
- `makeCamelSnakeRepositoryLayer(client)` creates the snake-query/camel-result SQL client view over
  a caller-owned PGlite instance.

`makeLiveTestSupport` composes those pieces while preserving its one-scope/one-database lifecycle.
The live suites consume that composition, so eventual graduation can move the constructors without
rewriting their behavior.

## E. BaseEntity migration plan

`research/baseentity-migration-plan.md` maps all eight shared BaseEntity fields, the three identity
extension fields, all nine persistence storage kinds, and all nine value strategies. It separates
live proof from mechanical projection and missing lifecycle semantics, preserves numeric millis and
legacy text-literal storage, inventories the current `EntityTable.pgTableFrom` conversion shape,
orders package tranches, and records round-two-through-five blockers.

The central recommendation is compatibility first: graduate the BSL package and lifecycle helpers,
prove an empty schema diff, keep existing table/repository exports behind adapters, migrate bounded
relation components, and remove `EntityTable.pgTableFrom` only after every caller has moved.

## F. Assertion census and round-six queue

The final AST census found:

- `as` expressions: 0;
- angle-bracket assertions: 0;
- `satisfies` expressions: 0;
- non-null assertions: 0.

The negative matrix grew from 57 to 68 named `@ts-expect-error` sites. New compile-time coverage
includes element-carrier mismatch, declared-depth mismatch, missing explicit element column,
array/primary-key/identity/version conflicts in both orders, scalar/array FK mismatch,
array-depth FK mismatch, and repository codec service propagation. Runtime mirrors cover every
array/model/FK state invariant plus relation collisions; executable positive tests cover unique,
defaults, enum projection, JSONB non-regression, deterministic reverse names, junction discovery,
and all required live query paths.

Round six should address, in order:

1. Promote BSL and the two live-harness constructors into owned shared packages with stable exports.
2. Implement the BaseEntity lifecycle algebra: context-provided, derived, service-computed,
   service-computed-on-insert, application-default-on-insert, and update-stamped fields, including
   numeric millis.
3. Execute a real service-requiring repository codec and the public-id-on-insert shape.
4. Preserve literal relation names through `Assembly.relations` so RQB callers do not need a
   reflective invocation/explicit decode seam.
5. Add explicit policy for payload junctions, composite foreign keys, and custom relation names.
6. Resolve or isolate PGlite custom-enum array serialization and add a live enum-array round trip.
7. Prove zero unintended drizzle-kit diff for a BaseEntity parity fixture before the first
   production entity migration.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0, `bun test scratchpad/bsl/` exit 0 (41/41,
185 assertions), full-line census clean (import aliases only). The array combinator
was read in full: element-as-argument authoring, runtime AST equality between the
outer schema's depth-stripped element and the base element, scalar-element and
modifier exclusions enforced in both orders, and FK equality correctly lifted to
`storageIdent`/`carrier` with dimensions. Reverse-naming and junction rules match
the report; the RQB live proofs decode rows with explicit schemas rather than
asserting types. The enum-array parameter boundary and the widened
`Assembly.relations` typing are accepted as documented open items. No reviewer
changes were needed.
