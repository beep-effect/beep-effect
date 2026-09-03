import {
  CI_LANE_DESCRIPTORS,
  CI_LANE_ID_VALUES,
  CI_LANE_PARTITIONS,
  CiLanePartition,
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLanePartitionArgsForTesting,
  ciLaneStepsForTesting,
  ciLocalLaneInputsForTesting,
  ciLocalStepsForTesting,
  docgenLaneModeForChangedPaths,
  doctestStepForTesting,
  proveCiLanePartition,
  runCiLane,
} from "@beep/repo-cli/commands/Ci";
import {
  isLabsWorkspaceDir,
  readTurboCacheEnvironment,
  resolveTurboCachePlan,
  turboCachePlanArgs,
} from "@beep/repo-cli/test/SharedInternals";
import { FsUtilsLive, findRepoRoot, resolveWorkspacePackages } from "@beep/repo-utils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem, HashMap, Layer, Order, Path, pipe, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { parseDocument } from "yaml";

const REPO_ROOT = "/repo";
const MERGE_BASE_SHA = "mergebase1234";
const encoder = new TextEncoder();
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

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
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: Bun.env.CI === "true" }));

const commandHandle = (output = "", exitCode = 0) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const gitStubResult = (
  command: ChildProcess.StandardCommand,
  changedFiles: ReadonlyArray<string>,
  sources: ReadonlyArray<readonly [string, string]>,
  gitShowResults: ReadonlyArray<readonly [string, string, number?]>,
  lsFilesExitCode: number,
  mergeBaseResult: readonly [output: string, exitCode?: number]
): readonly [output: string, exitCode: number] => {
  if (command.command !== "git") return ["", 0] as const;
  if (command.args[0] === "diff") return [A.join(changedFiles, "\n"), 0] as const;
  const trackedListing = A.join(
    A.map(sources, ([file]) => file),
    "\n"
  );
  if (command.args[0] === "ls-files") return [trackedListing, lsFilesExitCode] as const;
  if (command.args[0] === "merge-base") return [mergeBaseResult[0], mergeBaseResult[1] ?? 0] as const;
  if (command.args[0] === "show") {
    return O.match(
      A.findFirst(gitShowResults, ([revisionPath]) => command.args[1] === revisionPath),
      {
        onNone: () => ["", 0] as const,
        onSome: ([, content, code]) => [content, code ?? 0] as const,
      }
    );
  }
  return [trackedListing, 0] as const;
};

const doctestCiLayer = (
  changedFiles: ReadonlyArray<string>,
  sources: ReadonlyArray<readonly [string, string]>,
  spawned: Array<string>,
  lsFilesExitCode = 0,
  gitShowResults: ReadonlyArray<readonly [revisionPath: string, content: string, exitCode?: number]> = A.empty(),
  mergeBaseResult: readonly [output: string, exitCode?: number] = [MERGE_BASE_SHA]
) => {
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
  const processLayer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("the CI lane test never spawns a piped command");
      }
      spawned.push(A.join([command.command, ...command.args], " "));
      const [output, exitCode] = gitStubResult(
        command,
        changedFiles,
        sources,
        gitShowResults,
        lsFilesExitCode,
        mergeBaseResult
      );
      return Effect.succeed(commandHandle(output, exitCode));
    })
  );
  const fileSystemAndPath = Layer.merge(fileSystemLayer, Path.layer);
  return Layer.mergeAll(
    fileSystemAndPath,
    FsUtilsLive.pipe(Layer.provide(fileSystemAndPath)),
    processLayer,
    TestConsole.layer
  );
};

const firstOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.head(items));
const lastOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.last(items));

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
  schemaVersion: S.Literal("branch-protection-contexts/v1"),
  capturedAt: S.String,
  repository: S.Literal("beep-effect/beep-effect"),
  branch: S.Literal("main"),
  rulesetId: S.Literal(10240248),
  rulesetName: S.String,
  enforcement: S.Literal("active"),
  strictRequiredStatusChecksPolicy: S.Literal(false),
  requiredStatusChecks: S.Array(S.String),
});
const decodeBranchProtectionContextSnapshot = S.decodeUnknownEffect(S.fromJsonString(BranchProtectionContextSnapshot));
const branchProtectionContextSnapshotUrl = new URL(
  "../../../../../goals/ship-velocity/research/branch-protection-contexts.json",
  import.meta.url
);
const checkWorkflowUrl = new URL("../../../../../.github/workflows/check.yml", import.meta.url);
const LiveRepoLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));
const PartitionLaneLayer = Layer.merge(LiveRepoLayer, TestConsole.layer);

