/**
 * Typed actions: an action type written once, in code, from which the codec of its arguments is derived.
 *
 * **Details**
 *
 * `Action.argumentsCodec` turns an action type known only at runtime into a
 * codec whose static type is necessarily a record of `unknown`. The specs here
 * make the same pairing at authoring time, so the compiler sees it:
 *
 * - an `ExchangeSpec` (declared in `Model.spec.ts`) is a type tag with the
 *   codec `Action.argumentCodec` (or `Query.valueCodec`) would project for
 *   that tag. The leaf constants of the shared tags are exchange specs
 *   already (`Model.string`, `Model.integer`, `Model.timestamp`,
 *   `Model.marking`, `Model.mediaReference`, `Model.geoshape` ...), and so is
 *   `Model.vector(n)`: every universe reads those tags from one table. This
 *   file adds the tags only arguments have, each leaf built from the row
 *   `Action.leafCodec` holds under its tag: references to objects, object
 *   sets and interface objects, attachment identifiers, geohashes, lists and
 *   structs;
 * - a {@link ParameterSpec} is a value spec plus whether a request must supply
 *   it ({@link requiredParameter}, {@link optionalParameter});
 * - {@link action} maps a record of parameter specs to the struct codec of the
 *   argument record with one heterogeneous map and no conditional types.
 *
 * This replaces OSDK's `ActionDefinition`, its `ActionParam.*` type algebra
 * and the generated `applyAction` signatures. {@link actionConformance} checks
 * a hand-written model against the action type the platform serves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { leafCodec } from "../Action/Action.behavior.ts";
import { ActionParameterType, OntologyDataType } from "../Action/Action.model.ts";
import { DataTypeKind } from "../DataType/DataType.values.ts";
import {
  ActionTypeApiName,
  InterfaceTypeApiName,
  ObjectTypeApiName,
  ParameterId,
  StructFieldApiName,
} from "../Identifier/Identifier.model.ts";
import { ElementStep, FieldStep, TypePathStep } from "./Model.policy.ts";
import { ReferenceTarget } from "./Model.spec.ts";
import type { ActionType, StructParameterType } from "../Action/Action.model.ts";
import type { ActionParameterTypeKind } from "../DataType/DataType.values.ts";
import type { ExchangeSpec, SpecShape, ValueSpec } from "./Model.spec.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.action");

// -----------------------------------------------------------------------------
// Exchange specs
// -----------------------------------------------------------------------------

const exchange = <const Kind extends DataTypeKind, Value extends S.Top>(
  kind: Kind,
  value: Value,
  shape: SpecShape
): ExchangeSpec<Kind, Value, Value> => ({ kind, value, member: value, shape });

const leafShape: SpecShape = { type: "leaf" };

// A leaf spec is its tag and the row of the action's leaf table under that tag.
const leaf = <const Kind extends keyof typeof leafCodec>(kind: Kind) => exchange(kind, leafCodec[kind], leafShape);

// -----------------------------------------------------------------------------
// References
// -----------------------------------------------------------------------------

// What a reference needs of an object model: its name, and the spec of its primary key property.
interface KeyedModel<Key extends string, Specs extends Readonly<Record<Key, { readonly value: S.Top }>>> {
  readonly apiName: string;
  readonly primaryKey: Key;
  readonly properties: Specs;
}

const referenceShape = (target: O.Option<ReferenceTarget>): SpecShape => ({ type: "reference", target });

// A reference to whatever the tag ranges over: the row of the action's leaf table, and the target as data.
const reference = <const Kind extends "object" | "objectSet" | "interfaceObject">(
  kind: Kind,
  target: O.Option<ReferenceTarget>
) => exchange(kind, leafCodec[kind], referenceShape(target));

/**
 * Spec of a reference to one object of the given model: the value is that model's primary key value.
 *
 * **Details**
 *
 * An object travels as its primary key. The spec takes the key's codec from
 * the model, so a reference to an employee keyed by an integer is a `number`
 * and nothing else.
 *
 * **Example** (Type a reference by the model's primary key)
 *
 * ```ts import.meta.vitest name="Type a reference by the model's primary key"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: {},
 * })
 * const accepts = S.is(Model.objectReference(Employee).value)
 * const verdicts = [accepts(50030), accepts("50030")]
 * verdicts // => [true, false]
 * ```
 *
 * @param target - The model of the referenced object.
 * @throws When the model's API name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const objectReference = <
  const Key extends string,
  Specs extends Readonly<Record<Key, { readonly value: S.Top }>>,
>(
  target: KeyedModel<Key, Specs>
) =>
  exchange<"object", Specs[Key]["value"]>(
    "object",
    target.properties[target.primaryKey].value,
    referenceShape(O.some(ObjectTypeApiName.make(target.apiName)))
  );

/**
 * Spec of a reference to one object of an object type known only by name: the value is any primary key value.
 *
 * **Example** (Refer to an object type without a model)
 *
 * ```ts import.meta.vitest name="Refer to an object type without a model"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const accepts = S.is(Model.namedObjectReference("Employee").value)
 * const verdicts = [accepts(50030), accepts("EMP-1"), accepts(null)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @param objectType - API name of the referenced object type.
 * @throws When the name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const namedObjectReference = (objectType: string) =>
  reference("object", O.some(ObjectTypeApiName.make(objectType)));

/**
 * Spec of an object set of any object type: the identifier of a stored set, or a definition written in place.
 *
 * **Example** (Pass a stored object set by its identifier)
 *
 * ```ts import.meta.vitest name="Pass a stored object set by its identifier"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const stored = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.objectSetArgument.value)("ri.object-set.main.object-set.1")
 * )
 * stored // => "ri.object-set.main.object-set.1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const objectSetArgument = reference("objectSet", O.none());

/**
 * Spec of an object set whose members are objects of the given object type.
 *
 * **Details**
 *
 * The value is an `ObjectSetArgument`, so `Model.all(Employee).objectSet` and
 * every set built from it can be passed as is. The object type is recorded for
 * {@link actionConformance}; the codec does not look inside the set.
 *
 * **Example** (Pass a typed object set as an argument)
 *
 * ```ts import.meta.vitest name="Pass a typed object set as an argument"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: {},
 * })
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(Model.objectSetOf(Employee).value)(Model.all(Employee).objectSet)
 * )
 * wire // => { type: "base", objectType: "Employee" }
 * ```
 *
 * @param target - The model, or anything else that names the object type.
 * @throws When the API name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const objectSetOf = (target: { readonly apiName: string }) =>
  reference("objectSet", O.some(ObjectTypeApiName.make(target.apiName)));

/**
 * Spec of a reference to one object seen through any interface: the value names the object type and the primary key.
 *
 * **Example** (Read an interface object reference)
 *
 * ```ts import.meta.vitest name="Read an interface object reference"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const locator = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.interfaceObject.value)({ objectTypeApiName: "Office", primaryKeyValue: "NYC" })
 * )
 * const facts = [locator.objectType, locator.primaryKey]
 * facts // => ["Office", "NYC"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const interfaceObject = reference("interfaceObject", O.none());

/**
 * Spec of a reference to one object that implements the named interface.
 *
 * **Example** (Write an interface object reference)
 *
 * ```ts import.meta.vitest name="Write an interface object reference"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ObjectLocator } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const located = Model.interfaceObjectOf("Located")
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(located.value)(
 *     ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" })
 *   )
 * )
 * wire // => { objectTypeApiName: "Office", primaryKeyValue: "NYC" }
 * ```
 *
 * @param interfaceType - API name of the interface.
 * @throws When the name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const interfaceObjectOf = (interfaceType: string) =>
  reference("interfaceObject", O.some(InterfaceTypeApiName.make(interfaceType)));

// -----------------------------------------------------------------------------
// Leaves only arguments have
// -----------------------------------------------------------------------------

/**
 * Spec of an attachment handed to an action or a query: the identifier of an uploaded file.
 *
 * **Details**
 *
 * A property of the `attachment` tag reads as a reference record
 * (`Model.attachment`); an argument of the same tag is the bare identifier.
 *
 * **Example** (Tell an attachment argument from an attachment property)
 *
 * ```ts import.meta.vitest name="Tell an attachment argument from an attachment property"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const rid = "ri.attachments.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"
 * const verdicts = [S.is(Model.attachmentRid.value)(rid), S.is(Model.attachment.value)(rid)]
 * verdicts // => [true, false]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const attachmentRid = leaf("attachment");

/**
 * Spec of a `geohash` parameter: a point, which the platform stores as a geohash.
 *
 * **Example** (Read a geohash argument as a point)
 *
 * ```ts import.meta.vitest name="Read a geohash argument as a point"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const point = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.geohash.value)({ type: "Point", coordinates: [-74.006, 40.7128] })
 * )
 * point.coordinates // => [-74.006, 40.7128]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const geohash = leaf("geohash");

/**
 * Spec of a `timeSeriesReference` parameter: a reference to one time series.
 *
 * **Example** (Read a time series argument)
 *
 * ```ts import.meta.vitest name="Read a time series argument"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const reference = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.timeSeriesReference.value)("wellPressureSeriesId")
 * )
 * reference.type // => "series"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const timeSeriesReference = leaf("timeSeriesReference");

/**
 * Spec of an `objectType` parameter: the name of an object type rather than an object.
 *
 * **Example** (Accept an object type name)
 *
 * ```ts import.meta.vitest name="Accept an object type name"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const accepts = S.is(Model.objectTypeName.value)
 * const verdicts = [accepts("Employee"), accepts("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const objectTypeName = leaf("objectType");

/**
 * Spec of a `scenarioReference` parameter: the identifier of a scenario.
 *
 * **Example** (Accept a scenario identifier)
 *
 * ```ts import.meta.vitest name="Accept a scenario identifier"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const accepts = S.is(Model.scenarioReference.value)
 * const verdicts = [accepts("ri.ontology.main.scenario.what-if"), accepts(7)]
 * verdicts // => [true, false]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const scenarioReference = leaf("scenarioReference");

// -----------------------------------------------------------------------------
// Composites
// -----------------------------------------------------------------------------

/**
 * Spec of a list whose elements follow `element`.
 *
 * **Example** (Write a typed list of decimals the way the platform expects)
 *
 * ```ts import.meta.vitest name="Write a typed list of decimals the way the platform expects"
 * import * as BigDecimal from "effect/BigDecimal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const amounts = Model.listOf(Model.decimal)
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(amounts.value)([BigDecimal.fromStringUnsafe("2.718281828"), BigDecimal.fromStringUnsafe("3")])
 * )
 * wire // => ["2.718281828", "3"]
 * ```
 *
 * @param element - Spec of every element.
 * @category constructors
 * @since 0.0.0
 */
