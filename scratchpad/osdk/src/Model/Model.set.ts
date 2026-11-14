/**
 * Typed object sets: an object set that remembers which model its objects decode with.
 *
 * **Details**
 *
 * OSDK's `ObjectSet<Q, RDPs>` threads the object type through every method
 * with phantom generics and computes link targets with `LinkedType<Q, L>`.
 * Here a typed set is a pair: the model, and the plain object set value the
 * wire understands. Combinators rebuild the pair; {@link traverse} swaps the
 * model for the link's target after the compiler has checked, from the link
 * specs alone, that the link exists and leads to that model. Nothing is
 * encoded differently: `set.objectSet` is the value a request carries.
 *
 * What the pair is good for is checking the values that meet it. {@link where}
 * takes a typed filter and accepts it only when its owner is the API name of
 * the set's model. {@link orderBy} and {@link thenBy} take a property
 * reference and accept it only when the set's model issued it and its tag has
 * an order. Both checks compare literals the values really hold, so they need
 * no phantom parameter and no conditional type.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Struct from "effect/Struct";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import * as ObjectSets from "../ObjectSet/ObjectSet.behavior.ts";
import { OrderByFields, PropertyOrdering } from "../ObjectSet/ObjectSet.model.ts";
import { object } from "./Model.object.ts";
import type * as S from "effect/Schema";
import type { PrimaryKeyKind, PropertyTypeKind } from "../DataType/DataType.values.ts";
import type { PropertyCodec } from "../Object/Object.behavior.ts";
import type { ObjectSet, SortDirection } from "../ObjectSet/ObjectSet.model.ts";
import type { OrderedKind, TypedFilter } from "./Model.filter.ts";
import type {
  LinkSpec,
  ObjectModel,
  ObjectModelDefinition,
  ObjectModelOf,
  PropertyReference,
} from "./Model.object.ts";
import type { PropertySpec } from "./Model.spec.ts";

/**
 * An object set together with the model its objects decode with.
 *
 * **Details**
 *
 * `objectSet` is the plain value a request carries; `model.Instance` is the
 * codec of each object the set yields.
 *
 * @typeParam Model - The model of the objects in the set.
 * @category models
 * @since 0.0.0
 */
export interface TypedObjectSet<Model extends ObjectModel = ObjectModel> {
  readonly model: Model;
  readonly objectSet: ObjectSet;
}

