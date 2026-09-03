/**
 * Defines pipeable SQLite storage-class setters and SQL modifiers.
 *
 * Encoded carriers constrain every setter at the call site. SQLite-specific
 * omissions are deliberate: in particular, this module has no array operator.
 *
 * @since 0.0.0
 */

// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)

import { fromUndefinedOr, getOrElse } from "effect/Option";
import { BigInt as BigIntSchema, Finite, flip, is, isBetweenBigInt, isFinite, isInt, makeFilter } from "effect/Schema";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { assertSqlName } from "../core/names.ts";
import { factory as V } from "../core/variant.ts";
import { assignStatics } from "../internal/statics.ts";
import * as SqliteColumn from "./Column.ts";
import { DeriveColumnError, isEntityIdLike, isNullable, isStructuralJson, stringLiteralValues } from "./derive.ts";
import type { SQL } from "drizzle-orm";
import type { Check } from "effect/SchemaAST";
import type { ValidateSqlName } from "../core/names.ts";
import type { EntityIdLike, StructuralJson } from "./derive.ts";

const evolveSchemas = (
  schema: Field.AnySchema,
  evolve: (current: import("effect/Schema").Top) => import("effect/Schema").Top
): Field.AnySchema =>
  VariantSchema.isField(schema)
    ? V.fieldEvolve(schema, {
        select: evolve,
        insert: evolve,
        update: evolve,
        json: evolve,
        jsonCreate: evolve,
        jsonUpdate: evolve,
      })
    : evolve(schema);

function injectNumberChecks<I extends Field.Input>(
  input: I,
  checks: readonly [Check<number>, ...Array<Check<number>>]
): Field.Field<Field.SchemaFrom<I>, Field.MetaFrom<I>>;
function injectNumberChecks(input: Field.Input, checks: readonly [Check<number>, ...Array<Check<number>>]): Field.Any {
  const field = Field.from(input);
  const accepts = is(Finite.check(...checks));
  const evolved = evolveSchemas(field.schema, (schema) =>
    flip(
      flip(schema).check(
        makeFilter<unknown>((value) => value === null || accepts(value), {
          identifier: "@beep/effect-drizzle/SqliteNumberDomain",
          title: "SQLite number domain",
          description: "Mirrors a faithful SQLite numeric or integer number domain.",
          message: "The encoded number is outside the faithful SQLite value domain.",
        })
      )
    )
  );
  const preserved = isEntityIdLike(field.schema)
    ? assignStatics(evolved, {
        tableName: field.schema.tableName,
        entityType: field.schema.entityType,
      })
    : evolved;
  return Field.make(preserved, field.meta);
}

function injectBigIntCheck<I extends Field.Input>(
  input: I,
  check: Check<bigint>
): Field.Field<Field.SchemaFrom<I>, Field.MetaFrom<I>>;
function injectBigIntCheck(input: Field.Input, check: Check<bigint>): Field.Any {
  const field = Field.from(input);
  const accepts = is(BigIntSchema.check(check));
  return Field.make(
    evolveSchemas(field.schema, (schema) =>
      flip(
        flip(schema).check(
          makeFilter<unknown>((value) => value === null || accepts(value), {
            identifier: "@beep/effect-drizzle/SqliteBigIntDomain",
            title: "SQLite bigint domain",
            description: "Restricts native bigint values to SQLite's signed 64-bit range.",
            message: "The encoded bigint is outside SQLite's signed 64-bit range.",
          })
        )
      )
    ),
    field.meta
  );
}

