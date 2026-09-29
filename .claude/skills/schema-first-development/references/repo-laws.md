# Repository Laws

This file is the policy reference for schema-first work in this repo.

## 1. Schema Is the Source of Truth

Use `Schema` for pure data models.

- Do not introduce exported pure-data `interface` declarations.
- Do not introduce exported pure-data type literals when a schema can represent
  the same shape.
- Service contracts may stay interfaces, but wire payloads, persisted rows,
  config payloads, and domain object models should be schema-first.
- Where upstream covers a `foundation/modeling` concept's intent, its covered
  facets retire in the same PR that migrates their consumers, with no alias;
  the whole concept retires unless the lines reading its uncovered members
  outnumber the lines using its covered facets (ADAPT, per the facet census in
  `standards/architecture/DECISIONS.md` "Upstream-First Foundation/Modeling").

The repo enforces this inventory with `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`.

## 2. Object Models Prefer `S.Class`

Default to `S.Class` for object schemas.

Use `S.Struct` only when the boundary shape is the real output and class-style
construction adds no value.

Prefer:

```ts
export class User extends S.Class<User>($I`User`)(
  {
    id: S.String,
    name: S.String,
  },
  $I.annote("User", {
    description: "Application user payload.",
  })
) {}
```

Avoid:

```ts
export interface User {
  readonly id: string
  readonly name: string
}
```

## 3. Naming and Annotation Rules

- Do not suffix schema values with `Schema`.
- For non-class schemas, export the runtime type alias with the same identifier.
- Annotate reusable schemas with `$I.annote(...)`.
- Use descriptions that explain intent, not descriptions that only repeat the
  symbol name.

Prefer:

```ts
export const Tenant = S.String.annotate(
  $I.annote("Tenant", {
    description: "Logical tenant identifier used for partitioning.",
  })
)

export type Tenant = typeof Tenant.Type
```

Avoid:

```ts
export const TenantSchema = S.String
export type Tenant = string
```

## 4. Defaults and Normalization Belong in the Schema

Prefer schema-level defaults and transforms to ad-hoc runtime fallback objects.

Use:

- `S.withConstructorDefault(...)`
- `S.withDecodingDefault(...)`
- `S.withDecodingDefaultKey(...)`
- `S.decodeTo(...)`
- `SchemaTransformation.transform(...)`
- `SchemaTransformation.transformOrFail(...)`

Prefer:

```ts
const Enabled = S.UndefinedOr(S.String).pipe(
  S.decodeTo(
    S.Boolean,
    SchemaTransformation.transform({
      decode: (value) => value === "true",
      encode: (value) => (value ? "true" : "false"),
    })
  ),
  S.withConstructorDefault(() => O.some(false)),
  S.withDecodingDefault(() => "false")
)
```

Avoid:

```ts
const raw = process.env.FEATURE_ENABLED
const enabled = raw === undefined ? false : raw === "true"
```

## 5. Nullish and Optional Data Become `Option`

Convert absence at the boundary instead of leaking `null` or `undefined`
through domain logic.

Use:

- `S.OptionFromNullOr`
- `S.OptionFromNullishOr`
- `S.OptionFromOptionalKey`
- `S.OptionFromOptional`

Prefer:

```ts
export class AccountInput extends S.Class<AccountInput>($I`AccountInput`)({
  nickname: S.OptionFromNullishOr(S.String),
  bio: S.OptionFromNullOr(S.String),
  phone: S.OptionFromOptionalKey(S.String),
}) {}
```

## 6. JSON Boundaries Stay Schema-Driven

Do not use `JSON.parse` or `JSON.stringify` in schema-first code paths.

Use:

- `S.UnknownFromJsonString`
- `S.fromJsonString(...)`
- `S.decodeUnknownEffect` / `S.decodeEffect`
- `S.encodeUnknownEffect` / `S.encodeEffect`
- `S.decodeUnknownResult` / `S.decodeResult` or `S.decodeUnknownOption` only
  for deliberate non-throwing synchronous helpers

