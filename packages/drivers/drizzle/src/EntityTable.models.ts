/**
 * Drizzle table projection for schema-first entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DrizzleId } from "@beep/identity";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { A } from "@beep/utils";
import * as Struct from "@beep/utils/Struct";
import { getColumns } from "drizzle-orm";
import {
  bigint,
  boolean,
  bytea,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Match, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type {
  AnyPgColumnBuilder,
  ExtraConfigColumn,
  PgBigInt53Builder,
  PgBooleanBuilder,
  PgBuildColumns,
  PgByteaBuilder,
  PgIntegerBuilder,
  PgJsonbBuilder,
  PgSerialBuilder,
  PgTableExtraConfigValue,
  PgTableWithColumns,
  PgTextBuilder,
  PgTimestampBuilder,
  Set$Type,
  SetIsPrimaryKey,
  SetNotNull,
} from "drizzle-orm/pg-core";

const $I = $DrizzleId.create("EntityTable.models");

class EntityTableInvariantError extends S.TaggedError<EntityTableInvariantError>($I`EntityTableInvariantError`)(
  "EntityTableInvariantError",
  {
    message: S.String,
  },
  $I.annote("EntityTableInvariantError", {
    description: "Drizzle entity table projection invariant failure.",
  })
) {}

type EncodedAllowsNull<Encoded> = null extends Encoded ? true : false;

type TypedBuilder<Builder extends AnyPgColumnBuilder, Encoded> = Set$Type<Builder, Encoded>;

type ColumnMethods<Builder extends AnyPgColumnBuilder> = Builder & {
  readonly $type: <Type>() => Set$Type<Builder, Type>;
  readonly notNull: () => SetNotNull<Builder>;
  readonly primaryKey: () => SetIsPrimaryKey<Builder>;
};

type FieldDescriptor = EntitySchema.PersistDescriptorByValueStrategy<EntitySchema.PersistDescriptor>;
type EntityIdDescriptor = Extract<FieldDescriptor, { readonly storageKind: "entityId" }>;
type ExtraConfigColumnMap = Record<string, ExtraConfigColumn>;

type EntityIdColumnBuilderRuntimeBaseFor<Descriptor extends FieldDescriptor> = Descriptor extends unknown
  ? Descriptor["valueStrategy"] extends "generatedOnInsert"
    ? PgSerialBuilder
    : PgIntegerBuilder
  : never;

type ColumnBuilderRuntimeBaseFor<Descriptor extends FieldDescriptor> = Descriptor extends unknown
  ? Descriptor["storageKind"] extends "blob"
    ? PgByteaBuilder
    : Descriptor["storageKind"] extends "bool"
      ? PgBooleanBuilder
      : Descriptor["storageKind"] extends "entityId"
        ? EntityIdColumnBuilderRuntimeBaseFor<Descriptor>
        : Descriptor["storageKind"] extends "int"
          ? PgIntegerBuilder
          : Descriptor["storageKind"] extends "jsonb"
            ? PgJsonbBuilder
            : Descriptor["storageKind"] extends "timestampMillis"
              ? PgBigInt53Builder
              : Descriptor["storageKind"] extends "timestampDate"
                ? PgTimestampBuilder
                : PgTextBuilder
  : never;

type ColumnBuilderBaseFor<Descriptor extends FieldDescriptor, Encoded> = TypedBuilder<
  ColumnBuilderRuntimeBaseFor<Descriptor>,
  Encoded
>;

type ColumnBuilderWithNullability<
  Descriptor extends FieldDescriptor,
  Encoded,
  Builder extends AnyPgColumnBuilder,
> = Descriptor["valueStrategy"] extends "generatedOnInsert"
  ? SetIsPrimaryKey<TypedBuilder<PgSerialBuilder, Encoded>>
  : EncodedAllowsNull<Encoded> extends true
    ? Builder
    : SetNotNull<Builder>;

/**
 * Drizzle column builder type derived from one persisted descriptor.
 *
 * **Details**
 *
 * The descriptor controls the runtime builder family, encoded TypeScript data
 * type, generated primary-key handling, and nullable/not-null column shape.
 *
 * **Example** (Derive builder from descriptor)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { EntityTable } from "@beep/drizzle"
 * import { persist } from "@beep/schema/EntitySchema"
 *
 * const descriptor = persist.text()
 * type NameColumn = EntityTable.ColumnBuilderFor<typeof descriptor, string>
 * const derivesColumnBuilder: [NameColumn] extends [never] ? false : true = true
 *
 * strictEqual(derivesColumnBuilder, true)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ColumnBuilderFor<Descriptor extends FieldDescriptor, Encoded> = ColumnBuilderWithNullability<
  Descriptor,
  Encoded,
  ColumnBuilderBaseFor<Descriptor, Encoded>
>;

/**
 * Drizzle column-builder map derived from an entity definition.
 *
 * **Example** (Map builders from entity)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { EntityTable } from "@beep/drizzle"
 * import { $SchemaId } from "@beep/identity"
 * import * as EntitySchema from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("EntityTableColumns")
 * const Widget = EntitySchema.ClassFactory($I`Widget`)({
 *   fields: { name: S.String },
 *   persisted: { name: EntitySchema.persist.text() },
 *   tableName: "widget"
 * })
 *
 * type WidgetColumns = EntityTable.ColumnBuilderMapFor<typeof Widget.definition>
 * const hasNameColumn: "name" extends keyof WidgetColumns ? true : false = true
 *
 * strictEqual(hasNameColumn, true)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ColumnBuilderMapFor<Definition extends EntitySchema.Definition> = {
  readonly [K in keyof Definition["persisted"] & string]: K extends keyof Definition["fields"]
    ? ColumnBuilderFor<Definition["persisted"][K], S.Codec.Encoded<Definition["fields"][K]>>
    : never;
};

/**
 * Drizzle table type derived from a schema-first entity class.
 *
 * **Details**
 *
 * Values of this type carry both Drizzle's `PgTableWithColumns` metadata and
 * the original schema-first entity definition attached by {@link pgTableFrom}.
 *
 * **Example** (Typed table from entity class)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { EntityTable } from "@beep/drizzle"
 * import { $SchemaId } from "@beep/identity"
 * import * as EntitySchema from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("EntityTableFor")
 * const Widget = EntitySchema.ClassFactory($I`Widget`)({
 *   fields: { name: S.String },
 *   persisted: { name: EntitySchema.persist.text() },
 *   tableName: "widget"
 * })
 *
 * const table: EntityTable.TableFor<typeof Widget> = EntityTable.pgTableFrom(Widget)
 * strictEqual(table.definition.tableName, "widget")
 * strictEqual(table.entitySchema, Widget)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TableFor<Entity extends EntitySchema.EntityClass.Any> = PgTableWithColumns<{
  name: EntitySchema.EntityClass.DefinitionOf<Entity>["tableName"];
  schema: undefined;
  columns: PgBuildColumns<
    EntitySchema.EntityClass.DefinitionOf<Entity>["tableName"],
    ColumnBuilderMapFor<EntitySchema.EntityClass.DefinitionOf<Entity>>
  >;
  dialect: "pg";
}> & {
  readonly definition: EntitySchema.EntityClass.DefinitionOf<Entity>;
  readonly entitySchema: Entity;
};

const hasCallableProperty = (self: object, key: PropertyKey): boolean =>
  P.hasProperty(self, key) && P.isFunction(Reflect.get(self, key));

const hasColumnMethods = <Builder extends AnyPgColumnBuilder>(column: Builder): column is ColumnMethods<Builder> =>
  hasCallableProperty(column, "$type") &&
  hasCallableProperty(column, "notNull") &&
  hasCallableProperty(column, "primaryKey");

const columnMethods = <Builder extends AnyPgColumnBuilder>(column: Builder): ColumnMethods<Builder> => {
  if (hasColumnMethods(column)) {
    return column;
  }
  throw EntityTableInvariantError.make({
    message: "Drizzle column builder is missing the expected fluent column methods.",
  });
};

const typedColumn = <Encoded, Builder extends AnyPgColumnBuilder>(column: Builder): Set$Type<Builder, Encoded> =>
  columnMethods(column).$type<Encoded>();

const notNullColumn = <Builder extends AnyPgColumnBuilder>(column: Builder): SetNotNull<Builder> =>
  columnMethods(column).notNull();

const primaryKeyColumn = <Builder extends AnyPgColumnBuilder>(column: Builder): SetIsPrimaryKey<Builder> =>
  columnMethods(column).primaryKey();

const drizzleColumnBoundary = <const Descriptor extends FieldDescriptor, Encoded, Builder extends AnyPgColumnBuilder>(
  column: Builder | SetIsPrimaryKey<Builder> | SetNotNull<Builder>
): ColumnBuilderWithNullability<Descriptor, Encoded, Builder> =>
  column as ColumnBuilderWithNullability<Descriptor, Encoded, Builder>;

const columnWithNullability = <
  const Field extends S.Top,
  const Descriptor extends FieldDescriptor,
  Builder extends AnyPgColumnBuilder,
>(
  key: string,
  field: Field,
  descriptor: Descriptor,
  column: Builder
): ColumnBuilderWithNullability<Descriptor, S.Codec.Encoded<Field>, Builder> => {
  if (descriptor.valueStrategy === "generatedOnInsert") {
    return drizzleColumnBoundary<Descriptor, S.Codec.Encoded<Field>, Builder>(primaryKeyColumn(column));
  }
  return drizzleColumnBoundary<Descriptor, S.Codec.Encoded<Field>, Builder>(
    EntitySchema.selectedRowFieldShape(key, field).allowsNull ? column : notNullColumn(column)
  );
};

function entityIdColumn<const Descriptor extends EntityIdDescriptor>(
  key: string,
  descriptor: Descriptor
): EntityIdColumnBuilderRuntimeBaseFor<Descriptor>;
function entityIdColumn(
  key: string,
  descriptor: EntityIdDescriptor
): EntityIdColumnBuilderRuntimeBaseFor<EntityIdDescriptor> {
  const columnName = EntitySchema.columnNameFor(key, descriptor);
  return Match.value(descriptor).pipe(
    Match.withReturnType<EntityIdColumnBuilderRuntimeBaseFor<EntityIdDescriptor>>(),
    Match.discriminatorsExhaustive("valueStrategy")({
      computedByService: () => integer(columnName),
      computedByServiceOnInsert: () => integer(columnName),
      defaultedOnInsert: () => integer(columnName),
      derived: () => integer(columnName),
      generatedOnInsert: () => serial(columnName),
      incrementedOnWrite: () => integer(columnName),
      provided: () => integer(columnName),
      providedByContext: () => integer(columnName),
      updatedOnWrite: () => integer(columnName),
    })
  );
}

const baseColumnFor = <const Descriptor extends FieldDescriptor>(
  key: string,
  descriptor: Descriptor
): ColumnBuilderRuntimeBaseFor<Descriptor> => {
  const columnName = EntitySchema.columnNameFor(key, descriptor);
  const descriptorForMatch: FieldDescriptor = descriptor;
  const column = Match.value(descriptorForMatch).pipe(
    Match.withReturnType<AnyPgColumnBuilder>(),
    Match.discriminatorsExhaustive("storageKind")({
      blob: () => bytea(columnName),
      bool: () => boolean(columnName),
      entityId: (self) => entityIdColumn(key, self),
      int: () => integer(columnName),
      jsonb: () => jsonb(columnName),
      literal: () => text(columnName),
      text: () => text(columnName),
      timestampDate: () => timestamp(columnName, { mode: "date" }),
      timestampMillis: () => bigint(columnName, { mode: "number" }),
    })
  );
  return column as ColumnBuilderRuntimeBaseFor<Descriptor>;
};

const typedColumnFor = <const Field extends S.Top, const Descriptor extends FieldDescriptor>(
  key: string,
  field: Field,
  descriptor: Descriptor
): ColumnBuilderFor<Descriptor, S.Codec.Encoded<Field>> => {
  const column = typedColumn<S.Codec.Encoded<Field>, ColumnBuilderRuntimeBaseFor<Descriptor>>(
    baseColumnFor(key, descriptor)
  );
  return columnWithNullability(key, field, descriptor, column);
};

const columnsFor = <const Definition extends EntitySchema.Definition>(
  definition: Definition
): ColumnBuilderMapFor<Definition> => {
  const columns: Record<string, AnyPgColumnBuilder> = {};
  for (const key of Struct.keys(definition.persisted)) {
    columns[key] = typedColumnFor(key, definition.fields[key], definition.persisted[key]);
  }
  return columns as ColumnBuilderMapFor<Definition>;
};

const indexName = (
  tableName: string,
  key: string,
  descriptor: EntitySchema.PersistDescriptor,
  hint: EntitySchema.IndexHint
): string => `${tableName}_${EntitySchema.columnNameFor(key, descriptor)}_${hint.kind}_idx`;

const isJsonbIndexableStorageKind = (storageKind: EntitySchema.StorageKind): boolean =>
  EntitySchema.StorageKind.is.jsonb(storageKind);

const isScalarIndexableStorageKind = (storageKind: EntitySchema.StorageKind): boolean =>
  EntitySchema.StorageKind.is.bool(storageKind) ||
  EntitySchema.StorageKind.is.entityId(storageKind) ||
  EntitySchema.StorageKind.is.int(storageKind) ||
  EntitySchema.StorageKind.is.literal(storageKind) ||
  EntitySchema.StorageKind.is.text(storageKind) ||
  EntitySchema.StorageKind.is.timestampDate(storageKind) ||
  EntitySchema.StorageKind.is.timestampMillis(storageKind);

const supportsIndexHint = (descriptor: EntitySchema.PersistDescriptor, hint: EntitySchema.IndexHint): boolean =>
  Match.value(hint).pipe(
    Match.withReturnType<boolean>(),
    Match.discriminatorsExhaustive("kind")({
      btree: () => isScalarIndexableStorageKind(descriptor.storageKind),
      gin: () => isJsonbIndexableStorageKind(descriptor.storageKind),
      hash: () => isScalarIndexableStorageKind(descriptor.storageKind),
      lookup: () => isScalarIndexableStorageKind(descriptor.storageKind),
      unique: () => isScalarIndexableStorageKind(descriptor.storageKind),
    })
  );

const hasHintKind = (hints: ReadonlyArray<EntitySchema.IndexHint>, kind: EntitySchema.IndexHintKind): boolean =>
  pipe(
    hints,
    A.some((hint) => hint.kind === kind)
  );

const indexHintsForDescriptor = (descriptor: EntitySchema.PersistDescriptor): ReadonlyArray<EntitySchema.IndexHint> =>
  pipe(
    O.fromNullishOr(descriptor.indexHints),
    O.map((hints) =>
      pipe(
        hints,
        A.filter((hint) => supportsIndexHint(descriptor, hint)),
        A.filter((hint) => hint.kind !== "lookup" || !hasHintKind(hints, "btree"))
      )
    ),
    O.getOrElse(A.empty<EntitySchema.IndexHint>)
  );

const indexFor = (
  tableName: string,
  key: string,
  descriptor: EntitySchema.PersistDescriptor,
  column: ExtraConfigColumn,
  hint: EntitySchema.IndexHint
): PgTableExtraConfigValue =>
  Match.value(hint).pipe(
    Match.withReturnType<PgTableExtraConfigValue>(),
    Match.discriminatorsExhaustive("kind")({
      btree: (self) => index(indexName(tableName, key, descriptor, self)).on(column),
      gin: (self) => index(indexName(tableName, key, descriptor, self)).using("gin", column),
      hash: (self) => index(indexName(tableName, key, descriptor, self)).using("hash", column),
      lookup: (self) => index(indexName(tableName, key, descriptor, self)).on(column),
      unique: (self) => uniqueIndex(indexName(tableName, key, descriptor, self)).on(column),
    })
  );

const indexesForDescriptor = (
  tableName: string,
  columns: ExtraConfigColumnMap,
  key: string,
  descriptor: EntitySchema.PersistDescriptor
): Array<PgTableExtraConfigValue> =>
  pipe(
    R.get(columns, key),
    O.map((column) =>
      pipe(
        indexHintsForDescriptor(descriptor),
        A.map((hint) => indexFor(tableName, key, descriptor, column, hint))
      )
    ),
    O.getOrElse(A.empty<PgTableExtraConfigValue>)
  );

const indexesFor = (
  tableName: string,
  definition: EntitySchema.Definition,
  columns: ExtraConfigColumnMap
): Array<PgTableExtraConfigValue> =>
  pipe(
    Struct.entries(definition.persisted),
    A.flatMap(([key, descriptor]) => indexesForDescriptor(tableName, columns, key, descriptor))
  );

const attachTableMetadata = <const Entity extends EntitySchema.EntityClass.Any>(
  table: object,
  definition: EntitySchema.EntityClass.DefinitionOf<Entity>,
  entitySchema: Entity
): TableFor<Entity> => {
  Reflect.defineProperty(table, "definition", {
    configurable: false,
    enumerable: true,
    value: definition,
  });
  Reflect.defineProperty(table, "entitySchema", {
    configurable: false,
    enumerable: true,
    value: entitySchema,
  });
  if (hasAttachedTableMetadata(table, definition, entitySchema)) {
    return table;
  }
  throw EntityTableInvariantError.make({
    message: `Failed to attach EntitySchema metadata to table '${definition.tableName}'.`,
  });
};

const hasAttachedTableMetadata = <const Entity extends EntitySchema.EntityClass.Any>(
  table: object,
  definition: EntitySchema.EntityClass.DefinitionOf<Entity>,
  entitySchema: Entity
): table is TableFor<Entity> =>
  P.hasProperty(table, "definition") &&
  Reflect.get(table, "definition") === definition &&
  P.hasProperty(table, "entitySchema") &&
  Reflect.get(table, "entitySchema") === entitySchema;

/**
 * Project a schema-first entity class into a typed Postgres Drizzle table.
 *
 * **Gotchas**
 *
 * Projection is metadata-only: this does not create a physical table, run DDL,
 * or execute migrations. Unsupported index hints are ignored during Drizzle
 * metadata construction.
 *
 * **Example** (Project entity into table)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { EntityTable } from "@beep/drizzle"
 * import { $SchemaId } from "@beep/identity"
 * import * as EntitySchema from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("EntityTableExample")
 * const Widget = EntitySchema.ClassFactory($I`Widget`)({
 *   fields: {
 *     name: S.String
 *   },
 *   persisted: {
 *     name: EntitySchema.persist.text()
 *   },
 *   tableName: "widget"
 * })
 *
 * const table = EntityTable.pgTableFrom(Widget)
 * strictEqual(table.definition.tableName, "widget")
 * strictEqual(EntityTable.columns(table).name.name, "name")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pgTableFrom = <const Entity extends EntitySchema.EntityClass.Any>(entity: Entity): TableFor<Entity> => {
  const definition = EntitySchema.getDefinition(entity);
  const table = pgTable(
    definition.tableName,
    () => columnsFor(definition),
    (columns) => indexesFor(definition.tableName, definition, columns)
  );
  return attachTableMetadata(table, definition, entity);
};

/**
 * Get projected table columns using Drizzle metadata.
 *
 * **Details**
 *
 * For tables returned by {@link pgTableFrom}, the columns preserve Drizzle
 * column metadata while the table itself also retains the source entity
 * definition.
 *
 * **Example** (Read projected column metadata)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { EntityTable } from "@beep/drizzle"
 * import { $SchemaId } from "@beep/identity"
 * import * as EntitySchema from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("EntityTableColumnsExample")
 * const Widget = EntitySchema.ClassFactory($I`Widget`)({
 *   fields: {
 *     name: S.String
 *   },
 *   persisted: {
 *     name: EntitySchema.persist.text()
 *   },
 *   tableName: "widget"
 * })
 *
 * const table = EntityTable.pgTableFrom(Widget)
 * const columns = EntityTable.columns(table)
 * strictEqual(columns.name.name, "name")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const columns = getColumns;
