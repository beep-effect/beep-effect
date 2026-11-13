/**
 * Object types: what a kind of object is called, which properties it declares, what backs it and how it
 * relates to link types and interfaces.
 *
 * **Details**
 *
 * OSDK keeps four renderings of this one idea (the wire `ObjectTypeV2`, the
 * `ObjectMetadata` it converts to, the generated compile-time definition and
 * the authoring model) and restates the same rule in each: the primary key and
 * the title are declared properties. Here there is one record,
 * {@link ObjectType}, whose encoded side is the wire JSON and whose invariants
 * are checks on the schema itself, and one bundle, {@link ObjectTypeDefinition},
 * that adds the outgoing link sides and the interface implementations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constTrue, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Tuple from "effect/Tuple";
import {
  BooleanType,
  ByteType,
  DateType,
  DoubleType,
  IntegerType,
  LongType,
  ShortType,
  StringType,
  TimestampType,
} from "../DataType/DataType.model.ts";
import { PrimaryKeyKind } from "../DataType/DataType.values.ts";
import {
  ActionTypeApiName,
  InterfaceLinkTypeApiName,
  InterfacePropertyApiName,
  InterfaceTypeApiName,
  InterfaceTypeRid,
  LinkTypeApiName,
  MediaSetRid,
  MediaSetViewRid,
  ObjectTypeApiName,
  ObjectTypeRid,
  PropertyApiName,
  SharedPropertyTypeApiName,
  StructFieldApiName,
} from "../Identifier/Identifier.model.ts";
import { LinkTypeSide } from "../LinkType/LinkType.model.ts";
import { Icon, ReleaseStatus, Visibility } from "../Metadata/Metadata.values.ts";
import { PropertyDefinition } from "../Property/Property.model.ts";
import { GeotimeSeriesIntegrationRid } from "../TimeSeries/GeotimeSeries.model.ts";
import { TimeSeriesSyncRid } from "../TimeSeries/TimeSeries.model.ts";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $ScratchpadId.create("osdk/ObjectType/ObjectType.model");

// -----------------------------------------------------------------------------
// Datasource identifiers
// -----------------------------------------------------------------------------

/**
 * Identifier the platform generates for one datasource of an object type.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DatasourceRid = S.NonEmptyString.pipe(
  S.brand("DatasourceRid"),
  $I.annoteSchema("DatasourceRid", {
    description: "Identifier the platform generates for one datasource of an object type.",
  })
);

/**
 * Runtime type of {@link DatasourceRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DatasourceRid = typeof DatasourceRid.Type;

/**
 * Branch of a backing datasource, as the user named it.
 *
 * **Gotchas**
 *
 * This is free text chosen by a person, not a resource identifier, so it must
 * never be validated as one.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DatasourceBranchId = S.NonEmptyString.pipe(
  S.brand("DatasourceBranchId"),
  $I.annoteSchema("DatasourceBranchId", {
    description: "Branch of a backing datasource, as the user named it.",
  })
);

/**
 * Runtime type of {@link DatasourceBranchId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DatasourceBranchId = typeof DatasourceBranchId.Type;

/**
 * Resource identifier of a dataset.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DatasetRid = S.NonEmptyString.pipe(
  S.brand("DatasetRid"),
  $I.annoteSchema("DatasetRid", { description: "Resource identifier of a dataset." })
);

/**
 * Runtime type of {@link DatasetRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DatasetRid = typeof DatasetRid.Type;

/**
 * Resource identifier of a table registered from an external system.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const TableRid = S.NonEmptyString.pipe(
  S.brand("TableRid"),
  $I.annoteSchema("TableRid", { description: "Resource identifier of a table registered from an external system." })
);

/**
 * Runtime type of {@link TableRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type TableRid = typeof TableRid.Type;

/**
 * Resource identifier of a stream of records.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const StreamRid = S.NonEmptyString.pipe(
  S.brand("StreamRid"),
  $I.annoteSchema("StreamRid", { description: "Resource identifier of a stream of records." })
);

/**
 * Runtime type of {@link StreamRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type StreamRid = typeof StreamRid.Type;

/**
 * Resource identifier of a restricted view: a dataset filtered row by row to what each reader may see.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RestrictedViewRid = S.NonEmptyString.pipe(
  S.brand("RestrictedViewRid"),
  $I.annoteSchema("RestrictedViewRid", {
    description: "Resource identifier of a restricted view: a dataset filtered row by row to what each reader may see.",
  })
);

/**
 * Runtime type of {@link RestrictedViewRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RestrictedViewRid = typeof RestrictedViewRid.Type;

/**
 * Resource identifier of a direct-write source, which a writer fills without going through a dataset.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DirectSourceRid = S.NonEmptyString.pipe(
  S.brand("DirectSourceRid"),
  $I.annoteSchema("DirectSourceRid", {
    description: "Resource identifier of a direct-write source, which a writer fills without going through a dataset.",
  })
);

/**
 * Runtime type of {@link DirectSourceRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type DirectSourceRid = typeof DirectSourceRid.Type;

/**
 * Name of a column in a tabular datasource.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ColumnName = S.NonEmptyString.pipe(
  S.brand("ColumnName"),
  $I.annoteSchema("ColumnName", { description: "Name of a column in a tabular datasource." })
);

/**
 * Runtime type of {@link ColumnName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ColumnName = typeof ColumnName.Type;

/**
 * Name of a field inside a struct-typed column of a tabular datasource.
 *
 * **Details**
 *
 * This names the field as the datasource spells it. The field of the struct
 * property it feeds has its own name, a `StructFieldApiName`.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ColumnFieldName = S.NonEmptyString.pipe(
  S.brand("ColumnFieldName"),
  $I.annoteSchema("ColumnFieldName", {
    description: "Name of a field inside a struct-typed column of a tabular datasource.",
  })
);

/**
 * Runtime type of {@link ColumnFieldName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ColumnFieldName = typeof ColumnFieldName.Type;

/**
 * Name of an action slot an interface declares, which each implementing object type binds to one of its action types.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InterfaceActionConstraintApiName = S.NonEmptyString.pipe(
  S.brand("InterfaceActionConstraintApiName"),
  $I.annoteSchema("InterfaceActionConstraintApiName", {
    description:
      "Name of an action slot an interface declares, bound by each implementing object type to an action type.",
  })
);

/**
 * Runtime type of {@link InterfaceActionConstraintApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type InterfaceActionConstraintApiName = typeof InterfaceActionConstraintApiName.Type;

// -----------------------------------------------------------------------------
// Property mappings
// -----------------------------------------------------------------------------

const PropertyMappingKind = LiteralKit(["column", "struct", "editOnly"]);

/**
 * A property filled from one column of the datasource.
 *
 * @category models
 * @since 0.0.0
 */
