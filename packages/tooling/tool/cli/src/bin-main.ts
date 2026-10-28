#!/usr/bin/env bun

/**
 * CLI entry point for the repo command suite.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Result from "effect/Result";
import { LINT_POLICY_SUBCOMMANDS } from "./internal/cli/LintRouting.ts";

const LINT_POLICY_SUBCOMMAND_NAMES: ReadonlyArray<string> = LINT_POLICY_SUBCOMMANDS;
const QUALITY_TASK_NAMES: ReadonlyArray<string> = ["build", "check", "test", "lint", "audit", "coverage"];
const ROOT_CLI_GLOBAL_FLAG_NAMES: ReadonlyArray<string> = [
  "--completions",
  "--help",
  "--log-level",
  "--version",
  "-h",
  "-v",
];

const { A, Str } = await import("@beep/utils");

const isQualityTaskName = (value: string | undefined): boolean =>
  value !== undefined && QUALITY_TASK_NAMES.includes(value);

const isLintPolicySubcommand = (value: string | undefined): boolean =>
  value !== undefined && LINT_POLICY_SUBCOMMAND_NAMES.includes(value);

const isRootCliGlobalFlag = (value: string): boolean =>
  ROOT_CLI_GLOBAL_FLAG_NAMES.includes(value) ||
  A.some(ROOT_CLI_GLOBAL_FLAG_NAMES, (name) => Str.startsWith(`${name}=`)(value));

const hasRootCliGlobalFlag = (argv: ReadonlyArray<string>): boolean => A.some(argv, isRootCliGlobalFlag);

const canUseQualityTaskFastPath = (argv: ReadonlyArray<string>): boolean =>
  isQualityTaskName(argv[0]) && !hasRootCliGlobalFlag(argv) && !(argv[0] === "lint" && isLintPolicySubcommand(argv[1]));

const canUseCiFastPath = (argv: ReadonlyArray<string>): boolean => argv[0] === "ci" && !hasRootCliGlobalFlag(argv);

const { BunCrypto, BunHttpClient, BunRuntime, BunServices } = await import("@effect/platform-bun");
const [Console, Effect, Layer, Logger, Option, Runtime, { CliRuntime }, { renderCliFailure }] = await Promise.all([
  import("effect/Console"),
  import("effect/Effect"),
  import("effect/Layer"),
  import("effect/Logger"),
  import("effect/Option"),
  import("effect/Runtime"),
  import("@beep/cli-kit/CliRuntime"),
  import("./internal/cli/FailureRendering.ts"),
]);
const { drainProcessStreams, ProcessStreamName, streamConsole, writeBestEffortLine } = await import(
  "./internal/cli/Stdout.ts"
);
const O = await import("effect/Option");

/**
 * Foundation layer providing Node.js implementations of FileSystem, Path, and Terminal.
 *
 * These three services are leaf dependencies required by virtually every CLI
 * command and are combined here so they can be shared by all derived layers.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
const BaseLayers = Layer.mergeAll(
  BunServices.layer,
  BunHttpClient.layer,
  BunCrypto.layer,
  // `CliRuntime.main` installs `CliLogger` for the failure report. Command code
  // keeps Effect's default loggers: `CliLogger` drops a logged `Cause` and
  // renders an object message as `[object Object]`, and every `Effect.log*`
  // line stays on stdout in the format it had before (SPEC W4-aa).
  Logger.layer([Logger.defaultLogger, Logger.tracerLogger])
);

const argv = A.slice(process.argv, { start: 2 });

/**
 * Reset the shared terminal on CLI exit.
 *
 * Child processes spawned with inherited stdio (notably turbo's interactive
 * TUI) can put the shared TTY into raw mode and enable xterm mouse tracking,
 * then die abnormally without restoring it — leaving the terminal emitting
 * mouse-motion reports and swallowing Ctrl-C. Effect's own finalizers only undo
 * modes Effect itself set, so the parent CLI must reset the shared TTY here.
 * This teardown hook runs after all Scope finalizers and before `process.exit`,
 * which is the correct place to repair state a child left behind.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
const restoreSharedTerminal = (): void => {
  if (process.stdout.isTTY) {
    // Disable mouse tracking (?1000 normal, ?1002 button-event, ?1003
    // any-motion, ?1006 SGR) and show the cursor (?25h).
    // A dead stdout must not skip the raw-mode reset.
    Result.try(() => process.stdout.write("\u001B[?1000l\u001B[?1002l\u001B[?1003l\u001B[?1006l\u001B[?25h"));
  }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
};

const runRepoCliMain = <E, A>(effect: import("effect/Effect").Effect<A, E>) =>
  BunRuntime.runMain(
    // The stream console wraps the whole run, so the failure report the kit
    // writes through its logger goes through the same EPIPE-latching writers.
    Effect.provideService(
      CliRuntime.main(effect, {
        // Every path builds its own platform layer inside the program.
        platform: Layer.empty,
        // An unknown subcommand or a bad flag exits 1, as before the kit.
        usageExitCode: 1,
        render: renderCliFailure(argv),
      }),
      Console.Console,
      streamConsole
    ),
    {
      disableErrorReporting: true,
      // The runner's onExit only hard-exits on a signal or nonzero code; a clean
      // success is left to event-loop drain, so any handle a child leaves behind
      // (turbo daemon sockets, stuck bun wrappers) wedges the process after its
      // work is done — the CI class where a lane prints success and never exits.
      // Keep defaultTeardown as the sole exit-code authority and force the exit
      // the runner declines on success.
      teardown: (exit, onExit) => {
        // A dead terminal must not abort before the drain and exit.
        Result.try(restoreSharedTerminal);
        Runtime.defaultTeardown(exit, (code) => {
          // The runner's onExit hard-exits on a nonzero code, so the drain must come first.
          drainProcessStreams((failure) => {
            if (Option.isSome(failure)) {
              const { stream, message, droppedLines } = failure.value;
              const channel = ProcessStreamName.is.stderr(stream) ? process.stdout : process.stderr;
              const fallback = ProcessStreamName.is.stderr(stream) ? process.stderr : process.stdout;
              writeBestEffortLine(
                channel,
                fallback,
                `[beep-cli] exiting with code ${code}; ${stream} write failed: ${message}; ${droppedLines} line(s) dropped\n`
              );
            }
            onExit(code);
            process.exit(code);
          });
        });
      },
    }
  );

/**
 * Top-level CLI program effect produced by running the root command tree
 * with the fully-resolved {@link DerivedLayers}.
 *
 * This is the value handed to `Effect.runPromise` to execute the CLI.
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
let handledByQualityFastPath = false;

if (canUseQualityTaskFastPath(argv)) {
  const { parseQualityTaskInvocation, runQualityTask } = await import("./commands/Quality/Tasks.ts");
  const qualityTaskInvocation = parseQualityTaskInvocation(argv);

  if (O.isSome(qualityTaskInvocation)) {
    handledByQualityFastPath = true;
    const qualityProgram = Effect.scoped(
      Layer.build(BaseLayers).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (context) {
            return yield* runQualityTask(qualityTaskInvocation.value).pipe(Effect.provide(context));
          })
        )
      )
    );
    runRepoCliMain(qualityProgram);
  }
}

let handledByCiFastPath = false;

if (!handledByQualityFastPath && canUseCiFastPath(argv)) {
  handledByCiFastPath = true;
  const [{ ciCommand }, { FsUtilsLive }, Command] = await Promise.all([
    import("./commands/Ci/index.ts"),
    import("@beep/repo-utils"),
    import("effect/cli/Command"),
  ]);
  const ciRootCommand = Command.make("beep-cli").pipe(
    Command.withDescription("CLI tool for managing beep-effect monorepo packages"),
    Command.withSubcommands([ciCommand])
  );
  const CiLayers = FsUtilsLive.pipe(Layer.provideMerge(BaseLayers));
  const ciProgram = Effect.scoped(
    Layer.build(CiLayers).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* Command.run(ciRootCommand, { version: "0.0.0" }).pipe(Effect.provide(context));
        })
      )
    )
  );
  runRepoCliMain(ciProgram);
}

if (!handledByQualityFastPath && !handledByCiFastPath) {
  const [{ FsUtilsLive, TSMorphServiceLive }, Command, { rootCommand }, { MemoryStatsLive }] = await Promise.all([
    import("@beep/repo-utils"),
    import("effect/cli/Command"),
    import("./commands/Root.ts"),
    import("./internal/repo-run/QualityScheduler.ts"),
  ]);
  const DerivedLayers = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive, MemoryStatsLive).pipe(
    Layer.provideMerge(BaseLayers)
  );
  const commandProgram = Effect.scoped(
    Layer.build(DerivedLayers).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* Command.run(rootCommand, { version: "0.0.0" }).pipe(Effect.provide(context));
        })
      )
    )
  );
  runRepoCliMain(commandProgram);
}
