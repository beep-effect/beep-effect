/**
 * Column derivation for bare schema fields.
 *
 * Policy (deliberately identical at the type level and at runtime — the v3
 * experiment's fatal flaw was two derivation algorithms that disagreed):
 *
 * - EntityId-like schemas (statics `tableName` + `entityType`, number-encoded)
 *   derive `integer`.
 * - Unambiguous carriers derive directly: string → text, boolean → boolean,
 *   bigint → bigint, object/array → jsonb.
 * - `number` derives `doublePrecision` — v4 checks are not type-visible, so
 *   `Int` cannot be distinguished from `NumberSchema` statically; integer
 *   columns are explicit (`pg.integer()`).
 * - Declarations (Date, Uint8Array, Option, …), heterogeneous unions, and
 *   everything else DO NOT derive: explicit column metadata is required.
 *   Ambiguity is a loud error, never a silent fallback.
 *
 * Nullability never derives a column: `Null` union members are stripped (they
 * feed `.notNull()` instead), and an encoded `Undefined` is rejected — SQL
 * absence must be represented as `null` in selected rows.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- collectMaxLengths/collectExactLengths are deliberately parallel dual-signature AST walkers over distinct check kinds; sharing their spine would obscure the per-check policy (doc 14 family; review at next dialect addition)

import {
  append,
  appendAll,
  empty,
  every,
  filter,
  flatMap,
  head,
  isReadonlyArrayNonEmpty,
  of,
  range,
  reduce,
  some,
} from "effect/Array";
import { equals } from "effect/Equal";
import { dual, flow } from "effect/Function";
import { orElse as matchOrElse, tags as matchTags, type as matchType, withReturnType } from "effect/Match";
import { fromUndefinedOr, getOrElse, map as mapOption, none, some as someOption } from "effect/Option";
import { hasProperty, isNumber, isString, isTagged, not } from "effect/Predicate";
import { isSchema } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import { get as getStruct } from "effect/Struct";
import { VariantSchema } from "effect/unstable/schema";
import { classify as classifyCore, DeriveColumnError, flattenEncoded } from "../core/classification.ts";
import { EntityIdLike as EntityIdLikeSchema, isEntityIdLike } from "../core/entity-id.ts";
import { stringLiteralValues as collectStringLiteralValues } from "../core/literals.ts";
import * as PgColumn from "./Column.ts";
import type { Option } from "effect/Option";
import type { Top } from "effect/Schema";
import type { AST, Check } from "effect/SchemaAST";
import type { EntityIdLike as EntityIdLikeType } from "../core/entity-id.ts";
import type * as Field from "../core/Field.ts";

/**
 * Error raised when an encoded schema AST cannot determine one SQL column.
 *
 * @category errors
 * @since 0.0.0
 */
export { DeriveColumnError };

/**
 * PostgreSQL derivation view of the dialect-neutral EntityId static schema.
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdLike = EntityIdLikeSchema;
/**
 * Test unknown input for EntityId schema statics.
 *
 * @category guards
 * @since 0.0.0
 */
export { isEntityIdLike };
/**
 * Static EntityId metadata consumed by PostgreSQL derivation.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdLike = EntityIdLikeType;

// ---------------------------------------------------------------------------
// Type-level derivation
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Select-side schema type of an input; variant fields contribute `select`.
 *
 * @category models
 * @since 0.0.0
 */
export type SelectSchemaOf<Sch> =
  Sch extends VariantSchema.Field<infer Config> ? (Config extends { readonly select: infer Sel } ? Sel : never) : Sch;

type DeriveFromEncoded<E> =
  IsAny<E> extends true
    ? never
    : [E] extends [never]
      ? never
      : [E] extends [string]
        ? PgColumn.Text
        : [E] extends [boolean]
          ? PgColumn.Bool
          : [E] extends [bigint]
            ? PgColumn.Bigint<"bigint">
            : [E] extends [number]
              ? PgColumn.DoublePrecision
              : [E] extends [Date]
                ? never // Declarations require explicit metadata (pg.timestamp)
                : [E] extends [Uint8Array]
                  ? never // explicit pg.bytea
                  : E extends ReadonlyArray<unknown>
                    ? PgColumn.Jsonb
                    : E extends { readonly [key: string]: unknown }
                      ? PgColumn.Jsonb
                      : never;

