#!/usr/bin/env bun

/**
 * CLI entry point for the repo command suite.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Result from "effect/Result";
import type * as HashSetType from "effect/HashSet";
import type { DispatchTarget, RuntimeService } from "./internal/dispatch/Dispatch.schemas.ts";

const { A, Str } = await import("@beep/utils");

const { BunCrypto, BunHttpClient, BunRuntime, BunServices } = await import("@effect/platform-bun");
const [ConfigProvider, Console, Effect, Layer, Logger, Option, R, Runtime, { CliRuntime }, { renderCliFailure }] =
  await Promise.all([
    import("effect/ConfigProvider"),
    import("effect/Console"),
    import("effect/Effect"),
    import("effect/Layer"),
    import("effect/Logger"),
    import("effect/Option"),
    import("effect/Record"),
    import("effect/Runtime"),
    import("@beep/cli-kit/CliRuntime"),
    import("./internal/cli/FailureRendering.ts"),
  ]);
const { drainProcessStreams, ProcessStreamName, streamConsole, writeBestEffortLine } = await import(
  "./internal/cli/Stdout.ts"
);
const [Dispatch, { loadQualityTasks }, HashSet, Command] = await Promise.all([
  import("./internal/dispatch/Dispatch.ts"),
  import("./internal/dispatch/Dispatch.manifest.ts"),
  import("effect/HashSet"),
  import("effect/cli/Command"),
]);
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
const BaseLayers = Layer.mergeAll(BunServices.layer, BunHttpClient.layer, BunCrypto.layer);

/**
 * Effect's default loggers, provided around each whole program.
 *
 * `CliRuntime.main` installs `CliLogger` outermost for the failure report. The
 * program itself keeps Effect's default loggers: `CliLogger` drops a logged
 * `Cause` and renders an object message as `[object Object]`. Provided around
 * the scoped program, not beside the platform layers, so a line logged while a
 * layer builds or a finalizer runs keeps the stdout format it had before, like
 * a command handler's line (SPEC W4-aa).
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
const ProgramLoggers = Logger.layer([Logger.defaultLogger, Logger.tracerLogger]);

/**
 * Run a program under {@link ProgramLoggers}, built once like every path's own layers.
 *
 * @param effect - The scoped CLI program to run with Effect's default loggers provided.
 * @returns The same program with the logger context provided and the logger scope closed on exit.
 * @internal
 * @category configuration
 * @since 0.0.0
 */
const withProgramLoggers = <E, A>(effect: import("effect/Effect").Effect<A, E>) =>
  Effect.scoped(Effect.flatMap(Layer.build(ProgramLoggers), (context) => Effect.provide(effect, context)));

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

// Environment mutation belongs to this process entry point. Libraries only return defaults.
const applyHostTurboCacheDefaults = (defaults: Readonly<Record<string, string>>): void => {
  for (const [name, value] of R.toEntries(defaults)) Bun.env[name] = value;
};

const currentGitOrigin = (): string =>
  Result.getOrElse(
    Result.map(
      Result.try(() =>
        Bun.spawnSync({ cmd: ["git", "remote", "get-url", "origin"], stdout: "pipe", stderr: "ignore" })
      ),
      (result) => (result.success ? Str.trim(result.stdout.toString()) : "")
    ),
    () => ""
  );

const withHostTurboCacheDefaults = Effect.fn("RepoCli.withHostTurboCacheDefaults")(function* <A, E, R>(
  effect: import("effect/Effect").Effect<A, E, R>
) {
  const { configStringOption, isCiSync, loadHostTurboCacheDefaults } = yield* Effect.promise(
    () => import("./internal/cli/EnvConfig.ts")
  );
  const defaults = yield* loadHostTurboCacheDefaults(Bun.env, isCiSync(), currentGitOrigin());
  const configuredApi = yield* configStringOption("TURBO_API");
  const configuredSummary = yield* configStringOption("TURBO_RUN_SUMMARY");
  const selectedApi = O.orElse(O.fromUndefinedOr(defaults.TURBO_API), () => configuredApi);
  const summarize = O.isNone(configuredSummary) && O.exists(selectedApi, Str.startsWith("http://127.0.0.1:"));
  yield* Effect.sync(() =>
    applyHostTurboCacheDefaults(summarize ? R.set(defaults, "TURBO_RUN_SUMMARY", "true") : defaults)
  );
  // Rebuild the provider trie after adding defaults so effectful readers see the new keys.
  return yield* effect.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()));
});

