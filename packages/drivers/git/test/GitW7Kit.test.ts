// The W7 kit members (repo-cli-gh-git-consolidation SPEC D-17): revListCount,
// mergeTree, upstream, updateRef, gitDir and diffPatch, plus the ten option
// extensions. This suite pins argv shape, pre-spawn refusals and every
// classification arm over a scripted spawner; the real-git semantics live in
// integration/GitW7Kit.int.test.ts.

import { Git, GitCommandError, MergeTreeResult, NotARepositoryError, UnknownRefError } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { parseLogFor, parseMergeTree, parseRevListCount, parseUpstream } from "@beep/git/internal/parsers";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { scripted } from "./fixtures.ts";
import type { ScriptResult } from "./fixtures.ts";

const cwd = "/repo";
const TREE = Str.repeat(40)("a");

/** A parser failure's message, or `""` when the parse succeeded. */
const failureText = <A>(result: Result.Result<A, string>): string => O.getOrElse(Result.getFailure(result), () => "");

const isSshProbe = (args: ReadonlyArray<string>): boolean =>
  args[0] === "config" && args[1] === "--get" && (args[2] === "core.sshCommand" || args[2] === "ssh.variant");

/** Runs `program` against the live service over a spawner that records every argv it is handed. */
const run = <A, E>(program: Effect.Effect<A, E, Git>, byArgs: (args: ReadonlyArray<string>) => ScriptResult) => {
  const seen: Array<ReadonlyArray<string>> = [];
  const spawner = scripted((args) => {
    if (isSshProbe(args)) return { exit: 1 };
    seen.push(args);
    return byArgs(args);
  });
  return Effect.scopedWith((scope) =>
    Effect.flatMap(
      Layer.buildWithScope(
        Git.layer.pipe(Layer.provide(Layer.mergeAll(spawner, ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))))),
        scope
      ),
      (context) => Effect.provideContext(program, context)
    )
  ).pipe(Effect.map((value) => ({ value, seen })));
};

/** The failure of `program`, which must fail. */
const failure = <A, E>(program: Effect.Effect<A, E, Git>, byArgs: (args: ReadonlyArray<string>) => ScriptResult) =>
  run(Effect.flip(program), byArgs).pipe(Effect.map(({ value, seen }) => ({ error: value, seen })));

const ok = (stdout = ""): ScriptResult => ({ stdout });
const assertRefused = (error: unknown, detail: string) => {
  assert.isTrue(S.is(GitCommandError)(error));
  if (S.is(GitCommandError)(error)) {
    assert.strictEqual(error.kind, "refused");
    assert.include(error.detail ?? "", detail);
  }
};

