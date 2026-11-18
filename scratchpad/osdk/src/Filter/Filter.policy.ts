/**
 * Which filter operators and operands a property type admits, and the check of a filter against an object type.
 *
 * **Details**
 *
 * OSDK decides this with conditional types (`FilterFor<PD>`) that the runtime
 * compiler then ignores: any `$op` on any property is forwarded to the wire.
 * Here the decision is data. {@link allowedOperators} and
 * {@link allowedOperands} are total tables over the property type tags, checked
 * for totality by the compiler, and {@link checkFilter} applies them to a
 * filter tree and reports every violation instead of stopping at the first.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, flow, identity, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { PropertyTypeKind } from "../DataType/DataType.values.ts";
import { operandType, selectedType } from "../Property/Property.behavior.ts";
import { PropertySelector, PropertyType } from "../Property/Property.model.ts";
import { foldFilter } from "./Filter.behavior.ts";
import { ObjectFilter, PropertyFilter } from "./Filter.model.ts";
import type { PropertyApiName } from "../Identifier/Identifier.model.ts";
import type { PropertyDefinition } from "../Property/Property.model.ts";
import type { ScalarValue } from "../Value/Value.model.ts";

const $I = $ScratchpadId.create("osdk/Filter/Filter.policy");

// -----------------------------------------------------------------------------
// Operators
// -----------------------------------------------------------------------------

/**
 * Every filter operator: the `type` tags of the filter union.
 *
 * **Details**
 *
 * The kit is built from the union's own discriminants, so an operator cannot
 * exist in one and be missing from the other.
 *
 * **Example** (Count the operators and their families)
 *
 * ```ts import.meta.vitest name="Count the operators and their families"
 * import {
 *   ComparisonOperator,
 *   FilterOperator,
 *   GeoOperator,
 *   LogicalOperator,
 *   MembershipOperator,
 *   TemporalOperator,
 *   TextOperator,
 * } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const sizes = [
 *   FilterOperator.literals.length,
 *   ComparisonOperator.literals.length,
 *   MembershipOperator.literals.length,
 *   TextOperator.literals.length,
 *   TemporalOperator.literals.length,
 *   GeoOperator.literals.length,
 *   LogicalOperator.literals.length,
 * ]
 * sizes // => [28, 5, 3, 8, 1, 8, 3]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FilterOperator = LiteralKit(ObjectFilter.discriminants).pipe(
  $I.annoteSchema("FilterOperator", {
    description: "Every filter operator: the type tags of the filter union.",
  })
);

/**
 * Runtime type of {@link FilterOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type FilterOperator = typeof FilterOperator.Type;

/**
 * Operators that test one property: every operator except the logical combinators.
 *
 * **Example** (Tell a property operator from a combinator)
 *
 * ```ts import.meta.vitest name="Tell a property operator from a combinator"
 * import * as S from "effect/Schema"
 * import { PropertyOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const isPropertyOperator = S.is(PropertyOperator)
 * const verdicts = [isPropertyOperator("eq"), isPropertyOperator("and"), PropertyOperator.literals.length]
 * verdicts // => [true, false, 25]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyOperator = FilterOperator.omit(["and", "or", "not"]).pipe(
  $I.annoteSchema("PropertyOperator", {
    description: "Operators that test one property: every filter operator except the logical combinators.",
  })
);

/**
 * Runtime type of {@link PropertyOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyOperator = typeof PropertyOperator.Type;

/**
 * Operators that compare a property with one value: the four orderings and equality.
 *
 * **Example** (List the comparison operators)
 *
 * ```ts import.meta.vitest name="List the comparison operators"
 * import { ComparisonOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * ComparisonOperator.literals // => ["lt", "gt", "lte", "gte", "eq"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ComparisonOperator = FilterOperator.pick(["lt", "gt", "lte", "gte", "eq"]).pipe(
  $I.annoteSchema("ComparisonOperator", {
    description: "Operators that compare a property with one value: the four orderings and equality.",
  })
);

/**
 * Runtime type of {@link ComparisonOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type ComparisonOperator = typeof ComparisonOperator.Type;

/**
 * Operators that test membership or presence: one of a list, null or not, array contains.
 *
 * **Example** (List the membership operators)
 *
 * ```ts import.meta.vitest name="List the membership operators"
 * import { MembershipOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * MembershipOperator.literals // => ["in", "isNull", "contains"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MembershipOperator = FilterOperator.pick(["in", "isNull", "contains"]).pipe(
  $I.annoteSchema("MembershipOperator", {
    description: "Operators that test membership or presence: one of a list, null or not, array contains.",
  })
);

/**
 * Runtime type of {@link MembershipOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type MembershipOperator = typeof MembershipOperator.Type;

/**
 * Operators that search the text of a string property.
 *
 * **Example** (Recognize a text operator)
 *
 * ```ts import.meta.vitest name="Recognize a text operator"
 * import * as S from "effect/Schema"
 * import { TextOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const verdicts = [S.is(TextOperator)("regex"), S.is(TextOperator)("eq")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextOperator = FilterOperator.pick([
  "startsWith",
  "wildcard",
  "regex",
  "containsAnyTerm",
  "containsAllTerms",
  "containsAllTermsInOrder",
  "containsAllTermsInOrderPrefixLastTerm",
  "interval",
]).pipe(
  $I.annoteSchema("TextOperator", {
    description: "Operators that search the text of a string property.",
  })
);

/**
 * Runtime type of {@link TextOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type TextOperator = typeof TextOperator.Type;

/**
 * Operators that only make sense on dates and instants.
 *
 * **Example** (List the temporal operators)
 *
 * ```ts import.meta.vitest name="List the temporal operators"
 * import { TemporalOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * TemporalOperator.literals // => ["relativeDateRange"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TemporalOperator = FilterOperator.pick(["relativeDateRange"]).pipe(
  $I.annoteSchema("TemporalOperator", {
    description: "Operators that only make sense on dates and instants.",
  })
);

/**
 * Runtime type of {@link TemporalOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type TemporalOperator = typeof TemporalOperator.Type;

/**
 * Operators that compare a geospatial property with an area or a geometry.
 *
 * **Example** (Recognize a geospatial operator)
 *
 * ```ts import.meta.vitest name="Recognize a geospatial operator"
 * import * as S from "effect/Schema"
 * import { GeoOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const verdicts = [S.is(GeoOperator)("withinPolygon"), S.is(GeoOperator)("contains")]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GeoOperator = FilterOperator.pick([
  "withinDistanceOf",
  "withinBoundingBox",
  "withinPolygon",
  "intersectsBoundingBox",
  "intersectsPolygon",
  "doesNotIntersectBoundingBox",
  "doesNotIntersectPolygon",
  "geoShapeV2",
]).pipe(
  $I.annoteSchema("GeoOperator", {
    description: "Operators that compare a geospatial property with an area or a geometry.",
  })
);

/**
 * Runtime type of {@link GeoOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type GeoOperator = typeof GeoOperator.Type;

/**
 * Operators that combine filters rather than test a property.
 *
 * **Example** (List the logical operators)
 *
 * ```ts import.meta.vitest name="List the logical operators"
 * import { LogicalOperator } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * LogicalOperator.literals // => ["and", "or", "not"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LogicalOperator = FilterOperator.pick(["and", "or", "not"]).pipe(
  $I.annoteSchema("LogicalOperator", {
    description: "Operators that combine filters rather than test a property.",
  })
);

/**
 * Runtime type of {@link LogicalOperator}.
 *
 * @category models
 * @since 0.0.0
 */
