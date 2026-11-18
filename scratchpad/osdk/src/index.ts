/**
 * An Effect-native, schema-first ontology core: one namespace per concept, in three tiers.
 *
 * **Details**
 *
 * Tier 1, metamodel and algebra: schemas whose `Encoded` side is the Foundry v2 JSON and whose `Type` side is the
 * domain (identifiers, type tags, values, property / object / link / interface / action / query types, filters,
 * aggregations, object sets). Tier 2, projections: total functions from those values to codecs and tables
 * (`Property.valueCodec`, `Object.instanceCodec`, `Filter.allowedOperators`, `Action.argumentsCodec`). Tier 3, typed
 * models and services: `Model`, the `Client` port and facade, and its `Api` (HTTP) and `Faux` (in-memory) layers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Action types, the requests that apply them, and the edits and validation that come back.
 *
 * @category models
 * @since 0.0.0
 */
export * as Action from "./Action/index.ts";
/**
 * Agents: definitions, data types, sessions, events and the projection from a data type to its codec.
 *
 * @category models
 * @since 0.0.0
 */
export * as Agent from "./Agent/index.ts";
/**
 * Aggregations: metrics, group-bys, their envelopes and the tables that say which apply to which type tag.
 *
 * @category models
 * @since 0.0.0
 */
export * as Aggregation from "./Aggregation/index.ts";
/**
 * The platform over HTTP: its ontology routes declared as data, and the transport layer derived from them.
 *
 * @category layers
 * @since 0.0.0
 */
export * as Api from "./Api/index.ts";
/**
 * Attachment property values, attachment metadata and the file descriptor brands shared with media.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Attachment from "./Attachment/index.ts";
/**
 * Encrypted property values: the cipher text envelope codec, channel strategies and encryption shapes.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as CipherText from "./CipherText/index.ts";
/**
 * The client: request and response envelopes, typed errors, the transport port and the typed read facade.
 *
 * @category clients
 * @since 0.0.0
 */
export * as Client from "./Client/index.ts";
/**
 * The shared vocabulary of ontology type tags and the tag records reused across type universes.
 *
 * @category models
 * @since 0.0.0
 */
export * as DataType from "./DataType/index.ts";
/**
 * Derived properties: the tagged definition tree, the operations over linked objects and the date parts.
 *
 * @category models
 * @since 0.0.0
 */
export * as DerivedProperty from "./DerivedProperty/index.ts";
/**
 * An in-memory platform: a world of objects and links, an interpreter over it, and the transport built on both.
 *
 * @category layers
 * @since 0.0.0
 */
export * as Faux from "./Faux/index.ts";
/**
 * Object filters: the tagged filter tree, its operator tables and checks, and a constructor for every operator.
 *
 * @category models
 * @since 0.0.0
 */
export * as Filter from "./Filter/index.ts";
/**
 * GeoJSON geometry, features and the distance measure used by geospatial filters.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Geo from "./Geo/index.ts";
/**
 * Nominal identifiers: API names, resource identifiers and versions.
 *
 * @category identifiers
 * @since 0.0.0
 */
export * as Identifier from "./Identifier/index.ts";
/**
 * Interface types: the properties and links they promise, and what they inherit from the interfaces they extend.
 *
 * @category models
 * @since 0.0.0
 */
export * as InterfaceType from "./InterfaceType/index.ts";
/**
 * Link instances: one link between two objects, link listings and the link subscription protocol.
 *
 * @category models
 * @since 0.0.0
 */
export * as Link from "./Link/index.ts";
/**
 * Link types as an object type sees them: the outgoing side and its cardinality.
 *
 * @category models
 * @since 0.0.0
 */
export * as LinkType from "./LinkType/index.ts";
/**
 * Media: reference values, item metadata, transformations and the language domains they name.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Media from "./Media/index.ts";
/**
 * Descriptive metadata shared by ontology definitions: release status, visibility, icon and type classes.
 *
 * @category models
 * @since 0.0.0
 */
export * as Metadata from "./Metadata/index.ts";
/**
 * Typed models: authoring-time specs, object models, typed filters and object sets, and conformance findings.
 *
 * @category constructors
 * @since 0.0.0
 */
export * as Model from "./Model/index.ts";
/**
 * Object instances: locators, primary key values, the flat object record and the projection to typed instances.
 *
 * @category models
 * @since 0.0.0
 */
export * as Object from "./Object/index.ts";
/**
 * Object sets: the tagged tree of sources, filters, traversals and set arithmetic, its combinators, folds and checks.
 *
 * @category models
 * @since 0.0.0
 */
export * as ObjectSet from "./ObjectSet/index.ts";
/**
 * Object types: the record, its datasources, its interface implementations and the full definition bundle.
 *
 * @category models
 * @since 0.0.0
 */
export * as ObjectType from "./ObjectType/index.ts";
/**
 * The ontology as one value: its definition, the lookups and graphs it answers, and the validation of the whole.
 *
 * @category models
 * @since 0.0.0
 */
export * as Ontology from "./Ontology/index.ts";
/**
 * Cursor pagination: page tokens, page sizes, total counts and the page envelope of any list response.
 *
 * @category models
 * @since 0.0.0
 */
export * as Page from "./Page/index.ts";
/**
 * Property types, property definitions, property selectors and the projection from a type to its value codec.
 *
 * @category models
 * @since 0.0.0
 */
export * as Property from "./Property/index.ts";
/**
 * Query types, query data types, aggregation values and the messages of a query call.
 *
 * @category models
 * @since 0.0.0
 */
export * as Query from "./Query/index.ts";
/**
 * Property security: marking requirements, security outcomes and the secured value envelope.
 *
 * @category models
 * @since 0.0.0
 */
export * as Security from "./Security/index.ts";
/**
 * Shapes: per-property null policies and derived links over one object type, applied to loaded objects.
 *
 * @category projections
 * @since 0.0.0
 */
export * as Shape from "./Shape/index.ts";
/**
 * The object-set subscription protocol: subscribe requests, server messages, updates and closure causes.
 *
 * @category protocols
 * @since 0.0.0
 */
export * as Subscription from "./Subscription/index.ts";
/**
 * Time series: series references, time ranges, points, aggregation and the bodies of series reads.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as TimeSeries from "./TimeSeries/index.ts";
/**
 * Scalar value codecs between the wire encoding and the domain value of each type tag.
 *
 * @category codecs
 * @since 0.0.0
 */
export * as Value from "./Value/index.ts";
/**
 * Display-formatting rules of property values: number, date, timestamp, boolean and known-identifier formats.
 *
 * @category formatting
 * @since 0.0.0
 */
export * as ValueFormat from "./ValueFormat/index.ts";
/**
 * Value types: reusable constrained base types, the constraints they carry and the record that names them.
 *
 * @category models
 * @since 0.0.0
 */
export * as ValueType from "./ValueType/index.ts";