describe("GitCommand W7 argv", () => {
  it("builds the new members", () => {
    assert.deepStrictEqual(GitCommand.revListCount("a..b").command.args, [
      "rev-list",
      "--count",
      "--end-of-options",
      "a..b",
      "--",
    ]);
    assert.deepStrictEqual(pipe("a..b", GitCommand.revListCount(true)).command.args, [
      "rev-list",
      "--count",
      "--first-parent",
      "--end-of-options",
      "a..b",
      "--",
    ]);
    assert.deepStrictEqual(pipe("main", GitCommand.mergeTree("HEAD")).command.args, [
      "merge-tree",
      "--write-tree",
      "-z",
      "--name-only",
      "--end-of-options",
      "main",
      "HEAD",
    ]);
    assert.deepStrictEqual(GitCommand.upstream("feat").command.args, [
      "for-each-ref",
      "--format=%(refname)%00%(upstream)",
      "--end-of-options",
      "refs/heads/feat",
    ]);
    assert.deepStrictEqual(GitCommand.checkRefFormat("refs/x/y").command.args, ["check-ref-format", "refs/x/y"]);
    assert.deepStrictEqual(GitCommand.updateRef("refs/x/y", { create: "HEAD" }).command.args, [
      "update-ref",
      "--end-of-options",
      "refs/x/y",
      "HEAD",
      "",
    ]);
    assert.deepStrictEqual(pipe("refs/x/y", GitCommand.updateRef({ delete: "abc" })).command.args, [
      "update-ref",
      "-d",
      "--end-of-options",
      "refs/x/y",
      "abc",
    ]);
    assert.deepStrictEqual(GitCommand.gitDir().command.args, ["rev-parse", "--path-format=absolute", "--git-dir"]);
    assert.deepStrictEqual(GitCommand.gitDir("HEAD").command.args, [
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      "HEAD",
    ]);
    assert.deepStrictEqual(GitCommand.diffPatch().command.args, ["diff", "--no-color", "--no-ext-diff", "--"]);
    assert.deepStrictEqual(
      GitCommand.diffPatch({
        base: "a",
        head: "b",
        cached: true,
        binary: true,
        unified: 3,
        findRenames: 50,
        pathspec: ["src"],
      }).command.args,
      [
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--binary",
        "--unified=3",
        "--find-renames=50%",
        "--cached",
        "--end-of-options",
        "a",
        "b",
        "--",
        "src",
      ]
    );
    assert.deepStrictEqual(GitCommand.diffPatch({ base: "a", noRenames: true }).command.args, [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-renames",
      "--end-of-options",
      "a",
      "--",
    ]);
    assert.deepStrictEqual(GitCommand.diffPatch({ noIndex: ["/dev/null", "f"] }).command.args, [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-index",
      "--",
      "/dev/null",
      "f",
    ]);
  });

  it("extends the existing members without changing their default argv", () => {
    assert.deepStrictEqual(GitCommand.fetch("origin", "main").command.args, ["fetch", "origin", "main"]);
    assert.deepStrictEqual(GitCommand.fetch("origin").command.args, ["fetch", "origin"]);
    assert.deepStrictEqual(
      GitCommand.fetch("origin", "x", undefined, false, false, false, { noTags: true, noWriteFetchHead: true }).command
        .args,
      ["fetch", "--no-tags", "--no-write-fetch-head", "origin", "x"]
    );
    assert.deepStrictEqual(GitCommand.add(["a"]).command.args, ["add", "--", "a"]);
    assert.deepStrictEqual(GitCommand.add(["a"], true).command.args, ["add", "--force", "--", "a"]);
    assert.deepStrictEqual(GitCommand.checkIgnore(["a"], true).command.args, [
      "check-ignore",
      "--no-index",
      "-z",
      "--stdin",
    ]);
    assert.deepStrictEqual(GitCommand.stashPush("m", false, [], true).command.args, [
      "stash",
      "push",
      "--keep-index",
      "-m",
      "m",
    ]);
    assert.deepStrictEqual(GitCommand.branchList(true, false, "abc").command.args, [
      "branch",
      "--list",
      "--remotes",
      "--contains",
      "abc",
      "--format=%(HEAD)%00%(refname:short)%00%(objectname)",
    ]);
    assert.deepStrictEqual(GitCommand.submoduleForeach("pwd", false, true).command.args, [
      "submodule",
      "foreach",
      "--quiet",
      "pwd",
    ]);
    assert.deepStrictEqual(pipe("pwd", GitCommand.submoduleForeach(true, true)).command.args, [
      "submodule",
      "foreach",
      "--quiet",
      "--recursive",
      "pwd",
    ]);
    assert.deepStrictEqual(GitCommand.worktreeAdd("p", "r", false, false, "b").command.args, [
      "worktree",
      "add",
      "-b",
      "b",
      "p",
      "r",
    ]);
    assert.deepStrictEqual(GitCommand.nameStatus("a", "b", false, { noRenames: true }).command.args, [
      "diff",
      "--name-status",
      "-z",
      "--no-relative",
      "--no-renames",
      "a...b",
    ]);
    assert.deepStrictEqual(GitCommand.commit("m", false, false, false, undefined, false, false, true).command.args, [
      "commit",
      "--no-gpg-sign",
      "-m",
      "m",
    ]);
    assert.deepStrictEqual(
      pipe("m", GitCommand.commit(false, false, false, undefined, false, false, true)).command.args,
      ["commit", "--no-gpg-sign", "-m", "m"]
    );
    assert.deepStrictEqual(
      GitCommand.log(["p"], false, 2, false, {
        revisions: ["a..b"],
        noMerges: true,
        reverse: true,
        since: "21.days",
        omitPaths: true,
        includeBody: true,
      }).command.args,
      [
        "log",
        "--no-show-signature",
        "-z",
        "--format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae%x00%s%x00%b",
        "--max-count=2",
        "--no-merges",
        "--reverse",
        "--since=21.days",
        "--end-of-options",
        "a..b",
        "--",
        "p",
      ]
    );
  });
});

