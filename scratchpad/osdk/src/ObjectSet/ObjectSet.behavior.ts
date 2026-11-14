/**
 * Constructors and pipeable combinators for object sets and derived properties, and the folds over both trees.
 *
 * **Details**
 *
 * An object set starts from a source ({@link objectType}, {@link interfaceType},
 * {@link objects}, {@link saved}) and grows through a pipeline:
 * `pipe(objectType("Employee"), where(...), traverse("lead"))`. Every
 * combinator also takes the set first, so `where(set, filter)` reads as a
 * sentence. Nothing here talks to a platform: each function returns the wire
 * tree as a value.
 *
 * Derived properties are built the same way. OSDK's three builder interfaces
 * and its handle table are replaced by {@link currentObject}, the ordinary
 * object set combinators, and two terminal functions, {@link selectProperty}
 * and {@link aggregate}. Arithmetic on the results uses infix words
 * ({@link plus}, {@link minus}, {@link times}, {@link dividedBy}) because
 * `subtract` already names the difference of two object sets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  AbsoluteValue,
  Addition,
  DatePartExtraction,
  DerivedProperty,
  Division,
  Greatest,
  Least,
  LinkedSelection,
  Multiplication,
  Negation,
  OwnProperty,
  SelectedValue,
  Subtraction,
} from "../DerivedProperty/DerivedProperty.model.ts";
import { toSelector } from "../Filter/Filter.behavior.ts";
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
import {
  BaseObjectSet,
  DerivedObjectSet,
  DifferenceObjectSet,
  EntityType,
  FilteredObjectSet,
  InterfaceBaseObjectSet,
  InterfaceEntityType,
  InterfaceLinkTraversal,
  IntersectionObjectSet,
  LinkTraversal,
  MethodInputObjectSet,
  NarrowedObjectSet,
  NearestNeighborsObjectSet,
  ObjectEntityType,
  ObjectSet,
  SavedObjectSet,
  StaticObjectSet,
  TextQuery,
  UnionObjectSet,
  VectorQuery,
} from "./ObjectSet.model.ts";
import type { DatePart, SelectedPropertyOperation } from "../DerivedProperty/DerivedProperty.model.ts";
import type { ObjectFilter } from "../Filter/Filter.model.ts";
import type { PropertySelector } from "../Property/Property.model.ts";
import type { BaseTypesObjectSet } from "./ObjectSet.model.ts";

type PropertyNameOrSelector = string | PropertySelector;

type Operands = ObjectSet | ReadonlyArray<ObjectSet>;

const listOf = (operands: Operands): ReadonlyArray<ObjectSet> => A.ensure<ObjectSet>(operands);

// -----------------------------------------------------------------------------
// Sources
// -----------------------------------------------------------------------------

/**
 * The set of every object of an object type.
 *
 * **Example** (Start from an object type)
 *
 * ```ts import.meta.vitest name="Start from an object type"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const employees = objectType("Employee")
 * const parts = [employees.type, employees.objectType]
 * parts // => ["base", "Employee"]
 * ```
 *
 * @throws When `apiName` is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const objectType = (apiName: string): BaseObjectSet =>
  BaseObjectSet.make({ objectType: ObjectTypeApiName.make(apiName) });

/**
 * The set of every object whose type implements an interface type.
 *
 * **Example** (Start from an interface type)
 *
 * ```ts import.meta.vitest name="Start from an interface type"
 * import * as O from "effect/Option"
 * import { interfaceType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const people = interfaceType("Person")
 * const parts = [people.type, people.interfaceType, O.isNone(people.includeAllBaseObjectProperties)]
 * parts // => ["interfaceBase", "Person", true]
 * ```
 *
 * @throws When `apiName` is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const interfaceType = (apiName: string): InterfaceBaseObjectSet =>
  InterfaceBaseObjectSet.make({ interfaceType: InterfaceTypeApiName.make(apiName) });

/**
 * The set of exactly the objects with the given resource identifiers.
 *
 * **Example** (List the members of a set by identifier)
 *
 * ```ts import.meta.vitest name="List the members of a set by identifier"
 * import { objects } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const pair = objects(["ri.phonograph2-objects.main.object.a", "ri.phonograph2-objects.main.object.b"])
 * const parts = [pair.type, pair.objects.length]
 * parts // => ["static", 2]
 * ```
 *
 * @throws When an identifier is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const objects = (rids: ReadonlyArray<string>): StaticObjectSet =>
  StaticObjectSet.make({ objects: A.map(rids, (rid) => ObjectRid.make(rid)) });

/**
 * An object set stored on the platform, saved or temporary, named by its resource identifier.
 *
 * **Example** (Refer to a stored object set)
 *
 * ```ts import.meta.vitest name="Refer to a stored object set"
 * import { saved } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const stored = saved("ri.object-set.main.object-set.1234")
 * const parts = [stored.type, stored.rid]
 * parts // => ["reference", "ri.object-set.main.object-set.1234"]
 * ```
 *
 * @throws When `rid` is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const saved = (rid: string): SavedObjectSet => SavedObjectSet.make({ rid: ObjectSetRid.make(rid) });

/**
 * The object a derived property is being computed for: where every derived property pipeline starts.
 *
 * **Example** (Start a derived property from the current object)
 *
 * ```ts import.meta.vitest name="Start a derived property from the current object"
 * import { pipe } from "effect/Function"
 * import { currentObject, traverse } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const lead = pipe(currentObject, traverse("lead"))
 * const parts = [lead.type, lead.objectSet.type]
 * parts // => ["searchAround", "methodInput"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const currentObject: MethodInputObjectSet = MethodInputObjectSet.make({});

// -----------------------------------------------------------------------------
// Combinators
// -----------------------------------------------------------------------------

/**
 * Keeps the objects of a set that satisfy a filter.
 *
 * **Example** (Filter a set)
 *
 * ```ts import.meta.vitest name="Filter a set"
 * import { pipe } from "effect/Function"
 * import { eq } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { objectType, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const seattle = pipe(objectType("Employee"), where(eq("office", "Seattle")))
 * const parts = [seattle.type, seattle.objectSet.type, seattle.where.type]
 * parts // => ["filter", "base", "eq"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const where: {
  (filter: ObjectFilter): (self: ObjectSet) => FilteredObjectSet;
  (self: ObjectSet, filter: ObjectFilter): FilteredObjectSet;
} = dual(
  2,
  (self: ObjectSet, filter: ObjectFilter): FilteredObjectSet =>
    FilteredObjectSet.make({ objectSet: self, where: filter })
);

/**
 * Pools the objects of a set with those of one or more other sets.
 *
 * **Details**
 *
 * When the first set is already a union the others are appended to it, so a
 * chain of `union` produces one flat `union` on the wire instead of a nest.
 *
 * **Example** (Pool a static set with a stored one)
 *
 * ```ts import.meta.vitest name="Pool a static set with a stored one"
 * import { pipe } from "effect/Function"
 * import { objectType, objects, saved, union } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const pooled = pipe(
 *   objects(["ri.phonograph2-objects.main.object.a"]),
 *   union(saved("ri.object-set.main.object-set.1234")),
 *   union([objectType("Employee"), objectType("Contractor")])
 * )
 * const parts = [pooled.type, pooled.objectSets.length]
 * parts // => ["union", 4]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const union: {
  (that: Operands): (self: ObjectSet) => UnionObjectSet;
  (self: ObjectSet, that: Operands): UnionObjectSet;
} = dual(
  2,
  (self: ObjectSet, that: Operands): UnionObjectSet =>
    UnionObjectSet.make({
      objectSets: ObjectSet.guards.union(self)
        ? A.appendAll(self.objectSets, listOf(that))
        : A.prepend(listOf(that), self),
    })
);

/**
 * Keeps the objects of a set that also belong to one or more other sets.
 *
 * **Details**
 *
 * When the first set is already an intersection the others are appended to
 * it. Intersecting a typed source with a stored set is how a stored set gets a
 * type: `intersect(objectType("Employee"), saved(rid))`.
 *
 * **Example** (Give a stored object set a type)
 *
 * ```ts import.meta.vitest name="Give a stored object set a type"
 * import { intersect, objectType, saved } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const typed = intersect(objectType("Employee"), saved("ri.object-set.main.object-set.1234"))
 * const kinds = typed.objectSets.map((operand) => operand.type)
 * kinds // => ["base", "reference"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const intersect: {
  (that: Operands): (self: ObjectSet) => IntersectionObjectSet;
  (self: ObjectSet, that: Operands): IntersectionObjectSet;
} = dual(
  2,
  (self: ObjectSet, that: Operands): IntersectionObjectSet =>
    IntersectionObjectSet.make({
      objectSets: ObjectSet.guards.intersect(self)
        ? A.appendAll(self.objectSets, listOf(that))
        : A.prepend(listOf(that), self),
    })
);

/**
 * Removes from a set the objects that belong to one or more other sets.
 *
 * **Details**
 *
 * When the first set is already a difference the others are appended to it:
 * removing `b` and then `c` is the one difference "first minus `b` and `c`".
 *
 * **Example** (Remove two sets from a third)
 *
 * ```ts import.meta.vitest name="Remove two sets from a third"
 * import { pipe } from "effect/Function"
 * import { eq } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { objectType, subtract, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const employees = objectType("Employee")
 * const rest = pipe(
 *   employees,
 *   subtract(where(employees, eq("office", "Seattle"))),
 *   subtract(where(employees, eq("office", "Boston")))
 * )
 * const kinds = rest.objectSets.map((operand) => operand.type)
 * kinds // => ["base", "filter", "filter"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const subtract: {
  (that: Operands): (self: ObjectSet) => DifferenceObjectSet;
  (self: ObjectSet, that: Operands): DifferenceObjectSet;
} = dual(
  2,
  (self: ObjectSet, that: Operands): DifferenceObjectSet =>
    DifferenceObjectSet.make({
      objectSets: ObjectSet.guards.subtract(self)
        ? A.appendAll(self.objectSets, listOf(that))
        : A.prepend(listOf(that), self),
    })
);

/**
 * Follows a link type from every object of a set and returns the objects it leads to.
 *
 * **Details**
 *
 * This is the wire's `searchAround` and OSDK's `pivotTo`. Use
 * {@link traverseInterfaceLink} when the set holds interface objects and the
 * link is declared on the interface.
 *
 * **Example** (Reach the leads of a filtered set)
 *
 * ```ts import.meta.vitest name="Reach the leads of a filtered set"
 * import { pipe } from "effect/Function"
 * import { eq } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { objectType, traverse, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const leads = pipe(objectType("Employee"), where(eq("office", "Seattle")), traverse("lead"))
 * const parts = [leads.type, leads.link, leads.objectSet.type]
 * parts // => ["searchAround", "lead", "filter"]
 * ```
 *
 * @throws When `link` is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const traverse: {
  (link: string): (self: ObjectSet) => LinkTraversal;
  (self: ObjectSet, link: string): LinkTraversal;
} = dual(
  2,
  (self: ObjectSet, link: string): LinkTraversal =>
    LinkTraversal.make({ objectSet: self, link: LinkTypeApiName.make(link) })
);

/**
 * Follows an interface link type from every object of an interface-typed set and returns the objects it leads to.
 *
 * **Example** (Follow a link declared on an interface)
 *
 * ```ts import.meta.vitest name="Follow a link declared on an interface"
 * import { pipe } from "effect/Function"
 * import { interfaceType, traverseInterfaceLink } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const managers = pipe(interfaceType("Person"), traverseInterfaceLink("manager"))
 * const parts = [managers.type, managers.interfaceLink]
 * parts // => ["interfaceLinkSearchAround", "manager"]
 * ```
 *
 * @throws When `link` is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const traverseInterfaceLink: {
  (link: string): (self: ObjectSet) => InterfaceLinkTraversal;
  (self: ObjectSet, link: string): InterfaceLinkTraversal;
} = dual(
  2,
  (self: ObjectSet, link: string): InterfaceLinkTraversal =>
    InterfaceLinkTraversal.make({ objectSet: self, interfaceLink: InterfaceLinkTypeApiName.make(link) })
);

/**
 * Views the objects of a set as another object type or interface type, dropping the objects that are not of it.
 *
 * **Example** (View people as employees)
 *
 * ```ts import.meta.vitest name="View people as employees"
 * import { pipe } from "effect/Function"
 * import { interfaceType, narrowTo } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const employees = pipe(interfaceType("Person"), narrowTo("Employee"))
 * const parts = [employees.type, employees.entityType]
 * parts // => ["asType", "Employee"]
 * ```
 *
 * @throws When `entityType` is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const narrowTo: {
  (entityType: string): (self: ObjectSet) => NarrowedObjectSet;
  (self: ObjectSet, entityType: string): NarrowedObjectSet;
} = dual(
  2,
  (self: ObjectSet, entityType: string): NarrowedObjectSet =>
    NarrowedObjectSet.make({ objectSet: self, entityType: EntityTypeApiName.make(entityType) })
);

/**
 * Attaches derived properties to the objects of a set, each under the name it should come back as.
 *
 * **Example** (Attach the name of each employee's lead)
 *
 * ```ts import.meta.vitest name="Attach the name of each employee's lead"
 * import { pipe } from "effect/Function"
 * import * as R from "effect/Record"
 * import {
 *   currentObject,
 *   objectType,
 *   selectProperty,
 *   traverse,
 *   withProperties,
 * } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const employees = pipe(
 *   objectType("Employee"),
 *   withProperties({ leadName: pipe(currentObject, traverse("lead"), selectProperty("fullName")) })
 * )
 * const parts = [employees.type, R.keys(employees.derivedProperties)]
 * parts // => ["withProperties", ["leadName"]]
 * ```
 *
 * @throws When a name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const withProperties: {
  (derivedProperties: Readonly<Record<string, DerivedProperty>>): (self: ObjectSet) => DerivedObjectSet;
  (self: ObjectSet, derivedProperties: Readonly<Record<string, DerivedProperty>>): DerivedObjectSet;
} = dual(
  2,
  (self: ObjectSet, derivedProperties: Readonly<Record<string, DerivedProperty>>): DerivedObjectSet =>
    DerivedObjectSet.make({
      objectSet: self,
      derivedProperties: R.mapKeys(derivedProperties, (name) => DerivedPropertyApiName.make(name)),
    })
);

/**
 * Keeps the objects of a set whose vector property lies closest to a query.
 *
 * **Details**
 *
 * A text query is embedded by the platform with the property's own embedding
 * model; an array of numbers is used as the query vector directly. The
 * platform documents a count between 1 and 500.
 *
 * **Example** (Find the five documents nearest to a phrase)
 *
 * ```ts import.meta.vitest name="Find the five documents nearest to a phrase"
 * import { pipe } from "effect/Function"
 * import { nearestNeighbors, objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const nearest = pipe(objectType("Document"), nearestNeighbors("quarterly revenue", 5, "embedding"))
 * const parts = [nearest.type, nearest.query.type, nearest.count, nearest.property.type]
 * parts // => ["nearestNeighbors", "text", 5, "property"]
 * ```
 *
 * @throws When `count` is not an integer, a vector component is not finite, or a bare property name is empty.
 * @category combinators
 * @since 0.0.0
 */
