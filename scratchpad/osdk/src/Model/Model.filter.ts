/**
 * Typed filter constructors: the operators a property admits, decided by the compiler from its reference.
 *
 * **Details**
 *
 * OSDK types `where({ fullName: { $startsWith: "A" } })` with a forest of
 * conditional types that maps every property definition to a filter record.
 * Here a filter is built from a {@link PropertyReference}, which already
 * carries the property's tag and value codec, so each constructor states its
 * requirements as ordinary parameter types:
 *
 * - the tags it accepts, as the `Type` of a tag family (a pick of the property
 *   tag kit such as {@link OrderedKind});
 * - its operand, as the `Type` of the reference's own value codec.
 *
 * A wrong tag or a wrong operand is then a plain "not assignable" error, and
 * the families are data: {@link familyKinds} and {@link familyOperators} say
 * which operators the typed layer admits for which tag, and a test holds them
 * to the untyped policy table.
 *
 * This is the tier that knows the property's type, so it is the tier that
 * takes the rich operand: a `LocalDate` for a date property, a `bigint` for a
 * long, a `BigDecimal` for a decimal, a `DateTime.Utc` for a timestamp. A
 * plain filter holds the wire scalar, so a constructor encodes its operand
 * with the reference's own codec, the one that decodes the property, and hands
 * the result to its untyped twin in the filter module. The same codec reads it
 * back: `operandCodec` of the property's type.
 *
 * A typed filter also remembers which model it is about. A constructor returns
 * the plain filter inside a {@link TypedFilter}: the pair of the filter and
 * the API name of the model that issued the reference. {@link and}, {@link or}
 * and {@link not} combine typed filters of one model, and `Model.where`
 * accepts only a filter whose owner is the model of the set. The wire never
 * sees the pair: a request carries `typed.filter`, the value the untyped
 * constructor builds from the same wire scalar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { GeospatialKind, PropertyTypeKind, TemporalKind } from "../DataType/DataType.values.ts";
import * as Filter from "../Filter/Filter.behavior.ts";
import type {
  And,
  Contains,
  IsNull,
  Not,
  ObjectFilter,
  OneOf,
  Or,
  RelatesToGeometry,
  SearchGeometry,
  SpatialRelation,
} from "../Filter/Filter.model.ts";
import type { PropertyOperator } from "../Filter/Filter.policy.ts";
import type { ScalarValue } from "../Value/Value.model.ts";
import type { PropertyReference } from "./Model.object.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.filter");

// -----------------------------------------------------------------------------
// Tag families
// -----------------------------------------------------------------------------

/**
 * Tags whose values can be tested for equality with a value of their own type.
 *
 * **Details**
 *
 * These are the tags whose value is one scalar: booleans, the seven numeric
 * tags, text, dates, instants and markings. The untyped policy also lets the
 * reference-valued tags (attachments, media, series, vectors, cipher text) be
 * compared, with a text operand inherited from OSDK's fallback filter; the
 * typed layer leaves them out because no value of their own type is a
 * comparison operand.
 *
 * **Example** (Tell an equatable tag from a composite one)
 *
 * ```ts import.meta.vitest name="Tell an equatable tag from a composite one"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const isEquatable = S.is(Model.EquatableKind)
 * const verdicts = [isEquatable("marking"), isEquatable("struct"), Model.EquatableKind.literals.length]
 * verdicts // => [true, false, 12]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EquatableKind = PropertyTypeKind.pick([
  "boolean",
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
  "marking",
]).pipe(
  $I.annoteSchema("EquatableKind", {
    description: "Type tags whose values can be tested for equality with a value of their own type.",
  })
);

/**
 * Runtime type of {@link EquatableKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type EquatableKind = typeof EquatableKind.Type;

/**
 * Tags whose values have an order, so they admit less-than and greater-than.
 *
 * **Example** (Booleans and markings have no order)
 *
 * ```ts import.meta.vitest name="Booleans and markings have no order"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const isOrdered = S.is(Model.OrderedKind)
 * const verdicts = [isOrdered("short"), isOrdered("timestamp"), isOrdered("boolean"), isOrdered("marking")]
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OrderedKind = PropertyTypeKind.pick([
  "byte",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "string",
  "date",
  "timestamp",
]).pipe(
  $I.annoteSchema("OrderedKind", {
    description: "Type tags whose values have an order: numbers, text, dates and instants.",
  })
);

/**
 * Runtime type of {@link OrderedKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type OrderedKind = typeof OrderedKind.Type;

/**
 * Tags whose values are searchable text.
 *
 * **Example** (Only strings are searchable text)
 *
 * ```ts import.meta.vitest name="Only strings are searchable text"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * Model.TextKind.literals // => ["string"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextKind = PropertyTypeKind.pick(["string"]).pipe(
  $I.annoteSchema("TextKind", { description: "Type tags whose values are searchable text." })
);

/**
 * Runtime type of {@link TextKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type TextKind = typeof TextKind.Type;

/**
 * Tags whose values are lists, so they admit a test for one element.
 *
 * **Example** (Only arrays hold elements)
 *
 * ```ts import.meta.vitest name="Only arrays hold elements"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * Model.ArrayKind.literals // => ["array"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArrayKind = PropertyTypeKind.pick(["array"]).pipe(
  $I.annoteSchema("ArrayKind", { description: "Type tags whose values are lists of elements." })
);

/**
 * Runtime type of {@link ArrayKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayKind = typeof ArrayKind.Type;

/**
 * The tag families the typed constructors are grouped by.
 *
 * **Details**
 *
 * `nullable` is every tag (any property can be absent). `temporal` and
 * `geospatial` are the kernel's own families of those names; the others are
 * {@link EquatableKind}, {@link OrderedKind}, {@link TextKind} and
 * {@link ArrayKind}.
 *
 * **Example** (List the operator families)
 *
 * ```ts import.meta.vitest name="List the operator families"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * Model.OperatorFamily.literals // => ["nullable", "equatable", "ordered", "text", "temporal", "geospatial", "array"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OperatorFamily = LiteralKit([
  "nullable",
  "equatable",
  "ordered",
  "text",
  "temporal",
  "geospatial",
  "array",
]).pipe(
  $I.annoteSchema("OperatorFamily", {
    description: "The tag families the typed filter constructors are grouped by.",
  })
);

/**
 * Runtime type of {@link OperatorFamily}.
 *
 * @category models
 * @since 0.0.0
 */
