/**
 * Postgres combinators.
 *
 * Every combinator is parameter-constrained: an incompatible schema fails to
 * satisfy the input intersection, so the compile error lands AT the pipe
 * callsite with a readable `~bsl.error` message — not downstream where the
 * field gets used. All combinators funnel through `Field.patch`, the single
 * audited merge seam.
 *
 * Usage: `S.NonEmptyString.pipe(pg.varchar(320), pg.unique())`.
 */
import type { SQL } from "drizzle-orm";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import type * as PgColumn from "./PgColumn.ts";
import { DeriveColumnError, isEntityIdLike, maxLengths, type EntityIdLike } from "./derive.ts";

// ---------------------------------------------------------------------------
// Column setters
// ---------------------------------------------------------------------------

export const text =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.text requires a string-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Text }> =>
    Field.patch(input, { column: { kind: "text", ident: "text" } });

/**
 * Varchar column with three authoring modes, so the length is written exactly
 * once:
 *
 * - `pg.varchar()` — DERIVE: the length comes from the schema's `isMaxLength`
 *   check (tightest bound wins); no check is a loud construction error.
 * - `pg.varchar(n)` on a schema WITH a maxLength `m` — VERIFY: `m ≤ n` passes,
 *   `m > n` fails at model construction (column would truncate).
 * - `pg.varchar(n)` on a plain schema WITHOUT one — INJECT: the field's schema
 *   gains `S.check(S.isMaxLength(n))`, so the domain validates exactly what
 *   the column enforces. Variant-field inputs are verify-only (their per-variant
 *   codecs are author-owned).
 */
export const varchar: {
  (): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Varchar<number> }>;
  <const L extends number>(length: L): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Varchar<L> }>;
} =
  (length?: number) =>
  (input: Field.Input): never => {
    const f = Field.from(input);
    const bounds = maxLengths(f.schema);
    const spec = (resolved: number): PgColumn.Varchar => ({ kind: "varchar", ident: "varchar", length: resolved });
    if (length === undefined) {
      if (bounds.length === 0) {
        throw DeriveColumnError.make({
          message:
            "pg.varchar() derive mode requires an isMaxLength check on the schema; add one or pass an explicit length.",
          fieldName: "(unknown — set at model definition)",
          astTag: "(checks)",
        });
      }
      // Audited boundary: the overload impl returns `never`-typed; each branch
      // constructs exactly the declared Patched shape for its overload.
      return Field.patch(f, { column: spec(Math.min(...bounds)) }) as never;
    }
    if (bounds.length === 0 && !VariantSchema.isField(f.schema)) {
      // Audited boundary: ValidateEncoded proved the schema is string-encoded,
      // so its Type has `length`; S.Top erases that to `unknown`, which the
      // contravariant Check parameter cannot accept without help.
      const evolved = f.schema.check(S.isMaxLength(length) as AST.Check<unknown>);
      return Field.make(evolved, Meta.merge(f.meta, { column: spec(length) })) as never;
    }
    return Field.patch(f, { column: spec(length) }) as never;
  };

export const uuid =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.uuid requires a string-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Uuid }> =>
    Field.patch(input, { column: { kind: "uuid", ident: "uuid" } });

type IntegerColumn<I extends Field.Input> = Field.SchemaFrom<I> extends EntityIdLike & {
  readonly tableName: infer TableName extends string;
}
  ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
  : PgColumn.Integer;

export const integer =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.integer requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: IntegerColumn<I> }> => {
    const schema = Field.from(input).schema;
    const ident: "integer" | PgColumn.EntityIdIdent<string> = isEntityIdLike(schema)
      ? `entityId<"${schema.tableName}">`
      : "integer";
    // Audited boundary: the runtime EntityIdLike guard mirrors IntegerColumn's
    // structural tableName branch and constructs the corresponding literal.
    return Field.patch(input, { column: { kind: "integer", ident } }) as unknown as Field.Patched<
      I,
      { readonly column: IntegerColumn<I> }
    >;
  };