// Tests build the layer in a scope instead of Effect.provide so the effect-lsp
// entry-point rule (TS377032) stays satisfied, mirroring the sibling CLI tests.
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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

const withPartitionShim = <A, E, R>(
  options: PartitionShimOptions,
  use: (fixture: { readonly commandLogPath: string; readonly tempDir: string }) => Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectory();
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
      yield* Effect.addFinalizer(() => fs.remove(tempDir, { force: true, recursive: true }).pipe(Effect.orDie));

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
    })
  );

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
    A.flatMap((partition) => partition.packages),
    A.sort(Order.String)
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
    expect(A.length(CI_LANE_DESCRIPTORS)).toBe(25);
  });

  it("covers every runnable lane id", () => {
    const descriptorIds = A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id);
    const missing = A.filter(CI_LANE_ID_VALUES, (laneId) => !A.contains(descriptorIds, laneId));
    expect(missing).toEqual([]);
  });

  it.effect("matches the exact captured required-check context set", () =>
    Effect.gen(function* () {
      const snapshot = yield* Effect.tryPromise(() => Bun.file(branchProtectionContextSnapshotUrl).text()).pipe(
        Effect.flatMap(decodeBranchProtectionContextSnapshot)
      );
      const requiredContexts = pipe(
        CI_LANE_DESCRIPTORS,
        A.filter((descriptor) => descriptor.required),
        A.map((descriptor) => descriptor.contextName),
        A.dedupe,
        A.sort(Order.String)
      );
      expect(requiredContexts).toEqual(A.sort(snapshot.requiredStatusChecks, Order.String));
    })
  );

  it("keeps the ecosystem contracts context visible but non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "ecosystem"));
    expect(descriptor.contextName).toBe("Ecosystem Contracts");
    expect(descriptor.required).toBe(false);
  });

  it("keeps the JSDoc ratchet visible but non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "jsdoc-ratchet"));
    expect(descriptor.contextName).toBe("JSDoc Ratchet");
    expect(descriptor.required).toBe(false);
  });

  // lab-apps-lifecycle P2 (ratified row 10): the labs lane is PERMANENTLY
  // non-required — its context must never join ruleset 10240248.
  it("keeps the labs lane visible, workflow-gated, and permanently non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "labs"));
    expect(descriptor.contextName).toBe("Labs");
    expect(descriptor.required).toBe(false);
    expect(descriptor.laneClass).toBe("workflow-gated");
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
      { id: "lint-a", packages: 67, weightSeconds: 1132 },
      { id: "lint-b", packages: 67, weightSeconds: 1134 },
      { id: "repo-cli", packages: 1, weightSeconds: 879 },
      { id: "unit-a", packages: 66, weightSeconds: 1214 },
      { id: "unit-b", packages: 67, weightSeconds: 1214 },
    ]);
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

  it.effect("fails closed for a missing placement and a duplicate assignment", () =>
    Effect.gen(function* () {
      const lintPartitions = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint");
      const allLintPackages = A.flatMap(lintPartitions, (partition) => partition.packages);
      const lintA = O.getOrThrow(A.findFirst(lintPartitions, (partition) => partition.id === "lint-a"));
      const lintB = O.getOrThrow(A.findFirst(lintPartitions, (partition) => partition.id === "lint-b"));
      const firstLintA = O.getOrThrow(A.head(lintA.packages));
      const missingTable = A.map(CI_LANE_PARTITIONS, (partition) =>
        partition.id === "lint-a"
          ? CiLanePartition.make({ ...partition, packages: A.drop(partition.packages, 1) })
          : partition
      );
      const duplicateTable = A.map(CI_LANE_PARTITIONS, (partition) =>
        partition.id === "lint-b"
          ? CiLanePartition.make({ ...partition, packages: A.prepend(partition.packages, firstLintA) })
          : partition
      );

      const missing = yield* proveCiLanePartition(
        "lint",
        "lint-a",
        allLintPackages,
        allLintPackages,
        allLintPackages,
        false,
        missingTable
      ).pipe(Effect.flip);
      expect(missing.reason).toBe("missing-package");
      expect(missing.message).toContain(firstLintA);

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
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

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

  it.effect("makes the live non-labs task inventory a complete disjoint union", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const path = yield* Path.Path;
      const workspaces = yield* resolveWorkspacePackages(repoRoot);
      const workspaceEntries = A.fromIterable(HashMap.entries(workspaces));
      const workspacePackageNames = A.map(workspaceEntries, ([name]) => name);

      for (const [laneId, task, partition] of [
        ["lint", "lint", "lint-a"],
        ["test-unit", "test", "repo-cli"],
      ] as const) {
        const taskPackageNames = pipe(
          workspaceEntries,
          A.filter(([, workspace]) => {
            const relativeDir = Str.replace(/\\/g, "/")(path.relative(repoRoot, workspace.dir));
            return !isLabsWorkspaceDir(relativeDir) && R.has(workspace.scripts, task);
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
        const assignments = pipe(
          CI_LANE_PARTITIONS,
          A.filter((entry) => entry.lane === laneId),
          A.flatMap((entry) => entry.packages)
        );

        expect(A.length(A.dedupe(assignments))).toBe(A.length(assignments));
        expect(A.sort(assignments, Order.String)).toEqual(taskPackageNames);
        expect(proof.selectedTaskCount).toBe(134);
      }
    }).pipe(provideScopedLayer(LiveRepoLayer))
  );

  it.effect("keeps literal required aggregators and fails every non-success shard result", () =>
    Effect.gen(function* () {
      const workflowText = yield* Effect.tryPromise(() => Bun.file(checkWorkflowUrl).text());
      const workflow = parseDocument(workflowText);
      expect(workflow.errors).toHaveLength(0);
      expect(workflowText).not.toMatch(/ci lane (?:lint|test-unit)[^\n]*--force/u);
      expect(workflow.getIn(["jobs", "lint", "name"])).toBe("Lint");
      expect(workflow.getIn(["jobs", "lint", "if"])).toBe("${{ always() }}");
      expect(workflow.getIn(["jobs", "test-unit", "name"])).toBe("Test Unit");
      expect(workflow.getIn(["jobs", "test-unit", "if"])).toBe("${{ always() }}");
      expect(workflow.getIn(["jobs", "lint-shard", "strategy", "fail-fast"])).toBe(false);
      expect(workflow.getIn(["jobs", "test-unit-shard", "strategy", "fail-fast"])).toBe(false);

      const lintGate = String(workflow.getIn(["jobs", "lint", "steps", 0, "run"]));
      const unitGate = String(workflow.getIn(["jobs", "test-unit", "steps", 0, "run"]));
      expect(lintGate).toContain('needs.lint-shard.result }}" != "success"');
      expect(unitGate).toContain('needs.test-unit-shard.result }}" != "success"');
      expect(lintGate).toContain("exit 1");
      expect(unitGate).toContain("exit 1");
    })
  );
});

describe("partitioned CI lane execution", () => {
  it.effect("proves and executes a full lint partition with exact package tasks", () =>
    Effect.gen(function* () {
      const selectedPackages = lanePackages("lint");
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

          const commands = pipe(yield* fs.readFileString(commandLogPath), Str.split("\n"), A.filter(Str.isNonEmpty));
          expect(commands).toHaveLength(2);
          const selection = firstOf(commands);
          const execution = lastOf(commands);
          expect(selection).toContain("turbo run lint");
          expect(selection).toContain("--filter=!./apps/labs/** --only --dry-run=json");
          expect(selection).not.toContain("--affected");
          expect(execution).toContain(`turbo run ${firstPackage}#lint`);
          expect(execution).toContain("--only --concurrency=2 --filter=!./apps/labs/**");
          expect(execution).toContain(`--filter=${firstPackage}`);
          expect(execution).toContain("--force --summarize");
          expect(execution).not.toContain("--affected");

          const output = A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n");
          expect(output).toContain("lint partition union proved: 134 executable tasks, 134 selected, 67 in lint-a");
        })
      );
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

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
        runCiLane("lint", CiLaneRunOptions.make({ ...baseOptions, affected: true, dryRun: true, partition: "lint-a" }))
      );
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

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
              partition: "repo-cli",
            })
          );

          const commands = pipe(yield* fs.readFileString(commandLogPath), Str.split("\n"), A.filter(Str.isNonEmpty));
          expect(commands).toHaveLength(1);
          expect(firstOf(commands)).toContain("turbo run test");
          expect(firstOf(commands)).toContain("--affected --filter=!./apps/labs/** --only --dry-run=json");

          const output = A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n");
          expect(output).toContain("test-unit partition union proved: 134 executable tasks, 1 selected, 0 in repo-cli");
          expect(output).toContain("test-unit repo-cli: partition has no selected tasks (skipped)");
        })
      );
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

  it.effect("completes a successful partition dry run without execution", () =>
    Effect.gen(function* () {
      yield* withPartitionShim(
        { dryRunOutput: turboDryRunOutput("test", lanePackages("test-unit")) },
        ({ commandLogPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* runCiLane(
              "test-unit",
              CiLaneRunOptions.make({ ...baseOptions, dryRun: true, partition: "repo-cli" })
            );

            const commands = pipe(yield* fs.readFileString(commandLogPath), Str.split("\n"), A.filter(Str.isNonEmpty));
            expect(commands).toHaveLength(1);
            const output = A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n");
            expect(output).toContain("test-unit repo-cli: dry-run proof complete; no tasks executed");
          })
      );
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

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
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

  it.effect("surfaces a non-zero partition execution as a quality task failure", () =>
    Effect.gen(function* () {
      const selectedPackage = firstOf(partitionPackages("repo-cli"));
      const error = yield* withPartitionShim(
        {
          dryRunOutput: turboDryRunOutput("test", [selectedPackage]),
          executionExitCode: 7,
        },
        () =>
          runCiLane("test-unit", CiLaneRunOptions.make({ ...baseOptions, affected: true, partition: "repo-cli" })).pipe(
            Effect.flip
          )
      );

      expect(error._tag).toBe("QualityTaskGroupFailed");
      if (error._tag === "QualityTaskGroupFailed") {
        expect(error.exitCode).toBe(7);
        expect(error.label).toBe("ci:test-unit:repo-cli");
      }
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );

  it.effect("maps an unreadable workspace inventory to the typed partition error", () =>
    Effect.gen(function* () {
      const selectedPackage = firstOf(partitionPackages("repo-cli"));
      const error = yield* withPartitionShim(
        { dryRunOutput: turboDryRunOutput("test", [selectedPackage]) },
        ({ tempDir }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(path.join(tempDir, ".git"), { recursive: true });
            return yield* withWorkingDirectory(
              tempDir,
              runCiLane("test-unit", CiLaneRunOptions.make({ ...baseOptions, partition: "repo-cli" })).pipe(Effect.flip)
            );
          })
      );

      expect(error._tag).toBe("CiLanePartitionError");
      if (error._tag === "CiLanePartitionError") {
        expect(error.reason).toBe("workspace-read");
        expect(error.message).toContain("Failed to resolve the current workspace package inventory");
      }
    }).pipe(provideScopedLayer(PartitionLaneLayer))
  );
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

  it("runs the first ecosystem member's type and bundle contracts explicitly", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "ecosystem", baseOptions);
    expect(A.map(steps, (step) => step.command)).toEqual(["bun", "bun"]);
    expect(A.map(steps, (step) => [...step.args])).toEqual([
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:type-test"],
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:bundle-probe"],
    ]);
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
      "run",
      "beep",
      "quality",
      "jsdoc-inventory",
      "--output-json",
      ".beep/ci/jsdoc-documentation.inventory.jsonc",
      "--output-markdown",
      ".beep/ci/jsdoc-documentation.inventory.md",
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

  it("builds exact full and affected Doctest argv", () => {
    const full = firstOf(doctestStepForTesting(REPO_ROOT, undefined));
    expect(full.command).toBe("bunx");
    expect([...full.args]).toEqual(["vitest", "run", "--config", "vitest.docs.ts"]);

    const affected = firstOf(doctestStepForTesting(REPO_ROOT, ["apps/a/src/index.ts", "packages/z/src/index.ts"]));
    expect([...affected.args]).toEqual([
      "vitest",
      "run",
      "--config",
      "vitest.docs.ts",
      "apps/a/src/index.ts",
      "packages/z/src/index.ts",
    ]);
    expect(doctestStepForTesting(REPO_ROOT, [])).toEqual([]);
  });

  it("always runs the changeset graph and appends changeset status on request", () => {
    const withoutFlag = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", baseOptions);
    expect(A.map(withoutFlag, (step) => step.label)).toEqual(["ci:repo-sanity:changeset-graph", "ci:repo-sanity"]);
    expect([...firstOf(withoutFlag).args]).toEqual(["run", "beep", "quality", "changeset-graph"]);

    const withFlag = ciLaneStepsForTesting(
      REPO_ROOT,
      "repo-sanity",
      CiLaneRunOptions.make({ ...baseOptions, changesetStatus: true })
    );
    expect(A.map(withFlag, (step) => step.label)).toEqual([
      "ci:repo-sanity:changeset-graph",
      "ci:repo-sanity",
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
    expect(lastLabel).toBe("ci:fallow:envelope-check:dead-code");
  });

  it("builds the property lane with the 400-run floor, fixed seed, and cache-partitioning env", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "property", prShapeOptions));
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "test:property",
      ...expectedTurboCacheArgs(["--concurrency=4", "--affected", "--summarize"]),
      "--concurrency=4",
      "--affected",
      "--summarize",
    ]);
    expect(step.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708", TURBO_SCM_BASE: "origin/main" });

    const deep = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, runs: "1000" }))
    );
    expect(deep.env).toEqual({ BEEP_FC_NUM_RUNS: "1000", BEEP_FC_SEED: "20260708" });

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

    const summarized = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "build", CiLaneRunOptions.make({ ...baseOptions, summarize: true }))
    );
    expect([...summarized.args]).toEqual(["run", "build", "--", "--summarize"]);
  });
});