export type OperatorFamily = typeof OperatorFamily.Type;

/**
 * The tags of each family: which properties a family's constructors accept.
 *
 * **Example** (Read the tags of a family)
 *
 * ```ts import.meta.vitest name="Read the tags of a family"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const rows = [Model.familyKinds.temporal, Model.familyKinds.geospatial, Model.familyKinds.nullable.length]
 * rows // => [["date", "timestamp"], ["geopoint", "geoshape"], 22]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const familyKinds: { readonly [Family in OperatorFamily]: ReadonlyArray<PropertyTypeKind> } = {
  nullable: PropertyTypeKind.literals,
  equatable: EquatableKind.literals,
  ordered: OrderedKind.literals,
  text: TextKind.literals,
  temporal: TemporalKind.literals,
  geospatial: GeospatialKind.literals,
  array: ArrayKind.literals,
};

/**
 * The wire operators each family's constructors emit.
 *
 * **Details**
 *
 * `ne` has no operator of its own: the wire has none, so it emits `eq` under
 * a `not`.
 *
 * **Example** (Read the operators of a family)
 *
 * ```ts import.meta.vitest name="Read the operators of a family"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const rows = [Model.familyOperators.equatable, Model.familyOperators.ordered, Model.familyOperators.array]
 * rows // => [["eq", "in"], ["lt", "gt", "lte", "gte"], ["contains"]]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const familyOperators: { readonly [Family in OperatorFamily]: ReadonlyArray<PropertyOperator> } = {
  nullable: ["isNull"],
  equatable: ["eq", "in"],
  ordered: ["lt", "gt", "lte", "gte"],
  text: [
    "startsWith",
    "wildcard",
    "regex",
    "containsAnyTerm",
    "containsAllTerms",
    "containsAllTermsInOrder",
    "containsAllTermsInOrderPrefixLastTerm",
    "interval",
  ],
  temporal: ["relativeDateRange"],
  geospatial: [
    "withinDistanceOf",
    "withinBoundingBox",
    "withinPolygon",
    "intersectsBoundingBox",
    "intersectsPolygon",
    "doesNotIntersectBoundingBox",
    "doesNotIntersectPolygon",
    "geoShapeV2",
  ],
  array: ["contains"],
};

/**
 * The wire operators the typed constructors can emit for a property of the given tag.
 *
 * **Details**
 *
 * This is the union of {@link familyOperators} over the families the tag
 * belongs to. For every tag it is a subset of the untyped policy's row, and it
 * equals that row except on the reference-valued tags, where the policy's text
 * comparisons have no typed twin (see {@link EquatableKind}).
 *
 * **Example** (Look up the typed operators of a tag)
 *
 * ```ts import.meta.vitest name="Look up the typed operators of a tag"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const rows = [Model.typedOperators("boolean"), Model.typedOperators("geopoint").length, Model.typedOperators("struct")]
 * rows // => [["isNull", "eq", "in"], 9, ["isNull"]]
 * ```
 *
 * @param kind - The property type tag.
 * @category policies
 * @since 0.0.0
 */
export const typedOperators = (kind: PropertyTypeKind): ReadonlyArray<PropertyOperator> =>
  A.flatMap(OperatorFamily.literals, (family) =>
    A.contains(familyKinds[family], kind) ? familyOperators[family] : A.empty<PropertyOperator>()
  );

// -----------------------------------------------------------------------------
// The typed filter
// -----------------------------------------------------------------------------

/**
 * A filter together with the API name of the model whose properties it tests.
 *
 * **Details**
 *
 * The typed constructors return this pair instead of a bare filter, so a
 * filter keeps knowing which model it was built from. `owner` is copied from
 * the property reference, which got it from the model that issued it; it is a
 * literal in the type and the same text at run time, not a phantom parameter.
 * `filter` is the plain filter a request carries: encode `typed.filter`, or
 * hand the pair to `Model.where`, which unwraps it after the compiler has
 * checked that the owner is the model of the set.
 *
 * The pair is also the seam to the untyped filter module: to bring a plain
 * filter into the typed layer, write `{ owner, filter }` yourself. That line
 * is where you vouch that every property the filter names belongs to that
 * model; nothing checks it for you.
 *
 * The checks compare literals, so they hold as long as the literal is kept. A
 * filter annotated with the bare `TypedFilter`, whose owner is any `string`,
 * no longer says which model it is about and is accepted by every set.
 *
 * @typeParam Owner - API name of the model the filter is about.
 * @typeParam Shape - The filter's own case of the filter union.
 * @category models
 * @since 0.0.0
 */