/**
 * The column spec a bare input derives, or `never` when derivation is
 * ambiguous and explicit metadata is required.
 *
 * @category models
 * @since 0.0.0
 */
type Derived<I extends Field.Input> =
  SelectSchemaOf<Field.SchemaFrom<I>> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
      ? PgColumn.Integer<PgColumn.EntityIdIdent<TableName>>
      : never
    : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/**
 * Column descriptor an input resolves to: explicit metadata wins, then derivation.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolvedColumn<I extends Field.Input> = Field.MetaFrom<I>["column"] extends undefined
  ? Derived<I>
  : Field.MetaFrom<I>["column"] extends PgColumn.Spec
    ? Field.MetaFrom<I>["column"]
    : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
          readonly dialect: infer Dialect;
        }
      ? string extends Dialect
        ? Derived<I>
        : never
      : never;

// ---------------------------------------------------------------------------
// Runtime derivation (mirrors the type-level policy exactly)
// ---------------------------------------------------------------------------

/**
 * Return the select-side schema used as the database representation.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const selectSchemaOf = (schema: Field.AnySchema): Top => {
  if (VariantSchema.isField(schema)) {
    const select: unknown = schema.schemas.select;
    if (isSchema(select)) return select;
    throw DeriveColumnError.make({
      message: "Variant field has no select schema; the select variant is the database row representation.",
      fieldName: "(unknown)",
      astTag: "VariantField",
    });
  }
  return schema;
};

type Classified = { readonly column: PgColumn.Spec; readonly nullable: boolean };

/**
 * Derive `{ column, nullable }` for a field input from its encoded AST.
 * Explicit metadata should be consulted first; this is the bare-schema path
 * and the nullability oracle for both paths.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const classify: {
  (fieldName: string): (schema: Field.AnySchema) => Classified;
  (schema: Field.AnySchema, fieldName: string): Classified;
} = /* @__PURE__ */ dual(
  2,
  (schema: Field.AnySchema, fieldName: string): Classified =>
    classifyCore(schema, fieldName, {
      selectSchemaOf,
      entityTableName: (select) => (isEntityIdLike(select) ? someOption(select.tableName) : none()),
      entityColumn: (tableName) => PgColumn.Integer.make({ ident: `entityId<"${tableName}">` }),
      fromSchemaAST: PgColumn.Spec.fromSchemaAST,
    })
);

const fail = (fieldName: string, astTag: string, message: string): never => {
  throw DeriveColumnError.make({ message, fieldName, astTag });
};

/**
 * Test nullability of a field input's encoded select representation.
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isNullable = (schema: Field.AnySchema): boolean =>
  some(flattenEncoded(toEncoded(selectSchemaOf(schema).ast), "(unknown)"), isTagged("Null"));

const nonNullEncodedAST = (schema: Field.AnySchema): AST => {
  const encoded = toEncoded(selectSchemaOf(schema).ast);
  if (!isTagged(encoded, "Union")) return encoded;
  if (!some(encoded.types, isTagged("Null"))) return encoded;
  const members = filter(encoded.types, not(isTagged("Null")));
  return getOrElse(head(members), () =>
    fail("(unknown)", encoded._tag, "An array schema must retain one encoded member after stripping null.")
  );
};

/**
 * Resolve the scalar encoded AST under an exact PostgreSQL array depth.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const arrayElementAST: {
  (dimensions: Exclude<PgColumn.ArrayDimension, 0>): (schema: Field.AnySchema) => AST;
  (schema: Field.AnySchema, dimensions: Exclude<PgColumn.ArrayDimension, 0>): AST;
} = /* @__PURE__ */ dual(2, (schema: Field.AnySchema, dimensions: Exclude<PgColumn.ArrayDimension, 0>): AST => {
  const current = reduce(range(1, dimensions), nonNullEncodedAST(schema), (node) => {
    if (isTagged(node, "Arrays")) {
      if (isReadonlyArrayNonEmpty(node.elements) || node.rest.length !== 1) {
        fail("(unknown)", node._tag, `pg.array expected one homogeneous encoded element at depth ${dimensions}.`);
      }
      return getOrElse(head(node.rest), () =>
        fail("(unknown)", node._tag, `pg.array expected an encoded ReadonlyArray at depth ${dimensions}.`)
      );
    }
    return fail("(unknown)", node._tag, `pg.array expected an encoded ReadonlyArray at depth ${dimensions}.`);
  });
  if (isTagged(current, "Arrays")) {
    fail("(unknown)", current._tag, `pg.array encoded depth exceeds the declared depth ${dimensions}.`);
  }
  return current;
});