describe("W7 parsers", () => {
  it("reads rev-list counts fail-closed", () => {
    assert.strictEqual(Result.getOrThrow(parseRevListCount("7\n")), 7);
    assert.include(failureText(parseRevListCount("")), "expected one decimal count");
    assert.include(failureText(parseRevListCount("-1")), "expected one decimal count");
  });

  it("reads merge-tree answers fail-closed", () => {
    assert.deepStrictEqual(
      Result.getOrThrow(parseMergeTree(`${TREE}\u0000`, false)),
      MergeTreeResult.cases.clean.make({ tree: TREE })
    );
    const conflicted = `${TREE}\u0000a b.txt\u0000\u00001\u0000a b.txt\u0000Auto-merging\u0000Auto-merging a b.txt\n\u00001\u0000a b.txt\u0000CONFLICT (contents)\u0000CONFLICT (content): Merge conflict in a b.txt\n\u0000`;
    assert.deepStrictEqual(
      Result.getOrThrow(pipe(conflicted, parseMergeTree(true))),
      MergeTreeResult.cases.conflicted.make({
        tree: TREE,
        paths: ["a b.txt"],
        messages: ["Auto-merging a b.txt", "CONFLICT (content): Merge conflict in a b.txt"],
      })
    );
    assert.include(failureText(parseMergeTree("nottree\u0000", false)), "tree object id");
    assert.include(failureText(parseMergeTree(`${TREE}\u0000extra\u0000`, false)), "more than its tree");
    assert.include(failureText(parseMergeTree(`${TREE}\u0000a\u0000`, true)), "no end to its conflicted paths");
    assert.include(failureText(parseMergeTree(`${TREE}\u0000a\u0000\u0000x\u0000`, true)), "without a path count");
    assert.include(failureText(parseMergeTree(`${TREE}\u0000a\u0000\u00002\u0000a\u0000`, true)), "fewer fields");
    assert.include(failureText(parseMergeTree(TREE, false)), "NUL terminator");
  });

  it("reads exactly the named branch's upstream", () => {
    const output = "refs/heads/feat/x\u0000refs/remotes/origin/feat/x\nrefs/heads/main\u0000\n";
    const prefixOnly = parseUpstream(output, "refs/heads/feat");
    const noUpstream = pipe(output, parseUpstream("refs/heads/main"));
    const exact = parseUpstream(output, "refs/heads/feat/x");
    assertSuccess(prefixOnly, O.none());
    assertSuccess(noUpstream, O.none());
    assertSuccess(exact, O.some("refs/remotes/origin/feat/x"));
    assert.include(failureText(parseUpstream("refs/heads/main\n", "refs/heads/main")), "no NUL separator");
  });

  it("reads log bodies only when asked, and fails a short body record", () => {
    const header = "\u0000abc\u00002026-01-01T00:00:00Z\u00002026-01-01T00:00:00Z\u0000Ada\u0000ada@example.com\u0000s";
    const [entry] = Result.getOrThrow(parseLogFor({ includeBody: true })(`${header}\u0000b\n\u0000\nx.txt\u0000`));
    assert.strictEqual(entry?.body, "b\n");
    assert.deepStrictEqual(entry?.paths, ["x.txt"]);
    assert.include(failureText(parseLogFor({ includeBody: true, nameStatus: true })(header)), "fewer fields");
    const [plain] = Result.getOrThrow(parseLogFor({})(`${header}\u0000`));
    assert.isUndefined(plain?.body);
  });
});

