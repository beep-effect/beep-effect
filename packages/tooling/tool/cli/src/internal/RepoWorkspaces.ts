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
 * members; one whose `package.json` is missing, not JSON or rejected by the
 * strict repo-utils model fails typed, and so does a root pattern that could
 * reach outside the checkout (empty, absolute or carrying a `..` segment), so
 * a bad root never reads as an empty workspace. A member under a generated
 * `dist`, `build`, `coverage`, `.turbo` or `node_modules` directory is not a
 * member. The root package itself is never a member.
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
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { WorkspacePatternError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import type { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("internal/RepoWorkspaces");

/**
 * Why a root workspace pattern is refused before any directory is read.
 *
 * @category models
 * @since 0.0.0
 */
export const UnsafeWorkspacePatternReason = LiteralKit(["empty", "absolute", "parentSegment"]).pipe(
  $I.annoteSchema("UnsafeWorkspacePatternReason", {
    description: "Why a root workspace pattern is refused: it is empty, absolute, or carries a `..` segment.",
  })
);

/**
 * The literal type of {@link UnsafeWorkspacePatternReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnsafeWorkspacePatternReason = typeof UnsafeWorkspacePatternReason.Type;

/**
 * A root workspace pattern that could select directories outside the
 * repository, refused before discovery reads anything.
 *
 * **Details**
 *
 * The kit's `containWithinRoot` skips an escaping base, which would turn a
 * mistyped or hostile root entry into an empty member set that every
 * `--check` command then passes on; the reader fails closed instead, as the
 * retired repo-utils reader did. A leading `!` is ignored for the check.
 *
 * **Example** (Describe a refused pattern)
 *
 * ```ts
 * import { UnsafeWorkspacePatternError } from "@beep/repo-cli/test/SharedInternals"
 *
 * const error = UnsafeWorkspacePatternError.make({ root: "/repo", pattern: "../*", reason: "parentSegment" })
 * console.log(error.message) // Unsafe workspace pattern "../*" escapes the repository root (parentSegment).
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnsafeWorkspacePatternError extends S.TaggedError<
  UnsafeWorkspacePatternError,
  { readonly brand: unique symbol }
>($I`UnsafeWorkspacePatternError`)(
  "UnsafeWorkspacePatternError",
  {
    root: S.String.annotateKey({ description: "The repository root the pattern was declared in." }),
    pattern: S.String.annotateKey({ description: "The refused pattern, verbatim." }),
    reason: UnsafeWorkspacePatternReason.annotateKey({ description: "Why the pattern was refused." }),
  },
  $I.annoteError<UnsafeWorkspacePatternError>("UnsafeWorkspacePatternError", {
    description: "A root workspace pattern that could select directories outside the repository.",
  })
) {
  /**
   * Renders the refused pattern and its reason into a one-line message.
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `Unsafe workspace pattern "${this.pattern}" escapes the repository root (${this.reason}).`;
  }
}

/**
 * Why the repository's workspace members could not be discovered: a root or
 * member manifest the kit could not read or project, a pattern it could not
 * enumerate, or a root pattern refused as unsafe.
 *
 * @category errors
 * @since 0.0.0
 */
export type RepoWorkspacesError = WorkspaceDiscoveryError | WorkspacePatternError | UnsafeWorkspacePatternError;

const JsonText = S.fromJsonString(S.Unknown);

// A drive (`C:/`), UNC (`//host`) or POSIX (`/`) absolute pattern, after backslashes become slashes.
const absolutePattern = /^(?:[A-Za-z]:\/|\/\/|\/)/;

// Generated directories the retired repo-utils glob ignored; a member beneath one is not a member.
const GENERATED_DIRECTORIES = HashSet.make("node_modules", "dist", "build", "coverage", ".turbo");

const isUnderGeneratedDirectory = (member: WorkspacePackage): boolean =>
  A.some(Str.split(member.relativePath, "/"), (segment) => HashSet.has(GENERATED_DIRECTORIES, segment));

/**
 * The reason a root pattern is unsafe, if it is.
 *
 * @param pattern - A root workspace pattern, verbatim.
 * @returns The refusal reason, or none for a pattern that stays inside the root.
 */
const unsafeReasonOf = (pattern: string): O.Option<UnsafeWorkspacePatternReason> => {
  const body = Str.replaceAll("\\", "/")(Str.startsWith("!")(pattern) ? Str.slice(1)(pattern) : pattern);
  if (Str.isEmpty(Str.trim(body))) return O.some("empty");
  if (absolutePattern.test(body)) return O.some("absolute");
  return A.contains(Str.split(body, "/"), "..") ? O.some("parentSegment") : O.none();
};

/**
 * Reads and strictly decodes the root manifest, then refuses any unsafe
 * pattern of the workspace list discovery will enumerate.
 *
 * @param repoRoot - Absolute repository root.
 * @returns Nothing; it fails typed on a bad root.
 */
const guardRoot = Effect.fn("RepoWorkspaces.guardRoot")(function* (
  repoRoot: string
): Effect.fn.Return<void, WorkspaceDiscoveryError | UnsafeWorkspacePatternError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(repoRoot, "package.json");
  const failAt =
    (kind: "read" | "invalidJson" | "invalidShape") =>
    (cause: unknown): WorkspaceDiscoveryError =>
      WorkspaceDiscoveryError.make({ root: repoRoot, path: manifestPath, kind, cause });
  const text = yield* fs.readFileString(manifestPath).pipe(Effect.mapError(failAt("read")));
  const json = yield* S.decodeEffect(JsonText)(text).pipe(Effect.mapError(failAt("invalidJson")));
  yield* decodePackageJsonEffect(json).pipe(Effect.mapError(failAt("invalidShape")));
  const patterns = yield* WorkspacePatterns.read(repoRoot).pipe(
    Effect.mapError((error) =>
      WorkspaceDiscoveryError.make({ root: repoRoot, path: error.path, kind: error.kind, cause: error.cause })
    )
  );
  for (const pattern of patterns) {
    const reason = unsafeReasonOf(pattern);
    if (O.isSome(reason)) {
      return yield* UnsafeWorkspacePatternError.make({ root: repoRoot, pattern, reason: reason.value });
    }
  }
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
 * under `repoRoot` as enumerated. Before anything is enumerated the root
 * manifest is strictly decoded and each root pattern is checked: an empty,
 * absolute or `..`-carrying pattern fails with
 * {@link UnsafeWorkspacePatternError}. Members beneath a generated
 * directory (`dist`, `build`, `coverage`, `.turbo`, `node_modules`) are
 * dropped.
 *
 * @param repoRoot - Absolute repository root.
 * @returns The root package and every member.
 * @category workspaces
 * @since 0.0.0
 */
export const workspacePackages = Effect.fn("RepoWorkspaces.workspacePackages")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, RepoWorkspacesError, FileSystem.FileSystem | Path.Path> {
  yield* guardRoot(repoRoot);
  const roots = yield* WorkspaceRoot.make;
  const discovery = yield* WorkspaceDiscovery.make({
    cwd: repoRoot,
    stopAt: repoRoot,
    containWithinRoot: true,
    skipMissingBaseDirs: true,
  }).pipe(Effect.provideService(WorkspaceRoot, roots));
  // The root is pinned as the ceiling, so "no root" means `repoRoot` holds no workspace marker.
  const packages = yield* discovery.listPackages.pipe(
    Effect.catchTag("WorkspaceRootNotFoundError", () => Effect.succeed(A.empty<WorkspacePackage>()))
  );
  return A.filter(packages, (pkg) => !isUnderGeneratedDirectory(pkg));
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
  const decoded = yield* Effect.forEach(
    members,
    Effect.fnUntraced(function* (member) {
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
 * root package are not nodes. A member that lists itself gets no edge (the
 * kit drops self-edges), so a self-dependency does not read as a cycle.
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
