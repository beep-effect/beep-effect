// The shape-lenient discovery tier: `LenientManifest` decodes arbitrary
// real-world package.json JSON without ever failing the document over one
// malformed field. Every top-level field shares its name with `Package`, but
// is typed as its plain permissive JSON shape (any string, not the branded
// npm grammar; a plain record, not a `HashMap`); a present field that is not
// even that shape degrades to absence, is preserved verbatim in `rest`, and
// is reported on `issues`. Leniency is per-field, never per-syntax: input
// that is not a JSON object at all stays a typed error.
//
// The kit's tolerance ladder (see PackageManifest.ts for the full comment):
//   Package         — strict, publishable.
//   PackageManifest — presence-lenient, shape-on-presence strict.
//   LenientManifest — shape-lenient discovery/sniffing (this module).
//   @effected/npm Manifest — shape-blind outside the four dependency fields.
//   PackageJsonFormat — decode-free text path.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ExportsField, PackageDecodeError, PublishConfigField } from "./Package.ts";
import { PackageJsonSyntaxError } from "./PackageJsonFormat.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/package-json/LenientManifest");

// ── Issue reporting ─────────────────────────────────────────────────────────

/**
 * One degraded field from a lenient decode: the top-level `field` that did not
 * match its permissive shape, a human-readable description of the `expected`
 * shape, and the raw `value` found there (also preserved verbatim under
 * `LenientManifest.rest[field]`).
 *
 * A value, not an error — the decode still succeeds; issues exist so callers
 * can report what degraded.
 *
 * @public
 */
export interface LenientFieldIssue {
	/** The top-level field name that degraded, e.g. `"name"`. */
	readonly field: string;
	/** A human-readable description of the permissive shape the field required. */
	readonly expected: string;
	/** The raw value found on the wire, preserved for reporting. */
	readonly value: unknown;
}

const LenientFieldIssueSchema = S.Struct({
	field: S.String,
	expected: S.String,
	value: S.Unknown,
});

// ── Permissive field shapes ─────────────────────────────────────────────────

const StringRecord = S.Record(S.String, S.String);
const UnknownRecord = S.Record(S.String, S.Unknown);
const StringOrRecord = S.Union([S.String, UnknownRecord]);

// ── The permissive-shape guards backing the sift ────────────────────────────

const isString = (value: unknown): value is string => P.isString(value);
const isBoolean = (value: unknown): value is boolean => P.isBoolean(value);
const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !A.isArray(value);
const isStringRecord = (value: unknown): value is Record<string, string> =>
	isPlainRecord(value) && R.values(value).every(isString);
const isStringArray = (value: unknown): value is ReadonlyArray<string> => A.isArray(value) && value.every(isString);
const isStringOrRecord = (value: unknown): value is string | Record<string, unknown> =>
	isString(value) || isPlainRecord(value);
const isStringOrRecordArray = (value: unknown): value is ReadonlyArray<string | Record<string, unknown>> =>
	A.isArray(value) && value.every(isStringOrRecord);

interface FieldGuard {
	readonly expected: string;
	readonly test: (value: unknown) => boolean;
}

const stringGuard: FieldGuard = { expected: "a string", test: isString };
const stringRecordGuard: FieldGuard = { expected: "an object of string values", test: isStringRecord };
const stringOrRecordGuard: FieldGuard = { expected: "a string or an object", test: isStringOrRecord };
const recordGuard: FieldGuard = { expected: "an object", test: isPlainRecord };

