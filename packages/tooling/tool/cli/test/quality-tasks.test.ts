import { CiLaneRunOptions, ciLaneStepsForTesting } from "@beep/repo-cli/commands/Ci";
import {
  collectAuditDiffInputForTesting,
  fallowAuditDiffFallbackArgsForTesting,
  fallowAuditNeedsDiffFallbackForTesting,
  fallowCiUploadDiagnosticsForTesting,
} from "@beep/repo-cli/commands/Quality/FallowQuality.command";
import {
  CoveragePackageBaseline,
  CoverageRegressionBaseline,
  collectEffectTsgoDiagnosticLines,
  compareCoverageRegressionSnapshotsForTesting,
  compareJSDocTotalsForTesting,
  compareKnipFindingsForTesting,
  detectQualityProfileForTesting,
  devQualityStepsForTesting,
  FallowReportFinding,
  GithubCheckMode,
  GithubChecksFallowFeatureMatrix,
  githubCheckLanesForModeForTesting,
  githubCheckPrePushExternalLanesForTesting,
  githubCheckPromotedFallowLaneDiagnosticsForTesting,
  githubCheckQualityLanesForTesting,
  githubCheckRepoSanityLanesForTesting,
  KnipFinding,
  lintFixChangedStepForTesting,
  normalizeKnipReportForTesting,
  parseQualityTaskInvocation,
  promotedFallowGithubCheckLaneIdsForTesting,
  QualityTaskFailed,
  QualityTaskGroupFailed,
  QualityTaskStep,
  qualityProfileConfigForTesting,
  reviewFixDocgenLocalArgsForTesting,
  rootLintPolicyStepsForTesting,
  rootQualityStepsForTesting,
  runQualityTask,
  runQualityTaskStepGroupForTesting,
  runQualityTaskStreamingStepGroupForTesting,
  runRootLintPolicyTask,
  runSqlIntegrationTestLaneForTesting,
  sqlIntegrationConnectionUriFromEnvForTesting,
  sqlIntegrationStepForTesting,
  workspaceTaskFiltersForTesting,
} from "@beep/repo-cli/test/Quality";
import { findRepoRoot } from "@beep/repo-utils";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Cause, Effect, Exit, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import type { QualityTaskInvocation } from "@beep/repo-cli/test/Quality";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer)),
  TestConsole.layer
);
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);
const decodeGithubChecksFallowFeatureMatrixJsoncForTesting = decodeJsoncTextAs(GithubChecksFallowFeatureMatrix);
const isQualityTaskFailed = S.is(QualityTaskFailed);
const isQualityTaskGroupFailed = S.is(QualityTaskGroupFailed);
const isString = (value: unknown): value is string => typeof value === "string";
const runGit = Effect.fn("QualityTasksTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(yield* handle.exitCode).toBe(0);
});
const coveragePackageBaseline = (path: string, metric = 50): CoveragePackageBaseline =>
  CoveragePackageBaseline.make({
    path,
    lines: metric,
    statements: metric,
    branches: metric,
    functions: metric,
  });
const coverageRegressionBaseline = CoverageRegressionBaseline.make({
  schema_version: 1,
  generated_at: "2026-07-06T00:00:00.000Z",
  git_sha: "test-sha",
  command: "bun run coverage:baseline:write",
  epsilon: 0.001,
  packages: {
    "@beep/existing": coveragePackageBaseline("packages/existing"),
  },
});

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const originalCwd = process.cwd();
      const repositoryPath = yield* fs.makeTempDirectory();

      yield* Effect.sync(() => {
        process.chdir(repositoryPath);
      });
      yield* fs.makeDirectory(path.join(repositoryPath, ".git"), { recursive: true });
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            process.chdir(originalCwd);
          });
          yield* fs.remove(repositoryPath, { force: true, recursive: true }).pipe(Effect.orDie);
        })
      );

      return yield* use;
    })
  ).pipe(provideScopedLayer(PlatformLayer));

const getInvocation = (argv: ReadonlyArray<string>): QualityTaskInvocation => {
  const invocation = parseQualityTaskInvocation(argv);
  if (O.isNone(invocation)) {
    throw new Error(`Expected ${A.join(argv, " ")} to parse as a quality task.`);
  }
  return invocation.value;
};

const withEnvVar = <A>(name: string, value: string | undefined, use: () => A): A => {
  const previousValue = Bun.env[name];
  if (value === undefined) {
    delete Bun.env[name];
  } else {
    Bun.env[name] = value;
  }

  try {
    return use();
  } finally {
    if (previousValue === undefined) {
      delete Bun.env[name];
    } else {
      Bun.env[name] = previousValue;
    }
  }
};

const withEnvVarEffect = <Out, E, R>(
  name: string,
  value: string | undefined,
  use: Effect.Effect<Out, E, R>
): Effect.Effect<Out, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousValue = Bun.env[name];
      if (value === undefined) {
        delete Bun.env[name];
      } else {
        Bun.env[name] = value;
      }
      return previousValue;
    }),
    () => use,
    (previousValue) =>
      Effect.sync(() => {
        if (previousValue === undefined) {
          delete Bun.env[name];
        } else {
          Bun.env[name] = previousValue;
        }
      })
  );

const isTurboCacheControlArg = (arg: string): boolean =>
  arg === "--no-cache" ||
  arg === "--force" ||
  Str.startsWith("--force=")(arg) ||
  arg === "--remote-only" ||
  Str.startsWith("--remote-only=")(arg) ||
  arg === "--remote-cache-read-only" ||
  Str.startsWith("--remote-cache-read-only=")(arg) ||
  Str.startsWith("--cache=")(arg);

const isTurboConcurrencyArg = (arg: string): boolean =>
  arg === "--concurrency" || Str.startsWith("--concurrency=")(arg);

const expectedTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  task,
  ...(Bun.env.CI === "true" || A.some(args, isTurboCacheControlArg) ? [] : ["--cache=local:rw"]),
  ...args,
];
const expectedRootTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  expectedTurboArgs(
    task,
    Bun.env.CI === "true" || A.some(args, isTurboConcurrencyArg) ? args : ["--concurrency=3", ...args]
  );
