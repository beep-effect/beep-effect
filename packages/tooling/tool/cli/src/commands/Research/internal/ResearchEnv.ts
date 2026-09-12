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
 * @internal
 * @category utilities
 */
export const RESEARCH_ENV_FILE_RELATIVE = ".config/beep-research/env";

/**
 * EnvironmentFile location as shown in messages.
 *
 * @internal
 * @category utilities
 */
export const RESEARCH_ENV_FILE_HINT = `$HOME/${RESEARCH_ENV_FILE_RELATIVE}`;
