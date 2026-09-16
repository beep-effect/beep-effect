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

/**
 * Where Claude Code's desktop app nests its lane worktrees, relative to the clone.
 *
 * **Details**
 *
 * The canonical layout is the sibling `-worktrees` root, but the desktop app
 * creates `<clone>/.claude/worktrees/<name>` on its own; both are retirement-
 * eligible so an agent can retire the lane it is running in.
 *
 * **Example** (Locate a nested lane)
 *
 * ```ts
 * import { CLAUDE_WORKTREES_RELATIVE_ROOT } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(`/clones/beep-effect6/${CLAUDE_WORKTREES_RELATIVE_ROOT}/lane`) // /clones/beep-effect6/.claude/worktrees/lane
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLAUDE_WORKTREES_RELATIVE_ROOT = ".claude/worktrees";
