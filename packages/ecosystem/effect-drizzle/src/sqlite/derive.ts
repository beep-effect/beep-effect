/**
 * SQLite column derivation from encoded Effect schema carriers.
 *
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- pg/sqlite are deliberately mirrored dialect implementations; shared logic lives in src/core and the remaining parallelism is per-dialect vocabulary that must evolve independently (doc 14 family; review at next dialect addition)
import { every, filter, some } from "effect/Array";
import { dual } from "effect/Function";
import { none, some as someOption } from "effect/Option";
import { isTagged } from "effect/Predicate";
import { isSchema } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import { VariantSchema } from "effect/unstable/schema";
import { classify as classifyCore, DeriveColumnError, flattenEncoded } from "../core/classification.ts";
import { EntityIdLike as EntityIdLikeSchema, isEntityIdLike } from "../core/entity-id.ts";
import { stringLiteralValues as collectStringLiteralValues } from "../core/literals.ts";
import * as SqliteColumn from "./Column.ts";
import type { Top } from "effect/Schema";
import type { EntityIdLike as EntityIdLikeType } from "../core/entity-id.ts";
import type * as Field from "../core/Field.ts";

/** Internal shared derivation error and EntityId guard re-exports.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export { DeriveColumnError, isEntityIdLike };
/**
 * SQLite derivation view of the dialect-neutral EntityId static schema.
 *
 * @internal
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
type JsonCarrier = ReadonlyArray<unknown> | { readonly [key: string]: unknown };

/**
 * Select-side schema type of a plain schema or variant field.
 *
 * @category models
 * @since 0.0.0
 */
export type SelectSchemaOf<Sch> =
  Sch extends VariantSchema.Field<infer Config>
    ? Config extends { readonly select: infer Select }
      ? Select
      : never
    : Sch;

type DeriveFromEncoded<E> =
  IsAny<E> extends true
    ? never
    : [E] extends [never]
      ? never
      : [E] extends [string]
        ? SqliteColumn.Text<"text">
        : [E] extends [boolean]
          ? SqliteColumn.Integer<"boolean", "integer">
          : [E] extends [bigint]
            ? SqliteColumn.Blob<"bigint">
            : [E] extends [number]
              ? SqliteColumn.Real
              : E extends ReadonlyArray<unknown>
                ? SqliteColumn.Text<"json">
                : E extends { readonly [key: string]: unknown }
                  ? SqliteColumn.Text<"json">
                  : never;

/**
 * Require every non-null encoded member to be an array or string-keyed record.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const isStructuralJson = (schema: Field.AnySchema): boolean => {
  const members = filter(
    flattenEncoded(toEncoded(selectSchemaOf(schema).ast), "(unknown)"),
    (member) => member._tag !== "Null"
  );
  return members.length > 0 && every(members, (member) => member._tag === "Objects" || member._tag === "Arrays");
};

/**
 * Structural JSON carrier shared by SQLite JSON-mode combinator constraints.
 *
 * @category models
 * @since 0.0.0
 */
export type StructuralJson = JsonCarrier;

/** SQLite descriptor derived from an encoded carrier, or `never` when ambiguous. */
type Derived<I extends Field.Input> =
  SelectSchemaOf<Field.SchemaFrom<I>> extends EntityIdLike & {
    readonly tableName: infer TableName extends string;
  }
    ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
      ? SqliteColumn.Integer<"number", SqliteColumn.EntityIdIdent<TableName>>
      : never
    : DeriveFromEncoded<Exclude<Field.EncodedOf<I>, null>>;

/**
 * Explicit SQLite descriptor when present, otherwise the derived descriptor.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolvedColumn<I extends Field.Input> = Field.MetaFrom<I>["column"] extends undefined
  ? Derived<I>
  : Field.MetaFrom<I>["column"] extends SqliteColumn.Spec
    ? Field.MetaFrom<I>["column"]
    : Exclude<Field.MetaFrom<I>["column"], undefined> extends {
          readonly dialect: infer Dialect;
        }
      ? string extends Dialect
        ? Derived<I>
        : never
      : never;

/**
 * Return the database/select schema of a plain schema or variant field.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
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

/**
 * Derive one SQLite descriptor and its encoded nullability.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
type Classified = { readonly column: SqliteColumn.Spec; readonly nullable: boolean };

export const classify: {
  (fieldName: string): (schema: Field.AnySchema) => Classified;
  (schema: Field.AnySchema, fieldName: string): Classified;
} = /* @__PURE__ */ dual(
  2,
  (schema: Field.AnySchema, fieldName: string): Classified =>
    classifyCore(schema, fieldName, {
      selectSchemaOf,
      entityTableName: (select) => (isEntityIdLike(select) ? someOption(select.tableName) : none()),
      entityColumn: (tableName) => SqliteColumn.Integer.make({ mode: "number", ident: `entityId<"${tableName}">` }),
      fromSchemaAST: SqliteColumn.Spec.fromSchemaAST,
    })
);

/**
 * Test encoded select nullability.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const isNullable = (schema: Field.AnySchema): boolean =>
  some(flattenEncoded(toEncoded(selectSchemaOf(schema).ast), "(unknown)"), isTagged("Null"));

/**
 * Collect the finite encoded literal union used by SQLite enum checks.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const stringLiteralValues = (schema: Field.AnySchema) => collectStringLiteralValues(schema, selectSchemaOf);
