// The targeted path-removal read: the pure commit selection, the per-commit resolution cache, the
// unavailable-history paths, and a real repository where the targeted read must attribute every
// removed path and directory exactly as the whole-history rename-detecting walk does.

import { CommitLogEntry, Git, NameStatusEntry } from "@beep/git/Git";
import {
  groupKnowledgeDoctorFindings,
  KNOWLEDGE_PATH_REMOVAL_LOG,
  KNOWLEDGE_REMOVAL_WALK_LOG,
  KnowledgeDoctorFinding,
  KnowledgeFinding,
  KnowledgePathRemovalQuery,
  knowledgePathRemovalsFromLog,
  knowledgeRemovalCommitsFromLog,
  knowledgeRemovalTargets,
  knowledgeRemovedPackageNames,
  makeKnowledgeDoctorMemoryTree,
  makeKnowledgeLivePathRemovals,
  makeKnowledgePathRemovalReader,
  scanKnowledgeDoctorTree,
  selectKnowledgeRemovalCommits,
} from "@beep/repo-cli/commands/Knowledge";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import type { KnowledgeCommitSha, KnowledgePathRemoval } from "@beep/repo-cli/commands/Knowledge";
import type * as ChildProcess from "effect/process/ChildProcess";

const NEWEST = "3333333333333333333333333333333333333333";
const MIDDLE = "2222222222222222222222222222222222222222";
const OLDEST = "1111111111111111111111111111111111111111";
const LOGGED_AT = DateTime.makeUnsafe("2026-11-09T00:00:00Z");

const walkEntry = (sha: string, paths: ReadonlyArray<string>) =>
  CommitLogEntry.make({
    sha,
    authoredAt: LOGGED_AT,
    committedAt: LOGGED_AT,
    authorName: "Fixture",
    authorEmail: "fixture@example.invalid",
    subject: `remove ${Str.slice(0, 4)(sha)}`,
    paths,
  });

const HISTORY = knowledgeRemovalCommitsFromLog([
  walkEntry(NEWEST, ["docs/guide/a.md", "packages/x/package.json"]),
  walkEntry("abc", ["docs/skipped.md"]),
  walkEntry(MIDDLE, ["docs/guide/b.md", "docs/other.md"]),
  walkEntry(OLDEST, ["docs/other.md", "packages/y/package.json"]),
]);

const query = (targets: ReadonlyArray<string>) =>
  KnowledgePathRemovalQuery.make({ targets: HashSet.fromIterable(targets) });

// The rename-detecting removals each fixture commit resolves to.
const RESOLVED: ReadonlyArray<KnowledgePathRemoval> = knowledgePathRemovalsFromLog(
  A.map(HISTORY, (commit) =>
    CommitLogEntry.make({
      ...walkEntry(commit.commit, commit.paths),
      changes: A.map(commit.paths, (path) => NameStatusEntry.make({ status: "deleted", path })),
    })
  )
);

const pipeSelect = (removalQuery: KnowledgePathRemovalQuery) => selectKnowledgeRemovalCommits(removalQuery)(HISTORY);

describe("knowledge doctor removal commit selection", () => {
  it("skips walk entries without a full commit id", () => {
    assert.deepStrictEqual(
      A.map(HISTORY, (commit) => commit.commit),
      [NEWEST, MIDDLE, OLDEST]
    );
  });

  it("selects the newest commit removing each target or a path under it, in walk order", () => {
    assert.deepStrictEqual(selectKnowledgeRemovalCommits(HISTORY, query(["docs/guide", "docs/other.md"])), [
      NEWEST,
      MIDDLE,
    ]);
    assert.deepStrictEqual(selectKnowledgeRemovalCommits(HISTORY, query(["docs"])), [NEWEST]);
    assert.deepStrictEqual(selectKnowledgeRemovalCommits(HISTORY, query(["docs/guide/b.md"])), [MIDDLE]);
    assert.deepStrictEqual(selectKnowledgeRemovalCommits(HISTORY, query(["docs/gui", "docs/guide/", "nope"])), []);
    assert.deepStrictEqual(selectKnowledgeRemovalCommits(HISTORY, query([])), []);
  });

  it("stops at the commit that claims the last target", () => {
    assert.deepStrictEqual(pipeSelect(query(["docs/other.md"])), [MIDDLE]);
    assert.deepStrictEqual(pipeSelect(query(["packages", "docs/other.md"])), [NEWEST, MIDDLE]);
  });
});

