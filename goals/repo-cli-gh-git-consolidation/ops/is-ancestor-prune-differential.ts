/**
 * W0 differential: `Git.isAncestor` and `Git.worktreePrune` against the hand-rolled probes they replace.
 *
 * W0 of `goals/repo-cli-gh-git-consolidation` moves five repo-cli sites onto two new `@beep/git` members:
 *
 * - `merge-base --is-ancestor` probes in `Knowledge/KnowledgeDoctor.service.ts`,
 *   `Quality/internal/ResidueTerminalLaneLive.ts` and `Ci/RouteCensus.ts` onto `Git.isAncestor`;
 * - `worktree prune` (and the `-C <repo> worktree remove --force` beside it) in `internal/repo-run/GitWorktree.ts`
 *   and `internal/repo-run/TmpfsReap.ts` onto `Git.worktreePrune` and `Git.worktreeRemove`.
 *
 * Each pre-W0 body is frozen below as `old*` (from origin/main 186214ce22), running the same git argv through the
 * repo-run capture it used. Every scenario builds a real scratch repository, runs the old body and the kit member on
 * the same state, and compares normalized outcomes. A difference is either classified (an intended divergence named
 * in the SPEC Decision Log, with a witness scenario) or unclassified; the gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/is-ancestor-prune-differential.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

// --- pre-W0 bodies (frozen, behaviour-for-behaviour, from 186214ce22) ------------------------------------------

// The exit-code tri-state every is-ancestor site read: 0 ancestor, 1 not, anything else "other".
const oldIsAncestor = (cwd: string, ancestor: string, descendant: string) =>
  runRepoCommandCapture("git", ["merge-base", "--is-ancestor", ancestor, descendant], cwd).pipe(
    Effect.map((capture) =>
      capture.exitCode === 0 ? "ancestor" : capture.exitCode === 1 ? "not-ancestor" : `other(${capture.exitCode})`
    ),
    Effect.orElseSucceed(() => "spawn-failed")
  );

// ResidueTerminalLaneLive.ancestorOf: any failure is `false`.
const oldAncestorOf = (cwd: string, ancestor: string, descendant: string) =>
  runRepoCommandCapture("git", ["merge-base", "--is-ancestor", ancestor, descendant], cwd).pipe(
    Effect.map((capture) => capture.exitCode === 0),
    Effect.orElseSucceed(() => false)
  );

// GitWorktree.removeGitWorktree's prune half and TmpfsReap's `-C <repo> worktree prune`: exit 0 is success.
const oldPrune = (cwd: string) =>
  runRepoCommandCapture("git", ["worktree", "prune"], cwd).pipe(
    Effect.map((capture) => capture.exitCode === 0),
    Effect.orElseSucceed(() => false)
  );

// TmpfsReap's removal: `git -C <parent> worktree remove --force <path>`, exit 0 is success.
const oldRemove = (parent: string, worktreePath: string) =>
  runRepoCommandCapture("git", ["-C", parent, "worktree", "remove", "--force", worktreePath], parent).pipe(
    Effect.map((capture) => capture.exitCode === 0),
    Effect.orElseSucceed(() => false)
  );

// --- kit members, normalized to the same vocabulary ------------------------------------------------------------

const newIsAncestor = (cwd: string, ancestor: string, descendant: string) =>
  Effect.flatMap(Git, (git) => git.isAncestor(cwd, ancestor, descendant)).pipe(
    Effect.map((answer) => (answer ? "ancestor" : "not-ancestor")),
    Effect.catch((error) =>
      Effect.succeed(
        Match.valueTags(error, {
          UnknownRefError: () => "unknown-object",
          NotARepositoryError: () => "not-a-repository",
          GitCommandError: (failure) => `failed(${failure.exitCode ?? "refused"})`,
        })
      )
    )
  );

const newAncestorOf = (cwd: string, ancestor: string, descendant: string) =>
  Effect.flatMap(Git, (git) => git.isAncestor(cwd, ancestor, descendant)).pipe(Effect.orElseSucceed(() => false));

const newPrune = (cwd: string) => Effect.flatMap(Git, (git) => git.worktreePrune(cwd)).pipe(Effect.isSuccess);

const newRemove = (parent: string, worktreePath: string) =>
  Effect.flatMap(Git, (git) => git.worktreeRemove(parent, worktreePath, { force: true })).pipe(Effect.isSuccess);

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

const commit = Effect.fnUntraced(function* (cwd: string, file: string, message: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(cwd, file), `${message}\n`);
  yield* git(cwd, ["add", "-A"]);
  yield* git(cwd, [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.email=w0@example.com",
    "-c",
    "user.name=W0",
    "commit",
    "-m",
    message,
  ]);
  return yield* git(cwd, ["rev-parse", "HEAD"]);
});

interface Row {
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
}
type Classified = Row & { readonly verdict: string };

// Intended divergences, each recorded in SPEC.md's Decision Log (D-07) with these witness scenarios.
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["isAncestor", "unknown object", "D-07: an unknown object is a typed UnknownRefError, not a bare exit 128"],
  [
    "isAncestor",
    "shallow clone missing history",
    "D-07: an unknown object is a typed UnknownRefError, not a bare exit 128",
  ],
  [
    "isAncestor",
    "outside a repository",
    "D-07: a non-repository cwd is a typed NotARepositoryError, not a bare exit 128",
  ],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w0-differential-" });
  const rows: Array<Row> = [];
  const record = (site: string, scenario: string, oldValue: unknown, newValue: unknown) =>
    Effect.sync(() => {
      rows.push({ site, scenario, old: oldValue, new: newValue });
    });

  const repo = path.join(root, "repo");
  yield* fs.makeDirectory(repo);
  yield* git(repo, ["-c", "init.defaultBranch=main", "init", "--quiet"]);
  const c1 = yield* commit(repo, "a.txt", "c1");
  yield* git(repo, ["branch", "feature"]);
  const c2 = yield* commit(repo, "a.txt", "c2");
  yield* git(repo, ["checkout", "--quiet", "feature"]);
  const f1 = yield* commit(repo, "f.txt", "f1");
  yield* git(repo, ["checkout", "--quiet", "main"]);
  const missing = Str.repeat(40)("0");

  const ancestorCases: ReadonlyArray<readonly [string, string, string, string]> = [
    ["fork point into branch", repo, c1, f1],
    ["fork point into main", repo, c1, "main"],
    ["commit into itself", repo, c2, c2],
    ["branch tip into main", repo, f1, "main"],
    ["main tip into branch", repo, c2, "feature"],
    ["unknown object", repo, missing, "main"],
  ];
  for (const [scenario, cwd, ancestor, descendant] of ancestorCases) {
    yield* record(
      "isAncestor",
      scenario,
      yield* oldIsAncestor(cwd, ancestor, descendant),
      yield* newIsAncestor(cwd, ancestor, descendant)
    );
    yield* record(
      "ancestorOf",
      scenario,
      yield* oldAncestorOf(cwd, ancestor, descendant),
      yield* newAncestorOf(cwd, ancestor, descendant)
    );
  }

  // A shallow clone of main at depth 1: c1 is not in the object store, so citing it is an unknown object.
  const shallow = path.join(root, "shallow");
  yield* git(root, ["clone", "--quiet", "--depth", "1", "--branch", "main", `file://${repo}`, shallow]);
  yield* record(
    "isAncestor",
    "shallow clone missing history",
    yield* oldIsAncestor(shallow, c1, "HEAD"),
    yield* newIsAncestor(shallow, c1, "HEAD")
  );
  yield* record(
    "ancestorOf",
    "shallow clone missing history",
    yield* oldAncestorOf(shallow, c1, "HEAD"),
    yield* newAncestorOf(shallow, c1, "HEAD")
  );

  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);
  yield* record(
    "isAncestor",
    "outside a repository",
    yield* oldIsAncestor(plain, c1, c2),
    yield* newIsAncestor(plain, c1, c2)
  );
  yield* record(
    "ancestorOf",
    "outside a repository",
    yield* oldAncestorOf(plain, c1, c2),
    yield* newAncestorOf(plain, c1, c2)
  );

  // Worktree removal and prune over the same registrations.
  const linkedOld = path.join(root, "linked-old");
  const linkedNew = path.join(root, "linked-new");
  yield* git(repo, ["worktree", "add", "--detach", "--quiet", linkedOld, c1]);
  yield* git(repo, ["worktree", "add", "--detach", "--quiet", linkedNew, c1]);
  yield* record(
    "worktreeRemove",
    "registered linked worktree",
    yield* oldRemove(repo, linkedOld),
    yield* newRemove(repo, linkedNew)
  );
  yield* record(
    "worktreeRemove",
    "path that is not a worktree",
    yield* oldRemove(repo, path.join(root, "nope")),
    yield* newRemove(repo, path.join(root, "nope"))
  );

  const goneOld = path.join(root, "gone-old");
  yield* git(repo, ["worktree", "add", "--detach", "--quiet", goneOld, c1]);
  yield* fs.remove(goneOld, { recursive: true });
  const prunedOld = yield* oldPrune(repo);
  const listAfterOld = yield* git(repo, ["worktree", "list", "--porcelain"]);
  const goneNew = path.join(root, "gone-new");
  yield* git(repo, ["worktree", "add", "--detach", "--quiet", goneNew, c1]);
  yield* fs.remove(goneNew, { recursive: true });
  const prunedNew = yield* newPrune(repo);
  const listAfterNew = yield* git(repo, ["worktree", "list", "--porcelain"]);
  yield* record(
    "worktreePrune",
    "registration whose directory is gone",
    { ok: prunedOld, stillListed: Str.includes("gone-old")(listAfterOld) },
    { ok: prunedNew, stillListed: Str.includes("gone-new")(listAfterNew) }
  );
  yield* record("worktreePrune", "nothing to prune", yield* oldPrune(repo), yield* newPrune(repo));
  yield* record("worktreePrune", "outside a repository", yield* oldPrune(plain), yield* newPrune(plain));

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/is-ancestor-prune-differential.ts",
    commit: yield* git(repoRoot, ["rev-parse", "HEAD"]),
    git: yield* git(repoRoot, ["--version"]),
    scenarios: classified.length,
    same: A.filter(classified, (row) => row.verdict === "same").length,
    classified: A.filter(classified, (row) => row.verdict !== "same" && row.verdict !== "unclassified").length,
    unclassified: unclassified.length,
    gates,
    rows: A.map(classified, (row) => ({
      site: row.site,
      scenario: row.scenario,
      verdict: row.verdict,
      old: Str.replaceAll(root, "<tmp>")(show(row.old)),
      new: Str.replaceAll(root, "<tmp>")(show(row.new)),
    })),
  };
  const json = JSON.stringify(report, null, 2);
  yield* O.match(
    O.flatMap(outFlag, (index) => A.get(argv, index + 1)),
    {
      onNone: () => Console.log(json),
      onSome: (out) => fs.writeFileString(out, `${json}\n`),
    }
  );
  yield* Console.error(`gates: ${JSON.stringify(gates)} (${report.same} same, ${report.classified} classified)`);
  if (!gates.unclassified) process.exitCode = 1;
}).pipe(Effect.scoped);

NodeRuntime.runMain(
  Layer.build(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
