// Proves the W7 kit members and extensions (repo-cli-gh-git-consolidation
// SPEC D-17) against a REAL git binary and a real filesystem, through
// @effect/platform-node's NodeServices.layer. ../GitW7Kit.test.ts pins the
// argv and classification arms over a scripted spawner; this file is where the
// semantics those arms assume meet real git.
//
// One fixture: a repository with two divergent branches (one conflicting with
// main, one cleanly mergeable), a configured upstream, a tracked file an
// ignore rule matches, and a clone of it to fetch into. Each lives in a scoped
// temporary directory removed with the layer.

import { Git, GitCommandError, MergeTreeResult, UnknownRefError } from "@beep/git/Git";
import { runCollected } from "@beep/git/internal/run";
import { $GitId } from "@beep/identity/packages";
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GitId.create("GitW7Kit.int.test");

class FixtureSetupError extends S.TaggedError<FixtureSetupError, { readonly brand: unique symbol }>(
  $I`FixtureSetupError`
)(
  "FixtureSetupError",
  { message: S.String.annotate({ description: "The failing Git invocation, exit code and stderr." }) },
  $I.annote("FixtureSetupError", { description: "A real Git fixture command exited unsuccessfully." })
) {}

/** Pins fixture configuration at the real spawner boundary without changing the host environment. */
const FixtureServices = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.gen(function* () {
    const real = yield* ChildProcessSpawner.ChildProcessSpawner;
    return ChildProcessSpawner.make((command) =>
      real.spawn(
        ChildProcess.setEnv(command, {
          GIT_ALLOW_PROTOCOL: "file",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_SYSTEM: "/dev/null",
          GIT_AUTHOR_NAME: "Git Integration",
          GIT_AUTHOR_EMAIL: "git-integration@example.com",
          GIT_COMMITTER_NAME: "Git Integration",
          GIT_COMMITTER_EMAIL: "git-integration@example.com",
        })
      )
    );
  })
).pipe(Layer.provideMerge(NodeServices.layer));

const TestLayer = Git.layer.pipe(Layer.provideMerge(FixtureServices));

const FIXTURE_ENV = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } as const;

/** One raw fixture `git` call; dies loudly when git cannot spawn or exits non-zero. */
const runFixtureGit = (
  cwd: string,
  args: ReadonlyArray<string>
): Effect.Effect<string, never, ChildProcessSpawner.ChildProcessSpawner> =>
  runCollected(ChildProcess.setCwd(ChildProcess.make("git", args, { env: FIXTURE_ENV, extendEnv: true }), cwd)).pipe(
    Effect.orDie,
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout)
        : Effect.die(
            FixtureSetupError.make({
              message: `fixture setup failed: git ${A.join(args, " ")} in ${cwd} (exit ${result.exitCode}): ${result.stderr}`,
            })
          )
    )
  );