describe("ciLocalStepsForTesting", () => {
  const branchPlan = CiLocalStepPlan.make({ affected: false, base: "origin/main", onMainBranch: false });

  it("dispatches each lane through beep ci lane", () => {
    const step = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["knip"], branchPlan));
    expect([...step.args]).toEqual(["run", "beep", "ci", "lane", "knip"]);
  });

  it("pairs inner-lane ids with steps and honest absent executor digests", () => {
    const selection = ["knip"] as const;
    const steps = ciLocalStepsForTesting(REPO_ROOT, selection, branchPlan);
    const inputs = ciLocalLaneInputsForTesting(selection, steps);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.[0]).toBe("knip");
    expect(inputs[0]?.[1]).toBe(steps[0]);
    expect(inputs[0]?.[2]).toStrictEqual(O.none());
  });

  it("dispatches the labs lane bare, without affected shaping", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const step = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["labs"], affectedPlan));
    expect([...step.args]).toEqual(["run", "beep", "ci", "lane", "labs"]);
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

const dependentDoctestCommands = A.empty<string>();
const dependentDoctestSources: ReadonlyArray<readonly [string, string]> = [
  ["packages/a/package.json", '{"name":"@beep/a"}'],
  ["packages/a/src/marked.ts", "const markedA = import.meta.vitest;"],
  ["packages/a/src/unmarked.ts", "export const unmarked = true;"],
  ["packages/b/package.json", '{"name":"@beep/b","dependencies":{"@beep/a":"workspace:*"}}'],
  ["packages/b/src/marked.tsx", "const markedB = import.meta.vitest;"],
  ["packages/c/package.json", '{"name":"@beep/c"}'],
  ["packages/c/src/marked.ts", "const markedC = import.meta.vitest;"],
  ["apps/demo/src/marked.ts", "const markedApp = import.meta.vitest;"],
];

