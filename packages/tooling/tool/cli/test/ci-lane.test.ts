import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git, GitCommandError } from "@beep/git/Git";
import {
  CI_LANE_DESCRIPTORS,
  CI_LANE_ID_VALUES,
  CI_LANE_PARTITIONS,
  CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS,
  CiLaneId,
  CiLanePartition,
  CiLanePartitionShard,
  CiLanePartitionStepRequest,
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLaneCommand,
  ciLaneDefaultPlacementLinesForTesting,
  ciLaneDefaultPlacements,
  ciLanePartitionArgsForTesting,
  ciLanePartitionStepForTesting,
  ciLaneStartOrder,
  ciLaneStepsForTesting,
  ciLocalLaneInputsForTesting,
  ciLocalStepsForTesting,
  DOCS_POLICY_ROOT_TASKS,
  docgenLaneModeForChangedPaths,
  planCiLanePartitions,
  plannedCiLanePartitions,
  proveCiLanePartition,
  runCiLane,
  withCiLaneDefaultPlacements,
} from "@beep/repo-cli/commands/Ci";
import * as CiCoverage from "@beep/repo-cli/commands/Ci/CiCoverage";
import { CiCoverageArtifactPlan } from "@beep/repo-cli/commands/Quality/Tasks";
import { CoverageProducerIdentity, CoverageScopeOwner } from "@beep/repo-cli/test/Quality";
import {
  isCiSync,
  isLabsWorkspaceDir,
  readTurboCacheEnvironment,
  resolveTurboCachePlan,
  turboCachePlanArgs,
  workspaceManifests,
} from "@beep/repo-cli/test/SharedInternals";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { describe, expect, vi } from "@effect/vitest";
import { assertDefined, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { constUndefined, flow, identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { commandArgs } from "./support/commandArgs.ts";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";
import type { SpawnRecord } from "@beep/commands/ScriptedSpawner";
import type { PartitionedCiLane } from "@beep/repo-cli/commands/Ci";

class CiLaneTestOperationError extends S.TaggedError<CiLaneTestOperationError, { readonly brand: unique symbol }>()(
  "CiLaneTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in ci-lane.test.ts." }
) {}

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
const gitPlatform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer);

const REPO_ROOT = "/repo";
const coverageDispatchIdentity = CoverageProducerIdentity.make({
  executionSha: Str.repeat(40)("a"),
  baseSha: Str.repeat(40)("b"),
  runId: "coverage-dispatch-fixture",
  runAttempt: 1,
  scopeDigest: Str.repeat(64)("c"),
});
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const withEnvVar = <A>(name: string, value: string | undefined, use: () => A): A => {
  const previous = Bun.env[name];
  if (value === undefined) delete Bun.env[name];
  else Bun.env[name] = value;
  try {
    return use();
  } finally {
    if (previous === undefined) delete Bun.env[name];
    else Bun.env[name] = previous;
  }
};

const expectedTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: isCiSync() }));

const spawnLine = (spawn: SpawnRecord) => A.join([spawn.command, ...spawn.args], " ");
const spawnLines = (spawner: ScriptedSpawner) => A.map(spawner.spawns, spawnLine);

// The kit reads `-z` output, so the scripted diff answers NUL-separated.
const ciSpawner = (changedFiles: ReadonlyArray<string>, failedTask?: string) =>
  ScriptedSpawner.make((command, args) => ({
    stdout: command === "git" ? A.join(changedFiles, "\0") : "",
    exit: failedTask !== undefined && A.contains(args, failedTask) ? 1 : 0,
  }));

const ciExecutionLayer = (spawner: ScriptedSpawner, sources: ReadonlyArray<readonly [string, string]> = []) => {
  const fileSystemLayer = FileSystem.layerNoop({
    exists: (file) =>
      Effect.succeed(Str.endsWith("/.git")(file) || A.some(sources, ([suffix]) => Str.endsWith(suffix)(file))),
    makeDirectory: () => Effect.void,
    readFileString: (file) => {
      const source = A.findFirst(sources, ([suffix]) => Str.endsWith(suffix)(file));
      return O.match(source, {
        onNone: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "NotFound",
              module: "CiLaneTest",
              method: "readFileString",
              pathOrDescriptor: file,
            })
          ),
        onSome: ([, content]) => Effect.succeed(content),
      });
    },
    writeFileString: () => Effect.void,
  });
  const fileSystemAndPath = Layer.merge(fileSystemLayer, Path.layer);
  return Layer.provideMerge(
    Git.layer,
    Layer.mergeAll(
      BunCrypto.layer,
      fileSystemAndPath,
      FsUtilsLive.pipe(Layer.provide(fileSystemAndPath)),
      spawner.layer,
      TestConsole.layer
    )
  );
};

const firstOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.head(items));
const stepAt = <T>(items: ReadonlyArray<T>, index: number): T => O.getOrThrow(A.get(items, index));
const lastOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.last(items));
const isLocalCiLaneId = S.is(CiLaneId);
const isWorkflowScript = S.is(S.String);
const decodeShard = S.decodeUnknownOption(CiLanePartitionShard);

const baseOptions = CiLaneRunOptions.make({
  affected: false,
  base: "origin/main",
  head: "HEAD",
  summarize: false,
  mode: "affected",
  to: "HEAD",
  last: false,
  changesetStatus: false,
  validateEnvelopes: false,
});

const prShapeOptions = CiLaneRunOptions.make({
  ...baseOptions,
  affected: true,
  summarize: true,
});

const BranchProtectionContextSnapshot = S.Struct({
  schemaVersion: S.tag("branch-protection-contexts/v1"),
  capturedAt: S.String,
  repository: S.tag("beep-effect/beep-effect"),
  branch: S.tag("main"),
  rulesetId: S.tag(10240248),
  rulesetName: S.String,
  enforcement: S.tag("active"),
  strictRequiredStatusChecksPolicy: S.tag(false),
  requiredStatusChecks: S.Array(S.String),
});
const decodeBranchProtectionContextSnapshot = S.decodeUnknownEffect(S.fromJsonString(BranchProtectionContextSnapshot));
const branchProtectionContextSnapshotUrl = new URL(
  "../../../../../standards/branch-protection-contexts.json",
  import.meta.url
);
const checkWorkflowUrl = new URL("../../../../../.github/workflows/check.yml", import.meta.url);
const integrationShardPlanUrl = new URL(
  "../../../../../packages/law-practice/server/vitest.integration.shards.json",
  import.meta.url
);
const decodeIntegrationShardPlan = S.decodeUnknownEffect(
  S.Struct({ shardSeconds: S.Array(S.Finite), shards: S.String.pipe(S.Array, S.Array) })
);
const LiveRepoLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer)))
  )
);
const PartitionLaneLayer = Layer.merge(LiveRepoLayer, TestConsole.layer);

const withEnvVarEffect = <A, E, R>(
  name: string,
  value: string | undefined,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Bun.env[name];
      if (value === undefined) delete Bun.env[name];
      else Bun.env[name] = value;
      return previous;
    }),
    () => use,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) delete Bun.env[name];
        else Bun.env[name] = previous;
      })
  );

type PartitionShimOptions = {
  readonly dryRunOutput: string;
  readonly dryRunExitCode?: number;
  readonly executionExitCode?: number;
};

const withPartitionShim = Effect.fn("withPartitionShim")(function* <A, E, R>(
  options: PartitionShimOptions,
  use: (fixture: { readonly commandLogPath: string; readonly tempDir: string }) => Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const tempDir = yield* fs.makeTempDirectoryScoped();
  const path = yield* Path.Path;
  const binDir = path.join(tempDir, "bin");
  const commandLogPath = path.join(tempDir, "commands.log");
  const bunxPath = path.join(binDir, "bunx");

  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    bunxPath,
    A.join(
      [
        "#!/usr/bin/env sh",
        'printf \'%s\\n\' "$*" >> "$CI_LANE_TEST_COMMAND_LOG"',
        'case " $* " in',
        '  *" --dry-run=json "*)',
        "    printf '%s\\n' \"$CI_LANE_TEST_DRY_RUN_OUTPUT\"",
        '    exit "${CI_LANE_TEST_DRY_RUN_EXIT:-0}"',
        "    ;;",
        "esac",
        'exit "${CI_LANE_TEST_EXECUTION_EXIT:-0}"',
        "",
      ],
      "\n"
    )
  );
  yield* fs.chmod(bunxPath, 0o755);
  const bunPath = path.join(binDir, "bun");
  const readFileString1 = yield* fs.readFileString(bunxPath);
  yield* fs.writeFileString(bunPath, readFileString1);
  yield* fs.chmod(bunPath, 0o755);

  return yield* withEnvVarEffect(
    "PATH",
    `${binDir}:${Bun.env.PATH ?? ""}`,
    withEnvVarEffect(
      "CI_LANE_TEST_COMMAND_LOG",
      commandLogPath,
      withEnvVarEffect(
        "CI_LANE_TEST_DRY_RUN_OUTPUT",
        options.dryRunOutput,
        withEnvVarEffect(
          "CI_LANE_TEST_DRY_RUN_EXIT",
          String(options.dryRunExitCode ?? 0),
          withEnvVarEffect(
            "CI_LANE_TEST_EXECUTION_EXIT",
            String(options.executionExitCode ?? 0),
            use({ commandLogPath, tempDir })
          )
        )
      )
    )
  );
});

const withWorkingDirectory = <A, E, R>(directory: string, use: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(directory);
      return previous;
    }),
    () => use,
    (previous) => Effect.sync(() => process.chdir(previous))
  );

const partitionPackages = (partitionId: string): ReadonlyArray<string> =>
  O.getOrThrow(A.findFirst(CI_LANE_PARTITIONS, (partition) => partition.id === partitionId)).packages;

const lanePackages = (laneId: "lint" | "test-unit"): ReadonlyArray<string> =>
  pipe(
    CI_LANE_PARTITIONS,
    A.filter((partition) => partition.lane === laneId),
    A.flatMap((partition) => partition.packages)
  );

// Executable non-labs packages of the live workspace, the inventory the lane
// proves against. Deriving expectations from it keeps these tests green when a
// workspace package is created without a partition-table edit.
const liveTaskPackages = Effect.fn(function* (task: "lint" | "test") {
  const repoRoot = yield* findRepoRoot();
  const path = yield* Path.Path;
  const workspaces = yield* workspaceManifests(repoRoot);
  return pipe(
    A.fromIterable(HashMap.entries(workspaces)),
    A.filter(([, workspace]) => {
      const relativeDir = Str.replace(/\\/g, "/")(path.relative(repoRoot, workspace.dir));
      return !isLabsWorkspaceDir(relativeDir) && HashMap.has(workspace.manifest.scripts, task);
    }),
    A.map(([name]) => name),
    A.sort(Order.String)
  );
});

const effectivePartitionSize = (
  laneId: "lint" | "test-unit",
  partitionId: string,
  taskPackages: ReadonlyArray<string>
): number =>
  pipe(
    withCiLaneDefaultPlacements(
      A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === laneId),
      taskPackages
    ),
    A.findFirst((partition) => partition.id === partitionId),
    O.map((partition) => A.length(partition.packages)),
    O.getOrElse(() => 0)
  );

const turboDryRunOutput = (task: string, packages: ReadonlyArray<string>): string =>
  encodeJson({
    tasks: A.map(packages, (packageName) => ({
      command: `bun run ${task}`,
      package: packageName,
      task,
      taskId: `${packageName}#${task}`,
    })),
  });

describe("CI lane descriptors", () => {
  it("enumerates every check.yml lane exactly once", () => {
    const ids = A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id);
    expect(A.length(A.dedupe(ids))).toBe(A.length(ids));
    expect(A.length(CI_LANE_DESCRIPTORS)).toBe(26);
  });

  it("retires the standalone Effect diagnostics lane", () => {
    expect(A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id)).not.toContain("effect-diagnostics");
  });

  it("covers every runnable lane id", () => {
    const descriptorIds = A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id);
    const missing = A.filter(CI_LANE_ID_VALUES, (laneId) => !A.contains(descriptorIds, laneId));
    expect(missing).toEqual([]);
  });

  it.effect("matches captured workflow checks apart from the optional external reviewer App check", () =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.tryPromise({
        try: () => Bun.file(branchProtectionContextSnapshotUrl).text(),
        catch: (cause) => CiLaneTestOperationError.make({ cause }),
      }).pipe(Effect.flatMap(decodeBranchProtectionContextSnapshot));
      const requiredContexts = pipe(
        CI_LANE_DESCRIPTORS,
        A.filter((descriptor) => descriptor.required),
        A.map((descriptor) => descriptor.contextName),
        A.dedupe,
        A.sort(Order.String)
      );
      // The reviewer App owns this optional context outside the workflow lane inventory (D41).
      expect(requiredContexts).toEqual(
        pipe(
          snapshot.requiredStatusChecks,
          A.filter((context) => context !== "beep-reviewer"),
          A.sort(Order.String)
        )
      );
    })
  );

  it("keeps the ecosystem contracts context visible but non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "ecosystem"));
    expect(descriptor.contextName).toBe("Ecosystem Contracts");
    expect(descriptor.required).toBe(false);
  });

  // hosted-setup-tax PERIH-02: Repo Sanity owns `lint:shadcn`, so the
  // non-required Shadcn Lint context and its lane are retired.
  it("retires the Shadcn Lint context and lane", () => {
    expect(A.some(CI_LANE_DESCRIPTORS, (candidate) => candidate.contextName === "Shadcn Lint")).toBe(false);
    expect(A.some(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "repo-sanity" && candidate.required)).toBe(true);
  });

  it("keeps the JSDoc ratchet required by the live ruleset", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "jsdoc-ratchet"));
    expect(descriptor.contextName).toBe("JSDoc Ratchet");
    expect(descriptor.required).toBe(true);
  });

  // lab-apps-lifecycle P2 (ratified row 10): the labs lane is PERMANENTLY
  // non-required — its context must never join ruleset 10240248.
  it("keeps the labs lane visible, workflow-gated, and permanently non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "labs"));
    expect(descriptor.contextName).toBe("Labs");
    expect(descriptor.required).toBe(false);
    expect(descriptor.laneClass).toBe("workflow-gated");
  });

  // Quality-lane audit D13: the Storybook context is visible, gated, and
  // non-required until it has a stable green history.
  it("keeps the storybook lane visible, workflow-gated, and non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "storybook"));
    expect(descriptor.contextName).toBe("Storybook");
    expect(descriptor.required).toBe(false);
    expect(descriptor.laneClass).toBe("workflow-gated");
    expect(descriptor.replay).toBe("exact");
    expect([...descriptor.flags]).toEqual(["--affected", "--base", "--summarize"]);
  });

  it("marks the CI-only residue as unreplayable", () => {
    const residue = pipe(
      CI_LANE_DESCRIPTORS,
      A.filter((descriptor) => descriptor.replay === "none"),
      A.map((descriptor) => descriptor.id),
      A.sort(Order.String)
    );
    expect(residue).toEqual(["dependency-review", "pr-size"]);
  });
});

