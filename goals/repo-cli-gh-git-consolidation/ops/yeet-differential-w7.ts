/**
 * W7a differential: the Yeet git sites the W7 census lists (rows Y1-Y65), on `@beep/git`, against the pre-W7 bodies
 * they replace.
 *
 * W7a of `goals/repo-cli-gh-git-consolidation` moves Yeet's remaining `runGitOutput`/`runGitPathList` and
 * `runRepoCommandCapture("git", ...)` reads and mutations onto `Git` members (SPEC D-18): PublishScope's stash, base
 * freshness, upstream, existing-commit and restage reads; Handler's proof base and merge-only guard; FinalCheck and
 * FinalCheckRefresh's heads, merge bases, changed paths and counts; ProofState's origin URL and status fingerprint;
 * Provenance's common dir, top level and workspace label; ExpectationRewrite's per-file diff, modified-file list and
 * merge-base worktree; HeadInstallReceipt's tree and listing; MergedPreview's heads and merge-tree; GateStaleness,
 * PortfolioIndexGuard, ProvenanceFooter, PullRequestTitle, PullRequest's body log, Yeet.command's detached-job
 * coordinates and Sweep's ls-remote and fetch --prune.
 *
 * The pre-W7 bodies are frozen under `ops/frozen-w7a/` (from the lane base 8602b24203), with the retiring Yeet runners
 * inlined over the StepExec captures that survive the runner retirement (`frozen-w7a/GitRunners.old.ts`). Bodies the
 * site does not export are frozen inline below, beside the expression the site now ships ("frozen expression" /
 * "shipped expression"). Every scenario builds twin scratch repositories from one builder, runs the old body on one
 * and the shipped body on the other, and compares what the caller reads, never the command line (the kit's argv
 * differs by design, D-18). A difference is classified (an intended divergence named in D-18 with this scenario as
 * its witness) or unclassified; the gate is zero unclassified.
 *
 * Commit dates and identities are pinned through the environment, so twin repositories carry identical object ids.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/yeet-differential-w7.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git, GitOptions } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { runToExit } from "@beep/repo-cli-kit/process/StepExec";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { PORTFOLIO_INDEX_PATH } from "../../../packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts";
import { collectExpectationRewrites } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ExpectationRewrite.ts";
import { collectYeetGateInputPaths } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts";
import { yeetGitOutputErrorAdapter } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitErrorAdapter.ts";
import {
  captureGitKitExit,
  changedYeetPaths,
  countYeetRevisions,
  resolveYeetMergeBase,
  resolveYeetRev,
  YeetChangedPathsQuery,
  yeetGitKitError,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import { assertMergeOnlyPublish } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts";
import { collectHeadInstallInputs } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallReceipt.ts";
import { createYeetMergePreview } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts";
import {
  collectDiffFingerprint,
  proofLockPathForContext,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts";
import {
  assessBaseFreshness,
  collectPublishIntent,
  restoreStashedWorktree,
  stageReviewedPublishIntent,
  stashUnstagedWorktree,
  warnOnMismatchedPublishUpstream,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts";
import { buildPrBody } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts";
import { resolvePullRequestTitle } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequestTitle.ts";
import { sweepProbeFromGit } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts";
import { YeetStagedPublishIntent } from "../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts";
import { adaptGitKitError } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import { patientGit } from "../../../packages/tooling/tool/cli/src/internal/repo-run/PatientGit.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { RepoRunContext } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
import { oldCollectExpectationRewrites } from "./frozen-w7a/ExpectationRewrite.old.ts";
import { oldCollectYeetGateInputPaths } from "./frozen-w7a/GateStaleness.old.ts";
import { oldRunGitOutput, oldRunGitPathList } from "./frozen-w7a/GitRunners.old.ts";
import { oldAssertMergeOnlyPublish } from "./frozen-w7a/Handler.old.ts";
import { oldCollectHeadInstallInputs } from "./frozen-w7a/HeadInstallReceipt.old.ts";
import { oldCreateYeetMergePreview } from "./frozen-w7a/MergedPreview.old.ts";
import { oldCollectDiffFingerprint, oldProofLockPathForContext } from "./frozen-w7a/ProofState.old.ts";
import {
  oldAssessBaseFreshness,
  oldCollectExistingCommitPublishIntent,
  oldRestoreStashedWorktree,
  oldStageReviewedPublishIntent,
  oldStashUnstagedWorktree,
  oldWarnOnMismatchedPublishUpstream,
} from "./frozen-w7a/PublishScope.old.ts";
import { oldBuildPrBody } from "./frozen-w7a/PullRequest.old.ts";
import { oldResolvePullRequestTitle } from "./frozen-w7a/PullRequestTitle.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  YeetExecutedStep,
  YeetStashState,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts";
import type { YeetCommandError } from "../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import type { GitCommandErrorAdapter } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

type Services = ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path;

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

// Pinned identity and dates: twin repositories built by one builder carry identical object ids, and the merge
// preview's `commit-tree` writes the same commit on both sides.
for (const [key, value] of [
  ["GIT_CONFIG_NOSYSTEM", "1"],
  ["GIT_CONFIG_GLOBAL", "/dev/null"],
  ["GIT_AUTHOR_NAME", "W7a Differential"],
  ["GIT_AUTHOR_EMAIL", "w7a@example.invalid"],
  ["GIT_COMMITTER_NAME", "W7a Differential"],
  ["GIT_COMMITTER_EMAIL", "w7a@example.invalid"],
  ["GIT_AUTHOR_DATE", "2026-11-03T00:00:00Z"],
  ["GIT_COMMITTER_DATE", "2026-11-03T00:00:00Z"],
] as const)
  process.env[key] = value;

const contextFor = (cwd: string, base = "origin/main", branch = "feature"): RepoRunContext =>
  RepoRunContext.make({
    base,
    branch,
    cwd,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: cwd,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

// --- normalization ---------------------------------------------------------------------------------------------

type Row = { readonly site: string; readonly scenario: string; readonly old: unknown; readonly new: unknown };
type Verdict = { readonly verdict: string };
type Classified = Row & Verdict;

const show = (value: unknown): string => JSON.stringify(value);

// A Yeet failure reads as its exit code, its message only where the message is the caller's own wording (not a
// command line, whose argv the kit changes by design).
const failureOf = (error: YeetCommandError, keepMessage: boolean) =>
  keepMessage ? { message: error.message } : { exitCode: error.exitCode ?? "none" };
const outcome = <A, R>(effect: Effect.Effect<A, YeetCommandError, R>, keepMessage = false) =>
  effect.pipe(
    Effect.map((ok) => ({ ok })),
    Effect.catch((error) => Effect.succeed({ failed: failureOf(error, keepMessage) }))
  );
// What a run printed to stderr, through a fresh test console.
const errorLinesOf = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* effect.pipe(Effect.ignore);
    // The stash marker carries the park instant, which differs between twins.
    return A.map(yield* TestConsole.errorLines, (line) =>
      Str.replace(/yeet-staged-only\/[^"]+/gu, "<marker>")(String(line))
    );
  }).pipe(Effect.provide(TestConsole.layer));

// The scenarios whose old and new outcomes differ by design (D-18); each one is the named divergence's witness.
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  [
    "publishScope.restore",
    "re-dirtied path conflicts with the stash",
    "D-18 (b): the warning names the kit's stash failure where it named the `git stash pop stash@{0}` capture; the residue stays parked under the marker on both sides",
  ],
  [
    "publishScope.upstream",
    "tracks a configured but gone origin/other",
    "D-18 (c): `for-each-ref %(upstream)` reads the configured upstream where `rev-parse @{u}` failed on a gone one, so the mismatch warning now names it",
  ],
  [
    "proofState.fingerprint",
    "a non-ASCII and a spaced path",
    "D-18 (d): porcelain v1 lines carry raw paths where `status --short` quoted them, so the fingerprint bytes change once",
  ],
  [
    "proofState.fingerprint",
    "staged and unstaged edits with a rename and an untracked file",
    "D-18 (d): the merged capture trimmed the first status line's leading space (` M README.md` read `M README.md`); the porcelain v1 lines keep it, so the fingerprint bytes change once",
  ],
  [
    "proofState.fingerprint",
    "status.branch=true",
    "D-18 (d): `status --short` honoured `status.branch` and printed a `##` header; the kit's porcelain read has none",
  ],
  [
    "headInstall.inputs",
    "a manifest under a non-ASCII directory",
    "D-18 (e): `ls-tree -z` gives the raw path where the unquoted listing quoted it, so the manifest is now an install input",
  ],
  [
    "prTitle.resolve",
    "a subject past 512 KiB",
    "D-18 (f): `Git.log` reads under the kit's 16 MiB bound where the merged 512 KiB capture failed",
  ],
  [
    "publishScope.existingCommit",
    "nothing ahead of the base",
    "D-18 (g): the private existing-commit read answered none; the exported `collectPublishIntent` the differential reaches turns that none into its own refusal",
  ],
  [
    "provenance.gitPaths",
    "a subdirectory of the primary clone",
    "D-18 (h): `commonDir` is absolute; the cwd-relative `--git-common-dir` answer was resolved against the checkout root, which named the wrong clone from a subdirectory",
  ],
];

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-differential-w7-" });
  const rows: Array<Row> = [];
  const compare = (site: string, scenario: string, old: unknown, next: unknown) =>
    Effect.sync(() => rows.push({ site, scenario, old, new: next }));

  let counter = 0;
  const fresh = (label: string) => Effect.sync(() => path.join(root, `${label}-${(counter += 1)}`));
  const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("git", args, cwd).pipe(Effect.orDie);
    if (result.exitCode !== 0) return yield* Effect.die(`git ${A.join(args, " ")} failed in ${cwd}: ${result.output}`);
    return Str.trim(result.output);
  });
  const gitTry = (cwd: string, args: ReadonlyArray<string>) =>
    runRepoCommandCapture("git", args, cwd).pipe(
      Effect.map((result) => ({ exitCode: result.exitCode, output: Str.trim(result.output) })),
      Effect.orDie
    );
  const write = (cwd: string, file: string, text: string) =>
    Effect.gen(function* () {
      yield* fs.makeDirectory(path.dirname(path.join(cwd, file)), { recursive: true });
      yield* fs.writeFileString(path.join(cwd, file), text);
    }).pipe(Effect.orDie);
  const commitAll = (cwd: string, message: string) =>
    Effect.gen(function* () {
      yield* git(cwd, ["add", "-A"]);
      yield* git(cwd, ["commit", "--quiet", "--no-verify", "--allow-empty", "-m", message]);
    });

  // An origin with main (README.md, src/a.ts) and a work clone on `feature`, branched from origin/main.
  const world = Effect.fnUntraced(function* () {
    const dir = yield* fresh("world");
    const seed = path.join(dir, "seed");
    const origin = path.join(dir, "origin.git");
    const work = path.join(dir, "work");
    yield* fs.makeDirectory(seed, { recursive: true }).pipe(Effect.orDie);
    yield* git(seed, ["init", "--quiet", "--template=", "--initial-branch=main", "."]);
    yield* write(seed, "README.md", "seed\n");
    yield* write(seed, "src/a.ts", "export const a = 1;\n");
    yield* commitAll(seed, "seed");
    yield* git(dir, ["clone", "--quiet", "--bare", seed, origin]);
    yield* git(dir, ["clone", "--quiet", origin, work]);
    yield* git(work, ["switch", "--quiet", "-c", "feature", "origin/main"]);
    return { dir, seed, origin, work };
  });
  // Advance origin/main by one commit touching `file`, and refresh the work clone's tracking ref.
  const advanceOrigin = Effect.fnUntraced(function* (w: { seed: string; origin: string; work: string }, file: string) {
    yield* write(w.seed, file, `${file} on main\n`);
    yield* commitAll(w.seed, `main: ${file}`);
    yield* git(w.seed, ["push", "--quiet", w.origin, "main"]);
    yield* git(w.work, ["fetch", "--quiet", "origin"]);
  });
  const twin = <A, E, R>(build: Effect.Effect<A, E, R>) => Effect.all([build, build]);
  const statusOf = (cwd: string) => git(cwd, ["status", "--porcelain", "--untracked-files=all"]);

  // --- PublishScope (Y1-Y16) ------------------------------------------------------------------------------------

  const dirtyWorld = Effect.gen(function* () {
    const w = yield* world();
    yield* write(w.work, "staged.txt", "staged\n");
    yield* git(w.work, ["add", "staged.txt"]);
    yield* write(w.work, "README.md", "edited\n");
    yield* write(w.work, "untracked.txt", "untracked\n");
    return w;
  });
  const parkedState = (cwd: string, parked: O.Option<YeetStashState>) =>
    Effect.gen(function* () {
      const top = yield* gitTry(cwd, ["rev-parse", "stash@{0}"]);
      return {
        parked: O.isSome(parked),
        stashShaIsTop: O.exists(parked, (state) => state.stashSha === top.output),
        status: yield* statusOf(cwd),
      };
    });
  for (const [scenario, build] of [
    ["unstaged and untracked residue beside a staged path", dirtyWorld],
    ["clean worktree", world()],
  ] as const) {
    const [left, right] = yield* twin(build);
    yield* compare(
      "publishScope.stash",
      scenario,
      yield* oldStashUnstagedWorktree(contextFor(left.work)).pipe(
        Effect.flatMap((parked) => parkedState(left.work, parked)),
        outcome
      ),
      yield* stashUnstagedWorktree(contextFor(right.work)).pipe(
        Effect.flatMap((parked) => parkedState(right.work, parked)),
        outcome
      )
    );
  }

  // Restore: park with the shipped body on both twins, then restore with each side's body.
  const restoreCase = Effect.fnUntraced(function* (
    tweak: (cwd: string, state: YeetStashState) => Effect.Effect<YeetStashState, never, Services>
  ) {
    const w = yield* dirtyWorld;
    const parked = O.getOrThrow(yield* stashUnstagedWorktree(contextFor(w.work)).pipe(Effect.orDie));
    return { w, state: yield* tweak(w.work, parked) };
  });
  const restoreState = (cwd: string) =>
    Effect.gen(function* () {
      return { status: yield* statusOf(cwd), stashes: (yield* git(cwd, ["stash", "list"])).split("\n").length };
    });
  const tweaks: ReadonlyArray<
    readonly [string, (cwd: string, state: YeetStashState) => Effect.Effect<YeetStashState, never, Services>]
  > = [
    ["recorded stash", (_cwd: string, state: YeetStashState) => Effect.succeed(state)],
    [
      "stash dropped before the restore",
      (cwd: string, state: YeetStashState) => git(cwd, ["stash", "drop", "--quiet"]).pipe(Effect.as(state)),
    ],
    [
      "re-dirtied path conflicts with the stash",
      (cwd: string, state: YeetStashState) => write(cwd, "README.md", "dirtied again\n").pipe(Effect.as(state)),
    ],
  ];
  for (const [scenario, tweak] of tweaks) {
    const [left, right] = yield* twin(restoreCase(tweak));
    const oldLines = yield* errorLinesOf(oldRestoreStashedWorktree(contextFor(left.w.work), left.state));
    const newLines = yield* errorLinesOf(restoreStashedWorktree(contextFor(right.w.work), right.state));
    yield* compare(
      "publishScope.restore",
      scenario,
      { warnings: oldLines, ...(yield* restoreState(left.w.work)) },
      { warnings: newLines, ...(yield* restoreState(right.w.work)) }
    );
  }

  // Base freshness: behind with an overlapping path, up to date, and no merge base.
  const behindWorld = Effect.gen(function* () {
    const w = yield* world();
    yield* write(w.work, "src/a.ts", "export const a = 2;\n");
    yield* commitAll(w.work, "feature: a");
    yield* advanceOrigin(w, "src/a.ts");
    return w;
  });
  for (const [scenario, build, base] of [
    ["behind with an overlapping path", behindWorld, "origin/main"],
    ["up to date", world(), "origin/main"],
    ["no merge base with an unknown base", world(), "nope"],
  ] as const) {
    const [left, right] = yield* twin(build);
    yield* compare(
      "publishScope.baseFreshness",
      scenario,
      yield* outcome(oldAssessBaseFreshness(contextFor(left.work, base)), true),
      yield* outcome(assessBaseFreshness(contextFor(right.work, base)), true)
    );
  }

  // Upstream: the mismatch warning each body prints.
  const upstreamWorld = (configure: (w: { work: string; origin: string }) => Effect.Effect<void, never, Services>) =>
    Effect.gen(function* () {
      const w = yield* world();
      yield* configure(w);
      return w;
    });
  const configurations: ReadonlyArray<
    readonly [string, (w: { work: string; origin: string }) => Effect.Effect<void, never, Services>]
  > = [
    ["tracks origin/main", () => Effect.void],
    [
      "tracks origin/feature",
      (w: { work: string }) =>
        Effect.gen(function* () {
          yield* git(w.work, ["push", "--quiet", "-u", "origin", "feature"]);
        }),
    ],
    [
      "no upstream",
      (w: { work: string }) => git(w.work, ["branch", "--quiet", "--unset-upstream"]).pipe(Effect.asVoid),
    ],
    ["detached HEAD", (w: { work: string }) => git(w.work, ["switch", "--quiet", "--detach"]).pipe(Effect.asVoid)],
    [
      "tracks a configured but gone origin/other",
      (w: { work: string }) => git(w.work, ["config", "branch.feature.merge", "refs/heads/other"]).pipe(Effect.asVoid),
    ],
  ];
  for (const [scenario, configure] of configurations) {
    const [left, right] = yield* twin(upstreamWorld(configure));
    yield* compare(
      "publishScope.upstream",
      scenario,
      yield* errorLinesOf(oldWarnOnMismatchedPublishUpstream(contextFor(left.work))),
      yield* errorLinesOf(warnOnMismatchedPublishUpstream(contextFor(right.work)))
    );
  }

  // Existing-commit publish intent on a clean tree.
  const existingWorld = (push: boolean, commits: boolean) =>
    Effect.gen(function* () {
      const w = yield* world();
      if (push) yield* git(w.work, ["push", "--quiet", "-u", "origin", "feature"]);
      if (commits) {
        yield* write(w.work, "src/b.ts", "export const b = 1;\n");
        yield* commitAll(w.work, "feature: b");
      }
      return w;
    });
  for (const [scenario, build] of [
    ["pushed branch one commit ahead of origin/feature", existingWorld(true, true)],
    ["unpushed branch ahead of the base", existingWorld(false, true)],
    ["nothing ahead of the base", existingWorld(false, false)],
  ] as const) {
    const [left, right] = yield* twin(build);
    const oldIntent = yield* oldCollectExistingCommitPublishIntent(contextFor(left.work)).pipe(
      Effect.map(
        O.match({ onNone: () => "none", onSome: (intent) => ({ sha: intent.commitSha, paths: intent.paths }) })
      ),
      outcome
    );
    const newIntent = yield* collectPublishIntent(contextFor(right.work), false).pipe(
      Effect.map((intent) =>
        intent.kind === "existing-commit" ? { sha: intent.commitSha, paths: intent.paths } : intent.kind
      ),
      (effect) => outcome(effect, true)
    );
    yield* compare("publishScope.existingCommit", scenario, oldIntent, newIntent);
  }

  // Reviewed restaging.
  const restageWorld = (ignore: string, tracked: string) =>
    Effect.gen(function* () {
      const w = yield* world();
      yield* write(w.work, tracked, "original\n");
      yield* write(w.work, "regular.txt", "original\n");
      yield* write(w.work, ".gitignore", ignore);
      yield* git(w.work, ["add", ".gitignore", "regular.txt"]);
      yield* git(w.work, ["add", "--force", tracked]);
      yield* commitAll(w.work, "track");
      yield* write(w.work, tracked, "updated\n");
      yield* write(w.work, "regular.txt", "updated\n");
      yield* git(w.work, ["add", "--force", tracked]);
      yield* git(w.work, ["add", "regular.txt"]);
      return { ...w, tracked };
    });
  for (const [scenario, build] of [
    ["a regular and an ignored tracked path", restageWorld("tracked.txt\n", "tracked.txt")],
    ["a tracked path under an ignored directory", restageWorld("vendor/\n", "vendor/lib.txt")],
  ] as const) {
    const [left, right] = yield* twin(build);
    const intent = YeetStagedPublishIntent.make({ paths: ["regular.txt", left.tracked] });
    yield* compare(
      "publishScope.restage",
      scenario,
      yield* oldStageReviewedPublishIntent(contextFor(left.work), intent, false).pipe(
        Effect.andThen(git(left.work, ["diff", "--cached", "--name-status"])),
        outcome
      ),
      yield* stageReviewedPublishIntent(contextFor(right.work), intent, false).pipe(
        Effect.andThen(git(right.work, ["diff", "--cached", "--name-status"])),
        outcome
      )
    );
  }

  // --- Handler (Y17-Y23) ----------------------------------------------------------------------------------------

  // Frozen expression (Handler.proofBaseSha's `onNone`) and the shipped expression.
  for (const [scenario, base] of [
    ["the base ref", "origin/main"],
    ["an unknown base", "nope"],
  ] as const) {
    const [left, right] = yield* twin(world());
    yield* compare(
      "handler.proofBaseSha",
      scenario,
      yield* outcome(oldRunGitOutput(left.work, ["rev-parse", base])),
      yield* outcome(resolveYeetRev(right.work, base))
    );
  }

  const mergeWorld = (shape: "merge" | "plain" | "extra-edit" | "octopus") =>
    Effect.gen(function* () {
      const w = yield* world();
      yield* write(w.work, "src/feature.ts", "feature\n");
      yield* commitAll(w.work, "feature");
      yield* git(w.work, ["push", "--quiet", "-u", "origin", "feature"]);
      yield* advanceOrigin(w, "main.txt");
      if (shape === "plain") {
        yield* write(w.work, "src/more.ts", "more\n");
        yield* commitAll(w.work, "more");
        return w;
      }
      if (shape === "octopus") {
        yield* git(w.work, ["branch", "side", "origin/main~1"]);
        yield* git(w.work, ["switch", "--quiet", "side"]);
        yield* write(w.work, "side.txt", "side\n");
        yield* commitAll(w.work, "side");
        yield* git(w.work, ["switch", "--quiet", "feature"]);
        yield* git(w.work, ["merge", "--quiet", "--no-edit", "origin/main", "side"]);
        return w;
      }
      yield* git(w.work, ["merge", "--quiet", "--no-edit", "origin/main"]);
      if (shape === "extra-edit") {
        yield* write(w.work, "src/feature.ts", "feature with an extra edit\n");
        yield* git(w.work, ["add", "-A"]);
        yield* git(w.work, ["commit", "--quiet", "--no-verify", "--amend", "--no-edit"]);
      }
      return w;
    });
  const guardOutcome = <R>(effect: Effect.Effect<void, YeetCommandError, R>) =>
    effect.pipe(
      Effect.as("allowed"),
      Effect.catch((error) =>
        Effect.succeed(
          Str.includes("requires --reuse-verified")(error.message) ? "refused" : `failed ${error.exitCode}`
        )
      )
    );
  for (const [scenario, shape] of [
    ["a clean base merge onto the published tip", "merge"],
    ["a non-merge commit", "plain"],
    ["a base merge carrying an extra edit", "extra-edit"],
    ["an octopus merge", "octopus"],
  ] as const) {
    const [left, right] = yield* twin(mergeWorld(shape));
    yield* compare(
      "handler.mergeOnly",
      scenario,
      yield* guardOutcome(oldAssertMergeOnlyPublish(contextFor(left.work))),
      yield* guardOutcome(assertMergeOnlyPublish(contextFor(right.work)))
    );
  }

  // --- FinalCheck and FinalCheckRefresh (Y24-Y32) ----------------------------------------------------------------

  const branchWorld = Effect.gen(function* () {
    const w = yield* world();
    yield* write(w.work, "src/b.ts", "export const b = 1;\n");
    yield* git(w.work, ["mv", "src/a.ts", "src/renamed.ts"]);
    yield* git(w.work, ["rm", "--quiet", "README.md"]);
    yield* commitAll(w.work, "feature: add, rename, delete");
    yield* advanceOrigin(w, "main.txt");
    return w;
  });
  for (const [scenario, prepare] of [
    ["clean tree", (_cwd: string) => Effect.void],
    ["an untracked file", (cwd: string) => write(cwd, "new.txt", "new\n")],
    [
      "only an ignored file",
      (cwd: string) => Effect.andThen(write(cwd, ".git/info/exclude", "*.log\n"), write(cwd, "x.log", "x\n")),
    ],
    ["a modified tracked file", (cwd: string) => write(cwd, "src/b.ts", "export const b = 2;\n")],
  ] as const) {
    const [left, right] = yield* twin(branchWorld);
    yield* prepare(left.work);
    yield* prepare(right.work);
    // Frozen expression (FinalCheck.dirtyTree) and the shipped expression.
    yield* compare(
      "finalCheck.dirtyTree",
      scenario,
      yield* oldRunGitOutput(left.work, ["status", "--porcelain", "--untracked-files=all"]).pipe(
        Effect.map((output) => Str.isNonEmpty(Str.trim(output))),
        outcome
      ),
      yield* Effect.flatMap(Git, (g) => g.status(right.work, { untrackedFiles: "all" })).pipe(
        Effect.mapBoth({
          onFailure: yeetGitKitError(GitCommand.status({ untrackedFiles: "all" })),
          onSuccess: A.isReadonlyArrayNonEmpty,
        }),
        outcome
      )
    );
  }
  {
    const [left, right] = yield* twin(branchWorld);
    const oldMergeBase = yield* oldRunGitOutput(left.work, ["merge-base", "origin/main", "HEAD"]).pipe(
      Effect.map(Str.trim)
    );
    const newMergeBase = yield* resolveYeetMergeBase(right.work, "origin/main", "HEAD");
    yield* compare(
      "finalCheck.heads",
      "head and merge base",
      { mb: oldMergeBase, head: yield* oldRunGitOutput(left.work, ["rev-parse", "HEAD"]) },
      { mb: newMergeBase, head: yield* resolveYeetRev(right.work, "HEAD") }
    );
    yield* compare(
      "finalCheck.changedFiles",
      "an add, a rename and a deletion, deletions filtered",
      yield* outcome(
        oldRunGitPathList(left.work, ["diff", "--name-only", "-z", "--diff-filter=d", oldMergeBase, "HEAD"])
      ),
      yield* outcome(
        changedYeetPaths(right.work, YeetChangedPathsQuery.make({ base: newMergeBase, head: "HEAD", diffFilter: "d" }))
      )
    );
    // FinalCheckRefresh: changed paths without rename detection, the merge base and the receipt distance.
    yield* compare(
      "finalCheckRefresh.changedPaths",
      "a rename reads as two paths",
      yield* outcome(oldRunGitPathList(left.work, ["diff", "--name-only", "--no-renames", "-z", oldMergeBase, "HEAD"])),
      yield* outcome(
        changedYeetPaths(right.work, YeetChangedPathsQuery.make({ base: newMergeBase, head: "HEAD", noRenames: true }))
      )
    );
    yield* compare(
      "finalCheckRefresh.mergeBase",
      "an unknown receipt head",
      yield* outcome(
        oldRunGitOutput(left.work, ["merge-base", "0000000000000000000000000000000000000001", "origin/main"])
      ),
      yield* outcome(resolveYeetMergeBase(right.work, "0000000000000000000000000000000000000001", "origin/main"))
    );
    for (const [scenario, range] of [
      ["the receipt distance", "origin/main~1..HEAD"],
      ["an unknown range", "nope..HEAD"],
    ] as const) {
      yield* compare(
        "finalCheckRefresh.revListCount",
        scenario,
        yield* oldRunGitOutput(left.work, ["rev-list", "--count", range]).pipe(
          Effect.map((count) => Number(Str.trim(count))),
          outcome
        ),
        yield* outcome(countYeetRevisions(right.work, range))
      );
    }
  }

  // --- ProofState (Y35-Y37) --------------------------------------------------------------------------------------

  for (const [scenario, removeOrigin] of [
    ["an origin URL", false],
    ["no origin remote", true],
  ] as const) {
    const [left, right] = yield* twin(world());
    // One origin URL for both twins: the lock path is a digest of it.
    for (const cwd of [left.work, right.work])
      yield* git(
        cwd,
        removeOrigin
          ? ["remote", "remove", "origin"]
          : ["remote", "set-url", "origin", "https://example.invalid/w7a.git"]
      );
    yield* compare(
      "proofState.lockPath",
      scenario,
      yield* outcome(oldProofLockPathForContext(contextFor(left.work)), true),
      yield* outcome(proofLockPathForContext(contextFor(right.work)), true)
    );
  }
  for (const [scenario, prepare] of [
    ["clean tree", (_cwd: string) => Effect.void],
    [
      "staged and unstaged edits with a rename and an untracked file",
      (cwd: string) =>
        Effect.gen(function* () {
          yield* git(cwd, ["mv", "src/a.ts", "src/moved.ts"]);
          yield* write(cwd, "README.md", "edited\n");
          yield* write(cwd, "untracked.txt", "u\n");
        }),
    ],
    [
      "a non-ASCII and a spaced path",
      (cwd: string) => Effect.andThen(write(cwd, "café.txt", "c\n"), write(cwd, "a b.txt", "s\n")),
    ],
    [
      "status.branch=true",
      (cwd: string) =>
        Effect.andThen(git(cwd, ["config", "status.branch", "true"]), write(cwd, "README.md", "edited\n")),
    ],
  ] as const) {
    const [left, right] = yield* twin(world());
    yield* prepare(left.work);
    yield* prepare(right.work);
    yield* compare(
      "proofState.fingerprint",
      scenario,
      yield* outcome(oldCollectDiffFingerprint(contextFor(left.work)), true),
      yield* outcome(collectDiffFingerprint(contextFor(right.work)), true)
    );
  }

  // --- Provenance (Y38-Y40) --------------------------------------------------------------------------------------

  // Frozen expression (Provenance.detectGitPaths) and the shipped expression: the clone, the checkout, and the
  // workspace label override.
  const oldGitPaths = (cwd: string) =>
    Effect.gen(function* () {
      const [common, checkout] = yield* Effect.all([
        oldRunGitOutput(cwd, ["rev-parse", "--git-common-dir"]),
        oldRunGitOutput(cwd, ["rev-parse", "--show-toplevel"]),
      ]);
      const checkoutPath = path.resolve(Str.trim(checkout));
      return { clone: path.dirname(path.resolve(checkoutPath, Str.trim(common))), checkout: checkoutPath };
    });
  const newGitPaths = (cwd: string) =>
    Effect.gen(function* () {
      const g = yield* Git;
      const [common, checkout] = yield* Effect.all([
        g.commonDir(cwd).pipe(Effect.mapError(adaptGitKitError(GitCommand.commonDir(), yeetGitOutputErrorAdapter))),
        g.repoRoot(cwd).pipe(Effect.mapError(adaptGitKitError(GitCommand.repoRoot(), yeetGitOutputErrorAdapter))),
      ]);
      const checkoutPath = path.resolve(Str.trim(checkout));
      return { clone: path.dirname(path.resolve(checkoutPath, Str.trim(common))), checkout: checkoutPath };
    });
  {
    const w = yield* world();
    const linked = path.join(w.dir, "linked");
    yield* git(w.work, ["worktree", "add", "--quiet", "-b", "linked", linked]);
    for (const [scenario, cwd] of [
      ["the primary clone root", w.work],
      ["a subdirectory of the primary clone", path.join(w.work, "src")],
      ["a linked worktree", linked],
      ["a subdirectory of a linked worktree", path.join(linked, "src")],
      ["outside a repository", w.dir],
    ] as const) {
      yield* compare(
        "provenance.gitPaths",
        scenario,
        yield* outcome(oldGitPaths(cwd)),
        yield* outcome(newGitPaths(cwd))
      );
    }
    for (const [scenario, label] of [
      ["a workspace label", O.some("lane-label")],
      ["no workspace label", O.none<string>()],
    ] as const) {
      yield* O.match(label, {
        onNone: () => gitTry(w.work, ["config", "--unset-all", "beep.workspace.label"]),
        onSome: (value) => gitTry(w.work, ["config", "beep.workspace.label", ` ${value} `]),
      });
      yield* compare(
        "provenance.workspaceLabel",
        scenario,
        yield* oldRunGitOutput(w.work, ["config", "--get", "beep.workspace.label"]).pipe(
          Effect.map(Str.trim),
          Effect.option
        ),
        yield* Effect.flatMap(Git, (g) => g.configGet(w.work, "beep.workspace.label")).pipe(
          Effect.map(O.map(Str.trim)),
          Effect.orElseSucceed(O.none<string>)
        )
      );
    }
  }

  // --- ExpectationRewrite (Y41-Y44) ------------------------------------------------------------------------------

  const expectationWorld = Effect.gen(function* () {
    const w = yield* world();
    const test = (expected: string) =>
      `import { expect, it } from "vitest";\nit("x", () => {\n  expect(f()).toBe("${expected}");\n});\n`;
    yield* write(w.work, "pkg/test/small.test.ts", test("a"));
    yield* write(w.work, "pkg/test/moved.test.ts", test("c"));
    yield* write(w.work, "pkg/test/huge.test.ts", test("e"));
    yield* commitAll(w.work, "tests");
    const mergeBase = yield* git(w.work, ["rev-parse", "HEAD"]);
    yield* write(w.work, "pkg/test/small.test.ts", test("b"));
    yield* fs.makeDirectory(path.join(w.work, "pkg", "other")).pipe(Effect.orDie);
    yield* git(w.work, ["mv", "pkg/test/moved.test.ts", "pkg/other/moved.test.ts"]);
    yield* write(w.work, "pkg/other/moved.test.ts", test("d"));
    yield* write(
      w.work,
      "pkg/test/huge.test.ts",
      `${test("f")}${Str.repeat(9000)(`  expect(value).toBe("${Str.repeat(60)("x")}");\n`)}`
    );
    yield* commitAll(w.work, "rewrite");
    return { ...w, mergeBase };
  });
  {
    const [left, right] = yield* twin(expectationWorld);
    yield* compare(
      "expectationRewrite.collect",
      "a modified, a renamed and an overflowing test file",
      yield* outcome(oldCollectExpectationRewrites(left.work, left.mergeBase)),
      yield* outcome(collectExpectationRewrites(right.work, right.mergeBase))
    );
    for (const [scenario, ref, existing] of [
      ["the merge base", left.mergeBase, false],
      ["an unknown commit", "0000000000000000000000000000000000000001", false],
      ["a path that already exists", left.mergeBase, true],
    ] as const) {
      const oldTarget = path.join(left.dir, `base-${counter}`);
      const newTarget = path.join(right.dir, `base-${counter}`);
      if (existing) {
        yield* write(oldTarget, "occupied.txt", "x\n");
        yield* write(newTarget, "occupied.txt", "x\n");
      }
      // Frozen expression (ExpectationRewrite.runInherited over `worktree add --detach`) and the shipped one.
      const oldAdd = yield* runToExit({
        command: "git",
        args: ["worktree", "add", "--detach", oldTarget, ref],
        cwd: left.work,
        stdio: "ignore",
        extendEnv: true,
      }).pipe(Effect.orElseSucceed(() => -1));
      const newAdd = yield* patientGit.pipe(
        Effect.flatMap((g) =>
          captureGitKitExit(
            g.worktreeAdd(right.work, newTarget, { ref, detach: true }),
            GitCommand.worktreeAdd(newTarget, ref, true),
            "Failed to run git worktree add."
          )
        ),
        Effect.map((exit) => exit.exitCode),
        Effect.orElseSucceed(() => -1)
      );
      yield* compare(
        "expectationRewrite.worktreeAdd",
        scenario,
        oldAdd === 0 ? 0 : "nonzero",
        newAdd === 0 ? 0 : "nonzero"
      );
      const oldRemove = yield* runToExit({
        command: "git",
        args: ["worktree", "remove", "--force", oldTarget],
        cwd: left.work,
        stdio: "ignore",
        extendEnv: true,
      }).pipe(Effect.orElseSucceed(() => -1));
      const newRemove = yield* patientGit.pipe(
        Effect.flatMap((g) => g.worktreeRemove(right.work, newTarget, { force: true })),
        Effect.as(0),
        Effect.orElseSucceed(() => 1)
      );
      yield* compare(
        "expectationRewrite.worktreeRemove",
        scenario,
        oldRemove === 0 ? 0 : "nonzero",
        newRemove === 0 ? 0 : "nonzero"
      );
    }
  }

  // --- HeadInstallReceipt (Y45-Y46) -------------------------------------------------------------------------------

  const installWorld = (extra: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const w = yield* world();
      for (const file of [
        "package.json",
        "bun.lock",
        "bunfig.toml",
        "packages/x/package.json",
        "patches/p.patch",
        "packages/x/src/index.ts",
        ...extra,
      ])
        yield* write(w.work, file, `${file}\n`);
      yield* commitAll(w.work, "workspace");
      return w;
    });
  for (const [scenario, build, ref] of [
    ["a workspace with manifests, a lockfile, patches and bunfig", installWorld([]), "HEAD"],
    ["a manifest under a non-ASCII directory", installWorld(["packages/café/package.json"]), "HEAD"],
    ["an unknown commit", installWorld([]), "0000000000000000000000000000000000000001"],
  ] as const) {
    const [left, right] = yield* twin(build);
    const project = (inputs: { treeSha: string; lockfileDigest: string; manifestsDigest: string }) => ({
      tree: inputs.treeSha,
      lock: inputs.lockfileDigest,
      manifests: inputs.manifestsDigest,
    });
    yield* compare(
      "headInstall.inputs",
      scenario,
      yield* outcome(oldCollectHeadInstallInputs(left.work, ref).pipe(Effect.map(project))),
      yield* outcome(collectHeadInstallInputs(right.work, ref).pipe(Effect.map(project)))
    );
  }

  // --- MergedPreview (Y47-Y49) ------------------------------------------------------------------------------------

  const previewWorld = (conflict: boolean) =>
    Effect.gen(function* () {
      const w = yield* world();
      yield* write(w.work, conflict ? "README.md" : "feature.md", "feature\n");
      yield* commitAll(w.work, "feature");
      yield* advanceOrigin(w, conflict ? "README.md" : "main.md");
      return w;
    });
  for (const [scenario, build, base] of [
    ["a clean merge", previewWorld(false), "origin/main"],
    ["a conflicting merge", previewWorld(true), "origin/main"],
    ["an unknown base", previewWorld(false), "nope"],
  ] as const) {
    const [left, right] = yield* twin(build);
    const project = (preview: { treeSha: string; baseSha: string; headSha: string; commitSha: string }) => ({
      tree: preview.treeSha,
      base: preview.baseSha,
      head: preview.headSha,
      commit: preview.commitSha,
    });
    const previewContext = (cwd: string) =>
      RepoRunContext.make({ ...contextFor(cwd, base), packetDir: path.join(cwd, ".beep", "yeet") });
    yield* compare(
      "mergedPreview.create",
      scenario,
      yield* outcome(oldCreateYeetMergePreview(previewContext(left.work)).pipe(Effect.map(project)), true),
      yield* outcome(createYeetMergePreview(previewContext(right.work)).pipe(Effect.map(project)), true)
    );
  }

  // --- GateStaleness, PortfolioIndexGuard, ProvenanceFooter (Y51-Y53) --------------------------------------------

  for (const [scenario, base] of [
    ["committed and dirty paths", "origin/main"],
    ["an unknown base", "nope"],
  ] as const) {
    const [left, right] = yield* twin(dirtyWorld);
    yield* compare(
      "gateStaleness.inputPaths",
      scenario,
      yield* outcome(oldCollectYeetGateInputPaths(contextFor(left.work, base))),
      yield* outcome(collectYeetGateInputPaths(contextFor(right.work, base)))
    );
  }
  for (const [scenario, remove] of [
    ["a staged deletion of the index", true],
    ["a staged edit of the index", false],
  ] as const) {
    const indexWorld = Effect.gen(function* () {
      const w = yield* world();
      yield* write(w.work, PORTFOLIO_INDEX_PATH, "# index\n");
      yield* commitAll(w.work, "index");
      if (remove) yield* git(w.work, ["rm", "--quiet", PORTFOLIO_INDEX_PATH]);
      else {
        yield* write(w.work, PORTFOLIO_INDEX_PATH, "# index 2\n");
        yield* git(w.work, ["add", PORTFOLIO_INDEX_PATH]);
      }
      return w;
    });
    const [left, right] = yield* twin(indexWorld);
    const query = { diffFilter: "D", pathspec: [PORTFOLIO_INDEX_PATH] };
    // Frozen expression (PortfolioIndexGuard's staged-deletion read) and the shipped expression.
    yield* compare(
      "portfolioIndex.stagedDeletions",
      scenario,
      yield* outcome(
        oldRunGitPathList(left.work, [
          "diff",
          "--cached",
          "--diff-filter=D",
          "--name-only",
          "-z",
          "--",
          PORTFOLIO_INDEX_PATH,
        ])
      ),
      yield* Effect.flatMap(Git, (g) => g.stagedChanges(right.work, query)).pipe(
        Effect.mapError(yeetGitKitError(GitCommand.stagedChanges(false, query))),
        outcome
      )
    );
  }
  {
    const [left, right] = yield* twin(world());
    const unborn = path.join(root, "unborn");
    yield* fs.makeDirectory(unborn).pipe(Effect.orDie);
    yield* git(unborn, ["init", "--quiet", "--template=", "."]);
    for (const [scenario, oldCwd, newCwd] of [
      ["a repository", left.work, right.work],
      ["an unborn repository", unborn, unborn],
    ] as const) {
      // Frozen expression (ProvenanceFooter's head read) and the shipped expression.
      yield* compare(
        "provenanceFooter.head",
        scenario,
        yield* outcome(oldRunGitOutput(oldCwd, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim))),
        yield* Effect.flatMap(Git, (g) => g.revParse(newCwd, "HEAD")).pipe(
          Effect.mapError(adaptGitKitError(GitCommand.revParse("HEAD"), yeetGitOutputErrorAdapter)),
          outcome
        )
      );
    }
  }

  // --- PullRequestTitle and PullRequest (Y54-Y55) -----------------------------------------------------------------

  const historyWorld = (subjects: ReadonlyArray<readonly [subject: string, body: string]>, merge: boolean) =>
    Effect.gen(function* () {
      const w = yield* world();
      for (const [index, [subject, body]] of subjects.entries()) {
        yield* write(w.work, `history-${index}.txt`, `${index}\n`);
        yield* git(w.work, ["add", "-A"]);
        // A message file: a subject past 512 KiB would overflow the argument list.
        const messageFile = path.join(w.dir, `message-${index}.txt`);
        yield* fs
          .writeFileString(messageFile, Str.isNonEmpty(body) ? `${subject}\n\n${body}\n` : `${subject}\n`)
          .pipe(Effect.orDie);
        yield* git(w.work, ["commit", "--quiet", "--no-verify", "-F", messageFile]);
      }
      if (merge) {
        yield* advanceOrigin(w, "main.txt");
        yield* git(w.work, ["merge", "--quiet", "--no-ff", "--no-edit", "origin/main"]);
      }
      return w;
    });
  const longSubject = `feat: ${Str.repeat(600 * 1024)("x")}`;
  for (const [scenario, build, range, message] of [
    [
      "the first non-merge commit",
      historyWorld(
        [
          ["fix: first", ""],
          ["feat: second", ""],
        ],
        false
      ),
      "origin/main..HEAD",
      O.none<string>(),
    ],
    ["merge commits only", historyWorld([], true), "HEAD^2..HEAD", O.none<string>()],
    ["a subject past 512 KiB", historyWorld([[longSubject, ""]], false), "origin/main..HEAD", O.none<string>()],
    [
      "a --message",
      historyWorld([["fix: first", ""]], false),
      "origin/main..HEAD",
      O.some("docs: from message\n\nbody"),
    ],
  ] as const) {
    const [left, right] = yield* twin(build);
    yield* compare(
      "prTitle.resolve",
      scenario,
      yield* outcome(
        oldResolvePullRequestTitle(contextFor(left.work), message, range).pipe(
          Effect.map((r) => [Str.slice(0, 80)(r.title), r.source])
        ),
        true
      ),
      yield* outcome(
        resolvePullRequestTitle(contextFor(right.work), message, range).pipe(
          Effect.map((r) => [Str.slice(0, 80)(r.title), r.source])
        ),
        true
      )
    );
  }
  for (const [scenario, build] of [
    [
      "commits with bodies",
      historyWorld(
        [
          ["fix: first", "first body\n\nsecond paragraph"],
          ["feat: second", "second body"],
        ],
        false
      ),
    ],
    [
      "commits without bodies",
      historyWorld(
        [
          ["fix: first", ""],
          ["feat: second", ""],
        ],
        false
      ),
    ],
  ] as const) {
    const [left, right] = yield* twin(build);
    const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
    yield* compare(
      "prBody.build",
      scenario,
      yield* outcome(oldBuildPrBody(contextFor(left.work), recorder)),
      yield* outcome(buildPrBody(contextFor(right.work), recorder))
    );
  }

  // --- Yeet.command detached-job coordinates (Y56-Y57) ------------------------------------------------------------

  // Frozen expression (submitDetachedProofJob's `git` capture) and the shipped expression.
  const oldCoordinate = (cwd: string, args: ReadonlyArray<string>) =>
    runRepoCommandCapture("git", args, cwd, { PATH: process.env.PATH }).pipe(
      Effect.map((result) =>
        result.exitCode !== 0 ? { failed: Str.isNonEmpty(result.output) } : { ok: Str.trim(result.output) }
      ),
      Effect.orElseSucceed(() => ({ failed: "spawn" }))
    );
  const detachedAdapter: GitCommandErrorAdapter<{ readonly failed: string | boolean }> = {
    onSpawnFailure: () => () => ({ failed: "spawn" }),
    onNonZeroExit: ({ output }: { readonly output: string }) => ({ failed: Str.isNonEmpty(Str.trim(output)) }),
    onTruncated: O.none(),
  };
  {
    const [left, right] = yield* twin(world());
    yield* compare(
      "yeetCommand.branch",
      "a branch",
      yield* oldCoordinate(left.work, ["rev-parse", "--abbrev-ref", "HEAD"]),
      yield* Effect.flatMap(Git, (g) => g.currentBranch(right.work)).pipe(
        Effect.map((branch) => ({ ok: O.getOrElse(branch, () => "HEAD") })),
        Effect.catch((error) => Effect.succeed(adaptGitKitError(error, GitCommand.currentBranch(), detachedAdapter)))
      )
    );
    for (const [scenario, head] of [
      ["the head", "HEAD"],
      ["an unknown head", "nope"],
    ] as const) {
      yield* compare(
        "yeetCommand.head",
        scenario,
        yield* oldCoordinate(left.work, ["rev-parse", "--verify", head]),
        yield* Effect.flatMap(Git, (g) => g.revParse(right.work, head)).pipe(
          Effect.map((sha) => ({ ok: sha })),
          Effect.catch((error) => Effect.succeed(adaptGitKitError(error, GitCommand.revParse(head), detachedAdapter)))
        )
      );
    }
    yield* git(left.work, ["switch", "--quiet", "--detach"]);
    yield* git(right.work, ["switch", "--quiet", "--detach"]);
    yield* compare(
      "yeetCommand.branch",
      "a detached HEAD",
      yield* oldCoordinate(left.work, ["rev-parse", "--abbrev-ref", "HEAD"]),
      yield* Effect.flatMap(Git, (g) => g.currentBranch(right.work)).pipe(
        Effect.map((branch) => ({ ok: O.getOrElse(branch, () => "HEAD") })),
        Effect.catch((error) => Effect.succeed(adaptGitKitError(error, GitCommand.currentBranch(), detachedAdapter)))
      )
    );
  }

  // --- Sweep (Y61-Y64) ----------------------------------------------------------------------------------------------

  // Frozen expressions (Sweep.captureCommand over `ls-remote` and `fetch --prune`, read through `lsRemoteTip`) and
  // the shipped expressions (the patient `lsRemote` and `fetch` through `sweepProbeFromGit`).
  const tipOf = (output: string) =>
    O.getOrNull(
      A.head(
        A.filter(
          A.map(Str.split(output, "\n"), (line) => Str.trim(A.getUnsafe(Str.split(line, "\t"), 0))),
          Str.isNonEmpty
        )
      )
    );
  const oldRemoteTip = (cwd: string, branch: string) =>
    runRepoCommandCapture("git", ["ls-remote", "origin", `refs/heads/${branch}`], cwd).pipe(
      Effect.map((r) => (r.exitCode !== 0 || r.truncated ? "unreliable" : { tip: tipOf(Str.trim(r.output)) })),
      Effect.orElseSucceed(() => "unreliable")
    );
  const newRemoteTip = (cwd: string, branch: string) => {
    const patterns = [`refs/heads/${branch}`];
    return Effect.flatMap(patientGit, (g) =>
      g.lsRemote(cwd, "origin", { patterns }).pipe(
        sweepProbeFromGit(GitCommand.lsRemote("origin", false, false, patterns), (entries) =>
          A.join(
            A.map(entries, (e) => `${e.sha}\t${e.ref}`),
            "\n"
          )
        )
      )
    ).pipe(
      Effect.map((probe) => (probe.exitCode !== 0 || probe.truncated ? "unreliable" : { tip: tipOf(probe.output) }))
    );
  };
  {
    const [left, right] = yield* twin(world());
    yield* git(left.work, ["push", "--quiet", "origin", "feature"]);
    yield* git(right.work, ["push", "--quiet", "origin", "feature"]);
    for (const [scenario, branch] of [
      ["a branch origin still has", "feature"],
      ["a branch origin no longer has", "gone"],
    ] as const)
      yield* compare(
        "sweep.lsRemote",
        scenario,
        yield* oldRemoteTip(left.work, branch),
        yield* newRemoteTip(right.work, branch)
      );
    // fetch --prune after origin dropped the branch: the tracking ref goes on both sides.
    yield* git(left.work, ["push", "--quiet", "origin", "--delete", "feature"]);
    yield* git(right.work, ["push", "--quiet", "origin", "--delete", "feature"]);
    yield* git(left.work, ["update-ref", "refs/remotes/origin/feature", "HEAD"]);
    yield* git(right.work, ["update-ref", "refs/remotes/origin/feature", "HEAD"]);
    const oldFetch = yield* runRepoCommandCapture("git", ["fetch", "--prune", "origin"], left.work).pipe(
      Effect.map((r) => r.exitCode),
      Effect.orElseSucceed(() => 1)
    );
    const newFetch = yield* Effect.flatMap(patientGit, (g) =>
      g
        .fetch(right.work, { remote: "origin", prune: true })
        .pipe(sweepProbeFromGit(GitCommand.fetch("origin", undefined, undefined, false, false, true), () => ""))
    ).pipe(Effect.map((probe) => probe.exitCode));
    yield* compare(
      "sweep.fetchPrune",
      "origin dropped a tracked branch",
      {
        exit: oldFetch,
        tracking: (yield* gitTry(left.work, ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/feature"]))
          .exitCode,
      },
      {
        exit: newFetch,
        tracking: (yield* gitTry(right.work, ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/feature"]))
          .exitCode,
      }
    );
    yield* git(left.work, ["remote", "remove", "origin"]);
    yield* git(right.work, ["remote", "remove", "origin"]);
    yield* compare(
      "sweep.lsRemote",
      "no origin remote",
      yield* oldRemoteTip(left.work, "feature"),
      yield* newRemoteTip(right.work, "feature")
    );
    const oldNoOrigin = yield* runRepoCommandCapture("git", ["fetch", "--prune", "origin"], left.work).pipe(
      Effect.map((r) => r.exitCode !== 0),
      Effect.orElseSucceed(() => true)
    );
    const newNoOrigin = yield* Effect.flatMap(patientGit, (g) =>
      g
        .fetch(right.work, { remote: "origin", prune: true })
        .pipe(sweepProbeFromGit(GitCommand.fetch("origin", undefined, undefined, false, false, true), () => ""))
    ).pipe(Effect.map((probe) => probe.exitCode !== 0));
    yield* compare("sweep.fetchPrune", "no origin remote", { failed: oldNoOrigin }, { failed: newNoOrigin });
  }

  // --- report -------------------------------------------------------------------------------------------------------

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const scrub = (text: string) =>
    Str.replaceAll(root, "<tmp>")(Str.length(text) > 2000 ? `${Str.slice(0, 2000)(text)}...` : text);
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/yeet-differential-w7.ts",
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
      old: scrub(show(row.old)),
      new: scrub(show(row.new)),
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