/**
 * Return the non-null encoded AST used by a scalar element declaration.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
const encodedAST = flow(selectSchemaOf, flow(getStruct("ast"), toEncoded));

const atomicCarrierTag = (node: AST): PgColumn.CarrierTag =>
  matchType<AST>().pipe(
    withReturnType<PgColumn.CarrierTag>(),
    matchTags({
      String: () => "string",
      TemplateLiteral: () => "string",
      Number: () => "number",
      BigInt: () => "bigint",
      Boolean: () => "boolean",
      Objects: () => "object",
      Arrays: () => "object",
      Enum: ({ enums }) =>
        every(enums, ([, value]) => isString(value))
          ? "string"
          : fail("(unknown)", node._tag, "Encoded enum is not string-valued."),
      Literal: ({ literal }) =>
        isString(literal)
          ? "string"
          : isNumber(literal)
            ? "number"
            : typeof literal === "bigint"
              ? "bigint"
              : typeof literal === "boolean"
                ? "boolean"
                : fail("(unknown)", node._tag, "Encoded literal has no SQL carrier."),
      Declaration: (declaration) =>
        hasProperty(declaration.annotations?.representation, "id") &&
        declaration.annotations.representation.id === "effect/schema/Date"
          ? "date"
          : hasProperty(declaration.annotations?.representation, "id") &&
              declaration.annotations.representation.id === "effect/schema/Uint8Array"
            ? "bytes"
            : fail("(unknown)", node._tag, "Encoded declaration has no SQL carrier."),
    }),
    matchOrElse(() => fail("(unknown)", node._tag, "Encoded AST has no SQL carrier."))
  )(node);

const carrierTagFromAST = (node: AST): PgColumn.CarrierTag => {
  const members = filter(flattenEncoded(node, "(unknown)"), not(isTagged("Null")));
  const first = getOrElse(head(members), () =>
    fail("(unknown)", node._tag, "No encoded carrier remains after null stripping.")
  );
  const tag = atomicCarrierTag(first);
  if (!every(members, (member) => atomicCarrierTag(member) === tag)) {
    return fail("(unknown)", "Union", "Encoded union members have different SQL carriers.");
  }
  return tag;
};

/**
 * Runtime encoded-carrier witness for model-construction corroboration.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const carrier: {
  (dimensions: PgColumn.ArrayDimension): (schema: Field.AnySchema) => PgColumn.Carrier;
  (schema: Field.AnySchema, dimensions: PgColumn.ArrayDimension): PgColumn.Carrier;
} = /* @__PURE__ */ dual(2, (schema: Field.AnySchema, dimensions: PgColumn.ArrayDimension): PgColumn.Carrier => {
  const encoded = encodedAST(schema);
  const peelArray = (node: AST): AST => {
    const members = filter(flattenEncoded(node, "(unknown)"), not(isTagged("Null")));
    const current = getOrElse(head(members), () =>
      fail("(unknown)", node._tag, "PostgreSQL array has no encoded element.")
    );
    if (
      members.length !== 1 ||
      !isTagged(current, "Arrays") ||
      isReadonlyArrayNonEmpty(current.elements) ||
      current.rest.length !== 1
    ) {
      return fail("(unknown)", current._tag, `PostgreSQL array metadata does not match encoded depth ${dimensions}.`);
    }
    return getOrElse(head(current.rest), () =>
      fail("(unknown)", current._tag, "PostgreSQL array has no homogeneous element.")
    );
  };
  const scalar = dimensions === 0 ? encoded : reduce(range(1, dimensions), encoded, peelArray);
  const tag = carrierTagFromAST(scalar);
  if (dimensions !== 0 && tag === "object") {
    const members = filter(flattenEncoded(scalar, "(unknown)"), not(isTagged("Null")));
    if (some(members, isTagged("Arrays"))) {
      return fail("(unknown)", "Arrays", `PostgreSQL array encoded depth exceeds declared depth ${dimensions}.`);
    }
  }
  return { tag, dimensions };
});