describe("CI lane partitions", () => {
  it("preserves the signed bin counts and p95 weights", () => {
    expect(
      A.map(CI_LANE_PARTITIONS, (partition) => ({
        id: partition.id,
        packages: A.length(partition.packages),
        weightSeconds: partition.weightSeconds,
      }))
    ).toEqual([
      { id: "lint-a", packages: 75, weightSeconds: 1132 },
      { id: "lint-b", packages: 68, weightSeconds: 1134 },
      { id: "repo-cli-1", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-2", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-3", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-4", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-5", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-6", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-7", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-8", packages: 1, weightSeconds: 392 },
      { id: "repo-cli-9", packages: 1, weightSeconds: 392 },
      { id: "law-practice-1", packages: 1, weightSeconds: 564 },
      { id: "law-practice-2", packages: 1, weightSeconds: 564 },
      { id: "law-practice-3", packages: 1, weightSeconds: 564 },
      { id: "law-practice-4", packages: 1, weightSeconds: 564 },
      { id: "law-practice-5", packages: 1, weightSeconds: 564 },
      { id: "law-practice-6", packages: 1, weightSeconds: 564 },
      { id: "law-practice-7", packages: 1, weightSeconds: 564 },
      { id: "law-practice-8", packages: 1, weightSeconds: 564 },
      { id: "unit-a", packages: 26, weightSeconds: 594 },
      { id: "unit-b", packages: 28, weightSeconds: 593 },
      { id: "unit-c", packages: 27, weightSeconds: 594 },
      { id: "unit-d", packages: 27, weightSeconds: 594 },
      { id: "unit-e", packages: 27, weightSeconds: 593 },
      { id: "unit-f", packages: 28, weightSeconds: 593 },
      { id: "unit-g", packages: 28, weightSeconds: 594 },
      { id: "lps-int-1", packages: 1, weightSeconds: 422 },
      { id: "lps-int-2", packages: 1, weightSeconds: 400 },
      { id: "lps-int-3", packages: 1, weightSeconds: 391 },
      { id: "lps-int-4", packages: 1, weightSeconds: 366 },
      { id: "lps-int-5", packages: 1, weightSeconds: 359 },
      { id: "lps-int-6", packages: 1, weightSeconds: 356 },
      { id: "lps-int-7", packages: 1, weightSeconds: 355 },
      { id: "lps-int-8", packages: 1, weightSeconds: 347 },
      { id: "lps-int-9", packages: 1, weightSeconds: 328 },
      { id: "lps-int-10", packages: 1, weightSeconds: 324 },
      { id: "lps-int-11", packages: 1, weightSeconds: 312 },
      { id: "lps-int-12", packages: 1, weightSeconds: 308 },
      { id: "lps-int-13", packages: 1, weightSeconds: 310 },
      { id: "lps-int-14", packages: 1, weightSeconds: 342 },
      { id: "lps-int-15", packages: 1, weightSeconds: 356 },
      { id: "lps-int-16", packages: 1, weightSeconds: 353 },
      { id: "lps-int-17", packages: 1, weightSeconds: 367 },
      { id: "lps-int-18", packages: 1, weightSeconds: 391 },
      { id: "lps-int-19", packages: 1, weightSeconds: 421 },
      { id: "int-rest", packages: 0, weightSeconds: 60 },
    ]);
  });

  it("starts each unit bin's heaviest packages first and names only its own packages", () => {
    const bins = A.filter(CI_LANE_PARTITIONS, (partition) => Str.startsWith("unit-")(partition.id));
    for (const bin of bins) {
      const startFirst = bin.startFirst ?? [];
      expect(A.isReadonlyArrayNonEmpty(startFirst)).toBe(true);
      expect(A.every(startFirst, (name) => A.contains(bin.packages, name))).toBe(true);
      const ordered = ciLaneStartOrder(bin.packages, startFirst, identity);
      expect(A.take(ordered, A.length(startFirst))).toEqual(startFirst);
      expect(A.sort(ordered, Order.String)).toEqual(A.sort(bin.packages, Order.String));
    }
    expect(ciLaneStartOrder(["a", "b", "c", "d"], ["c", "x", "b"], identity)).toEqual(["c", "b", "a", "d"]);
    expect(ciLaneStartOrder(["a", "b"], [], identity)).toEqual(["a", "b"]);
  });

  it("pins the repo-cli and law-practice-server Vitest shard splits and keeps every other bin unsharded", () => {
    expect(A.map(CI_LANE_PARTITIONS, (partition) => ({ id: partition.id, shard: partition.shard }))).toEqual([
      { id: "lint-a", shard: undefined },
      { id: "lint-b", shard: undefined },
      { id: "repo-cli-1", shard: CiLanePartitionShard.make({ index: 1, total: 9 }) },
      { id: "repo-cli-2", shard: CiLanePartitionShard.make({ index: 2, total: 9 }) },
      { id: "repo-cli-3", shard: CiLanePartitionShard.make({ index: 3, total: 9 }) },
      { id: "repo-cli-4", shard: CiLanePartitionShard.make({ index: 4, total: 9 }) },
      { id: "repo-cli-5", shard: CiLanePartitionShard.make({ index: 5, total: 9 }) },
      { id: "repo-cli-6", shard: CiLanePartitionShard.make({ index: 6, total: 9 }) },
      { id: "repo-cli-7", shard: CiLanePartitionShard.make({ index: 7, total: 9 }) },
      { id: "repo-cli-8", shard: CiLanePartitionShard.make({ index: 8, total: 9 }) },
      { id: "repo-cli-9", shard: CiLanePartitionShard.make({ index: 9, total: 9 }) },
      { id: "law-practice-1", shard: CiLanePartitionShard.make({ index: 1, total: 8 }) },
      { id: "law-practice-2", shard: CiLanePartitionShard.make({ index: 2, total: 8 }) },
      { id: "law-practice-3", shard: CiLanePartitionShard.make({ index: 3, total: 8 }) },
      { id: "law-practice-4", shard: CiLanePartitionShard.make({ index: 4, total: 8 }) },
      { id: "law-practice-5", shard: CiLanePartitionShard.make({ index: 5, total: 8 }) },
      { id: "law-practice-6", shard: CiLanePartitionShard.make({ index: 6, total: 8 }) },
      { id: "law-practice-7", shard: CiLanePartitionShard.make({ index: 7, total: 8 }) },
      { id: "law-practice-8", shard: CiLanePartitionShard.make({ index: 8, total: 8 }) },
      { id: "unit-a", shard: undefined },
      { id: "unit-b", shard: undefined },
      { id: "unit-c", shard: undefined },
      { id: "unit-d", shard: undefined },
      { id: "unit-e", shard: undefined },
      { id: "unit-f", shard: undefined },
      { id: "unit-g", shard: undefined },
      { id: "lps-int-1", shard: CiLanePartitionShard.make({ index: 1, total: 19 }) },
      { id: "lps-int-2", shard: CiLanePartitionShard.make({ index: 2, total: 19 }) },
      { id: "lps-int-3", shard: CiLanePartitionShard.make({ index: 3, total: 19 }) },
      { id: "lps-int-4", shard: CiLanePartitionShard.make({ index: 4, total: 19 }) },
      { id: "lps-int-5", shard: CiLanePartitionShard.make({ index: 5, total: 19 }) },
      { id: "lps-int-6", shard: CiLanePartitionShard.make({ index: 6, total: 19 }) },
      { id: "lps-int-7", shard: CiLanePartitionShard.make({ index: 7, total: 19 }) },
      { id: "lps-int-8", shard: CiLanePartitionShard.make({ index: 8, total: 19 }) },
      { id: "lps-int-9", shard: CiLanePartitionShard.make({ index: 9, total: 19 }) },
      { id: "lps-int-10", shard: CiLanePartitionShard.make({ index: 10, total: 19 }) },
      { id: "lps-int-11", shard: CiLanePartitionShard.make({ index: 11, total: 19 }) },
      { id: "lps-int-12", shard: CiLanePartitionShard.make({ index: 12, total: 19 }) },
      { id: "lps-int-13", shard: CiLanePartitionShard.make({ index: 13, total: 19 }) },
      { id: "lps-int-14", shard: CiLanePartitionShard.make({ index: 14, total: 19 }) },
      { id: "lps-int-15", shard: CiLanePartitionShard.make({ index: 15, total: 19 }) },
      { id: "lps-int-16", shard: CiLanePartitionShard.make({ index: 16, total: 19 }) },
      { id: "lps-int-17", shard: CiLanePartitionShard.make({ index: 17, total: 19 }) },
      { id: "lps-int-18", shard: CiLanePartitionShard.make({ index: 18, total: 19 }) },
      { id: "lps-int-19", shard: CiLanePartitionShard.make({ index: 19, total: 19 }) },
      { id: "int-rest", shard: undefined },
    ]);
    for (const id of ["repo-cli-1", "repo-cli-2", "repo-cli-3", "repo-cli-4", "repo-cli-5", "repo-cli-6"] as const) {
      expect(partitionPackages(id)).toEqual(["@beep/repo-cli"]);
    }
    for (const id of ["law-practice-1", "law-practice-6", "law-practice-8"] as const) {
      expect(partitionPackages(id)).toEqual(["@beep/law-practice-server"]);
    }
    for (const partition of A.filter(CI_LANE_PARTITIONS, (candidate) => candidate.lane === "test-integration")) {
      expect(partition.packages).toEqual(partition.shard === undefined ? [] : ["@beep/law-practice-server"]);
    }
  });

  it.effect("sizes the law-practice-server integration shards from the committed LPT plan", () =>
    Effect.gen(function* () {
      const plan = yield* Effect.tryPromise({
        try: () => Bun.file(integrationShardPlanUrl).json(),
        catch: (cause) => CiLaneTestOperationError.make({ cause }),
      }).pipe(Effect.flatMap(decodeIntegrationShardPlan));
      const shards = A.filter(
        CI_LANE_PARTITIONS,
        (partition) => partition.lane === "test-integration" && partition.shard !== undefined
      );
      expect(A.length(shards)).toBe(A.length(plan.shards));
      expect(A.map(shards, (partition) => partition.shard?.total)).toEqual(
        A.makeBy(A.length(shards), () => A.length(plan.shards))
      );
      expect(A.map(shards, (partition) => partition.shard?.index)).toEqual(A.range(1, A.length(shards)));
      expect(A.map(shards, (partition) => partition.weightSeconds)).toEqual(A.map(plan.shardSeconds, Math.round));
      // Worst measured file seconds per shard stay within the sharded file budget, so the slowest
      // observed hosted runner still finishes the partition under the ten-minute job target.
      for (const seconds of plan.shardSeconds) {
        expect(seconds).toBeLessThanOrEqual(CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS);
      }
    })
  );

  it("plans an integration shard through Turbo and the catch-all through the root integration lane", () => {
    const options = CiLaneRunOptions.make({ ...baseOptions, affected: true, summarize: true });
    const sharded = ciLanePartitionStepForTesting(
      CiLanePartitionStepRequest.make({
        repoRoot: REPO_ROOT,
        laneId: "test-integration",
        partition: "lps-int-3",
        packages: ["@beep/law-practice-server"],
        options,
        shard: CiLanePartitionShard.make({ index: 3, total: 19 }),
      })
    );
    expect(sharded.command).toBe("bunx");
    expect([...sharded.args]).toContain("@beep/law-practice-server#test:integration:parallel");
    expect([...sharded.args]).toContain("--filter=@beep/law-practice-server");
    expect([...sharded.args]).toContain("--shard=3/19");
    expect([...sharded.args]).toContain("--maxWorkers=1");
    expect([...sharded.args]).not.toContain("--force");

    const rest = ciLanePartitionStepForTesting(
      CiLanePartitionStepRequest.make({
        repoRoot: REPO_ROOT,
        laneId: "test-integration",
        partition: "int-rest",
        packages: [],
        options,
      })
    );
    expect(rest.command).toBe("bun");
    expect([...rest.args]).toEqual([
      "run",
      "test",
      "--",
      "--integration",
      "--filter=!@beep/law-practice-server",
      "--affected",
      "--summarize",
    ]);
    expect(rest.env).toEqual({ TURBO_SCM_BASE: options.base });
  });

  it("rejects a shard whose index exceeds its total or whose total is below two", () => {
    assertNone(decodeShard({ index: 3, total: 2 }));
    assertNone(decodeShard({ index: 1, total: 1 }));
    assertNone(decodeShard({ index: 0, total: 2 }));
    assertSome(decodeShard({ index: 2, total: 2 }), CiLanePartitionShard.make({ index: 2, total: 2 }));
  });

  it.effect("proves a complete two-shard set and fails closed on every shard-set violation", () =>
    Effect.gen(function* () {
      const packageName = "@beep/repo-cli";
      const shardBin = (id: "lint-a" | "lint-b" | "unit-a" | "unit-b", index: number, total: number) =>
        CiLanePartition.make({
          id,
          lane: "lint",
          packages: [packageName],
          weightSeconds: 1,
          shard: CiLanePartitionShard.make({ index, total }),
        });
      const prove = (table: ReadonlyArray<CiLanePartition>) =>
        proveCiLanePartition("lint", "lint-a", [packageName], [packageName], [packageName], false, table);

      const valid = yield* prove([shardBin("lint-a", 1, 2), shardBin("lint-b", 2, 2)]);
      expect(valid.packages).toEqual([packageName]);
      expect(valid.shard).toEqual(CiLanePartitionShard.make({ index: 1, total: 2 }));

      const missingIndex = yield* prove([shardBin("lint-a", 1, 3), shardBin("lint-b", 3, 3)]).pipe(Effect.flip);
      expect(missingIndex.reason).toBe("shard-set-incomplete");
      expect(missingIndex.message).toContain("expected exactly 1..3");

      const mismatchedTotal = yield* prove([shardBin("lint-a", 1, 2), shardBin("lint-b", 2, 3)]).pipe(Effect.flip);
      expect(mismatchedTotal.reason).toBe("shard-total-mismatch");
      expect(mismatchedTotal.message).toContain("different totals (2, 3)");

      const duplicateIndex = yield* prove([shardBin("lint-a", 1, 2), shardBin("lint-b", 1, 2)]).pipe(Effect.flip);
      expect(duplicateIndex.reason).toBe("shard-index-duplicate");
      expect(duplicateIndex.message).toContain("shard index 1 more than once");

      const alsoUnsharded = yield* prove([
        shardBin("lint-a", 1, 2),
        shardBin("lint-b", 2, 2),
        CiLanePartition.make({ id: "unit-a", lane: "lint", packages: [packageName], weightSeconds: 1 }),
      ]).pipe(Effect.flip);
      expect(alsoUnsharded.reason).toBe("sharded-package-unsharded");
      expect(alsoUnsharded.message).toContain("unsharded in others (lint-a, lint-b, unit-a)");

      const oversized = yield* prove([
        CiLanePartition.make({ ...shardBin("lint-a", 1, 2), packages: [packageName, "@beep/types"] }),
        shardBin("lint-b", 2, 2),
      ]).pipe(Effect.flip);
      expect(oversized.reason).toBe("sharded-bin-package-count");
      expect(oversized.message).toContain("names 2 packages");
    })
  );

  it("forwards the Vitest shard as a Turbo pass-through only for sharded partitions", () => {
    const options = CiLaneRunOptions.make({ ...baseOptions, partition: "repo-cli-1", summarize: true });
    const repoCli1 = O.getOrThrow(A.findFirst(CI_LANE_PARTITIONS, (partition) => partition.id === "repo-cli-1"));
    const sharded = ciLanePartitionArgsForTesting("test-unit", repoCli1.packages, options, repoCli1.shard);
    const shardedShape = [
      "--only",
      "--concurrency=2",
      "--filter=!./apps/labs/**",
      "--filter=@beep/repo-cli",
      "--summarize",
      "--",
      "--shard=1/9",
    ];
    expect([...sharded.execution]).toEqual([
      "turbo",
      "run",
      "@beep/repo-cli#test",
      ...expectedTurboCacheArgs(shardedShape),
      ...shardedShape,
    ]);
    expect(A.takeRight(sharded.execution, 2)).toEqual(["--", "--shard=1/9"]);
    expect(sharded.selection).not.toContain("--shard=1/9");

    const unitA = O.getOrThrow(A.findFirst(CI_LANE_PARTITIONS, (partition) => partition.id === "unit-a"));
    const unsharded = ciLanePartitionArgsForTesting(
      "test-unit",
      A.take(unitA.packages, 1),
      CiLaneRunOptions.make({ ...baseOptions, partition: "unit-a" }),
      unitA.shard
    );
    expect(unsharded.execution).not.toContain("--");
    expect(A.some(unsharded.execution, Str.startsWith("--shard="))).toBe(false);
  });

  it.effect("rejects a partition that belongs to another lane", () =>
    Effect.gen(function* () {
      const error = yield* proveCiLanePartition("lint", "unit-a", [], [], [], false).pipe(Effect.flip);
      expect(error._tag).toBe("CiLanePartitionError");
      expect(error.reason).toBe("invalid-assignment");
      expect(error.message).toContain("CiLanePartitions.ts");
      expect(error.message).toContain("Regenerate the deterministic LPT placement");
    })
  );

  it("places an unlisted package by name without moving any listed or earlier-placed package", () => {
    const lintPartitions = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint");
    const listed = A.flatMap(lintPartitions, (partition) => partition.packages);
    const first = ciLaneDefaultPlacements(lintPartitions, [...listed, "@beep/new-one"]);
    const second = ciLaneDefaultPlacements(lintPartitions, [...listed, "@beep/new-two", "@beep/new-one", "@beep/a"]);

    expect(A.map(first, (placement) => placement.packageName)).toEqual(["@beep/new-one"]);
    expect(A.map(second, (placement) => placement.packageName)).toEqual(["@beep/a", "@beep/new-one", "@beep/new-two"]);
    expect(A.findFirst(second, (placement) => placement.packageName === "@beep/new-one")).toEqual(A.head(first));
    expect(A.every(second, (placement) => placement.partition === "lint-a" || placement.partition === "lint-b")).toBe(
      true
    );

    const effective = withCiLaneDefaultPlacements(lintPartitions, [...listed, "@beep/new-one"]);
    expect(
      A.zipWith(effective, lintPartitions, (after, before) => A.take(after.packages, A.length(before.packages)))
    ).toEqual(A.map(lintPartitions, (partition) => partition.packages));
    expect(A.length(A.flatMap(effective, (partition) => partition.packages))).toBe(A.length(listed) + 1);
    expect(withCiLaneDefaultPlacements(lintPartitions, listed)).toBe(lintPartitions);
  });

  it("logs default placements only when an executable package is absent from the table", () => {
    const listed = lanePackages("lint");
    expect(ciLaneDefaultPlacementLinesForTesting("lint", listed)).toEqual([]);

    const lines = ciLaneDefaultPlacementLinesForTesting("lint", [...listed, "@beep/new-two", "@beep/new-one"]);
    expect(A.length(lines)).toBe(1);
    const line = firstOf(lines);
    expect(line).toContain(
      "[ci] lint default placements (absent from packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts): "
    );
    expect(line).toMatch(/@beep\/new-one -> lint-[ab], @beep\/new-two -> lint-[ab]\.$/u);
    expect(ciLaneDefaultPlacementLinesForTesting(lanePackages("test-unit"))("test-unit")).toEqual([]);
  });

  it("never defaults a package into a sharded bin", () => {
    const unitPartitions = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "test-unit");
    const names = A.makeBy(64, (index) => `@beep/generated-${index}`);
    const partitions = A.dedupe(
      A.map(ciLaneDefaultPlacements(unitPartitions, names), (placement) => placement.partition)
    );

    expect(A.sort(partitions, Order.String)).toEqual([
      "unit-a",
      "unit-b",
      "unit-c",
      "unit-d",
      "unit-e",
      "unit-f",
      "unit-g",
    ]);
    expect(
      ciLaneDefaultPlacements(
        A.filter(unitPartitions, (partition) => partition.shard !== undefined),
        names
      )
    ).toEqual([]);
  });

  it.effect("proves a workspace package the table does not name in exactly one partition", () =>
    Effect.gen(function* () {
      const lintPartitions = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint");
      const taskPackages = [...A.flatMap(lintPartitions, (partition) => partition.packages), "@beep/fresh-package"];
      const proofs = yield* Effect.forEach(["lint-a", "lint-b"] as const, (partition) =>
        proveCiLanePartition("lint", partition, taskPackages, taskPackages, taskPackages, false)
      );
      const holders = A.filter(proofs, (proof) => A.contains(proof.packages, "@beep/fresh-package"));

      expect(A.length(holders)).toBe(1);
      expect(A.length(A.flatMap(proofs, (proof) => proof.packages))).toBe(A.length(taskPackages));
    })
  );

  it.effect("fails closed for an unplaceable package and a duplicate assignment", () =>
    Effect.gen(function* () {
      const lintPartitions = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint");
      const allLintPackages = A.flatMap(lintPartitions, (partition) => partition.packages);
      const lintA = O.getOrThrow(A.findFirst(lintPartitions, (partition) => partition.id === "lint-a"));
      const lintB = O.getOrThrow(A.findFirst(lintPartitions, (partition) => partition.id === "lint-b"));
      const firstLintA = O.getOrThrow(A.head(lintA.packages));
      // A lane whose every bin is sharded has no default bin, so an unlisted
      // package stays unplaced and the coverage proof still fails closed.
      const missingTable = [
        CiLanePartition.make({
          id: "lint-a",
          lane: "lint",
          packages: ["@beep/repo-cli"],
          weightSeconds: 1,
          shard: CiLanePartitionShard.make({ index: 1, total: 2 }),
        }),
        CiLanePartition.make({
          id: "lint-b",
          lane: "lint",
          packages: ["@beep/repo-cli"],
          weightSeconds: 1,
          shard: CiLanePartitionShard.make({ index: 2, total: 2 }),
        }),
      ];
      const duplicateTable = A.map(CI_LANE_PARTITIONS, (partition) =>
        partition.id === "lint-b"
          ? CiLanePartition.make({ ...partition, packages: A.prepend(partition.packages, firstLintA) })
          : partition
      );

      const missing = yield* proveCiLanePartition(
        "lint",
        "lint-a",
        ["@beep/repo-cli", "@beep/unplaced"],
        ["@beep/repo-cli", "@beep/unplaced"],
        ["@beep/repo-cli", "@beep/unplaced"],
        false,
        missingTable
      ).pipe(Effect.flip);
      expect(missing.reason).toBe("missing-package");
      expect(missing.message).toContain("@beep/unplaced");

      const duplicate = yield* proveCiLanePartition(
        "lint",
        "lint-b",
        allLintPackages,
        allLintPackages,
        allLintPackages,
        false,
        duplicateTable
      ).pipe(Effect.flip);
      expect(duplicate.reason).toBe("duplicate-package");
      expect(duplicate.message).toContain(firstLintA);
      expect(lintB.packages).not.toContain(firstLintA);
    })
  );

  it.effect("fails closed for absent, stale, and unknown-selected partition entries", () =>
    Effect.gen(function* () {
      const packageName = "@beep/repo-cli";
      const table = [
        CiLanePartition.make({
          id: "lint-a",
          lane: "lint",
          packages: [packageName],
          weightSeconds: 1,
        }),
      ];

      const absent = yield* proveCiLanePartition("lint", "lint-a", [], [], [], false, []).pipe(Effect.flip);
      expect(absent.reason).toBe("invalid-assignment");
      expect(absent.message).toContain("absent from the committed table");

      const staleWorkspace = yield* proveCiLanePartition("lint", "lint-a", [], [], [], false, table).pipe(Effect.flip);
      expect(staleWorkspace.reason).toBe("stale-package");
      expect(staleWorkspace.message).toContain("absent from the workspace");

      const staleTask = yield* proveCiLanePartition("lint", "lint-a", [packageName], [], [], false, table).pipe(
        Effect.flip
      );
      expect(staleTask.reason).toBe("stale-package");
      expect(staleTask.message).toContain("has no executable lint task");

      const unknownSelected = yield* proveCiLanePartition(
        "lint",
        "lint-a",
        [packageName],
        [packageName],
        ["@beep/not-assigned"],
        false,
        table
      ).pipe(Effect.flip);
      expect(unknownSelected.reason).toBe("unknown-selected-task");
      expect(unknownSelected.message).toContain("@beep/not-assigned");

      const duplicatePartitionTable = [
        ...table,
        CiLanePartition.make({
          id: "lint-a",
          lane: "lint",
          packages: [],
          weightSeconds: 1,
        }),
      ];
      const duplicatePartition = yield* proveCiLanePartition(
        "lint",
        "lint-a",
        [packageName],
        [packageName],
        [packageName],
        false,
        duplicatePartitionTable
      ).pipe(Effect.flip);
      expect(duplicatePartition.reason).toBe("duplicate-partition");
      expect(duplicatePartition.message).toContain("Partition id lint-a appears more than once");
    })
  );

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("rejects every invalid partition option shape before repository discovery", () =>
      Effect.gen(function* () {
        const invalidLane = yield* runCiLane(
          "build",
          CiLaneRunOptions.make({ ...baseOptions, partition: "lint-a" })
        ).pipe(Effect.flip);
        expect(invalidLane._tag).toBe("CiLanePartitionError");
        expect(invalidLane.message).toContain("Lane build does not support --partition");

        const combinedFilter = yield* runCiLane(
          "lint",
          CiLaneRunOptions.make({ ...baseOptions, filter: "@beep/repo-cli", partition: "lint-a" })
        ).pipe(Effect.flip);
        expect(combinedFilter._tag).toBe("CiLanePartitionError");
        expect(combinedFilter.message).toContain("--filter cannot be combined with --partition");

        const wrongLane = yield* runCiLane("lint", CiLaneRunOptions.make({ ...baseOptions, partition: "unit-a" })).pipe(
          Effect.flip
        );
        expect(wrongLane._tag).toBe("CiLanePartitionError");
        expect(wrongLane.message).toContain("Partition unit-a does not belong to lane lint");

        const dryRunWithoutPartition = yield* runCiLane(
          "lint",
          CiLaneRunOptions.make({ ...baseOptions, dryRun: true })
        ).pipe(Effect.flip);
        expect(dryRunWithoutPartition._tag).toBe("CiLanePartitionError");
        expect(dryRunWithoutPartition.message).toContain("--dry-run requires --partition");

        const forceWithoutPartition = yield* runCiLane(
          "lint",
          CiLaneRunOptions.make({ ...baseOptions, force: true })
        ).pipe(Effect.flip);
        expect(forceWithoutPartition._tag).toBe("CiLanePartitionError");
        expect(forceWithoutPartition.message).toContain("--force requires --partition");
      })
    );
  });

  it("keeps affected selection shaping out of the exact package execution", () => {
    const options = CiLaneRunOptions.make({
      ...prShapeOptions,
      partition: "lint-a",
      force: true,
    });
    const args = ciLanePartitionArgsForTesting("lint", ["@beep/repo-cli", "@beep/types"], options);
    const selectionShape = ["--affected", "--filter=!./apps/labs/**", "--only", "--dry-run=json"];
    const executionShape = [
      "--only",
      "--concurrency=2",
      "--filter=!./apps/labs/**",
      "--filter=@beep/repo-cli",
      "--filter=@beep/types",
      "--force",
      "--summarize",
    ];

    expect([...args.selection]).toEqual([
      "turbo",
      "run",
      "lint",
      ...expectedTurboCacheArgs(selectionShape),
      ...selectionShape,
    ]);
    expect([...args.execution]).toEqual([
      "turbo",
      "run",
      "@beep/repo-cli#lint",
      "@beep/types#lint",
      ...expectedTurboCacheArgs(executionShape),
      ...executionShape,
    ]);
    expect(args.execution).not.toContain("--affected");
    expect(args.execution).not.toContain("--base");
  });

  it.layer(LiveRepoLayer, { timeout: "10 seconds" })((it) => {
    it.effect("makes the live non-labs task inventory a complete disjoint union", () =>
      Effect.gen(function* () {
        const repoRoot = yield* findRepoRoot();
        const path = yield* Path.Path;
        const workspaces = yield* workspaceManifests(repoRoot);
        const workspaceEntries = A.fromIterable(HashMap.entries(workspaces));
        const workspacePackageNames = A.map(workspaceEntries, ([name]) => name);

        for (const [laneId, task, partition] of [
          ["lint", "lint", "lint-a"],
          ["test-unit", "test", "repo-cli-1"],
        ] as const) {
          const taskPackageNames = pipe(
            workspaceEntries,
            A.filter(([, workspace]) => {
              const relativeDir = Str.replace(/\\/g, "/")(path.relative(repoRoot, workspace.dir));
              return !isLabsWorkspaceDir(relativeDir) && HashMap.has(workspace.manifest.scripts, task);
            }),
            A.map(([name]) => name),
            A.sort(Order.String)
          );
          const proof = yield* proveCiLanePartition(
            laneId,
            partition,
            workspacePackageNames,
            taskPackageNames,
            taskPackageNames,
            false
          );
          // Default placements cover any workspace the curated table does not
          // name yet, so this union needs no edit when a package is created.
          const lanePartitions = withCiLaneDefaultPlacements(
            A.filter(CI_LANE_PARTITIONS, (entry) => entry.lane === laneId),
            taskPackageNames
          );
          const unshardedAssignments = pipe(
            lanePartitions,
            A.filter((entry) => entry.shard === undefined),
            A.flatMap((entry) => entry.packages)
          );
          const shardedAssignments = pipe(
            lanePartitions,
            A.filter((entry) => entry.shard !== undefined),
            A.flatMap((entry) => entry.packages),
            A.dedupe
          );
          const assignments = A.appendAll(unshardedAssignments, shardedAssignments);

          expect(A.length(A.dedupe(assignments))).toBe(A.length(assignments));
          expect(A.sort(assignments, Order.String)).toEqual(taskPackageNames);
          expect(proof.selectedTaskCount).toBe(A.length(taskPackageNames));
        }
      })
    );
  });

  // `!cancelled()` (not `always()`): a superseded run must not start aggregators
  // that can only fail; a failed shard still fails its aggregator.
  it.effect("keeps literal required aggregators and fails closed on classification and shard outcomes", () =>
    Effect.gen(function* () {
      const workflowText = yield* Effect.tryPromise({
        try: () => Bun.file(checkWorkflowUrl).text(),
        catch: (cause) => CiLaneTestOperationError.make({ cause }),
      });
      const workflow = parseWorkflowYaml(workflowText);
      expect(workflowText).not.toMatch(/ci lane (?:lint|test-unit)[^\n]*--force/u);
      expect(yamlAt(workflow, ["jobs", "lint", "name"])).toBe("Lint");
      expect(yamlAt(workflow, ["jobs", "lint", "if"])).toBe("${{ !cancelled() }}");
      expect(yamlAt(workflow, ["jobs", "test-unit", "name"])).toBe("Test Unit");
      expect(yamlAt(workflow, ["jobs", "test-unit", "if"])).toBe("${{ !cancelled() }}");
      expect(yamlAt(workflow, ["jobs", "lint-shard", "strategy", "fail-fast"])).toBe(false);
      expect(yamlAt(workflow, ["jobs", "test-unit-shard", "strategy", "fail-fast"])).toBe(false);
      expect(yamlAt(workflow, ["jobs", "test-integration-shard", "strategy", "fail-fast"])).toBe(false);

      // The integration aggregate reports the exact context the heavy pool used to own.
      expect(yamlAt(workflow, ["jobs", "test-integration", "name"])).toBe("Heavy / Test Integration");
      expect(yamlAt(workflow, ["jobs", "test-integration", "if"])).toBe("${{ !cancelled() }}");
      expect(yamlAt(workflow, ["jobs", "test-integration", "needs"])).toEqual([
        "admission",
        "change-profile",
        "test-plan",
        "test-integration-shard",
      ]);
      const integrationGate = yamlAt(workflow, ["jobs", "test-integration", "steps", 0, "run"]);
      assertTrue(isWorkflowScript(integrationGate));
      expect(integrationGate).toContain('[[ "${{ needs.admission.result }}" == "success" ]]');
      expect(integrationGate).toContain('[[ "${{ needs.change-profile.result }}" == "success" ]]');
      expect(integrationGate).toContain('[[ "${{ needs.test-plan.result }}" == "success" ]]');
      expect(integrationGate).toContain(
        'case "${{ needs.change-profile.outputs.docs_only }}:${planned}:${{ needs.test-integration-shard.result }}" in'
      );
      expect(integrationGate).toContain("true:*:skipped)");
      expect(integrationGate).toContain("false:some:success)");
      // The catch-all partition is always planned, so an empty integration plan never passes as a skip.
      expect(integrationGate).not.toContain("false:none:skipped)");
      expect(integrationGate).toContain('*) echo "Unexpected classification, plan or partition result"; exit 1');

      // Lint lists exactly its table's partitions, in table order.
      const lanePartitionIds = (laneId: PartitionedCiLane) =>
        pipe(
          CI_LANE_PARTITIONS,
          A.filter((partition) => partition.lane === laneId),
          A.map((partition) => partition.id)
        );
      expect(yamlAt(workflow, ["jobs", "lint-shard", "strategy", "matrix", "partition"])).toEqual(
        lanePartitionIds("lint")
      );

      // The test lanes allocate what Test Plan publishes. Its full lists (what a push runs and the
      // bound every pull-request plan is checked against) are exactly the table's partitions, in
      // table order, and each partition is handed the plan to prove it.
      for (const { job, laneId, all, output, aggregate } of [
        {
          job: "test-unit-shard",
          laneId: "test-unit",
          all: "ALL_TEST_UNIT_PARTITIONS",
          output: "test_unit",
          aggregate: "test-unit",
        },
        {
          job: "test-integration-shard",
          laneId: "test-integration",
          all: "ALL_TEST_INTEGRATION_PARTITIONS",
          output: "test_integration",
          aggregate: "test-integration",
        },
      ] as const) {
        const fullPlan = yamlAt(workflow, ["jobs", "test-plan", "env", all]);
        assertTrue(isWorkflowScript(fullPlan));
        // The list is JSON, which the workflow YAML reader parses as a flow sequence.
        expect(parseWorkflowYaml(fullPlan)).toEqual(lanePartitionIds(laneId));
        expect(yamlAt(workflow, ["jobs", job, "strategy", "matrix", "partition"])).toBe(
          `\${{ fromJSON(needs.test-plan.outputs.${output}) }}`
        );
        expect(yamlAt(workflow, ["jobs", job, "needs"])).toEqual(["change-profile", "test-plan"]);
        expect(yamlAt(workflow, ["jobs", job, "if"])).toBe(
          `needs.change-profile.outputs.docs_only != 'true' && needs.test-plan.outputs.${output} != '[]'`
        );
        expect(yamlAt(workflow, ["jobs", "test-plan", "outputs", output])).toBe(`\${{ steps.plan.outputs.${output} }}`);
        expect(workflowText).toContain(
          `ci lane ${laneId} --partition "\${{ matrix.partition }}" --planned-partitions "$PLANNED_PARTITIONS"`
        );
        expect(yamlAt(workflow, ["jobs", aggregate, "steps", 0, "env", "PLANNED_PARTITIONS"])).toBe(
          `\${{ needs.test-plan.outputs.${output} }}`
        );
      }
      // The plan waits for nothing, classifies the diff itself and plans with the partitions' own shape.
      expect(yamlAt(workflow, ["jobs", "test-plan", "needs"])).toBeUndefined();
      expect(yamlAt(workflow, ["jobs", "test-plan", "if"])).toBeUndefined();
      expect(workflowText).toContain(
        'bun run beep ci lane test-unit --plan-partitions --affected --base "$BEEP_COVERAGE_BASE_SHA"'
      );
      expect(workflowText).toContain(
        'bun run beep ci lane test-integration --plan-partitions --affected --base "origin/${GITHUB_BASE_REF:-main}"'
      );

      const lintGate = yamlAt(workflow, ["jobs", "lint", "steps", 0, "run"]);
      assertTrue(isWorkflowScript(lintGate));
      expect(yamlAt(workflow, ["jobs", "lint", "needs"])).toEqual(["change-profile", "lint-shard"]);
      expect(lintGate).toContain('[[ "${{ needs.change-profile.result }}" == "success" ]]');
      expect(lintGate).toContain(
        'case "${{ needs.change-profile.outputs.docs_only }}:${{ needs.lint-shard.result }}" in'
      );
      expect(lintGate).toContain("true:skipped)");
      expect(lintGate).toContain("false:success)");
      expect(lintGate).toContain('*) echo "Unexpected classification or shard result"; exit 1');

      const unitGate = yamlAt(workflow, ["jobs", "test-unit", "steps", 0, "run"]);
      assertTrue(isWorkflowScript(unitGate));
      expect(yamlAt(workflow, ["jobs", "test-unit", "needs"])).toEqual([
        "change-profile",
        "test-plan",
        "test-unit-shard",
      ]);
      expect(unitGate).toContain('[[ "${{ needs.change-profile.result }}" == "success" ]]');
      expect(unitGate).toContain('[[ "${{ needs.test-plan.result }}" == "success" ]]');
      expect(unitGate).toContain(
        'case "${{ needs.change-profile.outputs.docs_only }}:${planned}:${{ needs.test-unit-shard.result }}" in'
      );
      expect(unitGate).toContain("true:*:skipped)");
      expect(unitGate).toContain("false:none:skipped)");
      expect(unitGate).toContain("false:some:success)");
      expect(unitGate).toContain('*) echo "Unexpected classification, plan or shard result"; exit 1');

      // Property Laws keeps one context over four slices: the two Vitest shards of repo-cli's sweep
      // and two directory slices whose Turbo filters are complements, so every package and file runs
      // in exactly one of them.
      expect(yamlAt(workflow, ["jobs", "property-laws", "name"])).toBe("Property Laws");
      expect(yamlAt(workflow, ["jobs", "property-laws", "if"])).toBe("${{ !cancelled() }}");
      expect(yamlAt(workflow, ["jobs", "property-laws", "needs"])).toEqual(["change-profile", "property-laws-shard"]);
      expect(yamlAt(workflow, ["jobs", "property-laws-shard", "strategy", "fail-fast"])).toBe(false);
      expect(yamlAt(workflow, ["jobs", "property-laws-shard", "strategy", "matrix", "partition"])).toEqual([
        "repo-cli-1",
        "repo-cli-2",
        "foundation-drivers",
        "rest",
      ]);
      // A test lane: created with the other test shards, never behind Heavy Admission.
      expect(yamlAt(workflow, ["jobs", "property-laws-shard", "needs"])).toEqual(["change-profile", "test-plan"]);
      expect(workflowText).toContain('repo-cli-1) shape_args+=(--filter "@beep/repo-cli" --shard 1/2) ;;');
      expect(workflowText).toContain('repo-cli-2) shape_args+=(--filter "@beep/repo-cli" --shard 2/2) ;;');
      expect(workflowText).toContain(
        'foundation-drivers) shape_args+=(--filter "./packages/foundation/**,./packages/drivers/**") ;;'
      );
      expect(workflowText).toContain(
        'rest) shape_args+=(--filter "!./packages/foundation/**,!./packages/drivers/**,!@beep/repo-cli") ;;'
      );
      const propertyGate = yamlAt(workflow, ["jobs", "property-laws", "steps", 0, "run"]);
      assertTrue(isWorkflowScript(propertyGate));
      expect(propertyGate).toContain('[[ "${{ needs.change-profile.result }}" == "success" ]]');
      expect(propertyGate).toContain(
        'case "${{ needs.change-profile.outputs.docs_only }}:${{ needs.property-laws-shard.result }}" in'
      );
      expect(propertyGate).toContain("true:skipped)");
      expect(propertyGate).toContain("false:success)");
      expect(propertyGate).toContain('*) echo "Unexpected classification or slice result"; exit 1');
    })
  );
});