export class ColumnPropertyMapping extends S.Opaque<ColumnPropertyMapping, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("column"),
    column: ColumnName.annotateKey({ description: "Column the property's values are read from." }),
  }).pipe(
    $I.annoteSchema("ColumnPropertyMapping", { description: "A property filled from one column of the datasource." })
  )
) {}

/**
 * The struct property field that one field of a struct-typed column feeds.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldPropertyMapping extends S.Opaque<
  StructFieldPropertyMapping,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    apiName: StructFieldApiName.annotateKey({ description: "Field of the struct property that receives the value." }),
  }).pipe(
    $I.annoteSchema("StructFieldPropertyMapping", {
      description: "The struct property field that one field of a struct-typed column feeds.",
    })
  )
) {}

/**
 * A struct property filled from one struct-typed column, field by field.
 *
 * @category models
 * @since 0.0.0
 */
export class StructPropertyMapping extends S.Opaque<StructPropertyMapping, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    column: ColumnName.annotateKey({ description: "Struct-typed column the property's values are read from." }),
    fields: S.Record(ColumnFieldName, StructFieldPropertyMapping).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ColumnFieldName, StructFieldPropertyMapping>())),
      S.annotateKey({ description: "For each field of the column, the field of the struct property it feeds." })
    ),
  }).pipe(
    $I.annoteSchema("StructPropertyMapping", {
      description: "A struct property filled from one struct-typed column, field by field.",
    })
  )
) {}

/**
 * A property that the datasource secures but never fills: its values come only from actions.
 *
 * @category models
 * @since 0.0.0
 */
export class EditOnlyPropertyMapping extends S.Opaque<EditOnlyPropertyMapping, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("editOnly") }).pipe(
    $I.annoteSchema("EditOnlyPropertyMapping", {
      description: "A property that the datasource secures but never fills: its values come only from actions.",
    })
  )
) {}

/**
 * How one property is bound to a tabular datasource: to a column, to a struct-typed column, or to nothing.
 *
 * **Example** (Name the column behind a property)
 *
 * ```ts import.meta.vitest name="Name the column behind a property"
 * import * as O from "effect/Option"
 * import { ColumnName, ColumnPropertyMapping, EditOnlyPropertyMapping, PropertyMapping } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const backingColumn = PropertyMapping.match({
 *   column: ({ column }) => O.some(column),
 *   struct: ({ column }) => O.some(column),
 *   editOnly: () => O.none(),
 * })
 * const columns = [
 *   O.getOrNull(backingColumn(ColumnPropertyMapping.make({ column: ColumnName.make("employee_id") }))),
 *   O.getOrNull(backingColumn(EditOnlyPropertyMapping.make({}))),
 * ]
 * columns // => ["employee_id", null]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyMapping = PropertyMappingKind.mapMembers(() =>
  Tuple.make(ColumnPropertyMapping, StructPropertyMapping, EditOnlyPropertyMapping)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertyMapping", {
    description:
      "How one property is bound to a tabular datasource: to a column, to a struct-typed column, or to nothing.",
  })
);

/**
 * Runtime type of {@link PropertyMapping}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyMapping = typeof PropertyMapping.Type;

// -----------------------------------------------------------------------------
// Datasources
// -----------------------------------------------------------------------------

const DatasourceKind = LiteralKit([
  "dataset",
  "table",
  "stream",
  "restrictedView",
  "direct",
  "timeSeries",
  "geotimeSeries",
  "mediaSetView",
  "unsupported",
  "editsOnly",
]);

const columnMappings = S.Record(PropertyApiName, PropertyMapping).pipe(
  S.withConstructorDefault(Effect.succeed(R.empty<PropertyApiName, PropertyMapping>())),
  S.annotateKey({ description: "How each property the datasource backs is bound to it." })
);

const backedProperties = S.Array(PropertyApiName).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<PropertyApiName>())),
  S.annotateKey({ description: "Properties the datasource backs." })
);

const datasourceBranch = S.OptionFromOptionalKey(DatasourceBranchId).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({ description: "Branch of the source the object type reads, when it is not the default." })
);

/**
 * Backing by a dataset.
 *
 * @category models
 * @since 0.0.0
 */
export class DatasetDatasource extends S.Opaque<DatasetDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("dataset"),
    datasetRid: DatasetRid.annotateKey({ description: "The dataset that holds the rows." }),
    branch: datasourceBranch,
    propertyMapping: columnMappings,
  }).pipe($I.annoteSchema("DatasetDatasource", { description: "Backing by a dataset." }))
) {}

/**
 * Backing by a table registered from an external system.
 *
 * @category models
 * @since 0.0.0
 */
export class TableDatasource extends S.Opaque<TableDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("table"),
    tableRid: TableRid.annotateKey({ description: "The table that holds the rows." }),
    branch: datasourceBranch,
    propertyMapping: columnMappings,
  }).pipe($I.annoteSchema("TableDatasource", { description: "Backing by a table registered from an external system." }))
) {}

/**
 * Backing by a stream of records.
 *
 * @category models
 * @since 0.0.0
 */
export class StreamDatasource extends S.Opaque<StreamDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("stream"),
    streamRid: StreamRid.annotateKey({ description: "The stream that carries the records." }),
    branch: datasourceBranch,
    propertyMapping: columnMappings,
  }).pipe($I.annoteSchema("StreamDatasource", { description: "Backing by a stream of records." }))
) {}

/**
 * Backing by a restricted view, which filters rows to what each reader may see.
 *
 * @category models
 * @since 0.0.0
 */
