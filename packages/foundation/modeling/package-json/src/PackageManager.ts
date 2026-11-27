/**
 * The `packageManager` field model: a `PackageManager` class parsing
 * `"pnpm@10.33.0+sha512.abc"` into `name` / `version` / `integrity` (a genuine
 * `Option` — absence is computed on by `PackageManager.hasIntegrity`), with a
 * `PackageManager.FromString` string codec.
 *
 * **Details**
 *
 * The field carries the corepack pin triple, and this module shares BOTH of the
 * strict pieces with `@beep/npm-spec`'s `PackageManagerPin` rather than
 * re-deriving them: the integrity half is npm's `CorepackIntegrityHash`, and
 * the version half IS `@beep/semver`'s `SemVer.PinnableVersionString` —
 * the shared "exact version, no build metadata, no surrounding whitespace"
 * schema, whose parse is the same strict one corepack performs with
 * `semver.valid` (minus the trim: a padded version is a typed failure here).
 *
 * The one load-bearing grammar rule, identical to the pin's: the FIRST `+`
 * after the version begins the integrity component. The version position never
 * carries semver build metadata, so `pnpm@10.33.0+sha512.abc` is version
 * `10.33.0` plus integrity `sha512.abc`, and a malformed tail after `+` fails
 * typed rather than falling back to build-metadata parsing.
 *
 * What this module does NOT share with the pin is the name grammar; the
 * `PackageManager` class remarks carry that decision and its evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import { CorepackIntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { SemVer } from "@beep/semver";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $PackageJsonId.create("PackageManager");

const PACKAGE_MANAGER_NAME_RE = /^[a-z]+$/;

const invalid: {
  (input: string, message: string): Effect.Effect<never, SchemaIssue.InvalidValue>;
  (message: string): (input: string) => Effect.Effect<never, SchemaIssue.InvalidValue>;
} = dual(
  2,
  (input: string, message: string): Effect.Effect<never, SchemaIssue.InvalidValue> =>
    Effect.fail(new SchemaIssue.InvalidValue({ message }, input))
);

/**
 * **Details**
 *
 * The same `<name>@<version>[+<integrity>]` triple `@beep/npm-spec`'s
 * `PackageManagerPin` models, in its `package.json` field form. Both share the
 * strict pieces — the version is `@beep/semver`'s
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
 * **Example** (Decode a package manager pin with integrity)
 *
 * ```ts
 * import { PackageManager } from "@beep/package-json/PackageManager";
 * import * as S from "effect/Schema";
 *
 * const pm = S.decodeUnknownSync(PackageManager.FromString)("pnpm@10.33.0+sha512.abc");
 * console.log(pm.name) // pnpm
 * console.log(pm.version) // 10.33.0
 * console.log(pm.hasIntegrity) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PackageManager extends S.Class<PackageManager, { readonly brand: unique symbol }>($I`PackageManager`)(
  {
    /**
     * The package-manager name (e.g. `pnpm`). Any lowercase name — see the class remarks.
     *
     * @since 0.0.0
     */
    name: S.String.pipe(
      $I.annoteKey("PackageManager.name", {
        description: "The package-manager name (e.g. `pnpm`). Any lowercase name — see the class remarks.",
      })
    ),
    /**
     * The version (e.g. `10.33.0`): `@beep/semver`'s
     * `SemVer.PinnableVersionString` — an exact SemVer 2.0.0 version with no
     * build metadata and no surrounding whitespace. Prerelease versions are
     * allowed (`10.0.0-rc.1`); ranges, partial versions, dist-tags,
     * leading-zero components and padded values are not, and a version
     * carrying build metadata is rejected at construction because the grammar
     * cannot express it.
     *
     * @since 0.0.0
     */
    version: SemVer.PinnableVersionString,
    /**
     * The optional integrity hash (e.g. `sha512.abc`): `@beep/npm-spec`'s
     * `CorepackIntegrityHash`, the shared restriction of the `IntegrityHash`
     * brand to the corepack `<algo>.<hex>` form.
     *
     * @since 0.0.0
     */
    integrity: S.Option(CorepackIntegrityHash).pipe(
      $I.annoteKey("PackageManager.integrity", {
        description:
          "The optional integrity hash (e.g. `sha512.abc`): `@beep/npm-spec`'s `CorepackIntegrityHash`, the shared restriction of the `IntegrityHash` brand to the corepack `<algo>.<hex>` form.",
      })
    ),
  },
  $I.annote("PackageManager", {
    description: "A structured `packageManager` value with `name`, `version` and an optional `integrity` hash.",
  })
) {
  /**
   * Schema transformation between the `"name@version+integrity"` string and a
   * {@link PackageManager}.
   *
   * **Details**
   *
   * Decoding splits on the first `@`, then on the first `+` — which always
   * begins the integrity, never semver build metadata — and validates each
   * component: the name against the lowercase grammar, the version through
   * `@beep/semver`'s strict parse, the integrity through
   * `CorepackIntegrityHash`. Every failure is a typed decode failure naming
   * the component that failed. Encoding prints the canonical string, which is
   * byte-identical to any input this codec accepts.
   *
   * **Example** (Round-trip a package manager string)
   *
   * ```ts
   * import { PackageManager } from "@beep/package-json/PackageManager";
   * import * as S from "effect/Schema";
   *
   * const pm = S.decodeUnknownSync(PackageManager.FromString)("pnpm@10.33.0");
   * console.log(S.encodeSync(PackageManager.FromString)(pm)) // pnpm@10.33.0
   * ```
   *
   * @category schemas
   * @since 0.0.0
   */
  static readonly FromString: S.Codec<PackageManager, string> = S.String.pipe(
    S.decodeTo(
      S.instanceOf(PackageManager),
      SchemaTransformation.transformEffect({
        decode: (input: string): Effect.Effect<PackageManager, SchemaIssue.Issue> =>
          Effect.flatMap(
            O.match(Str.indexOf("@")(input), {
              onNone: () => invalid(input, `Invalid packageManager format: "${input}"`),
              onSome: (at) => Effect.succeed({ name: Str.slice(0, at)(input), rest: Str.slice(at + 1)(input) }),
            }),
            ({ name, rest }) => {
              if (!PACKAGE_MANAGER_NAME_RE.test(name)) {
                return invalid(input, `Invalid packageManager name: "${name}"`);
              }
              const plus = Str.indexOf("+")(rest);
              const version = O.match(plus, {
                onNone: () => rest,
                onSome: (at) => Str.slice(0, at)(rest),
              });
              if (!SemVer.isPinnable(version)) {
                return invalid(input, `Invalid packageManager version: "${version}"`);
              }
              return O.match(plus, {
                onNone: () => Effect.succeed(PackageManager.make({ name, version, integrity: O.none() })),
                onSome: (at): Effect.Effect<PackageManager, SchemaIssue.Issue> => {
                  const rawIntegrity = Str.slice(at + 1)(rest);
                  const decoded = S.decodeExit(CorepackIntegrityHash)(rawIntegrity);
                  if (Exit.isFailure(decoded)) {
                    return invalid(input, `Invalid packageManager integrity: "${rawIntegrity}"`);
                  }
                  return Effect.succeed(PackageManager.make({ name, version, integrity: O.some(decoded.value) }));
                },
              });
            }
          ),
        encode: (pm: PackageManager) =>
          Effect.succeed(
            O.match(pm.integrity, {
              onNone: () => `${pm.name}@${pm.version}`,
              onSome: (integrity) => `${pm.name}@${pm.version}+${integrity}`,
            })
          ),
      })
    )
  );

  /**
   * Whether an integrity hash is present.
   *
   * **Example** (Detect a pin without an integrity hash)
   *
   * ```ts
   * import { PackageManager } from "@beep/package-json/PackageManager";
   * import * as S from "effect/Schema";
   *
   * const pm = S.decodeUnknownSync(PackageManager.FromString)("pnpm@10.33.0");
   * console.log(pm.hasIntegrity) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get hasIntegrity(): boolean {
    return O.isSome(this.integrity);
  }
}
