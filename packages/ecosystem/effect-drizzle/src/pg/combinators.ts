/**
 * Postgres combinators.
 *
 * Every combinator is parameter-constrained: an incompatible schema fails to
 * satisfy the input intersection, so the compile error lands AT the pipe
 * callsite with a readable `~effect-drizzle.error` message — not downstream where the
 * field gets used. All combinators funnel through `Field.patch`, the single
 * audited merge seam.
 *
 * Usage: `NonEmptyString.pipe(pg.varchar(320), pg.unique())`.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- the varchar/char tri-mode combinators are deliberately parallel walkers over the same evolveSchemas seam; collapsing them would couple independent column vocabularies (doc 14 family; review at next dialect addition)

import {
  append,
  empty,
  every,
  findFirst,
  head,
  isArray,
  isReadonlyArrayEmpty,
  match as matchArray,
  min,
  some,
} from "effect/Array";
import { equals } from "effect/Equal";
import { constFalse, constTrue } from "effect/Function";
import {
  exhaustive,
  orElse as matchOrElse,
  tags as matchTags,
  type as matchType,
  value as matchValue,
  when as matchWhen,
  withReturnType,
} from "effect/Match";
import { Order as NumberOrder } from "effect/Number";
import { fromUndefinedOr, getOrElse, isSome, match as matchOption } from "effect/Option";
import { hasProperty, isNumber, isString, isUndefined } from "effect/Predicate";
import {
  Finite,
  flip,
  is,
  isBetween,
  isInt,
  isInt32,
  isLengthBetween,
  isMaxLength,
  isStringFinite,
  isUUID,
  makeFilter,
  String as StringSchema,
} from "effect/Schema";
import { toType } from "effect/SchemaAST";
import { toLowerCase } from "effect/String";
import { VariantSchema } from "effect/unstable/schema";
import * as Field from "../core/Field.ts";
import * as Meta from "../core/Meta.ts";
import { ModelInvariantError } from "../core/model.ts";
import { assertPgEnumLabel, assertSqlName } from "../core/names.ts";
import { factory as V } from "../core/variant.ts";
import { assignStatics } from "../internal/statics.ts";
import * as PgColumn from "./Column.ts";
import {
  arrayElementAST,
  DeriveColumnError,
  exactLengths,
  isEntityIdLike,
  isNullable,
  maxLengths,
  carrier as schemaCarrier,
  selectSchemaOf,
  stringLiteralValues,
} from "./derive.ts";
import type { SQL } from "drizzle-orm";
import type { Schema, Top } from "effect/Schema";
import type { AST, Check, Suspend } from "effect/SchemaAST";
import type { ValidateSqlName } from "../core/names.ts";
import type { EntityIdLike } from "./derive.ts";

// ---------------------------------------------------------------------------
// Column setters
// ---------------------------------------------------------------------------

const isStringTypeAst = (node: AST, visited: ReadonlyArray<Suspend> = empty()): boolean =>
  matchType<AST>().pipe(
    matchTags({
      String: constTrue,
      TemplateLiteral: constTrue,
      Literal: ({ literal }) => isString(literal),
      Enum: ({ enums }) => every(enums, ([, value]) => isString(value)),
      Union: ({ types }) => every(types, (member) => isStringTypeAst(member, visited)),
      Suspend: (suspend) =>
        some(visited, equals(suspend)) ? false : isStringTypeAst(suspend.thunk(), append(visited, suspend)),
    }),
    matchOrElse(constFalse)
  )(node);

const isStringTypeSchema = (schema: Top): schema is Schema<string> => isStringTypeAst(toType(schema.ast));

const evolveSchemas = (schema: Field.AnySchema, evolve: (current: Top) => Top): Field.AnySchema =>
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
  const evolved = evolveSchemas(field.schema, (schema) => {
    const encoded = flip(schema);
    return flip(
      encoded.check(
        makeFilter<unknown>((value) => value === null || accepts(value), {
          identifier: "@beep/effect-drizzle/PgIntegerDomain",
          title: "PostgreSQL integer domain",
          description: "Mirrors a PostgreSQL integer-family value range on the encoded schema.",
          message: "The encoded value is outside the PostgreSQL integer-family domain.",
        })
      )
    );
  });
  const preserved = isEntityIdLike(field.schema)
    ? assignStatics(evolved, {
        tableName: field.schema.tableName,
        entityType: field.schema.entityType,
      })
    : evolved;
  return Field.make(preserved, field.meta);
}

function injectStringCheck<I extends Field.Input>(
  input: I,
  check: Check<string>
): Field.Field<Field.SchemaFrom<I>, Field.MetaFrom<I>>;
function injectStringCheck(input: Field.Input, check: Check<string>): Field.Any {
  const field = Field.from(input);
  const accepts = is(StringSchema.check(check));
  const evolved = evolveSchemas(field.schema, (schema) => {
    const encoded = flip(schema);
    return flip(
      encoded.check(
        makeFilter<unknown>((value) => value === null || accepts(value), {
          identifier: "@beep/effect-drizzle/PgStringDomain",
          title: "PostgreSQL string domain",
          description: "Mirrors an installed Effect string-format check on the encoded schema.",
          message: "The encoded string is outside the PostgreSQL value domain.",
        })
      )
    );
  });
  return Field.make(evolved, field.meta);
}

/**
 * Set an unbounded PostgreSQL text column on a string-encoded schema.
 *
 * **Example** (Set a text column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { text } from "@beep/effect-drizzle/pg"
 *
 * const field = String.pipe(text())
 * field.meta.column?.kind // => "text"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const text =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.text requires a string-encoded schema">
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
  return matchOption(fromUndefinedOr(length), {
    onNone: () =>
      matchArray(bounds, {
        onEmpty: () => {
          throw DeriveColumnError.make({
            message: `pg.${kind}() derive mode requires an isMaxLength check on the schema; add one or pass an explicit length.`,
            fieldName: "(unknown — set at model definition)",
            astTag: "(checks)",
          });
        },
        onNonEmpty: (nonEmptyBounds) =>
          Field.patch(f, {
            column: spec(min(nonEmptyBounds, NumberOrder)),
          }),
      }),
    onSome: (resolvedLength) => {
      if (isReadonlyArrayEmpty(bounds) && !VariantSchema.isField(f.schema)) {
        const encodedSchema = flip(f.schema);
        if (!isStringTypeSchema(encodedSchema)) {
          throw DeriveColumnError.make({
            message: `pg.${kind}(length) can inject isMaxLength only when the encoded schema is string-valued.`,
            fieldName: "(unknown — set at model definition)",
            astTag: toType(encodedSchema.ast)._tag,
          });
        }
        const evolved = flip(encodedSchema.check(isMaxLength(resolvedLength)));
        return Field.make(evolved, Meta.merge(f.meta, { column: spec(resolvedLength) }));
      }
      return Field.patch(f, { column: spec(resolvedLength) });
    },
  });
};

const fixedString = (input: Field.Input, length: number | undefined): Field.Any => {
  const field = Field.from(input);
  const lengths = exactLengths(field.schema);
  return matchOption(fromUndefinedOr(length), {
    onNone: () =>
      matchArray(lengths, {
        onEmpty: () => {
          throw DeriveColumnError.make({
            message:
              "pg.char() derive mode requires an isLengthBetween(n, n) check on the schema; add one or pass an explicit length.",
            fieldName: "(unknown — set at model definition)",
            astTag: "(checks)",
          });
        },
        onNonEmpty: (nonEmptyLengths) => {
          const resolvedLength = getOrElse(head(nonEmptyLengths), () => {
            throw DeriveColumnError.make({
              message: "pg.char() derive mode found no exact-length checks.",
              fieldName: "(unknown — set at model definition)",
              astTag: "(checks)",
            });
          });
          if (!every(nonEmptyLengths, (current) => current === resolvedLength)) {
            throw DeriveColumnError.make({
              message: "pg.char() derive mode requires all reachable exact schema lengths to agree.",
              fieldName: "(unknown — set at model definition)",
              astTag: "(checks)",
            });
          }
          return Field.patch(field, {
            column: PgColumn.Char.make({ length: resolvedLength }),
          });
        },
      }),
    onSome: (resolvedLength) => {
      if (isSome(findFirst(lengths, (current) => current !== resolvedLength))) {
        throw DeriveColumnError.make({
          message: `pg.char(${resolvedLength}) requires an exact schema length of ${resolvedLength}.`,
          fieldName: "(unknown — set at model definition)",
          astTag: "(checks)",
        });
      }
      if (isReadonlyArrayEmpty(lengths)) {
        if (VariantSchema.isField(field.schema)) {
          throw DeriveColumnError.make({
            message: `pg.char(${resolvedLength}) cannot inject an exact-length check into an explicit VariantSchema.Field.`,
            fieldName: "(unknown — set at model definition)",
            astTag: "VariantField",
          });
        }
        const encodedSchema = flip(field.schema);
        if (!isStringTypeSchema(encodedSchema)) {
          throw DeriveColumnError.make({
            message: `pg.char(${resolvedLength}) can inject an exact-length check only when the encoded schema is string-valued.`,
            fieldName: "(unknown — set at model definition)",
            astTag: toType(encodedSchema.ast)._tag,
          });
        }
        const evolved = flip(encodedSchema.check(isLengthBetween(resolvedLength, resolvedLength)));
        return Field.make(evolved, Meta.merge(field.meta, { column: PgColumn.Char.make({ length: resolvedLength }) }));
      }
      return Field.patch(field, { column: PgColumn.Char.make({ length: resolvedLength }) });
    },
  });
};

/**
 * Sets a varchar column while keeping schema and storage bounds aligned.
 *
 * **When to use**
 *
 * Use when a string needs a database length bound. Prefer `text()` when no
 * meaningful maximum exists and `char()` only for genuinely fixed-width data.
 *
 * **Details**
 *
 * - `pg.varchar()` — DERIVE: the length comes from the schema's `isMaxLength`
 *   check (tightest bound wins); no check is a loud construction error.
 * - `pg.varchar(n)` on a schema WITH a maxLength `m` — VERIFY: `m ≤ n` passes,
 *   `m > n` fails at model construction (column would truncate).
 * - `pg.varchar(n)` on a plain schema WITHOUT one — INJECT: the field's schema
 *   gains `check(isMaxLength(n))`, so the domain validates exactly what
 *   the column enforces. Variant-field inputs are verify-only (their per-variant
 *   codecs are author-owned).
 *
 * **Gotchas**
 *
 * Derive mode fails without an `isMaxLength` check. An explicit length on a
 * variant field verifies existing codecs but never rewrites them.
 *
 * **Example** (Derive varchar length)
 *
 * ```ts
 * import { String, isMaxLength } from "effect/Schema"
 * import { varchar } from "@beep/effect-drizzle/pg"
 *
 * const field = String.check(isMaxLength(320)).pipe(varchar())
 * field.meta.column?.kind // => "varchar"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function varchar(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Varchar }>;
export function varchar<const L extends number>(
  length: L
): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.varchar requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Varchar<L> }>;
export function varchar(length?: number): unknown {
  return (input: Field.Input): Field.Any =>
    boundedString(input, length, "varchar", (resolved) => PgColumn.Varchar.make({ length: resolved }));
}

type ValidateEnum<I extends Field.Input> = [Exclude<Field.EncodedOf<I>, null>] extends [string]
  ? string extends Exclude<Field.EncodedOf<I>, null>
    ? Field.SqlTypeError<"pg.enum requires a finite union of encoded string literals">
    : unknown
  : Field.SqlTypeError<"pg.enum requires a finite union of encoded string literals">;

type EnumValue<I extends Field.Input> = Extract<Exclude<Field.EncodedOf<I>, null>, string>;

/**
 * Set a real PostgreSQL enum column whose values come from the encoded schema.
 *
 * **When to use**
 *
 * Use when a finite string domain should become a reusable PostgreSQL enum;
 * use `varchar` or `text` for open-ended strings.
 *
 * **Details**
 *
 * Omitting the name derives it from the declaring model field key. A broad
 * string schema is rejected because PostgreSQL enum values must be finite.
 *
 * **Gotchas**
 *
 * Omitting the name is safe only inside model construction, where the field key
 * resolves it. Assembly requires repeated enum names to use identical values.
 * Duplicate literals collapse in first-occurrence order; literals containing
 * NUL (U+0000) are rejected loudly. The empty string is a legal enum label; if
 * it is intended to mean absence, model absence explicitly with
 * `OptionFromNullOr(...)` so the encoded database value is `NULL`.
 *
 * **Example** (Set a named enum)
 *
 * ```ts
 * import { Literals } from "effect/Schema"
 * import { enum as pgEnum } from "@beep/effect-drizzle/pg"
 *
 * Literals(["draft", "active"]).pipe(pgEnum("status")).meta.column?.kind
 * // => "enum"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function enum_(): <I extends Field.Input>(
  input: I & ValidateEnum<I>
) => Field.Patched<I, { readonly column: PgColumn.Enum<"", EnumValue<I>> }>;
export function enum_<const Name extends string>(
  name: Name & ValidateSqlName<Name, "pg.enum name must be a lowercase SQL identifier">
): <I extends Field.Input>(
  input: I & ValidateEnum<I>
) => Field.Patched<I, { readonly column: PgColumn.Enum<Name, EnumValue<I>> }>;
export function enum_(name?: string): unknown {
  return (input: Field.Input): Field.Any => {
    const values = getOrElse(stringLiteralValues(Field.from(input).schema), () => {
      throw DeriveColumnError.make({
        message: "pg.enum requires a finite non-empty union of encoded string literals.",
        fieldName: "(unknown — set at model definition)",
        astTag: "(encoded literals)",
      });
    });
    values.forEach(assertPgEnumLabel);
    const explicitName = fromUndefinedOr(name);
    if (isSome(explicitName)) assertSqlName(explicitName.value, "pg", "PostgreSQL enum name");
    const resolvedName = getOrElse(explicitName, () => "");
    return Field.patch(input, {
      column: PgColumn.Enum.make({
        ident: `enum<${resolvedName}>`,
        name: resolvedName,
        values,
      }),
    });
  };
}

/** Named export for the PostgreSQL enum combinator.
 * @category combinators
 * @since 0.0.0
 */