describe("partitioned CI lane execution", () => {
  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("proves and executes a full lint partition with exact package tasks", () =>
      Effect.gen(function* () {
        const selectedPackages = yield* liveTaskPackages("lint");
        const firstPackage = firstOf(partitionPackages("lint-a"));
        const nonexistentPackage = firstPackage;
        const dryRunOutput = encodeJson({
          tasks: [
            ...A.map(selectedPackages, (packageName) => ({
              command: "bun run lint",
              package: packageName,
              task: "lint",
              taskId: `${packageName}#lint`,
            })),
            {
              command: "bun run lint",
              package: firstPackage,
              task: "lint",
              taskId: `${firstPackage}#lint`,
            },
            {
              command: "<NONEXISTENT>",
              package: nonexistentPackage,
              task: "lint",
              taskId: `${nonexistentPackage}#lint`,
            },
            {
              command: "bun run test",
              package: firstPackage,
              task: "test",
              taskId: `${firstPackage}#test`,
            },
          ],
        });

        yield* withPartitionShim({ dryRunOutput }, ({ commandLogPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* runCiLane(
              "lint",
              CiLaneRunOptions.make({
                ...baseOptions,
                force: true,
                partition: "lint-a",
                summarize: true,
              })
            );

            const readFileString2 = yield* fs.readFileString(commandLogPath);
            const commands = pipe(readFileString2, Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(2);
            const selection = firstOf(commands);
            const execution = lastOf(commands);
            expect(selection).toContain("turbo run lint");
            expect(selection).toContain("--filter=!./apps/labs/** --only --dry-run=json");
            expect(selection).not.toContain("--affected");
            expect(execution).toContain(`cache execute -- run ${firstPackage}#lint`);
            expect(execution).toContain("--no-env-file");
            expect(execution).toContain("--only --concurrency=2 --filter=!./apps/labs/**");
            expect(execution).toContain(`--filter=${firstPackage}`);
            expect(execution).toContain("--force --summarize");
            expect(execution).not.toContain("--affected");

            const logLines3 = yield* TestConsole.logLines;
            const output = A.join(A.filter(logLines3, P.isString), "\n");
            const taskCount = A.length(selectedPackages);
            expect(output).toContain(
              `lint partition union proved: ${taskCount} executable tasks, ${taskCount} selected, ${effectivePartitionSize("lint", "lint-a", selectedPackages)} in lint-a`
            );
          })
        );
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("rejects partial unscoped selections but allows affected selections", () =>
      Effect.gen(function* () {
        const selectedPackage = firstOf(partitionPackages("lint-a"));
        const dryRunOutput = turboDryRunOutput("lint", [selectedPackage]);
        const incomplete = yield* withPartitionShim({ dryRunOutput }, () =>
          runCiLane("lint", CiLaneRunOptions.make({ ...baseOptions, partition: "lint-a" })).pipe(Effect.flip)
        );
        expect(incomplete._tag).toBe("CiLanePartitionError");
        if (incomplete._tag === "CiLanePartitionError") {
          expect(incomplete.reason).toBe("incomplete-selection");
          expect(incomplete.message).toContain("Turbo's unscoped lint dry run omitted executable packages");
        }

        yield* withPartitionShim({ dryRunOutput }, () =>
          runCiLane(
            "lint",
            CiLaneRunOptions.make({ ...baseOptions, affected: true, dryRun: true, partition: "lint-a" })
          )
        );
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("skips execution when an affected unit selection misses the requested partition", () =>
      Effect.gen(function* () {
        const selectedPackage = firstOf(partitionPackages("unit-a"));
        yield* withPartitionShim({ dryRunOutput: turboDryRunOutput("test", [selectedPackage]) }, ({ commandLogPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* runCiLane(
              "test-unit",
              CiLaneRunOptions.make({
                ...baseOptions,
                affected: true,
                partition: "repo-cli-1",
              })
            );

            const readFileString4 = yield* fs.readFileString(commandLogPath);
            const commands = pipe(readFileString4, Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(1);
            expect(firstOf(commands)).toContain("turbo run test");
            expect(firstOf(commands)).toContain("--affected --filter=!./apps/labs/** --only --dry-run=json");

            const logLines5 = yield* TestConsole.logLines;
            const output = A.join(A.filter(logLines5, P.isString), "\n");
            const expectation = expect(output);
            const liveTaskPackages1 = yield* liveTaskPackages("test");
            expectation.toContain(
              `test-unit partition union proved: ${A.length(liveTaskPackages1)} executable tasks, 1 selected, 0 in repo-cli-1`
            );
            expect(output).toContain("test-unit repo-cli-1: partition has no selected tasks (skipped)");
          })
        );
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("completes a successful partition dry run without execution", () =>
      Effect.flatMap(liveTaskPackages("test"), (testPackages) =>
        withPartitionShim({ dryRunOutput: turboDryRunOutput("test", testPackages) }, ({ commandLogPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* runCiLane(
              "test-unit",
              CiLaneRunOptions.make({ ...baseOptions, dryRun: true, partition: "repo-cli-1" })
            );

            const readFileString6 = yield* fs.readFileString(commandLogPath);
            const commands = pipe(readFileString6, Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(1);
            const logLines7 = yield* TestConsole.logLines;
            const output = A.join(A.filter(logLines7, P.isString), "\n");
            expect(output).toContain("test-unit repo-cli-1: planned execution: bunx turbo run @beep/repo-cli#test");
            expect(output).toContain("--filter=@beep/repo-cli -- --shard=1/9");
            expect(output).toContain("test-unit repo-cli-1: dry-run proof complete; no tasks executed");
          })
        )
      )
    );
  });

  it("plans exactly the partitions that carry a selected task", () => {
    const idsOf = (laneId: PartitionedCiLane, shardedOnly: boolean) =>
      pipe(
        CI_LANE_PARTITIONS,
        A.filter((partition) => partition.lane === laneId && (!shardedOnly || partition.shard !== undefined)),
        A.map((partition) => partition.id)
      );
    const unitPackage = firstOf(partitionPackages("unit-a"));
    const unitPackages = lanePackages("test-unit");

    expect(plannedCiLanePartitions("test-unit", unitPackages, [])).toEqual([]);
    expect(plannedCiLanePartitions("test-unit", unitPackages, [unitPackage])).toEqual(["unit-a"]);
    // A sharded package needs every one of its slices.
    expect(plannedCiLanePartitions("test-unit", unitPackages, ["@beep/repo-cli"])).toEqual(
      A.filter(idsOf("test-unit", true), Str.startsWith("repo-cli-"))
    );
    expect(plannedCiLanePartitions("test-unit", unitPackages, unitPackages)).toEqual(idsOf("test-unit", false));
    expect(pipe("test-unit", plannedCiLanePartitions(unitPackages, [unitPackage]))).toEqual(["unit-a"]);

    // The integration catch-all runs Turbo's own affected scope, so it is planned even for an empty selection.
    expect(plannedCiLanePartitions("test-integration", ["@beep/law-practice-server"], [])).toEqual(["int-rest"]);
    expect(
      plannedCiLanePartitions("test-integration", ["@beep/law-practice-server"], ["@beep/law-practice-server"])
    ).toEqual(idsOf("test-integration", false));

    // A package the table does not name is planned into its default bin, the bin its partition proves.
    const unlisted = "@beep/unlisted-plan-fixture";
    const defaultBin = firstOf(
      ciLaneDefaultPlacements(
        A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "test-unit"),
        [unlisted]
      )
    ).partition;
    expect(plannedCiLanePartitions("test-unit", A.append(unitPackages, unlisted), [unlisted])).toEqual([defaultBin]);
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("plans a lane from one selection dry run and executes nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { commands, planned } = yield* withPartitionShim(
          { dryRunOutput: turboDryRunOutput("test:integration:parallel", ["@beep/law-practice-server"]) },
          ({ commandLogPath }) =>
            Effect.gen(function* () {
              const planned = yield* planCiLanePartitions(
                "test-integration",
                CiLaneRunOptions.make({ ...baseOptions, affected: true })
              );
              const commandLog = yield* fs.readFileString(commandLogPath);
              return { commands: pipe(commandLog, Str.split("\n"), A.filter(Str.isNonEmpty)), planned };
            })
        );
        expect(planned).toEqual(
          pipe(
            CI_LANE_PARTITIONS,
            A.filter((partition) => partition.lane === "test-integration"),
            A.map((partition) => partition.id)
          )
        );
        expect(commands).toHaveLength(1);
        expect(firstOf(commands)).toContain("turbo run test:integration:parallel");
        expect(firstOf(commands)).toContain("--affected --filter=!./apps/labs/** --only --dry-run=json");
        const planLogLines = yield* TestConsole.logLines;
        const output = A.join(A.filter(planLogLines, P.isString), "\n");
        expect(output).toContain(`test-integration plan: ${A.length(planned)} partition(s) for 1 selected task(s)`);
      })
    );

    it.effect("refuses to plan an unpartitioned lane or a single partition", () =>
      Effect.gen(function* () {
        const unpartitioned = yield* planCiLanePartitions("property", baseOptions).pipe(Effect.flip);
        expect(unpartitioned._tag).toBe("CiLanePartitionError");
        expect(unpartitioned.message).toContain("Lane property has no partitions to plan");

        const single = yield* planCiLanePartitions(
          "lint",
          CiLaneRunOptions.make({ ...baseOptions, partition: "lint-a" })
        ).pipe(Effect.flip);
        expect(single._tag).toBe("CiLanePartitionError");
        expect(single.message).toContain("cannot be combined with --partition or --filter");
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("fails a partition whose plan omits a partition with selected tasks", () =>
      Effect.gen(function* () {
        const selectedPackage = firstOf(partitionPackages("unit-b"));
        const dryRunOutput = turboDryRunOutput("test", [selectedPackage]);

        // unit-a was allocated and has nothing to run; unit-b has the selected task and no job.
        const omitted = yield* withPartitionShim({ dryRunOutput }, ({ commandLogPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const error = yield* runCiLane(
              "test-unit",
              CiLaneRunOptions.make({
                ...baseOptions,
                affected: true,
                partition: "unit-a",
                plannedPartitions: ["unit-a"],
              })
            ).pipe(Effect.flip);
            const commandLog = yield* fs.readFileString(commandLogPath);
            const commands = pipe(commandLog, Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(1);
            return error;
          })
        );
        expect(omitted._tag).toBe("CiLanePartitionError");
        if (omitted._tag === "CiLanePartitionError") {
          expect(omitted.reason).toBe("unplanned-partition");
          expect(omitted.partition).toBe("unit-a");
          expect(omitted.message).toContain("plan omits partition(s) with selected tasks: unit-b.");
        }

        yield* withPartitionShim({ dryRunOutput }, () =>
          runCiLane(
            "test-unit",
            CiLaneRunOptions.make({
              ...baseOptions,
              affected: true,
              partition: "unit-a",
              plannedPartitions: ["unit-a", "unit-b"],
            })
          )
        );
        const planLogLines = yield* TestConsole.logLines;
        const output = A.join(A.filter(planLogLines, P.isString), "\n");
        expect(output).toContain("test-unit plan proved: every partition with selected tasks was allocated.");
        expect(output).toContain("test-unit unit-a: partition has no selected tasks (skipped)");
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("surfaces Turbo dry-run exits and malformed dry-run JSON as typed failures", () =>
      Effect.gen(function* () {
        const nonZero = yield* withPartitionShim({ dryRunExitCode: 9, dryRunOutput: "{}" }, () =>
          runCiLane("lint", CiLaneRunOptions.make({ ...baseOptions, partition: "lint-a" })).pipe(Effect.flip)
        );
        expect(nonZero._tag).toBe("CiLanePartitionError");
        if (nonZero._tag === "CiLanePartitionError") {
          expect(nonZero.reason).toBe("turbo-dry-run");
          expect(nonZero.message).toContain("selection dry run exited with code 9");
        }

        const malformed = yield* withPartitionShim({ dryRunOutput: "not-json" }, () =>
          runCiLane("lint", CiLaneRunOptions.make({ ...baseOptions, partition: "lint-a" })).pipe(Effect.flip)
        );
        expect(malformed._tag).toBe("CiLanePartitionError");
        if (malformed._tag === "CiLanePartitionError") {
          expect(malformed.reason).toBe("turbo-dry-run");
          expect(malformed.message).toContain("Turbo emitted invalid JSON");
          expect(malformed.cause).toBeDefined();
        }
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("surfaces a non-zero partition execution as a quality task failure", () =>
      Effect.gen(function* () {
        const selectedPackage = firstOf(partitionPackages("repo-cli-2"));
        const error = yield* withPartitionShim(
          {
            dryRunOutput: turboDryRunOutput("test", [selectedPackage]),
            executionExitCode: 7,
          },
          () =>
            runCiLane(
              "test-unit",
              CiLaneRunOptions.make({ ...baseOptions, affected: true, partition: "repo-cli-2" })
            ).pipe(Effect.flip)
        );

        expect(error._tag).toBe("QualityTaskGroupFailed");
        if (error._tag === "QualityTaskGroupFailed") {
          expect(error.exitCode).toBe(7);
          expect(error.label).toBe("ci:test-unit:repo-cli-2");
        }
      })
    );
  });

  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("maps an unreadable workspace inventory to the typed partition error", () =>
      Effect.gen(function* () {
        const selectedPackage = firstOf(partitionPackages("repo-cli-2"));
        const error = yield* withPartitionShim(
          { dryRunOutput: turboDryRunOutput("test", [selectedPackage]) },
          ({ tempDir }) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              yield* fs.makeDirectory(path.join(tempDir, ".git"), { recursive: true });
              return yield* withWorkingDirectory(
                tempDir,
                runCiLane("test-unit", CiLaneRunOptions.make({ ...baseOptions, partition: "repo-cli-2" })).pipe(
                  Effect.flip
                )
              );
            })
        );

        expect(error._tag).toBe("CiLanePartitionError");
        if (error._tag === "CiLanePartitionError") {
          expect(error.reason).toBe("workspace-read");
          expect(error.message).toContain("Failed to resolve the current workspace package inventory");
        }
      })
    );
  });
});

describe("ciLaneStepsForTesting", () => {
  it("uses the local PR-shape check concurrency outside GitHub Actions", () => {
    const step = withEnvVar("GITHUB_ACTIONS", undefined, () =>
      withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", undefined, () =>
        firstOf(ciLaneStepsForTesting(REPO_ROOT, "check", prShapeOptions))
      )
    );
    expect([...step.args]).toEqual(["run", "check", "--", "--concurrency=3", "--affected", "--summarize"]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });

  it("uses the hosted PR-shape check concurrency in GitHub Actions", () => {
    const step = withEnvVar("GITHUB_ACTIONS", "true", () =>
      withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", undefined, () =>
        firstOf(ciLaneStepsForTesting(REPO_ROOT, "check", prShapeOptions))
      )
    );
    expect([...step.args]).toEqual(["run", "check", "--", "--concurrency=2", "--affected", "--summarize"]);
  });

  it("lowers Check to c2 under a contended admission profile", () => {
    withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", "2", () => {
      const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "check", prShapeOptions));
      expect([...step.args]).toEqual(["run", "check", "--", "--concurrency=2", "--affected", "--summarize"]);
    });
  });

  it("builds the PR-shape package lint graph with TURBO_SCM_BASE", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "lint", prShapeOptions);
    expect(A.length(steps)).toBe(1);
    const step = firstOf(steps);
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "lint",
      ...expectedTurboCacheArgs(["--concurrency=2", "--filter=!./apps/labs/**", "--affected", "--summarize"]),
      "--concurrency=2",
      "--filter=!./apps/labs/**",
      "--affected",
      "--summarize",
    ]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });

  it("builds the push-shape lint lane with the hosted-runner turbo cap", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint", baseOptions));
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "lint",
      ...expectedTurboCacheArgs(["--concurrency=2", "--filter=!./apps/labs/**"]),
      "--concurrency=2",
      "--filter=!./apps/labs/**",
    ]);
    expect(step.env).toBeUndefined();
  });

  // lab-apps-lifecycle P2 (ratified row 10): one bundled positively-filtered
  // turbo run, never --affected (turbo unions filter selectors), never
  // TURBO_SCM_BASE — the workflow path gate provides PR scoping.
  it("bundles the labs lane as one positively-filtered turbo run without --affected", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "labs", baseOptions);
    expect(A.length(steps)).toBe(1);
    const step = firstOf(steps);
    expect(step.label).toBe("ci:labs");
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      "test",
      ...expectedTurboCacheArgs(["--filter=./apps/labs/**", "--concurrency=2"]),
      "--filter=./apps/labs/**",
      "--concurrency=2",
    ]);
    expect(step.env).toBeUndefined();

    const prShaped = firstOf(ciLaneStepsForTesting(REPO_ROOT, "labs", prShapeOptions));
    expect([...prShaped.args]).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      "test",
      ...expectedTurboCacheArgs(["--filter=./apps/labs/**", "--concurrency=2"]),
      "--filter=./apps/labs/**",
      "--concurrency=2",
      "--summarize",
    ]);
    expect(prShaped.args).not.toContain("--affected");
    expect(prShaped.env).toBeUndefined();
  });

  it("splits the test lanes into CI's unit and integration shapes", () => {
    const unit = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-unit", prShapeOptions));
    expect([...unit.args]).toEqual(["run", "test", "--", "--unit", "--concurrency=2", "--affected", "--summarize"]);

    const integration = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-integration", prShapeOptions));
    expect([...integration.args]).toEqual(["run", "test", "--", "--integration", "--affected", "--summarize"]);
  });

  it("states the lint-policy full sweep in argv instead of inheriting CI=true", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint-policy", baseOptions));
    expect([...step.args]).toEqual(["run", "beep", "lint", "policy", "--full"]);
  });

  // Perf audit K1: the pull-request shape reaches `beep lint policy` as an explicit changed
  // scope, which the policy command widens on escalating changes; it never inherits CI=true.
  it("passes the pull-request affected shape through to the lint-policy changed scope", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint-policy", prShapeOptions));
    expect([...step.args]).toEqual(["run", "beep", "lint", "policy", "--affected", "--base", "origin/main"]);
    assertSome(
      pipe(
        CI_LANE_DESCRIPTORS,
        A.findFirst((descriptor) => descriptor.id === "lint-policy"),
        O.map((descriptor) => [...descriptor.flags])
      ),
      ["--affected", "--base", "--summarize"]
    );
  });

  it("replays the lint-policy lane locally with the hosted pull-request shape", () => {
    const prPlan = CiLocalStepPlan.make({ affected: true, base: "origin/main", onMainBranch: false });
    const fullPlan = CiLocalStepPlan.make({ ...prPlan, affected: false });
    expect([...firstOf(ciLocalStepsForTesting(REPO_ROOT, ["lint-policy"], prPlan)).args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "lint-policy",
      "--affected",
      "--base",
      "origin/main",
      "--summarize",
    ]);
    expect([...firstOf(ciLocalStepsForTesting(REPO_ROOT, ["lint-policy"], fullPlan)).args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "lint-policy",
      "--summarize",
    ]);
  });

  it("runs the first ecosystem member's type and bundle contracts explicitly", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "ecosystem", baseOptions);
    expect(A.map(steps, (step) => step.command)).toEqual(["bun", "bun"]);
    expect(A.map(steps, (step) => [...step.args])).toEqual([
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:type-test"],
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:bundle-probe"],
    ]);
  });

  it("runs the strict design-system lint in Repo Sanity through the uncached lint:shadcn root task", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", prShapeOptions);
    const shadcn = O.getOrThrow(A.findFirst(steps, (step) => step.label === "ci:repo-sanity:shadcn"));
    expect({ command: shadcn.command, args: [...shadcn.args] }).toEqual({
      command: "bunx",
      args: ["turbo", "run", "lint:shadcn", ...expectedTurboCacheArgs(["--summarize"]), "--summarize"],
    });
    expect(shadcn.env).toBeUndefined();
  });

  it("instruments the existing unit shard once and forces only its exact test targets", () => {
    const options = CiLaneRunOptions.make({ ...baseOptions, coverageOutput: ".beep/ci-coverage/repo-cli-1" });
    const args = ciLanePartitionArgsForTesting(
      "test-unit",
      ["@beep/repo-cli"],
      options,
      CiLanePartitionShard.make({ index: 1, total: 2 })
    );
    expect(args.execution).toContain("@beep/repo-cli#test");
    expect(args.execution).toContain("--only");
    expect(args.execution).toContain("--force");
    expect(A.filter(args.execution, (arg) => arg === "--")).toHaveLength(1);
    expect(args.execution).toContain("--coverage.provider=istanbul");
    expect(args.execution).toContain("--coverage.reporter=json");
    expect(args.execution).toContain("--coverage.reporter=json-summary");
    expect(args.execution).toContain("--outputFile=coverage/unit-results.json");
    expect(args.execution).toContain("--shard=1/2");
    expect(args.selection).not.toContain("--coverage");
    expect(args.execution).not.toContain("@beep/repo-cli#coverage");
  });

  it("matches coverage baseline regeneration concurrency", () => {
    const coverage = firstOf(ciLaneStepsForTesting(REPO_ROOT, "coverage", prShapeOptions));
    expect([...coverage.args]).toEqual(["run", "coverage", "--", "--concurrency=3", "--affected", "--summarize"]);
  });

  it("runs jsdoc-inventory before jsdoc-ratchet, matching hosted CI", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "jsdoc-ratchet", baseOptions);
    const labels = A.map(steps, (step) => step.label);
    expect(labels).toEqual(["ci:jsdoc-ratchet:inventory", "ci:jsdoc-ratchet:ratchet"]);
    expect(steps[0]?.args).toEqual([
      "turbo",
      "run",
      "jsdoc:inventory:check",
      ...expectedTurboCacheArgs(["--summarize"]),
      "--summarize",
    ]);
    expect(steps[1]?.args).toEqual([
      "run",
      "beep",
      "quality",
      "jsdoc-ratchet",
      "--inventory",
      ".beep/ci/jsdoc-documentation.inventory.jsonc",
    ]);
  });

  it("ratchets a pre-built inventory without regenerating it when --inventory is given", () => {
    const steps = ciLaneStepsForTesting(
      REPO_ROOT,
      "jsdoc-ratchet",
      CiLaneRunOptions.make({ ...baseOptions, inventory: "standards/jsdoc-documentation.inventory.jsonc" })
    );
    expect(A.map(steps, (step) => step.label)).toEqual(["ci:jsdoc-ratchet:ratchet"]);
    expect(steps[0]?.args).toEqual([
      "run",
      "beep",
      "quality",
      "jsdoc-ratchet",
      "--inventory",
      "standards/jsdoc-documentation.inventory.jsonc",
    ]);
  });

  it("builds the codegen drift lane from stable driver checks followed by the desktop bundle check", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "codegen", baseOptions);
    expect(A.map(steps, (step) => ({ label: step.label, command: step.command, args: [...step.args] }))).toEqual([
      {
        label: "ci:codegen:acp",
        command: "bun",
        args: ["run", "--cwd", "packages/drivers/acp", "generate:check"],
      },
      {
        label: "ci:codegen:ecfr",
        command: "bun",
        args: ["run", "--cwd", "packages/drivers/ecfr", "generate:check"],
      },
      {
        label: "ci:codegen:govinfo",
        command: "bun",
        args: ["run", "--cwd", "packages/drivers/govinfo", "generate:check"],
      },
      {
        label: "ci:codegen:runpod",
        command: "bun",
        args: ["run", "--cwd", "packages/drivers/runpod", "generate:check"],
      },
      {
        label: "ci:codegen:desktop-migration-bundle",
        command: "bun",
        args: ["run", "--cwd", "apps/professional-desktop", "codegen:check"],
      },
    ]);
  });

  it("builds commitlint range and last shapes", () => {
    const range = firstOf(
      ciLaneStepsForTesting(
        REPO_ROOT,
        "commitlint",
        CiLaneRunOptions.make({ ...baseOptions, from: "abc123", to: "def456" })
      )
    );
    expect([...range.args]).toEqual(["commitlint", "--from", "abc123", "--to", "def456", "--verbose"]);

    const last = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "commitlint", CiLaneRunOptions.make({ ...baseOptions, last: true }))
    );
    expect([...last.args]).toEqual(["commitlint", "--last", "--verbose"]);

    const defaulted = firstOf(ciLaneStepsForTesting(REPO_ROOT, "commitlint", baseOptions));
    expect([...defaulted.args]).toEqual(["commitlint", "--from", "origin/main", "--to", "HEAD", "--verbose"]);
  });

  it("builds docgen lanes per workflow lane-gate mode", () => {
    const auto = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" }))
    );
    expect([...auto.args]).toEqual(["run", "docgen:local", "--", "--base", "origin/main", "--head", "HEAD"]);

    expect(ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "none" }))).toEqual(
      []
    );

    const affected = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }))
    );
    expect([...affected.args]).toEqual(["run", "docgen:local", "--", "--base", "origin/main", "--head", "HEAD"]);

    const full = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "full" }))
    );
    expect([...full.args]).toEqual(["run", "docgen"]);
  });

  it("selects Docgen none, affected, and full modes from one CLI predicate", () => {
    expect(docgenLaneModeForChangedPaths([])).toBe("none");
    expect(docgenLaneModeForChangedPaths(["goals/ship-velocity/PLAN.md"])).toBe("affected");
    expect(docgenLaneModeForChangedPaths(["standards/architecture/DECISIONS.md"])).toBe("affected");
    expect(docgenLaneModeForChangedPaths(["scripts/release.sh"])).toBe("none");
    expect(docgenLaneModeForChangedPaths(["packages/example/src/index.ts"])).toBe("affected");
    expect(docgenLaneModeForChangedPaths(["packages/tooling/tool/docgen/src/index.ts"])).toBe("full");
    expect(docgenLaneModeForChangedPaths(["tsconfig.base.json"])).toBe("full");
  });

  it("lists mode only for Docgen, not Doctest", () => {
    const doctest = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "doctest"));
    const docgen = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "docgen"));
    expect([...doctest.flags]).toEqual([]);
    expect(doctest.flags).not.toContain("--mode");
    expect(docgen.flags).toContain("--mode");
  });

  it("builds the full Turbo Doctest plan without a mode flag", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "doctest", baseOptions);
    expect(steps).toHaveLength(1);
    const step = firstOf(steps);
    expect(step.label).toBe("ci:doctest");
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "doctest",
      ...expectedTurboCacheArgs(["--concurrency=4", "--summarize"]),
      "--concurrency=4",
      "--summarize",
    ]);
    expect(step.env).toBeUndefined();
  });

  it("runs only the home path law and the changeset checks on a documentation-only diff", () => {
    // --docs-only wins over --changeset-status: the documentation path always validates changesets.
    const steps = ciLaneStepsForTesting(
      REPO_ROOT,
      "repo-sanity",
      CiLaneRunOptions.make({ ...baseOptions, changesetStatus: true, docsOnly: true })
    );
    expect(A.map(steps, (step) => step.label)).toEqual([
      "lint:private-home-paths",
      "ci:repo-sanity:changeset-graph",
      "ci:repo-sanity:changeset-status",
    ]);
    expect(A.map(steps, (step) => [...step.args])).toEqual([
      ["run", "beep", "laws", "private-home-paths", "--check"],
      ["run", "beep", "quality", "changeset-graph"],
      ["run", "beep", "quality", "changeset-status", "--since", "origin/main"],
    ]);
  });

  it("runs the docs policy tasks in one Turbo graph, then the knowledge doctor against the base", () => {
    const steps = ciLaneStepsForTesting(
      REPO_ROOT,
      "docs-policy",
      CiLaneRunOptions.make({ ...baseOptions, base: "origin/release" })
    );
    expect(A.map(steps, (step) => step.label)).toEqual(["ci:docs-policy:tasks", "ci:docs-policy:knowledge-doctor"]);
    const turboFlags = ["--concurrency=4", "--continue=dependencies-successful", "--summarize"];
    expect(firstOf(steps)).toMatchObject({
      command: "bunx",
      args: ["turbo", "run", ...DOCS_POLICY_ROOT_TASKS, ...expectedTurboCacheArgs(turboFlags), ...turboFlags],
      cwd: REPO_ROOT,
    });
    expect([...lastOf(steps).args]).toEqual(["run", "beep", "knowledge", "doctor", "ci", "--base", "origin/release"]);
  });

  it("always checks the schema catalog, catalog usage, home paths and shadcn lint and appends changeset status on request", () => {
    const withoutFlag = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", baseOptions);
    expect(A.map(withoutFlag, (step) => step.label)).toEqual([
      "lint:schema-catalog",
      "ci:repo-sanity:catalog-usage",
      "lint:private-home-paths",
      "ci:repo-sanity",
      "ci:repo-sanity:shadcn",
    ]);
    expect(firstOf(withoutFlag)).toMatchObject({
      command: "bun",
      args: ["run", "beep", "lint", "schema-catalog"],
      cwd: REPO_ROOT,
    });
    // Repo Sanity is required and Heavy / Lint Policy is not, so the home path
    // law stays in Repo Sanity on every head.
    expect(O.getOrThrow(A.findFirst(withoutFlag, (step) => step.label === "lint:private-home-paths"))).toMatchObject({
      command: "bun",
      args: ["run", "beep", "laws", "private-home-paths", "--check"],
      cwd: REPO_ROOT,
    });

    const withFlag = ciLaneStepsForTesting(
      REPO_ROOT,
      "repo-sanity",
      CiLaneRunOptions.make({ ...baseOptions, changesetStatus: true })
    );
    expect(A.map(withFlag, (step) => step.label)).toEqual([
      "lint:schema-catalog",
      "ci:repo-sanity:catalog-usage",
      "lint:private-home-paths",
      "ci:repo-sanity",
      "ci:repo-sanity:shadcn",
      "ci:repo-sanity:changeset-status",
    ]);
    // lab-apps-lifecycle P2 (ratified row 8): CI's changeset gate routes
    // through the path-aware wrapper so lab-only changes are ceremony-exempt.
    expect([...lastOf(withFlag).args]).toEqual([
      "run",
      "beep",
      "quality",
      "changeset-status",
      "--since",
      "origin/main",
    ]);
  });

  it("plans the fallow lane as promoted blocking, advisory, then optional validation", () => {
    const runPhase = A.map(ciLaneStepsForTesting(REPO_ROOT, "fallow", baseOptions), (step) => step.label);
    expect(runPhase).toEqual([
      "ci:fallow:audit",
      "ci:fallow:dead-code",
      "ci:fallow:health",
      "ci:fallow:boundaries",
      "ci:fallow:flags",
      "ci:fallow:security",
      "ci:fallow:fix-preview",
    ]);

    const validated = ciLaneStepsForTesting(
      REPO_ROOT,
      "fallow",
      CiLaneRunOptions.make({ ...baseOptions, validateEnvelopes: true })
    );
    expect(A.length(validated)).toBe(14);
    const lastLabel = lastOf(validated).label;
    expect(lastLabel).toBe("ci:fallow:envelope-check:health");
  });

  it("routes Fallow tasks unfiltered with explicit proof base", () => {
    const steps = ciLaneStepsForTesting(
      REPO_ROOT,
      "fallow",
      CiLaneRunOptions.make({ ...prShapeOptions, base: "review-base" })
    );
    for (const [index, task] of [
      [0, "fallow:audit:check"],
      [1, "fallow:dead-code:check"],
      [2, "fallow:health:check"],
      [3, "fallow:boundaries:advisory"],
      [4, "fallow:flags:advisory"],
      [5, "fallow:security:advisory"],
      [6, "fallow:fix-preview:advisory"],
    ] as const) {
      expect(steps[index]?.args).toEqual([
        "turbo",
        "run",
        task,
        ...expectedTurboCacheArgs(["--summarize"]),
        "--summarize",
      ]);
      expect(steps[index]?.env).toEqual({ BEEP_PROOF_BASE: "review-base" });
    }
  });

  it("builds the property lane with the 400-run floor, fixed seed, continue-on-failure, and cache-partitioning env", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "property", prShapeOptions));
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "test:property",
      ...expectedTurboCacheArgs(["--concurrency=4", "--continue=dependencies-successful", "--affected", "--summarize"]),
      "--concurrency=4",
      "--continue=dependencies-successful",
      "--affected",
      "--summarize",
    ]);
    expect(step.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708", TURBO_SCM_BASE: "origin/main" });

    const deep = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, runs: "1000" }))
    );
    expect(deep.env).toEqual({ BEEP_FC_NUM_RUNS: "1000", BEEP_FC_SEED: "20260708" });

    // Commas separate several Turbo filters, and a Vitest shard rides behind Turbo's `--`, so hosted
    // slices split the sweep by directory and by shard without a package table.
    const sliced = firstOf(
      ciLaneStepsForTesting(
        REPO_ROOT,
        "property",
        CiLaneRunOptions.make({
          ...baseOptions,
          filter: "!./packages/foundation/**, !./packages/drivers/**,!@beep/repo-cli",
          shard: CiLanePartitionShard.make({ index: 2, total: 2 }),
        })
      )
    );
    expect(A.takeRight(sliced.args, 5)).toEqual([
      "--filter=!./packages/foundation/**",
      "--filter=!./packages/drivers/**",
      "--filter=!@beep/repo-cli",
      "--",
      "--shard=2/2",
    ]);

    // A blank or whitespace-only --runs must fall back to the 400 floor,
    // never reach the lane as BEEP_FC_NUM_RUNS="" (which parsers read as
    // absent, silently dropping to fast-check's 100-run default).
    for (const blank of ["", "   "]) {
      const step = firstOf(
        ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, runs: blank }))
      );
      expect(step.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708" });
    }

    // --seed overrides the deterministic default; blank/whitespace falls back
    // to the fixed seed so the PR lane can never silently go non-deterministic.
    const seeded = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, seed: "12345" }))
    );
    expect(seeded.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "12345" });
    for (const blank of ["", "   "]) {
      const fallback = firstOf(
        ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, seed: blank }))
      );
      expect(fallback.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708" });
    }
  });

  it("keeps the build lane's --summarize flag-driven", () => {
    const plain = firstOf(ciLaneStepsForTesting(REPO_ROOT, "build", baseOptions));
    expect([...plain.args]).toEqual(["run", "build"]);
    expect(plain.env).toBeUndefined();

    const summarized = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "build", CiLaneRunOptions.make({ ...baseOptions, summarize: true }))
    );
    expect([...summarized.args]).toEqual(["run", "build", "--", "--summarize"]);
  });

  // Quality-lane audit D13: one positively-filtered storybook build, the
  // browser run, then the artifact proof. --affected never reaches Turbo
  // (filter union hazard); it drives the CLI-side change-profile gate.
  it("builds the storybook lane as filtered turbo runs plus the artifact proof", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "storybook", baseOptions);
    expect(A.map(steps, (step) => step.label)).toEqual([
      "ci:storybook:build",
      "ci:storybook:test",
      "ci:storybook:artifact",
    ]);
    const build = stepAt(steps, 0);
    const test = stepAt(steps, 1);
    const artifact = stepAt(steps, 2);
    expect(build.command).toBe("bunx");
    expect([...build.args]).toEqual([
      "turbo",
      "run",
      "storybook:build",
      ...expectedTurboCacheArgs(["--filter=@beep/storybook"]),
      "--filter=@beep/storybook",
    ]);
    expect([...test.args]).toEqual([
      "turbo",
      "run",
      "test:storybook",
      ...expectedTurboCacheArgs(["--filter=@beep/storybook"]),
      "--filter=@beep/storybook",
    ]);
    expect(artifact.command).toBe("test");
    expect([...artifact.args]).toEqual(["-f", "apps/storybook/storybook-static/index.html"]);

    const prShaped = ciLaneStepsForTesting(REPO_ROOT, "storybook", prShapeOptions);
    const prBuild = firstOf(prShaped);
    expect([...prBuild.args]).toEqual([
      "turbo",
      "run",
      "storybook:build",
      ...expectedTurboCacheArgs(["--filter=@beep/storybook", "--summarize"]),
      "--filter=@beep/storybook",
      "--summarize",
    ]);
    for (const step of prShaped) {
      expect(step.args).not.toContain("--affected");
      expect(step.env).toBeUndefined();
    }
  });

  // The workflow gates only on docs_only and hands the affected decision to
  // the lane (Turbo dry-run probe); no path profile survives anywhere.
  it.layer(gitPlatform, { timeout: "10 seconds" })((it) => {
    it.effect("leaves the storybook affected decision to the lane instead of a workflow path profile", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const script = yield* fs.readFileString(
          path.join(repoRoot, "packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts")
        );
        const workflow = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/storybook.yml"));
        expect(script).not.toContain("storybook_relevant");
        expect(script).not.toContain("storybook_pattern");
        expect(workflow).not.toContain("storybook_relevant");
        expect(workflow).toContain('eval "$(beep ci change-profile)"');
        expect(workflow).toContain('if [[ "$docs_only" == "true" ]]; then');
        expect(workflow).toContain('shape_args+=(--affected --base "origin/${GITHUB_BASE_REF:-main}")');
        expect(workflow).toContain('run_lane ci lane storybook "${shape_args[@]}"');
        expect(workflow).toContain('bun run beep ci lane storybook --selection-only "${shape_args[@]}"');
        const selection = Str.indexOf("- name: Select Storybook before browser provisioning")(workflow);
        const browser = Str.indexOf("- name: Install Playwright Chromium")(workflow);
        expect(O.getOrThrow(selection)).toBeLessThan(O.getOrThrow(browser));
        expect(workflow).toContain("if: steps.storybook-selection.outputs.should_run == 'true'");
      })
    );
  });

  // Quality-lane audit D12: pull requests build affected-scoped with the same
  // TURBO_SCM_BASE shape the check lane uses; pushes stay unscoped.
  it("builds the PR-shape build lane with TURBO_SCM_BASE", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "build", prShapeOptions));
    expect(step.label).toBe("ci:build");
    expect([...step.args]).toEqual(["run", "build", "--", "--affected", "--summarize"]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });
});

