# Schema Annotation Patterns

Every schema definition must carry identity annotations via the file-local `$I`
composer created from the package identity.

## Class schemas (`S.Class`, `Model.Class`, `S.TaggedError`)

The annotations argument to the class factory receives `$I.annote`. Schema
classes are for errors, persisted entities, schemas with instance members, and
`.extend` chains, and they carry a brand type argument:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
class MyEntity extends S.Class<MyEntity, { readonly brand: unique symbol }>($I`MyEntity`)(
  { /* fields */ },
  $I.annote("MyEntity", {
    description: "A meaningful description reflected in JSDoc for the schema."
  })
) {
  get label(): string {
    return "…"
  }
}
```

## Plain data schemas (`S.Opaque`)

Plain data is a branded `S.Opaque` over a Struct. Annotate the Struct with
`$I.annoteSchema` inside the pipe; `MyPayload.annotate(...)` would return a
plain schema without the class statics:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
class MyPayload extends S.Opaque<MyPayload, { readonly brand: unique symbol }>()(
  S.Struct({ /* fields */ }).pipe(
    $I.annoteSchema("MyPayload", {
      description: "A meaningful description reflected in JSDoc for the schema."
    })
  )
) {}
```

## Tagged errors

Extend `S.TaggedError` from `effect/Schema` directly. Use the package `$I`
composer when a distinct namespaced schema identifier is wanted:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
class MyError extends S.TaggedError<MyError, { readonly brand: unique symbol }>($I`MyError`)(
  "MyError",
  { message: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annote("MyError", {
    description: "Describes when and why this error occurs."
  })
) {}
```

If no distinct identifier is needed, use
`S.TaggedError<MyError, { readonly brand: unique symbol }>()("MyError", fields)`. Never pass a bare identifier
equal to the tag. Cause-carrying errors declare
`cause: S.Defect({ includeStack: true })` explicitly.

## Non-class schemas

Use `$I.annoteSchema` via `.pipe(...)`:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
const MySchema = S.String.pipe(
  S.check(S.isPattern(/^[a-z]+$/)),
  $I.annoteSchema("MySchema", {
    description: "A meaningful description."
  })
)
```

## LiteralKit schemas

Same as every non-class schema: `$I.annoteSchema` via `.pipe(...)`. The kit's
helpers (`.Enum`, `.is`, `.match`, `.matchOrElse`) survive it:

```ts
import { LiteralKit } from "@beep/schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
const Status = LiteralKit(["active", "inactive"]).pipe(
  $I.annoteSchema("Status", {
    description: "Entity lifecycle status."
  })
)
```

Never write `.annotate($I.annote(...))` on a non-class schema. It writes the
same annotations, but its extras are untyped against the schema, and it keeps
only the statics a schema re-attaches in its own `rebuild`. `LiteralKit` does,
but an `S.toTaggedUnion(...)` result loses `match`, `cases`, `guards` and
`isAnyOf` at runtime. `annoteSchema` copies statics back for every schema.

## Checks and filters

Pass `$I.annote(...)` as the check's annotation argument. Never hand-build
`{ identifier: $I\`Name\`, ... }`; it skips the schema id, IRI and CURIE. A
caller-supplied `title` wins over the derived one:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
const Slug = S.String.check(
  S.isPattern(/^[a-z][a-z0-9-]*$/, $I.annote("SlugPattern", {
    title: "Slug syntax",
    description: "Lowercase letters, digits and hyphens.",
    message: "Expected a lowercase slug"
  }))
).pipe($I.annoteSchema("Slug", { description: "A URL slug." }))
```

## Struct fields

Use `$I.annoteKey("Parent.key", {...})` inside `.pipe(...)`, never
`.annotate($I.annote(...))` or `.annotateKey($I.annote(...))`. A raw
`.annotate({...})` on a field is fine. When a recursive class's own base
expression trips TS2310 on the pipe form, apply the helper directly:
`$I.annoteKey("Parent.key", {...})(S.suspend(() => Node))`.

## Union, TemplateLiteral, and composed schemas

Use `$I.annoteSchema(...)` inside `.pipe(...)`:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const SchemaA = S.TaggedStruct("A", {});
const SchemaB = S.TaggedStruct("B", {});
const $I = $SchemaId.create("examples");
const MyUnion = S.Union([SchemaA, SchemaB]).pipe(
  $I.annoteSchema("MyUnion", {
    description: "Discriminated union of A and B."
  })
)
```

## Type Alias Convention

Every non-class schema that is exported must also export a same-name runtime
type alias immediately after it:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
export const MySchema = S.String.pipe(
  $I.annoteSchema("MySchema", { description: "..." })
)

/**
 * Decoded value produced by {@link MySchema}.
 *
 * @see {@link MySchema} for the runtime schema and decoding behavior.
 * @category models
 * @since 0.0.0
 */
export type MySchema = typeof MySchema.Type
```

The same-name alias is pure type-level, so precise prose is required but an
Example is not. Keep its `@see` described; do not duplicate the runtime schema's
Example or add a legacy `@example` tag.
