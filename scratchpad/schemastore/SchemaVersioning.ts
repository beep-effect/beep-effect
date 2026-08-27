/**
 * SchemaStore catalog versioning: unversioned `name.json` and versioned
 * `name-<version>.json` with full three-component SemVer labels.
 *
 * Two-part corpus labels (`1.2`, `1`) are rejected on purpose so a label
 * splits unambiguously out of a file name or URL.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Option, Order, Result, Schema } from "effect";
import { SemVer } from "../semver/index.ts";

const $I = $ScratchpadId.create("schemastore/SchemaVersioning");

// Version labels are STRICT SemVer: all three components always present,
// optional prerelease, with `@effected/semver` doing the enforcing rather
// than a regex maintained alongside it.
//
// The file-name CONVENTION stays SchemaStore's (`<name>-<version>.json`,
// per its CONTRIBUTING guide and the `agripparc-1.2.json` corpus); only the
// label grammar is narrowed. The store's own labels are commonly two-part
// and therefore not SemVer at all, so a fixed three-component label is the
// one deliberate divergence: it is unambiguous to split back out of a file
// name or URL, which is what a consumer actually does with it. Anything
// submitted to SchemaStore proper will carry a third component its
// neighbours lack — valid, just not identical in style.
//
// Build metadata (`+build`) is rejected, as it was under the previous
// grammar: it is hostile in a URL, and SemVer precedence IGNORES it, so two
// labels differing only in build would compare equal and both claim to be
// the latest version.
const isVersionLabel = (input: string): boolean => {
	// `SemVer.parseResult` TRIMS its input, so `" 1.2.3 "` parses — and the
	// label round-trips verbatim into file names, schema URLs and catalog
	// keys, which would emit `agripparc- 1.2.3 .json`. The anchored regex
	// this replaced rejected padding for free; `isValid` restores that.
	if (!SemVer.isValid(input)) {
		return false;
	}
	const parsed = SemVer.parseResult(input);
	return Result.isSuccess(parsed) && parsed.success.build.length === 0;
};

/**
 * Indicates that a string is not a valid SchemaStore version label.
 *
 * Raised by {@link SchemaVersioning.parse}.
 *
 * **Example** (Parse a two-part label)
 *
 * ```ts
 * import { InvalidSchemaVersionError, SchemaVersioning } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 *
 * const failed = SchemaVersioning.parseResult("1.2")
 *
 * console.log(Result.isFailure(failed) && failed.failure instanceof InvalidSchemaVersionError)
 * // => true
 * if (Result.isFailure(failed)) {
 *   console.log(failed.failure.input)
 *   // => "1.2"
 * }
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidSchemaVersionError extends Schema.TaggedError<InvalidSchemaVersionError>(
	$I`InvalidSchemaVersionError`,
)(
	"InvalidSchemaVersionError",
	{
		/** The raw input string that failed to parse. */
		input: Schema.String,
	},
	$I.annote("InvalidSchemaVersionError", {
		description:
			"Raised when a string is not a full major.minor.patch SchemaStore version label (two-part labels and build metadata are rejected).",
	}),
) {
	override get message(): string {
		return `Invalid schema version label: "${this.input}"`;
	}
}

