/**
 * The BSL model class factory.
 *
 * `class User extends Bsl.Model<User>($I\`User\`)({ ... }) {}` produces an
 * Effect schema class (via BSL's own `VariantSchema.make` instance — the same
 * six variants as effect's `Model`, so `SqlModel.makeRepository` compatibility
 * stays structural) with `bsl` statics carrying the resolved SQL metadata.
 *
 * Whole-model invariants are enforced twice, at different altitudes:
 * - compile time: the `fields` parameter intersects `ValidateFields<F>`, so an
 *   underivable column or a second primary key fails on the offending key with
 *   a `~bsl.error` message literal;
 * - construction time: runtime checks mirror the same rules (nullable PK,
 *   multiple PKs) as tagged errors, catching hand-built field nodes.
 */
import { $ScratchpadId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { VariantSchema } from "effect/unstable/schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import type * as PgColumn from "./PgColumn.ts";
import type * as TableExtras from "./TableExtras.ts";

const $I = $ScratchpadId.create("bsl/factory");

export class ModelInvariantError extends TaggedErrorClass<ModelInvariantError>($I`ModelInvariantError`)(
  "ModelInvariantError",
  {
    message: S.String,
    fieldName: S.String,
  },
  $I.annote("ModelInvariantError", {
    description: "A BSL model declaration violates a SQL invariant.",
  })
) {}

// Audited boundary: VariantSchema requires the fixed family as a literal tuple;
// this assertion changes no runtime representation.
export const variants = ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"] as const;
export type Variant = (typeof variants)[number];

const V = VariantSchema.make({ variants, defaultVariant: "select" });

/** Re-exported variant helpers scoped to BSL's variant family. */
export const VariantField = V.Field;
export const FieldOnly = V.FieldOnly;
export const FieldExcept = V.FieldExcept;
export const fieldEvolve = V.fieldEvolve;
export const extract = V.extract;

export interface FieldsInput {
  readonly [key: string]: Field.Input;
}

// ---------------------------------------------------------------------------
// Resolved metadata (explicit meta + derivation + EntityId auto-references)
// ---------------------------------------------------------------------------

type AutoRef<I extends Field.Input> = Field.MetaFrom<I>["references"] extends Meta.References
  ? Field.MetaFrom<I>["references"]
  : Field.MetaFrom<I>["primaryKey"] extends true
    ? undefined
    : Derive.SelectSchemaOf<Field.SchemaFrom<I>> extends Derive.EntityIdLike & {
          readonly tableName: infer TableName extends string;
        }
      ? [Exclude<Field.EncodedOf<I>, null>] extends [number]
        ? Meta.References<TableName, "id">
        : undefined
      : undefined;

export type ResolvedMetaOf<I extends Field.Input> = Meta.Merge<
  Field.MetaFrom<I>,
  { readonly column: Derive.ResolvedColumn<I>; readonly references: AutoRef<I> }
>;

export type ColumnsOf<F extends FieldsInput> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K]>;
};

type PlainVariants<Sch extends S.Top, M extends Meta.Meta> = M["generated"] extends false
  ? VariantSchema.Field<{
      readonly select: Sch;
      readonly insert: M["hasDefault"] extends true ? S.optionalKey<Sch> : Sch;
      readonly update: S.optionalKey<Sch>;
      readonly json: Sch;
      readonly jsonCreate: Sch;
      readonly jsonUpdate: Sch;
    }>
  : VariantSchema.Field<{
      readonly select: Sch;
      readonly json: Sch;
      readonly jsonCreate: Sch;
      readonly jsonUpdate: Sch;
    }>;

/** Variant-aware schema after applying BSL's default/generated truth table. */
export type EffectiveSchema<I extends Field.Input> = Field.SchemaFrom<I> extends VariantSchema.Field<any>
  ? Field.SchemaFrom<I>
  : Field.SchemaFrom<I> extends S.Top
    ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
    : never;

export type UnwrappedFields<F extends FieldsInput> = {
  readonly [K in keyof F]: EffectiveSchema<F[K]>;
};

// ---------------------------------------------------------------------------
// Compile-time model validation (intersection validator)
// ---------------------------------------------------------------------------

type IsUnionInner<T, U> = T extends unknown ? ([U] extends [T] ? false : true) : never;
type IsUnion<T> = [T] extends [never] ? false : true extends IsUnionInner<T, T> ? true : false;

type PrimaryKeyKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["primaryKey"] extends true ? K : never;
}[keyof F];

/**
 * Per-key + whole-model compile-time validation. Success resolves each key to
 * `unknown` (a no-op intersection); violation resolves to a BslTypeError whose
 * message literal appears in the assignability failure on the offending key.
 */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: [Derive.ResolvedColumn<F[K]>] extends [never]
    ? Field.BslTypeError<"this field's encoded type does not derive a column — add explicit metadata (pg.integer, pg.timestamp, pg.bytea, ...)">
    : unknown;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.BslTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey in the extras callback">
  : unknown);

// ---------------------------------------------------------------------------
// The class type
// ---------------------------------------------------------------------------

export type MissingSelfGeneric =
  `Missing \`Self\` generic — use \`class Self extends Bsl.Model<Self>(identifier)({ ... }) {}\``;