describe("Git W7 members", () => {
  it.effect("revListCount counts, fails closed and maps unknown ranges", () =>
    Effect.gen(function* () {
      const counted = yield* run(
        Effect.flatMap(Git, (git) => git.revListCount(cwd, "a..b", { firstParent: true })),
        () => ok("3\n")
      );
      assert.strictEqual(counted.value, 3);
      assert.deepStrictEqual(counted.seen[0], [
        "rev-list",
        "--count",
        "--first-parent",
        "--end-of-options",
        "a..b",
        "--",
      ]);
      const unparseable = yield* failure(
        Effect.flatMap(Git, (git) => pipe(cwd, git.revListCount("a..b"))),
        () => ok("x")
      );
      assert.include(
        S.is(GitCommandError)(unparseable.error) ? (unparseable.error.detail ?? "") : "",
        "rev-list count"
      );
      const unknown = yield* failure(
        Effect.flatMap(Git, (git) => git.revListCount(cwd, "nope..HEAD")),
        () => ({ exit: 128, stderr: "fatal: bad revision 'nope..HEAD'" })
      );
      assert.isTrue(S.is(UnknownRefError)(unknown.error));
      const refused = yield* failure(
        Effect.flatMap(Git, (git) => git.revListCount(cwd, "--all")),
        () => ok()
      );
      assertRefused(refused.error, "option");
      assert.strictEqual(refused.seen.length, 0);
    })
  );

  it.effect("mergeTree answers clean, conflicted and unresolved revisions", () =>
    Effect.gen(function* () {
      const clean = yield* run(
        Effect.flatMap(Git, (git) => git.mergeTree(cwd, "main", "HEAD")),
        () => ok(`${TREE}\u0000`)
      );
      assert.strictEqual(clean.value._tag, "clean");
      const conflicted = yield* run(
        Effect.flatMap(Git, (git) => pipe(cwd, git.mergeTree("main", "HEAD"))),
        () => ({ exit: 1, stdout: `${TREE}\u0000f\u0000\u0000` })
      );
      assert.deepStrictEqual(
        conflicted.value,
        MergeTreeResult.cases.conflicted.make({ tree: TREE, paths: ["f"], messages: [] })
      );
      const unresolved = yield* failure(
        Effect.flatMap(Git, (git) => git.mergeTree(cwd, "main", "nope")),
        () => ({ exit: 1, stderr: "merge-tree: nope - not something we can merge\n" })
      );
      assert.isTrue(S.is(UnknownRefError)(unresolved.error));
      const noisy = yield* failure(
        Effect.flatMap(Git, (git) => git.mergeTree(cwd, "main", "HEAD")),
        () => ({ exit: 1, stderr: "warning: something else" })
      );
      assert.strictEqual(S.is(GitCommandError)(noisy.error) ? noisy.error.kind : "", "failed");
      const garbled = yield* failure(
        Effect.flatMap(Git, (git) => git.mergeTree(cwd, "main", "HEAD")),
        () => ok("garbage")
      );
      assert.include(S.is(GitCommandError)(garbled.error) ? (garbled.error.detail ?? "") : "", "merge-tree");
    })
  );

  it.effect("upstream reads the exact branch and keeps its defensive defect", () =>
    Effect.gen(function* () {
      const found = yield* run(
        Effect.flatMap(Git, (git) => git.upstream(cwd, "main")),
        () => ok("refs/heads/main\u0000refs/remotes/origin/main\n")
      );
      assertSome(found.value, "refs/remotes/origin/main");
      const garbled = yield* failure(
        Effect.flatMap(Git, (git) => pipe(cwd, git.upstream("main"))),
        () => ok("refs/heads/main\n")
      );
      assert.isTrue(S.is(GitCommandError)(garbled.error));
      const notRepo = yield* failure(
        Effect.flatMap(Git, (git) => git.upstream(cwd, "main")),
        () => ({ exit: 128, stderr: "fatal: not a git repository" })
      );
      assert.isTrue(S.is(NotARepositoryError)(notRepo.error));
      const failed = yield* failure(
        Effect.flatMap(Git, (git) => git.upstream(cwd, "main")),
        () => ({ exit: 128, stderr: "fatal: other" })
      );
      assert.isTrue(S.is(GitCommandError)(failed.error));
      const cause = yield* run(
        Effect.flatMap(Git, (git) => git.upstream(cwd, "main")),
        () => ({ exit: 128, stderr: "unknown revision" })
      ).pipe(Effect.sandbox, Effect.flip);
      assertSuccess(
        Result.map(Cause.findDie(cause), (reason) => reason.defect),
        'Git.upstream: unexpected classification "unknownRef"'
      );
    })
  );

  it.effect("updateRef guards the name with check-ref-format before writing", () =>
    Effect.gen(function* () {
      const created = yield* run(
        Effect.flatMap(Git, (git) => git.updateRef(cwd, "refs/archive/x", { create: "abc" })),
        () => ok()
      );
      assert.deepStrictEqual(created.seen, [
        ["check-ref-format", "refs/archive/x"],
        ["update-ref", "--end-of-options", "refs/archive/x", "abc", ""],
      ]);
      const deleted = yield* run(
        Effect.flatMap(Git, (git) => pipe(cwd, git.updateRef("refs/heads/b", { delete: "abc" }))),
        () => ok()
      );
      assert.deepStrictEqual(deleted.seen[1], ["update-ref", "-d", "--end-of-options", "refs/heads/b", "abc"]);
      const invalid = yield* failure(
        Effect.flatMap(Git, (git) => git.updateRef(cwd, "refs/a b", { create: "abc" })),
        () => ({ exit: 1 })
      );
      assertRefused(invalid.error, "well-formed");
      assert.strictEqual(invalid.seen.length, 1);
      const casFailed = yield* failure(
        Effect.flatMap(Git, (git) => git.updateRef(cwd, "refs/archive/x", { create: "abc" })),
        (args) => (args[0] === "check-ref-format" ? ok() : { exit: 128, stderr: "fatal: reference already exists" })
      );
      assert.strictEqual(S.is(GitCommandError)(casFailed.error) ? casFailed.error.kind : "", "failed");
      const optionLike = yield* failure(
        Effect.flatMap(Git, (git) => git.updateRef(cwd, "refs/archive/x", { delete: "-d" })),
        () => ok()
      );
      assertRefused(optionLike.error, "option");
    })
  );

  it.effect("gitDir answers the git dir or a git path and keeps commonDir's guards", () =>
    Effect.gen(function* () {
      const dir = yield* run(
        Effect.flatMap(Git, (git) => git.gitDir(cwd)),
        () => ok("/repo/.git\n")
      );
      assert.strictEqual(dir.value, "/repo/.git");
      const path = yield* run(
        Effect.flatMap(Git, (git) => pipe(cwd, git.gitDir({ path: "info/attributes" }))),
        () => ok("/repo/.git/info/attributes \n")
      );
      assert.strictEqual(path.value, "/repo/.git/info/attributes ");
      const old = yield* failure(
        Effect.flatMap(Git, (git) => git.gitDir(cwd, { path: "HEAD" })),
        () => ok("--path-format=absolute\n.git/HEAD\n")
      );
      assert.include(S.is(GitCommandError)(old.error) ? (old.error.detail ?? "") : "", "unparseable git-path output");
      const refused = yield* failure(
        Effect.flatMap(Git, (git) => git.gitDir(cwd, { path: "-x" })),
        () => ok()
      );
      assertRefused(refused.error, "option");
      const cause = yield* run(
        Effect.flatMap(Git, (git) => git.gitDir(cwd)),
        () => ({ exit: 128, stderr: "unknown revision" })
      ).pipe(Effect.sandbox, Effect.flip);
      assertSuccess(
        Result.map(Cause.findDie(cause), (reason) => reason.defect),
        'Git.gitDir: unexpected classification "unknownRef"'
      );
    })
  );

  it.effect("diffPatch renders patches, treats a silent no-index exit 1 as data, and refuses bad combinations", () =>
    Effect.gen(function* () {
      const worktree = yield* run(
        Effect.flatMap(Git, (git) => git.diffPatch(cwd)),
        () => ok("patch\n")
      );
      assert.strictEqual(worktree.value, "patch\n");
      const ranged = yield* run(
        Effect.flatMap(Git, (git) => pipe(cwd, git.diffPatch({ base: "a", head: "b" }))),
        () => ok("p")
      );
      assert.deepStrictEqual(ranged.seen[0], [
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--end-of-options",
        "a",
        "b",
        "--",
      ]);
      const differs = yield* run(
        Effect.flatMap(Git, (git) => git.diffPatch(cwd, { noIndex: ["/dev/null", "f"] })),
        () => ({ exit: 1, stdout: "new file" })
      );
      assert.strictEqual(differs.value, "new file");
      const same = yield* run(
        Effect.flatMap(Git, (git) => git.diffPatch(cwd, { noIndex: ["f", "f"] })),
        () => ok()
      );
      assert.strictEqual(same.value, "");
      const missing = yield* failure(
        Effect.flatMap(Git, (git) => git.diffPatch(cwd, { noIndex: ["missing", "f"] })),
        () => ({ exit: 1, stderr: "error: Could not access 'missing'" })
      );
      assert.strictEqual(S.is(GitCommandError)(missing.error) ? missing.error.kind : "", "failed");
      const unknown = yield* failure(
        Effect.flatMap(Git, (git) => git.diffPatch(cwd, { base: "nope" })),
        () => ({ exit: 128, stderr: "fatal: bad revision 'nope'" })
      );
      assert.isTrue(S.is(UnknownRefError)(unknown.error));
      for (const [options, detail] of [
        [{ head: "b" }, "needs a base"],
        [{ base: "a", noRenames: true, findRenames: 50 }, "noRenames with findRenames"],
        [{ noIndex: ["a", "b"], base: "x" }, "noIndex"],
        [{ noIndex: ["a", "b"], cached: true }, "noIndex"],
        [{ noIndex: ["a", "b"], pathspec: ["p"] }, "noIndex"],
        [{ unified: -1 }, "unified"],
        [{ findRenames: 0 }, "rename score"],
        [{ pathspec: ["-x"] }, "option"],
      ] as const) {
        const refused = yield* failure(
          Effect.flatMap(Git, (git) => git.diffPatch(cwd, options)),
          () => ok()
        );
        assertRefused(refused.error, detail);
        assert.strictEqual(refused.seen.length, 0);
      }
    })
  );
});

