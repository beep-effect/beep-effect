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
 */
import { flow } from "effect/Function";
import {
  orElse as matchOrElse,
  tags as matchTags,
  type as matchType,
  withReturnType,
} from "effect/Match";
import {
  append,
  appendAll,
  empty,
  every,
  filter,
  flatMap,
  getSomes,
  head,
  isReadonlyArrayNonEmpty,
  map,
  match,
  of,
  range,
  reduce,
  some,
} from "effect/Array";
import { equals } from "effect/Equal";
import { constFalse, constTrue, dual } from "effect/Function";
import {
  flatMap as flatMapOption,
  fromUndefinedOr,
  getOrElse,
  map as mapOption,
  none,
  some as someOption,
} from "effect/Option";
import type { Option } from "effect/Option";
import { Struct as StructPredicate, hasProperty, isNumber, isString, isTagged, not } from "effect/Predicate";
import { isSchema } from "effect/Schema";
import type { Top } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import type { AST, Check, Suspend } from "effect/SchemaAST";
import { get as getStruct } from "effect/Struct";
import { VariantSchema } from "effect/unstable/schema";
import type * as Field from "../core/Field.ts";
import { classify as classifyCore, DeriveColumnError } from "../core/classification.ts";
import {
  EntityIdLike as EntityIdLikeSchema,
  isEntityIdLike,
  type EntityIdLike as EntityIdLikeType,
} from "../core/entity-id.ts";
import * as PgColumn from "./Column.ts";

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
  Sch extends VariantSchema.Field<infer Config>
    ? Config extends { readonly select: infer Sel }
      ? Sel
      : never
    : Sch;

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
                  : [E] extends [object]
                    ? PgColumn.Jsonb
                    : never;

/**
 * The column spec a bare Input derives, or `never` when derivation is
 * ambiguous and explicit metadata is required.
 *
 * @category models
 * @since 0.0.0
 */
export type Derived<I extends Field.Input> =
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
export type ResolvedColumn<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends undefined
    ? Derived<I>
    : Field.MetaFrom<I>["column"] extends PgColumn.Spec
      ? Field.MetaFrom<I>["column"]
      : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
            readonly dialect: infer Dialect;
          }
        ? string extends Dialect ? Derived<I> : never
        : never;

// ---------------------------------------------------------------------------
// Runtime derivation (mirrors the type-level policy exactly)
// ---------------------------------------------------------------------------

/**
 * Return the select-side schema used as the database representation.
 *
 * @category getters
 * @since 0.0.0
 */
export const selectSchemaOf = (schema: Field.AnySchema): Top => {
  if (VariantSchema.isField(schema)) {
    const select: unknown = schema.schemas["select"];
    if (isSchema(select)) return select;
    throw DeriveColumnError.make({
      message:
        "Variant field has no select schema; the select variant is the database row representation.",
      fieldName: "(unknown)",
      astTag: "VariantField",
    });
  }
  return schema;
};

/**
 * Derive `{ column, nullable }` for a field input from its encoded AST.
 * Explicit metadata should be consulted first; this is the bare-schema path
 * and the nullability oracle for both paths.
 *
 * @category getters
 * @since 0.0.0
 */
export const classify = (
  schema: Field.AnySchema,
  fieldName: string,
): { readonly column: PgColumn.Spec; readonly nullable: boolean } =>
  classifyCore(schema, fieldName, {
    selectSchemaOf,
    entityTableName: (select) => (isEntityIdLike(select) ? someOption(select.tableName) : none()),
    entityColumn: (tableName) => PgColumn.Integer.make({ ident: `entityId<"${tableName}">` }),
    fromSchemaAST: PgColumn.Spec.fromSchemaAST,
  });

const fail = (fieldName: string, astTag: string, message: string): never => {
  throw DeriveColumnError.make({ message, fieldName, astTag });
};

/**
 * Test nullability of a field input's encoded select representation.
 *
 * @category guards
 * @since 0.0.0
 */
export const isNullable = flow(
  selectSchemaOf,
  flow(getStruct("ast"), toEncoded),
  matchType<AST>().pipe(
    withReturnType<boolean>(),
    matchTags({
      Union: StructPredicate({
        types: some(isTagged("Null")),
      }),
      Null: constTrue,
    }),
    matchOrElse(constFalse),
  ),
);

const nonNullEncodedAST = (schema: Field.AnySchema): AST => {
  const encoded = toEncoded(selectSchemaOf(schema).ast);
  if (!isTagged(encoded, "Union")) return encoded;
  if (!some(encoded.types, isTagged("Null"))) return encoded;
  const members = filter(encoded.types, not(isTagged("Null")));
  return getOrElse(head(members), () =>
    fail(
      "(unknown)",
      encoded._tag,
      "An array schema must retain one encoded member after stripping null.",
    ),
  );
};

/**
 * Resolve the scalar encoded AST under an exact PostgreSQL array depth.
 *
 * @category getters
 * @since 0.0.0
 */
