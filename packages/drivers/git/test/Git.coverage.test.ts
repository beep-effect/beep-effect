import * as GitModule from "@beep/git/Git";
import { Git } from "@beep/git/Git";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { scripted } from "./fixtures.ts";
import type { ScriptResult } from "./fixtures.ts";

const cwd = "/repo";
const run = <A, E>(program: Effect.Effect<A, E, Git>, outcome: ScriptResult) =>
  Effect.scopedWith((scope) =>
    Effect.flatMap(
      Layer.buildWithScope(
        Git.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              scripted((args) =>
                args[0] === "config" &&
                args[1] === "--get" &&
                (args[2] === "core.sshCommand" || args[2] === "ssh.variant")
                  ? { exit: 1 }
                  : outcome
              ),
              ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))
            )
          )
        ),
        scope
      ),
      (context) => Effect.provideContext(program, context)
    )
  );

type GitError =
  | GitModule.GitCommandError
  | GitModule.NotARepositoryError
  | GitModule.UnknownRefError
  | GitModule.NonFastForwardError
  | GitModule.MergeConflictError
  | GitModule.DirtyWorktreeError;

const operations: ReadonlyArray<readonly [string, (git: GitModule.GitShape) => Effect.Effect<unknown, GitError>]> = [
  ["show", (git) => git.show(cwd, "HEAD", "file")],
  ["lsTree", (git) => git.lsTree(cwd, "HEAD")],
  ["refExists", (git) => git.refExists(cwd, "HEAD")],
  ["mergeBase", (git) => git.mergeBase(cwd, "a", "b")],
  ["mergeBaseOption", (git) => git.mergeBaseOption(cwd, "a", "b")],
  ["isAncestor", (git) => git.isAncestor(cwd, "a", "b")],
  ["changedFiles", (git) => git.changedFiles(cwd, { base: "a", head: "b" })],
  ["workingChanges", (git) => git.workingChanges(cwd)],
  ["unstagedChanges", (git) => git.unstagedChanges(cwd)],
  ["stagedChanges", (git) => git.stagedChanges(cwd)],
  ["nameStatus", (git) => git.nameStatus(cwd, { base: "a", head: "b" })],
  ["revParse", (git) => git.revParse(cwd, "HEAD")],
  ["checkout", (git) => git.checkout(cwd, "HEAD")],
  ["reset", (git) => git.reset(cwd)],
  ["clean", (git) => git.clean(cwd)],
  ["restore", (git) => git.restore(cwd, ["file"])],
  ["branchCreate", (git) => git.branchCreate(cwd, "feature")],
  ["branchDelete", (git) => git.branchDelete(cwd, "feature")],
  ["isShallow", (git) => git.isShallow(cwd)],
  ["fetchUnshallow", (git) => git.fetchUnshallow(cwd)],
  ["fetch", (git) => git.fetch(cwd, { ref: "main" })],
  ["submoduleUpdate", (git) => git.submoduleUpdate(cwd)],
  ["submoduleAdd", (git) => git.submoduleAdd(cwd, { url: "https://example.test/lib", path: "lib" })],
  ["sparseCheckoutSet", (git) => git.sparseCheckoutSet(cwd, ["src"], { cone: true })],
  ["configSet", (git) => git.configSet(cwd, "a.b", "value")],
  ["add", (git) => git.add(cwd, ["file"])],
  ["defaultBranch", (git) => git.defaultBranch(cwd)],
  ["currentBranch", (git) => git.currentBranch(cwd)],
  ["repoRoot", (git) => git.repoRoot(cwd)],
  ["configGet", (git) => git.configGet(cwd, "a.b")],
  ["remoteUrl", (git) => git.remoteUrl(cwd, { remote: "origin" })],
  ["commitInfo", (git) => git.commitInfo(cwd)],
  ["status", (git) => git.status(cwd)],
  ["submoduleStatus", (git) => git.submoduleStatus(cwd)],
  ["submoduleInit", (git) => git.submoduleInit(cwd)],
  ["submoduleDeinit", (git) => git.submoduleDeinit(cwd, { all: true })],
  ["submoduleSync", (git) => git.submoduleSync(cwd)],
  ["submoduleSetUrl", (git) => git.submoduleSetUrl(cwd, "lib", "https://example.test/lib")],
  ["submoduleSetBranch", (git) => git.submoduleSetBranch(cwd, "lib")],
  ["submoduleAbsorbgitdirs", (git) => git.submoduleAbsorbgitdirs(cwd)],
  ["submoduleForeach", (git) => git.submoduleForeach(cwd, "pwd")],
  ["lsRemote", (git) => git.lsRemote(cwd, "origin")],
  ["remoteAdd", (git) => git.remoteAdd(cwd, "origin", "https://example.test/repo")],
  ["remoteRemove", (git) => git.remoteRemove(cwd, "origin")],
  ["remoteSetUrl", (git) => git.remoteSetUrl(cwd, "origin", "https://example.test/repo")],
  ["stashPush", (git) => git.stashPush(cwd)],
  ["stashPop", (git) => git.stashPop(cwd)],
  ["stashApply", (git) => git.stashApply(cwd)],
  ["stashDrop", (git) => git.stashDrop(cwd)],
  ["stashList", (git) => git.stashList(cwd)],
  ["branchList", (git) => git.branchList(cwd)],
  ["tagCreate", (git) => git.tagCreate(cwd, "v1")],
  ["tagDelete", (git) => git.tagDelete(cwd, "v1")],
  ["tagList", (git) => git.tagList(cwd)],
  ["forEachRef", (git) => git.forEachRef(cwd)],
  ["revList", (git) => git.revList(cwd, "HEAD")],
  ["commit", (git) => git.commit(cwd, "message")],
  ["push", (git) => git.push(cwd)],
  ["pull", (git) => git.pull(cwd)],
  ["configList", (git) => git.configList(cwd)],
  ["configGetAll", (git) => git.configGetAll(cwd, "a.b")],
  ["configUnset", (git) => git.configUnset(cwd, "a.b")],
  ["configRemoveSection", (git) => git.configRemoveSection(cwd, "a")],
  ["configRenameSection", (git) => git.configRenameSection(cwd, "a", "b")],
  ["rm", (git) => git.rm(cwd, ["file"])],
  ["mv", (git) => git.mv(cwd, "a", "b")],
  ["checkIgnore", (git) => git.checkIgnore(cwd, ["file"])],
  ["worktreeAdd", (git) => git.worktreeAdd(cwd, "/other")],
  ["worktreeList", (git) => git.worktreeList(cwd)],
  ["worktreeRemove", (git) => git.worktreeRemove(cwd, "/other")],
  ["worktreePrune", (git) => git.worktreePrune(cwd)],
  ["lsFiles", (git) => git.lsFiles(cwd)],
];

