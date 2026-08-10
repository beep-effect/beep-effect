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
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { VariantSchema } from "effect/unstable/schema";
import * as Derive from "./derive.ts";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import * as PgColumn from "./PgColumn.ts";
import type * as TableExtras from "./TableExtras.ts";

const $I = $ScratchpadId.create("bsl/factory");

/**
 * Error raised when resolved model metadata violates a BSL invariant.
 *
 * **Example** (Construct a model invariant error)
 *
 * ```ts
 * import { ModelInvariantError } from "./factory.ts"
 *
 * const error = ModelInvariantError.make({ message: "invalid primary key", fieldName: "id" })
 * console.log(error._tag) // "ModelInvariantError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelInvariantError extends TaggedErrorClass<ModelInvariantError>(
  $I`ModelInvariantError`
)(
  "ModelInvariantError",
  {
    message: S.String,
    fieldName: S.String,
  },
  $I.annote("ModelInvariantError", {
    description: "A BSL model declaration violates a SQL invariant.",
  })
) {}

/**
 * Fixed BSL model-variant domain.
 *
 * **Example** (Check a model variant)
 *
 * ```ts
 * import { Variant } from "./factory.ts"
 *
 * console.log(Variant.is.select("select")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Variant = LiteralKit([
  "select",
  "insert",
  "update",
  "json",
  "jsonCreate",
  "jsonUpdate",
]).pipe(
  $I.annoteSchema("Variant", {
    description:
      "Fixed BSL model variant family shared by schema construction and extraction.",
  })
);
/**
 * Model-variant literal represented by {@link Variant}.
 *
 * @category models
 * @since 0.0.0
 */
export type Variant = typeof Variant.Type;

/**
 * Ordered literal tuple supplied to the Effect variant factory.
 *
 * **Example** (Read configured variants)
 *
 * ```ts
 * import { variants } from "./factory.ts"
 *
 * console.log(variants[0]) // "select"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const variants = Variant.Options;

const V = VariantSchema.make({ variants, defaultVariant: Variant.Enum.select });

/**
 * Build an explicitly variant-specific BSL field.
 *
 * **Example** (Define select and insert schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VariantField } from "./factory.ts"
 *
 * const field = VariantField({ select: S.String, insert: S.String })
 * console.log(field.schemas.select === S.String) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const VariantField = V.Field;

/**
 * Include one schema only in the selected BSL variants.
 *
 * **Example** (Create a select-only field)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FieldOnly } from "./factory.ts"
 *
 * const field = S.String.pipe(FieldOnly(["select"]))
 * console.log(field.schemas.select === S.String) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const FieldOnly = V.FieldOnly;

/**
 * Include one schema in every BSL variant except the selected variants.
 *
 * **Example** (Omit a generated field from writes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FieldExcept } from "./factory.ts"
 *
 * const field = S.String.pipe(FieldExcept(["insert", "update"]))
 * console.log(field.schemas.insert) // undefined
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const FieldExcept = V.FieldExcept;

/**
 * Evolve selected schemas of a plain or variant-aware field.
 *
 * **Example** (Allow null in the update schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { fieldEvolve } from "./factory.ts"
 *
 * const field = fieldEvolve(S.String, { update: (schema) => S.NullOr(schema) })
 * console.log(field.schemas.update !== undefined) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const fieldEvolve = V.fieldEvolve;

/**
 * Extract one BSL variant from a variant-aware struct.
 *
 * **Example** (Inspect the extractor)
 *
 * ```ts
 * import { extract } from "./factory.ts"
 *
 * console.log(typeof extract("select")) // "function"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const extract = V.extract;

/**
 * String-keyed field declaration accepted by the BSL model factory.
 *
 * **Example** (Declare a field record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { FieldsInput } from "./factory.ts"
 *
 * const fields: FieldsInput = { name: S.String }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FieldsInput {
  readonly [key: string]: Field.Input;
}

// ---------------------------------------------------------------------------
// Resolved metadata (explicit meta + derivation + EntityId auto-references)
// ---------------------------------------------------------------------------

type AutoRef<I extends Field.Input> =
  Field.MetaFrom<I>["references"] extends Meta.References
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

/**
 * Metadata after column derivation and automatic reference resolution.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolvedMetaOf<
  I extends Field.Input,
  Key extends string = string
> = Meta.Merge<
  Field.MetaFrom<I>,
  {
    readonly column: PgColumn.ResolveName<Derive.ResolvedColumn<I>, Key>;
    readonly references: AutoRef<I>;
  }
>;

/**
 * Key-preserving resolved metadata record for a field declaration.
 *
 * @category models
 * @since 0.0.0
 */
