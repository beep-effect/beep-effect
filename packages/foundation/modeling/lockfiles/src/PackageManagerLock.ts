/**
 * The package manager a `pnpm-lock.yaml` pins, with the integrity its env
 * preamble records for it and its native packages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LockfilesId.create("PackageManagerLock");

/**
 * **Details**
 *
 * pnpm records the package manager a workspace declares in
 * `devEngines.packageManager` as the root importer's
 * `packageManagerDependencies` in the env preamble document, and resolves it
 * like any other dependency: the preamble's `packages:` section carries its
 * integrity, and pnpm refuses to run a manager whose identity does not match.
 * That makes the lockfile, not the `+sha512.<hex>` suffix on the declared
 * version, the checksum store for the manager itself.
 *
 * - `name` — the package-manager package, always `"pnpm"`.
 * - `specifier` — the declared specifier, verbatim. It may still carry the
 *   corepack-style `+sha512.<hex>` suffix the manifest declared it with.
 * - `version` — the exact version pnpm resolved the specifier to.
 * - `integrity` — the SRI integrity (`sha512-<base64>`) of the
 *   `pnpm@<version>` package.
 * - `nativeIntegrity` — SRI integrity per native package, keyed by package
 *   name with no version (`"@pnpm/exe.linux-x64"`): every package the lockfile
 *   records as an optional dependency of `pnpm@<version>`. pnpm 12 records one
 *   `@pnpm/exe.<target>` entry per platform there; pnpm 11 records none, so
 *   the record is empty — pnpm 11 hangs its platform binaries off a separate
 *   `@pnpm/exe` wrapper entry instead, which this model does not carry.
 *
 * **Example** (Inspect the pinned manager version)
 *
 * ```ts
 * import { PackageManagerLock } from "@beep/lockfiles/PackageManagerLock";
 *
 * const manager = PackageManagerLock.make({ name: "pnpm", specifier: "12.7.0", version: "12.7.0", integrity: "sha512-YWJj", nativeIntegrity: {} });
 * console.log(manager.version); // 12.7.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PackageManagerLock extends S.Opaque<PackageManagerLock, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.tag("pnpm").pipe(
      $I.annoteKey("PackageManagerLock.name", {
        description: "Package manager pinned by the env preamble, always `pnpm`",
      })
    ),
    specifier: S.String.pipe(
      $I.annoteKey("PackageManagerLock.specifier", {
        description:
          "Declared package manager specifier recorded verbatim, potentially retaining a corepack-style integrity suffix",
      })
    ),
    version: S.String.pipe(
      $I.annoteKey("PackageManagerLock.version", {
        description: "Exact pnpm package version resolved in the lockfile's env preamble",
      })
    ),
    integrity: S.String.pipe(
      $I.annoteKey("PackageManagerLock.integrity", {
        description: "SRI checksum recorded for the resolved pnpm package in the lockfile's env preamble",
      })
    ),
    nativeIntegrity: S.Record(S.String, S.String).pipe(
      $I.annoteKey("PackageManagerLock.nativeIntegrity", {
        description:
          "SRI checksums for pnpm's recorded optional native packages, keyed by unversioned package name; empty for pnpm 11",
      })
    ),
  }).pipe(
    $I.annoteSchema("PackageManagerLock", {
      description:
        "The package manager a `pnpm-lock.yaml` pins, with the integrity pnpm recorded for it — read from the lockfile's env preamble by `PnpmEnvLockfile.packageManager`.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PackageManagerLock {
  /**
   * The plain, unbranded encoded shape of a {@link PackageManagerLock}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PackageManagerLock.Encoded;
}
