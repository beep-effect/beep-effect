/**
 * Shell rendering helpers for AI metrics operator commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";

/**
 * Convert a repository path into Claude's project-directory name.
 *
 * **Example** (Convert a workspace path)
 *
 * ```ts
 * import { repoPathToClaudeProjectName } from "@beep/repo-ai-metrics"
 *
 * console.log(repoPathToClaudeProjectName("/workspace/beep-effect"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const repoPathToClaudeProjectName: (repoRoot: string) => string = Str.replace(/[/\\]/gu, "-");
