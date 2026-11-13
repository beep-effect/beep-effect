/**
 * Derived properties: values computed per object from its own properties and from the objects it links to.
 *
 * **Details**
 *
 * OSDK hides a derived property behind a closure over a builder with three
 * states, hands back an opaque handle and keeps the real definition in a side
 * table keyed by that handle. Here the definition is the model:
 * {@link DerivedProperty} is one recursive union of the 11 wire members on
 * `type`, so a derived property is data that can be matched, folded, checked
 * and sent as is.
 *
 * A derived property and an object set are mutually recursive. A
 * {@link LinkedSelection} reads a value through an object set rooted at "the
 * current object", and an object set can in turn attach derived properties.
 * The two modules import each other, and every reference across the cycle sits
 * inside a suspended schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { ObjectSet } from "../ObjectSet/ObjectSet.model.ts";

const $I = $ScratchpadId.create("osdk/DerivedProperty/DerivedProperty.model");

const suspendedObjectSet = S.suspend((): S.Codec<ObjectSet, ObjectSet.Encoded> => ObjectSet);

const suspendedDerivedProperty = S.suspend(
  (): S.Codec<DerivedProperty, DerivedProperty.Encoded> => DerivedProperty
);

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

/**
 * Which calendar component to read out of a date or a timestamp.
 *
 * **Details**
 *
 * The wire spells the parts as plural units (`DAYS`, `YEARS`), and the domain
 * literals are the lowerCamel form of those words, as for every mapped enum of
 * the library: `years` reads the year out of a date.
 *
 * **Example** (Decode the wire part name)
 *
 * ```ts import.meta.vitest name="Decode the wire part name"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DatePart } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 *
 * const part = await Effect.runPromise(S.decodeUnknownEffect(DatePart)("QUARTERS"))
 * part // => "quarters"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatePart = MappedLiteralKit([
  ["DAYS", "days"],
  ["MONTHS", "months"],
  ["QUARTERS", "quarters"],
  ["YEARS", "years"],
]).pipe(
  $I.annoteSchema("DatePart", {
    description: "Which calendar component to read out of a date or a timestamp.",
  })
);

/**
 * Runtime type of {@link DatePart}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatePart = typeof DatePart.Type;

// -----------------------------------------------------------------------------
// Operations over a linked object set
// -----------------------------------------------------------------------------

const SelectedPropertyOperationKind = LiteralKit([
  "get",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "approximateDistinct",
  "exactDistinct",
  "approximatePercentile",
  "collectList",
  "collectSet",
]);

const selectedProperty = PropertyApiName.annotateKey({
  description: "Property of the linked objects that the operation reads.",
});

// The wire shape shared by every operation that reads exactly one property of the linked objects.
const propertyOperation = <const Tag extends string>(tag: Tag) =>
  S.Struct({ type: S.tag(tag), property: selectedProperty }).pipe(
    S.encodeKeys({ property: "selectedPropertyApiName" })
  );

/**
 * Reads one property of the single linked object.
 *
 * **Gotchas**
 *
 * The platform rejects this operation when any traversed link is to-many,
 * because one object would receive many values. Whether a link is to-many is a
 * fact of the ontology, so nothing here can check it: use {@link SelectedList}
 * or {@link SelectedSet} across a to-many link.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedValue extends S.Opaque<SelectedValue, { readonly brand: unique symbol }>()(
  propertyOperation("get").pipe(
    $I.annoteSchema("SelectedValue", { description: "Reads one property of the single linked object." })
  )
) {
  /**
   * Reads the named property of the single linked object.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedValue {
    return SelectedValue.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Counts the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedCount extends S.Opaque<SelectedCount, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("count") }).pipe(
    $I.annoteSchema("SelectedCount", { description: "Counts the linked objects." })
  )
) {}

/**
 * Adds up a numeric property over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedSum extends S.Opaque<SelectedSum, { readonly brand: unique symbol }>()(
  propertyOperation("sum").pipe(
    $I.annoteSchema("SelectedSum", { description: "Adds up a numeric property over the linked objects." })
  )
) {
  /**
   * Adds up the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedSum {
    return SelectedSum.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Averages a numeric property over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedAverage extends S.Opaque<SelectedAverage, { readonly brand: unique symbol }>()(
  propertyOperation("avg").pipe(
    $I.annoteSchema("SelectedAverage", { description: "Averages a numeric property over the linked objects." })
  )
) {
  /**
   * Averages the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedAverage {
    return SelectedAverage.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Takes the smallest value of a property over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedMin extends S.Opaque<SelectedMin, { readonly brand: unique symbol }>()(
  propertyOperation("min").pipe(
    $I.annoteSchema("SelectedMin", {
      description: "Takes the smallest value of a property over the linked objects.",
    })
  )
) {
  /**
   * Takes the smallest value of the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedMin {
    return SelectedMin.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Takes the largest value of a property over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedMax extends S.Opaque<SelectedMax, { readonly brand: unique symbol }>()(
  propertyOperation("max").pipe(
    $I.annoteSchema("SelectedMax", {
      description: "Takes the largest value of a property over the linked objects.",
    })
  )
) {
  /**
   * Takes the largest value of the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedMax {
    return SelectedMax.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Estimates how many distinct values a property takes over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedApproximateDistinct extends S.Opaque<
  SelectedApproximateDistinct,
  { readonly brand: unique symbol }
>()(
  propertyOperation("approximateDistinct").pipe(
    $I.annoteSchema("SelectedApproximateDistinct", {
      description: "Estimates how many distinct values a property takes over the linked objects.",
    })
  )
) {
  /**
   * Estimates the number of distinct values of the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedApproximateDistinct {
    return SelectedApproximateDistinct.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Counts exactly how many distinct values a property takes over the linked objects.
 *
 * **Details**
 *
 * Exact counting can be slower than {@link SelectedApproximateDistinct}.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedExactDistinct extends S.Opaque<SelectedExactDistinct, { readonly brand: unique symbol }>()(
  propertyOperation("exactDistinct").pipe(
    $I.annoteSchema("SelectedExactDistinct", {
      description: "Counts exactly how many distinct values a property takes over the linked objects.",
    })
  )
) {
  /**
   * Counts the distinct values of the named property over the linked objects.
   *
   * @throws When `property` is the empty string.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string): SelectedExactDistinct {
    return SelectedExactDistinct.make({ property: PropertyApiName.make(property) });
  }
}

/**
 * Estimates the value below which a given share of a numeric property's values fall over the linked objects.
 *
 * **Details**
 *
 * The wire key is `approximatePercentile`; here it is `percentile`. The wire
 * does not say whether the scale is a fraction or a percentage: the OSDK
 * runtime defaults to `0.5` while its documentation passes `95`. The value is
 * therefore any finite number. The `Faux` backend reads it as a percentage
 * from `0` to `100`.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedApproximatePercentile extends S.Opaque<
  SelectedApproximatePercentile,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("approximatePercentile"),
    property: selectedProperty,
    percentile: S.Finite.annotateKey({ description: "Which percentile of the property's values to estimate." }),
  }).pipe(
    S.encodeKeys({ property: "selectedPropertyApiName", percentile: "approximatePercentile" }),
    $I.annoteSchema("SelectedApproximatePercentile", {
      description: "Estimates the value below which a given share of a numeric property's values fall.",
    })
  )
) {
  /**
   * Estimates the given percentile of the named property over the linked objects.
   *
   * @throws When `property` is the empty string or `percentile` is not finite.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string, percentile: number): SelectedApproximatePercentile {
    return SelectedApproximatePercentile.make({ property: PropertyApiName.make(property), percentile });
  }
}

const collectLimit = S.Int.annotateKey({
  description: "Most values to collect; the platform accepts at most 100.",
});

/**
 * Collects the non-null values of a property over the linked objects into a list, duplicates included.
 *
 * **Details**
 *
 * The list is empty when no linked object has a value. Pair it with
 * {@link SelectedCount} to tell a complete list from one cut off at `limit`.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedList extends S.Opaque<SelectedList, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("collectList"), property: selectedProperty, limit: collectLimit }).pipe(
    S.encodeKeys({ property: "selectedPropertyApiName" }),
    $I.annoteSchema("SelectedList", {
      description: "Collects the non-null values of a property over the linked objects into a list.",
    })
  )
) {
  /**
   * Collects at most `limit` values of the named property over the linked objects.
   *
   * @throws When `property` is the empty string or `limit` is not an integer.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string, limit: number): SelectedList {
    return SelectedList.make({ property: PropertyApiName.make(property), limit });
  }
}

/**
 * Collects the distinct non-null values of a property over the linked objects.
 *
 * @category models
 * @since 0.0.0
 */
