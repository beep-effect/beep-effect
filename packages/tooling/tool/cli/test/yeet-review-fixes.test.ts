import { userInfo } from "node:os";
import {
  canonicalRuntimeRootForTesting,
  MemoryStats,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
} from "@beep/repo-cli/test/RepoRun";
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
import { it } from "@beep/test-runner";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { ConfigProvider, Console, Deferred, Effect, Fiber, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
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

const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true }).pipe(Effect.orDie)
  );
});

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

const memoryStatsTestService = (availableGib: number, totalGib: number) =>
  MemoryStats.of({ availableGib: Effect.succeed(availableGib), totalGib: Effect.succeed(totalGib) });

const prepareProofCoordinatorRepo = Effect.fnUntraced(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* runGit(tmpDir, ["init"]);
  const repositoryIdentity = `https://example.test/review-fixes/${path.basename(tmpDir)}.git`;
  yield* runGit(tmpDir, ["remote", "add", "origin", repositoryIdentity]);
  const context = contextAt(tmpDir);
  const lockPath = yield* proofLockPathForContext(context);
  yield* fs.remove(lockPath, { force: true });
  // The test scope releases this lock before its enclosing temporary directory.
  return yield* Effect.acquireRelease(
    Effect.succeed({ context, lockPath, repositoryIdentity }),
    ({ lockPath: acquiredPath }) => fs.remove(acquiredPath, { force: true }).pipe(Effect.orDie)
  );
});

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

