/**
 * Installed tool version lookup shared by the schema-URL resolvers.
 *
 * Biome and Turbo both pin a `$schema` URL to the installed tool version. The
 * version that is actually installed is the one `bun.lock` resolved, so this
 * module reads the lockfile first and only falls back to the range-stripped
 * root `package.json` catalog (then `devDependencies`) when the lockfile has no
 * entry for the tool.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { Str, thunkEmptyStr } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { manifestParser } from "../../../../internal/ManifestRead.ts";
import { VersionSyncError } from "../../VersionSync.schemas.ts";
import type { LenientManifest } from "@beep/package-json/LenientManifest";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/RootCatalog");

/**
 * Extract exact version from a catalog version specifier (strip `^`, `~`, etc.).
 *
 * @category utilities
 * @since 0.0.0
 */
const VersionSpecifierToExactVersion = S.String.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: Str.replace(/^[~^>=<]+/, ""),
      encode: identity,
    })
  ),
  $I.annoteSchema("VersionSpecifierToExactVersion", {
    description: "Schema transformation that strips semver range prefixes from dependency version specifiers.",
  })
);

const decodeExactVersion = S.decodeUnknownOption(VersionSpecifierToExactVersion);

/**
 * Strip the semver range prefix from a dependency version specifier.
 *
 * **Example** (Strip a caret range)
 *
 * ```ts
 * import { exactVersionFromSpecifier } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 *
 * console.log(exactVersionFromSpecifier("^2.10.13")) // "2.10.13"
 * ```
 *
 * @param value - The version specifier (e.g. `^2.4.4`).
 * @returns The bare version string without range prefix.
 * @category utilities
 * @since 0.0.0
 */
export const exactVersionFromSpecifier = (value: unknown): string =>
  O.getOrElse(decodeExactVersion(value), () => `${value}`);

const parseRootPackageJson = manifestParser(["catalog", "devDependencies"]);

/**
 * Read the root `package.json` text the version resolvers consume.
 *
 * **Details**
 *
 * A present `catalog` or `devDependencies` must be a string record. Strict
 * JSON only: JSONC text fails.
 *
 * **Example** (Read the root catalog)
 *
 * ```ts
 * import { readRootPackageJsonText } from "@beep/repo-cli/test/VersionSync"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(readRootPackageJsonText('{"catalog":{"effect":"4.0.0"}}'))
 * console.log(manifest.catalog) // { effect: "4.0.0" }
 * ```
 *
 * @param text - The root manifest document as read from disk.
 * @returns The root manifest through `LenientManifest`.
 * @category parsing
 * @since 0.0.0
 */
export const readRootPackageJsonText = Effect.fn("RootCatalog.readRootPackageJsonText")(function* (
  text: string
): Effect.fn.Return<LenientManifest, VersionSyncError> {
  return yield* parseRootPackageJson(text).pipe(
    VersionSyncError.mapError("Failed to parse package.json", "package.json")
  );
});

/**
 * Read and decode the root `package.json` catalog and devDependencies.
 *
 * **Example** (Read the root manifest)
 *
 * ```ts
 * import { readRootPackageJson } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import * as Effect from "effect/Effect";
 * const program = readRootPackageJson("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns The root manifest through `LenientManifest`; a present `catalog` or `devDependencies` must keep its JSON shape.
 * @category utilities
 * @since 0.0.0
 */
export const readRootPackageJson = Effect.fn("readRootPackageJson")(function* (
  repoRoot: string
): Effect.fn.Return<LenientManifest, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const pkgJsonPath = path.join(repoRoot, "package.json");
  const pkgJsonContent = yield* fs
    .readFileString(pkgJsonPath)
    .pipe(VersionSyncError.mapError("Failed to read package.json", "package.json"));

  return yield* readRootPackageJsonText(pkgJsonContent);
});

