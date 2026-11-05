import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { isRegisteredWorktree, removeGitWorktree, runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const runGit = Effect.fn("GitWorktreeTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  expect(result.exitCode, result.output).toBe(0);
});

// A scratch repository with one commit, so linked worktrees can be added from it.
const withRepository = <A, E, R>(use: (root: string, repoRoot: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "git-worktree-test-" });
    }),
    Effect.fnUntraced(function* (root) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = path.join(root, "repo");
      yield* fs.makeDirectory(repoRoot);
      yield* runGit(repoRoot, ["init", "--quiet", "-b", "main"]);
      yield* runGit(repoRoot, ["config", "user.email", "git-worktree@example.invalid"]);
      yield* runGit(repoRoot, ["config", "user.name", "Git Worktree Test"]);
      yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
      yield* fs.writeFileString(path.join(repoRoot, "README.md"), "fixture\n");
      yield* runGit(repoRoot, ["add", "README.md"]);
      yield* runGit(repoRoot, ["commit", "--quiet", "-m", "fixture"]);
      return yield* use(root, repoRoot);
    }),
    (root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(root, { force: true, recursive: true });
      })
  );

const failingSpawner = ScriptedSpawner.make(() =>
  PlatformError.badArgument({ description: "simulated spawn failure", method: "spawn", module: "ChildProcess" })
);

// `Git` rides beside the platform services: the worktree probes take it from the context (W1b).
it.layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), {
  timeout: "30 seconds",
})("GitWorktree", (it) => {
  it.effect("recognizes a registered linked worktree, including through a symlinked path", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const linked = path.join(root, "linked with space");
        const alias = path.join(root, "alias");
        yield* runGit(repoRoot, ["worktree", "add", "--quiet", "--detach", linked]);
        yield* fs.symlink(linked, alias);

        const isRegisteredWorktree1 = yield* isRegisteredWorktree(repoRoot, linked);
        assertSome(isRegisteredWorktree1, true);
        const isRegisteredWorktree2 = yield* isRegisteredWorktree(repoRoot, alias);
        assertSome(isRegisteredWorktree2, true);
        const isRegisteredWorktree3 = yield* isRegisteredWorktree(repoRoot, repoRoot);
        assertSome(isRegisteredWorktree3, true);
      })
    )
  );

  it.effect("reports an unregistered or missing directory as not registered", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const plain = path.join(root, "plain");
        yield* fs.makeDirectory(plain);

        const isRegisteredWorktree4 = yield* isRegisteredWorktree(repoRoot, plain);
        assertSome(isRegisteredWorktree4, false);
        const isRegisteredWorktree5 = yield* isRegisteredWorktree(repoRoot, path.join(root, "missing"));
        assertSome(isRegisteredWorktree5, false);
      })
    )
  );

  it.effect("returns None when the worktree listing fails or cannot run", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const notARepository = path.join(root, "not-a-repository");
        yield* fs.makeDirectory(notARepository);

        const isRegisteredWorktree6 = yield* isRegisteredWorktree(notARepository, notARepository);
        assertNone(isRegisteredWorktree6);
        const pipe7 = yield* isRegisteredWorktree(repoRoot, repoRoot).pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(failingSpawner)
        );
        assertNone(
          // `Git` is rebuilt over the failing spawner: the probe takes the service from the context (W1b).
          pipe7
        );
      })
    )
  );

  it.effect("removes a registered worktree and prunes its registration", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const linked = path.join(root, "linked");
        yield* runGit(repoRoot, ["worktree", "add", "--quiet", "--detach", linked]);
        yield* fs.writeFileString(path.join(linked, "scratch.txt"), "local change\n");

        const removeGitWorktree8 = yield* removeGitWorktree(repoRoot, linked);
        expect(removeGitWorktree8).toBe(true);
        const exists9 = yield* fs.exists(linked);
        expect(exists9).toBe(false);
        const isRegisteredWorktree10 = yield* isRegisteredWorktree(repoRoot, linked);
        assertSome(isRegisteredWorktree10, false);
      })
    )
  );

  it.effect("reports failure for an unregistered path or an unrunnable git", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const plain = path.join(root, "plain");
        yield* fs.makeDirectory(plain);

        const removeGitWorktree11 = yield* removeGitWorktree(repoRoot, plain);
        expect(removeGitWorktree11).toBe(false);
        const exists12 = yield* fs.exists(plain);
        expect(exists12).toBe(true);
        const pipe13 = yield* removeGitWorktree(repoRoot, plain).pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(failingSpawner)
        );
        expect(pipe13).toBe(false);
      })
    )
  );
});