export class RestrictedViewDatasource extends S.Opaque<RestrictedViewDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("restrictedView"),
    restrictedViewRid: RestrictedViewRid.annotateKey({ description: "The restricted view that holds the rows." }),
    propertyMapping: columnMappings,
  }).pipe(
    $I.annoteSchema("RestrictedViewDatasource", {
      description: "Backing by a restricted view, which filters rows to what each reader may see.",
    })
  )
) {}

/**
 * Backing by a direct-write source: some writer puts property values there without a dataset in between.
 *
 * @category models
 * @since 0.0.0
 */
export class DirectDatasource extends S.Opaque<DirectDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("direct"),
    directSourceRid: DirectSourceRid.annotateKey({ description: "The source the writer writes to." }),
    propertyMapping: columnMappings,
  }).pipe(
    $I.annoteSchema("DirectDatasource", {
      description:
        "Backing by a direct-write source: a writer puts property values there without a dataset in between.",
    })
  )
) {}

/**
 * Backing of time series properties by a time series sync.
 *
 * @category models
 * @since 0.0.0
 */
export class TimeSeriesDatasource extends S.Opaque<TimeSeriesDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("timeSeries"),
    timeSeriesSyncRid: TimeSeriesSyncRid.annotateKey({ description: "The sync that feeds the series." }),
    properties: backedProperties,
  }).pipe(
    $I.annoteSchema("TimeSeriesDatasource", {
      description: "Backing of time series properties by a time series sync.",
    })
  )
) {}

/**
 * Backing of geotime series reference properties by a geotime series integration.
 *
 * @category models
 * @since 0.0.0
 */
export class GeotimeSeriesDatasource extends S.Opaque<GeotimeSeriesDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("geotimeSeries"),
    geotimeSeriesIntegrationRid: GeotimeSeriesIntegrationRid.annotateKey({
      description: "The integration that feeds the positions.",
    }),
    properties: backedProperties,
  }).pipe(
    $I.annoteSchema("GeotimeSeriesDatasource", {
      description: "Backing of geotime series reference properties by a geotime series integration.",
    })
  )
) {}

/**
 * Backing of media reference properties by a view over a media set.
 *
 * @category models
 * @since 0.0.0
 */
export class MediaSetViewDatasource extends S.Opaque<MediaSetViewDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mediaSetView"),
    mediaSetRid: MediaSetRid.annotateKey({ description: "The media set that stores the items." }),
    mediaSetViewRid: MediaSetViewRid.annotateKey({ description: "The view of the media set the object type reads." }),
    properties: backedProperties,
  }).pipe(
    $I.annoteSchema("MediaSetViewDatasource", {
      description: "Backing of media reference properties by a view over a media set.",
    })
  )
) {}

/**
 * Backing of a kind this version of the contract cannot describe; only its name and the properties it backs are known.
 *
 * @category models
 * @since 0.0.0
 */
export class UnsupportedDatasource extends S.Opaque<UnsupportedDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("unsupported"),
    unsupportedType: S.String.annotateKey({ description: "What the platform calls the kind of backing." }),
    properties: backedProperties,
  }).pipe(
    $I.annoteSchema("UnsupportedDatasource", {
      description: "Backing of a kind this version of the contract cannot describe.",
    })
  )
) {}

/**
 * No backing source at all: every object and every value is created through actions.
 *
 * @category models
 * @since 0.0.0
 */
export class EditsOnlyDatasource extends S.Opaque<EditsOnlyDatasource, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("editsOnly") }).pipe(
    $I.annoteSchema("EditsOnlyDatasource", {
      description: "No backing source at all: every object and every value is created through actions.",
    })
  )
) {}

