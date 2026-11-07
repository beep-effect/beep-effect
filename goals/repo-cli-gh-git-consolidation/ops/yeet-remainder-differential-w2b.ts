/**
 * W2b differential: the remaining Yeet git halves, the Library inventory read and ai-metrics' config snapshot on
 * `@beep/git` against the hand-rolled bodies they replace.
 *
 * W2b of `goals/repo-cli-gh-git-consolidation` moves these reads and mutations onto `Git` members (SPEC D-11):
 * `Settle.readYeetChangedPathsStrict` -> `Git.changedFiles({ noRenames: true })`; the ProofShadow working-tree read ->
 * `Git.status({ untrackedFiles: "all" })`; Sweep's planner probes (`currentBranch`, `status`, `repoRoot`,
 * `worktreeList`, `revParse({ quiet: true })`, the two-tree `bun.lock` diff) and steps (`branchDelete`, `checkout`,
 * `fetch <main>:<main>`) through the `sweepProbeFromGit` CommandProbe adapter; Retire's reads (`commonDir`, `repoRoot`,
 * `currentBranch`, `mergeBase`, the `goals/` diff, `show`); MergedPreview's `worktree add`; ReadyGate's empty commit and
 * push; PullRequest's push URL, merge base and changed paths; Status's three dirty-path reads; the Library inventory's
 * `rev-parse HEAD`; and ai-metrics' `ls-files -z`.
 *
 * Each pre-W2b body is frozen below as `old*` (from origin/main 4b15eaa7d7), running the same git argv through the
 * capture it used. Every scenario builds a real scratch repository, runs the old body and the shipped body on the same
 * state, and compares the normalized outcomes: what each caller branches on, not the command line (the kit's argv
 * differs by design and that shift is recorded in D-11). A difference is classified (an intended divergence named in
 * D-11 with a witness scenario) or unclassified; the gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/yeet-remainder-differential-w2b.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git, GitOptions } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
  yeetGitKitError,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import {
  readYeetChangedPathsStrict,
  strictGitKitError,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts";
import { sweepProbeFromGit } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts";
import { YeetCommandError } from "../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { adaptGitKitError } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import { patientGit } from "../../../packages/tooling/tool/cli/src/internal/repo-run/PatientGit.ts";
import {
  runRepoCommandCapture,
  runRepoCommandCaptureRaw,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { RepoRunContext } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
// The retired generic runner, frozen verbatim at the lane base (runner retirement, SPEC D-21).
import { runGitOutput } from "./frozen-w7b/GitRunners.old.ts";
import type { StatusEntry, WorktreeEntry } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

type Services = Git | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom;

const contextFor = (cwd: string, base = "main"): RepoRunContext =>
  RepoRunContext.make({
    base,
    branch: "feature",
    cwd,
    head: "HEAD",
    originalArgv: [],
    packetDir: cwd,
    repoRoot: cwd,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

// --- pre-W2b bodies (frozen, behaviour-for-behaviour, from 4b15eaa7d7) ------------------------------------------

// Yeet's git error adapter, verbatim (Yeet/internal/GitExec.ts; not exported).
const oldYeetAdapter: GitCommandErrorAdapter<YeetCommandError> = {
  onSpawnFailure: (commandLine) => YeetCommandError.new(`Failed to run ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    YeetCommandError.make({
      message: `${commandLine} failed with exit code ${exitCode}.`,
      command: commandLine,
      exitCode,
    }),
  onTruncated: O.some((commandLine) =>
    YeetCommandError.make({
      message: `${commandLine} output exceeded the repo-run capture limit.`,
      command: commandLine,
      exitCode: 1,
    })
  ),
};
const oldRunGitOutput = (cwd: string, args: ReadonlyArray<string>) => runGitOutput(cwd, args, oldYeetAdapter);

// Settle.captureRepoCommandStrict + readYeetChangedPathsStrict over the raw stdout capture.
const oldStrict = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>, onSpawnFailure: string) {
  const commandText = A.join(["git", ...args], " ");
  const result = yield* runRepoCommandCaptureRaw("git", args, cwd).pipe(
    Effect.mapError(YeetCommandError.new(onSpawnFailure))
  );
  if (result.exitCode !== 0)
    return yield* YeetCommandError.make({
      message: `${commandText} exited with code ${result.exitCode}.`,
      command: commandText,
      exitCode: result.exitCode,
    });
  if (result.truncated)
    return yield* YeetCommandError.make({ message: `${commandText} produced more output than the capture bound.` });
  return result.output;
});
const oldChangedPathsStrict = (cwd: string, base: string) =>
  oldStrict(cwd, ["diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`], "spawn").pipe(
    Effect.map((output) => A.filter(Str.split(output, "\0"), Str.isNonEmpty))
  );

// ProofShadow's porcelain scanner, verbatim.
const oldPorcelainPaths = (output: string): ReadonlyArray<string> => {
  const isEntry = (entry: string) => Str.length(entry) > 3 && Str.slice(2, 3)(entry) === " ";
  const isRename = (entry: string) => A.some(["R", "C"], (code) => Str.includes(code)(Str.slice(0, 2)(entry)));
  return A.reduce(
    A.filter(Str.split(output, "\0"), Str.isNonEmpty),
    { paths: A.empty<string>(), expectOriginalPath: false },
    (scan, token) =>
      scan.expectOriginalPath
        ? { paths: A.append(scan.paths, token), expectOriginalPath: false }
        : isEntry(token)
          ? { paths: A.append(scan.paths, Str.slice(3)(token)), expectOriginalPath: isRename(token) }
          : { paths: scan.paths, expectOriginalPath: false }
  ).paths;
};
const oldWorktreePaths = (cwd: string) =>
  oldStrict(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], "spawn").pipe(
    Effect.map(oldPorcelainPaths)
  );

// Sweep's capture probe and its worktree-list parser, verbatim.
type Probe = { readonly exitCode: number; readonly output: string; readonly truncated: boolean };
const oldProbe = (cwd: string, args: ReadonlyArray<string>) =>
  runRepoCommandCapture("git", args, cwd).pipe(
    Effect.map(
      (result): Probe => ({ exitCode: result.exitCode, output: Str.trim(result.output), truncated: result.truncated })
    ),
    Effect.orElseSucceed((): Probe => ({ exitCode: 1, output: "", truncated: false }))
  );
const valueAfter = (prefix: string, line: string) => Str.trim(Str.slice(Str.length(prefix))(line));
const oldParseWorktrees = (output: string) =>
  A.getSomes(
    A.map(Str.split(output, "\n\n"), (block) => {
      const lines = A.filter(A.map(Str.split(block, "\n"), Str.trim), Str.isNonEmpty);
      return O.map(A.findFirst(lines, Str.startsWith("worktree ")), (line) => ({
        path: valueAfter("worktree ", line),
        branch: O.getOrNull(
          O.map(A.findFirst(lines, Str.startsWith("branch refs/heads/")), (branch) =>
            valueAfter("branch refs/heads/", branch)
          )
        ),
      }));
    })
  );

// Retire.gitOutput, verbatim.
const oldRetireGit = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const commandLine = `git ${A.join(args, " ")}`;
  const result = yield* runRepoCommandCapture("git", args, cwd).pipe(
    Effect.mapError(YeetCommandError.new(`${commandLine} could not run in ${cwd}.`))
  );
  if (result.exitCode !== 0)
    return yield* YeetCommandError.make({
      message: `${commandLine} exited with ${result.exitCode} in ${cwd}: ${Str.trim(result.output)}`,
    });
  return Str.trim(result.output);
});

// MergedPreview.gitCapture, verbatim.
const oldGitCapture = (cwd: string, args: ReadonlyArray<string>) =>
  runRepoCommandCapture("git", args, cwd).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 128, output: "git could not be executed", truncated: false })),
    Effect.map((result) => ({ exitCode: result.exitCode, output: result.output }))
  );

// Status.runGitPaths, verbatim (sorted, deduped, NUL-separated).
const sortedUnique = (paths: ReadonlyArray<string>) => A.sort(A.dedupe(A.filter(paths, Str.isNonEmpty)), Order.String);
const oldStatusPaths = (cwd: string, args: ReadonlyArray<string>) =>
  oldRunGitOutput(cwd, args).pipe(Effect.map((output) => sortedUnique(Str.split(output, "\0"))));

// Library.inventory's `-C <root> rev-parse HEAD` (the old StepExec capture of the same argv).
const oldLibraryCommit = (root: string) =>
  runRepoCommandCapture("git", ["-C", root, "rev-parse", "HEAD"], root).pipe(
    Effect.map((result) => (result.exitCode === 0 ? Str.trim(result.output) : "")),
    Effect.orElseSucceed(() => "")
  );

// ai-metrics readTrackedSnapshotPaths: `ls-files -z`, unbounded.
const oldLsFiles = (cwd: string) =>
  runRepoCommandCaptureRaw("git", ["ls-files", "-z"], cwd).pipe(
    Effect.map((result) =>
      result.exitCode === 0 ? A.filter(Str.split(result.output, "\0"), Str.isNonEmpty) : ["<failed>"]
    )
  );

// --- the shipped bodies (the expressions each site ships, where the site does not export them) ---------------

const newWorktreePaths = (cwd: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .status(cwd, { untrackedFiles: "all" })
      .pipe(
        Effect.mapError(strictGitKitError(GitCommand.status({ untrackedFiles: "all" }), "spawn")),
        Effect.map(
          A.flatMap((entry: StatusEntry) => A.prepend(A.fromOption(O.fromUndefinedOr(entry.origPath)), entry.path))
        )
      )
  );
const newWorktrees = (cwd: string) =>
  Effect.flatMap(Git, (git) =>
    git.worktreeList(cwd).pipe(
      sweepProbeFromGit(GitCommand.worktreeList(), () => ""),
      Effect.map((probe) =>
        A.map(O.getOrElse(probe.value, A.empty<WorktreeEntry>), (entry) => ({
          path: entry.path,
          branch: O.getOrNull(
            O.map(O.filter(O.fromUndefinedOr(entry.branch), Str.startsWith("refs/heads/")), Str.slice(11))
          ),
        }))
      )
    )
  );
const retireFold = (invocation: Parameters<typeof yeetGitKitError>[0], cwd: string) =>
  adaptGitKitError(invocation, {
    onSpawnFailure: (commandLine) => YeetCommandError.new(`${commandLine} could not run in ${cwd}.`),
    onNonZeroExit: ({ commandLine, exitCode, output }) =>
      YeetCommandError.make({ message: `${commandLine} exited with ${exitCode} in ${cwd}: ${Str.trim(output)}` }),
    onTruncated: O.none(),
  });
const newPreviewAdd = (cwd: string, path: string, ref: string) =>
  Effect.flatMap(patientGit, (git) =>
    git.worktreeAdd(cwd, path, { ref, detach: true }).pipe(
      Effect.as({ exitCode: 0, output: "" }),
      Effect.catch((error) =>
        Effect.succeed(
          adaptGitKitError(error, GitCommand.worktreeAdd(path, ref, true), {
            onSpawnFailure: () => () => ({ exitCode: 128, output: "git could not be executed" }),
            onNonZeroExit: ({ exitCode, output }) => ({ exitCode, output }),
            onTruncated: O.none(),
          })
        )
      )
    )
  );

// --- normalization ---------------------------------------------------------------------------------------------

const yeetFailure = (error: YeetCommandError) =>
  O.match(O.fromUndefinedOr(error.exitCode), {
    onNone: () => ({ _tag: "no-exit" as const }),
    onSome: (exitCode) => ({ _tag: "exit" as const, exitCode }),
  });
const outcomeOf = <A, E>(
  body: Effect.Effect<A, E, Services>,
  view: (value: A) => unknown,
  fail: (error: E) => unknown
) =>
  body.pipe(
    Effect.map((value) => ({ ok: view(value) })),
    Effect.catch((failure) => Effect.succeed({ failed: fail(failure) }))
  );
const yeetOutcome = <A>(body: Effect.Effect<A, YeetCommandError, Services>, view: (value: A) => unknown = identity) =>
  outcomeOf(body, view, yeetFailure);
const plainOutcome = <A>(body: Effect.Effect<A, never, Services>, view: (value: A) => unknown = identity) =>
  outcomeOf(body, view, identity);
const probeView = (probe: Probe) => ({ reliable: !probe.truncated && probe.exitCode === 0, exitCode: probe.exitCode });
const nonEmptyView = (probe: Probe) => ({ ...probeView(probe), nonEmpty: Str.isNonEmpty(probe.output) });
const outputView = (probe: Probe) => ({ ...probeView(probe), output: probe.output });

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture(
    "git",
    ["-c", "commit.gpgsign=false", "-c", "user.email=w2b@example.com", "-c", "user.name=W2b", ...args],
    cwd
  );
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
  yield* git(cwd, ["commit", "--quiet", "-m", message]);
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

// Intended divergences, each recorded in SPEC.md's Decision Log (D-11) with these witness scenarios.
const TYPED =
  "D-11: an unknown ref or a non-repository cwd keeps exit 128 but the kit's typed message replaces git's stderr";
const NO_TRANSCRIPT =
  "D-11: a kit mutation surfaces no zero-exit transcript, so the sweep step's executed detail is empty";
const QUIET_UNKNOWN =
  "D-11: an unknown ref under --quiet is the kit's typed UnknownRefError (exit 128) where git exited 1 silently; observeSha reads None either way";
const UNTRIMMED =
  "D-11: Git.show returns the blob verbatim (trailing newline kept) where the capture trimmed it; the manifest decoder ignores the whitespace";
const NO_REMOTE = "D-11: a missing origin reads as no URL (the owner match fails) where get-url failed with exit 2";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["sweep.branchDelete", "merged branch -d", NO_TRANSCRIPT],
  ["sweep.branchDelete", "branch merged only to its upstream -d", NO_TRANSCRIPT],
  ["sweep.branchDelete", "unpushed branch -D", NO_TRANSCRIPT],
  ["sweep.head", "outside a repository", TYPED],
  ["sweep.toplevel", "outside a repository", TYPED],
  ["sweep.observeSha", "outside a repository", TYPED],
  ["sweep.observeSha", "upstream unset (remote-tracking ref missing)", QUIET_UNKNOWN],
  ["retire.showManifest", "manifest present", UNTRIMMED],
  ["sweep.fetchMain", "fetch origin main:main off main", NO_TRANSCRIPT],
  ["sweep.checkout", "switch to main", NO_TRANSCRIPT],
  ["retire.currentBranch", "outside a repository", TYPED],
  ["retire.commonDir", "outside a repository", TYPED],
  ["pullRequest.remoteUrl", "no origin remote", NO_REMOTE],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w2b-differential-" });
  const rows: Array<Row> = [];
  const compare = (site: string, scenario: string, oldValue: unknown, newValue: unknown) =>
    Effect.sync(() => rows.push({ site, scenario, old: oldValue, new: newValue }));

  // A bare origin with main (two commits, bun.lock moves in the second) and a feature branch that renames a spaced
  // path and adds a café file; a clone of it with an upstream, a linked worktree and a detached checkout.
  const seed = path.join(root, "seed with space");
  yield* initRepo(seed);
  yield* write(seed, "README.md", "seed\n");
  yield* write(seed, "bun.lock", "v1\n");
  yield* write(seed, "goals/alpha/ops/manifest.json", '{"lifecycle":"active"}\n');
  yield* write(seed, "src/old name.ts", "export const a = 1;\n");
  const c1 = yield* commitAll(seed, "c1");
  yield* git(seed, ["checkout", "--quiet", "-b", "feature"]);
  yield* git(seed, ["mv", "src/old name.ts", "src/new name.ts"]);
  yield* write(seed, "src/café.ts", "export const c = 3;\n");
  yield* write(seed, "goals/alpha/README.md", "touched\n");
  yield* commitAll(seed, "feature");
  yield* git(seed, ["checkout", "--quiet", "main"]);
  yield* write(seed, "bun.lock", "v2\n");
  const c2 = yield* commitAll(seed, "c2");
  const origin = path.join(root, "origin.git");
  yield* git(root, ["clone", "--quiet", "--bare", seed, origin]);
  const clone = path.join(root, "clone");
  yield* git(root, ["clone", "--quiet", origin, clone]);
  yield* git(clone, ["checkout", "--quiet", "-b", "feature", "origin/feature"]);
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);
  const unborn = path.join(root, "unborn");
  yield* initRepo(unborn);
  const detached = path.join(root, "detached");
  yield* git(seed, ["worktree", "add", "--quiet", "--detach", detached, c1]);
  const lane = path.join(root, "lane");
  yield* git(seed, ["worktree", "add", "--quiet", lane, "feature"]);
  const missing = path.join(root, "does-not-exist");

  // Settle: the merge-base diff, strict.
  for (const [scenario, cwd, base] of [
    ["feature branch with a rename and a café path", lane, "main"],
    ["no change against itself", seed, "main"],
    ["unknown base", seed, "nope"],
    ["outside a repository", plain, "main"],
  ] as const) {
    yield* compare(
      "settle.changedPathsStrict",
      scenario,
      yield* yeetOutcome(oldChangedPathsStrict(cwd, base), sortedUnique),
      yield* yeetOutcome(readYeetChangedPathsStrict(contextFor(cwd, base)), sortedUnique)
    );
  }

  // ProofShadow: the working-tree snapshot, clean and dirty (modified, staged rename, untracked spaced file).
  const dirty = path.join(root, "dirty");
  yield* git(root, ["clone", "--quiet", seed, dirty]);
  yield* compare(
    "proofShadow.worktreePaths",
    "clean tree",
    yield* yeetOutcome(oldWorktreePaths(dirty)),
    yield* yeetOutcome(newWorktreePaths(dirty))
  );
  yield* write(dirty, "README.md", "changed\n");
  yield* git(dirty, ["mv", "src/old name.ts", "src/moved name.ts"]);
  yield* write(dirty, "untracked dir/with space.ts", "x\n");
  for (const [scenario, cwd] of [
    ["dirty tree", dirty],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "proofShadow.worktreePaths",
      scenario,
      yield* yeetOutcome(oldWorktreePaths(cwd), sortedUnique),
      yield* yeetOutcome(newWorktreePaths(cwd), sortedUnique)
    );
  }

  // Sweep probes: head, status, toplevel, worktree list, refs, lockfile diff.
  const kitProbe = <A>(_cwd: string, read: (g: Git["Service"]) => Effect.Effect<A>) => Effect.flatMap(Git, read);
  const headProbe = (cwd: string) =>
    kitProbe(cwd, (g) =>
      g.currentBranch(cwd).pipe(
        sweepProbeFromGit(
          GitCommand.currentBranch(),
          O.getOrElse(() => "HEAD")
        )
      )
    );
  for (const [scenario, cwd] of [
    ["on a branch", seed],
    ["detached HEAD", detached],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "sweep.head",
      scenario,
      outputView(yield* oldProbe(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])),
      outputView(yield* headProbe(cwd))
    );
  }
  const statusProbe = (cwd: string) =>
    kitProbe(cwd, (g) =>
      g.status(cwd).pipe(
        sweepProbeFromGit(GitCommand.status(), (entries) =>
          A.join(
            A.map(entries, (e) => e.path),
            "\n"
          )
        )
      )
    );
  for (const [scenario, cwd] of [
    ["clean tree", seed],
    ["dirty tree", dirty],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "sweep.status",
      scenario,
      nonEmptyView(yield* oldProbe(cwd, ["status", "--porcelain"])),
      nonEmptyView(yield* statusProbe(cwd))
    );
  }
  for (const [scenario, cwd] of [
    ["main worktree", seed],
    ["linked worktree", lane],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "sweep.toplevel",
      scenario,
      outputView(yield* oldProbe(cwd, ["rev-parse", "--show-toplevel"])),
      outputView(yield* kitProbe(cwd, (g) => g.repoRoot(cwd).pipe(sweepProbeFromGit(GitCommand.repoRoot(), identity))))
    );
    yield* compare(
      "sweep.worktreeList",
      scenario,
      yield* oldProbe(cwd, ["worktree", "list", "--porcelain"]).pipe(
        Effect.map((probe) => oldParseWorktrees(probe.output))
      ),
      yield* newWorktrees(cwd)
    );
  }
  const shaProbe = (cwd: string, ref: string) =>
    kitProbe(cwd, (g) =>
      g.revParse(cwd, ref, { quiet: true }).pipe(sweepProbeFromGit(GitCommand.revParse(ref, { quiet: true }), identity))
    );
  for (const [scenario, cwd, ref] of [
    ["local branch present", clone, "refs/heads/feature"],
    ["upstream set (remote-tracking ref present)", clone, "refs/remotes/origin/feature"],
    ["upstream unset (remote-tracking ref missing)", seed, "refs/remotes/origin/feature"],
    ["outside a repository", plain, "refs/heads/main"],
  ] as const) {
    yield* compare(
      "sweep.observeSha",
      scenario,
      outputView(yield* oldProbe(cwd, ["rev-parse", "--verify", "--quiet", ref])),
      outputView(yield* shaProbe(cwd, ref))
    );
  }
  const lockProbe = (cwd: string, base: string, head: string) =>
    kitProbe(cwd, (g) =>
      g
        .changedFiles(cwd, { base, head, twoDot: true, pathspec: ["bun.lock"] })
        .pipe(
          sweepProbeFromGit(GitCommand.changedFiles(base, head, false, { twoDot: true, pathspec: ["bun.lock"] }), (p) =>
            A.join(p, "\n")
          )
        )
    );
  for (const [scenario, base, head] of [
    ["lockfile changed", c1, c2],
    ["lockfile unchanged", c2, c2],
    ["unknown base", "nope", c2],
  ] as const) {
    yield* compare(
      "sweep.lockfileDiff",
      scenario,
      nonEmptyView(yield* oldProbe(seed, ["diff", "--name-only", `${base}..${head}`, "--", "bun.lock"])),
      nonEmptyView(yield* lockProbe(seed, base, head))
    );
  }
  yield* compare(
    "sweep.probeAdapter",
    "spawn failure (cwd does not exist)",
    probeView(yield* oldProbe(missing, ["status", "--porcelain"])),
    probeView(yield* statusProbe(missing))
  );

  // Sweep mutations: each body gets its own clone of identical state.
  const mutationClone = Effect.fnUntraced(function* (name: string) {
    const cwd = path.join(root, name);
    yield* git(root, ["clone", "--quiet", origin, cwd]);
    yield* git(cwd, ["branch", "--quiet", "merged", c1]);
    yield* git(cwd, ["branch", "--quiet", "unmerged", "origin/feature"]);
    yield* git(cwd, ["checkout", "--quiet", "-b", "unpushed", c1]);
    yield* git(cwd, ["commit", "--quiet", "--allow-empty", "-m", "unpushed"]);
    yield* git(cwd, ["checkout", "--quiet", "main"]);
    return cwd;
  });
  const oldClone = yield* mutationClone("old-mutations");
  const newClone = yield* mutationClone("new-mutations");
  const stepView = (probe: Probe) => ({
    executed: probe.exitCode === 0,
    exitCode: probe.exitCode,
    detail: probe.output,
  });
  const branchDelete = (cwd: string, name: string, force: boolean) =>
    kitProbe(cwd, (g) =>
      g.branchDelete(cwd, name, { force }).pipe(sweepProbeFromGit(GitCommand.branchDelete(name, force), () => ""))
    );
  for (const [scenario, name, force] of [
    ["merged branch -d", "merged", false],
    ["branch merged only to its upstream -d", "unmerged", false],
    ["unpushed branch -d refused", "unpushed", false],
    ["unpushed branch -D", "unpushed", true],
  ] as const) {
    yield* compare(
      "sweep.branchDelete",
      scenario,
      stepView(yield* oldProbe(oldClone, ["branch", force ? "-D" : "-d", name])),
      stepView(yield* branchDelete(newClone, name, force))
    );
  }
  yield* git(oldClone, ["checkout", "--quiet", "-b", "side"]);
  yield* git(newClone, ["checkout", "--quiet", "-b", "side"]);
  yield* git(oldClone, ["update-ref", "refs/heads/main", c1]);
  yield* git(newClone, ["update-ref", "refs/heads/main", c1]);
  const fetchMain = (cwd: string) =>
    Effect.flatMap(patientGit, (g) =>
      g
        .fetch(cwd, { remote: "origin", ref: "main:main" })
        .pipe(sweepProbeFromGit(GitCommand.fetch("origin", "main:main"), () => ""))
    );
  yield* compare(
    "sweep.fetchMain",
    "fetch origin main:main off main",
    stepView(yield* oldProbe(oldClone, ["fetch", "origin", "main:main"])),
    stepView(yield* fetchMain(newClone))
  );
  const checkout = (cwd: string, ref: string) =>
    Effect.flatMap(patientGit, (g) => g.checkout(cwd, ref).pipe(sweepProbeFromGit(GitCommand.checkout(ref), () => "")));
  yield* compare(
    "sweep.checkout",
    "switch to main",
    stepView(yield* oldProbe(oldClone, ["switch", "main"])),
    stepView(yield* checkout(newClone, "main"))
  );
  yield* compare(
    "sweep.checkout",
    "unknown branch",
    { executed: (yield* oldProbe(oldClone, ["switch", "nope"])).exitCode === 0 },
    { executed: (yield* checkout(newClone, "nope")).exitCode === 0 }
  );

  // Retire reads.
  const retireCases: ReadonlyArray<readonly [string, string]> = [
    ["linked worktree", lane],
    ["main worktree", seed],
    ["outside a repository", plain],
  ];
  for (const [scenario, cwd] of retireCases) {
    yield* compare(
      "retire.commonDir",
      scenario,
      yield* yeetOutcome(oldRetireGit(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"])),
      yield* yeetOutcome(
        Effect.flatMap(Git, (g) => g.commonDir(cwd)).pipe(Effect.mapError(retireFold(GitCommand.commonDir(), cwd)))
      )
    );
    yield* compare(
      "retire.currentBranch",
      scenario,
      yield* yeetOutcome(oldRetireGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]), (b: string) =>
        b === "HEAD" ? "" : b
      ),
      yield* yeetOutcome(
        Effect.flatMap(Git, (g) => g.currentBranch(cwd)).pipe(
          Effect.mapBoth({ onFailure: retireFold(GitCommand.currentBranch(), cwd), onSuccess: O.getOrElse(() => "") })
        )
      )
    );
  }
  yield* compare(
    "retire.currentBranch",
    "detached HEAD",
    yield* yeetOutcome(oldRetireGit(detached, ["rev-parse", "--abbrev-ref", "HEAD"]), (b: string) =>
      b === "HEAD" ? "" : b
    ),
    yield* yeetOutcome(
      Effect.flatMap(Git, (g) => g.currentBranch(detached)).pipe(
        Effect.mapBoth({
          onFailure: retireFold(GitCommand.currentBranch(), detached),
          onSuccess: O.getOrElse(() => ""),
        })
      )
    )
  );
  const oldBranchPaths = (cwd: string) =>
    oldRetireGit(cwd, ["merge-base", "main", "HEAD"]).pipe(
      Effect.flatMap((mb) => oldRetireGit(cwd, ["diff", "--name-only", mb, "HEAD", "--", "goals/"])),
      Effect.map((out) => A.filter(A.map(Str.split(out, "\n"), Str.trim), Str.isNonEmpty))
    );
  const newBranchPaths = (cwd: string) =>
    Effect.gen(function* () {
      const g = yield* Git;
      const mb = yield* g
        .mergeBase(cwd, "main", "HEAD")
        .pipe(Effect.mapError(retireFold(GitCommand.mergeBase("main", "HEAD"), cwd)));
      const options = { twoDot: true, pathspec: ["goals/"] };
      return yield* g
        .changedFiles(cwd, { base: mb, head: "HEAD", ...options })
        .pipe(Effect.mapError(retireFold(GitCommand.changedFiles(mb, "HEAD", false, options), cwd)));
    });
  for (const [scenario, cwd] of [
    ["merged branch touching goals/", lane],
    ["unmerged branch on main itself", seed],
  ] as const) {
    yield* compare(
      "retire.branchPaths",
      scenario,
      yield* yeetOutcome(oldBranchPaths(cwd)),
      yield* yeetOutcome(newBranchPaths(cwd))
    );
  }
  for (const [scenario, slug] of [
    ["manifest present", "alpha"],
    ["manifest missing", "nope"],
  ] as const) {
    yield* compare(
      "retire.showManifest",
      scenario,
      yield* plainOutcome(oldRetireGit(lane, ["show", `HEAD:goals/${slug}/ops/manifest.json`]).pipe(Effect.option)),
      yield* plainOutcome(
        Effect.flatMap(Git, (g) => g.show(lane, "HEAD", `goals/${slug}/ops/manifest.json`)).pipe(
          Effect.flatMap(Effect.fromOption),
          Effect.option
        )
      )
    );
  }

  // MergedPreview: add the preview worktree (fresh and occupied paths).
  const addView = (target: string) => (result: { readonly exitCode: number; readonly output: string }) => ({
    exitCode: result.exitCode,
    failed: result.exitCode !== 0,
    output: result.exitCode === 0 ? "" : Str.replaceAll(target, "<target>")(Str.trim(result.output)),
  });
  const oldPreview = path.join(root, "old-preview");
  const newPreview = path.join(root, "new-preview");
  yield* compare(
    "mergedPreview.worktreeAdd",
    "fresh path",
    addView(oldPreview)(yield* oldGitCapture(seed, ["worktree", "add", "--detach", oldPreview, c2])),
    addView(newPreview)(yield* newPreviewAdd(seed, newPreview, c2))
  );
  const occupied = path.join(root, "occupied");
  yield* write(occupied, "keep.txt", "x\n");
  yield* compare(
    "mergedPreview.worktreeAdd",
    "path already exists",
    addView(occupied)(yield* oldGitCapture(seed, ["worktree", "add", "--detach", occupied, c2])),
    addView(occupied)(yield* newPreviewAdd(seed, occupied, c2))
  );

  // ReadyGate: the empty re-request commit and its push (accepted, then rejected as a non-fast-forward).
  const readyClone = Effect.fnUntraced(function* (name: string) {
    const cwd = path.join(root, name);
    yield* git(root, ["clone", "--quiet", origin, cwd]);
    yield* git(cwd, ["config", "user.email", "w2b@example.com"]);
    yield* git(cwd, ["config", "user.name", "W2b"]);
    yield* git(cwd, ["config", "commit.gpgsign", "false"]);
    return cwd;
  });
  const subject = "chore: re-request beep-reviewer (S32)";
  const oldReady = (cwd: string, branch: string) =>
    oldRunGitOutput(cwd, ["commit", "--allow-empty", "--only", "--no-verify", "-m", subject]).pipe(
      Effect.andThen(oldRunGitOutput(cwd, ["push", "origin", `HEAD:refs/heads/${branch}`])),
      Effect.asVoid
    );
  const newReady = (cwd: string, branch: string) =>
    Effect.gen(function* () {
      const g = yield* Git;
      yield* g
        .commit(cwd, subject, { allowEmpty: true, only: true, noVerify: true })
        .pipe(Effect.mapError(yeetGitKitError(GitCommand.commit(subject, false, true, false, undefined, true, true))));
      const refspec = `HEAD:refs/heads/${branch}`;
      const invocation = GitCommand.push("origin", refspec);
      yield* (yield* patientGit)
        .push(cwd, { remote: "origin", refspec })
        .pipe(
          Effect.mapError((error) =>
            error._tag === "NonFastForwardError"
              ? YeetCommandError.make({ message: "non-fast-forward", exitCode: 1 })
              : yeetGitKitError(invocation)(error)
          )
        );
    });
  const oldReadyClone = yield* readyClone("old-ready");
  const newReadyClone = yield* readyClone("new-ready");
  yield* compare(
    "readyGate.reviewerRequest",
    "push accepted",
    yield* yeetOutcome(oldReady(oldReadyClone, "old-ready")),
    yield* yeetOutcome(newReady(newReadyClone, "new-ready"))
  );
  // Both branches now carry a commit the other clone lacks; pushing from a stale head is a non-fast-forward.
  yield* git(oldReadyClone, ["reset", "--quiet", "--hard", "HEAD~1"]);
  yield* git(newReadyClone, ["reset", "--quiet", "--hard", "HEAD~1"]);
  yield* git(oldReadyClone, ["commit", "--quiet", "--allow-empty", "-m", "diverge"]);
  yield* git(newReadyClone, ["commit", "--quiet", "--allow-empty", "-m", "diverge"]);
  yield* compare(
    "readyGate.reviewerRequest",
    "push rejected as a non-fast-forward",
    yield* yeetOutcome(oldReady(oldReadyClone, "old-ready")),
    yield* yeetOutcome(newReady(newReadyClone, "new-ready"))
  );

  // PullRequest: push URL, merge base, changed paths.
  yield* compare(
    "pullRequest.remoteUrl",
    "origin present",
    yield* yeetOutcome(oldRunGitOutput(clone, ["remote", "get-url", "--push", "origin"]).pipe(Effect.map(Str.trim))),
    yield* yeetOutcome(
      Effect.flatMap(Git, (g) => g.remoteUrl(clone, { push: true })).pipe(
        Effect.mapBoth({
          onFailure: yeetGitKitError(GitCommand.remoteUrl("origin", true)),
          onSuccess: O.getOrElse(() => ""),
        })
      )
    )
  );
  yield* compare(
    "pullRequest.remoteUrl",
    "no origin remote",
    yield* yeetOutcome(oldRunGitOutput(seed, ["remote", "get-url", "--push", "origin"]).pipe(Effect.map(Str.trim))),
    yield* yeetOutcome(
      Effect.flatMap(Git, (g) => g.remoteUrl(seed, { push: true })).pipe(
        Effect.mapBoth({
          onFailure: yeetGitKitError(GitCommand.remoteUrl("origin", true)),
          onSuccess: O.getOrElse(() => ""),
        })
      )
    )
  );
  for (const [scenario, base] of [
    ["known base", "main"],
    ["unknown base", "nope"],
  ] as const) {
    yield* compare(
      "pullRequest.mergeBase",
      scenario,
      yield* plainOutcome(
        oldRunGitOutput(lane, ["merge-base", base, "HEAD"]).pipe(
          Effect.map(Str.trim),
          Effect.orElseSucceed(() => "")
        )
      ),
      yield* plainOutcome(
        Effect.flatMap(Git, (g) => g.mergeBase(lane, base, "HEAD")).pipe(Effect.orElseSucceed(() => ""))
      )
    );
    yield* compare(
      "pullRequest.changedPaths",
      scenario,
      yield* yeetOutcome(oldStatusPaths(lane, ["diff", "--name-only", "-z", `${base}...HEAD`])),
      yield* yeetOutcome(
        Effect.flatMap(Git, (g) => g.changedFiles(lane, { base, head: "HEAD" })).pipe(
          Effect.mapBoth({ onFailure: yeetGitKitError(GitCommand.changedFiles(base, "HEAD")), onSuccess: sortedUnique })
        )
      )
    );
  }

  // Status: staged, unstaged and untracked counts on a dirty and a clean tree, and outside a repository.
  for (const [scenario, cwd] of [
    ["dirty tree", dirty],
    ["clean tree", seed],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "status.worktree",
      scenario,
      yield* yeetOutcome(
        Effect.all([
          oldStatusPaths(cwd, ["diff", "--cached", "--name-only", "-z"]),
          oldStatusPaths(cwd, ["diff", "--name-only", "-z"]),
          oldStatusPaths(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
        ])
      ),
      yield* yeetOutcome(
        Effect.all([collectStagedPublishPaths(cwd), collectUnstagedTrackedPaths(cwd), collectUntrackedPaths(cwd)])
      )
    );
  }

  // Library inventory: an input root's commit.
  for (const [scenario, cwd] of [
    ["repository", seed],
    ["repository subdirectory", path.join(seed, "src")],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "library.repoCommit",
      scenario,
      yield* oldLibraryCommit(cwd),
      yield* Effect.flatMap(Git, (g) => g.revParse(cwd, "HEAD")).pipe(Effect.orElseSucceed(() => ""))
    );
  }
  yield* compare(
    "library.repoCommit",
    "input root that does not exist",
    yield* oldLibraryCommit(path.join(seed, "missing-dir")).pipe(Effect.orElseSucceed(() => "")),
    yield* Effect.flatMap(Git, (g) => g.revParse(path.join(seed, "missing-dir"), "HEAD")).pipe(
      Effect.orElseSucceed(() => "")
    )
  );

  // ai-metrics config snapshot: the tracked paths of a repository whose paths carry spaces, from its root and a
  // subdirectory, and of an index with an unmerged path.
  const conflicted = path.join(root, "conflicted");
  yield* git(root, ["clone", "--quiet", seed, conflicted]);
  yield* git(conflicted, ["checkout", "--quiet", "-b", "left"]);
  yield* write(conflicted, "README.md", "left\n");
  yield* commitAll(conflicted, "left");
  yield* git(conflicted, ["checkout", "--quiet", "main"]);
  yield* write(conflicted, "README.md", "right\n");
  yield* commitAll(conflicted, "right");
  yield* runRepoCommandCapture(
    "git",
    ["-c", "user.email=w2b@example.com", "-c", "user.name=W2b", "merge", "left"],
    conflicted
  ).pipe(Effect.ignore);
  for (const [scenario, cwd] of [
    ["repository with a space in a path", seed],
    ["subdirectory", path.join(seed, "src")],
    ["index with an unmerged path", conflicted],
  ] as const) {
    yield* compare(
      "configSnapshot.lsFiles",
      scenario,
      yield* oldLsFiles(cwd),
      yield* Effect.flatMap(Git, (g) => g.lsFiles(cwd)).pipe(
        Effect.map(A.map((entry) => entry.path)),
        Effect.orElseSucceed(() => ["<failed>"])
      )
    );
  }

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/yeet-remainder-differential-w2b.ts",
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
  Layer.build(
    Layer.provideMerge(Git.layerWith(GitOptions.make({})), Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
  ).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