export type LogicalOperator = typeof LogicalOperator.Type;

// -----------------------------------------------------------------------------
// Property type -> operators
// -----------------------------------------------------------------------------

const identityOperators: ReadonlyArray<PropertyOperator> = ["eq", "in", "isNull"];
const orderedOperators: ReadonlyArray<PropertyOperator> = A.appendAll(identityOperators, ["lt", "gt", "lte", "gte"]);
const textOperators: ReadonlyArray<PropertyOperator> = A.appendAll(orderedOperators, TextOperator.literals);
const temporalOperators: ReadonlyArray<PropertyOperator> = A.appendAll(orderedOperators, TemporalOperator.literals);
const spatialOperators: ReadonlyArray<PropertyOperator> = A.prepend(GeoOperator.literals, "isNull");
const arrayOperators: ReadonlyArray<PropertyOperator> = ["contains", "isNull"];
const structOperators: ReadonlyArray<PropertyOperator> = ["isNull"];

/**
 * The operators each property type admits, keyed by type tag.
 *
 * **Details**
 *
 * The rows follow the OSDK's `FilterFor` table translated to wire operators,
 * with its two lapses on integer types repaired, so that all seven numeric
 * tags share one row:
 *
 * - `short` is numeric. OSDK leaves it out of its numeric filter types, so it
 *   falls to a string-operand fallback without the orderings.
 * - `long` is numeric with an operand that travels as text (see
 *   {@link allowedOperands}). OSDK gives it the orderings but types the operand
 *   as a JavaScript `number`, which cannot hold the values the property stores.
 *
 * `date` and `timestamp` also admit the relative date range, which the wire
 * documents for exactly those two types and the OSDK never emits. An `array`
 * row lists only what applies to the array itself; operators of the element
 * type apply to it element-wise and are added by {@link operatorsOf}.
 *
 * **Example** (Look up the operators of a type tag)
 *
 * ```ts import.meta.vitest name="Look up the operators of a type tag"
 * import * as A from "effect/Array"
 * import { allowedOperators } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const verdicts = [
 *   A.contains(allowedOperators.short, "gte"),
 *   A.contains(allowedOperators.boolean, "gte"),
 *   A.contains(allowedOperators.string, "regex"),
 *   allowedOperators.struct,
 * ]
 * verdicts // => [true, false, true, ["isNull"]]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowedOperators: { readonly [K in PropertyTypeKind]: ReadonlyArray<PropertyOperator> } = {
  boolean: identityOperators,
  byte: orderedOperators,
  short: orderedOperators,
  integer: orderedOperators,
  long: orderedOperators,
  float: orderedOperators,
  double: orderedOperators,
  decimal: orderedOperators,
  string: textOperators,
  date: temporalOperators,
  timestamp: temporalOperators,
  marking: identityOperators,
  cipherText: identityOperators,
  attachment: identityOperators,
  mediaReference: identityOperators,
  geopoint: spatialOperators,
  geoshape: spatialOperators,
  geotimeSeriesReference: identityOperators,
  timeseries: identityOperators,
  vector: identityOperators,
  array: arrayOperators,
  struct: structOperators,
};

/**
 * The operators a property of the given type admits, looking through arrays to their elements.
 *
 * **Details**
 *
 * A filter on an array property applies an element operator to every element:
 * the wire has no wrapper for "some element is less than 5", it is `lt` on the
 * array property itself. So an array admits `contains`, `isNull` and whatever
 * its element type admits.
 *
 * **Example** (An array of integers admits the orderings)
 *
 * ```ts import.meta.vitest name="An array of integers admits the orderings"
 * import * as A from "effect/Array"
 * import { IntegerType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType } from "@beep/scratchpad/osdk/src/Property/index"
 * import { operatorsOf } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const operators = operatorsOf(ArrayType.make({ elementType: IntegerType.make({}) }))
 * const verdicts = [A.contains(operators, "contains"), A.contains(operators, "lt"), A.contains(operators, "regex")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const operatorsOf = (type: PropertyType): ReadonlyArray<PropertyOperator> =>
  PropertyType.guards.array(type)
    ? A.union(allowedOperators.array, operatorsOf(type.elementType))
    : allowedOperators[type.type];

// -----------------------------------------------------------------------------
// Property type -> operands
// -----------------------------------------------------------------------------

/**
 * The forms a comparison operand takes on the wire, one per JSON scalar.
 *
 * **Example** (List the operand families)
 *
 * ```ts import.meta.vitest name="List the operand families"
 * import { OperandFamily } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * OperandFamily.literals // => ["text", "number", "boolean"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OperandFamily = LiteralKit(["text", "number", "boolean"]).pipe(
  $I.annoteSchema("OperandFamily", {
    description: "The forms a comparison operand takes on the wire, one per JSON scalar.",
  })
);

/**
 * Runtime type of {@link OperandFamily}.
 *
 * @category models
 * @since 0.0.0
 */
