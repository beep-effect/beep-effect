/**
 * The lazy dispatch manifest: every top-level `beep` group, its static root
 * help fields, the runtime services it needs and a dynamic import of its
 * `commands/<Group>` facade.
 *
 * **Details**
 *
 * The bin reads argv, picks one route here and imports only that group, so a
 * `beep <group> ...` call no longer loads the other forty-odd groups. Entries
 * keep the order of `commands/Root.ts`, which is the order `beep --help`
 * lists them in. `test/dispatch-manifest.test.ts` fails when an entry drifts
 * from the real command tree.
 *
 * Each route's loader is typed against the services it declares: a facade
 * whose requirements are not covered by the platform base plus the declared
 * {@link RuntimeService} keys does not typecheck, so a missing Layer is a
 * compile error rather than a runtime "service not found".
 *
 * The module imports nothing from the groups at load time, so it moves to the
 * composition app (`goals/beep-cli-composition` D1) by rewriting the import
 * specifiers alone.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { CommandGroupHelp } from "./Dispatch.schemas.ts";
import type { FsUtils, TSMorphService } from "@beep/repo-utils";
import type { BunServices } from "@effect/platform-bun/BunServices";
import type * as Crypto from "effect/Crypto";
import type * as Command from "effect/cli/Command";
import type * as HttpClient from "effect/http/HttpClient";
import type * as Scope from "effect/Scope";
import type { MemoryStats } from "../repo-run/QualityScheduler.ts";
import type { RuntimeService } from "./Dispatch.schemas.ts";

/**
 * Services every route runs with: the platform base Layer plus the program scope.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type BaseServices = BunServices | HttpClient.HttpClient | Crypto.Crypto | Scope.Scope;

// The service each `RuntimeService` key provides; a type-level map, never a value.
interface RuntimeServiceTypes {
  readonly "fs-utils": FsUtils;
  readonly "memory-stats": MemoryStats;
  readonly "ts-morph": TSMorphService;
}

// One manifest entry: the schema-modeled help and service keys, plus the facade loader. The
// loader is behavior, so the entry is not a schema; consumers name it as `CommandGroupRoute`.
interface CommandGroupRoute {
  readonly help: CommandGroupHelp;
  readonly load: () => Promise<Command.Command.Any>;
  readonly services: ReadonlyArray<RuntimeService>;
}

const groupRoute =
  <const Services extends ReadonlyArray<RuntimeService>>(
    help: Parameters<typeof CommandGroupHelp.make>[0],
    services: Services
  ) =>
  <Name extends string, Input, ContextInput, E>(
    load: () => Promise<
      Command.Command<Name, Input, ContextInput, E, BaseServices | RuntimeServiceTypes[Services[number]]>
    >
  ): CommandGroupRoute => ({ help: CommandGroupHelp.make(help), services, load });

/**
 * Every top-level group in `beep --help` order.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const commandGroupRoutes: ReadonlyArray<CommandGroupRoute> = [
  groupRoute({ name: "topo-sort", description: "Output workspace packages in topological dependency order" }, [
    "fs-utils",
  ])(() => import("../../commands/TopoSort/index.ts").then((module) => module.topoSortCommand)),
  groupRoute(
    { name: "agent-effectiveness", description: "Inspect and sync AI-agent effectiveness evidence" },
    []
  )(() => import("../../commands/AgentEffectiveness/index.ts").then((module) => module.agentEffectivenessCommand)),
  groupRoute(
    { name: "agent-message", description: "Durable scoped messages between explicitly owned agent sessions" },
    []
  )(() => import("../../commands/AgentMessage/index.ts").then((module) => module.agentMessageCommand)),
  groupRoute(
    { name: "ai-metrics", description: "Collect, normalize, and plan deployment for AI-agent metrics" },
    []
  )(() => import("../../commands/AIMetrics/index.ts").then((module) => module.aiMetricsCommand)),
  groupRoute({ name: "architecture", description: "Schema-versioned architecture operation-plan utilities" }, [
    "fs-utils",
    "ts-morph",
  ])(() => import("../../commands/Architecture/index.ts").then((module) => module.architectureCommand)),
  groupRoute({ name: "cache", description: "Turbo cache recovery and evidence operations" }, ["fs-utils"])(() =>
    import("../../commands/Cache/index.ts").then((module) => module.cacheCommand)
  ),
  groupRoute({ name: "ci", description: "Continuous integration helper commands" }, ["fs-utils"])(() =>
    import("../../commands/Ci/index.ts").then((module) => module.ciCommand)
  ),
  groupRoute(
    { name: "codex", description: "Codex agent helper commands" },
    []
  )(() => import("../../commands/Codex/index.ts").then((module) => module.codexCommand)),
  groupRoute(
    { name: "corpus", description: "Corpus salvage and curation commands" },
    []
  )(() => import("../../commands/Corpus/index.ts").then((module) => module.corpusCommand)),
  groupRoute(
    { name: "docgen", description: "Documentation generation, analysis, and report-only quality review utilities" },
    ["fs-utils"]
  )(() => import("../../commands/Docgen/index.ts").then((module) => module.docgenCommand)),
  groupRoute({ name: "docs", description: "Discover laws, skills, and policies without path references" }, [
    "fs-utils",
  ])(() => import("../../commands/Docs/index.ts").then((module) => module.docsCommand)),
  groupRoute(
    {
      name: "drawings",
      description: "Design-figure sheet rendering, filing validation, approval, and reviewer intake",
    },
    []
  )(() => import("../../commands/Drawings/index.ts").then((module) => module.drawingsCommand)),
  groupRoute(
    { name: "explore", description: "Read-only packet-stream checks over explorations and goals (advisory)" },
    []
  )(() => import("../../commands/Explore/index.ts").then((module) => module.exploreCommand)),
  groupRoute({ name: "fallow", description: "Fallow quality-tooling helpers" }, ["fs-utils"])(() =>
    import("../../commands/Fallow/index.ts").then((module) => module.fallowCommand)
  ),
  groupRoute(
    { name: "files", description: "Dataset file curation commands" },
    []
  )(() => import("../../commands/Files/index.ts").then((module) => module.filesCommand)),
  groupRoute(
    {
      name: "goals",
      description:
        "Goal-packet lifecycle tooling (doctor, index, capability graph, transitions, bootstrap, adoption, convention migration)",
    },
    []
  )(() => import("../../commands/Goals/index.ts").then((module) => module.goalsCommand)),
  groupRoute(
    {
      name: "harness-ledger",
      description: "Append-only harness evidence ledger (propose, disposition, list, prune-proposals, reconcile)",
    },
    []
  )(() => import("../../commands/HarnessLedger/index.ts").then((module) => module.harnessLedgerCommand)),
  groupRoute(
    { name: "refs", description: "Manage the manifest-defined reference workspace" },
    []
  )(() => import("../../commands/Refs/index.ts").then((module) => module.refsCommand)),
  groupRoute(
    { name: "image", description: "Image and video curation commands" },
    []
  )(() => import("../../commands/Image/index.ts").then((module) => module.imageCommand)),
  groupRoute(
    { name: "knowledge", description: "Knowledge-surface verification commands" },
    []
  )(() => import("../../commands/Knowledge/index.ts").then((module) => module.knowledgeCommand)),
  groupRoute({ name: "labs", description: "Inspect lab apps under apps/labs" }, ["fs-utils", "ts-morph"])(() =>
    import("../../commands/Labs/index.ts").then((module) => module.labsCommand)
  ),
  groupRoute({ name: "lint", description: "Repository lint policy checks" }, ["fs-utils", "ts-morph"])(() =>
    import("../../commands/Lint/index.ts").then((module) => module.lintCommand)
  ),
  // `lawsCommand` and `researchCommand` are exported with their requirements cast away, so
  // their keys are set by hand: Laws reads TSMorphService, Research only the platform base.
  groupRoute({ name: "laws", description: "Effect governance validation and migration commands" }, ["ts-morph"])(() =>
    import("../../commands/Laws/index.ts").then((module) => module.lawsCommand)
  ),
  groupRoute(
    { name: "models", description: "Check every routing surface against the operator model manifest" },
    []
  )(() => import("../../commands/Models/index.ts").then((module) => module.modelsCommand)),
  groupRoute({ name: "observability", description: "Instrumentation catalog and observability standards" }, [
    "fs-utils",
  ])(() => import("../../commands/Observability/index.ts").then((module) => module.observabilityCommand)),
  groupRoute(
    {
      name: "palantiri",
      description: "Agent-facing observability parcels: quota headroom, lane reds, host pressure and more",
    },
    ["memory-stats"]
  )(() => import("../../commands/Palantiri/index.ts").then((module) => module.palantiriCommand)),
  groupRoute({ name: "quality", description: "Repository operational quality commands" }, ["fs-utils", "memory-stats"])(
    () => import("../../commands/Quality/index.ts").then((module) => module.qualityCommand)
  ),
  groupRoute(
    { name: "research", description: "Research knowledge-vault and source-library curation commands" },
    []
  )(() => import("../../commands/Research/index.ts").then((module) => module.researchCommand)),
  groupRoute(
    { name: "reviewer" },
    []
  )(() => import("../../commands/Reviewer/index.ts").then((module) => module.reviewerCommand)),
  groupRoute(
    { name: "runners", description: "CI runner image operations" },
    []
  )(() => import("../../commands/Runners/index.ts").then((module) => module.runnersCommand)),
  groupRoute(
    {
      name: "session",
      description: "Record and read where harness sessions stopped across every clone on this machine",
    },
    []
  )(() => import("../../commands/Session/index.ts").then((module) => module.sessionCommand)),
  groupRoute(
    {
      name: "accounts",
      description:
        "Live screen of every Claude, Codex, SuperGrok, and Muse account: which one to use next, per provider",
    },
    []
  )(() => import("../../commands/Accounts/index.ts").then((module) => module.accountsCommand)),
  groupRoute(
    { name: "create-package", description: "Create a new package or app workspace following Effect v4 conventions" },
    ["fs-utils", "ts-morph"]
  )(() => import("../../commands/CreatePackage/index.ts").then((module) => module.createPackageCommand)),
  groupRoute(
    {
      name: "delete-package",
      description: "Delete a leaf workspace package or doctor a deleted package for registration residue",
    },
    ["fs-utils", "ts-morph"]
  )(() => import("../../commands/DeletePackage/index.ts").then((module) => module.deletePackageCommand)),
  groupRoute({ name: "codegen", description: "Run a code generator" }, ["fs-utils"])(() =>
    import("../../commands/Codegen/index.ts").then((module) => module.codegenCommand)
  ),
  groupRoute(
    { name: "purge", description: "Remove root and workspace build artifacts" },
    []
  )(() => import("../../commands/Purge/index.ts").then((module) => module.purgeCommand)),
  groupRoute(
    { name: "qa", description: "Recorded UI verification: capture, extract, and judge motion evidence" },
    []
  )(() => import("../../commands/Qa/index.ts").then((module) => module.qaCommand)),
  groupRoute(
    { name: "skills", description: "Manage repo-local Claude and Codex skill mirrors" },
    []
  )(() => import("../../commands/Skills/index.ts").then((module) => module.skillsCommand)),
  groupRoute(
    { name: "sync-data-to-ts", description: "Sync official upstream datasets into checked-in TypeScript modules" },
    []
  )(() => import("../../commands/SyncDataToTs/index.ts").then((module) => module.syncDataToTsCommand)),
  groupRoute(
    {
      name: "tsconfig-sync",
      description:
        "Synchronize repo-managed config files including root tsconfig references, aliases, syncpack, package tsconfig.check.json references, package docgen, the generated Vitest alias data, and the generated Fallow boundary config",
    },
    ["fs-utils"]
  )(() => import("../../commands/TsconfigSync/index.ts").then((module) => module.tsconfigSyncCommand)),
  groupRoute(
    {
      name: "version-sync",
      description:
        "Detect and fix version drift across Bun runtime pins and checksums, Node pins, CI workflows, Docker images, Biome, the root Effect catalog, and turbo.json schema URLs",
    },
    ["fs-utils"]
  )(() => import("../../commands/VersionSync/index.ts").then((module) => module.versionSyncCommand)),
  groupRoute(
    { name: "worktree", description: "Manage sibling git worktrees under the canonical worktrees root" },
    []
  )(() => import("../../commands/Worktree/index.ts").then((module) => module.worktreeCommand)),
  groupRoute({ name: "yeet", description: "Repair, verify, or publish repository work with canonical quality proof" }, [
    "memory-stats",
  ])(() => import("../../commands/Yeet/index.ts").then((module) => module.yeetCommand)),
];

/**
 * Root quality-task names (`beep build`, `beep check`, ...) parsed by
 * `commands/Quality/Tasks.ts` before any command group loads.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const QUALITY_TASK_NAMES: ReadonlyArray<string> = ["build", "check", "test", "lint", "audit", "coverage"];

/**
 * Loader for the quality-task route: argv parsing and the task program, on the platform base alone.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const loadQualityTasks = () => import("../../commands/Quality/Tasks.ts");