export const smallint =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.smallint requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Smallint }> =>
    Field.patch(input, { column: { kind: "smallint", ident: "smallint" } });

export const doublePrecision =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.doublePrecision requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.DoublePrecision }> =>
    Field.patch(input, { column: { kind: "doublePrecision", ident: "doublePrecision" } });

/** Bigint column; the mode decides the required encoded carrier (number vs bigint). */
export const bigint: {
  (mode: "number"): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.bigint('number') requires a number-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Bigint<"number"> }>;
  (mode: "bigint"): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, bigint, "pg.bigint('bigint') requires a bigint-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Bigint<"bigint"> }>;
} =
  (mode: "number" | "bigint") =>
  (input: Field.Input): any =>
    Field.patch(input, { column: { kind: "bigint", ident: "bigint", mode } });

export const serial =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.serial requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Serial; readonly hasDefault: true }> =>
    Field.patch(input, { column: { kind: "serial", ident: "integer" }, hasDefault: true });

export const boolean =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, boolean, "pg.boolean requires a boolean-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Bool }> =>
    Field.patch(input, { column: { kind: "boolean", ident: "boolean" } });

export const jsonb =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, object, "pg.jsonb requires an object- or array-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Jsonb }> =>
    Field.patch(input, { column: { kind: "jsonb", ident: "jsonb" } });

export const bytea =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, Uint8Array, "pg.bytea requires a Uint8Array-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Bytea }> =>
    Field.patch(input, { column: { kind: "bytea", ident: "bytea" } });

/** Timestamp column; the mode decides the required encoded carrier (string vs Date). */
export const timestamp: {
  <const TZ extends boolean = true>(options?: { readonly mode?: "string"; readonly withTimezone?: TZ }): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.timestamp (string mode) requires a string-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"string", TZ> }>;
  <const TZ extends boolean = true>(options: { readonly mode: "date"; readonly withTimezone?: TZ }): <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, Date, "pg.timestamp (date mode) requires a Date-encoded schema">
  ) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"date", TZ> }>;
} =
  (options?: { readonly mode?: "string" | "date"; readonly withTimezone?: boolean }) =>
  (input: Field.Input): any =>
    Field.patch(input, {
      column: {
        kind: "timestamp",
        ident: options?.withTimezone === false ? "timestamp" : "timestamptz",
        mode: options?.mode ?? "string",
        withTimezone: options?.withTimezone ?? true,
      },
    });

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

export const primaryKey =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema — a primary key cannot admit null">
  ): Field.Patched<I, { readonly primaryKey: true }> =>
    Field.patch(input, { primaryKey: true });

export const unique =
  () =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly unique: true }> =>
    Field.patch(input, { unique: true });

type ValidateIdentity<I extends Field.Input> = Field.MetaFrom<I>["column"] extends {
  readonly kind: PgColumn.IdentityKind;
}
  ? unknown
  : Field.BslTypeError<"identity() requires an explicit integer-family column first (pg.integer/pg.smallint/pg.bigint) — bare number schemas derive doublePrecision">;

type ValidateNotGenerated<I extends Field.Input> = Field.MetaFrom<I>["generated"] extends false
  ? unknown
  : Field.BslTypeError<"default and generated are mutually exclusive">;

type ValidateNotDefaulted<I extends Field.Input> = Field.MetaFrom<I>["hasDefault"] extends false
  ? unknown
  : Field.BslTypeError<"default and generated are mutually exclusive">;