/**
 * What stands behind some of an object type's properties: one of ten kinds of source.
 *
 * **Details**
 *
 * The kinds fall into three families. Tabular sources (`dataset`, `table`,
 * `stream`, `restrictedView`, `direct`) bind each property to a column through
 * a {@link PropertyMapping}. Reference sources (`timeSeries`, `geotimeSeries`,
 * `mediaSetView`, `unsupported`) only list the properties they back.
 * `editsOnly` carries nothing: there is no source.
 *
 * **Example** (Tell tabular sources from the rest)
 *
 * ```ts import.meta.vitest name="Tell tabular sources from the rest"
 * import { DatasetDatasource, DatasetRid, DatasourceDefinition, EditsOnlyDatasource } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const isTabular = DatasourceDefinition.isAnyOf(["dataset", "table", "stream", "restrictedView", "direct"])
 * const dataset = DatasetDatasource.make({ datasetRid: DatasetRid.make("ri.foundry.main.dataset.employees") })
 * const verdicts = [isTabular(dataset), isTabular(EditsOnlyDatasource.make({}))]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatasourceDefinition = DatasourceKind.mapMembers(() =>
  Tuple.make(
    DatasetDatasource,
    TableDatasource,
    StreamDatasource,
    RestrictedViewDatasource,
    DirectDatasource,
    TimeSeriesDatasource,
    GeotimeSeriesDatasource,
    MediaSetViewDatasource,
    UnsupportedDatasource,
    EditsOnlyDatasource
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DatasourceDefinition", {
    description: "What stands behind some of an object type's properties: one of ten kinds of source.",
  })
);

/**
 * Runtime type of {@link DatasourceDefinition}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatasourceDefinition = typeof DatasourceDefinition.Type;

/**
 * One datasource of an object type: its identifier and what kind of source it is.
 *
 * **Details**
 *
 * An object type has one or more datasources, and together they back all of
 * its properties.
 *
 * **Example** (Decode a dataset-backed datasource)
 *
 * ```ts import.meta.vitest name="Decode a dataset-backed datasource"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeDatasource } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const datasource = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectTypeDatasource)({
 *     rid: "ri.ontology.main.datasource.1",
 *     definition: {
 *       type: "dataset",
 *       datasetRid: "ri.foundry.main.dataset.employees",
 *       propertyMapping: { employeeId: { type: "column", column: "employee_id" } },
 *     },
 *   })
 * )
 * datasource.definition.type // => "dataset"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectTypeDatasource extends S.Opaque<ObjectTypeDatasource, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: DatasourceRid.annotateKey({ description: "Identifier the platform generated for the datasource." }),
    definition: DatasourceDefinition.annotateKey({ description: "What kind of source it is and what it backs." }),
  }).pipe(
    $I.annoteSchema("ObjectTypeDatasource", {
      description: "One datasource of an object type: its identifier and what kind of source it is.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Interface implementations
// -----------------------------------------------------------------------------

/**
 * One field of one struct property of an object type.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyStructField extends S.Opaque<PropertyStructField, { readonly brand: unique symbol }>()(
  S.Struct({
    propertyApiName: PropertyApiName.annotateKey({ description: "The struct property." }),
    structFieldApiName: StructFieldApiName.annotateKey({ description: "The field within the struct property." }),
  }).pipe(
    $I.annoteSchema("PropertyStructField", { description: "One field of one struct property of an object type." })
  )
) {}

const StructFieldSourceKind = LiteralKit(["property", "structFieldOfProperty"]);

/**
 * A field of an interface struct taken from a whole property of the object type.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySource extends S.Opaque<PropertySource, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("property"),
    propertyApiName: PropertyApiName.annotateKey({ description: "The property that supplies the field's value." }),
  }).pipe(
    $I.annoteSchema("PropertySource", {
      description: "A field of an interface struct taken from a whole property of the object type.",
    })
  )
) {}

/**
 * A field of an interface struct taken from one field of a struct property of the object type.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldOfPropertySource extends S.Opaque<
  StructFieldOfPropertySource,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("structFieldOfProperty"),
    propertyApiName: PropertyApiName.annotateKey({ description: "The struct property that holds the field." }),
    structFieldApiName: StructFieldApiName.annotateKey({ description: "The field that supplies the value." }),
  }).pipe(
    $I.annoteSchema("StructFieldOfPropertySource", {
      description: "A field of an interface struct taken from one field of a struct property of the object type.",
    })
  )
) {}

/**
 * Where one field of an interface struct property comes from on the implementing object type.
 *
 * **Example** (Name the property behind an interface struct field)
 *
 * ```ts import.meta.vitest name="Name the property behind an interface struct field"
 * import { PropertyApiName, StructFieldApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { StructFieldOfPropertySource, StructFieldSource } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const path = StructFieldSource.match({
 *   property: ({ propertyApiName }) => `${propertyApiName}`,
 *   structFieldOfProperty: ({ propertyApiName, structFieldApiName }) => `${propertyApiName}.${structFieldApiName}`,
 * })
 * const alpha = StructFieldOfPropertySource.make({
 *   propertyApiName: PropertyApiName.make("multiStruct"),
 *   structFieldApiName: StructFieldApiName.make("alpha"),
 * })
 * path(alpha) // => "multiStruct.alpha"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructFieldSource = StructFieldSourceKind.mapMembers(() =>
  Tuple.make(PropertySource, StructFieldOfPropertySource)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("StructFieldSource", {
    description: "Where one field of an interface struct property comes from on the implementing object type.",
  })
);

/**
 * Runtime type of {@link StructFieldSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructFieldSource = typeof StructFieldSource.Type;

const ImplementationKind = LiteralKit([
  "localPropertyImplementation",
  "structFieldImplementation",
  "structImplementation",
  "reducedPropertyImplementation",
]);

/**
 * An interface property implemented by one property of the object type.
 *
 * @category models
 * @since 0.0.0
 */
export class LocalPropertyImplementation extends S.Opaque<
  LocalPropertyImplementation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("localPropertyImplementation"),
    propertyApiName: PropertyApiName.annotateKey({ description: "The property that stands for the interface's." }),
  }).pipe(
    $I.annoteSchema("LocalPropertyImplementation", {
      description: "An interface property implemented by one property of the object type.",
    })
  )
) {}

/**
 * An interface property implemented by one field of a struct property of the object type.
 *
 * @category models
 * @since 0.0.0
 */
export class StructFieldImplementation extends S.Opaque<StructFieldImplementation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("structFieldImplementation"),
    // The struct field that stands for the interface property.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    structFieldOfProperty: PropertyStructField,
  }).pipe(
    $I.annoteSchema("StructFieldImplementation", {
      description: "An interface property implemented by one field of a struct property of the object type.",
    })
  )
) {}

/**
 * A struct interface property assembled field by field from the object type's properties and struct fields.
 *
 * @category models
 * @since 0.0.0
 */
export class StructImplementation extends S.Opaque<StructImplementation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("structImplementation"),
    mapping: S.Record(StructFieldApiName, StructFieldSource).annotateKey({
      description: "For each field of the interface struct, where its value comes from.",
    }),
  }).pipe(
    $I.annoteSchema("StructImplementation", {
      description: "A struct interface property assembled field by field from the object type's own data.",
    })
  )
) {}

/**
 * The ways an object type can implement an interface property without reducing an array.
 *
 * **Details**
 *
 * This is the full implementation union minus its `reducedPropertyImplementation`
 * case. It exists because a reduction wraps exactly one of these: the wire
 * forbids a reduction of a reduction, so the nesting is one level deep by
 * construction.
 *
 * **Example** (Read the property a direct implementation rests on)
 *
 * ```ts import.meta.vitest name="Read the property a direct implementation rests on"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { LocalPropertyImplementation, UnreducedInterfacePropertyImplementation } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const fullName = LocalPropertyImplementation.make({ propertyApiName: PropertyApiName.make("fullName") })
 * const verdicts = [
 *   UnreducedInterfacePropertyImplementation.guards.localPropertyImplementation(fullName),
 *   UnreducedInterfacePropertyImplementation.guards.structImplementation(fullName),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnreducedInterfacePropertyImplementation = ImplementationKind.pick([
  "localPropertyImplementation",
  "structFieldImplementation",
  "structImplementation",
])
  .mapMembers(() => Tuple.make(LocalPropertyImplementation, StructFieldImplementation, StructImplementation))
  .pipe(
    S.toTaggedUnion("type"),
    $I.annoteSchema("UnreducedInterfacePropertyImplementation", {
      description: "The ways an object type can implement an interface property without reducing an array.",
    })
  );

/**
 * Runtime type of {@link UnreducedInterfacePropertyImplementation}.
 *
 * @category models
 * @since 0.0.0
 */
