/**
 * The runner files the `ci` commands publish to, through `@beep/github-actions`.
 *
 * **Details**
 *
 * `ActionOutputs` owns the runner-file formats (`GITHUB_OUTPUT` and `GITHUB_ENV`
 * heredoc blocks with a derived delimiter, `GITHUB_STEP_SUMMARY` appends). The
 * commands read their environment through `Config`, so the runner environment
 * `ActionOutputs` resolves its files from is seeded from the same
 * `ConfigProvider`: a test that supplies `GITHUB_OUTPUT` through
 * `ConfigProvider.fromUnknown` and the hosted runner's process environment
 * reach the same file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import type * as FileSystem from "effect/FileSystem";

/** The variables `ActionOutputs` reads: the three runner files and the line-ending host fact. */
const RUNNER_VARIABLES = ["GITHUB_OUTPUT", "GITHUB_ENV", "GITHUB_STEP_SUMMARY", "RUNNER_OS"] as const;

const runnerVariable = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map((value) => O.map(O.filter(value, Str.isNonEmpty), (present) => [name, present] as const))
  );

/** The present, non-empty runner variables, read through the current `ConfigProvider`. */
const runnerEnvironment = Effect.map(
  Effect.forEach(RUNNER_VARIABLES, runnerVariable, { concurrency: 1 }),
  (entries): Readonly<Record<string, string>> => R.fromEntries(A.getSomes(entries))
);

/**
 * `ActionOutputs` over the runner files the current `ConfigProvider` names.
 *
 * **Details**
 *
 * An unset or empty runner variable is absent, so writing to it fails with the
 * package's `RunnerFileUnavailableError`; the commands check the variables they
 * require first and report their own message.
 *
 * **Example** (Provide the runner outputs)
 *
 * ```ts
 * import { CiRunnerOutputsLive } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(CiRunnerOutputsLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiRunnerOutputsLive: Layer.Layer<ActionOutputs, never, FileSystem.FileSystem> = ActionOutputs.layer.pipe(
  Layer.provide(Layer.unwrap(Effect.map(runnerEnvironment, ActionEnvironment.layerFrom)))
);

/**
 * Append Markdown to the job's step summary, or print it off a runner.
 *
 * **Details**
 *
 * With no `GITHUB_STEP_SUMMARY` (or an empty one) the Markdown goes to stdout
 * instead, so a local run shows what a runner would append. A failed append
 * fails with `failure(path)` as the {@link CiCommandError} message.
 *
 * **Example** (Print a summary off a runner)
 *
 * ```ts
 * import { appendStepSummary, CiRunnerOutputsLive } from "@beep/repo-cli/commands/Ci"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = appendStepSummary("### Ready", (path) => `Failed to append the summary to ${path}.`).pipe(
 *   Effect.provide(CiRunnerOutputsLive.pipe(Layer.provideMerge(NodeServices.layer)))
 * )
 * Effect.runPromise(program).then(() => console.log("appended"))
 * ```
 *
 * @param rendered - The Markdown to append.
 * @param failure - The error message when the append to the named file fails.
 * @returns An effect that appends or prints the Markdown.
 * @category use-cases
 * @since 0.0.0
 */
export const appendStepSummary = Effect.fn("Ci.appendStepSummary")(function* (
  rendered: string,
  failure: (summaryPath: string) => string
): Effect.fn.Return<void, CiCommandError, ActionOutputs> {
  const summaryPath = yield* Config.option(Config.String("GITHUB_STEP_SUMMARY")).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(O.filter(Str.isNonEmpty))
  );
  if (O.isNone(summaryPath)) {
    yield* Console.log(rendered);
    return;
  }
  const outputs = yield* ActionOutputs;
  yield* outputs.summary(rendered).pipe(CiCommandError.mapError(failure(summaryPath.value)));
});
