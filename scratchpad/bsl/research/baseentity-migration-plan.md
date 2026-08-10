# BaseEntity to BSL migration plan

## Decision boundary

This plan migrates the persistence contract currently split between
`BaseEntity.fields`, `BaseEntity.persisted`, and `EntityTable.pgTableFrom`. It does not propose a
flag-day replacement. The first production conversion should preserve table names, column names,
encoded carriers, defaults, indexes, generated identity behavior, and public table exports exactly;
schema diffs and live repository tests are the release gate for every tranche.

The BSL scratchpad is now a credible target, but it is not yet a promotable package. In particular,
the generic lifecycle strategies used by BaseEntity are not all represented by kit combinators. A
migration must not translate those strategies into ordinary author-provided fields merely to make
the types compile.

## BaseEntity field mapping

| BaseEntity member | Current persistence contract | BSL target | Proof state |
| --- | --- | --- | --- |
| `createdAt` | `DateTimeFromMillis`; `timestampMillis`; `defaultedOnInsert` | Keep the number carrier with `pg.bigint("number")`, then add a constructor-only insert default equivalent to the current application clock | Numeric bigint projection exists; the exact millis constructor/default contract is missing and is not live-proven |
| `createdByPrincipal` | `Principal`; `jsonb`; `providedByContext` | `Principal.pipe(pg.jsonb())` plus a context-provided constructor field | JSONB projection is implemented; generic context provisioning is missing |
| `orgId` | `OrganizationId`; `entityId`; btree + lookup; `providedByContext` | `OrganizationId.pipe(pg.integer(), pg.references(...))` plus a context-provided constructor field and one btree index | EntityId identity/FK compatibility and indexes are proven structurally; context provisioning is missing; `lookup` currently collapses to an ordinary btree index |
| `rowVersion` | `PosInt`; `int`; `incrementedOnWrite` | `PosInt.pipe(pg.integer(), pg.default(1), pg.version())` and `kit.Repository(Model, table)` | Optimistic insert/update/conflict behavior is proven live through version 2 |
| `schemaVersion` | `SemanticVersion`; `text`; `providedByContext` | `SemanticVersion.pipe(pg.text())` plus a context-provided constructor field | Text projection is implemented; context provisioning is missing |
| `source` | `SourceKind`; `literal`; btree + lookup; `derived` | Preserve the finite schema with `pg.text()` for storage compatibility, plus an explicit derived constructor field and one btree index | Literal/text projection exists; a generic derived-value strategy is missing. Do not switch to a PostgreSQL enum in the compatibility tranche because that changes DDL |
| `updatedAt` | `DateTimeFromMillis`; `timestampMillis`; `updatedOnWrite` | Keep `pg.bigint("number")`, then add an update constructor equivalent to the current application clock | Optimistic update construction is proven for ISO timestamps; the exact millis field/update contract is missing |
| `updatedByPrincipal` | `Principal`; `jsonb`; `providedByContext` | `Principal.pipe(pg.jsonb())` plus a context-provided insert/update field | JSONB projection is implemented; generic context provisioning is missing |
| `entityType` | entity literal; `literal`; column `entity_type`; `derived` | `S.Literal(entityType).pipe(pg.text(), pg.columnName("entity_type"))` plus an explicit derived constructor field | Literal/text and physical names are implemented; generic derivation is missing |
| `id` | entity id; `entityId`; `generatedOnInsert` | entity-id schema with `pg.integer()`, `pg.identity("byDefault")`, and `pg.primaryKey()` unless a schema diff proves `always` is the existing policy | Generated integer identity, repository lookup, and FK identity are proven live; the serial-to-identity DDL transition must be checked before choosing the exact modifier |
| `publicId` | public-id codec; `text`; column `public_id`; unique; `computedByServiceOnInsert` | public-id codec with `pg.text()`, `pg.columnName("public_id")`, and `pg.unique()`, plus a service-requiring insert constructor | Column/unique projection and service requirements in repository method types are proven; service-driven value construction is missing |