export { enum_ as enum };

/**
 * Sets an explicitly unsafe custom PostgreSQL type with no carrier validation.
 *
 * **When to use**
 *
 * Use when extension or domain types are not modeled by the built-in combinators.
 *
 * **Gotchas**
 *
 * The SQL type string is emitted verbatim, and foreign-key compatibility uses
 * exact `custom<...>` identity rather than validating the schema carrier.
 *
 * **Example** (Set a tsvector column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeCustom } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(unsafeCustom("tsvector")).meta.column?.ident // => "custom<tsvector>"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const unsafeCustom =
  <const SqlType extends string>(sqlType: SqlType) =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly column: PgColumn.Custom<SqlType> }> =>
    Field.patch(input, {
      column: PgColumn.Custom.make({
        ident: `custom<${sqlType}>`,
        sqlType,
      }),
    });

/**
 * Sets an exact PostgreSQL numeric column carried as a string.
 *
 * **Details**
 *
 * Precision and scale are optional Drizzle configuration; string encoding
 * avoids narrowing arbitrary-precision decimal values to JavaScript numbers.
 * The encoded schema gains Effect v4's `isStringFinite` check
 * (`node_modules/effect/src/Schema.ts`, `isStringFinite`, lines 6765-6768).
 *
 * **Example** (Set numeric precision and scale)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { numeric } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(numeric({ precision: 10, scale: 2 })).meta.column?.kind // => "numeric"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function numeric(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Numeric<undefined, undefined> }>;
export function numeric<const Precision extends number>(
  precision: Precision
): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Numeric<Precision, undefined> }>;
export function numeric<const Precision extends number, const Scale extends number>(options: {
  readonly precision: Precision;
  readonly scale: Scale;
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.numeric requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Numeric<Precision, Scale> }>;
export function numeric(options?: number | { readonly precision: number; readonly scale: number }): unknown {
  const precision = isNumber(options) ? options : options?.precision;
  const scale = isNumber(options) ? undefined : options?.scale;
  return (input: Field.Input): Field.Any =>
    Field.patch(injectStringCheck(input, isStringFinite()), {
      column: PgColumn.Numeric.make({ precision, scale }),
    });
}

/**
 * Sets a PostgreSQL date column in string or JavaScript `Date` mode.
 *
 * **When to use**
 *
 * Use with string mode for ISO date carriers and date mode only when the encoded
 * schema deliberately exposes JavaScript `Date` values to the driver.
 *
 * **Gotchas**
 *
 * String mode is carrier-only: installed Effect v4 exposes `DateFromString` as
 * a transformation, not a reusable encoded-string format check
 * (`node_modules/effect/src/Schema.ts`, `DateFromString`, lines 11851-11885).
 * Supply a validating schema when PostgreSQL date syntax must be rejected
 * before insertion.
 *
 * **Example** (Set string date mode)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { date } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(date()).meta.column?.kind // => "date"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function date(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.date (string mode) requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"string"> }>;
export function date(options: {
  readonly mode: "date";
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Date, "pg.date (date mode) requires a Date-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.DateColumn<"date"> }>;
export function date(options?: { readonly mode: "date" }): unknown {
  return (input: Field.Input): Field.Any =>
    Field.patch(input, {
      column: PgColumn.DateColumn.make({
        mode: matchOption(fromUndefinedOr(options), {
          onNone: () => "string",
          onSome: ({ mode }) => mode,
        }),
      }),
    });
}

/**
 * Sets a fixed-width PostgreSQL char column with exact-length authoring.
 *
 * **When to use**
 *
 * Use with truly fixed-width codes; use `varchar` for bounded variable text.
 *
 * **Details**
 *
 * Omitted length derives an `isLengthBetween(n, n)` check. An explicit length
 * verifies or injects that exact check.
 *
 * **Gotchas**
 *
 * PostgreSQL blank-pads shorter `char(n)` values. Exact-length validation keeps
 * valid encoded values stable across a database round trip.
 *
 * **Example** (Derive a char length)
 *
 * ```ts
 * import { String, isLengthBetween } from "effect/Schema"
 * import { char } from "@beep/effect-drizzle/pg"
 *
 * String.check(isLengthBetween(2, 2)).pipe(char()).meta.column?.kind // => "char"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function char(): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Char }>;
export function char<const Length extends number>(
  length: Length
): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.char requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Char<Length> }>;
export function char(length?: number): unknown {
  return (input: Field.Input): Field.Any => fixedString(input, length);
}

/**
 * Sets textual PostgreSQL JSON storage distinct from JSONB.
 *
 * **When to use**
 *
 * Use when preserving the input JSON text representation matters; use `jsonb`
 * for normalized binary JSON and its indexing/operator support.
 *
 * **Example** (Set JSON storage)
 *
 * ```ts
 * import { Boolean, Struct } from "effect/Schema"
 * import { json } from "@beep/effect-drizzle/pg"
 *
 * Struct({ ok: Boolean }).pipe(json()).meta.column?.ident // => "json"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const json =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, object, "pg.json requires an object- or array-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Json }> =>
    Field.patch(input, { column: PgColumn.Json.make({}) });

/**
 * Sets a PostgreSQL single-precision real column.
 *
 * **When to use**
 *
 * Use when single precision is intentional; ordinary number derivation
 * and `doublePrecision()` retain wider precision.
 *
 * **Example** (Set real storage)
 *
 * ```ts
 * import { Number } from "effect/Schema"
 * import { real } from "@beep/effect-drizzle/pg"
 *
 * Number.pipe(real()).meta.column?.ident // => "real"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const real =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.real requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Real }> =>
    Field.patch(input, { column: PgColumn.Real.make({}) });

/**
 * Sets a PostgreSQL bigserial column and marks inserts as defaulted.
 *
 * **When to use**
 *
 * Use with legacy serial semantics at bigint range. Prefer
 * `bigint(...).pipe(identity())` when explicit identity policy is required.
 *
 * **Example** (Set number-mode bigserial)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { bigserial } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(bigserial("number")).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function bigserial(mode: "number"): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "pg.bigserial('number') requires a number-encoded schema">
) => Field.Patched<
  I,
  {
    readonly column: PgColumn.Bigserial<"number">;
    readonly hasDefault: true;
  }
>;
export function bigserial(mode: "bigint"): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "pg.bigserial('bigint') requires a bigint-encoded schema">
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
 * Sets a PostgreSQL smallserial column and marks inserts as defaulted.
 *
 * **Example** (Set smallserial storage)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { smallserial } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(smallserial()).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const smallserial =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.smallserial requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Smallserial; readonly hasDefault: true }> =>
    Field.patch(input, {
      column: PgColumn.Smallserial.make({}),
      hasDefault: true,
    });

/**
 * Set a PostgreSQL UUID column on a string-encoded schema.
 *
 * **Details**
 *
 * Plain string schemas gain Effect v4's UUID format check
 * (`node_modules/effect/src/Schema.ts`, `isUUID`, lines 6913-6925).
 *
 * **Example** (Set a UUID column)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { uuid } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(uuid()).meta.column?.kind // => "uuid"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const uuid =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, string, "pg.uuid requires a string-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Uuid }> =>
    Field.patch(injectStringCheck(input, isUUID()), { column: PgColumn.Uuid.make({}) });

type IntegerColumn<I extends Field.Input> =
  Field.SchemaFrom<I> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
    : PgColumn.Integer;

/**
 * Sets a PostgreSQL integer column on a number-encoded schema.
 *
 * **Details**
 *
 * EntityId schemas retain an `entityId<...>` identity for foreign-key equality;
 * ordinary number schemas use the plain `integer` identity. Both plain and
 * variant fields gain PostgreSQL's signed 32-bit value-domain check.
 *
 * **Example** (Set an integer column)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { integer } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(integer()).meta.column?.kind // => "integer"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const integer = () => {
  function apply<I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.integer requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: IntegerColumn<I> }>;
  function apply(input: Field.Input): Field.Any {
    const bounded = injectNumberChecks(input, [isInt32()]);
    const schema = bounded.schema;
    const ident: "integer" | PgColumn.EntityIdIdent<string> = isEntityIdLike(schema)
      ? `entityId<"${schema.tableName}">`
      : "integer";
    return Field.patch(bounded, { column: PgColumn.Integer.make({ ident }) });
  }
  return apply;
};

/**
 * Set a PostgreSQL smallint column on a number-encoded schema.
 *
 * **Details**
 *
 * Plain and variant fields gain the signed 16-bit range check.
 *
 * **Example** (Set a smallint column)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { smallint } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(smallint()).meta.column?.kind // => "smallint"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const smallint =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.smallint requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Smallint }> =>
    Field.patch(injectNumberChecks(input, [isInt(), isBetween({ minimum: -32_768, maximum: 32_767 })]), {
      column: PgColumn.Smallint.make({}),
    });

/**
 * Set a PostgreSQL double-precision column on a number-encoded schema.
 *
 * **Example** (Set a double-precision column)
 *
 * ```ts
 * import { Finite } from "effect/Schema"
 * import { doublePrecision } from "@beep/effect-drizzle/pg"
 *
 * Finite.pipe(doublePrecision()).meta.column?.kind // => "doublePrecision"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const doublePrecision =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.doublePrecision requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.DoublePrecision }> =>
    Field.patch(input, { column: PgColumn.DoublePrecision.make({}) });

/**
 * Sets a bigint column whose mode matches the encoded carrier.
 *
 * **When to use**
 *
 * Use with number mode only within JavaScript's safe integer range; use bigint mode
 * when the schema and callers carry native `bigint` values.
 *
 * **Example** (Set a native-bigint column)
 *
 * ```ts
 * import { BigInt } from "effect/Schema"
 * import { bigint } from "@beep/effect-drizzle/pg"
 *
 * BigInt.pipe(bigint("bigint")).meta.column?.kind // => "bigint"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function bigint(
  mode: "number"
): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, number, "pg.bigint('number') requires a number-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Bigint<"number"> }>;
export function bigint(
  mode: "bigint"
): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, bigint, "pg.bigint('bigint') requires a bigint-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Bigint<"bigint"> }>;
export function bigint(mode: "number" | "bigint"): unknown {
  return (input: Field.Input): Field.Any => Field.patch(input, { column: PgColumn.Bigint.make({ mode }) });
}

/**
 * Sets a PostgreSQL serial column and marks inserts as defaulted.
 *
 * **When to use**
 *
 * Use with legacy serial semantics. Prefer `integer().pipe(identity())` when the
 * choice between identity-always and identity-by-default matters.
 *
 * **Example** (Set a serial column)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { serial } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(serial()).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const serial =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, number, "pg.serial requires a number-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Serial; readonly hasDefault: true }> =>
    Field.patch(input, { column: PgColumn.Serial.make({}), hasDefault: true });

/**
 * Set a PostgreSQL boolean column on a boolean-encoded schema.
 *
 * **Example** (Set a boolean column)
 *
 * ```ts
 * import { Boolean } from "effect/Schema"
 * import { boolean } from "@beep/effect-drizzle/pg"
 *
 * Boolean.pipe(boolean()).meta.column?.kind // => "boolean"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const boolean =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, boolean, "pg.boolean requires a boolean-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Bool }> =>
    Field.patch(input, { column: PgColumn.Bool.make({}) });

/**
 * Sets normalized PostgreSQL JSONB storage on an object-encoded schema.
 *
 * **When to use**
 *
 * Use with queryable and indexable structured data; use `json()` when textual
 * representation preservation is required.
 *
 * **Example** (Set a JSONB column)
 *
 * ```ts
 * import { String, Struct } from "effect/Schema"
 * import { jsonb } from "@beep/effect-drizzle/pg"
 *
 * Struct({ theme: String }).pipe(jsonb()).meta.column?.kind // => "jsonb"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const jsonb =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, object, "pg.jsonb requires an object- or array-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Jsonb }> =>
    Field.patch(input, { column: PgColumn.Jsonb.make({}) });

/**
 * Set a PostgreSQL bytea column on a Uint8Array-encoded schema.
 *
 * **Example** (Set a bytea column)
 *
 * ```ts
 * import { Uint8Array } from "effect/Schema"
 * import { bytea } from "@beep/effect-drizzle/pg"
 *
 * Uint8Array.pipe(bytea()).meta.column?.kind // => "bytea"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const bytea =
  () =>
  <I extends Field.Input>(
    input: I & Field.ValidateEncoded<I, Uint8Array, "pg.bytea requires a Uint8Array-encoded schema">
  ): Field.Patched<I, { readonly column: PgColumn.Bytea }> =>
    Field.patch(input, { column: PgColumn.Bytea.make({}) });

/**
 * Sets a timestamp column with explicit carrier and timezone policy.
 *
 * **When to use**
 *
 * Use with string mode for Effect's ISO-encoded date-time schemas and date mode only
 * for schemas encoded as JavaScript `Date`. Disable timezone only for deliberately
 * zone-free database values.
 *
 * **Gotchas**
 *
 * Carrier mode is an encoded-side choice, not a Type-side convenience. A
 * millis-encoded schema does not fit timestamp storage.
 *
 * **Example** (Set a string timestamp)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { timestamp } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(timestamp()).meta.column?.kind // => "timestamp"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function timestamp<const TZ extends boolean = true>(options?: {
  readonly mode?: "string";
  readonly withTimezone?: TZ;
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, string, "pg.timestamp (string mode) requires a string-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"string", TZ> }>;
export function timestamp<const TZ extends boolean = true>(options: {
  readonly mode: "date";
  readonly withTimezone?: TZ;
}): <I extends Field.Input>(
  input: I & Field.ValidateEncoded<I, Date, "pg.timestamp (date mode) requires a Date-encoded schema">
) => Field.Patched<I, { readonly column: PgColumn.Timestamp<"date", TZ> }>;
export function timestamp(options?: { readonly mode?: "string" | "date"; readonly withTimezone?: boolean }): unknown {
  return (input: Field.Input): Field.Any => {
    const withTimezone = getOrElse(fromUndefinedOr(options?.withTimezone), constTrue);
    return Field.patch(input, {
      column: PgColumn.Timestamp.make({
        ident: withTimezone ? "timestamptz" : "timestamp",
        mode: getOrElse(fromUndefinedOr(options?.mode), () => "string"),
        withTimezone,
      }),
    });
  };
}

type ArrayPatch<Element extends Field.Input, Dimensions extends Exclude<PgColumn.ArrayDimension, 0>> = {
  readonly column: Exclude<Field.MetaFrom<Element>["column"], undefined>;
  readonly dimensions: Dimensions;
};

type ValidateArrayModifiers<I extends Field.Input> = Field.MetaFrom<I>["primaryKey"] extends true
  ? Field.SqlTypeError<"array fields cannot be primary keys">
  : Field.MetaFrom<I>["identity"] extends false
    ? Field.MetaFrom<I>["version"] extends false
      ? unknown
      : Field.SqlTypeError<"array fields cannot be optimistic versions">
    : Field.SqlTypeError<"array fields cannot use identity generation">;

const dimension = (suffix: PgColumn.ArrayDimensionString): Exclude<PgColumn.ArrayDimension, 0> =>
  matchValue(suffix).pipe(
    withReturnType<Exclude<PgColumn.ArrayDimension, 0>>(),
    matchWhen("[]", () => 1),
    matchWhen("[][]", () => 2),
    matchWhen("[][][]", () => 3),
    matchWhen("[][][][]", () => 4),
    matchWhen("[][][][][]", () => 5),
    exhaustive
  );

const arrayShape = (value: unknown, depth: number): string =>
  depth === 0 || !isArray(value)
    ? "value"
    : `${value.length}[${value.map((member) => arrayShape(member, depth - 1)).join(",")}]`;

const isRectangular = (value: unknown, depth: number): boolean => {
  if (depth < 2 || !isArray(value) || value.length === 0) return true;
  const expected = arrayShape(value[0], depth - 1);
  return value.every((member) => arrayShape(member, depth - 1) === expected);
};

const everyArrayElement = (value: unknown, depth: number, accepts: (value: unknown) => boolean): boolean =>
  value === null ||
  (depth === 0
    ? accepts(value)
    : isArray(value) && value.every((member) => everyArrayElement(member, depth - 1, accepts)));

/**
 * Declares a PostgreSQL array over an explicitly compiled scalar element.
 *
 * **Details**
 *
 * The scalar element owns the column descriptor; the outer schema must match
 * its encoded element at the declared depth. Dimensions range from one to five.
 *
 * **Gotchas**
 *
 * The element must have exactly one scalar column combinator. Arrays cannot be
 * primary keys, identity columns, or optimistic versions, and SQLite exposes no
 * corresponding operator. Multidimensional inputs are checked for rectangular
 * shape at the schema boundary; ragged arrays are rejected before insertion.
 *
 * **Example** (Declare a two-dimensional text array)
 *
 * ```ts
 * import { Array, String } from "effect/Schema"
 * import { array, text } from "@beep/effect-drizzle/pg"
 *
 * const matrix = Array(Array(String)).pipe(
 *   array({ element: String.pipe(text()), suffix: "[][]" })
 * )
 * matrix.meta.dimensions // => 2
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export function array<const Element extends Field.Input>(
  element: Element & Field.ValidateArrayElement<Element>
): <I extends Field.Input>(
  input: I & Field.ValidateArrayEncoded<I, Element, 1> & ValidateArrayModifiers<I>
) => Field.Patched<I, ArrayPatch<Element, 1>>;
export function array<const Element extends Field.Input, const Suffix extends PgColumn.ArrayDimensionString>(options: {
  readonly element: Element & Field.ValidateArrayElement<Element>;
  readonly suffix: Suffix;
}): <I extends Field.Input>(
  input: I & Field.ValidateArrayEncoded<I, Element, PgColumn.DimensionOf<Suffix>> & ValidateArrayModifiers<I>
) => Field.Patched<I, ArrayPatch<Element, PgColumn.DimensionOf<Suffix>>>;
export function array(
  input: Field.Input | { readonly element: Field.Input; readonly suffix: PgColumn.ArrayDimensionString }
): unknown {
  const configured = hasProperty(input, "element") && hasProperty(input, "suffix");
  const element = configured ? input.element : input;
  const suffix = configured && isString(input.suffix) ? input.suffix : "[]";
  return (input: Field.Input): Field.Any => {
    const outer = Field.from(input);
    const base = Field.from(element);
    const dimensions = dimension(suffix);
    if (isUndefined(base.meta.column) || base.meta.dimensions !== 0) {
      throw DeriveColumnError.make({
        message: "pg.array requires an element schema with one explicit scalar column combinator.",
        fieldName: "(unknown — set at model definition)",
        astTag: "(array element)",
      });
    }
    if (outer.meta.primaryKey || outer.meta.identity !== false || outer.meta.version) {
      throw DeriveColumnError.make({
        message: "pg.array is incompatible with primaryKey, identity, and version semantics.",
        fieldName: "(unknown — set at model definition)",
        astTag: "(array modifiers)",
      });
    }
    const outerElement = arrayElementAST(outer.schema, dimensions);
    if (schemaCarrier(outer.schema, dimensions).tag !== schemaCarrier(base.schema, 0).tag) {
      throw DeriveColumnError.make({
        message: "pg.array outer schema does not match the element schema at the declared depth.",
        fieldName: "(unknown — set at model definition)",
        astTag: outerElement._tag,
      });
    }
    const acceptsElement = is(flip(selectSchemaOf(base.schema)));
    const checked = Field.make(
      evolveSchemas(outer.schema, (schema) =>
        flip(
          flip(schema).check(
            makeFilter<unknown>(
              (value) => isRectangular(value, dimensions) && everyArrayElement(value, dimensions, acceptsElement),
              {
                identifier: "@beep/effect-drizzle/PgRectangularArray",
                title: "PostgreSQL rectangular array",
                description: "Requires scalar element domains and equal nested extents for PostgreSQL arrays.",
                message: "PostgreSQL arrays must satisfy the element domain and be rectangular.",
              }
            )
          )
        )
      ),
      outer.meta
    );
    return Field.patch(checked, {
      column: base.meta.column,
      dimensions,
    });
  };
}

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/**
 * Marks a non-nullable field as the inline primary key.
 *
 * **Gotchas**
 *
 * A model accepts at most one inline key; use `Table.compositePrimaryKey` for
 * multi-column keys. Arrays and nullable carriers are rejected.
 *
 * **Example** (Mark a primary key)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { primaryKey } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(primaryKey()).meta.primaryKey // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const primaryKey =
  () =>
  <I extends Field.Input>(
    input: I &
      Field.ValidateNonNullable<I, "primaryKey() forbids a nullable schema — a primary key cannot admit null"> &
      ValidateNotArray<I>
  ): Field.Patched<I, { readonly primaryKey: true }> =>
    Field.patch(input, { primaryKey: true });

/**
 * Mark a field as carrying a single-column unique constraint.
 *
 * **Example** (Mark a unique field)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unique } from "@beep/effect-drizzle/pg"
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
 * Colocate a single-column btree index with the field it indexes.
 *
 * **When to use**
 *
 * Use for single-column indexes so the intent lives on the column instead of
 * a table-extras callback; keep the callback for multi-column or expression
 * indexes.
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
 * import { index, text } from "@beep/effect-drizzle/pg"
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
    if (!isUndefined(options?.name)) assertSqlName(options.name, "pg", "PostgreSQL index name");
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
 * import { text, uniqueIndex } from "@beep/effect-drizzle/pg"
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
    if (!isUndefined(options?.name)) assertSqlName(options.name, "pg", "PostgreSQL index name");
    return Field.patch(input, { indexed: { name: options?.name, unique: true } });
  };

type ValidateIdentity<I extends Field.Input> = Field.MetaFrom<I>["column"] extends {
  readonly kind: PgColumn.IdentityKind;
}
  ? unknown
  : Field.SqlTypeError<"identity() requires an explicit integer-family column first (pg.integer/pg.smallint/pg.bigint) — bare number schemas derive doublePrecision">;

type ValidateNotGenerated<I extends Field.Input> = Field.MetaFrom<I>["generated"] extends false
  ? unknown
  : Field.SqlTypeError<"default and generated are mutually exclusive">;

type ValidateNotDefaulted<I extends Field.Input> = Field.MetaFrom<I>["hasDefault"] extends false
  ? unknown
  : Field.SqlTypeError<"default and generated are mutually exclusive">;

type ValidateNotVersion<I extends Field.Input> = Field.MetaFrom<I>["version"] extends false
  ? unknown
  : Field.SqlTypeError<"version fields are mutually exclusive with identity and generated columns">;

type ValidateNotArray<I extends Field.Input> = Field.MetaFrom<I>["dimensions"] extends 0
  ? unknown
  : Field.SqlTypeError<"array fields cannot use primary-key, identity, or version semantics">;

/**
 * Applies PostgreSQL identity generation after an integer-family column setter.
 *
 * **When to use**
 *
 * Use with `always` when callers must never author inserted ids, and `byDefault`
 * when explicit ids remain allowed. Use serial combinators for legacy policy.
 *
 * **Details**
 *
 * Identity-always is absent from insert but remains required in update as the
 * row locator. Identity-by-default is insert-optional and not generated.
 *
 * **Gotchas**
 *
 * Update membership for identity-always does not put the id in `SET`; repository
 * code consumes it in `WHERE`. Identity requires an explicit integer-family
 * column and is incompatible with defaults, versions, and arrays.
 *
 * **Example** (Apply always identity generation)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { identity, integer } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(integer(), identity()).meta.identity // => "always"
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
    ValidateNotGenerated<I> &
    ValidateNotVersion<I> &
    ValidateNotArray<I>
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
    const resolved: Exclude<Meta.IdentityMode, false> = getOrElse(fromUndefinedOr(kind), (): "always" => "always");
    return Field.patch(
      input,
      resolved === "always"
        ? {
            identity: resolved,
            generated: Meta.Generated.identityAlways(),
          }
        : { identity: resolved, hasDefault: true, generated: false }
    );
  };
}

type ValidateDefaultValue<I extends Field.Input, Value> = [Value] extends [Exclude<Field.EncodedOf<I>, null>]
  ? unknown
  : Field.SqlTypeError<"default() value must match the field's encoded carrier">;

type ValidateExpression<I extends Field.Input, Carrier> = [Carrier] extends [Exclude<Field.EncodedOf<I>, null>]
  ? [Exclude<Field.EncodedOf<I>, null>] extends [Carrier]
    ? unknown
    : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">
  : Field.SqlTypeError<"SQL expression carrier must equal the field's encoded carrier">;

/**
 * Sets a typed literal default matching the encoded database carrier.
 *
 * **Details**
 *
 * The field becomes insert-optional while the literal stays correlated with
 * the schema's encoded type. Model construction also validates the value against
 * the complete encoded schema and PostgreSQL literal representation. Non-finite
 * numbers, NUL text, and unproven `bytea` literals are rejected; use
 * `unsafeDefaultSql` only for a trusted SQL spelling that intentionally escapes
 * these checks.
 *
 * **Example** (Set a literal default)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { default as defaultValue } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(defaultValue("active")).meta.hasDefault // => true
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
    Field.patch(input, {
      default: { _tag: "value", value },
      hasDefault: true,
    });

/** Named export for the PostgreSQL literal-default combinator.
 * @category combinators
 * @since 0.0.0
 */
