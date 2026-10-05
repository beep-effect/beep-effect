/**
 * GitHub pull request lifecycle helpers for Yeet publish and monitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, Effect, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhPrView, ghOutput } from "../../../internal/github/index.ts";
import { RepoStepRunResult, runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { HEAVY_ADMISSION_LABEL, isHeavyDocsOnlyPath } from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runIdForContext, runArtifactPathForContext as runOutputPathForContext } from "./ArtifactPaths.ts";
import { runGitOutput, runGitPathList } from "./GitExec.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import {
  ensureProvenanceFooter,
  isProvenanceStampFailure,
  ProvenanceStampOutcome,
  recordCurrentPrSession,
} from "./ProvenanceFooter.ts";
import { YeetExecutedStep } from "./Verdict.ts";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { GhCommandFailure } from "../../../internal/github/index.ts";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrNumber } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PullRequest");

const ghPullRequestViewArgs = ["pr", "view", "--json", "number,headRefName,state,url"] as const;
const ghPullRequestViewCommand = "gh pr view --json number,headRefName,state,url";
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
): Effect.fn.Return<GhPrView, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
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
): Effect.fn.Return<O.Option<GhPrView>, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
    : "- no local proof lane ran before the push; hosted CI is the authoritative proof";
  const runId = yield* runIdForContext(context);
  return `${Str.trim(commitLog)}\n\n## Local proof\n\n${proofSection}\n\nVerdict: .beep/yeet/runs/${runId}/verdict.json\n`;
});

/**
 * The pull request a publish ended up with: the one it created, or the open
 * one it found for the branch.
 *
 * **Example** (Describe a created draft)
 *
 * ```ts
 * import { YeetEnsuredPullRequest } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const pullRequest = YeetEnsuredPullRequest.make({ number: 42, url: O.some("https://github.com/o/r/pull/42"), created: true })
 * console.log(pullRequest.created) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetEnsuredPullRequest extends S.Class<YeetEnsuredPullRequest>($I`YeetEnsuredPullRequest`)(
  {
    number: S.Finite,
    url: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    created: S.Boolean,
  },
  $I.annote("YeetEnsuredPullRequest", {
    description: "The pull request a publish created or found open for its branch.",
  })
) {}

interface EnsurePullRequestDependencies {
  readonly capture?: typeof runRepoCommandCapture;
  readonly findOpen?: typeof findOpenPullRequest;
  readonly registry?: PrSessionRegistryShape;
  readonly view?: typeof runGhPullRequestView;
}

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
 * Record the non-fatal provenance-stamp outcome as an executed publish lane.
 *
 * **Example** (Record a skipped stamp)
 *
 * ```ts
 * import { Effect, Ref } from "effect"
 * import * as O from "effect/Option"
 * import { ProvenanceStampOutcome, recordPrProvenanceStampLane } from "@beep/repo-cli/test/Yeet"
 *
 * const recorded = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   const outcome = ProvenanceStampOutcome.make({ status: "current", message: "provenance footer current for PR #42" })
 *   yield* recordPrProvenanceStampLane(recorder, O.none(), O.none(), outcome)
 * })
 * console.log(Effect.isEffect(recorded)) // true
 * ```
 *
 * @param recorder - Mutable Ref of executed Yeet lanes.
 * @param stampStep - Optional planned provenance-stamp step to append.
 * @param prNumber - Pull-request number when GitHub supplied one.
 * @param outcome - Typed stamp outcome; `current` and `preserved` pass, the failure family fails the lane.
 * @returns An Effect that records passed, failed, or skipped stamp status.
 * @category diagnostics
 * @since 0.0.0
 */