export const listOf = <Kind extends DataTypeKind, Value extends S.Top>(element: ExchangeSpec<Kind, Value>) =>
  exchange("array", S.Array(element.value), { type: "list", element });

interface MemberOf extends Struct.Lambda {
  <Member extends S.Top>(spec: { readonly member: Member }): Member;
  readonly "~lambda.out": this["~lambda.in"] extends { readonly member: infer Member extends S.Top } ? Member : never;
}

const membersOf: <const Specs extends Readonly<Record<string, ExchangeSpec>>>(
  specs: Specs
) => { [K in keyof Specs]: Struct.Apply<MemberOf, Specs[K]> } = Struct.map(
  Struct.lambda<MemberOf>((field) => field.member)
);

// A struct schema with no fields accepts any non-null value. The check keeps a field-less struct
// spec honest: its value is still a record, never text, a number or an array.
const StructIsRecord = S.makeFilter(
  P.isObject,
  $I.annote("StructIsRecordCheck", {
    title: "Struct is a record",
    description: "A struct value is a record of named fields.",
    message: "Expected a record of named fields",
  })
);

/**
 * Spec of a struct with the given named field specs.
 *
 * **Details**
 *
 * Every field is a required key. A field the action type does not require, or
 * whose query type allows `null`, is declared {@link nullable}: it is an
 * `Option` in the domain, `null` on the wire when none, and may be left out of
 * a value that is read.
 *
 * **Example** (Write a struct argument with an empty field)
 *
 * ```ts import.meta.vitest name="Write a struct argument with an empty field"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const address = Model.structOf({
 *   city: Model.string,
 *   state: Model.string,
 *   zipcode: Model.nullable(Model.integer),
 * })
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(address.value)({ city: "NYC", state: "NY", zipcode: O.none() })
 * )
 * wire // => { city: "NYC", state: "NY", zipcode: null }
 * ```
 *
 * @param fields - Spec of each field, keyed by the field's name.
 * @category constructors
 * @since 0.0.0
 */