/** Postgres `GENERATED ... AS IDENTITY`. Requires an integer-family column already set. */
export const identity =
  <const K extends "always" | "byDefault" = "always">(kind?: K) =>
  <I extends Field.Input>(
    input: I & ValidateIdentity<I> & ValidateNotDefaulted<I> & ValidateNotGenerated<I>
  ): Field.Patched<
    I,
    K extends "always"
      ? { readonly identity: K; readonly generated: Meta.Generated.IdentityAlways }
      : { readonly identity: K; readonly hasDefault: true; readonly generated: false }
  > => {
    const resolved = kind ?? "always";
    // Audited boundary: the literal branch constructs exactly the conditional
    // patch above; TypeScript cannot narrow a generic K from the runtime value.
    return Field.patch(
      input,
      resolved === "always"
        ? { identity: resolved, generated: { _tag: "identityAlways" } }
        : { identity: resolved, hasDefault: true, generated: false }
    ) as unknown as Field.Patched<
      I,
      K extends "always"
        ? { readonly identity: K; readonly generated: Meta.Generated.IdentityAlways }
        : { readonly identity: K; readonly hasDefault: true; readonly generated: false }
    >;
  };

type ValidateDefaultValue<I extends Field.Input, Value> = [Value] extends [Exclude<Field.EncodedOf<I>, null>]
  ? unknown
  : Field.BslTypeError<"default() value must match the field's encoded carrier">;

type ValidateExpression<I extends Field.Input, Carrier> = [Carrier] extends [Exclude<Field.EncodedOf<I>, null>]
  ? [Exclude<Field.EncodedOf<I>, null>] extends [Carrier]
    ? unknown
    : Field.BslTypeError<"SQL expression carrier must equal the field's encoded carrier">
  : Field.BslTypeError<"SQL expression carrier must equal the field's encoded carrier">;

/** Typed literal default; the value must match the encoded database carrier. */
export const default_ =
  <const Value>(value: Value) =>
  <I extends Field.Input>(
    input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.Default.Value<Value>; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "value", value }, hasDefault: true });

export { default_ as default };

/** Typed SQL default expression. */
export const defaultExpr =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.Default.SqlExpr<Carrier>; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "sqlExpr", expression }, hasDefault: true });

type ValidateTimestamp<I extends Field.Input> = Field.MetaFrom<I>["column"] extends PgColumn.Timestamp
  ? unknown
  : Field.BslTypeError<"defaultNow() requires an explicit pg.timestamp column first">;

/** PostgreSQL current-time default; only valid after `pg.timestamp(...)`. */
export const defaultNow =
  () =>
  <I extends Field.Input>(
    input: I & ValidateTimestamp<I> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.Default.Now; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "now" }, hasDefault: true });

/** Explicit raw-SQL escape hatch for defaults. */
export const unsafeDefaultSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.Default.UnsafeSql; readonly hasDefault: true }> =>
    Field.patch(input, { default: { _tag: "unsafeSql", sql }, hasDefault: true });

/** @deprecated Use the explicitly unsafe-named {@link unsafeDefaultSql}. */
export const defaultSql = unsafeDefaultSql;

/** Typed stored generated expression; omitted from insert and update variants. */
export const generated =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I>
  ): Field.Patched<I, { readonly generated: Meta.Generated.SqlExpr<Carrier> }> =>
    Field.patch(input, { generated: { _tag: "sqlExpr", expression } });

/** Explicit raw-SQL escape hatch for stored generated expressions. */
export const unsafeGeneratedSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotDefaulted<I>
  ): Field.Patched<I, { readonly generated: Meta.Generated.UnsafeSql }> =>
    Field.patch(input, { generated: { _tag: "unsafeSql", sql } });

/** Physical column-name override — the exception, not the rule (keys derive snake_case). */
export const columnName =
  <const N extends string>(name: N) =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly columnName: N }> =>
    Field.patch(input, { columnName: name });

/**
 * Foreign key to another entity, read from its EntityId statics — the
 * reference target needs zero extra spelling beyond the action policy.
 */
export const references =
  <const Id extends EntityIdLike>(
    id: Id,
    options?: { readonly onDelete?: Meta.FkAction; readonly onUpdate?: Meta.FkAction }
  ) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id"> }> => {
    const ref: Meta.References<Id["tableName"], "id"> = {
      tableName: id.tableName,
      columnName: "id",
      onDelete: options?.onDelete,
      onUpdate: options?.onUpdate,
    };
    return Field.patch(input, { references: ref });
  };