export { default_ as default };

/**
 * Sets a typed SQL default expression with carrier equality checking.
 *
 * **When to use**
 *
 * Use when PostgreSQL should compute an insert default and typed Drizzle SQL
 * can represent it.
 *
 * **Gotchas**
 *
 * Schema expressions must render with zero parameters. Carrier typing does not
 * prove PostgreSQL expression legality; volatility, column references, and
 * other database rules remain migration-time checks.
 *
 * **Example** (Set an expression default)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { defaultExpr } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(defaultExpr(sql<string>`'active'`)).meta.hasDefault // => true
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

type ValidateTimestamp<I extends Field.Input> = Field.MetaFrom<I>["column"] extends PgColumn.Timestamp
  ? unknown
  : Field.SqlTypeError<"defaultNow() requires an explicit pg.timestamp column first">;

/**
 * Sets PostgreSQL's current time as a timestamp database default.
 *
 * **When to use**
 *
 * Use when PostgreSQL is the single authority for an insert timestamp.
 *
 * **Gotchas**
 *
 * Do not combine this database clock with an Effect constructor default for
 * the same field; two clocks can disagree.
 *
 * **Example** (Set the current-time default)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { defaultNow, timestamp } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(timestamp(), defaultNow()).meta.hasDefault // => true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const defaultNow =
  () =>
  <I extends Field.Input>(
    input: I & ValidateTimestamp<I> & ValidateNotGenerated<I>
  ): Field.Patched<I, { readonly default: Meta.DefaultNow; readonly hasDefault: true }> =>
    Field.patch(input, {
      default: Meta.Default.now(),
      hasDefault: true,
    });

/**
 * Sets an explicitly unsafe raw-SQL default.
 *
 * **When to use**
 *
 * Use when only trusted raw SQL can represent the default.
 *
 * **Gotchas**
 *
 * The string bypasses carrier checking, parameterization, and escaping.
 *
 * **Example** (Set a raw default)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeDefaultSql } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(unsafeDefaultSql("current_user")).meta.hasDefault // => true
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
    Field.patch(input, {
      default: Meta.Default.unsafeSql({ sql }),
      hasDefault: true,
    });

/**
 * Compatibility alias for {@link unsafeDefaultSql}.
 *
 * **Gotchas**
 *
 * The alias is equally unsafe; its older name does not communicate that boundary.
 *
 * **Example** (Use the compatibility alias)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { defaultSql } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(defaultSql("current_user")).meta.hasDefault // => true
 * ```
 *
 * @deprecated Use the explicitly unsafe-named {@link unsafeDefaultSql}.
 * @category combinators
 * @since 0.0.0
 */