/**
 * Sets SQLite TEXT storage in string or JSON mode.
 *
 * **When to use**
 *
 * Use with string mode for textual carriers and JSON mode for structured values
 * that should remain text-backed rather than BLOB-backed.
 *
 * **Details**
 *
 * JSON mode delegates serialization to Drizzle while retaining SQLite's TEXT
 * storage class.
 *
 * **Example** (Store text)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { text } from "@beep/effect-drizzle/sqlite"
 * String.pipe(text()).meta.column?.mode // => "text"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function text(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "sqlite.text requires a string-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Text<"text"> }>;
export function text(options: {
  readonly mode: "json";
}): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      StructuralJson,
      "sqlite.text({ mode: 'json' }) requires an array- or record-encoded schema"
    >
) => Field.Patched<I, { readonly column: SqliteColumn.Text<"json"> }>;
export function text(options?: { readonly mode: "json" }): unknown {
  return (input: Field.Input): Field.Any => {
    const field = Field.from(input);
    if (options?.mode === "json" && !isStructuralJson(field.schema)) {
      throw ModelInvariantError.make({
        message: "sqlite.text({ mode: 'json' }) requires an array- or record-encoded schema.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    return Field.patch(field, {
      column: SqliteColumn.Text.make({ mode: options?.mode === "json" ? "json" : "text" }),
    });
  };
}

type IntegerColumn<I extends Field.Input> =
  Field.SchemaFrom<I> extends EntityIdLike & { readonly tableName: infer TableName extends string }
    ? SqliteColumn.Integer<"number", SqliteColumn.EntityIdIdent<TableName>>
    : SqliteColumn.Integer<"number", "integer">;

/**
 * Sets SQLite INTEGER storage in number, boolean, or timestamp mode.
 *
 * **When to use**
 *
 * Use with the mode matching the encoded carrier; number mode is also required for
 * database-assigned rowid keys and optimistic versions.
 *
 * **Details**
 *
 * Number-encoded EntityId schemas retain an `entityId<...>` storage identity
 * so foreign keys cannot cross domain identities accidentally.
 *
 * **Example** (Store an integer)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { integer } from "@beep/effect-drizzle/sqlite"
 * Int.pipe(integer()).meta.column?.mode // => "number"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function integer(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.integer requires a number-encoded schema">
) => Field.Patched<I, { readonly column: IntegerColumn<I> }>;
export function integer(options: {
  readonly mode: "number";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.integer number mode requires a number-encoded schema">
) => Field.Patched<I, { readonly column: IntegerColumn<I> }>;
export function integer(options: {
  readonly mode: "boolean";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, boolean, "sqlite.integer boolean mode requires a boolean-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"boolean", "integer"> }>;
export function integer(options: {
  readonly mode: "timestamp" | "timestamp_ms";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Date, "sqlite.integer timestamp modes require a Date-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"timestamp" | "timestamp_ms", "integer"> }>;
export function integer(options?: { readonly mode: SqliteColumn.IntegerMode }): unknown {
  return (input: Field.Input): Field.Any => {
    const mode = getOrElse(fromUndefinedOr(options?.mode), (): "number" => "number");
    const checked = mode === "number" ? injectNumberChecks(input, [isInt()]) : Field.from(input);
    const schema = checked.schema;
    const ident: "integer" | SqliteColumn.EntityIdIdent<string> =
      mode === "number" && isEntityIdLike(schema) ? `entityId<"${schema.tableName}">` : "integer";
    return Field.patch(checked, { column: SqliteColumn.Integer.make({ mode, ident }) });
  };
}

/**
 * Set SQLite REAL storage for a number-encoded schema.
 *
 * **Example** (Store a double-precision number)
 *
 * ```ts
 * import { Finite } from "effect/Schema"
 * import { real } from "@beep/effect-drizzle/sqlite"
 *
 * Finite.pipe(real()).meta.column?.kind // => "real"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const real =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "sqlite.real requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: SqliteColumn.Real }> =>
    Field.patch(injectNumberChecks(input, [isFinite()]), { column: SqliteColumn.Real.make({}) });

/**
 * Sets SQLite BLOB storage in buffer, JSON, or bigint mode.
 *
 * **When to use**
 *
 * Use with buffer mode for bytes, JSON mode for structured binary storage, and
 * bigint mode for native bigint carriers.
 *
 * **Example** (Store a bigint as a blob)
 *
 * ```ts
 * import { BigInt } from "effect/Schema"
 * import { blob } from "@beep/effect-drizzle/sqlite"
 *
 * BigInt.pipe(blob({ mode: "bigint" })).meta.column?.kind // => "blob"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function blob(options: {
  readonly mode: "buffer";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Uint8Array, "sqlite.blob buffer mode requires a Uint8Array-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"buffer"> }>;
export function blob(options: {
  readonly mode: "json";
}): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<I, StructuralJson, "sqlite.blob json mode requires an array- or record-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"json"> }>;
export function blob(options: {
  readonly mode: "bigint";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "sqlite.blob bigint mode requires a bigint-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"bigint"> }>;
export function blob(options: { readonly mode: SqliteColumn.BlobMode }): unknown {
  return (input: Field.Input): Field.Any => {
    const field = Field.from(input);
    if (options.mode === "json" && !isStructuralJson(field.schema)) {
      throw ModelInvariantError.make({
        message: "sqlite.blob json mode requires an array- or record-encoded schema.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    return Field.patch(field, { column: SqliteColumn.Blob.make({ mode: options.mode }) });
  };
}

/**
 * Sets SQLite NUMERIC storage in faithful number or signed-64-bit bigint mode.
 *
 * **When to use**
 *
 * Use number mode for finite JavaScript numbers and bigint mode for signed
 * 64-bit integers.
 *
 * **Gotchas**
 *
 * SQLite NUMERIC affinity rewrites decimal strings (exponents, leading zeros,
 * and high precision), so string mode is deliberately unavailable. Use
 * `text()` for representation-preserving decimal strings.
 *
 * **Example** (Preserve a numeric string)
 *
 * ```ts
 * import { Finite } from "effect/Schema"
 * import { numeric } from "@beep/effect-drizzle/sqlite"
 *
 * Finite.pipe(numeric({ mode: "number" })).meta.column?.kind // => "numeric"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function numeric(options: {
  readonly mode: "number";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.numeric number mode requires a number-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"number"> }>;
export function numeric(options: {
  readonly mode: "bigint";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "sqlite.numeric bigint mode requires a bigint-encoded schema">
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"bigint"> }>;
export function numeric(options: { readonly mode: SqliteColumn.NumericMode }): unknown {
  return (input: Field.Input): Field.Any => {
    if (options.mode !== "number" && options.mode !== "bigint") {
      throw ModelInvariantError.make({
        message:
          "sqlite.numeric supports only faithful number and signed-64-bit bigint modes; use text() for decimal strings.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    const checked =
      options.mode === "number"
        ? injectNumberChecks(input, [isFinite()])
        : injectBigIntCheck(
            input,
            isBetweenBigInt({
              minimum: BigInt("-9223372036854775808"),
              maximum: BigInt("9223372036854775807"),
            })
          );
    return Field.patch(checked, { column: SqliteColumn.Numeric.make({ mode: options.mode }) });
  };
}

type ValidateEnum<I extends Field.Input> = [Exclude<Field.EncodedOf<I>, null>] extends [string]
  ? string extends Exclude<Field.EncodedOf<I>, null>
    ? Field.SqlTypeError<"sqlite.enum requires a finite union of encoded string literals">
    : unknown
  : Field.SqlTypeError<"sqlite.enum requires a finite union of encoded string literals">;
type EnumValue<I extends Field.Input> = Extract<Exclude<Field.EncodedOf<I>, null>, string>;

/**
 * Compiles a finite string domain to TEXT plus a table-local `CHECK`.
 *
 * **When to use**
 *
 * Use when a literal schema should be enforced by SQLite without inventing a
 * native enum type that the dialect does not provide.
 *
 * **Details**
 *
 * Values come from the encoded schema, so the domain is never restated in SQL
 * metadata. Projection emits the check automatically.
 *
 * **Gotchas**
 *
 * Each table receives its own check. Reusing one logical enum across tables
 * duplicates the constraint, and broad string schemas are rejected. Duplicate
 * literals collapse in first-occurrence order; NUL-containing literals fail.
 * The empty string is a legal label; represent absence with
 * `OptionFromNullOr(...)` when the encoded database value should be `NULL`.
 *
 * **Example** (Declare a checked domain)
 *
 * ```ts
 * import { Literals } from "effect/Schema"
 * import { enum as sqliteEnum } from "@beep/effect-drizzle/sqlite"
 * Literals(["draft", "active"]).pipe(sqliteEnum()).meta.column?.values
 * // => ["draft", "active"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function enum_(): <I extends Field.Input>(
  input: I & ValidateEnum<I>
) => Field.Patched<I, { readonly column: SqliteColumn.Enum<EnumValue<I>> }>;
export function enum_(): unknown {
  return (input: Field.Input): Field.Any => {
    const values = getOrElse(stringLiteralValues(Field.from(input).schema), () => {
      throw DeriveColumnError.make({
        message: "sqlite.enum requires a finite non-empty union of encoded string literals.",
        fieldName: "(unknown — set at model definition)",
        astTag: "(encoded literals)",
      });
    });
    return Field.patch(input, { column: SqliteColumn.Enum.make({ values }) });
  };
}
/** Named export for the SQLite enum combinator.
 * @category combinators
 * @since 0.0.0
 */