// A Map, not a plain object: a manifest key like `"toString"` or
// `"constructor"` must miss, not hit `Object.prototype`.
const FIELD_GUARDS: ReadonlyMap<string, FieldGuard> = new Map<string, FieldGuard>([
	["name", stringGuard],
	["version", stringGuard],
	["description", stringGuard],
	["private", { expected: "a boolean", test: isBoolean }],
	["type", stringGuard],
	["main", stringGuard],
	["license", stringGuard],
	["author", stringOrRecordGuard],
	["contributors", { expected: "an array of strings or objects", test: isStringOrRecordArray }],
	["maintainers", { expected: "an array of strings or objects", test: isStringOrRecordArray }],
	["keywords", { expected: "an array of strings", test: isStringArray }],
	["repository", stringOrRecordGuard],
	["bugs", stringOrRecordGuard],
	[
		"funding",
		{
			expected: "a string, an object, or an array of either",
			test: (value) => isStringOrRecord(value) || isStringOrRecordArray(value),
		},
	],
	["homepage", stringGuard],
	["dependencies", stringRecordGuard],
	["devDependencies", stringRecordGuard],
	["peerDependencies", stringRecordGuard],
	["optionalDependencies", stringRecordGuard],
	["peerDependenciesMeta", recordGuard],
	["scripts", stringRecordGuard],
	["bin", { expected: "a string or an object of string values", test: (v) => isString(v) || isStringRecord(v) }],
	["engines", stringRecordGuard],
	["exports", stringOrRecordGuard],
	["publishConfig", recordGuard],
	["packageManager", stringGuard],
	["devEngines", recordGuard],
]);

// ── The sift engine (pure) ──────────────────────────────────────────────────

// Partition a raw manifest object: keys matching their permissive shape become
// typed members; unknown keys AND malformed known keys flow verbatim into
// `rest` (a malformed known field is treated as an unknown key), with each
// degradation recorded as an issue. The field guards establish the constructor invariants.
const sift = (raw: Record<string, unknown>): LenientManifest => {
	const known: Record<string, unknown> = {};
	// Null-prototype for the same reason as the strict wire transform: an own
	// `__proto__` key on a plain object would mutate the prototype instead of
	// storing data.
	const rest: Record<string, unknown> = Object.create(null);
	const issues: Array<LenientFieldIssue> = [];
	for (const [key, value] of R.toEntries(raw)) {
		const guard = FIELD_GUARDS.get(key);
		if (guard === undefined) {
			rest[key] = value;
		} else if (guard.test(value)) {
			known[key] = value;
		} else {
			rest[key] = value;
			issues.push({ field: key, expected: guard.expected, value });
		}
	}
	// The guards above are exactly the field schemas' permissive shapes, so the
	// sifted knowns satisfy `make`'s validation.
	return LenientManifest.make({ ...known, rest, issues });
};

const decodeRecord = S.decodeUnknownExit(UnknownRecord);

// ── Model ───────────────────────────────────────────────────────────────────

/**
 * The shape-lenient view of a package.json document, for discovery and
 * sniffing — probing a fetched tarball's manifest, walking a `node_modules`
 * tree, listing candidate packages — where the document is other people's
 * data and one malformed field must not fail the read.
 *
 * @remarks
 * **This is the discovery tier, not a validation bypass.** Every field shares
 * its name with the strict `Package` model, but is typed as its plain permissive JSON
 * shape: `name` and `version` are any string (a legacy uppercase name or a
 * non-semver `"1.0"` is recovered, not rejected), `license` is any string (no
 * SPDX check), the dependency maps and `scripts` are plain string→string
 * records rather than `HashMap`s. A present field that is not even that shape
 * **degrades to absence** rather than failing the document: the raw value is
 * preserved verbatim in `rest` and the degradation is reported on `issues`,
 * so callers can surface what was ignored. Degradation granularity is the
 * top-level field — one junk entry degrades its whole map, with the raw map
 * still in `rest`.
 *
 * Leniency is per-field, never per-syntax: text that is not valid JSON fails
 * {@link LenientManifest.parseResult} as a typed
 * {@link PackageJsonSyntaxError}, and a value that is not a JSON object fails
 * {@link LenientManifest.decodeResult} as a typed {@link PackageDecodeError}.
 *
 * An empty `issues` array does **not** mean the strict tiers would accept the
 * document — the permissive shapes check JSON shape, not npm semantics. The
 * upgrade path is to decode the *original* input through
 * `PackageManifest.decode` (presence-lenient, shape-strict) or
 * `Package.decode` (strict, publishable) when validation is actually
 * wanted. This class deliberately carries no mutation statics and no write
 * path; editing belongs to the strict tiers and to
 * `PackageJsonFormat.modifyToString` / `PackageJsonFile.modify`.
 *
 * @example
 * ```ts
 * import { LenientManifest } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const sniffed = yield* LenientManifest.decode({ name: "JSONStream", version: "1.0", license: 42 });
 *   console.log(sniffed.name, sniffed.version); // "JSONStream" "1.0"
 *   console.log(sniffed.issues); // [{ field: "license", expected: "a string", value: 42 }]
 *   console.log(sniffed.rest?.license); // 42 — degraded, preserved verbatim
 * });
 * ```
 *
 * @public
 */
