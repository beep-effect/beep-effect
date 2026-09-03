/**
 * GitHub pull request lifecycle helpers for Yeet publish and monitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhPrView, ghOutput } from "../../../internal/github/index.ts";
import { RepoStepRunResult, runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runIdForContext, runArtifactPathForContext as runOutputPathForContext } from "./ArtifactPaths.ts";
import { runGitOutput } from "./GitExec.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import { makePrProvenanceServiceLive, renderPrProvenance } from "./Provenance.ts";
import { YeetExecutedStep } from "./Verdict.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GhCommandFailure } from "../../../internal/github/index.ts";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.ts";

const ghPullRequestViewArgs = ["pr", "view", "--json", "number,headRefName,state"] as const;
const ghPullRequestViewCommand = "gh pr view --json number,headRefName,state";
const decodeGhPullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));

const ghPullRequestViewFailure = (failure: GhCommandFailure): YeetCommandError => {
  if (failure._tag === "spawn") {
    return YeetCommandError.new("Failed to inspect current branch pull request.")(failure.cause);
  }
  if (failure._tag === "truncated") {
    return YeetCommandError.make({
      message: "gh pr view output exceeded the repo-run capture limit.",
      command: ghPullRequestViewCommand,
      exitCode: 1,
    });
  }
  return YeetCommandError.make({
    message:
      "yeet monitor requires an open pull request for the current branch. Run the full local proof fallback with `bun run audit:github pre-push` when no PR is available.",
    command: ghPullRequestViewCommand,
    exitCode: failure.exitCode,
  });
};

/**
 * Read the current branch pull request through `gh pr view`.
 *
 * **Example** (Map current branch PR number)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, runGhPullRequestView } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const prNumber = runGhPullRequestView(context).pipe(Effect.map((view) => view.number))
 * ```
 *
 * @param context - Repo context whose root is used as the GitHub CLI working
 * directory.
 * @returns Decoded pull request metadata for the current branch.
 * @category clients
 * @since 0.0.0
 */
export const runGhPullRequestView = Effect.fn("Yeet.runGhPullRequestView")(function* (
  context: RepoRunContext
): Effect.fn.Return<GhPrView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* ghOutput({
    args: ghPullRequestViewArgs,
    cwd: context.repoRoot,
    label: ghPullRequestViewCommand,
    onFailure: ghPullRequestViewFailure,
  });

  return yield* decodeGhPullRequestView(output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON."))
  );
});

/**
 * Return the open pull request for the current branch when one exists.
 *
 * **Example** (Check open PR option tag)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { findOpenPullRequest, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const maybePr = findOpenPullRequest(context).pipe(Effect.map((view) => view._tag))
 * ```
 *
 * @param context - Repo context whose branch must match the PR head ref.
 * @returns `Some` open pull request metadata for the current branch, otherwise
 * `None`.
 * @category clients
 * @since 0.0.0
 */
export const findOpenPullRequest = Effect.fn("Yeet.findOpenPullRequest")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<GhPrView>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* ghOutput({
    args: ghPullRequestViewArgs,
    cwd: context.repoRoot,
    label: ghPullRequestViewCommand,
    onFailure: (failure) => failure,
  }).pipe(
    Effect.asSome,
    Effect.catch((failure) =>
      failure._tag === "spawn"
        ? Effect.fail(YeetCommandError.new("Failed to inspect current branch pull request.")(failure.cause))
        : Effect.succeed(O.none<string>())
    )
  );
  if (O.isNone(output)) {
    return O.none();
  }

  const view = yield* decodeGhPullRequestView(output.value).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON."))
  );
  return view.state === "OPEN" && view.headRefName === context.branch ? O.some(view) : O.none();
});

/**
 * Build the PR body from commit log text and recorded local proof lanes.
 *
 * **Example** (Build body with recorder)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import { buildPrBody, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const body = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   return yield* buildPrBody(context, recorder)
 * })
 * ```
 *
 * @param context - Repo context used to compute the commit range and verdict
 * artifact path.
 * @param recorder - Ref containing proof lanes already executed before PR
 * creation.
 * @returns Markdown body text for `gh pr create`.
 * @category formatting
 * @since 0.0.0
 */
export const buildPrBody = Effect.fn("Yeet.buildPrBody")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const mergeBase = yield* runGitOutput(context.repoRoot, ["merge-base", context.base, "HEAD"]).pipe(
    Effect.map(Str.trim),
    Effect.orElseSucceed(() => "")
  );
  const range = Str.isNonEmpty(mergeBase) ? `${mergeBase}..HEAD` : "HEAD";
  const commitLog = yield* runGitOutput(context.repoRoot, ["log", "--reverse", "--pretty=format:## %s%n%n%b", range]);
  const executed = yield* Ref.get(recorder);
  const laneSummary = pipe(
    executed,
    A.map((entry) => `- ${entry.step.label}: ${entry.result.exitCode === 0 ? "passed" : "failed"}`),
    A.join("\n")
  );
  const proofSection = Str.isNonEmpty(laneSummary)
    ? laneSummary
    : "- full local proof still running (start-pr-early); see the verdict artifact for final lane results";
  const provenanceService = yield* makePrProvenanceServiceLive();
  const provenance = yield* provenanceService.detect(context.repoRoot, context.branch);
  return `${Str.trim(commitLog)}\n\n## Local proof\n\n${proofSection}\n\nVerdict: .beep/yeet/runs/${runIdForContext(context)}/verdict.json\n\n${renderPrProvenance(provenance)}`;
});

