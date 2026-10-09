import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as GitModule from "../../effected/git/Git.ts";
import { Git } from "../../effected/git/Git.ts";
import { scripted } from "./fixtures.ts";
import type { ScriptResult } from "./fixtures.ts";

const cwd = "/repo";
const run = <A, E>(program: Effect.Effect<A, E, Git>, outcome: ScriptResult) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(
    Git.layer.pipe(Layer.provide(Layer.mergeAll(
      scripted((args) => args[0] === "config" && args[1] === "--get" &&
        (args[2] === "core.sshCommand" || args[2] === "ssh.variant") ? { exit: 1 } : outcome),
      ConfigProvider.layer(ConfigProvider.fromEnvRecord({})),
    ))), scope), (context) => Effect.provideContext(program, context)));

type GitError = GitModule.GitCommandError | GitModule.NotARepositoryError | GitModule.UnknownRefError |
  GitModule.NonFastForwardError | GitModule.MergeConflictError | GitModule.DirtyWorktreeError;

const operations: ReadonlyArray<readonly [string, (git: GitModule.GitShape) => Effect.Effect<unknown, GitError>]> = [
  ["show", (git) => git.show(cwd, "HEAD", "file")],
  ["lsTree", (git) => git.lsTree(cwd, "HEAD")],
  ["refExists", (git) => git.refExists(cwd, "HEAD")],
  ["mergeBase", (git) => git.mergeBase(cwd, "a", "b")],
  ["mergeBaseOption", (git) => git.mergeBaseOption(cwd, "a", "b")],
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
  ["lsFiles", (git) => git.lsFiles(cwd)],
];

describe("Git service error contracts", () => {
  for (const [name, invoke] of operations) {
    it.effect(`${name}: classifies repository and command failures`, () => Effect.gen(function* () {
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
    }));
    it.effect(`${name}: maps unknown revisions`, () => Effect.gen(function* () {
      const result = yield* run(Effect.flatMap(Git, invoke), { stderr: "fatal: unknown revision", exit: 128 }).pipe(Effect.result);
      if (name === "refExists") {
        assertSuccess(result, false);
      } else {
        assert.strictEqual(Result.isFailure(result), true);
        if (Result.isFailure(result)) {
          assert.strictEqual(S.is(GitModule.UnknownRefError)(result.failure), true);
        }
      }
    }));
  }

  it.effect("renders all public diagnostic messages and optional details", () => Effect.sync(() => {
    assert.strictEqual(GitModule.NotARepositoryError.make({ cwd }).message, "not a git repository: /repo");
    assert.strictEqual(GitModule.UnknownRefError.make({ cwd, ref: "HEAD" }).message, "unknown ref 'HEAD' in /repo");
    assert.strictEqual(GitModule.MergeConflictError.make({ cwd }).message, "merge conflict in /repo: fix conflicts (or abort) before continuing");
    assert.strictEqual(GitModule.DirtyWorktreeError.make({ cwd }).message, "local changes would be overwritten in /repo: commit or stash them first");
    assert.match(GitModule.NonFastForwardError.make({ cwd }).message, /non-fast-forward/);
    assert.match(GitModule.NonFastForwardError.make({ cwd, refspec: "main" }).message, /main/);
    assert.match(GitModule.GitCommandError.make({ cwd, kind: "failed", args: ["status"], stderr: "oops" }).message, /exit \?/);
    assert.match(GitModule.GitCommandError.make({ cwd, kind: "failed", args: [], stderr: "", detail: "reason" }).message, /reason/);
  }));

  it.effect("commonDir retains the defensive unknown-ref defect", () => Effect.gen(function* () {
    const exit = yield* run(Effect.flatMap(Git, (git) => git.commonDir(cwd)), { exit: 128, stderr: "unknown revision" }).pipe(Effect.exit);
    assert.strictEqual(Exit.isFailure(exit), true);
    if (Exit.isFailure(exit)) {
      assertSuccess(Cause.findDie(exit.cause).pipe(Result.map((reason) => reason.defect)),
        'Git.commonDir: unexpected classification "unknownRef"');
    }
  }));
});