it.layer(PlatformLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("yeet review fixes", () => {
    it.effect("stops the proof phase after a failing cheap-gates step", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("poisons the checkout on a local shard failure and clears it after the shard succeeds", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          yield* runGit(tmpDir, ["init"]);
          yield* runGit(tmpDir, [
            "-c",
            "user.name=Yeet Test",
            "-c",
            "user.email=yeet@example.test",
            "-c",
            "commit.gpgsign=false",
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("runs every proof step when each step succeeds", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("installs a persistent scheduler-retirement marker across success and failure", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.flatMap(prepareProofCoordinatorRepo(tmpDir), ({ context, lockPath }) =>
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
            expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v4"');

            const failure = yield* runWithFullProofCoordinatorForTesting(
              context,
              [plannedProof],
              Effect.gen(function* () {
                expect(yield* fs.exists(lockPath)).toBe(true);
                return yield* Effect.fail("expected proof failure");
              })
            ).pipe(Effect.flip);

            expect(failure).toBe("expected proof failure");
            expect(yield* fs.readFileString(lockPath)).toContain('"coordination":"quality-scheduler/v1"');
          })
        ).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: `${tmpDir}/runtime` })),
          Effect.provideService(MemoryStats, memoryStatsTestService(50, 128))
        )
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("allows two same-origin full proofs to overlap under weighted admission", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.flatMap(prepareProofCoordinatorRepo(tmpDir), ({ context, lockPath, repositoryIdentity }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const siblingRoot = path.join(context.repoRoot, "sibling-checkout");
            yield* fs.makeDirectory(siblingRoot);
            yield* runGit(siblingRoot, ["init"]);
            yield* runGit(siblingRoot, ["remote", "add", "origin", repositoryIdentity]);
            const siblingContext = contextAt(siblingRoot);
            const plannedProof = proofStep(context.repoRoot, "full:pre-push", 'console.log("proof")');
            const siblingProof = proofStep(siblingRoot, "full:pre-push", 'console.log("proof")');
            const firstEntered = yield* Deferred.make<void>();
            const secondEntered = yield* Deferred.make<void>();
            const first = yield* Effect.forkChild(
              runWithFullProofCoordinatorForTesting(
                siblingContext,
                [siblingProof],
                Effect.gen(function* () {
                  yield* Deferred.succeed(firstEntered, undefined);
                  yield* Deferred.await(secondEntered);
                  return "first";
                })
              )
            );
            yield* Deferred.await(firstEntered);
            const second = yield* Effect.forkChild(
              runWithFullProofCoordinatorForTesting(
                context,
                [plannedProof],
                Effect.gen(function* () {
                  yield* Deferred.succeed(secondEntered, undefined);
                  return "second";
                })
              )
            );

            yield* Deferred.await(secondEntered).pipe(Effect.timeout("2 seconds"));
            expect(yield* Fiber.join(first)).toBe("first");
            expect(yield* Fiber.join(second)).toBe("second");
            expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v4"');
          })
        ).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: `${tmpDir}/runtime` })),
          Effect.provideService(MemoryStats, memoryStatsTestService(50, 128))
        )
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("serializes same-origin proofs through the fallback lock below the scheduler envelope", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.flatMap(prepareProofCoordinatorRepo(tmpDir), ({ context, lockPath }) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const plannedProof = proofStep(context.repoRoot, "full:pre-push", 'console.log("proof")');
            const firstEntered = yield* Deferred.make<void>();
            const releaseFirst = yield* Deferred.make<void>();
            const secondEntered = yield* Deferred.make<void>();
            const first = yield* Effect.forkChild(
              runWithFullProofCoordinatorForTesting(
                context,
                [plannedProof],
                Effect.gen(function* () {
                  yield* Deferred.succeed(firstEntered, undefined);
                  yield* Deferred.await(releaseFirst);
                  return "first";
                })
              )
            );
            yield* Deferred.await(firstEntered);
            const second = yield* Effect.forkChild(
              runWithFullProofCoordinatorForTesting(
                context,
                [plannedProof],
                Effect.gen(function* () {
                  yield* Deferred.succeed(secondEntered, undefined);
                  return "second";
                })
              )
            );

            yield* Effect.sleep("100 millis");
            expect(second.pollUnsafe()).toBeUndefined();
            expect(yield* Deferred.isDone(secondEntered)).toBe(false);
            yield* Deferred.succeed(releaseFirst, undefined);
            expect(yield* Fiber.join(first)).toBe("first");
            expect(yield* Fiber.join(second)).toBe("second");
            expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v4"');
            expect(yield* fs.exists(path.join(path.dirname(lockPath), "scheduler-fallback.lock"))).toBe(false);
          })
        ).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: `${tmpDir}/runtime` })),
          Effect.provideService(MemoryStats, memoryStatsTestService(6, 8))
        )
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect.each(equivalentOriginCases)("maps equivalent $label origins to one lock path", ({ origins }) =>
      Effect.gen(function* () {
        const paths = yield* Effect.forEach(origins, proofCoordinatorLockPath, { concurrency: 1 });
        expect(A.dedupe(paths)).toHaveLength(1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("maps distinct repositories to distinct lock paths", () =>
      Effect.gen(function* () {
        const repository = yield* proofCoordinatorLockPath("https://github.com/acme/repo.git");
        const other = yield* proofCoordinatorLockPath("https://github.com/acme/other.git");
        expect(repository).not.toBe(other);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("uses one canonical runtime root and supports an isolated override", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const repositoryIdentity = "https://github.com/acme/repo.git";
        const resolveWithEnvironment = (environment: Readonly<Record<string, string>>) =>
          proofCoordinatorLockPath(repositoryIdentity).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)),
            Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({}))
          );
        const canonicalPrefix = path.join(
          canonicalRuntimeRootForTesting(process.platform, userInfo().homedir),
          "beep-yeet-proof-locks-"
        );
        const configuredRoot = path.join(
          canonicalRuntimeRootForTesting(process.platform, userInfo().homedir),
          "configured-yeet-runtime"
        );

        const missing = yield* resolveWithEnvironment({});
        const relative = yield* resolveWithEnvironment({ XDG_RUNTIME_DIR: "relative-runtime" });
        const configured = yield* resolveWithEnvironment({ XDG_RUNTIME_DIR: configuredRoot });

        expect(missing).toContain(canonicalPrefix);
        expect(relative).toContain(canonicalPrefix);
        expect(configured).toContain(canonicalPrefix);

        const overridden = yield* proofCoordinatorLockPath(repositoryIdentity).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: configuredRoot })),
          Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({}))
        );
        expect(overridden).toContain(path.join(configuredRoot, "beep-yeet-proof-locks-"));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("preserves a non-default HTTPS port in the canonical repository authority", () =>
      Effect.gen(function* () {
        const nonDefault = yield* proofCoordinatorLockPath("https://Example.test:8443/acme/repo.git");
        const equivalent = yield* proofCoordinatorLockPath("https://example.test:8443/acme/repo/");
        const defaultPort = yield* proofCoordinatorLockPath("https://example.test/acme/repo.git");

        expect(nonDefault).toBe(equivalent);
        expect(nonDefault).not.toBe(defaultPort);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("falls back to trimmed raw text for unsupported repository URL protocols", () =>
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("http://Example.test/acme/repo.git");
        const padded = yield* proofCoordinatorLockPath("  http://Example.test/acme/repo.git  ");
        const canonicalLooking = yield* proofCoordinatorLockPath("http://example.test/acme/repo");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(canonicalLooking);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("falls back to trimmed raw text when a supported repository URL has no hostname", () =>
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("git:///acme/repo.git");
        const padded = yield* proofCoordinatorLockPath("  git:///acme/repo.git  ");
        const other = yield* proofCoordinatorLockPath("git:///acme/other.git");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(other);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("falls back deterministically to trimmed unparseable origin text", () =>
      Effect.gen(function* () {
        const raw = yield* proofCoordinatorLockPath("local mirror alias");
        const padded = yield* proofCoordinatorLockPath("  local mirror alias  ");
        const other = yield* proofCoordinatorLockPath("local mirror other");

        expect(raw).toBe(padded);
        expect(raw).not.toBe(other);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