// Storybook affected probe: under --affected the lane asks Turbo (JSON dry
// run, TURBO_SCM_BASE from --base) whether @beep/storybook sits in the
// dependency-aware affected set and runs the whole lane iff the plan carries
// @beep/storybook#storybook:build. A path profile could not see transitive
// workspace dependencies such as @beep/schema; Turbo's graph can.
const storybookSpawner = (dryRunOutput: string, dryRunExitCode = 0) =>
  ScriptedSpawner.make((_command, args) =>
    A.contains(args, "--dry-run=json") ? { stdout: dryRunOutput, exit: dryRunExitCode } : {}
  );

const storybookCiLayer = (
  spawner: ScriptedSpawner,
  fileSystemLayer: Layer.Layer<FileSystem.FileSystem> = FileSystem.layerNoop({
    exists: (file) => Effect.succeed(Str.endsWith("/.git")(file)),
    makeDirectory: () => Effect.void,
    writeFileString: () => Effect.void,
  })
) => {
  const fileSystemAndPath = Layer.merge(fileSystemLayer, Path.layer);
  return Layer.provideMerge(
    Git.layer,
    Layer.mergeAll(
      BunCrypto.layer,
      fileSystemAndPath,
      FsUtilsLive.pipe(Layer.provide(fileSystemAndPath)),
      spawner.layer,
      TestConsole.layer
    )
  );
};

