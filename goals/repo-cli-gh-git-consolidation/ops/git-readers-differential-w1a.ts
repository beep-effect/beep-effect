/**
 * W1a differential: repo-cli's typed git readers on `@beep/git` against the hand-rolled bodies they replace.
 *
 * W1a of `goals/repo-cli-gh-git-consolidation` moves the typed readers of
 * `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts` onto `Git` members: `resolveGitCommit` ->
 * `Git.revParse({ peel: "commit" })`, `resolveGitMergeBase` -> `Git.mergeBase`, `readGitTree` -> `Git.repoRoot` +
 * `Git.lsTree`, `readGitRenames` -> `Git.nameStatus({ findRenames: 50 })`, `collectStagedPaths` /
 * `collectUnstagedPaths` / `collectUntrackedPaths` -> `Git.stagedChanges` / `Git.unstagedChanges` /
 * `Git.untrackedFiles`, and `currentBranch("abbrev-ref")` -> `Git.currentBranch`. Every reader keeps its
 * `GitCommandErrorAdapter<E>` and the kit's errors fold back through it (`adaptGitKitError`).
 *
 * Each pre-W1a body is frozen below as `old*` (from origin/main bad248c433), running the same git argv through the
 * repo-run capture it used. Every scenario builds a real scratch repository, runs the old body and the shipped
 * reader on the same state through the same recording adapter, and compares the normalized outcomes. A difference is
 * either classified (an intended divergence named in SPEC D-08 with a witness scenario) or unclassified; the gate is
 * zero unclassified. `ensureOriginMain` needs a remote and is not exercised here; its argv shift (`--quiet` dropped)
 * is recorded in D-08 from the kit's command constructors.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/git-readers-differential-w1a.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import {
  formatCommandLine,
  OutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
} from "@beep/repo-cli-kit/process/StepExec";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  collectStagedPaths,
  collectUnstagedPaths,
  collectUntrackedPaths,
  currentBranch,
  GitRenameEntry,
  gitPathListFromNulOutput,
  gitTreeEntriesFromNulOutput,
  readGitRenames,
  readGitTree,
  resolveGitCommit,
  resolveGitMergeBase,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import type { RunCapturedOptions, RunCapturedStreamsOptions } from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  CurrentBranchRef,
  GitCommandErrorAdapter,
  GitTreeEntry,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

// --- the recording adapter both bodies run through -------------------------------------------------------------
// The command line is deliberately NOT part of the outcome: the kit's argv differs from the frozen argv by design
// (`--no-relative`, `--full-name`, no `--`, `base...head`), and that shift is recorded in D-08, not re-derived here.

type Outcome =
  | { readonly _tag: "spawn-failure" }
  | { readonly _tag: "exit"; readonly exitCode: number; readonly output: string }
  | { readonly _tag: "truncated" }
  | { readonly _tag: "malformed" };

const adapter: GitCommandErrorAdapter<Outcome> = {
  onSpawnFailure: () => () => ({ _tag: "spawn-failure" }),
  onNonZeroExit: ({ exitCode, output }) => ({ _tag: "exit", exitCode, output: Str.trim(output) }),
  onTruncated: O.some(() => ({ _tag: "truncated" })),
};
const malformed = (): Outcome => ({ _tag: "malformed" });

// --- pre-W1a bodies (frozen, behaviour-for-behaviour, from bad248c433) -----------------------------------------

type GitCaptureOutcome = {
  readonly exitCode: number;
  readonly parsed: string;
  readonly failureOutput: string;
  readonly truncated: boolean;
};

const failFromOutcome = (outcome: GitCaptureOutcome, commandLine: string): Effect.Effect<string, Outcome> => {
  if (outcome.exitCode !== 0) {
    return Effect.fail(
      adapter.onNonZeroExit({ commandLine, exitCode: outcome.exitCode, output: outcome.failureOutput })
    );
  }
  return O.match(adapter.onTruncated, {
    onNone: () => Effect.succeed(outcome.parsed),
    onSome: (toError) => (outcome.truncated ? Effect.fail(toError(commandLine)) : Effect.succeed(outcome.parsed)),
  });
};

const oldRunGitCaptured = (args: ReadonlyArray<string>, capture: Omit<RunCapturedOptions, "command" | "args">) => {
  const commandLine = formatCommandLine("git", args);
  return runCaptured({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.output,
          failureOutput: captured.output,
          truncated: captured.truncated,
        },
        commandLine
      )
    )
  );
};

const oldRunGitStructured = (
  args: ReadonlyArray<string>,
  capture: Omit<RunCapturedStreamsOptions, "command" | "args">
) => {
  const commandLine = formatCommandLine("git", args);
  return runCapturedStreams({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.stdout,
          failureOutput: `${captured.stdout}${captured.stderr}`,
          truncated: captured.truncated,
        },
        commandLine
      )
    )
  );
};

const structuredCapture = (cwd: string): Omit<RunCapturedStreamsOptions, "command" | "args"> => ({
  cwd,
  extendEnv: true,
  stdin: "inherit",
  bound: repoRunOutputBound,
  trim: true,
});

const gitPathOutputBound = OutputBound.make({
  maxChars: 8 * 1024 * 1024,
  truncatedNotice: "\n[repo-run] Git filename inventory exceeded 8 MiB",
});

const oldRunGitOutput = (cwd: string, args: ReadonlyArray<string>) =>
  oldRunGitCaptured(args, {
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  });

const oldRunGitPathList = (cwd: string, args: ReadonlyArray<string>) =>
  oldRunGitStructured(args, { ...structuredCapture(cwd), stdoutBound: gitPathOutputBound }).pipe(
    Effect.map(gitPathListFromNulOutput)
  );

const oldRunGitRawOutput = (cwd: string, args: ReadonlyArray<string>) =>
  oldRunGitStructured(args, { cwd, stdin: "ignore" });

// The pre-W1a rename parser, verbatim (deleted from GitExec.ts in W1a; the kit's fail-closed parser owns it now).
const GIT_RENAME_STATUS = /^R([0-9]+)$/u;
const GIT_COPY_STATUS = /^C[0-9]+$/u;
const GIT_SINGLE_STATUS = /^[ADMTUXB]$/u;
const nameStatusPathCount = (status: string): O.Option<number> => {
  if (GIT_RENAME_STATUS.test(status) || GIT_COPY_STATUS.test(status)) return O.some(2);
  return GIT_SINGLE_STATUS.test(status) ? O.some(1) : O.none();
};
const renameScoreFromStatus = (status: string): O.Option<number> => {
  const match = GIT_RENAME_STATUS.exec(status);
  if (match === null || !P.isString(match[1])) return O.none();
  return O.filter(N.parse(match[1]), (score) => score >= 50 && score <= 100);
};
type GitNameStatusRecord = { readonly width: number; readonly rename: O.Option<GitRenameEntry> };
const readNameStatusRecord = (fields: ReadonlyArray<string>, index: number): O.Option<GitNameStatusRecord> => {
  const status = fields[index];
  const sourcePath = fields[index + 1];
  if (!P.isString(status) || !P.isString(sourcePath)) return O.none();
  const pathCount = nameStatusPathCount(status);
  if (O.isNone(pathCount)) return O.none();
  const width = pathCount.value + 1;
  if (pathCount.value === 1) return O.some({ width, rename: O.none<GitRenameEntry>() });
  const targetPath = fields[index + 2];
  if (!P.isString(targetPath)) return O.none();
  if (!GIT_RENAME_STATUS.test(status)) return O.some({ width, rename: O.none<GitRenameEntry>() });
  return O.map(renameScoreFromStatus(status), (score) => ({
    width,
    rename: O.some(GitRenameEntry.make({ sourcePath, targetPath, score: S.Natural.make(score) })),
  }));
};
const oldGitRenameEntriesFromNulOutput = (output: string): O.Option<ReadonlyArray<GitRenameEntry>> => {
  if (Str.isEmpty(output)) return O.some(A.empty<GitRenameEntry>());
  if (!Str.endsWith("\0")(output)) return O.none();
  const fields = A.dropRight(Str.split("\0")(output), 1);
  let index = 0;
  let renames = A.empty<GitRenameEntry>();
  while (index < A.length(fields)) {
    const record = readNameStatusRecord(fields, index);
    if (O.isNone(record)) return O.none();
    index += record.value.width;
    renames = A.appendAll(renames, O.toArray(record.value.rename));
  }
  return O.some(renames);
};

const oldResolveGitCommit = (cwd: string, ref: string) =>
  oldRunGitStructured(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], structuredCapture(cwd));

const oldResolveGitMergeBase = (cwd: string, leftRef: string, rightRef: string) =>
  oldRunGitStructured(["merge-base", "--", leftRef, rightRef], structuredCapture(cwd));

const oldReadGitTree = (cwd: string, commit: string) =>
  oldRunGitRawOutput(cwd, ["ls-tree", "-r", "-z", "--full-tree", commit]).pipe(
    Effect.flatMap((output) => Effect.fromOption(gitTreeEntriesFromNulOutput(output), malformed))
  );

const oldReadGitRenames = (cwd: string, base: string, head: string, pathspec: ReadonlyArray<string>) =>
  oldRunGitRawOutput(cwd, ["diff", "--name-status", "-z", "--find-renames=50%", base, head, "--", ...pathspec]).pipe(
    Effect.flatMap((output) => Effect.fromOption(oldGitRenameEntriesFromNulOutput(output), malformed))
  );

const oldCollectStagedPaths = (cwd: string) => oldRunGitPathList(cwd, ["diff", "--cached", "--name-only", "-z"]);
const oldCollectUnstagedPaths = (cwd: string) => oldRunGitPathList(cwd, ["diff", "--name-only", "-z"]);
const oldCollectUntrackedPaths = (cwd: string) =>
  oldRunGitPathList(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]);
const oldCurrentBranch = (cwd: string, ref: CurrentBranchRef) =>
  oldRunGitOutput(cwd, ref === "show-current" ? ["branch", "--show-current"] : ["rev-parse", "--abbrev-ref", "HEAD"]);

// --- the shipped readers, through the same adapter -------------------------------------------------------------

const newResolveGitCommit = (cwd: string, ref: string) => resolveGitCommit(cwd, ref, adapter);
const newResolveGitMergeBase = (cwd: string, a: string, b: string) => resolveGitMergeBase(cwd, a, b, adapter);
const newReadGitTree = (cwd: string, commit: string) => readGitTree(cwd, commit, adapter, malformed);
const newReadGitRenames = (cwd: string, base: string, head: string, pathspec: ReadonlyArray<string>) =>
  readGitRenames(cwd, base, head, pathspec, adapter, malformed);
const newCollectStagedPaths = (cwd: string) => collectStagedPaths(cwd, adapter);
const newCollectUnstagedPaths = (cwd: string) => collectUnstagedPaths(cwd, adapter);
const newCollectUntrackedPaths = (cwd: string) => collectUntrackedPaths(cwd, adapter);
const newCurrentBranch = (cwd: string, ref: CurrentBranchRef) => currentBranch(cwd, adapter, ref);

// --- normalization ---------------------------------------------------------------------------------------------

const treeView = (entries: ReadonlyArray<GitTreeEntry>) =>
  A.map(entries, (entry) => `${entry.mode} ${entry.objectType} ${entry.objectId} ${entry.path}`);
const renameView = (entries: ReadonlyArray<GitRenameEntry>) =>
  A.map(entries, (entry) => `${entry.sourcePath} -> ${entry.targetPath} @${entry.score}`);
const same = (value: unknown): unknown => value;

/** Everything either body may need: the frozen capture's spawner and crypto, the shipped readers' `Git`. */
type Services = Git | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom;

