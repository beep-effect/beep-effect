/**
 * Display-formatting rules: how an application prints the value of a property.
 *
 * **Details**
 *
 * A property may carry one {@link ValueFormat}. It never changes the stored
 * value; it says how to print it. The rule is a small algebra:
 *
 * - a {@link ValueFormat} picks the kind of value (number, timestamp, date, boolean, known identifier);
 * - a number is printed by one of nine {@link NumberFormat}s, most of which share {@link NumberFormatOptions};
 * - dates and instants are printed by a {@link DatetimeFormat}, instants also in a {@link DatetimeTimezone};
 * - wherever a rule needs a piece of text (a unit, a currency code, a zone), a
 *   {@link PropertyOrConstant} lets it be fixed or read from a sibling property of the same object.
 *
 * The encoded side of every schema is the platform JSON, field for field. The
 * decoded side differs in three ways only: an absent key is an `Option`, an
 * upper-case enum is a lower-camel literal, and four keys whose wire name
 * misleads are renamed (`numberType`, `affix`, the preset's `format` and
 * `baseValue`; see the members that carry them).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as R from "@beep/utils/Record";
import * as Effect from "effect/Effect";
import { constTrue } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import {
  CurrencyStyle,
  DatetimePreset,
  DurationInputUnit,
  DurationPrecision,
  KnownType,
  NumberFormatKind,
  NumberNotation,
  NumberRatio,
  NumberRoundingMode,
  NumberScale,
  ValueFormatKind,
} from "./ValueFormat.values.ts";

const $I = $ScratchpadId.create("osdk/ValueFormat/ValueFormat.model");

// -----------------------------------------------------------------------------
// Text that is fixed or read from the object
// -----------------------------------------------------------------------------

const PropertyOrConstantKind = LiteralKit(["constant", "propertyType"]);

/**
 * Text that is the same for every object.
 *
 * @category models
 * @since 0.0.0
 */
export class StringConstant extends S.Opaque<StringConstant, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("constant"),
    value: S.String.annotateKey({ description: "The text to use, verbatim." }),
  }).pipe($I.annoteSchema("StringConstant", { description: "Text that is the same for every object." }))
) {}

/**
 * Companion namespace for {@link StringConstant}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StringConstant {
  /**
   * Encoded (wire) form of {@link StringConstant}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "constant";
    readonly value: string;
  }
}

/**
 * Text read, at format time, from another property of the object being printed.
 *
 * **Details**
 *
 * The wire tags this case `propertyType`, but it names a property whose
 * *value* supplies the text. Nothing is fetched: when that property is not
 * loaded or is null there is no text.
 *
 * @category models
 * @since 0.0.0
 */
export class PropertyLookup extends S.Opaque<PropertyLookup, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("propertyType"),
    propertyApiName: PropertyApiName.annotateKey({
      description: "Sibling property whose value supplies the text.",
    }),
  }).pipe(
    $I.annoteSchema("PropertyLookup", {
      description: "Text read, at format time, from another property of the object being printed.",
    })
  )
) {}

/**
 * Companion namespace for {@link PropertyLookup}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PropertyLookup {
  /**
   * Encoded (wire) form of {@link PropertyLookup}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "propertyType";
    readonly propertyApiName: PropertyApiName.Encoded;
  }
}

/**
 * A piece of text a formatting rule needs: fixed, or read from a sibling property of the same object.
 *
 * **Details**
 *
 * This is what makes a rule data-driven per object: the currency code of an
 * amount, the unit of a measurement, the affixes around a number and the time
 * zone of an instant can each live in a neighbouring property.
 *
 * **Example** (Resolve a currency code against an object)
 *
 * ```ts import.meta.vitest name="Resolve a currency code against an object"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { PropertyOrConstant } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const row: Record<string, string> = { currency: "EUR" }
 * const resolve = PropertyOrConstant.match({
 *   constant: ({ value }) => value,
 *   propertyType: ({ propertyApiName }) => O.getOrElse(R.get(row, propertyApiName), () => "unknown"),
 * })
 * const sources = [
 *   PropertyOrConstant.cases.constant.make({ value: "USD" }),
 *   PropertyOrConstant.cases.propertyType.make({ propertyApiName: PropertyApiName.make("currency") }),
 * ]
 * const codes = A.map(sources, (source) => resolve(source))
 * codes // => ["USD", "EUR"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PropertyOrConstant = PropertyOrConstantKind.mapMembers(() =>
  Tuple.make(StringConstant, PropertyLookup)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("PropertyOrConstant", {
    description: "Text a formatting rule needs: fixed, or read from a sibling property of the same object.",
  })
);

/**
 * Runtime type of {@link PropertyOrConstant}.
 *
 * @category models
 * @since 0.0.0
 */
export type PropertyOrConstant = typeof PropertyOrConstant.Type;

