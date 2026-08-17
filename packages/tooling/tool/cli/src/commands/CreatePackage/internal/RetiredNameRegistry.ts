/**
 * Sanctioned removal of retired package names during
 * `create-package --reuse-retired-name`.
 *
 * The retired registry (`standards/changesets.retired-packages.json`) is the
 * changeset-history record of deleted workspace names. Create-package refuses
 * to mint a retired name; when the operator sanctions reuse with
 * `--reuse-retired-name`, this module removes the entry through a
 * schema-decoded rewrite so name provenance is restored with stable
 * formatting (2-space JSON, trailing newline).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { RETIRED_REGISTRY_PATH, RetiredPackagesRegistry } from "../../../internal/cli/Labs/index.ts";

const RetiredPackagesRegistryFromJsonString = S.fromJsonString(RetiredPackagesRegistry, { space: 2 });
const decodeRegistryJson = S.decodeEffect(RetiredPackagesRegistryFromJsonString);
const encodeRegistryJson = S.encodeEffect(RetiredPackagesRegistryFromJsonString);

/**
 * Remove one retired package entry from the retirement registry.
 *
 * The registry body is decoded through {@link RetiredPackagesRegistry} (never
 * hand-parsed), filtered, and re-encoded with the registry's canonical
 * 2-space formatting plus trailing newline. Returns whether an entry was
 * actually removed; a name absent from the registry is a no-op.
 *
 * @category utilities
 * @since 0.0.0
 */
export const removeRetiredPackageName = Effect.fn("CreatePackage.removeRetiredPackageName")(function* (
  repoRoot: string,
  packageName: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const registryPath = path.join(repoRoot, RETIRED_REGISTRY_PATH);
  const content = yield* fs
    .readFileString(registryPath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${registryPath}"`)));
  const registry = yield* decodeRegistryJson(content).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode "${registryPath}"`))
  );
  const remaining = A.filter(registry.packages, (record) => !Str.equivalence(record.name, packageName));

  if (A.length(remaining) === A.length(registry.packages)) {
    return false;
  }

  const next = yield* encodeRegistryJson(RetiredPackagesRegistry.make({ packages: remaining })).pipe(
    Effect.mapError(DomainError.newCause(`Failed to encode "${registryPath}"`))
  );
  yield* fs
    .writeFileString(registryPath, `${next}\n`)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write "${registryPath}"`)));
  return true;
});
