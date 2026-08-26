/**
 * Shared Yeet artifact path helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { Effect, flow, Path } from "effect";
import * as Str from "effect/String";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

/**
 * Convert an arbitrary branch or step name into a stable artifact file segment.
 *
 * **Example** (Sanitize branch name segment)
 *
 * ```ts
 * import { safeArtifactName } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 *
 * console.log(safeArtifactName("feature/status work"))
 * ```
 *
 * @param value - Branch, package, or step name to sanitize.
 * @returns A non-empty artifact-safe path segment.
 * @category utilities
 * @since 0.0.0
 */
export const safeArtifactName: (value: string) => string = flow(
  Str.replace(/[^a-zA-Z0-9._-]+/gu, "_"),
  Str.replace(/^_+|_+$/gu, ""),
  (name) => (Str.isNonEmpty(name) ? name : "repo")
);

const artifactNameHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);

/**
 * Resolve the machine-local coordinator path for one repository identity.
 *
 * **Details**
 *
 * The origin identity is hashed before it reaches the path, so sibling clones
 * of the same repository coordinate without exposing a credential-bearing
 * remote URL in a filename.
 *
 * **Example** (Share a coordinator across checkouts)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { proofCoordinatorLockPath } from "@beep/repo-cli/test/Yeet"
 *
 * const lock = proofCoordinatorLockPath("git@github.com:acme/repo.git").pipe(
 *   Effect.map((path) => path.endsWith(".lock"))
 * )
 * ```
 *
 * @param repositoryIdentity - Stable remote identity shared by sibling clones.
 * @returns Machine-local proof coordinator lock path.
 * @category utilities
 * @since 0.0.0
 */
export const proofCoordinatorLockPath = Effect.fn("Yeet.proofCoordinatorLockPath")(function* (
  repositoryIdentity: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(tmpdir(), "beep-yeet-proof-locks", `${artifactNameHash(repositoryIdentity)}.lock`);
});

/**
 * Return the stable Yeet run id for a repo run context.
 *
 * **Example** (Derive run id from context)
 *
 * ```ts
 * import { runIdForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { RepoRunContext } from "@beep/repo-cli/internal/repo-run"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/status-work",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(runIdForContext(context)) // e.g. "feature-status-work-1a2b3c4d"
 * ```
 *
 * @param context - Repo run context carrying the current branch.
 * @returns Sanitized run id for branch-scoped Yeet artifacts.
 * @category utilities
 * @since 0.0.0
 */
export const runIdForContext = (context: RepoRunContext): string =>
  `${safeArtifactName(context.branch)}-${artifactNameHash(context.branch)}`;

/**
 * Resolve the Yeet artifact directory for a repo run context.
 *
 * **Example** (Resolve artifact directory path)
 *
 * ```ts
 * import { artifactDirForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(artifactDirForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying `repoRoot` and `packetDir`.
 * @returns Absolute Yeet artifact directory path.
 * @category utilities
 * @since 0.0.0
 */
export const artifactDirForContext = Effect.fn("Yeet.artifactDirForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.isAbsolute(context.packetDir) ? context.packetDir : path.join(context.repoRoot, context.packetDir);
});

/**
 * Resolve a file path inside the current Yeet run directory.
 *
 * **Example** (Resolve run artifact file path)
 *
 * ```ts
 * import { runArtifactPathForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runArtifactPathForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @param fileName - File name within `.beep/yeet/runs/<run-id>/`.
 * @returns Absolute path to the named run artifact.
 * @category utilities
 * @since 0.0.0
 */
export const runArtifactPathForContext = Effect.fn("Yeet.runArtifactPathForContext")(function* (
  context: RepoRunContext,
  fileName: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "runs", runIdForContext(context), fileName);
});

/**
 * Resolve the state artifact path for the current Yeet run.
 *
 * **Example** (Resolve run state.json path)
 *
 * ```ts
 * import { runStatePathForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runStatePathForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @returns Absolute path to the branch-scoped `state.json`.
 * @category utilities
 * @since 0.0.0
 */
export const runStatePathForContext = (context: RepoRunContext): Effect.Effect<string, never, Path.Path> =>
  runArtifactPathForContext(context, "state.json");