/**
 * Collect a finite non-empty union of encoded string literals.
 *
 * **Details**
 *
 * Nullable literal schemas are accepted after stripping `null`; broad strings,
 * templates, and mixed literal families return `None`.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const stringLiteralValues = (schema: Field.AnySchema): Option<readonly [string, ...string[]]> =>
  collectStringLiteralValues(schema, selectSchemaOf);

const maxLengthFromCheck = (check: Check<unknown>): ReadonlyArray<number> => {
  const representation = check.annotations?.representation;
  const current =
    representation?.id === "effect/schema/isMaxLength" &&
    hasProperty(representation.payload, "maxLength") &&
    isNumber(representation.payload.maxLength)
      ? of(representation.payload.maxLength)
      : empty<number>();
  return isTagged(check, "FilterGroup") ? appendAll(current, flatMap(check.checks, maxLengthFromCheck)) : current;
};

const collectMaxLengths: {
  (visited: ReadonlyArray<AST>): (node: AST) => ReadonlyArray<number>;
  (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number>;
} = dual(2, (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number> => {
  if (some(visited, equals(node))) return empty();
  const nextVisited = append(visited, node);
  const collectNested = collectMaxLengths(nextVisited);
  const checks = fromUndefinedOr(node.checks).pipe(mapOption(flatMap(maxLengthFromCheck)), getOrElse(empty<number>));
  const encodings = fromUndefinedOr(node.encoding).pipe(
    mapOption(flatMap((link) => collectNested(link.to))),
    getOrElse(empty<number>)
  );
  const nested = matchType<AST>().pipe(
    withReturnType<ReadonlyArray<number>>(),
    matchTags({
      Union: ({ types }) => flatMap(types, collectNested),
      Suspend: (suspend) => collectNested(suspend.thunk()),
      Declaration: ({ typeParameters }) => flatMap(typeParameters, collectNested),
    }),
    matchOrElse(empty<number>)
  )(node);
  return appendAll(appendAll(checks, encodings), nested);
});

/**
 * Collect every installed `isMaxLength` bound on the encoded select schema.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const maxLengths = flow(selectSchemaOf, flow(getStruct("ast"), toEncoded), collectMaxLengths(empty()));

const exactLengthFromCheck = (check: Check<unknown>): ReadonlyArray<number> => {
  const representation = check.annotations?.representation;
  const current =
    representation?.id === "effect/schema/isLengthBetween" &&
    hasProperty(representation.payload, "minimum") &&
    isNumber(representation.payload.minimum) &&
    hasProperty(representation.payload, "maximum") &&
    isNumber(representation.payload.maximum) &&
    representation.payload.minimum === representation.payload.maximum
      ? of(representation.payload.minimum)
      : empty<number>();
  return isTagged(check, "FilterGroup") ? appendAll(current, flatMap(check.checks, exactLengthFromCheck)) : current;
};

const collectExactLengths: {
  (visited: ReadonlyArray<AST>): (node: AST) => ReadonlyArray<number>;
  (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number>;
} = dual(2, (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number> => {
  if (some(visited, equals(node))) return empty();
  const nextVisited = append(visited, node);
  const collectNested = collectExactLengths(nextVisited);
  const checks = fromUndefinedOr(node.checks).pipe(mapOption(flatMap(exactLengthFromCheck)), getOrElse(empty<number>));
  const encodings = fromUndefinedOr(node.encoding).pipe(
    mapOption(flatMap((link) => collectNested(link.to))),
    getOrElse(empty<number>)
  );
  const nested = matchType<AST>().pipe(
    withReturnType<ReadonlyArray<number>>(),
    matchTags({
      Union: ({ types }) => flatMap(types, collectNested),
      Suspend: (suspend) => collectNested(suspend.thunk()),
      Declaration: ({ typeParameters }) => flatMap(typeParameters, collectNested),
    }),
    matchOrElse(empty<number>)
  )(node);
  return appendAll(appendAll(checks, encodings), nested);
});

/**
 * Collect exact encoded string lengths installed with `isLengthBetween(n, n)`.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const exactLengths = flow(selectSchemaOf, flow(getStruct("ast"), toEncoded), collectExactLengths(empty()));
