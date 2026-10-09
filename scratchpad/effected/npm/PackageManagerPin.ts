// The corepack pin triple `<name>@<version>[+<integrity>]` as a first-class
// schema — e.g. `pnpm@11.17.0+sha512.abc…`. `@effected/package-json`'s
// `PackageManager.FromString` binds the same grammar to the `packageManager`
// field; this module gives the triple itself a reusable home beside the
// dependency vocabulary that lives here (`IntegrityHash`, `DependencySpecifier`).
//
// The one load-bearing grammar rule: the FIRST `+` after the version always
// begins the integrity component. A pin's version NEVER carries semver build
// metadata — `pnpm@11.17.0+sha512.abc` is version `11.17.0` plus integrity
// `sha512.abc`, and a malformed tail after a `+` is a typed failure, never a
// fallback to build-metadata parsing.

import { $ScratchpadId } from "@beep/identity/packages";
import { SemVer } from "../semver/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { CorepackIntegrityHash } from "./IntegrityHash.ts";

const $I = $ScratchpadId.create("effected/npm/PackageManagerPin");

/**
 * Indicates that a string could not be parsed as a corepack package-manager
 * pin (`<name>@<version>[+<integrity>]`).
 *
 * Raised by {@link PackageManagerPin.parse} and
 * {@link PackageManagerPin.parseResult}; the decode direction of
 * {@link PackageManagerPin.FromString} reports the same failure through a
 * generic `Schema` parse error carrying the same message. The offending string
 * is preserved on `input`; `reason` says which component failed.
 *
 * @public
 */
export class InvalidPackageManagerPinError extends S.TaggedError<InvalidPackageManagerPinError>($I`InvalidPackageManagerPinError`)(
	"InvalidPackageManagerPinError",
	{
		/** The raw input string that failed validation. */
		input: S.String.annotateKey({ description: "The raw input string that failed validation." }),
		/**
		 * Which component of the pin failed: `format` (no `@` separator at all),
		 * `name` (not one of the four supported package managers), `version` (not
		 * an exact SemVer 2.0.0 version — ranges, partial versions and dist-tags
		 * all land here), or `integrity` (the tail after `+` is not a corepack
		 * `<algo>.<hex>` hash).
		 */
		reason: S.Literals(["format", "name", "version", "integrity"]).annotateKey({ description: "Which component of the pin failed: `format` (no `@` separator at all), `name` (not one of the four supported package managers), `version` (not an exact SemVer 2.0.0 version — ranges, partial versions and dist-tags all land here), or `integrity` (the tail after `+` is not a corepack `<algo>.<hex>` hash)." }),
	}, $I.annote("InvalidPackageManagerPinError", { description: "Indicates that a string could not be parsed as a corepack package-manager pin (`<name>@<version>[+<integrity>]`)." }),
) {
	override get message(): string {
		return this.reason === "format"
			? `Invalid package-manager pin "${this.input}": expected <name>@<version>[+<integrity>]`
			: this.reason === "name"
				? `Invalid package-manager pin "${this.input}": name must be one of npm, pnpm, yarn, bun`
				: this.reason === "version"
					? `Invalid package-manager pin "${this.input}": version must be an exact SemVer version (ranges, partial versions and dist-tags are not pinnable)`
					: `Invalid package-manager pin "${this.input}": integrity must be a corepack <algo>.<hex> hash`;
	}
}

/**
 * The four package managers a corepack pin can name.
 *
 * @remarks
 * Structurally identical to `@effected/workspaces`' `PackageManagerName` and
 * `@effected/commands`' `Launcher`, and assigns freely to both. It is
 * deliberately a mirror, not an import: either edge would point from this
 * package at a downstream consumer and invert the dependency direction.
 *
 * **This four-literal set is narrower than the `packageManager` manifest field,
 * and the difference is deliberate.** `@effected/package-json`'s
 * `PackageManager` parses the identical `<name>@<version>[+<integrity>]`
 * grammar with the same strict version and the same shared corepack integrity,
 * but accepts any `[a-z]+` name, because a field model reads manifests it did
 * not write. This schema is the kit's *provisioning* vocabulary: a pin names
 * something the kit is prepared to install and run, so the set is closed by
 * what the kit supports rather than by what a manifest may contain. The two
 * name grammars are the one place the schemas diverge; see the field model's
 * remarks for the evidence behind the latitude.
 *
 * Worth knowing while reading corepack's own source: corepack (0.34.0,
 * `specUtils.ts`) supports **three** managers, `npm | pnpm | yarn`, and
 * `parseSpec` throws `Unsupported package manager specification` for anything
 * else. `bun` is in this set anyway — the kit provisions bun directly, not
 * through corepack — which is exactly why the set is stated in kit terms and
 * not copied from corepack.
 *
 * @public
 */
