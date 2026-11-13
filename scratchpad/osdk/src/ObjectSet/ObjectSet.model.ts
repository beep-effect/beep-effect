/**
 * Object sets: descriptions of which objects to read, as a tree of sources, filters, traversals and set arithmetic.
 *
 * **Details**
 *
 * OSDK's object set is an object of closures whose real definition lives out
 * of band in a `WeakMap`, and whose static type is rebuilt from sixteen method
 * interfaces. Here the definition is the model: {@link ObjectSet} is one
 * recursive union of the 15 wire members on `type`. An object set is data. It
 * can be built with pipeable functions, matched, folded, checked and sent as
 * is, and nothing about it depends on a client.
 *
 * An object set and a derived property are mutually recursive: a
 * {@link DerivedObjectSet} attaches derived properties, and a derived property
 * can read through an object set rooted at {@link MethodInputObjectSet}. The
 * two modules import each other, and every reference across the cycle sits
 * inside a suspended schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { DerivedProperty } from "../DerivedProperty/DerivedProperty.model.ts";
import { ObjectFilter } from "../Filter/Filter.model.ts";
import {
  DerivedPropertyApiName,
  EntityTypeApiName,
  InterfaceLinkTypeApiName,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectRid,
  ObjectSetRid,
  ObjectTypeApiName,
  PropertyApiName,
} from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { PropertySelector } from "../Property/Property.model.ts";

const $I = $ScratchpadId.create("osdk/ObjectSet/ObjectSet.model");

const suspendedObjectSet = S.suspend((): S.Codec<ObjectSet, ObjectSet.Encoded> => ObjectSet);

const suspendedDerivedProperty = S.suspend(
  (): S.Codec<DerivedProperty, DerivedProperty.Encoded> => DerivedProperty
);

// -----------------------------------------------------------------------------
// Entity types
// -----------------------------------------------------------------------------

const EntityTypeKind = LiteralKit(["object", "interface"]);

/**
 * An object type, named as the type of the objects in a set.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectEntityType extends S.Opaque<ObjectEntityType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("object"),
    apiName: ObjectTypeApiName.annotateKey({ description: "API name of the object type." }),
  }).pipe(
    $I.annoteSchema("ObjectEntityType", {
      description: "An object type, named as the type of the objects in a set.",
    })
  )
) {}

/**
 * An interface type, named as the type of the objects in a set.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceEntityType extends S.Opaque<InterfaceEntityType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interface"),
    apiName: InterfaceTypeApiName.annotateKey({ description: "API name of the interface type." }),
  }).pipe(
    $I.annoteSchema("InterfaceEntityType", {
      description: "An interface type, named as the type of the objects in a set.",
    })
  )
) {}

/**
 * The type every object of a set has: an object type, or an interface type.
 *
 * **Details**
 *
 * This is a domain value, not a wire shape. The wire names a set's type only
 * implicitly, through the leaf the set starts from.
 *
 * **Example** (Describe the type of a set)
 *
 * ```ts import.meta.vitest name="Describe the type of a set"
 * import { InterfaceTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { EntityType, InterfaceEntityType, ObjectEntityType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const describe = EntityType.match({
 *   object: ({ apiName }) => `objects of type ${apiName}`,
 *   interface: ({ apiName }) => `objects implementing ${apiName}`,
 * })
 * const readings = [
 *   describe(ObjectEntityType.make({ apiName: ObjectTypeApiName.make("Employee") })),
 *   describe(InterfaceEntityType.make({ apiName: InterfaceTypeApiName.make("Person") })),
 * ]
 * readings // => ["objects of type Employee", "objects implementing Person"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EntityType = EntityTypeKind.mapMembers(() => Tuple.make(ObjectEntityType, InterfaceEntityType)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EntityType", {
    description: "The type every object of a set has: an object type, or an interface type.",
  })
);

/**
 * Runtime type of {@link EntityType}.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityType = typeof EntityType.Type;

// -----------------------------------------------------------------------------
// Nearest-neighbour queries
// -----------------------------------------------------------------------------

const NearestNeighborsQueryKind = LiteralKit(["vector", "text"]);

/**
 * A nearest-neighbour query given directly as a vector.
 *
 * **Details**
 *
 * The vector must have the dimension of the property it is compared with.
 * That dimension is a fact of the ontology, so it is not checked here.
 *
 * @category models
 * @since 0.0.0
 */
