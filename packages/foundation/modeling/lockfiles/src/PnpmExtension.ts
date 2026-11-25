/**
 * The pnpm-specific residue a `pnpm-lock.yaml` header records: catalogs,
 * overrides and settings, attached to `Lockfile.extension`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LockfilesId.create("PnpmExtension");

/**
 * One pinned catalog entry as `pnpm-lock.yaml` records it: the declared
 * specifier and the version it resolved to.
 *
 * **Example** (Validate a catalog pin)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PnpmCatalogPin } from "@beep/lockfiles/PnpmExtension";
 *
 * console.log(S.is(PnpmCatalogPin)({ specifier: "^4.0.0", version: "4.0.2" })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PnpmCatalogPin extends S.Opaque<PnpmCatalogPin, { readonly brand: unique symbol }>()(
  S.Struct({
    specifier: S.String.pipe(
      $I.annoteKey("PnpmCatalogPin.specifier", {
        description: "Dependency specifier declared by the catalog entry",
      })
    ),
    version: S.String.pipe(
      $I.annoteKey("PnpmCatalogPin.version", {
        description: "Pinned version resolved for the catalog entry",
      })
    ),
  }).pipe(
    $I.annoteSchema("PnpmCatalogPin", {
      description: "A pnpm catalog entry's declared specifier and the version it resolved to",
    })
  )
) {}

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PnpmCatalogPin {
  /**
   * The plain, unbranded encoded shape of a {@link PnpmCatalogPin}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PnpmCatalogPin.Encoded;
}

/**
 * The pnpm `catalogs:` record shape as it appears in `pnpm-lock.yaml`:
 * catalog name → package name → pinned version string or
 * {@link PnpmCatalogPin}.
 *
 * **Details**
 *
 * Exported so consumers (e.g. a `CatalogSet.fromLockfileCatalogs`) can type
 * against the lockfile's own shape instead of re-declaring it.
 *
 * **Example** (Validate catalog entries)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PnpmCatalogs } from "@beep/lockfiles/PnpmExtension";
 *
 * console.log(S.is(PnpmCatalogs)({ default: { effect: { specifier: "^4.0.0", version: "4.0.2" } } })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PnpmCatalogs = S.Record(
  S.String,
  S.mutableKey(S.Record(S.String, S.mutableKey(S.Union([S.String, PnpmCatalogPin]))))
).pipe(
  $I.annoteSchema("PnpmCatalogs", {
    description: "Catalog names mapped to package versions or specifier/version pairs preserved from the pnpm lockfile",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PnpmCatalogs = typeof PnpmCatalogs.Type;

/**
 * **Details**
 *
 * - `catalogs` — pnpm catalog definitions ({@link PnpmCatalogs}).
 * - `overrides` — the version override map recorded in the lockfile header.
 * - `settings` — pnpm settings recorded in the lockfile header.
 * - `publishDirTargets` — normalized declared publish directories mapped to workspace importer paths.
 *
 * **Example** (Construct pnpm header metadata)
 *
 * ```ts
 * import { PnpmExtension } from "@beep/lockfiles/PnpmExtension";
 *
 * const extension = PnpmExtension.make({ overrides: { effect: "4.0.2" } });
 * console.log(extension._tag); // pnpm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PnpmExtension extends S.Opaque<PnpmExtension, { readonly brand: unique symbol }>()(
  S.TaggedStruct("pnpm", {
    publishDirTargets: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("PnpmExtension.publishDirTargets", {
        description: "Normalized declared publish-directory targets mapped to their workspace importer paths",
      })
    ),
    catalogs: S.optionalKey(PnpmCatalogs).pipe(
      $I.annoteKey("PnpmExtension.catalogs", {
        description:
          "Catalog definitions recorded in the lockfile, mapping catalog and package names to pinned versions or specifier/version pairs",
      })
    ),
    overrides: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("PnpmExtension.overrides", {
        description: "Dependency version overrides recorded in the pnpm lockfile header",
      })
    ),
    settings: S.optionalKey(
      S.Struct({
        autoInstallPeers: S.optionalKey(S.Boolean),
        excludeLinksFromLockfile: S.optionalKey(S.Boolean),
      })
    ).pipe(
      $I.annoteKey("PnpmExtension.settings", {
        description: "Peer auto-installation and link-exclusion settings recorded in the pnpm lockfile header",
      })
    ),
  }).pipe(
    $I.annoteSchema("PnpmExtension", {
      description:
        'Extension data specific to pnpm lockfiles, attached to `Lockfile.extension` when the format is `"pnpm"`.',
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PnpmExtension {
  /**
   * The plain, unbranded encoded shape of a {@link PnpmExtension}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PnpmExtension.Encoded;
}