describe("knowledge doctor removal reader", () => {
  const recordingReader = Effect.fnUntraced(function* (failFirst: boolean) {
    const calls = yield* Ref.make(A.empty<ReadonlyArray<KnowledgeCommitSha>>());
    const reader = makeKnowledgePathRemovalReader(Effect.succeedSome(HISTORY), (commits) =>
      Ref.updateAndGet(calls, A.append(commits)).pipe(
        Effect.map((seen) =>
          failFirst && A.length(seen) === 1
            ? O.none()
            : O.some(A.filter(RESOLVED, (removal) => A.contains(commits, removal.commit)))
        )
      )
    );
    return { calls, read: reader.pathRemovals, removedPaths: reader.removedPaths } as const;
  });

  it.effect(
    "resolves only commits no earlier query resolved and returns them in walk order",
    Effect.fnUntraced(function* () {
      const { calls, read } = yield* recordingReader(false);
      const first = yield* read(query(["docs/guide"]));
      assert.deepStrictEqual(
        A.map(O.getOrElse(first, A.empty), (removal) => removal.path),
        ["docs/guide/a.md", "packages/x/package.json"]
      );
      const second = yield* read(query(["docs/guide", "docs/other.md"]));
      assert.deepStrictEqual(
        A.map(O.getOrElse(second, A.empty), (removal) => [removal.commit, removal.path] as const),
        [
          [NEWEST, "docs/guide/a.md"],
          [NEWEST, "packages/x/package.json"],
          [MIDDLE, "docs/guide/b.md"],
          [MIDDLE, "docs/other.md"],
        ]
      );
      yield* read(query(["docs/other.md"]));
      yield* read(query([]));
      const seen = yield* Ref.get(calls);
      assert.deepStrictEqual(seen, [[NEWEST], [MIDDLE]]);
    })
  );

  it.effect(
    "rebuilds walk order when an older commit was resolved before a newer one",
    Effect.fnUntraced(function* () {
      const { read } = yield* recordingReader(false);
      // MIDDLE is cached first; the next query also selects the newer NEWEST.
      yield* read(query(["docs/other.md"]));
      const both = yield* read(query(["docs/guide", "docs/other.md"]));
      assert.deepStrictEqual(
        A.map(O.getOrElse(both, A.empty), (removal) => removal.commit),
        [NEWEST, NEWEST, MIDDLE, MIDDLE]
      );
      // The removal index files `docs/guide` under its first removal, which must be the newest.
      assert.strictEqual(
        O.getOrUndefined(
          A.findFirst(O.getOrElse(both, A.empty), (removal) => Str.startsWith("docs/guide/")(removal.path))
        )?.commit,
        NEWEST
      );
    })
  );

  it.effect(
    "reads every removed path of the walk without resolving a commit",
    Effect.fnUntraced(function* () {
      const { calls, removedPaths } = yield* recordingReader(false);
      const paths = yield* removedPaths;
      assert.deepStrictEqual(paths, O.some(A.flatMap(HISTORY, (commit) => commit.paths)));
      assert.deepStrictEqual(
        knowledgeRemovedPackageNames(O.getOrElse(paths, A.empty)),
        HashSet.make("x", "packages-x", "y", "packages-y")
      );
      const seen = yield* Ref.get(calls);
      assert.deepStrictEqual(seen, []);
    })
  );

  it.effect(
    "is none without history and never resolves a commit",
    Effect.fnUntraced(function* () {
      const calls = yield* Ref.make(0);
      const reader = makeKnowledgePathRemovalReader(Effect.succeedNone, () =>
        Ref.update(calls, (count) => count + 1).pipe(Effect.as(O.some(RESOLVED)))
      );
      const removals = yield* reader.pathRemovals(query(["docs/guide"]));
      assertNone(removals);
      const paths = yield* reader.removedPaths;
      assertNone(paths);
      const count = yield* Ref.get(calls);
      assert.strictEqual(count, 0);
    })
  );

  it.effect(
    "latches a failed resolution so every later read of the tree is none and spawns nothing",
    Effect.fnUntraced(function* () {
      const { calls, read, removedPaths } = yield* recordingReader(true);
      const before = yield* removedPaths;
      assert.strictEqual(O.isSome(before), true);
      const failed = yield* read(query(["docs/guide"]));
      assertNone(failed);
      // The scan's read failed: the check's identical read and the mint's paths must agree with it.
      const again = yield* read(query(["docs/guide"]));
      assertNone(again);
      const other = yield* read(query(["docs/other.md"]));
      assertNone(other);
      const after = yield* removedPaths;
      assertNone(after);
      const seen = yield* Ref.get(calls);
      assert.deepStrictEqual(seen, [[NEWEST]]);
    })
  );

  it.effect(
    "lets a memory tree return its configured removals whatever the query",
    Effect.fnUntraced(function* () {
      const tree = makeKnowledgeDoctorMemoryTree({ files: {}, pathRemovals: O.some(RESOLVED) });
      const removals = yield* tree.pathRemovals(query([]));
      assert.deepStrictEqual(removals, O.some(RESOLVED));
      const paths = yield* tree.removedPaths;
      assert.deepStrictEqual(paths, O.some(A.map(RESOLVED, (removal) => removal.path)));
    })
  );
});

