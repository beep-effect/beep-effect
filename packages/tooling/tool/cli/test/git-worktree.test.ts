import { isRegisteredWorktree, removeGitWorktree, runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";

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

const failingSpawner = ChildProcessSpawner.make(() =>
  Effect.fail(
    PlatformError.badArgument({ description: "simulated spawn failure", method: "spawn", module: "ChildProcess" })
  )
);

describe("GitWorktree", () => {
  it.effect("recognizes a registered linked worktree, including through a symlinked path", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const linked = path.join(root, "linked with space");
        const alias = path.join(root, "alias");
        yield* runGit(repoRoot, ["worktree", "add", "--quiet", "--detach", linked]);
        yield* fs.symlink(linked, alias);

        assertSome(yield* isRegisteredWorktree(repoRoot, linked), true);
        assertSome(yield* isRegisteredWorktree(repoRoot, alias), true);
        assertSome(yield* isRegisteredWorktree(repoRoot, repoRoot), true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports an unregistered or missing directory as not registered", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const plain = path.join(root, "plain");
        yield* fs.makeDirectory(plain);

        assertSome(yield* isRegisteredWorktree(repoRoot, plain), false);
        assertSome(yield* isRegisteredWorktree(repoRoot, path.join(root, "missing")), false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("returns None when the worktree listing fails or cannot run", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const notARepository = path.join(root, "not-a-repository");
        yield* fs.makeDirectory(notARepository);

        assertNone(yield* isRegisteredWorktree(notARepository, notARepository));
        assertNone(
          yield* isRegisteredWorktree(repoRoot, repoRoot).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, failingSpawner)
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("removes a registered worktree and prunes its registration", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const linked = path.join(root, "linked");
        yield* runGit(repoRoot, ["worktree", "add", "--quiet", "--detach", linked]);
        yield* fs.writeFileString(path.join(linked, "scratch.txt"), "local change\n");

        expect(yield* removeGitWorktree(repoRoot, linked)).toBe(true);
        expect(yield* fs.exists(linked)).toBe(false);
        assertSome(yield* isRegisteredWorktree(repoRoot, linked), false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports failure for an unregistered path or an unrunnable git", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const plain = path.join(root, "plain");
        yield* fs.makeDirectory(plain);

        expect(yield* removeGitWorktree(repoRoot, plain)).toBe(false);
        expect(yield* fs.exists(plain)).toBe(true);
        expect(
          yield* removeGitWorktree(repoRoot, plain).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, failingSpawner)
          )
        ).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