/**
 * A schema version label: a branded string holding a **full three-component
 * SemVer** — `major.minor.patch` with an optional prerelease, validated by
 * `@effected/semver` itself. Build metadata is rejected (see below).
 *
 * `1.2` and `1` are NOT accepted, though SchemaStore's own corpus uses such
 * labels: requiring all three components makes a label unambiguous to split
 * back out of `<name>-<version>.json` or its URL, which is what consumers
 * do with it. The file-name convention around the label stays SchemaStore's.
 *
 * The label round-trips verbatim into file names and catalog `versions`
 * keys; ordering parses it directly (see {@link SchemaVersioning.Order}).
 *
 * **Gotchas**
 *
 * SchemaStore corpus two-part labels (`1.2`, `1`) are rejected on purpose.
 * Build metadata (`1.2.3+build`) is rejected because it is URL-hostile and
 * SemVer-ignored. `SemVer.parseResult` trims, but this brand restores
 * no-padding so `" 1.2.3 "` fails.
 *
 * **Example** (Accept 1.2.3, reject 1.2 and build metadata)
 *
 * ```ts
 * import { SchemaVersion, SchemaVersioning } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(SchemaVersion)("1.2.3"))
 * // => "1.2.3"
 * console.log(Result.isSuccess(SchemaVersioning.parseResult("1.2")))
 * // => false
 * console.log(Result.isSuccess(SchemaVersioning.parseResult("1.2.3+build")))
 * // => false
 * ```
 *
 * @see {@link SchemaVersioning.parse} for the Effect form of the same check.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SchemaVersion = Schema.String.check(
	Schema.makeFilter((value) => (isVersionLabel(value) ? undefined : "must be a full major.minor.patch SemVer label")),
).pipe(
	Schema.brand("SchemaVersion"),
	$I.annoteSchema("SchemaVersion", {
		description: "Full major.minor.patch SchemaStore version label without build metadata.",
	}),
);

/**
 * Decoded SchemaStore version label produced by {@link SchemaVersion}.
 *
 * @see {@link SchemaVersion} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SchemaVersion = typeof SchemaVersion.Type;

// A validated label IS a SemVer string, so ordering is a plain parse — the
// zero-padding the old two-part grammar needed is gone with it.
const orderingKey = (label: SchemaVersion): SemVer => {
	const result = SemVer.parseResult(label);
	if (Result.isFailure(result)) {
		// Unreachable for a validated label: the brand's filter IS this parse.
		throw new Error(`SchemaVersion ordering invariant violated for label "${label}"`);
	}
	return result.success;
};

const assertSimpleName = (name: string): void => {
	if (name.length === 0 || /[/\\\s]/.test(name)) {
		throw new Error(`Schema name must be a non-empty simple file base name, got "${name}"`);
	}
};

// A manual trailing-slash trim rather than `/\/+$/`: the regex form
// backtracks polynomially on adversarial all-slash inputs (CodeQL
// js/polynomial-redos), and baseUrl is library input.
const joinUrl = (baseUrl: string, file: string): string => {
	let end = baseUrl.length;
	while (end > 0 && baseUrl.charCodeAt(end - 1) === 47) {
		end -= 1;
	}
	return `${baseUrl.slice(0, end)}/${file}`;
};

/**
 * The `url`/`versions` half of a catalog entry, as assembled by
 * {@link SchemaVersioning.catalogUrls}.
 *
 * @see {@link SchemaVersioning.catalogUrls} for the function that assembles this shape.
 * @see {@link CatalogEntry.assemble} for the catalog entry that consumes it.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface CatalogUrls {
	/** The catalog `url` — the unversioned file, or the latest versioned file. */
	readonly url: string;
	/**
	 * The versioned catalog's `versions` map (label → url), inserted — and,
	 * since a three-component label can never be integer-like, enumerated
	 * and serialized — in ascending version order.
	 */
	readonly versions?: Readonly<Record<string, string>>;
}

/**
 * Both SchemaStore catalog modes as pure derivations: unversioned (a plain
 * `name.json` file, `url` only) and versioned (`name-<version>.json` files
 * — SchemaStore's own suffix convention — a `versions` map, and `url`
 * pointing at the latest version).
 *
 * Version labels are full three-component SemVer, so ordering is plain
 * SemVer precedence: `1.10.0` above `1.9.0`, `2.0.0-beta` below `2.0.0`.
 *
 * **Gotchas**
 *
 * Two-part corpus labels and build metadata are rejected by
 * {@link SchemaVersion}. {@link SchemaVersioning.fileName} throws on an
 * empty, separator-bearing, or whitespace name.
 * {@link SchemaVersioning.catalogUrls} throws on an empty `versions` array
 * — pass `undefined` (omit the key) for unversioned mode.
 *
 * **Example** (Assemble unversioned and versioned catalog URLs)
 *
 * ```ts
 * import { SchemaVersioning } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 *
 * const unversioned = SchemaVersioning.catalogUrls({
 *   baseUrl: "https://example.com/schemas",
 *   name: "config",
 * })
 * console.log(unversioned.url)
 * // => "https://example.com/schemas/config.json"
 *
 * const parsed = SchemaVersioning.parseResult("1.2.3")
 * if (Result.isSuccess(parsed)) {
 *   const versioned = SchemaVersioning.catalogUrls({
 *     baseUrl: "https://example.com/schemas",
 *     name: "config",
 *     versions: [parsed.success],
 *   })
 *   console.log(versioned.url)
 *   // => "https://example.com/schemas/config-1.2.3.json"
 * }
 * ```
 *
 * @throws `fileName` throws `Error` when `name` is empty, contains a path
 * separator, or contains whitespace. `catalogUrls` throws `Error` when
 * `versions` is an empty array.
 * @see {@link SchemaVersioning.parse} for the branded-label parser both modes share.
 * @see {@link CatalogEntry.assemble} for the catalog entry built from these URLs.
 * @see {@link CatalogUrls} for the `url`/`versions` shape this class returns.
 * @public
 * @category constructors
 * @since 0.0.0
 */