export class SelectedSet extends S.Opaque<SelectedSet, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("collectSet"), property: selectedProperty, limit: collectLimit }).pipe(
    S.encodeKeys({ property: "selectedPropertyApiName" }),
    $I.annoteSchema("SelectedSet", {
      description: "Collects the distinct non-null values of a property over the linked objects.",
    })
  )
) {
  /**
   * Collects at most `limit` distinct values of the named property over the linked objects.
   *
   * @throws When `property` is the empty string or `limit` is not an integer.
   * @category constructors
   * @since 0.0.0
   */
  static of(property: string, limit: number): SelectedSet {
    return SelectedSet.make({ property: PropertyApiName.make(property), limit });
  }
}

/**
 * What a derived property computes from the objects a selection reaches: one value, or an aggregate over many.
 *
 * **Details**
 *
 * OSDK spells these as strings parsed at runtime (`"salary:sum"`, `"$count"`)
 * with options in a second argument. Here each operation is a case carrying
 * exactly the fields it needs.
 *
 * **Example** (Tell single values from aggregates)
 *
 * ```ts import.meta.vitest name="Tell single values from aggregates"
 * import {
 *   SelectedCount,
 *   SelectedList,
 *   SelectedPropertyOperation,
 *   SelectedValue,
 * } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 *
 * const describe = SelectedPropertyOperation.matchOrElse(
 *   {
 *     get: ({ property }) => `the ${property} of the one linked object`,
 *     count: () => "how many linked objects",
 *     collectList: ({ property, limit }) => `up to ${limit} values of ${property}`,
 *   },
 *   ({ type, property }) => `${type} of ${property}`
 * )
 * const readings = [
 *   describe(SelectedValue.of("fullName")),
 *   describe(SelectedCount.make({})),
 *   describe(SelectedList.of("office", 10)),
 * ]
 * readings // => ["the fullName of the one linked object", "how many linked objects", "up to 10 values of office"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SelectedPropertyOperation = SelectedPropertyOperationKind.mapMembers(() =>
  Tuple.make(
    SelectedValue,
    SelectedCount,
    SelectedSum,
    SelectedAverage,
    SelectedMin,
    SelectedMax,
    SelectedApproximateDistinct,
    SelectedExactDistinct,
    SelectedApproximatePercentile,
    SelectedList,
    SelectedSet
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("SelectedPropertyOperation", {
    description: "What a derived property computes from the objects a selection reaches.",
  })
);

/**
 * Runtime type of {@link SelectedPropertyOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type SelectedPropertyOperation = typeof SelectedPropertyOperation.Type;

// -----------------------------------------------------------------------------
// Derived property definitions
// -----------------------------------------------------------------------------

const DerivedPropertyKind = LiteralKit([
  "property",
  "selection",
  "add",
  "subtract",
  "multiply",
  "divide",
  "absoluteValue",
  "negate",
  "least",
  "greatest",
  "extract",
]);

/**
 * A property of the current object, used as an operand of a derived property.
 *
 * @category models
 * @since 0.0.0
 */
