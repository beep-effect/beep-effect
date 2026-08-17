/**
 * Argv-only verbosity resolution for the CLI's terminal failure renderer.
 *
 * Lives here rather than in the entrypoint because the entrypoint runs after the
 * Effect runtime has torn down, where neither the parsed CLI config nor a
 * `Config` provider is reachable — so the decision has to be made from raw argv.
 * Keeping it a pure function of argv makes it directly testable instead of
 * stranded behind a module-level constant in a file with top-level await.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

const VERBOSE_LOG_LEVELS: ReadonlyArray<string> = ["debug", "trace"];
const VERBOSE_FLAG = "--verbose";
const LOG_LEVEL_FLAG = "--log-level";
const LOG_LEVEL_INLINE_PREFIX = `${LOG_LEVEL_FLAG}=`;

const isVerboseLevel = (value: string | undefined): boolean =>
  value !== undefined && VERBOSE_LOG_LEVELS.includes(value);

/** `--log-level=debug` carries its value in the same argv entry. */
const inlineLogLevel = (entry: string): string | undefined =>
  entry.startsWith(LOG_LEVEL_INLINE_PREFIX) ? entry.slice(LOG_LEVEL_INLINE_PREFIX.length) : undefined;

/** `--log-level debug` carries its value in the next entry, which may not exist. */
const separatedLogLevel = (argv: ReadonlyArray<string>, index: number): string | undefined =>
  argv[index] === LOG_LEVEL_FLAG ? argv[index + 1] : undefined;

/**
 * Whether a rendered CLI failure should append the full `Cause`.
 *
 * **Details**
 *
 * Causes carry absolute transcript paths and upstream stderr, so the default is
 * off and callers opt in with `--verbose`, `--log-level debug|trace`, or the
 * `--log-level=debug` inline form. Anything else — including a `--log-level`
 * with no value, or a non-verbose level — resolves to `false`.
 *
 * **Example** (Opting in through an inline log level)
 *
 * ```ts
 * import { shouldRenderFailureCause } from "@beep/repo-cli/internal/cli/FailureRendering"
 *
 * console.log(shouldRenderFailureCause(["ai-metrics", "--log-level=debug"])) // true
 * console.log(shouldRenderFailureCause(["ai-metrics"])) // false
 * ```
 *
 * @category utils
 * @since 0.0.0
 */
export const shouldRenderFailureCause = (argv: ReadonlyArray<string>): boolean =>
  argv.some(
    (entry, index) =>
      entry === VERBOSE_FLAG || isVerboseLevel(inlineLogLevel(entry)) || isVerboseLevel(separatedLogLevel(argv, index))
  );
