import { Git } from "@beep/git/Git";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  layerYeetHeadMoveClassifierTest,
  YeetHeadMoveClassifier,
  YeetHeadMoveRequest,
  YeetHeadMoveUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

const git = Effect.fn("HeadMoveTest.git")(function* (
  root: string,
  args: ReadonlyArray<string>,
  env?: Record<string, string>
) {
  const result = yield* runRepoCommandCapture("git", args, root, env);
  expect(result.exitCode, result.output).toBe(0);
  return Str.trim(result.output);
});
const PROBE = "explorations/stacked-pr-adoption/research/";
const FILE_A = `${PROBE}stack-probe-a.md`;
const FILE_B = `${PROBE}stack-probe-b.md`;
const fixture = Effect.fn("HeadMoveTest.fixture")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(`./fixtures/yeet-head-move/${name}`, import.meta.url));
  return yield* fs.readFileString(file);
});
const init = Effect.fn("HeadMoveTest.init")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-head-move-" });
  yield* git(root, ["init", "--quiet", "-b", "main"]);
  yield* git(root, ["config", "user.name", "Lane Author"]);
  yield* git(root, ["config", "user.email", "lane@example.invalid"]);
  yield* git(root, ["config", "commit.gpgsign", "false"]);
  return root;
});
// Plumbing keeps every branch as an object, independent of the worktree/index state.
// No mutation here runs against the linked source checkout.
const commit = Effect.fn("HeadMoveTest.commit")(function* (
  root: string,
  parents: ReadonlyArray<string>,
  files: Readonly<Record<string, O.Option<string>>>,
  message: string,
  date = "2026-11-09T20:23:48-06:00",
  email = "lane@example.invalid"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const first = A.head(parents);
  yield* git(root, O.isSome(first) ? ["read-tree", first.value] : ["read-tree", "--empty"]);
  for (const [file, contents] of R.toEntries(files)) {
    if (O.isNone(contents)) {
      yield* git(root, ["update-index", "--force-remove", "--", file]);
      continue;
    }
    const scratch = path.join(root, "blob-input");
    yield* fs.writeFileString(scratch, contents.value);
    const blob = yield* git(root, ["hash-object", "-w", "--", scratch]);
    yield* git(root, ["update-index", "--add", "--cacheinfo", `100644,${blob},${file}`]);
  }
  const tree = yield* git(root, ["write-tree"]);
  return yield* git(root, ["commit-tree", tree, ...A.flatMap(parents, (parent) => ["-p", parent]), "-m", message], {
    GIT_AUTHOR_NAME: "Stack Probe Author",
    GIT_AUTHOR_EMAIL: "stack-probe@users.noreply.github.com",
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME:
      email === "noreply@github.com" ? "GitHub" : email === "lane@example.invalid" ? "Lane Author" : "octocat",
    GIT_COMMITTER_EMAIL: email,
    GIT_COMMITTER_DATE: "2026-11-10T03:00:00Z",
  });
});
const stack = Effect.fn("HeadMoveTest.stack")(function* () {
  const root = yield* init();
  const a = yield* fixture("stack-probe-a.md");
  const b = yield* fixture("stack-probe-b.md");
  const m1 = yield* fixture("layer-1.txt");
  const m2 = yield* fixture("layer-2.txt");
  const m3 = yield* fixture("layer-3.txt");
  const ms = yield* fixture("squash.txt");
  const main = yield* commit(root, [], { "main.md": O.some("main\n") }, "main");
  const l1 = yield* commit(root, [main], { [FILE_A]: O.some(a) }, m1, "2026-11-09T20:23:46-06:00");
  const l2 = yield* commit(root, [l1], { [FILE_B]: O.some(b) }, m2);
  const l3 = yield* commit(root, [l2], { [FILE_A]: O.none(), [FILE_B]: O.none() }, m3, "2026-11-09T20:23:49-06:00");
  const moved = yield* commit(root, [main], { "main.md": O.some("main moved\n") }, "main moving");
  const squash = yield* commit(
    root,
    [moved],
    { [FILE_A]: O.some(a) },
    ms,
    "2026-11-09T21:45:57-05:00",
    "noreply@github.com"
  );
  const c2 = yield* commit(
    root,
    [squash],
    { [FILE_B]: O.some(b) },
    m2,
    undefined,
    "12345+octocat@users.noreply.github.com"
  );
  const c3 = yield* commit(
    root,
    [c2],
    { [FILE_A]: O.none(), [FILE_B]: O.none() },
    m3,
    "2026-11-09T20:23:49-06:00",
    "12345+octocat@users.noreply.github.com"
  );
  const restackBase = yield* commit(root, [squash], { "main.md": O.some("main moved again\n") }, "main moving again");
  const r2 = yield* commit(root, [restackBase], { [FILE_B]: O.some(b) }, m2, undefined, "noreply@github.com");
  const r3 = yield* commit(
    root,
    [r2],
    { [FILE_A]: O.none(), [FILE_B]: O.none() },
    m3,
    "2026-11-09T20:23:49-06:00",
    "noreply@github.com"
  );
  return { root, main, l1, l2, l3, moved, squash, c2, c3, restackBase, r2, r3, a, b, m2, m3 };
});
const classify = Effect.fn("HeadMoveTest.classify")(function* (
  root: string,
  before: string,
  after: string,
  base: string
) {
  const context = yield* Layer.build(YeetHeadMoveClassifier.layer(root));
  const service = Context.get(context, YeetHeadMoveClassifier);
  return yield* service.classify(YeetHeadMoveRequest.make({ before, after, base }));
});
const expectChange = (verdict: Awaited<Effect.Success<ReturnType<typeof classify>>>, change: string) => {
  expect(verdict._tag).toBe("changed");
  if (verdict._tag === "changed") expect(verdict.change, verdict.detail).toBe(change);
};
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "120 seconds" })(
  "head-move real Git",
  (it) => {
    it.effect("carries all six recorded cascade/restack pairs with sanitized identities", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const pairs: ReadonlyArray<readonly [string, string, string]> = [
          [s.l2, s.c2, s.squash],
          [s.c2, s.r2, s.restackBase],
          [s.l2, s.r2, s.restackBase],
          [s.l3, s.c3, s.c2],
          [s.c3, s.r3, s.r2],
          [s.l3, s.r3, s.r2],
        ];
        for (const [before, after, base] of pairs) {
          const result = yield* classify(s.root, before, after, base);
          expect(result, `${before} -> ${after}`).toMatchObject({ _tag: "unchanged", commits: 1 });
        }
      })
    );
    it.effect("rejects stale-base and retarget-before-cascade heads", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const verdict1 = yield* classify(s.root, s.l3, s.c3, s.r2);
        expectChange(verdict1, "base-mismatch");
        const result = yield* classify(s.root, s.l2, s.l2, s.squash);
        expectChange(result, "lane-push");
        const verdict2 = yield* classify(s.root, s.c3, s.l3, s.c2);
        expectChange(verdict2, "base-mismatch");
      })
    );
    it.effect("rejects fast forwards, identical heads and lane-identity rebases", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const verdict3 = yield* classify(s.root, s.l1, s.l2, s.main);
        expectChange(verdict3, "lane-push");
        const verdict4 = yield* classify(s.root, s.l2, s.l2, s.main);
        expectChange(verdict4, "lane-push");
        const lane = yield* commit(s.root, [s.squash], { [FILE_B]: O.some(s.b) }, s.m2);
        const verdict5 = yield* classify(s.root, s.l2, lane, s.squash);
        expectChange(verdict5, "not-github-rewrite");
      })
    );
    it.effect("detects whitespace edits, metadata edits and raw-entry changes", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const whitespace = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(Str.replace("Second", "Second ")(s.b)) },
          s.m2,
          undefined,
          "noreply@github.com"
        );
        const verdict6 = yield* classify(s.root, s.l2, whitespace, s.squash);
        expectChange(verdict6, "patch");
        const date = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(s.b) },
          s.m2,
          "2026-11-09T20:23:50-06:00",
          "noreply@github.com"
        );
        const verdict7 = yield* classify(s.root, s.l2, date, s.squash);
        expectChange(verdict7, "metadata");
        const crossLayer = yield* classify(s.root, s.l2, s.c3, s.c2);
        expectChange(crossLayer, "patch");
        // Also isolate the raw-entry mismatch while holding metadata constant.
        const deletion = yield* commit(
          s.root,
          [s.c2],
          { [FILE_A]: O.none(), [FILE_B]: O.none() },
          s.m2,
          undefined,
          "noreply@github.com"
        );
        const verdict8 = yield* classify(s.root, s.l2, deletion, s.c2);
        expectChange(verdict8, "patch");
      })
    );
    it.effect("drops trailing S32 empty commits and ignores new empty commits", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const oldEmpty = yield* commit(s.root, [s.l2], {}, "chore: re-request beep-reviewer (S32)");
        const newEmpty = yield* commit(s.root, [s.c2], {}, "chore: re-request beep-reviewer (S32)");
        const verdict9 = yield* classify(s.root, oldEmpty, s.c2, s.squash);
        expect(verdict9).toMatchObject({ _tag: "unchanged", commits: 1 });
        const verdict10 = yield* classify(s.root, oldEmpty, newEmpty, s.squash);
        expect(verdict10).toMatchObject({ _tag: "unchanged", commits: 1 });
        const onlyEmpty = yield* commit(s.root, [s.squash], {}, "empty");
        const verdict11 = yield* classify(s.root, s.l2, onlyEmpty, s.squash);
        expectChange(verdict11, "empty-range");
        const verdict12 = yield* classify(s.root, s.l2, s.squash, s.squash);
        expectChange(verdict12, "empty-range");
      })
    );
    it.effect("refuses a dropped lane commit whose old base was not absorbed", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const oldBase = yield* commit(s.root, [s.l1], { "dropped.md": O.some("lost\n") }, "lane commit");
        const before = yield* commit(s.root, [oldBase], { [FILE_B]: O.some(s.b) }, s.m2);
        const verdict13 = yield* classify(s.root, before, s.c2, s.squash);
        expectChange(verdict13, "old-base-not-absorbed");
      })
    );
    it.effect("rejects merges on either side and too-short old tails", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const merge = yield* commit(s.root, [s.c2, s.l2], {}, "merge", undefined, "noreply@github.com");
        const verdict14 = yield* classify(s.root, s.l3, merge, s.squash);
        expectChange(verdict14, "merge-commit");
        const oldMerge = yield* commit(s.root, [s.l2, s.moved], {}, s.m2);
        const verdict15 = yield* classify(s.root, oldMerge, s.c2, s.squash);
        expectChange(verdict15, "merge-commit");
        const extra = yield* commit(
          s.root,
          [s.c2],
          { "extra.md": O.some("extra\n") },
          "extra",
          undefined,
          "noreply@github.com"
        );
        const orphan = yield* commit(s.root, [], { "orphan.md": O.some("orphan\n") }, "orphan");
        const verdict16 = yield* classify(s.root, orphan, extra, s.squash);
        expectChange(verdict16, "commit-count");
      })
    );
    it.effect("catches relocated identical hunks with exact replay-tree equality", () =>
      Effect.gen(function* () {
        const root = yield* init();
        // Repeated context makes the normalized per-path patches equal at two distinct locations.
        const block = "before-one\nbefore-two\nbefore-three\nold\nafter-one\nafter-two\nafter-three\n";
        const base = yield* commit(root, [], { "repeat.txt": O.some(`${block}separator\n${block}`) }, "base");
        const before = yield* commit(
          root,
          [base],
          { "repeat.txt": O.some(`${Str.replace("old", "new")(block)}separator\n${block}`) },
          "edit"
        );
        const moved = yield* commit(root, [base], { "main.txt": O.some("advance\n") }, "main");
        const after = yield* commit(
          root,
          [moved],
          { "repeat.txt": O.some(`${block}separator\n${Str.replace("old", "new")(block)}`) },
          "edit",
          undefined,
          "noreply@github.com"
        );
        const verdict17 = yield* classify(root, before, after, moved);
        expectChange(verdict17, "replay-tree");
      })
    );
    it.effect("fetches missing pinned objects once without replacing FETCH_HEAD", () =>
      Effect.gen(function* () {
        const remote = yield* stack();
        yield* git(remote.root, ["update-ref", "refs/heads/probe", remote.c2]);
        const local = yield* init();
        yield* git(local, ["remote", "add", "origin", remote.root]);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fetchHead = path.join(local, ".git", "FETCH_HEAD");
        yield* fs.writeFileString(fetchHead, "preserve concurrent reader\n");
        const verdict = yield* classify(local, remote.l2, remote.c2, remote.squash);
        expect(verdict).toMatchObject({ _tag: "unchanged", commits: 1 });
        const preserved = yield* fs.readFileString(fetchHead);
        expect(preserved).toBe("preserve concurrent reader\n");
      })
    );
    it.effect("returns unknown when a missing object cannot be fetched from origin", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const result = yield* classify(s.root, Str.repeat(40)("0"), s.c2, s.squash);
        expect(result._tag).toBe("unknown");
      })
    );
    it.effect("provides a requirement-free deterministic test service", () =>
      Effect.gen(function* () {
        const request = YeetHeadMoveRequest.make({ before: "b", after: "a", base: "s" });
        const context = yield* Layer.build(
          layerYeetHeadMoveClassifierTest((input) => YeetHeadMoveUnknown.make({ ...input, reason: "fixture" }))
        );
        const result = yield* Context.get(context, YeetHeadMoveClassifier).classify(request);
        expect(result._tag).toBe("unknown");
      })
    );
  }
);