export class VectorQuery extends S.Opaque<VectorQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("vector"),
    value: S.Array(S.Finite).annotateKey({ description: "Components of the query vector." }),
  }).pipe($I.annoteSchema("VectorQuery", { description: "A nearest-neighbour query given directly as a vector." }))
) {}

/**
 * A nearest-neighbour query given as text, which the platform embeds with the property's own embedding model.
 *
 * @category models
 * @since 0.0.0
 */
export class TextQuery extends S.Opaque<TextQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("text"),
    value: S.String.annotateKey({ description: "Text to embed and search with." }),
  }).pipe(
    $I.annoteSchema("TextQuery", {
      description: "A nearest-neighbour query given as text, embedded by the platform.",
    })
  )
) {}

/**
 * What to search near: a vector, or text that the platform turns into one.
 *
 * **Details**
 *
 * OSDK takes `string | number[]` and tags it at the last moment. The wire's
 * tagged form is the model here.
 *
 * **Example** (Read the size of a query)
 *
 * ```ts import.meta.vitest name="Read the size of a query"
 * import { NearestNeighborsQuery, TextQuery, VectorQuery } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const size = NearestNeighborsQuery.match({
 *   vector: ({ value }) => value.length,
 *   text: ({ value }) => value.length,
 * })
 * const sizes = [size(VectorQuery.make({ value: [0.1, 0.2, 0.3] })), size(TextQuery.make({ value: "coffee" }))]
 * sizes // => [3, 6]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NearestNeighborsQuery = NearestNeighborsQueryKind.mapMembers(() =>
  Tuple.make(VectorQuery, TextQuery)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("NearestNeighborsQuery", {
    description: "What to search near: a vector, or text that the platform turns into one.",
  })
);

/**
 * Runtime type of {@link NearestNeighborsQuery}.
 *
 * @category models
 * @since 0.0.0
 */
export type NearestNeighborsQuery = typeof NearestNeighborsQuery.Type;

// -----------------------------------------------------------------------------
// Leaves
// -----------------------------------------------------------------------------

const ObjectSetKind = LiteralKit([
  "base",
  "interfaceBase",
  "static",
  "reference",
  "methodInput",
  "filter",
  "searchAround",
  "interfaceLinkSearchAround",
  "asType",
  "asBaseObjectTypes",
  "nearestNeighbors",
  "withProperties",
  "union",
  "intersect",
  "subtract",
]);

/**
 * Every object of one object type.
 *
 * @category models
 * @since 0.0.0
 */
export class BaseObjectSet extends S.Opaque<BaseObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("base"),
    objectType: ObjectTypeApiName.annotateKey({ description: "Object type whose objects make up the set." }),
  }).pipe($I.annoteSchema("BaseObjectSet", { description: "Every object of one object type." }))
) {}

/**
 * Every object whose type implements one interface type.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceBaseObjectSet extends S.Opaque<InterfaceBaseObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceBase"),
    interfaceType: InterfaceTypeApiName.annotateKey({
      description: "Interface type whose implementing objects make up the set.",
    }),
    includeAllBaseObjectProperties: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Whether objects come back with every property of their own type, not only the interface's.",
      })
    ),
  }).pipe(
    $I.annoteSchema("InterfaceBaseObjectSet", {
      description: "Every object whose type implements one interface type.",
    })
  )
) {}

/**
 * Exactly the objects with the listed resource identifiers.
 *
 * @category models
 * @since 0.0.0
 */
export class StaticObjectSet extends S.Opaque<StaticObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("static"),
    objects: S.Array(ObjectRid).annotateKey({ description: "Resource identifiers of the member objects." }),
  }).pipe(
    $I.annoteSchema("StaticObjectSet", { description: "Exactly the objects with the listed resource identifiers." })
  )
) {}