export interface TypedFilter<Owner extends string = string, Shape extends ObjectFilter = ObjectFilter> {
  readonly owner: Owner;
  readonly filter: Shape;
}

// -----------------------------------------------------------------------------
// The two call shapes
// -----------------------------------------------------------------------------

// A codec whose wire form is one comparison operand and that needs no service to write it. Bounding
// the reference's codec by it is what lets a constructor take its operand as `Value["Type"]` and write
// the wire scalar with the property's own codec, without an assertion.
type OperandCodec = S.Codec<unknown, ScalarValue>;

// The codec of a list whose elements are comparison operands.
type OperandArrayCodec = S.$Array<OperandCodec>;

// Writes a typed operand as the wire scalar a plain filter carries. A value the codec refuses (an
// integer past the 32-bit range, a 30th of February) is not a value of the property's type: it fails
// the way `X.make` fails on input its schema refuses, by throwing. What is thrown is the codec's own
// schema error, with the property's name as the path of its issue.
const wireOperand = <Codec extends OperandCodec>(property: string, codec: Codec, operand: Codec["Type"]): ScalarValue =>
  Result.getOrThrowWith(
    S.encodeResult(codec)(operand),
    ({ issue }) => new S.SchemaError(new SchemaIssue.Pointer([property], issue))
  );

// Operators whose operand does not depend on the property's value type: text patterns, date ranges, areas.
// Nothing about the operand waits for the reference, so the data-last shape is generic in the reference's
// owner and works with or without a pipeline around it.
const withOperand =
  <Kind extends PropertyTypeKind>() =>
  <Operand, Shape extends ObjectFilter>(
    make: (property: string, operand: Operand) => Shape
  ): {
    (
      operand: Operand
    ): <Owner extends string>(reference: PropertyReference<string, Kind, S.Top, Owner>) => TypedFilter<Owner, Shape>;
    <Owner extends string>(
      reference: PropertyReference<string, Kind, S.Top, Owner>,
      operand: Operand
    ): TypedFilter<Owner, Shape>;
  } =>
    dual(
      2,
      <Owner extends string>(
        reference: PropertyReference<string, Kind, S.Top, Owner>,
        operand: Operand
      ): TypedFilter<Owner, Shape> => ({ owner: reference.owner, filter: make(reference.name, operand) })
    );

// Operators whose operand is one value of the property's own type.
//
// Data-first, `Value` and `Owner` are inferred from the reference and the operand is checked against
// `Value`. Data-last there is no reference yet, so both can only come from the call's surroundings: in
// a pipeline the compiler infers them from the reference being piped. Without such a context they fall
// to their default, `never`, which rejects every operand instead of silently accepting any scalar. The
// data-first signature repeats the defaults only so the two shapes stay mirror images of each other.
const withValue =
  <Kind extends PropertyTypeKind>() =>
  <Shape extends ObjectFilter>(
    make: (property: string, operand: ScalarValue) => Shape
  ): {
    <Value extends OperandCodec = never, Owner extends string = never>(
      operand: Value["Type"]
    ): (reference: PropertyReference<string, Kind, Value, Owner>) => TypedFilter<Owner, Shape>;
    <Value extends OperandCodec = never, Owner extends string = never>(
      reference: PropertyReference<string, Kind, Value, Owner>,
      operand: Value["Type"]
    ): TypedFilter<Owner, Shape>;
  } =>
    dual(
      2,
      <Value extends OperandCodec, Owner extends string>(
        reference: PropertyReference<string, Kind, Value, Owner>,
        operand: Value["Type"]
      ): TypedFilter<Owner, Shape> => ({
        owner: reference.owner,
        filter: make(reference.name, wireOperand(reference.name, reference.value, operand)),
      })
    );

// -----------------------------------------------------------------------------
// Presence
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose property has no value. Every property admits it.
 *
 * **Example** (Find employees without a name)
 *
 * ```ts import.meta.vitest name="Find employees without a name"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
 *   links: {},
 * })
 * const unnamed = Model.isNull(Employee.property("fullName"))
 * const parts = [unnamed.owner, unnamed.filter.type, unnamed.filter.value]
 * parts // => ["Employee", "isNull", true]
 * ```
 *
 * @param reference - The property to test.
 * @category constructors
 * @since 0.0.0
 */
export const isNull = <Owner extends string>(
  reference: PropertyReference<string, PropertyTypeKind, S.Top, Owner>
): TypedFilter<Owner, IsNull> => ({ owner: reference.owner, filter: Filter.isNull(reference.name) });

