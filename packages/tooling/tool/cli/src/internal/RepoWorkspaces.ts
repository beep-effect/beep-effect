/**
 * Repository workspace members and their dependency graph for the repo CLI.
 *
 * Every command that needs the monorepo's workspace packages reads them
 * through `@beep/repo-workspaces` here: members from `WorkspaceDiscovery`
 * and edges and order from `DependencyGraph`. The repository root is pinned
 * as both the start and the ceiling of the kit's root ascent, so an enclosing
 * workspace is never adopted. Discovery runs with `containWithinRoot`, so a
 * member whose real path leaves the checkout is skipped before its manifest
 * is read, and with `skipMissingBaseDirs`, so a wildcard whose base directory
 * is absent (git keeps no empty directory) selects nothing instead of failing
 * every command. A repository root that declares no workspaces has no
 * members; one whose `package.json` is missing or malformed fails typed. The root package itself is never a member.
 *
 * The directory readers return each member's real path, as the retired
 * repo-utils reader did, so a member reached through a link inside the
 * checkout keeps the identity every caller compares against (Docgen's orphan
 * check, DeletePackage's repository-root refusal).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodePackageJsonEffect, PackageJson } from "@beep/repo-utils/schemas/PackageJson";
import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
import { WorkspaceDiscovery, WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { WorkspacePatternError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import type { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("internal/RepoWorkspaces");

/**
 * Why the repository's workspace members could not be discovered: a member
 * manifest the kit could not read or project, or a pattern it could not
 * enumerate.
 *
 * @category errors
 * @since 0.0.0
 */
export type RepoWorkspacesError = WorkspaceDiscoveryError | WorkspacePatternError;

const JsonText = S.fromJsonString(S.Unknown);

/**
 * A repository root that holds no workspace marker: no members when its
 * `package.json` reads as JSON, and a typed discovery failure when the root
 * manifest is missing or malformed, as the retired repo-utils reader failed.
 *
 * @param repoRoot - Absolute repository root.
 * @returns No workspace packages.
 * @category workspaces
 * @since 0.0.0
 */
const rootWithoutWorkspaces = Effect.fn("RepoWorkspaces.rootWithoutWorkspaces")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(repoRoot, "package.json");
  const text = yield* fs
    .readFileString(manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        WorkspaceDiscoveryError.make({ root: repoRoot, path: manifestPath, kind: "read", cause })
      )
    );
  yield* S.decodeEffect(JsonText)(text).pipe(
    Effect.mapError((cause) =>
      WorkspaceDiscoveryError.make({ root: repoRoot, path: manifestPath, kind: "invalidJson", cause })
    )
  );
  return A.empty<WorkspacePackage>();
});

/**
 * Every workspace package beneath `repoRoot`, the root package first, then
 * the members sorted by relative path.
 *
 * **Details**
 *
 * A member is accepted by the kit's tolerant projection (a non-empty string
 * `name` and, when present, a non-empty string `version`); a non-empty
 * `pnpm-workspace.yaml` `packages` list takes precedence over the root
 * `package.json` `workspaces` field. Each package's `path` is its directory
 * under `repoRoot` as enumerated.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The root package and every member.
 * @category workspaces
 * @since 0.0.0
 */
export const workspacePackages = Effect.fn("RepoWorkspaces.workspacePackages")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, RepoWorkspacesError, FileSystem.FileSystem | Path.Path> {
  const roots = yield* WorkspaceRoot.make;
  const discovery = yield* WorkspaceDiscovery.make({
    cwd: repoRoot,
    stopAt: repoRoot,
    containWithinRoot: true,
    skipMissingBaseDirs: true,
  }).pipe(Effect.provideService(WorkspaceRoot, roots));
  // The root is pinned as the ceiling, so "no root" means `repoRoot` holds no workspace marker.
  return yield* discovery.listPackages.pipe(
    Effect.catchTag("WorkspaceRootNotFoundError", () => rootWithoutWorkspaces(repoRoot))
  );
});

