/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Struct } from "@beep/utils";
import type { Str } from "@beep/utils";
import type * as S from "effect/Schema";
import type { Simplify, Assign as StructAssign } from "effect/Struct";
import type * as Model from "../Model/index.ts";
import type {
  EntityFieldInput,
  EntityFieldInputs,
  EntityVariantFieldInput,
  Fields,
  SelectedFieldOf,
  SelectedFieldsOf,
} from "./EntitySchema.fields.ts";
import type {
  CheckedPersistedFor,
  EntityIdLike,
  PersistDescriptor,
  PersistedFor,
  PersistedMap,
} from "./EntitySchema.persist.ts";
/**
 * Entity metadata attached to entity schema classes.
 *
 * @example
 * ```ts
 * import type { Definition } from "@beep/schema/EntitySchema"
 *
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Definition<
  FieldMap extends EntityFieldInputs = EntityFieldInputs,
  SelectedFieldMap extends Fields = SelectedFieldsOf<FieldMap>,
  Persisted extends PersistedMap = PersistedMap,
  TableName extends string = string,
  EntityId extends EntityIdLike | undefined = EntityIdLike | undefined,
> = {
  readonly fields: SelectedFieldMap;
  readonly inputFields: FieldMap;
  readonly persisted: Persisted;
  readonly tableName: TableName;
  readonly variantFields: VariantFieldsFor<FieldMap, Persisted>;
} & (EntityId extends EntityIdLike
  ? {
      readonly entityId: EntityId;
    }
  : {
      readonly entityId?: never;
    });

/**
 * Encoded persistence row shape for a field map.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { EncodedShape } from "@beep/schema/EntitySchema"
 *
 * type Row = EncodedShape<{ readonly id: typeof S.String }>
 * console.log({ id: "acct_123" } satisfies Row)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EncodedShape<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: S.Codec.Encoded<SelectedFieldOf<FieldMap[K]>>;
};

/**
 * Decoded domain type shape for a field map.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { TypeShape } from "@beep/schema/EntitySchema"
 *
 * type Domain = TypeShape<{ readonly id: typeof S.String }>
 * console.log({ id: "acct_123" } satisfies Domain)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TypeShape<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: S.Schema.Type<SelectedFieldOf<FieldMap[K]>>;
};

/**
 * Schema annotation bag accepted by entity class factories.
 *
 * @example
 * ```ts
 * import type { SchemaAnnotations } from "@beep/schema/EntitySchema"
 *
 * const annotations = { title: "Account" } satisfies SchemaAnnotations
 * console.log(annotations.title)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SchemaAnnotations = S.Annotations.Annotations;

/**
 * Type-level snake-case transform.
 *
 * @example
 * ```ts
 * import type { SnakeCase } from "@beep/schema/EntitySchema"
 *
 * const table = "account_profile" satisfies SnakeCase<"AccountProfile">
 * console.log(table)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SnakeCase<Value extends string> = ReturnType<typeof Str.snakeCase<Value>>;

/**
 * Last path segment of an identity string.
 *
 * @example
 * ```ts
 * import type { LastPathSegment } from "@beep/schema/EntitySchema"
 *
 * const segment = "Account" satisfies LastPathSegment<"Domain/Account">
 * console.log(segment)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LastPathSegment<Value extends string> = Value extends `${string}/${infer Tail}`
  ? LastPathSegment<Tail>
  : Value;

/**
 * Default table name derived from a schema identifier.
 *
 * @example
 * ```ts
 * import type { TableNameFromIdentifier } from "@beep/schema/EntitySchema"
 *
 * const table = "account_profile" satisfies TableNameFromIdentifier<"Domain/AccountProfile">
 * console.log(table)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TableNameFromIdentifier<Identifier extends string> = SnakeCase<LastPathSegment<Identifier>>;

/**
 * Column name for a field key and descriptor.
 *
 * @example
 * ```ts
 * import type { ColumnNameFor, PersistDescriptor } from "@beep/schema/EntitySchema"
 *
 * type Column = ColumnNameFor<"createdAt", PersistDescriptor<"text", "provided">>
 * const column: Column = "created_at"
 * console.log(column)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ColumnNameFor<Key extends string, Descriptor extends PersistDescriptor> = Descriptor extends {
  readonly columnName: infer ColumnName extends string;
}
  ? ColumnName
  : SnakeCase<Key>;

/**
 * Input accepted by {@link ClassFactory}.
 *
 * @example
 * ```ts
 * import { defineClassInput } from "@beep/schema/EntitySchema"
 * import type { ClassInput } from "@beep/schema/EntitySchema"
 *
 * const input = defineClassInput({ fields: {}, persisted: {} }) satisfies ClassInput<{}, {}>
 * console.log(Object.keys(input.fields))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ClassInput<
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  TableName extends string = string,
  EntityId extends EntityIdLike | undefined = undefined,
> = {
  readonly entityId?: EntityId;
  readonly fields: FieldMap;
  readonly persisted: CheckedPersistedFor<FieldMap, Persisted>;
  readonly tableName?: TableName;
};

/**
 * Preserve a checked class input while letting callers keep `const` inference.
 *
 * @example
 * ```ts
 * import { defineClassInput } from "@beep/schema/EntitySchema"
 *
 * const input = defineClassInput({ fields: {}, persisted: {} })
 * console.log(Object.keys(input.fields))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const defineClassInput = <
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  const TableName extends string = string,
  const EntityId extends EntityIdLike | undefined = undefined,
>(
  input: ClassInput<FieldMap, Persisted, TableName, EntityId>
): ClassInput<FieldMap, Persisted, TableName, EntityId> => input;

/**
 * Variant field schema selected for a persisted field descriptor.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptor, VariantFieldFor } from "@beep/schema/EntitySchema"
 *
 * type Field = VariantFieldFor<typeof S.String, PersistDescriptor.Any>
 * const field = S.String satisfies Field
 * console.log(S.isSchema(field))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VariantFieldFor<
  Field extends S.Top,
  Descriptor extends PersistDescriptor.Any,
> = Descriptor["valueStrategy"] extends "generatedOnInsert"
  ? Model.Generated<Field>
  : Descriptor["valueStrategy"] extends "incrementedOnWrite"
    ? Model.Generated<Field>
    : Descriptor["valueStrategy"] extends "defaultedOnInsert"
      ? Descriptor["storageKind"] extends "timestampMillis"
        ? Model.DateTimeInsertFromNumber
        : Descriptor["storageKind"] extends "timestampDate"
          ? Model.DateTimeInsertFromDate
          : Model.GeneratedByApp<Field>
      : Descriptor["valueStrategy"] extends "updatedOnWrite"
        ? Descriptor["storageKind"] extends "timestampMillis"
          ? Model.DateTimeUpdateFromNumber
          : Descriptor["storageKind"] extends "timestampDate"
            ? Model.DateTimeUpdateFromDate
            : Model.GeneratedByApp<Field>
        : Descriptor["valueStrategy"] extends "computedByServiceOnInsert"
          ? Model.GeneratedByAppOnInsert<Field>
          : Descriptor["valueStrategy"] extends "providedByContext" | "derived" | "computedByService"
            ? Model.GeneratedByApp<Field>
            : Field;

/**
 * Variant field schema selected for a field input and persisted descriptor.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptor, VariantFieldForInput } from "@beep/schema/EntitySchema"
 *
 * type Field = VariantFieldForInput<typeof S.String, PersistDescriptor.Any>
 * const field = S.String satisfies Field
 * console.log(S.isSchema(field))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VariantFieldForInput<
  Field extends EntityFieldInput,
  Descriptor extends PersistDescriptor.Any,
> = Field extends EntityVariantFieldInput ? Field : VariantFieldFor<SelectedFieldOf<Field>, Descriptor>;

/**
 * Variant field map derived from entity inputs and persistence descriptors.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { VariantFieldsFor } from "@beep/schema/EntitySchema"
 *
 * type Fields = VariantFieldsFor<{ readonly id: typeof S.String }, {}>
 * const fields = { id: S.String } satisfies Fields
 * console.log(Object.keys(fields))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VariantFieldsFor<FieldMap extends EntityFieldInputs, Persisted extends PersistedMap> = {
  readonly [K in keyof FieldMap]: K extends keyof Persisted
    ? VariantFieldForInput<FieldMap[K], Persisted[K]>
    : FieldMap[K];
};

/**
 * Entity schema class produced by {@link ClassFactory}.
 *
 * @example
 * ```ts
 * import type { EntityClass } from "@beep/schema/EntitySchema"
 *
 * type Definition = EntityClass.Any["definition"]
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EntityClass<
  Self,
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  Inherited = {},
  TableName extends string = string,
  EntityId extends EntityIdLike | undefined = EntityIdLike | undefined,
> = S.Codec<Self, EncodedShape<FieldMap>, never, never> &
  Model.ClassShape<Self, VariantFieldsFor<FieldMap, Persisted>, {}, Inherited> & {
    readonly definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>;
  };

/**
 * Companion types for {@link EntityClass}.
 *
 * @example
 * ```ts
 * import type { EntityClass } from "@beep/schema/EntitySchema"
 *
 * type Definition = EntityClass.DefinitionOf<EntityClass.Any>
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export namespace EntityClass {
  /**
   * Any entity schema class.
   *
   * @since 0.0.0
   * @category models
   */
  export type Any = S.Top & {
    readonly definition: Definition;
  };

  /**
   * Definition attached to an entity schema class.
   *
   * @since 0.0.0
   * @category models
   */
  export type DefinitionOf<Entity extends Any> = Entity["definition"];
}

