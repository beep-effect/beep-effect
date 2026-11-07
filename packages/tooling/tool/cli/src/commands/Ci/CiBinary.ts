/**
 * The slim CI binary's program: a `beep` root holding only the pre-toolchain `ci` commands.
 *
 * **Details**
 *
 * `src/bin-ci.ts` hands this program and its run options to `BunRuntime.runMain`.
 * It registers the same command values as the full `ci` group, so
 * `beep ci <command>` behaves identically in both, and it needs only the
 * platform services those commands use. Keep its imports to the bootstrap
 * commands and the runtime edge: `bun build --compile` bundles everything
 * reachable from here into the CI binary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CliRuntime } from "@beep/cli-kit/CliRuntime";
import { renderCliFailure } from "@beep/repo-cli-kit/cli/FailureRendering";
import { streamConsole } from "@beep/repo-cli-kit/cli/Stdout";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import { drainThenExit } from "../../internal/runtime/ExitDrain.ts";
import { ciBootstrapCommands } from "./CiBootstrap.command.ts";

const ciCommand = Command.make("ci").pipe(
  Command.withDescription("Continuous integration helper commands"),
  Command.withSubcommands(ciBootstrapCommands)
);

/**
 * The CI binary's root command: `beep ci <bootstrap command>`.
 *
 * **Example** (Inspect the CI binary root)
 *
 * ```ts
 * import { ciBinaryCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciBinaryCommand.name) // "beep"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciBinaryCommand = Command.make("beep").pipe(
  Command.withDescription("Pre-toolchain CI commands of the beep-effect repo CLI"),
  Command.withSubcommands([ciCommand])
);

/**
 * Build the CI binary's main effect over a platform layer.
 *
 * **Details**
 *
 * The platform services are built once, at the entry point, like bin-main's
 * base layer. Output goes through the stream console, and a failure is
 * rendered against `argv` with the usage exit code 1. The data-last form
 * takes the platform first.
 *
 * **Example** (Build the main effect)
 *
 * ```ts
 * import { ciBinaryMain } from "@beep/repo-cli/commands/Ci"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(ciBinaryMain(["ci", "change-profile"], NodeServices.layer))) // true
 * ```
 *
 * @param argv - The command-line arguments after the runtime and entry path, for failure rendering.
 * @param platform - The platform services the bootstrap commands run on.
 * @returns The effect `BunRuntime.runMain` runs.
 * @category use-cases
 * @since 0.0.0
 */
export const ciBinaryMain: {
  <E>(platform: Layer.Layer<Command.Environment, E>): (argv: ReadonlyArray<string>) => Effect.Effect<void, Error>;
  <E>(argv: ReadonlyArray<string>, platform: Layer.Layer<Command.Environment, E>): Effect.Effect<void, Error>;
} = dual(
  2,
  <E>(argv: ReadonlyArray<string>, platform: Layer.Layer<Command.Environment, E>): Effect.Effect<void, Error> =>
    Effect.provideService(
      CliRuntime.main(
        platform.pipe(
          Layer.build,
          Effect.flatMap((context) => Command.run(ciBinaryCommand, { version: "0.0.0" }).pipe(Effect.provide(context))),
          Effect.scoped
        ),
        { platform: Layer.empty, usageExitCode: 1, render: renderCliFailure(argv) }
      ),
      Console.Console,
      streamConsole
    )
);

/**
 * The CI binary's `BunRuntime.runMain` options.
 *
 * **Details**
 *
 * As in bin-main: drain the stream console, then exit with the teardown's code.
 *
 * **Example** (Read the run options)
 *
 * ```ts
 * import { ciBinaryRunMainOptions } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciBinaryRunMainOptions.disableErrorReporting) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ciBinaryRunMainOptions: {
  readonly disableErrorReporting: true;
  readonly teardown: Runtime.Teardown;
} = {
  disableErrorReporting: true,
  teardown: (exit, onExit) =>
    Runtime.defaultTeardown(exit, (code) =>
      drainThenExit({
        label: "beep-ci",
        code,
        onDrained: () => {
          onExit(code);
          process.exit(code);
        },
      })
    ),
};