export type UnreducedInterfacePropertyImplementation = typeof UnreducedInterfacePropertyImplementation.Type;

/**
 * An interface property implemented by reducing an array-valued implementation to one element.
 *
 * @category models
 * @since 0.0.0
 */
export class ReducedPropertyImplementation extends S.Opaque<
  ReducedPropertyImplementation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("reducedPropertyImplementation"),
    implementation: UnreducedInterfacePropertyImplementation.annotateKey({
      description: "The implementation whose array value the reducers collapse.",
    }),
  }).pipe(
    $I.annoteSchema("ReducedPropertyImplementation", {
      description: "An interface property implemented by reducing an array-valued implementation to one element.",
    })
  )
) {}

/**
 * How an object type implements one property of an interface it claims.
 *
 * **Example** (Find the object property an interface property rests on)
 *
 * ```ts import.meta.vitest name="Find the object property an interface property rests on"
 * import * as O from "effect/Option"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import {
 *   InterfacePropertyImplementation,
 *   LocalPropertyImplementation,
 *   ReducedPropertyImplementation,
 * } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const soleProperty = InterfacePropertyImplementation.match({
 *   localPropertyImplementation: ({ propertyApiName }) => O.some(propertyApiName),
 *   structFieldImplementation: ({ structFieldOfProperty }) => O.some(structFieldOfProperty.propertyApiName),
 *   structImplementation: () => O.none(),
 *   reducedPropertyImplementation: () => O.none(),
 * })
 * const scores = LocalPropertyImplementation.make({ propertyApiName: PropertyApiName.make("performanceScores") })
 * const names = [
 *   O.getOrNull(soleProperty(scores)),
 *   O.getOrNull(soleProperty(ReducedPropertyImplementation.make({ implementation: scores }))),
 * ]
 * names // => ["performanceScores", null]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InterfacePropertyImplementation = ImplementationKind.mapMembers(() =>
  Tuple.make(
    LocalPropertyImplementation,
    StructFieldImplementation,
    StructImplementation,
    ReducedPropertyImplementation
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("InterfacePropertyImplementation", {
    description: "How an object type implements one property of an interface it claims.",
  })
);

/**
 * Runtime type of {@link InterfacePropertyImplementation}.
 *
 * @category models
 * @since 0.0.0
 */
export type InterfacePropertyImplementation = typeof InterfacePropertyImplementation.Type;