/**
 * An object set stored on the platform, saved or temporary, referred to by its resource identifier.
 *
 * **Details**
 *
 * The wire tag is `reference` and its key is `reference`; here the key is `rid`.
 *
 * @category models
 * @since 0.0.0
 */
export class SavedObjectSet extends S.Opaque<SavedObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("reference"),
    rid: ObjectSetRid.annotateKey({ description: "Resource identifier of the stored object set." }),
  }).pipe(
    S.encodeKeys({ rid: "reference" }),
    $I.annoteSchema("SavedObjectSet", {
      description: "An object set stored on the platform, referred to by its resource identifier.",
    })
  )
) {}

/**
 * The object a derived property is being computed for: the root of every selection inside a derived property.
 *
 * @category models
 * @since 0.0.0
 */
export class MethodInputObjectSet extends S.Opaque<MethodInputObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("methodInput") }).pipe(
    $I.annoteSchema("MethodInputObjectSet", {
      description: "The object a derived property is being computed for.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// One source
// -----------------------------------------------------------------------------

const source = suspendedObjectSet.annotateKey({ description: "Object set this one is built from." });

/**
 * The objects of a set that satisfy a filter.
 *
 * @category models
 * @since 0.0.0
 */
export class FilteredObjectSet extends S.Opaque<FilteredObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("filter"),
    objectSet: source,
    where: ObjectFilter.annotateKey({ description: "Filter the kept objects satisfy." }),
  }).pipe($I.annoteSchema("FilteredObjectSet", { description: "The objects of a set that satisfy a filter." }))
) {}

/**
 * Companion namespace for {@link FilteredObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FilteredObjectSet {
  /**
   * Encoded form of {@link FilteredObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "filter";
    readonly objectSet: ObjectSet.Encoded;
    readonly where: ObjectFilter.Encoded;
  }
}

/**
 * The objects reached from a set by following one link type.
 *
 * **Details**
 *
 * The wire tag is `searchAround` and OSDK calls the operation `pivotTo`. The
 * result holds the linked objects, not the objects of the source set.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkTraversal extends S.Opaque<LinkTraversal, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("searchAround"),
    objectSet: source,
    link: LinkTypeApiName.annotateKey({ description: "Link type to follow from each object of the source." }),
  }).pipe(
    $I.annoteSchema("LinkTraversal", { description: "The objects reached from a set by following one link type." })
  )
) {}

/**
 * Companion namespace for {@link LinkTraversal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LinkTraversal {
  /**
   * Encoded form of {@link LinkTraversal}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "searchAround";
    readonly objectSet: ObjectSet.Encoded;
    readonly link: string;
  }
}

/**
 * The objects reached from a set of interface objects by following one interface link type.
 *
 * @category models
 * @since 0.0.0
 */
export class InterfaceLinkTraversal extends S.Opaque<InterfaceLinkTraversal, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("interfaceLinkSearchAround"),
    objectSet: source,
    interfaceLink: InterfaceLinkTypeApiName.annotateKey({
      description: "Interface link type to follow from each object of the source.",
    }),
  }).pipe(
    $I.annoteSchema("InterfaceLinkTraversal", {
      description: "The objects reached from a set of interface objects by following one interface link type.",
    })
  )
) {}

/**
 * Companion namespace for {@link InterfaceLinkTraversal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InterfaceLinkTraversal {
  /**
   * Encoded form of {@link InterfaceLinkTraversal}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "interfaceLinkSearchAround";
    readonly objectSet: ObjectSet.Encoded;
    readonly interfaceLink: string;
  }
}

/**
 * The objects of a set viewed as another object type or interface type; objects that are not of that type are dropped.
 *
 * @category models
 * @since 0.0.0
 */
export class NarrowedObjectSet extends S.Opaque<NarrowedObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("asType"),
    objectSet: source,
    entityType: EntityTypeApiName.annotateKey({
      description: "Object type or interface type the objects are viewed as.",
    }),
  }).pipe(
    $I.annoteSchema("NarrowedObjectSet", {
      description: "The objects of a set viewed as another object type or interface type.",
    })
  )
) {}

