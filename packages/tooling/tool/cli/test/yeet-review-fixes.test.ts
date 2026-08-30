import { tmpdir } from "node:os";
import { MemoryStats, provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun";
import {
  emptyTurboPlanSnapshot,
  loadYeetInboxView,
  proofCoordinatorLockPath,
  proofLockPathForContext,
  RepoPlanStep,
  RepoRunContext,
  runProofPhaseForTesting,
  runWithFullProofCoordinatorForTesting,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer))
);

const contextAt = (repoRoot: string): RepoRunContext =>
  RepoRunContext.make({
    repoRoot,
    cwd: repoRoot,
    base: "origin/main",
    head: "HEAD",
    branch: "review-fixes",
    packetDir: ".beep/yeet",
    originalArgv: [],
    turbo: emptyTurboPlanSnapshot([]),
  });

const withTempDirectory = <Success, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Success, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(PlatformLayer));

const runGit = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* Effect.sync(() =>
    Bun.spawnSync(["git", ...args], {
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    })
  );
  expect(result.exitCode).toBe(0);
});

const memoryStatsTestLayer = Layer.succeed(
  MemoryStats,
  MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) })
);

const withProofCoordinatorRepo = <Success, Error, Requirements>(
  use: (repo: {
    readonly context: RepoRunContext;
    readonly lockPath: string;
  }) => Effect.Effect<Success, Error, Requirements>
) =>
  withTempDirectory((tmpDir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* runGit(tmpDir, ["init"]);
      yield* runGit(tmpDir, [
        "remote",
        "add",
        "origin",
        `https://example.test/review-fixes/${path.basename(tmpDir)}.git`,
      ]);
      const context = contextAt(tmpDir);
      const lockPath = yield* proofLockPathForContext(context);
      yield* fs.remove(lockPath, { force: true });
      return yield* Effect.acquireUseRelease(Effect.succeed({ context, lockPath }), use, ({ lockPath: acquiredPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.remove(acquiredPath, { force: true });
        })
      );
    }).pipe(
      // Coordinator locks and admission leases both live under the temp
      // runtime root, so removing tmpDir cleans every artifact.
      provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: `${tmpDir}/runtime` })),
      provideScopedLayer(memoryStatsTestLayer)
    )
  );

const proofStep = (repoRoot: string, id: string, source: string): RepoPlanStep =>
  RepoPlanStep.make({
    id,
    label: id,
    phase: "full",
    command: "bun",
    args: ["--eval", source],
    cwd: repoRoot,
    env: {
      BEEP_YEET_ADMISSION_LEASE_ID: "review-fixes-test-lease",
      BEEP_YEET_ADMISSION_WORKLOAD_PATH: `${repoRoot}/.review-fixes-test.workload`,
    },
    scope: "repo",
    mutability: "readonly",
    resume: "never",
  });

const equivalentOriginCases = [
  {
    label: "GitHub owner/repository",
    origins: [
      "git@GitHub.COM:Acme/Repo.git",
      "ssh://git@github.com:22/Acme/Repo.git",
      "https://user:secret@github.com:443/Acme/Repo.git/",
      "git://github.com:9418/Acme/Repo/",
    ],
  },
  {
    label: "nested GitLab repository",
    origins: [
      "git@gitlab.example:Group/Subgroup/Repo.git",
      "ssh://git@gitlab.example/Group/Subgroup/Repo/",
      "https://GITLAB.EXAMPLE/Group/Subgroup/Repo.git/",
    ],
  },
];