/**
 * Companion namespace for {@link PropertyOrConstant}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PropertyOrConstant {
  /**
   * Encoded (wire) form of {@link PropertyOrConstant}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | StringConstant.Encoded
    | PropertyLookup.Encoded;
}

// -----------------------------------------------------------------------------
// Number settings
// -----------------------------------------------------------------------------

/**
 * Digit, grouping, notation and rounding settings applied to a number before any unit or affix.
 *
 * **Details**
 *
 * Every setting is optional and follows the semantics of `Intl.NumberFormat`,
 * except `convertNegativeToParenthesis`, which prints `-5` as `(5)`. A digit
 * count is a whole number, but the platform does not range-check it, so
 * neither does this schema; add {@link IntlDigitBounds} where a rule must be
 * renderable.
 *
 * **Example** (Encode only the settings that are set)
 *
 * ```ts import.meta.vitest name="Encode only the settings that are set"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { NumberFormatOptions } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const options = NumberFormatOptions.make({ maximumFractionDigits: O.some(2), notation: O.some("compact") })
 * const wire = await Effect.runPromise(S.encodeEffect(NumberFormatOptions)(options))
 * wire // => { maximumFractionDigits: 2, notation: "COMPACT" }
 * ```
 *
 * @invariant Every digit count is a whole number.
 * @category models
 * @since 0.0.0
 */
