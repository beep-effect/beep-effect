/**
 * Integrity-bound installed dependency views for local cache experiments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheDependencyTree, CacheExecutablePin } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.dependencies.schemas");

/**
 * Canonical dependency-link and installed-tree identities shared by evidence consumers.
 *
 * @category models
 * @since 0.0.0
 */
export { CacheDependencyLink, CacheDependencyTree } from "./Cache.schemas.ts";

/**
 * A retained local dependency snapshot verified against the source installation.
 *
 * **Details**
 *
 * The directory is machine-local and belongs in a private request or receipt.
 * Portable reports should retain its evidence reference and tree digest only.
 *
 * **Example** (Inspect the lockfile binding)
 *
 * ```ts
 * import { CacheDependencyMaterialization } from "@beep/repo-cli/commands/Cache"
 * console.assert("lockfileSha256" in CacheDependencyMaterialization.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyMaterialization extends S.Class<CacheDependencyMaterialization>(
  $I`CacheDependencyMaterialization`
)(
  {
    schemaVersion: S.Literal("cache-dependency-materialization/v1"),
    authority: S.Literal("local-installed-tree-snapshot"),
    directory: S.NonEmptyString,
    lockfileSha256: Sha256Hex,
    rootManifestSha256: Sha256Hex,
    tree: CacheDependencyTree,
    tools: S.Record(S.String, CacheExecutablePin),
  },
  $I.annote("CacheDependencyMaterialization", {
    description: "A copied installed dependency tree with source/copy parity and exact integrity-tool pins.",
  })
) {}
