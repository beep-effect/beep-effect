/**
 * SPDX license identifiers, exceptions and license expressions as Effect
 * schemas.
 *
 * {@link License} and {@link LicenseException} validate an identifier against
 * the vendored SPDX catalogs (or, for a license, the `LicenseRef-`/
 * `DocumentRef-` reference grammar); each class doubles as its own schema. The
 * {@link SpdxExpression} facade parses a full license expression into a
 * tagged-union AST — {@link LicenseNode}, {@link LicenseRefNode},
 * {@link WithExceptionNode}, {@link AndNode}, {@link OrNode} — over a hardened,
 * depth-capped parser, and its `FromString` codec re-serializes the AST to the
 * canonical, fully-parenthesized SPDX string. Malformed or unknown input fails
 * through the single typed {@link InvalidSpdxExpressionError}, never as a
 * defect.
 *
 * @example
 * ```ts
 * import { isValidExpression, SpdxExpression } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const expr = yield* SpdxExpression.parse("(MIT OR Apache-2.0+)");
 *   return [expr._tag, expr.toString()] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["Or", "(MIT OR Apache-2.0+)"]
 * console.log(isValidExpression("MIT AND"));
 * // => false
 * ```
 *
 * @see {@link https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/ | SPDX License Expressions}
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

export { InvalidSpdxExpressionError, License } from "./License.ts";
export { LicenseException } from "./LicenseException.ts";
export {
	AndNode,
	LicenseNode,
	LicenseRefNode,
	OrNode,
	SpdxExpression,
	WithExceptionNode,
	isValidExpression,
} from "./SpdxExpression.ts";