/**
 * Assign fields with right-hand override.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Assign } from "@beep/schema/EntitySchema"
 *
 * type Fields = Assign<{ readonly id: typeof S.String }, { readonly name: typeof S.String }>
 * console.log({ id: S.String, name: S.String } satisfies Fields)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Assign<Base extends EntityFieldInputs, Extension extends EntityFieldInputs> = Simplify<
  StructAssign<Base, Extension>
>;

/**
 * Assign persisted maps with right-hand override.
 *
 * @example
 * ```ts
 * import type { AssignPersisted } from "@beep/schema/EntitySchema"
 *
 * type Persisted = AssignPersisted<{}, {}>
 * console.log({} satisfies Persisted)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AssignPersisted<BasePersisted extends PersistedMap, ExtensionPersisted extends PersistedMap> = Simplify<
  StructAssign<BasePersisted, ExtensionPersisted>
>;

/**
 * Field and persistence maps produced by composing an inherited entity shape
 * with a child entity shape.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { AssignedEntityParts } from "@beep/schema/EntitySchema"
 *
 * type Parts = AssignedEntityParts<{ readonly id: typeof S.String }, {}, { readonly name: typeof S.String }, {}>
 * const fieldKey: keyof Parts["fields"] = "id"
 * console.log(fieldKey)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AssignedEntityParts<
  BaseFields extends EntityFieldInputs,
  BasePersisted extends PersistedMap,
  ExtensionFields extends EntityFieldInputs,
  ExtensionPersisted extends PersistedMap,
> = {
  readonly fields: Assign<BaseFields, ExtensionFields>;
  readonly persisted: AssignedPersisted<BaseFields, BasePersisted, ExtensionFields, ExtensionPersisted>;
};

/**
 * Persisted map produced by composing inherited and child entity parts.
 *
 * @example
 * ```ts
 * import type { AssignedPersisted } from "@beep/schema/EntitySchema"
 *
 * type Persisted = AssignedPersisted<{}, {}, {}, {}>
 * console.log({} satisfies Persisted)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AssignedPersisted<
  BaseFields extends EntityFieldInputs,
  BasePersisted extends PersistedMap,
  ExtensionFields extends EntityFieldInputs,
  ExtensionPersisted extends PersistedMap,
> = CheckedPersistedFor<
  Assign<BaseFields, ExtensionFields>,
  AssignPersisted<BasePersisted, ExtensionPersisted> & PersistedFor<Assign<BaseFields, ExtensionFields>>
>;

/**
 * Compose field and persistence maps together so their correlation is checked
 * at the call site and preserved for downstream class factories.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { assignEntityParts } from "@beep/schema/EntitySchema"
 *
 * const parts = assignEntityParts({
 *   baseFields: {},
 *   basePersisted: {},
 *   extensionFields: { name: S.String },
 *   extensionPersisted: { name: { storageKind: "text", valueStrategy: "provided" } },
 * })
 * console.log(Object.keys(parts.fields))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const assignEntityParts = <
  const BaseFields extends EntityFieldInputs,
  const BasePersisted extends PersistedFor<BaseFields>,
  const ExtensionFields extends EntityFieldInputs,
  const ExtensionPersisted extends PersistedMap,
>(input: {
  readonly baseFields: BaseFields;
  readonly basePersisted: BasePersisted;
  readonly extensionFields: ExtensionFields;
  readonly extensionPersisted: ExtensionPersisted;
}): AssignedEntityParts<BaseFields, BasePersisted, ExtensionFields, ExtensionPersisted> =>
  ({
    fields: Struct.assign(input.baseFields, input.extensionFields),
    persisted: Struct.assign(input.basePersisted, input.extensionPersisted),
  }) as AssignedEntityParts<BaseFields, BasePersisted, ExtensionFields, ExtensionPersisted>;