/**
 * The set of every object of a model's object type.
 *
 * **Example** (Start from every employee)
 *
 * ```ts import.meta.vitest name="Start from every employee"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: {},
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectSet)(Model.all(Employee).objectSet))
 * wire // => { type: "base", objectType: "Employee" }
 * ```
 *
 * @param model - The model whose objects the set ranges over.
 * @throws When the model's API name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const all = <Model extends ObjectModel>(model: Model): TypedObjectSet<Model> => ({
  model,
  objectSet: ObjectSets.objectType(model.apiName),
});

/**
 * Keeps the objects of a set that satisfy a typed filter of the set's own model.
 *
 * **Details**
 *
 * The filter's owner must be the API name of the set's model, so a filter
 * built from another model's properties does not compile, in a pipeline or
 * called directly. The set receives the plain filter inside the pair, which is
 * all a request carries. To filter by a plain filter from the untyped module,
 * pair it with the model's API name yourself (see `TypedFilter`).
 *
 * **Example** (Filter employees in a pipeline)
 *
 * ```ts import.meta.vitest name="Filter employees in a pipeline"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
 *   links: {},
 * })
 * const johns = pipe(Model.all(Employee), Model.where(Model.startsWith(Employee.property("fullName"), "John")))
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectSet)(johns.objectSet))
 * wire // => { type: "filter", objectSet: { type: "base", objectType: "Employee" }, where: { type: "startsWith", field: "fullName", value: "John" } }
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const where: {
  <Owner extends string>(
    filter: TypedFilter<Owner>
  ): <Model extends ObjectModel<Owner>>(self: TypedObjectSet<Model>) => TypedObjectSet<Model>;
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: TypedObjectSet<Model>,
    filter: TypedFilter<Owner>
  ): TypedObjectSet<Model>;
} = dual(
  2,
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: TypedObjectSet<Model>,
    filter: TypedFilter<Owner>
  ): TypedObjectSet<Model> => ({
    model: self.model,
    objectSet: ObjectSets.where(self.objectSet, filter.filter),
  })
);

/**
 * The objects that are in either of two sets of the same model.
 *
 * **Example** (Unite two filtered sets)
 *
 * ```ts import.meta.vitest name="Unite two filtered sets"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), office: Model.string },
 *   links: {},
 * })
 * const office = Employee.property("office")
 * const seattle = Model.where(Model.all(Employee), Model.eq(office, "Seattle"))
 * const lyon = Model.where(Model.all(Employee), Model.eq(office, "Lyon"))
 * const either = Model.union(seattle, lyon)
 * const parts = [either.objectSet.type, either.model.apiName]
 * parts // => ["union", "Employee"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const union: {
  <Model extends ObjectModel>(that: TypedObjectSet<Model>): (self: TypedObjectSet<Model>) => TypedObjectSet<Model>;
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model>;
} = dual(
  2,
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model> => ({
    model: self.model,
    objectSet: ObjectSets.union(self.objectSet, that.objectSet),
  })
);

/**
 * The objects that are in both of two sets of the same model.
 *
 * **Example** (Intersect two filtered sets)
 *
 * ```ts import.meta.vitest name="Intersect two filtered sets"
 * import { pipe } from "effect/Function"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), office: Model.string, age: Model.short },
 *   links: {},
 * })
 * const seattle = Model.where(Model.all(Employee), Model.eq(Employee.property("office"), "Seattle"))
 * const adults = Model.where(Model.all(Employee), Model.gte(Employee.property("age"), 18))
 * const both = pipe(seattle, Model.intersect(adults))
 * both.objectSet.type // => "intersect"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const intersect: {
  <Model extends ObjectModel>(that: TypedObjectSet<Model>): (self: TypedObjectSet<Model>) => TypedObjectSet<Model>;
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model>;
} = dual(
  2,
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model> => ({
    model: self.model,
    objectSet: ObjectSets.intersect(self.objectSet, that.objectSet),
  })
);

/**
 * The objects of a set that are not in another set of the same model.
 *
 * **Example** (Remove one office from everyone)
 *
 * ```ts import.meta.vitest name="Remove one office from everyone"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), office: Model.string },
 *   links: {},
 * })
 * const everyone = Model.all(Employee)
 * const seattle = Model.where(everyone, Model.eq(Employee.property("office"), "Seattle"))
 * const elsewhere = Model.subtract(everyone, seattle)
 * elsewhere.objectSet.type // => "subtract"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const subtract: {
  <Model extends ObjectModel>(that: TypedObjectSet<Model>): (self: TypedObjectSet<Model>) => TypedObjectSet<Model>;
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model>;
} = dual(
  2,
  <Model extends ObjectModel>(self: TypedObjectSet<Model>, that: TypedObjectSet<Model>): TypedObjectSet<Model> => ({
    model: self.model,
    objectSet: ObjectSets.subtract(self.objectSet, that.objectSet),
  })
);

/**
 * The objects reached from a set by following one of its model's links, typed by the target model.
 *
 * **Details**
 *
 * The compiler checks two things from the link specs: `link` names a link of
 * the set's model, and that link's target is the API name of `target`. The
 * result decodes with `target`. Data-last, the set's model is taken from the
 * set being piped, so use that shape inside a pipeline.
 *
 * **Example** (Follow a link to another model)
 *
 * ```ts import.meta.vitest name="Follow a link to another model"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string) },
 *   links: { occupants: Model.many("Employee") },
 * })
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: { office: Model.one("Office") },
 * })
 * const offices = pipe(Model.all(Employee), Model.traverse("office", Office))
 * const wire = await Effect.runPromise(S.encodeEffect(ObjectSet)(offices.objectSet))
 * const summary = [offices.model.apiName, wire]
 * summary // => ["Office", { type: "searchAround", objectSet: { type: "base", objectType: "Employee" }, link: "office" }]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const traverse: {
  <
    Model extends ObjectModel = never,
    const Link extends keyof Model["links"] & string = never,
    Target extends ObjectModel<Model["links"][Link]["target"]> = never,
  >(
    link: Link,
    target: Target
  ): (self: TypedObjectSet<Model>) => TypedObjectSet<Target>;
  <
    Model extends ObjectModel = never,
    const Link extends keyof Model["links"] & string = never,
    Target extends ObjectModel<Model["links"][Link]["target"]> = never,
  >(
    self: TypedObjectSet<Model>,
    link: Link,
    target: Target
  ): TypedObjectSet<Target>;
} = dual(
  3,
  <
    Model extends ObjectModel,
    const Link extends keyof Model["links"] & string,
    Target extends ObjectModel<Model["links"][Link]["target"]>,
  >(
    self: TypedObjectSet<Model>,
    link: Link,
    target: Target
  ): TypedObjectSet<Target> => ({ model: target, objectSet: ObjectSets.traverse(self.objectSet, link) })
);

/**
 * A typed set together with the ordering a read of it asks for.
 *
 * **Details**
 *
 * Sets have no order; a page of one does. An ordered set is therefore the
 * same pair as a typed set plus `orderBy`, the plain list of sort keys a load
 * request carries beside the object set. `objectSet` is unchanged, and the
 * typed reads of the client send `orderBy` with the request.
 *
 * Order last. The set combinators (`where`, `union`, `traverse`, ...) return
 * a plain typed set, as their types say: an ordering does not survive them.
 *
 * @typeParam Model - The model of the objects in the set.
 * @category models
 * @since 0.0.0
 */
