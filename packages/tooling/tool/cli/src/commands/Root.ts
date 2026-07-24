/**
 * Root CLI command definition.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Command } from "effect/unstable/cli";
import { agentEffectivenessCommand } from "./AgentEffectiveness/index.ts";
import { aiMetricsCommand } from "./AIMetrics/index.ts";
import { architectureCommand } from "./Architecture/index.ts";
import { ciCommand } from "./Ci/index.ts";
import { codegenCommand } from "./Codegen/index.ts";
import { codexCommand } from "./Codex/index.ts";
import { corpusCommand } from "./Corpus/index.ts";
import { createPackageCommand } from "./CreatePackage/index.ts";
import { docgenCommand } from "./Docgen/index.ts";
import { docsCommand } from "./Docs/index.ts";
import { fallowCommand } from "./Fallow/index.ts";
import { filesCommand } from "./Files/index.ts";
import { goalsCommand } from "./Goals/index.ts";
import { graphitiCommand } from "./Graphiti/index.ts";
import { imageCommand } from "./Image/index.ts";
import { lawsCommand } from "./Laws/index.ts";
import { lintCommand } from "./Lint/index.ts";
import { purgeCommand } from "./Purge/index.ts";
import { qualityCommand } from "./Quality/index.ts";
import { researchCommand } from "./Research/index.ts";
import { skillsCommand } from "./Skills/index.ts";
import { syncDataToTsCommand } from "./SyncDataToTs/index.ts";
import { topoSortCommand } from "./TopoSort/index.ts";
import { tsconfigSyncCommand } from "./TsconfigSync/index.ts";
import { versionSyncCommand } from "./VersionSync/index.ts";
import { worktreeCommand } from "./Worktree/index.ts";
import { yeetCommand } from "./Yeet/index.ts";

/**
 * Top-level CLI command that registers all subcommands.
 *
 * This is the command tree root consumed by `Command.run` in the bin entry point.
 *
 * @internal
 * @example
 * ```ts
 * console.log("rootCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const rootCommand = Command.make("beep-cli").pipe(
  Command.withDescription("CLI tool for managing beep-effect monorepo packages"),
  Command.withSubcommands([
    topoSortCommand,
    agentEffectivenessCommand,
    aiMetricsCommand,
    architectureCommand,
    ciCommand,
    codexCommand,
    corpusCommand,
    docgenCommand,
    docsCommand,
    fallowCommand,
    filesCommand,
    goalsCommand as Command.Command<"goals", {}, {}, never, never>,
    imageCommand,
    lintCommand,
    lawsCommand,
    qualityCommand,
    graphitiCommand,
    researchCommand,
    createPackageCommand,
    codegenCommand,
    purgeCommand,
    skillsCommand,
    syncDataToTsCommand,
    tsconfigSyncCommand,
    versionSyncCommand,
    worktreeCommand as Command.Command<"worktree", {}, {}, never, never>,
    yeetCommand,
  ])
) as Command.Command<"beep-cli", {}, {}, never, never>;