/** Runs one body to a JSON-comparable value: its success, or the adapter outcome it failed with. */
const outcomeOf = <A>(body: Effect.Effect<A, Outcome, Services>, view: (value: A) => unknown) =>
  body.pipe(
    Effect.map((value) => ({ ok: view(value) })),
    Effect.catch((failure) => Effect.succeed({ failed: failure }))
  );

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

const write = Effect.fnUntraced(function* (cwd: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(path.join(cwd, file)), { recursive: true });
  yield* fs.writeFileString(path.join(cwd, file), content);
});

const commitAll = Effect.fnUntraced(function* (cwd: string, message: string) {
  yield* git(cwd, ["add", "-A"]);
  yield* git(cwd, [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.email=w1a@example.com",
    "-c",
    "user.name=W1a",
    "commit",
    "--quiet",
    "-m",
    message,
  ]);
  return yield* git(cwd, ["rev-parse", "HEAD"]);
});

const initRepo = Effect.fnUntraced(function* (cwd: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(cwd, { recursive: true });
  yield* git(cwd, ["-c", "init.defaultBranch=main", "init", "--quiet"]);
});

interface Row {
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
}
type Classified = Row & { readonly verdict: string };

// Intended divergences, each recorded in SPEC.md's Decision Log (D-08) with these witness scenarios.
const TYPED_TEXT =
  "D-08: an unknown ref or a non-repository cwd keeps exit 128 but carries the kit's typed message, not git's stderr";