export class SchemaVersioning {
	private constructor() {}

	/**
	 * Parses a version label. Pure and synchronous — the primitive form;
	 * {@link SchemaVersioning.parse} is the same check behind a span.
	 */
	static parseResult(input: string): Result.Result<SchemaVersion, InvalidSchemaVersionError> {
		return isVersionLabel(input)
			? Result.succeed(input as SchemaVersion)
			: Result.fail(InvalidSchemaVersionError.make({ input }));
	}

	/**
	 * Effect form of {@link SchemaVersioning.parseResult}, adding only the
	 * `SchemaVersioning.parse` span. Defined in terms of the `Result`
	 * primitive — synchronous callers can use that variant directly.
	 */
	static readonly parse = Effect.fn("SchemaVersioning.parse")(
		(input: string): Effect.Effect<SchemaVersion, InvalidSchemaVersionError> =>
			Effect.fromResult(SchemaVersioning.parseResult(input)),
	);

	/**
	 * `Order` instance over version labels: plain SemVer precedence.
	 * `1.10.0` sorts above `1.9.0` (numeric, not lexical) and `2.0.0-beta`
	 * below `2.0.0` (prerelease precedence).
	 */
	static readonly Order: Order.Order<SchemaVersion> = Order.make((a, b) =>
		SemVer.Order(orderingKey(a), orderingKey(b)),
	);

	/**
	 * The highest version label by {@link SchemaVersioning.Order}, or
	 * `Option.none()` for an empty collection.
	 */
	static latest(versions: ReadonlyArray<SchemaVersion>): Option.Option<SchemaVersion> {
		return versions.length === 0
			? Option.none()
			: Option.some(versions.reduce((max, v) => (SchemaVersioning.Order(v, max) > 0 ? v : max)));
	}

	/**
	 * Derives the schema file name for a catalog name: `name.json`
	 * unversioned, `name-<version>.json` versioned.
	 *
	 * The name must be a simple file base name (no separators, no
	 * whitespace); anything else is a wiring mistake and throws.
	 *
	 * @throws Throws `Error` when `name` is empty, contains `/` or `\\`, or
	 * contains whitespace.
	 */
	static fileName(name: string, version?: SchemaVersion): string {
		assertSimpleName(name);
		return version === undefined ? `${name}.json` : `${name}-${version}.json`;
	}

	/**
	 * The canonical URL a schema file is hosted at: `baseUrl` joined with
	 * {@link SchemaVersioning.fileName}.
	 */
	static schemaUrl(baseUrl: string, name: string, version?: SchemaVersion): string {
		return joinUrl(baseUrl, SchemaVersioning.fileName(name, version));
	}

	/**
	 * Assembles the `url`/`versions` half of a catalog entry.
	 *
	 * Omitting `versions` selects the unversioned mode (`url` only,
	 * pointing at the plain `name.json`). Providing them selects the
	 * versioned mode: the `versions` map carries every label, and `url`
	 * points at the latest version's file. An **empty** `versions` array is
	 * a contradiction (versioned mode with no versions) and throws — pass
	 * `undefined` for the unversioned mode.
	 *
	 * Labels are inserted in ascending {@link SchemaVersioning.Order} and
	 * stay that way on serialization. Requiring three components is what
	 * buys this: JavaScript enumerates array-index-like keys first, so the
	 * old grammar's bare-major label (`"2"`) jumped ahead of every dotted
	 * one regardless of insertion order. No SemVer label is integer-like,
	 * so that hazard is gone. Deriving ordering from the labels themselves
	 * (as {@link SchemaVersioning.latest} does) is still the robust read.
	 *
	 * @throws Throws `Error` when `versions` is present but empty — pass
	 * `undefined` for unversioned mode.
	 */
	static catalogUrls(options: {
		readonly baseUrl: string;
		readonly name: string;
		readonly versions?: ReadonlyArray<SchemaVersion>;
	}): CatalogUrls {
		const { baseUrl, name, versions } = options;
		if (versions === undefined) {
			return { url: SchemaVersioning.schemaUrl(baseUrl, name) };
		}
		if (versions.length === 0) {
			throw new Error(
				`catalogUrls received an empty versions array for "${name}": pass undefined for the unversioned mode`,
			);
		}
		const ascending = [...versions].sort(SchemaVersioning.Order);
		const map: Record<string, string> = {};
		for (const version of ascending) {
			map[version] = SchemaVersioning.schemaUrl(baseUrl, name, version);
		}
		const newest = ascending[ascending.length - 1] as SchemaVersion;
		return { url: SchemaVersioning.schemaUrl(baseUrl, name, newest), versions: map };
	}
}