export interface Statics<F extends FieldsInput> {
  readonly bsl: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}

export type ModelClass<Self, F extends FieldsInput> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  S.Struct<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & {
  readonly [Va in Variant]: VariantSchema.Extract<Va, VariantSchema.Struct<UnwrappedFields<F>>>;
} & Statics<F>;

/** Structural bound for anything the table projector accepts. */
export interface AnyModel {
  readonly bsl: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta>;
    readonly extras: ((columns: never) => ReadonlyArray<TableExtras.Node>) | undefined;
  };
}

// ---------------------------------------------------------------------------
// Runtime factory
// ---------------------------------------------------------------------------

const deriveTableName = (identifier: string): string => {
  const segments = identifier.split("/");
  const last = segments[segments.length - 1] ?? identifier;
  return Str.snakeCase(last);
};

const resolveReferences = (
  meta: Meta.Meta,
  select: unknown
): Meta.References | undefined => {
  if (meta.references !== undefined) return meta.references;
  if (meta.primaryKey) return undefined;
  if (Derive.isEntityIdLike(select)) {
    return {
      tableName: select.tableName,
      columnName: "id",
      onDelete: undefined,
      onUpdate: undefined,
    };
  }
  return undefined;
};

const effectiveSchema = (schema: Field.AnySchema, meta: Meta.Meta): Field.AnySchema => {
  if (VariantSchema.isField(schema)) return schema;
  if (meta.generated !== false) {
    return V.Field({
      select: schema,
      json: schema,
      jsonCreate: schema,
      jsonUpdate: schema,
    });
  }
  return V.Field({
    select: schema,
    insert: meta.hasDefault ? S.optionalKey(schema) : schema,
    update: S.optionalKey(schema),
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};

export const Model =
  <Self = never>(identifier: string) =>
  <const F extends FieldsInput>(
    fields: F & ValidateFields<F>,
    annotationsOrExtras?: S.Annotations.Annotations | TableExtras.Callback<F>
  ): [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F> => {
    const fieldRecord: FieldsInput = fields;
    const tableName = deriveTableName(identifier);
    const schemaFields: Record<string, Field.AnySchema> = {};
    const columns: Record<string, Meta.Meta> = {};
    let primaryKeys = 0;
    const extras = P.isFunction(annotationsOrExtras) ? annotationsOrExtras : undefined;
    const annotations = P.isFunction(annotationsOrExtras) ? undefined : annotationsOrExtras;

    for (const key of Object.keys(fieldRecord)) {
      const f = Field.from(fieldRecord[key]!);
      const select = Derive.selectSchemaOf(f.schema);
      const classified =
        f.meta.column !== undefined
          ? { column: f.meta.column, nullable: Derive.isNullable(f.schema) }
          : Derive.classify(f.schema, key);
      if (f.meta.primaryKey) {
        primaryKeys += 1;
        if (classified.nullable) {
          throw ModelInvariantError.make({
            message: `Primary key '${key}' derives a nullable encoded representation.`,
            fieldName: key,
          });
        }
      }
      const identityKinds: ReadonlyArray<PgColumn.Kind> = ["integer", "smallint", "bigint"];
      if (f.meta.identity !== false && !identityKinds.includes(classified.column.kind)) {
        throw ModelInvariantError.make({
          message: `Identity on '${key}' requires an integer-family column, got '${classified.column.kind}'.`,
          fieldName: key,
        });
      }
      if (f.meta.generated !== false && (f.meta.hasDefault || f.meta.default !== undefined)) {
        throw ModelInvariantError.make({
          message: `Field '${key}' cannot be both defaulted and generated.`,
          fieldName: key,
        });
      }
      if (classified.column.kind === "varchar") {
        const varcharLength = classified.column.length;
        const incompatible = Derive.maxLengths(f.schema).find(
          (maxLength) => maxLength > varcharLength
        );
        if (incompatible !== undefined) {
          throw ModelInvariantError.make({
            message: `varchar(${varcharLength}) on '${key}' is narrower than schema maxLength ${incompatible}.`,
            fieldName: key,
          });
        }
      }
      const resolvedMeta = Meta.merge(f.meta, {
        column: classified.column,
        references: resolveReferences(f.meta, select),
      });
      columns[key] = resolvedMeta;
      schemaFields[key] = effectiveSchema(f.schema, resolvedMeta);
    }

    if (primaryKeys > 1) {
      throw ModelInvariantError.make({
        message: `Model '${identifier}' declares ${primaryKeys} inline primary keys; use Table.compositePrimaryKey in the extras callback.`,
        fieldName: "(model)",
      });
    }

    // Audited boundary: schemaFields is keywise EffectiveSchema of F, the
    // variant factory validates it at runtime, and Object.assign attaches the
    // exact bsl statics built above; TS cannot see through those dynamic class
    // construction operations.
    const Base = V.Class<Self>(identifier)(schemaFields as never, annotations as never);
    Object.assign(Base as object, { bsl: { tableName, fields: fieldRecord, columns, extras } });
    // Audited boundary: the returned class is exactly ModelClass<Self, F> by
    // construction (variant class + bsl statics); the conditional return type
    // cannot be proven inside the generic body.
    return Base as unknown as [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
  };