export const structOf = <const Specs extends Readonly<Record<string, ExchangeSpec>>>(fields: Specs) =>
  exchange("struct", S.Struct(membersOf<Specs>(fields)).check(StructIsRecord), { type: "struct", fields });

/**
 * Spec of a value that may be missing: an `Option` in the domain and `null` on the wire when none.
 *
 * **Details**
 *
 * This is how a query type says a value may be missing (a union with the
 * `null` tag) and how a field of a struct parameter that is not required is
 * declared. As a field of a struct the value may also be left out when read;
 * it is always written, as `null` when none.
 *
 * **Example** (Read a missing value as none)
 *
 * ```ts import.meta.vitest name="Read a missing value as none"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const person = Model.structOf({ name: Model.string, age: Model.nullable(Model.integer) })
 * const decode = S.decodeUnknownEffect(person.value)
 * const [absent, empty, present] = await Effect.runPromise(
 *   Effect.all([decode({ name: "Ada" }), decode({ name: "Ada", age: null }), decode({ name: "Ada", age: 36 })])
 * )
 * const ages = [O.isNone(absent.age), O.isNone(empty.age), O.getOrNull(present.age)]
 * ages // => [true, true, 36]
 * ```
 *
 * @param inner - Spec of the value when it is present.
 * @category combinators
 * @since 0.0.0
 */
