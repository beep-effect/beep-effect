import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git, GitCommandError } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  assessBaseFreshnessForTesting,
  captureGitKitExit,
  collectYeetGateInputPaths,
  currentCommitSha,
  currentYeetBranch,
  lockfileChangedSinceBase,
  optionFromNonEmpty,
  patientGit,
  RepoRunContext,
  refreshBaseRef,
  resolvePullRequestTitle,
  runGitFoldedStdout,
  safeOriginBranchFromBaseForTesting,
} from "@beep/repo-cli/test/Yeet";
import { expect, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Yeet Git Fixture",
  "-c",
  "user.email=yeet-git@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

// An origin whose main holds base.txt and a work clone on `feature`, branched from origin/main.
const fixture = Effect.fn("YeetGitExecTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-git-exec-" });
  const origin = path.join(root, "origin");
  const work = path.join(root, "work");
  yield* fs.makeDirectory(origin);
  yield* fs.makeDirectory(work);
  const git = Effect.fn("YeetGitExecTest.git")(function* (cwd: string, ...args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], cwd, GIT_ENV);
    expect(result.exitCode).toBe(0);
    return Str.trim(result.output);
  });
  const commit = Effect.fn("YeetGitExecTest.commit")(function* (cwd: string, file: string) {
    yield* fs.writeFileString(path.join(cwd, file), `${file}\n`);
    yield* git(cwd, "add", "--all");
    yield* git(cwd, "commit", "--quiet", "--no-verify", "-m", file);
    return yield* git(cwd, "rev-parse", "HEAD");
  });

  yield* git(origin, "init", "--quiet", "--template=", "--initial-branch=main", ".");
  const c0 = yield* commit(origin, "base.txt");
  yield* git(work, "init", "--quiet", "--template=", "--initial-branch=main", ".");
  yield* git(work, "remote", "add", "origin", origin);
  yield* git(work, "fetch", "--quiet", "origin");
  yield* git(work, "switch", "--quiet", "-c", "feature", "origin/main");
  const context = RepoRunContext.make({
    base: "origin/main",
    branch: "feature",
    cwd: work,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: work,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
  return { root, origin, work, c0, context, git, commit };
});

const failingSpawner = ScriptedSpawner.make(() =>
  PlatformError.badArgument({ description: "spawn disabled", method: "spawn", module: "ChildProcess" })
);

const WORKTREE_FAILED = "Failed to run git worktree add.";

it("optionFromNonEmpty trims to Some and drops blank text", () => {
  assertSome(optionFromNonEmpty(" main "), "main");
  assertNone(optionFromNonEmpty("   "));
});

it("safeOriginBranchFromBaseForTesting keeps plain origin branches only", () => {
  assertSome(safeOriginBranchFromBaseForTesting("origin/feature/x"), "feature/x");
  assertNone(safeOriginBranchFromBaseForTesting("origin/../main"));
  assertNone(safeOriginBranchFromBaseForTesting("main"));
});

it.effect("captureGitKitExit preserves fractional finite exit codes admitted by the typed producer contract", () =>
  Effect.gen(function* () {
    // Synthetic typed-producer contract fixture; OS process exit statuses are integers.
    const invocation = GitCommand.worktreeAdd("/repo/preview", "HEAD", true);
    const error = GitCommandError.make({
      kind: "failed",
      args: invocation.redactedArgs,
      cwd: "/repo",
      exitCode: 1.5,
      stderr: "synthetic finite exit",
    });
    const exit = yield* Effect.fail(error).pipe(captureGitKitExit(invocation, WORKTREE_FAILED));
    expect(exit).toEqual({ exitCode: 1.5, output: "synthetic finite exit" });
  })
);

