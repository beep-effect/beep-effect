import { Git, LsTreeEntry, NotStubbedError } from "@beep/git/Git";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constFalse, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { GitStubs } from "@beep/git/Git";

const cwd = "/repo";

// ── Git.makeTest: the shape value directly — no layer needed ────────────────

describe("Git.makeTest", () => {
  it.effect("an overridden method runs the stub", () =>
    Effect.gen(function* () {
      const double = Git.makeTest({
        revParse: () => Effect.succeed(Str.repeat(40)("a")),
      });
      assert.strictEqual(yield* double.revParse(cwd, "HEAD"), Str.repeat(40)("a"));
    })
  );

  it.effect("a stub answers the data-last form too, with cwd as the piped subject", () =>
    Effect.gen(function* () {
      const double = Git.makeTest({
        revParse: (stubCwd, ref) => Effect.succeed(`${stubCwd}@${ref}`),
        reset: (stubCwd, options) =>
          Effect.sync(() => assert.strictEqual(`${stubCwd}:${options?.mode ?? "mixed"}`, "/repo:hard")),
        workingChanges: (stubCwd) => Effect.succeed([stubCwd]),
      });
      // Fixed arity: dispatch on argument count.
      assert.strictEqual(yield* pipe(cwd, double.revParse("HEAD")), "/repo@HEAD");
      // Optional trailing options: dispatch on the string subject, so the
      // data-first call without options still runs instead of returning a function.
      yield* pipe(cwd, double.reset({ mode: "hard" }));
      assert.deepStrictEqual(yield* double.workingChanges(cwd), ["/repo"]);
      assert.deepStrictEqual(yield* pipe(cwd, double.workingChanges()), ["/repo"]);
    })
  );

  it.effect("(cwd, ...strings, options?) members dispatch on the last required string, with or without options", () =>
    Effect.gen(function* () {
      const double = Git.makeTest({
        checkout: (stubCwd, ref, options) =>
          Effect.sync(() => seen.push(`checkout ${stubCwd} ${ref} ${options?.detach ?? false}`)),
        configSet: (stubCwd, key, value, options) =>
          Effect.sync(() => seen.push(`configSet ${stubCwd} ${key}=${value} ${options?.file ?? "-"}`)),
      });
      const seen: Array<string> = [];
      yield* double.checkout(cwd, "main");
      yield* double.checkout(cwd, "main", { detach: true });
      yield* pipe(cwd, double.checkout("main"));
      yield* pipe(cwd, double.checkout("main", { detach: true }));
      yield* double.configSet(cwd, "core.bare", "false");
      yield* pipe(cwd, double.configSet("core.bare", "false"));
      yield* pipe(cwd, double.configSet("core.bare", "false", { file: ".gitmodules" }));
      assert.deepStrictEqual(seen, [
        "checkout /repo main false",
        "checkout /repo main true",
        "checkout /repo main false",
        "checkout /repo main true",
        "configSet /repo core.bare=false -",
        "configSet /repo core.bare=false -",
        "configSet /repo core.bare=false .gitmodules",
      ]);
    })
  );

  it.effect("an unstubbed dual member dies in its data-last form as well", () =>
    Effect.gen(function* () {
      const double = Git.makeTest();
      const fixed = yield* Effect.exit(pipe(cwd, double.show("HEAD", "file.txt")));
      fixed.pipe(Exit.match({ onSuccess: constFalse, onFailure: Cause.hasDies }), assertTrue);
      const optional = yield* Effect.exit(pipe(cwd, double.stashPop()));
      optional.pipe(Exit.match({ onSuccess: constFalse, onFailure: Cause.hasDies }), assertTrue);
    })
  );

  it.effect("an unstubbed method DIES with a defect naming the method", () =>
    Effect.gen(function* () {
      // No honest default exists for an unstubbed method — a
      // fabricated answer would leak into consumer logic as fact — so the
      // default is a defect, not a typed failure a test could swallow.
      const double = Git.makeTest({ revParse: () => Effect.succeed("sha") });
      assertExitFailure(
        yield* Effect.exit(double.status(cwd)),
        Cause.die(
          NotStubbedError.make({
            message:
              "Git.makeTest: status() was called but not stubbed — no honest default exists for a test double; pass a `status` override.",
          })
        )
      );
    })
  );

  it.effect("every method of an unstubbed double is present and dies — none is undefined", () =>
    Effect.gen(function* () {
      // The motivating boilerplate (issue #170): a hand-rolled double had to
      // stub all twenty-six methods to satisfy tsc. `makeTest()` with no
      // overrides must fill every slot with a callable that dies.
      const double = Git.makeTest();
      const calls: Record<
        keyof typeof double,
        () => Effect.Effect<unknown, Effect.Error<ReturnType<GitStubs[keyof GitStubs]>>>
      > = {
        show: () => double.show(cwd, "HEAD", "file.txt"),
        lsTree: () => double.lsTree(cwd, "HEAD"),
        refExists: () => double.refExists(cwd, "HEAD"),
        mergeBase: () => double.mergeBase(cwd, "HEAD", "main"),
        mergeBaseOption: () => double.mergeBaseOption(cwd, "HEAD", "main"),
        changedFiles: () => double.changedFiles(cwd, { base: "main", head: "HEAD" }),
        workingChanges: () => double.workingChanges(cwd),
        revParse: () => double.revParse(cwd, "HEAD"),
        checkout: () => double.checkout(cwd, "main"),
        fetch: () => double.fetch(cwd, { ref: "main" }),
        fetchAny: () => double.fetchAny(cwd, { ref: "main" }),
        fetchUnshallow: () => double.fetchUnshallow(cwd),
        isShallow: () => double.isShallow(cwd),
        reset: () => double.reset(cwd),
        clean: () => double.clean(cwd),
        restore: () => double.restore(cwd, ["file.txt"]),
        branchCreate: () => double.branchCreate(cwd, "topic"),
        branchDelete: () => double.branchDelete(cwd, "topic"),
        submoduleUpdate: () => double.submoduleUpdate(cwd),
        submoduleAdd: () => double.submoduleAdd(cwd, { url: "../other", path: "vendor" }),
        submoduleStatus: () => double.submoduleStatus(cwd),
        submoduleInit: () => double.submoduleInit(cwd),
        submoduleDeinit: () => double.submoduleDeinit(cwd, { all: true }),
        submoduleSync: () => double.submoduleSync(cwd),
        submoduleSetUrl: () => double.submoduleSetUrl(cwd, "vendor", "../other"),
        submoduleSetBranch: () => double.submoduleSetBranch(cwd, "vendor"),
        submoduleAbsorbgitdirs: () => double.submoduleAbsorbgitdirs(cwd),
        submoduleForeach: () => double.submoduleForeach(cwd, "git status"),
        sparseCheckoutSet: () => double.sparseCheckoutSet(cwd, ["src"], { cone: true }),
        configSet: () => double.configSet(cwd, "core.bare", "false"),
        add: () => double.add(cwd, ["file.txt"]),
        nameStatus: () => double.nameStatus(cwd, { base: "main" }),
        unstagedChanges: () => double.unstagedChanges(cwd),
        stagedChanges: () => double.stagedChanges(cwd),
        untrackedFiles: () => double.untrackedFiles(cwd),
        defaultBranch: () => double.defaultBranch(cwd),
        currentBranch: () => double.currentBranch(cwd),
        repoRoot: () => double.repoRoot(cwd),
        commonDir: () => double.commonDir(cwd),
        configGet: () => double.configGet(cwd, "core.bare"),
        remoteUrl: () => double.remoteUrl(cwd),
        commitInfo: () => double.commitInfo(cwd),
        log: () => double.log(cwd),
        status: () => double.status(cwd),
        lsRemote: () => double.lsRemote(cwd, "origin"),
        remoteAdd: () => double.remoteAdd(cwd, "origin", "../other"),
        remoteRemove: () => double.remoteRemove(cwd, "origin"),
        remoteSetUrl: () => double.remoteSetUrl(cwd, "origin", "../other"),
        stashPush: () => double.stashPush(cwd),
        stashPop: () => double.stashPop(cwd),
        stashApply: () => double.stashApply(cwd),
        stashDrop: () => double.stashDrop(cwd),
        stashList: () => double.stashList(cwd),
        branchList: () => double.branchList(cwd),
        tagCreate: () => double.tagCreate(cwd, "v1"),
        tagDelete: () => double.tagDelete(cwd, "v1"),
        tagList: () => double.tagList(cwd),
        forEachRef: () => double.forEachRef(cwd),
        revList: () => double.revList(cwd, "HEAD"),
        commit: () => double.commit(cwd, "test"),
        push: () => double.push(cwd),
        pull: () => double.pull(cwd),
        configList: () => double.configList(cwd),
        configGetAll: () => double.configGetAll(cwd, "core.bare"),
        configUnset: () => double.configUnset(cwd, "core.bare"),
        configRemoveSection: () => double.configRemoveSection(cwd, "core"),
        configRenameSection: () => double.configRenameSection(cwd, "core", "other"),
        rm: () => double.rm(cwd, ["file.txt"]),
        mv: () => double.mv(cwd, "old.txt", "new.txt"),
        checkIgnore: () => double.checkIgnore(cwd, ["file.txt"]),
        worktreeAdd: () => double.worktreeAdd(cwd, "../worktree"),
        worktreeList: () => double.worktreeList(cwd),
        worktreeRemove: () => double.worktreeRemove(cwd, "../worktree"),
        lsFiles: () => double.lsFiles(cwd),
      };
      for (const method of R.keys(double)) {
        const fn = double[method];
        assert.isFunction(fn);
        const effect = calls[method]();
        const exit = yield* Effect.exit(effect);
        assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
        assert.isTrue(Cause.hasDies(exit.cause), `${method} should die unstubbed`);
      }
    })
  );
});

// ── Git.layerTest: the double behind Layer.succeed ──────────────────────────

// Bound to a const: layerTest is a parameterized layer factory and layers
// memoize by reference.
const TestGit = Git.layerTest({
  show: (_cwd: string, _ref: string, path: string) => Effect.succeed(path === "package.json" ? O.some("{}") : O.none()),
  lsTree: () =>
    Effect.succeed([
      LsTreeEntry.make({ mode: "100644", type: "blob", oid: Str.repeat(40)("0"), path: "package.json" }),
    ]),
});

describe("Git.layerTest", () => {
  it.layer(TestGit, { timeout: "30 seconds" })((it) => {
    it.effect("provides the Git service with the stubbed methods answering", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const shown = yield* git.show(cwd, "HEAD", "package.json");
        assertSome(shown, "{}");
        const entries = yield* git.lsTree(cwd, "HEAD");
        assert.deepStrictEqual(
          A.map(entries, (entry) => entry.path),
          ["package.json"]
        );
      })
    );

    it.effect("an unstubbed method still dies through the layer", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const exit = yield* Effect.exit(git.checkout(cwd, "main"));
        assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
        assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
        assert.isTrue(Cause.hasDies(exit.cause));
      })
    );
  });
});
