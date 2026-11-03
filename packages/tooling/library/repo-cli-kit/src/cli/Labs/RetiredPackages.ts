/**
 * Schema-decoded reader for `standards/changesets.retired-packages.json`.
 *
 * **Details**
 *
 * Create-package consults the registry to refuse retired-name reuse without
 * `--reuse-retired-name`; delete-package records retirements into it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliKitId } from "@beep/identity/packages";
import { A, thunkFalse } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $RepoCliKitId.create("cli/Labs/RetiredPackages");

/**
 * Repo-relative path of the retired-packages registry.
 *
 * **Example** (Locate the registry)
 *
 * ```ts
 * import { RETIRED_REGISTRY_PATH } from "@beep/repo-cli-kit/cli/Labs/RetiredPackages"
 *
 * console.log(RETIRED_REGISTRY_PATH) // standards/changesets.retired-packages.json
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RETIRED_REGISTRY_PATH = "standards/changesets.retired-packages.json";

/**
 * One retired package name plus the rationale recorded at retirement time.
 *
 * **Example** (Describe a retired package)
 *
 * ```ts
 * import { RetiredPackageRecord } from "@beep/repo-cli-kit/cli/Labs/RetiredPackages"
 *
 * const record = RetiredPackageRecord.make({ name: "@beep/old-tool", rationale: "Replaced by the CLI kit" })
 * console.log(record.name) // @beep/old-tool
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetiredPackageRecord extends S.Opaque<RetiredPackageRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    rationale: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RetiredPackageRecord", {
      description: "One retired workspace package name and its retirement rationale.",
    })
  )
) {}

/**
 * The retired-packages registry document.
 *
 * **Example** (Construct an empty registry)
 *
 * ```ts
 * import { RetiredPackagesRegistry } from "@beep/repo-cli-kit/cli/Labs/RetiredPackages"
 *
 * const registry = RetiredPackagesRegistry.make({ packages: [] })
 * console.log(registry.packages.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetiredPackagesRegistry extends S.Opaque<RetiredPackagesRegistry, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.Array(RetiredPackageRecord),
  }).pipe(
    $I.annoteSchema("RetiredPackagesRegistry", {
      description: "Registry of retired workspace package names kept for changeset history.",
    })
  )
) {}

const decodeRegistryJson = S.decodeEffect(S.fromJsonString(RetiredPackagesRegistry));

/**
 * Read the retired-package name set from the registry; a missing registry file
 * decodes to the empty set.
 *
 * **Example** (Compose a registry read)
 *
 * ```ts
 * import { readRetiredPackageNames } from "@beep/repo-cli-kit/cli/Labs/RetiredPackages"
 * import * as Effect from "effect/Effect"
 *
 * const read = readRetiredPackageNames("/repo")
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readRetiredPackageNames = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const registryPath = `${repoRoot}/${RETIRED_REGISTRY_PATH}`;
  const exists = yield* fs.exists(registryPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return HashSet.empty<string>();
  }
  const content = yield* fs.readFileString(registryPath);
  const registry = yield* decodeRegistryJson(content);
  return HashSet.fromIterable(A.map(registry.packages, (record) => record.name));
});