export { enum_ as enum };

type ValidateNotGenerated<I extends Field.Input> = Field.MetaFrom<I>["generated"] extends false
  ? unknown
  : Field.SqlTypeError<"default and generated are mutually exclusive">;
type ValidateNotDefaulted<I extends Field.Input> = Field.MetaFrom<I>["hasDefault"] extends false
  ? unknown
  : Field.SqlTypeError<"default and generated are mutually exclusive">;
type ValidateNotVersion<I extends Field.Input> = Field.MetaFrom<I>["version"] extends false
  ? unknown
  : Field.SqlTypeError<"version fields are mutually exclusive with db-assigned keys and generated columns">;

/**
 * Marks a non-null field as an inline primary key.
 *
 * **Gotchas**
 *
 * A model accepts at most one inline key; use `Table.compositePrimaryKey` for
 * multi-column keys.
 *
 * **Example** (Declare a text primary key)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { primaryKey, text } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(text(), primaryKey()).meta.primaryKey // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const primaryKey =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema">
  ): Field.Patched<I, { readonly primaryKey: true }> =>
    Field.patch(input, { primaryKey: true });

/**
 * Marks a field as carrying a single-column unique constraint.
 *
 * **Example** (Declare a unique field)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unique } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(unique()).meta.unique // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unique =
  () =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly unique: true }> =>
    Field.patch(input, { unique: true });

/**
 * Colocate a single-column index with the field it indexes.
 *
 * **When to use**
 *
 * Use for single-column indexes so the intent lives on the column instead of
 * a table-extras callback; keep the callback for multi-column indexes.
 *
 * **Details**
 *
 * Model construction harvests the intent into an ordinary index node named
 * `{table}_{column}_btree_idx` (respecting `columnName` overrides), before any
 * kit or model extras callback runs. Pass `name` to pin a legacy index name
 * the derivation cannot reproduce.
 *
 * **Example** (Colocate an index on a column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { index, text } from "@beep/effect-drizzle/sqlite"
 *
 * const field = String.pipe(text(), index())
 * field.meta.indexed // => { name: undefined, unique: false }
 * ```
 *
 * @see {@link uniqueIndex} for the unique-index form.
 * @category combinators
 * @since 0.0.0
 */