export interface OrderedObjectSet<Model extends ObjectModel = ObjectModel> extends TypedObjectSet<Model> {
  readonly orderBy: OrderByFields;
}

// A reference issued by the model named `Owner`, to a property whose values have an order.
type SortReference<Owner extends string> = PropertyReference<string, OrderedKind, S.Top, Owner>;

const sortKey = (reference: PropertyReference<string, PropertyTypeKind>, direction: SortDirection): PropertyOrdering =>
  PropertyOrdering.make({ property: PropertyApiName.make(reference.name), direction: O.some(direction) });

/**
 * Orders the reads of a set by one of its model's properties, in the given direction.
 *
 * **Details**
 *
 * The compiler checks two things from the reference: the set's model issued
 * it (its owner is the model's API name), and its tag has an order (numbers,
 * text, dates and instants; a geopoint, a struct or an array does not sort).
 * The result is the same set with the ordering beside it; an earlier ordering
 * of the set is replaced. Add tie-breakers with {@link thenBy}.
 *
 * **Example** (Sort employees by name, ascending)
 *
 * ```ts import.meta.vitest name="Sort employees by name, ascending"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { OrderBy } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
 *   links: {},
 * })
 * const byName = pipe(Model.all(Employee), Model.orderBy(Employee.property("fullName"), "asc"))
 * const wire = await Effect.runPromise(S.encodeEffect(OrderBy)(byName.orderBy))
 * const summary = [byName.objectSet.type, wire]
 * summary // => ["base", { fields: [{ field: "fullName", direction: "asc" }] }]
 * ```
 *
 * @throws When the reference's name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const orderBy: {
  <Owner extends string>(
    reference: SortReference<Owner>,
    direction: SortDirection
  ): <Model extends ObjectModel<Owner>>(self: TypedObjectSet<Model>) => OrderedObjectSet<Model>;
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: TypedObjectSet<Model>,
    reference: SortReference<Owner>,
    direction: SortDirection
  ): OrderedObjectSet<Model>;
} = dual(
  3,
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: TypedObjectSet<Model>,
    reference: SortReference<Owner>,
    direction: SortDirection
  ): OrderedObjectSet<Model> => ({
    model: self.model,
    objectSet: self.objectSet,
    orderBy: OrderByFields.make({ fields: [sortKey(reference, direction)] }),
  })
);

/**
 * Adds a tie-breaking property to an ordered set: it decides between objects every earlier key ranks equal.
 *
 * **Details**
 *
 * The set must already be ordered, and the reference is checked as for
 * {@link orderBy}: issued by the set's model, with a tag that has an order.
 *
 * **Example** (Sort by office, then by name)
 *
 * ```ts import.meta.vitest name="Sort by office, then by name"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { OrderBy } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string, office: Model.string },
 *   links: {},
 * })
 * const ordered = pipe(
 *   Model.all(Employee),
 *   Model.orderBy(Employee.property("office"), "asc"),
 *   Model.thenBy(Employee.property("fullName"), "desc")
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(OrderBy)(ordered.orderBy))
 * wire // => { fields: [{ field: "office", direction: "asc" }, { field: "fullName", direction: "desc" }] }
 * ```
 *
 * @throws When the reference's name is the empty string.
 * @category combinators
 * @since 0.0.0
 */
