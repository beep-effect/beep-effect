/**
 * Suffix appended to a main checkout path for its sibling worktree container.
 *
 * **Example** (Build a sibling worktree root name)
 *
 * ```ts
 * import { WORKTREES_ROOT_SUFFIX } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(`beep-effect${WORKTREES_ROOT_SUFFIX}`) // "beep-effect-worktrees"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WORKTREES_ROOT_SUFFIX = "-worktrees";
