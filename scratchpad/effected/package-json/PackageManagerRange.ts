// The range-tolerant `packageManager` field model: a `PackageManagerRange`
// class parsing `"pnpm@^11.20.0"` (or an exact `"pnpm@11.2.0"`) into
// `name` / `range` / `integrity`, with a `PackageManagerRange.FromString`
// string codec.
//
// The strict `PackageManager` models what corepack provisions — an exact,
// pinnable version. pnpm's own reading of the field is wider: with
// `manage-package-manager-versions` it accepts a semver *range* and resolves
// it itself, and manifests carrying `pnpm@^11.20.0` exist in the wild. This
// class models
// that wider field without weakening the strict one: the range text is carried
// **verbatim** (the `Repository` posture — fidelity first, interpretation as
// derived getters), validated only to parse as a semver range, and `isExact`
// reports whether it is in fact an exact pinnable version.
//
// The grammar shares the strict form's one load-bearing rule: the FIRST `+`
// after the `@` begins the integrity component, never semver build metadata.
// A range whose own text would carry `+` build metadata in a comparator
// therefore cannot be expressed in this field — the field's grammar owns `+`.
//
// `devEngines.packageManager` carries the same `<range>[+<integrity>]` tail in
// its `version` slot, with the name in its own slot; `fromDevEngine` reads that
// shape onto this model through the same component validation `parseResult`
// uses, so the two fields cannot drift apart.

import { $ScratchpadId } from "@beep/identity/packages";
import { CorepackIntegrityHash } from "../npm/index.ts";
import { Range, SemVer } from "../semver/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type { DevEngine } from "./DevEngines.ts";

const $I = $ScratchpadId.create("effected/package-json/PackageManagerRange");

/**
 * The encoded shape of a `devEngines.packageManager` entry: what a raw
 * `package.json` object carries. A {@link DevEngine} instance satisfies it
 * structurally, so both a decoded entry and the plain object read straight off
 * disk are accepted.
 *
 * @public
 */
export interface DevEnginePackageManagerEntry {
	/** The package-manager name (e.g. `pnpm`). */
	readonly name: string;
	/** The `<range>[+<integrity>]` version constraint; an entry without one names no range. */
	readonly version?: string | undefined;
}

// A single exact, caret or tilde comparator over a pinnable version: the only
// range shapes whose operator can be carried onto a new version unambiguously.
const SINGLE_COMPARATOR_RE = /^([\^~]?)(.+)$/;

const singleComparator = (
	range: string,
): O.Option<{ readonly operator: "" | "^" | "~"; readonly version: string }> => {
	const match = SINGLE_COMPARATOR_RE.exec(range);
	if (match === null) return O.none();
	const operator = match[1];
	const version = match[2];
	if ((operator !== "" && operator !== "^" && operator !== "~") || version === undefined) return O.none();
	return SemVer.isPinnable(version) ? O.some({ operator, version }) : O.none();
};

// The name half of the grammar — identical latitude to `PackageManager`'s
// (any lowercase name); see that class's remarks for the evidence.
const PACKAGE_MANAGER_NAME_RE = /^[a-z]+$/;

/** `Schema.String` refined to parse as a semver range (`Range.parseResult` succeeds). The check is erased from the built type. */
const SemVerRangeString: S.String = S.String.pipe(
	S.check(
		S.makeFilter((value) =>
			value.length > 0 && Result.isSuccess(Range.parseResult(value))
				? undefined
				: "Expected a semver range (an exact version, a caret/tilde range, a comparator set, ...)",
		),
	),
);

/**
 * Indicates that a `packageManager` value, or a `devEngines.packageManager`
 * entry, could not be read as a {@link PackageManagerRange}.
 *
 * Raised by {@link PackageManagerRange.parse},
 * {@link PackageManagerRange.parseResult},
 * {@link PackageManagerRange.fromDevEngine} and
 * {@link PackageManagerRange.fromDevEngineResult}; the decode direction of
 * {@link PackageManagerRange.FromString} reports the same failure through a
 * generic `Schema` parse error carrying the same message.
 *
 * @public
 */