/**
 * The workspace members beneath `repoRoot`: {@link workspacePackages} without
 * the root package.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The non-root workspace packages.
 * @category workspaces
 * @since 0.0.0
 */
export const workspaceMembers = Effect.fn("RepoWorkspaces.workspaceMembers")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, RepoWorkspacesError, FileSystem.FileSystem | Path.Path> {
  const packages = yield* workspacePackages(repoRoot);
  return A.filter(packages, (member) => !member.isRootWorkspace);
});

/**
 * Each workspace member's real directory, keyed by package name.
 *
 * **Details**
 *
 * A later member with an earlier member's name replaces it.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The member real paths by package name.
 * @category workspaces
 * @since 0.0.0
 */
export const workspaceDirectories = Effect.fn("RepoWorkspaces.workspaceDirectories")(function* (
  repoRoot: string
): Effect.fn.Return<
  HashMap.HashMap<string, string>,
  RepoWorkspacesError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const members = yield* workspaceMembers(repoRoot);
  const entries = yield* Effect.forEach(members, (member) =>
    fs.realPath(member.path).pipe(Effect.map((dir) => [member.name, dir] as const))
  );
  return HashMap.fromIterable(entries);
});

/**
 * A workspace member's real directory and its strictly decoded manifest.
 *
 * **Details**
 *
 * The manifest's `scripts` field is a `HashMap` that defaults to empty, so
 * callers read `manifest.scripts` directly.
 *
 * @category models
 * @since 0.0.0
 */
export class DecodedWorkspaceMember extends S.Opaque<DecodedWorkspaceMember, { readonly brand: unique symbol }>()(
  S.Struct({
    dir: S.String.annotateKey({ description: "Real path of the workspace member's directory." }),
    manifest: S.instanceOf(PackageJson).annotateKey({ description: "The member's strictly decoded manifest." }),
  }).pipe(
    $I.annoteSchema("DecodedWorkspaceMember", {
      description: "A workspace member's real directory and its strictly decoded package.json.",
    })
  )
) {}

/**
 * Each workspace member's directory and strictly decoded manifest, keyed by
 * package name.
 *
 * **Details**
 *
 * The manifest the kit already read (`manifestRecord`) is decoded through the
 * strict repo-utils `package.json` model; no file is read twice. A malformed
 * manifest fails with `S.SchemaError`.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The decoded members by package name.
 * @category workspaces
 * @since 0.0.0
 */
export const workspaceManifests = Effect.fn("RepoWorkspaces.workspaceManifests")(function* (
  repoRoot: string
): Effect.fn.Return<
  HashMap.HashMap<string, DecodedWorkspaceMember>,
  RepoWorkspacesError | PlatformError.PlatformError | S.SchemaError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const members = yield* workspaceMembers(repoRoot);
  const decoded = yield* Effect.forEach(members, (member) =>
    Effect.gen(function* () {
      const dir = yield* fs.realPath(member.path);
      const manifest = yield* decodePackageJsonEffect(member.manifestRecord);
      return [member.name, DecodedWorkspaceMember.make({ dir, manifest })] as const;
    })
  );
  return HashMap.fromIterable(decoded);
});

/**
 * The dependency graph between the workspace members.
 *
 * **Details**
 *
 * Edges merge the four dependency kinds; external npm dependencies and the
 * root package are not nodes.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The members' dependency graph.
 * @category workspaces
 * @since 0.0.0
 */
export const workspaceDependencyGraph = Effect.fn("RepoWorkspaces.workspaceDependencyGraph")(function* (
  repoRoot: string
): Effect.fn.Return<DependencyGraph, RepoWorkspacesError, FileSystem.FileSystem | Path.Path> {
  return DependencyGraph.make({ packages: yield* workspaceMembers(repoRoot) });
});