export const index =
  (options?: { readonly name?: string }) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: false } }> => {
    if (options?.name !== undefined) assertSqlName(options.name, "sqlite", "SQLite index name");
    return Field.patch(input, { indexed: { name: options?.name, unique: false } });
  };

/**
 * Colocate a single-column unique index with the field it constrains.
 *
 * **When to use**
 *
 * Use when DDL compatibility requires a named unique index rather than the
 * inline `unique()` column constraint, and the index covers one column.
 *
 * **Details**
 *
 * Model construction harvests the intent into a unique-index node named
 * `{table}_{column}_unique_idx` (respecting `columnName` overrides). Pass
 * `name` to pin a legacy index name the derivation cannot reproduce.
 *
 * **Example** (Colocate a unique index on a column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { text, uniqueIndex } from "@beep/effect-drizzle/sqlite"
 *
 * const field = String.pipe(text(), uniqueIndex())
 * field.meta.indexed // => { name: undefined, unique: true }
 * ```
 *
 * @see {@link index} for the non-unique form.
 * @see {@link unique} for the inline unique column constraint.
 * @category combinators
 * @since 0.0.0
 */
export const uniqueIndex =
  (options?: { readonly name?: string }) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly indexed: { readonly name: string | undefined; readonly unique: true } }> => {
    if (options?.name !== undefined) assertSqlName(options.name, "sqlite", "SQLite index name");
    return Field.patch(input, { indexed: { name: options?.name, unique: true } });
  };

