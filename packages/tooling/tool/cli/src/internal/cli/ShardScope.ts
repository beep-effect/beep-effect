/**
 * Path-scoped regeneration for the per-package generated catalogs.
 *
 * **Details**
 *
 * Both committed catalogs (`standards/schema-catalog` and
 * `standards/instrumentation-catalog`) are sharded by owning package, and a
 * package's shard depends only on that package's sources. A pre-commit hook
 * therefore regenerates just the shards of the packages that own the staged
 * paths instead of scanning the whole repository, and stages the shards it
 * rewrote so the commit carries them. This module resolves staged paths to
 * their owners' source globs and stages regenerated files, retrying while
 * another hook holds `.git/index.lock`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { workspaceDirectories } from "../RepoWorkspaces.ts";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git/Git";
import type * as PlatformError from "effect/PlatformError";
import type { RepoWorkspacesError } from "../RepoWorkspaces.ts";

const $I = $RepoCliId.create("internal/cli/ShardScope");

/**
 * One owning package of a scoped run with the source globs that feed its shard.
 *
 * **Example** (Describe a scoped owner)
 *
 * ```ts
 * import { ShardScopeOwner } from "@beep/repo-cli/test/Cli"
 *
 * const owner = ShardScopeOwner.make({ owner: "@beep/git", globs: ["packages/drivers/git/**\/*.{ts,tsx}"] })
 * console.log(owner.owner) // "@beep/git"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardScopeOwner extends S.Opaque<ShardScopeOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    owner: S.String.annotateKey({ description: "Scoped package name that owns the shard." }),
    globs: S.Array(S.String).annotateKey({
      description: "Repo-relative source globs that feed this owner's shard.",
    }),
  }).pipe(
    $I.annoteSchema("ShardScopeOwner", {
      description: "One owning package of a scoped catalog run with the source globs that feed its shard.",
    })
  )
) {}

/**
 * The owners a scoped catalog run regenerates, sorted by package name.
 *
 * **Details**
 *
 * `skipped` lists the input paths whose owner has no source directory (the
 * `@beep/root` fallback, for example); the hosted and cheap-gate checks stay
 * authoritative for those.
 *
 * **Example** (Inspect an empty scope)
 *
 * ```ts
 * import { ShardScope } from "@beep/repo-cli/test/Cli"
 *
 * const scope = ShardScope.make({ owners: [], skipped: [] })
 * console.log(scope.owners.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardScope extends S.Opaque<ShardScope, { readonly brand: unique symbol }>()(
  S.Struct({
    owners: S.Array(ShardScopeOwner).annotateKey({ description: "Owners to regenerate, sorted by package name." }),
    skipped: S.Array(S.String).annotateKey({
      description: "Input paths whose owner has no source directory and so no shard to regenerate.",
    }),
  }).pipe(
    $I.annoteSchema("ShardScope", {
      description: "The owners a scoped catalog run regenerates and the input paths it could not place.",
    })
  )
) {}

// Inputs of `resolveShardScope`: two members are functions, so this is a call contract, not data.
type ShardScopeInput = {
  /** Owners outside the workspace list that still own a shard, with their fixed globs. */
  readonly fallbackOwners?: ReadonlyArray<ShardScopeOwner> | undefined;
  /** Builds the source globs of one owner from its repo-relative directory. */
  readonly globsForDirectory: (directory: string) => ReadonlyArray<string>;
  /** Maps an absolute path to its owning package name. */
  readonly ownerOf: (absolutePath: string) => string;
  /** Paths (absolute or repo-relative) whose owners' shards should be regenerated. */
  readonly paths: ReadonlyArray<string>;
  /** Absolute repository root; relative `paths` resolve against it. */
  readonly repoRoot: string;
};

const byOwner: Order.Order<ShardScopeOwner> = Order.mapInput(Order.String, (owner: ShardScopeOwner) => owner.owner);