/**
 * Filter for objects whose property has a value. Every property admits it.
 *
 * **Example** (Find employees with skills on record)
 *
 * ```ts import.meta.vitest name="Find employees with skills on record"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), skills: Model.array(Model.string) },
 *   links: {},
 * })
 * const skilled = Model.isNotNull(Employee.property("skills"))
 * const parts = [skilled.filter.type, skilled.filter.value]
 * parts // => ["isNull", false]
 * ```
 *
 * @param reference - The property to test.
 * @category constructors
 * @since 0.0.0
 */
export const isNotNull = <Owner extends string>(
  reference: PropertyReference<string, PropertyTypeKind, S.Top, Owner>
): TypedFilter<Owner, IsNull> => ({ owner: reference.owner, filter: Filter.isNotNull(reference.name) });

// -----------------------------------------------------------------------------
// Equality and membership
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose property equals a value of the property's own type.
 *
 * **Details**
 *
 * The reference must have an {@link EquatableKind} tag. The operand has the
 * type the property decodes to: text for a string, a `bigint` for a long, a
 * calendar date for a date. In a pipeline the operand is checked against the
 * reference being piped. The filter holds the operand as the property's codec
 * writes it for the wire: a `bigint` as its decimal text, a date as
 * `YYYY-MM-DD`.
 *
 * **Gotchas**
 *
 * The static type of an operand is wider than the property's values where the
 * codec checks a range: a `number` typed operand of an integer property can be
 * past 32 bits. Such an operand is refused when the filter is built, by
 * throwing, as `X.make` refuses input its schema rejects. The error is the
 * `SchemaError` of the property's codec, and the path of its issue is the
 * property's name. This holds for every constructor that takes a value of the
 * property's own type.
 *
 * **Example** (Compare each property with a value of its own type)
 *
 * ```ts import.meta.vitest name="Compare each property with a value of its own type"
 * import { pipe } from "effect/Function"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string, badge: Model.long },
 *   links: {},
 * })
 * const byName = Model.eq(Employee.property("fullName"), "John Doe")
 * const byBadge = pipe(Employee.property("badge"), Model.eq(BigInt("9007199254740993")))
 * const parts = [byName.filter.type, byName.filter.value, byBadge.filter.value]
 * parts // => ["eq", "John Doe", "9007199254740993"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const eq = withValue<EquatableKind>()(Filter.eq);

/**
 * Filter for objects whose property differs from a value of the property's own type.
 *
 * **Details**
 *
 * The wire has no inequality operator, so the result is `eq` under a `not`.
 *
 * **Example** (Exclude one office)
 *
 * ```ts import.meta.vitest name="Exclude one office"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), office: Model.string },
 *   links: {},
 * })
 * const elsewhere = Model.ne(Employee.property("office"), "Seattle")
 * const parts = [elsewhere.filter.type, elsewhere.filter.filter.type]
 * parts // => ["not", "eq"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const ne = withValue<EquatableKind>()(Filter.ne);

/**
 * Filter for objects whose property equals one of the listed values of the property's own type.
 *
 * **Example** (Keep three employees by key)
 *
 * ```ts import.meta.vitest name="Keep three employees by key"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer) },
 *   links: {},
 * })
 * const chosen = Model.oneOf(Employee.property("employeeId"), [50030, 50031, 50032])
 * const parts = [chosen.filter.type, chosen.filter.value]
 * parts // => ["in", [50030, 50031, 50032]]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when an operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const oneOf: {
  <Value extends OperandCodec = never, Owner extends string = never>(
    operands: ReadonlyArray<Value["Type"]>
  ): (reference: PropertyReference<string, EquatableKind, Value, Owner>) => TypedFilter<Owner, OneOf>;
  <Value extends OperandCodec = never, Owner extends string = never>(
    reference: PropertyReference<string, EquatableKind, Value, Owner>,
    operands: ReadonlyArray<Value["Type"]>
  ): TypedFilter<Owner, OneOf>;
} = dual(
  2,
  <Value extends OperandCodec, Owner extends string>(
    reference: PropertyReference<string, EquatableKind, Value, Owner>,
    operands: ReadonlyArray<Value["Type"]>
  ): TypedFilter<Owner, OneOf> => ({
    owner: reference.owner,
    filter: Filter.oneOf(
      reference.name,
      A.map(operands, (operand) => wireOperand(reference.name, reference.value, operand))
    ),
  })
);

/**
 * Filter for objects whose array property holds a value of the array's element type.
 *
 * **Details**
 *
 * The reference must be an array whose elements are scalars; the operand is
 * one element, not a list, and it is written with the element's codec.
 *
 * **Example** (Find employees with one skill)
 *
 * ```ts import.meta.vitest name="Find employees with one skill"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), skills: Model.array(Model.string) },
 *   links: {},
 * })
 * const sailors = Model.contains(Employee.property("skills"), "sailing")
 * const parts = [sailors.filter.type, sailors.filter.value]
 * parts // => ["contains", "sailing"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the element type.
 * @category constructors
 * @since 0.0.0
 */
export const contains: {
  <Value extends OperandArrayCodec = never, Owner extends string = never>(
    element: Value["value"]["Type"]
  ): (reference: PropertyReference<string, ArrayKind, Value, Owner>) => TypedFilter<Owner, Contains>;
  <Value extends OperandArrayCodec = never, Owner extends string = never>(
    reference: PropertyReference<string, ArrayKind, Value, Owner>,
    element: Value["value"]["Type"]
  ): TypedFilter<Owner, Contains>;
} = dual(
  2,
  <Value extends OperandArrayCodec, Owner extends string>(
    reference: PropertyReference<string, ArrayKind, Value, Owner>,
    element: Value["value"]["Type"]
  ): TypedFilter<Owner, Contains> => ({
    owner: reference.owner,
    filter: Filter.contains(reference.name, wireOperand(reference.name, reference.value.value, element)),
  })
);