export const thenBy: {
  <Owner extends string>(
    reference: SortReference<Owner>,
    direction: SortDirection
  ): <Model extends ObjectModel<Owner>>(self: OrderedObjectSet<Model>) => OrderedObjectSet<Model>;
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: OrderedObjectSet<Model>,
    reference: SortReference<Owner>,
    direction: SortDirection
  ): OrderedObjectSet<Model>;
} = dual(
  3,
  <Owner extends string, Model extends ObjectModel<Owner>>(
    self: OrderedObjectSet<Model>,
    reference: SortReference<Owner>,
    direction: SortDirection
  ): OrderedObjectSet<Model> => ({
    model: self.model,
    objectSet: self.objectSet,
    orderBy: OrderByFields.make({ fields: A.append(self.orderBy.fields, sortKey(reference, direction)) }),
  })
);

// What `pick` keeps: the named properties and, always, the primary key.
type PickedSpecs<
  Specs extends Readonly<Record<string, PropertySpec>>,
  Key extends keyof Specs & string,
  Names extends ReadonlyArray<keyof Specs & string>,
> = Struct.Simplify<
  Pick<
    Specs & { readonly [K in Key]: PropertySpec<PrimaryKeyKind, PropertyCodec, PropertyCodec, "required"> },
    Names[number] | Key
  >
>;

/**
 * Narrows a model to some of its properties; the primary key is always kept.
 *
 * **Details**
 *
 * The result is a model in its own right, built by `Model.object` from the
 * picked specs: its `Properties` and `Instance` decode and type only the
 * picked properties and the key, which is what a load request that selects
 * those properties returns. A record that holds more is still an instance:
 * what the narrowed model does not declare is kept as JSON in `undeclared`.
 * Links are unchanged.
 *
 * **Example** (Select two properties of a model)
 *
 * ```ts import.meta.vitest name="Select two properties of a model"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string, office: Model.string },
 *   links: {},
 * })
 * const Named = Model.pick(Employee, ["fullName"])
 * const named = await Effect.runPromise(
 *   S.decodeEffect(Named.Instance)({ __apiName: "Employee", __primaryKey: 7, employeeId: 7, office: "Lyon" })
 * )
 * const parts = [R.keys(named.properties), named.undeclared]
 * parts // => [["employeeId", "fullName"], { office: "Lyon" }]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const pick: {
  <
    const ApiName extends string = never,
    const Specs extends Readonly<Record<string, PropertySpec>> = never,
    const Key extends keyof Specs & string = never,
    const Links extends Readonly<Record<string, LinkSpec>> = never,
    const Names extends ReadonlyArray<keyof Specs & string> = never,
  >(
    names: Names
  ): (
    model: ObjectModelDefinition<ApiName, Specs, Key, Links>
  ) => ObjectModelOf<ApiName, PickedSpecs<Specs, Key, Names>, Key, Links>;
  <
    const ApiName extends string = never,
    const Specs extends Readonly<Record<string, PropertySpec>> = never,
    const Key extends keyof Specs & string = never,
    const Links extends Readonly<Record<string, LinkSpec>> = never,
    const Names extends ReadonlyArray<keyof Specs & string> = never,
  >(
    model: ObjectModelDefinition<ApiName, Specs, Key, Links>,
    names: Names
  ): ObjectModelOf<ApiName, PickedSpecs<Specs, Key, Names>, Key, Links>;
} = dual(
  2,
  <
    const ApiName extends string,
    const Specs extends Readonly<Record<string, PropertySpec>>,
    const Key extends keyof Specs & string,
    const Links extends Readonly<Record<string, LinkSpec>>,
    const Names extends ReadonlyArray<keyof Specs & string>,
  >(
    model: ObjectModelDefinition<ApiName, Specs, Key, Links>,
    names: Names
  ) =>
    object({
      apiName: model.apiName,
      primaryKey: model.primaryKey,
      properties: Struct.pick(model.properties, A.append(names, model.primaryKey)),
      links: model.links,
    })
);
