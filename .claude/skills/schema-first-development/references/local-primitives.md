# Local Primitives

This repo uses both upstream `effect/Schema` and local helpers from
`@beep/schema`.

Reach for existing local building blocks before inventing new schemas or custom
filters.

## Import Baseline

Use this baseline unless the file already follows a stronger local pattern.

```ts
import { $PackageNameId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema"
import * as S from "effect/Schema"
```

## Use `@beep/identity` for Annotations

Create a file-local composer and use it for schema identifiers and annotations.

```ts
const $I = $PackageNameId.create("relative/path/to/file/from/package/src")
```

Use `$I\`Name\`` for class or service identifiers and `$I.annote(...)` for
annotation metadata.

## Prefer `LiteralKit` for Internal Literal Domains

Use `LiteralKit` when the literal set needs more than just a one-off union.
Do not add `as const` to inline array literals passed directly to
`LiteralKit(...)`; its const type parameters preserve the literal tuple.

What it gives you:

- schema value
- `.Options`
- `.Enum`
- `.is`
- `.thunk`
- `.pickOptions(...)`
- `.omitOptions(...)`
- `$match`
- `.mapMembers(...)` for tagged-union assembly
- `.toTaggedUnion(...)` for direct literal-to-member tagged unions

Good fits:

- status fields
- mode fields
- error kinds
- reusable small internal domains

## Prefer `MappedLiteralKit` for Lookup-Driven Literal Domains

Use `MappedLiteralKit` when the literal set comes from a structured map or
dictionary and you need the schema to stay derived from that source. It keeps
directional helpers on both sides of the mapping through `.From`, `.To`, and
`.Pairs`.

Good fits:

- error-code tables
- database enum maps
- protocol lookup tables

## Preserve Static Helpers After Rebuilds

Schema annotations and transformations can rebuild schema values. If a
`LiteralKit` value needs to keep its helper surface after a rebuild, use the
repo helper that reattaches those statics instead of hand-copying properties:

```ts
import { withLiteralKitStatics } from "@beep/schema/SchemaUtils/withLiteralKitStatics"

const StatusBase = LiteralKit(["draft", "published"])
const Status = StatusBase.pipe(withLiteralKitStatics(StatusBase))
```

## Prefer Shared Schemas Before New Brands

Check `packages/common/schema/src/` before writing a custom primitive.

Examples worth reusing:

- `TrimmedNonEmptyText`
- `CommaSeparatedList`
- `NormalizedBooleanString`
- `FilePath`
- `PosixPath`
- `Email`
- integer and numeric helpers from `Int.ts` and `Number.ts`
- SQL-focused schemas under `Sql/`

If the domain already exists there, reuse it or extend it instead of cloning the
logic locally.

## Prefer Shared Transform Helpers Before Manual Wrappers

Look for transformation helpers before writing custom decode glue.

Example:

- `destructiveTransform` in `@beep/schema/Transformations`

Use local transform helpers when they already encode the repo's expected
behavior or failure handling.

## Prefer `S.TaggedError` for Typed Error Schemas

When an error is part of a module boundary, extend `S.TaggedError` from
`effect/Schema` directly.

This keeps the error itself schema-backed and consistent with the repo's error
modeling style.

Prefer:

```ts
export class InputError extends S.TaggedError<InputError>($I`InputError`)(
  "InputError",
  { message: S.String },
  $I.annote("InputError", {
    description: "Invalid input payload.",
  })
) {}
```

Use the package `$I` composer when a distinct namespaced schema identifier is
wanted. If no distinct identifier is needed, use
`S.TaggedError<InputError>()("InputError", fields)`. Never pass a bare
identifier equal to the tag. Cause-carrying errors declare
`cause: S.Defect({ includeStack: true })` explicitly.

## Decide Between Raw `effect/Schema` and Local Helpers

Use raw `effect/Schema` when:

- composing an object model with `S.Class`
- building a one-off local codec
- using standard helpers such as `OptionFrom*`, `decodeTo`, or JSON codecs

Use `@beep/schema` when:

- the repo already has a shared primitive for the concept
- the domain is a reusable literal set
- the error should be schema-backed
- transformation or validation logic already exists locally

## Common Pitfalls

- Do not rebuild boolean, path, or email normalization from scratch if
  `@beep/schema` already provides it.
- Do not use `S.Literals(...)` where `LiteralKit(...)` is expected for reuse.
- Do not define schema helpers without annotation metadata when they are shared
  across files or modules.
- Do not create plain TS types beside a reusable schema primitive unless the
  type alias is derived from the schema value.
