/**
 * W1b differential: Yeet's own git spawns on `@beep/git` against the hand-rolled bodies they replace.
 *
 * W1b of `goals/repo-cli-gh-git-consolidation` moves Yeet's git layer onto `Git` members:
 * `Yeet/internal/GitExec.ts` `refreshBaseRef` -> `Git.fetch({ remote: "origin", ref: "refs/heads/<b>:refs/remotes/origin/<b>" })`
 * for an `origin/<b>` base and `Git.revParse(base)` otherwise; `currentCommitSha` -> `Git.revParse("HEAD")`; the
 * is-ancestor probes of `FinalCheckRefresh.ts` (`isAncestor`) and `Sweep.ts` (`branchMergedIntoBase`) ->
 * `Git.isAncestor` folded to `false` on any failure; `HeadInstallPreflight.ts` `worktree add --detach`,
 * `worktree remove --force` and `worktree prune` -> `Git.worktreeAdd({ ref: "HEAD", detach: true })`,
 * `Git.worktreeRemove({ force: true })` and `Git.worktreePrune`, read back onto the capture's exit view through
 * `captureGitKitExit`. Every exported name keeps its `YeetCommandError` wording; the kit's errors fold through W1a's
 * `adaptGitKitError`. `lockfileChangedSinceBase` stays on the capture (no `changedFiles` pathspec until W2) and is not
 * exercised here.
 *
 * Each pre-W1b body is frozen below as `old*` (from feat/gh-git-w1-sites-v2 ba4bf22d2a), running the same git argv
 * through the repo-run capture it used. Every scenario builds a real scratch repository, runs the old body and the
 * shipped reader on the same state, and compares the normalized outcomes. The command line is deliberately NOT part of
 * the outcome: the kit's argv differs from the frozen argv by design (`fetch` without `--quiet --no-tags`,
 * `rev-parse --verify` for `HEAD`), and that shift is recorded in SPEC D-09, not re-derived here. A difference is
 * either classified (an intended divergence named in D-09 with a witness scenario) or unclassified; the gate is zero
 * unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/yeet-git-differential-w1b.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constFalse } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import {
  captureGitKitExit,
  currentCommitSha,
  refreshBaseRef,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import { YeetCommandError } from "../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { runGitOutput } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { RepoRunContext } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

/** Everything either body may need: the frozen capture's spawner and crypto, the shipped readers' `Git`. */
type Services = Git | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom;

// --- pre-W1b bodies (frozen, behaviour-for-behaviour, from ba4bf22d2a) ------------------------------------------

// Yeet's git error adapter, verbatim (Yeet/internal/GitExec.ts; not exported).
const oldGitErrorAdapter: GitCommandErrorAdapter<YeetCommandError> = {
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

const oldRunGitOutput = (cwd: string, args: ReadonlyArray<string>) => runGitOutput(cwd, args, oldGitErrorAdapter);

// The unsafe-ref and option-like checks are shared pre-spawn logic (unchanged by W1b); only the spawn differs, so the
// frozen body takes the already-validated origin branch or the raw non-origin base.
const oldRefreshOriginBase = (cwd: string, branch: string) =>
  oldRunGitOutput(cwd, [
    "fetch",
    "--quiet",
    "--no-tags",
    "origin",
    `refs/heads/${branch}:refs/remotes/origin/${branch}`,
  ]).pipe(Effect.asVoid);
const oldRefreshPlainBase = (cwd: string, base: string) =>
  oldRunGitOutput(cwd, ["rev-parse", "--verify", "--end-of-options", base]).pipe(Effect.asVoid);
const oldCurrentCommitSha = (cwd: string) => oldRunGitOutput(cwd, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim));
// FinalCheckRefresh `isAncestor` and the Sweep ancestry probe both read exit 0 as "ancestor" and anything else as false.
const oldIsAncestor = (cwd: string, ancestor: string, head: string) =>
  oldRunGitOutput(cwd, ["merge-base", "--is-ancestor", ancestor, head]).pipe(
    Effect.as(true),
    Effect.orElseSucceed(constFalse)
  );
const oldWorktreeAdd = (cwd: string, checkout: string) =>
  runRepoCommandCapture("git", ["worktree", "add", "--detach", checkout, "HEAD"], cwd).pipe(
    Effect.mapError(YeetCommandError.new("Failed to create the clean-HEAD preflight worktree.")),
    Effect.map((result) => ({ exitCode: result.exitCode, output: result.output }))
  );
const oldWorktreeRemove = (cwd: string, checkout: string) =>
  runRepoCommandCapture("git", ["worktree", "remove", "--force", checkout], cwd).pipe(
    Effect.map((result) => result.exitCode),
    Effect.option
  );
