/**
 * Internal package version metadata for the docgen CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Domain from "./Domain.ts";
import type * as FileSystem from "effect/FileSystem";

/**
 * Reads the `version` of a `package.json` through the presence-lenient
 * `PackageManifest` tier.
 *
 * **Details**
 *
 * Every present field must satisfy its `PackageManifest` codec (a present
 * `version` is strict semver), and the manifest must declare `version`.
 * Strict JSON only: JSONC text fails.
 *
 * **Example** (Read this package's version)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect";
 * import { readManifestVersion } from "../../src/Version.ts"
 *
 * const version = await Effect.runPromise(
 *   readManifestVersion("package.json").pipe(Effect.provide(BunServices.layer))
 * )
 * console.log(version)
 * ```
 *
 * @param manifestPath - Path of the `package.json` to read.
 * @returns The declared version as text.
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readManifestVersion = Effect.fn("Version.readManifestVersion")(function* (
  manifestPath: string
): Effect.fn.Return<string, Domain.DocgenError, FileSystem.FileSystem | Path.Path> {
  const files = yield* PackageJsonFile.make;
  const manifest = yield* files.readManifest(manifestPath).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Version.readModuleVersion] Failed to read '${manifestPath}'\n${String(cause)}`,
        cause,
      })
    )
  );
  if (P.isUndefined(manifest.version)) {
    return yield* Domain.DocgenError.make({
      message: `[Version.readModuleVersion] Failed to read '${manifestPath}'\npackage.json must declare \`version\`.`,
    });
  }
  return manifest.version.toString();
});

/**
 * Reads the runtime package version shown in the CLI banner and proof manifests.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect";
 * import { readModuleVersion } from "../../src/Version.ts"
 *
 * const version = await Effect.runPromise(
 *   readModuleVersion().pipe(Effect.provide(BunServices.layer))
 * )
 * console.log(version)
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readModuleVersion = Effect.fn("Version.readModuleVersion")(function* (): Effect.fn.Return<
  string,
  Domain.DocgenError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const manifestUrl = new URL("../package.json", import.meta.url);
  const manifestPath = yield* path.fromFileUrl(manifestUrl).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Version.readModuleVersion] Failed to resolve manifest path '${manifestUrl.pathname}'\n${String(cause)}`,
      })
    )
  );

  return yield* readManifestVersion(manifestPath);
});
