/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Struct } from "@beep/utils";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { $I } from "./EntitySchema.shared.ts";
import type { EntityFieldInput, EntityFieldInputs, SelectedFieldOf } from "./EntitySchema.fields.ts";
/**
 * Physical storage kind projected by table adapters.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { StorageKind } from "@beep/schema/EntitySchema"
 *
 * const kind = S.decodeUnknownSync(StorageKind)("text")
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const StorageKind = LiteralKit([
  "blob",
  "bool",
  "entityId",
  "int",
  "jsonb",
  "literal",
  "text",
  "timestampDate",
  "timestampMillis",
]).pipe(
  $I.annoteSchema("StorageKind", {
    description: "Physical storage kind projected from a schema-first entity field.",
  })
);

/**
 * Runtime type for {@link StorageKind}.
 *
 * @example
 * ```ts
 * import type { StorageKind } from "@beep/schema/EntitySchema"
 *
 * const kind: StorageKind = "text"
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type StorageKind = typeof StorageKind.Type;

/**
 * Lifecycle strategy for a persisted field.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValueStrategy } from "@beep/schema/EntitySchema"
 *
 * const strategy = S.decodeUnknownSync(ValueStrategy)("provided")
 * console.log(strategy)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ValueStrategy = LiteralKit([
  "computedByService",
  "defaultedOnInsert",
  "derived",
  "generatedOnInsert",
  "incrementedOnWrite",
  "provided",
  "providedByContext",
  "updatedOnWrite",
]).pipe(
  $I.annoteSchema("ValueStrategy", {
    description: "Lifecycle strategy used to derive entity variants for a persisted field.",
  })
);

/**
 * Runtime type for {@link ValueStrategy}.
 *
 * @example
 * ```ts
 * import type { ValueStrategy } from "@beep/schema/EntitySchema"
 *
 * const strategy: ValueStrategy = "provided"
 * console.log(strategy)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ValueStrategy = typeof ValueStrategy.Type;

/**
 * Compatibility alias for lifecycle strategy.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PersistStrategy } from "@beep/schema/EntitySchema"
 *
 * const strategy = S.decodeUnknownSync(PersistStrategy)("provided")
 * console.log(strategy)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const PersistStrategy = ValueStrategy;

/**
 * Runtime type for {@link PersistStrategy}.
 *
 * @example
 * ```ts
 * import type { PersistStrategy } from "@beep/schema/EntitySchema"
 *
 * const strategy: PersistStrategy = "provided"
 * console.log(strategy)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistStrategy = ValueStrategy;

/**
 * Storage-neutral index hint kind.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { IndexHintKind } from "@beep/schema/EntitySchema"
 *
 * const kind = S.decodeUnknownSync(IndexHintKind)("unique")
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const IndexHintKind = LiteralKit(["btree", "gin", "hash", "lookup", "unique"]).pipe(
  $I.annoteSchema("IndexHintKind", {
    description: "Storage-neutral index hint kind attached to a persisted field.",
  })
);

/**
 * Runtime type for {@link IndexHintKind}.
 *
 * @example
 * ```ts
 * import type { IndexHintKind } from "@beep/schema/EntitySchema"
 *
 * const kind: IndexHintKind = "unique"
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IndexHintKind = typeof IndexHintKind.Type;

const IndexHintBase = IndexHintKind.toTaggedUnion("kind")({
  btree: {},
  gin: {},
  hash: {},
  lookup: {},
  unique: {},
}).pipe(
  $I.annoteSchema("IndexHint", {
    description: "Storage-neutral index hint attached to a persisted field.",
  })
);

/**
 * Storage-neutral index hint values and schema.
 *
 * @example
 * ```ts
 * import { IndexHint } from "@beep/schema/EntitySchema"
 *
 * console.log(IndexHint.unique)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const IndexHint = Struct.assign(IndexHintBase, {
  btree: { kind: "btree" } as const,
  gin: { kind: "gin" } as const,
  hash: { kind: "hash" } as const,
  lookup: { kind: "lookup" } as const,
  unique: { kind: "unique" } as const,
});

/**
 * Runtime type for {@link IndexHint}.
 *
 * @example
 * ```ts
 * import { IndexHint } from "@beep/schema/EntitySchema"
 * import type { IndexHint as IndexHintValue } from "@beep/schema/EntitySchema"
 *
 * const hint: IndexHintValue = IndexHint.btree
 * console.log(hint.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IndexHint = typeof IndexHint.Type;

/**
 * Encoded absence classification for a field.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EncodedAbsenceKind } from "@beep/schema/EntitySchema"
 *
 * const kind = S.decodeUnknownSync(EncodedAbsenceKind)("optionalKey")
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const EncodedAbsenceKind = LiteralKit([
  "required",
  "nullable",
  "undefined",
  "nullish",
  "optionalKey",
  "optionalNullable",
  "optionalUndefined",
  "optionalNullish",
  "ambiguous",
]).pipe(
  $I.annoteSchema("EncodedAbsenceKind", {
    description: "Classifies how an encoded entity field represents absence at a persistence boundary.",
  })
);

/**
 * Runtime type for {@link EncodedAbsenceKind}.
 *
 * @example
 * ```ts
 * import type { EncodedAbsenceKind } from "@beep/schema/EntitySchema"
 *
 * const absence: EncodedAbsenceKind = "optionalKey"
 * console.log(absence)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EncodedAbsenceKind = typeof EncodedAbsenceKind.Type;

/**
 * Options accepted by persistence descriptor constructors.
 *
 * @example
 * ```ts
 * import { IndexHint } from "@beep/schema/EntitySchema"
 * import type { PersistOptions } from "@beep/schema/EntitySchema"
 *
 * const options: PersistOptions<"provided", "user_id", readonly [typeof IndexHint.unique]> = {
 *   columnName: "user_id",
 *   indexHints: [IndexHint.unique],
 *   valueStrategy: "provided"
 * }
 * console.log(options.columnName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistOptions<
  Strategy extends PersistStrategy = "provided",
  ColumnName extends string | undefined = string | undefined,
  IndexHints extends ReadonlyArray<IndexHint> | undefined = undefined,
> = {
  readonly columnName?: ColumnName;
  readonly indexHints?: IndexHints;
  readonly valueStrategy?: Strategy;
};

type PersistDescriptorShape<
  TStorageKind extends StorageKind = StorageKind,
  TValueStrategy extends PersistStrategy = PersistStrategy,
  TColumnName extends string | undefined = string | undefined,
  TIndexHints extends ReadonlyArray<IndexHint> | undefined = undefined,
> = {
  readonly storageKind: TStorageKind;
  readonly valueStrategy: TValueStrategy;
} & (TColumnName extends string
  ? {
      readonly columnName: TColumnName;
    }
  : {
      readonly columnName?: never;
    }) &
  (TIndexHints extends ReadonlyArray<IndexHint>
    ? {
        readonly indexHints: TIndexHints;
      }
    : {
        readonly indexHints?: never;
      });

/**
 * Descriptor for one persisted entity field.
 *
 * @example
 * ```ts
 * import type { PersistDescriptor } from "@beep/schema/EntitySchema"
 *
 * const descriptor: PersistDescriptor<"text", "provided", "name"> = {
 *   columnName: "name",
 *   storageKind: "text",
 *   valueStrategy: "provided"
 * }
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistDescriptor<
  TStorageKind extends StorageKind = StorageKind,
  TValueStrategy extends PersistStrategy = PersistStrategy,
  TColumnName extends string | undefined = string | undefined,
  TIndexHints extends ReadonlyArray<IndexHint> | undefined = ReadonlyArray<IndexHint> | undefined,
> = TStorageKind extends StorageKind
  ? TValueStrategy extends PersistStrategy
    ? PersistDescriptorShape<TStorageKind, TValueStrategy, TColumnName, TIndexHints>
    : never
  : never;

/**
 * Companion types for {@link PersistDescriptor}.
 *
 * @example
 * ```ts
 * import type { PersistDescriptor } from "@beep/schema/EntitySchema"
 *
 * const descriptor = { storageKind: "text", valueStrategy: "provided" } satisfies PersistDescriptor.Any
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export namespace PersistDescriptor {
  /**
   * Any persistence descriptor value.
   *
   * @since 0.0.0
   * @category models
   */
  export type Any = {
    readonly columnName?: string;
    readonly indexHints?: ReadonlyArray<IndexHint>;
    readonly storageKind: StorageKind;
    readonly valueStrategy: PersistStrategy;
  };
}

