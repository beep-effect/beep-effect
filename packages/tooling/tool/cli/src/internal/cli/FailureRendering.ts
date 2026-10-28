/**
 * The repo CLI's failure report: the `render` hook it hands `@beep/cli-kit`
 * `CliRuntime.main`, and the argv-only verbosity switch that hook reads.
 *
 * The hook runs in `CliRuntime.main`'s failure reporting, outside `Command.run`,
 * where neither the parsed CLI config nor a `Config` provider is reachable, so
 * verbosity is decided from raw argv. Keeping both pure functions makes them
 * directly testable instead of stranded behind a module-level constant in a
 * file with top-level await.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import * as Str from "effect/String";
import type { FailureDetails } from "@beep/cli-kit/CliRuntime";

const VERBOSE_LOG_LEVELS: ReadonlyArray<string> = ["debug", "trace"];
const VERBOSE_FLAG = "--verbose";
const LOG_LEVEL_FLAG = "--log-level";
const LOG_LEVEL_INLINE_PREFIX = `${LOG_LEVEL_FLAG}=`;

const isVerboseLevel: (value: O.Option<string>) => boolean = O.exists((level) => A.contains(VERBOSE_LOG_LEVELS, level));

/** `--log-level=debug` carries its value in the same argv entry. */
const inlineLogLevel = (entry: string): O.Option<string> =>
  Str.startsWith(LOG_LEVEL_INLINE_PREFIX)(entry) ? O.some(Str.slice(LOG_LEVEL_INLINE_PREFIX.length)(entry)) : O.none();

/** `--log-level debug` carries its value in the next entry, which may not exist. */
const separatedLogLevel = (argv: ReadonlyArray<string>, entry: string, index: number): O.Option<string> =>
  entry === LOG_LEVEL_FLAG ? A.get(argv, index + 1) : O.none();

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
 * import { shouldRenderFailureCause } from "@beep/repo-cli/test/Cli"
 *
 * console.log(shouldRenderFailureCause(["ai-metrics", "--log-level=debug"])) // true
 * console.log(shouldRenderFailureCause(["ai-metrics"])) // false
 * ```
 *
 * @category utils
 * @since 0.0.0
 */
export const shouldRenderFailureCause = (argv: ReadonlyArray<string>): boolean =>
  A.some(
    argv,
    (entry, index) =>
      entry === VERBOSE_FLAG ||
      isVerboseLevel(inlineLogLevel(entry)) ||
      isVerboseLevel(separatedLogLevel(argv, entry, index))
  );

/**
 * Render a repo CLI failure: the `render` hook for `CliRuntime.main`.
 *
 * **Details**
 *
 * An error already reported (`Runtime.errorReported` is `false`, as on
 * `CliReportedExit`, whose command printed its own output) renders no line, so
 * the process exits silently with the error's code. Otherwise the report leads
 * with the error's `message`, followed by the full `Cause` only when
 * {@link shouldRenderFailureCause} opts in; an error with no string `message`
 * renders as the full `Cause`. The kit writes the lines through its logger to
 * stderr, after neutralizing any line a GitHub runner would read as a workflow
 * command.
 *
 * **Example** (Render a failure, then an already-reported one)
 *
 * ```ts
 * import { CliReportedExit, renderCliFailure } from "@beep/repo-cli/test/Cli"
 * import * as Cause from "effect/Cause"
 *
 * const error = new Error("boom")
 * console.log(JSON.stringify(renderCliFailure([])(error, { cause: Cause.fail(error) }))) // ["boom"]
 * const reported = CliReportedExit.make({ message: "printed", exitCode: 2 })
 * console.log(JSON.stringify(renderCliFailure([])(reported, { cause: Cause.fail(reported) }))) // []
 * ```
 *
 * @param argv - The raw CLI arguments, read for `--verbose` and `--log-level`.
 * @returns The hook, taking the squashed error and the failure details.
 * @category utils
 * @since 0.0.0
 */
export const renderCliFailure =
  (argv: ReadonlyArray<string>) =>
  (error: unknown, details: Pick<FailureDetails.Encoded, "cause">): ReadonlyArray<string> => {
    if (!Runtime.getErrorReported(error)) {
      return [];
    }
    // The message leads; the cause follows only on request, because it carries
    // absolute transcript paths and upstream stderr. Before the cause could be
    // requested at all, every typed error rendered as one bare sentence with no
    // errno, path, or stack at ANY log level, which is why the ai-metrics
    // parquet-export regression sat unexplained for a month behind
    // `Failed to read transcript input.`.
    if (P.hasProperty(error, "message") && P.isString(error.message)) {
      return shouldRenderFailureCause(argv) ? [error.message, Cause.pretty(details.cause)] : [error.message];
    }
    return [Cause.pretty(details.cause)];
  };