export class InvalidPackageManagerRangeError extends S.TaggedError<InvalidPackageManagerRangeError>($I`InvalidPackageManagerRangeError`)(
	"InvalidPackageManagerRangeError",
	{
		/**
		 * The offending value: the raw `packageManager` string, or for a
		 * `devEngines` entry its `name` and `version` joined as
		 * `<name>@<version>` (just `<name>` when `version` is absent).
		 */
		input: S.String.annotateKey({ description: "The offending value: the raw `packageManager` string, or for a `devEngines` entry its `name` and `version` joined as `<name>@<version>` (just `<name>` when `version` is absent)." }),
		/**
		 * Which component failed: `format` (a `packageManager` string with no
		 * `@`), `name` (not a lowercase name), `range` (absent, empty, or not a
		 * semver range) or `integrity` (the tail after the first `+` is not a
		 * corepack `<algo>.<hex>` hash).
		 */
		reason: S.Literals(["format", "name", "range", "integrity"]).annotateKey({ description: "Which component failed: `format` (a `packageManager` string with no `@`), `name` (not a lowercase name), `range` (absent, empty, or not a semver range) or `integrity` (the tail after the first `+` is not a corepack `<algo>.<hex>` hash)." }),
	}, $I.annote("InvalidPackageManagerRangeError", { description: "Indicates that a `packageManager` value, or a `devEngines.packageManager` entry, could not be read as a PackageManagerRange." }),
) {
	override get message(): string {
		return this.reason === "format"
			? `Invalid packageManager format: "${this.input}": expected <name>@<range>[+<integrity>]`
			: this.reason === "name"
				? `Invalid packageManager name: "${this.input}": name must be a lowercase package-manager name`
				: this.reason === "range"
					? `Invalid packageManager range: "${this.input}": the range is missing or is not a semver range`
					: `Invalid packageManager integrity: "${this.input}": integrity must be a corepack <algo>.<hex> hash`;
	}
}

/**
 * The shared component validation behind both entry points: `name`, and the
 * `<range>[+<integrity>]` tail split on its FIRST `+`. `input` is only the
 * text the error reports.
 */
const fromParts = (
	input: string,
	name: string,
	tail: string,
): Result.Result<PackageManagerRange, InvalidPackageManagerRangeError> => {
	if (!PACKAGE_MANAGER_NAME_RE.test(name)) {
		return Result.fail(InvalidPackageManagerRangeError.make({ input, reason: "name" }));
	}
	// The first `+` begins the integrity component, unconditionally — the
	// version position of this field never carries build metadata.
	const plus = tail.indexOf("+");
	const range = plus === -1 ? tail : tail.slice(0, plus);
	// An empty range (`pnpm@`) is a range error, not the `*` node-semver
	// coerces an empty string to — coercion would be a silent edit.
	if (range.length === 0 || Result.isFailure(Range.parseResult(range))) {
		return Result.fail(InvalidPackageManagerRangeError.make({ input, reason: "range" }));
	}
	if (plus === -1) {
		return Result.succeed(PackageManagerRange.make({ name, range, integrity: O.none() }));
	}
	// Validate the integrity through the corepack-restricted schema so a
	// malformed hash is a typed failure, not the defect `make` would throw on
	// a value the field schema rejects.
	const decoded = S.decodeExit(CorepackIntegrityHash)(tail.slice(plus + 1));
	if (Exit.isFailure(decoded)) {
		return Result.fail(InvalidPackageManagerRangeError.make({ input, reason: "integrity" }));
	}
	return Result.succeed(PackageManagerRange.make({ name, range, integrity: O.some(decoded.value) }));
};

