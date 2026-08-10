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
import { Match } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import * as PgColumn from "./PgColumn.ts";
import {
  DeriveColumnError,
  isEntityIdLike,
  maxLengths,
  stringLiteralValues,
  type EntityIdLike,
} from "./derive.ts";
import { thunkTrue, thunkFalse } from "@beep/utils";

// ---------------------------------------------------------------------------
// Column setters
// ---------------------------------------------------------------------------

const isStringTypeAst = (
  node: AST.AST,
  visited: ReadonlyArray<AST.Suspend> = A.empty()
): boolean =>
  Match.type<AST.AST>().pipe(
    Match.tags({
      String: thunkTrue,
      TemplateLiteral: thunkTrue,
      Literal: ({ literal }) => P.isString(literal),
      Enum: ({ enums }) => A.every(enums, ([, value]) => P.isString(value)),
      Union: ({ types }) =>
        A.every(types, (member) => isStringTypeAst(member, visited)),
      Suspend: (suspend) =>
        A.some(visited, Eq.equals(suspend))
          ? false
          : isStringTypeAst(suspend.thunk(), A.append(visited, suspend)),
    }),
    Match.orElse(thunkFalse)
  )(node);

const isStringTypeSchema = (schema: S.Top): schema is S.Schema<string> =>
  isStringTypeAst(AST.toType(schema.ast));