// The preflight ignores the prune's outcome; what it relies on is the registration list afterwards.
const oldWorktreePrune = (cwd: string) => runRepoCommandCapture("git", ["worktree", "prune"], cwd).pipe(Effect.ignore);

// --- the shipped bodies ----------------------------------------------------------------------------------------

const newRefreshBaseRef = (cwd: string, base: string) => refreshBaseRef(cwd, base);
const newCurrentCommitSha = (cwd: string) =>
  currentCommitSha(
    RepoRunContext.make({
      base: "origin/main",
      branch: "main",
      cwd,
      head: "HEAD",
      originalArgv: [],
      packetDir: cwd,
      repoRoot: cwd,
      turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
    })
  );
// The expression FinalCheckRefresh.ts and Sweep.ts ship (neither exports its probe).
const newIsAncestor = (cwd: string, ancestor: string, head: string) =>
  Effect.flatMap(Git, (git) => git.isAncestor(cwd, ancestor, head)).pipe(Effect.orElseSucceed(constFalse));
// The expressions HeadInstallPreflight.ts ships.
const newWorktreeAdd = (cwd: string, checkout: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .worktreeAdd(cwd, checkout, { ref: "HEAD", detach: true })
      .pipe(
        captureGitKitExit(
          GitCommand.worktreeAdd(checkout, "HEAD", true),
          "Failed to create the clean-HEAD preflight worktree."
        )
      )
  );
const newWorktreeRemove = (cwd: string, checkout: string) =>
  Effect.flatMap(Git, (git) =>
    git.worktreeRemove(cwd, checkout, { force: true }).pipe(
      captureGitKitExit(GitCommand.worktreeRemove(checkout, true), "Failed to run git worktree remove."),
      Effect.map((exit) => exit.exitCode),
      Effect.option
    )
  );
const newWorktreePrune = (cwd: string) => Effect.flatMap(Git, (git) => git.worktreePrune(cwd)).pipe(Effect.ignore);

// --- normalization ---------------------------------------------------------------------------------------------

/** A `YeetCommandError` reduced to what Yeet's callers branch on: whether git ran, and its exit code when it did. */
const yeetFailure = (error: YeetCommandError) =>
  O.match(O.fromUndefinedOr(error.exitCode), {
    onNone: () => ({ _tag: "spawn-failure" as const }),
    onSome: (exitCode) => ({ _tag: "exit" as const, exitCode }),
  });

const same = (value: unknown): unknown => value;

/** Runs one body to a JSON-comparable value: its success, or the Yeet failure it surfaced. */
const outcomeOf = <A>(body: Effect.Effect<A, YeetCommandError, Services>, view: (value: A) => unknown) =>
  body.pipe(
    Effect.map((value) => ({ ok: view(value) })),
    Effect.catch((failure) => Effect.succeed({ failed: yeetFailure(failure) }))
  );

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

/** A fixture read that may legitimately fail (an absent ref): the trimmed output, or `None`. */
const gitOption = (cwd: string, args: ReadonlyArray<string>) =>
  runRepoCommandCapture("git", args, cwd).pipe(
    Effect.map((result) => (result.exitCode === 0 ? O.some(Str.trim(result.output)) : O.none<string>())),
    Effect.orElseSucceed(O.none<string>)
  );

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
    "user.email=w1b@example.com",
    "-c",
    "user.name=W1b",
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

// Intended divergences, each recorded in SPEC.md's Decision Log (D-09) with these witness scenarios.
const NO_TAGS =
  "D-09: Git.fetch has no --no-tags, so a tag pointing into the fetched history is auto-followed where the frozen fetch left the clone tagless";
const REFUSED =
  "D-09: an option-like ref is refused before any spawn (onSpawnFailure) instead of being shielded by --end-of-options";
const NO_TRANSCRIPT =
  "D-09: Git.worktreeAdd surfaces no transcript on a zero exit, so the rendered block carries only its header line";
