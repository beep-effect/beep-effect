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
export const shouldRenderFailureCause = (argv: ReadonlyArray<string>): boolean => {
  let index = 0;
  while (index < argv.length) {
    const entry = argv[index];
    if (entry === "--verbose") {
      return true;
    }
    if (entry === "--log-level") {
      const value = argv[index + 1];
      if (value !== undefined && VERBOSE_LOG_LEVELS.includes(value)) {
        return true;
      }
    }
    if (entry?.startsWith("--log-level=")) {
      if (VERBOSE_LOG_LEVELS.includes(entry.slice("--log-level=".length))) {
        return true;
      }
    }
    index = index + 1;
  }
  return false;
};