/**
 * Everything an object type supplies to satisfy one interface: properties, links and actions.
 *
 * **Details**
 *
 * The wire carries the property mapping twice. `properties` (here
 * `sharedPropertyTypeMapping`) is the older form and covers only interface
 * properties backed by a shared property type, each mapped to a whole object
 * property. `propertiesV2` (here `propertyImplementations`) covers every
 * interface property and every way of implementing it. Both are kept because
 * the platform sends both.
 *
 * Saved ontology documents leave empty collections out, and documents saved
 * by an older platform lack the maps that platform did not know (`actionTypes`
 * is the newest of the four, `propertiesV2` and `links` came before it). Each
 * of the four maps therefore decodes as empty when its key is absent, and all
 * four are written on encode.
 *
 * **Example** (Decode an implementation and read one property)
 *
 * ```ts import.meta.vitest name="Decode an implementation and read one property"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { InterfaceImplementation } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const implementation = await Effect.runPromise(
 *   S.decodeUnknownEffect(InterfaceImplementation)({
 *     properties: { fooSpt: "fullName" },
 *     propertiesV2: { fooSpt: { type: "localPropertyImplementation", propertyApiName: "fullName" } },
 *     links: {},
 *     actionTypes: {},
 *   })
 * )
 * const kinds = A.map(R.values(implementation.propertyImplementations), (entry) => entry.type)
 * kinds // => ["localPropertyImplementation"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceImplementation extends S.Opaque<InterfaceImplementation, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: S.OptionFromOptionalKey(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Name of the implemented interface, when the platform repeats it here." })
    ),
    rid: S.OptionFromOptionalKey(InterfaceTypeRid).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Resource identifier of the implemented interface, when the platform sends it." })
    ),
    sharedPropertyTypeMapping: S.Record(SharedPropertyTypeApiName, PropertyApiName).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<SharedPropertyTypeApiName, PropertyApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, string>())),
      S.annotateKey({
        description: "For each shared property type the interface is built from, the object property that carries it.",
      })
    ),
    propertyImplementations: S.Record(InterfacePropertyApiName, InterfacePropertyImplementation).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfacePropertyApiName, InterfacePropertyImplementation>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfacePropertyImplementation)["Encoded"]>())),
      S.annotateKey({ description: "For each interface property, how the object type implements it." })
    ),
    links: S.Record(InterfaceLinkTypeApiName, S.Array(LinkTypeApiName)).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceLinkTypeApiName, ReadonlyArray<LinkTypeApiName>>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, ReadonlyArray<string>>())),
      S.annotateKey({ description: "For each link the interface declares, the link sides that realize it." })
    ),
    actionTypes: S.Record(InterfaceActionConstraintApiName, ActionTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceActionConstraintApiName, ActionTypeApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, string>())),
      S.annotateKey({ description: "For each action slot the interface declares, the action type bound to it." })
    ),
  }).pipe(
    S.encodeKeys({ sharedPropertyTypeMapping: "properties", propertyImplementations: "propertiesV2" }),
    $I.annoteSchema("InterfaceImplementation", {
      description: "Everything an object type supplies to satisfy one interface: properties, links and actions.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Object type
// -----------------------------------------------------------------------------

const ObjectTypeRecord = S.Struct({
  apiName: ObjectTypeApiName.annotateKey({ description: "Name under which clients address the object type." }),
  displayName: S.String.annotateKey({ description: "Human-readable name of one object of the type." }),
  pluralDisplayName: S.String.annotateKey({ description: "Human-readable name of several objects of the type." }),
  description: S.OptionFromOptionalKey(S.String).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "What an object of the type stands for." })
  ),
  status: ReleaseStatus.annotateKey({ description: "How far along its lifecycle the object type is." }),
  visibility: S.OptionFromOptionalKey(Visibility).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Suggested prominence in user interfaces." })
  ),
  icon: Icon.annotateKey({ description: "Icon applications draw next to objects of the type." }),
  rid: ObjectTypeRid.annotateKey({ description: "Resource identifier of the object type." }),
  primaryKey: PropertyApiName.annotateKey({ description: "The property whose value identifies an object." }),
  titleProperty: PropertyApiName.annotateKey({ description: "The property whose value names an object to people." }),
  properties: S.Record(PropertyApiName, PropertyDefinition).annotateKey({
    description: "Every property the object type declares, by API name.",
  }),
  aliases: S.Array(S.String).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<string>())),
    S.withDecodingDefaultKey(Effect.succeed(A.empty<string>())),
    S.annotateKey({ description: "Other names people search the object type by." })
  ),
  datasources: S.Array(ObjectTypeDatasource).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<ObjectTypeDatasource>())),
    S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof ObjectTypeDatasource)["Encoded"]>())),
    S.annotateKey({ description: "The sources that together back the object type's properties." })
  ),
});

type ObjectTypeRecord = typeof ObjectTypeRecord.Type;

const isPrimaryKeyKind = S.is(PrimaryKeyKind);

const ObjectTypeKeyChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      ({ primaryKey, properties }: ObjectTypeRecord) => R.has(properties, primaryKey),
      $I.annote("PrimaryKeyDeclaredCheck", {
        title: "Primary Key Declared",
        description: "An object type whose primary key names one of its declared properties.",
        message: "The primary key must name a declared property",
      })
    ),
    S.makeFilter(
      ({ titleProperty, properties }: ObjectTypeRecord) => R.has(properties, titleProperty),
      $I.annote("TitlePropertyDeclaredCheck", {
        title: "Title Property Declared",
        description: "An object type whose title property names one of its declared properties.",
        message: "The title property must name a declared property",
      })
    ),
    S.makeFilter(
      ({ primaryKey, properties }: ObjectTypeRecord) =>
        pipe(
          R.get(properties, primaryKey),
          O.map((definition) => isPrimaryKeyKind(definition.dataType.type)),
          O.getOrElse(constTrue)
        ),
      $I.annote("PrimaryKeyTypeCheck", {
        title: "Primary Key Type",
        description: "An object type whose primary key holds a value that can identify an object.",
        message:
          "The primary key must be a string, integer, long, short, byte, double, boolean, date or timestamp property",
      })
    ),
  ],
  $I.annote("ObjectTypeKeyChecks", {
    title: "Object Type Keys",
    description: "The primary key and the title are declared properties, and the primary key has a key-capable type.",
  })
);

const primaryKeyType = PrimaryKeyKind.match({
  string: () => StringType.make({}),
  integer: () => IntegerType.make({}),
  long: () => LongType.make({}),
  short: () => ShortType.make({}),
  byte: () => ByteType.make({}),
  double: () => DoubleType.make({}),
  boolean: () => BooleanType.make({}),
  date: () => DateType.make({}),
  timestamp: () => TimestampType.make({}),
});

// What a generator needs to build a valid object type: free fields, plus the two definitions the key checks ask for.
const ObjectTypeSeed = S.Struct({
  record: ObjectTypeRecord,
  primaryKeyKind: PrimaryKeyKind,
  primaryKeyDefinition: PropertyDefinition,
  titleDefinition: PropertyDefinition,
});

/**
 * A kind of object: its names, its declared properties, which of them identifies and which names an object,
 * and what backs it.
 *
 * **Details**
 *
 * This is the wire's object type record, key for key. Three facts every
 * consumer relies on are checks of the schema, so a value that decoded or was
 * constructed always satisfies them: the primary key names a declared
 * property, the title property names a declared property, and the primary
 * key's type can identify an object (string, integer, long, short, byte,
 * double, boolean, date or timestamp).
 *
 * **Gotchas**
 *
 * Because those checks span fields, the schema is a class with a generator
 * link (random fields would almost never agree with each other). Values are
 * therefore instances: build them with `ObjectType.make` or by decoding, not
 * as bare object literals. A key of `properties` that is not a property name
 * (the empty string) is dropped on decode instead of failing it, as in every
 * record keyed by a name.
 *
 * **Example** (Declare an object type and look up its key)
 *
 * ```ts import.meta.vitest name="Declare an object type and look up its key"
 * import * as O from "effect/Option"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ObjectTypeApiName, ObjectTypeRid, PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { Icon } from "@beep/scratchpad/osdk/src/Metadata/index"
 * import { ObjectType } from "@beep/scratchpad/osdk/src/ObjectType/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const officeId = PropertyApiName.make("officeId")
 * const office = ObjectType.make({
 *   apiName: ObjectTypeApiName.make("Office"),
 *   displayName: "Office",
 *   pluralDisplayName: "Offices",
 *   status: "active",
 *   icon: Icon.cases.blueprint.make({ color: "blue", name: "office" }),
 *   rid: ObjectTypeRid.make("ri.ontology.main.object-type.office"),
 *   primaryKey: officeId,
 *   titleProperty: officeId,
 *   properties: {
 *     [officeId]: PropertyDefinition.make({
 *       dataType: StringType.make({}),
 *       rid: PropertyTypeRid.make("ri.ontology.main.property.office-id"),
 *     }),
 *   },
 * })
 * const keyType = O.getOrNull(O.map(ObjectType.primaryKeyDefinition(office), (definition) => definition.dataType.type))
 * keyType // => "string"
 * ```
 *
 * @invariant `primaryKey` and `titleProperty` are keys of `properties`, and the primary key's type tag is a primary key kind.
 * @category models
 * @since 0.0.0
 */