layer(
  doctestCiLayer(
    ["packages/a/src/unmarked.ts", "apps\\demo\\src\\marked.ts"],
    dependentDoctestSources,
    dependentDoctestCommands
  )
)("dependent-aware affected Doctest CI lane", (it) => {
  it.effect("selects marked files in a changed package and its transitive dependents plus direct app changes", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(dependentDoctestCommands).toHaveLength(3);
      expect(dependentDoctestCommands[0]).toBe("git diff --name-only origin/main...HEAD -- packages apps");
      expect(dependentDoctestCommands[1]).toContain("git ls-files -- :(glob)packages/**/package.json");
      expect(dependentDoctestCommands[2]).toContain(
        "bunx vitest run --config vitest.docs.ts apps/demo/src/marked.ts packages/a/src/marked.ts packages/b/src/marked.tsx"
      );
      expect(dependentDoctestCommands[2]).not.toContain("packages/c/src/marked.ts");
    })
  );
});

const autoDocgenCommands = A.empty<string>();
layer(doctestCiLayer(["packages/a/src/index.ts"], dependentDoctestSources, autoDocgenCommands))(
  "automatic Docgen CI lane",
  (it) => {
    it.effect("derives the affected mode from the base-to-head diff and executes it", () =>
      Effect.gen(function* () {
        yield* runCiLane("docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" }));

        expect(autoDocgenCommands[0]).toBe("git diff --name-only origin/main...HEAD");
        expect(autoDocgenCommands[1]).toContain("bun run docgen:local -- --base origin/main --head HEAD");
      })
    );
  }
);