export type OperandFamily = typeof OperandFamily.Type;

/**
 * The family of a wire operand: which JSON scalar it is.
 *
 * **Example** (Classify operands by their JSON form)
 *
 * ```ts import.meta.vitest name="Classify operands by their JSON form"
 * import { operandFamily } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const families = [operandFamily("Ishmael"), operandFamily("2021-01-04"), operandFamily(3.5), operandFamily(true)]
 * families // => ["text", "text", "number", "boolean"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const operandFamily: (operand: ScalarValue) => OperandFamily = Match.type<ScalarValue>().pipe(
  Match.when(P.isString, () => OperandFamily.Enum.text),
  Match.when(P.isNumber, () => OperandFamily.Enum.number),
  Match.when(P.isBoolean, () => OperandFamily.Enum.boolean),
  Match.exhaustive
);

const textOperand: ReadonlyArray<OperandFamily> = ["text"];
const numberOperand: ReadonlyArray<OperandFamily> = ["number"];
const noOperand: ReadonlyArray<OperandFamily> = A.empty();

/**
 * The operand families a comparison with each property type admits, keyed by type tag.
 *
 * **Details**
 *
 * A row lists the JSON forms in which an operand of that type travels. `date`
 * and `timestamp` travel as text. `long` and `decimal` travel as text too, and
 * also admit a JSON number, the form OSDK callers pass. Whether a text operand
 * really spells a date or a 64-bit integer is for the property's `operandCodec`
 * to say; this table only tells the forms apart. Types whose values are
 * references (attachments, media, series, vectors, cipher text) compare as
 * text, as in the OSDK, and so do markings. Geospatial and composite types have
 * no scalar operand; {@link operandsOf} looks through arrays.
 *
 * **Example** (Look up the operands of a type tag)
 *
 * ```ts import.meta.vitest name="Look up the operands of a type tag"
 * import { allowedOperands } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const rows = [allowedOperands.integer, allowedOperands.long, allowedOperands.date, allowedOperands.geopoint]
 * rows // => [["number"], ["text", "number"], ["text"], []]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowedOperands: { readonly [K in PropertyTypeKind]: ReadonlyArray<OperandFamily> } = {
  boolean: ["boolean"],
  byte: numberOperand,
  short: numberOperand,
  integer: numberOperand,
  long: ["text", "number"],
  float: numberOperand,
  double: numberOperand,
  decimal: ["text", "number"],
  string: textOperand,
  date: textOperand,
  timestamp: textOperand,
  marking: textOperand,
  cipherText: textOperand,
  attachment: textOperand,
  mediaReference: textOperand,
  geopoint: noOperand,
  geoshape: noOperand,
  geotimeSeriesReference: textOperand,
  timeseries: textOperand,
  vector: textOperand,
  array: noOperand,
  struct: noOperand,
};

/**
 * The operand families a comparison with a property of the given type admits, looking through arrays to their elements.
 *
 * **Example** (An array of longs compares as a long does)
 *
 * ```ts import.meta.vitest name="An array of longs compares as a long does"
 * import { LongType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ArrayType } from "@beep/scratchpad/osdk/src/Property/index"
 * import { operandsOf } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * operandsOf(ArrayType.make({ elementType: LongType.make({}) })) // => ["text", "number"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const operandsOf = (type: PropertyType): ReadonlyArray<OperandFamily> =>
  allowedOperands[operandType(type).type];

// -----------------------------------------------------------------------------
// Violations
// -----------------------------------------------------------------------------

const FilterViolationKind = LiteralKit(["unknownProperty", "operatorNotAllowed", "operandMismatch", "emptyCombinator"]);

/**
 * A filter tests a property, or a struct field, that the object type does not declare.
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownProperty extends S.Opaque<UnknownProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("unknownProperty"),
    operator: PropertyOperator.annotateKey({ description: "Operator of the offending filter." }),
    property: PropertySelector.annotateKey({ description: "Selector that resolves to nothing." }),
  }).pipe(
    $I.annoteSchema("UnknownProperty", {
      description: "A filter tests a property, or a struct field, that the object type does not declare.",
    })
  )
) {}

/**
 * A filter applies an operator that the property's type does not admit.
 *
 * @category models
 * @since 0.0.0
 */