export type ColumnsOf<F extends FieldsInput> = {
  readonly [K in keyof F]: ResolvedMetaOf<F[K], K & string>;
};

type PlainVariants<
  Sch extends S.Top,
  M extends Meta.Meta
> = M["version"] extends true
  ? VariantSchema.Field<{
      readonly select: Sch;
      readonly insert: S.optionalKey<Sch>;
      readonly update: Sch;
      readonly json: Sch;
      readonly jsonCreate: Sch;
      readonly jsonUpdate: Sch;
    }>
  : M["generated"] extends false
  ? VariantSchema.Field<{
      readonly select: Sch;
      readonly insert: M["hasDefault"] extends true ? S.optionalKey<Sch> : Sch;
      readonly update: S.optionalKey<Sch>;
      readonly json: Sch;
      readonly jsonCreate: Sch;
      readonly jsonUpdate: Sch;
    }>
  : M["generated"] extends Meta.GeneratedIdentityAlways
  ? VariantSchema.Field<{
      readonly select: Sch;
      readonly update: Sch;
      readonly json: Sch;
    }>
  : VariantSchema.Field<{
      readonly select: Sch;
      readonly json: Sch;
    }>;

/**
 * Variant-aware schema after applying BSL's default and generated truth table.
 *
 * @category models
 * @since 0.0.0
 */
export type EffectiveSchema<I extends Field.Input> =
  Field.SchemaFrom<I> extends VariantSchema.Field.Any
    ? Field.SchemaFrom<I>
    : Field.SchemaFrom<I> extends S.Top
    ? PlainVariants<Field.SchemaFrom<I>, ResolvedMetaOf<I>>
    : never;