/**
 * Companion namespace for {@link NarrowedObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NarrowedObjectSet {
  /**
   * Encoded form of {@link NarrowedObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "asType";
    readonly objectSet: ObjectSet.Encoded;
    readonly entityType: string;
  }
}

/**
 * The objects of an interface-typed set viewed as their own object types, with every property those types declare.
 *
 * @category models
 * @since 0.0.0
 */
export class BaseTypesObjectSet extends S.Opaque<BaseTypesObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("asBaseObjectTypes"),
    objectSet: source,
  }).pipe(
    $I.annoteSchema("BaseTypesObjectSet", {
      description: "The objects of an interface-typed set viewed as their own object types.",
    })
  )
) {}

/**
 * Companion namespace for {@link BaseTypesObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BaseTypesObjectSet {
  /**
   * Encoded form of {@link BaseTypesObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "asBaseObjectTypes";
    readonly objectSet: ObjectSet.Encoded;
  }
}

/**
 * The objects of a set whose vector property lies closest to a query.
 *
 * **Details**
 *
 * The wire keys are `propertyIdentifier` and `numNeighbors`; here they are
 * `property` and `count`. The platform documents a count between 1 and 500;
 * the object set policy reports a count outside it. Relevance scores come back
 * only when results are ordered by relevance, and are lost when the set is
 * combined with other sets by union, intersection or difference.
 *
 * @category models
 * @since 0.0.0
 */
export class NearestNeighborsObjectSet extends S.Opaque<
  NearestNeighborsObjectSet,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("nearestNeighbors"),
    objectSet: source,
    property: PropertySelector.annotateKey({ description: "Vector property the query is compared with." }),
    count: S.Int.annotateKey({ description: "How many nearest objects to keep." }),
    similarityThreshold: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Least similarity an object needs to be kept." })
    ),
    query: NearestNeighborsQuery.annotateKey({ description: "What to search near." }),
  }).pipe(
    S.encodeKeys({ property: "propertyIdentifier", count: "numNeighbors" }),
    $I.annoteSchema("NearestNeighborsObjectSet", {
      description: "The objects of a set whose vector property lies closest to a query.",
    })
  )
) {}

/**
 * Companion namespace for {@link NearestNeighborsObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NearestNeighborsObjectSet {
  /**
   * Encoded form of {@link NearestNeighborsObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "nearestNeighbors";
    readonly objectSet: ObjectSet.Encoded;
    readonly propertyIdentifier: PropertySelector.Encoded;
    readonly numNeighbors: number;
    readonly similarityThreshold?: number;
    readonly query: (typeof NearestNeighborsQuery)["Encoded"];
  }
}

/**
 * A set whose objects carry extra properties computed for each of them.
 *
 * **Details**
 *
 * The wire tag is `withProperties`. Each derived property is computed for
 * every object of the source. Filters and aggregations applied on top of this
 * set can name the derived properties like declared ones.
 *
 * @category models
 * @since 0.0.0
 */
export class DerivedObjectSet extends S.Opaque<DerivedObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("withProperties"),
    objectSet: source,
    derivedProperties: S.Record(DerivedPropertyApiName, suspendedDerivedProperty).annotateKey({
      description: "How to compute each extra property, keyed by the name it comes back under.",
    }),
  }).pipe(
    $I.annoteSchema("DerivedObjectSet", {
      description: "A set whose objects carry extra properties computed for each of them.",
    })
  )
) {}

/**
 * Companion namespace for {@link DerivedObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DerivedObjectSet {
  /**
   * Encoded form of {@link DerivedObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "withProperties";
    readonly objectSet: ObjectSet.Encoded;
    readonly derivedProperties: { readonly [name: string]: DerivedProperty.Encoded };
  }
}

// -----------------------------------------------------------------------------
// Several sources
// -----------------------------------------------------------------------------

const operands = S.Array(suspendedObjectSet).check(RecursiveArraySizeHint);

/**
 * The objects that belong to at least one of the listed sets.
 *
 * @category models
 * @since 0.0.0
 */
export class UnionObjectSet extends S.Opaque<UnionObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("union"),
    objectSets: operands.annotateKey({ description: "Sets whose objects are pooled." }),
  }).pipe(
    $I.annoteSchema("UnionObjectSet", { description: "The objects that belong to at least one of the listed sets." })
  )
) {}

