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
 * **Example** (Satisfying Definition object)
 *
 * ```ts
 * import type { Definition } from "@beep/schema/EntitySchema"
 *
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Encoded row from fields)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { EncodedShape } from "@beep/schema/EntitySchema"
 *
 * type Row = EncodedShape<{ readonly id: typeof S.String }>
 * console.log({ id: "acct_123" } satisfies Row)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EncodedShape<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: S.Codec.Encoded<SelectedFieldOf<FieldMap[K]>>;
};

/**
 * Decoded domain type shape for a field map.
 *
 * **Example** (Decoded domain from fields)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { TypeShape } from "@beep/schema/EntitySchema"
 *
 * type Domain = TypeShape<{ readonly id: typeof S.String }>
 * console.log({ id: "acct_123" } satisfies Domain)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypeShape<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: S.Schema.Type<SelectedFieldOf<FieldMap[K]>>;
};

/**
 * Schema annotation bag accepted by entity class factories.
 *
 * **Example** (Satisfying annotations bag)
 *
 * ```ts
 * import type { SchemaAnnotations } from "@beep/schema/EntitySchema"
 *
 * const annotations = { title: "Account" } satisfies SchemaAnnotations
 * console.log(annotations.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SchemaAnnotations = S.Annotations.Annotations;

/**
 * Type-level snake-case transform.
 *
 * **Example** (Snake-case type transform)
 *
 * ```ts
 * import type { SnakeCase } from "@beep/schema/EntitySchema"
 *
 * const table = "account_profile" satisfies SnakeCase<"AccountProfile">
 * console.log(table)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SnakeCase<Value extends string> = ReturnType<typeof Str.snakeCase<Value>>;

/**
 * Last path segment of an identity string.
 *
 * **Example** (Extract last path segment)
 *
 * ```ts
 * import type { LastPathSegment } from "@beep/schema/EntitySchema"
 *
 * const segment = "Account" satisfies LastPathSegment<"Domain/Account">
 * console.log(segment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LastPathSegment<Value extends string> = Value extends `${string}/${infer Tail}`
  ? LastPathSegment<Tail>
  : Value;

/**
 * Default table name derived from a schema identifier.
 *
 * **Example** (Table name from identifier)
 *
 * ```ts
 * import type { TableNameFromIdentifier } from "@beep/schema/EntitySchema"
 *
 * const table = "account_profile" satisfies TableNameFromIdentifier<"Domain/AccountProfile">
 * console.log(table)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableNameFromIdentifier<Identifier extends string> = SnakeCase<LastPathSegment<Identifier>>;

/**
 * Column name for a field key and descriptor.
 *
 * **Example** (Column name for field)
 *
 * ```ts
 * import type { ColumnNameFor, PersistDescriptor } from "@beep/schema/EntitySchema"
 *
 * type Column = ColumnNameFor<"createdAt", PersistDescriptor<"text", "provided">>
 * const column: Column = "created_at"
 * console.log(column)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ColumnNameFor<Key extends string, Descriptor extends PersistDescriptor> = Descriptor extends {
  readonly columnName: infer ColumnName extends string;
}
  ? ColumnName
  : SnakeCase<Key>;

/**
 * Input accepted by {@link ClassFactory}.
 *
 * **Example** (Satisfying ClassInput shape)
 *
 * ```ts
 * import { defineClassInput } from "@beep/schema/EntitySchema"
 * import type { ClassInput } from "@beep/schema/EntitySchema"
 *
 * const input = defineClassInput({ fields: {}, persisted: {} }) satisfies ClassInput<{}, {}>
 * console.log(Object.keys(input.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Preserve const class input)
 *
 * ```ts
 * import { defineClassInput } from "@beep/schema/EntitySchema"
 *
 * const input = defineClassInput({ fields: {}, persisted: {} })
 * console.log(Object.keys(input.fields))
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Variant field for descriptor)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptor, VariantFieldFor } from "@beep/schema/EntitySchema"
 *
 * type Field = VariantFieldFor<typeof S.String, PersistDescriptor.Any>
 * const field = S.String satisfies Field
 * console.log(S.isSchema(field))
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Variant field for input)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PersistDescriptor, VariantFieldForInput } from "@beep/schema/EntitySchema"
 *
 * type Field = VariantFieldForInput<typeof S.String, PersistDescriptor.Any>
 * const field = S.String satisfies Field
 * console.log(S.isSchema(field))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VariantFieldForInput<
  Field extends EntityFieldInput,
  Descriptor extends PersistDescriptor.Any,
> = Field extends EntityVariantFieldInput ? Field : VariantFieldFor<SelectedFieldOf<Field>, Descriptor>;

/**
 * Variant field map derived from entity inputs and persistence descriptors.
 *
 * **Example** (Variant fields from inputs)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { VariantFieldsFor } from "@beep/schema/EntitySchema"
 *
 * type Fields = VariantFieldsFor<{ readonly id: typeof S.String }, {}>
 * const fields = { id: S.String } satisfies Fields
 * console.log(Object.keys(fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VariantFieldsFor<FieldMap extends EntityFieldInputs, Persisted extends PersistedMap> = {
  readonly [K in keyof FieldMap]: K extends keyof Persisted
    ? VariantFieldForInput<FieldMap[K], Persisted[K]>
    : FieldMap[K];
};

/**
 * Entity schema class produced by {@link ClassFactory}.
 *
 * **Example** (EntityClass definition access)
 *
 * ```ts
 * import type { EntityClass } from "@beep/schema/EntitySchema"
 *
 * type Definition = EntityClass.Any["definition"]
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityClass<
  Self,
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  Inherited = {},
  TableName extends string = string,
  EntityId extends EntityIdLike | undefined = EntityIdLike | undefined,
> = S.ConstraintCodec<Self, EncodedShape<FieldMap>, never, never> &
  Model.ClassShape<Self, VariantFieldsFor<FieldMap, Persisted>, {}, Inherited> & {
    readonly definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>;
  };

/**
 * Companion types for {@link EntityClass}.
 *
 * **Example** (DefinitionOf companion type)
 *
 * ```ts
 * import type { EntityClass } from "@beep/schema/EntitySchema"
 *
 * type Definition = EntityClass.DefinitionOf<EntityClass.Any>
 * const definition = { fields: {}, inputFields: {}, persisted: {}, tableName: "accounts", variantFields: {} } satisfies Definition
 * console.log(definition.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Assign fields with override)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Assign } from "@beep/schema/EntitySchema"
 *
 * type Fields = Assign<{ readonly id: typeof S.String }, { readonly name: typeof S.String }>
 * console.log({ id: S.String, name: S.String } satisfies Fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Assign<Base extends EntityFieldInputs, Extension extends EntityFieldInputs> = Simplify<
  StructAssign<Base, Extension>
>;

/**
 * Assign persisted maps with right-hand override.
 *
 * **Example** (Assign empty persisted maps)
 *
 * ```ts
 * import type { AssignPersisted } from "@beep/schema/EntitySchema"
 *
 * type Persisted = AssignPersisted<{}, {}>
 * console.log({} satisfies Persisted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AssignPersisted<BasePersisted extends PersistedMap, ExtensionPersisted extends PersistedMap> = Simplify<
  StructAssign<BasePersisted, ExtensionPersisted>
>;

/**
 * Field and persistence maps produced by composing an inherited entity shape
 * with a child entity shape.
 *
 * **Example** (Composed entity field parts)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { AssignedEntityParts } from "@beep/schema/EntitySchema"
 *
 * type Parts = AssignedEntityParts<{ readonly id: typeof S.String }, {}, { readonly name: typeof S.String }, {}>
 * const fieldKey: keyof Parts["fields"] = "id"
 * console.log(fieldKey)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Composed persisted map type)
 *
 * ```ts
 * import type { AssignedPersisted } from "@beep/schema/EntitySchema"
 *
 * type Persisted = AssignedPersisted<{}, {}, {}, {}>
 * console.log({} satisfies Persisted)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Compose base and extension)
 *
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
 * @category constructors
 * @since 0.0.0
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