/**
 * A structured `packageManager` value whose version position is a semver
 * **range**, carried verbatim: `name`, `range` and an optional `integrity`
 * hash.
 *
 * @remarks
 * The range-tolerant sibling of {@link PackageManager}. The strict class
 * models the corepack pin — an exact version, which is all corepack itself
 * accepts — and stays strict; this class models the field as pnpm reads it,
 * where a range such as `^11.20.0` is a supported spelling that pnpm resolves
 * to a concrete version. An exact version is a valid range, so every string
 * the strict codec accepts decodes here too; {@link PackageManagerRange.isExact}
 * is how a caller tracks which form the manifest actually carried.
 *
 * The `range` field is the manifest's text **verbatim** — validated to parse
 * as a semver range but never normalized, so encoding is byte-identical to
 * the accepted input and reading a manifest never rewrites the field.
 * Interpretation is a derived getter, following `Repository`'s
 * carry-verbatim posture.
 *
 * The first `+` after the `@` begins the integrity component, exactly as in
 * the strict grammar — the version position of this field never carries
 * semver build metadata.
 *
 * @example
 * ```ts
 * import { PackageManagerRange } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const program = Effect.gen(function* () {
 *   const pm = yield* S.decodeUnknownEffect(PackageManagerRange.FromString)("pnpm@^11.20.0");
 *   console.log(pm.name, pm.range, pm.isExact); // "pnpm" "^11.20.0" false
 * });
 * ```
 *
 * @public
 */