export class NumberFormatOptions extends S.Opaque<NumberFormatOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    useGrouping: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether digits are grouped with thousands separators." })
    ),
    convertNegativeToParenthesis: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether a negative number is wrapped in parentheses instead of signed." })
    ),
    minimumIntegerDigits: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Least number of digits before the decimal point, padded with zeros." })
    ),
    minimumFractionDigits: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Least number of digits after the decimal point, padded with zeros." })
    ),
    maximumFractionDigits: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Most digits after the decimal point; the rest is rounded away." })
    ),
    minimumSignificantDigits: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Least number of significant digits, padded with zeros." })
    ),
    maximumSignificantDigits: S.OptionFromOptionalKey(S.Int).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Most significant digits; the rest is rounded away." })
    ),
    notation: S.OptionFromOptionalKey(NumberNotation).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How the magnitude is written, absent for the locale's default." })
    ),
    roundingMode: S.OptionFromOptionalKey(NumberRoundingMode).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Which way excess digits are rounded, absent for the locale's default." })
    ),
  }).pipe(
    $I.annoteSchema("NumberFormatOptions", {
      description: "Digit, grouping, notation and rounding settings applied to a number before any unit or affix.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatOptions {
  /**
   * Encoded (wire) form of {@link NumberFormatOptions}: an unset setting is an absent key and each enum is its
   * upper-case wire literal.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly useGrouping?: boolean;
    readonly convertNegativeToParenthesis?: boolean;
    readonly minimumIntegerDigits?: number;
    readonly minimumFractionDigits?: number;
    readonly maximumFractionDigits?: number;
    readonly minimumSignificantDigits?: number;
    readonly maximumSignificantDigits?: number;
    readonly notation?: NumberNotation.Encoded;
    readonly roundingMode?: NumberRoundingMode.Encoded;
  }
}

// Digit counts as a formatter accepts them: absent, or a whole number inside the engine's range.
const IntegerDigitCount = S.Option(S.Int.check(S.isBetween({ minimum: 1, maximum: 21 })));
const FractionDigitCount = S.Option(S.Int.check(S.isBetween({ minimum: 0, maximum: 100 })));
const isOrdered = (minimum: O.Option<number>, maximum: O.Option<number>): boolean =>
  O.getOrElse(
    O.zipWith(minimum, maximum, (least, most) => least <= most),
    constTrue
  );

/**
 * The digit-count bounds `Intl.NumberFormat` enforces when a number is actually rendered.
 *
 * **When to use**
 *
 * Use when authoring or linting a rule that must render:
 * `NumberFormatOptions.check(IntlDigitBounds)`. Do not add it to a schema that
 * decodes platform responses, because the platform does not promise these bounds.
 *
 * **Details**
 *
 * Integer and significant digit counts are whole numbers from 1 to 21,
 * fraction digit counts are whole numbers from 0 to 100, and each minimum is
 * at most its maximum. A formatter throws a `RangeError` on anything else.
 *
 * **Example** (Reject settings a formatter would throw on)
 *
 * ```ts import.meta.vitest name="Reject settings a formatter would throw on"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { IntlDigitBounds, NumberFormatOptions } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const isRenderable = S.is(NumberFormatOptions.check(IntlDigitBounds))
 * const verdicts = [
 *   isRenderable(NumberFormatOptions.make({ minimumFractionDigits: O.some(2), maximumFractionDigits: O.some(4) })),
 *   isRenderable(NumberFormatOptions.make({ minimumFractionDigits: O.some(4), maximumFractionDigits: O.some(2) })),
 *   isRenderable(NumberFormatOptions.make({ minimumIntegerDigits: O.some(0) })),
 * ]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const IntlDigitBounds = S.makeFilterGroup<NumberFormatOptions>(
  [
    S.makeFilter(
      (options) => S.is(IntegerDigitCount)(options.minimumIntegerDigits),
      $I.annote("IntegerDigitCountCheck", {
        title: "Integer Digit Count",
        description: "A minimum integer digit count that is a whole number from 1 to 21.",
        message: "minimumIntegerDigits must be a whole number from 1 to 21",
      })
    ),
    S.makeFilter(
      (options) =>
        S.is(FractionDigitCount)(options.minimumFractionDigits) &&
        S.is(FractionDigitCount)(options.maximumFractionDigits),
      $I.annote("FractionDigitCountCheck", {
        title: "Fraction Digit Count",
        description: "Fraction digit counts that are whole numbers from 0 to 100.",
        message: "minimumFractionDigits and maximumFractionDigits must be whole numbers from 0 to 100",
      })
    ),
    S.makeFilter(
      (options) =>
        S.is(IntegerDigitCount)(options.minimumSignificantDigits) &&
        S.is(IntegerDigitCount)(options.maximumSignificantDigits),
      $I.annote("SignificantDigitCountCheck", {
        title: "Significant Digit Count",
        description: "Significant digit counts that are whole numbers from 1 to 21.",
        message: "minimumSignificantDigits and maximumSignificantDigits must be whole numbers from 1 to 21",
      })
    ),
    S.makeFilter(
      (options) =>
        isOrdered(options.minimumFractionDigits, options.maximumFractionDigits) &&
        isOrdered(options.minimumSignificantDigits, options.maximumSignificantDigits),
      $I.annote("OrderedDigitCountCheck", {
        title: "Ordered Digit Counts",
        description: "Minimum digit counts that do not exceed their maximum.",
        message: "A minimum digit count must not exceed its maximum",
      })
    ),
  ],
  $I.annote("IntlDigitBounds", {
    title: "Intl Digit Bounds",
    description: "Digit counts within the bounds Intl.NumberFormat enforces when a number is rendered.",
  })
);

const BaseFormatOptions = NumberFormatOptions.pipe(
  S.withConstructorDefault(Effect.succeed(NumberFormatOptions.make({}))),
  S.annotateKey({ description: "Digit, grouping, notation and rounding settings applied to the number itself." })
);

// -----------------------------------------------------------------------------
// Affixes
// -----------------------------------------------------------------------------

/**
 * Text printed directly before and after a number, with no separator added.
 *
 * **Details**
 *
 * Either side may be absent, and either may be read from a sibling property.
 * The wire calls the trailing side `postfix`.
 *
 * **Example** (Decorate a number with a trailing label)
 *
 * ```ts import.meta.vitest name="Decorate a number with a trailing label"
 * import * as O from "effect/Option"
 * import { Affix, PropertyOrConstant } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const total = Affix.make({ postfix: O.some(PropertyOrConstant.cases.constant.make({ value: " total" })) })
 * const sides = [O.isSome(total.prefix), O.isSome(total.postfix)]
 * sides // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Affix extends S.Opaque<Affix, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: S.OptionFromOptionalKey(PropertyOrConstant).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Text printed directly before the number." })
    ),
    postfix: S.OptionFromOptionalKey(PropertyOrConstant).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Text printed directly after the number." })
    ),
  }).pipe(
    $I.annoteSchema("Affix", {
      description: "Text printed directly before and after a number, with no separator added.",
    })
  )
) {}

/**
 * Companion namespace for {@link Affix}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Affix {
  /**
   * Encoded (wire) form of {@link Affix}: an absent side is an absent key.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly prefix?: PropertyOrConstant.Encoded;
    readonly postfix?: PropertyOrConstant.Encoded;
  }
}

// -----------------------------------------------------------------------------
// Durations
// -----------------------------------------------------------------------------

const DurationFormatStyleKind = LiteralKit(["humanReadable", "timecode"]);

/**
 * Duration printed as unit-labelled parts, such as "1h 1m 1s".
 *
 * @category models
 * @since 0.0.0
 */
export class HumanReadableDuration extends S.Opaque<HumanReadableDuration, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("humanReadable"),
    showFullUnits: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether unit names are written in full rather than abbreviated." })
    ),
  }).pipe(
    $I.annoteSchema("HumanReadableDuration", {
      description: "Duration printed as unit-labelled parts, such as 1h 1m 1s.",
    })
  )
) {}

/**
 * Companion namespace for {@link HumanReadableDuration}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HumanReadableDuration {
  /**
   * Encoded (wire) form of {@link HumanReadableDuration}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "humanReadable";
    readonly showFullUnits?: boolean;
  }
}

/**
 * Duration printed as a clock-style timecode, such as "01:01:01".
 *
 * @category models
 * @since 0.0.0
 */