Application time remains the authority. Round three deliberately avoided a database timestamp
default, and round four proved the constructor-to-database path. For BaseEntity parity, millis
values remain numeric `bigint` storage, matching the installed `EntityTable` projection, rather
than being silently reinterpreted as PostgreSQL timestamps.

## Every `EntitySchema.persist` member

### Storage kinds

| `storageKind` | Current `EntityTable` builder | BSL equivalent | Status |
| --- | --- | --- | --- |
| `blob` | `bytea` | `pg.bytea()` | Implemented; not yet part of the round-four/five live entity suite |
| `bool` | `boolean` | bare boolean derivation or `pg.boolean()` | Implemented |
| `entityId` | `serial` when generated, otherwise `integer` | EntityId schema plus `pg.integer()` and explicit identity/PK modifiers when generated | Implemented; migration DDL equivalence must be checked |
| `int` | `integer` | `pg.integer()` | Implemented and live through optimistic versioning |
| `jsonb` | `jsonb` | bare object/array derivation or `pg.jsonb()` | Implemented; bare arrays intentionally remain JSONB |
| `literal` | `text` | `pg.text()` for compatibility; `pg.enum(name)` only in an intentional enum migration | Both implemented; named enums are live-proven |
| `text` | `text` | bare string derivation or `pg.text()` | Implemented and live |
| `timestampDate` | `timestamp` in JavaScript `Date` mode | `pg.timestamp({ mode: "date" })` | Implemented; string-mode timestamptz is the live-proven path, not Date mode |
| `timestampMillis` | `bigint({ mode: "number" })` | `pg.bigint("number")` | Implemented mechanically; BaseEntity lifecycle semantics remain missing |

### Value strategies

| `valueStrategy` | BSL mapping | Status |
| --- | --- | --- |
| `provided` | Ordinary model field | Implemented |
| `defaultedOnInsert` | `pg.default(value)`/`pg.defaultExpr(...)` for SQL defaults, or an Effect constructor field for application defaults | Both mechanisms exist; a reusable application-default helper matching EntitySchema is missing |
| `generatedOnInsert` | `pg.identity(...)` plus `pg.primaryKey()` for entity ids, or `pg.generated(...)` for SQL expressions | Implemented; exact legacy DDL must be checked |
| `incrementedOnWrite` | `pg.version()` plus the optimistic repository | Implemented and live-proven |
| `updatedOnWrite` | Effect `Model.DateTimeUpdate`-style constructor plus ordinary column metadata | ISO-string timestamp form is live-proven; generic/millis form is missing |
| `providedByContext` | Context-dependent insert/update constructor | Missing as a reusable BSL strategy |
| `derived` | Explicit variant/constructor field that excludes author input | Variant override seam exists; a safe reusable derivation helper is missing |
| `computedByService` | Service-requiring constructor/codec available on insert and update as required | Repository service requirements now propagate; lifecycle constructor support is missing |
| `computedByServiceOnInsert` | Service-requiring insert constructor excluded from updates | Repository service requirements now propagate; lifecycle constructor support is missing |

Index hints translate as follows: `btree` to `Table.index`, `gin` to
`Table.index(..., { method: "gin" })`, `hash` likewise, `unique` to `pg.unique()` for one column
or `Table.unique` for composites, and `lookup` to an ordinary btree index. Where both `btree` and
`lookup` occur, emit one index, matching the current driver's duplicate suppression.

## Compatibility surface

1. Promote BSL behind a package-private experimental export and copy the round-four live harness
   with it. Do not import production packages from `scratchpad/`.
2. Add the missing lifecycle constructor helpers before converting BaseEntity. They must preserve
   insert/update membership and carry Effect services without assertions.
3. Introduce a BSL BaseEntity kit whose defaults reproduce the eleven fields above. During the
   transition, expose the existing domain class name and variants from a narrow adapter so
   consumers do not see two independently authored schemas.
4. Convert each table module from `EntityTable.pgTableFrom(Model)` to the stable BSL table export:
   use `kit.toPgTable(Model)` only for isolated tables and `kit.schema({ ... }).tables.<key>` for
   any FK/relation component. Keep the module's existing exported table symbol unchanged.
5. Keep the current repository facade while it delegates to the BSL repository. Consumers should
   not have to migrate persistence mechanics and business call sites in the same change.