export class OwnProperty extends S.Opaque<OwnProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("property"),
    apiName: PropertyApiName.annotateKey({ description: "Name of the current object's property." }),
  }).pipe(
    $I.annoteSchema("OwnProperty", {
      description: "A property of the current object, used as an operand of a derived property.",
    })
  )
) {}

/**
 * A value read through an object set that starts at the current object.
 *
 * **Details**
 *
 * The object set is rooted at the `methodInput` placeholder, which stands for
 * the object the derived property is being computed for. Traversals and filters
 * on top of it say which linked objects to read, and the operation says what to
 * compute from them.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkedSelection extends S.Opaque<LinkedSelection, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("selection"),
    objectSet: suspendedObjectSet.annotateKey({
      description: "Objects to read, reached from the current object.",
    }),
    operation: SelectedPropertyOperation.annotateKey({ description: "What to compute from those objects." }),
  }).pipe(
    $I.annoteSchema("LinkedSelection", {
      description: "A value read through an object set that starts at the current object.",
    })
  )
) {}

/**
 * Companion namespace for {@link LinkedSelection}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LinkedSelection {
  /**
   * Encoded form of {@link LinkedSelection}, declared explicitly because it holds a recursive object set.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "selection";
    readonly objectSet: ObjectSet.Encoded;
    readonly operation: (typeof SelectedPropertyOperation)["Encoded"];
  }
}

const operandList = S.Array(suspendedDerivedProperty).check(RecursiveArraySizeHint);

/**
 * The sum of two or more numeric derived values.
 *
 * **Details**
 *
 * The wire key is `properties`; here it is `operands`.
 *
 * @category models
 * @since 0.0.0
 */
export class Addition extends S.Opaque<Addition, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("add"),
    operands: operandList.annotateKey({ description: "Values to add together." }),
  }).pipe(
    S.encodeKeys({ operands: "properties" }),
    $I.annoteSchema("Addition", { description: "The sum of two or more numeric derived values." })
  )
) {}

