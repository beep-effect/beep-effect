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

## 2. Plain Data Is a Branded `S.Opaque`

Plain data schemas use `S.Opaque` over an annotated `S.Struct`. Plain data
means no instance members, not an error, not a persisted entity, and not part
of an `.extend` chain. Tagged data uses `S.TaggedStruct("X", {...})` as the
source so `_tag` dispatch keeps working.

Prefer:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
export class User extends S.Opaque<User, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    name: S.String,
  }).pipe(
    $I.annoteSchema("User", {
      description: "Application user payload.",
    })
  )
) {}

const user = User.make({ id: "u-1", name: "Ada" })
```

What the shape gives you:

- Values are plain objects validated by shape, so `S.is(User)`, encoding, and
  `HttpApiClient` payloads accept any structurally valid object, and
  `structuredClone` / `postMessage` keep the value intact.
- The class gives an opaque nominal type and a place for `static` members.
- `User.make(...)` constructs. `new User(...)` is not available.
- There is no `User.extend`. Spread `User.fields` into a new `S.Struct`, or use
  `S.fieldsAssign(...)`.
- `User.annotate(...)` returns a plain schema without the statics. Put
  annotations on the Struct inside the pipe.

Keep `S.Class` / `S.TaggedClass` / `S.Error` / `S.TaggedError` for:

- errors
- persisted entities (built on `@beep/effect-drizzle`)
- schemas with instance members (getters or methods)
- `.extend` chain roots and subclasses

`S.Class` checks `instanceof` on the type side. A structurally valid plain
object fails `S.is`, encoding, and `HttpApiClient` payload encoding against
it, which is why it is no longer the default for data.

Every `S.Class`, `S.TaggedClass`, `S.Error`, `S.TaggedError`, and `S.Opaque`
declaration carries `{ readonly brand: unique symbol }` as its brand type
argument, for example
``S.Class<X, { readonly brand: unique symbol }>($I`X`)(...)``. A structural
`{}` brand needs a documented exception in
`standards/schema-first.inventory.jsonc`.
`schemaClassMissingBrand` is an error in the root compiler map
(`tsconfig.base.json`), so `tsrs` fails Check on it.
Decision: `standards/architecture/DECISIONS.md` (2026-10-14).

Avoid plain data as `S.Class`:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
// Rejects structurally valid plain objects; no brand.
export class User extends S.Class<User>($I`User`)({
  id: S.String,
  name: S.String,
}) {}
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
- Annotate reusable non-class schemas, `LiteralKit` included, with
  `.pipe($I.annoteSchema(...))`, never `.annotate($I.annote(...))`. Classes keep
  `$I.annote(...)` / `$I.annoteError<X>(...)` as their trailing argument.
- Use descriptions that explain intent, not descriptions that only repeat the
  symbol name.

Prefer:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
export const Tenant = S.String.pipe(
  $I.annoteSchema("Tenant", {
    description: "Logical tenant identifier used for partitioning.",
  })
)

export type Tenant = typeof Tenant.Type
```

Avoid:

```ts
import * as S from "effect/Schema";
export const TenantSchema = S.String
export type Tenant = string
```

## 4. Defaults and Normalization Belong in the Schema

Prefer schema-level defaults and transforms to ad-hoc runtime fallback objects.

Use:

- `S.withConstructorDefault(...)`
- `S.withDecodingDefaultKey(...)`
- `S.decodeTo(...)`
- `SchemaTransformation.transform(...)`
- `SchemaTransformation.transformEffect(...)`

Prefer:

```ts
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as SchemaTransformation from "effect/SchemaTransformation";
const Enabled = S.String.pipe(
  S.decodeTo(
    S.Boolean,
    SchemaTransformation.transform({
      decode: (value) => value === "true",
      encode: (value) => (value ? "true" : "false"),
    })
  ),
  S.withConstructorDefault(Effect.succeed(false)),
  S.withDecodingDefaultKey(Effect.succeed("false"))
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

Never `S.optional`, `S.withDecodingDefault` or `S.OptionFromOptional`: optional
fields use exact keys (EF-40, enforced by the `prefer-exact-optional-key` Biome
rule). A field whose decoder really receives `undefined` from third-party code
is `S.optionalKey(S.UndefinedOr(X))`.

Prefer:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
export class AccountInput extends S.Opaque<AccountInput, { readonly brand: unique symbol }>()(
  S.Struct({
    nickname: S.OptionFromNullishOr(S.String),
    bio: S.OptionFromNullOr(S.String),
    phone: S.OptionFromOptionalKey(S.String),
  }).pipe(
    $I.annoteSchema("AccountInput", {
      description: "Account input whose absent fields decode to Option.",
    })
  )
) {}
```

## 6. JSON Boundaries Stay Schema-Driven

Do not use `JSON.parse` or `JSON.stringify` in schema-first code paths.

Use:

- `S.fromJsonString(S.Unknown)`
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
- `Arbitrary.schema(schema)` (`effect/Arbitrary`) for schema-modeled laws and
  boundary invariants
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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
S.makeFilter(Str.includes("/"), $I.annote("ContainsSlashCheck", {
  title: "Contains Slash",
  description: "A string that contains the slash character.",
  message: "Expected text to contain '/'",
}))
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
- Spell a fixed tag with the tagged constructors: `S.TaggedStruct("X", {...})`,
  not `S.Struct({ _tag: S.Literal("X"), ... })`; `S.TaggedClass` /
  `S.TaggedError`, not `S.Class` / `S.Error` with a `_tag` field; and
  `S.tag(v)` for any other required field fixed to one literal, not
  `S.Literal(v)` or the hand-rolled
  `S.Literal(v).pipe(S.withConstructorDefault(Effect.succeed(v)))`. A
  `Class.extend` `_tag` has no tagged form, so it uses `S.tag`. Optional keys,
  `S.tagDefaultOmit`, `S.Literals`, `LiteralKit`, brand chains and literals
  behind `S.suspend` are different shapes and stay as they are.

## 9b. Source Schemas Must Be Precise Enough to Generate Test Data

Property tests should import production schemas and derive data from them.
Do not define weaker test-only schemas to make arbitrary generation easier.

When `Arbitrary.schema(schema)` exposes values that break a claimed invariant,
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
- `bun run beep laws schema-tag-idioms --check` (`lint:schema-tag-idioms`, no
  allowlist) for the tagged-constructor and `S.tag` rules in section 9
- package-level tests that pin the package's schema conventions, where the
  package has them

The intent is not just "make lint pass". The intent is to keep schema modeling
central enough that runtime helpers, docs, and validation behavior all stay in
sync.
