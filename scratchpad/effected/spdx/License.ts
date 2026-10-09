import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ACTIVE_LICENSE_IDS, DEPRECATED_LICENSE_ID_LIST, DEPRECATED_LICENSE_IDS } from "./internal/licenseIds.ts";
import { LICENSE_META, META_FLAG_FSF_LIBRE, META_FLAG_OSI_APPROVED } from "./internal/licenseMeta.ts";

const $I = $ScratchpadId.create("effected/spdx/License");

/**
 * Indicates that a string is not a valid SPDX expression fragment: an
 * unrecognized license or exception identifier, or a malformed
 * `LicenseRef-`/`DocumentRef-` reference.
 *
 * **Details**
 *
 * This is the package's single typed error. Both malformed grammar and an
 * unknown identifier fail through it on the `E` channel — never as a defect.
 * {@link License.parse} and
 * `LicenseException.parse` raise it, and the recursive expression parser reuses
 * it for the whole grammar.
 *
 * @see {@link https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/ | SPDX License Expressions} for the SPDX expression grammar
 * @public
 */
export class InvalidSpdxExpressionError extends S.TaggedError<InvalidSpdxExpressionError>($I`InvalidSpdxExpressionError`)(
	"InvalidSpdxExpressionError",
	{
		/** The raw input string that failed to validate. */
		input: S.String.annotateKey({ description: "The raw input string that failed to validate." }),
	}, $I.annote("InvalidSpdxExpressionError", { description: "Indicates that a string is not a valid SPDX expression fragment: an unrecognized license or exception identifier, or a malformed `LicenseRef-`/`DocumentRef-` reference." }),
) {
	override get message(): string {
		return `Invalid SPDX expression: "${this.input}"`;
	}
}

// A LicenseRef / DocumentRef reference is valid without catalog membership.
// SPDX Appendix IV grammar:
//   license-ref = ["DocumentRef-"idstring":"]"LicenseRef-"idstring
//   idstring    = 1*(ALPHA / DIGIT / "-" / "." )
// The pattern is anchored and lookahead-free so it stays cheap and its inverse
// (a malformed ref) fails to match and surfaces as a typed error, not a throw.
const LICENSE_REF_PATTERN = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/;
const LicenseRefId = S.String.check(
	S.isPattern(
		LICENSE_REF_PATTERN,
		$I.annote("LicenseRefIdPattern", {
			description: "An SPDX LicenseRef identifier with an optional DocumentRef scope and nonempty idstrings.",
		}),
	),
).pipe(
	S.brand("LicenseRefId"),
	$I.annoteSchema("LicenseRefId", {
		description: "A well-formed SPDX LicenseRef identifier, optionally scoped by a DocumentRef identifier.",
	}),
);
const isLicenseRefId = S.is(LicenseRefId);

/**
 * A validated SPDX license identifier: an Effect `Schema.Class` whose `id` is
 * either a member of the SPDX License List or a well-formed
 * `LicenseRef-`/`DocumentRef-` reference. The class doubles as its own schema —
 * there is no `*Schema` suffix.
 *
 * **Details**
 *
 * This is the catalog-level model: it validates and resolves an identifier and
 * owns the static catalog and predicates. It is deliberately distinct from the
 * expression AST's simple-license leaf ({@link LicenseNode}): the trailing `+`
 * ("or later") marker is an expression-level operator and does not live here,
 * and a `LicenseRef` is accepted whole as an `id` rather than decomposed.
 *
 * Construction of a resolved identifier goes through {@link License.parse}
 * (Effect) or {@link License.parseResult} (the synchronous `Result` primitive);
 * the inherited `make` remains the field-level struct constructor.
 *
 * **Example** (Parse a license identifier and inspect its deprecation flag)
 *
 * ```ts
 * import { License } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const mit = yield* License.parse("MIT");
 *   return [mit.id, mit.deprecated] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["MIT", false]
 * ```
 *
 * @see {@link https://spdx.org/licenses/ | SPDX License List} for the catalog of SPDX license identifiers
 * @public
 */