/**
 * Record a successful `gh pr create` lane in the Yeet execution recorder.
 *
 * **Example** (Record successful PR create)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import * as O from "effect/Option"
 * import { recordPrCreateLane, RepoPlanStep } from "@beep/repo-cli/test/Yeet"
 *
 * const step = RepoPlanStep.make({
 *   args: ["pr", "create"],
 *   command: "gh",
 *   cwd: ".",
 *   id: "publish:pr-create",
 *   label: "create pull request",
 *   mutability: "write",
 *   phase: "publish",
 *   resume: "never",
 *   scope: "repo"
 * })
 *
 * const recorded = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   yield* recordPrCreateLane(recorder, O.some(step), "https://github.com/o/r/pull/1")
 *   return (yield* Ref.get(recorder)).length
 * })
 * ```
 *
 * @param recorder - Mutable Ref of executed Yeet lanes.
 * @param prStep - Optional planned PR creation step to append.
 * @param output - GitHub CLI output, usually the created PR URL.
 * @returns An Effect that updates the recorder when `prStep` is present.
 * @category diagnostics
 * @since 0.0.0
 */
export const recordPrCreateLane = Effect.fn("Yeet.recordPrCreateLane")(function* (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  output: string
): Effect.fn.Return<void> {
  if (O.isNone(prStep)) {
    return;
  }
  yield* Ref.update(
    recorder,
    A.append(
      YeetExecutedStep.make({
        result: RepoStepRunResult.make({
          stepId: prStep.value.id,
          commandText: "gh pr create",
          exitCode: 0,
          output,
        }),
        step: prStep.value,
      })
    )
  );
});

/**
 * Create a pull request for publish when one does not already exist.
 *
 * **Example** (Ensure PR when missing)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import * as O from "effect/Option"
 * import { ensurePullRequest, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const ensured = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   yield* ensurePullRequest(context, recorder, O.none())
 *   return "pull request ensured"
 * })
 * ```
 *
 * @param context - Repo context whose branch is published.
 * @param recorder - Execution recorder updated when PR creation is attempted
 * or skipped.
 * @param prStep - Optional planned PR creation lane for recorder metadata.
 * @returns An Effect that completes after an existing PR is found or a new PR
 * is created.
 * @category workflows
 * @since 0.0.0
 */
export const ensurePullRequest = Effect.fn("Yeet.ensurePullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const existing = yield* findOpenPullRequest(context);
  if (O.isSome(existing)) {
    yield* Console.log(
      `[yeet] --pr: open pull request #${existing.value.number} already exists for ${context.branch}; skipping create`
    );
    yield* recordPrCreateLane(recorder, prStep, `skipped: open pull request #${existing.value.number} already exists`);
    return;
  }

  const title = yield* runGitOutput(context.repoRoot, ["log", "-1", "--pretty=%s"]).pipe(Effect.map(Str.trim));
  const bodyPath = yield* runOutputPathForContext(context, "pr-body.md");
  yield* writeTextFile(bodyPath, yield* buildPrBody(context, recorder));
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "create", "--title", title, "--body-file", bodyPath],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to run gh pr create.")));
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `gh pr create failed:\n${result.output}`,
      command: `gh pr create --title <subject> --body-file ${bodyPath}`,
      exitCode: result.exitCode,
    });
  }
  yield* Console.log(`[yeet] --pr: created pull request -> ${Str.trim(result.output)}`);
  yield* recordPrCreateLane(recorder, prStep, Str.trim(result.output));
});

/**
 * Ensure the current branch has an open PR whose head matches the branch.
 *
 * **Example** (Validate matching open PR)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, validateOpenPullRequest } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const valid = validateOpenPullRequest(context).pipe(Effect.as("open PR matches branch"))
 * ```
 *
 * @param context - Repo context carrying the branch that monitor expects.
 * @returns An Effect that completes when `gh pr view` reports an open matching
 * pull request.
 * @category validation
 * @since 0.0.0
 */
export const validateOpenPullRequest = Effect.fn("Yeet.validateOpenPullRequest")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const pullRequest = yield* runGhPullRequestView(context);

  if (pullRequest.state !== "OPEN") {
    return yield* YeetCommandError.make({
      message: `yeet monitor requires an open pull request; current branch PR #${pullRequest.number} is ${pullRequest.state}.`,
      command: "gh pr view --json number,headRefName,state",
      exitCode: 1,
    });
  }

  if (pullRequest.headRefName !== context.branch) {
    return yield* YeetCommandError.make({
      message: `yeet monitor expected PR head "${context.branch}" but gh reported "${pullRequest.headRefName}".`,
      command: "gh pr view --json number,headRefName,state",
      exitCode: 1,
    });
  }
});