it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("yeet git exec over a real checkout", (it) => {
  it.effect("refreshBaseRef fetches origin/main to the origin tip", () =>
    Effect.gen(function* () {
      const { origin, work, git, commit } = yield* fixture();
      const c1 = yield* commit(origin, "next.txt");
      yield* refreshBaseRef(work, "origin/main");
      expect(yield* git(work, "rev-parse", "refs/remotes/origin/main")).toBe(c1);
    })
  );

  it.effect("refreshBaseRef refuses an unsafe origin base", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const error = yield* Effect.flip(refreshBaseRef(work, "origin/../main"));
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe(
        'yeet refuses an unsafe base ref "origin/../main". Use a plain branch under origin/ such as origin/main.'
      );
    })
  );

  it.effect("refreshBaseRef refuses an option-like origin base", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const error = yield* Effect.flip(refreshBaseRef(work, "origin/--upload-pack=x"));
      assertInclude(error.message, 'yeet refuses an unsafe base ref "origin/--upload-pack=x".');
    })
  );

  it.effect("refreshBaseRef refuses an option-like non-origin base before spawning", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const error = yield* Effect.flip(refreshBaseRef(work, "--upload-pack=x"));
      expect(error).toBeInstanceOf(YeetCommandError);
      assertInclude(error.message, "Failed to run git rev-parse");
    })
  );

  it.effect("refreshBaseRef verifies a non-origin base with rev-parse", () =>
    Effect.gen(function* () {
      const { work, c0 } = yield* fixture();
      yield* refreshBaseRef(work, c0);
      yield* refreshBaseRef(work, "feature");
    })
  );

  it.effect("refreshBaseRef fails on an unknown non-origin base", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const error = yield* Effect.flip(refreshBaseRef(work, "no-such-branch"));
      expect(error).toBeInstanceOf(YeetCommandError);
      assertInclude(error.message, "failed with exit code 128.");
    })
  );

  it.effect("currentYeetBranch and currentCommitSha read the checkout", () =>
    Effect.gen(function* () {
      const { c0, context } = yield* fixture();
      expect(yield* currentYeetBranch(context.repoRoot)).toBe("feature");
      expect(yield* currentCommitSha(context)).toBe(c0);
    })
  );

  it.effect("currentCommitSha fails with exit 128 in an unborn repository", () =>
    Effect.gen(function* () {
      const { origin, context, git } = yield* fixture();
      const path = yield* Path.Path;
      const unborn = path.join(origin, "..", "unborn");
      yield* FileSystem.FileSystem.use((fs) => fs.makeDirectory(unborn));
      yield* git(unborn, "init", "--quiet", "--template=", ".");
      const error = yield* Effect.flip(currentCommitSha(RepoRunContext.make({ ...context, repoRoot: unborn })));
      assertInclude(error.message, "failed with exit code 128.");
    })
  );

  it.effect("runGitFoldedStdout folds stdout as it streams", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const size = yield* runGitFoldedStdout(work, ["show", "HEAD:base.txt"], (stdout) =>
        stdout.pipe(
          Stream.runFold(
            () => 0,
            (total: number, chunk: Uint8Array) => total + chunk.length
          ),
          Effect.map(String)
        )
      );
      expect(size).toBe("9");
    })
  );

  it.effect("runGitFoldedStdout reports a failing git with its exit code", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const error = yield* Effect.flip(
        runGitFoldedStdout(work, ["show", "HEAD:absent.txt"], (stdout) => stdout.pipe(Stream.runDrain, Effect.as("")))
      );
      assertInclude(error.message, "git show HEAD:absent.txt failed with exit code 128.");
    })
  );

  it.effect("collectYeetGateInputPaths reads committed, staged, unstaged and untracked paths", () =>
    Effect.gen(function* () {
      const { work, context, git, commit } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* commit(work, "committed.txt");
      yield* fs.writeFileString(path.join(work, "staged.txt"), "staged\n");
      yield* git(work, "add", "staged.txt");
      yield* fs.writeFileString(path.join(work, "base.txt"), "edited\n");
      yield* fs.writeFileString(path.join(work, "untracked.txt"), "untracked\n");
      expect(yield* collectYeetGateInputPaths(context)).toEqual([
        "base.txt",
        "committed.txt",
        "staged.txt",
        "untracked.txt",
      ]);
    })
  );

  it.effect("assessBaseFreshnessForTesting counts commits behind a refreshed base", () =>
    Effect.gen(function* () {
      const { origin, work, c0, context, commit } = yield* fixture();
      yield* commit(origin, "next.txt");
      yield* refreshBaseRef(work, "origin/main");
      const freshness = yield* assessBaseFreshnessForTesting(context);
      expect(freshness.behindCount).toBe(1);
      expect(freshness.mergeBase).toBe(c0);
    })
  );

  it.effect("assessBaseFreshnessForTesting fails when no merge-base exists", () =>
    Effect.gen(function* () {
      const { context } = yield* fixture();
      const error = yield* Effect.flip(
        assessBaseFreshnessForTesting(RepoRunContext.make({ ...context, base: "nope" }))
      );
      assertInclude(error.message, "yeet publish could not compute a merge-base between nope and HEAD.");
    })
  );

  it.effect("runGitOutput fails when git prints past the capture limit", () =>
    Effect.gen(function* () {
      const { root, work, context, git } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const messageFile = path.join(root, "long-subject.txt");
      yield* fs.writeFileString(messageFile, `feat: ${Str.repeat(600 * 1024)("x")}\n`);
      yield* git(work, "commit", "--quiet", "--no-verify", "--allow-empty", "-F", messageFile);
      const error = yield* Effect.flip(resolvePullRequestTitle(context, O.none(), "origin/main..HEAD"));
      assertInclude(error.message, "output exceeded the repo-run capture limit.");
    })
  );

  it.effect("lockfileChangedSinceBase is true when bun.lock changed", () =>
    Effect.gen(function* () {
      const { work, context, commit } = yield* fixture();
      yield* commit(work, "bun.lock");
      expect(yield* lockfileChangedSinceBase(context)).toBe(true);
    })
  );

  it.effect("lockfileChangedSinceBase is false when only other files changed", () =>
    Effect.gen(function* () {
      const { work, context, commit } = yield* fixture();
      yield* commit(work, "other.txt");
      expect(yield* lockfileChangedSinceBase(context)).toBe(false);
    })
  );

  it.effect("lockfileChangedSinceBase is false when the diff cannot run", () =>
    Effect.gen(function* () {
      const { context } = yield* fixture();
      expect(yield* lockfileChangedSinceBase(RepoRunContext.make({ ...context, base: "nope" }))).toBe(false);
    })
  );

  it.effect("patientGit runs a kit call on the scratch repository", () =>
    Effect.gen(function* () {
      const { work, c0 } = yield* fixture();
      const git = yield* patientGit;
      expect(yield* git.revParse(work, "HEAD")).toBe(c0);
    })
  );

  it.effect("captureGitKitExit reads a successful worktreeAdd as exit 0", () =>
    Effect.gen(function* () {
      const { root, work } = yield* fixture();
      const path = yield* Path.Path;
      const target = path.join(root, "preview");
      const git = yield* Git;
      const exit = yield* captureGitKitExit(
        git.worktreeAdd(work, target, { ref: "HEAD", detach: true }),
        GitCommand.worktreeAdd(target, "HEAD", true),
        WORKTREE_FAILED
      );
      expect(exit).toEqual({ exitCode: 0, output: "" });
    })
  );

  it.effect("captureGitKitExit reads a refused worktreeAdd as git's exit code and stderr", () =>
    Effect.gen(function* () {
      const { origin, work } = yield* fixture();
      const git = yield* Git;
      const exit = yield* git
        .worktreeAdd(work, origin, { ref: "HEAD", detach: true })
        .pipe(captureGitKitExit(GitCommand.worktreeAdd(origin, "HEAD", true), WORKTREE_FAILED));
      expect(exit.exitCode).not.toBe(0);
      assertInclude(exit.output, "already exists");
    })
  );

  it.effect("captureGitKitExit turns a spawn failure into the failedToRun error", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Git.use((git) => git.worktreeAdd("/repo", "/repo/preview", { ref: "HEAD", detach: true })).pipe(
          captureGitKitExit(GitCommand.worktreeAdd("/repo/preview", "HEAD", true), WORKTREE_FAILED),
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(failingSpawner)
        )
      );
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe(WORKTREE_FAILED);
    })
  );
});