export const nullable = <Kind extends DataTypeKind, Value extends S.Top>(
  inner: ExchangeSpec<Kind, Value>
): ExchangeSpec<"union", S.OptionFromNullOr<Value>, S.withDecodingDefaultKey<S.OptionFromNullOr<Value>>> => ({
  kind: "union",
  value: S.OptionFromNullOr(inner.value),
  member: S.OptionFromNullOr(inner.value).pipe(S.withDecodingDefaultKey(Effect.succeed(null))),
  shape: { type: "nullable", inner },
});

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

/**
 * A value spec declared as a parameter: whether a request must supply it, and the codecs that follow from that.
 *
 * **Details**
 *
 * It is a `ValueSpec` (tag, value codec, shape) with three more facts.
 * `argument` is the codec of the parameter as a key of an action's argument
 * record, and `input` its codec as a key of a query's parameter record. For a
 * required parameter both are `value`. For an optional one they differ,
 * because the two requests do: an action tells "leave untouched" (key absent)
 * from "clear" (`null`), a query only "left out" from "supplied".
 *
 * @typeParam Kind - The type tag.
 * @typeParam Value - The codec of one value.
 * @typeParam Argument - The codec of the parameter as a key of an action's argument record.
 * @typeParam Input - The codec of the parameter as a key of a query's parameter record.
 * @typeParam Presence - Whether a request may leave the parameter out.
 * @category models
 * @since 0.0.0
 */
export interface ParameterSpec<
  Kind extends DataTypeKind = DataTypeKind,
  Value extends S.Top = S.Top,
  Argument extends S.Top = S.Top,
  Input extends S.Top = S.Top,
  Presence extends "optional" | "required" = "optional" | "required",
> extends ValueSpec<Kind, Value> {
  readonly presence: Presence;
  readonly argument: Argument;
  readonly input: Input;
}

/**
 * Declares a parameter every request must supply: a required key holding the value.
 *
 * **Example** (Require a parameter)
 *
 * ```ts import.meta.vitest name="Require a parameter"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Rename = Model.action({
 *   apiName: "renameOffice",
 *   parameters: { officeId: Model.requiredParameter(Model.string), name: Model.requiredParameter(Model.string) },
 * })
 * const accepts = S.is(Rename.Arguments)
 * const verdicts = [accepts({ officeId: "NYC", name: "New York" }), accepts({ officeId: "NYC" })]
 * verdicts // => [true, false]
 * ```
 *
 * @param spec - What the parameter holds.
 * @category combinators
 * @since 0.0.0
 */
export const requiredParameter = <Kind extends DataTypeKind, Value extends S.Top>(
  spec: ExchangeSpec<Kind, Value>
): ParameterSpec<Kind, Value, Value, Value, "required"> => ({
  kind: spec.kind,
  presence: "required",
  value: spec.value,
  argument: spec.value,
  input: spec.value,
  shape: spec.shape,
});

/**
 * Declares a parameter a request may leave out.
 *
 * **Details**
 *
 * As an argument of an action it keeps the three intents the wire tells
 * apart, exactly as `ActionArguments` does, now with the value typed:
 *
 * | Intent | Domain | Wire |
 * | --- | --- | --- |
 * | leave untouched (prefills apply) | key absent | key absent |
 * | clear the value | `Option.none()` | `null` |
 * | set a value | `Option.some(value)` | the value |
 *
 * As a parameter of a query it is an `Option`: none leaves the key out, which
 * is not the same message as supplying `null`.
 *
 * **Example** (Tell clearing a parameter from leaving it untouched)
 *
 * ```ts import.meta.vitest name="Tell clearing a parameter from leaving it untouched"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Move = Model.action({
 *   apiName: "moveOffice",
 *   parameters: { officeId: Model.requiredParameter(Model.string), capacity: Model.optionalParameter(Model.integer) },
 * })
 * const encode = S.encodeEffect(Move.Arguments)
 * const wires = await Effect.runPromise(
 *   Effect.all([
 *     encode({ officeId: "NYC" }),
 *     encode({ officeId: "NYC", capacity: O.none() }),
 *     encode({ officeId: "NYC", capacity: O.some(100) }),
 *   ])
 * )
 * wires // => [{ officeId: "NYC" }, { officeId: "NYC", capacity: null }, { officeId: "NYC", capacity: 100 }]
 * ```
 *
 * @param spec - What the parameter holds.
 * @category combinators
 * @since 0.0.0
 */
export const optionalParameter = <Kind extends DataTypeKind, Value extends S.Top>(
  spec: ExchangeSpec<Kind, Value>
): ParameterSpec<
  Kind,
  Value,
  S.optionalKey<S.OptionFromNullOr<Value>>,
  S.OptionFromOptionalKey<Value>,
  "optional"
> => ({
  kind: spec.kind,
  presence: "optional",
  value: spec.value,
  argument: spec.value.pipe(S.OptionFromNullOr, S.optionalKey),
  input: S.OptionFromOptionalKey(spec.value),
  shape: spec.shape,
});