describe("Git parser edge contracts", () => {
  it.effect("preserves incomplete name-status and rename tokens without inventing paths", () => Effect.gen(function* () {
    const git = Effect.flatMap(Git, (git) => git.nameStatus(cwd, { base: "HEAD" }));
    for (const text of ["Q", "R", "R\0old", "M"]) {
      const entries = yield* run(git, { stdout: text });
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0]?.path, "");
    }
    const entries = yield* run(Effect.flatMap(Git, (git) => git.status(cwd)), { stdout: "R  new" });
    assert.strictEqual(entries[0]?.origPath, "");
  }));

  it.effect("defaults missing tree and index headers and retains unterminated config values", () => Effect.gen(function* () {
    const tree = yield* run(Effect.flatMap(Git, (git) => git.lsTree(cwd, "HEAD")), { stdout: "100644\tfile\0" });
    assert.deepStrictEqual(tree, [GitModule.LsTreeEntry.make({ mode: "100644", type: "blob", oid: "", path: "file" })]);
    const files = yield* run(Effect.flatMap(Git, (git) => git.lsFiles(cwd)), { stdout: "100644\tfile\0" });
    assert.deepStrictEqual(files, [GitModule.LsFilesEntry.make({ mode: "100644", oid: "", stage: 0, path: "file" })]);
    assert.deepStrictEqual(yield* run(Effect.flatMap(Git, (git) => git.configGetAll(cwd, "a.b")), { stdout: "value" }), ["value"]);
  }));

  it.effect("accepts CRLF and sha-only submodule listings", () => Effect.gen(function* () {
    const entries = yield* run(Effect.flatMap(Git, (git) => git.submoduleStatus(cwd)), { stdout: "abcdef\r\n" });
    assert.deepStrictEqual(entries, [GitModule.SubmoduleStatusEntry.make({ state: "current", sha: "abcdef", path: "" })]);
  }));

  it.effect("retains empty and reasoned worktree annotations and ignores unknown attributes", () => Effect.gen(function* () {
    const entries = yield* run(Effect.flatMap(Git, (git) => git.worktreeList(cwd)), {
      stdout: "worktree /a\0locked\0prunable\0\0worktree /b\0locked reason\0prunable stale\0unknown attribute\0\0",
    });
    assert.deepStrictEqual(entries, [
      GitModule.WorktreeEntry.make({ path: "/a", bare: false, detached: false, locked: "", prunable: "" }),
      GitModule.WorktreeEntry.make({ path: "/b", bare: false, detached: false, locked: "reason", prunable: "stale" }),
    ]);
  }));

  it.effect("reports every truncated log header as a parse failure", () => Effect.gen(function* () {
    for (const text of ["\0", "\0sha\0", "\0sha\0date\0", "\0sha\0date\0date\0"]) {
      const result = yield* run(Effect.flatMap(Git, (git) => git.log(cwd)), { stdout: text }).pipe(Effect.result);
      assert.strictEqual(Result.isFailure(result), true);
      if (Result.isFailure(result)) assert.match(result.failure.message, /fewer fields/);
    }
  }));

  it.effect("keeps non-origin symbolic default branches and commonDir failures", () => Effect.gen(function* () {
    assertSome(yield* run(Effect.flatMap(Git, (git) => git.defaultBranch(cwd)), { stdout: "main\n" }), "main");
    const result = yield* run(Effect.flatMap(Git, (git) => git.commonDir(cwd)), { exit: 2, stderr: "failure" }).pipe(Effect.result);
    assert.strictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) assert.strictEqual(result.failure._tag, "GitCommandError");
  }));

  it.effect("successful stash restoration and submodule changes return void", () => Effect.gen(function* () {
    const result = yield* run(Effect.gen(function* () {
      const git = yield* Git;
      yield* git.stashPop(cwd);
      yield* git.stashApply(cwd);
      yield* git.submoduleSync(cwd);
      yield* git.submoduleSetUrl(cwd, "lib", "url");
      yield* git.configGetAll(cwd, "a.b", { file: "/config" });
      yield* git.configUnset(cwd, "a.b", { file: "/config" });
      yield* git.worktreeAdd(cwd, "/other", { ref: "HEAD" });
    }), { stdout: "" });
    assert.strictEqual(result, undefined);
  }));
});


describe("Git final branch contracts", () => {
  it.effect("names the single base revision in a working-tree diff failure", () => Effect.gen(function* () {
    const result = yield* run(Effect.flatMap(Git, (git) => git.nameStatus(cwd, { base: "base" })),
      { exit: 128, stderr: "unknown revision" }).pipe(Effect.result);
    assertFailure(result, GitModule.UnknownRefError.make({ cwd, ref: "base" }));
  }));

  it.effect("declines to rewrite an unterminated quoted SSH command", () => Effect.gen(function* () {
    let observed = false;
    const recording = Layer.effect(ChildProcessSpawner.ChildProcessSpawner,
      Effect.map(ChildProcessSpawner.ChildProcessSpawner, (original) => ChildProcessSpawner.make((command) => {
        if (ChildProcess.isStandardCommand(command) && command.args[0] === "ls-remote") {
          observed = true;
          assert.strictEqual(command.options.env?.GIT_SSH_COMMAND, undefined);
        }
        return original.spawn(command);
      }))).pipe(Layer.provide(scripted(() => ({ stdout: "", exit: 0 }))));
    yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(
      Git.layer.pipe(Layer.provide(Layer.mergeAll(recording,
        ConfigProvider.layer(ConfigProvider.fromEnvRecord({ GIT_SSH_COMMAND: '"/opt/my tools/ssh' }))))), scope),
      (context) => Effect.provideContext(Effect.flatMap(Git, (git) => git.lsRemote(cwd, "origin")), context)));
    assert.strictEqual(observed, true);
  }));
});
