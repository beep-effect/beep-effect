import { AiMetricsGitRootEvidence, observeAiMetricsGitRoot } from "@beep/repo-ai-metrics/git-root-evidence";
import {
  AiMetricsCanonicalRoot,
  AiMetricsCanonicalRootInput,
  makeAiMetricsCanonicalRoot,
} from "@beep/repo-ai-metrics/identity-registry";
import { it } from "@beep/test-runner";
import { NodeFileSystem, NodePath, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

const temporaryDirectory = FileSystem.FileSystem.use((fs) =>
  Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie)
  )
);
const input = (rootPath: string) =>
  AiMetricsCanonicalRootInput.make({ rootPath, hashSalt: "synthetic-root-identity-salt" });
const git = Effect.fn("GitRootEvidenceTest.git")(function* (root: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
      env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    })
  );
  expect(exitCode).toBe(0);
});
const init = Effect.fn("GitRootEvidenceTest.init")(function* (root: string, separate?: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(root, { recursive: true });
  yield* git(
    root,
    separate === undefined ? ["init", "-q", "."] : ["init", "-q", `--separate-git-dir=${separate}`, "."]
  );
  yield* git(root, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--allow-empty",
    "-qm",
    "synthetic fixture",
  ]);
});
const observed = (value: AiMetricsGitRootEvidence) => {
  if (!AiMetricsGitRootEvidence.isAnyOf(["Observed"])(value))
    throw new Error(`Expected observed identity, received ${value._tag}`);
  return value;
};
const encodeAiMetricsGitRootEvidenceJson = S.encodeEffect(S.fromJsonString(AiMetricsGitRootEvidence));

it.layer(NodeServices.layer, { timeout: "30 seconds", concurrent: false })("Git root identity evidence", (it) => {
  it.effect("joins linked worktrees to their owning clone while preserving legacy IDs", () =>
    Effect.gen(function* () {
      const directory = yield* temporaryDirectory;
      const clone = `${directory}/clone`;
      const worktree = `${directory}/linked`;
      yield* init(clone);
      yield* git(clone, ["remote", "add", "origin", "git@example.invalid:project.git"]);
      yield* git(clone, ["worktree", "add", "-q", "--detach", worktree]);
      const primary = yield* makeAiMetricsCanonicalRoot(input(clone));
      const linked = yield* makeAiMetricsCanonicalRoot(input(worktree));
      const first = observed(primary.gitEvidence);
      const second = observed(linked.gitEvidence);
      expect(first.owningCloneIdHash).toBe(second.owningCloneIdHash);
      expect(first.repositoryIdHash).toBe(second.repositoryIdHash);
      expect(first.worktreeIdHash).not.toBe(second.worktreeIdHash);
      expect(first.linkedWorktree).toBe(false);
      expect(second.linkedWorktree).toBe(true);
      expect(primary.cloneIdHash).not.toBe(linked.cloneIdHash);
      expect(primary.rootId).toBe(`root-${primary.cloneIdHash}`);
      expect(linked.rootId).toBe(`root-${linked.cloneIdHash}`);
      expect((yield* makeAiMetricsCanonicalRoot(input(worktree))).worktreeIdHash).toBe(linked.worktreeIdHash);
    })
  );
  it.effect("separates independent clones and strips credentials from shared remote identity", () =>
    Effect.gen(function* () {
      const directory = yield* temporaryDirectory;
      const first = `${directory}/first`;
      const second = `${directory}/second`;
      yield* init(first);
      yield* init(second);
      yield* git(first, ["remote", "add", "origin", "git@example.invalid:project.git"]);
      yield* git(second, [
        "remote",
        "add",
        "origin",
        "https://synthetic-user:synthetic-secret@EXAMPLE.invalid/project.git?token=synthetic-token#private",
      ]);
      const a = observed(yield* observeAiMetricsGitRoot(input(first)));
      const b = observed(yield* observeAiMetricsGitRoot(input(second)));
      expect(a.repositoryIdHash).toBe(b.repositoryIdHash);
      expect(a.owningCloneIdHash).not.toBe(b.owningCloneIdHash);
      expect(a.worktreeIdHash).not.toBe(b.worktreeIdHash);
      const encoded = yield* encodeAiMetricsGitRootEvidenceJson(b);
      expect(encoded).not.toContain(directory);
      expect(encoded).not.toContain("synthetic-secret");
      expect(encoded).not.toContain("synthetic-token");
      expect(encoded).not.toContain("example.invalid");
    })
  );
  it.effect("recognizes separate Git directories and physical aliases without inventing parent roots", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const root = `${directory}/checkout`;
      yield* init(root, `${directory}/metadata`);
      yield* fs.symlink(root, `${directory}/alias`);
      yield* fs.makeDirectory(`${root}/nested`);
      const actual = observed(yield* observeAiMetricsGitRoot(input(root)));
      const alias = observed(yield* observeAiMetricsGitRoot(input(`${directory}/alias`)));
      expect(actual.linkedWorktree).toBe(false);
      expect(actual.repositoryIdentityScope).toBe("local-clone");
      expect(actual.owningCloneIdHash).toBe(alias.owningCloneIdHash);
      expect(actual.worktreeIdHash).toBe(alias.worktreeIdHash);
      expect(yield* observeAiMetricsGitRoot(input(`${root}/nested`))).toEqual({
        _tag: "Unknown",
        reason: "not-a-checkout-root",
      });
    })
  );
  it.effect("keeps unsupported roots and missing salt explicit", () =>
    Effect.gen(function* () {
      const directory = yield* temporaryDirectory;
      expect(yield* observeAiMetricsGitRoot(input(directory))).toEqual({ _tag: "Unknown", reason: "probe-failed" });
      expect(yield* observeAiMetricsGitRoot(AiMetricsCanonicalRootInput.make({ rootPath: directory }))).toEqual({
        _tag: "Unknown",
        reason: "missing-hash-salt",
      });
    })
  );
});