const REFUSED =
  "D-08: an option-like ref is refused before any spawn (onSpawnFailure) instead of being shielded by --end-of-options or --";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["resolveGitCommit", "unknown ref", TYPED_TEXT],
  ["resolveGitCommit", "unknown object", TYPED_TEXT],
  ["resolveGitCommit", "outside a repository", TYPED_TEXT],
  ["resolveGitCommit", "option-like ref", REFUSED],
  ["resolveGitMergeBase", "unknown ref", TYPED_TEXT],
  ["resolveGitMergeBase", "outside a repository", TYPED_TEXT],
  ["resolveGitMergeBase", "option-like ref", REFUSED],
  ["readGitTree", "unknown commit", TYPED_TEXT],
  ["readGitTree", "outside a repository", TYPED_TEXT],
  ["readGitRenames", "unknown ref", TYPED_TEXT],
  [
    "readGitRenames",
    "outside a repository",
    "D-08: outside a repository git's --no-index fallback rejects the kit's base...head range with usage text (exit 129) where the frozen base head argv exited 1 (Could not access); both fail through onNonZeroExit",
  ],
  [
    "readGitRenames",
    "base on a diverged branch",
    "D-08: Git.nameStatus diffs the merge-base range (base...head) where the frozen reader diffed base head; equal whenever base is an ancestor of head",
  ],
  ["collectStagedPaths", "outside a repository", TYPED_TEXT],
  ["collectUnstagedPaths", "outside a repository", TYPED_TEXT],
  ["collectUntrackedPaths", "outside a repository", TYPED_TEXT],
  [
    "collectUntrackedPaths",
    "cwd in a subdirectory",
    "D-08: Git.untrackedFiles passes --full-name, so a subdirectory cwd reports repository-relative paths; every caller passes the repository root",
  ],
  [
    "collectUnstagedPaths",
    "cwd in a subdirectory with diff.relative",
    "D-08: Git.unstagedChanges passes --no-relative, so diff.relative=true no longer narrows the listing; every caller passes the repository root",
  ],
  [
    "collectStagedPaths",
    "cwd in a subdirectory with diff.relative",
    "D-08: Git.stagedChanges passes --no-relative, so diff.relative=true no longer narrows the listing; every caller passes the repository root",
  ],
  ["currentBranch", "unborn repository (abbrev-ref)", TYPED_TEXT],
  ["currentBranch", "outside a repository (abbrev-ref)", TYPED_TEXT],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w1a-differential-" });
  const rows: Array<Row> = [];
  const compare = <A, B>(
    site: string,
    scenario: string,
    oldBody: Effect.Effect<A, Outcome, Services>,
    newBody: Effect.Effect<B, Outcome, Services>,
    oldView: (value: A) => unknown = same,
    newView: (value: B) => unknown = same
  ) =>
    Effect.gen(function* () {
      const oldValue = yield* outcomeOf(oldBody, oldView);
      const newValue = yield* outcomeOf(newBody, newView);
      rows.push({ site, scenario, old: oldValue, new: newValue });
    });

  // A repository with branched history, a rename at 100%, a rename at 60%, a rename below 50% (seen as D + A),
  // a path with a space, a deleted file, and a subdirectory to run from.
  const repo = path.join(root, "repo");
  yield* initRepo(repo);
  const lines = (count: number, prefix: string) =>
    A.join(
      A.makeBy(count, (i) => `${prefix} line ${i}`),
      "\n"
    );
  yield* write(repo, "src/keep.ts", lines(20, "keep"));
  yield* write(repo, "src/exact.ts", lines(20, "exact"));
  yield* write(repo, "src/mostly.ts", lines(20, "mostly"));
  yield* write(repo, "src/rewritten.ts", lines(20, "rewritten"));
  yield* write(repo, "src/with space.ts", lines(20, "spaced"));
  yield* write(repo, "docs/gone.md", lines(5, "gone"));
  yield* write(repo, "sub/inner.ts", lines(5, "inner"));
  const c1 = yield* commitAll(repo, "c1");
  yield* git(repo, ["branch", "feature"]);
  yield* git(repo, ["branch", "diverged"]);
  // main moves on: exact rename, 60% rename, full rewrite under a new name, spaced rename, a deletion.
  yield* git(repo, ["mv", "src/exact.ts", "src/exact-moved.ts"]);
  yield* fs.remove(path.join(repo, "src/mostly.ts"));
  yield* write(repo, "src/mostly-moved.ts", A.join([lines(12, "mostly"), lines(8, "changed")], "\n"));
  yield* fs.remove(path.join(repo, "src/rewritten.ts"));
  yield* write(repo, "src/rewritten-moved.ts", lines(20, "entirely new"));
  yield* git(repo, ["mv", "src/with space.ts", "src/with other space.ts"]);
  yield* fs.remove(path.join(repo, "docs/gone.md"));
  const c2 = yield* commitAll(repo, "c2");
  // feature diverges from c1 with its own commit.
  yield* git(repo, ["checkout", "--quiet", "feature"]);
  yield* write(repo, "feature.txt", "f1\n");
  const f1 = yield* commitAll(repo, "f1");
  // diverged renames a main-side file so base...head and base head disagree.
  yield* git(repo, ["checkout", "--quiet", "diverged"]);
  yield* git(repo, ["mv", "src/keep.ts", "src/kept-elsewhere.ts"]);
  const d1 = yield* commitAll(repo, "d1");
  yield* git(repo, ["checkout", "--quiet", "main"]);
  // An orphan branch with no common ancestor.
  yield* git(repo, ["checkout", "--quiet", "--orphan", "orphan"]);
  yield* git(repo, ["rm", "-rfq", "."]);
  yield* write(repo, "orphan.txt", "o1\n");
  const o1 = yield* commitAll(repo, "o1");
  yield* git(repo, ["checkout", "--quiet", "main"]);
  const sub = path.join(repo, "sub");
  const missing = Str.repeat(40)("0");
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);

  // resolveGitCommit
  const commitCases: ReadonlyArray<readonly [string, string, string]> = [
    ["HEAD", repo, "HEAD"],
    ["branch name", repo, "feature"],
    ["full sha", repo, c1],
    ["unknown ref", repo, "nope"],
    ["unknown object", repo, missing],
    ["option-like ref", repo, "--all"],
    ["outside a repository", plain, "HEAD"],
  ];
  for (const [scenario, cwd, ref] of commitCases) {
    yield* compare("resolveGitCommit", scenario, oldResolveGitCommit(cwd, ref), newResolveGitCommit(cwd, ref));
  }

  // resolveGitMergeBase
  const mergeBaseCases: ReadonlyArray<readonly [string, string, string, string]> = [
    ["fork point", repo, "main", "feature"],
    ["ancestor of itself", repo, c1, c2],
    ["no common ancestor", repo, "main", o1],
    ["unknown ref", repo, "main", "nope"],
    ["option-like ref", repo, "--all", "main"],
    ["outside a repository", plain, c1, c2],
  ];
  for (const [scenario, cwd, a, b] of mergeBaseCases) {
    yield* compare(
      "resolveGitMergeBase",
      scenario,
      oldResolveGitMergeBase(cwd, a, b),
      newResolveGitMergeBase(cwd, a, b)
    );
  }

  // readGitTree
  const treeCases: ReadonlyArray<readonly [string, string, string]> = [
    ["full tree at HEAD", repo, c2],
    ["full tree at the base", repo, c1],
    ["cwd in a subdirectory", sub, c2],
    ["unknown commit", repo, missing],
    ["outside a repository", plain, c2],
  ];
  for (const [scenario, cwd, commit] of treeCases) {
    yield* compare(
      "readGitTree",
      scenario,
      oldReadGitTree(cwd, commit),
      newReadGitTree(cwd, commit),
      treeView,
      treeView
    );
  }

  // readGitRenames
  const renameCases: ReadonlyArray<readonly [string, string, string, string, ReadonlyArray<string>]> = [
    ["renames at and above 50%, a rewrite below, a spaced path, a deletion", repo, c1, c2, []],
    ["scoped by pathspec", repo, c1, c2, ["src/exact*", "src/with*"]],
    ["pathspec matching nothing", repo, c1, c2, ["nowhere/"]],
    ["no changes", repo, c2, c2, []],
    ["merge base into a branch tip", repo, c1, f1, []],
    ["base on a diverged branch", repo, d1, c2, []],
    ["unknown ref", repo, "nope", c2, []],
    ["outside a repository", plain, c1, c2, []],
  ];
  for (const [scenario, cwd, base, head, pathspec] of renameCases) {
    yield* compare(
      "readGitRenames",
      scenario,
      oldReadGitRenames(cwd, base, head, pathspec),
      newReadGitRenames(cwd, base, head, pathspec),
      renameView,
      renameView
    );
  }

  // Dirty-path collectors: a staged change, an unstaged change, a partially staged file, untracked paths (one
  // ignored, one with a space), from the root and from a subdirectory, with and without diff.relative.
  yield* write(repo, "src/keep.ts", lines(21, "keep"));
  yield* git(repo, ["add", "src/keep.ts"]);
  yield* write(repo, "src/exact-moved.ts", lines(21, "exact"));
  yield* write(repo, "sub/inner.ts", lines(6, "inner"));
  yield* git(repo, ["add", "sub/inner.ts"]);
  yield* write(repo, "sub/inner.ts", lines(7, "inner"));
  yield* write(repo, "untracked.txt", "u\n");
  yield* write(repo, "sub/untracked two.txt", "u\n");
  yield* write(repo, "build/out.js", "ignored\n");
  yield* write(repo, ".gitignore", "build/\n");
  type Collector = (cwd: string) => Effect.Effect<ReadonlyArray<string>, Outcome, Services>;
  const collectors: ReadonlyArray<readonly [string, Collector, Collector]> = [
    ["collectStagedPaths", oldCollectStagedPaths, newCollectStagedPaths],
    ["collectUnstagedPaths", oldCollectUnstagedPaths, newCollectUnstagedPaths],
    ["collectUntrackedPaths", oldCollectUntrackedPaths, newCollectUntrackedPaths],
  ];
  for (const [site, oldBody, newBody] of collectors) {
    yield* compare(site, "dirty repository root", oldBody(repo), newBody(repo));
    yield* compare(site, "cwd in a subdirectory", oldBody(sub), newBody(sub));
    yield* compare(site, "outside a repository", oldBody(plain), newBody(plain));
  }
  yield* git(repo, ["config", "diff.relative", "true"]);
  yield* compare(
    "collectStagedPaths",
    "cwd in a subdirectory with diff.relative",
    oldCollectStagedPaths(sub),
    newCollectStagedPaths(sub)
  );
  yield* compare(
    "collectUnstagedPaths",
    "cwd in a subdirectory with diff.relative",
    oldCollectUnstagedPaths(sub),
    newCollectUnstagedPaths(sub)
  );
  yield* git(repo, ["config", "--unset", "diff.relative"]);

  // currentBranch: on a branch, detached, unborn, outside; both ref modes.
  const detached = path.join(root, "detached");
  yield* git(root, ["clone", "--quiet", `file://${repo}`, detached]);
  yield* git(detached, ["checkout", "--quiet", "--detach", "HEAD"]);
  const unborn = path.join(root, "unborn");
  yield* initRepo(unborn);
  const branchCases: ReadonlyArray<readonly [string, string]> = [
    ["on a branch", repo],
    ["detached HEAD", detached],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ];
  for (const [scenario, cwd] of branchCases) {
    for (const mode of ["abbrev-ref", "show-current"] as const) {
      yield* compare(
        "currentBranch",
        `${scenario} (${mode})`,
        oldCurrentBranch(cwd, mode),
        newCurrentBranch(cwd, mode)
      );
    }
  }

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/git-readers-differential-w1a.ts",
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