interface ArgumentOf extends Struct.Lambda {
  <Argument extends S.Top>(parameter: { readonly argument: Argument }): Argument;
  readonly "~lambda.out": this["~lambda.in"] extends { readonly argument: infer Argument extends S.Top }
    ? Argument
    : never;
}

/**
 * Maps a record of parameter specs to the record of their argument codecs, key by key.
 *
 * **Details**
 *
 * This is the whole type-level mechanism of a typed action: one heterogeneous
 * map from `effect/Struct`. Passing its result to `S.Struct` yields a struct
 * schema whose `Type` and `Encoded` are exact for every parameter.
 *
 * **Example** (Build an argument struct by hand)
 *
 * ```ts import.meta.vitest name="Build an argument struct by hand"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Arguments = S.Struct(
 *   Model.argumentsOf({ title: Model.requiredParameter(Model.string), salary: Model.optionalParameter(Model.double) })
 * )
 * const accepts = S.is(Arguments)
 * const verdicts = [accepts({ title: "Director" }), accepts({ salary: 100 })]
 * verdicts // => [true, false]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const argumentsOf: <const Specs extends Readonly<Record<string, ParameterSpec>>>(
  specs: Specs
) => { [K in keyof Specs]: Struct.Apply<ArgumentOf, Specs[K]> } = Struct.map(
  Struct.lambda<ArgumentOf>((parameter) => parameter.argument)
);

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

/**
 * What {@link action} needs to know about an action type.
 *
 * @typeParam ApiName - The action type's API name.
 * @typeParam Specs - The spec of every parameter, keyed by parameter identifier.
 * @category models
 * @since 0.0.0
 */
export interface ActionModelDefinition<
  ApiName extends string,
  Specs extends Readonly<Record<string, ParameterSpec<ActionParameterTypeKind>>>,
> {
  readonly apiName: ApiName;
  readonly parameters: Specs;
}

/**
 * Defines an action model and derives the codec of its arguments.
 *
 * **Details**
 *
 * The result carries the definition as given plus `Arguments`, a struct codec
 * with one key per parameter: its `Type` side is what a call site writes and
 * its `Encoded` side is the `parameters` record of the request. The static
 * type of the arguments is simply `typeof Model.Arguments.Type`.
 *
 * The compiler accepts only tags an action parameter can have, so a `byte` or
 * a query-only `set` is rejected as a parameter. An argument that names no
 * parameter is a compile error where the arguments are written; a record that
 * arrives untyped has such keys dropped, as every struct does.
 * `Client.applyAction`, `Client.applyActionWithEdits` and
 * `Client.validateAction` take the model.
 *
 * **Example** (Define an action and write its arguments)
 *
 * ```ts import.meta.vitest name="Define an action and write its arguments"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: {},
 * })
 * const Promote = Model.action({
 *   apiName: "promoteEmployeeObject",
 *   parameters: {
 *     employee: Model.requiredParameter(Model.objectReference(Employee)),
 *     newTitle: Model.requiredParameter(Model.string),
 *     newCompensation: Model.optionalParameter(Model.double),
 *   },
 * })
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(Promote.Arguments)({ employee: 50030, newTitle: "Director", newCompensation: O.none() })
 * )
 * wire // => { employee: 50030, newTitle: "Director", newCompensation: null }
 * ```
 *
 * @param definition - The action type's name and parameter specs.
 * @category constructors
 * @since 0.0.0
 */
export const action = <
  const ApiName extends string,
  const Specs extends Readonly<Record<string, ParameterSpec<ActionParameterTypeKind>>>,
>(
  definition: ActionModelDefinition<ApiName, Specs>
) => {
  const { apiName, parameters } = definition;
  const identifier: string = apiName;
  const Arguments = S.Struct(argumentsOf<Specs>(parameters)).pipe(
    $I.annoteSchema(`${identifier}Arguments`, {
      description: `The arguments of one application of the ${identifier} action, keyed by parameter.`,
    })
  );
  return { apiName, parameters, Arguments };
};

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

const parameterField = ParameterId.annotateKey({ description: "The parameter the finding is about." });
const placeField = S.Option(ParameterId).annotateKey({
  description: "The parameter the finding is about; none when it is about what a query returns.",
});
const pathField = S.Array(TypePathStep).annotateKey({
  description: "Steps from the declared type down to the place that disagrees; empty for the type itself.",
});

/**
 * The served action type has another API name than the model declares.
 *
 * @category models
 * @since 0.0.0
 */
export class ActionNameMismatch extends S.Opaque<ActionNameMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("actionNameMismatch"),
    declared: ActionTypeApiName.annotateKey({ description: "API name the model declares." }),
    served: ActionTypeApiName.annotateKey({ description: "API name of the served action type." }),
  }).pipe(
    $I.annoteSchema("ActionNameMismatch", {
      description: "The served action type has another API name than the model declares.",
    })
  )
) {}