export class TimecodeDuration extends S.Opaque<TimecodeDuration, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("timecode") }).pipe(
    $I.annoteSchema("TimecodeDuration", {
      description: "Duration printed as a clock-style timecode, such as 01:01:01.",
    })
  )
) {}

/**
 * Companion namespace for {@link TimecodeDuration}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TimecodeDuration {
  /**
   * Encoded (wire) form of {@link TimecodeDuration}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "timecode";
  }
}

/**
 * How the parts of a duration are laid out when it is printed.
 *
 * **Example** (Encode a duration style)
 *
 * ```ts import.meta.vitest name="Encode a duration style"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { DurationFormatStyle } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const style = DurationFormatStyle.cases.humanReadable.make({ showFullUnits: O.some(true) })
 * const wire = await Effect.runPromise(S.encodeEffect(DurationFormatStyle)(style))
 * wire // => { type: "humanReadable", showFullUnits: true }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DurationFormatStyle = DurationFormatStyleKind.mapMembers(() =>
  Tuple.make(HumanReadableDuration, TimecodeDuration)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DurationFormatStyle", {
    description: "How the parts of a duration are laid out when it is printed.",
  })
);

/**
 * Runtime type of {@link DurationFormatStyle}.
 *
 * @category models
 * @since 0.0.0
 */
export type DurationFormatStyle = typeof DurationFormatStyle.Type;

/**
 * Companion namespace for {@link DurationFormatStyle}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DurationFormatStyle {
  /**
   * Encoded (wire) form of {@link DurationFormatStyle}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | HumanReadableDuration.Encoded
    | TimecodeDuration.Encoded;
}

// -----------------------------------------------------------------------------
// Number formats
// -----------------------------------------------------------------------------

/**
 * Number printed as it is, with no unit and no scaling.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatStandard extends S.Opaque<NumberFormatStandard, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("standard"),
    baseFormatOptions: BaseFormatOptions,
  }).pipe(
    $I.annoteSchema("NumberFormatStandard", {
      description: "Number printed as it is, with no unit and no scaling.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatStandard}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatStandard {
  /**
   * Encoded (wire) form of {@link NumberFormatStandard}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "standard";
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
  }
}

const FixedValueKey = S.String.check(
  S.isPattern(
    /^-?[0-9]+$/,
    $I.annote("FixedValueKeyCheck", {
      title: "Fixed Value Key",
      description: "An integer written in base ten, the stored number a label stands for.",
      message: "Expected an integer key such as 1 or -3",
    })
  )
);

// The wire guarantees integer keys. A record schema with a restricted key silently drops the keys
// that do not match, so the guarantee is checked on the encoded record, where every key is visible.
const FixedValueLabels = S.Record(S.String, S.String)
  .check(
    S.isPropertyNames(
      FixedValueKey,
      $I.annote("FixedValueKeysCheck", {
        title: "Fixed Value Keys",
        description: "A label table whose every key is an integer written in base ten.",
        message: "Every key of a fixed-value table must be an integer",
      })
    )
  )
  .pipe(S.decodeTo(S.Record(FixedValueKey, S.String)));

/**
 * Number replaced by a label looked up in a fixed table, such as 2 printed as "Second".
 *
 * **Details**
 *
 * A stored number with no entry in the table has no label. JSON object keys
 * are strings, so the integer keys travel, and are kept, as decimal strings.
 *
 * @invariant Every key of `values` is an integer written in base ten.
 * @category models
 * @since 0.0.0
 */
