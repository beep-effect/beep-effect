/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, P, Struct } from "@beep/utils";
import { Match } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Model from "../Model/index.ts";
import * as VariantSchema from "../VariantSchema/index.ts";
import { tableNameFromIdentifier } from "./EntitySchema.constructors.ts";
import { assignEntityParts, defineClassInput } from "./EntitySchema.definition.ts";
import { EntityFieldInputError, EntitySchemaAttachmentError, selectedRowFieldShape } from "./EntitySchema.shape.ts";
import { DefinitionAnnotationKey } from "./EntitySchema.shared.ts";
import type {
  Assign,
  AssignedPersisted,
  ClassInput,
  Definition,
  EntityClass,
  SchemaAnnotations,
  TypeShape,
  VariantFieldFor,
  VariantFieldForInput,
  VariantFieldsFor,
} from "./EntitySchema.definition.ts";
import type {
  EntityFieldInput,
  EntityFieldInputs,
  EntityVariantFieldInput,
  SelectedFieldOf,
  SelectedFieldsOf,
} from "./EntitySchema.fields.ts";
import type {
  EntityIdLike,
  PersistDescriptor,
  PersistedFor,
  PersistedMap,
  PersistStrategy,
} from "./EntitySchema.persist.ts";

/**
 * Class factory with inherited invariant fields.
 *
 * @example
 * ```ts
 * import type { ClassFactory } from "@beep/schema/EntitySchema"
 *
 * type TableName = ClassFactory<unknown, {}, {}, "accounts", undefined>["definition"]["tableName"]
 * const tableName: TableName = "accounts"
 * console.log(tableName)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export type ClassFactory<
  Self,
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  TableName extends string = string,
  EntityId extends EntityIdLike | undefined = EntityIdLike | undefined,
> = EntityClass<Self, FieldMap, Persisted, {}, TableName, EntityId> & {
  readonly Class: <Child = never>(
    identifier: string
  ) => <
    const ChildFields extends EntityFieldInputs,
    const ChildPersisted extends PersistedFor<ChildFields>,
    const ChildTableName extends string = string,
    const ChildEntityId extends EntityIdLike | undefined = undefined,
  >(
    input: ClassInput<ChildFields, ChildPersisted, ChildTableName, ChildEntityId>,
    annotations?: SchemaAnnotations
  ) => [Child] extends [never]
    ? "Missing `Child` generic - use `BaseEntity.Class<Child>(...)`"
    : EntityClass<
        Child,
        Assign<FieldMap, ChildFields>,
        AssignedPersisted<FieldMap, Persisted, ChildFields, ChildPersisted>,
        Self,
        ChildTableName,
        ChildEntityId
      >;
};

const failEntityFieldInput = (field: string, message: string): never => {
  throw EntityFieldInputError.make({ field, message });
};

const modelVariantKeys = [
  "select",
  "insert",
  "update",
  "json",
  "jsonCreate",
  "jsonUpdate",
] as const satisfies ReadonlyArray<Model.Variant>;

const isModelVariantKey = (key: string): key is Model.Variant => A.contains(modelVariantKeys, key);

const hasVariant = (field: EntityVariantFieldInput, variant: Model.Variant): boolean =>
  S.isSchema(field.schemas[variant]);

type ServerSideValueStrategy = Extract<PersistStrategy, "providedByContext" | "derived" | "computedByService">;

type ExplicitVariantCompatibility =
  | { readonly _tag: "Compatible" }
  | { readonly _tag: "GeneratedOnInsertConflict" }
  | { readonly _tag: "IncrementedOnWriteConflict" }
  | { readonly _tag: "DefaultedOnInsertConflict" }
  | { readonly _tag: "ComputedByServiceOnInsertConflict" }
  | { readonly _tag: "UpdatedOnWriteConflict" }
  | { readonly _tag: "ServerSideValueConflict"; readonly valueStrategy: ServerSideValueStrategy };

const explicitVariantCompatible: ExplicitVariantCompatibility = { _tag: "Compatible" };

type VariantFieldShape = VariantSchema.Field.Any & {
  readonly schemas: VariantSchema.Field.Config;
};

function isVariantFieldShape(field: unknown): field is VariantFieldShape {
  return VariantSchema.isField(field);
}

function isSchemaField(field: unknown): field is S.Top {
  return S.isSchema(field);
}

function assertEntityVariantFieldInput(key: string, field: unknown): asserts field is EntityVariantFieldInput {
  if (isVariantFieldShape(field)) {
    for (const variant of Struct.keys(field.schemas)) {
      if (!isModelVariantKey(variant)) {
        failEntityFieldInput(key, `Entity field '${key}' uses unsupported model variant '${variant}'.`);
      }
      const schema = field.schemas[variant];
      if (!P.isUndefined(schema) && !S.isSchema(schema)) {
        failEntityFieldInput(key, `Entity field '${key}' variant '${variant}' must be a Schema.`);
      }
    }
    if (!S.isSchema(field.schemas.select)) {
      failEntityFieldInput(key, `Persisted entity field '${key}' must define a select variant.`);
    }
    return;
  }
  failEntityFieldInput(key, `Entity field '${key}' must be a Model variant field.`);
}

function selectedFieldFor<const Field extends EntityFieldInput>(key: string, field: Field): SelectedFieldOf<Field>;
function selectedFieldFor(key: string, field: EntityFieldInput): S.Top {
  if (isVariantFieldShape(field)) {
    assertEntityVariantFieldInput(key, field);
    return field.schemas.select;
  }
  if (!isSchemaField(field)) {
    failEntityFieldInput(key, `Entity field '${key}' must be a Schema or a Model variant field.`);
  }
  return field;
}

const selectedFieldsFor = <const FieldMap extends EntityFieldInputs>(fields: FieldMap): SelectedFieldsOf<FieldMap> => {
  const output = R.empty<string, S.Top>();
  for (const [key, field] of Struct.entries(fields)) {
    const selected = selectedFieldFor(key, field);
    selectedRowFieldShape(key, selected);
    output[key] = selected;
  }
  return output as SelectedFieldsOf<FieldMap>;
};

const explicitVariantCompatibilityFor = (
  field: EntityVariantFieldInput,
  descriptor: PersistDescriptor.Any
): ExplicitVariantCompatibility => {
  const insert = hasVariant(field, "insert");
  const update = hasVariant(field, "update");
  const jsonCreate = hasVariant(field, "jsonCreate");
  const jsonUpdate = hasVariant(field, "jsonUpdate");

  const matchValueStrategy: (valueStrategy: PersistStrategy) => ExplicitVariantCompatibility =
    Match.type<PersistStrategy>().pipe(
      Match.withReturnType<ExplicitVariantCompatibility>(),
      Match.when("generatedOnInsert", () =>
        insert ? { _tag: "GeneratedOnInsertConflict" } : explicitVariantCompatible
      ),
      Match.when("incrementedOnWrite", () =>
        insert || !update ? { _tag: "IncrementedOnWriteConflict" } : explicitVariantCompatible
      ),
      Match.when("defaultedOnInsert", () =>
        !insert || jsonCreate ? { _tag: "DefaultedOnInsertConflict" } : explicitVariantCompatible
      ),
      Match.when("computedByServiceOnInsert", () =>
        !insert || update || jsonCreate || jsonUpdate
          ? { _tag: "ComputedByServiceOnInsertConflict" }
          : explicitVariantCompatible
      ),
      Match.when("updatedOnWrite", () =>
        !insert || !update || jsonCreate || jsonUpdate ? { _tag: "UpdatedOnWriteConflict" } : explicitVariantCompatible
      ),
      Match.whenOr("providedByContext", "derived", "computedByService", (valueStrategy) =>
        !insert || !update || jsonCreate || jsonUpdate
          ? { _tag: "ServerSideValueConflict", valueStrategy }
          : explicitVariantCompatible
      ),
      Match.when("provided", () => explicitVariantCompatible),
      Match.exhaustive
    );

  return matchValueStrategy(descriptor.valueStrategy);
};

const assertExplicitVariantCompatibilityForKey = (
  key: string
): ((compatibility: ExplicitVariantCompatibility) => void) =>
  Match.type<ExplicitVariantCompatibility>().pipe(
    Match.tagsExhaustive({
      Compatible: () => undefined,
      GeneratedOnInsertConflict: () =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses valueStrategy 'generatedOnInsert' but its explicit helper defines an insert variant.`
        ),
      IncrementedOnWriteConflict: () =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses valueStrategy 'incrementedOnWrite' and must omit insert while keeping update.`
        ),
      DefaultedOnInsertConflict: () =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses valueStrategy 'defaultedOnInsert' and must define insert while omitting jsonCreate.`
        ),
      ComputedByServiceOnInsertConflict: () =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses valueStrategy 'computedByServiceOnInsert' and must define insert while omitting update/jsonCreate/jsonUpdate.`
        ),
      UpdatedOnWriteConflict: () =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses valueStrategy 'updatedOnWrite' and must define insert/update while omitting jsonCreate/jsonUpdate.`
        ),
      ServerSideValueConflict: ({ valueStrategy }) =>
        failEntityFieldInput(
          key,
          `Entity field '${key}' uses server-side valueStrategy '${valueStrategy}' and must define insert/update while omitting jsonCreate/jsonUpdate.`
        ),
    })
  );

function assertExplicitVariantCompatible(
  key: string,
  field: unknown,
  descriptor: PersistDescriptor.Any
): asserts field is EntityVariantFieldInput {
  assertEntityVariantFieldInput(key, field);
  assertExplicitVariantCompatibilityForKey(key)(explicitVariantCompatibilityFor(field, descriptor));
}

const withDefinitionAnnotation = <
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  TableName extends string,
  EntityId extends EntityIdLike | undefined,
>(
  definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>,
  annotations?: SchemaAnnotations
): SchemaAnnotations => Struct.assign(annotations ?? {}, { [DefinitionAnnotationKey]: definition });

const normalizeDefinition = <
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  const TableName extends string,
  const EntityId extends EntityIdLike | undefined,
>(
  identifier: string,
  input: ClassInput<FieldMap, Persisted, TableName, EntityId>
): Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId> => {
  const fields = selectedFieldsFor(input.fields);
  const variantFields = variantFieldsFor(input.fields, input.persisted);
  return {
    ...(P.isUndefined(input.entityId) ? {} : { entityId: input.entityId }),
    fields,
    inputFields: input.fields,
    persisted: input.persisted,
    tableName: (input.tableName ?? input.entityId?.tableName ?? tableNameFromIdentifier(identifier)) as TableName,
    variantFields,
  } as unknown as Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>;
};

const attachDefinition = <
  Class extends object,
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  TableName extends string,
  EntityId extends EntityIdLike | undefined,
>(
  entityClass: Class,
  definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>
): Class & {
  readonly definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>;
} => {
  Reflect.defineProperty(entityClass, "definition", {
    configurable: false,
    enumerable: true,
    value: definition,
  });
  if (hasAttachedDefinition(entityClass, definition)) {
    return entityClass;
  }
  throw EntitySchemaAttachmentError.make({ message: "Failed to attach EntitySchema definition metadata." });
};

const hasAttachedDefinition = <
  Class extends object,
  FieldMap extends EntityFieldInputs,
  Persisted extends PersistedFor<FieldMap>,
  TableName extends string,
  EntityId extends EntityIdLike | undefined,
>(
  entityClass: Class,
  definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>
): entityClass is Class & {
  readonly definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>;
} => P.hasProperty(entityClass, "definition") && Reflect.get(entityClass, "definition") === definition;

const attachEntityClassDefinition = <
  Self,
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  Inherited,
  const TableName extends string,
  const EntityId extends EntityIdLike | undefined,
>(
  entityClass: Model.ClassShape<Self, VariantFieldsFor<FieldMap, Persisted>, {}, Inherited>,
  definition: Definition<FieldMap, SelectedFieldsOf<FieldMap>, Persisted, TableName, EntityId>
): EntityClass<Self, FieldMap, Persisted, Inherited, TableName, EntityId> =>
  attachDefinition(entityClass, definition) as EntityClass<Self, FieldMap, Persisted, Inherited, TableName, EntityId>;

const matchVariantFieldDescriptor = <const Field extends S.Top>(
  field: Field
): ((descriptor: PersistDescriptor.Any) => unknown) =>
  Match.type<PersistDescriptor.Any>().pipe(
    Match.withReturnType<unknown>(),
    Match.when(
      (self) => self.valueStrategy === "generatedOnInsert" || self.valueStrategy === "incrementedOnWrite",
      () => Model.Generated(field)
    ),
    Match.when(
      (self) => self.valueStrategy === "defaultedOnInsert" && self.storageKind === "timestampMillis",
      () => Model.DateTimeInsertFromNumber
    ),
    Match.when(
      (self) => self.valueStrategy === "updatedOnWrite" && self.storageKind === "timestampMillis",
      () => Model.DateTimeUpdateFromNumber
    ),
    Match.when(
      (self) => self.valueStrategy === "defaultedOnInsert" && self.storageKind === "timestampDate",
      () => Model.DateTimeInsertFromDate
    ),
    Match.when(
      (self) => self.valueStrategy === "updatedOnWrite" && self.storageKind === "timestampDate",
      () => Model.DateTimeUpdateFromDate
    ),
    Match.when(
      (self) =>
        self.valueStrategy === "defaultedOnInsert" ||
        self.valueStrategy === "computedByServiceOnInsert" ||
        self.valueStrategy === "updatedOnWrite" ||
        self.valueStrategy === "providedByContext" ||
        self.valueStrategy === "derived" ||
        self.valueStrategy === "computedByService",
      (self) =>
        self.valueStrategy === "computedByServiceOnInsert"
          ? Model.GeneratedByAppOnInsert(field)
          : Model.GeneratedByApp(field)
    ),
    Match.orElse(() => field)
  );

const variantFieldFor = <const Field extends S.Top, const Descriptor extends PersistDescriptor.Any>(
  field: Field,
  descriptor: Descriptor
): VariantFieldFor<Field, Descriptor> =>
  matchVariantFieldDescriptor(field)(descriptor) as VariantFieldFor<Field, Descriptor>;

function variantFieldForInput<const Field extends EntityFieldInput, const Descriptor extends PersistDescriptor.Any>(
  key: string,
  field: Field,
  descriptor: Descriptor
): VariantFieldForInput<Field, Descriptor>;
function variantFieldForInput(
  key: string,
  field: EntityFieldInput,
  descriptor: PersistDescriptor.Any
): EntityFieldInput {
  if (isVariantFieldShape(field)) {
    assertExplicitVariantCompatible(key, field, descriptor);
    return field;
  }
  return variantFieldFor(selectedFieldFor(key, field), descriptor);
}

const variantFieldsFor = <const FieldMap extends EntityFieldInputs, const Persisted extends PersistedMap>(
  fields: FieldMap,
  persisted: Persisted
): VariantFieldsFor<FieldMap, Persisted> => {
  const output = R.empty<string, unknown>();
  for (const [key, field] of Struct.entries(fields)) {
    const descriptor = persisted[key];
    if (P.isUndefined(descriptor)) {
      failEntityFieldInput(key, `Entity field '${key}' is missing a persistence descriptor.`);
    }
    output[key] = variantFieldForInput(key, field, descriptor);
  }
  return output as VariantFieldsFor<FieldMap, Persisted>;
};

const makeEntityModelClass = <
  Self,
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
>(
  identifier: string,
  fields: VariantFieldsFor<FieldMap, Persisted>,
  annotations?: SchemaAnnotations
): Model.ClassShape<Self, VariantFieldsFor<FieldMap, Persisted>> => {
  const makeClass = Model.Class<Self>(identifier) as unknown as (
    fields: VariantFieldsFor<FieldMap, Persisted>,
    annotations?: SchemaAnnotations
  ) => Model.ClassShape<Self, VariantFieldsFor<FieldMap, Persisted>>;
  return makeClass(fields, annotations);
};

const extendEntityModelClass = <
  Self,
  Child,
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  const ChildFields extends EntityFieldInputs,
  const ChildPersisted extends PersistedFor<ChildFields>,
  const TableName extends string,
  const EntityId extends EntityIdLike | undefined,
>(
  baseClass: EntityClass<Self, FieldMap, Persisted, {}, TableName, EntityId>,
  identifier: string,
  fields: VariantFieldsFor<ChildFields, ChildPersisted>,
  annotations?: SchemaAnnotations
): Model.ClassShape<
  Child,
  VariantFieldsFor<Assign<FieldMap, ChildFields>, AssignedPersisted<FieldMap, Persisted, ChildFields, ChildPersisted>>,
  {},
  Self
> => {
  const extend = baseClass.extend<Child>(identifier) as unknown as (
    fields: VariantFieldsFor<ChildFields, ChildPersisted>,
    annotations?: SchemaAnnotations
  ) => Model.ClassShape<
    Child,
    VariantFieldsFor<
      Assign<FieldMap, ChildFields>,
      AssignedPersisted<FieldMap, Persisted, ChildFields, ChildPersisted>
    >,
    {},
    Self
  >;
  return extend(fields, annotations);
};

const createClass = <
  Self,
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  const TableName extends string,
  const EntityId extends EntityIdLike | undefined,
>(
  identifier: string,
  input: ClassInput<FieldMap, Persisted, TableName, EntityId>,
  annotations?: SchemaAnnotations
): EntityClass<Self, FieldMap, Persisted, {}, TableName, EntityId> => {
  const definition = normalizeDefinition(identifier, input);
  const entityClass = makeEntityModelClass<Self, FieldMap, Persisted>(
    identifier,
    definition.variantFields,
    withDefinitionAnnotation(definition, annotations)
  );
  return attachEntityClassDefinition(entityClass, definition);
};

const withClassFactory = <
  Self,
  const FieldMap extends EntityFieldInputs,
  const Persisted extends PersistedFor<FieldMap>,
  const TableName extends string,
  const EntityId extends EntityIdLike | undefined,
>(
  baseClass: EntityClass<Self, FieldMap, Persisted, {}, TableName, EntityId>
): ClassFactory<Self, FieldMap, Persisted, TableName, EntityId> => {
  const Class =
    <Child = never>(identifier: string) =>
    <
      const ChildFields extends EntityFieldInputs,
      const ChildPersisted extends PersistedFor<ChildFields>,
      const ChildTableName extends string = string,
      const ChildEntityId extends EntityIdLike | undefined = undefined,
    >(
      input: ClassInput<ChildFields, ChildPersisted, ChildTableName, ChildEntityId>,
      annotations?: SchemaAnnotations
    ) => {
      const childParts = assignEntityParts({
        baseFields: baseClass.definition.inputFields,
        basePersisted: baseClass.definition.persisted,
        extensionFields: input.fields,
        extensionPersisted: input.persisted,
      });
      const childInput = defineClassInput({
        ...(P.isUndefined(input.entityId) ? {} : { entityId: input.entityId }),
        fields: childParts.fields,
        persisted: childParts.persisted,
        ...(P.isUndefined(input.tableName) ? {} : { tableName: input.tableName }),
      });
      const childDefinition = normalizeDefinition(identifier, childInput);
      const childClass = extendEntityModelClass<
        Self,
        Child,
        FieldMap,
        Persisted,
        ChildFields,
        ChildPersisted,
        TableName,
        EntityId
      >(
        baseClass,
        identifier,
        variantFieldsFor<ChildFields, ChildPersisted>(input.fields, input.persisted),
        withDefinitionAnnotation(childDefinition, annotations)
      );
      return attachEntityClassDefinition(
        childClass,
        childDefinition as Definition<
          Assign<FieldMap, ChildFields>,
          SelectedFieldsOf<Assign<FieldMap, ChildFields>>,
          AssignedPersisted<FieldMap, Persisted, ChildFields, ChildPersisted>,
          ChildTableName,
          ChildEntityId
        >
      );
    };

  Reflect.defineProperty(baseClass, "Class", {
    configurable: true,
    value: Class,
  });
  return baseClass as ClassFactory<Self, FieldMap, Persisted, TableName, EntityId>;
};

/**
 * Build an entity schema class factory with invariant fields.
 *
 * @example
 * ```ts
 * import { ClassFactory, persist } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const Account = ClassFactory("Account")({
 *   fields: { name: S.String },
 *   persisted: { name: persist.text() }
 * })
 *
 * console.log(Account.definition.tableName)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const ClassFactory =
  (identifier: string) =>
  <
    const FieldMap extends EntityFieldInputs,
    const Persisted extends PersistedFor<FieldMap>,
    const TableName extends string = string,
    const EntityId extends EntityIdLike | undefined = undefined,
  >(
    input: ClassInput<FieldMap, Persisted, TableName, EntityId>,
    annotations?: SchemaAnnotations
  ): ClassFactory<TypeShape<FieldMap>, FieldMap, Persisted, TableName, EntityId> =>
    withClassFactory(
      createClass<TypeShape<FieldMap>, FieldMap, Persisted, TableName, EntityId>(identifier, input, annotations)
    );

/**
 * Retrieve entity metadata from schema annotations or class statics.
 *
 * @example
 * ```ts
 * import { ClassFactory, getDefinition, persist } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const Account = ClassFactory("Account")({
 *   fields: { name: S.String },
 *   persisted: { name: persist.text() }
 * })
 *
 * console.log(getDefinition(Account).tableName)
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const getDefinition = <Entity extends EntityClass.Any>(entity: Entity): EntityClass.DefinitionOf<Entity> => {
  const annotated = entity.ast.annotations?.[DefinitionAnnotationKey];
  return isDefinitionAnnotationFor(entity, annotated) ? annotated : entity.definition;
};

const isDefinitionAnnotationFor = <Entity extends EntityClass.Any>(
  entity: Entity,
  value: unknown
): value is EntityClass.DefinitionOf<Entity> =>
  P.isObject(value) &&
  P.hasProperty(value, "fields") &&
  P.hasProperty(value, "persisted") &&
  P.hasProperty(value, "tableName") &&
  Reflect.get(value, "tableName") === entity.definition.tableName;