/**
 * The model declares a parameter the served action or query type does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class MissingParameter extends S.Opaque<MissingParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("missingParameter"),
    parameter: parameterField,
  }).pipe(
    $I.annoteSchema("MissingParameter", {
      description: "The model declares a parameter the served action or query type does not have.",
    })
  )
) {}

/**
 * The served type requires a parameter the model does not declare, so no typed request can supply it.
 *
 * @category models
 * @since 0.0.0
 */
export class UndeclaredRequiredParameter extends S.Opaque<
  UndeclaredRequiredParameter,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("undeclaredRequiredParameter"),
    parameter: parameterField,
  }).pipe(
    $I.annoteSchema("UndeclaredRequiredParameter", {
      description: "The served type requires a parameter the model does not declare.",
    })
  )
) {}

/**
 * A parameter, or a field of a struct parameter, is required on one side and optional on the other.
 *
 * @category models
 * @since 0.0.0
 */
export class RequiredMismatch extends S.Opaque<RequiredMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("requiredMismatch"),
    parameter: parameterField,
    path: pathField,
    declared: S.Boolean.annotateKey({ description: "Whether the model requires a value at this place." }),
    served: S.Boolean.annotateKey({ description: "Whether the server requires a value at this place." }),
  }).pipe(
    $I.annoteSchema("RequiredMismatch", {
      description: "A parameter, or a field of a struct parameter, is required on one side and optional on the other.",
    })
  )
) {}

/**
 * A parameter, an element, a field or a returned value has another type tag on the server than in the model.
 *
 * @category models
 * @since 0.0.0
 */
export class ValueTagMismatch extends S.Opaque<ValueTagMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("valueTagMismatch"),
    parameter: placeField,
    path: pathField,
    declared: DataTypeKind.annotateKey({ description: "Type tag the model declares at this place." }),
    served: DataTypeKind.annotateKey({ description: "Type tag the server has at this place." }),
  }).pipe(
    $I.annoteSchema("ValueTagMismatch", {
      description: "A parameter, an element, a field or a returned value has another type tag on the server.",
    })
  )
) {}

