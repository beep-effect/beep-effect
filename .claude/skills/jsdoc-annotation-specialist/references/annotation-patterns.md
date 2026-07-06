# Schema Annotation Patterns

Every schema definition must carry identity annotations via the file-local `$I`
composer created from the package identity.

## Class schemas (S.Class, Model.Class, TaggedErrorClass)

The third argument to the class factory receives `$I.annote`:

```ts
class MyEntity extends S.Class<MyEntity>($I`MyEntity`)(
  { /* fields */ },
  $I.annote("MyEntity", {
    description: "A meaningful description reflected in JSDoc for the schema."
  })
) {}
```

## TaggedErrorClass

Same pattern, but imported from `@beep/schema`:

```ts
class MyError extends TaggedErrorClass<MyError>($I`MyError`)(
  "MyError",
  { message: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annote("MyError", {
    description: "Describes when and why this error occurs."
  })
) {}
```

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
 * Type for {@link MySchema}. {@inheritDoc MySchema}
 *
 * @category models
 * @since 0.0.0
 */
export type MySchema = typeof MySchema.Type
```

The type alias JSDoc uses `{@link}` and `{@inheritDoc}` to avoid duplicating
the description.