describe("Git W7 extensions", () => {
  it.effect("fetch takes no ref, the two quiet flags, and refuses a tag without a ref", () =>
    Effect.gen(function* () {
      const all = yield* run(
        Effect.flatMap(Git, (git) => git.fetch(cwd, { prune: true })),
        () => ok()
      );
      assert.deepStrictEqual(all.seen[0], ["fetch", "--prune", "origin"]);
      const pinned = yield* run(
        Effect.flatMap(Git, (git) =>
          git.fetch(cwd, { ref: "abc", noTags: true, noWriteFetchHead: true, remote: "upstream" })
        ),
        () => ok()
      );
      assert.deepStrictEqual(pinned.seen[0], ["fetch", "--no-tags", "--no-write-fetch-head", "upstream", "abc"]);
      const tagless = yield* failure(
        Effect.flatMap(Git, (git) => git.fetch(cwd, { tag: true })),
        () => ok()
      );
      assertRefused(tagless.error, "needs a ref");
      const missing = yield* failure(
        Effect.flatMap(Git, (git) => git.fetch(cwd, {})),
        () => ({ exit: 128, stderr: "fatal: couldn't find remote ref" })
      );
      assert.strictEqual(S.is(UnknownRefError)(missing.error) ? missing.error.ref : "", "(configured refspecs)");
    })
  );

  it.effect("log walks from revisions, omits paths, reads bodies, and types an unknown revision", () =>
    Effect.gen(function* () {
      const header =
        "\u0000abc\u00002026-01-01T00:00:00Z\u00002026-01-01T00:00:00Z\u0000Ada\u0000ada@example.com\u0000s";
      const listed = yield* run(
        Effect.flatMap(Git, (git) =>
          git.log(cwd, { revisions: ["a..b"], omitPaths: true, includeBody: true, since: "1.day" })
        ),
        () => ok(`${header}\u0000body\n\u0000`)
      );
      assert.strictEqual(listed.value[0]?.body, "body\n");
      assert.include(listed.seen[0] ?? [], "--since=1.day");
      const unknown = yield* failure(
        Effect.flatMap(Git, (git) => git.log(cwd, { revisions: ["nope", "^main"] })),
        () => ({ exit: 128, stderr: "fatal: bad revision 'nope'" })
      );
      assert.strictEqual(S.is(UnknownRefError)(unknown.error) ? unknown.error.ref : "", "nope ^main");
      const fromHead = yield* run(
        Effect.flatMap(Git, (git) => git.log(cwd)),
        () => ({ exit: 128, stderr: "fatal: bad revision 'HEAD'" })
      );
      assert.deepStrictEqual(fromHead.value, []);
      const contradictory = yield* failure(
        Effect.flatMap(Git, (git) => git.log(cwd, { omitPaths: true, nameStatus: true })),
        () => ok()
      );
      assertRefused(contradictory.error, "omitting paths");
      const optionLike = yield* failure(
        Effect.flatMap(Git, (git) => git.log(cwd, { revisions: ["--all"] })),
        () => ok()
      );
      assertRefused(optionLike.error, "option");
    })
  );

  it.effect(
    "nameStatus, add, checkIgnore, stashPush, commit, submoduleForeach and branchList render their new flags",
    () =>
      Effect.gen(function* () {
        const flagged = yield* run(
          Effect.gen(function* () {
            const git = yield* Git;
            yield* git.nameStatus(cwd, { base: "a", head: "b", noRenames: true, twoDot: true });
            yield* git.add(cwd, ["f"], { force: true });
            yield* pipe(cwd, git.add(["g"]));
            yield* git.checkIgnore(cwd, ["f"], { noIndex: true });
            yield* pipe(cwd, git.checkIgnore(["g"]));
            yield* git.stashPush(cwd, { keepIndex: true, includeUntracked: true });
            yield* git.commit(cwd, "m", { noGpgSign: true });
            yield* git.submoduleForeach(cwd, "pwd", { quiet: true, recursive: true });
            yield* git.branchList(cwd, { remotes: true, contains: "abc" });
          }),
          () => ok()
        );
        assert.deepStrictEqual(flagged.seen, [
          ["diff", "--name-status", "-z", "--no-relative", "--no-renames", "a", "b"],
          ["add", "--force", "--", "f"],
          ["add", "--", "g"],
          ["check-ignore", "--no-index", "-z", "--stdin"],
          ["check-ignore", "-z", "--stdin"],
          ["stash", "push", "--include-untracked", "--keep-index"],
          ["commit", "--no-gpg-sign", "-m", "m"],
          ["submodule", "foreach", "--quiet", "--recursive", "pwd"],
          ["branch", "--list", "--remotes", "--contains", "abc", "--format=%(HEAD)%00%(refname:short)%00%(objectname)"],
        ]);
        const renames = yield* failure(
          Effect.flatMap(Git, (git) => git.nameStatus(cwd, { base: "a", noRenames: true, findRenames: 50 })),
          () => ok()
        );
        assertRefused(renames.error, "noRenames with findRenames");
        const contains = yield* failure(
          Effect.flatMap(Git, (git) => git.branchList(cwd, { contains: "-x" })),
          () => ok()
        );
        assertRefused(contains.error, "option");
        const unknown = yield* failure(
          Effect.flatMap(Git, (git) => git.branchList(cwd, { contains: "nope" })),
          () => ({ exit: 129, stderr: "error: malformed object name nope; unknown revision" })
        );
        assert.strictEqual(S.is(UnknownRefError)(unknown.error) ? unknown.error.ref : "", "nope");
      })
  );

  it.effect("worktreeAdd creates a branch and refuses one in a detached worktree", () =>
    Effect.gen(function* () {
      const added = yield* run(
        Effect.flatMap(Git, (git) => git.worktreeAdd(cwd, "../lane", { ref: "abc", newBranch: "feat/lane" })),
        () => ok()
      );
      assert.deepStrictEqual(added.seen[0], ["worktree", "add", "-b", "feat/lane", "../lane", "abc"]);
      const detached = yield* failure(
        Effect.flatMap(Git, (git) => git.worktreeAdd(cwd, "../lane", { detach: true, newBranch: "feat/lane" })),
        () => ok()
      );
      assertRefused(detached.error, "detached");
      const optionLike = yield* failure(
        Effect.flatMap(Git, (git) => git.worktreeAdd(cwd, "../lane", { newBranch: "-f" })),
        () => ok()
      );
      assertRefused(optionLike.error, "option");
    })
  );

  it.effect("the test double dispatches the new members data-last too", () =>
    Effect.gen(function* () {
      const double = Git.makeTest({
        revListCount: () => Effect.succeed(2),
        upstream: () => Effect.succeedNone,
        gitDir: (stubCwd) => Effect.succeed(`${stubCwd}/.git`),
        diffPatch: () => Effect.succeed(""),
        add: () => Effect.void,
        checkIgnore: (_cwd, paths) => Effect.succeed(paths),
      });
      assert.strictEqual(yield* pipe(cwd, double.revListCount("a..b")), 2);
      assertNone(yield* pipe(cwd, double.upstream("main")));
      assert.strictEqual(yield* pipe(cwd, double.gitDir()), "/repo/.git");
      assert.strictEqual(yield* pipe(cwd, double.diffPatch({ base: "a" })), "");
      yield* pipe(cwd, double.add(["f"], { force: true }));
      assert.deepStrictEqual(yield* pipe(cwd, double.checkIgnore(["f"], { noIndex: true })), ["f"]);
      assert.isTrue(A.isArray(yield* double.checkIgnore(cwd, [])));
    })
  );
});
