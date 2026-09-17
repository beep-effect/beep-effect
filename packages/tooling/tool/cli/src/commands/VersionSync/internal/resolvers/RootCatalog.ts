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
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, identity, Path, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { VersionSyncError } from "../../VersionSync.schemas.ts";

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

/**
 * Subset of the root `package.json` that version resolvers read.
 *
 * **Example** (Construct an empty document)
 *
 * ```ts
 * import { RootPackageJsonDocument } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 *
 * const document = RootPackageJsonDocument.make({})
 * console.log(Object.keys(document.catalog).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootPackageJsonDocument extends S.Class<RootPackageJsonDocument>($I`RootPackageJsonDocument`)(
  {
    catalog: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, string>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, string>()))
    ),
    devDependencies: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, string>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, string>()))
    ),
  },
  $I.annote("RootPackageJsonDocument", {
    description: "Subset of root package.json fields required to resolve an installed tool version.",
  })
) {}

/**
 * Read and decode the root `package.json` catalog and devDependencies.
 *
 * **Example** (Read the root manifest)
 *
 * ```ts
 * import { readRootPackageJson } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import { Effect } from "effect"
 *
 * const program = readRootPackageJson("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns The decoded catalog and devDependencies subset.
 * @category utilities
 * @since 0.0.0
 */
export const readRootPackageJson = Effect.fn("readRootPackageJson")(function* (
  repoRoot: string
): Effect.fn.Return<RootPackageJsonDocument, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const pkgJsonPath = path.join(repoRoot, "package.json");
  const pkgJsonContent = yield* fs
    .readFileString(pkgJsonPath)
    .pipe(VersionSyncError.mapError("Failed to read package.json", "package.json"));

  return yield* decodeJsoncTextAs(RootPackageJsonDocument)(pkgJsonContent).pipe(
    VersionSyncError.mapError("Failed to parse package.json", "package.json")
  );
});

class BunLockDocument extends S.Class<BunLockDocument>($I`BunLockDocument`)(
  {
    packages: S.Record(S.String, S.Array(S.Unknown)).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, ReadonlyArray<unknown>>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, ReadonlyArray<unknown>>()))
    ),
  },
  $I.annote("BunLockDocument", {
    description: "Subset of bun.lock: the resolved package map whose entries start with `<name>@<version>`.",
  })
) {}

/**
 * Read the version `bun.lock` resolved for a dependency.
 *
 * **Details**
 *
 * Each `packages` entry in `bun.lock` is a tuple whose first element is the
 * resolved `<name>@<version>` specifier. A missing lockfile or a missing entry
 * yields `None` so the caller can fall back to the catalog.
 *
 * **Example** (Read the resolved turbo version)
 *
 * ```ts
 * import { readLockfileResolvedVersion } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import { Effect } from "effect"
 *
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
  dependencyName: string
): Effect.fn.Return<O.Option<string>, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const lockPath = path.join(repoRoot, "bun.lock");
  const present = yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(() => false));
  if (!present) {
    return O.none();
  }

  const lockContent = yield* fs
    .readFileString(lockPath)
    .pipe(VersionSyncError.mapError("Failed to read bun.lock", "bun.lock"));

  const lock = yield* decodeJsoncTextAs(BunLockDocument)(lockContent).pipe(
    VersionSyncError.mapError("Failed to parse bun.lock", "bun.lock")
  );

  const resolvedPrefix = `${dependencyName}@`;

  return O.flatMap(
    O.flatMap(R.get(lock.packages, dependencyName), A.head),
    (specifier): O.Option<string> =>
      P.isString(specifier) && Str.startsWith(resolvedPrefix)(specifier)
        ? O.some(Str.slice(resolvedPrefix.length)(specifier))
        : O.none()
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
 * import { Effect } from "effect"
 *
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
  dependencyName: string
): Effect.fn.Return<string, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const lockfileVersion = yield* readLockfileResolvedVersion(repoRoot, dependencyName);
  if (O.isSome(lockfileVersion)) {
    return lockfileVersion.value;
  }

  const pkgJson = yield* readRootPackageJson(repoRoot);

  const rawVersion = O.getOrElse(
    O.orElse(R.get(pkgJson.catalog, dependencyName), () => R.get(pkgJson.devDependencies, dependencyName)),
    thunkEmptyStr
  );

  return exactVersionFromSpecifier(rawVersion);
});
