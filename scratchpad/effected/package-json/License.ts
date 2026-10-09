// SPDX license validation: the `SpdxLicense` branded schema (accepting real
// SPDX expressions plus the `UNLICENSED` and `SEE LICENSE IN` special cases)
// and the `InvalidSpdxLicenseError` the concept raises.

import type { SpdxExpression } from "../spdx/index.ts";
import { SpdxExpression as SpdxExpressionOps, isValidExpression } from "../spdx/index.ts";
import type { Brand, Option } from "effect";
import { Result, Schema } from "effect";

/**
 * Indicates that a string is not a valid SPDX license identifier or expression.
 *
 * Raised by {@link Package.setLicense} and the decode direction of
 * `SpdxLicense`. The offending string is preserved on `input`.
 *
 * @public
 */
export class InvalidSpdxLicenseError extends Schema.TaggedError<InvalidSpdxLicenseError>()("InvalidSpdxLicenseError", {
	/** The raw input string that failed validation. */
	input: Schema.String,
}) {
	override get message(): string {
		return `Invalid SPDX license "${this.input}": not a recognized identifier or expression`;
	}
}

/**
 * Whether a string is a valid SPDX license identifier or expression, or one of
 * the npm special cases `UNLICENSED` / `SEE LICENSE IN <file>`.
 *
 * @public
 */
export const isValidSpdx = (value: string): boolean => {
	if (value === "UNLICENSED") return true;
	if (value.startsWith("SEE LICENSE IN ") && value.length > "SEE LICENSE IN ".length) return true;
	return isValidExpression(value);
};

/**
 * A valid SPDX license identifier, expression, `UNLICENSED`, or
 * `SEE LICENSE IN <file>`.
 *
 * @remarks
 * **A branded value here is not necessarily parseable as SPDX.** npm's
 * `license` field admits two strings that the SPDX grammar does not —
 * `UNLICENSED` and `SEE LICENSE IN <file>` — and this brand accepts both,
 * because it models what a manifest may legally carry, not what SPDX defines.
 * Feeding a branded value straight to `SpdxExpression.parse` therefore fails
 * on exactly those two forms. Do not hand-screen for them — reach for
 * {@link licenseExpressionOf}, which answers "what expression is this, if any"
 * and yields `Option.none()` for a spelling that is not one. Reach for
 * {@link isValidSpdx} when the question is instead "may a manifest carry this".
 *
 * @public
 */
export const SpdxLicense = Schema.String.pipe(
	Schema.check(
		Schema.makeFilter((value) => (isValidSpdx(value) ? undefined : "Expected a valid SPDX license expression")),
	),
	Schema.brand("SpdxLicense"),
);

/**
 * A branded SPDX license string.
 *
 * @public
 */
export type SpdxLicense = string & Brand.Brand<"SpdxLicense">;

/**
 * The parsed SPDX expression a manifest's `license` denotes, or `Option.none()`
 * when it denotes no expression at all.
 *
 * @remarks
 * This is the accessor to reach for whenever a branded `SpdxLicense` has
 * to become an actual expression — a license URL, a badge, structured data, a
 * policy check. It exists because the brand and the grammar disagree, so no
 * consumer has to rediscover that disagreement.
 *
 * `UNLICENSED` and `SEE LICENSE IN <file>` are legal in a manifest and are not
 * SPDX expressions, so they yield `Option.none()`. Everything else parses.
 * A consumer screening for those two spellings by hand gets it wrong the day
 * npm admits a third — this accessor is the mechanism that prose could not be,
 * and it needs no change on that day, because "not an expression" is answered
 * by the grammar rather than by a list of spellings kept in step with npm.
 *
 * @example
 * ```ts
 * import { SpdxLicense, licenseExpressionOf } from "./index.ts";
 * import { Option, Schema } from "effect";
 *
 * const decode = Schema.decodeUnknownSync(SpdxLicense);
 *
 * Option.isSome(licenseExpressionOf(decode("MIT"))); // => true
 * Option.isSome(licenseExpressionOf(decode("UNLICENSED"))); // => false
 * Option.isSome(licenseExpressionOf(decode("SEE LICENSE IN LICENSE.txt"))); // => false
 * ```
 *
 * @param license - a branded manifest license value
 * @returns the parsed expression, or none for a spelling that is not one
 *
 * @public
 */
export const licenseExpressionOf = (license: SpdxLicense): Option.Option<SpdxExpression> =>
	// No explicit screen for npm's two spellings: the grammar already declines
	// them, so discarding the parse failure IS the screen. The absence is
	// load-bearing — it is why a future third npm special case needs no change
	// here.
	Result.getSuccess(SpdxExpressionOps.parseResult(license));
