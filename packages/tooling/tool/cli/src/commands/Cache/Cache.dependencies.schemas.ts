/**
 * Integrity-bound installed dependency views for local cache experiments.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheExecutablePin } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.dependencies.schemas");

/**
 * A package-tree link restricted to the installed tree or a declared workspace.
 *
 * **Example** (Inspect workspace-link evidence)
 *
 * ```ts
 * import { CacheDependencyLink } from "@beep/repo-cli/commands/Cache"
 * console.assert("Workspace" in CacheDependencyLink.cases)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheDependencyLink = S.TaggedUnion({
  Internal: { path: S.NonEmptyString, target: S.NonEmptyString },
  Workspace: { path: S.NonEmptyString, target: S.NonEmptyString, workspace: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("CacheDependencyLink", {
    description: "Validated relative symlink topology of an installed dependency tree.",
  })
);
/**
 * An installed-tree or declared-workspace link.
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyLink = typeof CacheDependencyLink.Type;

/**
 * A bounded canonical archive digest with separately validated link topology.
 *
 * **Details**
 *
 * The digest preserves paths, file bytes, modes and symlink targets. GNU tar
 * normalizes ownership and timestamps and dereferences hard links into bytes.
 * It does not attest registry provenance, ACLs or extended attributes.
 *
 * **Example** (Inspect the content identity)
 *
 * ```ts
 * import { CacheDependencyTree } from "@beep/repo-cli/commands/Cache"
 * console.assert("sha256" in CacheDependencyTree.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyTree extends S.Class<CacheDependencyTree>($I`CacheDependencyTree`)(
  {
    format: S.Literal("canonical-gnu-tar/v1"),
    sha256: Sha256Hex,
    regularFiles: NonNegativeInt.check(S.isLessThanOrEqualTo(400000)),
    entries: NonNegativeInt.check(S.isLessThanOrEqualTo(600000)),
    bytes: NonNegativeInt.check(S.isLessThanOrEqualTo(16 * 1024 * 1024 * 1024)),
    links: S.Array(CacheDependencyLink).check(S.isMaxLength(4096)),
  },
  $I.annote("CacheDependencyTree", {
    description: "A bounded installed tree fingerprint, independent of checkout location and file timestamps.",
  })
) {}

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