const inertDocgenCommands = A.empty<string>();
layer(doctestCiLayer(["scripts/release.sh"], dependentDoctestSources, inertDocgenCommands))(
  "automatic inert Docgen CI lane",
  (it) => {
    it.effect("skips execution when the diff has no Docgen inputs", () =>
      Effect.gen(function* () {
        yield* runCiLane("docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "auto" }));

        expect(inertDocgenCommands).toEqual(["git diff --name-only origin/main...HEAD"]);
      })
    );
  }
);

const manifestDoctestCommands = A.empty<string>();

layer(doctestCiLayer(["packages/c/package.json"], dependentDoctestSources, manifestDoctestCommands))(
  "manifest-affected Doctest CI lane",
  (it) => {
    it.effect("selects only the changed unrelated package for a manifest change", () =>
      Effect.gen(function* () {
        yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

        expect(lastOf(manifestDoctestCommands)).toContain(
          "bunx vitest run --config vitest.docs.ts packages/c/src/marked.ts"
        );
        expect(lastOf(manifestDoctestCommands)).not.toContain("packages/a/src/marked.ts");
        expect(lastOf(manifestDoctestCommands)).not.toContain("packages/b/src/marked.tsx");
      })
    );
  }
);

const emptyAffectedDoctestCommands = A.empty<string>();

layer(doctestCiLayer([], dependentDoctestSources, emptyAffectedDoctestCommands))(
  "empty affected Doctest CI lane",
  (it) => {
    it.effect("logs the early exit for an empty diff without workspace discovery or Vitest", () =>
      Effect.gen(function* () {
        yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

        expect(emptyAffectedDoctestCommands).toEqual(["git diff --name-only origin/main...HEAD -- packages apps"]);
        expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
          "[ci] doctest: no marked affected source files (skipped)"
        );
      })
    );
  }
);