const storybookDryRun = (
  tasks: ReadonlyArray<{ readonly package: string; readonly task: string; readonly command?: string }>
): string =>
  encodeJson({
    tasks: A.map(tasks, (entry) => ({
      command: entry.command ?? "bun run beep:build",
      package: entry.package,
      task: entry.task,
      taskId: `${entry.package}#${entry.task}`,
    })),
  });

const STORYBOOK_PROBE_SUFFIX = ["--filter=@beep/storybook", "--affected", "--dry-run=json"];
const storybookProbeLine = A.join(
  [
    "bunx",
    "turbo",
    "run",
    "storybook:build",
    ...expectedTurboCacheArgs(STORYBOOK_PROBE_SUFFIX),
    ...STORYBOOK_PROBE_SUFFIX,
  ],
  " "
);
const consoleOutput = Effect.map(TestConsole.logLines, (lines) => A.join(A.filter(lines, P.isString), "\n"));

const unselectedStorybook = storybookSpawner(storybookDryRun([]));
it.layer(storybookCiLayer(unselectedStorybook), { timeout: "10 seconds" })(
  "storybook lane affected probe (nothing in the closure changed)",
  (it) => {
    it.effect("skips the lane when Turbo's affected plan selects no @beep/storybook task", () =>
      Effect.gen(function* () {
        yield* runCiLane("storybook", prShapeOptions);

        expect(unselectedStorybook.spawns).toHaveLength(1);
        const probe = firstOf(unselectedStorybook.spawns);
        expect(spawnLine(probe)).toBe(storybookProbeLine);
        expect(probe.env).toMatchObject({ TURBO_SCM_BASE: "origin/main" });
        const output = yield* consoleOutput;
        expect(output).toContain(
          "Turbo's affected plan (origin/main...HEAD) does not select @beep/storybook#storybook:build (0 task(s) selected)"
        );
        expect(output).toContain(
          "[ci] storybook: @beep/storybook is outside Turbo's affected set for this change set (skipped)"
        );
      })
    );
  }
);