export const defaultSql = unsafeDefaultSql;

type ValidateVersionColumn<I extends Field.Input> = Field.MetaFrom<I>["column"] extends
  | PgColumn.Integer
  | PgColumn.Smallint
  | PgColumn.Bigint<"number">
  ? unknown
  : Field.SqlTypeError<"version() requires a number-encoded integer-family column first (pg.integer/pg.smallint/pg.bigint('number'))">;

type ValidateVersionSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SqlTypeError<"version() cannot own an explicit VariantSchema.Field">
    : unknown;

type ValidateVersionCompatibility<I extends Field.Input> = Field.MetaFrom<I>["identity"] extends false
  ? Field.MetaFrom<I>["generated"] extends false
    ? unknown
    : Field.SqlTypeError<"version fields cannot be generated">
  : Field.SqlTypeError<"version fields cannot use identity generation">;

/**
 * Marks one number-encoded integer-family field as the optimistic-concurrency token.
 *
 * **When to use**
 *
 * Use with `makeRepository` when updates must compare and increment one version
 * atomically.
 *
 * **Details**
 *
 * The field is optional on insert so its SQL default applies, required on
 * update as the expected version, and present on selected and JSON rows.
 *
 * **Gotchas**
 *
 * Every update payload must include the current version. Native-bigint and
 * explicit variant fields are rejected; version fields also cannot use
 * identity, generated-column, or array semantics.
 *
 * **Example** (Mark a row version)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { default as defaultValue, integer, version } from "@beep/effect-drizzle/pg"
 *
 * Int.pipe(integer(), defaultValue(1), version()).meta.version // => true
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
      Field.ValidateNonNullable<I, "version() forbids a nullable schema"> &
      ValidateNotArray<I>
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
      !PgColumn.isSpec(field.meta.column) ||
      !PgColumn.isNumberInteger(field.meta.column)
    ) {
      throw ModelInvariantError.make({
        message: "version() requires a number-encoded integer-family PostgreSQL column.",
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
 * remains readable through select and JSON variants.
 *
 * **Gotchas**
 *
 * Schema expressions must render with zero parameters. Carrier typing does not
 * prove immutability or forbid generated-column chaining; PostgreSQL validates
 * those deeper semantics when DDL is applied.
 *
 * **Example** (Set a generated expression)
 *
 * ```ts
 * import { sql } from "drizzle-orm"
 * import { String } from "effect/Schema"
 * import { generated } from "@beep/effect-drizzle/pg"
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
    Field.patch(input, {
      generated: { _tag: "sqlExpr", expression },
    });

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
 * **Example** (Set a raw generated expression)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { unsafeGeneratedSql } from "@beep/effect-drizzle/pg"
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
    Field.patch(input, {
      generated: Meta.Generated.unsafeSql({ sql }),
    });

/**
 * Overrides the physical column name while preserving the model field key.
 *
 * **When to use**
 *
 * Use with legacy schemas or names that differ from snake-case derivation.
 *
 * **Example** (Override a column name)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { columnName } from "@beep/effect-drizzle/pg"
 *
 * String.pipe(columnName("legacy_name")).meta.columnName // => "legacy_name"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const columnName =
  <const N extends string>(name: N & ValidateSqlName<N, "pg.columnName requires a lowercase SQL identifier">) =>
  <I extends Field.Input>(input: I): Field.Patched<I, { readonly columnName: N }> => {
    assertSqlName(name, "pg", "PostgreSQL column name");
    const resolvedName: N = name;
    return Field.patch(input, { columnName: resolvedName });
  };

/**
 * Foreign key to another entity, read from its EntityId statics.
 *
 * **Details**
 *
 * The target table comes from `tableName`, the target column is `id`, and
 * delete/update actions remain optional policy. A deterministic constraint
 * name can be supplied when preserving an existing database contract.
 *
 * **Gotchas**
 *
 * Assembly compares SQL identity, encoded carrier, and array depth. Two
 * number-like fields with different EntityId identities do not silently match.
 * `SET NULL` requires a nullable encoded source; `SET DEFAULT` requires a
 * declared database default. The chosen default must still reference a live
 * target row when the action executes.
 *
 * **Example** (Reference an EntityId schema)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { references } from "@beep/effect-drizzle/pg"
 *
 * class UserId {
 *   static readonly tableName = "user"
 *   static readonly entityType = "User"
 * }
 * const reference = Int.pipe(
 *   references({
 *     id: UserId,
 *     options: { name: "membership_user_id_user_id_fkey" }
 *   })
 * ).meta.references
 *
 * console.log(reference?.tableName) // "user"
 * console.log(reference?.name) // "membership_user_id_user_id_fkey"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
type ReferenceOptions = {
  readonly name?: string;
  readonly onDelete?: Meta.FkAction;
  readonly onUpdate?: Meta.FkAction;
};
type ValidateReferenceName<Options> = Options extends { readonly name: infer Name extends string }
  ? ValidateSqlName<Lowercase<Name>, "pg.references constraint name must be a valid PostgreSQL identifier">
  : unknown;
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
export function references<const Id extends EntityIdLike>(
  id: Id
): <I extends Field.Input>(
  input: I & ValidateReferenceActions<NoInfer<I>, undefined>
) => Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id"> }>;
export function references<const Id extends EntityIdLike, const Options extends ReferenceOptions>(config: {
  readonly id: Id;
  readonly options: Options & ValidateReferenceName<Options>;
}): <I extends Field.Input>(
  input: I & ValidateReferenceActions<NoInfer<I>, Options>
) => Field.Patched<I, { readonly references: Meta.References<Id["tableName"], "id"> }>;
export function references(
  idOrConfig: EntityIdLike | { readonly id: EntityIdLike; readonly options: ReferenceOptions }
): unknown {
  const id = isEntityIdLike(idOrConfig) ? idOrConfig : idOrConfig.id;
  const options = isEntityIdLike(idOrConfig) ? undefined : idOrConfig.options;
  return (input: Field.Input): Field.Any => {
    const ref: Meta.References = matchOption(fromUndefinedOr(options?.name), {
      onNone: () => ({
        tableName: id.tableName,
        columnName: "id",
        onDelete: options?.onDelete,
        onUpdate: options?.onUpdate,
      }),
      onSome: (name) => ({
        tableName: id.tableName,
        columnName: "id",
        name,
        onDelete: options?.onDelete,
        onUpdate: options?.onUpdate,
      }),
    });
    if (!isUndefined(ref.name)) {
      assertSqlName(toLowerCase(ref.name), "pg", "PostgreSQL foreign-key constraint name");
    }
    return Field.patch(input, { references: ref });
  };
}
