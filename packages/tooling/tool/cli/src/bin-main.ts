#!/usr/bin/env bun

/**
 * CLI entry point for the repo command suite.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { shouldRenderFailureCause } from "./internal/cli/FailureRendering.ts";
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
const CHANGED_PATH_DIFF_FILTER = ["A", "C", "M", "R", "T", "U", "X", "B"].join("");

const rawArgv = Bun.argv.slice(2);

const { A } = await import("@beep/utils");
const { flow } = await import("effect");
const nonEmptyLines = (text: string): ReadonlyArray<string> =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const unique: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(A.fromIterable, A.dedupe);

const spawnTextOption = (args: ReadonlyArray<string>): string | undefined => {
  const result = Bun.spawnSync({
    cmd: ["git", ...args],
    stderr: "ignore",
    stdout: "pipe",
  });

  return result.success ? result.stdout.toString() : undefined;
};

const fastLintFixNoop = (): boolean => {
  if (rawArgv.length !== 2 || rawArgv[0] !== "lint" || rawArgv[1] !== "--fix") {
    return false;
  }

  const outputs = [
    spawnTextOption(["diff", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "HEAD", "--"]),
    spawnTextOption(["diff", "--cached", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "--"]),
    spawnTextOption(["ls-files", "--others", "--exclude-standard"]),
  ];

  if (outputs.some((output) => output === undefined)) {
    return false;
  }

  const changedFiles = unique(outputs.flatMap((output) => nonEmptyLines(output ?? "")));
  if (changedFiles.length > 0) {
    return false;
  }

  process.stdout.write("[beep-cli] lint:fix: no changed files\n");
  return true;
};

if (fastLintFixNoop()) {
  process.exit(0);
}

const isQualityTaskName = (value: string | undefined): boolean =>
  value !== undefined && QUALITY_TASK_NAMES.includes(value);

const isLintPolicySubcommand = (value: string | undefined): boolean =>
  value !== undefined && LINT_POLICY_SUBCOMMAND_NAMES.includes(value);

const isRootCliGlobalFlag = (value: string): boolean =>
  ROOT_CLI_GLOBAL_FLAG_NAMES.includes(value) || ROOT_CLI_GLOBAL_FLAG_NAMES.some((name) => value.startsWith(`${name}=`));

const hasRootCliGlobalFlag = (argv: ReadonlyArray<string>): boolean => argv.some(isRootCliGlobalFlag);

const canUseQualityTaskFastPath = (argv: ReadonlyArray<string>): boolean =>
  isQualityTaskName(argv[0]) && !hasRootCliGlobalFlag(argv) && !(argv[0] === "lint" && isLintPolicySubcommand(argv[1]));

const canUseCiFastPath = (argv: ReadonlyArray<string>): boolean => argv[0] === "ci" && !hasRootCliGlobalFlag(argv);

const { BunCrypto, BunHttpClient, BunRuntime, BunServices } = await import("@effect/platform-bun");
const { Cause, Effect, Exit, Layer, Runtime } = await import("effect");
const O = await import("effect/Option");
const P = await import("effect/Predicate");

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

const argv = A.slice(process.argv, { start: 2 });

const renderCliFailure = (exit: import("effect").Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const error = Cause.squash(exit.cause);
  if (!Runtime.getErrorReported(error)) {
    return;
  }

  // Print the message, then the full cause. Previously this returned right after
  // the message, so every typed error rendered as one bare sentence with no
  // errno, path, or stack at ANY log level including --log-level debug. That is
  // why the ai-metrics parquet-export regression sat unexplained for a month
  // behind `Failed to read transcript input.`, and why the forwarder's systemd
  // unit -- which captures 2000 bytes of stderr into status/latest.json -- had
  // nothing useful to capture.
  //
  // The cause is appended rather than substituted so the common case still leads
  // with the human-readable line.
  if (P.hasProperty(error, "message") && P.isString(error.message)) {
    process.stderr.write(`${error.message}\n`);
    if (shouldRenderFailureCause(argv)) {
      process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
    }
    return;
  }

  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
};

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
    process.stdout.write("\u001B[?1000l\u001B[?1002l\u001B[?1003l\u001B[?1006l\u001B[?25h");
  }
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
};

const runRepoCliMain = <E, A>(effect: import("effect").Effect.Effect<A, E>) =>
  BunRuntime.runMain(effect, {
    disableErrorReporting: true,
    // The runner's onExit only hard-exits on a signal or nonzero code; a clean
    // success is left to event-loop drain, so any handle a child leaves behind
    // (turbo daemon sockets, stuck bun wrappers) wedges the process after its
    // work is done — the CI class where a lane prints success and never exits.
    // Keep defaultTeardown as the sole exit-code authority and force the exit
    // the runner declines on success.
    teardown: (exit, onExit) => {
      renderCliFailure(exit);
      restoreSharedTerminal();
      Runtime.defaultTeardown(exit, (code) => {
        onExit(code);
        process.exit(code);
      });
    },
  });

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
  const [{ ciCommand }, { FsUtilsLive }, { Command }] = await Promise.all([
    import("./commands/Ci/index.ts"),
    import("@beep/repo-utils"),
    import("effect/unstable/cli"),
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
  const [{ FsUtilsLive, TSMorphServiceLive }, { Command }, { rootCommand }, { MemoryStatsLive }] = await Promise.all([
    import("@beep/repo-utils"),
    import("effect/unstable/cli"),
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
