/**
 * Leaf naming helpers shared by repo-run artifact writers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { Effect, flow } from "effect";
import * as Str from "effect/String";
import { QualitySchedulerError } from "./QualityScheduler.schemas.ts";

/**
 * Convert an arbitrary branch or step name into a stable artifact file segment.
 *
 * **Example** (Sanitize a branch segment)
 *
 * ```ts
 * import { repoRunSafeArtifactName } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(repoRunSafeArtifactName("feature/status work")) // "feature_status_work"
 * ```
 *
 * @param value - Branch, package, or step name to sanitize.
 * @returns A non-empty artifact-safe path segment.
 * @category utilities
 * @since 0.0.0
 */
export const repoRunSafeArtifactName: (value: string) => string = flow(
  Str.replace(/[^a-zA-Z0-9._-]+/gu, "_"),
  Str.replace(/^_+|_+$/gu, ""),
  (name) => (Str.isNonEmpty(name) ? name : "repo")
);

const artifactNameHash = Effect.fnUntraced(function* (value: string) {
  return Str.takeLeft(12)(
    yield* sha256Hex(value).pipe(Effect.mapError(QualitySchedulerError.new("Failed to hash run artifact identity.")))
  );
});

/**
 * Derive the stable run-artifact directory name for a branch.
 *
 * **Example** (Derive a stable run id)
 *
 * ```ts
 * import { repoRunArtifactId } from "@beep/repo-cli/test/RepoRun"
 *
 * import { Effect } from "effect"
 *
 * const program = repoRunArtifactId("main").pipe(Effect.map((id) => id.startsWith("main-")))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param branch - Git branch whose run artifacts are being named.
 * @returns Sanitized branch name plus its stable identity hash.
 * @category utilities
 * @since 0.0.0
 */
export const repoRunArtifactId = Effect.fn("RepoRunArtifacts.artifactId")(function* (branch: string) {
  return `${repoRunSafeArtifactName(branch)}-${yield* artifactNameHash(branch)}`;
});