/**
 * Set an unbounded PostgreSQL text column on a string-encoded schema.
 *
 * **Example** (Set a text column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { text } from "./pg.ts"
 *
 * const field = S.String.pipe(text())
 * console.log(field.meta.column?.kind) // "text"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const text =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        string,
        "pg.text requires a string-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Text }> =>
    Field.patch(input, { column: PgColumn.Text.make({}) });

const boundedString = (
  input: Field.Input,
  length: number | undefined,
  kind: "varchar" | "char",
  spec: (length: number) => PgColumn.Varchar | PgColumn.Char
): Field.Any => {
  const f = Field.from(input);
  const bounds = maxLengths(f.schema);
  return O.match(O.fromUndefinedOr(length), {
    onNone: () =>
      A.match(bounds, {
        onEmpty: () => {
          throw DeriveColumnError.make({
            message: `pg.${kind}() derive mode requires an isMaxLength check on the schema; add one or pass an explicit length.`,
            fieldName: "(unknown — set at model definition)",
            astTag: "(checks)",
          });
        },
        onNonEmpty: (nonEmptyBounds) =>
          Field.patch(f, {
            column: spec(A.min(nonEmptyBounds, N.Order)),
          }),
      }),
    onSome: (resolvedLength) => {
      if (A.isReadonlyArrayEmpty(bounds) && !VariantSchema.isField(f.schema)) {
        const encodedSchema = S.flip(f.schema);
        if (!isStringTypeSchema(encodedSchema)) {
          throw DeriveColumnError.make({
            message: `pg.${kind}(length) can inject isMaxLength only when the encoded schema is string-valued.`,
            fieldName: "(unknown — set at model definition)",
            astTag: AST.toType(encodedSchema.ast)._tag,
          });
        }
        const evolved = S.flip(
          encodedSchema.check(S.isMaxLength(resolvedLength))
        );
        return Field.make(
          evolved,
          Meta.merge(f.meta, { column: spec(resolvedLength) })
        );
      }
      return Field.patch(f, { column: spec(resolvedLength) });
    },
  });
};

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
 *
 * **Example** (Derive varchar length)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { varchar } from "./pg.ts"
 *
 * const field = S.String.check(S.isMaxLength(320)).pipe(varchar())
 * console.log(field.meta.column?.kind) // "varchar"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function varchar(): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.varchar requires a string-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Varchar }>;
export function varchar<const L extends number>(
  length: L
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.varchar requires a string-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Varchar<L> }>;
export function varchar(length?: number): unknown {
  return (input: Field.Input): Field.Any =>
    boundedString(input, length, "varchar", (resolved) =>
      PgColumn.Varchar.make({ length: resolved })
    );
}

type ValidateEnum<I extends Field.Input> = [
  Exclude<Field.EncodedOf<I>, null>
] extends [string]
  ? string extends Exclude<Field.EncodedOf<I>, null>
    ? Field.BslTypeError<"pg.enum requires a finite union of encoded string literals">
    : unknown
  : Field.BslTypeError<"pg.enum requires a finite union of encoded string literals">;

type EnumValue<I extends Field.Input> = Extract<
  Exclude<Field.EncodedOf<I>, null>,
  string
>;

/**
 * Set a real PostgreSQL enum column whose values come from the encoded schema.
 *
 * **Details**
 *
 * Omitting the name derives it from the declaring model field key. A broad
 * string schema is rejected because PostgreSQL enum values must be finite.
 *
 * **Example** (Set a named enum)
 *
 * ```ts
 * import { LiteralKit } from "@beep/schema"
 * import { enum as pgEnum } from "./pg.ts"
 *
 * console.log(LiteralKit(["draft", "active"]).pipe(pgEnum("status")).meta.column?.kind)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function enum_(): <I extends Field.Input>(
  input: I & ValidateEnum<I>
) => Field.Patched<I, { readonly column: PgColumn.Enum<"", EnumValue<I>> }>;
export function enum_<const Name extends string>(
  name: Name
): <I extends Field.Input>(
  input: I & ValidateEnum<I>
) => Field.Patched<I, { readonly column: PgColumn.Enum<Name, EnumValue<I>> }>;
export function enum_(name?: string): unknown {
  return (input: Field.Input): Field.Any => {
    const values = O.getOrElse(
      stringLiteralValues(Field.from(input).schema),
      () => {
        throw DeriveColumnError.make({
          message:
            "pg.enum requires a finite non-empty union of encoded string literals.",
          fieldName: "(unknown — set at model definition)",
          astTag: "(encoded literals)",
        });
      }
    );
    const explicitName = O.fromUndefinedOr(name);
    if (O.isSome(explicitName) && !S.is(S.NonEmptyString)(explicitName.value)) {
      throw DeriveColumnError.make({
        message: "pg.enum name must be non-empty when supplied explicitly.",
        fieldName: "(unknown — set at model definition)",
        astTag: "(enum name)",
      });
    }
    const resolvedName = O.getOrElse(explicitName, () => "");
    return Field.patch(input, {
      column: PgColumn.Enum.make({
        ident: `enum<${resolvedName}>`,
        name: resolvedName,
        values,
      }),
    });
  };
}

export { enum_ as enum };

/**
 * Set an explicitly unsafe custom PostgreSQL type with no carrier validation.
 *
 * **Example** (Set a tsvector column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { unsafeCustom } from "./pg.ts"
 *
 * console.log(S.String.pipe(unsafeCustom("tsvector")).meta.column?.ident)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeCustom =
  <const SqlType extends string>(sqlType: SqlType) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly column: PgColumn.Custom<SqlType> }> =>
    Field.patch(input, {
      // Literal construction (not Custom.make): the schema constructor widens
      // `ident` to `custom<${string}>`, losing the SqlType literal this
      // combinator exists to preserve; the annotated return type still checks
      // the record against Custom<SqlType> structurally.
      column: {
        kind: "custom",
        ident: `custom<${sqlType}>`,
        sqlType,
      },
    });

/**
 * Set a string-carried PostgreSQL numeric column.
 *
 * **Example** (Set numeric precision and scale)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { numeric } from "./pg.ts"
 *
 * console.log(S.String.pipe(numeric(10, 2)).meta.column?.kind) // "numeric"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function numeric(): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.numeric requires a string-encoded schema"
    >
) => Field.Patched<
  I,
  { readonly column: PgColumn.Numeric<undefined, undefined> }
>;
export function numeric<const Precision extends number>(
  precision: Precision
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.numeric requires a string-encoded schema"
    >
) => Field.Patched<
  I,
  { readonly column: PgColumn.Numeric<Precision, undefined> }
>;
export function numeric<
  const Precision extends number,
  const Scale extends number
>(
  precision: Precision,
  scale: Scale
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.numeric requires a string-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Numeric<Precision, Scale> }>;
export function numeric(precision?: number, scale?: number): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: PgColumn.Numeric.make({ precision, scale }),
    });
}

/**
 * Set a PostgreSQL date column in string or JavaScript Date mode.
 *
 * **Example** (Set string date mode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { date } from "./pg.ts"
 *
 * console.log(S.String.pipe(date()).meta.column?.kind) // "date"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function date(): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.date (string mode) requires a string-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"string"> }>;
export function date(options: {
  readonly mode: "date";
}): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      Date,
      "pg.date (date mode) requires a Date-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"date"> }>;
export function date(options?: { readonly mode: "date" }): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: PgColumn.DateColumn.make({
        mode: O.match(O.fromUndefinedOr(options), {
          onNone: () => "string",
          onSome: ({ mode }) => mode,
        }),
      }),
    });
}

/**
 * Set a fixed-width PostgreSQL char column with varchar-style length authoring.
 *
 * **Example** (Derive a char length)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { char } from "./pg.ts"
 *
 * console.log(S.String.check(S.isMaxLength(2)).pipe(char()).meta.column?.kind)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function char(): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Char }>;
export function char<const Length extends number>(
  length: Length
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Char<Length> }>;
export function char(length?: number): unknown {
  return (input: Field.Input): Field.Any =>
    boundedString(input, length, "char", (resolved) =>
      PgColumn.Char.make({ length: resolved })
    );
}

/**
 * Set a PostgreSQL JSON column distinct from JSONB.
 *
 * **Example** (Set JSON storage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { json } from "./pg.ts"
 *
 * console.log(S.Struct({ ok: S.Boolean }).pipe(json()).meta.column?.ident)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const json =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        object,
        "pg.json requires an object- or array-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Json }> =>
    Field.patch(input, { column: PgColumn.Json.make({}) });

/**
 * Set a PostgreSQL single-precision real column.
 *
 * **Example** (Set real storage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { real } from "./pg.ts"
 *
 * console.log(S.Number.pipe(real()).meta.column?.ident) // "real"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const real =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.real requires a number-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Real }> =>
    Field.patch(input, { column: PgColumn.Real.make({}) });

/**
 * Set a PostgreSQL bigserial column and mark it defaulted.
 *
 * **Example** (Set number-mode bigserial)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { bigserial } from "./pg.ts"
 *
 * console.log(S.Int.pipe(bigserial("number")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function bigserial(mode: "number"): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      number,
      "pg.bigserial('number') requires a number-encoded schema"
    >
) => Field.Patched<
  I,
  {
    readonly column: PgColumn.Bigserial<"number">;
    readonly hasDefault: true;
  }
>;
export function bigserial(mode: "bigint"): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      bigint,
      "pg.bigserial('bigint') requires a bigint-encoded schema"
    >
) => Field.Patched<
  I,
  {
    readonly column: PgColumn.Bigserial<"bigint">;
    readonly hasDefault: true;
  }
>;
export function bigserial(mode: "number" | "bigint"): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: PgColumn.Bigserial.make({ mode }),
      hasDefault: true,
    });
}

/**
 * Set a PostgreSQL smallserial column and mark it defaulted.
 *
 * **Example** (Set smallserial storage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { smallserial } from "./pg.ts"
 *
 * console.log(S.Int.pipe(smallserial()).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const smallserial =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.smallserial requires a number-encoded schema"
      >
  ): Field.Patched<
    I,
    { readonly column: PgColumn.Smallserial; readonly hasDefault: true }
  > =>
    Field.patch(input, {
      column: PgColumn.Smallserial.make({}),
      hasDefault: true,
    });

/**
 * Set a PostgreSQL UUID column on a string-encoded schema.
 *
 * **Example** (Set a UUID column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { uuid } from "./pg.ts"
 *
 * console.log(S.String.pipe(uuid()).meta.column?.kind) // "uuid"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const uuid =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        string,
        "pg.uuid requires a string-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Uuid }> =>
    Field.patch(input, { column: PgColumn.Uuid.make({}) });

type IntegerColumn<I extends Field.Input> =
  Field.SchemaFrom<I> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
    : PgColumn.Integer;

/**
 * Set a PostgreSQL integer column on a number-encoded schema.
 *
 * **Example** (Set an integer column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { integer } from "./pg.ts"
 *
 * console.log(S.Int.pipe(integer()).meta.column?.kind) // "integer"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const integer = () => {
  function apply<I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.integer requires a number-encoded schema"
      >
  ): Field.Patched<I, { readonly column: IntegerColumn<I> }>;
  function apply(input: Field.Input): Field.Any {
    const schema = Field.from(input).schema;
    const ident: "integer" | PgColumn.EntityIdIdent<string> = isEntityIdLike(
      schema
    )
      ? `entityId<"${schema.tableName}">`
      : "integer";
    return Field.patch(input, { column: PgColumn.Integer.make({ ident }) });
  }
  return apply;
};

/**
 * Set a PostgreSQL smallint column on a number-encoded schema.
 *
 * **Example** (Set a smallint column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { smallint } from "./pg.ts"
 *
 * console.log(S.Int.pipe(smallint()).meta.column?.kind) // "smallint"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const smallint =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.smallint requires a number-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Smallint }> =>
    Field.patch(input, { column: PgColumn.Smallint.make({}) });

/**
 * Set a PostgreSQL double-precision column on a number-encoded schema.
 *
 * **Example** (Set a double-precision column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { doublePrecision } from "./pg.ts"
 *
 * console.log(S.Finite.pipe(doublePrecision()).meta.column?.kind) // "doublePrecision"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const doublePrecision =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.doublePrecision requires a number-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.DoublePrecision }> =>
    Field.patch(input, { column: PgColumn.DoublePrecision.make({}) });

/**
 * Set a bigint column; mode determines the required encoded carrier.
 *
 * **Example** (Set a native-bigint column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { bigint } from "./pg.ts"
 *
 * console.log(S.BigInt.pipe(bigint("bigint")).meta.column?.kind) // "bigint"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function bigint(
  mode: "number"
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      number,
      "pg.bigint('number') requires a number-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Bigint<"number"> }>;
export function bigint(
  mode: "bigint"
): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      bigint,
      "pg.bigint('bigint') requires a bigint-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Bigint<"bigint"> }>;
export function bigint(mode: "number" | "bigint"): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, { column: PgColumn.Bigint.make({ mode }) });
}

/**
 * Set a PostgreSQL serial column and mark it as defaulted.
 *
 * **Example** (Set a serial column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { serial } from "./pg.ts"
 *
 * console.log(S.Int.pipe(serial()).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const serial =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        number,
        "pg.serial requires a number-encoded schema"
      >
  ): Field.Patched<
    I,
    { readonly column: PgColumn.Serial; readonly hasDefault: true }
  > =>
    Field.patch(input, { column: PgColumn.Serial.make({}), hasDefault: true });

/**
 * Set a PostgreSQL boolean column on a boolean-encoded schema.
 *
 * **Example** (Set a boolean column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { boolean } from "./pg.ts"
 *
 * console.log(S.Boolean.pipe(boolean()).meta.column?.kind) // "boolean"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const boolean =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        boolean,
        "pg.boolean requires a boolean-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Bool }> =>
    Field.patch(input, { column: PgColumn.Bool.make({}) });

/**
 * Set a PostgreSQL JSONB column on an object-encoded schema.
 *
 * **Example** (Set a JSONB column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { jsonb } from "./pg.ts"
 *
 * console.log(S.Struct({ theme: S.String }).pipe(jsonb()).meta.column?.kind) // "jsonb"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const jsonb =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        object,
        "pg.jsonb requires an object- or array-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Jsonb }> =>
    Field.patch(input, { column: PgColumn.Jsonb.make({}) });

/**
 * Set a PostgreSQL bytea column on a Uint8Array-encoded schema.
 *
 * **Example** (Set a bytea column)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { bytea } from "./pg.ts"
 *
 * console.log(S.Uint8Array.pipe(bytea()).meta.column?.kind) // "bytea"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const bytea =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateEncoded<
        I,
        Uint8Array,
        "pg.bytea requires a Uint8Array-encoded schema"
      >
  ): Field.Patched<I, { readonly column: PgColumn.Bytea }> =>
    Field.patch(input, { column: PgColumn.Bytea.make({}) });

/**
 * Set a timestamp column; mode determines the string or Date carrier.
 *
 * **Example** (Set a string timestamp)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { timestamp } from "./pg.ts"
 *
 * console.log(S.String.pipe(timestamp()).meta.column?.kind) // "timestamp"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function timestamp<const TZ extends boolean = true>(options?: {
  readonly mode?: "string";
  readonly withTimezone?: TZ;
}): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      string,
      "pg.timestamp (string mode) requires a string-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"string", TZ> }>;
export function timestamp<const TZ extends boolean = true>(options: {
  readonly mode: "date";
  readonly withTimezone?: TZ;
}): <I extends Field.Input>(
  input: I &
    Field.ValidateEncoded<
      I,
      Date,
      "pg.timestamp (date mode) requires a Date-encoded schema"
    >
) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"date", TZ> }>;
export function timestamp(options?: {
  readonly mode?: "string" | "date";
  readonly withTimezone?: boolean;
}): unknown {
  return (input: Field.Input): Field.Any => {
    const withTimezone = O.getOrElse(
      O.fromUndefinedOr(options?.withTimezone),
      thunkTrue
    );
    return Field.patch(input, {
      column: PgColumn.Timestamp.make({
        ident: withTimezone ? "timestamptz" : "timestamp",
        mode: O.getOrElse(O.fromUndefinedOr(options?.mode), () => "string"),
        withTimezone,
      }),
    });
  };
}

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/**
 * Mark a non-nullable field as the inline primary key.
 *
 * **Example** (Mark a primary key)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { primaryKey } from "./pg.ts"
 *
 * console.log(S.String.pipe(primaryKey()).meta.primaryKey) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const primaryKey =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateNonNullable<
        I,
        "primaryKey() forbids a nullable schema — a primary key cannot admit null"
      >
  ): Field.Patched<I, { readonly primaryKey: true }> =>
    Field.patch(input, { primaryKey: true });

/**
 * Mark a field as carrying a single-column unique constraint.
 *
 * **Example** (Mark a unique field)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { unique } from "./pg.ts"
 *
 * console.log(S.String.pipe(unique()).meta.unique) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unique =
  () =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly unique: true }> =>
    Field.patch(input, { unique: true });

type ValidateIdentity<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends {
    readonly kind: PgColumn.IdentityKind;
  }
    ? unknown
    : Field.BslTypeError<"identity() requires an explicit integer-family column first (pg.integer/pg.smallint/pg.bigint) — bare number schemas derive doublePrecision">;

type ValidateNotGenerated<I extends Field.Input> =
  Field.MetaFrom<I>["generated"] extends false
    ? unknown
    : Field.BslTypeError<"default and generated are mutually exclusive">;

type ValidateNotDefaulted<I extends Field.Input> =
  Field.MetaFrom<I>["hasDefault"] extends false
    ? unknown
    : Field.BslTypeError<"default and generated are mutually exclusive">;

/**
 * Apply PostgreSQL identity generation after an integer-family column setter.
 *
 * **Example** (Apply always identity generation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { identity, integer } from "./pg.ts"
 *
 * console.log(S.Int.pipe(integer(), identity()).meta.identity) // "always"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function identity<const K extends "always" | "byDefault" = "always">(
  kind?: K
): <I extends Field.Input>(
  input: I &
    ValidateIdentity<I> &
    ValidateNotDefaulted<I> &
    ValidateNotGenerated<I>
) => Field.Patched<
  I,
  K extends "always"
    ? { readonly identity: K; readonly generated: Meta.GeneratedIdentityAlways }
    : {
        readonly identity: K;
        readonly hasDefault: true;
        readonly generated: false;
      }
>;
export function identity(kind?: "always" | "byDefault"): unknown {
  return (input: Field.Input): Field.Any => {
    const resolved = O.getOrElse(
      O.fromUndefinedOr(kind),
      Meta.Identity.thunk.always
    );
    return Field.patch(
      input,
      resolved === "always"
        ? {
            identity: resolved,
            generated: Meta.Generated.cases.identityAlways.make({}),
          }
        : { identity: resolved, hasDefault: true, generated: false }
    );
  };
}

type ValidateDefaultValue<I extends Field.Input, Value> = [Value] extends [
  Exclude<Field.EncodedOf<I>, null>
]
  ? unknown
  : Field.BslTypeError<"default() value must match the field's encoded carrier">;

type ValidateExpression<I extends Field.Input, Carrier> = [Carrier] extends [
  Exclude<Field.EncodedOf<I>, null>
]
  ? [Exclude<Field.EncodedOf<I>, null>] extends [Carrier]
    ? unknown
    : Field.BslTypeError<"SQL expression carrier must equal the field's encoded carrier">
  : Field.BslTypeError<"SQL expression carrier must equal the field's encoded carrier">;

/**
 * Set a typed literal default matching the encoded database carrier.
 *
 * **Example** (Set a literal default)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { default as defaultValue } from "./pg.ts"
 *
 * console.log(S.String.pipe(defaultValue("active")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const default_ =
  <const Value>(value: Value) =>
  <I extends Field.Input>(
    input: I & ValidateDefaultValue<I, Value> & ValidateNotGenerated<I>
  ): Field.Patched<
    I,
    { readonly default: Meta.DefaultValue<Value>; readonly hasDefault: true }
  > =>
    Field.patch(input, {
      default: { _tag: "value", value },
      hasDefault: true,
    });

export { default_ as default };

/**
 * Set a typed SQL default expression.
 *
 * **Example** (Set an expression default)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import * as S from "effect/Schema"
 * import { defaultExpr } from "./pg.ts"
 *
 * console.log(S.String.pipe(defaultExpr(sql<string>`'active'`)).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultExpr =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotGenerated<I>
  ): Field.Patched<
    I,
    {
      readonly default: Meta.DefaultSqlExpr<Carrier>;
      readonly hasDefault: true;
    }
  > =>
    Field.patch(input, {
      default: { _tag: "sqlExpr", expression },
      hasDefault: true,
    });

type ValidateTimestamp<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends PgColumn.Timestamp
    ? unknown
    : Field.BslTypeError<"defaultNow() requires an explicit pg.timestamp column first">;

/**
 * Set the PostgreSQL current-time default after a timestamp column setter.
 *
 * **Example** (Set the current-time default)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { defaultNow, timestamp } from "./pg.ts"
 *
 * console.log(S.String.pipe(timestamp(), defaultNow()).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultNow =
  () =>
  <I extends Field.Input>(
    input: I & ValidateTimestamp<I> & ValidateNotGenerated<I>
  ): Field.Patched<
    I,
    { readonly default: Meta.DefaultNow; readonly hasDefault: true }
  > =>
    Field.patch(input, {
      default: Meta.Default.cases.now.make({}),
      hasDefault: true,
    });

/**
 * Set an explicitly unsafe raw-SQL default.
 *
 * **Example** (Set a raw default)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { unsafeDefaultSql } from "./pg.ts"
 *
 * console.log(S.String.pipe(unsafeDefaultSql("current_user")).meta.hasDefault) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeDefaultSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotGenerated<I>
  ): Field.Patched<
    I,
    { readonly default: Meta.UnsafeDefaultSql; readonly hasDefault: true }
  > =>
    Field.patch(input, {
      default: Meta.Default.cases.unsafeSql.make({ sql }),
      hasDefault: true,
    });

/**
 * Compatibility alias for {@link unsafeDefaultSql}.
 *
 * **Example** (Use the compatibility alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { defaultSql } from "./pg.ts"
 *
 * console.log(S.String.pipe(defaultSql("current_user")).meta.hasDefault) // true
 * ```
 *
 * @deprecated Use the explicitly unsafe-named {@link unsafeDefaultSql}.
 * @category combinators
 * @since 0.0.0
 */
