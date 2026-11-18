/**
 * Typed object models: an object type written once, in code, from which its instance codec is derived.
 *
 * **Details**
 *
 * OSDK generates, for every object type, a definition constant plus a phantom
 * `__DefinitionMetadata` type, and computes the instance type from it with
 * `Osdk.Instance<Q, OPTIONS, P, R>` and its supporting conditional types. Here
 * {@link object} takes names and property specs and returns a model whose
 * `Instance` is a real codec: its `Encoded` side is the platform's flat JSON
 * record and its `Type` side is exact for every property, with identity kept
 * apart from the properties so no key needs a `$` or `__` sigil. The static
 * type is simply `typeof Model.Instance.Type`.
 *
 * The codec is not written here. It is `InstanceOf` of the `Object` concept,
 * the one instance codec of the library, applied to the struct the specs
 * precipitate. The projection from a served definition (`instanceCodec`) is
 * the same function applied to another codec of the properties, so a typed
 * instance and a dynamic one have one shape, keep the same invariants and
 * are refused with the same words.
 *
 * Presence follows what the platform guarantees and nothing more: the primary
 * key always has a value, so it is the one property a definition marks
 * `required`; every other property is an `Option`, and a definition that says
 * otherwise does not compile. A model also issues the property references the
 * typed filters and orderings are built from, each stamped with the model's
 * API name so a filter cannot be applied to a set of another model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { InstanceOf } from "../Object/Object.behavior.ts";
import { fieldsOf } from "./Model.spec.ts";
import type { PrimaryKeyKind, PropertyTypeKind } from "../DataType/DataType.values.ts";
import type { LinkCardinality } from "../LinkType/LinkType.model.ts";
import type { PropertyCodec } from "../Object/Object.behavior.ts";
import type { ObjectRecord } from "../Object/Object.model.ts";
import type { PropertySpec } from "./Model.spec.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.object");

/**
 * One outgoing link of an object model: how many objects it reaches and of which object type.
 *
 * @typeParam Cardinality - `"one"` for at most one linked object, `"many"` for any number.
 * @typeParam Target - API name of the linked object type, kept as a literal.
 * @category models
 * @since 0.0.0
 */
export interface LinkSpec<Cardinality extends LinkCardinality = LinkCardinality, Target extends string = string> {
  readonly cardinality: Cardinality;
  readonly target: Target;
}

/**
 * A link that reaches at most one object of the `target` object type.
 *
 * **Example** (Declare a link to at most one object)
 *
 * ```ts import.meta.vitest name="Declare a link to at most one object"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const lead = Model.one("Employee")
 * lead // => { cardinality: "one", target: "Employee" }
 * ```
 *
 * @param target - API name of the linked object type.
 * @category constructors
 * @since 0.0.0
 */
export const one = <const Target extends string>(target: Target): LinkSpec<"one", Target> => ({
  cardinality: "one",
  target,
});

/**
 * A link that reaches any number of objects of the `target` object type.
 *
 * **Example** (Declare a link to any number of objects)
 *
 * ```ts import.meta.vitest name="Declare a link to any number of objects"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string) },
 *   links: { occupants: Model.many("Employee") },
 * })
 * Office.links.occupants // => { cardinality: "many", target: "Employee" }
 * ```
 *
 * @param target - API name of the linked object type.
 * @category constructors
 * @since 0.0.0
 */
export const many = <const Target extends string>(target: Target): LinkSpec<"many", Target> => ({
  cardinality: "many",
  target,
});

/**
 * A property of a model, addressed by name and carrying the tag and value codec its spec declares.
 *
 * **Details**
 *
 * Typed filter and ordering constructors take a reference rather than a bare
 * string, so the compiler knows which operators the property's tag allows and
 * what an operand must be. `owner` is the API name of the model that issued
 * the reference. It is data, not a phantom parameter: every typed filter
 * copies it, and `Model.where` and `Model.orderBy` compare it with the API
 * name of the set's model, so a property of one model cannot filter or order
 * the objects of another.
 *
 * @typeParam Name - The property's API name.
 * @typeParam Kind - The property's type tag.
 * @typeParam Value - The codec of one present value.
 * @typeParam Owner - API name of the model that issued the reference.
 * @category models
 * @since 0.0.0
 */