/**
 * Read the root lockfile for reuse within one version-sync resolution.
 *
 * **Example** (Create a lazy shared read)
 *
 * ```ts
 * import { readRootLockfile } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import * as Effect from "effect/Effect"
 * const shared = Effect.cached(readRootLockfile("/repo"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readRootLockfile = Effect.fn("VersionSync.readRootLockfile")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<Lockfile>, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const lockPath = path.join(repoRoot, "bun.lock");
  const present = yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(() => false));
  if (!present) {
    return O.none<Lockfile>();
  }

  const lockContent = yield* fs
    .readFileString(lockPath)
    .pipe(VersionSyncError.mapError("Failed to read bun.lock", "bun.lock"));

  return yield* Lockfile.parse(lockContent, { format: "bun" }).pipe(
    Effect.asSome,
    VersionSyncError.mapError("Failed to parse bun.lock", "bun.lock")
  );
});

/**
 * Read the version `bun.lock` resolved for a dependency.
 *
 * **Details**
 *
 * The answer is the registry package `@beep/lockfiles` resolves from the
 * workspace root (`Lockfile#rootPackage`) whose real name is the dependency.
 * A missing lockfile, a missing entry, a workspace package and an npm alias of
 * another package all yield `None`, so the caller can fall back to the
 * catalog.
 *
 * **Gotchas**
 *
 * A lockfile the kit rejects fails with a `VersionSyncError` instead of
 * falling back: malformed JSONC, and also JSONC that bun would read but the
 * kit does not admit (a non-numeric `lockfileVersion`, an unparseable
 * integrity). Callers can share a lazy read for the duration of one run.
 *
 * **Example** (Read the resolved turbo version)
 *
 * ```ts
 * import { readLockfileResolvedVersion } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import * as Effect from "effect/Effect";
 * const program = readLockfileResolvedVersion("/repo", "turbo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param dependencyName - The dependency to look up (e.g. `turbo`).
 * @returns The lockfile-resolved version, or `None` when unavailable.
 * @category utilities
 * @since 0.0.0
 */
export const readLockfileResolvedVersion = Effect.fn("readLockfileResolvedVersion")(function* (
  repoRoot: string,
  dependencyName: string,
  lockfileRead: Effect.Effect<
    O.Option<Lockfile>,
    VersionSyncError,
    FileSystem.FileSystem | Path.Path
  > = readRootLockfile(repoRoot)
): Effect.fn.Return<O.Option<string>, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const lockfile = yield* lockfileRead;
  return O.flatMap(lockfile, (document) => document.rootPackage(dependencyName)).pipe(
    O.filter((pkg) => !pkg.isWorkspace && pkg.name === dependencyName),
    O.map((pkg) => pkg.version)
  );
});

/**
 * Resolve the exact installed version of a tool pinned through the root catalog.
 *
 * **Details**
 *
 * Prefers the version `bun.lock` resolved, because that is the binary that is
 * installed; a caret or tilde catalog range can float above its floor. Without
 * a lockfile entry it falls back to the root `package.json` `catalog` entry,
 * then `devDependencies`, with the semver range prefix stripped. Returns the
 * empty string when the tool is pinned nowhere so callers can report the
 * absence instead of failing.
 *
 * **Example** (Resolve the installed Turbo version)
 *
 * ```ts
 * import { resolveInstalledToolVersion } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import * as Effect from "effect/Effect";
 * const program = resolveInstalledToolVersion("/repo", "turbo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param dependencyName - The catalog dependency to resolve (e.g. `turbo`).
 * @returns The exact installed version, or the empty string when unpinned.
 * @category utilities
 * @since 0.0.0
 */
export const resolveInstalledToolVersion = Effect.fn("resolveInstalledToolVersion")(function* (
  repoRoot: string,
  dependencyName: string,
  lockfileRead: Effect.Effect<
    O.Option<Lockfile>,
    VersionSyncError,
    FileSystem.FileSystem | Path.Path
  > = readRootLockfile(repoRoot)
): Effect.fn.Return<string, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const lockfileVersion = yield* readLockfileResolvedVersion(repoRoot, dependencyName, lockfileRead);
  if (O.isSome(lockfileVersion)) {
    return lockfileVersion.value;
  }

  const pkgJson = yield* readRootPackageJson(repoRoot);

  const declaredIn = (field: Readonly<Record<string, string>> | undefined): O.Option<string> =>
    O.flatMap(O.fromUndefinedOr(field), R.get(dependencyName));
  const rawVersion = O.getOrElse(
    O.orElse(declaredIn(pkgJson.catalog), () => declaredIn(pkgJson.devDependencies)),
    thunkEmptyStr
  );

  return exactVersionFromSpecifier(rawVersion);
});