// A real repository whose history holds an exact rename, an inexact rename, a plain delete, a
// directory move, a delete beside an unrelated add, a merge, a path deleted, re-added and deleted
// again, and a deleted package manifest.
const runGit = (cwd: string, args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Removals",
      GIT_AUTHOR_EMAIL: "removals@example.invalid",
      GIT_COMMITTER_NAME: "Removals",
      GIT_COMMITTER_EMAIL: "removals@example.invalid",
    },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
  }
  return Str.trim(result.stdout.toString());
};

const lines = (label: string, count: number): string =>
  A.join(
    A.makeBy(count, (index) => `${label} line ${index} with enough text to be similar`),
    "\n"
  );

const buildHistory = Effect.fnUntraced(function* (repo: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const write = (file: string, text: string) =>
    fs
      .makeDirectory(path.dirname(path.join(repo, file)), { recursive: true })
      .pipe(Effect.andThen(fs.writeFileString(path.join(repo, file), text)));
  const commit = (message: string) => Effect.sync(() => runGit(repo, ["commit", "--quiet", "-m", message]));
  const git = (...args: ReadonlyArray<string>) => Effect.sync(() => runGit(repo, args));
  yield* git("-c", "init.defaultBranch=main", "init", "--quiet");
  yield* write("docs/exact.md", lines("exact", 20));
  yield* write("docs/edited.md", lines("edited", 20));
  yield* write("docs/guide/x.md", lines("guide x", 10));
  yield* write("docs/guide/y.md", lines("guide y", 10));
  yield* write("docs/plain.md", lines("plain", 5));
  yield* write("docs/swap.md", lines("swap", 5));
  yield* write("tmp/again.md", lines("again", 5));
  yield* write("packages/one/package.json", '{ "name": "@fixture/one" }\n');
  yield* write("packages/one/src/index.ts", lines("index", 5));
  yield* git("add", "-A");
  yield* commit("seed");
  yield* git("mv", "docs/exact.md", "docs/exact-renamed.md");
  yield* commit("exact rename");
  yield* git("rm", "--quiet", "docs/edited.md");
  yield* write("notes/edited.md", `${lines("edited", 18)}\nan edited line\n`);
  yield* git("add", "-A");
  yield* commit("inexact rename");
  yield* git("rm", "--quiet", "docs/plain.md");
  yield* commit("plain delete");
  yield* git("rm", "--quiet", "tmp/again.md");
  yield* commit("first delete");
  yield* write("tmp/again.md", lines("different", 7));
  yield* git("add", "-A");
  yield* commit("re-add");
  yield* git("mv", "docs/guide", "guide");
  yield* commit("directory move");
  yield* git("rm", "--quiet", "docs/swap.md");
  yield* write("other/unrelated.md", "nothing alike\n");
  yield* git("add", "-A");
  yield* commit("delete beside an unrelated add");
  yield* git("checkout", "--quiet", "-b", "side");
  yield* git("rm", "--quiet", "-r", "packages/one");
  yield* commit("retire the package");
  yield* git("checkout", "--quiet", "main");
  yield* git("rm", "--quiet", "tmp/again.md");
  yield* commit("second delete");
  yield* git("merge", "--quiet", "--no-ff", "-m", "merge side", "side");
  yield* git("rm", "--quiet", "guide/x.md");
  yield* commit("delete under the moved directory");
  return runGit(repo, ["rev-parse", "HEAD"]);
});