export class License extends S.Class<License>($I`License`)({
	/**
	 * The SPDX short identifier (e.g. `"MIT"`) or a `LicenseRef-`/`DocumentRef-`
	 * reference string.
	 */
	id: S.String.annotateKey({ description: "The SPDX short identifier (e.g. `\"MIT\"`) or a `LicenseRef-`/`DocumentRef-` reference string." }),
	/**
	 * Whether `id` is a deprecated SPDX identifier. Always `false` for a
	 * `LicenseRef`/`DocumentRef` reference.
	 */
	deprecated: S.Boolean.annotateKey({ description: "Whether `id` is a deprecated SPDX identifier. Always `false` for a `LicenseRef`/`DocumentRef` reference." }),
}, $I.annote("License", { description: "A validated SPDX license identifier: an Effect `Schema.Class` whose `id` is either a member of the SPDX License List or a well-formed `LicenseRef-`/`DocumentRef-` reference. The class doubles as its own schema — there is no `*Schema` suffix." })) {
	// ── Catalog ─────────────────────────────────────────────────────────

	/**
	 * The full SPDX license catalog keyed by identifier, holding resolved
	 * {@link License} domain objects for every active and deprecated id. Built
	 * once from the vendored datasets at module load; references are not
	 * catalog members.
	 */
	static readonly catalog: HashMap.HashMap<string, License> = HashMap.fromIterable([
		...A.map(ACTIVE_LICENSE_IDS, (id): readonly [string, License] => [
			id,
			License.make({ id, deprecated: false }),
		]),
		...A.map(DEPRECATED_LICENSE_ID_LIST, (id): readonly [string, License] => [
			id,
			License.make({ id, deprecated: true }),
		]),
	]);

	/**
	 * Whether `id` is a recognized SPDX license identifier — active or
	 * deprecated. A grammatically valid `LicenseRef`/`DocumentRef` is not a
	 * catalog member and returns `false`.
	 */
	static isKnownId(id: string): boolean {
		return HashMap.has(License.catalog, id);
	}

	/** Whether `id` is specifically a deprecated SPDX license identifier. */
	static isDeprecatedId(id: string): boolean {
		return HashSet.has(DEPRECATED_LICENSE_IDS, id);
	}

	/**
	 * Whether `id` matches the `LicenseRef-`/`DocumentRef-` reference grammar.
	 * A reference is valid without catalog membership; this is the grammar
	 * predicate the expression parser consults.
	 */
	static isLicenseRef(id: string): boolean {
		return isLicenseRefId(id);
	}

	// ── Construction ────────────────────────────────────────────────────

	/**
  * Validate a license identifier synchronously, returning a `Result`. The
  * `id` is accepted when it is a catalog member (active or deprecated) or a
  * well-formed `LicenseRef`/`DocumentRef` reference; anything else fails with
  * {@link InvalidSpdxExpressionError}.
  *
  * **Details**
  *
  * {@link License.parse} is defined in terms of this function; the two never
  * diverge. Reach for the `Effect` variant inside Effect code — it carries
  * the `License.parse` tracing span — and for this one at synchronous
  * boundaries.
  *
  * @param id - the license identifier to validate
  * @returns a `Result` succeeding with the resolved {@link License}, or
  * failing with {@link InvalidSpdxExpressionError}.
  */
	static parseResult(id: string): Result.Result<License, InvalidSpdxExpressionError> {
		const known = HashMap.get(License.catalog, id);
		if (O.isSome(known)) return Result.succeed(known.value);
		if (isLicenseRefId(id)) return Result.succeed(License.make({ id, deprecated: false }));
		return Result.fail(InvalidSpdxExpressionError.make({ input: id }));
	}

	/**
	 * Validate a license identifier. Defined in terms of
	 * {@link License.parseResult} — synchronous callers can use that variant
	 * directly.
	 *
	 * @param id - the license identifier to validate
	 * @returns the resolved {@link License}. Fails with
	 * {@link InvalidSpdxExpressionError} when `id` is neither a catalog member
	 * nor a valid reference.
	 */
	static readonly parse = Effect.fn("License.parse")((id: string) => Effect.fromResult(License.parseResult(id)));

	/**
	 * Construct a {@link License} directly from already-typed parts:
	 * `License.of("MIT")`. This is the field-level convenience constructor, a thin
	 * wrapper over the inherited `make` — it does **not** consult the catalog and
	 * does **not** validate that `id` is a known identifier or a well-formed
	 * reference. Reach for {@link License.parse} or {@link License.parseResult}
	 * when the `id` is untrusted and must be validated.
	 *
	 * @param id - the SPDX short identifier or `LicenseRef`/`DocumentRef` reference
	 * @param deprecated - whether `id` is a deprecated identifier; defaults to
	 * `false`
	 * @returns the constructed {@link License}
	 */
	static of(id: string, deprecated = false): License {
		return License.make({ id, deprecated });
	}

	// ── Catalog metadata ────────────────────────────────────────────────

	/**
  * The canonical SPDX web page for this license — for example
  * `https://spdx.org/licenses/MIT.html` — or `Option.none()` when `id` is not
  * a catalog member.
  *
  * **Details**
  *
  * A `LicenseRef-`/`DocumentRef-` reference names a license that lives in the
  * consuming document, not on spdx.org, and so has no page; the same holds
  * for an id this catalog does not know. `None` is the honest answer there —
  * templating the URL anyway would hand callers a confidently broken link.
  *
  * **Example** (Look up a catalog license URL and handle a custom reference)
  *
  * ```ts
  * import { License } from "./index.ts";
  * import * as O from "effect/Option";
  *
  * console.log(O.getOrNull(License.of("MIT").referenceUrl));
  * // => "https://spdx.org/licenses/MIT.html"
  * console.log(O.getOrNull(License.of("LicenseRef-Acme").referenceUrl));
  * // => null
  * ```
  */
	get referenceUrl(): O.Option<string> {
		// Templated rather than vendored: every upstream entry's `reference` is
		// exactly this form, and lib/scripts/generate-data.ts asserts that for every
		// id on regeneration, so the template is a checked invariant.
		return HashMap.has(LICENSE_META, this.id) ? O.some(`https://spdx.org/licenses/${this.id}.html`) : O.none();
	}

	/**
	 * The license's full title from the SPDX License List — `"MIT License"` for
	 * `MIT` — or `Option.none()` when `id` is not a catalog member, including
	 * every `LicenseRef-`/`DocumentRef-` reference.
	 */
	get name(): O.Option<string> {
		return O.map(HashMap.get(LICENSE_META, this.id), (meta) => meta[1]);
	}

	/**
	 * Whether the OSI has approved this license. `false` for a reference and for
	 * any uncataloged id — the flag is an assertion about a known license, so
	 * the absence of a catalog entry is never "approved".
	 */
	get osiApproved(): boolean {
		return O.exists(HashMap.get(LICENSE_META, this.id), (meta) => (meta[2] & META_FLAG_OSI_APPROVED) !== 0);
	}

	/**
  * Whether the FSF lists this license as libre. `false` for a reference and
  * for any uncataloged id.
  *
  * **Gotchas**
  *
  * The FSF's list is much shorter than the OSI's and the two disagree in both
  * directions: `0BSD` is OSI-approved and not FSF-libre, `Apache-1.0` is
  * FSF-libre and not OSI-approved. Never derive one flag from the other.
  */
	get fsfLibre(): boolean {
		return O.exists(HashMap.get(LICENSE_META, this.id), (meta) => (meta[2] & META_FLAG_FSF_LIBRE) !== 0);
	}

	// ── Display ─────────────────────────────────────────────────────────

	/** The identifier string. */
	override toString(): string {
		return this.id;
	}
}