export class NumberFormatFixedValues extends S.Opaque<NumberFormatFixedValues, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("fixedValues"),
    values: FixedValueLabels.annotateKey({
      description: "Label for each stored integer, keyed by the integer written in base ten.",
    }),
  }).pipe(
    $I.annoteSchema("NumberFormatFixedValues", {
      description: "Number replaced by a label looked up in a fixed table of integers.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatFixedValues}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatFixedValues {
  /**
   * Encoded (wire) form of {@link NumberFormatFixedValues}: the label table keyed by integers written as decimal
   * strings.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "fixedValues";
    readonly values: R.ReadonlyRecord<string, string>;
  }
}

/**
 * Number printed as an amount of money in a currency.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatCurrency extends S.Opaque<NumberFormatCurrency, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("currency"),
    baseFormatOptions: BaseFormatOptions,
    style: CurrencyStyle.annotateKey({ description: "Whether the amount is written in full or compacted." }),
    currencyCode: PropertyOrConstant.annotateKey({
      description: "ISO 4217 code of the currency, fixed or read from a sibling property.",
    }),
  }).pipe(
    $I.annoteSchema("NumberFormatCurrency", {
      description: "Number printed as an amount of money in a currency.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatCurrency}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatCurrency {
  /**
   * Encoded (wire) form of {@link NumberFormatCurrency}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "currency";
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
    readonly style: CurrencyStyle.Encoded;
    readonly currencyCode: PropertyOrConstant.Encoded;
  }
}

/**
 * Number printed with a unit the locale knows how to write, such as `meter` or `celsius`.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatStandardUnit extends S.Opaque<NumberFormatStandardUnit, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("standardUnit"),
    baseFormatOptions: BaseFormatOptions,
    unit: PropertyOrConstant.annotateKey({
      description: "Unit identifier understood by Intl.NumberFormat, fixed or read from a sibling property.",
    }),
  }).pipe(
    $I.annoteSchema("NumberFormatStandardUnit", {
      description: "Number printed with a unit the locale knows how to write, such as meter or celsius.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatStandardUnit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatStandardUnit {
  /**
   * Encoded (wire) form of {@link NumberFormatStandardUnit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "standardUnit";
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
    readonly unit: PropertyOrConstant.Encoded;
  }
}

/**
 * Number printed with a free-text unit after it, such as "1,500 widgets".
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatCustomUnit extends S.Opaque<NumberFormatCustomUnit, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("customUnit"),
    baseFormatOptions: BaseFormatOptions,
    unit: PropertyOrConstant.annotateKey({
      description: "Free-text unit printed after the number, fixed or read from a sibling property.",
    }),
  }).pipe(
    $I.annoteSchema("NumberFormatCustomUnit", {
      description: "Number printed with a free-text unit after it, such as 1,500 widgets.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatCustomUnit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatCustomUnit {
  /**
   * Encoded (wire) form of {@link NumberFormatCustomUnit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "customUnit";
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
    readonly unit: PropertyOrConstant.Encoded;
  }
}

/**
 * Number printed between arbitrary text.
 *
 * **Details**
 *
 * The wire nests the two sides under a key also called `affix`; the domain
 * calls that record `decoration` so the case does not read `affix.affix`.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatAffix extends S.Opaque<NumberFormatAffix, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("affix"),
    baseFormatOptions: BaseFormatOptions,
    // Text printed directly before and after the number.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    decoration: Affix,
  }).pipe(
    S.encodeKeys({ decoration: "affix" }),
    $I.annoteSchema("NumberFormatAffix", { description: "Number printed between arbitrary text." })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatAffix}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatAffix {
  /**
   * Encoded (wire) form of {@link NumberFormatAffix}: `decoration` travels as `affix`.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "affix";
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
    readonly affix: Affix.Encoded;
  }
}

/**
 * Number that counts seconds or milliseconds, printed as a duration.
 *
 * **Details**
 *
 * The wire calls the unit of the stored number `baseValue`; the domain calls
 * it `inputUnit`, because it is a unit and not a value. This format takes no
 * {@link NumberFormatOptions}.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatDuration extends S.Opaque<NumberFormatDuration, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("duration"),
    formatStyle: DurationFormatStyle.annotateKey({ description: "How the parts of the duration are laid out." }),
    precision: S.OptionFromOptionalKey(DurationPrecision).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Finest unit shown, absent for the platform default." })
    ),
    inputUnit: DurationInputUnit.annotateKey({ description: "Unit the stored number is counted in." }),
  }).pipe(
    S.encodeKeys({ inputUnit: "baseValue" }),
    $I.annoteSchema("NumberFormatDuration", {
      description: "Number that counts seconds or milliseconds, printed as a duration.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatDuration}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatDuration {
  /**
   * Encoded (wire) form of {@link NumberFormatDuration}: `inputUnit` travels as `baseValue`.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "duration";
    readonly formatStyle: DurationFormatStyle.Encoded;
    readonly precision?: DurationPrecision.Encoded;
    readonly baseValue: DurationInputUnit.Encoded;
  }
}

/**
 * Number divided by a power of ten and printed with a magnitude suffix, such as 1500 as "1.5K".
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatScale extends S.Opaque<NumberFormatScale, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("scale"),
    scaleType: NumberScale.annotateKey({ description: "Power of ten the number is divided by." }),
    baseFormatOptions: BaseFormatOptions,
  }).pipe(
    $I.annoteSchema("NumberFormatScale", {
      description: "Number divided by a power of ten and printed with a magnitude suffix.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatScale}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatScale {
  /**
   * Encoded (wire) form of {@link NumberFormatScale}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "scale";
    readonly scaleType: NumberScale.Encoded;
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
  }
}

/**
 * Fraction multiplied up and printed as a proportion, such as 0.15 as "15%".
 *
 * @category models
 * @since 0.0.0
 */
export class NumberFormatRatio extends S.Opaque<NumberFormatRatio, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("ratio"),
    ratioType: NumberRatio.annotateKey({ description: "Proportion the fraction is printed as." }),
    baseFormatOptions: BaseFormatOptions,
  }).pipe(
    $I.annoteSchema("NumberFormatRatio", {
      description: "Fraction multiplied up and printed as a proportion, such as a percentage.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberFormatRatio}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormatRatio {
  /**
   * Encoded (wire) form of {@link NumberFormatRatio}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "ratio";
    readonly ratioType: NumberRatio.Encoded;
    readonly baseFormatOptions: NumberFormatOptions.Encoded;
  }
}

/**
 * How a number is printed: plain, as a label, with a unit, between text, as a duration, scaled or as a ratio.
 *
 * **Details**
 *
 * Seven of the nine cases carry {@link NumberFormatOptions}; `fixedValues` and
 * `duration` replace the number entirely and do not. `baseFormatOptions`
 * defaults to no settings in `make`, so `NumberFormat.cases.standard.make({})`
 * is the plain format.
 *
 * **Example** (Encode a currency format)
 *
 * ```ts import.meta.vitest name="Encode a currency format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { NumberFormat, PropertyOrConstant } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const euros = NumberFormat.cases.currency.make({
 *   style: "standard",
 *   currencyCode: PropertyOrConstant.cases.constant.make({ value: "EUR" }),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(NumberFormat)(euros))
 * wire // => { type: "currency", baseFormatOptions: {}, style: "STANDARD", currencyCode: { type: "constant", value: "EUR" } }
 * ```
 *
 * **Example** (Tell which formats keep the number visible)
 *
 * ```ts import.meta.vitest name="Tell which formats keep the number visible"
 * import * as A from "effect/Array"
 * import { NumberFormat } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const replacesNumber = NumberFormat.isAnyOf(["fixedValues", "duration"])
 * const formats = [
 *   NumberFormat.cases.standard.make({}),
 *   NumberFormat.cases.fixedValues.make({ values: { "1": "First", "2": "Second" } }),
 * ]
 * const flags = A.map(formats, (format) => replacesNumber(format))
 * flags // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberFormat = NumberFormatKind.mapMembers(() =>
  Tuple.make(
    NumberFormatStandard,
    NumberFormatFixedValues,
    NumberFormatCurrency,
    NumberFormatStandardUnit,
    NumberFormatCustomUnit,
    NumberFormatAffix,
    NumberFormatDuration,
    NumberFormatScale,
    NumberFormatRatio
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("NumberFormat", {
    description:
      "How a number is printed: plain, labelled, with a unit, between text, as a duration, scaled or as a ratio.",
  })
);

/**
 * Runtime type of {@link NumberFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberFormat = typeof NumberFormat.Type;

/**
 * Companion namespace for {@link NumberFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberFormat {
  /**
   * Encoded (wire) form of {@link NumberFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | NumberFormatStandard.Encoded
    | NumberFormatFixedValues.Encoded
    | NumberFormatCurrency.Encoded
    | NumberFormatStandardUnit.Encoded
    | NumberFormatCustomUnit.Encoded
    | NumberFormatAffix.Encoded
    | NumberFormatDuration.Encoded
    | NumberFormatScale.Encoded
    | NumberFormatRatio.Encoded;
}

// -----------------------------------------------------------------------------
// Dates and instants
// -----------------------------------------------------------------------------

const DatetimeFormatKind = LiteralKit(["stringFormat", "localizedFormat"]);

/**
 * Date or instant printed with a custom pattern.
 *
 * @category models
 * @since 0.0.0
 */
export class DatetimeStringFormat extends S.Opaque<DatetimeStringFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("stringFormat"),
    pattern: S.String.annotateKey({ description: "Date format pattern the value is printed with." }),
  }).pipe(
    $I.annoteSchema("DatetimeStringFormat", {
      description: "Date or instant printed with a custom pattern.",
    })
  )
) {}

/**
 * Companion namespace for {@link DatetimeStringFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeStringFormat {
  /**
   * Encoded (wire) form of {@link DatetimeStringFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "stringFormat";
    readonly pattern: string;
  }
}

/**
 * Date or instant printed with one of the predefined, locale-aware presets.
 *
 * **Details**
 *
 * The wire keeps the preset under a key called `format`, inside a value that
 * is itself the `format` of its rule; the domain calls it `preset`.
 *
 * @category models
 * @since 0.0.0
 */
export class DatetimeLocalizedFormat extends S.Opaque<DatetimeLocalizedFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("localizedFormat"),
    preset: DatetimePreset.annotateKey({ description: "Which predefined rendering to use." }),
  }).pipe(
    S.encodeKeys({ preset: "format" }),
    $I.annoteSchema("DatetimeLocalizedFormat", {
      description: "Date or instant printed with one of the predefined, locale-aware presets.",
    })
  )
) {}