export const PackageManagerPinName = S.Literals(["npm", "pnpm", "yarn", "bun"]).pipe($I.annoteSchema("PackageManagerPinName", { description: "The four package managers a corepack pin can name." }));

/**
 * The decoded type of {@link (PackageManagerPinName:variable)}:
 * `"npm" | "pnpm" | "yarn" | "bun"`.
 *
 * @public
 */
export type PackageManagerPinName = typeof PackageManagerPinName.Type;

const isPinName = (value: string): value is PackageManagerPinName =>
	value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";

// A pin's version is an exact SemVer version with NO build metadata: the pin
// grammar cannot express it (the first `+` always begins the integrity), so a
// constructed version carrying build identifiers would encode to a string that
// re-parses differently. Rejecting it at the field keeps decode/encode sound.
const pinVersion = SemVer.pipe(
	S.check(
		S.makeFilter((version: SemVer) =>
			version.build.length === 0 ? undefined : "Expected a version without build metadata",
		),
	),
);

/**
 * A corepack package-manager pin: the `<name>@<version>[+<integrity>]` triple
 * (e.g. `pnpm@11.17.0+sha512.abc…`), independent of any `package.json` field.
 *
 * `version` is an exact `@effected/semver` `SemVer` — prerelease versions are
 * pinnable (`pnpm@10.0.0-rc.1` is a valid pin), ranges, partial versions and
 * dist-tags are not, and build metadata is impossible by grammar: the first
 * `+` after the version always begins the integrity component, so
 * `pnpm@11.17.0+sha512.abc` is version `11.17.0` plus integrity `sha512.abc`,
 * never version `11.17.0+sha512.abc`. `integrity`, when present, is an
 * {@link (IntegrityHash:variable)} restricted to the corepack `<algo>.<hex>`
 * form.
 *
 * A consequence worth stating loudly: a version tail that is valid **semver
 * build metadata but not a corepack integrity** — `pnpm@10.20.0+deadbeef`,
 * say — is intentionally outside the pin grammar and fails with
 * `reason: "integrity"`. Build-metadata-carrying versions are not pinnable by
 * design; the `+` position is spoken for.
 *
 * @example
 * ```ts
 * import { PackageManagerPin } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const pin = yield* PackageManagerPin.parse("pnpm@11.17.0+sha512.deadbeef");
 *   return [pin.name, pin.version.toString(), pin.integrity] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => ["pnpm", "11.17.0", "sha512.deadbeef"]
 * ```
 *
 * @public
 */