export interface PropertyReference<
  Name extends string = string,
  Kind extends PropertyTypeKind = PropertyTypeKind,
  Value extends S.Top = S.Top,
  Owner extends string = string,
> {
  readonly owner: Owner;
  readonly name: Name;
  readonly kind: Kind;
  readonly value: Value;
}

/**
 * What {@link object} needs to know about an object type.
 *
 * **Details**
 *
 * `properties` states presence the way the platform guarantees it. The spec
 * under `primaryKey` must be marked `required` and have a key-eligible tag:
 * an object always has its key. Every other spec must be left optional: an
 * object can lack any other property, even one the ontology marks
 * not-nullable (an object missing from the datasource mapping omits it), so a
 * definition that marks one `required` is rejected by the compiler rather
 * than believed.
 *
 * @typeParam ApiName - The object type's API name.
 * @typeParam Specs - The spec of every property, keyed by API name.
 * @typeParam Key - The name of the primary key property.
 * @typeParam Links - The outgoing links, keyed by link API name.
 * @category models
 * @since 0.0.0
 */
export interface ObjectModelDefinition<
  ApiName extends string,
  Specs extends Readonly<Record<string, PropertySpec>>,
  Key extends keyof Specs & string,
  Links extends Readonly<Record<string, LinkSpec>>,
> {
  readonly apiName: ApiName;
  readonly primaryKey: Key;
  readonly properties: Specs & {
    readonly [K in Key]: PropertySpec<PrimaryKeyKind, PropertyCodec, PropertyCodec, "required">;
  } & {
    readonly [K in Exclude<keyof Specs, Key>]: PropertySpec<PropertyTypeKind, PropertyCodec, PropertyCodec, "optional">;
  };
  readonly links: Links;
}

/**
 * Defines an object model and derives its codecs.
 *
 * **Details**
 *
 * The result carries the definition as given plus two codecs:
 *
 * - `Properties` decodes the property keys of a wire record. The primary key,
 *   which must be marked `required` and have a key-eligible type tag, is
 *   plain; every other property must be left optional and is an `Option`. The
 *   compiler checks all three, because the key is the only property the
 *   platform guarantees.
 * - `Instance` decodes a whole wire record into
 *   `{ locator, rid, title, score, properties, undeclared }`: `InstanceOf`
 *   applied to `Properties`. `locator` is the ordinary `ObjectLocator`, so an
 *   instance can be handed to anything that takes one; `properties` has the
 *   exact type of `Properties`; `undeclared` keeps every key the model does
 *   not declare as JSON and writes it back, so a round trip loses nothing.
 *
 * In both directions the record must belong to this object type, and the key
 * in `locator`, read with the key property's codec, must equal the key
 * property. `property(name)` returns a typed reference for the filter and
 * ordering constructors, stamped with this model's API name as its `owner`.
 *
 * **Gotchas**
 *
 * A record loaded with a selection that leaves out the key property, and one
 * loaded with property securities (every value wrapped), are not instances of
 * a model. Both decode as `OntologyObject`; read them through an untyped set.
 *
 * **Example** (Define a model and decode an instance)
 *
 * ```ts import.meta.vitest name="Define a model and decode an instance"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: {
 *     employeeId: Model.required(Model.integer),
 *     fullName: Model.string,
 *     startedAt: Model.timestamp,
 *     skills: Model.array(Model.string),
 *   },
 *   links: { lead: Model.one("Employee"), peeps: Model.many("Employee") },
 * })
 *
 * const employee = await Effect.runPromise(
 *   S.decodeEffect(Employee.Instance)({
 *     __apiName: "Employee",
 *     __primaryKey: 50030,
 *     __title: "John Doe",
 *     employeeId: 50030,
 *     fullName: "John Doe",
 *     startedAt: "2019-01-01T00:00:00Z",
 *     nickname: "Johnny",
 *   })
 * )
 * const summary = [
 *   employee.locator.primaryKey,
 *   employee.properties.employeeId,
 *   O.getOrElse(employee.properties.fullName, () => ""),
 *   O.getOrElse(O.map(employee.properties.startedAt, DateTime.getPartUtc("year")), () => 0),
 *   O.isNone(employee.properties.skills),
 *   employee.undeclared,
 * ]
 * summary // => [50030, 50030, "John Doe", 2019, true, { nickname: "Johnny" }]
 * ```
 *
 * @param definition - The object type's name, key, property specs and links.
 * @category constructors
 * @since 0.0.0
 */