Fix lint or review findings by moving parsing and encoding into schemas rather
than wrapping native JSON helpers with `try/catch`.

Do not use `S.decodeSync`, `S.decodeUnknownSync`, `S.encodeSync`, or
`S.encodeUnknownSync` by default. If schema errors cross a local module,
service, CLI, or HTTP boundary, map the schema error into that boundary's typed
error with `Effect.mapError(...)`.

## 7. Guards and Comparisons Derive from the Schema

Prefer derived helpers over parallel hand-written predicates.

Use:

- `S.is(schema)`
- `S.toEquivalence(schema)`
- `S.toArbitrary(schema)` for schema-modeled laws and boundary invariants
- `S.TaggedUnion(...).cases` / `.guards` / `.isAnyOf` / `.match`
- `S.toTaggedUnion(...).cases` / `.guards` / `.isAnyOf` / `.match`
- `LiteralKit.Enum`, `.is`, `.$match`, and `.toTaggedUnion`, plus the
  inherited `S.Literals` members `.literals` and `.pick(...)`
- `MappedLiteralKit.From`, `.To`, and `.Pairs` for directional literal maps

Avoid ad-hoc duplicate helpers when the schema already expresses the domain
constraint.

## 8. Reusable Checks Need Metadata

When you do need custom reusable checks:

- Prefer built-in checks first.
- If `S.makeFilter(...)` or `S.makeFilterGroup(...)` is still required, include
  `identifier`, `title`, and `description`.
- Keep `message` focused on user-facing decode failure.

Prefer:

```ts
S.makeFilter(Str.includes("/"), {
  identifier: $I`ContainsSlashCheck`,
  title: "Contains Slash",
  description: "A string that contains the slash character.",
  message: "Expected text to contain '/'",
})
```

## 9. Literal Domains and Tagged Unions Follow Repo Style

- Use `LiteralKit` for named literal domains; use `S.Literals` for anonymous
  inline unions never referenced by name.
- Model finite variants, lifecycle states, status/result cases, and
  case-specific payloads as discriminated unions instead of optional/nullish
  payload bags.
- Keep external optional/nullish case bags at the boundary only when a wire
  shape requires them; decode or normalize to an internal tagged model before
  case-specific branching.
- Use `S.toTaggedUnion("<field>")` for discriminator fields such as `kind`,
  `type`, `status`, `subtype`, `decision`, `profile`, or `family`.
- Use `S.TaggedUnion(...)` only for canonical `_tag` unions.
- Prefer `LiteralKit + mapMembers + Tuple.evolve + S.toTaggedUnion(...)` for
  reusable literal domains, and prefer the schema-derived `.match` helper when
  branching directly on the tagged union.
- Use `LiteralKit.Enum`, `.literals`, and `.pick(...)` instead of duplicate
  literal arrays or enum-like constants.

## 9b. Source Schemas Must Be Precise Enough to Generate Test Data

Property tests should import production schemas and derive data from them.
Do not define weaker test-only schemas to make arbitrary generation easier.

When `S.toArbitrary(schema)` exposes values that break a claimed invariant,
fix or annotate the source schema unless the invariant was overstated.

Broad primitives in exported/domain/boundary schemas need a deliberate reason:

- use `S.NonEmptyString`, patterns, brands, and length checks when a string
  domain is narrower than all strings;
- use `S.Finite`, `S.Int`, `S.FiniteFromString`, and range checks for
  operational numbers;
- use non-empty or bounded collections when empty or unbounded arrays are not
  valid domain values.

## 10. Enforcement and Review Signals

When fixing schema-first issues, check:

- `bun run beep lint schema-first`
- `standards/schema-first.inventory.jsonc`
- package-level convention tests such as `packages/ai/sdk/test/conventions-guard.test.ts`

The intent is not just "make lint pass". The intent is to keep schema modeling
central enough that runtime helpers, docs, and validation behavior all stay in
sync.