// -----------------------------------------------------------------------------
// Order
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose property is greater than a value of the property's own type.
 *
 * **Details**
 *
 * The reference must have an {@link OrderedKind} tag.
 *
 * **Example** (Keep employees who started after a date)
 *
 * ```ts import.meta.vitest name="Keep employees who started after a date"
 * import { LocalDate } from "@beep/schema/LocalDate"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), startDate: Model.date },
 *   links: {},
 * })
 * const cutoff = LocalDate.make({ year: 2020, month: 1, day: 1 })
 * const recent = Model.gt(Employee.property("startDate"), cutoff)
 * const parts = [recent.filter.type, recent.filter.value]
 * parts // => ["gt", "2020-01-01"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const gt = withValue<OrderedKind>()(Filter.gt);

/**
 * Filter for objects whose property is greater than or equal to a value of the property's own type.
 *
 * **Example** (Keep adults)
 *
 * ```ts import.meta.vitest name="Keep adults"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Person = Model.object({
 *   apiName: "Person",
 *   primaryKey: "personId",
 *   properties: { personId: Model.required(Model.string), age: Model.short },
 *   links: {},
 * })
 * const adults = Model.gte(Person.property("age"), 18)
 * const parts = [adults.filter.type, adults.filter.value]
 * parts // => ["gte", 18]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const gte = withValue<OrderedKind>()(Filter.gte);

/**
 * Filter for objects whose property is less than a value of the property's own type.
 *
 * **Example** (Keep names before M in a pipeline)
 *
 * ```ts import.meta.vitest name="Keep names before M in a pipeline"
 * import { pipe } from "effect/Function"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Person = Model.object({
 *   apiName: "Person",
 *   primaryKey: "personId",
 *   properties: { personId: Model.required(Model.string), fullName: Model.string },
 *   links: {},
 * })
 * const early = pipe(Person.property("fullName"), Model.lt("M"))
 * const parts = [early.filter.type, early.filter.value]
 * parts // => ["lt", "M"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const lt = withValue<OrderedKind>()(Filter.lt);

/**
 * Filter for objects whose property is less than or equal to a value of the property's own type.
 *
 * **Example** (Cap a decimal price and keep its scale)
 *
 * ```ts import.meta.vitest name="Cap a decimal price and keep its scale"
 * import * as BigDecimal from "effect/BigDecimal"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Product = Model.object({
 *   apiName: "Product",
 *   primaryKey: "sku",
 *   properties: { sku: Model.required(Model.string), price: Model.decimal },
 *   links: {},
 * })
 * const limit = BigDecimal.fromStringUnsafe("12.50")
 * const affordable = Model.lte(Product.property("price"), limit)
 * const parts = [affordable.filter.type, affordable.filter.value]
 * parts // => ["lte", "12.50"]
 * ```
 *
 * @throws A `SchemaError` whose issue points at the property, when the operand is not a value of the property's type.
 * @category constructors
 * @since 0.0.0
 */
export const lte = withValue<OrderedKind>()(Filter.lte);