const deletedAffectedDoctestCommands = A.empty<string>();

layer(doctestCiLayer(["packages/a/src/deleted.ts"], dependentDoctestSources, deletedAffectedDoctestCommands))(
  "deleted affected Doctest path",
  (it) => {
    it.effect("expands the owning package and dependents for a delete-only diff without running the deleted path", () =>
      Effect.gen(function* () {
        yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

        expect(deletedAffectedDoctestCommands).toHaveLength(3);
        expect(lastOf(deletedAffectedDoctestCommands)).toContain(
          "bunx vitest run --config vitest.docs.ts packages/a/src/marked.ts packages/b/src/marked.tsx"
        );
        expect(lastOf(deletedAffectedDoctestCommands)).not.toContain("packages/a/src/deleted.ts");
        expect(lastOf(deletedAffectedDoctestCommands)).not.toContain("packages/c/src/marked.ts");
      })
    );
  }
);

const deletedWithUnrelatedChangeCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/a/src/deleted.ts", "packages/c/src/marked.ts"],
    dependentDoctestSources,
    deletedWithUnrelatedChangeCommands
  )
)("deleted Doctest path with an unrelated change", (it) => {
  it.effect("retains deleted-path dependent expansion alongside an unrelated changed package", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(lastOf(deletedWithUnrelatedChangeCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/a/src/marked.ts packages/b/src/marked.tsx packages/c/src/marked.ts"
      );
      expect(lastOf(deletedWithUnrelatedChangeCommands)).not.toContain("packages/a/src/deleted.ts");
    })
  );
});

const excludedDoctestSourceCommands = A.empty<string>();
const excludedDoctestSources: ReadonlyArray<readonly [string, string]> = [
  ...dependentDoctestSources,
  ["packages/a/src/types.d.ts", "const markedDeclaration = import.meta.vitest;"],
  ["packages/a/src/test/fixtures/marked.ts", "const markedFixture = import.meta.vitest;"],
  ["packages/a/node_modules/dep/src/marked.ts", "const markedDependency = import.meta.vitest;"],
];

layer(doctestCiLayer(["packages/a/src/marked.ts"], excludedDoctestSources, excludedDoctestSourceCommands))(
  "excluded affected Doctest sources",
  (it) => {
    it.effect("excludes declarations, fixtures, and node_modules while retaining real dependent sources", () =>
      Effect.gen(function* () {
        yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

        expect(lastOf(excludedDoctestSourceCommands)).toContain(
          "bunx vitest run --config vitest.docs.ts packages/a/src/marked.ts packages/b/src/marked.tsx"
        );
        expect(lastOf(excludedDoctestSourceCommands)).not.toContain("packages/a/src/types.d.ts");
        expect(lastOf(excludedDoctestSourceCommands)).not.toContain("packages/a/src/test/fixtures/marked.ts");
        expect(lastOf(excludedDoctestSourceCommands)).not.toContain("packages/a/node_modules/dep/src/marked.ts");
      })
    );
  }
);