export class OperatorNotAllowed extends S.Opaque<OperatorNotAllowed, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("operatorNotAllowed"),
    operator: PropertyOperator.annotateKey({ description: "Operator of the offending filter." }),
    property: PropertySelector.annotateKey({ description: "Selector of the tested property." }),
    propertyType: PropertyTypeKind.annotateKey({ description: "Type tag of the tested property." }),
    allowed: S.Array(PropertyOperator).annotateKey({ description: "Operators the property's type admits." }),
  }).pipe(
    $I.annoteSchema("OperatorNotAllowed", {
      description: "A filter applies an operator that the property's type does not admit.",
    })
  )
) {}

/**
 * A filter compares a property with an operand of a family its type does not admit.
 *
 * @category models
 * @since 0.0.0
 */
export class OperandMismatch extends S.Opaque<OperandMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("operandMismatch"),
    operator: PropertyOperator.annotateKey({ description: "Operator of the offending filter." }),
    property: PropertySelector.annotateKey({ description: "Selector of the tested property." }),
    propertyType: PropertyTypeKind.annotateKey({ description: "Type tag of the tested property." }),
    operand: OperandFamily.annotateKey({ description: "Family of the operand that was given." }),
    expected: S.Array(OperandFamily).annotateKey({ description: "Families the property's type admits." }),
  }).pipe(
    $I.annoteSchema("OperandMismatch", {
      description: "A filter compares a property with an operand of a family its type does not admit.",
    })
  )
) {}

