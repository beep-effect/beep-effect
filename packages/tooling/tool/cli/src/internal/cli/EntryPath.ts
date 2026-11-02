/**
 * The repository-relative path of the `beep` CLI's own entry module.
 *
 * **Details**
 *
 * Commands that spawn the CLI again (quality task children, systemd units,
 * lane retirement, eval sandboxes) name the entry by this one constant, so the
 * beep-cli-composition move of the bin into the composition app (W8) edits a
 * single line.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Repository-relative path of the CLI entry module that `bun run` executes.
 *
 * **Example** (Spawn the CLI from the repository root)
 *
 * ```ts
 * import { REPO_CLI_ENTRY_PATH } from "@beep/repo-cli/test/Cli"
 *
 * console.log(["bun", "run", REPO_CLI_ENTRY_PATH, "--help"].join(" "))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPO_CLI_ENTRY_PATH = "packages/tooling/tool/cli/src/bin.ts";