const fullDoctestCommands = A.empty<string>();

layer(doctestCiLayer([], [], fullDoctestCommands))("full Doctest CI lane", (it) => {
  it.effect("runs the complete documentation Vitest corpus without Git discovery", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "full" }));

      expect(fullDoctestCommands).toHaveLength(1);
      expect(fullDoctestCommands[0]).toContain("bunx vitest run --config vitest.docs.ts");
    })
  );
});

const disabledDoctestCommands = A.empty<string>();

layer(doctestCiLayer([], [], disabledDoctestCommands))("disabled Doctest CI lane", (it) => {
  it.effect("takes the no-step branch without Git discovery or Vitest", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "none" }));

      expect(disabledDoctestCommands).toEqual([]);
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
        "[ci] doctest: no marked affected source files (skipped)"
      );
    })
  );
});

const fallowCommands = A.empty<string>();
const fallowReports: ReadonlyArray<readonly [string, string]> = [
  [".beep/fallow/audit.check.json", "{}"],
  [".beep/fallow/dead-code.check.json", "{}"],
];

layer(doctestCiLayer([], fallowReports, fallowCommands))("Fallow CI lane execution", (it) => {
  it.effect("runs blocking and advisory sublanes before validating blocking envelopes", () =>
    Effect.gen(function* () {
      yield* runCiLane("fallow", CiLaneRunOptions.make({ ...baseOptions, validateEnvelopes: true }));

      expect(fallowCommands).toHaveLength(14);
      expect(fallowCommands[0]).toContain("beep quality fallow audit --check");
      expect(fallowCommands[1]).toContain("beep quality fallow dead-code --check");
      expect(fallowCommands[2]).toContain("beep quality fallow health --advisory");
      expect(fallowCommands[12]).toContain("fallow envelope-check .beep/fallow/audit.check.json");
      expect(fallowCommands[13]).toContain("fallow envelope-check .beep/fallow/dead-code.check.json");
    })
  );
});

const configInputDoctestCommands = A.empty<string>();
const configInputDoctestSources: ReadonlyArray<readonly [string, string]> = [
  ...dependentDoctestSources,
  ["packages/a/docgen.json", "{}"],
  ["packages/c/tsconfig.build.json", "{}"],
];

layer(
  doctestCiLayer(
    ["packages/a/docgen.json", "packages/c/tsconfig.build.json"],
    configInputDoctestSources,
    configInputDoctestCommands
  )
)("config-input affected Doctest CI lane", (it) => {
  it.effect("treats docgen.json and tsconfig changes as package inputs and expands dependents", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(lastOf(configInputDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/a/src/marked.ts packages/b/src/marked.tsx packages/c/src/marked.ts"
      );
      expect(lastOf(configInputDoctestCommands)).not.toContain("apps/demo/src/marked.ts");
    })
  );
});

const failingLsFilesDoctestCommands = A.empty<string>();

layer(doctestCiLayer(["packages/a/src/unmarked.ts"], dependentDoctestSources, failingLsFilesDoctestCommands, 128))(
  "Doctest CI lane with a failing workspace listing",
  (it) => {
    it.effect("fails with a CiCommandError when git ls-files exits non-zero", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }))
        );

        expect(Exit.isFailure(exit)).toBe(true);
        const message = Exit.match(exit, {
          onFailure: (cause) => Cause.squash(cause),
          onSuccess: () => "unexpected success",
        });
        expect(String(P.hasProperty(message, "message") ? message.message : message)).toContain(
          "git ls-files for Doctest failed with exit code 128"
        );
        expect(failingLsFilesDoctestCommands).toHaveLength(2);
      })
    );
  }
);

const deletedNestedPackageDoctestCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/a/nested/package.json", "packages/a/nested/src/helper.ts"],
    dependentDoctestSources,
    deletedNestedPackageDoctestCommands
  )
)("deleted nested package Doctest CI lane", (it) => {
  it.effect("attributes files under a deleted nested package to the enclosing tracked workspace", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(lastOf(deletedNestedPackageDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/a/src/marked.ts packages/b/src/marked.tsx"
      );
      expect(lastOf(deletedNestedPackageDoctestCommands)).not.toContain("packages/c/src/marked.ts");
      expect(lastOf(deletedNestedPackageDoctestCommands)).not.toContain("packages/a/nested/");
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
        "[ci] doctest: skipped deleted workspace manifest packages/a/nested/package.json (base content did not decode)"
      );
    })
  );
});

