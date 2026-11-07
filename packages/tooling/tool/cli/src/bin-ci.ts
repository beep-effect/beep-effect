#!/usr/bin/env bun
/**
 * Slim CI entry point: a `beep` root holding only the pre-toolchain `ci` commands.
 *
 * `beep ci compile-binary` compiles this module with `bun build --compile`
 * into the binary hosted jobs run before `bun install`. It registers the same
 * command values as the full `ci` group, so `beep ci <command>` behaves
 * identically in both, and it provides only the Bun platform services those
 * commands need.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { CliRuntime } from "@beep/cli-kit/CliRuntime";
import { renderCliFailure } from "@beep/repo-cli-kit/cli/FailureRendering";
import {
  drainProcessStreams,
  ProcessStreamName,
  streamConsole,
  writeBestEffortLine,
} from "@beep/repo-cli-kit/cli/Stdout";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import { ciBootstrapCommands } from "./commands/Ci/CiBootstrap.command.ts";

const argv = A.drop(process.argv, 2);

const ciCommand = Command.make("ci").pipe(
  Command.withDescription("Continuous integration helper commands"),
  Command.withSubcommands(ciBootstrapCommands)
);

const rootCommand = Command.make("beep").pipe(
  Command.withDescription("Pre-toolchain CI commands of the beep-effect repo CLI"),
  Command.withSubcommands([ciCommand])
);

// The platform services are built once here, at the entry point, like bin-main's base layer.
const program = BunServices.layer.pipe(
  Layer.build,
  Effect.flatMap((context) => Command.run(rootCommand, { version: "0.0.0" }).pipe(Effect.provide(context))),
  Effect.scoped
);

BunRuntime.runMain(
  Effect.provideService(
    CliRuntime.main(program, { platform: Layer.empty, usageExitCode: 1, render: renderCliFailure(argv) }),
    Console.Console,
    streamConsole
  ),
  {
    disableErrorReporting: true,
    // As in bin-main: drain the stream console, then exit with the teardown's code.
    teardown: (exit, onExit) =>
      Runtime.defaultTeardown(exit, (code) => {
        drainProcessStreams((failure) => {
          if (O.isSome(failure)) {
            const { stream, message, droppedLines } = failure.value;
            const channel = ProcessStreamName.is.stderr(stream) ? process.stdout : process.stderr;
            const fallback = ProcessStreamName.is.stderr(stream) ? process.stderr : process.stdout;
            writeBestEffortLine(
              channel,
              fallback,
              `[beep-ci] exiting with code ${code}; ${stream} write failed: ${message}; ${droppedLines} line(s) dropped\n`
            );
          }
          onExit(code);
          process.exit(code);
        });
      }),
  }
);