/**
 * The model declares a struct field the served struct type does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class MissingValueField extends S.Opaque<MissingValueField, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("missingValueField"),
    parameter: placeField,
    path: pathField,
    field: StructFieldApiName.annotateKey({ description: "Field the model declares and the server lacks." }),
  }).pipe(
    $I.annoteSchema("MissingValueField", {
      description: "The model declares a struct field the served struct type does not have.",
    })
  )
) {}

/**
 * A reference ranges over another object type or interface on the server than the model declares.
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceTargetMismatch extends S.Opaque<ReferenceTargetMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("referenceTargetMismatch"),
    parameter: placeField,
    path: pathField,
    declared: ReferenceTarget.annotateKey({ description: "Object type or interface the model declares." }),
    served: ReferenceTarget.annotateKey({ description: "Object type or interface the server states." }),
  }).pipe(
    $I.annoteSchema("ReferenceTargetMismatch", {
      description: "A reference ranges over another object type or interface on the server than the model declares.",
    })
  )
) {}

const ActionFindingKind = LiteralKit([
  "actionNameMismatch",
  "missingParameter",
  "undeclaredRequiredParameter",
  "requiredMismatch",
  "valueTagMismatch",
  "missingValueField",
  "referenceTargetMismatch",
]);

/**
 * One way an action model disagrees with the action type the platform serves.
 *
 * **Details**
 *
 * `valueTagMismatch`, `missingValueField`, `requiredMismatch` and
 * `referenceTargetMismatch` point into a parameter through their `path`: the
 * element of a list, the field of a struct, at any depth.
 *
 * **Example** (Describe an action finding with one exhaustive match)
 *
 * ```ts import.meta.vitest name="Describe an action finding with one exhaustive match"
 * import { ParameterId } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const describe = Model.ActionFinding.match({
 *   actionNameMismatch: ({ served }) => `serves ${served}`,
 *   missingParameter: ({ parameter }) => `no parameter ${parameter}`,
 *   undeclaredRequiredParameter: ({ parameter }) => `${parameter} is required and not declared`,
 *   requiredMismatch: ({ parameter, served }) => `${parameter} is ${served ? "required" : "optional"}`,
 *   valueTagMismatch: ({ declared, served }) => `${served}, not ${declared}`,
 *   missingValueField: ({ field }) => `no field ${field}`,
 *   referenceTargetMismatch: ({ served }) => `refers to ${served}`,
 * })
 * const finding = Model.ActionFinding.cases.requiredMismatch.make({
 *   parameter: ParameterId.make("newTitle"),
 *   path: [],
 *   declared: false,
 *   served: true,
 * })
 * describe(finding) // => "newTitle is required"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActionFinding = ActionFindingKind.mapMembers(() =>
  Tuple.make(
    ActionNameMismatch,
    MissingParameter,
    UndeclaredRequiredParameter,
    RequiredMismatch,
    ValueTagMismatch,
    MissingValueField,
    ReferenceTargetMismatch
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ActionFinding", {
    description: "One way an action model disagrees with the action type the platform serves.",
  })
);

/**
 * Runtime type of {@link ActionFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActionFinding = typeof ActionFinding.Type;

// -----------------------------------------------------------------------------
// The comparison
// -----------------------------------------------------------------------------

type Findings = ReadonlyArray<ActionFinding>;
type Path = ReadonlyArray<TypePathStep>;

const none: Findings = A.empty();

const unless = (agree: boolean, finding: () => ActionFinding): Findings => (agree ? none : A.of(finding()));

// What a served type says at one place, in the terms a spec states them. Parameters and the fields of
// a struct parameter are drawn from two universes; both are read into this one view.
interface ServedType {
  readonly kind: DataTypeKind;
  readonly element: O.Option<ServedType>;
  readonly fields: ReadonlyArray<ServedField>;
  readonly target: O.Option<ReferenceTarget>;
}

interface ServedField {
  readonly name: StructFieldApiName;
  readonly required: boolean;
  readonly fieldType: ServedType;
}

const servedLeaf = (kind: DataTypeKind): ServedType => ({
  kind,
  element: O.none(),
  fields: A.empty(),
  target: O.none(),
});

const servedStruct = ({ fields }: StructParameterType): ServedType => ({
  ...servedLeaf("struct"),
  fields: A.map(fields, ({ name, fieldType, required }) => ({
    name,
    required,
    fieldType: servedFieldType(fieldType),
  })),
});

const servedFieldType: (dataType: OntologyDataType) => ServedType = OntologyDataType.matchOrElse(
  {
    array: ({ elementType }) => ({ ...servedLeaf("array"), element: O.some(servedFieldType(elementType)) }),
    set: ({ elementType }) => ({ ...servedLeaf("set"), element: O.some(servedFieldType(elementType)) }),
    struct: servedStruct,
    object: ({ objectTypeApiName }) => ({ ...servedLeaf("object"), target: O.some(objectTypeApiName) }),
    objectSet: ({ objectTypeApiName }) => ({ ...servedLeaf("objectSet"), target: objectTypeApiName }),
  },
  ({ type }) => servedLeaf(type)
);

const servedParameterType: (dataType: ActionParameterType) => ServedType = ActionParameterType.matchOrElse(
  {
    array: ({ elementType }) => ({ ...servedLeaf("array"), element: O.some(servedParameterType(elementType)) }),
    struct: servedStruct,
    object: ({ objectTypeApiName }) => ({ ...servedLeaf("object"), target: O.some(objectTypeApiName) }),
    objectSet: ({ objectTypeApiName }) => ({ ...servedLeaf("objectSet"), target: objectTypeApiName }),
    interfaceObject: ({ interfaceTypeApiName }) => ({
      ...servedLeaf("interfaceObject"),
      target: interfaceTypeApiName,
    }),
  },
  ({ type }) => servedLeaf(type)
);

// A field declared nullable is one the model does not require; what it wraps is what is compared.
const declaredField = (field: ValueSpec): { readonly required: boolean; readonly spec: ValueSpec } =>
  field.shape.type === "nullable" ? { required: false, spec: field.shape.inner } : { required: true, spec: field };

// Compares one spec with the served type at the same place: first by tag, then through what the spec
// nests. A served type the spec says nothing about (the target of an untyped reference, a field the
// model does not declare) has nothing to disagree with.
const compareValue = (parameter: ParameterId, path: Path, declared: ValueSpec, served: ServedType): Findings =>
  declared.kind === served.kind
    ? pipe(
        Match.value(declared.shape),
        Match.discriminatorsExhaustive("type")({
          leaf: () => none,
          vector: () => none,
          list: ({ element }) =>
            O.match(served.element, {
              onNone: () => none,
              onSome: (servedElement) =>
                compareValue(parameter, A.append(path, ElementStep.make({})), element, servedElement),
            }),
          struct: ({ fields }) =>
            A.flatMap(R.toEntries(fields), ([name, field]) =>
              pipe(
                A.findFirst(served.fields, (servedField) => servedField.name === name),
                O.match({
                  onNone: (): Findings =>
                    A.of(
                      MissingValueField.make({
                        parameter: O.some(parameter),
                        path,
                        field: StructFieldApiName.make(name),
                      })
                    ),
                  onSome: (servedField) => {
                    const fieldPath = A.append(path, FieldStep.make({ name: servedField.name }));
                    const { required, spec: fieldSpec } = declaredField(field);
                    return A.appendAll(
                      unless(required === servedField.required, () =>
                        RequiredMismatch.make({
                          parameter,
                          path: fieldPath,
                          declared: required,
                          served: servedField.required,
                        })
                      ),
                      compareValue(parameter, fieldPath, fieldSpec, servedField.fieldType)
                    );
                  },
                })
              )
            ),
          entries: () => none,
          nullable: () => none,
          union: () => none,
          reference: ({ target }) =>
            pipe(
              O.all({ declaredTarget: target, servedTarget: served.target }),
              O.match({
                onNone: () => none,
                onSome: ({ declaredTarget, servedTarget }) =>
                  unless(declaredTarget === servedTarget, () =>
                    ReferenceTargetMismatch.make({
                      parameter: O.some(parameter),
                      path,
                      declared: declaredTarget,
                      served: servedTarget,
                    })
                  ),
              })
            ),
        })
      )
    : A.of(ValueTagMismatch.make({ parameter: O.some(parameter), path, declared: declared.kind, served: served.kind }));

/**
 * Every way an action model disagrees with a served action type; empty when the model conforms.
 *
 * **Details**
 *
 * The comparison covers what a request relies on:
 *
 * - the action type's API name;
 * - each declared parameter: that it exists, is required exactly when the
 *   server requires it, and has the same type tag, looking through lists to
 *   their element and through structs to each declared field, and that a
 *   reference ranges over the declared object type or interface;
 * - each served parameter the model does not declare: a finding when the
 *   server requires it, because no typed request could then be accepted.
 *
 * An optional parameter the model leaves out is fine: a request simply never
 * supplies it.
 *
 * **Example** (Catch a parameter that became required)
 *
 * ```ts import.meta.vitest name="Catch a parameter that became required"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionType } from "@beep/scratchpad/osdk/src/Action/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Promote = Model.action({
 *   apiName: "promoteEmployee",
 *   parameters: {
 *     employeeId: Model.requiredParameter(Model.integer),
 *     newTitle: Model.optionalParameter(Model.string),
 *     effectiveOn: Model.optionalParameter(Model.date),
 *   },
 * })
 * const served = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionType)({
 *     apiName: "promoteEmployee",
 *     rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
 *     status: "ACTIVE",
 *     parameters: {
 *       employeeId: { displayName: "Employee ID", dataType: { type: "string" }, required: true, typeClasses: [] },
 *       newTitle: { displayName: "New Title", dataType: { type: "string" }, required: true, typeClasses: [] },
 *       approver: { displayName: "Approver", dataType: { type: "string" }, required: true, typeClasses: [] },
 *     },
 *     operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
 *   })
 * )
 * const findings = A.map(Model.actionConformance(Promote, served), (finding) => finding.type)
 * findings // => ["valueTagMismatch", "requiredMismatch", "missingParameter", "undeclaredRequiredParameter"]
 * ```
 *
 * @throws When the model declares an empty action, parameter or struct field name that has to be reported.
 * @category policies
 * @since 0.0.0
 */