/**
 * An `and` or an `or` combines no filters at all.
 *
 * **Details**
 *
 * The platform accepts it: an empty `and` matches every object and an empty
 * `or` matches none. It is reported because it is almost always the result of
 * building a filter from an empty list by mistake.
 *
 * @category models
 * @since 0.0.0
 */
export class EmptyCombinator extends S.Opaque<EmptyCombinator, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("emptyCombinator"),
    operator: S.Literals(["and", "or"]).annotateKey({ description: "The combinator that has no operands." }),
  }).pipe(
    $I.annoteSchema("EmptyCombinator", {
      description: "An and or an or combines no filters at all.",
    })
  )
) {}

/**
 * One way a filter can disagree with the object type it is meant for.
 *
 * **Example** (Explain a violation in words)
 *
 * ```ts import.meta.vitest name="Explain a violation in words"
 * import { EmptyCombinator, FilterViolation } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const explain = FilterViolation.match({
 *   unknownProperty: ({ operator }) => `${operator} tests an undeclared property`,
 *   operatorNotAllowed: ({ operator, propertyType }) => `${operator} does not apply to ${propertyType}`,
 *   operandMismatch: ({ operand, propertyType }) => `${propertyType} does not compare with ${operand}`,
 *   emptyCombinator: ({ operator }) => `${operator} has no operands`,
 * })
 * explain(EmptyCombinator.make({ operator: "or" })) // => "or has no operands"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FilterViolation = FilterViolationKind.mapMembers(() =>
  Tuple.make(UnknownProperty, OperatorNotAllowed, OperandMismatch, EmptyCombinator)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("FilterViolation", {
    description: "One way a filter can disagree with the object type it is meant for.",
  })
);

/**
 * Runtime type of {@link FilterViolation}.
 *
 * @category models
 * @since 0.0.0
 */
export type FilterViolation = typeof FilterViolation.Type;

// -----------------------------------------------------------------------------
// Checking a filter against an object type
// -----------------------------------------------------------------------------

type PropertyTable = Readonly<Record<PropertyApiName, PropertyDefinition>>;

const oneComparand = (filter: { readonly value: ScalarValue }): ReadonlyArray<ScalarValue> => A.of(filter.value);
const noComparand = (): ReadonlyArray<ScalarValue> => A.empty();

const comparandsOf: (filter: PropertyFilter) => ReadonlyArray<ScalarValue> = PropertyFilter.match({
  lt: oneComparand,
  gt: oneComparand,
  lte: oneComparand,
  gte: oneComparand,
  eq: oneComparand,
  in: ({ value }) => value,
  isNull: noComparand,
  contains: oneComparand,
  startsWith: noComparand,
  wildcard: noComparand,
  regex: noComparand,
  containsAnyTerm: noComparand,
  containsAllTerms: noComparand,
  containsAllTermsInOrder: noComparand,
  containsAllTermsInOrderPrefixLastTerm: noComparand,
  interval: noComparand,
  relativeDateRange: noComparand,
  withinDistanceOf: noComparand,
  withinBoundingBox: noComparand,
  withinPolygon: noComparand,
  intersectsBoundingBox: noComparand,
  intersectsPolygon: noComparand,
  doesNotIntersectBoundingBox: noComparand,
  doesNotIntersectPolygon: noComparand,
  geoShapeV2: noComparand,
});

