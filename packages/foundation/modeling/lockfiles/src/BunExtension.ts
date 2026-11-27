/**
 * The bun-specific residue a `bun.lock` records beside its packages: the
 * default and named catalogs, the dependency overrides and the trusted
 * dependencies, attached to `Lockfile.extension`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LockfilesId.create("BunExtension");

type OverrideValue = string | { readonly [dependency: string]: OverrideValue };

const OverrideValue: S.Codec<OverrideValue> = S.Union([
  S.String,
  S.Record(
    S.String,
    S.suspend((): S.Codec<OverrideValue> => OverrideValue)
  ),
]).pipe(
  $I.annoteSchema("OverrideValue", {
    description: "A dependency specifier or nested npm-style override rules, including the self rule '.'",
  })
);

/**
 * **Details**
 * - `catalog` — the default (unnamed) catalog.
 * - `catalogs` — named catalog definitions.
 * - `overrides` — dependency specifiers and nested npm-style override rules.
 * - `trustedDependencies` — packages allowed to run install scripts.
 *
 * **Example** (Preserve a parent-scoped override)
 *
 * ```ts
 * import { BunExtension } from "@beep/lockfiles/BunExtension";
 *
 * const extension = BunExtension.make({ overrides: { parent: { child: "^2.0.0" } } });
 * extension.overrides; // { parent: { child: "^2.0.0" } }
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BunExtension extends S.Opaque<BunExtension, { readonly brand: unique symbol }>()(
  S.TaggedStruct("bun", {
    catalog: S.optionalKey(S.Record(S.String, S.Unknown)).pipe(
      $I.annoteKey("BunExtension.catalog", {
        description: "Default unnamed catalog entries preserved from the bun lockfile",
      })
    ),
    catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))).pipe(
      $I.annoteKey("BunExtension.catalogs", {
        description: "Catalog definitions preserved from the bun lockfile, keyed by catalog name",
      })
    ),
    overrides: S.optionalKey(S.Record(S.String, OverrideValue)).pipe(
      $I.annoteKey("BunExtension.overrides", {
        description:
          "Dependency override rules preserved from the bun lockfile, including nested and version-scoped rules",
      })
    ),
    trustedDependencies: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("BunExtension.trustedDependencies", {
        description: "Packages the bun lockfile allows to run install scripts",
      })
    ),
  }).pipe(
    $I.annoteSchema("BunExtension", {
      description:
        'Extension data specific to bun lockfiles, attached to `Lockfile.extension` when the format is `"bun"`.',
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BunExtension {
  /**
   * The plain, unbranded encoded shape of a {@link BunExtension}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BunExtension.Encoded;
}
