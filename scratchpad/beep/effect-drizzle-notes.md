# effect-drizzle notes from the OMI port

Observed while porting the OMI models into `scratchpad/beep`. These are limits of the current package, not workarounds to copy into product slices.

## Encoded `undefined` cannot be a SQL column

`packages/ecosystem/effect-drizzle/src/core/classification.ts` rejects an encoded `undefined` with "Encoded 'undefined' cannot reach a SQL row; represent absence as null." `S.OptionFromOptionalNullOr` puts `undefined` in the encoded AST, so a nullable column cannot use it. The scratchpad wrapper decodes a missing key or `null` to `None` and encodes `None` as `null` before the `pg` combinator. A first-class nullable-column combinator that does that would remove the wrapper.

## `pg.jsonb()` does not accept a generic schema

`pg.jsonb()` requires `Field.ValidateEncoded<I, object>`. That proof disappears when the schema is a type parameter, so `jsonColumn` in `Port.ts` needs a `ts-expect-error` even when every call site is an object or array schema. A combinator that accepted `S.ConstraintDecoder` whose `Encoded` extends `object` would typecheck the generic form.

The workaround that keeps the field type is an explicit annotation on the
patched result, `PatchedField<Sch, { readonly column: Jsonb }>`, with the
`ts-expect-error` on the single `pg.jsonb()(schema)` call. Without it the
failed overload resolves the field to `never`, so every model that used
`optionalJsonColumn` typed that field as `undefined` and its `make` argument
as `never`. Both `PatchedField` and `Jsonb` are already public, so the
combinator overload is the only missing piece.

## A patched field outside `Model` crashes at build time

`pg.*` combinators return a `Field`, not a schema. Placing one in a plain
`S.Struct` or `S.Class` field map compiles but throws
`Cannot read properties of undefined (reading 'encoding')` from `SchemaAST`
when the struct is built. Only `Model` unwraps fields. A `Field` that carried a
readable `Schema` protocol, or a guard that names the field at the `S.Struct`
callsite, would turn that stack trace into an actionable error.

## A patched field cannot take `annotateKey`

Once a schema has been through `pg.text()` or `pg.columnName()` it is a
`Field`, and `annotateKey` is gone. A field description has to be attached to
the schema before the `pg` pipe, so every shared factory that wants to carry a
description needs a description parameter (`MemoryPromotion.ts` grew local
`blankTextColumn` / `positiveIntColumn` / `stringListColumn` for that reason).
An `annotateKey` passthrough on `Field`, or a `pg.describe(text)` combinator,
would let the factories stay description-free.

## Schema checks and SQL checks are separate

`isBetween`, `isMinLength`, and `isPattern` carry `arbitraryConstraint` for `Arbitrary.schema`. `Table.check` is a second, hand-written SQL expression. Nothing projects a schema check into a parameter-free `Table.check`. The port repeats each Python `Field` bound in both places.

## `Model` derives the table name from the identifier

The final segment of the `Model` identifier becomes the snake-case table name. An identifier with a slash is a bad table name. These experimental models use the PascalCase class name and set snake-case column names with `pg.columnName`.