type ValidateRowidKey<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
    ? unknown
    : Field.SqlTypeError<"autoIncrement() requires sqlite.integer number mode">;

/**
 * Declares an `INTEGER PRIMARY KEY AUTOINCREMENT` value assigned by SQLite.
 *
 * **When to use**
 *
 * Use with SQLite rowid-backed surrogate keys. Ordinary primary keys should use
 * `primaryKey()` without database assignment.
 *
 * **Details**
 *
 * The field becomes primary, insert-optional, and identity-by-default in one
 * correlated metadata change.
 *
 * **Gotchas**
 *
 * SQLite requires number-mode `integer()` and does not support PostgreSQL's
 * separate identity-always policy.
 *
 * **Example** (Declare a database-assigned key)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { autoIncrement, integer } from "@beep/effect-drizzle/sqlite"
 * Int.pipe(integer(), autoIncrement()).meta.identity // => "byDefault"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const autoIncrement =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateNonNullable<I, "autoIncrement() forbids a nullable schema"> &
      ValidateRowidKey<I> &
      ValidateNotDefaulted<I> &
      ValidateNotGenerated<I> &
      ValidateNotVersion<I>
  ): Field.Patched<
    I,
    {
      readonly primaryKey: true;
      readonly identity: "byDefault";
      readonly hasDefault: true;
    }
  > =>
    Field.patch(input, { primaryKey: true, identity: "byDefault", hasDefault: true });

type ValidateDefaultValue<I extends Field.Input, Value> = [Value] extends [Exclude<Field.EncodedOf<I>, null>]
  ? unknown
  : Field.SqlTypeError<"default() value must match the field's encoded carrier">;
type ValidateExpression<I extends Field.Input, Carrier> = [Carrier] extends [Exclude<Field.EncodedOf<I>, null>]
  ? [Exclude<Field.EncodedOf<I>, null>] extends [Carrier]
    ? unknown
    : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">
  : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">;

/**
 * Sets a literal SQL default that matches the encoded carrier.
 *
 * **Details**
 *
 * The insert variant becomes optional while selected and update values retain
 * the schema's encoded type. Model construction validates the literal against
 * the complete encoded schema and SQLite representation. Non-finite numbers,
 * NUL text, and unproven BLOB literals are rejected; `unsafeDefaultSql` is the
 * explicit escape for a trusted SQL spelling.
 *
 * **Example** (Default a status)
 *
 * ```ts
 * import { Literals } from "effect/Schema"
 * import { default as defaultValue } from "@beep/effect-drizzle/sqlite"
 *
 * Literals(["draft", "active"]).pipe(defaultValue("draft")).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const default_ =
  <const Value>(value: Value) =>
  <I extends Field.Input>(
    input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "value", value }, hasDefault: true });
/** Named export for the SQLite literal-default combinator.
 * @category combinators
 * @since 0.0.0
 */
export { default_ as default };