6. For each tranche, compare drizzle-kit output to the current schema before applying anything.
   Any serial/identity, enum/text, timestamp/bigint, name, index, or FK delta requires an explicit
   migration decision rather than an adapter trick.

## Migration order

1. **Graduation and parity fixtures.** Promote the BSL core, live support, and BaseEntity parity
   fixture into shared packages; prove an empty schema diff and repository round trips without
   changing a production entity.
2. **Low-fan-out pilot.** Convert `architecture-lab`'s Worker and one workspace leaf such as
   CandidateDraft/CandidateProject. These exercise the adapter with small ownership surfaces.
3. **Shared identity graph.** Convert Organization, User, and Membership together. Assembly must
   own the three tables so organization self-relations, user-to-organization, reverse collections,
   and Membership through-relations remain one tested graph.
4. **Workspace graph.** Convert Workspace, Thread, Message, Turn, CandidateProject, and
   CandidateDraft as one FK-aware assembly after the shared IDs are stable.
5. **Documents and agents.** Convert the four document synchronization entities, then
   ProviderInstance. Preserve their existing public table exports through adapters.
6. **Epistemic and law-practice.** Move these last because they contain the largest concentration
   of entity tables, multi-table concepts, and domain-specific index/constraint behavior. Convert
   one bounded relation component per PR and remove `EntityTable.pgTableFrom` only after every live
   consumer has moved.
7. **Remove compatibility.** Delete the EntitySchema-to-table adapter and old driver path only
   after repository, migration, relation, and hosted package checks are green for all call sites.

## Graduation blockers and receipts

- **Lifecycle algebra:** BaseEntity depends on `providedByContext`, `derived`,
  `computedByServiceOnInsert`, millis `defaultedOnInsert`, and millis `updatedOnWrite`. Rounds three
  and four proved specific timestamp constructors, and round five proved service requirements in
  repository method types, but not these reusable lifecycle strategies.
- **DDL parity:** the current driver maps generated entity ids to `serial`, literal storage to
  `text`, and millis timestamps to number-mode `bigint`. BSL can express each carrier but must prove
  zero unintended drizzle-kit changes before production adoption.
- **Dynamic relation result typing:** round two records that `Assembly.relations` remains broad
  because relation names are assembled dynamically. Round five proves the graph executes, but
  production callers still need ergonomic typed query access without local reflective helpers.
- **Relation coverage:** round five covers single-column FKs, reverse relations, self-relations,
  and the strict two-FK composite-PK junction shape. Composite foreign keys, payload junction
  policy, and user-specified relation names remain absent.
- **Index/constraint parity:** round two implemented table nodes, but a mechanical audit must prove
  every existing `IndexHint`, composite constraint, and naming convention. Combined model
  annotations plus extras also remains an open API seam from round two.
- **Codec execution services:** round five removes the service-free repository bound and proves
  the requirement types. A real service-backed insert/update/decode still needs a live test before
  the BaseEntity public-id path moves.
- **Harness ownership:** round five separates timestamp parser pinning and the camel/snake client
  view, but they remain scratchpad-local. Promotion needs one shared owner and tests for both raw
  and transformed clients.
- **PostgreSQL array boundary:** round five proves text arrays and multidimensional text arrays
  live. Named enum arrays project valid DDL, but PGlite's current custom-enum array parameter
  serializer produced an invalid array literal, so enum-array live writes need an upstream fix or
  a documented driver codec before graduation claims include them.
- **Package/public API design:** `Bsl.make`, exported model/table types, errors, and JSDoc need a
  shared package location and stability review before any production package imports them.

## Acceptance gate for the first production tranche

- The promoted proof suite retains zero runtime type assertions.
- A service-backed lifecycle fixture executes, not only typechecks.
- The BaseEntity parity fixture proves insert, optimistic update, context values, public-id
  computation, and numeric millis round trips.
- drizzle-kit produces no unreviewed changes against the corresponding current tables.
- Existing table and repository imports remain source-compatible through the adapter.
- The migrated relation component passes actual RQB forward, reverse, self, and through queries.
