// SPDX license validation: the `SpdxLicense` branded schema (accepting real
// SPDX expressions plus the `UNLICENSED` and `SEE LICENSE IN` special cases)
// and the `InvalidSpdxLicenseError` the concept raises.

import { $ScratchpadId } from "@beep/identity/packages";
import type { SpdxExpression } from "../spdx/index.ts";
import { SpdxExpression as SpdxExpressionOps, isValidExpression } from "../spdx/index.ts";
import type * as Brand from "effect/Brand";
import type * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/package-json/License");

/**
 * Indicates that a string is not a valid SPDX license identifier or expression.
 *
 * **Details**
 *
 * Raised by {@link Package.setLicense} and the decode direction of
 * `SpdxLicense`. The offending string is preserved on `input`.
 *
 * **Example** (Inspect an invalid license error)
 *
 * ```ts
 * import { InvalidSpdxLicenseError } from "@beep/scratchpad/effected/package-json/License";
 *
 * const error = new InvalidSpdxLicenseError({ input: "not-a-license" });
 * console.log(error.input); // not-a-license
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidSpdxLicenseError extends S.TaggedError<InvalidSpdxLicenseError>($I`InvalidSpdxLicenseError`)("InvalidSpdxLicenseError", {
	/**
	 * The raw input string that failed validation.
	 *
	 * **Example** (Recover the rejected input)
	 *
	 * ```ts
	 * import { InvalidSpdxLicenseError } from "@beep/scratchpad/effected/package-json/License";
	 *
	 * console.log(new InvalidSpdxLicenseError({ input: "unknown" }).input); // unknown
	 * ```
	 *
	 * @since 0.0.0
	 */
	input: S.String.annotateKey({ description: "The raw input string that failed validation." }),
}, $I.annote("InvalidSpdxLicenseError", { description: "Indicates that a string is not a valid SPDX license identifier or expression." })) {
	/**
	 * Explains the validation failure and includes the rejected license string.
	 *
	 * **Example** (Read the license validation message)
	 *
	 * ```ts
	 * import { InvalidSpdxLicenseError } from "@beep/scratchpad/effected/package-json/License";
	 *
	 * const error = new InvalidSpdxLicenseError({ input: "unknown" });
	 * console.log(error.message); // Invalid SPDX license "unknown": not a recognized identifier or expression
	 * ```
	 *
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Invalid SPDX license "${this.input}": not a recognized identifier or expression`;
	}
}

/**
 * Checks whether a string is a valid SPDX license identifier or expression, or one of
 * the npm special cases `UNLICENSED` / `SEE LICENSE IN <file>`.
 *
 * **Example** (Validate expressions and npm license placeholders)
 *
 * ```ts
 * import { isValidSpdx } from "@beep/scratchpad/effected/package-json/License";
 *
 * console.log(isValidSpdx("MIT OR Apache-2.0")); // true
 * console.log(isValidSpdx("UNLICENSED")); // true
 * console.log(isValidSpdx("SEE LICENSE IN LICENSE.txt")); // true
 * console.log(isValidSpdx("not-a-license")); // false
 * ```
 *
 * @public
 * @category predicates
 * @since 0.0.0
 */
export const isValidSpdx = (value: string): boolean => {
	if (value === "UNLICENSED") return true;
	if (value.startsWith("SEE LICENSE IN ") && value.length > "SEE LICENSE IN ".length) return true;
	return isValidExpression(value);
};

/**
 * Validates and brands a manifest license string: a valid SPDX license identifier,
 * expression, `UNLICENSED`, or `SEE LICENSE IN <file>`.
 *
 * **Gotchas**
 *
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
 * **Example** (Decode manifest license strings)
 *
 * ```ts
 * import { SpdxLicense } from "@beep/scratchpad/effected/package-json/License";
 * import * as S from "effect/Schema";
 *
 * const decode = S.decodeUnknownSync(SpdxLicense);
 * console.log(decode("MIT")); // MIT
 * console.log(decode("UNLICENSED")); // UNLICENSED
 * console.log(decode("SEE LICENSE IN LICENSE.txt")); // SEE LICENSE IN LICENSE.txt
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SpdxLicense = S.String.pipe(
	S.check(
		S.makeFilterGroup([S.makeFilter((value) => (isValidSpdx(value) ? undefined : "Expected a valid SPDX license expression"), {
			identifier: $I`SpdxLicenseCheck`,
			title: "Manifest SPDX License",
			description: "A valid SPDX license identifier or expression, UNLICENSED, or SEE LICENSE IN followed by a filename.",
		})]),
	),
	S.brand("SpdxLicense"),
	// Identity annotates the group, retaining the SPDX filter's own metadata.
	$I.annoteSchema("SpdxLicense", { description: "A valid SPDX license identifier, expression, UNLICENSED, or SEE LICENSE IN <file>." }),
);

/**
 * A branded SPDX license string.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SpdxLicense = string & Brand.Brand<"SpdxLicense">;

/**
 * The parsed SPDX expression a manifest's `license` denotes, or `Option.none()`
 * when it denotes no expression at all.
 *
 * **Details**
 *
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
 * **Example** (Distinguish SPDX expressions from npm license placeholders)
 *
 * ```ts
 * import { SpdxLicense, licenseExpressionOf } from "@beep/scratchpad/effected/package-json/License";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const decode = S.decodeUnknownSync(SpdxLicense);
 *
 * console.log(O.isSome(licenseExpressionOf(decode("MIT")))); // true
 * console.log(O.isSome(licenseExpressionOf(decode("UNLICENSED")))); // false
 * console.log(O.isSome(licenseExpressionOf(decode("SEE LICENSE IN LICENSE.txt")))); // false
 * ```
 *
 * @param license - a branded manifest license value
 * @returns the parsed expression, or none for a spelling that is not one
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const licenseExpressionOf = (license: SpdxLicense): O.Option<SpdxExpression> =>
	// No explicit screen for npm's two spellings: the grammar already declines
	// them, so discarding the parse failure IS the screen. The absence is
	// load-bearing — it is why a future third npm special case needs no change
	// here.
	Result.getSuccess(SpdxExpressionOps.parseResult(license));
