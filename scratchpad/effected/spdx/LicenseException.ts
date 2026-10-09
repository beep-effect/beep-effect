import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ACTIVE_EXCEPTION_IDS, DEPRECATED_EXCEPTION_ID_LIST, DEPRECATED_EXCEPTION_IDS } from "./internal/exceptions.ts";
import { InvalidSpdxExpressionError } from "./License.ts";

const $I = $ScratchpadId.create("effected/spdx/LicenseException");

/**
 * A validated SPDX license-exception identifier: an Effect `Schema.Class` whose
 * `id` is a member of the SPDX exception list. The class doubles as its own
 * schema.
 *
 * **Details**
 *
 * Unlike {@link License}, an exception has no reference grammar — an exception
 * identifier is valid only when it is a catalog member. Construction goes
 * through {@link LicenseException.parse} (Effect) or
 * {@link LicenseException.parseResult} (the synchronous `Result` primitive);
 * the inherited `make` remains the field-level struct constructor. Validation
 * failures reuse {@link InvalidSpdxExpressionError}, the package's single error.
 *
 * **Example** (Parse a license exception identifier)
 *
 * ```ts
 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const e = yield* LicenseException.parse("Classpath-exception-2.0");
 *   return e.id;
 * });
 *
 * console.log(Effect.runSync(program)); // Classpath-exception-2.0
 * ```
 *
 * @see {@link https://spdx.org/licenses/exceptions-index.html | SPDX Exceptions List} for the catalog of SPDX license exceptions
 * @public
 * @category models
 * @since 0.0.0
 */
export class LicenseException extends S.Class<LicenseException>($I`LicenseException`)({
	/**
	 * The SPDX exception short identifier (e.g. `"Classpath-exception-2.0"`).
	 *
	 * **Example** (Read the SPDX identifier)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.of("Classpath-exception-2.0").id); // Classpath-exception-2.0
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	id: S.String.annotateKey({ description: "The SPDX exception short identifier (e.g. `\"Classpath-exception-2.0\"`)." }),
	/**
	 * Whether `id` is a deprecated SPDX exception identifier.
	 *
	 * **Example** (Read the deprecation flag)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.of("Classpath-exception-2.0").deprecated); // false
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	deprecated: S.Boolean.annotateKey({ description: "Whether `id` is a deprecated SPDX exception identifier." }),
}, $I.annote("LicenseException", { description: "A validated SPDX license-exception identifier: an Effect `Schema.Class` whose `id` is a member of the SPDX exception list. The class doubles as its own schema." })) {
	// ── Catalog ─────────────────────────────────────────────────────────

	/**
	 * The full SPDX exception catalog keyed by identifier, holding resolved
	 * {@link LicenseException} domain objects for every active and deprecated
	 * id. Built once from the vendored datasets at module load.
	 *
	 * **Example** (Find an identifier in the catalog)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 * import * as HashMap from "effect/HashMap";
	 *
	 * console.log(HashMap.has(LicenseException.catalog, "Classpath-exception-2.0")); // true
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly catalog: HashMap.HashMap<string, LicenseException> = HashMap.fromIterable([
		...A.map(ACTIVE_EXCEPTION_IDS, (id): readonly [string, LicenseException] => [
			id,
			LicenseException.make({ id, deprecated: false }),
		]),
		...A.map(DEPRECATED_EXCEPTION_ID_LIST, (id): readonly [string, LicenseException] => [
			id,
			LicenseException.make({ id, deprecated: true }),
		]),
	]);

	/**
	 * Whether `id` is a recognized SPDX exception identifier — active or
	 * deprecated.
	 *
	 * **Example** (Distinguish catalog membership)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.isKnownId("Classpath-exception-2.0")); // true
	 * console.log(LicenseException.isKnownId("LicenseRef-Acme")); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static isKnownId(id: string): boolean {
		return HashMap.has(LicenseException.catalog, id);
	}

	/**
	 * Whether `id` is specifically a deprecated SPDX exception identifier.
	 *
	 * **Example** (Check an active identifier for deprecation)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.isDeprecatedId("Classpath-exception-2.0")); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static isDeprecatedId(id: string): boolean {
		return HashSet.has(DEPRECATED_EXCEPTION_IDS, id);
	}

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Validate an exception identifier synchronously, returning a `Result`. The
	 * `id` is accepted only when it is a catalog member (active or deprecated);
	 * anything else fails with {@link InvalidSpdxExpressionError}.
	 *
	 * **Details**
	 *
	 * {@link LicenseException.parse} is defined in terms of this function; the
	 * two never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `LicenseException.parse` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * **Example** (Validate an identifier synchronously)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 * import * as Result from "effect/Result";
	 *
	 * console.log(Result.isSuccess(LicenseException.parseResult("Classpath-exception-2.0"))); // true
	 * console.log(Result.isFailure(LicenseException.parseResult("unknown"))); // true
	 * ```
	 *
	 * @param id - the exception identifier to validate
	 * @returns a `Result` succeeding with the resolved {@link LicenseException},
	 * or failing with {@link InvalidSpdxExpressionError}.
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(id: string): Result.Result<LicenseException, InvalidSpdxExpressionError> {
		const known = HashMap.get(LicenseException.catalog, id);
		if (O.isSome(known)) return Result.succeed(known.value);
		return Result.fail(InvalidSpdxExpressionError.make({ input: id }));
	}

	/**
	 * Validate an exception identifier. Defined in terms of
	 * {@link LicenseException.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * **Example** (Validate an identifier in an Effect)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(LicenseException.parse("Classpath-exception-2.0")).id); // Classpath-exception-2.0
	 * ```
	 *
	 * @param id - the exception identifier to validate
	 * @returns the resolved {@link LicenseException}. Fails with
	 * {@link InvalidSpdxExpressionError} when `id` is not a catalog member.
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("LicenseException.parse")((id: string) =>
		Effect.fromResult(LicenseException.parseResult(id)),
	);

	/**
	 * Construct a {@link LicenseException} directly from already-typed parts:
	 * `LicenseException.of("Classpath-exception-2.0")`. This is the field-level
	 * convenience constructor, a thin wrapper over the inherited `make` — it does
	 * **not** consult the catalog and does **not** validate that `id` is a known
	 * exception identifier. Reach for {@link LicenseException.parse} or
	 * {@link LicenseException.parseResult} when the `id` is untrusted and must be
	 * validated.
	 *
	 * **Example** (Construct an identifier without catalog validation)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.of("unknown").id); // unknown
	 * ```
	 *
	 * @param id - the SPDX exception short identifier
	 * @param deprecated - whether `id` is a deprecated identifier; defaults to
	 * `false`
	 * @returns the constructed {@link LicenseException}
	 * @category constructors
	 * @since 0.0.0
	 */
	static of(id: string, deprecated = false): LicenseException {
		return LicenseException.make({ id, deprecated });
	}

	// ── Display ─────────────────────────────────────────────────────────

	/**
	 * Returns the SPDX identifier for display without adding expression operators.
	 *
	 * **Example** (Display the identifier)
	 *
	 * ```ts
	 * import { LicenseException } from "@beep/scratchpad/effected/spdx/LicenseException";
	 *
	 * console.log(LicenseException.of("Classpath-exception-2.0").toString()); // Classpath-exception-2.0
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	override toString(): string {
		return this.id;
	}
}