const PersistDescriptorFields = {
  columnName: S.optionalKey(S.String),
  indexHints: S.Array(IndexHint).pipe(S.optionalKey),
  valueStrategy: ValueStrategy,
} as const;

const PersistDescriptorCases = {
  blob: PersistDescriptorFields,
  bool: PersistDescriptorFields,
  entityId: PersistDescriptorFields,
  int: PersistDescriptorFields,
  jsonb: PersistDescriptorFields,
  literal: PersistDescriptorFields,
  text: PersistDescriptorFields,
  timestampDate: PersistDescriptorFields,
  timestampMillis: PersistDescriptorFields,
} as const;

const PersistDescriptorStorageBase = StorageKind.toTaggedUnion("storageKind")(PersistDescriptorCases);
type PersistDescriptorStatics = Pick<typeof PersistDescriptorStorageBase, "cases" | "guards" | "isAnyOf" | "match">;

const attachPersistDescriptorStatics = <Schema extends S.ConstraintDecoder<PersistDescriptor.Any>>(
  schema: Schema
): Schema & PersistDescriptorStatics =>
  SchemaUtils.withStatics(schema, () =>
    Struct.pick(PersistDescriptorStorageBase, ["cases", "guards", "isAnyOf", "match"])
  );

/**
 * Schema-backed discriminated persistence descriptor.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PersistDescriptor } from "@beep/schema/EntitySchema"
 *
 * const descriptor = S.decodeUnknownSync(PersistDescriptor)({ storageKind: "text", valueStrategy: "provided" })
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const PersistDescriptor: S.ConstraintDecoder<PersistDescriptor.Any> & PersistDescriptorStatics =
  attachPersistDescriptorStatics(
    PersistDescriptorStorageBase.pipe(
      $I.annoteSchema("PersistDescriptor", {
        description: "Schema-backed discriminated persistence descriptor for one entity field.",
      })
    )
  );

/**
 * Persistence descriptor narrowed by storage kind and value strategy.
 *
 * @example
 * ```ts
 * import type { PersistDescriptorByValueStrategy } from "@beep/schema/EntitySchema"
 *
 * type ProvidedText = PersistDescriptorByValueStrategy<{
 *   readonly storageKind: "text"
 *   readonly valueStrategy: "provided"
 * }>
 * const descriptor: ProvidedText = { storageKind: "text", valueStrategy: "provided" }
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistDescriptorByValueStrategy<Descriptor extends PersistDescriptor.Any = PersistDescriptor> =
  Descriptor extends unknown
    ? {
        readonly [Kind in Descriptor["storageKind"]]: {
          readonly [Strategy in Descriptor["valueStrategy"]]: Descriptor & {
            readonly storageKind: Kind;
            readonly valueStrategy: Strategy;
          };
        }[Descriptor["valueStrategy"]];
      }[Descriptor["storageKind"]]
    : never;

/**
 * Entity-id schema shape accepted by persisted entity factories.
 *
 * @example
 * ```ts
 * import type { EntityIdLike } from "@beep/schema/EntitySchema"
 *
 * type EntityType = EntityIdLike["entityType"]
 * const entityType: EntityType = "Account"
 * console.log(entityType)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EntityIdLike = S.Codec<unknown, number> & {
  readonly Type: unknown;
  readonly entityType: string;
  readonly tableName: string;
};

type NonNullish<A> = Exclude<A, null | undefined>;
type JsonContainer = object;

type NumericStorage<Encoded> =
  NonNullish<Encoded> extends number ? PersistDescriptor<"entityId" | "int" | "timestampMillis"> : never;

type TextStorage<Encoded> = NonNullish<Encoded> extends string ? PersistDescriptor<"literal" | "text"> : never;

type BoolStorage<Encoded> = NonNullish<Encoded> extends boolean ? PersistDescriptor<"bool"> : never;

type BlobStorage<Encoded> = NonNullish<Encoded> extends Uint8Array ? PersistDescriptor<"blob"> : never;

type DateStorage<Encoded> = NonNullish<Encoded> extends Date ? PersistDescriptor<"timestampDate"> : never;

type JsonStorage<Encoded> =
  NonNullish<Encoded> extends JsonContainer
    ? NonNullish<Encoded> extends Date | Uint8Array
      ? never
      : PersistDescriptor<"jsonb">
    : never;

type PersistDescriptorForEncoded<Encoded> = undefined extends Encoded
  ? never
  :
      | NumericStorage<Encoded>
      | TextStorage<Encoded>
      | BoolStorage<Encoded>
      | BlobStorage<Encoded>
      | DateStorage<Encoded>
      | JsonStorage<Encoded>;

/**
 * Persistence descriptor type permitted for one schema field.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptorFor } from "@beep/schema/EntitySchema"
 *
 * type TextDescriptor = PersistDescriptorFor<typeof S.String>
 * const descriptor: TextDescriptor = { storageKind: "text", valueStrategy: "provided" }
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistDescriptorFor<Schema extends S.Top> = Schema["~encoded.optionality"] extends "optional"
  ? never
  : [S.Codec.DecodingServices<Schema>] extends [never]
    ? [S.Codec.EncodingServices<Schema>] extends [never]
      ? PersistDescriptorForEncoded<S.Codec.Encoded<Schema>>
      : never
    : never;

/**
 * Persistence descriptor type permitted for one entity field input.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptorForInput } from "@beep/schema/EntitySchema"
 *
 * type Descriptor = PersistDescriptorForInput<typeof S.String>
 * const descriptor: Descriptor = { storageKind: "text", valueStrategy: "provided" }
 * console.log(descriptor.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistDescriptorForInput<Field extends EntityFieldInput> = PersistDescriptorFor<SelectedFieldOf<Field>>;

/**
 * Exact persisted descriptor map permitted for a field map.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistedFor } from "@beep/schema/EntitySchema"
 *
 * type Persisted = PersistedFor<{ readonly name: typeof S.String }>
 * const persisted: Persisted = { name: { storageKind: "text", valueStrategy: "provided" } }
 * console.log(persisted.name.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistedFor<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: PersistDescriptorForInput<FieldMap[K]>;
};

/**
 * Any persisted descriptor map.
 *
 * @example
 * ```ts
 * import type { PersistedMap } from "@beep/schema/EntitySchema"
 *
 * const persisted: PersistedMap = {
 *   name: { storageKind: "text", valueStrategy: "provided" }
 * }
 * console.log(persisted.name?.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PersistedMap = Readonly<Record<string, PersistDescriptor>>;

type ExtraPersistedKeys<FieldMap extends EntityFieldInputs, Persisted extends PersistedMap> = Exclude<
  keyof Persisted,
  keyof FieldMap
>;

type NoExtraPersistedKeys<FieldMap extends EntityFieldInputs, Persisted extends PersistedMap> = {
  readonly [K in ExtraPersistedKeys<FieldMap, Persisted>]: never;
};

/**
 * Persisted map that matches a field map and rejects keys outside that field map.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { CheckedPersistedFor, PersistedFor } from "@beep/schema/EntitySchema"
 *
 * type FieldMap = { readonly name: typeof S.String }
 * type Checked = CheckedPersistedFor<FieldMap, PersistedFor<FieldMap>>
 * const checked: Checked = { name: { storageKind: "text", valueStrategy: "provided" } }
 * console.log(checked.name.storageKind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CheckedPersistedFor<
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
> = Persisted & NoExtraPersistedKeys<FieldMap, Persisted>;
