import {
  CiCommandError,
  CiLanePartitionProof,
  CiLanePartitionShard,
  CiLaneRunOptions,
} from "@beep/repo-cli/commands/Ci";
import {
  ciCoveragePlan,
  runCiCoverageComparison,
  runCiCoveragePartition,
  runCiLabsCoverage,
} from "@beep/repo-cli/commands/Ci/CiCoverage";
import * as Tasks from "@beep/repo-cli/commands/Quality/Tasks";
import { CiCoverageArtifactPlan, QualityTaskStep } from "@beep/repo-cli/commands/Quality/Tasks";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import {
  CoverageArtifacts,
  CoverageProducerIdentity,
  CoverageScopeOwner,
  QualityTaskConfigurationError,
  workspaceCoverageScopeOwners,
} from "@beep/repo-cli/test/Quality";
import { FsUtilsLive } from "@beep/repo-utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, beforeEach, expect, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { vi } from "vitest";
import { parseCLI } from "vitest/node";

const nativeRunCaptured = StepExec.runCaptured;

const mocks = vi.hoisted(() => ({
  plan: vi.fn(),
  run: vi.fn(),
  discover: vi.fn(),
  write: vi.fn(),
  compare: vi.fn<typeof CoverageArtifacts.compareCoverageProducerArtifacts>(),
}));

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const layer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));
const identity = CoverageProducerIdentity.make({
  executionSha: Str.repeat(40)("a"),
  baseSha: Str.repeat(40)("b"),
  runId: "123",
  runAttempt: 1,
  scopeDigest: Str.repeat(64)("c"),
});
const owner = (packageName = "@beep/repo-cli", packagePath = "packages/tool") =>
  CoverageScopeOwner.make({ packageName, packagePath, hasCoverage: true });
const plan = (owners: ReadonlyArray<CoverageScopeOwner>) =>
  CiCoverageArtifactPlan.make({ identity, owners, scoped: true });
const options = (values: Partial<CiLaneRunOptions> = {}) =>
  CiLaneRunOptions.make({
    affected: true,
    base: "base-ref",
    head: "HEAD",
    summarize: true,
    mode: "auto",
    to: "HEAD",
    last: false,
    changesetStatus: false,
    validateEnvelopes: false,
    ...values,
  });

afterEach(vi.unstubAllEnvs);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Tasks, "resolveCiCoverageArtifactPlan").mockImplementation(mocks.plan);
  vi.spyOn(Tasks, "runQualityTaskStreamingStepGroup").mockImplementation(mocks.run);
  vi.spyOn(StepExec, "runCaptured").mockImplementation(mocks.discover);
  vi.spyOn(CoverageArtifacts, "writeCoverageProducerArtifact").mockImplementation(mocks.write);
  vi.spyOn(CoverageArtifacts, "compareCoverageProducerArtifacts").mockImplementation(mocks.compare);
  for (const mock of [mocks.plan, mocks.run, mocks.discover, mocks.write, mocks.compare]) mock.mockReset();
  mocks.run.mockReturnValue(Effect.void);
  mocks.write.mockReturnValue(Effect.void);
  mocks.compare.mockReturnValue(Effect.void);
});