export const nearestNeighbors: {
  (
    query: string | ReadonlyArray<number>,
    count: number,
    property: PropertyNameOrSelector
  ): (self: ObjectSet) => NearestNeighborsObjectSet;
  (
    self: ObjectSet,
    query: string | ReadonlyArray<number>,
    count: number,
    property: PropertyNameOrSelector
  ): NearestNeighborsObjectSet;
} = dual(
  4,
  (
    self: ObjectSet,
    query: string | ReadonlyArray<number>,
    count: number,
    property: PropertyNameOrSelector
  ): NearestNeighborsObjectSet =>
    NearestNeighborsObjectSet.make({
      objectSet: self,
      property: toSelector(property),
      count,
      query: P.isString(query) ? TextQuery.make({ value: query }) : VectorQuery.make({ value: query }),
    })
);

// -----------------------------------------------------------------------------
// Folding object sets
// -----------------------------------------------------------------------------

/**
 * One function per case of an object set, each producing a result from the results of the sets it is built from.
 *
 * **Details**
 *
 * The keys are the wire tags. A leaf receives its node. A case with one source
 * receives the source's result and then its node; a case with several receives
 * their results in order and then its node. The definitions inside a
 * `withProperties` node are not folded: its handler reads them from the node.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ObjectSetAlgebra<Result> {
  readonly base: (set: BaseObjectSet) => Result;
  readonly interfaceBase: (set: InterfaceBaseObjectSet) => Result;
  readonly static: (set: StaticObjectSet) => Result;
  readonly reference: (set: SavedObjectSet) => Result;
  readonly methodInput: (set: MethodInputObjectSet) => Result;
  readonly filter: (source: Result, set: FilteredObjectSet) => Result;
  readonly searchAround: (source: Result, set: LinkTraversal) => Result;
  readonly interfaceLinkSearchAround: (source: Result, set: InterfaceLinkTraversal) => Result;
  readonly asType: (source: Result, set: NarrowedObjectSet) => Result;
  readonly asBaseObjectTypes: (source: Result, set: BaseTypesObjectSet) => Result;
  readonly nearestNeighbors: (source: Result, set: NearestNeighborsObjectSet) => Result;
  readonly withProperties: (source: Result, set: DerivedObjectSet) => Result;
  readonly union: (operands: ReadonlyArray<Result>, set: UnionObjectSet) => Result;
  readonly intersect: (operands: ReadonlyArray<Result>, set: IntersectionObjectSet) => Result;
  readonly subtract: (operands: ReadonlyArray<Result>, set: DifferenceObjectSet) => Result;
}

/**
 * Reduces an object set bottom-up: sources become results and every other case combines the results of its sources.
 *
 * **Details**
 *
 * The fold is total: it needs one handler per case, so a walker written with
 * it cannot forget one. OSDK has four hand-written walkers over this tree, and
 * each of them skips or throws on a different subset of the cases.
 *
 * **Example** (Render an object set as a sentence)
 *
 * ```ts import.meta.vitest name="Render an object set as a sentence"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import { eq } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { foldObjectSet, objectType, saved, traverse, union, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const render = foldObjectSet<string>({
 *   base: ({ objectType: name }) => name,
 *   interfaceBase: ({ interfaceType: name }) => name,
 *   static: ({ objects: rids }) => `${rids.length} objects`,
 *   reference: () => "a stored set",
 *   methodInput: () => "this object",
 *   filter: (source) => `some ${source}`,
 *   searchAround: (source, { link }) => `the ${link} of ${source}`,
 *   interfaceLinkSearchAround: (source, { interfaceLink }) => `the ${interfaceLink} of ${source}`,
 *   asType: (source, { entityType }) => `${source} viewed through ${entityType}`,
 *   asBaseObjectTypes: (source) => source,
 *   nearestNeighbors: (source, { count }) => `the ${count} nearest of ${source}`,
 *   withProperties: (source) => source,
 *   union: A.join(" or "),
 *   intersect: A.join(" and "),
 *   subtract: A.join(" minus "),
 * })
 * const sentence = pipe(
 *   objectType("Employee"),
 *   where(eq("office", "Seattle")),
 *   traverse("lead"),
 *   union(saved("ri.object-set.main.object-set.1234")),
 *   render
 * )
 * sentence // => "the lead of some Employee or a stored set"
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldObjectSet: {
  <Result>(algebra: ObjectSetAlgebra<Result>): (set: ObjectSet) => Result;
  <Result>(set: ObjectSet, algebra: ObjectSetAlgebra<Result>): Result;
} = dual(2, <Result>(set: ObjectSet, algebra: ObjectSetAlgebra<Result>): Result => {
  // Each case answers with a thunk: the matcher unifies its handlers' results, which it cannot do for a
  // result type that is still a type parameter, while a function of that type passes through unchanged.
  const fold = (node: ObjectSet): Result =>
    ObjectSet.match(node, {
      base: (leaf) => () => algebra.base(leaf),
      interfaceBase: (leaf) => () => algebra.interfaceBase(leaf),
      static: (leaf) => () => algebra.static(leaf),
      reference: (leaf) => () => algebra.reference(leaf),
      methodInput: (leaf) => () => algebra.methodInput(leaf),
      filter: (filtered) => () => algebra.filter(fold(filtered.objectSet), filtered),
      searchAround: (traversal) => () => algebra.searchAround(fold(traversal.objectSet), traversal),
      interfaceLinkSearchAround: (traversal) => () =>
        algebra.interfaceLinkSearchAround(fold(traversal.objectSet), traversal),
      asType: (narrowed) => () => algebra.asType(fold(narrowed.objectSet), narrowed),
      asBaseObjectTypes: (widened) => () => algebra.asBaseObjectTypes(fold(widened.objectSet), widened),
      nearestNeighbors: (nearest) => () => algebra.nearestNeighbors(fold(nearest.objectSet), nearest),
      withProperties: (derived) => () => algebra.withProperties(fold(derived.objectSet), derived),
      union: (combined) => () => algebra.union(A.map(combined.objectSets, fold), combined),
      intersect: (combined) => () => algebra.intersect(A.map(combined.objectSets, fold), combined),
      subtract: (combined) => () => algebra.subtract(A.map(combined.objectSets, fold), combined),
    })();
  return fold(set);
});

const sameEntityType = S.toEquivalence(EntityType);

// A union has one type only when every operand has a known type and they all agree.
const agreedType = (operands: ReadonlyArray<O.Option<EntityType>>): O.Option<EntityType> =>
  O.flatMap(O.all(operands), (types) =>
    A.matchLeft(types, {
      onEmpty: () => O.none(),
      onNonEmpty: (first, rest) => (A.every(rest, (type) => sameEntityType(first, type)) ? O.some(first) : O.none()),
    })
  );

/**
 * The object type or interface type that every object of a set has, when the set alone determines it.
 *
 * **Details**
 *
 * A filter, a nearest-neighbour search, attached derived properties and a view
 * as base object types keep the type of their source. A difference has the
 * type of its first operand. An intersection is bounded by any operand whose
 * type is known, and the first such operand is reported. A union has a type
 * only when every operand has one and they agree.
 *
 * **Gotchas**
 *
 * The answer is none wherever only an ontology could tell: after a link
 * traversal (the target type belongs to the link's definition), after a cast
 * (the name does not say whether it is an object type or an interface type),
 * and for static, stored and current-object sets. OSDK answers those cases by
 * consulting loaded metadata and a per-client memory of earlier casts.
 *
 * **Example** (Ask what type a set ranges over)
 *
 * ```ts import.meta.vitest name="Ask what type a set ranges over"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import * as O from "effect/Option"
 * import { isNotNull } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { baseType, intersect, objectType, saved, traverse, where } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const stored = saved("ri.object-set.main.object-set.1234")
 * const employees = pipe(objectType("Employee"), where(isNotNull("lead")))
 * const names = A.map([employees, intersect(employees, stored), stored, traverse(employees, "lead")], (set) =>
 *   O.match(baseType(set), { onNone: () => "unknown", onSome: ({ type, apiName }) => `${type} ${apiName}` })
 * )
 * names // => ["object Employee", "object Employee", "unknown", "unknown"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const baseType: (set: ObjectSet) => O.Option<EntityType> = foldObjectSet<O.Option<EntityType>>({
  base: (set) => O.some(ObjectEntityType.make({ apiName: set.objectType })),
  interfaceBase: (set) => O.some(InterfaceEntityType.make({ apiName: set.interfaceType })),
  static: O.none,
  reference: O.none,
  methodInput: O.none,
  filter: identity,
  searchAround: O.none,
  interfaceLinkSearchAround: O.none,
  asType: O.none,
  asBaseObjectTypes: identity,
  nearestNeighbors: identity,
  withProperties: identity,
  union: agreedType,
  intersect: (operands) => A.head(A.getSomes(operands)),
  subtract: (operands) => O.flatten(A.head(operands)),
});

/**
 * Whether a set, or any set it is built from, attaches derived properties.
 *
 * **Details**
 *
 * The platform rejects a union, intersection or difference whose operands
 * carry derived properties; this is the test that rule needs. Object sets
 * nested inside a derived property's own selection are not inspected.
 *
 * **Example** (Detect derived properties under a filter)
 *
 * ```ts import.meta.vitest name="Detect derived properties under a filter"
 * import { pipe } from "effect/Function"
 * import { isNotNull } from "@beep/scratchpad/osdk/src/Filter/index"
 * import {
 *   currentObject,
 *   hasDerivedProperties,
 *   objectType,
 *   selectProperty,
 *   traverse,
 *   where,
 *   withProperties,
 * } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const employees = objectType("Employee")
 * const withLead = pipe(
 *   employees,
 *   withProperties({ leadName: pipe(currentObject, traverse("lead"), selectProperty("fullName")) }),
 *   where(isNotNull("leadName"))
 * )
 * const verdicts = [hasDerivedProperties(employees), hasDerivedProperties(withLead)]
 * verdicts // => [false, true]
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasDerivedProperties: (set: ObjectSet) => boolean = foldObjectSet<boolean>({
  base: () => false,
  interfaceBase: () => false,
  static: () => false,
  reference: () => false,
  methodInput: () => false,
  filter: identity,
  searchAround: identity,
  interfaceLinkSearchAround: identity,
  asType: identity,
  asBaseObjectTypes: identity,
  nearestNeighbors: identity,
  withProperties: () => true,
  union: A.some(identity),
  intersect: A.some(identity),
  subtract: A.some(identity),
});

// -----------------------------------------------------------------------------
// Derived properties
// -----------------------------------------------------------------------------

/**
 * Reads one property through an object set that starts at the current object.
 *
 * **Details**
 *
 * On {@link currentObject} itself this is the object's own property. After a
 * traversal or a filter it is the property of the single object the set
 * reaches.
 *
 * **Gotchas**
 *
 * The platform rejects a single-value read across a to-many link. Whether a
 * link is to-many is a fact of the ontology and cannot be checked here: use
 * {@link aggregate} with a collecting operation across such a link.
 *
 * **Example** (Read an own property and a linked one)
 *
 * ```ts import.meta.vitest name="Read an own property and a linked one"
 * import { pipe } from "effect/Function"
 * import { currentObject, selectProperty, traverse } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const own = selectProperty(currentObject, "employeeId")
 * const linked = pipe(currentObject, traverse("lead"), selectProperty("employeeId"))
 * const kinds = [own.type, linked.type]
 * kinds // => ["property", "selection"]
 * ```
 *
 * @throws When `property` is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const selectProperty: {
  (property: string): (source: ObjectSet) => OwnProperty | LinkedSelection;
  (source: ObjectSet, property: string): OwnProperty | LinkedSelection;
} = dual(
  2,
  (source: ObjectSet, property: string): OwnProperty | LinkedSelection =>
    ObjectSet.guards.methodInput(source)
      ? OwnProperty.make({ apiName: PropertyApiName.make(property) })
      : LinkedSelection.make({ objectSet: source, operation: SelectedValue.of(property) })
);

/**
 * Computes one value from all the objects reached through an object set that starts at the current object.
 *
 * **Example** (Count and collect over a to-many link)
 *
 * ```ts import.meta.vitest name="Count and collect over a to-many link"
 * import { pipe } from "effect/Function"
 * import { SelectedCount, SelectedList } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 * import { aggregate, currentObject, traverse } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const reports = pipe(currentObject, traverse("peeps"))
 * const headcount = aggregate(reports, SelectedCount.make({}))
 * const names = pipe(reports, aggregate(SelectedList.of("fullName", 20)))
 * const kinds = [headcount.operation.type, names.operation.type]
 * kinds // => ["count", "collectList"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const aggregate: {
  (operation: SelectedPropertyOperation): (source: ObjectSet) => LinkedSelection;
  (source: ObjectSet, operation: SelectedPropertyOperation): LinkedSelection;
} = dual(
  2,
  (source: ObjectSet, operation: SelectedPropertyOperation): LinkedSelection =>
    LinkedSelection.make({ objectSet: source, operation })
);

/**
 * Adds one numeric derived value to another.
 *
 * **Details**
 *
 * When the first value is already a sum the second is appended to it, so a
 * chain of `plus` produces one flat `add` on the wire instead of a nest.
 *
 * **Example** (Add three values into one sum)
 *
 * ```ts import.meta.vitest name="Add three values into one sum"
 * import { pipe } from "effect/Function"
 * import { currentObject, plus, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const own = (name: string) => selectProperty(currentObject, name)
 * const total = pipe(own("salary"), plus(own("bonus")), plus(own("stipend")))
 * const parts = [total.type, total.operands.length]
 * parts // => ["add", 3]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const plus: {
  (that: DerivedProperty): (self: DerivedProperty) => Addition;
  (self: DerivedProperty, that: DerivedProperty): Addition;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Addition =>
    Addition.make({ operands: DerivedProperty.guards.add(self) ? A.append(self.operands, that) : A.make(self, that) })
);

/**
 * Subtracts one numeric derived value from another.
 *
 * **Example** (Subtract a deduction)
 *
 * ```ts import.meta.vitest name="Subtract a deduction"
 * import { currentObject, minus, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const net = minus(selectProperty(currentObject, "salary"), selectProperty(currentObject, "deductions"))
 * const parts = [net.type, net.left.type, net.right.type]
 * parts // => ["subtract", "property", "property"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const minus: {
  (that: DerivedProperty): (self: DerivedProperty) => Subtraction;
  (self: DerivedProperty, that: DerivedProperty): Subtraction;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Subtraction => Subtraction.make({ left: self, right: that })
);

/**
 * Multiplies one numeric derived value by another.
 *
 * **Details**
 *
 * When the first value is already a product the second is appended to it.
 *
 * **Example** (Multiply a rate by hours)
 *
 * ```ts import.meta.vitest name="Multiply a rate by hours"
 * import { currentObject, selectProperty, times } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const pay = times(selectProperty(currentObject, "hourlyRate"), selectProperty(currentObject, "hours"))
 * const parts = [pay.type, pay.operands.length]
 * parts // => ["multiply", 2]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const times: {
  (that: DerivedProperty): (self: DerivedProperty) => Multiplication;
  (self: DerivedProperty, that: DerivedProperty): Multiplication;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Multiplication =>
    Multiplication.make({
      operands: DerivedProperty.guards.multiply(self) ? A.append(self.operands, that) : A.make(self, that),
    })
);

/**
 * Divides one numeric derived value by another.
 *
 * **Example** (Divide a total by a headcount)
 *
 * ```ts import.meta.vitest name="Divide a total by a headcount"
 * import { pipe } from "effect/Function"
 * import { SelectedCount, SelectedSum } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 * import { aggregate, currentObject, dividedBy, traverse } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const reports = pipe(currentObject, traverse("peeps"))
 * const total = aggregate(reports, SelectedSum.of("salary"))
 * const mean = pipe(total, dividedBy(aggregate(reports, SelectedCount.make({}))))
 * const parts = [mean.type, mean.left.type, mean.right.type]
 * parts // => ["divide", "selection", "selection"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const dividedBy: {
  (that: DerivedProperty): (self: DerivedProperty) => Division;
  (self: DerivedProperty, that: DerivedProperty): Division;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Division => Division.make({ left: self, right: that })
);

/**
 * The smaller of two numeric, date or timestamp derived values.
 *
 * **Details**
 *
 * When the first value is already a `least` the second is appended to it.
 *
 * **Example** (Take the earlier of two dates)
 *
 * ```ts import.meta.vitest name="Take the earlier of two dates"
 * import { currentObject, least, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const earliest = least(selectProperty(currentObject, "startDate"), selectProperty(currentObject, "transferDate"))
 * const parts = [earliest.type, earliest.operands.length]
 * parts // => ["least", 2]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const least: {
  (that: DerivedProperty): (self: DerivedProperty) => Least;
  (self: DerivedProperty, that: DerivedProperty): Least;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Least =>
    Least.make({ operands: DerivedProperty.guards.least(self) ? A.append(self.operands, that) : A.make(self, that) })
);

/**
 * The larger of two numeric, date or timestamp derived values.
 *
 * **Details**
 *
 * When the first value is already a `greatest` the second is appended to it.
 *
 * **Example** (Take the larger of two amounts)
 *
 * ```ts import.meta.vitest name="Take the larger of two amounts"
 * import { currentObject, greatest, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const larger = greatest(selectProperty(currentObject, "quota"), selectProperty(currentObject, "sales"))
 * const parts = [larger.type, larger.operands.length]
 * parts // => ["greatest", 2]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const greatest: {
  (that: DerivedProperty): (self: DerivedProperty) => Greatest;
  (self: DerivedProperty, that: DerivedProperty): Greatest;
} = dual(
  2,
  (self: DerivedProperty, that: DerivedProperty): Greatest =>
    Greatest.make({
      operands: DerivedProperty.guards.greatest(self) ? A.append(self.operands, that) : A.make(self, that),
    })
);

/**
 * The magnitude of a numeric derived value.
 *
 * **Example** (Drop the sign of a balance)
 *
 * ```ts import.meta.vitest name="Drop the sign of a balance"
 * import { abs, currentObject, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const magnitude = abs(selectProperty(currentObject, "balance"))
 * const parts = [magnitude.type, magnitude.operand.type]
 * parts // => ["absoluteValue", "property"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const abs = (operand: DerivedProperty): AbsoluteValue => AbsoluteValue.make({ operand });

/**
 * A numeric derived value with its sign flipped.
 *
 * **Example** (Flip the sign of a balance)
 *
 * ```ts import.meta.vitest name="Flip the sign of a balance"
 * import { currentObject, negate, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const owed = negate(selectProperty(currentObject, "balance"))
 * const parts = [owed.type, owed.operand.type]
 * parts // => ["negate", "property"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const negate = (operand: DerivedProperty): Negation => Negation.make({ operand });

/**
 * One calendar component of a date or timestamp derived value.
 *
 * **Example** (Read the year an employee started)
 *
 * ```ts import.meta.vitest name="Read the year an employee started"
 * import { pipe } from "effect/Function"
 * import { currentObject, extractPart, selectProperty } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const startYear = pipe(selectProperty(currentObject, "startDate"), extractPart("years"))
 * const parts = [startYear.type, startYear.part]
 * parts // => ["extract", "years"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const extractPart: {
  (part: DatePart): (operand: DerivedProperty) => DatePartExtraction;
  (operand: DerivedProperty, part: DatePart): DatePartExtraction;
} = dual(
  2,
  (operand: DerivedProperty, part: DatePart): DatePartExtraction => DatePartExtraction.make({ operand, part })
);

/**
 * One function per case of a derived property, each producing a result from the results of its operands.
 *
 * **Details**
 *
 * The keys are the wire tags. A selection is a leaf of this fold: its handler
 * receives the node and decides whether to look into the object set it reads.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface DerivedPropertyAlgebra<Result> {
  readonly property: (definition: OwnProperty) => Result;
  readonly selection: (definition: LinkedSelection) => Result;
  readonly add: (operands: ReadonlyArray<Result>, definition: Addition) => Result;
  readonly subtract: (left: Result, right: Result, definition: Subtraction) => Result;
  readonly multiply: (operands: ReadonlyArray<Result>, definition: Multiplication) => Result;
  readonly divide: (left: Result, right: Result, definition: Division) => Result;
  readonly absoluteValue: (operand: Result, definition: AbsoluteValue) => Result;
  readonly negate: (operand: Result, definition: Negation) => Result;
  readonly least: (operands: ReadonlyArray<Result>, definition: Least) => Result;
  readonly greatest: (operands: ReadonlyArray<Result>, definition: Greatest) => Result;
  readonly extract: (operand: Result, definition: DatePartExtraction) => Result;
}

/**
 * Reduces a derived property bottom-up: leaves become results and each expression combines its operands' results.
 *
 * **Example** (Render a derived property as a formula)
 *
 * ```ts import.meta.vitest name="Render a derived property as a formula"
 * import * as A from "effect/Array"
 * import { pipe } from "effect/Function"
 * import {
 *   abs,
 *   currentObject,
 *   foldDerivedProperty,
 *   minus,
 *   plus,
 *   selectProperty,
 *   traverse,
 * } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const render = foldDerivedProperty<string>({
 *   property: ({ apiName }) => apiName,
 *   selection: ({ operation }) => `linked.${operation.type}`,
 *   add: (operands) => `(${A.join(operands, " + ")})`,
 *   subtract: (left, right) => `(${left} - ${right})`,
 *   multiply: (operands) => `(${A.join(operands, " * ")})`,
 *   divide: (left, right) => `(${left} / ${right})`,
 *   absoluteValue: (operand) => `|${operand}|`,
 *   negate: (operand) => `-${operand}`,
 *   least: (operands) => `least(${A.join(operands, ", ")})`,
 *   greatest: (operands) => `greatest(${A.join(operands, ", ")})`,
 *   extract: (operand, { part }) => `${part}(${operand})`,
 * })
 * const leadSalary = pipe(currentObject, traverse("lead"), selectProperty("salary"))
 * const formula = pipe(selectProperty(currentObject, "salary"), minus(leadSalary), abs, plus(leadSalary), render)
 * formula // => "(|(salary - linked.get)| + linked.get)"
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldDerivedProperty: {
  <Result>(algebra: DerivedPropertyAlgebra<Result>): (definition: DerivedProperty) => Result;
  <Result>(definition: DerivedProperty, algebra: DerivedPropertyAlgebra<Result>): Result;
} = dual(2, <Result>(definition: DerivedProperty, algebra: DerivedPropertyAlgebra<Result>): Result => {
  // Each case answers with a thunk, for the same reason as in the object set fold.
  const fold = (node: DerivedProperty): Result =>
    DerivedProperty.match(node, {
      property: (leaf) => () => algebra.property(leaf),
      selection: (leaf) => () => algebra.selection(leaf),
      add: (sum) => () => algebra.add(A.map(sum.operands, fold), sum),
      subtract: (difference) => () => algebra.subtract(fold(difference.left), fold(difference.right), difference),
      multiply: (product) => () => algebra.multiply(A.map(product.operands, fold), product),
      divide: (quotient) => () => algebra.divide(fold(quotient.left), fold(quotient.right), quotient),
      absoluteValue: (magnitude) => () => algebra.absoluteValue(fold(magnitude.operand), magnitude),
      negate: (negation) => () => algebra.negate(fold(negation.operand), negation),
      least: (smallest) => () => algebra.least(A.map(smallest.operands, fold), smallest),
      greatest: (largest) => () => algebra.greatest(A.map(largest.operands, fold), largest),
      extract: (extraction) => () => algebra.extract(fold(extraction.operand), extraction),
    })();
  return fold(definition);
});