/**
 * Effective variant-aware schema record derived from a BSL field record.
 *
 * **Example** (Unwrap model fields)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { UnwrappedFields } from "./factory.ts"
 *
 * type Fields = UnwrappedFields<{ readonly name: typeof S.String }>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnwrappedFields<F extends FieldsInput> = {
  readonly [K in keyof F]: EffectiveSchema<F[K]>;
};

// ---------------------------------------------------------------------------
// Compile-time model validation (intersection validator)
// ---------------------------------------------------------------------------

type IsUnionInner<T, U> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;
type IsUnion<T> = [T] extends [never]
  ? false
  : true extends IsUnionInner<T, T>
  ? true
  : false;

type PrimaryKeyKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["primaryKey"] extends true ? K : never;
}[keyof F];

type VersionKeys<F extends FieldsInput> = {
  [K in keyof F]: Field.MetaFrom<F[K]>["version"] extends true ? K : never;
}[keyof F];

type ValidateVersionField<I extends Field.Input> = Field.MetaFrom<I>["version"] extends true
  ? Field.MetaFrom<I>["column"] extends {
      readonly kind: PgColumn.IdentityKind;
    }
    ? Field.MetaFrom<I>["generated"] extends false
      ? Field.MetaFrom<I>["identity"] extends false
        ? unknown
        : Field.BslTypeError<"version fields cannot use identity generation">
      : Field.BslTypeError<"version fields cannot be generated">
    : Field.BslTypeError<"version fields require an explicit integer-family column">
  : unknown;

/**
 * Per-key and whole-model compile-time validation for a field record.
 *
 * **Details**
 *
 * Success resolves each key to `unknown`; a violation resolves to a
 * `BslTypeError` whose literal message appears on the offending key.
 *
 * **Example** (Validate a model field record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { ValidateFields } from "./factory.ts"
 *
 * type Valid = ValidateFields<{ readonly name: typeof S.String }>
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type ValidateFields<F extends FieldsInput> = {
  readonly [K in keyof F]: [Derive.ResolvedColumn<F[K]>] extends [never]
    ? Field.BslTypeError<"this field's encoded type does not derive a column — add explicit metadata (pg.integer, pg.timestamp, pg.bytea, ...)">
    : ValidateVersionField<F[K]>;
} & (IsUnion<PrimaryKeyKeys<F>> extends true
  ? Field.BslTypeError<"model declares multiple inline primary keys — use Table.compositePrimaryKey in the extras callback">
  : unknown) &
  (IsUnion<VersionKeys<F>> extends true
    ? Field.BslTypeError<"model declares multiple optimistic-version fields">
    : unknown);

// ---------------------------------------------------------------------------
// The class type
// ---------------------------------------------------------------------------

/**
 * Compile-time diagnostic returned when {@link Model} omits its self type.
 *
 * **Example** (Inspect the diagnostic)
 *
 * ```ts
 * import type { MissingSelfGeneric } from "./factory.ts"
 *
 * declare const diagnostic: MissingSelfGeneric
 * console.log(diagnostic)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type MissingSelfGeneric =
  `Missing \`Self\` generic — use \`class Self extends Bsl.Model<Self>(identifier)({ ... }) {}\``;

/**
 * BSL metadata statics attached to every generated model class.
 *
 * **Example** (Read model statics)
 *
 * ```ts
 * import type { FieldsInput, Statics } from "./factory.ts"
 *
 * declare const model: Statics<FieldsInput>
 * console.log(model.bsl.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Statics<F extends FieldsInput> {
  readonly bsl: {
    readonly tableName: string;
    readonly fields: F;
    readonly columns: ColumnsOf<F>;
    readonly extras: TableExtras.Callback<F> | undefined;
  };
}

/**
 * Complete Effect variant class plus the BSL statics for a field record.
 *
 * **Example** (Name a generated model type)
 *
 * ```ts
 * import type { FieldsInput, ModelClass } from "./factory.ts"
 *
 * type Generated = ModelClass<object, FieldsInput>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ModelClass<Self, F extends FieldsInput> = VariantSchema.Class<
  Self,
  UnwrappedFields<F>,
  S.Struct<VariantSchema.ExtractFields<"select", UnwrappedFields<F>, true>>
> & {
  readonly [Va in Variant]: VariantSchema.Extract<
    Va,
    VariantSchema.Struct<UnwrappedFields<F>>
  >;
} & Statics<F>;

/**
 * Structural bound accepted by the table and cross-model projectors.
 *
 * **Example** (Accept any BSL model)
 *
 * ```ts
 * import type { AnyModel } from "./factory.ts"
 *
 * const tableName = (model: AnyModel) => model.bsl.tableName
 * console.log(tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AnyModel {
  readonly bsl: {
    readonly tableName: string;
    readonly fields: FieldsInput;
    readonly columns: Record<string, Meta.Meta>;
    readonly extras:
      | ((columns: never) => ReadonlyArray<TableExtras.Node>)
      | undefined;
  };
}

// ---------------------------------------------------------------------------
// Runtime factory
// ---------------------------------------------------------------------------

const deriveTableName = (identifier: string): string => {
  const last = O.getOrElse(
    A.last(Str.split(identifier, "/")),
    () => identifier
  );
  return Str.snakeCase(last);
};

const resolveReferences = (
  meta: Meta.Meta,
  select: unknown
): Meta.References | undefined => {
  const explicit = O.fromUndefinedOr(meta.references);
  const derived =
    !meta.primaryKey && Derive.isEntityIdLike(select)
      ? O.some<Meta.References>({
          tableName: select.tableName,
          columnName: "id",
          onDelete: undefined,
          onUpdate: undefined,
        })
      : O.none<Meta.References>();
  return explicit.pipe(
    O.orElse(() => derived),
    O.getOrUndefined
  );
};

const effectiveSchema = (
  schema: Field.AnySchema,
  meta: Meta.Meta
): Field.AnySchema => {
  if (meta.version) {
    const select = Derive.selectSchemaOf(schema);
    return V.Field({
      select,
      insert: S.optionalKey(select),
      update: select,
      json: select,
      jsonCreate: select,
      jsonUpdate: select,
    });
  }
  if (VariantSchema.isField(schema)) return schema;
  if (Meta.Generated.guards.identityAlways(meta.generated)) {
    return V.Field({
      select: schema,
      update: schema,
      json: schema,
    });
  }
  if (meta.generated !== false) {
    return V.Field({
      select: schema,
      json: schema,
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

/**
 * Build one BSL model class after its public factory has validated the field set.
 *
 * **Details**
 *
 * This is the shared runtime seam used by bare {@link Model} and kit-provided
 * entities. Runtime invariants remain authoritative when types are suppressed.
 *
 * @category constructors
 * @since 0.0.0
 */
