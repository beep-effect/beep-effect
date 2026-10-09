// The `packageManager` field model: a `PackageManager` class parsing
// `"pnpm@10.33.0+sha512.abc"` into `name` / `version` / `integrity` (a genuine
// `Option` — absence is computed on by `PackageManager.hasIntegrity`), with a
// `PackageManager.FromString` string codec.
//
// The field carries the corepack pin triple, and this module shares BOTH of the
// strict pieces with `@effected/npm`'s `PackageManagerPin` rather than
// re-deriving them: the integrity half is npm's `CorepackIntegrityHash`, and
// the version half IS `@effected/semver`'s `SemVer.PinnableVersionString` —
// the shared "exact version, no build metadata, no surrounding whitespace"
// schema, whose parse is the same strict one corepack performs with
// `semver.valid` (minus the trim: a padded version is a typed failure here).
//
// The one load-bearing grammar rule, identical to the pin's: the FIRST `+`
// after the version begins the integrity component. The version position never
// carries semver build metadata, so `pnpm@10.33.0+sha512.abc` is version
// `10.33.0` plus integrity `sha512.abc`, and a malformed tail after `+` fails
// typed rather than falling back to build-metadata parsing.
//
// What this module does NOT share with the pin is the name grammar; the
// `PackageManager` class remarks carry that decision and its evidence.

import { CorepackIntegrityHash } from "../npm/index.ts";
import { SemVer } from "../semver/index.ts";
import { Effect, Exit, Option, Schema, SchemaIssue, SchemaTransformation } from "effect";

// The name half of the grammar, deliberately looser than
// `PackageManagerPin`'s four literals — see the class remarks for why.
const PACKAGE_MANAGER_NAME_RE = /^[a-z]+$/;

const invalid = (input: string, message: string) => Effect.fail(new SchemaIssue.InvalidValue({ message }, input));

/**
 * A structured `packageManager` value with `name`, `version` and an optional
 * `integrity` hash.
 *
 * @remarks
 * The same `<name>@<version>[+<integrity>]` triple `@effected/npm`'s
 * `PackageManagerPin` models, in its `package.json` field form. Both share the
 * strict pieces — the version is `@effected/semver`'s
 * `SemVer.PinnableVersionString` (decode rules through `SemVer.isPinnable`),
 * the integrity is npm's `CorepackIntegrityHash` — and
 * both apply the first-`+`-is-integrity rule. Reach for the pin when
 * provisioning a package manager; reach for this class when reading or writing
 * the manifest field.
 *
 * **The one deliberate divergence is the name grammar**, and it points this
 * way: the pin closes the set to the four managers the kit can provision
 * (`npm | pnpm | yarn | bun`), while this field model accepts any lowercase
 * name. The evidence:
 *
 * - Corepack 0.34.0 (`specUtils.ts`, `parseSpec`) recognises **three** names —
 *   `npm`, `pnpm`, `yarn` — and throws an "unsupported package manager
 *   specification" usage error for any other. Adopting that set here would reject
 *   `bun@1.2.20`, which real published manifests carry, and a manifest model
 *   that cannot read them is useless for the job it has.
 * - Corepack does not treat the set as closed either. `parseSpec` skips the
 *   name check entirely when the spec is a URL, so a custom name is reachable
 *   in corepack's own grammar (behind `COREPACK_ENABLE_UNSAFE_CUSTOM_URLS`).
 * - npm documents no constraint on this field at all. Its `package.json`
 *   reference constrains only `devEngines.packageManager.name` — a different
 *   field, modeled here by `DevEngine` and out of scope for this class.
 *
 * So: field model = manifests as they exist in the wild; pin = the kit's
 * provisioning vocabulary. A name outside the pin's four is representable here
 * and simply will not be installable through the pin — which is the honest
 * relationship between a document model and a provisioning contract.
 *
 * @example
 * ```ts
 * import { PackageManager } from "./index.ts";
 * import { Schema } from "effect";
 *
 * const pm = Schema.decodeUnknownSync(PackageManager.FromString)("pnpm@10.33.0+sha512.abc");
 * pm.name; // => "pnpm"
 * pm.version; // => "10.33.0"
 * pm.hasIntegrity; // => true
 * ```
 *
 * @public
 */