const TYPED_TEXT =
  "D-09: an unknown ref or a non-repository cwd keeps exit 128 but the rendered text is the kit's typed message, not git's stderr";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["refreshBaseRef", "origin base with a tag on the fetched history", NO_TAGS],
  ["refreshBaseRef", "option-like plain base", REFUSED],
  ["worktreeAdd", "fresh path", NO_TRANSCRIPT],
  ["worktreeAdd", "outside a repository", TYPED_TEXT],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w1b-differential-" });
  const rows: Array<Row> = [];
  const compare = <A, B>(
    site: string,
    scenario: string,
    oldBody: Effect.Effect<A, YeetCommandError, Services>,
    newBody: Effect.Effect<B, YeetCommandError, Services>,
    oldView: (value: A) => unknown = same,
    newView: (value: B) => unknown = same
  ) =>
    Effect.gen(function* () {
      const oldValue = yield* outcomeOf(oldBody, oldView);
      const newValue = yield* outcomeOf(newBody, newView);
      rows.push({ site, scenario, old: oldValue, new: newValue });
    });

  // A bare origin with two commits on main and a tag on its tip; a feature branch off the first commit.
  const seed = path.join(root, "seed");
  yield* initRepo(seed);
  yield* write(seed, "README.md", "seed\n");
  const c1 = yield* commitAll(seed, "c1");
  yield* git(seed, ["branch", "feature"]);
  yield* write(seed, "README.md", "seed\nmore\n");
  const c2 = yield* commitAll(seed, "c2");
  yield* git(seed, ["tag", "v1"]);
  const origin = path.join(root, "origin.git");
  yield* git(root, ["clone", "--quiet", "--bare", `file://${seed}`, origin]);
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);
  const missing = Str.repeat(40)("0");

  // refreshBaseRef: each body gets its own clone of identical state, since a fetch mutates the clone. The outcome
  // carries the side effects Yeet relies on (the remote-tracking ref) and the one it never asked for (tags).
  const freshClone = Effect.fnUntraced(function* (name: string) {
    const cwd = path.join(root, name);
    yield* initRepo(cwd);
    yield* git(cwd, ["remote", "add", "origin", origin]);
    return cwd;
  });
  const fetchState = (cwd: string, branch: string) =>
    Effect.all({
      trackingRef: gitOption(cwd, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`]),
      tags: gitOption(cwd, ["tag", "--list"]),
    });
  const compareFetch = Effect.fnUntraced(function* (scenario: string, branch: string) {
    const oldClone = yield* freshClone(`old-${Str.replaceAll(" ", "-")(scenario)}`);
    const newClone = yield* freshClone(`new-${Str.replaceAll(" ", "-")(scenario)}`);
    yield* compare(
      "refreshBaseRef",
      scenario,
      oldRefreshOriginBase(oldClone, branch).pipe(Effect.andThen(fetchState(oldClone, branch))),
      newRefreshBaseRef(newClone, `origin/${branch}`).pipe(Effect.andThen(fetchState(newClone, branch)))
    );
  });
  yield* compareFetch("origin base with a tag on the fetched history", "main");
  yield* compareFetch("origin base on an untagged branch", "feature");
  yield* compareFetch("origin base missing on the remote", "nope");
  const noRemote = path.join(root, "no-remote");
  yield* initRepo(noRemote);
  yield* compare(
    "refreshBaseRef",
    "origin base without a remote",
    oldRefreshOriginBase(noRemote, "main"),
    newRefreshBaseRef(noRemote, "origin/main")
  );
  const plainCases: ReadonlyArray<readonly [string, string, string]> = [
    ["plain base on a branch", seed, "feature"],
    ["plain base as a sha", seed, c1],
    ["unknown plain base", seed, "nope"],
    ["option-like plain base", seed, "--all"],
    ["plain base outside a repository", plain, "main"],
  ];
  for (const [scenario, cwd, base] of plainCases) {
    yield* compare("refreshBaseRef", scenario, oldRefreshPlainBase(cwd, base), newRefreshBaseRef(cwd, base));
  }

  // currentCommitSha: on a branch, detached, unborn, outside.
  const detached = path.join(root, "detached");
  yield* git(root, ["clone", "--quiet", `file://${seed}`, detached]);
  yield* git(detached, ["checkout", "--quiet", "--detach", c1]);
  const unborn = path.join(root, "unborn");
  yield* initRepo(unborn);
  const shaCases: ReadonlyArray<readonly [string, string]> = [
    ["on a branch", seed],
    ["detached HEAD", detached],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ];
  for (const [scenario, cwd] of shaCases) {
    yield* compare("currentCommitSha", scenario, oldCurrentCommitSha(cwd), newCurrentCommitSha(cwd));
  }

  // isAncestor (FinalCheckRefresh.isAncestor and Sweep.branchMergedIntoBase share the boolean fold).
  const ancestorCases: ReadonlyArray<readonly [string, string, string, string]> = [
    ["ancestor", seed, c1, c2],
    ["itself", seed, c2, c2],
    ["non-ancestor", seed, c2, c1],
    ["unknown object", seed, missing, c2],
    ["unknown ref", seed, "refs/heads/nope", c2],
    ["option-like ref", seed, "--all", c2],
    ["outside a repository", plain, c1, c2],
  ];
  for (const [scenario, cwd, ancestor, head] of ancestorCases) {
    yield* compare("isAncestor", scenario, oldIsAncestor(cwd, ancestor, head), newIsAncestor(cwd, ancestor, head));
  }

  // HeadInstallPreflight: add a detached HEAD checkout, remove it with --force, prune. Each body gets its own
  // worktree path; the add outcome is the exit view the step result renders, with the checkout path normalized.
  const exitView =
    (checkout: string) =>
    ({ exitCode, output }: { readonly exitCode: number; readonly output: string }) => ({
      exitCode,
      output: Str.replaceAll(checkout, "<checkout>")(Str.trim(output)),
    });
  const oldFresh = path.join(root, "old-checkout");
  const newFresh = path.join(root, "new-checkout");
  yield* compare(
    "worktreeAdd",
    "fresh path",
    oldWorktreeAdd(seed, oldFresh),
    newWorktreeAdd(seed, newFresh),
    exitView(oldFresh),
    exitView(newFresh)
  );
  const occupied = path.join(root, "occupied");
  yield* write(occupied, "keep.txt", "occupied\n");
  yield* compare(
    "worktreeAdd",
    "path already exists",
    oldWorktreeAdd(seed, occupied),
    newWorktreeAdd(seed, occupied),
    exitView(occupied),
    exitView(occupied)
  );
  const oldUnbornCheckout = path.join(root, "old-unborn-checkout");
  const newUnbornCheckout = path.join(root, "new-unborn-checkout");
  yield* compare(
    "worktreeAdd",
    "unborn repository",
    oldWorktreeAdd(unborn, oldUnbornCheckout),
    newWorktreeAdd(unborn, newUnbornCheckout),
    exitView(oldUnbornCheckout),
    exitView(newUnbornCheckout)
  );
  const oldPlainCheckout = path.join(root, "old-plain-checkout");
  const newPlainCheckout = path.join(root, "new-plain-checkout");
  yield* compare(
    "worktreeAdd",
    "outside a repository",
    oldWorktreeAdd(plain, oldPlainCheckout),
    newWorktreeAdd(plain, newPlainCheckout),
    exitView(oldPlainCheckout),
    exitView(newPlainCheckout)
  );
  // Removal: the worktrees the fresh adds registered (dirtied first, since --force is the designed teardown), an
  // unregistered directory, a path that was never created, and a non-repository.
  yield* write(oldFresh, "scratch.txt", "dirty\n");
  yield* write(newFresh, "scratch.txt", "dirty\n");
  yield* compare(
    "worktreeRemove",
    "registered dirty worktree",
    oldWorktreeRemove(seed, oldFresh),
    newWorktreeRemove(seed, newFresh)
  );
  yield* compare(
    "worktreeRemove",
    "unregistered directory",
    oldWorktreeRemove(seed, occupied),
    newWorktreeRemove(seed, occupied)
  );
  yield* compare(
    "worktreeRemove",
    "never created",
    oldWorktreeRemove(seed, path.join(root, "never")),
    newWorktreeRemove(seed, path.join(root, "never"))
  );
  yield* compare(
    "worktreeRemove",
    "outside a repository",
    oldWorktreeRemove(plain, oldPlainCheckout),
    newWorktreeRemove(plain, newPlainCheckout)
  );
  // Prune: a registration whose directory vanished, nothing to prune, outside a repository. The outcome is the
  // registration list the prune leaves behind (each body prunes its own vanished worktree).
  const worktreeListing = (cwd: string) =>
    gitOption(cwd, ["worktree", "list", "--porcelain"]).pipe(
      Effect.map(O.map(Str.replaceAll(/(old|new)-gone/g, "<gone>")))
    );
  const comparePrune = (scenario: string, cwd: string) =>
    compare(
      "worktreePrune",
      scenario,
      oldWorktreePrune(cwd).pipe(Effect.andThen(worktreeListing(cwd))),
      newWorktreePrune(cwd).pipe(Effect.andThen(worktreeListing(cwd)))
    );
  for (const name of ["old-gone", "new-gone"]) {
    const gone = path.join(root, name);
    yield* git(seed, ["worktree", "add", "--quiet", "--detach", gone]);
    yield* fs.remove(gone, { recursive: true });
  }
  yield* comparePrune("vanished worktree directories", seed);
  yield* comparePrune("nothing to prune", seed);
  yield* comparePrune("outside a repository", plain);

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/yeet-git-differential-w1b.ts",
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