it.layer(layer, { timeout: "10 seconds" })("CI coverage artifact orchestration", (it) => {
  const fixture = Effect.fnUntraced(function* (
    entries: ReadonlyArray<CoverageScopeOwner> = [owner()],
    script = "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
    hasTest = true
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-coverage-" });
    yield* fs.writeFileString(
      path.join(root, "package.json"),
      yield* encode({ name: "fixture", private: true, workspaces: A.map(entries, (entry) => entry.packagePath) })
    );
    for (const entry of entries) {
      const directory = path.join(root, entry.packagePath);
      yield* fs.makeDirectory(path.join(directory, "coverage"), { recursive: true });
      yield* fs.writeFileString(path.join(directory, "coverage/stale"), "old");
      yield* fs.writeFileString(
        path.join(directory, "package.json"),
        yield* encode({
          name: entry.packageName,
          version: "0.0.0",
          scripts: {
            coverage: `${Str.replaceAll("--bun ", "")(Str.split(script, " && ")[0] ?? "")} --coverage`,
            "beep:test": script,
            "test:lambda": "bun --version",
            ...(hasTest === true ? { test: "bun run beep:test" } : {}),
          },
        })
      );
    }
    mocks.discover.mockImplementation(
      ({
        cwd,
        command,
        args,
      }: {
        readonly cwd: string;
        readonly command: string;
        readonly args: ReadonlyArray<string>;
      }) =>
        command !== "bunx"
          ? Effect.succeed({ output: command === "bun" ? "1.4.3" : "22.22.3", exitCode: 0, truncated: false })
          : encode(
              A.some(args, (arg) => /^test\/[^*]+\.test\.ts$/u.test(arg))
                ? A.map(
                    A.filter(args, (arg) => /^test\/[^*]+\.test\.ts$/u.test(arg)),
                    (file) => ({ file: path.join(cwd, file) })
                  )
                : [
                    { file: path.join(cwd, "test/b.test.ts") },
                    { file: path.join(cwd, "test/a.test.ts") },
                    { file: path.join(cwd, "test/a.test.ts") },
                  ]
            ).pipe(Effect.map((output) => ({ output, exitCode: 0, truncated: false })))
    );
    mocks.plan.mockReturnValue(Effect.succeed(plan(entries)));
    return { fs, path, root };
  });

  it.effect("seals a fresh instrumented shard with the complete configured census", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      vi.stubEnv("VITEST_COVERAGE_RATCHET", "1");
      const selected = plan([owner()]);
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "repo-cli-1",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: ["@beep/repo-cli"],
        shard: CiLanePartitionShard.make({ index: 1, total: 2 }),
      });
      const step = QualityTaskStep.make({
        label: "unit",
        command: "bunx",
        args: ["turbo"],
        cwd: root,
        env: { CUSTOM: "kept" },
      });
      yield* runCiCoveragePartition(root, options(), selected, proof, step);
      expect(yield* fs.exists(path.join(root, "packages/tool/coverage/stale"))).toBe(false);
      expect(mocks.discover).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [
            "--bun",
            "vitest",
            "list",
            "--filesOnly",
            "--passWithNoTests",
            "--exclude=test/integration/**",
            "--json",
          ],
        })
      );
      expect(mocks.run).toHaveBeenCalledTimes(2);
      expect(mocks.run).toHaveBeenNthCalledWith(1, "ci:coverage:compound-prerequisites", expect.any(Array));
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:test:@beep/repo-cli:0", [
        expect.objectContaining({
          args: expect.arrayContaining(["vitest", "run", "--coverage.provider=v8", "--shard=1/2"]),
          env: expect.objectContaining({ CUSTOM: "kept", VITEST_COVERAGE_RATCHET: undefined }),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:test:@beep/repo-cli:0", [
        expect.objectContaining({ args: expect.not.arrayContaining(["--bun", "--coverage.provider=istanbul"]) }),
      ]);
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          partitionId: "repo-cli-1",
          identity,
          packages: [
            expect.objectContaining({
              expectedTestFiles: ["packages/tool/test/a.test.ts", "packages/tool/test/b.test.ts"],
              testRuntime: "node",
              provider: "v8",
              testReportPath: "coverage/unit-results.json",
              shard: { index: 1, total: 2 },
            }),
          ],
        })
      );
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("emits an explicit empty partition without executing tests", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-a",
        selectedTaskCount: 0,
        partitionTaskCount: 0,
        packages: [],
      });
      yield* runCiCoveragePartition(root, options(), plan([]), proof, undefined);
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({ artifactRoot: ".beep/ci-coverage", packages: [] })
      );
    })
  );

  it.effect("compares all four unit partitions and selected Labs without running a producer", () =>
    Effect.gen(function* () {
      const entries = [owner(), owner("@beep/ciops", "apps/labs/ciops")];
      const { root } = yield* fixture(entries);
      yield* runCiCoverageComparison(root, options());
      const input = mocks.compare.mock.calls[0]?.[1];
      assertDefined(input);
      expect(input).toMatchObject({ artifactRoot: ".beep/ci-coverage-inputs", identity, scoped: true });
      expect(A.map(input.expectedPartitions, (partition) => partition.partitionId)).toEqual([
        "repo-cli-1",
        "repo-cli-2",
        "unit-a",
        "unit-b",
        "labs",
      ]);
      const firstHalf = input.expectedPartitions[0]?.packages[0];
      const secondHalf = input.expectedPartitions[1]?.packages[0];
      const lab = input.expectedPartitions[4]?.packages[0];
      assertDefined(firstHalf);
      assertDefined(secondHalf);
      assertDefined(lab);
      expect(firstHalf.shard).toEqual({ index: 1, total: 2 });
      expect(secondHalf.shard).toEqual({ index: 2, total: 2 });
      expect(lab.packageName).toBe("@beep/ciops");
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  // The comparison judges a row the pull request lowered against the base floor only when it
  // knows the base; the other affected coverage lanes pass it through TURBO_SCM_BASE.
  it.effect("pins the comparison to the base on affected runs only", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([owner()]);
      yield* runCiCoverageComparison(root, options());
      yield* runCiCoverageComparison(root, options({ affected: false }));
      const [affected, full] = A.map(mocks.compare.mock.calls, (call) => call[1]);
      assertDefined(affected);
      assertDefined(full);
      expect(affected.base).toBe("base-ref");
      expect(full.base).toBeUndefined();
    })
  );

  it.effect("runs Labs checks separately and instruments only selected Labs tests", () =>
    Effect.gen(function* () {
      const entries = [owner(), owner("@beep/ciops", "apps/labs/ciops")];
      const { root } = yield* fixture(entries);
      const check = QualityTaskStep.make({ label: "checks", command: "bunx", args: ["check", "lint"], cwd: root });
      yield* runCiLabsCoverage(root, options(), [check]);
      expect(mocks.run).toHaveBeenNthCalledWith(1, "ci:labs:checks", [check]);
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:coverage:compound-prerequisites", [
        expect.objectContaining({
          args: expect.arrayContaining(["build", "--filter=@beep/ciops^..."]),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(3, "ci:test:@beep/ciops:0", [
        expect.objectContaining({ args: expect.arrayContaining(["vitest", "run", "--coverage.provider=v8"]) }),
      ]);
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          partitionId: "labs",
          packages: [expect.objectContaining({ packageName: "@beep/ciops" })],
        })
      );
    })
  );

  it.effect("skips Labs checks when separately gated and still emits the empty Labs receipt", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      yield* runCiLabsCoverage(root, options({ coverageOnly: true }), []);
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.write).toHaveBeenCalledWith(root, expect.objectContaining({ partitionId: "labs", packages: [] }));
      yield* ciCoveragePlan(root, options({ affected: false }));
      expect(mocks.plan).toHaveBeenLastCalledWith(root, [], "base-ref");
    })
  );

  it.effect("rejects a filter that could bypass the authoritative owner plan", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      const error = yield* Effect.flip(ciCoveragePlan(root, options({ filter: "@beep/repo-cli" })));
      expect(error.message).toContain("--filter is not supported");
      expect(mocks.plan).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses owners without a unit test task instead of dropping them from comparison", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([owner()], undefined, false);
      const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
      expect(error.message).toContain("Coverage owners have no unit test task");
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  for (const [name, result] of [
    ["failed", { output: "[]", exitCode: 1, truncated: false }],
    ["truncated", { output: "[]", exitCode: 0, truncated: true }],
    ["invalid", { output: "not-json", exitCode: 0, truncated: false }],
  ] as const) {
    it.effect(`refuses ${name} discovery before test execution or artifact sealing`, () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        mocks.discover.mockReturnValue(Effect.succeed(result));
        const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
        expect(error._tag).toBe("CiCommandError");
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
        expect(mocks.compare).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("surfaces a typed seal diagnostic and preserves its original cause without rendering its stack", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      const original = QualityTaskConfigurationError.new(
        "Coverage artifact: missing executable source packages/tool/src/value.ts."
      );
      original.stack = "DO_NOT_RENDER_SEAL_STACK";
      mocks.write.mockReturnValue(Effect.fail(original));
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-a",
        selectedTaskCount: 0,
        partitionTaskCount: 0,
        packages: [],
      });
      const error = yield* runCiCoveragePartition(root, options(), plan([]), proof, undefined).pipe(Effect.flip);
      expect(error.message).toBe(
        "Failed to seal coverage partition unit-a.: Coverage artifact: missing executable source packages/tool/src/value.ts."
      );
      expect(error.cause).toBe(original);
      expect(error.message).not.toContain("DO_NOT_RENDER_SEAL_STACK");
      expect(mocks.write).toHaveBeenCalledOnce();
      expect(mocks.run).not.toHaveBeenCalled();
    })
  );

  it.effect("retains opaque seal failures without dumping arbitrary diagnostic or environment fields", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      const original = { message: "opaque diagnostic", environment: { fixture: "DO_NOT_RENDER_ENVIRONMENT" } };
      mocks.write.mockReturnValue(Effect.fail(original));
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-a",
        selectedTaskCount: 0,
        partitionTaskCount: 0,
        packages: [],
      });
      const error = yield* runCiCoveragePartition(root, options(), plan([]), proof, undefined).pipe(Effect.flip);
      expect(error.message).toBe("Failed to seal coverage partition unit-a.");
      expect(error.cause).toBe(original);
      expect(error.message).not.toContain("opaque diagnostic");
      expect(error.message).not.toContain("DO_NOT_RENDER_ENVIRONMENT");
    })
  );

  it.effect("refuses a missing workspace before running the selected shard", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([]);
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: ["@beep/repo-cli"],
      });
      const error = yield* Effect.flip(runCiCoveragePartition(root, options(), plan([owner()]), proof, undefined));
      expect(error.message).toContain("not a workspace");
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses an owner without a canonical test implementation", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      yield* fs.writeFileString(
        path.join(root, "packages/tool/package.json"),
        yield* encode({ name: "@beep/repo-cli", version: "0.0.0", scripts: { test: "bun run beep:test" } })
      );
      const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
      expect(error.message).toContain("canonical Vitest");
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses a missing CLI coverage script before discovering or comparing evidence", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture();
      yield* fs.writeFileString(
        path.join(root, "packages/tool/package.json"),
        yield* encode({
          name: "@beep/repo-cli",
          version: "0.0.0",
          scripts: { test: "bun run beep:test", "beep:test": "bunx --bun vitest run" },
        })
      );
      const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
      expect(error.message).toContain("canonical Vitest test script");
      expect(mocks.discover).not.toHaveBeenCalled();
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.write).not.toHaveBeenCalled();
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses an undeclared native continuation before discovering or running tests", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/infra", "infra");
      const { root, fs, path } = yield* fixture([entry]);
      yield* fs.writeFileString(
        path.join(root, "infra/package.json"),
        yield* encode({
          name: entry.packageName,
          version: "0.0.0",
          scripts: {
            coverage: "bunx vitest run --coverage",
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run && bun run test:lambda",
          },
        })
      );
      const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
      expect(error.message).toBe("Coverage owner @beep/infra has no continuation script test:lambda.");
      expect(mocks.discover).not.toHaveBeenCalled();
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.write).not.toHaveBeenCalled();
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps an unsharded selected owner in its ordinary unit partition", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/mcpb-kit", "packages/tool");
      const { root } = yield* fixture([entry]);
      yield* runCiCoverageComparison(root, options({ coverageInput: ".beep/downloaded" }));
      expect(mocks.compare).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          artifactRoot: ".beep/downloaded",
          expectedPartitions: expect.arrayContaining([
            expect.objectContaining({
              partitionId: "unit-b",
              packages: [expect.objectContaining({ packageName: "@beep/mcpb-kit" })],
            }),
          ]),
        })
      );
    })
  );

  it.effect("preserves an infrastructure script continuation once after instrumented Vitest", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/infra", "infra");
      const { root, fs, path } = yield* fixture(
        [entry],
        "bunx --bun vitest run --passWithNoTests && bun run test:lambda"
      );
      const manifestPath = path.join(root, "infra/package.json");
      yield* fs.writeFileString(
        manifestPath,
        yield* encode({
          name: entry.packageName,
          scripts: {
            coverage: "bun run beep:coverage",
            "beep:coverage": "bun run --cwd node_modules/@pulumi/gharunners build && bunx vitest run --coverage",
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run --passWithNoTests && bun run test:lambda",
            "test:lambda": `bun -e 'require("node:fs").appendFileSync("lambda.log", "called\\n")'`,
          },
        })
      );
      const preparationRoot = path.join(root, "infra/node_modules/@pulumi/gharunners");
      yield* fs.makeDirectory(preparationRoot, { recursive: true });
      yield* fs.writeFileString(
        path.join(preparationRoot, "package.json"),
        yield* encode({
          scripts: { build: `bun -e 'require("node:fs").appendFileSync("preparation.log", "called\\n")'` },
        })
      );
      mocks.run.mockImplementation((_label: string, steps: ReadonlyArray<QualityTaskStep>) =>
        Effect.forEach(
          steps,
          (step) =>
            step.command === "bun"
              ? nativeRunCaptured({
                  command: step.command,
                  args: step.args,
                  cwd: step.cwd,
                  env: step.env,
                  extendEnv: true,
                }).pipe(Effect.asVoid)
              : Effect.void,
          { discard: true }
        )
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const step = QualityTaskStep.make({
        label: "unit",
        command: "bunx",
        cwd: root,
        args: ["turbo", "run", "@beep/infra#test", "--filter=@beep/infra", "--", "--coverage"],
      });
      yield* runCiCoveragePartition(root, options(), plan([entry]), proof, step);
      expect(yield* fs.readFileString(path.join(root, "infra/lambda.log"))).toBe("called\n");
      expect(yield* fs.readFileString(path.join(preparationRoot, "preparation.log"))).toBe("called\n");
      expect(mocks.run).toHaveBeenCalledTimes(4);
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:test:@beep/infra:0:prepare", [
        expect.objectContaining({ command: "bun", args: ["run", "--cwd", "node_modules/@pulumi/gharunners", "build"] }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(3, "ci:test:@beep/infra:0", [
        expect.objectContaining({
          command: "bunx",
          args: expect.arrayContaining(["vitest", "run", "--coverage", "--coverage.provider=v8"]),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(4, "ci:test:@beep/infra:0:test:lambda", [
        expect.objectContaining({ command: "bun", args: ["run", "test:lambda"] }),
      ]);
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          packages: [
            expect.objectContaining({
              preparationCommands: [["bun", "run", "--cwd", "node_modules/@pulumi/gharunners", "build"]],
              continuationScripts: ["test:lambda"],
            }),
          ],
        })
      );
    })
  );

  it.effect("rejects a failing native script continuation before sealing", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/infra", "infra");
      const { root, fs, path } = yield* fixture([entry], "bunx --bun vitest run && bun run test:lambda");
      yield* fs.writeFileString(
        path.join(root, "infra/package.json"),
        yield* encode({
          name: entry.packageName,
          scripts: {
            coverage: "bun run beep:coverage",
            "beep:coverage": "bunx vitest run --coverage",
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run && bun run test:lambda",
            "test:lambda": "bun -e 'process.exit(7)'",
          },
        })
      );
      mocks.run.mockImplementation((_label: string, steps: ReadonlyArray<QualityTaskStep>) =>
        Effect.forEach(
          steps,
          (step) =>
            step.command === "bun"
              ? nativeRunCaptured({
                  command: step.command,
                  args: step.args,
                  cwd: step.cwd,
                  env: step.env,
                  extendEnv: true,
                }).pipe(
                  Effect.flatMap((result) =>
                    result.exitCode === 0
                      ? Effect.void
                      : Effect.fail(CiCommandError.make({ message: `Continuation exited ${result.exitCode}` }))
                  )
                )
              : Effect.void,
          { discard: true }
        )
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const failure = yield* runCiCoveragePartition(root, options(), plan([entry]), proof, undefined).pipe(Effect.flip);
      expect(failure.message).toBe("Continuation exited 7");
      expect(mocks.run).toHaveBeenCalledTimes(3);
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  it.effect("does not run a script continuation or seal evidence after Vitest failure", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/infra", "infra");
      const { root } = yield* fixture([entry], "bunx --bun vitest run && bun run test:lambda");
      mocks.run.mockImplementation((label: string) =>
        label === "ci:test:@beep/infra:0" ? Effect.fail(CiCommandError.make({ message: "Vitest failed" })) : Effect.void
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const failure = yield* runCiCoveragePartition(root, options(), plan([entry]), proof, undefined).pipe(Effect.flip);
      expect(failure.message).toBe("Vitest failed");
      expect(mocks.run).toHaveBeenCalledTimes(2);
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "passes canonical CLI coverage arguments through the installed Vitest parser without duplicate booleans",
    () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        const proof = CiLanePartitionProof.make({
          laneId: "test-unit",
          partition: "repo-cli-1",
          selectedTaskCount: 1,
          partitionTaskCount: 1,
          packages: ["@beep/repo-cli"],
          shard: CiLanePartitionShard.make({ index: 1, total: 2 }),
        });
        yield* runCiCoveragePartition(root, options(), plan([owner()]), proof, undefined);
        const args = mocks.run.mock.calls[1]?.[1][0]?.args;
        assertDefined(args);
        expect(A.filter(args, (arg) => arg === "--coverage")).toHaveLength(1);
        expect(parseCLI(A.fromIterable(args)).options.coverage?.enabled).toBe(true);
      })
  );

  it.effect("accepts every current workspace coverage owner's canonical script without executing tests", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
      const owners = A.filter(yield* workspaceCoverageScopeOwners(repoRoot), (entry) => entry.hasCoverage);
      mocks.plan.mockReturnValue(Effect.succeed(plan(owners)));
      mocks.discover.mockImplementation(({ command, cwd }: { readonly command: string; readonly cwd: string }) =>
        command === "bunx"
          ? encode([{ file: path.join(cwd, "test/census.test.ts") }]).pipe(
              Effect.map((output) => ({ output, exitCode: 0, truncated: false }))
            )
          : Effect.succeed({ output: command === "bun" ? "1.4.3" : "22.22.3", exitCode: 0, truncated: false })
      );
      yield* runCiCoverageComparison(repoRoot, options());
      expect(owners.length).toBeGreaterThan(100);
      expect(mocks.compare).toHaveBeenCalledOnce();
      expect(mocks.run).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "discovers the real legacy integration/config census and adds only disjoint Unit files",
    () =>
      Effect.gen(function* () {
        const entry = owner("@beep/mcpb-kit", "packages/tool");
        const { root, fs, path } = yield* fixture([entry]);
        const directory = path.join(root, entry.packagePath);
        yield* fs.makeDirectory(path.join(directory, "test/integration"), { recursive: true });
        for (const file of ["test/shared.test.ts", "test/unit-only.test.ts", "test/integration/repo.test.ts"])
          yield* fs.writeFileString(
            path.join(directory, file),
            'throw new Error("discovery must never execute tests");'
          );
        yield* fs.writeFileString(
          path.join(directory, "vitest.config.ts"),
          'export default { test: { include: ["test/**/*.test.ts"], exclude: ["test/integration/**"] } };'
        );
        yield* fs.writeFileString(
          path.join(directory, "vitest.coverage.config.ts"),
          'export default { test: { include: ["test/shared.test.ts", "test/integration/*.test.ts"] } };'
        );
        yield* fs.writeFileString(
          path.join(directory, "package.json"),
          yield* encode({
            name: entry.packageName,
            scripts: {
              test: "bun run beep:test",
              "beep:test": "MODE=unit bunx --bun vitest run --exclude=test/integration/** && bun run test:lambda",
              "test:lambda": "bun --version",
              coverage: "bunx vitest run --config vitest.coverage.config.ts --coverage",
            },
          })
        );
        const vitest = path.resolve(import.meta.dirname, "../../../../../node_modules/vitest/vitest.mjs");
        mocks.discover.mockImplementation((input: Parameters<typeof nativeRunCaptured>[0]) =>
          input.command === "bunx"
            ? nativeRunCaptured({
                ...input,
                command: input.args?.[0] === "--bun" ? "bun" : "node",
                args: [vitest, ...A.drop(input.args ?? [], input.args?.[0] === "--bun" ? 2 : 1)],
              })
            : nativeRunCaptured(input)
        );
        yield* runCiCoverageComparison(root, options());
        const compared = mocks.compare.mock.calls[0]?.[1];
        assertDefined(compared);
        const selected = A.flatMap(compared.expectedPartitions, (partition) => partition.packages);
        expect(A.map(selected, (invocation) => invocation.expectedTestFiles)).toEqual([
          ["packages/tool/test/integration/repo.test.ts", "packages/tool/test/shared.test.ts"],
          ["packages/tool/test/unit-only.test.ts"],
        ]);
        expect(
          A.makeEquivalence(S.toEquivalence(S.Struct({ runtime: S.String, provider: S.String, testOnly: S.Boolean })))(
            A.map(selected, (invocation) => ({
              runtime: invocation.testRuntime,
              provider: invocation.provider,
              testOnly: invocation.testOnly,
            })),
            [
              { runtime: "node", provider: "v8", testOnly: false },
              { runtime: "bun", provider: "istanbul", testOnly: true },
            ]
          )
        ).toBe(true);
        expect(selected[0]?.testCommand).toContain("vitest.coverage.config.ts");
        expect(selected[1]?.testEnvironment).toEqual({ MODE: "unit" });
        expect(selected[1]?.testCommand).toContain("--exclude=test/shared.test.ts");
        expect(A.map(selected, (invocation) => invocation.continuationScripts)).toEqual([[], ["test:lambda"]]);
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.write).not.toHaveBeenCalled();
      }),
    { timeout: 30_000 }
  );

  for (const [name, scripts] of R.toEntries({
    cycle: { coverage: "bun run first", first: "bun run coverage", expectedMessage: "Cyclic coverage script" },
    missing: { coverage: "bun run missing", expectedMessage: "canonical Vitest test script" },
    escaping: {
      coverage: "bun run --cwd node_modules/../outside build && bunx vitest run --coverage",
      expectedMessage: "Invalid preparation command",
    },
    shell: {
      coverage: "bun run --cwd node_modules/helper build; echo bypass && bunx vitest run --coverage",
      expectedMessage: "canonical Vitest test script",
    },
  })) {
    it.effect(`rejects ${name} coverage aliases or preparation before discovery`, () =>
      Effect.gen(function* () {
        const { expectedMessage, ...scriptFields } = scripts;
        const entry = owner("@beep/mcpb-kit", "packages/tool");
        const { root, fs, path } = yield* fixture([entry]);
        yield* fs.writeFileString(
          path.join(root, entry.packagePath, "package.json"),
          yield* encode({
            name: entry.packageName,
            scripts: { test: "bun run beep:test", "beep:test": "bunx --bun vitest run", ...scriptFields },
          })
        );
        const error = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
        expect(error._tag).toBe("CiCommandError");
        expect(error.message).toContain(expectedMessage);
        expect(mocks.discover).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.compare).not.toHaveBeenCalled();
      })
    );
  }

  for (const scenario of [
    {
      name: "mixed provider runtimes",
      coverage: "bunx --bun vitest run --coverage && bunx vitest run --coverage",
      message: "Mixed canonical coverage runtimes",
    },
    {
      name: "overlapping coverage invocations",
      coverage: "bunx vitest run --coverage && bunx vitest run --coverage",
      message: "Overlapping canonical coverage invocations",
    },
  ]) {
    it.effect(`rejects ${scenario.name} instead of merging incompatible or duplicate execution`, () =>
      Effect.gen(function* () {
        const entry = owner("@beep/mcpb-kit", "packages/tool");
        const { root, fs, path } = yield* fixture([entry]);
        yield* fs.writeFileString(
          path.join(root, entry.packagePath, "package.json"),
          yield* encode({
            name: entry.packageName,
            scripts: { test: "bun run beep:test", "beep:test": "bunx --bun vitest run", coverage: scenario.coverage },
          })
        );
        const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
        expect(failure.message).toContain(scenario.message);
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.compare).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("rejects a Unit-only rediscovery that still overlaps legacy tests", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/mcpb-kit", "packages/tool");
      const { root, path } = yield* fixture([entry]);
      mocks.discover.mockImplementation(({ cwd, args }: Parameters<typeof nativeRunCaptured>[0]) =>
        encode(
          A.map(A.contains(args ?? [], "--coverage") ? ["a"] : ["a", "b"], (name) => ({
            file: path.join(cwd ?? root, `test/${name}.test.ts`),
          }))
        ).pipe(Effect.map((output) => ({ output, exitCode: 0, truncated: false })))
      );
      const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
      expect(failure.message).toContain("Disjoint unit coverage census differs");
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("retains an explicitly Bun canonical provider for disjoint Unit additions", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/mcpb-kit", "packages/tool");
      const { root, fs, path } = yield* fixture([entry], "bunx --bun vitest run test/b.test.ts");
      yield* fs.writeFileString(
        path.join(root, entry.packagePath, "package.json"),
        yield* encode({
          name: entry.packageName,
          scripts: {
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run test/b.test.ts",
            coverage: "bunx --bun vitest run test/a.test.ts --coverage",
          },
        })
      );
      yield* runCiCoverageComparison(root, options());
      const compared = mocks.compare.mock.calls[0]?.[1];
      assertDefined(compared);
      const selected = A.flatMap(compared.expectedPartitions, (partition) => partition.packages);
      expect(A.map(selected, (invocation) => invocation.expectedTestFiles)).toEqual([
        ["packages/tool/test/a.test.ts"],
        ["packages/tool/test/b.test.ts"],
      ]);
      expect(
        A.every(selected, (invocation) => invocation.testRuntime === "bun" && invocation.provider === "istanbul")
      ).toBe(true);
    })
  );

  it.effect("executes a single Bun coverage invocation with its attested config and environment", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/mcpb-kit", "packages/tool");
      const { root, fs, path } = yield* fixture([entry]);
      yield* fs.writeFileString(
        path.join(root, entry.packagePath, "package.json"),
        yield* encode({
          name: entry.packageName,
          scripts: {
            test: "bun run beep:test",
            "beep:test": "MODE=unit bunx --bun vitest run",
            coverage: "MODE=coverage bunx --bun vitest run --config coverage.config.ts --coverage",
          },
        })
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const step = QualityTaskStep.make({
        label: "unit",
        command: "bunx",
        cwd: root,
        args: ["turbo", "run", `${entry.packageName}#test`, `--filter=${entry.packageName}`],
      });
      yield* runCiCoveragePartition(root, options(), plan([entry]), proof, step);
      expect(A.map(mocks.run.mock.calls, ([label]) => label)).toEqual([
        "ci:coverage:compound-prerequisites",
        "ci:test:@beep/mcpb-kit:0",
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:test:@beep/mcpb-kit:0", [
        expect.objectContaining({
          command: "bunx",
          args: expect.arrayContaining([
            "--bun",
            "vitest",
            "run",
            "--config",
            "coverage.config.ts",
            "--coverage.provider=istanbul",
          ]),
          env: expect.objectContaining({ MODE: "coverage", BEEP_COVERAGE_INVOCATION_ID: "0" }),
        }),
      ]);
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          packages: [
            expect.objectContaining({
              testEnvironment: { MODE: "coverage" },
              testRuntime: "bun",
              provider: "istanbul",
              testCommand: ["bunx", "--bun", "vitest", "run", "--config", "coverage.config.ts", "--coverage"],
            }),
          ],
        })
      );
    })
  );

  it.effect("stops before Vitest and sealing when a canonical preparation fails", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/infra", "infra");
      const { root, fs, path } = yield* fixture([entry]);
      yield* fs.writeFileString(
        path.join(root, entry.packagePath, "package.json"),
        yield* encode({
          name: entry.packageName,
          scripts: {
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run",
            coverage: "bun run --cwd node_modules/helper build && bunx vitest run --coverage",
          },
        })
      );
      mocks.run.mockImplementation((label: string) =>
        Str.endsWith(":prepare")(label)
          ? Effect.fail(CiCommandError.make({ message: "Preparation failed" }))
          : Effect.void
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const failure = yield* runCiCoveragePartition(root, options(), plan([entry]), proof, undefined).pipe(Effect.flip);
      expect(failure.message).toBe("Preparation failed");
      expect(mocks.run).toHaveBeenCalledTimes(2);
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  for (const scenario of [
    {
      name: "preparation",
      coverage: "bun run --cwd node_modules/helper build && bunx --bun vitest run --coverage",
      unit: "bunx --bun vitest run",
      labels: ["ci:coverage:compound-prerequisites", "ci:test:@beep/infra:0:prepare", "ci:test:@beep/infra:0"],
    },
    {
      name: "continuation",
      coverage: "bunx --bun vitest run --coverage",
      unit: "bunx --bun vitest run && bun run test:lambda",
      labels: ["ci:coverage:compound-prerequisites", "ci:test:@beep/infra:0", "ci:test:@beep/infra:0:test:lambda"],
    },
  ]) {
    it.effect(`preserves an explicit Bun coverage ${scenario.name} instead of routing it through ordinary Unit`, () =>
      Effect.gen(function* () {
        const entry = owner("@beep/infra", "infra");
        const { root, fs, path } = yield* fixture([entry], scenario.unit);
        yield* fs.writeFileString(
          path.join(root, "infra/package.json"),
          yield* encode({
            name: entry.packageName,
            scripts: {
              test: "bun run beep:test",
              "beep:test": scenario.unit,
              coverage: scenario.coverage,
              "test:lambda": "bun --version",
            },
          })
        );
        const proof = CiLanePartitionProof.make({
          laneId: "test-unit",
          partition: "unit-b",
          selectedTaskCount: 1,
          partitionTaskCount: 1,
          packages: [entry.packageName],
        });
        yield* runCiCoveragePartition(root, options(), plan([entry]), proof, undefined);
        expect(A.map(mocks.run.mock.calls, ([label]) => label)).toEqual(scenario.labels);
        expect(mocks.write).toHaveBeenCalledWith(
          root,
          expect.objectContaining({
            packages: [expect.objectContaining({ testRuntime: "bun", provider: "istanbul" })],
          })
        );
      })
    );
  }

  it.effect("runs compound commands once after dependency builds with isolated reports and runtime declarations", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/repo-utils", "packages/tool");
      const { root } = yield* fixture(
        [entry],
        "TESTCONTAINERS_RYUK_DISABLED=true bunx --bun vitest run --exclude=test/TsNativeApi.test.ts && bunx vitest run test/TsNativeApi.test.ts"
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 2,
        partitionTaskCount: 2,
        packages: [entry.packageName, "@beep/other"],
        shard: CiLanePartitionShard.make({ index: 1, total: 2 }),
      });
      const step = QualityTaskStep.make({
        label: "unit",
        command: "bunx",
        cwd: root,
        args: [
          "turbo",
          "run",
          `${entry.packageName}#test`,
          "@beep/other#test",
          `--filter=${entry.packageName}`,
          "--filter=@beep/other",
          "--",
          "--coverage",
        ],
      });
      yield* runCiCoveragePartition(root, options(), plan([entry]), proof, step);
      expect(mocks.run).toHaveBeenCalledTimes(4);
      expect(mocks.run).toHaveBeenNthCalledWith(1, "unit", [
        expect.objectContaining({ args: expect.arrayContaining(["@beep/other#test", "--filter=@beep/other"]) }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(1, "unit", [
        expect.objectContaining({
          args: expect.not.arrayContaining([`${entry.packageName}#test`, `--filter=${entry.packageName}`]),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(2, "ci:coverage:compound-prerequisites", [
        expect.objectContaining({
          args: ["turbo", "run", "build", `--filter=${entry.packageName}^...`, "--concurrency=2"],
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(3, `ci:test:${entry.packageName}:0`, [
        expect.objectContaining({
          args: expect.arrayContaining([
            "vitest",
            "run",
            "--coverage.provider=v8",
            "--exclude=test/TsNativeApi.test.ts",
            "--coverage.reportsDirectory=coverage/invocation-0",
            "--outputFile=coverage/invocation-0/unit-results.json",
          ]),
          env: expect.objectContaining({
            TESTCONTAINERS_RYUK_DISABLED: "true",
            BEEP_COVERAGE_INVOCATION_ID: "0",
            BEEP_COVERAGE_RUNTIME_RECEIPT: "coverage/invocation-0/runtime.json",
          }),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(4, `ci:test:${entry.packageName}:1`, [
        expect.objectContaining({
          args: expect.arrayContaining([
            "vitest",
            "run",
            "test/TsNativeApi.test.ts",
            "--coverage.reportsDirectory=coverage/invocation-1",
            "--outputFile=coverage/invocation-1/unit-results.json",
          ]),
          env: expect.objectContaining({
            BEEP_COVERAGE_INVOCATION_ID: "1",
            BEEP_COVERAGE_RUNTIME_RECEIPT: "coverage/invocation-1/runtime.json",
          }),
        }),
      ]);
      expect(mocks.run).toHaveBeenNthCalledWith(4, `ci:test:${entry.packageName}:1`, [
        expect.objectContaining({ args: expect.not.arrayContaining(["--bun", "&&"]) }),
      ]);
      expect(mocks.write).toHaveBeenCalledWith(
        root,
        expect.objectContaining({
          packages: [
            expect.objectContaining({
              invocationId: "0",
              testRuntime: "node",
              provider: "v8",
              testRuntimeVersion: "22.22.3",
              testEnvironment: { TESTCONTAINERS_RYUK_DISABLED: "true" },
            }),
            expect.objectContaining({
              invocationId: "1",
              testRuntime: "node",
              testRuntimeVersion: "22.22.3",
              testEnvironment: {},
            }),
          ],
        })
      );
    })
  );
  it.effect("stops a compound chain after failure and never seals partial coverage", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/repo-utils", "packages/tool");
      const { root } = yield* fixture(
        [entry],
        "bunx --bun vitest run --exclude=test/TsNativeApi.test.ts && bunx vitest run test/TsNativeApi.test.ts"
      );
      mocks.run.mockImplementation((label: string) =>
        label === `ci:test:${entry.packageName}:0`
          ? Effect.fail(CiCommandError.make({ message: "first invocation failed" }))
          : Effect.void
      );
      const proof = CiLanePartitionProof.make({
        laneId: "test-unit",
        partition: "unit-b",
        selectedTaskCount: 1,
        partitionTaskCount: 1,
        packages: [entry.packageName],
      });
      const step = QualityTaskStep.make({
        label: "unit",
        command: "bunx",
        cwd: root,
        args: ["turbo", "run", `${entry.packageName}#test`],
      });
      const failure = yield* runCiCoveragePartition(root, options(), plan([entry]), proof, step).pipe(Effect.flip);
      expect(failure.message).toBe("first invocation failed");
      expect(mocks.run).toHaveBeenCalledTimes(2);
      expect(mocks.write).not.toHaveBeenCalled();
    })
  );

  it.effect("keeps optional JSON output switch last so a positional test filter cannot become an output path", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture(
        [owner("@beep/mcpb-kit", "packages/tool")],
        "bunx vitest run test/TsNativeApi.test.ts"
      );
      yield* runCiCoverageComparison(root, options());
      expect(mocks.discover).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: ["vitest", "list", "--filesOnly", "test/TsNativeApi.test.ts", "--coverage", "--json"],
        })
      );
      expect(mocks.run).not.toHaveBeenCalled();
    })
  );

  for (const scenario of [
    {
      name: "Bun coverage instead of canonical Node",
      unit: "bunx --bun vitest run",
      coverage: "bunx --bun vitest run --coverage",
    },
    {
      name: "different test arguments",
      unit: "bunx --bun vitest run --exclude=test/a.test.ts",
      coverage: "bunx vitest run --coverage",
    },
    {
      name: "different package environment",
      unit: "MODE=a bunx --bun vitest run",
      coverage: "MODE=b bunx vitest run --coverage",
    },
    {
      name: "multiple coverage commands",
      unit: "bunx --bun vitest run",
      coverage: "bunx vitest run --coverage && bunx vitest run --coverage",
    },
    {
      name: "multiple canonical unit commands",
      unit: "bunx --bun vitest run && bunx --bun vitest run",
      coverage: "bunx vitest run --coverage",
    },
  ])
    it.effect(`refuses CLI provider migration with ${scenario.name}`, () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* fixture();
        yield* fs.writeFileString(
          path.join(root, "packages/tool/package.json"),
          yield* encode({
            name: "@beep/repo-cli",
            version: "0.0.0",
            scripts: { test: "bun run beep:test", "beep:test": scenario.unit, coverage: scenario.coverage },
          })
        );
        const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
        expect(failure.message).toContain("CLI coverage must preserve");
        expect(mocks.discover).not.toHaveBeenCalled();
        expect(mocks.compare).not.toHaveBeenCalled();
      })
    );
  it.effect("refuses runtime-dependent CLI test census differences even with equivalent literal arguments", () =>
    Effect.gen(function* () {
      const { root, path } = yield* fixture();
      mocks.discover.mockImplementationOnce(() =>
        encode([{ file: path.join(root, "packages/tool/test/bun-only.test.ts") }]).pipe(
          Effect.map((output) => ({ output, exitCode: 0, truncated: false }))
        )
      );
      const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
      expect(failure.message).toContain("CLI coverage test census differs");
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.compare).not.toHaveBeenCalled();
    })
  );

  it.effect("expands the Epistemic coverage glob into eight canonical tests with no Unit extras", () =>
    Effect.gen(function* () {
      const entry = owner("@beep/epistemic-server", "packages/tool");
      const { root, fs, path } = yield* fixture([entry]);
      const directory = path.join(root, entry.packagePath);
      const names = [
        "BoundedShaclValidator",
        "ContradictionTriage.observability",
        "EpistemicRepositoryDriverFailure.pglite",
        "EpistemicServer",
        "GovernedEgress",
        "GovernedTierGate",
        "IdentityShaclProjection.e2e",
      ];
      const files = A.map(names, (name) => `test/${name}.test.ts`);
      const integration = "test/integration/ContradictionTriage.pglite.test.ts";
      yield* fs.makeDirectory(path.join(directory, "test/integration"), { recursive: true });
      for (const file of [...files, integration])
        yield* fs.writeFileString(path.join(directory, file), 'throw new Error("discovery must never execute tests");');
      yield* fs.writeFileString(
        path.join(directory, "package.json"),
        yield* encode({
          name: entry.packageName,
          version: "0.0.0",
          scripts: {
            test: "bun run beep:test",
            "beep:test": "bunx --bun vitest run test/*.test.ts",
            coverage: `bunx vitest run --coverage test/*.test.ts ${integration}`,
          },
        })
      );
      yield* fs.writeFileString(
        path.join(directory, "vitest.config.ts"),
        'export default { test: { include: ["test/**/*.test.ts"] } };'
      );
      const vitest = path.resolve(import.meta.dirname, "../../../../../node_modules/vitest/vitest.mjs");
      mocks.discover.mockImplementation((input: Parameters<typeof nativeRunCaptured>[0]) =>
        input.command === "bunx"
          ? nativeRunCaptured({
              ...input,
              command: input.args?.[0] === "--bun" ? "bun" : "node",
              args: [vitest, ...A.drop(input.args ?? [], input.args?.[0] === "--bun" ? 2 : 1)],
            })
          : nativeRunCaptured(input)
      );
      yield* runCiCoverageComparison(root, options());
      const compared = mocks.compare.mock.calls[0]?.[1];
      assertDefined(compared);
      const packages = A.flatMap(compared.expectedPartitions, (partition) => partition.packages);
      expect(packages).toHaveLength(1);
      expect(packages[0]?.testOnly).toBe(false);
      expect(packages[0]?.expectedTestFiles).toHaveLength(8);
      expect(packages[0]?.testCommand).toEqual(["bunx", "vitest", "run", "--coverage", ...files, integration]);
      expect(mocks.discover).not.toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(["test/*.test.ts"]) })
      );
    })
  );
  A.forEach(
    [
      { word: "'test/*.test.ts'", expected: "test/*.test.ts" },
      { word: '"test/*.test.ts"', expected: "test/*.test.ts" },
      { word: "test/\\*.test.ts", expected: "test/*.test.ts" },
      { word: "missing/*.test.ts", expected: "missing/*.test.ts" },
      { word: "--exclude=test/*.test.ts", expected: "--exclude=test/*.test.ts" },
    ],
    (scenario) =>
      it.effect(`preserves canonical literal argument ${scenario.word}`, () =>
        Effect.gen(function* () {
          const { root, fs, path } = yield* fixture([owner("@beep/example")], `bunx vitest run ${scenario.word}`);
          yield* fs.makeDirectory(path.join(root, "packages/tool/test"), { recursive: true });
          yield* fs.writeFileString(path.join(root, "packages/tool/test/present.test.ts"), "");
          yield* runCiCoverageComparison(root, options());
          expect(mocks.discover).toHaveBeenCalledWith(
            expect.objectContaining({ args: expect.arrayContaining([scenario.expected]) })
          );
        })
      )
  );

  it.effect("expands sorted pathname matches containing spaces into separate arguments", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture([owner("@beep/example")], "bunx vitest run test/*.test.ts");
      yield* fs.makeDirectory(path.join(root, "packages/tool/test"), { recursive: true });
      for (const name of ["z last", "a first"])
        yield* fs.writeFileString(path.join(root, `packages/tool/test/${name}.test.ts`), "");
      yield* fs.writeFileString(
        path.join(root, "packages/tool/package.json"),
        yield* encode({
          name: "@beep/example",
          scripts: {
            test: "bun run beep:test",
            "beep:test": "bunx vitest run test/*.test.ts",
            coverage: "bunx vitest run --coverage test/*.test.ts",
            "shell-contract": "printf '<%s>\\n' test/*.test.ts",
          },
        })
      );
      const shell = yield* nativeRunCaptured({
        command: "bun",
        args: ["run", "--silent", "shell-contract"],
        cwd: path.join(root, "packages/tool"),
        source: "stdout",
        trim: true,
      });
      expect(shell.exitCode).toBe(0);
      expect(shell.output).toBe("<test/a first.test.ts>\n<test/z last.test.ts>");
      yield* runCiCoverageComparison(root, options());
      expect(mocks.discover).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ["vitest", "list", "--filesOnly", "test/a first.test.ts", "test/z last.test.ts", "--json"],
        })
      );
    })
  );
  A.forEach(
    [
      "../*.test.ts",
      "/tmp/*.test.ts",
      "node_modules/*.test.ts",
      "test/**/*.test.ts",
      "test/?.test.ts",
      "test/[a].test.ts",
      "test/space\\ dir/*.test.ts",
      "test/\\*/*.test.ts",
    ],
    (pattern) =>
      it.effect(`refuses unsupported or escaping pathname pattern ${pattern}`, () =>
        Effect.gen(function* () {
          const { root } = yield* fixture([owner("@beep/example")], `bunx vitest run ${pattern}`);
          const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
          expect(failure.message).toMatch(/pathname pattern/u);
          expect(mocks.discover).not.toHaveBeenCalled();
        })
      )
  );

  it.effect("reports filesystem pathname enumeration failures before test discovery", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture([owner("@beep/example")], "bunx vitest run test/*.test.ts");
      const failure = yield* fs.readFileString(path.join(root, "missing-file")).pipe(Effect.flip);
      vi.spyOn(fs, "glob").mockReturnValueOnce(Effect.fail(failure));
      const error = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
      expect(error.message).toContain("Failed to expand test/*.test.ts");
      expect(mocks.discover).not.toHaveBeenCalled();
    })
  );

  const scriptVariants = [
    { name: "identity Node", script: "bunx vitest run", runtimes: [false], env: {} },
    { name: "app Bun", script: "bunx --bun vitest run", runtimes: [true], env: {} },
    { name: "library Bun", script: "bunx --bun vitest run --passWithNoTests", runtimes: [true], env: {} },
    {
      name: "excluded integration",
      script: "bunx --bun vitest run --exclude=test/integration/**",
      runtimes: [true],
      env: {},
    },
    {
      name: "default library",
      script: "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
      runtimes: [true],
      env: {},
    },
    {
      name: "drizzle and postgres environment",
      script: "TESTCONTAINERS_RYUK_DISABLED=true bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
      runtimes: [true],
      env: { TESTCONTAINERS_RYUK_DISABLED: "true" },
    },
    {
      name: "multiple literal assignments",
      script: "FIRST=one SECOND=two bunx --bun vitest run",
      runtimes: [true],
      env: { FIRST: "one", SECOND: "two" },
    },
    {
      name: "repo-utils split runtime",
      script: "bunx --bun vitest run --exclude=test/TsNativeApi.test.ts && bunx vitest run test/TsNativeApi.test.ts",
      runtimes: [true, false],
      env: {},
    },
    {
      name: "effect-drizzle split runtime",
      script:
        "bunx --bun vitest run --passWithNoTests --exclude=test/integration/** --exclude=test/import-boundary.test.ts && bunx vitest run test/import-boundary.test.ts",
      runtimes: [true, false],
      env: {},
    },
  ];
  for (const variant of scriptVariants) {
    it.effect(`discovers ${variant.name} unit census while preserving canonical coverage runtime without a shell`, () =>
      Effect.gen(function* () {
        const { root } = yield* fixture([owner("@beep/mcpb-kit", "packages/tool")], variant.script);
        yield* runCiCoverageComparison(root, options());
        for (const bun of variant.runtimes) {
          expect(mocks.discover).toHaveBeenCalledWith(
            expect.objectContaining({
              command: "bunx",
              args: expect.arrayContaining(
                bun ? ["--bun", "vitest", "list", "--filesOnly", "--json"] : ["vitest", "list", "--filesOnly", "--json"]
              ),
              env: expect.objectContaining(variant.env),
              extendEnv: true,
            })
          );
        }
        const compared = mocks.compare.mock.calls[0]?.[1];
        assertDefined(compared);
        const selected = A.flatMap(compared.expectedPartitions, (partition) => partition.packages);
        expect(selected.length).toBeGreaterThan(0);
        expect(A.every(selected, (entry) => entry.testRuntime === "node" && entry.provider === "v8")).toBe(true);
        expect(mocks.run).not.toHaveBeenCalled();
      })
    );
  }
  for (const invalidVersion of [
    { output: "", exitCode: 0, truncated: false },
    { output: "1.4.3", exitCode: 1, truncated: false },
    { output: "1.4.3", exitCode: 0, truncated: true },
  ]) {
    it.effect(`refuses invalid runtime provenance ${JSON.stringify(invalidVersion)}`, () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        mocks.discover.mockImplementation(({ command }: { readonly command: string }) =>
          Effect.succeed(command === "bunx" ? { output: "[]", exitCode: 0, truncated: false } : invalidVersion)
        );
        const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
        expect(failure.message).toContain("Invalid test runtime version");
        expect(mocks.compare).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
      })
    );
  }

  for (const script of [
    "bunx vitest run; echo unsafe",
    'bunx vitest run "test/"*.test.ts',
    "bunx vitest run `echo unsafe`",
    "bunx vitest run > output",
    "bunx vitest run 'unterminated",
    "TOKEN=$(echo unsafe) bunx vitest run",
    "bunx vitest run | other",
    "bunx vitest run && custom-test-command",
    "bunx vitest run && bun run --help",
    "bunx vitest run && bun run --",
    "bunx vitest runner",
    "bunx --bun vitest run --flag=$VALUE",
  ]) {
    it.effect(`refuses shell evaluation or noncanonical invocation: ${script}`, () =>
      Effect.gen(function* () {
        const { root } = yield* fixture([owner()], script);
        const failure = yield* runCiCoverageComparison(root, options()).pipe(Effect.flip);
        expect(failure.message).toContain("canonical Vitest test script");
        expect(mocks.discover).not.toHaveBeenCalled();
        expect(mocks.run).not.toHaveBeenCalled();
      })
    );
  }

  it.effect("refuses a noncanonical command rather than guessing its test inventory", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture([owner()], "custom-test-command");
      const error = yield* Effect.flip(runCiCoverageComparison(root, options()));
      expect(error.message).toContain("canonical Vitest test script");
      expect(mocks.discover).not.toHaveBeenCalled();
    })
  );
});
