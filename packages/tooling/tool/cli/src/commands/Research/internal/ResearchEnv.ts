/**
 * Location of the research pipeline's systemd EnvironmentFile.
 *
 * The research timers load secrets from this file, and the Cognee gate names
 * it when no credentials are configured so the journal says where to add them.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * EnvironmentFile path relative to `$HOME`.
 *
 * **Example** (Join the path under a home directory)
 *
 * ```ts
 * import { RESEARCH_ENV_FILE_RELATIVE } from "@beep/repo-cli/commands/Research/internal/ResearchEnv"
 *
 * console.log(`/home/user/${RESEARCH_ENV_FILE_RELATIVE}`) // "/home/user/.config/beep-research/env"
 * ```
 *
 * @internal
 * @category utilities
 */
export const RESEARCH_ENV_FILE_RELATIVE = ".config/beep-research/env";

/**
 * EnvironmentFile location as shown in messages.
 *
 * **Example** (Hint used by the Cognee credentials gate)
 *
 * ```ts
 * import { RESEARCH_ENV_FILE_HINT } from "@beep/repo-cli/commands/Research/internal/ResearchEnv"
 *
 * console.log(RESEARCH_ENV_FILE_HINT) // "$HOME/.config/beep-research/env"
 * ```
 *
 * @internal
 * @category utilities
 */
export const RESEARCH_ENV_FILE_HINT = `$HOME/${RESEARCH_ENV_FILE_RELATIVE}`;