export class PackageManagerRange extends S.Class<PackageManagerRange>($I`PackageManagerRange`)({
	/** The package-manager name (e.g. `pnpm`). Any lowercase name — the same latitude as {@link PackageManager}, for the same evidence. */
	name: S.String.annotateKey({ description: "The package-manager name (e.g. `pnpm`). Any lowercase name — the same latitude as PackageManager, for the same evidence." }),
	/**
	 * The version position, verbatim: a semver range (`^11.20.0`,
	 * `>=10 <12`, ...) or an exact version (`11.2.0`). Validated to parse
	 * through `@effected/semver`'s `Range.parseResult`; never normalized, so
	 * the field round-trips byte-identically.
	 */
	range: SemVerRangeString.annotateKey({ description: "The version position, verbatim: a semver range (`^11.20.0`, `>=10 <12`, ...) or an exact version (`11.2.0`). Validated to parse through `@effected/semver`'s `Range.parseResult`; never normalized, so the field round-trips byte-identically." }),
	/**
	 * The optional integrity hash (e.g. `sha512.abc`): `@effected/npm`'s
	 * `CorepackIntegrityHash`. Meaningful only alongside an exact range —
	 * an integrity pins one artifact — but carried whenever the manifest
	 * carries it, because fidelity outranks plausibility in a field model.
	 */
	integrity: S.Option(CorepackIntegrityHash).annotateKey({ description: "The optional integrity hash (e.g. `sha512.abc`): `@effected/npm`'s `CorepackIntegrityHash`. Meaningful only alongside an exact range — an integrity pins one artifact — but carried whenever the manifest carries it, because fidelity outranks plausibility in a field model." }),
}, $I.annote("PackageManagerRange", { description: "A structured `packageManager` value whose version position is a semver **range**, carried verbatim: `name`, `range` and an optional `integrity` hash." })) {
	/**
	 * Schema transformation between the `"name@range[+integrity]"` string and a
	 * {@link PackageManagerRange}.
	 *
	 * @remarks
	 * Decoding parses via {@link PackageManagerRange.parseResult}, so every
	 * failure is a typed decode failure naming the component that failed.
	 * Encoding prints `toString()`, reconstructed from the verbatim parts, so
	 * it is byte-identical to any input this codec accepts.
	 */
	static readonly FromString: S.Codec<PackageManagerRange, string> = S.String.pipe(
		S.decodeTo(
			S.instanceOf(PackageManagerRange),
			SchemaTransformation.transformEffect({
				decode: (input: string) => {
					const parsed = PackageManagerRange.parseResult(input);
					return Result.isSuccess(parsed)
						? Effect.succeed(parsed.success)
						: Effect.fail(new SchemaIssue.InvalidValue({ message: parsed.failure.message }, input));
				},
				encode: (pm: PackageManagerRange) => Effect.succeed(pm.toString()),
			}),
		),
	);

	/**
	 * Parse a `packageManager` string (`name@range[+integrity]`), synchronously,
	 * returning a `Result` instead of an `Effect`.
	 *
	 * @remarks
	 * Splits on the first `@`, then on the first `+` — which always begins the
	 * integrity, never semver build metadata — and validates each component:
	 * the name against the lowercase grammar, the range through
	 * `@effected/semver`'s `Range.parseResult`, the integrity through
	 * `CorepackIntegrityHash`. {@link PackageManagerRange.parse} is defined in
	 * terms of this function.
	 *
	 * @param input - the `packageManager` value to parse
	 * @returns a `Result` succeeding with the parsed {@link PackageManagerRange},
	 * or failing with {@link InvalidPackageManagerRangeError} naming the
	 * component that failed.
	 */
	static parseResult(input: string): Result.Result<PackageManagerRange, InvalidPackageManagerRangeError> {
		const at = input.indexOf("@");
		return at === -1
			? Result.fail(InvalidPackageManagerRangeError.make({ input, reason: "format" }))
			: fromParts(input, input.slice(0, at), input.slice(at + 1));
	}

	/**
	 * Parse a `packageManager` string. Defined in terms of
	 * {@link PackageManagerRange.parseResult}.
	 *
	 * @param input - the `packageManager` value to parse
	 * @returns the parsed {@link PackageManagerRange}. Fails with
	 * {@link InvalidPackageManagerRangeError} when `input` is malformed.
	 */
	static readonly parse = Effect.fn("PackageManagerRange.parse")((input: string) =>
		Effect.fromResult(PackageManagerRange.parseResult(input)),
	);

	/**
	 * Read a `devEngines.packageManager` entry onto this model, synchronously,
	 * returning a `Result`.
	 *
	 * @remarks
	 * The entry's `name` is the package-manager name and its `version` is the
	 * same `<range>[+<integrity>]` tail the `packageManager` field carries after
	 * its `@` — `^12.6.0`, `12.6.0`, or `12.6.0+sha512.<hex>`. Both are validated exactly as
	 * {@link PackageManagerRange.parseResult} validates them. The `version`
	 * slot is optional on a {@link DevEngine}, but an entry without one names
	 * no range, so it fails with `reason: "range"`; `onFail` is ignored. The
	 * parameter is the encoded {@link DevEnginePackageManagerEntry} shape, so a
	 * plain object read off disk needs no `DevEngine` construction first.
	 *
	 * To write the entry back without its integrity (the bare form pnpm 11+
	 * writes), use `range` — the verbatim range with its operator kept and the
	 * integrity dropped.
	 *
	 * @param engine - the `devEngines.packageManager` entry to read
	 * @returns a `Result` succeeding with the {@link PackageManagerRange}, or
	 * failing with {@link InvalidPackageManagerRangeError}.
	 */
	static fromDevEngineResult(
		engine: DevEnginePackageManagerEntry,
	): Result.Result<PackageManagerRange, InvalidPackageManagerRangeError> {
		if (engine.version === undefined) {
			return Result.fail(InvalidPackageManagerRangeError.make({ input: engine.name, reason: "range" }));
		}
		return fromParts(`${engine.name}@${engine.version}`, engine.name, engine.version);
	}

	/**
	 * Read a `devEngines.packageManager` entry onto this model. Defined in
	 * terms of {@link PackageManagerRange.fromDevEngineResult}.
	 *
	 * @param engine - the `devEngines.packageManager` entry to read
	 * @returns the {@link PackageManagerRange}. Fails with
	 * {@link InvalidPackageManagerRangeError} when the name, range or integrity
	 * is malformed, or the entry has no `version`.
	 */
	static readonly fromDevEngine = Effect.fn("PackageManagerRange.fromDevEngine")(
		(engine: DevEnginePackageManagerEntry) => Effect.fromResult(PackageManagerRange.fromDevEngineResult(engine)),
	);

	/**
	 * The `packageManager` value without its integrity: `<name>@<range>`, range
	 * operator kept (`pnpm@^12.6.0+sha512.<hex>` → `pnpm@^12.6.0`). The
	 * `devEngines` counterpart is `range` itself.
	 */
	get bare(): string {
		return `${this.name}@${this.range}`;
	}

	/**
	 * The value as parsed: `<name>@<range>` or `<name>@<range>+<integrity>`.
	 * The encode direction of {@link PackageManagerRange.FromString} prints
	 * exactly this.
	 */
	override toString(): string {
		return O.match(this.integrity, {
			onNone: () => this.bare,
			onSome: (integrity) => `${this.bare}+${integrity}`,
		});
	}

	/**
	 * Whether the range is an exact, pinnable version (`11.2.0`) rather than a
	 * genuine range (`^11.20.0`) — decided by `SemVer.isPinnable` over the
	 * verbatim text, so `=11.2.0` and other range spellings of a single
	 * version report `false`. This is the exactness a consumer tracks when it
	 * must re-emit the same spelling it read.
	 */
	get isExact(): boolean {
		return SemVer.isPinnable(this.range);
	}

	/**
	 * The range's operator when it is a single exact, caret or tilde comparator
	 * over a pinnable version: `""` for `12.6.0`, `"^"` for `^12.6.0`, `"~"` for
	 * `~12.6.0`. `Option.none()` for anything else (`>=12 <13`, `12.x`,
	 * `=12.6.0`, `^12`), whose operator cannot be carried onto a new version
	 * unambiguously.
	 */
	get operator(): O.Option<"" | "^" | "~"> {
		return O.map(singleComparator(this.range), (parts) => parts.operator);
	}

	/**
	 * The version a single exact, caret or tilde comparator is anchored on
	 * (`^12.6.0` → `12.6.0`); `Option.none()` exactly when
	 * {@link PackageManagerRange.operator} is.
	 */
	get baseVersion(): O.Option<string> {
		return O.map(singleComparator(this.range), (parts) => parts.version);
	}

	/**
	 * The same range re-anchored on `version`, operator kept and integrity
	 * dropped (`^12.6.0+sha512.<hex>` with `12.8.1` → `^12.8.1`), synchronously,
	 * returning a `Result`.
	 *
	 * @remarks
	 * Only a single exact, caret or tilde comparator can be re-anchored (see
	 * {@link PackageManagerRange.operator}); any other range, or a `version`
	 * that is not a pinnable semver version, fails with `reason: "range"`. The
	 * integrity is dropped because it named the old version's artifact.
	 *
	 * @param version - the pinnable version to anchor the range on
	 * @returns a `Result` succeeding with the re-anchored
	 * {@link PackageManagerRange}, or failing with
	 * {@link InvalidPackageManagerRangeError}.
	 */
	withVersionResult(version: string): Result.Result<PackageManagerRange, InvalidPackageManagerRangeError> {
		const parts = singleComparator(this.range);
		if (O.isNone(parts) || !SemVer.isPinnable(version)) {
			return Result.fail(
				InvalidPackageManagerRangeError.make({ input: `${this.name}@${this.range} -> ${version}`, reason: "range" }),
			);
		}
		return Result.succeed(
			PackageManagerRange.make({
				name: this.name,
				range: `${parts.value.operator}${version}`,
				integrity: O.none(),
			}),
		);
	}

	/**
	 * The same range re-anchored on `version`. Defined in terms of
	 * {@link PackageManagerRange.withVersionResult}.
	 *
	 * @param version - the pinnable version to anchor the range on
	 * @returns the re-anchored {@link PackageManagerRange}. Fails with
	 * {@link InvalidPackageManagerRangeError} when the range is not a single
	 * exact, caret or tilde comparator, or `version` is not pinnable.
	 */
	withVersion(version: string): Effect.Effect<PackageManagerRange, InvalidPackageManagerRangeError> {
		return Effect.fromResult(this.withVersionResult(version));
	}

	/** Whether an integrity hash is present. */
	get hasIntegrity(): boolean {
		return O.isSome(this.integrity);
	}
}