/**
 * Companion namespace for {@link Addition}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Addition {
  /**
   * Encoded form of {@link Addition}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "add";
    readonly properties: ReadonlyArray<DerivedProperty.Encoded>;
  }
}

/**
 * One numeric derived value minus another.
 *
 * @category models
 * @since 0.0.0
 */
export class Subtraction extends S.Opaque<Subtraction, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("subtract"),
    left: suspendedDerivedProperty.annotateKey({ description: "Value to subtract from." }),
    right: suspendedDerivedProperty.annotateKey({ description: "Value to subtract." }),
  }).pipe($I.annoteSchema("Subtraction", { description: "One numeric derived value minus another." }))
) {}

/**
 * Companion namespace for {@link Subtraction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Subtraction {
  /**
   * Encoded form of {@link Subtraction}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "subtract";
    readonly left: DerivedProperty.Encoded;
    readonly right: DerivedProperty.Encoded;
  }
}

/**
 * The product of two or more numeric derived values.
 *
 * **Details**
 *
 * The wire key is `properties`; here it is `operands`.
 *
 * @category models
 * @since 0.0.0
 */
export class Multiplication extends S.Opaque<Multiplication, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("multiply"),
    operands: operandList.annotateKey({ description: "Values to multiply together." }),
  }).pipe(
    S.encodeKeys({ operands: "properties" }),
    $I.annoteSchema("Multiplication", { description: "The product of two or more numeric derived values." })
  )
) {}

/**
 * Companion namespace for {@link Multiplication}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Multiplication {
  /**
   * Encoded form of {@link Multiplication}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "multiply";
    readonly properties: ReadonlyArray<DerivedProperty.Encoded>;
  }
}

/**
 * One numeric derived value divided by another.
 *
 * @category models
 * @since 0.0.0
 */
export class Division extends S.Opaque<Division, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("divide"),
    left: suspendedDerivedProperty.annotateKey({ description: "Value to divide." }),
    right: suspendedDerivedProperty.annotateKey({ description: "Value to divide by." }),
  }).pipe($I.annoteSchema("Division", { description: "One numeric derived value divided by another." }))
) {}

/**
 * Companion namespace for {@link Division}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Division {
  /**
   * Encoded form of {@link Division}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "divide";
    readonly left: DerivedProperty.Encoded;
    readonly right: DerivedProperty.Encoded;
  }
}

/**
 * The magnitude of a numeric derived value.
 *
 * **Details**
 *
 * The wire key is `property`; here it is `operand`.
 *
 * @category models
 * @since 0.0.0
 */
export class AbsoluteValue extends S.Opaque<AbsoluteValue, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("absoluteValue"),
    operand: suspendedDerivedProperty.annotateKey({ description: "Value whose sign is dropped." }),
  }).pipe(
    S.encodeKeys({ operand: "property" }),
    $I.annoteSchema("AbsoluteValue", { description: "The magnitude of a numeric derived value." })
  )
) {}

/**
 * Companion namespace for {@link AbsoluteValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AbsoluteValue {
  /**
   * Encoded form of {@link AbsoluteValue}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "absoluteValue";
    readonly property: DerivedProperty.Encoded;
  }
}

/**
 * A numeric derived value with its sign flipped.
 *
 * **Details**
 *
 * The wire key is `property`; here it is `operand`.
 *
 * @category models
 * @since 0.0.0
 */
export class Negation extends S.Opaque<Negation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("negate"),
    operand: suspendedDerivedProperty.annotateKey({ description: "Value whose sign is flipped." }),
  }).pipe(
    S.encodeKeys({ operand: "property" }),
    $I.annoteSchema("Negation", { description: "A numeric derived value with its sign flipped." })
  )
) {}

/**
 * Companion namespace for {@link Negation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Negation {
  /**
   * Encoded form of {@link Negation}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "negate";
    readonly property: DerivedProperty.Encoded;
  }
}

/**
 * The smallest of two or more numeric, date or timestamp derived values.
 *
 * **Details**
 *
 * The wire key is `properties`; here it is `operands`.
 *
 * @category models
 * @since 0.0.0
 */
export class Least extends S.Opaque<Least, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("least"),
    operands: operandList.annotateKey({ description: "Values to take the smallest of." }),
  }).pipe(
    S.encodeKeys({ operands: "properties" }),
    $I.annoteSchema("Least", {
      description: "The smallest of two or more numeric, date or timestamp derived values.",
    })
  )
) {}