describe("Git service error contracts", () => {
  for (const [name, invoke] of operations) {
    it.effect(`${name}: classifies repository and command failures`, () =>
      Effect.gen(function* () {
        for (const [stderr, schema] of [
          ["fatal: not a git repository", GitModule.NotARepositoryError],
          ["fatal: unrelated failure", GitModule.GitCommandError],
        ] as const) {
          const result = yield* run(Effect.flatMap(Git, invoke), { stderr, exit: 128 }).pipe(Effect.result);
          assert.strictEqual(Result.isFailure(result), true);
          if (Result.isFailure(result)) {
            assert.strictEqual(S.is(schema)(result.failure), true);
          }
        }
      })
    );
    it.effect(`${name}: maps unknown revisions`, () =>
      Effect.gen(function* () {
        const result = yield* run(Effect.flatMap(Git, invoke), { stderr: "fatal: unknown revision", exit: 128 }).pipe(
          Effect.result
        );
        if (name === "refExists") {
          assertSuccess(result, false);
        } else {
          assert.strictEqual(Result.isFailure(result), true);
          if (Result.isFailure(result)) {
            assert.strictEqual(S.is(GitModule.UnknownRefError)(result.failure), true);
          }
        }
      })
    );
  }

  it.effect("renders all public diagnostic messages and optional details", () =>
    Effect.sync(() => {
      assert.strictEqual(GitModule.NotARepositoryError.make({ cwd }).message, "not a git repository: /repo");
      assert.strictEqual(GitModule.UnknownRefError.make({ cwd, ref: "HEAD" }).message, "unknown ref 'HEAD' in /repo");
      assert.strictEqual(
        GitModule.MergeConflictError.make({ cwd }).message,
        "merge conflict in /repo: fix conflicts (or abort) before continuing"
      );
      assert.strictEqual(
        GitModule.DirtyWorktreeError.make({ cwd }).message,
        "local changes would be overwritten in /repo: commit or stash them first"
      );
      assert.match(GitModule.NonFastForwardError.make({ cwd }).message, /non-fast-forward/);
      assert.match(GitModule.NonFastForwardError.make({ cwd, refspec: "main" }).message, /main/);
      assert.match(
        GitModule.GitCommandError.make({ cwd, kind: "failed", args: ["status"], stderr: "oops" }).message,
        /exit \?/
      );
      assert.match(
        GitModule.GitCommandError.make({ cwd, kind: "failed", args: [], stderr: "", detail: "reason" }).message,
        /reason/
      );
    })
  );

  it.effect("commonDir retains the defensive unknown-ref defect", () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.flatMap(Git, (git) => git.commonDir(cwd)),
        { exit: 128, stderr: "unknown revision" }
      ).pipe(Effect.exit);
      assert.strictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        assertSuccess(
          Cause.findDie(exit.cause).pipe(Result.map((reason) => reason.defect)),
          'Git.commonDir: unexpected classification "unknownRef"'
        );
      }
    })
  );
});

