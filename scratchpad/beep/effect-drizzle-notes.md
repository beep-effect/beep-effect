# effect-drizzle notes from the OMI port

Observed while porting the OMI models into `scratchpad/beep`. These are limits of the current package, not workarounds to copy into product slices.

## Encoded `undefined` cannot be a SQL column

`packages/ecosystem/effect-drizzle/src/core/classification.ts` rejects an encoded `undefined` with "Encoded 'undefined' cannot reach a SQL row; represent absence as null." `S.OptionFromOptionalNullOr` puts `undefined` in the encoded AST, so a nullable column cannot use it. The scratchpad wrapper decodes a missing key or `null` to `None` and encodes `None` as `null` before the `pg` combinator. A first-class nullable-column combinator that does that would remove the wrapper.

## `pg.jsonb()` does not accept a generic schema

`pg.jsonb()` requires `Field.ValidateEncoded<I, object>`. That proof disappears when the schema is a type parameter, so `jsonColumn` in `Port.ts` needs a `ts-expect-error` even when every call site is an object or array schema. A combinator that accepted `S.ConstraintDecoder` whose `Encoded` extends `object` would typecheck the generic form.

## Schema checks and SQL checks are separate

`isBetween`, `isMinLength`, and `isPattern` carry `arbitraryConstraint` for `Arbitrary.schema`. `Table.check` is a second, hand-written SQL expression. Nothing projects a schema check into a parameter-free `Table.check`. The port repeats each Python `Field` bound in both places.

## `Model` derives the table name from the identifier

The final segment of the `Model` identifier becomes the snake-case table name. An identifier with a slash is a bad table name. These experimental models use the PascalCase class name and set snake-case column names with `pg.columnName`.