for (const selected of [false, true]) {
  const probe = storybookSpawner(
    storybookDryRun(selected ? [{ package: "@beep/storybook", task: "storybook:build" }] : [])
  );
  it.layer(Layer.mergeAll(storybookCiLayer(probe, NodeFileSystem.layer), NodeStdio.layer, NodeTerminal.layer), {
    timeout: "10 seconds",
  })(`storybook selection-only (${selected})`, (it) => {
    it.effect("writes the dependency-aware decision without provisioning or running the lane", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* fs.makeTempFileScoped();
        yield* Command.runWith(ciLaneCommand, { version: "0.0.0" })([
          "storybook",
          "--selection-only",
          "--affected",
          "--base",
          "origin/main",
        ]).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ GITHUB_OUTPUT: output }))
        );
        expect(probe.spawns).toHaveLength(1);
        expect(spawnLine(firstOf(probe.spawns))).toBe(storybookProbeLine);
        expect(firstOf(probe.spawns).env).toMatchObject({ TURBO_SCM_BASE: "origin/main" });
        const contents = yield* fs.readFileString(output);
        expect(contents).toContain("should_run");
        expect(contents).toContain(selected ? "true" : "false");
      })
    );
  });
}

it.layer(Layer.mergeAll(PartitionLaneLayer, NodeStdio.layer, NodeTerminal.layer), { timeout: "10 seconds" })(
  "partition plan command",
  (it) => {
    it.effect("publishes the planned partitions as one JSON step output and runs nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const output = yield* fs.makeTempFileScoped();
        const commandLog = yield* withPartitionShim(
          { dryRunOutput: turboDryRunOutput("lint", [firstOf(partitionPackages("lint-b"))]) },
          ({ commandLogPath }) =>
            Command.runWith(ciLaneCommand, { version: "0.0.0" })(["lint", "--plan-partitions", "--affected"]).pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ GITHUB_OUTPUT: output })
              ),
              Effect.andThen(fs.readFileString(commandLogPath))
            )
        );
        const contents = yield* fs.readFileString(output);
        expect(contents).toContain("partitions");
        expect(contents).toContain('["lint-b"]');
        const commands = pipe(commandLog, Str.split("\n"), A.filter(Str.isNonEmpty));
        expect(commands).toHaveLength(1);
        expect(firstOf(commands)).toContain("--dry-run=json");
      })
    );

    it.effect("rejects a planned list that is not a JSON array of partition ids before running the lane", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ranAnything = yield* withPartitionShim(
          { dryRunOutput: turboDryRunOutput("lint", []) },
          ({ commandLogPath }) =>
            Effect.gen(function* () {
              for (const planned of ["lint-a", '["not-a-partition"]', "{}"]) {
                // `Effect.flip` fails the test unless the command itself failed.
                yield* Command.runWith(ciLaneCommand, { version: "0.0.0" })([
                  "lint",
                  "--partition",
                  "lint-a",
                  "--planned-partitions",
                  planned,
                ]).pipe(Effect.flip);
              }
              return yield* fs.exists(commandLogPath);
            })
        );
        expect(ranAnything).toBe(false);
        const errorLines = yield* TestConsole.errorLines;
        const errors = A.join(A.filter(errorLines, P.isString), "\n");
        expect(errors).toContain("--planned-partitions must be a JSON array of partition ids.");
      })
    );
  }
);