const runRepoCliMain = <E, A>(effect: import("effect/Effect").Effect<A, E>) =>
  BunRuntime.runMain(
    // The stream console wraps the whole run, so the failure report the kit
    // writes through its logger goes through the same EPIPE-latching writers.
    Effect.provideService(
      CliRuntime.main(withProgramLoggers(effect), {
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
 * Build the platform base plus only the runtime services the dispatched groups declare.
 *
 * Each extra Layer's module is imported only when a group needs it, so a group
 * that declares none never loads `@beep/repo-utils` or the quality scheduler here.
 *
 * @param services - The runtime services named by the dispatch target's routes.
 * @returns The Layer providing the platform base and those services.
 * @internal
 * @category configuration
 * @since 0.0.0
 */
const runtimeLayerFor = Effect.fnUntraced(function* (services: HashSetType.HashSet<RuntimeService>) {
  const needsRepoUtils = HashSet.has(services, "fs-utils") || HashSet.has(services, "ts-morph");
  const repoUtils = needsRepoUtils ? O.some(yield* Effect.promise(() => import("@beep/repo-utils"))) : O.none();
  const scheduler = HashSet.has(services, "memory-stats")
    ? O.some(yield* Effect.promise(() => import("./internal/repo-run/QualityScheduler.ts")))
    : O.none();
  const extras = A.getSomes([
    O.filter(
      O.map(repoUtils, ({ FsUtilsLive }) => FsUtilsLive),
      () => HashSet.has(services, "fs-utils")
    ),
    O.filter(
      O.map(repoUtils, ({ TSMorphServiceLive }) => TSMorphServiceLive),
      () => HashSet.has(services, "ts-morph")
    ),
    O.map(scheduler, ({ MemoryStatsLive }) => MemoryStatsLive),
  ]);
  return Layer.mergeAll(Layer.empty, ...extras).pipe(Layer.provideMerge(BaseLayers));
});

/**
 * Run the command groups argv names through the lazy dispatch manifest.
 *
 * Only the named group's facade is imported and only its runtime services are
 * built; the rest of the root renders from static help stubs
 * (`internal/dispatch`).
 *
 * @param target - A command-group dispatch target (not the quality-task route).
 * @returns The CLI program for that target.
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
const commandProgram = (target: DispatchTarget) =>
  Effect.scoped(
    Effect.flatMap(runtimeLayerFor(Dispatch.dispatchRuntimeServices(target)), (layer) =>
      Layer.build(layer).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (context) {
            const commands = yield* Dispatch.loadDispatchTarget(target);
            return yield* Command.run(Dispatch.makeRootCommand(commands), { version: "0.0.0" }).pipe(
              withHostTurboCacheDefaults,
              Effect.provide(context)
            );
          })
        )
      )
    )
  );

const dispatchTarget = Dispatch.resolveDispatchTarget(argv);

// A quality-task invocation that does not parse falls back to the command groups, as before.
const qualityTaskInvocation =
  dispatchTarget._tag === "quality-task"
    ? await loadQualityTasks().then(({ parseQualityTaskInvocation, runQualityTask }) =>
        O.map(parseQualityTaskInvocation(argv), (invocation) => runQualityTask(invocation))
      )
    : O.none();

if (O.isSome(qualityTaskInvocation)) {
  runRepoCliMain(
    Effect.scoped(
      Layer.build(BaseLayers).pipe(
        Effect.flatMap((context) =>
          qualityTaskInvocation.value.pipe(withHostTurboCacheDefaults, Effect.provide(context))
        )
      )
    )
  );
} else {
  runRepoCliMain(
    commandProgram(dispatchTarget._tag === "quality-task" ? Dispatch.resolveCommandTarget(argv) : dispatchTarget)
  );
}