/** The fail-closed contract every entry parser shares: `kind: "failed"`, no exit code, a detail naming the output. */
const assertUnparseable = (result: Result.Result<unknown, unknown>, what: string, reason: RegExp): void => {
  assert.strictEqual(Result.isFailure(result), true);
  if (!Result.isFailure(result)) return;
  const failure = result.failure;
  assert.strictEqual(S.is(GitModule.GitCommandError)(failure), true);
  if (!S.is(GitModule.GitCommandError)(failure)) return;
  assert.strictEqual(failure.kind, "failed");
  assert.strictEqual(failure.exitCode, undefined);
  assert.strictEqual(failure.cwd, cwd);
  assert.isTrue(
    Str.startsWith(`unparseable ${what} output: `)(failure.detail ?? ""),
    `detail should open "unparseable ${what} output: ", got ${failure.detail}`
  );
  assert.match(failure.detail ?? "", reason);
};

describe("Git parser edge contracts", () => {
  // Inverted (G4): these inputs USED to parse fail-open — a missing path
  // token became `""` and an unknown code became `"unknown"` — which is how
  // a truncated `-z` stream or a non-`-z` run turned into plausible entries.
  // Every entry parser now fails closed, naming the offending record.
  it.effect("refuses incomplete name-status and rename tokens instead of inventing paths", () =>
    Effect.gen(function* () {
      const git = Effect.flatMap(Git, (git) => git.nameStatus(cwd, { base: "HEAD" }));
      // No trailing NUL: a line-delimited (non -z) or truncated stream.
      for (const text of ["Q", "R", "R\0old", "M"]) {
        assertUnparseable(yield* run(git, { stdout: text }).pipe(Effect.result), "name-status", /NUL terminator/);
      }
      // Terminated, but the record is short of its path tokens or opens with a code git never emits.
      assertUnparseable(yield* run(git, { stdout: "M\0" }).pipe(Effect.result), "name-status", /fewer path tokens/);
      assertUnparseable(yield* run(git, { stdout: "R100\0old\0" }).pipe(Effect.result), "name-status", /fewer path/);
      assertUnparseable(yield* run(git, { stdout: "Q\0file\0" }).pipe(Effect.result), "name-status", /"Q"/);
      // Well-formed input is unchanged, empty output stays the empty listing.
      assert.deepStrictEqual(yield* run(git, { stdout: "" }), []);
      assert.deepStrictEqual(yield* run(git, { stdout: "M\0file\0" }), [
        GitModule.NameStatusEntry.make({ status: "modified", path: "file" }),
      ]);
      // A rename code without digits is still a rename, with no score to report.
      assert.deepStrictEqual(yield* run(git, { stdout: "R\0old\0new\0" }), [
        GitModule.NameStatusEntry.make({ status: "renamed", oldPath: "old", path: "new" }),
      ]);
      const status = Effect.flatMap(Git, (git) => git.status(cwd));
      assertUnparseable(yield* run(status, { stdout: "R  new" }).pipe(Effect.result), "status", /NUL terminator/);
      assertUnparseable(yield* run(status, { stdout: "R  new\0" }).pipe(Effect.result), "status", /no original path/);
      assertUnparseable(yield* run(status, { stdout: "M\0" }).pipe(Effect.result), "status", /XY <path>/);
      assertUnparseable(
        yield* run(status, { stdout: "ZZ file\0" }).pipe(Effect.result),
        "status",
        /porcelain does not/
      );
    })
  );

  it.effect("quotes a long offending record truncated, JSON-escaped", () =>
    Effect.gen(function* () {
      const long = Str.repeat(200)("x");
      const result = yield* run(
        Effect.flatMap(Git, (git) => git.lsTree(cwd, "HEAD")),
        { stdout: `${long}\0` }
      ).pipe(Effect.result);
      assertUnparseable(result, "ls-tree", /"x{80}…"/);
      if (Result.isFailure(result) && S.is(GitModule.GitCommandError)(result.failure)) {
        assert.isBelow(result.failure.detail?.length ?? 0, 200);
      }
    })
  );

  // Inverted (G4): a tree or index record missing header fields used to be
  // back-filled with `type: "blob"`, `oid: ""` and `stage: 0`.
  it.effect("refuses tree and index records missing header fields; unterminated config values still parse", () =>
    Effect.gen(function* () {
      const tree = Effect.flatMap(Git, (git) => git.lsTree(cwd, "HEAD"));
      assertUnparseable(yield* run(tree, { stdout: "100644\tfile\0" }).pipe(Effect.result), "ls-tree", /<oid>/);
      assertUnparseable(
        yield* run(tree, { stdout: "100644 blob abc file\0" }).pipe(Effect.result),
        "ls-tree",
        /tab|<path>/
      );
      assertUnparseable(
        yield* run(tree, { stdout: "100644 thing abc\tfile\0" }).pipe(Effect.result),
        "ls-tree",
        /"100644 thing abc\\tfile"/
      );
      assertUnparseable(yield* run(tree, { stdout: "100644 blob abc\tfile" }).pipe(Effect.result), "ls-tree", /NUL/);
      const files = Effect.flatMap(Git, (git) => git.lsFiles(cwd));
      assertUnparseable(yield* run(files, { stdout: "100644\tfile\0" }).pipe(Effect.result), "ls-files", /<stage>/);
      assertUnparseable(
        yield* run(files, { stdout: "100644 abc 7\tfile\0" }).pipe(Effect.result),
        "ls-files",
        /<stage>/
      );
      assertUnparseable(
        yield* run(files, { stdout: "100644 abc x\tfile\0" }).pipe(Effect.result),
        "ls-files",
        /<stage>/
      );
      assert.deepStrictEqual(yield* run(files, { stdout: "100644 abc 3\tfile\0" }), [
        GitModule.LsFilesEntry.make({ mode: "100644", oid: "abc", stage: 3, path: "file" }),
      ]);
      // configGetAll is a value list, not an entry parser: it keeps its total contract.
      assert.deepStrictEqual(
        yield* run(
          Effect.flatMap(Git, (git) => git.configGetAll(cwd, "a.b")),
          { stdout: "value" }
        ),
        ["value"]
      );
    })
  );

  it.effect("accepts CRLF and sha-only submodule listings", () =>
    Effect.gen(function* () {
      const entries = yield* run(
        Effect.flatMap(Git, (git) => git.submoduleStatus(cwd)),
        { stdout: "abcdef\r\n" }
      );
      assert.deepStrictEqual(entries, [
        GitModule.SubmoduleStatusEntry.make({ state: "current", sha: "abcdef", path: "" }),
      ]);
    })
  );

  it.effect("retains empty and reasoned lock annotations, reads prunable as a flag, ignores unknown attributes", () =>
    Effect.gen(function* () {
      const entries = yield* run(
        Effect.flatMap(Git, (git) => git.worktreeList(cwd)),
        {
          stdout: "worktree /a\0locked\0prunable\0\0worktree /b\0locked reason\0prunable stale\0unknown attribute\0\0",
        }
      );
      // `prunable` is a boolean now (G4): the reason text git appends is dropped.
      assert.deepStrictEqual(entries, [
        GitModule.WorktreeEntry.make({ path: "/a", bare: false, detached: false, locked: "", prunable: true }),
        GitModule.WorktreeEntry.make({ path: "/b", bare: false, detached: false, locked: "reason", prunable: true }),
      ]);
    })
  );

  it.effect("refuses worktree output without its block terminator, its worktree line, or its trailing NUL", () =>
    Effect.gen(function* () {
      const list = Effect.flatMap(Git, (git) => git.worktreeList(cwd));
      assertUnparseable(
        yield* run(list, { stdout: "worktree /a\0bare\0" }).pipe(Effect.result),
        "worktree list",
        /not terminated/
      );
      assertUnparseable(
        yield* run(list, { stdout: "HEAD abc\0detached\0\0" }).pipe(Effect.result),
        "worktree list",
        /no `worktree <path>` line/
      );
      assertUnparseable(
        yield* run(list, { stdout: "worktree /a\0bare" }).pipe(Effect.result),
        "worktree list",
        /NUL terminator/
      );
      assert.deepStrictEqual(yield* run(list, { stdout: "" }), []);
    })
  );

  it.effect("reports every truncated log header as a parse failure", () =>
    Effect.gen(function* () {
      for (const text of ["\0", "\0sha\0", "\0sha\0date\0", "\0sha\0date\0date\0"]) {
        const result = yield* run(
          Effect.flatMap(Git, (git) => git.log(cwd)),
          { stdout: text }
        ).pipe(Effect.result);
        assert.strictEqual(Result.isFailure(result), true);
        if (Result.isFailure(result)) assert.match(result.failure.message, /fewer fields/);
      }
    })
  );

  it.effect("keeps non-origin symbolic default branches and commonDir failures", () =>
    Effect.gen(function* () {
      assertSome(
        yield* run(
          Effect.flatMap(Git, (git) => git.defaultBranch(cwd)),
          { stdout: "main\n" }
        ),
        "main"
      );
      const result = yield* run(
        Effect.flatMap(Git, (git) => git.commonDir(cwd)),
        { exit: 2, stderr: "failure" }
      ).pipe(Effect.result);
      assert.strictEqual(Result.isFailure(result), true);
      if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "GitCommandError");
    })
  );

  it.effect("successful stash restoration and submodule changes return void", () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const git = yield* Git;
          yield* git.stashPop(cwd);
          yield* git.stashApply(cwd);
          yield* git.submoduleSync(cwd);
          yield* git.submoduleSetUrl(cwd, "lib", "url");
          yield* git.configGetAll(cwd, "a.b", { file: "/config" });
          yield* git.configUnset(cwd, "a.b", { file: "/config" });
          yield* git.worktreeAdd(cwd, "/other", { ref: "HEAD" });
        }),
        { stdout: "" }
      );
      assert.strictEqual(result, undefined);
    })
  );
});