export class ObjectType extends S.Class<ObjectType, { readonly brand: unique symbol }>($I`ObjectType`)(
  ObjectTypeRecord.check(ObjectTypeKeyChecks),
  $I.annote("ObjectType", {
    toCodecArbitrary: (): SchemaAST.Link =>
      S.link<ObjectType>()(ObjectTypeSeed, {
        decode: SchemaGetter.transform(({ record, primaryKeyKind, primaryKeyDefinition, titleDefinition }) =>
          ObjectType.make({
            ...record,
            properties: pipe(
              record.properties,
              R.set(record.titleProperty, titleDefinition),
              R.set(
                record.primaryKey,
                PropertyDefinition.make({ ...primaryKeyDefinition, dataType: primaryKeyType(primaryKeyKind) })
              )
            ),
          })
        ),
        encode: SchemaGetter.forbidden(() => "An object type seed is only ever generated, never encoded."),
      }),
    description:
      "A kind of object: its names, its declared properties, which of them identifies and names an object, and what backs it.",
  })
) {
  /**
   * The definition of a property, looked up by API name.
   *
   * **Example** (Look up a declared and an undeclared property)
   *
   * ```ts import.meta.vitest name="Look up a declared and an undeclared property"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
   * import { ObjectType } from "@beep/scratchpad/osdk/src/ObjectType/index"
   *
   * const office = await Effect.runPromise(
   *   S.decodeUnknownEffect(ObjectType)({
   *     apiName: "Office",
   *     displayName: "Office",
   *     pluralDisplayName: "Offices",
   *     status: "ACTIVE",
   *     icon: { type: "blueprint", color: "blue", name: "office" },
   *     rid: "ri.ontology.main.object-type.office",
   *     primaryKey: "officeId",
   *     titleProperty: "officeId",
   *     properties: { officeId: { dataType: { type: "string" }, rid: "ri.ontology.main.property.office-id" } },
   *   })
   * )
   * const found = [
   *   O.isSome(ObjectType.property(office, PropertyApiName.make("officeId"))),
   *   O.isSome(ObjectType.property(office, PropertyApiName.make("capacity"))),
   * ]
   * found // => [true, false]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly property: {
    (name: PropertyApiName): (self: ObjectType) => O.Option<PropertyDefinition>;
    (self: ObjectType, name: PropertyApiName): O.Option<PropertyDefinition>;
  } = dual(2, (self: ObjectType, name: PropertyApiName): O.Option<PropertyDefinition> => R.get(self.properties, name));

  /**
   * The definition of the property whose value identifies an object.
   *
   * **Details**
   *
   * The result is `Some` for every value the schema admits, because the key
   * checks guarantee the lookup. It stays an `Option` so the function is total
   * without asserting anything.
   *
   * **Example** (Read the type of the primary key)
   *
   * ```ts import.meta.vitest name="Read the type of the primary key"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ObjectType } from "@beep/scratchpad/osdk/src/ObjectType/index"
   *
   * const employee = await Effect.runPromise(
   *   S.decodeUnknownEffect(ObjectType)({
   *     apiName: "Employee",
   *     displayName: "Employee",
   *     pluralDisplayName: "Employees",
   *     status: "ACTIVE",
   *     icon: { type: "blueprint", color: "blue", name: "person" },
   *     rid: "ri.ontology.main.object-type.employee",
   *     primaryKey: "employeeId",
   *     titleProperty: "fullName",
   *     properties: {
   *       employeeId: { dataType: { type: "integer" }, rid: "ri.ontology.main.property.employee-id" },
   *       fullName: { dataType: { type: "string" }, rid: "ri.ontology.main.property.full-name" },
   *     },
   *   })
   * )
   * const keyType = O.getOrNull(O.map(ObjectType.primaryKeyDefinition(employee), (definition) => definition.dataType.type))
   * keyType // => "integer"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly primaryKeyDefinition = (self: ObjectType): O.Option<PropertyDefinition> =>
    R.get(self.properties, self.primaryKey);

  /**
   * The definition of the property whose value names an object to people.
   *
   * **Details**
   *
   * Like {@link ObjectType.primaryKeyDefinition}, the result is `Some` for
   * every value the schema admits.
   *
   * **Example** (Read the type of the title)
   *
   * ```ts import.meta.vitest name="Read the type of the title"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { ObjectType } from "@beep/scratchpad/osdk/src/ObjectType/index"
   *
   * const employee = await Effect.runPromise(
   *   S.decodeUnknownEffect(ObjectType)({
   *     apiName: "Employee",
   *     displayName: "Employee",
   *     pluralDisplayName: "Employees",
   *     status: "ACTIVE",
   *     icon: { type: "blueprint", color: "blue", name: "person" },
   *     rid: "ri.ontology.main.object-type.employee",
   *     primaryKey: "employeeId",
   *     titleProperty: "fullName",
   *     properties: {
   *       employeeId: { dataType: { type: "integer" }, rid: "ri.ontology.main.property.employee-id" },
   *       fullName: { dataType: { type: "string" }, rid: "ri.ontology.main.property.full-name" },
   *     },
   *   })
   * )
   * const titleType = O.getOrNull(O.map(ObjectType.titleDefinition(employee), (definition) => definition.dataType.type))
   * titleType // => "string"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly titleDefinition = (self: ObjectType): O.Option<PropertyDefinition> =>
    R.get(self.properties, self.titleProperty);
}

// -----------------------------------------------------------------------------
// Object type definition
// -----------------------------------------------------------------------------

/**
 * An object type together with what surrounds it: the link sides that start from it and the interfaces it implements.
 *
 * **Details**
 *
 * This is the wire's "full metadata" bundle. `interfaceImplementations` is
 * the wire's `implementsInterfaces2`; the plain list `implementsInterfaces`
 * and the flat `sharedPropertyTypeMapping` are older summaries of it that the
 * platform still sends, so they are kept as they arrive. Nothing here checks
 * links or implementations against the declared properties: real ontologies
 * list link sides whose foreign key is not a property the client can see.
 *
 * Saved ontology documents leave empty collections out, and older ones lack
 * the three interface keys altogether. Each of the four collections therefore
 * decodes as empty when its key is absent, and all four are written on encode.
 *
 * **Example** (Find an outgoing link by name)
 *
 * ```ts import.meta.vitest name="Find an outgoing link by name"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ObjectTypeDefinition } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const office = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectTypeDefinition)({
 *     objectType: {
 *       apiName: "Office",
 *       displayName: "Office",
 *       pluralDisplayName: "Offices",
 *       status: "ACTIVE",
 *       icon: { type: "blueprint", color: "blue", name: "office" },
 *       rid: "ri.ontology.main.object-type.office",
 *       primaryKey: "officeId",
 *       titleProperty: "officeId",
 *       properties: { officeId: { dataType: { type: "string" }, rid: "ri.ontology.main.property.office-id" } },
 *     },
 *     linkTypes: [
 *       {
 *         apiName: "occupants",
 *         displayName: "Office Occupants",
 *         status: "EXPERIMENTAL",
 *         objectTypeApiName: "Employee",
 *         cardinality: "MANY",
 *         linkTypeRid: "rid.link-type.324",
 *       },
 *     ],
 *     implementsInterfaces: [],
 *     implementsInterfaces2: {},
 *     sharedPropertyTypeMapping: {},
 *   })
 * )
 * const target = O.getOrNull(
 *   O.map(ObjectTypeDefinition.link(office, LinkTypeApiName.make("occupants")), (side) => side.targetObjectType)
 * )
 * target // => "Employee"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectTypeDefinition extends S.Opaque<ObjectTypeDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    objectType: ObjectType.annotateKey({ description: "The object type itself." }),
    linkTypes: S.Array(LinkTypeSide).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<LinkTypeSide>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof LinkTypeSide)["Encoded"]>())),
      S.annotateKey({ description: "The link sides that start from the object type." })
    ),
    implementsInterfaces: S.Array(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<InterfaceTypeApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<string>())),
      S.annotateKey({ description: "Names of the interfaces the object type implements." })
    ),
    interfaceImplementations: S.Record(InterfaceTypeApiName, InterfaceImplementation).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceTypeApiName, InterfaceImplementation>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfaceImplementation)["Encoded"]>())),
      S.annotateKey({ description: "For each implemented interface, how the object type satisfies it." })
    ),
    sharedPropertyTypeMapping: S.Record(SharedPropertyTypeApiName, PropertyApiName).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<SharedPropertyTypeApiName, PropertyApiName>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, string>())),
      S.annotateKey({
        description: "For each shared property type the object type uses, the property that carries it.",
      })
    ),
  }).pipe(
    S.encodeKeys({ interfaceImplementations: "implementsInterfaces2" }),
    $I.annoteSchema("ObjectTypeDefinition", {
      description: "An object type with the link sides that start from it and the interfaces it implements.",
    })
  )
) {
  /**
   * The outgoing link side with the given API name.
   *
   * **Example** (Miss a link the object type does not have)
   *
   * ```ts import.meta.vitest name="Miss a link the object type does not have"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { LinkTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
   * import { ObjectTypeDefinition } from "@beep/scratchpad/osdk/src/ObjectType/index"
   *
   * const office = await Effect.runPromise(
   *   S.decodeUnknownEffect(ObjectTypeDefinition)({
   *     objectType: {
   *       apiName: "Office",
   *       displayName: "Office",
   *       pluralDisplayName: "Offices",
   *       status: "ACTIVE",
   *       icon: { type: "blueprint", color: "blue", name: "office" },
   *       rid: "ri.ontology.main.object-type.office",
   *       primaryKey: "officeId",
   *       titleProperty: "officeId",
   *       properties: { officeId: { dataType: { type: "string" }, rid: "ri.ontology.main.property.office-id" } },
   *     },
   *     linkTypes: [],
   *     implementsInterfaces: [],
   *     implementsInterfaces2: {},
   *     sharedPropertyTypeMapping: {},
   *   })
   * )
   * O.isNone(ObjectTypeDefinition.link(office, LinkTypeApiName.make("occupants"))) // => true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly link: {
    (name: LinkTypeApiName): (self: ObjectTypeDefinition) => O.Option<LinkTypeSide>;
    (self: ObjectTypeDefinition, name: LinkTypeApiName): O.Option<LinkTypeSide>;
  } = dual(
    2,
    (self: ObjectTypeDefinition, name: LinkTypeApiName): O.Option<LinkTypeSide> =>
      A.findFirst(self.linkTypes, (side) => side.apiName === name)
  );

  /**
   * How the object type satisfies the interface with the given API name.
   *
   * **Example** (Read the implementation of one interface)
   *
   * ```ts import.meta.vitest name="Read the implementation of one interface"
   * import * as Effect from "effect/Effect"
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { InterfaceTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
   * import { ObjectTypeDefinition } from "@beep/scratchpad/osdk/src/ObjectType/index"
   *
   * const employee = await Effect.runPromise(
   *   S.decodeUnknownEffect(ObjectTypeDefinition)({
   *     objectType: {
   *       apiName: "Employee",
   *       displayName: "Employee",
   *       pluralDisplayName: "Employees",
   *       status: "ACTIVE",
   *       icon: { type: "blueprint", color: "blue", name: "person" },
   *       rid: "ri.ontology.main.object-type.employee",
   *       primaryKey: "employeeId",
   *       titleProperty: "employeeId",
   *       properties: { employeeId: { dataType: { type: "integer" }, rid: "ri.ontology.main.property.employee-id" } },
   *     },
   *     linkTypes: [],
   *     implementsInterfaces: ["FooInterface"],
   *     implementsInterfaces2: {
   *       FooInterface: { properties: {}, propertiesV2: {}, links: {}, actionTypes: {} },
   *     },
   *     sharedPropertyTypeMapping: {},
   *   })
   * )
   * const found = [
   *   O.isSome(ObjectTypeDefinition.interfaceImplementation(employee, InterfaceTypeApiName.make("FooInterface"))),
   *   O.isSome(ObjectTypeDefinition.interfaceImplementation(employee, InterfaceTypeApiName.make("BarInterface"))),
   * ]
   * found // => [true, false]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  static readonly interfaceImplementation: {
    (name: InterfaceTypeApiName): (self: ObjectTypeDefinition) => O.Option<InterfaceImplementation>;
    (self: ObjectTypeDefinition, name: InterfaceTypeApiName): O.Option<InterfaceImplementation>;
  } = dual(
    2,
    (self: ObjectTypeDefinition, name: InterfaceTypeApiName): O.Option<InterfaceImplementation> =>
      R.get(self.interfaceImplementations, name)
  );
}