/**
 * Resolve the owners whose shards a scoped run regenerates.
 *
 * **Details**
 *
 * Every path is resolved against the repository root and mapped to its owner.
 * A workspace owner's globs come from `globsForDirectory` applied to its
 * repo-relative directory, so a scoped scan sees exactly the files a full scan
 * attributes to that owner. Fallback owners keep the globs they were given.
 * Paths whose owner is neither are reported in `skipped`. Deleted paths
 * resolve too, because ownership is a prefix match that never touches the
 * filesystem.
 *
 * **Example** (Wrap the resolver Effect)
 *
 * ```ts
 * import { resolveShardScope } from "@beep/repo-cli/test/Cli"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.succeed(resolveShardScope)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - Repository root, paths, owner resolver and glob builder.
 * @returns The sorted owners to regenerate and the paths without a shard.
 * @category utilities
 * @since 0.0.0
 */
export const resolveShardScope = Effect.fn("ShardScope.resolve")(function* (
  input: ShardScopeInput
): Effect.fn.Return<ShardScope, RepoWorkspacesError | PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = toPosixPath(yield* fs.realPath(input.repoRoot));
  const workspaces = yield* workspaceDirectories(repoRoot);
  const fallbacks = input.fallbackOwners ?? A.empty<ShardScopeOwner>();
  const resolveOwner = (candidate: string): O.Option<ShardScopeOwner> => {
    const owner = input.ownerOf(path.resolve(repoRoot, candidate));
    const directory = HashMap.get(workspaces, owner).pipe(
      O.map((absolute) => toPosixPath(path.relative(repoRoot, absolute))),
      O.filter((relative) => !Str.startsWith("..")(relative))
    );
    return O.match(directory, {
      onSome: (relative) => O.some(ShardScopeOwner.make({ owner, globs: input.globsForDirectory(relative) })),
      onNone: () => A.findFirst(fallbacks, (fallback) => fallback.owner === owner),
    });
  };
  const resolved = A.map(input.paths, (candidate) => [candidate, resolveOwner(candidate)] as const);
  const owners = A.dedupeWith(
    A.getSomes(A.map(resolved, ([, owner]) => owner)),
    (left, right) => left.owner === right.owner
  );
  return ShardScope.make({
    owners: A.sort(owners, byOwner),
    skipped: A.filterMap(resolved, ([candidate, owner]) =>
      O.isNone(owner) ? Result.succeed(candidate) : Result.failVoid
    ),
  });
});

const INDEX_LOCK_RETRIES = 30;
const INDEX_LOCK_INTERVAL = Duration.millis(100);

const isIndexLockContention = (error: GitCommandError | NotARepositoryError | UnknownRefError): boolean =>
  error._tag === "GitCommandError" && error.kind === "failed" && Str.includes("index.lock")(error.stderr);

/**
 * Stage regenerated files in the git index.
 *
 * **Details**
 *
 * `git add -- <paths>` stages rewrites and removals alike. Lefthook runs
 * pre-commit commands in parallel and other commands (`stage_fixed`, a
 * sibling catalog hook) take the index lock too, so a `.git/index.lock`
 * failure is retried for a few seconds before it surfaces. An empty path list
 * is a no-op.
 *
 * **Example** (Wrap the staging Effect)
 *
 * ```ts
 * import { stageGeneratedFiles } from "@beep/repo-cli/test/Cli"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.succeed(stageGeneratedFiles)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root the paths are relative to.
 * @param paths - Repo-relative paths to stage.
 * @returns Nothing; fails with the git error once the retries are spent.
 * @category utilities
 * @since 0.0.0
 */
export const stageGeneratedFiles = Effect.fn("ShardScope.stage")(function* (
  repoRoot: string,
  paths: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayEmpty(paths)) {
    return;
  }
  const git = yield* Git;
  yield* git.add(repoRoot, paths).pipe(
    Effect.retry({
      while: isIndexLockContention,
      times: INDEX_LOCK_RETRIES,
      schedule: Schedule.spaced(INDEX_LOCK_INTERVAL),
    })
  );
});