const checkTyped = (filter: PropertyFilter, dataType: PropertyType): ReadonlyArray<FilterViolation> => {
  const allowed = operatorsOf(dataType);
  const expected = operandsOf(dataType);
  return A.contains(allowed, filter.type)
    ? pipe(
        comparandsOf(filter),
        A.map(operandFamily),
        A.dedupe,
        A.filter((operand) => !A.contains(expected, operand)),
        A.map((operand) =>
          OperandMismatch.make({
            operator: filter.type,
            property: filter.property,
            propertyType: dataType.type,
            operand,
            expected,
          })
        )
      )
    : A.of(
        OperatorNotAllowed.make({
          operator: filter.type,
          property: filter.property,
          propertyType: dataType.type,
          allowed,
        })
      );
};

const checkProperty = (properties: PropertyTable) => {
  // Outer none: the selector names something the table does not declare.
  // Inner none: it is declared, but its effective type cannot be read from a property table alone.
  const resolve = selectedType(properties);
  return (filter: PropertyFilter): ReadonlyArray<FilterViolation> =>
    O.match(resolve(filter.property), {
      onNone: () => A.of(UnknownProperty.make({ operator: filter.type, property: filter.property })),
      // Declared, but of a type a property table cannot tell: nothing to check the operator against.
      onSome: flow(
        O.map((dataType) => checkTyped(filter, dataType)),
        O.getOrElse(A.empty<FilterViolation>)
      ),
    });
};

const checkOperands =
  (operator: "and" | "or") =>
  (results: ReadonlyArray<ReadonlyArray<FilterViolation>>): ReadonlyArray<FilterViolation> =>
    A.isReadonlyArrayEmpty(results) ? A.of(EmptyCombinator.make({ operator })) : A.flatten(results);

/**
 * Checks a filter against the properties of an object type and returns every violation, in tree order.
 *
 * **Details**
 *
 * An empty result means the filter is consistent with the property table. Four
 * things are reported: a selector that resolves to no declared property or
 * struct field, an operator the property's type does not admit, a comparison
 * operand of a family the type does not admit, and an `and` / `or` without
 * operands.
 *
 * The check needs only the property table, so it works before a whole object
 * type exists. For that reason the title and primary-key selectors, whose
 * target is a fact of the object type, and selectors with a load level, whose
 * effective type the platform decides, are checked for existence only.
 *
 * **Example** (Report every violation of a filter)
 *
 * ```ts import.meta.vitest name="Report every violation of a filter"
 * import * as A from "effect/Array"
 * import * as R from "effect/Record"
 * import { BooleanType, IntegerType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 * import { checkFilter, eq, every, gt, startsWith } from "@beep/scratchpad/osdk/src/Filter/index"
 *
 * const rid = PropertyTypeRid.make("ri.ontology.main.property.example")
 * const properties = R.fromEntries([
 *   [PropertyApiName.make("age"), PropertyDefinition.make({ dataType: IntegerType.make({}), rid })],
 *   [PropertyApiName.make("active"), PropertyDefinition.make({ dataType: BooleanType.make({}), rid })],
 * ])
 * const filter = every([gt("age", 21), gt("active", true), eq("age", "old"), startsWith("nickname", "ish")])
 * const kinds = A.map(checkFilter(filter, properties), (violation) => violation.type)
 * kinds // => ["operatorNotAllowed", "operandMismatch", "unknownProperty"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkFilter: {
  (properties: PropertyTable): (filter: ObjectFilter) => ReadonlyArray<FilterViolation>;
  (filter: ObjectFilter, properties: PropertyTable): ReadonlyArray<FilterViolation>;
} = dual(
  2,
  (filter: ObjectFilter, properties: PropertyTable): ReadonlyArray<FilterViolation> =>
    foldFilter(filter, {
      property: checkProperty(properties),
      and: checkOperands("and"),
      or: checkOperands("or"),
      not: identity,
    })
);
