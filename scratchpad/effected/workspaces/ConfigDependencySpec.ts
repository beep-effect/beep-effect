// The `configDependencies` value model: a `ConfigDependencySpec` class parsing
// a `pnpm-workspace.yaml` config-dependency spec — `0.11.1` (the bare form
// pnpm 11+ writes) or `0.11.1+sha512-<base64>` (the legacy inline-integrity
// form) — into a strict `version` and an optional SRI `integrity`.
//
// pnpm 11 moved config-dependency integrity into the lockfile and
// `pnpm add --config` writes the bare version, so a tool that touches the
// field normalizes to `bare`; `toString()` keeps the spelling it read for a
// tool that must not rewrite it.
//
// The split itself lives in `internal/configDependencySpecGrammar.ts`, shared
// with the hook-replay ladder, which keeps its lenient (unvalidated) reading of
// the version half — see that module for why.

import { $ScratchpadId } from "@beep/identity/packages";
import { SriIntegrityHash } from "../npm/index.ts";
import { SemVer } from "../semver/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { splitConfigDependencySpec } from "./internal/configDependencySpecGrammar.ts";

const $I = $ScratchpadId.create("effected/workspaces/ConfigDependencySpec");

/**
 * Indicates that a string could not be parsed as a pnpm `configDependencies`
 * spec (`<version>[+<integrity>]`).
 *
 * Raised by {@link ConfigDependencySpec.parse} and
 * {@link ConfigDependencySpec.parseResult}; the decode direction of
 * {@link ConfigDependencySpec.FromString} reports the same failure through a
 * generic `Schema` parse error carrying the same message. The offending string
 * is preserved on `input`; `reason` says which half failed.
 *
 * @public
 */
export class InvalidConfigDependencySpecError extends S.TaggedError<InvalidConfigDependencySpecError>($I`InvalidConfigDependencySpecError`)(
	"InvalidConfigDependencySpecError",
	{
		/** The raw spec string that failed validation. */
		input: S.String.annotateKey({ description: "The raw spec string that failed validation." }),
		/**
		 * Which half of the spec failed: `version` (the text before the first
		 * `+` is not an exact SemVer version — ranges, partial versions,
		 * dist-tags and padded values all land here) or `integrity` (the text
		 * after the first `+` is not an SRI `<algo>-<base64>` hash).
		 */
		reason: S.Literals(["version", "integrity"]).annotateKey({ description: "Which half of the spec failed: `version` (the text before the first `+` is not an exact SemVer version — ranges, partial versions, dist-tags and padded values all land here) or `integrity` (the text after the first `+` is not an SRI `<algo>-<base64>` hash)." }),
	}, $I.annote("InvalidConfigDependencySpecError", { description: "Indicates that a string could not be parsed as a pnpm `configDependencies` spec (`<version>[+<integrity>]`)." }),
) {
	override get message(): string {
		return this.reason === "version"
			? `Invalid config dependency spec "${this.input}": version must be an exact SemVer version (ranges, partial versions and dist-tags are not allowed)`
			: `Invalid config dependency spec "${this.input}": integrity must be an SRI <algo>-<base64> hash`;
	}
}

// A config dependency's version is exact and carries NO build metadata: the
// spec grammar cannot express it (the first `+` always begins the integrity),
// so a constructed version with build identifiers would encode to a string
// that re-parses differently. Rejecting it at the field keeps decode/encode
// sound — the same rule `@effected/npm`'s `PackageManagerPin` applies.
const specVersion = SemVer.pipe(
	S.check(
		S.makeFilter((version: SemVer) =>
			version.build.length === 0 ? undefined : "Expected a version without build metadata",
		),
	),
);

/**
 * A pnpm `configDependencies` spec from `pnpm-workspace.yaml`: an exact
 * `version` and, on the legacy inline form only, an SRI `integrity`.
 *
 * @remarks
 * pnpm 11 and later write the **bare** form — `pnpm add --config` records
 * `0.11.1`, and the integrity lives in the lockfile. The inline form
 * `0.11.1+sha512-<base64>` is deprecated but still read, and workspaces in the
 * wild still carry it. {@link ConfigDependencySpec.bare} renders the bare form
 * (a tool normalizing the field writes this); `toString()` re-renders the form
 * that was parsed, so a tool that must not rewrite the field round-trips it
 * byte-identically.
 *
 * The first `+` always begins the integrity, never semver build metadata, so
 * `0.11.1+sha512-…` is version `0.11.1` plus integrity `sha512-…`; a tail that
 * is not an SRI hash fails with `reason: "integrity"` rather than falling back
 * to build-metadata parsing.
 *
 * `version` is `@effected/semver`'s `SemVer`: prerelease versions are
 * accepted, ranges (`^0.11.1`), partial versions, dist-tags, a `v` prefix and
 * padded values are not.
 *
 * @example
 * ```ts
 * import { ConfigDependencySpec } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const spec = yield* ConfigDependencySpec.parse("0.11.1+sha512-m35m…==");
 *   return [spec.bare, spec.hasIntegrity] as const; // ["0.11.1", true]
 * });
 * ```
 *
 * @public
 */