export const recordPrProvenanceStampLane = Effect.fn("Yeet.recordPrProvenanceStampLane")(function* (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  stampStep: O.Option<RepoPlanStep>,
  prNumber: O.Option<PrNumber>,
  outcome: ProvenanceStampOutcome
): Effect.fn.Return<void> {
  if (O.isNone(stampStep)) return;
  const skipped = O.isNone(prNumber);
  const failed = isProvenanceStampFailure(outcome);
  const output = skipped ? "skipped: no pull request number was available" : outcome.message;
  yield* Ref.update(
    recorder,
    A.append(
      YeetExecutedStep.make({
        result: RepoStepRunResult.make({
          stepId: stampStep.value.id,
          commandText: "gh pr edit <number> --body-file <run-artifacts>/pr-provenance-body.md",
          exitCode: failed ? 1 : 0,
          output,
        }),
        status: skipped ? "skipped" : failed ? "failed" : "passed",
        step: stampStep.value,
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
 * @param stampStep - Optional planned provenance-stamp lane for recorder metadata.
 * @param dependencies - Injectable GitHub runners and registry for deterministic tests.
 * @returns The open pull request the branch now has, and whether this call
 * created it. A create step whose args carry `--draft` opens a draft.
 * @category workflows
 * @since 0.0.0
 */
export const ensurePullRequest = Effect.fn("Yeet.ensurePullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  stampStep: O.Option<RepoPlanStep> = O.none(),
  dependencies: EnsurePullRequestDependencies = {}
): Effect.fn.Return<
  YeetEnsuredPullRequest,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const capture = dependencies.capture ?? runRepoCommandCapture;
  const existing = yield* (dependencies.findOpen ?? findOpenPullRequest)(context);
  if (O.isSome(existing)) {
    yield* Console.log(
      `[yeet] --pr: open pull request #${existing.value.number} already exists for ${context.branch}; skipping create`
    );
    yield* recordPrCreateLane(recorder, prStep, `skipped: open pull request #${existing.value.number} already exists`);
    const recording = yield* recordCurrentPrSession(
      context,
      existing.value.number,
      O.none(),
      "pushed",
      dependencies.registry
    );
    const outcome = O.isSome(recording)
      ? yield* ensureProvenanceFooter(
          context,
          recording.value.repository,
          existing.value.number,
          capture,
          dependencies.registry
        )
      : ProvenanceStampOutcome.make({
          status: "skipped",
          message: `[yeet] provenance footer stamp skipped for PR #${existing.value.number}: session recording was unavailable`,
        });
    yield* recordPrProvenanceStampLane(recorder, stampStep, O.some(existing.value.number), outcome);
    return YeetEnsuredPullRequest.make({
      number: existing.value.number,
      url: O.fromUndefinedOr(existing.value.url),
      created: false,
    });
  }

  const title = yield* runGitOutput(context.repoRoot, ["log", "-1", "--pretty=%s"]).pipe(Effect.map(Str.trim));
  const bodyPath = yield* runOutputPathForContext(context, "pr-body.md");
  yield* writeTextFile(bodyPath, yield* buildPrBody(context, recorder));
  const draft = O.exists(prStep, (step) => A.contains(step.args, "--draft"));
  const result = yield* capture(
    "gh",
    ["pr", "create", ...(draft ? ["--draft"] : []), "--title", title, "--body-file", bodyPath],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to run gh pr create.")));
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `gh pr create failed:\n${result.output}`,
      command: `gh pr create --title <subject> --body-file ${bodyPath}`,
      exitCode: result.exitCode,
    });
  }
  yield* Console.log(`[yeet] --pr: created ${draft ? "draft " : ""}pull request -> ${Str.trim(result.output)}`);
  yield* recordPrCreateLane(recorder, prStep, Str.trim(result.output));
  const created = yield* (dependencies.view ?? runGhPullRequestView)(context);
  const recording = yield* recordCurrentPrSession(
    context,
    created.number,
    O.some(Str.trim(result.output)),
    "created",
    dependencies.registry
  );
  const outcome = O.isSome(recording)
    ? yield* ensureProvenanceFooter(context, recording.value.repository, created.number, capture, dependencies.registry)
    : ProvenanceStampOutcome.make({
        status: "skipped",
        message: `[yeet] provenance footer stamp skipped for PR #${created.number}: session recording was unavailable`,
      });
  yield* recordPrProvenanceStampLane(recorder, stampStep, O.some(created.number), outcome);
  return YeetEnsuredPullRequest.make({
    number: created.number,
    url: O.orElse(O.fromUndefinedOr(created.url), () => O.liftPredicate(Str.trim(result.output), Str.isNonEmpty)),
    created: true,
  });
});

interface HeavyAdmissionLabelDependencies {
  readonly capture?: typeof runRepoCommandCapture;
  readonly changedPaths?: (
    context: RepoRunContext
  ) => Effect.Effect<ReadonlyArray<string>, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>;
}

const recordPrLabelLane = (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  labelStep: RepoPlanStep,
  status: "passed" | "failed" | "skipped",
  output: string
) =>
  Ref.update(
    recorder,
    A.append(
      YeetExecutedStep.make({
        result: RepoStepRunResult.make({
          stepId: labelStep.id,
          commandText: `gh pr edit <number> --add-label ${HEAVY_ADMISSION_LABEL}`,
          exitCode: status === "failed" ? 1 : 0,
          output,
        }),
        status,
        step: labelStep,
      })
    )
  );

const branchChangedPaths = (context: RepoRunContext) =>
  runGitPathList(context.repoRoot, ["diff", "--name-only", "-z", `${context.base}...HEAD`]);

/**
 * Apply the heavy-admission label to the draft pull request a publish just
 * created.
 *
 * **Details**
 *
 * Push-first publish opens the pull request as a draft and admits the heavy
 * matrix at creation (push-first-publish D4), so the hosted proof starts with
 * the first push instead of waiting for someone to add the label. A diff whose
 * every path is docs-only skips the label: the heavy matrix already treats it as
 * satisfied. An existing pull request keeps the labels it has. A failed edit is
 * recorded and warned about, never fatal: the branch is already pushed, and
 * `monitor --until-ready` names the same edit while the heavy matrix holds.
 *
 * **Example** (Skip without a planned label step)
 *
 * ```ts
 * import { applyHeavyAdmissionLabel, RepoRunContext, YeetEnsuredPullRequest } from "@beep/repo-cli/test/Yeet"
 * import { Effect, Ref } from "effect"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main", branch: "feature/x", cwd: ".", head: "HEAD", originalArgv: [],
 *   packetDir: ".beep/yeet", repoRoot: ".", turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const program = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   yield* applyHeavyAdmissionLabel(context, recorder, O.none(), YeetEnsuredPullRequest.make({ number: 1, created: true }))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo context whose branch diff decides the docs-only skip.
 * @param recorder - Execution recorder updated with the label lane.
 * @param labelStep - Planned label step; `None` skips the edit entirely.
 * @param pullRequest - The pull request the publish created or found.
 * @param dependencies - Injectable GitHub runner and changed-path reader for tests.
 * @returns An Effect that completes after the label lane is recorded.
 * @category workflows
 * @since 0.0.0
 */
export const applyHeavyAdmissionLabel = Effect.fn("Yeet.applyHeavyAdmissionLabel")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  labelStep: O.Option<RepoPlanStep>,
  pullRequest: YeetEnsuredPullRequest,
  dependencies: HeavyAdmissionLabelDependencies = {}
): Effect.fn.Return<void, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isNone(labelStep)) return;
  if (!pullRequest.created) {
    yield* recordPrLabelLane(
      recorder,
      labelStep.value,
      "skipped",
      `skipped: pull request #${pullRequest.number} already existed and keeps its labels`
    );
    return;
  }
  const changedPaths = yield* (dependencies.changedPaths ?? branchChangedPaths)(context);
  if (A.isReadonlyArrayNonEmpty(changedPaths) && A.every(changedPaths, isHeavyDocsOnlyPath)) {
    yield* Console.log(`[yeet] docs-only diff: ${HEAVY_ADMISSION_LABEL} not applied to PR #${pullRequest.number}`);
    yield* recordPrLabelLane(recorder, labelStep.value, "skipped", "skipped: docs-only diff needs no heavy matrix");
    return;
  }
  const args = ["pr", "edit", `${pullRequest.number}`, "--add-label", HEAVY_ADMISSION_LABEL];
  const result = yield* (dependencies.capture ?? runRepoCommandCapture)("gh", args, context.repoRoot).pipe(
    Effect.mapError(YeetCommandError.new("Failed to run gh pr edit --add-label."))
  );
  if (result.exitCode !== 0) {
    yield* Console.error(
      `[yeet] warning: could not apply ${HEAVY_ADMISSION_LABEL} to PR #${pullRequest.number}; run: gh ${A.join(args, " ")}\n${result.output}`
    );
    yield* recordPrLabelLane(recorder, labelStep.value, "failed", result.output);
    return;
  }
  yield* Console.log(`[yeet] applied ${HEAVY_ADMISSION_LABEL} to PR #${pullRequest.number}`);
  yield* recordPrLabelLane(recorder, labelStep.value, "passed", Str.trim(result.output));
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
): Effect.fn.Return<void, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const pullRequest = yield* runGhPullRequestView(context);

  if (pullRequest.state !== "OPEN") {
    return yield* YeetCommandError.make({
      message: `yeet monitor requires an open pull request; current branch PR #${pullRequest.number} is ${pullRequest.state}.`,
      command: ghPullRequestViewCommand,
      exitCode: 1,
    });
  }

  if (pullRequest.headRefName !== context.branch) {
    return yield* YeetCommandError.make({
      message: `yeet monitor expected PR head "${context.branch}" but gh reported "${pullRequest.headRefName}".`,
      command: ghPullRequestViewCommand,
      exitCode: 1,
    });
  }
});