export const arrayElementAST = (
  schema: Field.AnySchema,
  dimensions: Exclude<PgColumn.ArrayDimension, 0>,
): AST => {
  const current = reduce(range(1, dimensions), nonNullEncodedAST(schema), (node) => {
    if (isTagged(node, "Arrays")) {
      if (isReadonlyArrayNonEmpty(node.elements) || node.rest.length !== 1) {
        fail(
          "(unknown)",
          node._tag,
          `pg.array expected one homogeneous encoded element at depth ${dimensions}.`,
        );
      }
      return getOrElse(head(node.rest), () =>
        fail(
          "(unknown)",
          node._tag,
          `pg.array expected an encoded ReadonlyArray at depth ${dimensions}.`,
        ),
      );
    }
    return fail(
      "(unknown)",
      node._tag,
      `pg.array expected an encoded ReadonlyArray at depth ${dimensions}.`,
    );
  });
  if (isTagged(current, "Arrays")) {
    fail(
      "(unknown)",
      current._tag,
      `pg.array encoded depth exceeds the declared depth ${dimensions}.`,
    );
  }
  return current;
};

/**
 * Return the non-null encoded AST used by a scalar element declaration.
 *
 * @category getters
 * @since 0.0.0
 */
export const encodedAST = flow(selectSchemaOf, flow(getStruct("ast"), toEncoded));

const stringLiteralsFromAST = (
  node: AST,
  visited: ReadonlyArray<Suspend> = empty(),
): Option<ReadonlyArray<string>> =>
  matchType<AST>().pipe(
    withReturnType<Option<ReadonlyArray<string>>>(),
    matchTags({
      Literal: ({ literal }) => (isString(literal) ? someOption(of(literal)) : none()),
      Null: () => someOption(empty()),
      Enum: ({ enums }) =>
        every(enums, ([, value]) => isString(value))
          ? someOption(
              getSomes(map(enums, ([, value]) => (isString(value) ? someOption(value) : none()))),
            )
          : none(),
      Union: ({ types }) =>
        reduce(types, someOption<ReadonlyArray<string>>(empty()), (values, member) =>
          flatMapOption(values, (current) =>
            mapOption(stringLiteralsFromAST(member, visited), (next) => appendAll(current, next)),
          ),
        ),
      Suspend: (suspend) =>
        some(visited, equals(suspend))
          ? none()
          : stringLiteralsFromAST(suspend.thunk(), append(visited, suspend)),
    }),
    matchOrElse(() => none()),
  )(node);

/**
 * Collect a finite non-empty union of encoded string literals.
 *
 * **Details**
 *
 * Nullable literal schemas are accepted after stripping `null`; broad strings,
 * templates, and mixed literal families return `None`.
 *
 * @category getters
 * @since 0.0.0
 */
export const stringLiteralValues = (
  schema: Field.AnySchema,
): Option<readonly [string, ...string[]]> =>
  flatMapOption(stringLiteralsFromAST(toEncoded(selectSchemaOf(schema).ast)), (values) =>
    match(values, {
      onEmpty: none,
      onNonEmpty: someOption,
    }),
  );

const maxLengthFromCheck = (check: Check<unknown>): ReadonlyArray<number> => {
  const representation = check.annotations?.representation;
  const current =
    representation?.id === "effect/schema/isMaxLength" &&
    hasProperty(representation.payload, "maxLength") &&
    isNumber(representation.payload.maxLength)
      ? of(representation.payload.maxLength)
      : empty<number>();
  return isTagged(check, "FilterGroup")
    ? appendAll(current, flatMap(check.checks, maxLengthFromCheck))
    : current;
};

const collectMaxLengths: {
  (visited: ReadonlyArray<AST>): (node: AST) => ReadonlyArray<number>;
  (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number>;
} = dual(2, (node: AST, visited: ReadonlyArray<AST>): ReadonlyArray<number> => {
  if (some(visited, equals(node))) return empty();
  const nextVisited = append(visited, node);
  const collectNested = collectMaxLengths(nextVisited);
  const checks = fromUndefinedOr(node.checks).pipe(
    mapOption(flatMap(maxLengthFromCheck)),
    getOrElse(empty<number>),
  );
  const encodings = fromUndefinedOr(node.encoding).pipe(
    mapOption(flatMap((link) => collectNested(link.to))),
    getOrElse(empty<number>),
  );
  const nested = matchType<AST>().pipe(
    withReturnType<ReadonlyArray<number>>(),
    matchTags({
      Union: ({ types }) => flatMap(types, collectNested),
      Suspend: (suspend) => collectNested(suspend.thunk()),
      Declaration: ({ typeParameters }) => flatMap(typeParameters, collectNested),
    }),
    matchOrElse(empty<number>),
  )(node);
  return appendAll(appendAll(checks, encodings), nested);
});

/**
 * Collect every installed `isMaxLength` bound on the encoded select schema.
 *
 * @category getters
 * @since 0.0.0
 */
export const maxLengths = flow(
  selectSchemaOf,
  flow(getStruct("ast"), toEncoded),
  collectMaxLengths(empty()),
);