const bunScriptStep = (label: string, source: string) =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["-e", source],
    cwd: process.cwd(),
  });

type FallowFeatureMatrixRowTuple = readonly [
  featureFamily: "audit" | "dead-code" | "health",
  ciMode: "advisory-artifact" | "blocking-check",
  promotionStatus: "advisory" | "research" | "candidate-blocking" | "blocking",
];

const fallowFeatureMatrix = (features: ReadonlyArray<FallowFeatureMatrixRowTuple>) =>
  GithubChecksFallowFeatureMatrix.make({
    features: A.map(features, ([featureFamily, ciMode, promotionStatus]) => ({
      ciMode,
      featureFamily,
      promotionStatus,
    })),
  });

const expectUnpromotedWiredFallowLanes = (matrix: GithubChecksFallowFeatureMatrix): void => {
  expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
    "unpromoted Fallow GitHub check lane is wired: fallow:audit",
    "unpromoted Fallow GitHub check lane is wired: fallow:dead-code",
  ]);
};

const expectSubstringBefore = (text: string, before: string, after: string): void => {
  const beforeIndex = Str.indexOf(before)(text);
  const afterIndex = Str.indexOf(after)(text);

  expect(O.isSome(beforeIndex)).toBe(true);
  expect(O.isSome(afterIndex)).toBe(true);

  if (O.isSome(beforeIndex) && O.isSome(afterIndex)) {
    expect(beforeIndex.value).toBeLessThan(afterIndex.value);
  }
};