export const defaultSql = unsafeDefaultSql;

/**
 * Set a typed stored generated expression omitted from write variants.
 *
 * **Example** (Set a generated expression)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import * as S from "effect/Schema"
 * import { generated } from "./pg.ts"
 *
 * console.log(S.String.pipe(generated(sql<string>`lower(name)`)).meta.generated !== false) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const generated =
  <Carrier>(expression: SQL<Carrier>) =>
  <I extends Field.Input>(
    input: I & ValidateExpression<I, Carrier> & ValidateNotDefaulted<I>
  ): Field.Patched<I, { readonly generated: Meta.GeneratedSqlExpr<Carrier> }> =>
    Field.patch(input, {
      generated: { _tag: "sqlExpr", expression },
    });

/**
 * Set an explicitly unsafe stored generated expression.
 *
 * **Example** (Set a raw generated expression)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { unsafeGeneratedSql } from "./pg.ts"
 *
 * console.log(S.String.pipe(unsafeGeneratedSql("lower(name)")).meta.generated !== false) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeGeneratedSql =
  (sql: string) =>
  <I extends Field.Input>(
    input: I & ValidateNotDefaulted<I>
  ): Field.Patched<I, { readonly generated: Meta.UnsafeGeneratedSql }> =>
    Field.patch(input, {
      generated: Meta.Generated.cases.unsafeSql.make({ sql }),
    });

/**
 * Override the physical column name when snake-case derivation is insufficient.
 *
 * **Example** (Override a column name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { columnName } from "./pg.ts"
 *
 * console.log(S.String.pipe(columnName("legacy_name")).meta.columnName) // "legacy_name"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const columnName =
  <const N extends string>(name: N) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<I, { readonly columnName: N }> =>
    Field.patch(input, { columnName: name });

/**
 * Foreign key to another entity, read from its EntityId statics — the
 * reference target needs zero extra spelling beyond the action policy.
 *
 * **Example** (Reference an EntityId schema)
 *
 * ```ts
 * import { SchemaUtils } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { references } from "./pg.ts"
 *
 * const UserId = S.Int.pipe(SchemaUtils.withStatics(() => ({ tableName: "user", entityType: "User" })))
 * console.log(S.Int.pipe(references(UserId)).meta.references?.tableName) // "user"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const references =
  <const Id extends EntityIdLike>(
    id: Id,
    options?: {
      readonly onDelete?: Meta.FkAction;
      readonly onUpdate?: Meta.FkAction;
    }
  ) =>
  <I extends Field.Input>(
    input: I
  ): Field.Patched<
    I,
    { readonly references: Meta.References<Id["tableName"], "id"> }
  > => {
    const ref: Meta.References<Id["tableName"], "id"> = {
      tableName: id.tableName,
      columnName: "id",
      onDelete: options?.onDelete,
      onUpdate: options?.onUpdate,
    };
    return Field.patch(input, { references: ref });
  };