it.layer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer), { timeout: "30 seconds" })((it) =>
  it.effect("does not require a process service just to read legacy identities", () =>
    Effect.gen(function* () {
      const legacy = {
        cloneIdHash: "legacy-clone",
        rootId: "legacy-root",
        repositoryIdHash: "legacy-repository",
        worktreeIdHash: "legacy-worktree",
        excludedFromParentSnapshot: false,
        firstSeenAtEpochMillis: 1,
        lastSeenAtEpochMillis: 2,
        kind: "primary-clone",
      };
      const decoded = yield* S.decodeUnknownEffect(AiMetricsCanonicalRoot)(legacy);
      expect(decoded.gitEvidence).toEqual({ _tag: "Unknown", reason: "not-observed" });
      expect(decoded.cloneIdHash).toBe(legacy.cloneIdHash);
      expect(decoded.worktreeIdHash).toBe(legacy.worktreeIdHash);
      expect(yield* observeAiMetricsGitRoot(input("/unused-synthetic-root"))).toEqual({
        _tag: "Unknown",
        reason: "git-unavailable",
      });
    })
  )
);

const probeSpawner = (stdout: Stream.Stream<Uint8Array>, released: Ref.Ref<number>, started: Deferred.Deferred<void>) =>
  ChildProcessSpawner.make(() =>
    Effect.acquireRelease(
      Effect.succeed(
        ChildProcessSpawner.makeHandle({
          all: stdout,
          stdout,
          stderr: Stream.empty,
          stdin: Sink.drain,
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          isRunning: Effect.succeed(true),
          kill: () => Effect.void,
          pid: ChildProcessSpawner.ProcessId(1),
          unref: Effect.succeed(Effect.void),
        })
      ).pipe(Effect.tap(() => Deferred.succeed(started, undefined))),
      () => Ref.update(released, (count) => count + 1)
    )
  );

it.layer(Layer.mergeAll(NodeServices.layer, TestClock.layer()), { timeout: "30 seconds" })(
  "bounded Git probes",
  (it) => {
    it.effect("refuses oversized Git output and releases the process scope", () =>
      Effect.gen(function* () {
        const root = yield* temporaryDirectory;
        const released = yield* Ref.make(0);
        const started = yield* Deferred.make<void>();
        const result = yield* observeAiMetricsGitRoot(input(root)).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            probeSpawner(Stream.make(new Uint8Array(16385)), released, started)
          )
        );
        expect(result).toEqual({ _tag: "Unknown", reason: "probe-failed" });
        expect(yield* Ref.get(released)).toBe(1);
      })
    );
  }
);

it.layer(Layer.mergeAll(NodeServices.layer, TestClock.layer()), { timeout: "30 seconds" })(
  "isolated Git probe timeout",
  (it) => {
    it.effect("expires an unresponsive Git probe and releases its scope", () =>
      Effect.gen(function* () {
        const root = yield* temporaryDirectory;
        const released = yield* Ref.make(0);
        const started = yield* Deferred.make<void>();
        const fiber = yield* observeAiMetricsGitRoot(input(root)).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, probeSpawner(Stream.never, released, started)),
          Effect.forkChild
        );
        yield* Deferred.await(started);
        yield* TestClock.adjust("5 seconds");
        expect(yield* Fiber.join(fiber)).toEqual({ _tag: "Unknown", reason: "timed-out" });
        expect(yield* Ref.get(released)).toBe(1);
      })
    );
  }
);
