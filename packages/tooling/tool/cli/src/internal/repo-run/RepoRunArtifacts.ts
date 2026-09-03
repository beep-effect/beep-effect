/**
 * Leaf naming helpers shared by repo-run artifact writers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { flow, pipe } from "effect";
import * as Str from "effect/String";

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

const artifactNameHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);

/**
 * Derive the stable run-artifact directory name for a branch.
 *
 * **Example** (Derive a stable run id)
 *
 * ```ts
 * import { repoRunArtifactId } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(repoRunArtifactId("main").startsWith("main-")) // true
 * ```
 *
 * @param branch - Git branch whose run artifacts are being named.
 * @returns Sanitized branch name plus its stable identity hash.
 * @category utilities
 * @since 0.0.0
 */
export const repoRunArtifactId = (branch: string): string =>
  pipe(branch, repoRunSafeArtifactName, (name) => `${name}-${artifactNameHash(branch)}`);