export class LenientManifest extends S.Class<LenientManifest>($I`LenientManifest`)({
	name: S.optionalKey(S.String).annotateKey({ description: "The package identifier from the manifest, preserved without npm name validation" }),
	version: S.optionalKey(S.String).annotateKey({ description: "The declared package release, preserved without semver validation" }),
	description: S.optionalKey(S.String).annotateKey({ description: "A human-readable summary of the package from the manifest" }),
	private: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the manifest marks the package as private; absence reads as false through `isPrivate`" }),
	type: S.optionalKey(S.String).annotateKey({ description: "The declared module format; only the exact value `module` makes `isESM` true" }),
	main: S.optionalKey(S.String).annotateKey({ description: "The package's declared primary entry-point path" }),
	license: S.optionalKey(S.String).annotateKey({ description: "The declared licensing terms, preserved without SPDX validation" }),
	author: S.optionalKey(StringOrRecord).annotateKey({ description: "The package creator's details, preserved in the manifest's original form" }),
	contributors: StringOrRecord.pipe(S.Array, S.optionalKey).annotateKey({ description: "Details of people credited with contributing to the package, preserved without parsing individual entries" }),
	maintainers: StringOrRecord.pipe(S.Array, S.optionalKey).annotateKey({ description: "Details of people listed as maintaining the package, preserved without parsing individual entries" }),
	keywords: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Search terms associated with the package in its manifest" }),
	repository: S.optionalKey(StringOrRecord).annotateKey({ description: "The source repository reference, preserved without normalization or validation of its details" }),
	bugs: S.optionalKey(StringOrRecord).annotateKey({ description: "Issue-reporting contact details, preserved without validation of URLs, email addresses, or object contents" }),
	funding: S.optionalKey(S.Union([StringOrRecord, S.Array(StringOrRecord)])).annotateKey({ description: "Declared funding destinations, preserved without validating individual entries or normalizing their original form" }),
	homepage: S.optionalKey(S.String).annotateKey({ description: "The package's declared homepage address, preserved without URL validation" }),
	dependencies: S.optionalKey(StringRecord).annotateKey({ description: "Package names mapped to declared runtime dependency specifiers, preserved without specifier validation" }),
	devDependencies: S.optionalKey(StringRecord).annotateKey({ description: "Package names mapped to declared development dependency specifiers, preserved without specifier validation" }),
	peerDependencies: S.optionalKey(StringRecord).annotateKey({ description: "Package names mapped to dependency requirements expected from the consuming project, preserved without specifier validation" }),
	optionalDependencies: S.optionalKey(StringRecord).annotateKey({ description: "Package names mapped to dependency specifiers whose installation may fail without failing the overall install" }),
	peerDependenciesMeta: S.optionalKey(UnknownRecord).annotateKey({ description: "Additional peer dependency metadata, such as optional status, preserved without validating individual entries" }),
	scripts: S.optionalKey(StringRecord).annotateKey({ description: "Lifecycle or task names mapped to command text declared in the manifest" }),
	bin: S.optionalKey(S.Union([S.String, StringRecord])).annotateKey({ description: "Executable entry-point paths, declared as a single path or a mapping from command names to paths" }),
	engines: S.optionalKey(StringRecord).annotateKey({ description: "Runtime and tool names mapped to declared version requirements, preserved without range validation" }),
	exports: S.optionalKey(ExportsField).annotateKey({ description: "The declared package entry point or export mappings, preserving object contents without validating individual targets" }),
	publishConfig: S.optionalKey(PublishConfigField).annotateKey({ description: "Publishing configuration from the manifest, preserving npm settings and extensions without validating their values" }),
	packageManager: S.optionalKey(S.String).annotateKey({ description: "The declared package-manager selection, preserved without parsing its name, version, or integrity component" }),
	devEngines: S.optionalKey(UnknownRecord).annotateKey({ description: "Development environment constraints from the manifest, preserved without validating individual engine entries" }),
	/**
	 * Unknown top-level keys, plus every degraded known field's raw value,
	 * verbatim. Always present after a lenient decode (possibly empty).
	 */
	rest: S.optionalKey(UnknownRecord).annotateKey({ description: "Unknown top-level keys, plus every degraded known field's raw value, verbatim. Always present after a lenient decode (possibly empty)." }),
	/** The degradations collected by the decode — empty when nothing degraded. */
	issues: S.Array(LenientFieldIssueSchema).annotateKey({ description: "The degradations collected by the decode — empty when nothing degraded." }),
}, $I.annote("LenientManifest", { description: "The shape-lenient view of a package.json document, for discovery and sniffing — probing a fetched tarball's manifest, walking a `node_modules` tree, listing candidate packages — where the document is other people's data and one malformed field must not fail the read." })) {
	/**
	 * Decode an unknown JSON value leniently, degrading malformed fields instead
	 * of failing the document. The sync primitive backing
	 * {@link LenientManifest.decode}.
	 *
	 * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
	 * @returns the lenient manifest, or a {@link PackageDecodeError} when
	 * `input` is not a JSON object at all (`null`, an array or a scalar) — the
	 * one failure leniency does not cover
	 */
	static decodeResult(input: unknown): Result.Result<LenientManifest, PackageDecodeError> {
		const exit = decodeRecord(input);
		if (Exit.isFailure(exit)) {
			return Result.fail(PackageDecodeError.make({ cause: Cause.squash(exit.cause) }));
		}
		return Result.succeed(sift(exit.value));
	}

	/**
	 * Decode an unknown JSON value leniently, degrading malformed fields instead
	 * of failing the document. The `Effect` form of
	 * {@link LenientManifest.decodeResult}, adding the tracing span.
	 *
	 * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
	 * @returns an Effect resolving to the decoded {@link LenientManifest},
	 * failing with {@link PackageDecodeError} when `input` is not a JSON object
	 */
	static readonly decode = Effect.fn("LenientManifest.decode")((input: unknown) =>
		Effect.fromResult(LenientManifest.decodeResult(input)),
	);

	/**
	 * Parse package.json text and decode it leniently. The sync primitive
	 * backing {@link LenientManifest.parse}.
	 *
	 * @param text - the package.json source text
	 * @returns the lenient manifest, or a {@link PackageJsonSyntaxError} when
	 * the text is not valid JSON (`"invalid-json"`) or parses to something
	 * other than a JSON object (`"not-an-object"`) — leniency is per-field,
	 * never per-syntax
	 */
	static parseResult(text: string): Result.Result<LenientManifest, PackageJsonSyntaxError> {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch (cause) {
			return Result.fail(PackageJsonSyntaxError.make({ reason: "invalid-json", cause }));
		}
		if (!isPlainRecord(raw)) {
			return Result.fail(PackageJsonSyntaxError.make({ reason: "not-an-object" }));
		}
		return Result.succeed(sift(raw));
	}

	/**
	 * Parse package.json text and decode it leniently. The `Effect` form of
	 * {@link LenientManifest.parseResult}, adding the tracing span.
	 *
	 * @param text - the package.json source text
	 * @returns an Effect resolving to the decoded {@link LenientManifest},
	 * failing with {@link PackageJsonSyntaxError} when the text is not valid JSON
	 * or is not a JSON object
	 */
	static readonly parse = Effect.fn("LenientManifest.parse")((text: string) =>
		Effect.fromResult(LenientManifest.parseResult(text)),
	);

	/** Whether the manifest is marked private. */
	get isPrivate(): boolean {
		return this.private ?? false;
	}

	/** Whether the manifest declares ESM (`"type": "module"`, exact comparison). */
	get isESM(): boolean {
		return this.type === "module";
	}
}
