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

/**
 * Where T3 Code creates its lane worktrees, relative to the home directory.
 *
 * **Details**
 *
 * T3 Code adds each lane as a linked worktree of the clone it was opened on,
 * at `<home>/.t3/worktrees/<clone name>/<lane>`, outside the projects
 * directory. The removal fence treats `<home>/.t3/worktrees/<clone name>` as a
 * worktree root of that clone, so a T3 lane can retire itself.
 *
 * **Example** (Locate a T3 lane)
 *
 * ```ts
 * import { T3_WORKTREES_RELATIVE_ROOT } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(`/home/user/${T3_WORKTREES_RELATIVE_ROOT}/beep-effect/lane`) // /home/user/.t3/worktrees/beep-effect/lane
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const T3_WORKTREES_RELATIVE_ROOT = ".t3/worktrees";

/**
 * Local-only files copied from the main checkout into a fresh worktree.
 *
 * **Details**
 *
 * These are gitignored per-worktree files that a fresh `git worktree add` does
 * not carry over; restoring them makes a new worktree immediately usable.
 *
 * **Example** (Inspect the bootstrap entries)
 *
 * ```ts
 * import { WORKTREE_LOCAL_FILE_ENTRIES } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WORKTREE_LOCAL_FILE_ENTRIES.includes(".env")) // true
 * console.log(WORKTREE_LOCAL_FILE_ENTRIES.length) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WORKTREE_LOCAL_FILE_ENTRIES = [
  ".env",
  ".claude/settings.local.json",
  "CLAUDE.local.md",
  ".idea/compiler.xml",
  ".idea/effect.intellij.xml",
] as const;