/**
 * Companion namespace for {@link Least}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Least {
  /**
   * Encoded form of {@link Least}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "least";
    readonly properties: ReadonlyArray<DerivedProperty.Encoded>;
  }
}

/**
 * The largest of two or more numeric, date or timestamp derived values.
 *
 * **Details**
 *
 * The wire key is `properties`; here it is `operands`.
 *
 * @category models
 * @since 0.0.0
 */
export class Greatest extends S.Opaque<Greatest, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("greatest"),
    operands: operandList.annotateKey({ description: "Values to take the largest of." }),
  }).pipe(
    S.encodeKeys({ operands: "properties" }),
    $I.annoteSchema("Greatest", {
      description: "The largest of two or more numeric, date or timestamp derived values.",
    })
  )
) {}

/**
 * Companion namespace for {@link Greatest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Greatest {
  /**
   * Encoded form of {@link Greatest}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "greatest";
    readonly properties: ReadonlyArray<DerivedProperty.Encoded>;
  }
}

/**
 * One calendar component of a date or timestamp derived value.
 *
 * **Details**
 *
 * The wire key is `property`; here it is `operand`.
 *
 * @category models
 * @since 0.0.0
 */
export class DatePartExtraction extends S.Opaque<DatePartExtraction, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("extract"),
    operand: suspendedDerivedProperty.annotateKey({ description: "Date or timestamp to read the part from." }),
    part: DatePart.annotateKey({ description: "Calendar component to read." }),
  }).pipe(
    S.encodeKeys({ operand: "property" }),
    $I.annoteSchema("DatePartExtraction", {
      description: "One calendar component of a date or timestamp derived value.",
    })
  )
) {}

/**
 * Companion namespace for {@link DatePartExtraction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatePartExtraction {
  /**
   * Encoded form of {@link DatePartExtraction}, declared explicitly because the definition is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "extract";
    readonly property: DerivedProperty.Encoded;
    readonly part: (typeof DatePart)["Encoded"];
  }
}

/**
 * How to compute a derived property: a property of the object, a value read through its links, or arithmetic on both.
 *
 * **Example** (Decode a definition and name the properties it reads)
 *
 * ```ts import.meta.vitest name="Decode a definition and name the properties it reads"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DerivedProperty } from "@beep/scratchpad/osdk/src/DerivedProperty/index"
 *
 * const wire = {
 *   type: "add",
 *   properties: [
 *     {
 *       type: "selection",
 *       objectSet: { type: "searchAround", objectSet: { type: "methodInput" }, link: "lead" },
 *       operation: { type: "get", selectedPropertyApiName: "employeeId" },
 *     },
 *     { type: "property", apiName: "employeeId" },
 *   ],
 * }
 * const definition = await Effect.runPromise(S.decodeUnknownEffect(DerivedProperty)(wire))
 * const reads = (node: DerivedProperty): ReadonlyArray<string> =>
 *   DerivedProperty.matchOrElse(
 *     node,
 *     {
 *       property: ({ apiName }) => [`own ${apiName}`],
 *       selection: ({ operation }) => [`linked ${operation.type}`],
 *       add: ({ operands }) => A.flatMap(operands, reads),
 *     },
 *     () => []
 *   )
 * const encoded = await Effect.runPromise(S.encodeEffect(DerivedProperty)(definition))
 * const facts = [reads(definition), DerivedProperty.discriminants.length, encoded]
 * facts // => [["linked get", "own employeeId"], 11, wire]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DerivedProperty = DerivedPropertyKind.mapMembers(() =>
  Tuple.make(
    OwnProperty,
    LinkedSelection,
    Addition,
    Subtraction,
    Multiplication,
    Division,
    AbsoluteValue,
    Negation,
    Least,
    Greatest,
    DatePartExtraction
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DerivedProperty", {
    description: "How to compute a derived property from an object's own properties and the objects it links to.",
  })
);

/**
 * Runtime type of {@link DerivedProperty}.
 *
 * @category models
 * @since 0.0.0
 */
export type DerivedProperty =
  | OwnProperty
  | LinkedSelection
  | Addition
  | Subtraction
  | Multiplication
  | Division
  | AbsoluteValue
  | Negation
  | Least
  | Greatest
  | DatePartExtraction;

/**
 * Companion namespace for {@link DerivedProperty}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DerivedProperty {
  /**
   * Encoded (wire) form of {@link DerivedProperty}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof OwnProperty)["Encoded"]
    | LinkedSelection.Encoded
    | Addition.Encoded
    | Subtraction.Encoded
    | Multiplication.Encoded
    | Division.Encoded
    | AbsoluteValue.Encoded
    | Negation.Encoded
    | Least.Encoded
    | Greatest.Encoded
    | DatePartExtraction.Encoded;
}