export function makeModelClass<Self, const F extends FieldsInput>(
  identifier: string,
  fields: F,
  annotations: S.Annotations.Annotations | undefined,
  extras: TableExtras.Callback<F> | undefined
): ModelClass<Self, F>;
export function makeModelClass(
  identifier: string,
  fields: FieldsInput,
  annotations: S.Annotations.Annotations | undefined,
  extras: TableExtras.Callback<FieldsInput> | undefined
): object {
  const tableName = deriveTableName(identifier);
  const state = A.reduce(
    R.toEntries(fields),
    {
      columns: R.empty<string, Meta.Meta>(),
      primaryKeys: 0,
      versionFields: 0,
      schemaFields: R.empty<string, Field.AnySchema>(),
    },
    (state, [key, input]) => {
      const field = Field.from(input);
      const select = Derive.selectSchemaOf(field.schema);
      const classified = P.isNotUndefined(field.meta.column)
        ? {
            column: field.meta.column,
            nullable: Derive.isNullable(field.schema),
          }
        : Derive.classify(field.schema, key);

      if (field.meta.primaryKey && classified.nullable) {
        throw ModelInvariantError.make({
          message: `Primary key '${key}' derives a nullable encoded representation.`,
          fieldName: key,
        });
      }
      if (
        field.meta.identity !== false &&
        !S.is(PgColumn.IdentityKind)(classified.column.kind)
      ) {
        throw ModelInvariantError.make({
          message: `Identity on '${key}' requires an integer-family column, got '${classified.column.kind}'.`,
          fieldName: key,
        });
      }
      if (
        field.meta.generated !== false &&
        (field.meta.hasDefault || P.isNotUndefined(field.meta.default))
      ) {
        throw ModelInvariantError.make({
          message: `Field '${key}' cannot be both defaulted and generated.`,
          fieldName: key,
        });
      }
      if (
        field.meta.version &&
        !S.is(PgColumn.IdentityKind)(classified.column.kind)
      ) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' requires an integer-family column, got '${classified.column.kind}'.`,
          fieldName: key,
        });
      }
      if (
        field.meta.version &&
        (field.meta.identity !== false || field.meta.generated !== false)
      ) {
        throw ModelInvariantError.make({
          message: `Version field '${key}' cannot use identity or generated-column semantics.`,
          fieldName: key,
        });
      }
      const bounded = PgColumn.Spec.guards.varchar(classified.column)
        ? O.some({ kind: "varchar", length: classified.column.length })
        : PgColumn.Spec.guards.char(classified.column)
        ? O.some({ kind: "char", length: classified.column.length })
        : O.none<{ readonly kind: string; readonly length: number }>();
      if (O.isSome(bounded)) {
        const incompatible = A.findFirst(
          Derive.maxLengths(field.schema),
          (maxLength) => maxLength > bounded.value.length
        );
        if (O.isSome(incompatible)) {
          throw ModelInvariantError.make({
            message: `${bounded.value.kind}(${bounded.value.length}) on '${key}' is narrower than schema maxLength ${incompatible.value}.`,
            fieldName: key,
          });
        }
      }
      const resolvedMeta = Meta.merge(field.meta, {
        column: PgColumn.resolveName(classified.column, key),
        references: resolveReferences(field.meta, select),
      });
      return {
        columns: R.set(state.columns, key, resolvedMeta),
        primaryKeys: state.primaryKeys + (field.meta.primaryKey ? 1 : 0),
        versionFields: state.versionFields + (field.meta.version ? 1 : 0),
        schemaFields: R.set(
          state.schemaFields,
          key,
          effectiveSchema(field.schema, resolvedMeta)
        ),
      };
    }
  );

  if (state.primaryKeys > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares ${state.primaryKeys} inline primary keys; use Table.compositePrimaryKey in the extras callback.`,
      fieldName: "(model)",
    });
  }

  if (state.versionFields > 1) {
    throw ModelInvariantError.make({
      message: `Model '${identifier}' declares ${state.versionFields} optimistic-version fields; at most one is allowed.`,
      fieldName: "(model)",
    });
  }

  const Base = V.Class<object>(identifier)(state.schemaFields, annotations);
  return SchemaUtils.withStatics(Base, () => ({
    bsl: { tableName, fields, columns: state.columns, extras },
  }));
}

/**
 * Build a variant-aware model class whose fields own their resolved SQL metadata.
 *
 * **Example** (Define a BSL model)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model } from "./factory.ts"
 *
 * class User extends Model<User>("User")({ name: S.String }) {}
 * console.log(User.bsl.tableName) // "user"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function Model<Self = never>(
  identifier: string
): <const F extends FieldsInput>(
  fields: F & ValidateFields<F>,
  annotationsOrExtras?: S.Annotations.Annotations | TableExtras.Callback<F>
) => [Self] extends [never] ? MissingSelfGeneric : ModelClass<Self, F>;
export function Model(identifier: string): unknown {
  return (
    fields: FieldsInput,
    annotationsOrExtras?:
      | S.Annotations.Annotations
      | TableExtras.Callback<FieldsInput>
  ): object => {
    const extras = P.isFunction(annotationsOrExtras)
      ? annotationsOrExtras
      : undefined;
    const annotations = P.isFunction(annotationsOrExtras)
      ? undefined
      : annotationsOrExtras;
    return makeModelClass(identifier, fields, annotations, extras);
  };
}
