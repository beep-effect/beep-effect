/**
 * Root `package.json` catalog version lookup shared by the schema-URL resolvers.
 *
 * Biome and Turbo both pin a `$schema` URL to the installed tool version, and
 * both read that version from the root `package.json` catalog (falling back to
 * `devDependencies`). This module owns that lookup once.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Str, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, identity, Path, SchemaTransformation } from "effect";
import * as O from "effect/Option";
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

/**
 * Resolve the exact installed version of a root catalog dependency.
 *
 * **Details**
 *
 * Reads the root `package.json`, prefers the `catalog` entry, falls back to
 * `devDependencies`, and strips the semver range prefix. Returns the empty
 * string when the dependency is pinned in neither place so callers can report
 * the absence instead of failing.
 *
 * **Example** (Resolve the installed Turbo version)
 *
 * ```ts
 * import { resolveRootCatalogVersion } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/RootCatalog"
 * import { Effect } from "effect"
 *
 * const program = resolveRootCatalogVersion("/repo", "turbo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param dependencyName - The catalog dependency to resolve (e.g. `turbo`).
 * @returns The exact installed version, or the empty string when unpinned.
 * @category utilities
 * @since 0.0.0
 */
export const resolveRootCatalogVersion = Effect.fn("resolveRootCatalogVersion")(function* (
  repoRoot: string,
  dependencyName: string
): Effect.fn.Return<string, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const pkgJson = yield* readRootPackageJson(repoRoot);

  const rawVersion = O.getOrElse(
    O.orElse(R.get(pkgJson.catalog, dependencyName), () => R.get(pkgJson.devDependencies, dependencyName)),
    thunkEmptyStr
  );

  return exactVersionFromSpecifier(rawVersion);
});