/**
 * Companion namespace for {@link UnionObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnionObjectSet {
  /**
   * Encoded form of {@link UnionObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "union";
    readonly objectSets: ReadonlyArray<ObjectSet.Encoded>;
  }
}

/**
 * The objects that belong to every one of the listed sets.
 *
 * @category models
 * @since 0.0.0
 */
export class IntersectionObjectSet extends S.Opaque<IntersectionObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("intersect"),
    objectSets: operands.annotateKey({ description: "Sets an object must belong to all of." }),
  }).pipe(
    $I.annoteSchema("IntersectionObjectSet", {
      description: "The objects that belong to every one of the listed sets.",
    })
  )
) {}

/**
 * Companion namespace for {@link IntersectionObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IntersectionObjectSet {
  /**
   * Encoded form of {@link IntersectionObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "intersect";
    readonly objectSets: ReadonlyArray<ObjectSet.Encoded>;
  }
}

/**
 * The objects of the first listed set that belong to none of the others.
 *
 * **Details**
 *
 * The wire tag is `subtract`. Order matters: the first set is the one that is
 * narrowed, and every later set is removed from it.
 *
 * @category models
 * @since 0.0.0
 */
export class DifferenceObjectSet extends S.Opaque<DifferenceObjectSet, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("subtract"),
    objectSets: operands.annotateKey({ description: "The set to narrow, followed by the sets to remove from it." }),
  }).pipe(
    $I.annoteSchema("DifferenceObjectSet", {
      description: "The objects of the first listed set that belong to none of the others.",
    })
  )
) {}