/**
 * Companion namespace for {@link DatetimeLocalizedFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeLocalizedFormat {
  /**
   * Encoded (wire) form of {@link DatetimeLocalizedFormat}: `preset` travels as `format`.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "localizedFormat";
    readonly format: DatetimePreset.Encoded;
  }
}

/**
 * How a calendar date or an instant is printed: by a custom pattern or by a locale-aware preset.
 *
 * **Example** (Decode a preset format)
 *
 * ```ts import.meta.vitest name="Decode a preset format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DatetimeFormat } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const format = await Effect.runPromise(
 *   S.decodeEffect(DatetimeFormat)({ type: "localizedFormat", format: "DATE_FORMAT_DATE_TIME" })
 * )
 * const label = DatetimeFormat.match(format, {
 *   stringFormat: ({ pattern }) => `pattern ${pattern}`,
 *   localizedFormat: ({ preset }) => `preset ${preset}`,
 * })
 * label // => "preset dateFormatDateTime"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimeFormat = DatetimeFormatKind.mapMembers(() =>
  Tuple.make(DatetimeStringFormat, DatetimeLocalizedFormat)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DatetimeFormat", {
    description: "How a calendar date or an instant is printed: by a custom pattern or by a locale-aware preset.",
  })
);

/**
 * Runtime type of {@link DatetimeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimeFormat = typeof DatetimeFormat.Type;

/**
 * Companion namespace for {@link DatetimeFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeFormat {
  /**
   * Encoded (wire) form of {@link DatetimeFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | DatetimeStringFormat.Encoded
    | DatetimeLocalizedFormat.Encoded;
}

const DatetimeTimezoneKind = LiteralKit(["static", "user"]);

/**
 * One fixed time zone for every viewer, given as text or read from a sibling property.
 *
 * @category models
 * @since 0.0.0
 */
