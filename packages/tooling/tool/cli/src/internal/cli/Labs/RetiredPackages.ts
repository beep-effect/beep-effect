/**
 * Schema-decoded reader for `standards/changesets.retired-packages.json`.
 *
 * Create-package consults the registry to refuse retired-name reuse without
 * `--reuse-retired-name`; delete-package records retirements into it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, HashSet } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/Labs/RetiredPackages");

/**
 * Repo-relative path of the retired-packages registry.
 *
 * @category configuration
 * @since 0.0.0
 */
export const RETIRED_REGISTRY_PATH = "standards/changesets.retired-packages.json";

/**
 * One retired package name plus the rationale recorded at retirement time.
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetiredPackageRecord extends S.Class<RetiredPackageRecord>($I`RetiredPackageRecord`)(
  {
    name: S.NonEmptyString,
    rationale: S.NonEmptyString,
  },
  $I.annote("RetiredPackageRecord", {
    description: "One retired workspace package name and its retirement rationale.",
  })
) {}

/**
 * The retired-packages registry document.
 *
 * @category schemas
 * @since 0.0.0
 */
export class RetiredPackagesRegistry extends S.Class<RetiredPackagesRegistry>($I`RetiredPackagesRegistry`)(
  {
    packages: S.Array(RetiredPackageRecord),
  },
  $I.annote("RetiredPackagesRegistry", {
    description: "Registry of retired workspace package names kept for changeset history.",
  })
) {}

const decodeRegistryJson = S.decodeEffect(S.fromJsonString(RetiredPackagesRegistry));

/**
 * Read the retired-package name set from the registry; a missing registry file
 * decodes to the empty set.
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
