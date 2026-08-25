/**
 * Internal package version metadata for the docgen CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoDocgenId } from "@beep/identity/packages";
import { Effect, Path } from "effect";
import * as S from "effect/Schema";
import * as Domain from "./Domain.ts";
import { readDecodedJsonFile } from "./internal/JsonFile.ts";
import type { FileSystem } from "effect";

const $I = $RepoDocgenId.create("Version");

const PackageManifestVersion = S.Struct({ version: S.String }).pipe(
  $I.annoteSchema("PackageManifestVersion", {
    description: "Required package manifest fields used to identify the running docgen version.",
  })
);

const decodePackageManifestVersion = S.decodeUnknownEffect(S.fromJsonString(PackageManifestVersion));

/**
 * Reads the runtime package version shown in the CLI banner and proof manifests.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect } from "effect"
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
  const manifest = yield* readDecodedJsonFile("Version.readModuleVersion", manifestPath, decodePackageManifestVersion);

  return manifest.version;
});