it.layer(TestLayer, { timeout: "60 seconds" })("Git W7 kit — real repository", (it) => {
  let dir = "";
  let clone = "";
  let root = "";
  let mainSha = "";
  let baseSha = "";

  /**
   * base: a.txt, .gitignore (`*.log`), tracked keep.log (force-added).
   * main: a.txt changed, plus b.txt. conflict: a.txt changed differently.
   * clean: c.txt only. `main` tracks `refs/remotes/origin/main`.
   */
  const FixtureLayer = Layer.effectDiscard(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-git-w7-" });
      dir = path.join(root, "repo");
      clone = path.join(root, "clone");
      yield* fs.makeDirectory(dir);
      const raw = (args: ReadonlyArray<string>) => runFixtureGit(dir, args);
      yield* raw(["-c", "init.defaultBranch=main", "init"]);
      yield* raw(["config", "commit.gpgsign", "false"]);
      yield* fs.writeFileString(path.join(dir, "a.txt"), "base\n");
      yield* fs.writeFileString(path.join(dir, ".gitignore"), "*.log\n");
      yield* fs.writeFileString(path.join(dir, "keep.log"), "tracked\n");
      yield* raw(["add", "a.txt", ".gitignore"]);
      yield* raw(["add", "--force", "keep.log"]);
      yield* raw(["commit", "-m", "base", "-m", "the base body"]);
      const gitResult1 = yield* raw(["rev-parse", "HEAD"]);
      baseSha = Str.trim(gitResult1);
      yield* raw(["branch", "conflict"]);
      yield* raw(["branch", "clean"]);
      yield* fs.writeFileString(path.join(dir, "a.txt"), "main\n");
      yield* fs.writeFileString(path.join(dir, "b.txt"), "b\n");
      yield* raw(["add", "a.txt", "b.txt"]);
      yield* raw(["commit", "-m", "main change"]);
      const gitResult2 = yield* raw(["rev-parse", "HEAD"]);
      mainSha = Str.trim(gitResult2);
      yield* raw(["checkout", "-q", "conflict"]);
      yield* fs.writeFileString(path.join(dir, "a.txt"), "conflict\n");
      yield* raw(["commit", "-am", "conflicting change"]);
      yield* raw(["checkout", "-q", "clean"]);
      yield* fs.writeFileString(path.join(dir, "c.txt"), "c\n");
      yield* raw(["add", "c.txt"]);
      yield* raw(["commit", "-m", "clean change"]);
      yield* raw(["checkout", "-q", "main"]);
      // %(upstream) maps branch.<b>.merge through the remote's fetch refspec, so the remote must exist.
      yield* raw(["remote", "add", "origin", dir]);
      yield* raw(["update-ref", "refs/remotes/origin/main", mainSha]);
      yield* raw(["config", "branch.main.remote", "origin"]);
      yield* raw(["config", "branch.main.merge", "refs/heads/main"]);
      yield* raw(["branch", "feat/x"]);
      yield* runFixtureGit(root, ["clone", "-q", "--no-local", dir, clone]);
    })
  );

  it.layer(FixtureLayer, { timeout: "60 seconds" })((it) => {
    it.effect("revListCount counts a range and types an unknown one", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const gitResult3 = yield* git.revListCount(dir, `${baseSha}..main`);
        assert.strictEqual(gitResult3, 1);
        const gitResult4 = yield* git.revListCount(dir, "main", { firstParent: true });
        assert.strictEqual(gitResult4, 2);
        const error = yield* Effect.flip(git.revListCount(dir, "nope..main"));
        assert.isTrue(S.is(UnknownRefError)(error));
      })
    );

    it.effect("mergeTree answers clean, conflicted and unresolved without touching the checkout", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const clean = yield* git.mergeTree(dir, "main", "clean");
        assert.strictEqual(clean._tag, "clean");
        const conflicted = yield* git.mergeTree(dir, "main", "conflict");
        assert.isTrue(MergeTreeResult.guards.conflicted(conflicted));
        if (MergeTreeResult.guards.conflicted(conflicted)) {
          assert.deepStrictEqual(conflicted.paths, ["a.txt"]);
          assert.isTrue(A.some(conflicted.messages, (message) => Str.startsWith("CONFLICT (content)")(message)));
        }
        const error = yield* Effect.flip(git.mergeTree(dir, "main", "nope"));
        assert.isTrue(S.is(UnknownRefError)(error));
        const gitResult5 = yield* runFixtureGit(dir, ["rev-parse", "HEAD"]);
        assert.strictEqual(Str.trim(gitResult5), mainSha);
      })
    );

    it.effect("upstream reads the exact branch, never a prefix match", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const gitResult6 = yield* git.upstream(dir, "main");
        assertSome(gitResult6, "refs/remotes/origin/main");
        const gitResult7 = yield* git.upstream(dir, "conflict");
        assertNone(gitResult7);
        const gitResult8 = yield* git.upstream(dir, "feat");
        assertNone(gitResult8);
        const gitResult9 = yield* git.upstream(dir, "missing");
        assertNone(gitResult9);
      })
    );

    it.effect("updateRef creates, refuses a second create and a bad name, and deletes only on a match", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        yield* git.updateRef(dir, "refs/archive/lane", { create: mainSha });
        const gitResult10 = yield* git.refExists(dir, "refs/archive/lane");
        assert.isTrue(gitResult10);
        const again = yield* Effect.flip(git.updateRef(dir, "refs/archive/lane", { create: baseSha }));
        assert.strictEqual(S.is(GitCommandError)(again) ? again.kind : "", "failed");
        const wrong = yield* Effect.flip(git.updateRef(dir, "refs/archive/lane", { delete: baseSha }));
        assert.strictEqual(S.is(GitCommandError)(wrong) ? wrong.kind : "", "failed");
        const gitResult11 = yield* git.refExists(dir, "refs/archive/lane");
        assert.isTrue(gitResult11);
        const invalid = yield* Effect.flip(git.updateRef(dir, "refs/archive/a b", { create: mainSha }));
        assert.strictEqual(S.is(GitCommandError)(invalid) ? invalid.kind : "", "refused");
        yield* git.updateRef(dir, "refs/archive/lane", { delete: mainSha });
        const gitResult12 = yield* git.refExists(dir, "refs/archive/lane");
        assert.isFalse(gitResult12);
      })
    );

    it.effect("gitDir answers the absolute git dir and git's own git-path", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const path = yield* Path.Path;
        const gitDir = yield* git.gitDir(dir);
        assert.isTrue(path.isAbsolute(gitDir));
        assert.strictEqual(path.basename(gitDir), ".git");
        const gitResult13 = yield* git.gitDir(dir, { path: "info/attributes" });
        assert.strictEqual(gitResult13, path.join(gitDir, "info", "attributes"));
      })
    );

    it.effect("diffPatch renders revision, worktree and no-index patches", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ranged = yield* git.diffPatch(dir, { base: baseSha, head: "main", unified: 0, pathspec: ["b.txt"] });
        assert.include(ranged, "+++ b/b.txt");
        assert.notInclude(ranged, "a.txt");
        const gitResult14 = yield* git.diffPatch(dir, { base: "HEAD" });
        assert.strictEqual(gitResult14, "");
        const outside = path.join(root, "loose.txt");
        yield* fs.writeFileString(outside, "loose\n");
        const added = yield* git.diffPatch(root, { noIndex: ["/dev/null", outside], binary: true });
        assert.include(added, "new file mode");
        const gitResult15 = yield* git.diffPatch(root, { noIndex: [outside, outside] });
        assert.strictEqual(gitResult15, "");
        const missing = yield* Effect.flip(git.diffPatch(root, { noIndex: [path.join(root, "absent"), outside] }));
        assert.strictEqual(S.is(GitCommandError)(missing) ? missing.kind : "", "failed");
      })
    );

    it.effect("log walks from revisions, reverses, omits paths and reads bodies", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const entries = yield* git.log(dir, { revisions: ["main"], reverse: true, omitPaths: true, includeBody: true });
        assert.deepStrictEqual(
          A.map(entries, (entry) => entry.subject),
          ["base", "main change"]
        );
        assert.strictEqual(entries[0]?.body, "the base body\n");
        assert.deepStrictEqual(entries[0]?.paths, []);
        const ranged = yield* git.log(dir, { revisions: [`${baseSha}..conflict`], noMerges: true });
        assert.deepStrictEqual(
          A.map(ranged, (entry) => entry.paths),
          [["a.txt"]]
        );
        const error = yield* Effect.flip(git.log(dir, { revisions: ["nope"] }));
        assert.isTrue(S.is(UnknownRefError)(error));
      })
    );

    it.effect("checkIgnore noIndex, add force, stashPush keepIndex and commit noGpgSign behave as git does", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const gitResult16 = yield* git.checkIgnore(dir, ["keep.log"]);
        assert.deepStrictEqual(gitResult16, []);
        const gitResult17 = yield* git.checkIgnore(dir, ["keep.log"], { noIndex: true });
        assert.deepStrictEqual(gitResult17, ["keep.log"]);
        yield* fs.writeFileString(path.join(dir, "new.log"), "ignored\n");
        const refused = yield* Effect.flip(git.add(dir, ["new.log"]));
        assert.isTrue(S.is(GitCommandError)(refused));
        yield* git.add(dir, ["new.log"], { force: true });
        yield* fs.writeFileString(path.join(dir, "b.txt"), "unstaged\n");
        yield* git.stashPush(dir, { keepIndex: true, message: "w7" });
        const gitResult18 = yield* git.stagedChanges(dir);
        assert.deepStrictEqual(gitResult18, ["new.log"]);
        const gitResult19 = yield* git.unstagedChanges(dir);
        assert.deepStrictEqual(gitResult19, []);
        yield* runFixtureGit(dir, ["config", "commit.gpgsign", "true"]);
        yield* git.commit(dir, "force-added log", { noGpgSign: true });
        yield* runFixtureGit(dir, ["config", "commit.gpgsign", "false"]);
        const gitResult20 = yield* git.commitInfo(dir);
        assert.strictEqual(gitResult20.signatureStatus, "N");
      })
    );

    it.effect("branchList contains, worktreeAdd newBranch and submoduleForeach quiet", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const path = yield* Path.Path;
        const containing = yield* git.branchList(dir, { contains: "conflict" });
        assert.deepStrictEqual(
          A.map(containing, (entry) => entry.name),
          ["conflict"]
        );
        const lane = path.join(root, "lane");
        yield* git.worktreeAdd(dir, lane, { ref: baseSha, newBranch: "feat/lane" });
        const gitResult21 = yield* git.currentBranch(lane);
        assertSome(gitResult21, "feat/lane");
        const gitResult22 = yield* git.submoduleForeach(dir, "pwd", { quiet: true });
        assert.strictEqual(gitResult22, "");
      })
    );

    it.effect("fetch without a ref refreshes the configured refspecs and leaves FETCH_HEAD alone on request", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* runFixtureGit(dir, ["branch", "late"]);
        yield* git.fetch(clone, { prune: true, noTags: true });
        const gitResult23 = yield* git.refExists(clone, "refs/remotes/origin/late");
        assert.isTrue(gitResult23);
        const fetchHead = path.join(clone, ".git", "FETCH_HEAD");
        yield* fs.remove(fetchHead);
        yield* git.fetch(clone, { ref: baseSha, noWriteFetchHead: true });
        const gitResult24 = yield* fs.exists(fetchHead);
        assert.isFalse(gitResult24);
      })
    );
  });
});