const prefixesOf = (path: string): ReadonlyArray<string> =>
  A.drop(
    A.scan(Str.split("/")(path), "", (prefix, segment) => (Str.isEmpty(prefix) ? segment : `${prefix}/${segment}`)),
    1
  );

const findingsFor = Effect.fnUntraced(function* (targets: ReadonlyArray<string>) {
  const report = yield* scanKnowledgeDoctorTree(
    makeKnowledgeDoctorMemoryTree({ files: { "docs/cite.md": "See `docs/gone.md`." } })
  );
  const template = yield* Effect.fromOption(A.head(report.findings));
  return A.map(targets, (target, index) =>
    KnowledgeDoctorFinding.make({
      ...template,
      causeKey: `path:${target}`,
      finding: KnowledgeFinding.make({
        ...template.finding,
        findingId: `knowledge-finding/v1:${Str.padStart(64, "0")(`${index}`)}`,
      }),
    })
  );
});

layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, Git.layer.pipe(Layer.provide(NodeServices.layer))), {
  timeout: "60 seconds",
})("knowledge doctor removals over a real repository", (it) => {
  it.effect(
    "attributes every removed path and directory as the whole-history walk does, from fewer commits",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const git = yield* Git;
      const repo = yield* fs.makeTempDirectoryScoped({ prefix: "beep-knowledge-removals-" });
      const head = yield* buildHistory(repo);
      const fullLog = yield* git.log(repo, { ...KNOWLEDGE_PATH_REMOVAL_LOG, revisions: [head] });
      const full = knowledgePathRemovalsFromLog(fullLog);
      const walkLog = yield* git.log(repo, { ...KNOWLEDGE_REMOVAL_WALK_LOG, revisions: [head] });
      const walk = knowledgeRemovalCommitsFromLog(walkLog);
      // The selection premise: per commit, the tree-only walk removes the same paths in the same order.
      assert.deepStrictEqual(
        A.map(walk, (commit) => [commit.commit, A.sort(commit.paths, Order.String)] as const),
        A.map(
          A.dedupe(A.map(full, (removal) => removal.commit)),
          (commit) =>
            [
              commit,
              A.sort(
                A.map(
                  A.filter(full, (removal) => removal.commit === commit),
                  (removal) => removal.path
                ),
                Order.String
              ),
            ] as const
        )
      );
      assertTrue(A.some(full, (removal) => removal.path === "docs/edited.md" && removal.change === "renamed"));
      const targets = A.appendAll(
        A.fromIterable(HashSet.fromIterable(A.flatMap(full, (removal) => prefixesOf(removal.path)))),
        ["never/removed.md", "docs/gui"]
      );
      const findings = yield* findingsFor(targets);
      const read = yield* makeKnowledgeLivePathRemovals(repo, head);
      const targeted = yield* read.pathRemovals(
        KnowledgePathRemovalQuery.make({ targets: knowledgeRemovalTargets(findings) })
      );
      assert.deepStrictEqual(
        groupKnowledgeDoctorFindings(findings, targeted),
        groupKnowledgeDoctorFindings(findings, O.some(full))
      );
      assertTrue(
        A.some(groupKnowledgeDoctorFindings(findings, targeted), (group) =>
          O.exists(group.attribution, (attribution) => attribution.change === "renamed")
        )
      );
      // Each target alone, through one shared reader: its own commits resolve and earlier queries'
      // cached commits never leak into its attribution.
      const single = yield* makeKnowledgeLivePathRemovals(repo, head);
      for (const finding of findings) {
        const alone = yield* single.pathRemovals(
          KnowledgePathRemovalQuery.make({ targets: knowledgeRemovalTargets([finding]) })
        );
        assert.deepStrictEqual(
          groupKnowledgeDoctorFindings([finding], alone),
          groupKnowledgeDoctorFindings([finding], O.some(full)),
          finding.causeKey
        );
      }
      const fewer = A.dedupe(A.map(O.getOrElse(targeted, A.empty), (removal) => removal.commit));
      assertTrue(A.length(fewer) < A.length(walk));
      const removedPaths = yield* read.removedPaths;
      const fullPaths = A.map(full, (removal) => removal.path);
      assert.deepStrictEqual(
        knowledgeRemovedPackageNames(O.getOrElse(removedPaths, A.empty)),
        knowledgeRemovedPackageNames(fullPaths)
      );
      assertTrue(HashSet.has(knowledgeRemovedPackageNames(fullPaths), "one"));
    })
  );

  it.effect(
    "is none in a shallow clone and for a walk git cannot start",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* fs.makeTempDirectoryScoped({ prefix: "beep-knowledge-removals-full-" });
      const head = yield* buildHistory(repo);
      const shallow = path.join(repo, "shallow");
      yield* Effect.sync(() => runGit(repo, ["clone", "--quiet", "--depth", "1", `file://${repo}`, shallow]));
      const fromShallow = yield* makeKnowledgeLivePathRemovals(shallow, head);
      const shallowRemovals = yield* fromShallow.pathRemovals(query(["docs"]));
      assertNone(shallowRemovals);
      const shallowPaths = yield* fromShallow.removedPaths;
      assertNone(shallowPaths);
      const unknown = yield* makeKnowledgeLivePathRemovals(repo, "0000000000000000000000000000000000000000");
      const unknownRemovals = yield* unknown.pathRemovals(query(["docs"]));
      assertNone(unknownRemovals);
      const unknownPaths = yield* unknown.removedPaths;
      assertNone(unknownPaths);
    })
  );

  it.effect(
    "walks the history once per reader and resolves only the selected commits without walking",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const git = yield* Git;
      const repo = yield* fs.makeTempDirectoryScoped({ prefix: "beep-knowledge-removals-spawns-" });
      const head = yield* buildHistory(repo);
      const walkLog = yield* git.log(repo, { ...KNOWLEDGE_REMOVAL_WALK_LOG, revisions: [head] });
      const walk = knowledgeRemovalCommitsFromLog(walkLog);
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const spawned = yield* Ref.make(A.empty<ReadonlyArray<string>>());
      // Own double: decorates the real platform spawner (the walk needs real git), recording each argv.
      const recording = ChildProcessSpawner.make((command) =>
        Ref.update(spawned, A.append(commandArgs(command))).pipe(Effect.andThen(spawner.spawn(command)))
      );
      const reader = yield* makeKnowledgeLivePathRemovals(repo, head).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recording)
      );
      const first = query(["docs/plain.md"]);
      const second = query(["docs/plain.md", "tmp/again.md"]);
      yield* reader.removedPaths;
      yield* reader.pathRemovals(first);
      yield* reader.pathRemovals(second);
      yield* reader.removedPaths;
      const allSpawned = yield* Ref.get(spawned);
      const logs = A.filter(allSpawned, A.contains("log"));
      // One tree-only walk for the whole reader, however many reads.
      assert.strictEqual(A.length(A.filter(logs, A.contains("--no-renames"))), 1);
      const firstCommits = selectKnowledgeRemovalCommits(walk, first);
      const newCommits = A.difference(selectKnowledgeRemovalCommits(walk, second), firstCommits);
      assert.deepStrictEqual(
        A.map(A.filter(logs, A.contains("--find-renames=50%")), (args) => [
          A.contains(args, "--no-walk=unsorted"),
          revisionArgs(args),
        ]),
        [
          [true, firstCommits],
          [true, newCommits],
        ]
      );
    })
  );
});

// The argv of a spawned command; redacted words never occur in these git reads.
const commandArgs = (command: ChildProcess.Command): ReadonlyArray<string> =>
  command._tag === "StandardCommand" ? A.filter(command.args, P.isString) : A.empty();

// The revisions a `Git.log` argv names between `--end-of-options` and `--`.
const revisionArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.takeWhile(
    A.drop(
      A.dropWhile(args, (arg) => arg !== "--end-of-options"),
      1
    ),
    (arg) => arg !== "--"
  );