describe("yeet review fixes", () => {
  it("stops the proof phase after a failing cheap-gates step", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
          const cheapGates = proofStep(tmpDir, "full:cheap-gates", "process.exitCode = 23");
          const prePush = proofStep(tmpDir, "full:pre-push", 'console.log("must not run")');

          const results = yield* runProofPhaseForTesting(contextAt(tmpDir), [cheapGates, prePush], recorder);
          const executed = yield* Ref.get(recorder);

          expect(A.map(results, (result) => result.stepId)).toEqual(["full:cheap-gates"]);
          expect(A.map(executed, (entry) => entry.step.id)).toEqual(["full:cheap-gates"]);
          expect(results[0]?.exitCode).toBe(23);
        })
      )
    ));

  it("poisons the checkout on a local shard failure and clears it after the shard succeeds", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* runGit(tmpDir, ["init"]);
          yield* runGit(tmpDir, [
            "-c",
            "user.name=Yeet Test",
            "-c",
            "user.email=yeet@example.test",
            "commit",
            "--allow-empty",
            "-m",
            "test: seed repo",
          ]);
          const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());

          yield* runProofPhaseForTesting(
            contextAt(tmpDir),
            [proofStep(tmpDir, "full:check", "process.exitCode = 23")],
            recorder
          );
          const failedView = yield* loadYeetInboxView(tmpDir);
          expect(failedView.entries).toHaveLength(1);
          expect(failedView.entries[0]?.row.kind).toBe("local-shard-failed");
          expect(failedView.entries[0]?.liveness).toBe("live");
          expect(failedView.entries[0]?.ack.acked).toBe(false);

          yield* runProofPhaseForTesting(
            contextAt(tmpDir),
            [proofStep(tmpDir, "full:check", "process.exitCode = 0")],
            recorder
          );
          const repairedView = yield* loadYeetInboxView(tmpDir);
          expect(repairedView.entries).toHaveLength(1);
          expect(repairedView.entries[0]?.ack.acked).toBe(true);
          expect(repairedView.entries[0]?.ack.receipt?.resolution.kind).toBe("fix-sha");
        })
      )
    ));

  it("runs every proof step when each step succeeds", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
          const cheapGates = proofStep(tmpDir, "full:cheap-gates", "process.exitCode = 0");
          const prePush = proofStep(tmpDir, "full:pre-push", "process.exitCode = 0");

          const results = yield* runProofPhaseForTesting(contextAt(tmpDir), [cheapGates, prePush], recorder);
          const executed = yield* Ref.get(recorder);

          expect(A.map(results, (result) => result.stepId)).toEqual(["full:cheap-gates", "full:pre-push"]);
          expect(A.map(executed, (entry) => entry.step.id)).toEqual(["full:cheap-gates", "full:pre-push"]);
          expect(A.every(results, (result) => result.exitCode === 0)).toBe(true);
        })
      )
    ));

  it("holds the coordinator across preflight and proof checkpoints and releases it on failure", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ context, lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const plannedProof = proofStep(context.repoRoot, "full:pre-push", 'console.log("proof")');

          const checkpoints = yield* runWithFullProofCoordinatorForTesting(
            context,
            [plannedProof],
            Effect.gen(function* () {
              const preflight = yield* fs.exists(lockPath);
              const proof = yield* fs.exists(lockPath);
              return { preflight, proof };
            })
          );

          expect(checkpoints).toEqual({ preflight: true, proof: true });
          expect(yield* fs.exists(lockPath)).toBe(false);

          const failure = yield* runWithFullProofCoordinatorForTesting(
            context,
            [plannedProof],
            Effect.gen(function* () {
              expect(yield* fs.exists(lockPath)).toBe(true);
              return yield* Effect.fail("expected proof failure");
            })
          ).pipe(Effect.flip);

          expect(failure).toBe("expected proof failure");
          expect(yield* fs.exists(lockPath)).toBe(false);
        })
      )
    ));

  it.each(equivalentOriginCases)("maps equivalent $label origins to one lock path", ({ origins }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* Effect.forEach(origins, proofCoordinatorLockPath, { concurrency: 1 });
        expect(A.dedupe(paths)).toHaveLength(1);
      }).pipe(provideScopedLayer(PlatformLayer))
    )
  );

  it("maps distinct repositories to distinct lock paths", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* proofCoordinatorLockPath("https://github.com/acme/repo.git");
        const other = yield* proofCoordinatorLockPath("https://github.com/acme/other.git");
        expect(repository).not.toBe(other);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("uses only absolute runtime roots and an ephemeral fallback", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const repositoryIdentity = "https://github.com/acme/repo.git";
        const resolveWithEnvironment = (environment: Readonly<Record<string, string>>) =>
          proofCoordinatorLockPath(repositoryIdentity).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)),
            provideScopedLayer(FileSystem.layerNoop({}))
          );
        const fallbackPrefix = path.join(tmpdir(), "beep-yeet-proof-locks-");
        const configuredRoot = path.join(tmpdir(), "configured-yeet-runtime");

        const missing = yield* resolveWithEnvironment({});
        const relative = yield* resolveWithEnvironment({ XDG_RUNTIME_DIR: "relative-runtime" });
        const configured = yield* resolveWithEnvironment({ XDG_RUNTIME_DIR: configuredRoot });

        expect(missing).toContain(fallbackPrefix);
        expect(relative).toContain(fallbackPrefix);
        expect(configured).toContain(fallbackPrefix);

        const overridden = yield* proofCoordinatorLockPath(repositoryIdentity).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: configuredRoot })),
          provideScopedLayer(FileSystem.layerNoop({}))
        );
        expect(overridden).toContain(path.join(configuredRoot, "beep-yeet-proof-locks-"));
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("preserves a non-default HTTPS port in the canonical repository authority", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const nonDefault = yield* proofCoordinatorLockPath("https://Example.test:8443/acme/repo.git");
        const equivalent = yield* proofCoordinatorLockPath("https://example.test:8443/acme/repo/");
        const defaultPort = yield* proofCoordinatorLockPath("https://example.test/acme/repo.git");

        expect(nonDefault).toBe(equivalent);
        expect(nonDefault).not.toBe(defaultPort);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("falls back to trimmed raw text for unsupported repository URL protocols", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("http://Example.test/acme/repo.git");
        const padded = yield* proofCoordinatorLockPath("  http://Example.test/acme/repo.git  ");
        const canonicalLooking = yield* proofCoordinatorLockPath("http://example.test/acme/repo");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(canonicalLooking);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("falls back to trimmed raw text when a supported repository URL has no hostname", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("git:///acme/repo.git");
        const padded = yield* proofCoordinatorLockPath("  git:///acme/repo.git  ");
        const other = yield* proofCoordinatorLockPath("git:///acme/other.git");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(other);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("falls back deterministically to trimmed unparseable origin text", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("local mirror alias");
        const padded = yield* proofCoordinatorLockPath("  local mirror alias  ");
        const other = yield* proofCoordinatorLockPath("local mirror other");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(other);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));
});
