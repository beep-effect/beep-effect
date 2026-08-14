# Schema Annotation Patterns

Every schema definition must carry identity annotations via the file-local `$I`
composer created from the package identity.

## Class schemas (`S.Class`, `Model.Class`, `S.TaggedError`)

The third argument to the class factory receives `$I.annote`:

```ts
class MyEntity extends S.Class<MyEntity>($I`MyEntity`)(
  { /* fields */ },
  $I.annote("MyEntity", {
    description: "A meaningful description reflected in JSDoc for the schema."
  })
) {}
```

## Tagged errors

Extend `S.TaggedError` from `effect/Schema` directly. Use the package `$I`
composer when a distinct namespaced schema identifier is wanted:

```ts
class MyError extends S.TaggedError<MyError>($I`MyError`)(
  "MyError",
  { message: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annote("MyError", {
    description: "Describes when and why this error occurs."
  })
) {}
```

If no distinct identifier is needed, use
`S.TaggedError<MyError>()("MyError", fields)`. Never pass a bare identifier
equal to the tag. Cause-carrying errors declare
`cause: S.Defect({ includeStack: true })` explicitly.

## Non-class schemas

Use `$I.annoteSchema` via `.pipe(...)`:

```ts
const MySchema = S.String.pipe(
  S.pattern(/^[a-z]+$/),
  $I.annoteSchema("MySchema", {
    description: "A meaningful description."
  })
)
```

## LiteralKit schemas

Use `.annotate($I.annote(...))`:

```ts
const Status = LiteralKit(["active", "inactive"]).annotate(
  $I.annote("Status", {
    description: "Entity lifecycle status."
  })
)
```

## Union, TemplateLiteral, and composed schemas

Use `$I.annoteSchema(...)` inside `.pipe(...)`:

```ts
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