export class StaticTimezone extends S.Opaque<StaticTimezone, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("static"),
    zoneId: PropertyOrConstant.annotateKey({
      description: "IANA time zone identifier, fixed or read from a sibling property.",
    }),
  }).pipe(
    $I.annoteSchema("StaticTimezone", {
      description: "One fixed time zone for every viewer, given as text or read from a sibling property.",
    })
  )
) {}

/**
 * Companion namespace for {@link StaticTimezone}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StaticTimezone {
  /**
   * Encoded (wire) form of {@link StaticTimezone}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "static";
    readonly zoneId: PropertyOrConstant.Encoded;
  }
}

/**
 * The time zone of whoever is looking at the value.
 *
 * @category models
 * @since 0.0.0
 */
export class UserTimezone extends S.Opaque<UserTimezone, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("user") }).pipe(
    $I.annoteSchema("UserTimezone", { description: "The time zone of whoever is looking at the value." })
  )
) {}

/**
 * Companion namespace for {@link UserTimezone}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UserTimezone {
  /**
   * Encoded (wire) form of {@link UserTimezone}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "user";
  }
}

/**
 * Time zone an instant is printed in: one fixed zone, or each viewer's own.
 *
 * **Example** (Tell a fixed zone from the viewer's zone)
 *
 * ```ts import.meta.vitest name="Tell a fixed zone from the viewer's zone"
 * import * as A from "effect/Array"
 * import { DatetimeTimezone, PropertyOrConstant } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const zones = [
 *   DatetimeTimezone.cases.user.make({}),
 *   DatetimeTimezone.cases.static.make({ zoneId: PropertyOrConstant.cases.constant.make({ value: "Europe/Rome" }) }),
 * ]
 * const fixed = A.map(zones, (zone) => DatetimeTimezone.guards.static(zone))
 * fixed // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimeTimezone = DatetimeTimezoneKind.mapMembers(() => Tuple.make(StaticTimezone, UserTimezone)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DatetimeTimezone", {
    description: "Time zone an instant is printed in: one fixed zone, or each viewer's own.",
  })
);

/**
 * Runtime type of {@link DatetimeTimezone}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimeTimezone = typeof DatetimeTimezone.Type;

/**
 * Companion namespace for {@link DatetimeTimezone}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DatetimeTimezone {
  /**
   * Encoded (wire) form of {@link DatetimeTimezone}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | StaticTimezone.Encoded
    | UserTimezone.Encoded;
}

// -----------------------------------------------------------------------------
// Value formats
// -----------------------------------------------------------------------------

/**
 * Rule that prints a numeric property with a {@link NumberFormat}.
 *
 * **Details**
 *
 * The wire keeps the number format under `numberType`, a second discriminator
 * next to `type`; the domain calls it `format`, as the date and timestamp rules do.
 *
 * @category models
 * @since 0.0.0
 */
export class NumberValueFormat extends S.Opaque<NumberValueFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("number"),
    format: NumberFormat.annotateKey({ description: "How the number is printed." }),
  }).pipe(
    S.encodeKeys({ format: "numberType" }),
    $I.annoteSchema("NumberValueFormat", {
      description: "Rule that prints a numeric property with a number format.",
    })
  )
) {}

/**
 * Companion namespace for {@link NumberValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NumberValueFormat {
  /**
   * Encoded (wire) form of {@link NumberValueFormat}: `format` travels as `numberType`.
.   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "number";
    readonly numberType: NumberFormat.Encoded;
  }
}

/**
 * Rule that prints an instant with a {@link DatetimeFormat} in a chosen time zone.
 *
 * @category models
 * @since 0.0.0
 */