const foreignStorybook = storybookSpawner(
  storybookDryRun([
    { package: "@beep/schema", task: "build" },
    { package: "@beep/storybook", task: "storybook:build", command: "<NONEXISTENT>" },
  ])
);
it.layer(storybookCiLayer(foreignStorybook), { timeout: "10 seconds" })(
  "storybook lane affected probe (no executable storybook task)",
  (it) => {
    it.effect("ignores dependency builds and non-existent task placeholders", () =>
      Effect.gen(function* () {
        yield* runCiLane("storybook", prShapeOptions);

        expect(foreignStorybook.spawns).toHaveLength(1);
        const consoleOutput8 = yield* consoleOutput;
        expect(consoleOutput8).toContain("does not select @beep/storybook#storybook:build (2 task(s) selected)");
      })
    );
  }
);

const selectedStorybook = storybookSpawner(
  storybookDryRun([
    { package: "@beep/schema", task: "build" },
    { package: "@beep/ui", task: "build" },
    {
      package: "@beep/storybook",
      task: "storybook:build",
      command: "storybook build -o storybook-static",
    },
  ])
);
it.layer(storybookCiLayer(selectedStorybook), { timeout: "10 seconds" })(
  "storybook lane affected probe (transitive dependency changed)",
  (it) => {
    it.effect("runs the whole lane when the plan carries @beep/storybook#storybook:build", () =>
      Effect.gen(function* () {
        yield* runCiLane("storybook", prShapeOptions);

        const lines = spawnLines(selectedStorybook);
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe(storybookProbeLine);
        expect(lines[1]).toContain("cache execute -- run storybook:build");
        expect(lines[1]).toContain("--filter=@beep/storybook --summarize");
        expect(lines[1]).not.toContain("--affected");
        expect(lines[2]).toContain("cache execute -- run test:storybook");
        expect(lines[2]).not.toContain("--affected");
        expect(lines[3]).toBe("test -f apps/storybook/storybook-static/index.html");
        const consoleOutput9 = yield* consoleOutput;
        expect(consoleOutput9).toContain(
          "Turbo's affected plan (origin/main...HEAD) selects @beep/storybook#storybook:build (3 task(s) selected)"
        );
      })
    );
  }
);

const unscopedStorybook = storybookSpawner(storybookDryRun([]));
it.layer(storybookCiLayer(unscopedStorybook), { timeout: "10 seconds" })("storybook lane without --affected", (it) => {
  it.effect("never probes Turbo and runs every step", () =>
    Effect.gen(function* () {
      yield* runCiLane("storybook", baseOptions);

      const lines = spawnLines(unscopedStorybook);
      expect(lines).toHaveLength(3);
      expect(A.some(lines, Str.includes("--dry-run=json"))).toBe(false);
      expect(lines[0]).toContain("cache execute -- run storybook:build");
      expect(lines[2]).toBe("test -f apps/storybook/storybook-static/index.html");
    })
  );
});

const overriddenStorybook = storybookSpawner(storybookDryRun([]));
// The spawner's live record, under the name the rejection assertion reads.
const overriddenStorybookSpawns = overriddenStorybook.spawns;
it.layer(storybookCiLayer(overriddenStorybook), { timeout: "10 seconds" })(
  "storybook lane caller runtime identity rejection",
  (it) => {
    it.effect("rejects an ambient runtime key before launching a native task", () =>
      withEnvVarEffect(
        "BEEP_CACHE_TOOLCHAIN_DIGEST",
        "caller-controlled",
        Effect.gen(function* () {
          const error = yield* runCiLane("storybook", baseOptions).pipe(Effect.flip);
          expect(error._tag).toBe("QualityTaskConfigurationError");
          expect(error.message).toContain("cache runtime identity");
          expect(overriddenStorybookSpawns).toEqual([]);
        })
      )
    );
  }
);

const failedStorybook = storybookSpawner("turbo: could not resolve base", 2);
it.layer(storybookCiLayer(failedStorybook), { timeout: "10 seconds" })(
  "storybook lane affected probe (Turbo failure)",
  (it) => {
    it.effect("fails closed instead of guessing when the probe exits non-zero", () =>
      Effect.gen(function* () {
        const error = yield* runCiLane("storybook", prShapeOptions).pipe(Effect.flip);

        expect(error._tag).toBe("CiCommandError");
        expect(error.message).toBe("Turbo's Storybook affected dry run exited with code 2.");
        expect(failedStorybook.spawns).toHaveLength(1);
      })
    );
  }
);

const malformedStorybook = storybookSpawner("{not json");
it.layer(storybookCiLayer(malformedStorybook), { timeout: "10 seconds" })(
  "storybook lane affected probe (malformed plan)",
  (it) => {
    it.effect("fails closed when Turbo's plan does not decode", () =>
      Effect.gen(function* () {
        const error = yield* runCiLane("storybook", prShapeOptions).pipe(Effect.flip);

        expect(error._tag).toBe("CiCommandError");
        expect(error.message).toBe("Turbo emitted invalid JSON for the Storybook affected dry run.");
        expect(malformedStorybook.spawns).toHaveLength(1);
      })
    );
  }
);

type FallowLaneProbe = {
  readonly started: Array<string>;
  inFlight: number;
  maxInFlight: number;
  status: string;
};

const FALLOW_LANE_TASKS = [
  "fallow:audit:check",
  "fallow:dead-code:check",
  "fallow:health:check",
  "fallow:boundaries:advisory",
  "fallow:flags:advisory",
  "fallow:security:advisory",
  "fallow:fix-preview:advisory",
];
const FALLOW_STATUS_LANES = ["audit", "dead-code", "health", "boundaries", "flags", "security", "fix-preview"];

const fallowLaneProbe = (): FallowLaneProbe => ({ started: [], inFlight: 0, maxInFlight: 0, status: "" });

// Own double: the Fallow concurrency probe holds each sub-lane's exit on a latch and counts
// the lanes in flight, which a `ScriptCompletion` cannot express (SPEC D-14 KEEP).
const fallowLaneHandle = (exitCode: Effect.Effect<ChildProcessSpawner.ExitCode>) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

// Each fake Fallow `turbo run` holds its exit until three sub-lanes are in flight, so
// a runner that waits for one sub-lane before starting the next never gets past the
// first and the test times out.
const fallowCiLayer = (probe: FallowLaneProbe, failingTask?: string) => {
  const threeInFlight = Latch.makeUnsafe(false);
  const fileSystemLayer = FileSystem.layerNoop({
    exists: (file) => Effect.succeed(Str.endsWith("/.git")(file)),
    makeDirectory: () => Effect.void,
    readFileString: () => Effect.succeed("{}"),
    writeFileString: (_file, content) =>
      Effect.sync(() => {
        probe.status = content;
      }),
  });
  const processLayer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("the Fallow lane test never spawns a piped command");
      }
      const task = A.findFirst(commandArgs(command), Str.startsWith("fallow:"));
      if (O.isNone(task)) {
        const idle = fallowLaneHandle(Effect.succeed(ChildProcessSpawner.ExitCode(0)));
        return Effect.succeed(idle);
      }
      A.appendInPlace(probe.started, task.value);
      probe.inFlight += 1;
      probe.maxInFlight = Num.max(probe.maxInFlight, probe.inFlight);
      if (A.length(probe.started) === 3) {
        Latch.openUnsafe(threeInFlight);
      }
      const exit = Effect.sync(() => {
        probe.inFlight -= 1;
        return ChildProcessSpawner.ExitCode(task.value === failingTask ? 1 : 0);
      });
      const held = fallowLaneHandle(Latch.whenOpen(threeInFlight, exit));
      return Effect.succeed(held);
    })
  );
  const fileSystemAndPath = Layer.merge(fileSystemLayer, Path.layer);
  return Layer.provideMerge(
    Git.layer,
    Layer.mergeAll(
      BunCrypto.layer,
      fileSystemAndPath,
      FsUtilsLive.pipe(Layer.provide(fileSystemAndPath)),
      processLayer,
      TestConsole.layer
    )
  );
};

const statusLanes = flow(Str.split("\n"), A.filter(Str.isNonEmpty), A.map(Str.replace(/ \(\d+s\)$/u, "")));

const concurrentFallowProbe = fallowLaneProbe();
it.layer(fallowCiLayer(concurrentFallowProbe), { timeout: "10 seconds" })("fallow lane sub-lane concurrency", (it) => {
  it.effect("runs the seven sub-lanes three at a time and records status in declaration order", () =>
    Effect.gen(function* () {
      yield* runCiLane("fallow", baseOptions);

      expect(concurrentFallowProbe.started).toEqual(FALLOW_LANE_TASKS);
      expect(concurrentFallowProbe.maxInFlight).toBe(3);
      expect(statusLanes(concurrentFallowProbe.status)).toEqual(A.map(FALLOW_STATUS_LANES, (lane) => `- ${lane}: 0`));
    })
  );
});

const failingFallowProbe = fallowLaneProbe();
it.layer(fallowCiLayer(failingFallowProbe, "fallow:health:check"), { timeout: "10 seconds" })(
  "fallow lane blocking failure under concurrency",
  (it) => {
    it.effect("still runs the advisory sub-lanes and fails on the blocking exit status", () =>
      Effect.gen(function* () {
        const error = yield* runCiLane("fallow", baseOptions).pipe(Effect.flip);

        expect(error.message).toBe("Fallow blocking lane(s) failed with status 1.");
        expect(failingFallowProbe.started).toEqual(FALLOW_LANE_TASKS);
        expect(statusLanes(failingFallowProbe.status)).toEqual(
          A.map(FALLOW_STATUS_LANES, (lane) => `- ${lane}: ${lane === "health" ? 1 : 0}`)
        );
      })
    );
  }
);