export class PackageManager extends Schema.Class<PackageManager>("PackageManager")({
	/** The package-manager name (e.g. `pnpm`). Any lowercase name — see the class remarks. */
	name: Schema.String,
	/**
	 * The version (e.g. `10.33.0`): `@effected/semver`'s
	 * `SemVer.PinnableVersionString` — an exact SemVer 2.0.0 version with no
	 * build metadata and no surrounding whitespace. Prerelease versions are
	 * allowed (`10.0.0-rc.1`); ranges, partial versions, dist-tags,
	 * leading-zero components and padded values are not, and a version
	 * carrying build metadata is rejected at construction because the grammar
	 * cannot express it.
	 */
	version: SemVer.PinnableVersionString,
	/**
	 * The optional integrity hash (e.g. `sha512.abc`): `@effected/npm`'s
	 * `CorepackIntegrityHash`, the shared restriction of the `IntegrityHash`
	 * brand to the corepack `<algo>.<hex>` form.
	 */
	integrity: Schema.Option(CorepackIntegrityHash),
}) {
	/**
	 * Schema transformation between the `"name@version+integrity"` string and a
	 * {@link PackageManager}.
	 *
	 * @remarks
	 * Decoding splits on the first `@`, then on the first `+` — which always
	 * begins the integrity, never semver build metadata — and validates each
	 * component: the name against the lowercase grammar, the version through
	 * `@effected/semver`'s strict parse, the integrity through
	 * `CorepackIntegrityHash`. Every failure is a typed decode failure naming
	 * the component that failed. Encoding prints the canonical string, which is
	 * byte-identical to any input this codec accepts.
	 */
	static readonly FromString: Schema.Codec<PackageManager, string> = Schema.String.pipe(
		Schema.decodeTo(
			Schema.instanceOf(PackageManager),
			SchemaTransformation.transformEffect({
				decode: Effect.fn("decode")((input: string): Effect.Effect<PackageManager, SchemaIssue.Issue> => {
					const at = input.indexOf("@");
					if (at === -1) {
						return invalid(input, `Invalid packageManager format: "${input}"`);
					}
					const name = input.slice(0, at);
					if (!PACKAGE_MANAGER_NAME_RE.test(name)) {
						return invalid(input, `Invalid packageManager name: "${name}"`);
					}
					const rest = input.slice(at + 1);
					// The first `+` begins the integrity component, unconditionally —
					// the version position of this field never carries build metadata.
					const plus = rest.indexOf("+");
					const version = plus === -1 ? rest : rest.slice(0, plus);
					// Strict semver, matching corepack's own `semver.valid` check: a
					// leading-zero component (`01.2.3`), a leading-zero numeric
					// prerelease (`1.2.3-01`) or an empty prerelease identifier
					// (`1.2.3-a..b`) is malformed, not merely unusual. Stricter than
					// the trimming parse on one axis — a padded version substring
					// (`pnpm@ 10.33.0`) fails typed rather than being canonicalized.
					if (!SemVer.isPinnable(version)) {
						return invalid(input, `Invalid packageManager version: "${version}"`);
					}
					if (plus === -1) {
						return Effect.succeed(PackageManager.make({ name, version, integrity: Option.none() }));
					}
					// Validate the integrity through the corepack-restricted schema so a
					// malformed hash — or a valid SRI/yarn form the `packageManager`
					// field never legitimately carries — is a typed failure, not the
					// defect `make` would throw on a value the field schema rejects.
					const rawIntegrity = rest.slice(plus + 1);
					const decoded = Schema.decodeExit(CorepackIntegrityHash)(rawIntegrity);
					if (Exit.isFailure(decoded)) {
						return invalid(input, `Invalid packageManager integrity: "${rawIntegrity}"`);
					}
					return Effect.succeed(PackageManager.make({ name, version, integrity: Option.some(decoded.value) }));
				}),
				encode: (pm: PackageManager) =>
					Effect.succeed(
						Option.match(pm.integrity, {
							onNone: () => `${pm.name}@${pm.version}`,
							onSome: (integrity) => `${pm.name}@${pm.version}+${integrity}`,
						}),
					),
			}),
		),
	);

	/** Whether an integrity hash is present. */
	get hasIntegrity(): boolean {
		return Option.isSome(this.integrity);
	}
}