export const actionConformance: {
  (
    actionType: ActionType
  ): (model: {
    readonly apiName: string;
    readonly parameters: Readonly<Record<string, ParameterSpec>>;
  }) => ReadonlyArray<ActionFinding>;
  (
    model: { readonly apiName: string; readonly parameters: Readonly<Record<string, ParameterSpec>> },
    actionType: ActionType
  ): ReadonlyArray<ActionFinding>;
} = dual(
  2,
  (
    model: { readonly apiName: string; readonly parameters: Readonly<Record<string, ParameterSpec>> },
    actionType: ActionType
  ): ReadonlyArray<ActionFinding> =>
    A.flatten([
      unless(actionType.apiName === model.apiName, () =>
        ActionNameMismatch.make({ declared: ActionTypeApiName.make(model.apiName), served: actionType.apiName })
      ),
      A.flatMap(R.toEntries(model.parameters), ([name, declared]) =>
        pipe(
          R.findFirst(actionType.parameters, (_, key) => key === name),
          O.match({
            onNone: (): Findings => A.of(MissingParameter.make({ parameter: ParameterId.make(name) })),
            onSome: ([parameter, served]) =>
              A.appendAll(
                compareValue(parameter, A.empty(), declared, servedParameterType(served.dataType)),
                unless((declared.presence === "required") === served.required, () =>
                  RequiredMismatch.make({
                    parameter,
                    path: A.empty(),
                    declared: declared.presence === "required",
                    served: served.required,
                  })
                )
              ),
          })
        )
      ),
      A.flatMap(R.toEntries(actionType.parameters), ([parameter, served]) =>
        unless(!served.required || R.has(model.parameters, parameter), () =>
          UndeclaredRequiredParameter.make({ parameter })
        )
      ),
    ])
);
