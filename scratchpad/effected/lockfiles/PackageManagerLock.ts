import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/PackageManagerLock");

/**
 * The package manager a `pnpm-lock.yaml` pins, with the integrity pnpm
 * recorded for it — read from the lockfile's env preamble by
 * `PnpmEnvLockfile.packageManager`.
 *
 * @remarks
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
 * @public
 */
export class PackageManagerLock extends S.Class<PackageManagerLock>($I`PackageManagerLock`)({
	name: S.Literal("pnpm").annotateKey({ description: "Package manager pinned by the env preamble, always `pnpm`" }),
	specifier: S.String.annotateKey({ description: "Declared package manager specifier recorded verbatim, potentially retaining a corepack-style integrity suffix" }),
	version: S.String.annotateKey({ description: "Exact pnpm package version resolved in the lockfile's env preamble" }),
	integrity: S.String.annotateKey({ description: "SRI checksum recorded for the resolved pnpm package in the lockfile's env preamble" }),
	nativeIntegrity: S.Record(S.String, S.String).annotateKey({ description: "SRI checksums for pnpm's recorded optional native packages, keyed by unversioned package name; empty for pnpm 11" }),
}, $I.annote("PackageManagerLock", { description: "The package manager a `pnpm-lock.yaml` pins, with the integrity pnpm recorded for it — read from the lockfile's env preamble by `PnpmEnvLockfile.packageManager`." })) {}
