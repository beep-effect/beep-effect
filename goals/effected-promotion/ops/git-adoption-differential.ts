/**
 * Git adoption differential (roadmap PR R10, W4-l).
 *
 * R10 moves three repo-cli sites onto `@beep/git`:
 *
 * - `Skills/internal/MergeBase.ts` `readAtMergeBase`: `Git.mergeBase` + `Git.show`;
 * - `internal/repo-run/GitWorktree.ts` `isRegisteredWorktree` / `removeGitWorktree`: `Git.worktreeList` +
 *   `Git.worktreeRemove` (the `worktree prune` call stays a repo-run capture);
 * - `Yeet/internal/ProvenanceFooter.ts` `detectPrRepository` and the `beep.provenance.labels` read: `Git.configGet`.
 *
 * Each pre-R10 body is frozen below as `old*` (from origin/main 35faa4a00d), running the same git argv through
 * the repo-run executors it used. Every scenario builds a real scratch repository, runs the old body and the
 * shipped one on the same state, and compares normalized outcomes. A difference is either classified (an intended
 * divergence named in the R10 SPEC row, with a witness scenario) or unclassified; the gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/git-adoption-differential.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { readAtMergeBase } from "../../../packages/tooling/tool/cli/src/commands/Skills/internal/MergeBase.ts";
import {
  detectPrRepository,
  readProvenanceLabels,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ProvenanceFooter.ts";
import { runCapturedStreams } from "../../../packages/tooling/tool/cli/src/internal/process/StepExec.ts";
import {
  isRegisteredWorktree,
  removeGitWorktree,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitWorktree.ts";
import {
  runRepoCommandCapture,
  runRepoCommandCaptureRaw,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

// --- pre-R10 bodies (frozen, behaviour-for-behaviour, from 35faa4a00d) ----------------------------------------

const oldReadAtMergeBase = Effect.fnUntraced(function* (cwd: string, baseRef: string, path: string) {
  const mergeBase = yield* runCapturedStreams({
    command: "git",
    args: ["merge-base", "HEAD", baseRef],
    cwd,
    extendEnv: true,
  });
  if (mergeBase.exitCode !== 0) return { _tag: "error" as const };
  const base = Str.trim(mergeBase.stdout);
  const shown = yield* runCapturedStreams({ command: "git", args: ["show", `${base}:${path}`], cwd, extendEnv: true });
  return { _tag: "ok" as const, base, text: shown.exitCode === 0 ? O.some(shown.stdout) : O.none<string>() };
});

const oldIsRegisteredWorktree = Effect.fnUntraced(function* (cwd: string, worktreePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = (candidate: string) =>
    fs.realPath(candidate).pipe(Effect.option, Effect.map(O.getOrElse(() => path.resolve(candidate))));
  const capture = yield* runRepoCommandCaptureRaw("git", ["worktree", "list", "--porcelain", "-z"], cwd).pipe(
    Effect.option
  );
  if (O.isNone(capture) || capture.value.exitCode !== 0 || capture.value.truncated) return O.none<boolean>();
  const target = yield* resolved(worktreePath);
  const records = A.filter(Str.split(capture.value.output, "\0"), Str.startsWith("worktree "));
  const listed = yield* Effect.forEach(records, (record) => resolved(Str.slice(9)(record)));
  return O.some(A.contains(listed, target));
});

const oldRemoveGitWorktree = Effect.fnUntraced(function* (cwd: string, worktreePath: string) {
  const removed = yield* runRepoCommandCapture("git", ["worktree", "remove", "--force", worktreePath], cwd).pipe(
    Effect.option
  );
  yield* runRepoCommandCapture("git", ["worktree", "prune"], cwd).pipe(Effect.ignore);
  return O.exists(removed, (capture) => capture.exitCode === 0);
});

const repositoryPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u;

const oldConfigGet = Effect.fnUntraced(function* (cwd: string, key: string) {
  const capture = yield* runRepoCommandCapture("git", ["config", "--get", key], cwd).pipe(Effect.option);
  if (O.isNone(capture)) return { _tag: "error" as const, detail: "spawn" };
  if (capture.value.exitCode !== 0) return { _tag: "error" as const, detail: `exit ${capture.value.exitCode}` };
  return { _tag: "ok" as const, value: Str.trim(capture.value.output) };
});

const oldDetectRepository = Effect.fnUntraced(function* (cwd: string) {
  const origin = yield* oldConfigGet(cwd, "remote.origin.url");
  // A spawn failure and a non-exit-1 failure both surface as a typed git failure on either side; only the
  // exit-1 "unset" answer keeps its detail, because that is where the two bodies part ways.
  if (origin._tag === "error") {
    return origin.detail === "exit 1" ? "error: git config failed (exit 1)" : "error: git config failed";
  }
  const match = Str.match(repositoryPattern)(origin.value);
  if (O.isNone(match) || match.value[1] === undefined || match.value[2] === undefined) {
    return "error: Expected a github.com origin URL.";
  }
  return `github.com/${Str.toLowerCase(match.value[1])}/${Str.toLowerCase(match.value[2])}`;
});

const oldLabels = (cwd: string) =>
  oldConfigGet(cwd, "beep.provenance.labels").pipe(Effect.map((read) => read._tag === "error" || read.value !== "off"));

// --- new bodies, normalized ------------------------------------------------------------------------------------

const newReadAtMergeBase = (cwd: string, baseRef: string, path: string) =>
  readAtMergeBase(cwd, baseRef, path, "the differential").pipe(
    Effect.map((read) => ({ _tag: "ok" as const, base: read.base, text: read.text })),
    Effect.orElseSucceed(() => ({ _tag: "error" as const }))
  );

const newDetectRepository = (cwd: string) =>
  detectPrRepository(cwd).pipe(
    Effect.map((repository) => `${repository.host}/${repository.owner}/${repository.name}`),
    Effect.catch((error) =>
      Effect.succeed(
        error.message === "Expected a github.com origin URL." ? `error: ${error.message}` : "error: git config failed"
      )
    )
  );

const newLabels = readProvenanceLabels;

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return result.output;
});

const write = Effect.fnUntraced(function* (file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, text);
});

const makeRepository = Effect.fnUntraced(function* (root: string, name: string) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const cwd = path.join(root, name);
  yield* fs.makeDirectory(cwd, { recursive: true });
  yield* git(cwd, ["init", "--quiet", "-b", "main"]);
  yield* git(cwd, ["config", "user.email", "differential@example.invalid"]);
  yield* git(cwd, ["config", "user.name", "Differential"]);
  yield* git(cwd, ["config", "commit.gpgsign", "false"]);
  yield* fs.makeDirectory(path.join(cwd, "dir with space"), { recursive: true });
  yield* write(path.join(cwd, "OWNERS"), "* @base\n");
  yield* write(path.join(cwd, "no-newline.txt"), "  padded text without newline  ");
  yield* write(path.join(cwd, "dir with space", "file name.md"), "unicode: ünïcödé ✓\n");
  yield* write(path.join(cwd, "large.txt"), Str.repeat("0123456789abcdef\n", 65_536));
  yield* git(cwd, ["add", "."]);
  yield* git(cwd, ["commit", "--quiet", "-m", "base"]);
  yield* git(cwd, ["switch", "--quiet", "-c", "feature"]);
  yield* write(path.join(cwd, "OWNERS"), "* @self\n");
  yield* git(cwd, ["commit", "--quiet", "-am", "feature"]);
  return cwd;
});

type Row = { readonly site: string; readonly scenario: string; readonly old: unknown; readonly new: unknown };
type Classified = Row & { readonly verdict: "same" | string };

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (O.isOption(v) ? (O.isSome(v) ? { some: v.value } : "none") : v));

// Intended divergences, each keyed by site and scenario; anything else that differs is unclassified.
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  [
    "removeGitWorktree",
    "option-like path",
    "option-refused: Git.worktreeRemove refuses an option-like path before spawning (old handed it to git)",
  ],
  [
    "detectPrRepository",
    "no origin",
    "message-only: an unset remote.origin.url is the github-origin refusal, not a git exit-1 failure",
  ],
  [
    "readAtMergeBase",
    "unreadable object at the merge-base",
    "fail-closed: a show failure other than absent-at-ref is a typed SkillsCommandError (old answered None)",
  ],
];

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "git-adoption-differential-" });
  const cwd = yield* makeRepository(root, "repo");
  const rows: Array<Row> = [];
  const record = (site: string, scenario: string, old: unknown, next: unknown) =>
    Effect.sync(() => rows.push({ site, scenario, old, new: next }));

  // readAtMergeBase
  const mergeBaseCases: ReadonlyArray<readonly [string, string, string, string]> = [
    ["present file", cwd, "main", "OWNERS"],
    ["absent file", cwd, "main", "MISSING.md"],
    ["directory path", cwd, "main", "dir with space"],
    ["path with spaces and unicode", cwd, "main", "dir with space/file name.md"],
    ["untrimmed content without newline", cwd, "main", "no-newline.txt"],
    ["1 MiB file", cwd, "main", "large.txt"],
    ["unknown base ref", cwd, "origin/absent", "OWNERS"],
    ["not a repository", root, "main", "OWNERS"],
  ];
  for (const [scenario, at, base, file] of mergeBaseCases) {
    yield* record(
      "readAtMergeBase",
      scenario,
      yield* oldReadAtMergeBase(at, base, file),
      yield* newReadAtMergeBase(at, base, file)
    );
  }
  const island = yield* makeRepository(root, "island");
  yield* git(island, ["switch", "--quiet", "--orphan", "orphan"]);
  yield* write(path.join(island, "OWNERS"), "* @orphan\n");
  yield* git(island, ["add", "OWNERS"]);
  yield* git(island, ["commit", "--quiet", "-m", "orphan"]);
  yield* record(
    "readAtMergeBase",
    "disjoint histories",
    yield* oldReadAtMergeBase(island, "main", "OWNERS"),
    yield* newReadAtMergeBase(island, "main", "OWNERS")
  );

  // A file the merge-base carries whose blob is gone from the object store: `git show` exits 128 with
  // "bad object", which is not the absent-at-ref answer.
  const corrupt = yield* makeRepository(root, "corrupt");
  const blob = Str.trim(yield* git(corrupt, ["rev-parse", "main:OWNERS"]));
  yield* fs.remove(path.join(corrupt, ".git", "objects", Str.slice(0, 2)(blob), Str.slice(2)(blob)));
  yield* record(
    "readAtMergeBase",
    "unreadable object at the merge-base",
    yield* oldReadAtMergeBase(corrupt, "main", "OWNERS"),
    yield* newReadAtMergeBase(corrupt, "main", "OWNERS")
  );

  // isRegisteredWorktree
  const linked = path.join(root, "linked with space");
  const newline = path.join(root, "linked\nnewline");
  const locked = path.join(root, "locked");
  const prunable = path.join(root, "prunable");
  const alias = path.join(root, "alias");
  const plain = path.join(root, "plain");
  yield* git(cwd, ["worktree", "add", "--quiet", "--detach", linked]);
  yield* git(cwd, ["worktree", "add", "--quiet", "-b", "nl", newline]);
  yield* git(cwd, ["worktree", "add", "--quiet", "--detach", locked]);
  yield* git(cwd, ["worktree", "lock", "--reason", "held by the differential", locked]);
  yield* git(cwd, ["worktree", "add", "--quiet", "--detach", prunable]);
  yield* fs.remove(prunable, { recursive: true, force: true });
  yield* fs.symlink(linked, alias);
  yield* fs.makeDirectory(plain);
  const worktreeCases: ReadonlyArray<readonly [string, string, string]> = [
    ["main worktree", cwd, cwd],
    ["linked with space", cwd, linked],
    ["path with newline", cwd, newline],
    ["locked worktree", cwd, locked],
    ["prunable worktree", cwd, prunable],
    ["symlinked alias", cwd, alias],
    ["plain directory", cwd, plain],
    ["missing directory", cwd, path.join(root, "missing")],
    ["not a repository", plain, plain],
  ];
  for (const [scenario, at, target] of worktreeCases) {
    yield* record(
      "isRegisteredWorktree",
      scenario,
      yield* oldIsRegisteredWorktree(at, target),
      yield* isRegisteredWorktree(at, target)
    );
  }

  // removeGitWorktree: each side removes its own copy of the same state.
  const dirtyPair = (suffix: string) =>
    Effect.gen(function* () {
      const target = path.join(root, `dirty-${suffix}`);
      yield* git(cwd, ["worktree", "add", "--quiet", "--detach", target]);
      yield* write(path.join(target, "scratch.txt"), "local change\n");
      return target;
    });
  const lockedPair = (suffix: string) =>
    Effect.gen(function* () {
      const target = path.join(root, `locked-${suffix}`);
      yield* git(cwd, ["worktree", "add", "--quiet", "--detach", target]);
      yield* git(cwd, ["worktree", "lock", target]);
      return target;
    });
  const plainPair = (suffix: string) =>
    Effect.gen(function* () {
      const target = path.join(root, `plain-${suffix}`);
      yield* fs.makeDirectory(target);
      return target;
    });
  for (const [scenario, make] of [
    ["dirty linked worktree", dirtyPair],
    ["locked linked worktree", lockedPair],
    ["unregistered directory", plainPair],
  ] as const) {
    const oldTarget = yield* make("old");
    const newTarget = yield* make("new");
    const oldResult = { removed: yield* oldRemoveGitWorktree(cwd, oldTarget), exists: yield* fs.exists(oldTarget) };
    const newResult = { removed: yield* removeGitWorktree(cwd, newTarget), exists: yield* fs.exists(newTarget) };
    yield* record("removeGitWorktree", scenario, oldResult, newResult);
  }
  yield* record(
    "removeGitWorktree",
    "option-like path",
    "not run: the old body hands --help to git worktree remove as an option, which opens git's help",
    { removed: yield* removeGitWorktree(cwd, "--help") }
  );

  // detectPrRepository and the labels read
  const originCases: ReadonlyArray<readonly [string, ReadonlyArray<ReadonlyArray<string>>]> = [
    ["no origin", []],
    ["https origin with .git", [["remote", "add", "origin", "https://github.com/Beep-Effect/Beep-Effect.git"]]],
    ["ssh origin", [["remote", "set-url", "origin", "git@github.com:owner/repo.git"]]],
    ["origin without .git", [["remote", "set-url", "origin", "https://github.com/owner/repo"]]],
    ["non-GitHub origin", [["remote", "set-url", "origin", "https://gitlab.invalid/owner/repo.git"]]],
    [
      "insteadOf rewrite configured",
      [
        ["remote", "set-url", "origin", "https://github.com/owner/repo.git"],
        ["config", "url.https://mirror.invalid/.insteadOf", "https://github.com/"],
      ],
    ],
    ["value with surrounding whitespace", [["config", "remote.origin.url", "  https://github.com/owner/repo.git  "]]],
  ];
  for (const [scenario, steps] of originCases) {
    for (const step of steps) yield* git(cwd, step);
    yield* record("detectPrRepository", scenario, yield* oldDetectRepository(cwd), yield* newDetectRepository(cwd));
  }
  yield* record(
    "detectPrRepository",
    "vanished directory",
    yield* oldDetectRepository(path.join(root, "vanished")),
    yield* newDetectRepository(path.join(root, "vanished"))
  );
  const labelCases: ReadonlyArray<readonly [string, ReadonlyArray<ReadonlyArray<string>>]> = [
    ["unset", []],
    ["off", [["config", "beep.provenance.labels", "off"]]],
    ["on", [["config", "beep.provenance.labels", "on"]]],
    ["OFF uppercase", [["config", "beep.provenance.labels", "OFF"]]],
    ["padded off", [["config", "beep.provenance.labels", "  off  "]]],
    [
      "multi-valued, last off",
      [
        ["config", "--unset-all", "beep.provenance.labels"],
        ["config", "--add", "beep.provenance.labels", "on"],
        ["config", "--add", "beep.provenance.labels", "off"],
      ],
    ],
  ];
  for (const [scenario, steps] of labelCases) {
    for (const step of steps) yield* git(cwd, step);
    yield* record("provenanceLabels", scenario, yield* oldLabels(cwd), yield* newLabels(cwd));
  }

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/effected-promotion/ops/git-adoption-differential.ts",
    commit: Str.trim((yield* runRepoCommandCapture("git", ["rev-parse", "HEAD"], repoRoot)).output),
    git: Str.trim((yield* runRepoCommandCapture("git", ["--version"], repoRoot)).output),
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
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