const deletedWorkspaceDoctestCommands = A.empty<string>();
const survivingDeletedWorkspaceSources: ReadonlyArray<readonly [string, string]> = [
  ["packages/b/package.json", '{"name":"@beep/b","dependencies":{"@beep/x":"workspace:*"}}'],
  ["packages/b/src/marked.tsx", "const markedB = import.meta.vitest;"],
  ["packages/c/package.json", '{"name":"@beep/c"}'],
  ["packages/c/src/marked.ts", "const markedC = import.meta.vitest;"],
];

layer(
  doctestCiLayer(
    ["packages/x/package.json", "packages/x/src/helper.ts"],
    survivingDeletedWorkspaceSources,
    deletedWorkspaceDoctestCommands,
    0,
    [[`${MERGE_BASE_SHA}:packages/x/package.json`, '{"name":"@beep/x"}']]
  )
)("deleted workspace Doctest CI lane", (it) => {
  it.effect("expands surviving dependents from the deleted workspace base manifest", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(deletedWorkspaceDoctestCommands).toHaveLength(5);
      expect(deletedWorkspaceDoctestCommands[2]).toBe("git merge-base origin/main HEAD");
      expect(deletedWorkspaceDoctestCommands[3]).toBe(`git show ${MERGE_BASE_SHA}:packages/x/package.json`);
      expect(lastOf(deletedWorkspaceDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/b/src/marked.tsx"
      );
      expect(lastOf(deletedWorkspaceDoctestCommands)).not.toContain("packages/c/src/marked.ts");
      expect(lastOf(deletedWorkspaceDoctestCommands)).not.toContain("packages/x/");
    })
  );
});

const unreadableDeletedWorkspaceDoctestCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/x/package.json", "packages/x/src/helper.ts", "packages/c/src/marked.ts"],
    survivingDeletedWorkspaceSources,
    unreadableDeletedWorkspaceDoctestCommands,
    0,
    [[`${MERGE_BASE_SHA}:packages/x/package.json`, "", 128]]
  )
)("unreadable deleted workspace Doctest CI lane", (it) => {
  it.effect("continues direct attributable work when the deleted base manifest cannot be read", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(lastOf(unreadableDeletedWorkspaceDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/c/src/marked.ts"
      );
      expect(lastOf(unreadableDeletedWorkspaceDoctestCommands)).not.toContain("packages/b/src/marked.tsx");
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
        "[ci] doctest: skipped deleted workspace manifest packages/x/package.json (git show exited 128)"
      );
    })
  );
});

const nonzeroMergeBaseDoctestCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/x/package.json", "packages/x/src/helper.ts"],
    survivingDeletedWorkspaceSources,
    nonzeroMergeBaseDoctestCommands,
    0,
    [["origin/main:packages/x/package.json", '{"name":"@beep/x"}']],
    [MERGE_BASE_SHA, 128]
  )
)("deleted workspace Doctest CI lane with a failing merge-base lookup", (it) => {
  it.effect("falls back to the base ref when git merge-base exits non-zero", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(nonzeroMergeBaseDoctestCommands[2]).toBe("git merge-base origin/main HEAD");
      expect(nonzeroMergeBaseDoctestCommands[3]).toBe("git show origin/main:packages/x/package.json");
      expect(lastOf(nonzeroMergeBaseDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/b/src/marked.tsx"
      );
    })
  );
});

const emptyMergeBaseDoctestCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/x/package.json", "packages/x/src/helper.ts"],
    survivingDeletedWorkspaceSources,
    emptyMergeBaseDoctestCommands,
    0,
    [["origin/main:packages/x/package.json", '{"name":"@beep/x"}']],
    [" \n"]
  )
)("deleted workspace Doctest CI lane with an empty merge-base lookup", (it) => {
  it.effect("falls back to the base ref when git merge-base returns no revision", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(emptyMergeBaseDoctestCommands[2]).toBe("git merge-base origin/main HEAD");
      expect(emptyMergeBaseDoctestCommands[3]).toBe("git show origin/main:packages/x/package.json");
      expect(lastOf(emptyMergeBaseDoctestCommands)).toContain(
        "bunx vitest run --config vitest.docs.ts packages/b/src/marked.tsx"
      );
    })
  );
});
