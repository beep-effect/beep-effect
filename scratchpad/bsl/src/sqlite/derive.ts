/** SQLite column derivation from encoded Effect schema carriers. */
import { every, filter, some } from "effect/Array";
import { none, some as someOption } from "effect/Option";
import { isTagged } from "effect/Predicate";
import { isSchema } from "effect/Schema";
import type { Top } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import type * as Field from "../core/Field.ts";
import {
  classify as classifyCore,
  DeriveColumnError,
  flattenEncoded,
} from "../core/classification.ts";
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
/** @internal */
export const EntityIdLike = EntityIdLikeSchema;
/**
 * Static EntityId metadata consumed by SQLite derivation.
 *
 * @category models
 * @since 0.0.0
 */
/** @internal */
export type EntityIdLike = EntityIdLikeType;

type IsAny<T> = 0 extends 1 & T ? true : false;
type JsonCarrier = ReadonlyArray<unknown> | { readonly [key: string]: unknown };

/** Select-side schema type of a plain schema or variant field. */
/** @internal */
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
  : E extends ReadonlyArray<unknown> ? SqliteColumn.Text<"json">
  : E extends { readonly [key: string]: unknown } ? SqliteColumn.Text<"json">
  : never;

/** Require every non-null encoded member to be an array or string-keyed record. */
/** @internal */
export const isStructuralJson = (schema: Field.AnySchema): boolean => {
  const members = filter(
    flattenEncoded(toEncoded(selectSchemaOf(schema).ast), "(unknown)"),
    (member) => member._tag !== "Null",
  );
  return members.length > 0 && every(members, (member) => member._tag === "Objects" || member._tag === "Arrays");
};

/** Structural JSON carrier shared by SQLite JSON-mode combinator constraints. */
/** @internal */
export type StructuralJson = JsonCarrier;

/** SQLite descriptor derived from an encoded carrier, or `never` when ambiguous. */
/** @internal */
export type Derived<I extends Field.Input> =
  SelectSchemaOf<Field.SchemaFrom<I>> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
      ? SqliteColumn.Integer<"number", SqliteColumn.EntityIdIdent<TableName>>
      : never
    : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/** Explicit SQLite descriptor when present, otherwise the derived descriptor. */
/** @internal */
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
/** @internal */
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
/** @internal */
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
/** @internal */
export const isNullable = (schema: Field.AnySchema): boolean =>
  some(flattenEncoded(toEncoded(selectSchemaOf(schema).ast), "(unknown)"), isTagged("Null"));

/** Collect the finite encoded literal union used by SQLite enum checks. */
/** @internal */
export const stringLiteralValues = (schema: Field.AnySchema) =>
  collectStringLiteralValues(schema, selectSchemaOf);