describe("Git final branch contracts", () => {
  it.effect("names the single base revision in a working-tree diff failure", () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.flatMap(Git, (git) => git.nameStatus(cwd, { base: "base" })),
        { exit: 128, stderr: "unknown revision" }
      ).pipe(Effect.result);
      assertFailure(result, GitModule.UnknownRefError.make({ cwd, ref: "base" }));
    })
  );

  it.effect("declines to rewrite an unterminated quoted SSH command", () =>
    Effect.gen(function* () {
      let observed = false;
      const recording = Layer.effect(
        ChildProcessSpawner.ChildProcessSpawner,
        Effect.map(ChildProcessSpawner.ChildProcessSpawner, (original) =>
          ChildProcessSpawner.make((command) => {
            if (ChildProcess.isStandardCommand(command) && command.args[0] === "ls-remote") {
              observed = true;
              assert.strictEqual(command.options.env?.GIT_SSH_COMMAND, undefined);
            }
            return original.spawn(command);
          })
        )
      ).pipe(Layer.provide(scripted(() => ({ stdout: "", exit: 0 }))));
      yield* Effect.scopedWith((scope) =>
        Effect.flatMap(
          Layer.buildWithScope(
            Git.layer.pipe(
              Layer.provide(
                Layer.mergeAll(
                  recording,
                  ConfigProvider.layer(ConfigProvider.fromEnvRecord({ GIT_SSH_COMMAND: '"/opt/my tools/ssh' }))
                )
              )
            ),
            scope
          ),
          (context) =>
            Effect.provideContext(
              Effect.flatMap(Git, (git) => git.lsRemote(cwd, "origin")),
              context
            )
        )
      );
      assert.strictEqual(observed, true);
    })
  );
});