describe("ciLocalStepsForTesting", () => {
  const branchPlan = CiLocalStepPlan.make({ affected: false, base: "origin/main", onMainBranch: false });

  it("dispatches each lane through beep ci lane", () => {
    const step = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["fallow"], branchPlan));
    expect([...step.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "fallow",
      "--base",
      "origin/main",
      "--validate-envelopes",
    ]);
  });

  it("pairs inner-lane ids with steps and honest absent executor digests", () => {
    const selection = ["fallow"] as const;
    const steps = ciLocalStepsForTesting(REPO_ROOT, selection, branchPlan);
    const inputs = ciLocalLaneInputsForTesting(selection, steps);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.[0]).toBe("fallow");
    expect(inputs[0]?.[1]).toBe(steps[0]);
    {
      const optionUnderTest = inputs[0]?.[2];
      assertDefined(optionUnderTest);
      assertNone(optionUnderTest);
    }
  });

  it("dispatches the labs lane with the hosted --summarize and without affected shaping", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const affected = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["labs"], affectedPlan));
    const branch = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["labs"], branchPlan));
    expect([...affected.args]).toEqual(["run", "beep", "ci", "lane", "labs", "--summarize"]);
    expect([...branch.args]).toEqual([...affected.args]);
  });

  // TTC ruling 58: a lane whose descriptor accepts --summarize replays it locally,
  // because the run summary is the only source of the lane's Turbo input digest.
  it("replays --summarize for every local lane whose descriptor accepts it", () => {
    const summarizing = pipe(
      CI_LANE_DESCRIPTORS,
      A.filter((descriptor) => A.contains(descriptor.flags, "--summarize")),
      A.map((descriptor) => descriptor.id),
      A.filter(isLocalCiLaneId)
    );
    const missingFor = (plan: CiLocalStepPlan) =>
      A.filter(
        summarizing,
        (laneId) => !A.contains(firstOf(ciLocalStepsForTesting(REPO_ROOT, [laneId], plan)).args, "--summarize")
      );
    expect(summarizing).toContain("labs");
    expect(missingFor(branchPlan)).toEqual([]);
    expect(missingFor(CiLocalStepPlan.make({ ...branchPlan, affected: true }))).toEqual([]);
  });

  it("forwards the affected shape to the storybook lane as its change-profile gate", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const gated = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["storybook"], affectedPlan));
    expect([...gated.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "storybook",
      "--affected",
      "--base",
      "origin/main",
      "--summarize",
    ]);
    const full = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["storybook"], branchPlan));
    expect([...full.args]).toEqual(["run", "beep", "ci", "lane", "storybook", "--summarize"]);
  });

  it("keeps --summarize on turbo-backed lanes even without the affected shape", () => {
    const check = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["check"], branchPlan));
    expect([...check.args]).toEqual(["run", "beep", "ci", "lane", "check", "--summarize"]);
  });

  it("forwards the affected shape to turbo-backed lanes", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const lint = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["lint"], affectedPlan));
    expect([...lint.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "lint",
      "--affected",
      "--base",
      "origin/main",
      "--summarize",
    ]);

    const docgen = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["docgen"], affectedPlan));
    expect([...docgen.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "docgen",
      "--mode",
      "auto",
      "--base",
      "origin/main",
    ]);
  });

  it("replays fallow with envelope validation locally", () => {
    const fallow = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["fallow"], branchPlan));
    expect([...fallow.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "fallow",
      "--base",
      "origin/main",
      "--validate-envelopes",
    ]);
  });

  it("skips the changeset status flag on main", () => {
    const mainPlan = CiLocalStepPlan.make({ ...branchPlan, onMainBranch: true });
    const onMain = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["repo-sanity"], mainPlan));
    expect([...onMain.args]).toEqual(["run", "beep", "ci", "lane", "repo-sanity"]);

    const onBranch = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["repo-sanity"], branchPlan));
    expect([...onBranch.args]).toEqual(["run", "beep", "ci", "lane", "repo-sanity", "--changeset-status"]);
  });
});

const autoDocgen = ciSpawner(["packages/a/src/index.ts"]);
it.layer(ciExecutionLayer(autoDocgen), { timeout: "10 seconds" })("automatic Docgen CI lane", (it) => {
  it.effect("derives the affected mode from the base-to-head diff and executes it", () =>
    Effect.gen(function* () {
      yield* runCiLane("docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" }));

      const commands = spawnLines(autoDocgen);
      expect(commands[0]).toBe("git diff --name-only -z --no-relative origin/main...HEAD");
      expect(commands[1]).toContain("bun run docgen:local -- --base origin/main --head HEAD");
    })
  );
});

// The automatic Docgen scope diff fails before git answers (no exit code) or after git refuses.
const docgenScopeFailures = [
  {
    label: "an unspawnable",
    failure: GitCommandError.make({ kind: "failed", args: ["diff"], cwd: "/repo", stderr: "", detail: "spawn ENOENT" }),
    message: "Failed to resolve automatic Docgen scope.",
  },
  {
    label: "a refused",
    failure: GitCommandError.make({ kind: "failed", args: ["diff"], cwd: "/repo", exitCode: 128, stderr: "fatal" }),
    message: "git diff for automatic Docgen scope failed with exit code 128.",
  },
] as const;

const failedScope = ciSpawner([]);
it.layer(ciExecutionLayer(failedScope), { timeout: "10 seconds" })(
  "automatic Docgen CI lane over a failing diff",
  (it) => {
    for (const { label, failure, message } of docgenScopeFailures) {
      it.effect(`reports ${label} scope diff without running Docgen`, () =>
        Effect.gen(function* () {
          const error = yield* runCiLane("docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" })).pipe(
            Effect.provideService(Git, Git.makeTest({ changedFiles: () => Effect.fail(failure) })),
            Effect.flip
          );

          expect(error.message).toBe(message);
          expect(failedScope.spawns).toEqual([]);
        })
      );
    }
  }
);

const inertDocgen = ciSpawner(["scripts/release.sh"]);
it.layer(ciExecutionLayer(inertDocgen), { timeout: "10 seconds" })("automatic inert Docgen CI lane", (it) => {
  it.effect("skips execution when the diff has no Docgen inputs", () =>
    Effect.gen(function* () {
      yield* runCiLane("docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" }));

      expect(spawnLines(inertDocgen)).toEqual(["git diff --name-only -z --no-relative origin/main...HEAD"]);
    })
  );
});

const fullDoctest = ciSpawner([]);

it.layer(ciExecutionLayer(fullDoctest), { timeout: "10 seconds" })("full Doctest CI lane", (it) => {
  it.effect("runs the complete documentation Vitest corpus without Git discovery", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", baseOptions);

      const commands = spawnLines(fullDoctest);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toContain("cache execute -- run doctest");
      expect(commands[0]).toContain("--summarize");
      expect(commands[0]).not.toContain("--affected");
    })
  );
});

const fallow = ciSpawner([]);
const fallowReports: ReadonlyArray<readonly [string, string]> = [
  [".beep/fallow/audit.check.json", "{}"],
  [".beep/fallow/dead-code.check.json", "{}"],
  [".beep/fallow/health.check.json", "{}"],
];

it.layer(ciExecutionLayer(fallow, fallowReports), { timeout: "10 seconds" })("Fallow CI lane execution", (it) => {
  it.effect("runs blocking and advisory sublanes before validating blocking envelopes", () =>
    Effect.gen(function* () {
      yield* runCiLane("fallow", CiLaneRunOptions.make({ ...baseOptions, validateEnvelopes: true }));

      const commands = spawnLines(fallow);
      expect(commands).toHaveLength(14);
      expect(commands[0]).toContain("cache execute -- run fallow:audit:check");
      expect(commands[1]).toContain("cache execute -- run fallow:dead-code:check");
      expect(commands[2]).toContain("cache execute -- run fallow:health:check");
      expect(commands[11]).toContain("fallow envelope-check .beep/fallow/audit.check.json");
      expect(commands[13]).toContain("fallow envelope-check .beep/fallow/health.check.json");
    })
  );
});

const failedInventory = ciSpawner([], "jsdoc:inventory:check");
it.layer(ciExecutionLayer(failedInventory), { timeout: "10 seconds" })("JSDoc inventory dependency", (it) => {
  it.effect("does not compare a stale inventory after the Turbo inventory task fails", () =>
    Effect.gen(function* () {
      const result = yield* runCiLane("jsdoc-ratchet", baseOptions).pipe(Effect.exit);
      result.pipe(Exit.isFailure, assertTrue);
      const commands = spawnLines(failedInventory);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toContain("cache execute -- run jsdoc:inventory:check");
    })
  );
});

describe("public CI coverage lane dispatch", () => {
  it.layer(PartitionLaneLayer, { timeout: "10 seconds" })((it) => {
    it.effect("routes comparison-only coverage without invoking a producer", () =>
      Effect.gen(function* () {
        const comparison = vi.spyOn(CiCoverage, "runCiCoverageComparison").mockReturnValue(Effect.sync(constUndefined));
        const producer = vi.spyOn(CiCoverage, "runCiCoveragePartition").mockReturnValue(Effect.void);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            comparison.mockRestore();
            producer.mockRestore();
          })
        );
        const repoRoot = yield* findRepoRoot();
        const options = CiLaneRunOptions.make({
          ...baseOptions,
          compareOnly: true,
          coverageInput: ".beep/downloaded-coverage",
        });
        yield* runCiLane("coverage", options);
        expect(comparison).toHaveBeenCalledExactlyOnceWith(repoRoot, options);
        expect(producer).not.toHaveBeenCalled();

        const error = yield* runCiLane("lint", options).pipe(Effect.flip);
        expect(error._tag).toBe("CiCommandError");
        expect(error.message).toContain("must be used together on the coverage lane");
        expect(comparison).toHaveBeenCalledTimes(1);
        expect(producer).not.toHaveBeenCalled();
      })
    );

    it.effect("passes Labs check and lint work while removing the duplicate test target", () =>
      Effect.gen(function* () {
        const labs = vi.spyOn(CiCoverage, "runCiLabsCoverage").mockReturnValue(Effect.void);
        yield* Effect.addFinalizer(() => Effect.sync(() => labs.mockRestore()));
        const repoRoot = yield* findRepoRoot();
        const options = CiLaneRunOptions.make({
          ...baseOptions,
          coverageOutput: ".beep/labs-coverage",
          coverageOnly: true,
        });
        const original = ciLaneStepsForTesting(repoRoot, "labs", options);
        yield* runCiLane("labs", options);
        expect(labs).toHaveBeenCalledTimes(1);
        const [actualRoot, actualOptions, checks] = firstOf(labs.mock.calls);
        expect(actualRoot).toBe(repoRoot);
        expect(actualOptions).toEqual(options);
        expect(A.map(checks, (step) => step.label)).toEqual(A.map(original, (step) => step.label));
        expect(A.map(checks, (step) => step.args)).toEqual(
          A.map(original, (step) => A.filter(step.args, (argument) => argument !== "test"))
        );
        expect(A.flatMap(original, (step) => step.args)).toContain("test");
        expect(A.flatMap(checks, (step) => step.args)).not.toContain("test");
        expect(A.flatMap(checks, (step) => step.args)).toEqual(expect.arrayContaining(["check", "lint"]));
      })
    );

    it.effect("adds ordinary coverage owners to the unit selection and leaves Labs to its own lane", () =>
      Effect.gen(function* () {
        const repoRoot = yield* findRepoRoot();
        const path = yield* Path.Path;
        const workspaces = yield* workspaceManifests(repoRoot);
        const packageName = firstOf(partitionPackages("unit-a"));
        const workspace = O.getOrThrow(HashMap.get(workspaces, packageName));
        const selectedOwner = CoverageScopeOwner.make({
          packageName,
          packagePath: path.relative(repoRoot, workspace.dir),
          hasCoverage: true,
        });
        const selectedPlan = CiCoverageArtifactPlan.make({
          identity: coverageDispatchIdentity,
          scoped: true,
          owners: [
            selectedOwner,
            CoverageScopeOwner.make({
              packageName: "@beep/fixture-lab",
              packagePath: "apps/labs/fixture-lab",
              hasCoverage: true,
            }),
          ],
        });
        const planner = vi.spyOn(CiCoverage, "ciCoveragePlan").mockReturnValue(Effect.succeed(selectedPlan));
        const producer = vi.spyOn(CiCoverage, "runCiCoveragePartition").mockReturnValue(Effect.void);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            planner.mockRestore();
            producer.mockRestore();
          })
        );
        const options = CiLaneRunOptions.make({
          ...baseOptions,
          affected: true,
          partition: "unit-a",
          coverageOutput: ".beep/unit-a-coverage",
        });
        yield* withPartitionShim({ dryRunOutput: turboDryRunOutput("test", []) }, ({ commandLogPath }) =>
          Effect.gen(function* () {
            yield* runCiLane("test-unit", options);
            const fs = yield* FileSystem.FileSystem;
            const readFileString10 = yield* fs.readFileString(commandLogPath);
            const commands = pipe(readFileString10, Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(1);
            expect(firstOf(commands)).toContain("--dry-run=json");
          })
        );
        expect(planner).toHaveBeenCalledExactlyOnceWith(repoRoot, options);
        expect(producer).toHaveBeenCalledTimes(1);
        const [actualRoot, actualOptions, actualPlan, proof, step] = firstOf(producer.mock.calls);
        expect(actualRoot).toBe(repoRoot);
        expect(actualOptions).toEqual(options);
        expect(actualPlan).toEqual(selectedPlan);
        expect(proof.packages).toEqual([packageName]);
        expect(proof.selectedTaskCount).toBe(1);
        expect(proof.partitionTaskCount).toBe(1);
        assertDefined(step);
        expect(step.command).toBe("bunx");
        expect(step.cwd).toBe(repoRoot);
        expect(step.args).toContain(`--filter=${packageName}`);
        expect(step.args).not.toContain("--filter=@beep/fixture-lab");
      })
    );

    it.effect("seals an empty affected unit partition without creating an execution step", () =>
      Effect.gen(function* () {
        const selectedPlan = CiCoverageArtifactPlan.make({
          identity: coverageDispatchIdentity,
          scoped: true,
          owners: [],
        });
        const planner = vi.spyOn(CiCoverage, "ciCoveragePlan").mockReturnValue(Effect.succeed(selectedPlan));
        const producer = vi.spyOn(CiCoverage, "runCiCoveragePartition").mockReturnValue(Effect.void);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            planner.mockRestore();
            producer.mockRestore();
          })
        );
        const repoRoot = yield* findRepoRoot();
        const options = CiLaneRunOptions.make({
          ...baseOptions,
          affected: true,
          partition: "unit-a",
          coverageOutput: ".beep/unit-a-coverage",
        });
        yield* withPartitionShim({ dryRunOutput: turboDryRunOutput("test", []) }, () =>
          runCiLane("test-unit", options)
        );
        expect(producer).toHaveBeenCalledTimes(1);
        const [actualRoot, actualOptions, actualPlan, proof, step] = firstOf(producer.mock.calls);
        expect(actualRoot).toBe(repoRoot);
        expect(actualOptions).toEqual(options);
        expect(actualPlan).toEqual(selectedPlan);
        expect(proof.packages).toEqual([]);
        expect(proof.selectedTaskCount).toBe(0);
        expect(proof.partitionTaskCount).toBe(0);
        expect(step).toBeUndefined();
        const logLines11 = yield* TestConsole.logLines;
        expect(A.join(A.filter(logLines11, P.isString), "\n")).toContain(
          "test-unit unit-a: partition has no selected tasks (skipped)"
        );
      })
    );
  });
});