export class TimestampValueFormat extends S.Opaque<TimestampValueFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("timestamp"),
    format: DatetimeFormat.annotateKey({ description: "How the instant is printed." }),
    displayTimezone: DatetimeTimezone.annotateKey({ description: "Time zone the instant is printed in." }),
  }).pipe(
    $I.annoteSchema("TimestampValueFormat", {
      description: "Rule that prints an instant with a datetime format in a chosen time zone.",
    })
  )
) {}

/**
 * Companion namespace for {@link TimestampValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TimestampValueFormat {
  /**
   * Encoded (wire) form of {@link TimestampValueFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "timestamp";
    readonly format: DatetimeFormat.Encoded;
    readonly displayTimezone: DatetimeTimezone.Encoded;
  }
}

/**
 * Rule that prints a calendar date with a {@link DatetimeFormat}; a date has no time zone to choose.
 *
 * @category models
 * @since 0.0.0
 */
export class DateValueFormat extends S.Opaque<DateValueFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("date"),
    format: DatetimeFormat.annotateKey({ description: "How the date is printed." }),
  }).pipe(
    $I.annoteSchema("DateValueFormat", {
      description: "Rule that prints a calendar date with a datetime format.",
    })
  )
) {}

/**
 * Companion namespace for {@link DateValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DateValueFormat {
  /**
   * Encoded (wire) form of {@link DateValueFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "date";
    readonly format: DatetimeFormat.Encoded;
  }
}

/**
 * Rule that prints a boolean as one of two fixed texts.
 *
 * @category models
 * @since 0.0.0
 */
export class BooleanValueFormat extends S.Opaque<BooleanValueFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("boolean"),
    valueIfTrue: S.String.annotateKey({ description: "Text printed for true." }),
    valueIfFalse: S.String.annotateKey({ description: "Text printed for false." }),
  }).pipe(
    $I.annoteSchema("BooleanValueFormat", {
      description: "Rule that prints a boolean as one of two fixed texts.",
    })
  )
) {}

/**
 * Companion namespace for {@link BooleanValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BooleanValueFormat {
  /**
   * Encoded (wire) form of {@link BooleanValueFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "boolean";
    readonly valueIfTrue: string;
    readonly valueIfFalse: string;
  }
}

/**
 * Rule that prints a string holding a platform identifier as the thing it identifies.
 *
 * @category models
 * @since 0.0.0
 */
export class KnownTypeValueFormat extends S.Opaque<KnownTypeValueFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("knownType"),
    knownType: KnownType.annotateKey({ description: "Kind of platform identifier the string holds." }),
  }).pipe(
    $I.annoteSchema("KnownTypeValueFormat", {
      description: "Rule that prints a string holding a platform identifier as the thing it identifies.",
    })
  )
) {}

/**
 * Companion namespace for {@link KnownTypeValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace KnownTypeValueFormat {
  /**
   * Encoded (wire) form of {@link KnownTypeValueFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "knownType";
    readonly knownType: KnownType.Encoded;
  }
}

/**
 * The display-formatting rule of a property: how applications print its value.
 *
 * **Details**
 *
 * A rule is pure display metadata: it never changes the stored value, and it
 * only says how a single value of the matching kind is printed.
 *
 * **Example** (Decode a formatting rule from the platform)
 *
 * ```ts import.meta.vitest name="Decode a formatting rule from the platform"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ValueFormat } from "@beep/scratchpad/osdk/src/ValueFormat/index"
 *
 * const rule = await Effect.runPromise(
 *   S.decodeEffect(ValueFormat)({
 *     type: "number",
 *     numberType: { type: "ratio", ratioType: "PERCENTAGE", baseFormatOptions: { maximumFractionDigits: 1 } },
 *   })
 * )
 * const summary = ValueFormat.match(rule, {
 *   number: ({ format }) => `number (${format.type})`,
 *   timestamp: () => "timestamp",
 *   date: () => "date",
 *   boolean: ({ valueIfTrue, valueIfFalse }) => `${valueIfTrue} or ${valueIfFalse}`,
 *   knownType: ({ knownType }) => `identifier of a ${knownType}`,
 * })
 * summary // => "number (ratio)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValueFormat = ValueFormatKind.mapMembers(() =>
  Tuple.make(NumberValueFormat, TimestampValueFormat, DateValueFormat, BooleanValueFormat, KnownTypeValueFormat)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ValueFormat", {
    description: "The display-formatting rule of a property: how applications print its value.",
  })
);

/**
 * Runtime type of {@link ValueFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValueFormat = typeof ValueFormat.Type;

/**
 * Companion namespace for {@link ValueFormat}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValueFormat {
  /**
   * Encoded (wire) form of {@link ValueFormat}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | NumberValueFormat.Encoded
    | TimestampValueFormat.Encoded
    | DateValueFormat.Encoded
    | BooleanValueFormat.Encoded
    | KnownTypeValueFormat.Encoded;
}