export const object = <
  const ApiName extends string,
  const Specs extends Readonly<Record<string, PropertySpec>>,
  const Key extends keyof Specs & string,
  const Links extends Readonly<Record<string, LinkSpec>>,
>(
  definition: ObjectModelDefinition<ApiName, Specs, Key, Links>
) => {
  const { apiName, primaryKey, links } = definition;
  // The definition's type also states which specs are required. The model keeps the specs as written.
  const properties: Specs = definition.properties;
  // The same record, seen as one in which every name it has leads to a spec. Indexing `Specs` by a name
  // the compiler knows only generically would otherwise yield a value that may be missing.
  const specAt: Specs & { readonly [K in keyof Specs]: PropertySpec } = definition.properties;
  const identifier: string = apiName;

  const Properties = S.Struct(fieldsOf<Specs>(properties)).pipe(
    $I.annoteSchema(`${identifier}Properties`, {
      description: `The properties of one ${identifier} object, keyed by property name.`,
    })
  );

  // The one instance codec of the library, applied to this model's properties struct.
  const Instance = InstanceOf({ apiName, primaryKey, properties: Properties }).pipe(
    $I.annoteSchema(identifier, {
      description: `One ${identifier} object: its locator, its typed properties and its undeclared keys.`,
    })
  );

  return {
    apiName,
    primaryKey,
    properties,
    links,
    Properties,
    Instance,
    property: <const Name extends keyof Specs & string>(
      name: Name
    ): PropertyReference<Name, Specs[Name]["kind"], Specs[Name]["value"], ApiName> => ({
      owner: apiName,
      name,
      kind: specAt[name].kind,
      value: specAt[name].value,
    }),
  };
};

/**
 * What every object model has, whatever its properties: the shape typed combinators are generic over.
 *
 * **Details**
 *
 * Any value returned by `Model.object` satisfies it. `ApiName` is kept as a
 * parameter so a link's target literal can be compared with a model's name.
 * `Instance` is a codec of the flat wire record, which is all the read facade
 * asks of a model.
 *
 * @typeParam ApiName - The object type's API name.
 * @category models
 * @since 0.0.0
 */
export interface ObjectModel<ApiName extends string = string> {
  readonly apiName: ApiName;
  readonly primaryKey: string;
  readonly properties: Readonly<Record<string, PropertySpec>>;
  readonly links: Readonly<Record<string, LinkSpec>>;
  readonly Properties: S.Top;
  readonly Instance: S.Codec<unknown, ObjectRecord>;
}

/**
 * The model `Model.object` derives from the given names, specs and links.
 *
 * **Details**
 *
 * It is the return type of `Model.object` under a name, so signatures that
 * produce a model (such as `Model.pick`) can state which one.
 *
 * @typeParam ApiName - The object type's API name.
 * @typeParam Specs - The spec of every property, keyed by API name.
 * @typeParam Key - The name of the primary key property.
 * @typeParam Links - The outgoing links, keyed by link API name.
 * @category models
 * @since 0.0.0
 */
export interface ObjectModelOf<
  ApiName extends string,
  Specs extends Readonly<Record<string, PropertySpec>>,
  Key extends keyof Specs & string,
  Links extends Readonly<Record<string, LinkSpec>>,
> extends ReturnType<typeof object<ApiName, Specs, Key, Links>> {}
