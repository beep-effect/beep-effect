/** SQLite column derivation from encoded Effect schema carriers. */
import { flow } from "effect/Function";
import {
  orElse as matchOrElse,
  tags as matchTags,
  type as matchType,
  withReturnType,
} from "effect/Match";
import { some } from "effect/Array";
import { none, some as someOption } from "effect/Option";
import { Struct as StructPredicate, isTagged } from "effect/Predicate";
import { isSchema } from "effect/Schema";
import type { Top } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import type { AST } from "effect/SchemaAST";
import { get } from "effect/Struct";
import { VariantSchema } from "effect/unstable/schema";
import type * as Field from "../core/Field.ts";
import { classify as classifyCore, DeriveColumnError } from "../core/classification.ts";
import {
  EntityIdLike as EntityIdLikeSchema,
  isEntityIdLike,
  type EntityIdLike as EntityIdLikeType,
} from "../core/entity-id.ts";
import { stringLiteralValues as collectStringLiteralValues } from "../core/literals.ts";
import * as SqliteColumn from "./Column.ts";

export { DeriveColumnError, isEntityIdLike };
/**
 * SQLite derivation view of the dialect-neutral EntityId static schema.
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdLike = EntityIdLikeSchema;
/**
 * Static EntityId metadata consumed by SQLite derivation.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdLike = EntityIdLikeType;

type IsAny<T> = 0 extends 1 & T ? true : false;

/** Select-side schema type of a plain schema or variant field. */
export type SelectSchemaOf<Sch> =
  Sch extends VariantSchema.Field<infer Config>
    ? Config extends { readonly select: infer Select } ? Select : never
    : Sch;

type DeriveFromEncoded<E> =
  IsAny<E> extends true ? never
  : [E] extends [never] ? never
  : [E] extends [string] ? SqliteColumn.Text<"text">
  : [E] extends [boolean] ? SqliteColumn.Integer<"boolean", "integer">
  : [E] extends [bigint] ? SqliteColumn.Blob<"bigint">
  : [E] extends [number] ? SqliteColumn.Real
  : [E] extends [Date] ? never
  : [E] extends [Uint8Array] ? never
  : [E] extends [object] ? SqliteColumn.Text<"json">
  : never;

/** SQLite descriptor derived from an encoded carrier, or `never` when ambiguous. */
export type Derived<I extends Field.Input> =
  SelectSchemaOf<Field.SchemaFrom<I>> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
      ? SqliteColumn.Integer<"number", SqliteColumn.EntityIdIdent<TableName>>
      : never
    : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/** Explicit SQLite descriptor when present, otherwise the derived descriptor. */
export type ResolvedColumn<I extends Field.Input> =
  Field.MetaFrom<I>["column"] extends undefined
    ? Derived<I>
    : Field.MetaFrom<I>["column"] extends SqliteColumn.Spec
      ? Field.MetaFrom<I>["column"]
      : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
            readonly dialect: infer Dialect;
          }
        ? string extends Dialect ? Derived<I> : never
        : never;

/** Return the database/select schema of a plain schema or variant field. */
export const selectSchemaOf = (schema: Field.AnySchema): Top => {
  if (VariantSchema.isField(schema)) {
    const select: unknown = schema.schemas.select;
    if (isSchema(select)) return select;
    throw DeriveColumnError.make({
      message: "Variant field has no select schema.",
      fieldName: "(unknown)",
      astTag: "VariantField",
    });
  }
  return schema;
};

/** Derive one SQLite descriptor and its encoded nullability. */
export const classify = (
  schema: Field.AnySchema,
  fieldName: string,
): { readonly column: SqliteColumn.Spec; readonly nullable: boolean } =>
  classifyCore(schema, fieldName, {
    selectSchemaOf,
    entityTableName: (select) => isEntityIdLike(select) ? someOption(select.tableName) : none(),
    entityColumn: (tableName) =>
      SqliteColumn.Integer.make({ mode: "number", ident: `entityId<"${tableName}">` }),
    fromSchemaAST: SqliteColumn.Spec.fromSchemaAST,
  });

/** Test encoded select nullability. */
export const isNullable = flow(
  selectSchemaOf,
  flow(get("ast"), toEncoded),
  matchType<AST>().pipe(
    withReturnType<boolean>(),
    matchTags({
      Union: StructPredicate({ types: some(isTagged("Null")) }),
      Null: () => true,
    }),
    matchOrElse(() => false),
  ),
);

/** Collect the finite encoded literal union used by SQLite enum checks. */
export const stringLiteralValues = (schema: Field.AnySchema) =>
  collectStringLiteralValues(schema, selectSchemaOf);