/**
 * Sets a typed SQLite expression default with carrier equality checking.
 *
 * **When to use**
 *
 * Use when the database, rather than the application constructor, should
 * compute an insert default and a typed Drizzle expression is available.
 *
 * **Gotchas**
 *
 * Schema expressions must render with zero parameters. Carrier typing does not
 * prove SQLite's constant-expression rules; column references and other deeper
 * semantics remain database-checked.
 *
 * **Example** (Default from an expression)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { defaultExpr } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(defaultExpr(sql<string>`lower('A')`)).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultExpr =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.DefaultSqlExpr<Carrier>; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "sqlExpr", expression }, hasDefault: true });

type ValidateTimestampText<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends SqliteColumn.Text<"text">
    ? unknown
    : Field.SqlTypeError<"defaultNow() requires sqlite.text string storage">;

/**
 * Sets SQLite's current time as an ISO-text database default.
 *
 * **When to use**
 *
 * Use when SQLite is the single authority for an insert timestamp.
 *
 * **Gotchas**
 *
 * Do not combine this database clock with an Effect model constructor default
 * for the same field; two clocks can produce inconsistent values.
 *
 * **Example** (Default an ISO timestamp)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { defaultNow, text } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(text(), defaultNow()).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultNow =
  () =>
  <I extends Field.Input>(
    input: I & ValidateTimestampText<I> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.DefaultNow; readonly hasDefault: true }> =>
    Field.patch(input, { default: Meta.Default.now(), hasDefault: true });

/**
 * Sets an explicitly unsafe raw SQLite default.
 *
 * **When to use**
 *
 * Use when only trusted raw SQL can represent the default.
 *
 * **Gotchas**
 *
 * The string bypasses carrier checking, parameterization, and escaping.
 *
 * **Example** (Use a trusted SQLite expression)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeDefaultSql } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(unsafeDefaultSql("lower('A')")).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeDefaultSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.UnsafeDefaultSql; readonly hasDefault: true }> =>
    Field.patch(input, { default: Meta.Default.unsafeSql({ sql }), hasDefault: true });
type ValidateVersionColumn<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
    ? unknown
    : Field.SqlTypeError<"version() requires sqlite.integer number mode">;
type ValidateVersionCompatibility<I extends Field.Input> = Field.MetaFrom<I>["identity"] extends false
  ? Field.MetaFrom<I>["generated"] extends false
    ? unknown
    : Field.SqlTypeError<"version fields cannot be generated">
  : Field.SqlTypeError<"version fields cannot use db-assigned key generation">;
type ValidateVersionSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SqlTypeError<"version() cannot own an explicit VariantSchema.Field">
    : unknown;

/**
 * Marks one number-mode integer as the optimistic concurrency token.
 *
 * **Details**
 *
 * The field is optional on insert, required on update, and interpreted as the
 * expected version by the optimistic repository.
 *
 * **Gotchas**
 *
 * Update payloads must include the current value. Explicit variant fields are
 * rejected; version fields also cannot be generated or database-assigned keys.
 *
 * **Example** (Declare a row version)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { integer, version } from "@beep/effect-drizzle/sqlite"
 *
 * Int.pipe(integer(), version()).meta.version // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const version =
  () =>
  <I extends Field.Input>(
    input: I &
      ValidateVersionColumn<I> &
      ValidateVersionCompatibility<I> &
      ValidateVersionSchema<I> &
      Field.ValidateNonNullable<I, "version() forbids a nullable schema">
  ): Field.Patched<I, { readonly version: true }> => {
    const field = Field.from(input);
    if (VariantSchema.isField(field.schema)) {
      throw ModelInvariantError.make({
        message: "version() cannot own an explicit VariantSchema.Field.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    if (isNullable(field.schema)) {
      throw ModelInvariantError.make({
        message: "version() forbids a nullable schema.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    if (
      field.meta.column === undefined ||
      !SqliteColumn.isSpec(field.meta.column) ||
      !SqliteColumn.Spec.guards.integer(field.meta.column) ||
      field.meta.column.mode !== "number"
    ) {
      throw ModelInvariantError.make({
        message: "version() requires sqlite.integer number mode.",
        fieldName: "(unknown — set at model definition)",
      });
    }
    return Field.patch(input, { version: true });
  };

/**
 * Sets a typed stored generated expression omitted from author writes.
 *
 * **Details**
 *
 * The expression carrier must equal the field's encoded carrier. The field
 * remains in selected and JSON rows but disappears from insert and update.
 *
 * **Gotchas**
 *
 * Schema expressions must render with zero parameters. BSL does not analyze
 * determinism or SQLite's generated-expression grammar; DDL application is the
 * semantic check.
 *
 * **Example** (Generate a normalized value)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { generated } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(generated(sql<string>`lower(name)`)).meta.generated._tag // => "sqlExpr"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const generated =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I> & ValidateNotVersion<I>
  ): Field.Patched<I, { readonly generated: Meta.GeneratedSqlExpr<Carrier> }> =>
    Field.patch(input, { generated: { _tag: "sqlExpr", expression } });

/**
 * Sets an explicitly unsafe stored generated expression.
 *
 * **When to use**
 *
 * Use when only trusted raw SQL can represent the generated expression.
 *
 * **Gotchas**
 *
 * The raw statement bypasses carrier checking and escaping.
 *
 * **Example** (Generate from trusted SQL)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeGeneratedSql } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(unsafeGeneratedSql("lower(name)")).meta.generated._tag // => "unsafeSql"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeGeneratedSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotDefaulted<I> & ValidateNotVersion<I>
  ): Field.Patched<I, { readonly generated: Meta.UnsafeGeneratedSql }> =>
    Field.patch(input, { generated: Meta.Generated.unsafeSql({ sql }) });

/**
 * Overrides the physical SQLite column name while preserving the field key.
 *
 * **When to use**
 *
 * Use with legacy schemas or names that differ from the default snake-case policy.
 *
 * **Example** (Choose a physical name)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { columnName } from "@beep/effect-drizzle/sqlite"
 *
 * String.pipe(columnName("display_name")).meta.columnName // => "display_name"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const columnName =
  <const Name extends string>(
    name: Name & ValidateSqlName<Name, "sqlite.columnName requires a lowercase SQL identifier">
  ) =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly columnName: Name }> => {
    assertSqlName(name, "sqlite", "SQLite column name");
    const resolvedName: Name = name;
    return Field.patch(input, { columnName: resolvedName });
  };

/**
 * Attaches a foreign-key target derived from EntityId statics.
 *
 * **Details**
 *
 * The target table comes from `tableName`, the target column is `id`, and
 * delete/update actions remain optional policy.
 *
 * **Gotchas**
 *
 * Assembly compares SQLite storage identity and encoded carrier, so two
 * number-like fields with different EntityId identities do not silently match.
 * `SET NULL` requires a nullable encoded source; `SET DEFAULT` requires a
 * declared database default. The chosen default must still reference a live
 * target row when the action executes.
 *
 * **Example** (Inspect a reference target)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { references } from "@beep/effect-drizzle/sqlite"
 *
 * const OrganizationId = Object.assign(Int.annotate({ identifier: "OrganizationId" }), {
 *   tableName: "organization",
 *   entityType: "Organization"
 * })
 * Int.pipe(references(OrganizationId)).meta.references?.tableName // => "organization"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
type ReferenceOptions = { readonly onDelete?: Meta.FkAction; readonly onUpdate?: Meta.FkAction };
type HasReferenceAction<Options, Action extends Meta.FkAction> = Options extends
  | { readonly onDelete: Action }
  | { readonly onUpdate: Action }
  ? true
  : false;
type ValidateReferenceActions<I extends Field.Input, Options> =
  HasReferenceAction<Options, "set null"> extends false
    ? HasReferenceAction<Options, "set default"> extends false
      ? unknown
      : Field.MetaFrom<I>["hasDefault"] extends true
        ? unknown
        : Field.SqlTypeError<"SET DEFAULT references require a declared database default">
    : null extends Field.EncodedOf<I>
      ? HasReferenceAction<Options, "set default"> extends false
        ? unknown
        : Field.MetaFrom<I>["hasDefault"] extends true
          ? unknown
          : Field.SqlTypeError<"SET DEFAULT references require a declared database default">
      : Field.SqlTypeError<"SET NULL references require a nullable encoded schema">;

/** Attaches a foreign-key target and referential actions to a field.
 * @category combinators
 * @since 0.0.0
 */
export function references<
  const Id extends EntityIdLike,
  const Options extends ReferenceOptions | undefined = undefined,
>(
  ...args: readonly [id: Id, options?: Options]
): <I extends Field.Input>(
  input: I & ValidateReferenceActions<NoInfer<I>, Options>
) => Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id"> }>;
export function references(...args: readonly [id: EntityIdLike, options?: ReferenceOptions]): unknown {
  const [id, options] = args;
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      references: {
        tableName: id.tableName,
        columnName: "id",
        onDelete: options?.onDelete,
        onUpdate: options?.onUpdate,
      },
    });
}