export class PackageManagerPin extends S.Class<PackageManagerPin>($I`PackageManagerPin`)({
	/** The package-manager name (`npm`, `pnpm`, `yarn` or `bun`). */
	name: PackageManagerPinName.annotateKey({ description: "The package-manager name (`npm`, `pnpm`, `yarn` or `bun`)." }),
	/**
	 * The exact pinned version. Never carries build metadata — the pin grammar
	 * cannot express it (see the class remarks), and a version constructed with
	 * build identifiers is rejected at construction.
	 */
	version: pinVersion.annotateKey({ description: "The exact pinned version. Never carries build metadata — the pin grammar cannot express it (see the class remarks), and a version constructed with build identifiers is rejected at construction." }),
	/**
	 * The optional integrity hash (e.g. `sha512.abc…`):
	 * {@link (CorepackIntegrityHash:variable)}, the shared restriction of the
	 * `IntegrityHash` brand to the corepack `<algo>.<hex>` form. Absent when the
	 * pin carries no `+<integrity>` tail — never present-but-`undefined`.
	 */
	integrity: S.optionalKey(CorepackIntegrityHash).annotateKey({ description: "The optional integrity hash (e.g. `sha512.abc…`): (CorepackIntegrityHash:variable), the shared restriction of the `IntegrityHash` brand to the corepack `<algo>.<hex>` form. Absent when the pin carries no `+<integrity>` tail — never present-but-`undefined`." }),
}, $I.annote("PackageManagerPin", { description: "A corepack package-manager pin: the `<name>@<version>[+<integrity>]` triple (e.g. `pnpm@11.17.0+sha512.abc…`), independent of any `package.json` field." })) {
	/**
	 * Schema transformation between the `<name>@<version>[+<integrity>]` string
	 * and a {@link PackageManagerPin}. Decoding parses via
	 * {@link PackageManagerPin.parseResult} (the three surfaces share one
	 * grammar and cannot diverge); encoding prints the canonical pin string.
	 */
	static readonly FromString: S.Codec<PackageManagerPin, string> = S.String.pipe(
		S.decodeTo(
			S.instanceOf(PackageManagerPin),
			SchemaTransformation.transformEffect({
				decode: (input: string) => {
					const parsed = PackageManagerPin.parseResult(input);
					return Result.isSuccess(parsed)
						? Effect.succeed(parsed.success)
						: Effect.fail(new SchemaIssue.InvalidValue({ message: parsed.failure.message }, input));
				},
				encode: (pin: PackageManagerPin) => Effect.succeed(pin.toString()),
			}),
		),
	);

	/**
	 * Parse a corepack pin string, synchronously, returning a `Result` instead
	 * of an `Effect`.
	 *
	 * The first `+` after the version always begins the integrity component: a
	 * pin's version never carries semver build metadata, and a malformed tail
	 * after a `+` fails with `reason: "integrity"` rather than falling back to
	 * build-metadata parsing — `pnpm@10.20.0+deadbeef`, whose tail is valid
	 * semver build metadata but not a corepack `<algo>.<hex>` hash, is
	 * intentionally not pinnable. Prerelease versions are accepted; ranges
	 * (`^9.0.0`), partial versions (`9`, `9.1`), dist-tags (`latest`,
	 * `berry`) and padded versions (`pnpm@ 11.17.0` — the version substring is
	 * ruled on by `@effected/semver`'s `SemVer.isPinnable`, which rejects
	 * surrounding whitespace) fail with `reason: "version"`.
	 *
	 * @remarks
	 * {@link PackageManagerPin.parse} is defined in terms of this function; the
	 * two never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `PackageManagerPin.parse` tracing span — and for this one at
	 * synchronous boundaries.
	 *
	 * @param input - the pin string to parse
	 * @returns a `Result` succeeding with the parsed {@link PackageManagerPin},
	 * or failing with {@link InvalidPackageManagerPinError} when `input` is not
	 * a valid pin.
	 */
	static parseResult(input: string): Result.Result<PackageManagerPin, InvalidPackageManagerPinError> {
		const at = input.indexOf("@");
		if (at === -1) {
			return Result.fail(InvalidPackageManagerPinError.make({ input, reason: "format" }));
		}
		const name = input.slice(0, at);
		if (!isPinName(name)) {
			return Result.fail(InvalidPackageManagerPinError.make({ input, reason: "name" }));
		}
		const rest = input.slice(at + 1);
		// The first `+` begins the integrity component, unconditionally — the
		// version part of a pin never carries build metadata.
		const plus = rest.indexOf("+");
		const candidate = plus === -1 ? rest : rest.slice(0, plus);
		// The string-level ruling is `SemVer.isPinnable` — the same export
		// `@effected/package-json`'s field model consumes — and it is stricter
		// than the trimming parse: a padded version substring (`pnpm@ 11.17.0`)
		// fails typed here rather than being silently canonicalized.
		const version = SemVer.parseResult(candidate);
		if (Result.isFailure(version) || !SemVer.isPinnable(candidate)) {
			return Result.fail(InvalidPackageManagerPinError.make({ input, reason: "version" }));
		}
		if (plus === -1) {
			return Result.succeed(PackageManagerPin.make({ name, version: version.success }));
		}
		const integrity = S.decodeExit(CorepackIntegrityHash)(rest.slice(plus + 1));
		if (Exit.isFailure(integrity)) {
			return Result.fail(InvalidPackageManagerPinError.make({ input, reason: "integrity" }));
		}
		return Result.succeed(PackageManagerPin.make({ name, version: version.success, integrity: integrity.value }));
	}

	/**
	 * Parse a corepack pin string. Defined in terms of
	 * {@link PackageManagerPin.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * @param input - the pin string to parse
	 * @returns the parsed {@link PackageManagerPin}. Fails with
	 * {@link InvalidPackageManagerPinError} when `input` is not a valid pin.
	 */
	static readonly parse = Effect.fn("PackageManagerPin.parse")((input: string) =>
		Effect.fromResult(PackageManagerPin.parseResult(input)),
	);

	/**
	 * The pin without its integrity: `<name>@<version>`
	 * (`pnpm@12.6.0+sha512.<hex>` → `pnpm@12.6.0`), the bare form pnpm itself
	 * writes to the `packageManager` field.
	 */
	get bare(): string {
		return `${this.name}@${this.version.toString()}`;
	}

	/**
	 * The canonical pin string: `<name>@<version>` or
	 * `<name>@<version>+<integrity>`. The encode direction of
	 * {@link PackageManagerPin.FromString} prints exactly this.
	 */
	override toString(): string {
		return this.integrity === undefined ? this.bare : `${this.bare}+${this.integrity}`;
	}
}