/**
 * Companion namespace for {@link DifferenceObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DifferenceObjectSet {
  /**
   * Encoded form of {@link DifferenceObjectSet}, declared explicitly because the object set is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "subtract";
    readonly objectSets: ReadonlyArray<ObjectSet.Encoded>;
  }
}

// -----------------------------------------------------------------------------
// The object set union
// -----------------------------------------------------------------------------

/**
 * A description of which objects to read: five kinds of source, seven ways to derive a set, three ways to combine sets.
 *
 * **Example** (Decode a wire object set and measure its depth)
 *
 * ```ts import.meta.vitest name="Decode a wire object set and measure its depth"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const wire = {
 *   type: "searchAround",
 *   objectSet: {
 *     type: "filter",
 *     objectSet: { type: "base", objectType: "Employee" },
 *     where: { type: "eq", field: "employeeId", value: 50030 },
 *   },
 *   link: "peeps",
 * }
 * const set = await Effect.runPromise(S.decodeUnknownEffect(ObjectSet)(wire))
 * const deepest = (sets: ReadonlyArray<ObjectSet>): number =>
 *   A.reduce(sets, 0, (deepestSoFar, child) => Math.max(deepestSoFar, depth(child)))
 * const depth = (node: ObjectSet): number =>
 *   ObjectSet.matchOrElse(
 *     node,
 *     {
 *       base: () => 1,
 *       interfaceBase: () => 1,
 *       static: () => 1,
 *       reference: () => 1,
 *       methodInput: () => 1,
 *       union: ({ objectSets }) => 1 + deepest(objectSets),
 *       intersect: ({ objectSets }) => 1 + deepest(objectSets),
 *       subtract: ({ objectSets }) => 1 + deepest(objectSets),
 *     },
 *     ({ objectSet }) => 1 + depth(objectSet)
 *   )
 * const encoded = await Effect.runPromise(S.encodeEffect(ObjectSet)(set))
 * const facts = [depth(set), ObjectSet.discriminants.length, encoded]
 * facts // => [3, 15, wire]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectSet = ObjectSetKind.mapMembers(() =>
  Tuple.make(
    BaseObjectSet,
    InterfaceBaseObjectSet,
    StaticObjectSet,
    SavedObjectSet,
    MethodInputObjectSet,
    FilteredObjectSet,
    LinkTraversal,
    InterfaceLinkTraversal,
    NarrowedObjectSet,
    BaseTypesObjectSet,
    NearestNeighborsObjectSet,
    DerivedObjectSet,
    UnionObjectSet,
    IntersectionObjectSet,
    DifferenceObjectSet
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ObjectSet", {
    description: "A description of which objects to read: sources, filters, traversals, casts and set arithmetic.",
  })
);

/**
 * Runtime type of {@link ObjectSet}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectSet =
  | BaseObjectSet
  | InterfaceBaseObjectSet
  | StaticObjectSet
  | SavedObjectSet
  | MethodInputObjectSet
  | FilteredObjectSet
  | LinkTraversal
  | InterfaceLinkTraversal
  | NarrowedObjectSet
  | BaseTypesObjectSet
  | NearestNeighborsObjectSet
  | DerivedObjectSet
  | UnionObjectSet
  | IntersectionObjectSet
  | DifferenceObjectSet;

/**
 * Companion namespace for {@link ObjectSet}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ObjectSet {
  /**
   * Encoded (wire) form of {@link ObjectSet}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof BaseObjectSet)["Encoded"]
    | (typeof InterfaceBaseObjectSet)["Encoded"]
    | (typeof StaticObjectSet)["Encoded"]
    | (typeof SavedObjectSet)["Encoded"]
    | (typeof MethodInputObjectSet)["Encoded"]
    | FilteredObjectSet.Encoded
    | LinkTraversal.Encoded
    | InterfaceLinkTraversal.Encoded
    | NarrowedObjectSet.Encoded
    | BaseTypesObjectSet.Encoded
    | NearestNeighborsObjectSet.Encoded
    | DerivedObjectSet.Encoded
    | UnionObjectSet.Encoded
    | IntersectionObjectSet.Encoded
    | DifferenceObjectSet.Encoded;
}

/**
 * An object set handed to an action or a query: the identifier of a stored set, or a definition written in place.
 *
 * **Details**
 *
 * The platform's table of value encodings gives an object-set argument two
 * spellings, "a RID or an inline definition". The first is JSON text and the
 * second a JSON record, so the two never overlap and the union needs no tag:
 * text is an identifier, anything else is read as an {@link ObjectSet}.
 *
 * **Example** (Read both spellings of an object-set argument)
 *
 * ```ts import.meta.vitest name="Read both spellings of an object-set argument"
 * import * as Effect from "effect/Effect"
 * import * as P from "effect/Predicate"
 * import * as S from "effect/Schema"
 * import { ObjectSetArgument } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const decode = S.decodeUnknownEffect(ObjectSetArgument)
 * const stored = await Effect.runPromise(decode("ri.object-set.main.object-set.1"))
 * const inline = await Effect.runPromise(decode({ type: "base", objectType: "Employee" }))
 * const kinds = [P.isString(stored) ? "identifier" : stored.type, P.isString(inline) ? "identifier" : inline.type]
 * kinds // => ["identifier", "base"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectSetArgument = S.Union([ObjectSetRid, ObjectSet]).pipe(
  $I.annoteSchema("ObjectSetArgument", {
    description: "An object set handed to an action or a query: a stored set's identifier, or an inline definition.",
  })
);

/**
 * Runtime type of {@link ObjectSetArgument}.
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectSetArgument = typeof ObjectSetArgument.Type;

// -----------------------------------------------------------------------------
// Ordering
// -----------------------------------------------------------------------------

/**
 * Direction of a sort over a property: smallest first or largest first.
 *
 * **Details**
 *
 * The wire types this as free text and documents the two values listed here,
 * in lower case. Aggregation ordering spells the same idea in upper case on
 * the wire; the domain literals are the same in both places.
 *
 * **Example** (Flip a sort direction)
 *
 * ```ts import.meta.vitest name="Flip a sort direction"
 * import { SortDirection } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const flip = SortDirection.match({ asc: () => SortDirection.Enum.desc, desc: () => SortDirection.Enum.asc })
 * flip("asc") // => "desc"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SortDirection = LiteralKit(["asc", "desc"]).pipe(
  $I.annoteSchema("SortDirection", {
    description: "Direction of a sort over a property: smallest first or largest first.",
  })
);

/**
 * Runtime type of {@link SortDirection}.
 *
 * @category models
 * @since 0.0.0
 */
export type SortDirection = typeof SortDirection.Type;

