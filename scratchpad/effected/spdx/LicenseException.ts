import { Effect, Result, Schema } from "effect";
import { DEPRECATED_EXCEPTION_IDS, EXCEPTION_IDS } from "./internal/exceptions.ts";
import { InvalidSpdxExpressionError } from "./License.ts";

/**
 * A validated SPDX license-exception identifier: an Effect `Schema.Class` whose
 * `id` is a member of the SPDX exception list. The class doubles as its own
 * schema.
 *
 * Unlike {@link License}, an exception has no reference grammar — an exception
 * identifier is valid only when it is a catalog member. Construction goes
 * through {@link LicenseException.parse} (Effect) or
 * {@link LicenseException.parseResult} (the synchronous `Result` primitive);
 * the inherited `make` remains the field-level struct constructor. Validation
 * failures reuse {@link InvalidSpdxExpressionError}, the package's single error.
 *
 * @example
 * ```ts
 * import { LicenseException } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const e = yield* LicenseException.parse("Classpath-exception-2.0");
 *   return e.id;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => "Classpath-exception-2.0"
 * ```
 *
 * @see {@link https://spdx.org/licenses/exceptions-index.html | SPDX Exceptions List}
 * @public
 */
export class LicenseException extends Schema.Class<LicenseException>("LicenseException")({
	/** The SPDX exception short identifier (e.g. `"Classpath-exception-2.0"`). */
	id: Schema.String,
	/** Whether `id` is a deprecated SPDX exception identifier. */
	deprecated: Schema.Boolean,
}) {
	// ── Catalog ─────────────────────────────────────────────────────────

	/**
	 * The full SPDX exception catalog keyed by identifier, holding resolved
	 * {@link LicenseException} domain objects for every active and deprecated
	 * id. Built once from the vendored datasets at module load.
	 */
	static readonly catalog: ReadonlyMap<string, LicenseException> = (() => {
		const map = new Map<string, LicenseException>();
		for (const id of EXCEPTION_IDS) map.set(id, LicenseException.make({ id, deprecated: false }));
		for (const id of DEPRECATED_EXCEPTION_IDS) map.set(id, LicenseException.make({ id, deprecated: true }));
		return map;
	})();

	/**
	 * Whether `id` is a recognized SPDX exception identifier — active or
	 * deprecated.
	 */
	static isKnownId(id: string): boolean {
		return LicenseException.catalog.has(id);
	}

	/** Whether `id` is specifically a deprecated SPDX exception identifier. */
	static isDeprecatedId(id: string): boolean {
		return DEPRECATED_EXCEPTION_IDS.has(id);
	}

	// ── Construction ────────────────────────────────────────────────────

	/**
	 * Validate an exception identifier synchronously, returning a `Result`. The
	 * `id` is accepted only when it is a catalog member (active or deprecated);
	 * anything else fails with {@link InvalidSpdxExpressionError}.
	 *
	 * @remarks
	 * {@link LicenseException.parse} is defined in terms of this function; the
	 * two never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `LicenseException.parse` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * @param id - the exception identifier to validate
	 * @returns a `Result` succeeding with the resolved {@link LicenseException},
	 * or failing with {@link InvalidSpdxExpressionError}.
	 */
	static parseResult(id: string): Result.Result<LicenseException, InvalidSpdxExpressionError> {
		const known = LicenseException.catalog.get(id);
		if (known !== undefined) return Result.succeed(known);
		return Result.fail(InvalidSpdxExpressionError.make({ input: id }));
	}

	/**
	 * Validate an exception identifier. Defined in terms of
	 * {@link LicenseException.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * @param id - the exception identifier to validate
	 * @returns the resolved {@link LicenseException}. Fails with
	 * {@link InvalidSpdxExpressionError} when `id` is not a catalog member.
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
	 * @param id - the SPDX exception short identifier
	 * @param deprecated - whether `id` is a deprecated identifier; defaults to
	 * `false`
	 * @returns the constructed {@link LicenseException}
	 */
	static of(id: string, deprecated = false): LicenseException {
		return LicenseException.make({ id, deprecated });
	}

	// ── Display ─────────────────────────────────────────────────────────

	/** The identifier string. */
	override toString(): string {
		return this.id;
	}
}
