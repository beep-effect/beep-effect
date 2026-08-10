/** Pipeable SQLite column setters and shared SQL modifiers. */
import type { SQL } from "drizzle-orm";
import { fromUndefinedOr, getOrElse } from "effect/Option";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import * as SqliteColumn from "./Column.ts";
import { DeriveColumnError, isEntityIdLike, stringLiteralValues, type EntityIdLike } from "./derive.ts";

/**
 * Set SQLite TEXT storage in string or JSON mode.
 *
 * **Example** (Store text)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { text } from "@beep/effect-drizzle/sqlite"
 * String.pipe(text())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function text(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "sqlite.text requires a string-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Text<"text"> }>;
export function text(options: { readonly mode: "json" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, object, "sqlite.text({ mode: 'json' }) requires an object-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Text<"json"> }>;
export function text(options?: { readonly mode: "json" }): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: SqliteColumn.Text.make({ mode: options?.mode === "json" ? "json" : "text" }),
    });
}

type IntegerColumn<I extends Field.Input> =
  Field.SchemaFrom<I> extends EntityIdLike & { readonly tableName: infer TableName extends string }
    ? SqliteColumn.Integer<"number", SqliteColumn.EntityIdIdent<TableName>>
    : SqliteColumn.Integer<"number", "integer">;

/**
 * Set SQLite INTEGER storage in an installed Drizzle mode.
 *
 * **Example** (Store an integer)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { integer } from "@beep/effect-drizzle/sqlite"
 * Int.pipe(integer())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function integer(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.integer requires a number-encoded schema">,
) => Field.Patched<I, { readonly column: IntegerColumn<I> }>;
export function integer(options: { readonly mode: "number" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.integer number mode requires a number-encoded schema">,
) => Field.Patched<I, { readonly column: IntegerColumn<I> }>;
export function integer(options: { readonly mode: "boolean" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, boolean, "sqlite.integer boolean mode requires a boolean-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"boolean", "integer"> }>;
export function integer(options: { readonly mode: "timestamp" | "timestamp_ms" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Date, "sqlite.integer timestamp modes require a Date-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Integer<"timestamp" | "timestamp_ms", "integer"> }>;
export function integer(options?: { readonly mode: SqliteColumn.IntegerMode }): unknown {
  return (input: Field.Input): Field.Any => {
    const schema = Field.from(input).schema;
    const mode = getOrElse(fromUndefinedOr(options?.mode), (): "number" => "number");
    const ident: "integer" | SqliteColumn.EntityIdIdent<string> =
      mode === "number" && isEntityIdLike(schema) ? `entityId<"${schema.tableName}">` : "integer";
    return Field.patch(input, { column: SqliteColumn.Integer.make({ mode, ident }) });
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
 * console.log(Finite.pipe(real()).meta.column?.kind) // "real"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const real = () => <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.real requires a number-encoded schema">,
): Field.Patched<I, { readonly column: SqliteColumn.Real }> =>
  Field.patch(input, { column: SqliteColumn.Real.make({}) });

/**
 * Set SQLite BLOB storage in buffer, JSON, or bigint mode.
 *
 * **Example** (Store a bigint as a blob)
 *
 * ```ts
 * import { BigInt } from "effect/Schema"
 * import { blob } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(BigInt.pipe(blob({ mode: "bigint" })).meta.column?.kind) // "blob"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function blob(options: { readonly mode: "buffer" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Uint8Array, "sqlite.blob buffer mode requires a Uint8Array-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"buffer"> }>;
export function blob(options: { readonly mode: "json" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, object, "sqlite.blob json mode requires an object-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"json"> }>;
export function blob(options: { readonly mode: "bigint" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "sqlite.blob bigint mode requires a bigint-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Blob<"bigint"> }>;
export function blob(options: { readonly mode: SqliteColumn.BlobMode }): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, { column: SqliteColumn.Blob.make({ mode: options.mode }) });
}

/**
 * Set SQLite NUMERIC storage in string, number, or bigint mode.
 *
 * **Example** (Preserve a numeric string)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { numeric } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(numeric()).meta.column?.kind) // "numeric"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function numeric(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "sqlite.numeric string mode requires a string-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"string"> }>;
export function numeric(options: { readonly mode: "string" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "sqlite.numeric string mode requires a string-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"string"> }>;
export function numeric(options: { readonly mode: "number" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "sqlite.numeric number mode requires a number-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"number"> }>;
export function numeric(options: { readonly mode: "bigint" }): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "sqlite.numeric bigint mode requires a bigint-encoded schema">,
) => Field.Patched<I, { readonly column: SqliteColumn.Numeric<"bigint"> }>;
export function numeric(options?: { readonly mode: SqliteColumn.NumericMode }): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: SqliteColumn.Numeric.make({
        mode: getOrElse(fromUndefinedOr(options?.mode), (): "string" => "string"),
      }),
    });
}

type ValidateEnum<I extends Field.Input> = [Exclude<Field.EncodedOf<I>, null>] extends [string]
  ? string extends Exclude<Field.EncodedOf<I>, null>
    ? Field.SqlTypeError<"sqlite.enum requires a finite union of encoded string literals">
    : unknown
  : Field.SqlTypeError<"sqlite.enum requires a finite union of encoded string literals">;
type EnumValue<I extends Field.Input> = Extract<Exclude<Field.EncodedOf<I>, null>, string>;

/**
 * Compile a literal string domain to TEXT plus a table-local CHECK.
 *
 * **Example** (Declare a checked domain)
 *
 * ```ts
 * import { Literals } from "effect/Schema"
 * import { enum as sqliteEnum } from "@beep/effect-drizzle/sqlite"
 * Literals(["draft", "active"]).pipe(sqliteEnum())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function enum_(): <I extends Field.Input>(
  input: I & ValidateEnum<I>,
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
 * Mark a non-null field as an inline primary key.
 *
 * **Example** (Declare a text primary key)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { primaryKey, text } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(text(), primaryKey()).meta.primaryKey) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const primaryKey = () => <I extends Field.Input>(
  input: I & Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema">,
): Field.Patched<I, { readonly primaryKey: true }> => Field.patch(input, { primaryKey: true });

/**
 * Mark a field as uniquely constrained.
 *
 * **Example** (Declare a unique field)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unique } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(unique()).meta.unique) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unique = () => <I extends Field.Input>(input: I): Field.Patched<I, { readonly unique: true }> =>
  Field.patch(input, { unique: true });

type ValidateRowidKey<I extends Field.Input> = Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
  ? unknown
  : Field.SqlTypeError<"autoIncrement() requires sqlite.integer number mode">;

/**
 * Declare an INTEGER PRIMARY KEY AUTOINCREMENT value assigned by SQLite.
 *
 * **Example** (Declare a database-assigned key)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { autoIncrement, integer } from "@beep/effect-drizzle/sqlite"
 * Int.pipe(integer(), autoIncrement())
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const autoIncrement = () => <I extends Field.Input>(
  input: I &
    Field.ValidateNonNullable<I, "autoIncrement() forbids a nullable schema"> &
    ValidateRowidKey<I> & ValidateNotDefaulted<I> & ValidateNotGenerated<I> & ValidateNotVersion<I>,
): Field.Patched<I, {
  readonly primaryKey: true;
  readonly identity: "byDefault";
  readonly hasDefault: true;
}> => Field.patch(input, { primaryKey: true, identity: "byDefault", hasDefault: true });

type ValidateDefaultValue<I extends Field.Input, Value> = [Value] extends [Exclude<Field.EncodedOf<I>, null>]
  ? unknown
  : Field.SqlTypeError<"default() value must match the field's encoded carrier">;
type ValidateExpression<I extends Field.Input, Carrier> = [Carrier] extends [Exclude<Field.EncodedOf<I>, null>]
  ? [Exclude<Field.EncodedOf<I>, null>] extends [Carrier]
    ? unknown
    : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">
  : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">;

/**
 * Set a literal SQL default and make the insert field optional.
 *
 * **Example** (Default a status)
 *
 * ```ts
 * import { Literals } from "effect/Schema"
 * import { default as defaultValue } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(Literals(["draft", "active"]).pipe(defaultValue("draft")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const default_ = <const Value>(value: Value) => <I extends Field.Input>(
  input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>,
): Field.Patched<I, { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true }> =>
  Field.patch(input, { default: { _tag: "value", value }, hasDefault: true });
export { default_ as default };

/**
 * Set a typed SQLite expression default.
 *
 * **Example** (Default from an expression)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { defaultExpr } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(defaultExpr(sql<string>`lower('A')`)).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultExpr = <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(
  input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>,
): Field.Patched<I, { readonly default: Meta.DefaultSqlExpr<Carrier>; readonly hasDefault: true }> =>
  Field.patch(input, { default: { _tag: "sqlExpr", expression }, hasDefault: true });

type ValidateTimestampText<I extends Field.Input> = Field.MetaFrom<I>["column"] extends SqliteColumn.Text<"text">
  ? unknown
  : Field.SqlTypeError<"defaultNow() requires sqlite.text string storage">;

/**
 * Set SQLite's current time as an ISO-text default.
 *
 * **Example** (Default an ISO timestamp)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { defaultNow, text } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(text(), defaultNow()).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultNow = () => <I extends Field.Input>(
  input: I & ValidateTimestampText<I> & ValidateNotGenerated<I>,
): Field.Patched<I, { readonly default: Meta.DefaultNow; readonly hasDefault: true }> =>
  Field.patch(input, { default: Meta.Default.now(), hasDefault: true });

/**
 * Set an explicitly unsafe raw SQLite default.
 *
 * **Example** (Use a trusted SQLite expression)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeDefaultSql } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(unsafeDefaultSql("lower('A')")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeDefaultSql = (sql: string) => <I extends Field.Input>(
  input: I & ValidateNotGenerated<I>,
): Field.Patched<I, { readonly default: Meta.UnsafeDefaultSql; readonly hasDefault: true }> =>
  Field.patch(input, { default: Meta.Default.unsafeSql({ sql }), hasDefault: true });
/**
 * Alias for {@link unsafeDefaultSql}.
 *
 * **Example** (Use the compatibility alias)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { defaultSql } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(defaultSql("lower('A')")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultSql = unsafeDefaultSql;

type ValidateVersionColumn<I extends Field.Input> = Field.MetaFrom<I>["column"] extends SqliteColumn.Integer<"number">
  ? unknown
  : Field.SqlTypeError<"version() requires sqlite.integer number mode">;
type ValidateVersionCompatibility<I extends Field.Input> = Field.MetaFrom<I>["identity"] extends false
  ? Field.MetaFrom<I>["generated"] extends false ? unknown : Field.SqlTypeError<"version fields cannot be generated">
  : Field.SqlTypeError<"version fields cannot use db-assigned key generation">;

/**
 * Mark one number-mode integer as the optimistic version.
 *
 * **Example** (Declare a row version)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { integer, version } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(Int.pipe(integer(), version()).meta.version) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const version = () => <I extends Field.Input>(
  input: I & ValidateVersionColumn<I> & ValidateVersionCompatibility<I>,
): Field.Patched<I, { readonly version: true }> => Field.patch(input, { version: true });

/**
 * Set a typed SQLite generated expression.
 *
 * **Example** (Generate a normalized value)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { generated } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(generated(sql<string>`lower(name)`)).meta.generated)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const generated = <Carrier>(expression: SQL<Carrier>) => <I extends Field.Input>(
  input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I> & ValidateNotVersion<I>,
): Field.Patched<I, { readonly generated: Meta.GeneratedSqlExpr<Carrier> }> =>
  Field.patch(input, { generated: { _tag: "sqlExpr", expression } });

/**
 * Set an explicitly unsafe raw generated expression.
 *
 * **Example** (Generate from trusted SQL)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeGeneratedSql } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(unsafeGeneratedSql("lower(name)")).meta.generated)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeGeneratedSql = (sql: string) => <I extends Field.Input>(
  input: I & ValidateNotDefaulted<I> & ValidateNotVersion<I>,
): Field.Patched<I, { readonly generated: Meta.UnsafeGeneratedSql }> =>
  Field.patch(input, { generated: Meta.Generated.unsafeSql({ sql }) });

/**
 * Override the physical SQLite column name.
 *
 * **Example** (Choose a physical name)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { columnName } from "@beep/effect-drizzle/sqlite"
 *
 * console.log(String.pipe(columnName("display_name")).meta.columnName) // "display_name"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const columnName = <const Name extends string>(name: Name) => <I extends Field.Input>(
  input: I,
): Field.Patched<I, { readonly columnName: Name }> => Field.patch(input, { columnName: name });

/**
 * Attach an EntityId-derived foreign-key reference.
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
 * console.log(Int.pipe(references(OrganizationId)).meta.references?.tableName) // "organization"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const references = <const Id extends EntityIdLike>(
  id: Id,
  options?: { readonly onDelete?: Meta.FkAction; readonly onUpdate?: Meta.FkAction },
) => <I extends Field.Input>(
  input: I,
): Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id"> }> =>
  Field.patch(input, {
    references: {
      tableName: id.tableName,
      columnName: "id",
      onDelete: options?.onDelete,
      onUpdate: options?.onUpdate,
    },
  });