export class ConfigDependencySpec extends S.Class<ConfigDependencySpec>($I`ConfigDependencySpec`)({
	/**
	 * The exact declared version. Never carries build metadata — the spec
	 * grammar cannot express it (see the class remarks), and a version
	 * constructed with build identifiers is rejected at construction.
	 */
	version: specVersion.annotateKey({ description: "The exact declared version. Never carries build metadata — the spec grammar cannot express it (see the class remarks), and a version constructed with build identifiers is rejected at construction." }),
	/**
	 * The inline integrity (e.g. `sha512-m35m…==`): `@effected/npm`'s
	 * `SriIntegrityHash`, the shared restriction of the `IntegrityHash` brand
	 * to the SRI `<algo>-<base64>` form. `None` on the bare form pnpm 11+
	 * writes.
	 */
	integrity: S.Option(SriIntegrityHash).annotateKey({ description: "The inline integrity (e.g. `sha512-m35m…==`): `@effected/npm`'s `SriIntegrityHash`, the shared restriction of the `IntegrityHash` brand to the SRI `<algo>-<base64>` form. `None` on the bare form pnpm 11+ writes." }),
}, $I.annote("ConfigDependencySpec", { description: "A pnpm `configDependencies` spec from `pnpm-workspace.yaml`: an exact `version` and, on the legacy inline form only, an SRI `integrity`." })) {
	/**
	 * Schema transformation between the `<version>[+<integrity>]` string and a
	 * {@link ConfigDependencySpec}. Decoding parses via
	 * {@link ConfigDependencySpec.parseResult} (the surfaces share one grammar);
	 * encoding prints `toString()`, the form that was parsed.
	 */
	static readonly FromString: S.Codec<ConfigDependencySpec, string> = S.String.pipe(
		S.decodeTo(
			S.instanceOf(ConfigDependencySpec),
			SchemaTransformation.transformEffect({
				decode: (input: string) => {
					const parsed = ConfigDependencySpec.parseResult(input);
					return Result.isSuccess(parsed)
						? Effect.succeed(parsed.success)
						: Effect.fail(new SchemaIssue.InvalidValue({ message: parsed.failure.message }, input));
				},
				encode: (spec: ConfigDependencySpec) => Effect.succeed(spec.toString()),
			}),
		),
	);

	/**
	 * Parse a `configDependencies` spec, synchronously, returning a `Result`
	 * instead of an `Effect`.
	 *
	 * @remarks
	 * The text before the first `+` must be an exact SemVer version that
	 * renders back to itself byte for byte (`SemVer.isPinnable`, plus a
	 * canonical-spelling check so `toString()` round-trips); the text after it,
	 * when present, must be an SRI `<algo>-<base64>` hash. An empty tail
	 * (`0.11.1+`) is an integrity failure, not a bare spec.
	 * {@link ConfigDependencySpec.parse} is defined in terms of this function.
	 *
	 * @param input - the spec string to parse
	 * @returns a `Result` succeeding with the parsed {@link ConfigDependencySpec},
	 * or failing with {@link InvalidConfigDependencySpecError} naming the half
	 * that failed.
	 */
	static parseResult(input: string): Result.Result<ConfigDependencySpec, InvalidConfigDependencySpecError> {
		const parts = splitConfigDependencySpec(input);
		const version = SemVer.parseResult(parts.version);
		if (
			Result.isFailure(version) ||
			!SemVer.isPinnable(parts.version) ||
			version.success.toString() !== parts.version
		) {
			return Result.fail(InvalidConfigDependencySpecError.make({ input, reason: "version" }));
		}
		if (parts.integrity === undefined) {
			return Result.succeed(ConfigDependencySpec.make({ version: version.success, integrity: O.none() }));
		}
		const integrity = S.decodeExit(SriIntegrityHash)(parts.integrity);
		if (Exit.isFailure(integrity)) {
			return Result.fail(InvalidConfigDependencySpecError.make({ input, reason: "integrity" }));
		}
		return Result.succeed(
			ConfigDependencySpec.make({ version: version.success, integrity: O.some(integrity.value) }),
		);
	}

	/**
	 * Parse a `configDependencies` spec. Defined in terms of
	 * {@link ConfigDependencySpec.parseResult} — synchronous callers can use
	 * that variant directly.
	 *
	 * @param input - the spec string to parse
	 * @returns the parsed {@link ConfigDependencySpec}. Fails with
	 * {@link InvalidConfigDependencySpecError} when `input` is not a valid spec.
	 */
	static readonly parse = Effect.fn("ConfigDependencySpec.parse")((input: string) =>
		Effect.fromResult(ConfigDependencySpec.parseResult(input)),
	);

	/** Whether the spec carries an inline integrity (the legacy form). */
	get hasIntegrity(): boolean {
		return O.isSome(this.integrity);
	}

	/**
	 * The bare `<version>` form — what pnpm 11+ writes to `configDependencies`
	 * — with any inline integrity dropped.
	 */
	get bare(): string {
		return this.version.toString();
	}

	/**
	 * The spec as parsed: `<version>` or `<version>+<integrity>`. The encode
	 * direction of {@link ConfigDependencySpec.FromString} prints exactly this.
	 */
	override toString(): string {
		return O.match(this.integrity, {
			onNone: () => this.bare,
			onSome: (integrity) => `${this.bare}+${integrity}`,
		});
	}
}
