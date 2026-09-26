# Pattern Catalog

Use this file to choose the repo-preferred schema pattern for the task.

## 1. Replace an Exported Pure-Data `interface`

Trigger:

- schema-first lint finding
- review note about duplicated type and runtime validation
- new domain payload proposal written as plain TS

Preferred replacement:

```ts
export class TaskInput extends S.Class<TaskInput>($I`TaskInput`)(
  {
    id: S.String,
    title: S.String,
    priority: S.Int,
  },
  $I.annote("TaskInput", {
    description: "Input payload for task creation.",
  })
) {}
```

Keep the schema value as the source of truth and derive types from it.

## 2. Build an Object Model

Default:

- `S.Class` for domain objects and reusable payloads

Boundary exception:

- `S.Struct` for plain shape composition when class construction adds nothing
- If you use `S.Struct`, export `type X = typeof X.Type`

## 3. Model Boundary Normalization and Defaults

Use this when:

- reading env/config values
- normalizing strings
- translating text or unknown input into typed values
- encoding fallback behavior directly in the schema

Preferred tools:

- `S.UndefinedOr(...)`
- `S.decodeTo(...)`
- `SchemaTransformation.transform(...)`
- `S.withConstructorDefault(...)`
- `S.withDecodingDefault(...)`
- `S.withDecodingDefaultKey(...)`

This pattern is preferred over manual parsing branches and fallback object
construction.

## 4. Model Absence as `Option`

Use the schema helpers that match the boundary shape.

- `OptionFromNullOr`: input may be `null`
- `OptionFromNullishOr`: input may be `null` or `undefined`
- `OptionFromOptionalKey`: object key may be absent
- `OptionFromOptional`: optional standalone field

Do not decode to `string | undefined` and convert later unless the boundary
truly requires it.

## 5. Model Reusable Literal Domains

Use `LiteralKit(...)` when the literal set needs any of:

- guards
- enums
- options or subsets
- thunks
- member mapping
- direct annotation

Inline array literals passed directly to `LiteralKit(...)` should omit
`as const`; `LiteralKit` preserves them through const type parameters.

Use a one-off literal union only when the value is genuinely local and no helper
surface is needed.

## 6. Model Tagged Unions

Use this split:

- Model finite variants, lifecycle states, status/result cases, and
  case-specific payloads as discriminated unions instead of optional/nullish
  payload bags.
- If an external wire contract forces a bag shape, decode or normalize it into
  an internal tagged model before branching.
- `S.toTaggedUnion("field")` for discriminator fields such as `kind`, `type`,
  `status`, `subtype`, `decision`, `profile`, or `family`
- `S.TaggedUnion(...)` only for `_tag`

Repo-preferred construction for reusable literal domains:

1. Define the literal kit.
2. Define member schemas, usually with `S.Class`.
3. Assemble members with `.mapMembers(...)`.
4. Finalize with `S.toTaggedUnion("field")`.

This is the high-signal repo style for discriminator-heavy modules.

When branching on the resulting schema union, prefer the schema-derived
`.match` helper. Use `.cases` for case constructors, `.guards` for
discriminator-aware guards, and `.isAnyOf` for grouped case checks. For
ordinary runtime unions that are not schema-derived, prefer
`Match.tagsExhaustive` or `Match.tags` when they make the case set explicit.

## 7. Reuse Schema-Derived Runtime Helpers

When the schema already exists, derive helpers instead of duplicating the rule.

Use:

- `S.is(schema)` for guards
- `S.toEquivalence(schema)` for comparisons
- `S.toArbitrary(schema)` for schema-modeled property tests
- schema tagged-union `.cases`, `.guards`, `.isAnyOf`, and `.match`
- `LiteralKit.Options`, `.Enum`, `.is`, `.pickOptions`, `.omitOptions`,
  `.$match`, `.thunk`, and `.toTaggedUnion`
- `S.decodeUnknownEffect` / `S.decodeEffect` for default decoders
- `S.encodeUnknownEffect` / `S.encodeEffect` for default encoders
- `S.decodeUnknownResult`, `S.decodeResult`, or `S.decodeUnknownOption` only
  for explicit non-throwing synchronous helpers

Avoid:

- hand-written `isX`
- duplicate comparison logic
- duplicate literal arrays or enum-like constants for a `LiteralKit` domain
- `switch` / `if` branches over a schema tagged-union discriminator in the
  same module that owns the schema
- manual conversion helpers that restate schema behavior
- sync throwing schema codecs (`S.decodeSync`, `S.decodeUnknownSync`,
  `S.encodeSync`, `S.encodeUnknownSync`) as the default constructor pattern

When decoder or encoder failures leave the local helper, wrap the Effect codec
with `Effect.mapError(...)` and return the boundary's typed error.

## 8. Use JSON String Codecs

For JSON string boundaries:

- `S.UnknownFromJsonString` for unknown JSON payloads
- `S.fromJsonString(MySchema)` when the string should decode directly into a
  known domain schema

Avoid wrapping `JSON.parse` with Effect code unless a very unusual boundary
forces it.

## 9. Add Reusable Custom Checks

Before custom checks:

1. Look for an existing schema in `@beep/schema`.
2. Look for built-in constructors such as `S.NonEmptyString`,
   `S.NonEmptyArray`, `S.isPattern`, and `S.isIncluding`.
3. For exported/domain/boundary schemas, ask whether broad primitives such as
   `S.String`, `S.Number`, or `S.Array` really accept the full primitive space.
4. Only then use `S.makeFilter(...)` or `S.makeFilterGroup(...)`.

If the check is reusable, include:

- `identifier`
- `title`
- `description`
- user-facing `message`

## 10. Common Anti-Patterns and Replacements

- Exported data `interface`
  Replace with `S.Class` or annotated `S.Struct`
- `type X = { ... }` plus separate decoder
  Replace with one schema value and derived type alias
- `JSON.parse` / `JSON.stringify`
  Replace with schema JSON codecs
- Manual default object merging
  Replace with schema defaults and transforms
- Manual branch helpers for schema tagged unions
  Replace with `.match`, `.guards`, `.isAnyOf`, and `.cases`
- Duplicate literal constants for reusable literal domains
  Replace with `LiteralKit.Enum`, `LiteralKit.Options`, and subset helpers
- Ad-hoc string predicates
  Replace with local shared schemas, built-in checks, or a reusable metadata-rich
  filter
- `S.Literals(...)` for a reusable internal domain
  Replace with `LiteralKit(...)`
- One object with optional fields for every case payload
  Replace with a tagged union, or decode the external bag into an internal
  tagged model at the boundary.

## 11. Review Checklist

Before approving or shipping schema work, check:

- Is the schema the source of truth?
- Are defaults and normalization encoded in the schema?
- Are nullish and optional fields converted at the boundary?
- Does the code reuse local shared schema primitives?
- Are annotations present and meaningful?
- Are tagged unions built with the right discriminator helper?
- Are guards, branch helpers, options, arbitraries, or comparisons derived
  instead of duplicated?
- Are exported/domain/boundary primitives as precise as the domain requires?
