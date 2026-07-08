/**
 * TODO:MODULE_DESCRIPTION
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import {LiteralKit} from "@beep/schema";

const $I = $ScratchpadId.create("aggregation/Aggregation.models.ts");

/**
 * TODO:DESCRIPTION
 *
 * **When to use**
 *
 * TODO:WHEN_TO_USE
 *
 * **Gotchas**
 *
 * TODO:GOTCHAS
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {BaseAggregationOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = BaseAggregationOption.Model.make("approximateDistinct");
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BaseAggregationOption = LiteralKit([
	"approximateDistinct",
	"exactDistinct",
]).pipe($I.annoteSchema("BaseAggregationOption", {
	description: "",
}))

/**
 * Companion runtime type for {@link BaseAggregationOption}
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {BaseAggregationOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = BaseAggregationOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseAggregationOption = typeof BaseAggregationOption.Type;

/**
 * TODO:DESCRIPTION
 *
 * **When to use**
 *
 * TODO:WHEN_TO_USE
 *
 * **Gotchas**
 *
 * TODO:GOTCHAS
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {MinMaxAggregateOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = MinMaxAggregateOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MinMaxAggregateOption = LiteralKit([
	"min",
	"max",
]).pipe($I.annoteSchema("MinMaxAggregateOption", {
	description: "",
}))

/**
 * Companion runtime type for {@link MinMaxAggregateOption}
 *
 * @category models
 * @since 0.0.0
 */
export type MinMaxAggregateOption = typeof MinMaxAggregateOption.Type;

/**
 * TODO:DESCRIPTION
 *
 * **When to use**
 *
 * TODO:WHEN_TO_USE
 *
 * **Gotchas**
 *
 * TODO:GOTCHAS
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {DatetimeAggregateOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = DatetimeAggregateOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DatetimeAggregateOption = LiteralKit([
	...MinMaxAggregateOption.Options,
	...BaseAggregationOption.Options,
]).pipe($I.annoteSchema("DatetimeAggregateOption", {
	description: "",
}))

/**
 * Companion runtime type for {@link DatetimeAggregateOption}
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {DatetimeAggregateOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = DatetimeAggregateOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DatetimeAggregateOption = typeof DatetimeAggregateOption.Type;


/**
 * TODO:DESCRIPTION
 *
 * **When to use**
 *
 * TODO:WHEN_TO_USE
 *
 * **Gotchas**
 *
 * TODO:GOTCHAS
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {NumericAggregateOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = NumericAggregateOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumericAggregateOption = LiteralKit([
	...MinMaxAggregateOption.Options,
	"sum",
	"avg",
	"approximateDistinct",
	"exactDistinct",
]).pipe($I.annoteSchema("NumericAggregateOption", {
	description: "",
}))

/**
 * Companion runtime type for {@link NumericAggregateOption}
 *
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 *
 * ```ts
 * import {NumericAggregateOption} from "@beep/osdk/aggregation/Aggregation.model";
 *
 * const thing = NumericAggregateOption.Model.make();
 *
 * console.log(thing);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NumericAggregateOption = typeof NumericAggregateOption.Type;


export const PossibleWhereClauseFilter = LiteralKit([
	"$gt",
	"$eq",
	"$ne",
	"$isNull",
	"$contains",
	"$gte",
	"$lt",
	"$lte",
	"$within",
	"$in",
	"$intersects",
	"$startsWith",
	"$containsAllTermsInOrder",
	"$containsAnyTerm",
	"$containsAllTerms",
	"$interval",
	"$matchesRegex",
]).pipe($I.annoteSchema("PossibleWhereClauseFilter", {
	description: "",
}))

export type PossibleWhereClauseFilter = typeof PossibleWhereClauseFilter.Type;


export const DistanceUnit = LiteralKit([
	"centimeter",
	"centimeters",
	"cm",
	"meter",
	"meters",
	"m",
	"kilometer",
	"kilometers",
	"km",
	"inch",
	"inches",
	"foot",
	"feet",
	"yard",
	"yards",
	"mile",
	"miles",
	"nautical_mile",
	"nauticalMile",
	"nautical miles",
]).pipe($I.annoteSchema("DistanceUnit", {
	description: "",
}))

export type DistanceUnit = typeof DistanceUnit.Type;

export const DistanceUnitMapping = DistanceUnit.transform([
	"CENTIMETERS",
	"CENTIMETERS",
	"CENTIMETERS",
	"METERS",
	"METERS",
	"METERS",
	"KILOMETERS",
	"KILOMETERS",
	"KILOMETERS",
	"INCHES",
	"INCHES",
	"FEET",
	"FEET",
	"YARDS",
	"YARDS",
	"MILES",
	"MILES",
	"NAUTICAL_MILES",
	"NAUTICAL_MILES",
	"NAUTICAL_MILES",
]).pipe($I.annoteSchema("DistanceUnitMapping", {
	description: "",
}))

export type DistanceUnitMapping = typeof DistanceUnitMapping.Type;

export declare namespace DistanceUnit {
	export type Encoded = typeof DistanceUnit.Encoded
}

export const WhereClauseNumberPropertyType = LiteralKit(
	[
		"double",
		"integer",
		"long",
		"float",
		"decimal",
		"byte",
	]
).pipe($I.annoteSchema("WhereClauseNumberPropertyType", {
	description: "",
}))

export type WhereClauseNumberPropertyType = typeof WhereClauseNumberPropertyType.Type;