describe("quality task adapter", () => {
  it("parses canonical task invocations and preserves passthrough args", () => {
    expect(getInvocation(["build", "--affected", "--summarize"])).toMatchObject({
      task: "build",
      fix: false,
      args: ["--affected", "--summarize"],
    });
    expect(getInvocation(["lint", "--fix", "--filter=@beep/schema"])).toMatchObject({
      task: "lint",
      fix: true,
      args: ["--filter=@beep/schema"],
    });
    expect(getInvocation(["lint", "--fix", "--dry=json"])).toMatchObject({
      task: "lint",
      fix: true,
      args: ["--dry=json"],
    });
    expect(getInvocation(["audit", "packages", "--filter=@beep/schema"])).toMatchObject({
      task: "audit",
      fix: false,
      args: ["packages", "--filter=@beep/schema"],
    });
    expect(getInvocation(["coverage", "--affected"])).toMatchObject({
      task: "coverage",
      fix: false,
      args: ["--affected"],
    });
  });

  it("builds package-only audit steps by default and keeps turbo filters", () =>
    withEnvVar("CI", undefined, () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--filter=@beep/schema", "--summarize"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        label: "audit:packages",
        command: "bunx",
        args: expectedRootTurboArgs("audit", ["--filter=@beep/schema", "--summarize"]),
        cwd: "/repo",
      });
    }));

  it("keeps package audit cacheable by default for local runs", () =>
    withEnvVar("CI", undefined, () => {
      const steps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "--filter=@beep/schema"]));

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual(expectedRootTurboArgs("audit", ["--filter=@beep/schema"]));
    }));

  it("forces package audit execution in CI unless cache behavior is explicit", () =>
    withEnvVar("CI", "true", () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--filter=@beep/schema", "--dry=json"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual(["turbo", "run", "audit", "--force", "--filter=@beep/schema", "--dry=json"]);
    }));

  it("honors explicit audit cache-control args in CI", () =>
    withEnvVar("CI", "true", () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--cache=local:rw", "--filter=@beep/schema"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual(["turbo", "run", "audit", "--cache=local:rw", "--filter=@beep/schema"]);
    }));

  it("routes explicit and legacy github audit modes to script checks", () => {
    const explicitSteps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "github", "repo-sanity"]));
    const legacySteps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "repo-sanity"]));

    expect(explicitSteps).toHaveLength(1);
    expect(legacySteps).toHaveLength(1);
    expect(explicitSteps[0]).toMatchObject({
      label: "audit:repo-sanity",
      command: "bun",
      args: ["run", "beep", "quality", "github-checks", "repo-sanity"],
      cwd: "/repo",
    });
    expect(legacySteps[0]).toMatchObject({
      label: "audit:repo-sanity",
      command: "bun",
      args: ["run", "beep", "quality", "github-checks", "repo-sanity"],
      cwd: "/repo",
    });
  });

  it("includes the targeted review-fix github check mode", () => {
    expect(GithubCheckMode.is["review-fix"]("review-fix")).toBe(true);
  });

  it("lets review-fix docgen escalate when docgen tooling changed", () => {
    expect(reviewFixDocgenLocalArgsForTesting("origin/main", "HEAD")).toEqual([
      "docgen:local",
      "--",
      "--base",
      "origin/main",
      "--head",
      "HEAD",
      "--parallel=3",
      "--full",
    ]);
  });

  it("builds balanced affected local development quality steps by default", () => {
    const steps = devQualityStepsForTesting("/repo", {
      base: "origin/main",
      head: "HEAD",
      surface: false,
    });

    expect(A.map(steps, (step) => step.label)).toEqual(["dev:lint", "dev:check", "dev:test"]);
    expect(steps[0]).toMatchObject({
      command: "bun",
      args: ["run", "lint", "--", "--affected", "--summarize"],
      cwd: "/repo",
      env: {
        TURBO_SCM_BASE: "origin/main",
        TURBO_SCM_HEAD: "HEAD",
      },
    });
    expect(steps[1]?.args).toEqual(["run", "check", "--", "--affected", "--summarize"]);
    expect(steps[2]?.args).toEqual(["run", "test", "--", "--unit", "--types", "--affected", "--summarize"]);
    expect(
      A.some(
        A.map(steps, (step) => step.label),
        (label) =>
          A.some(
            [
              "build",
              "integration",
              "docgen",
              "repo-sanity",
              "audit",
              "nix",
              "sast",
              "coverage",
              "storybook",
              "fallow",
            ],
            (fragment) => Str.includes(fragment)(label)
          )
      )
    ).toBe(false);
  });

  it("adds surface-only docgen check when requested", () => {
    const steps = devQualityStepsForTesting("/repo", {
      base: "main",
      head: "feature",
      surface: true,
    });

    expect(A.map(steps, (step) => step.label)).toEqual(["dev:lint", "dev:check", "dev:test", "dev:docgen-local"]);
    expect(steps[3]).toMatchObject({
      command: "bun",
      args: ["run", "docgen:local", "--", "--base", "main", "--head", "feature", "--parallel=3"],
      cwd: "/repo",
    });
  });

  it("maps repo-quality github checks as independent collector lanes", () => {
    const lanes = githubCheckQualityLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "quality:build",
      "quality:check",
      "quality:knip",
      "quality:jsdoc-ratchet",
      "quality:lint",
      "quality:docgen",
      "quality:test",
    ]);
    expect(A.every(lanes, (lane) => lane.stage === "repo-quality")).toBe(true);
    expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
    expect(lanes[1]?.step.args).toEqual(["run", "check"]);
    expect(lanes[2]?.step.args).toEqual(["run", "beep", "quality", "knip"]);
    expect(lanes[3]?.step.args).toEqual(["run", "beep", "ci", "lane", "jsdoc-ratchet"]);
    expect(lanes[4]?.step.args).toEqual(["run", "lint"]);
    expect(lanes[6]?.step.args).toEqual(["run", "test"]);
  });

  it("maps repo-sanity github checks as collector lanes", () => {
    const lanes = githubCheckRepoSanityLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "repo-sanity:changeset-graph",
      "repo-sanity:tsconfig-sync",
      "repo-sanity:fallow-boundaries-config",
      "repo-sanity:versions",
      "repo-sanity:syncpack",
      "repo-sanity:sherif",
      "repo-sanity:bun-audit",
    ]);
    expect(A.every(lanes, (lane) => lane.stage === "repo-sanity")).toBe(true);
    expect(lanes[0]?.step.args).toEqual(["run", "beep", "quality", "changeset-graph"]);
    expect(lanes[2]?.step.args).toEqual(["run", "beep", "quality", "fallow", "boundaries", "config-check", "--check"]);
    expect(lanes[6]?.step.args).toEqual(["run", "beep", "quality", "bun-audit"]);
  });

  it("maps pre-push external gates after repo diagnostics", () => {
    const lanes = githubCheckPrePushExternalLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "pre-push:secrets",
      "pre-push:security",
      "pre-push:sast",
      "pre-push:nix",
    ]);
    expect(A.map(lanes, (lane) => lane.stage)).toEqual([
      "diff-security",
      "diff-security",
      "diff-security",
      "environment",
    ]);
    expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
  });

  it("accepts the current packet state with audit and dead-code as promoted pre-push lanes", () => {
    const matrix = fallowFeatureMatrix([
      ["audit", "blocking-check", "blocking"],
      ["dead-code", "blocking-check", "blocking"],
    ]);

    expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual(["fallow:audit", "fallow:dead-code"]);
    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([]);
  });

  it("falls back to diff-scoped audit when Fallow cannot create the base worktree", () => {
    expect(
      fallowAuditNeedsDiffFallbackForTesting({
        exitCode: 2,
        stdout: JSON.stringify({
          error: true,
          message: "could not create a temporary worktree for base ref 'origin/main'",
          exit_code: 2,
        }),
      })
    ).toBe(true);
    expect(
      fallowAuditNeedsDiffFallbackForTesting({
        exitCode: 2,
        stdout: "",
        stderr: JSON.stringify({
          error: true,
          message: "could not create a temporary worktree for base ref 'origin/main'",
          exit_code: 2,
        }),
      })
    ).toBe(true);
    expect(fallowAuditNeedsDiffFallbackForTesting({ exitCode: 2, stdout: '{"error":true}' })).toBe(false);
    expect(fallowAuditDiffFallbackArgsForTesting("origin/main", true, "/tmp/audit.diff")).toEqual([
      "run",
      "fallow",
      "--",
      "audit",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      "--quiet",
      "--base",
      "origin/main",
      "--diff-file",
      "/tmp/audit.diff",
      "--gate",
      "all",
    ]);
  });

  it("includes untracked files in the diff-scoped audit input", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.acquireUseRelease(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = yield* fs.makeTempDirectory();

            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "quality-test@example.com"]);
            yield* runGit(repoRoot, ["config", "user.name", "Quality Test"]);
            yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
            yield* fs.writeFileString(path.join(repoRoot, "tracked.ts"), "export const tracked = 1;\n");
            yield* runGit(repoRoot, ["add", "tracked.ts"]);
            yield* runGit(repoRoot, ["commit", "-m", "init"]);
            yield* fs.writeFileString(path.join(repoRoot, "tracked.ts"), "export const tracked = 2;\n");
            yield* fs.writeFileString(path.join(repoRoot, "untracked.ts"), "export const untracked = true;\n");

            return { fs, repoRoot } as const;
          }),
          ({ repoRoot }) =>
            Effect.gen(function* () {
              const result = yield* collectAuditDiffInputForTesting(repoRoot, "HEAD");

              expect(result.exitCode).toBe(0);
              expect(result.stdout).toContain("tracked.ts");
              expect(result.stdout).toContain("untracked.ts");
              expect(result.stdout).toContain("new file mode");
            }),
          ({ fs, repoRoot }) => fs.remove(repoRoot, { recursive: true, force: true }).pipe(Effect.ignore)
        ).pipe(provideScopedLayer(PlatformLayer))
      )
    ));

  it("keeps wired pre-push Fallow lanes in parity with authoritative promoted matrix lanes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const matrixText = yield* fs.readFileString(
          path.join(repoRoot, "goals/fallow-quality-enforcement/research/feature-matrix.jsonc")
        );
        const matrix = yield* decodeGithubChecksFallowFeatureMatrixJsoncForTesting(matrixText);
        const promotedLaneIds = promotedFallowGithubCheckLaneIdsForTesting(matrix);
        const wiredFallowLaneIds = pipe(
          githubCheckLanesForModeForTesting("/repo", "pre-push"),
          A.map((lane) => lane.id),
          A.filter(Str.startsWith("fallow:")),
          A.dedupe,
          A.sort(Order.String)
        );

        expect(wiredFallowLaneIds).toEqual(promotedLaneIds);
        expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([]);
      }).pipe(provideScopedLayer(FileSystemLayer))
    ));

  it("does not wire removed Fallow dupes or reuse clone lanes", () => {
    const laneIds = pipe(
      githubCheckLanesForModeForTesting("/repo", "pre-push"),
      A.map((lane) => lane.id)
    );

    expect(laneIds).toContain("repo-sanity:fallow-boundaries-config");
    expect(laneIds).not.toContain("quality:reuse-clones");
    expect(laneIds).not.toContain("fallow:dupes");
    expect(laneIds).not.toContain("fallow:boundaries");
  });

  it("keeps CI Fallow blocking failures deferred until advisory envelopes are written", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));

        // The fallow lane body lives in the beep CLI (one-round-loop P0
        // inversion): check.yml dispatches `beep ci lane fallow`, and the
        // deferred-exit ordering (blocking lanes run first, advisory lanes
        // still execute, envelope existence is checked, THEN blocking
        // status fails the lane) is owned by runCiFallowLane and pinned by
        // the ci-lane step-plan tests. Here we pin the workflow contract:
        // the dispatch line, and envelope validation as a separate
        // always()-guarded step after the run step.
        const dispatchIndex = workflowText.indexOf(
          'bun run beep ci lane fallow --base "${{ steps.base.outputs.base_ref }}"'
        );
        const validateStepIndex = workflowText.indexOf("      - name: Validate Fallow envelopes", dispatchIndex);
        const uploadStepIndex = workflowText.indexOf("      - name: Upload Fallow envelopes", validateStepIndex);

        expect(dispatchIndex).toBeGreaterThan(-1);
        expect(workflowText).not.toContain("run_blocking_fallow()");
        expect(validateStepIndex).toBeGreaterThan(dispatchIndex);
        expect(uploadStepIndex).toBeGreaterThan(validateStepIndex);

        // Deferred-exit ordering, from the lane's own step plan: both
        // blocking lanes precede every advisory lane, and envelope
        // validation steps come last when replayed locally.
        const plan = ciLaneStepsForTesting(
          "/repo",
          "fallow",
          CiLaneRunOptions.make({
            affected: false,
            base: "origin/main",
            head: "HEAD",
            summarize: false,
            mode: "affected",
            to: "HEAD",
            last: false,
            changesetStatus: false,
            validateEnvelopes: true,
          })
        );
        const labels = A.map(plan, (step) => step.label);
        expect(A.take(labels, 2)).toEqual(["ci:fallow:audit", "ci:fallow:dead-code"]);
        expect(labels).toContain("ci:fallow:envelope-check:dead-code");
      }).pipe(provideScopedLayer(FileSystemLayer))
    ));

  it("rejects a promoted Fallow matrix row that is not wired into pre-push", () => {
    // dead-code is wired; health is promoted but not wired → missing health diagnostic
    const matrix = fallowFeatureMatrix([
      ["audit", "blocking-check", "blocking"],
      ["dead-code", "blocking-check", "blocking"],
      ["health", "blocking-check", "blocking"],
    ]);

    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
      "missing promoted Fallow GitHub check lane fallow:health",
    ]);
  });

  it("rejects a wired Fallow lane whose matrix row is not promoted", () => {
    expectUnpromotedWiredFallowLanes(
      fallowFeatureMatrix([
        ["audit", "advisory-artifact", "research"],
        ["dead-code", "advisory-artifact", "research"],
      ])
    );
  });

  it("treats candidate-blocking Fallow rows as promotion contract inputs", () => {
    // health=candidate-blocking counts as promoted; dead-code wired but research → both diagnostics fire
    const matrix = fallowFeatureMatrix([
      ["health", "advisory-artifact", "candidate-blocking"],
      ["audit", "advisory-artifact", "research"],
      ["dead-code", "advisory-artifact", "research"],
    ]);
    expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual(["fallow:health"]);
    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
      "missing promoted Fallow GitHub check lane fallow:health",
      "unpromoted Fallow GitHub check lane is wired: fallow:audit",
      "unpromoted Fallow GitHub check lane is wired: fallow:dead-code",
    ]);
  });

  it("requires Fallow CI upload wiring only when the contract requires uploads", () => {
    const uploadStep = {
      uses: "actions/upload-artifact@v4",
      with: {
        "if-no-files-found": "error",
        path: ".beep/fallow/**",
      },
    };

    expect(fallowCiUploadDiagnosticsForTesting(false, [], [], ".beep/fallow", "error")).toEqual([]);
    expect(fallowCiUploadDiagnosticsForTesting(true, [], [], ".beep/fallow", "error")).toEqual([
      "missing upload of complete Fallow output tree: .beep/fallow/**",
      "missing actions/upload-artifact step",
      "missing if-no-files-found: error",
    ]);
    expect(
      fallowCiUploadDiagnosticsForTesting(true, ["actions/upload-artifact@v4"], [uploadStep], ".beep/fallow", "error")
    ).toEqual([]);
  });

  it("accepts promoted Fallow findings with blocking true in report envelopes", () => {
    expect(
      FallowReportFinding.make({
        attribution: "introduced",
        blocking: true,
        featureFamily: "audit",
        id: "audit-introduced-dead-code-1",
        parser: "fallow/audit/v1",
        sourceRef: "standards/fallow.pilot.inventory.jsonc",
        subCategory: "fallow:audit:dead-code",
      }).blocking
    ).toBe(true);
  });

  it("detects explicit quality hardware profiles", () => {
    expect(
      detectQualityProfileForTesting({
        ci: true,
        cpuCount: 64,
        totalMemoryBytes: 128 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "ci",
      config: { fullProofSlots: 1, reviewFixSlots: 1 },
    });
    expect(
      detectQualityProfileForTesting({
        ci: false,
        cpuCount: 64,
        totalMemoryBytes: 128 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "workstation",
      config: { docgenParallel: 6, reviewFixSlots: 3 },
    });
    expect(
      detectQualityProfileForTesting({
        ci: false,
        cpuCount: 8,
        totalMemoryBytes: 16 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "current",
      config: { docgenParallel: 3, reviewFixSlots: 1 },
    });
    expect(qualityProfileConfigForTesting("workstation")).toMatchObject({
      fullProofSlots: 1,
      turboConcurrency: 8,
    });
  });

  it("includes repo-level tsgo diagnostics for affected root check lanes", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--affected", "--summarize"]));

    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatchObject({
      label: "check",
      command: "bunx",
      cwd: "/repo",
    });
    expect(steps[0]?.args).toEqual([
      "turbo",
      "run",
      "check",
      ...(Bun.env.CI === "true" ? [] : ["--cache=local:rw", "--concurrency=3"]),
      "--affected",
      "--summarize",
    ]);
    expect(A.slice(steps, { start: 1 })).toEqual([
      expect.objectContaining({
        label: "check:dtslint:tsgo",
        command: "bun",
        args: ["run", "beep", "quality", "dtslint-tsgo"],
      }),
      expect.objectContaining({
        label: "check:tsgo:tests",
        command: "bun",
        args: ["run", "beep", "quality", "test-tsgo"],
      }),
      expect.objectContaining({
        label: "check:tsgo:smoke",
        command: "bun",
        args: ["run", "beep", "quality", "tsgo-smoke"],
      }),
    ]);
  });

  it("collects Effect tsgo warnings from successful package results", () => {
    const diagnostics = collectEffectTsgoDiagnosticLines([
      {
        output: [
          "src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage",
          "src/example.test.ts:2:1 - warning TS99999: unrelated diagnostic",
        ].join("\n"),
      },
    ]);

    expect(diagnostics).toEqual(["src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage"]);
  });

  it("normalizes Knip findings with stable ordering and without position fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const findings = yield* normalizeKnipReportForTesting(
          encodeJson({
            issues: [
              {
                file: "b.ts",
                exports: [{ name: "Beta", line: 5, col: 14, pos: 100 }],
              },
              {
                file: "a.ts",
                dependencies: [{ name: "left-pad", line: 10, col: 6, pos: 220 }],
                files: [{ name: "a.ts" }],
              },
            ],
          })
        );

        expect(findings).toEqual([
          KnipFinding.make({ kind: "dependencies", file: "a.ts", name: "left-pad" }),
          KnipFinding.make({ kind: "exports", file: "b.ts", name: "Beta" }),
          KnipFinding.make({ kind: "files", file: "a.ts", name: "a.ts" }),
        ]);
      })
    ));

  it("compares Knip findings as fail-on-growth and advisory shrinkage", () => {
    const inherited = KnipFinding.make({ kind: "exports", file: "src/a.ts", name: "legacy" });
    const removed = KnipFinding.make({ kind: "dependencies", file: "package.json", name: "unused-lib" });
    const introduced = KnipFinding.make({ kind: "types", file: "src/b.ts", name: "NewType" });

    expect(compareKnipFindingsForTesting([inherited], [removed, inherited])).toMatchObject({
      current_count: 1,
      baseline_count: 2,
      introduced: [],
      resolved: [removed],
    });
    expect(compareKnipFindingsForTesting([inherited, introduced], [inherited])).toMatchObject({
      current_count: 2,
      baseline_count: 1,
      introduced: [introduced],
      resolved: [],
    });
  });

  it("compares JSDoc totals as fail-on-growth and advisory shrinkage", () => {
    expect(
      compareJSDocTotalsForTesting(
        {
          missingExportExamples: 10,
          unsafeExampleFindings: 2,
        },
        {
          missingExportExamples: 12,
          unsafeExampleFindings: 2,
        }
      )
    ).toMatchObject({
      increased: [],
      decreased: [
        {
          metric: "missingExportExamples",
          baseline: 12,
          current: 10,
          delta: -2,
        },
      ],
      missing_current_metrics: [],
    });

    expect(
      compareJSDocTotalsForTesting(
        {
          missingExportExamples: 13,
        },
        {
          missingExportExamples: 12,
          unsafeExampleFindings: 2,
        }
      )
    ).toMatchObject({
      increased: [
        {
          metric: "missingExportExamples",
          baseline: 12,
          current: 13,
          delta: 1,
        },
      ],
      decreased: [],
      missing_current_metrics: ["unsafeExampleFindings"],
    });
  });

  it("skips repo-level tsgo diagnostics only for explicit package filters", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--filter=@beep/schema"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("check", ["--filter=@beep/schema"]));
  });

  it("keeps scope args in the aggregate lint --fix step", () => {
    const steps = rootQualityStepsForTesting(
      "/repo",
      getInvocation(["lint", "--fix", "--filter=@beep/schema", "--affected", "--dry=json"])
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: expectedRootTurboArgs("lint:fix", ["--filter=@beep/schema", "--affected", "--dry=json"]),
    });
  });

  it("strips lint --fix aggregate aliases before delegating to Turbo", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", "--full", "--repo"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: expectedRootTurboArgs("lint:fix", []),
    });
  });

  it("preserves explicit lint Turbo concurrency", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", "--full", "--concurrency=1"]));

    expect(steps[0]?.args).toEqual(expectedTurboArgs("lint:fix", ["--concurrency=1"]));
  });

  it("plans repo-wide root lint as aggregate and policy sibling steps", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint"]));

    expect(A.map(steps, (step) => step.label)).toEqual([
      "lint",
      "lint:effect-imports",
      "lint:terse-effect",
      "lint:effect-fn",
      "lint:native-runtime",
      "lint:dual-arity",
      "lint:allowlist",
      "lint:tsgo-rules",
      "lint:identity-registry",
      "lint:package-test-imports",
      "lint:package-test-typecheck",
      "lint:reflection-artifacts",
      "lint:roadmap-refs",
      "goals:doctor",
      "goals:index-check",
      "lint:schema-first",
      "lint:deprecated-apis",
      "lint:jsdoc",
      "lint:jsdoc-module-tags",
      "lint:docgen",
      "lint:spell",
      "lint:markdown",
      "lint:circular",
      "lint:typos",
      "lint:oxlint",
    ]);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", []));
  });

  it("plans repo-wide root lint policy without the aggregate lint lane", () => {
    const steps = rootLintPolicyStepsForTesting("/repo");

    expect(A.map(steps, (step) => step.label)).toEqual([
      "lint:effect-imports",
      "lint:terse-effect",
      "lint:effect-fn",
      "lint:native-runtime",
      "lint:dual-arity",
      "lint:allowlist",
      "lint:tsgo-rules",
      "lint:identity-registry",
      "lint:package-test-imports",
      "lint:package-test-typecheck",
      "lint:reflection-artifacts",
      "lint:roadmap-refs",
      "goals:doctor",
      "goals:index-check",
      "lint:schema-first",
      "lint:deprecated-apis",
      "lint:jsdoc",
      "lint:jsdoc-module-tags",
      "lint:docgen",
      "lint:spell",
      "lint:markdown",
      "lint:circular",
      "lint:typos",
      "lint:oxlint",
    ]);
    expect(steps.find((step) => step.label === "lint:jsdoc")?.args).toEqual(["eslint", ".", "--max-warnings=0"]);
  });

  it("runs repo-wide root lint policy with hosted-stable concurrency", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const binDir = path.join(tmpDir, "bin");
          const fakeBunxPath = path.join(binDir, "bunx");
          const fakeBunPath = path.join(binDir, "bun");

          yield* fs.makeDirectory(binDir, { recursive: true });
          yield* fs.writeFileString(fakeBunxPath, ["#!/usr/bin/env sh", "exit 0", ""].join("\n"));
          yield* fs.writeFileString(fakeBunPath, ["#!/usr/bin/env sh", "exit 0", ""].join("\n"));
          yield* fs.chmod(fakeBunxPath, 0o755);
          yield* fs.chmod(fakeBunPath, 0o755);

          const exit = yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.exit(runRootLintPolicyTask)
          );

          expect(Exit.isSuccess(exit)).toBe(true);

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] lint:policy: running 24 step(s) with concurrency 3");
        })
      )
    ));

  it("applies Biome lint fixes in the changed-file lint fix fast path", () => {
    const step = lintFixChangedStepForTesting("/repo", ["packages/example/src/index.ts"]);

    expect(step).toMatchObject({
      label: "lint:fix:changed",
      command: "./node_modules/.bin/biome",
      args: [
        "check",
        "--write",
        "--files-ignore-unknown=true",
        "--no-errors-on-unmatched",
        "--",
        "packages/example/src/index.ts",
      ],
      cwd: "/repo",
    });
  });

  it("lets Biome own changed-file matching in the lint fix fast path", () => {
    const step = lintFixChangedStepForTesting("/repo", [
      ".claude/skills/yeet/SKILL.md",
      "packages/example/src/index.ts",
      "schema/example.graphql",
    ]);

    expect(step.args).toEqual([
      "check",
      "--write",
      "--files-ignore-unknown=true",
      "--no-errors-on-unmatched",
      "--",
      ".claude/skills/yeet/SKILL.md",
      "packages/example/src/index.ts",
      "schema/example.graphql",
    ]);
  });

  it("runs combined root coverage tasks in ratchet mode", () => {
    const passthroughTasks = ["build", "check", "test", "coverage", "audit", "lint", "docgen"] as const;
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", ...passthroughTasks]));

    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: expectedRootTurboArgs("lint:fix", passthroughTasks),
      env: {
        BEEP_FC_SEED: "20260708",
        NODE_OPTIONS: "--no-experimental-webstorage",
        VITEST_COVERAGE_RATCHET: "1",
      },
    });
    expect(steps[0]?.env).not.toHaveProperty("VITEST_COVERAGE_REPORT_ONLY");
  });

  it("runs root coverage as the ratchet gate by default", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["coverage"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "coverage:ratchet",
      command: "bunx",
      args: expectedRootTurboArgs("coverage", []),
      env: {
        BEEP_FC_SEED: "20260708",
        NODE_OPTIONS: "--no-experimental-webstorage",
        VITEST_COVERAGE_RATCHET: "1",
      },
    });
    expect(steps[0]?.env).not.toHaveProperty("VITEST_COVERAGE_REPORT_ONLY");
  });

  it("preserves existing Node options when disabling experimental Web Storage for coverage", () => {
    const steps = withEnvVar("NODE_OPTIONS", "--max-old-space-size=4096", () =>
      rootQualityStepsForTesting("/repo", getInvocation(["coverage"]))
    );

    expect(steps[0]?.env).toMatchObject({
      BEEP_FC_SEED: "20260708",
      NODE_OPTIONS: "--max-old-space-size=4096 --no-experimental-webstorage",
    });
  });

  it("honors an explicit fast-check seed for exploratory coverage runs", () => {
    const steps = withEnvVar("BEEP_FC_SEED", "8675309", () =>
      rootQualityStepsForTesting("/repo", getInvocation(["coverage"]))
    );

    expect(steps[0]?.env).toMatchObject({
      BEEP_FC_SEED: "8675309",
      NODE_OPTIONS: "--no-experimental-webstorage",
    });
  });

  it("keeps report-only coverage reserved for baseline regeneration", () => {
    const steps = rootQualityStepsForTesting(
      "/repo",
      getInvocation(["coverage", "--write-baseline", "--concurrency=1"])
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "coverage:baseline",
      command: "bunx",
      args: expectedTurboArgs("coverage", ["--concurrency=1"]),
      env: {
        BEEP_FC_SEED: "20260708",
        NODE_OPTIONS: "--no-experimental-webstorage",
        VITEST_COVERAGE_RATCHET: "1",
        VITEST_COVERAGE_REPORT_ONLY: "1",
      },
    });
  });

  it("compares coverage snapshots with fail-on-drop and warning-only new package semantics", () => {
    const result = compareCoverageRegressionSnapshotsForTesting(
      coverageRegressionBaseline,
      [
        {
          packageName: "@beep/existing",
          baseline: CoveragePackageBaseline.make({
            path: "packages/existing",
            lines: 49.998,
            statements: 50,
            branches: 50,
            functions: 50,
          }),
        },
        {
          packageName: "@beep/new",
          baseline: coveragePackageBaseline("packages/new"),
        },
      ],
      false
    );

    expect(result.comparedCount).toBe(1);
    expect(result.missingActuals).toEqual([]);
    expect(result.newPackages).toEqual([
      expect.objectContaining({
        packageName: "@beep/new",
        baseline: expect.objectContaining({ path: "packages/new" }),
      }),
    ]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        packageName: "@beep/existing",
        metric: "lines",
        actual: 49.998,
        baseline: 50,
      }),
    ]);
  });

  it("only fails missing baseline-package summaries for unscoped coverage runs", () => {
    expect(compareCoverageRegressionSnapshotsForTesting(coverageRegressionBaseline, [], false).missingActuals).toEqual([
      "@beep/existing",
    ]);
    expect(compareCoverageRegressionSnapshotsForTesting(coverageRegressionBaseline, [], true).missingActuals).toEqual(
      []
    );
  });

  it("runs unit and types as separate turbo invocations", () => {
    const steps = rootQualityStepsForTesting(
      "/repo",
      getInvocation(["test", "--unit", "--types", "--filter=@beep/schema", "--summarize"])
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      label: "test:unit",
      command: "bunx",
      args: expectedRootTurboArgs("test", ["--filter=@beep/schema", "--summarize"]),
    });
    expect(steps[1]).toMatchObject({
      label: "test:types",
      command: "bunx",
      args: expectedRootTurboArgs("type-test", ["--filter=@beep/schema", "--summarize"]),
    });
  });

  it("builds the integration lane command with shared SQL environment", () => {
    const step = sqlIntegrationStepForTesting("/repo", ["--filter=@beep/test-utils", "--summarize"], {
      connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
    });

    expect(step).toMatchObject({
      label: "test:integration",
      command: "bunx",
      args: expectedTurboArgs("test:integration", ["--concurrency=1", "--filter=@beep/test-utils", "--summarize"]),
      cwd: "/repo",
      env: {
        BEEP_TEST_DATABASE_DRIVER: "pg-external",
        BEEP_TEST_DATABASE_ISOLATION: "schema",
        BEEP_TEST_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
      },
    });
  });

  it("requires explicit test SQL URLs over generic application defaults", () => {
    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        BEEP_TEST_DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
        DATABASE_URL: "postgres://other:secret@127.0.0.1:5432/other",
      })
    ).toEqual(O.some("postgres://test:secret@127.0.0.1:5432/test"));

    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
      })
    ).toEqual(O.none());

    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        BEEP_TEST_DATABASE_URL: "op://beep-dev-secrets/DATABASE_URL",
        DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
        DATABASE_URL_UNPOOLED: "postgres://test:secret@127.0.0.1:5432/test",
      })
    ).toEqual(O.none());
  });

  it("forwards shared SQL env vars to the integration child process", () =>
    Effect.runPromise(
      withTempRepo(
        runSqlIntegrationTestLaneForTesting({
          acquireResource: Effect.acquireRelease(
            Effect.succeed({
              connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
            }),
            () => Effect.void
          ),
          args: [],
          childCommand: {
            command: "bun",
            args: [
              "-e",
              "process.exit(Bun.env.BEEP_TEST_DATABASE_URL === 'postgres://postgres:postgres@127.0.0.1:5432/postgres' && Bun.env.BEEP_TEST_DATABASE_DRIVER === 'pg-external' ? 0 : 42)",
            ],
          },
          repoRoot: process.cwd(),
        })
      )
    ));

  it("fails nonzero integration children and releases the shared SQL resource", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          let released = false;
          const exit = yield* Effect.exit(
            runSqlIntegrationTestLaneForTesting({
              acquireResource: Effect.acquireRelease(
                Effect.succeed({
                  connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
                }),
                () =>
                  Effect.sync(() => {
                    released = true;
                  })
              ),
              args: [],
              childCommand: {
                command: "bun",
                args: ["-e", "process.exit(7)"],
              },
              repoRoot: process.cwd(),
            })
          );

          expect(released).toBe(true);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskFailed);
            if (isQualityTaskFailed(failure)) {
              expect(failure.exitCode).toBe(7);
            }
          }
        })
      )
    ));

  it("runs grouped quality steps with bounded concurrency and deterministic output", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep("test:slow", "await Bun.sleep(20); console.log('slow')"),
              bunScriptStep("test:fast", "console.log('fast')"),
            ],
            2
          );

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] test:group: running 2 step(s) with concurrency 2");
          expect(logText).toContain("[beep-cli] test:slow: bun -e await Bun.sleep(20); console.log('slow')");
          expect(logText).toContain("[beep-cli] test:fast: bun -e console.log('fast')");
          expectSubstringBefore(logText, "[beep-cli] test:slow output:\nslow", "[beep-cli] test:fast output:\nfast");
        })
      )
    ));

  it("truncates retained grouped quality step output", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep(
                "test:large-output",
                "process.stdout.write('x'.repeat(300000)); console.log('tail-marker')"
              ),
            ],
            1
          );

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] output truncated after 262144 characters");
          expect(Str.length(logText)).toBeLessThan(270_000);
        })
      )
    ));

  it("aggregates grouped quality step failures in configured step order", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            runQualityTaskStepGroupForTesting(
              "test:group",
              [
                bunScriptStep("test:first", "console.log('first failed'); process.exit(7)"),
                bunScriptStep("test:second", "console.log('second failed'); process.exit(3)"),
              ],
              2
            )
          );

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first", "test:second"]);
            }
          }

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expectSubstringBefore(
            logText,
            "[beep-cli] test:first output:\nfirst failed",
            "[beep-cli] test:second output:\nsecond failed"
          );

          const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:group: failed 2 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('first failed'); process.exit(7)");
          expect(errorText).toContain("[beep-cli]   test:second: exit 3");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('second failed'); process.exit(3)");
        })
      )
    ));

  it("streams grouped quality step failures and keeps running sibling steps", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const markerPath = path.join(process.cwd(), "second-ran.txt");
          const exit = yield* Effect.exit(
            runQualityTaskStreamingStepGroupForTesting("test:stream", [
              bunScriptStep("test:first", "process.exit(7)"),
              bunScriptStep("test:second", "await Bun.write('second-ran.txt', 'yes')"),
            ])
          );

          expect(yield* fs.exists(markerPath)).toBe(true);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first"]);
            }
          }

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] test:stream: running 2 streaming step(s)");
          expectSubstringBefore(logText, "[beep-cli] test:first:", "[beep-cli] test:second:");

          const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:stream: failed 1 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e process.exit(7)");
        })
      )
    ));

  it("keeps running repo-wide root lint policy checks after aggregate lint fails", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const binDir = path.join(tmpDir, "bin");
          const commandLogPath = path.join(tmpDir, "quality-commands.log");
          const fakeBunxPath = path.join(binDir, "bunx");
          const fakeBunPath = path.join(binDir, "bun");

          yield* fs.makeDirectory(binDir, { recursive: true });
          yield* fs.writeFileString(
            fakeBunxPath,
            [
              "#!/usr/bin/env sh",
              "printf 'bunx %s\\n' \"$*\" >> quality-commands.log",
              'if [ "$1" = "turbo" ] && [ "$2" = "run" ] && [ "$3" = "lint" ]; then',
              "  exit 7",
              "fi",
              "exit 0",
              "",
            ].join("\n")
          );
          yield* fs.writeFileString(
            fakeBunPath,
            ["#!/usr/bin/env sh", "printf 'bun %s\\n' \"$*\" >> quality-commands.log", "exit 0", ""].join("\n")
          );
          yield* fs.chmod(fakeBunxPath, 0o755);
          yield* fs.chmod(fakeBunPath, 0o755);

          const exit = yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.exit(runQualityTask(getInvocation(["lint"])))
          );

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["lint"]);
            }
          }

          const commandLog = yield* fs.readFileString(commandLogPath);
          // The aggregate lint step and the policy steps run grouped-concurrent
          // (LINT_POLICY_STEP_CONCURRENCY), so log order between them is not
          // guaranteed — the resilience property is that every policy check
          // still executes after the aggregate lint step fails.
          expect(commandLog).toContain("bunx turbo run lint");
          expect(commandLog).toContain("bun run beep laws effect-imports --check");
          expect(commandLog).toContain("bun run beep lint roadmap-refs");
          expect(commandLog).toContain("bun run beep docgen check --reuse-proof-manifest");
          expect(commandLog).toContain("bunx typos");

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] lint: running 25 step(s) with concurrency 3");
        })
      )
    ));

  it("leaves lint policy subcommands on the existing command tree", () => {
    expect(O.isNone(parseQualityTaskInvocation(["lint", "circular"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "deprecated-apis"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "package-test-imports"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "policy"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "schema-first"]))).toBe(true);
  });

  it("leaves root CLI help and metadata flags on the existing command tree", () => {
    expect(O.isNone(parseQualityTaskInvocation(["lint", "--help"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["check", "-h"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["build", "--version"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["test", "--log-level=debug"]))).toBe(true);
  });

  it("delegates affected root lint only to the affected aggregate repo lint lane", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--affected", "--summarize"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", ["--affected", "--summarize"]));
  });

  it("skips repo-wide lint policy checks for explicit package filters", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--filter=@beep/schema"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", ["--filter=@beep/schema"]));
  });

  it("limits root type and integration test filters to script-owning workspaces", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const plainPackageDir = path.join(tmpDir, "packages", "plain");
          const typePackageDir = path.join(tmpDir, "packages", "typed");
          const integrationPackageDir = path.join(tmpDir, "apps", "integration");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: {
                packages: ["packages/*", "apps/*"],
              },
            })
          );
          yield* fs.makeDirectory(plainPackageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(plainPackageDir, "package.json"),
            encodeJson({
              name: "@beep/plain",
              private: true,
              scripts: {
                test: "vitest",
              },
            })
          );
          yield* fs.makeDirectory(typePackageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(typePackageDir, "package.json"),
            encodeJson({
              name: "@beep/typed",
              private: true,
              scripts: {
                "type-test": "tstyche",
              },
            })
          );
          yield* fs.makeDirectory(integrationPackageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(integrationPackageDir, "package.json"),
            encodeJson({
              name: "@beep/integration",
              private: true,
              scripts: {
                "test:integration": "vitest run test/integration",
              },
            })
          );

          const typeFilters = yield* workspaceTaskFiltersForTesting(tmpDir, "type-test");
          const integrationFilters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          expect(typeFilters).toEqual(["--filter=@beep/typed"]);
          expect(integrationFilters).toEqual(["--filter=@beep/integration"]);
        })
      )
    ));

  it("treats unsupported package tasks as explicit no-ops", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const packageDir = path.join(tmpDir, "packages", "empty");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/*"],
            })
          );
          yield* fs.makeDirectory(packageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/empty",
              private: true,
              scripts: {
                lint: "beep-cli lint",
              },
            })
          );

          process.chdir(packageDir);
          yield* runQualityTask(getInvocation(["lint"]));

          const lines = yield* TestConsole.logLines;
          expect(lines).toEqual(["[beep-cli] @beep/empty lint: no-op"]);
          expect(process.exitCode ?? 0).toBe(0);
        })
      )
    ));
});