/**
 * One key of a sort: a property and, optionally, the direction to sort it in.
 *
 * **Details**
 *
 * The wire key is `field`; here it is `property`.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyOrdering extends S.Opaque<PropertyOrdering, { readonly brand: unique symbol }>()(
  S.Struct({
    property: PropertyApiName.annotateKey({ description: "Property to sort by." }),
    direction: S.OptionFromOptionalKey(SortDirection).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Direction to sort in; the platform chooses when absent." })
    ),
  }).pipe(
    S.encodeKeys({ property: "field" }),
    $I.annoteSchema("PropertyOrdering", {
      description: "One key of a sort: a property and, optionally, the direction to sort it in.",
    })
  )
) {}

const OrderByKind = LiteralKit(["relevance", "fields"]);

/**
 * Orders results by decreasing relevance score.
 *
 * **Details**
 *
 * Scores are meaningful only for text search filters and nearest-neighbour
 * sets. Paging through relevance-ordered results is not stable: an object may
 * repeat or be skipped across pages.
 *
 * @category models
 * @since 0.0.0
 */
export class OrderByRelevance extends S.Opaque<OrderByRelevance, { readonly brand: unique symbol }>()(
  S.Struct({ orderType: S.tag("relevance"), fields: S.Tuple([]) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("relevance") }),
      SchemaTransformation.transform({
        decode: (): { readonly type: "relevance" } => ({ type: OrderByKind.Enum.relevance }),
        encode: (): { readonly orderType: "relevance"; readonly fields: readonly [] } => ({
          orderType: OrderByKind.Enum.relevance,
          fields: [],
        }),
      })
    ),
    $I.annoteSchema("OrderByRelevance", { description: "Orders results by decreasing relevance score." })
  )
) {}

/**
 * Orders results by the listed properties, the first one deciding and each later one breaking ties.
 *
 * @category models
 * @since 0.0.0
 */
export class OrderByFields extends S.Opaque<OrderByFields, { readonly brand: unique symbol }>()(
  S.Struct({
    orderType: S.optionalKey(S.Literals(["fields", "relevance"])),
    fields: S.Array(PropertyOrdering),
  }).pipe(
    S.decodeTo(
      S.Struct({
        type: S.tag("fields"),
        fields: PropertyOrdering.pipe(S.toType, S.Array).annotateKey({
          description: "Sort keys, most significant first.",
        }),
      }),
      SchemaTransformation.transform({
        decode: ({ fields }) => ({ type: OrderByKind.Enum.fields, fields }),
        encode: ({ fields }) => ({ fields }),
      })
    ),
    $I.annoteSchema("OrderByFields", {
      description: "Orders results by the listed properties, the first one deciding and each later one breaking ties.",
    })
  )
) {}

/**
 * How to order the objects of a result page: by relevance, or by properties.
 *
 * **Details**
 *
 * The wire is one record with an optional `orderType` beside a `fields`
 * array, and the platform lets a non-empty `fields` win over the stated type.
 * The domain is the two-case union that rule describes. Property ordering
 * encodes without `orderType`, as OSDK sends it, and relevance ordering encodes
 * with an empty `fields`.
 *
 * **Example** (Decode both spellings of an ordering)
 *
 * ```ts import.meta.vitest name="Decode both spellings of an ordering"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OrderBy } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const decode = S.decodeUnknownEffect(OrderBy)
 * const orderings = await Effect.runPromise(
 *   Effect.all([
 *     decode({ orderType: "relevance", fields: [] }),
 *     decode({ fields: [{ field: "fullName", direction: "asc" }, { field: "startDate" }] }),
 *   ])
 * )
 * const describe = OrderBy.match({ relevance: () => "relevance", fields: ({ fields }) => fields.length })
 * const kinds = A.map(orderings, describe)
 * kinds // => ["relevance", 2]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OrderBy = OrderByKind.mapMembers(() => Tuple.make(OrderByRelevance, OrderByFields)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("OrderBy", {
    description: "How to order the objects of a result page: by relevance, or by properties.",
  })
);

/**
 * Runtime type of {@link OrderBy}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type OrderBy = typeof OrderBy.Type;
