/**
 * Graphiti command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, flow, pipe } from "effect";
import * as O from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.js";
import { GraphitiProxyServiceInstallOptions, GraphitiRestoreOptions } from "./Graphiti.schemas.js";
import {
  ensureGraphitiProxy,
  installGraphitiProxyService,
  recoverGraphitiStack,
  restoreGraphitiStack,
  verifyGraphitiStack,
} from "./Graphiti.service.js";
import { runGraphitiProxy } from "./internal/ProxyRuntime.js";
import type { GraphitiProxyOpsError } from "./Graphiti.errors.js";

/**
 * Graphiti queue proxy subcommand.
 *
 * @example
 * ```ts
 * console.log("graphiti proxy")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const graphitiProxyCommand = pipe(
  Command.make("proxy", {}, () => runGraphitiProxy),
  Command.withDescription("Run the Graphiti MCP queue proxy")
);

const runProxyOpsProgram = <A, R>(program: Effect.Effect<A, GraphitiProxyOpsError, R>) => program.pipe(Effect.asVoid);

const graphitiProxyEnsureCommand = pipe(
  Command.make("ensure", {}, () => runProxyOpsProgram(ensureGraphitiProxy())),
  Command.withDescription("Ensure the Graphiti MCP queue proxy is healthy")
);

const graphitiProxyServiceInstallCommand = pipe(
  Command.make("install", {}, () =>
    runProxyOpsProgram(installGraphitiProxyService(GraphitiProxyServiceInstallOptions.make({})))
  ),
  Command.withDescription("Install and start the Graphiti proxy user service")
);

const graphitiProxyServiceCommand = pipe(
  Command.make("service", {}, () =>
    printLines(["Graphiti proxy service commands:", "- bun run beep graphiti proxy service install"])
  ),
  Command.withDescription("Graphiti proxy user service commands"),
  Command.withSubcommands([graphitiProxyServiceInstallCommand])
);

const graphitiRecoverCommand = pipe(
  Command.make(
    "recover",
    {
      dryRun: pipe(
        Flag.boolean("dry-run"),
        Flag.withDescription("Print" + " planned recovery actions without side effects")
      ),
      force: pipe(
        Flag.boolean("force"),
        Flag.withDescription("Restart" + " backing containers even when they are healthy")
      ),
    },
    flow(recoverGraphitiStack, runProxyOpsProgram)
  ),
  Command.withDescription("Recover the local Graphiti backing stack")
);

const stackDirFlag = pipe(
  Flag.string("stack-dir"),
  Flag.withDescription(
    "Graphiti Compose stack directory (default: $HOME/graphiti-mcp; override with GRAPHITI_STACK_DIR)"
  ),
  Flag.optional
);

const graphitiRestoreCommand = pipe(
  Command.make(
    "restore",
    {
      backup: pipe(Flag.boolean("backup"), Flag.withDescription("Copy persisted data before restoring containers")),
      dryRun: pipe(Flag.boolean("dry-run"), Flag.withDescription("Print planned restore actions without side effects")),
      force: pipe(Flag.boolean("force"), Flag.withDescription("Force recreate backing containers during restore")),
      stackDir: stackDirFlag,
    },
    ({ backup, dryRun, force, stackDir }) =>
      runProxyOpsProgram(
        restoreGraphitiStack(
          GraphitiRestoreOptions.make({
            backup,
            dryRun,
            force,
            stackDir: O.getOrUndefined(stackDir),
          })
        )
      )
  ),
  Command.withDescription("Restore and verify the local Graphiti memory runtime")
);

const graphitiVerifyCommand = pipe(
  Command.make(
    "verify",
    {
      stackDir: stackDirFlag,
    },
    ({ stackDir }) =>
      runProxyOpsProgram(
        verifyGraphitiStack(
          GraphitiRestoreOptions.make({
            stackDir: O.getOrUndefined(stackDir),
          })
        )
      )
  ),
  Command.withDescription("Verify the local Graphiti stack, persisted graph, and MCP proxy")
);

/**
 * Graphiti command group.
 *
 * @example
 * ```ts
 * console.log("graphitiCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const graphitiCommand = pipe(
  Command.make("graphiti", {}, () =>
    printLines([
      "Graphiti commands:",
      "- bun run beep graphiti proxy",
      "- bun run beep graphiti proxy ensure",
      "- bun run beep graphiti proxy service install",
      "- bun run beep graphiti restore --dry-run",
      "- bun run beep graphiti restore",
      "- bun run beep graphiti verify",
      "- bun run beep graphiti recover --dry-run",
    ])
  ),
  Command.withDescription("Graphiti operational commands"),
  Command.withSubcommands([
    pipe(graphitiProxyCommand, Command.withSubcommands([graphitiProxyEnsureCommand, graphitiProxyServiceCommand])),
    graphitiRecoverCommand,
    graphitiRestoreCommand,
    graphitiVerifyCommand,
  ])
);
