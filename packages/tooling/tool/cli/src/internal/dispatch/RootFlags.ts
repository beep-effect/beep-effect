/**
 * Root flag names shared by the dispatcher and the GitHub ledger's command
 * labeller. A leaf, so the labeller does not import the dispatch manifest.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Built-in root flags that take their value as the next token.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const ROOT_VALUE_FLAG_NAMES: ReadonlyArray<string> = ["--completions", "--log-level"];
