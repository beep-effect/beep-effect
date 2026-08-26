import {
  emptyTurboPlanSnapshot,
  proofCoordinatorLockPath,
  proofLockPathForContext,
  RepoPlanStep,
  RepoRunContext,
  releaseProofLock,
  runProofPhaseForTesting,
  runWithFullProofCoordinatorForTesting,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
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

const withProofCoordinatorRepo = <Success, Error, Requirements>(
  use: (repo: {
    readonly context: RepoRunContext;
    readonly lockPath: string;
  }) => Effect.Effect<Success, Error, Requirements>
) =>
  withTempDirectory((tmpDir) =>
    Effect.gen(function* () {
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
      yield* releaseProofLock(lockPath);
      return yield* Effect.acquireUseRelease(Effect.succeed({ context, lockPath }), use, ({ lockPath: acquiredPath }) =>
        releaseProofLock(acquiredPath)
      );
    })
  );

const proofStep = (repoRoot: string, id: string, source: string): RepoPlanStep =>
  RepoPlanStep.make({
    id,
    label: id,
    phase: "full",
    command: "bun",
    args: ["--eval", source],
    cwd: repoRoot,
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