// -----------------------------------------------------------------------------
// Text search
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose text property holds the terms as a phrase whose last term is a prefix.
 *
 * **Details**
 *
 * The reference must have a {@link TextKind} tag, as for every text search
 * below. The platform keeps this operator as a deprecated alias of
 * {@link containsAllTermsInOrderPrefixLastTerm}.
 *
 * **Example** (Match names by prefix)
 *
 * ```ts import.meta.vitest name="Match names by prefix"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
 *   links: {},
 * })
 * const match = Model.startsWith(Employee.property("fullName"), "John D")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["startsWith", "John D"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const startsWith = withOperand<TextKind>()(Filter.startsWith);

/**
 * Filter for objects whose text property matches a wildcard pattern.
 *
 * **Example** (Match serials by wildcard)
 *
 * ```ts import.meta.vitest name="Match serials by wildcard"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Device = Model.object({
 *   apiName: "Device",
 *   primaryKey: "serial",
 *   properties: { serial: Model.required(Model.string) },
 *   links: {},
 * })
 * const match = Model.matchesWildcard(Device.property("serial"), "PQ-*")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["wildcard", "PQ-*"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesWildcard = withOperand<TextKind>()(Filter.matchesWildcard);

/**
 * Filter for objects whose text property matches a regular expression.
 *
 * **Example** (Match serials by pattern)
 *
 * ```ts import.meta.vitest name="Match serials by pattern"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Device = Model.object({
 *   apiName: "Device",
 *   primaryKey: "serial",
 *   properties: { serial: Model.required(Model.string) },
 *   links: {},
 * })
 * const match = Model.matchesRegex(Device.property("serial"), "PQ-[0-9]+")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["regex", "PQ-[0-9]+"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesRegex = withOperand<TextKind>()(Filter.matchesRegex);

/**
 * Filter for objects whose text property holds at least one of the terms.
 *
 * **Example** (Match any of two words)
 *
 * ```ts import.meta.vitest name="Match any of two words"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Book = Model.object({
 *   apiName: "Book",
 *   primaryKey: "isbn",
 *   properties: { isbn: Model.required(Model.string), title: Model.string },
 *   links: {},
 * })
 * const match = Model.containsAnyTerm(Book.property("title"), "whale ship")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["containsAnyTerm", "whale ship"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAnyTerm = withOperand<TextKind>()(Filter.containsAnyTerm);

/**
 * Filter for objects whose text property holds every one of the terms, in any order.
 *
 * **Example** (Match both words)
 *
 * ```ts import.meta.vitest name="Match both words"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Book = Model.object({
 *   apiName: "Book",
 *   primaryKey: "isbn",
 *   properties: { isbn: Model.required(Model.string), title: Model.string },
 *   links: {},
 * })
 * const match = Model.containsAllTerms(Book.property("title"), "white whale")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["containsAllTerms", "white whale"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTerms = withOperand<TextKind>()(Filter.containsAllTerms);

/**
 * Filter for objects whose text property holds the terms as an exact phrase.
 *
 * **Example** (Match a phrase)
 *
 * ```ts import.meta.vitest name="Match a phrase"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Book = Model.object({
 *   apiName: "Book",
 *   primaryKey: "isbn",
 *   properties: { isbn: Model.required(Model.string), title: Model.string },
 *   links: {},
 * })
 * const match = Model.containsAllTermsInOrder(Book.property("title"), "the white whale")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["containsAllTermsInOrder", "the white whale"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTermsInOrder = withOperand<TextKind>()(Filter.containsAllTermsInOrder);

/**
 * Filter for objects whose text property holds the terms as a phrase whose last term is a prefix.
 *
 * **Example** (Match a phrase as it is typed)
 *
 * ```ts import.meta.vitest name="Match a phrase as it is typed"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Book = Model.object({
 *   apiName: "Book",
 *   primaryKey: "isbn",
 *   properties: { isbn: Model.required(Model.string), title: Model.string },
 *   links: {},
 * })
 * const match = Model.containsAllTermsInOrderPrefixLastTerm(Book.property("title"), "moby di")
 * const parts = [match.filter.type, match.filter.value]
 * parts // => ["containsAllTermsInOrderPrefixLastTerm", "moby di"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const containsAllTermsInOrderPrefixLastTerm = withOperand<TextKind>()(
  Filter.containsAllTermsInOrderPrefixLastTerm
);

/**
 * Filter for objects whose text property satisfies a positional interval rule.
 *
 * **Example** (Match two terms at most one position apart in a biography)
 *
 * ```ts import.meta.vitest name="Match two terms at most one position apart in a biography"
 * import * as O from "effect/Option"
 * import { IntervalMatch } from "@beep/scratchpad/osdk/src/Filter/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Author = Model.object({
 *   apiName: "Author",
 *   primaryKey: "authorId",
 *   properties: { authorId: Model.required(Model.string), bio: Model.string },
 *   links: {},
 * })
 * const rule = IntervalMatch.make({ query: "quick fox", ordered: true, maxGaps: O.some(1) })
 * const near = Model.matchesInterval(Author.property("bio"), rule)
 * const parts = [near.filter.type, near.filter.rule.type]
 * parts // => ["interval", "match"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const matchesInterval = withOperand<TextKind>()(Filter.matchesInterval);

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose date or timestamp property falls in a range that moves with the clock.
 *
 * **Details**
 *
 * The reference must have a temporal tag: `date` or `timestamp`.
 *
 * **Example** (Match hires of the last seven days)
 *
 * ```ts import.meta.vitest name="Match hires of the last seven days"
 * import * as O from "effect/Option"
 * import { RelativeDateRange, RelativePoint } from "@beep/scratchpad/osdk/src/Filter/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), hiredAt: Model.timestamp },
 *   links: {},
 * })
 * const lastWeek = RelativeDateRange.make({
 *   relativeStartTime: O.some(RelativePoint.make({ value: -7, timeUnit: "day" })),
 *   timeZoneId: "UTC",
 * })
 * const recent = Model.inRelativeDateRange(Employee.property("hiredAt"), lastWeek)
 * const parts = [recent.filter.type, recent.filter.timeZoneId]
 * parts // => ["relativeDateRange", "UTC"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const inRelativeDateRange = withOperand<TemporalKind>()(Filter.inRelativeDateRange);

// -----------------------------------------------------------------------------
// Geospatial
// -----------------------------------------------------------------------------

/**
 * Filter for objects whose point lies within a distance of a center point.
 *
 * **Details**
 *
 * The reference must have a geospatial tag, `geopoint` or `geoshape`, as for
 * every predicate below.
 *
 * **Example** (Match offices within five kilometres)
 *
 * ```ts import.meta.vitest name="Match offices within five kilometres"
 * import { CircularArea } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { Distance } from "@beep/scratchpad/osdk/src/Geo/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), entrance: Model.geopoint },
 *   links: {},
 * })
 * const area = CircularArea.around([-122.33, 47.61], Distance.kilometers(5))
 * const nearby = Model.withinDistance(Office.property("entrance"), area)
 * const parts = [nearby.filter.type, nearby.filter.value.center.coordinates]
 * parts // => ["withinDistanceOf", [-122.33, 47.61]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinDistance = withOperand<GeospatialKind>()(Filter.withinDistance);

/**
 * Filter for objects whose geometry lies inside a rectangle.
 *
 * **Example** (Match offices inside a bounding box)
 *
 * ```ts import.meta.vitest name="Match offices inside a bounding box"
 * import { BoundingBoxCorners } from "@beep/scratchpad/osdk/src/Filter/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), entrance: Model.geopoint },
 *   links: {},
 * })
 * const box = BoundingBoxCorners.fromBoundingBox([-122.5, 47.5, -122.2, 47.7])
 * const inside = Model.withinBoundingBox(Office.property("entrance"), box)
 * const parts = [inside.filter.type, inside.filter.value.topLeft.coordinates]
 * parts // => ["withinBoundingBox", [-122.5, 47.7]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinBoundingBox = withOperand<GeospatialKind>()(Filter.withinBoundingBox);

/**
 * Filter for objects whose geometry lies inside a polygon.
 *
 * **Example** (Match offices inside a triangle)
 *
 * ```ts import.meta.vitest name="Match offices inside a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), entrance: Model.geopoint },
 *   links: {},
 * })
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const inside = Model.withinPolygon(Office.property("entrance"), triangle)
 * const parts = [inside.filter.type, inside.filter.value.coordinates.length]
 * parts // => ["withinPolygon", 1]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withinPolygon = withOperand<GeospatialKind>()(Filter.withinPolygon);

/**
 * Filter for objects whose geometry touches or overlaps a rectangle.
 *
 * **Example** (Match routes touching a rectangle)
 *
 * ```ts import.meta.vitest name="Match routes touching a rectangle"
 * import { BoundingBoxCorners } from "@beep/scratchpad/osdk/src/Filter/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Route = Model.object({
 *   apiName: "Route",
 *   primaryKey: "routeId",
 *   properties: { routeId: Model.required(Model.string), path: Model.geoshape },
 *   links: {},
 * })
 * const box = BoundingBoxCorners.fromBoundingBox([0, 0, 10, 10])
 * const touching = Model.intersectsBoundingBox(Route.property("path"), box)
 * const parts = [touching.filter.type, touching.filter.value.topLeft.coordinates]
 * parts // => ["intersectsBoundingBox", [0, 10]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const intersectsBoundingBox = withOperand<GeospatialKind>()(Filter.intersectsBoundingBox);

/**
 * Filter for objects whose geometry touches or overlaps a polygon.
 *
 * **Example** (Match routes touching a triangle)
 *
 * ```ts import.meta.vitest name="Match routes touching a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Route = Model.object({
 *   apiName: "Route",
 *   primaryKey: "routeId",
 *   properties: { routeId: Model.required(Model.string), path: Model.geoshape },
 *   links: {},
 * })
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const touching = Model.intersectsPolygon(Route.property("path"), triangle)
 * touching.filter.type // => "intersectsPolygon"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const intersectsPolygon = withOperand<GeospatialKind>()(Filter.intersectsPolygon);

/**
 * Filter for objects whose geometry has no point in common with a rectangle.
 *
 * **Example** (Match routes clear of a rectangle)
 *
 * ```ts import.meta.vitest name="Match routes clear of a rectangle"
 * import { BoundingBoxCorners } from "@beep/scratchpad/osdk/src/Filter/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Route = Model.object({
 *   apiName: "Route",
 *   primaryKey: "routeId",
 *   properties: { routeId: Model.required(Model.string), path: Model.geoshape },
 *   links: {},
 * })
 * const box = BoundingBoxCorners.fromBoundingBox([0, 0, 10, 10])
 * const clear = Model.doesNotIntersectBoundingBox(Route.property("path"), box)
 * clear.filter.type // => "doesNotIntersectBoundingBox"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const doesNotIntersectBoundingBox = withOperand<GeospatialKind>()(Filter.doesNotIntersectBoundingBox);

/**
 * Filter for objects whose geometry has no point in common with a polygon.
 *
 * **Example** (Match routes clear of a triangle)
 *
 * ```ts import.meta.vitest name="Match routes clear of a triangle"
 * import { LinearRing, Polygon } from "@beep/scratchpad/osdk/src/Geo/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Route = Model.object({
 *   apiName: "Route",
 *   primaryKey: "routeId",
 *   properties: { routeId: Model.required(Model.string), path: Model.geoshape },
 *   links: {},
 * })
 * const triangle = Polygon.make({ coordinates: [LinearRing.fromVertices([[0, 0], [4, 0], [0, 3]])] })
 * const clear = Model.doesNotIntersectPolygon(Route.property("path"), triangle)
 * clear.filter.type // => "doesNotIntersectPolygon"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const doesNotIntersectPolygon = withOperand<GeospatialKind>()(Filter.doesNotIntersectPolygon);

/**
 * Filter for objects whose geopoint or geoshape stands in a chosen spatial relation to a geometry.
 *
 * **Example** (Match regions that enclose a point)
 *
 * ```ts import.meta.vitest name="Match regions that enclose a point"
 * import { GeoJsonGeometry } from "@beep/scratchpad/osdk/src/Filter/index"
 * import { GeoPoint } from "@beep/scratchpad/osdk/src/Geo/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Region = Model.object({
 *   apiName: "Region",
 *   primaryKey: "regionId",
 *   properties: { regionId: Model.required(Model.string), outline: Model.geoshape },
 *   links: {},
 * })
 * const point = GeoJsonGeometry.make({ geoJson: GeoPoint.make({ coordinates: [1, 2] }) })
 * const enclosing = Model.relatesToGeometry(Region.property("outline"), point, "contains")
 * const parts = [enclosing.filter.type, enclosing.filter.spatialFilterMode]
 * parts // => ["geoShapeV2", "contains"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const relatesToGeometry: {
  (
    geometry: SearchGeometry,
    relation: SpatialRelation
  ): <Owner extends string>(
    reference: PropertyReference<string, GeospatialKind, S.Top, Owner>
  ) => TypedFilter<Owner, RelatesToGeometry>;
  <Owner extends string>(
    reference: PropertyReference<string, GeospatialKind, S.Top, Owner>,
    geometry: SearchGeometry,
    relation: SpatialRelation
  ): TypedFilter<Owner, RelatesToGeometry>;
} = dual(
  3,
  <Owner extends string>(
    reference: PropertyReference<string, GeospatialKind, S.Top, Owner>,
    geometry: SearchGeometry,
    relation: SpatialRelation
  ): TypedFilter<Owner, RelatesToGeometry> => ({
    owner: reference.owner,
    filter: Filter.relatesToGeometry(reference.name, geometry, relation),
  })
);

// -----------------------------------------------------------------------------
// Combination
// -----------------------------------------------------------------------------

/**
 * Filter for objects that satisfy both of two filters of the same model.
 *
 * **Details**
 *
 * Both filters must have the same owner: the second is checked against the
 * owner of the first, so a filter of another model is a compile error here and
 * not only when the result reaches `Model.where`. The wire value is the one
 * the untyped `and` builds, which appends to a filter that is already a
 * conjunction instead of nesting it.
 *
 * **Example** (Require a name and a starting year)
 *
 * ```ts import.meta.vitest name="Require a name and a starting year"
 * import { pipe } from "effect/Function"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string, startYear: Model.short },
 *   links: {},
 * })
 * const startYear = Employee.property("startYear")
 * const veterans = pipe(
 *   Model.startsWith(Employee.property("fullName"), "John"),
 *   Model.and(Model.isNotNull(startYear)),
 *   Model.and(Model.lt(startYear, 2010))
 * )
 * const parts = [veterans.owner, veterans.filter.type, veterans.filter.filters.length]
 * parts // => ["Employee", "and", 3]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const and: {
  <Owner extends string>(that: TypedFilter<Owner>): (self: TypedFilter<Owner>) => TypedFilter<Owner, And>;
  <Owner extends string>(self: TypedFilter<Owner>, that: TypedFilter<NoInfer<Owner>>): TypedFilter<Owner, And>;
} = dual(
  2,
  <Owner extends string>(self: TypedFilter<Owner>, that: TypedFilter<Owner>): TypedFilter<Owner, And> => ({
    owner: self.owner,
    filter: Filter.and(self.filter, that.filter),
  })
);

/**
 * Filter for objects that satisfy either of two filters of the same model.
 *
 * **Details**
 *
 * Both filters must have the same owner, as for {@link and}. The wire value is
 * the one the untyped `or` builds, which appends to a filter that is already a
 * disjunction instead of nesting it.
 *
 * **Example** (Accept either of two offices)
 *
 * ```ts import.meta.vitest name="Accept either of two offices"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), office: Model.string },
 *   links: {},
 * })
 * const office = Employee.property("office")
 * const either = Model.or(Model.eq(office, "Lyon"), Model.eq(office, "Seattle"))
 * const parts = [either.owner, either.filter.type, either.filter.filters.length]
 * parts // => ["Employee", "or", 2]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const or: {
  <Owner extends string>(that: TypedFilter<Owner>): (self: TypedFilter<Owner>) => TypedFilter<Owner, Or>;
  <Owner extends string>(self: TypedFilter<Owner>, that: TypedFilter<NoInfer<Owner>>): TypedFilter<Owner, Or>;
} = dual(
  2,
  <Owner extends string>(self: TypedFilter<Owner>, that: TypedFilter<Owner>): TypedFilter<Owner, Or> => ({
    owner: self.owner,
    filter: Filter.or(self.filter, that.filter),
  })
);

/**
 * Filter for objects that do not satisfy a filter; the result is about the same model.
 *
 * **Example** (Exclude names with a prefix)
 *
 * ```ts import.meta.vitest name="Exclude names with a prefix"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), fullName: Model.string },
 *   links: {},
 * })
 * const others = Model.not(Model.startsWith(Employee.property("fullName"), "John"))
 * const parts = [others.owner, others.filter.type, others.filter.filter.type]
 * parts // => ["Employee", "not", "startsWith"]
 * ```
 *
 * @param typed - The filter to negate.
 * @category combinators
 * @since 0.0.0
 */
export const not = <Owner extends string>(typed: TypedFilter<Owner>): TypedFilter<Owner, Not> => ({
  owner: typed.owner,
  filter: Filter.not(typed.filter),
});
