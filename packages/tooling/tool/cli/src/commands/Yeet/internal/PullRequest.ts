/**
 * GitHub pull request lifecycle helpers for Yeet publish and monitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { GitHubRepository } from "@beep/github/GitHubRepository";
import { PullRequest as GithubPullRequest } from "@beep/github/PullRequest";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhPrView, GithubRest, ghOutput } from "../../../internal/github/index.ts";
import { RepoStepRunResult, sortedUniquePaths } from "../../../internal/repo-run/index.ts";
import { HEAVY_ADMISSION_LABEL, isHeavyDocsOnlyPath } from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
  writeTextFile,
} from "./ArtifactPaths.ts";
import { yeetGitKitError } from "./GitExec.ts";
import {
  ensureProvenanceFooter,
  isProvenanceStampFailure,
  ProvenanceStampOutcome,
  recordCurrentPrSession,
} from "./ProvenanceFooter.ts";
import {
  isMergeCommitSubject,
  resolvePullRequestTitle,
  YeetPullRequestTitleSync,
  YeetPullRequestTitleSyncStatus,
} from "./PullRequestTitle.ts";
import { YeetExecutedStep } from "./Verdict.ts";
import type { PullRequestInfo as GithubPullRequestInfo } from "@beep/github/PullRequest";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GhCommandFailure, GithubPullRequestRecord } from "../../../internal/github/index.ts";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetGithubServices } from "./GhOps.ts";
import type { PrNumber } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PullRequest");

// KEEP (W6): `gh pr view` of the checked-out branch resolves the pull request
// from the branch itself, which no kit member does; it stays the fallback for a
// REST lookup that failed.
const ghPullRequestViewArgs = ["pr", "view", "--json", "number,headRefName,state,url,title"] as const;
const ghPullRequestViewCommand = "gh pr view --json number,headRefName,state,url,title";
const decodeGhPullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));
const isGraphQlRateLimitOutput = (output: string) => /GraphQL: API rate limit (already )?exceeded/.test(output);
const graphQlRateLimited = (failure: GhCommandFailure) =>
  failure._tag === "nonzero-exit" && isGraphQlRateLimitOutput(failure.output);
const ghPullRequestViewOutput = (context: RepoRunContext) =>
  ghOutput({
    args: ghPullRequestViewArgs,
    cwd: context.repoRoot,
    label: ghPullRequestViewCommand,
    onFailure: (failure) => failure,
  });

// A REST pull request in the `gh pr view --json` shape the callers read: the
// REST lookup's former `--jq` projection.
const restPullRequestView = (pull: GithubPullRequestRecord): GhPrView =>
  GhPrView.make({
    number: pull.number,
    headRefName: pull.headRef,
    state: Str.toUpperCase(pull.state),
    url: pull.htmlUrl,
    headRefOid: pull.headSha,
    isDraft: pull.draft,
    title: pull.title,
  });

const originPushOwner = Effect.fn("Yeet.originPushOwner")(function* (context: RepoRunContext) {
  const git = yield* Git;
  // A missing origin reads as no URL, which fails the owner match below.
  const remote = yield* git.remoteUrl(context.repoRoot, { push: true }).pipe(
    Effect.mapBoth({
      onFailure: yeetGitKitError(GitCommand.remoteUrl("origin", true)),
      onSuccess: O.getOrElse(() => ""),
    })
  );
  const owner = pipe(
    Str.match(/^(?:[^@/\s]+@[^:/\s]+:|ssh:\/\/[^/]+\/|https?:\/\/[^/]+\/)([^/?#\s]+)\/[^/?#\s]+$/)(remote),
    O.flatMap((parts) => O.fromNullishOr(parts[1]))
  );
  return yield* Effect.fromOption(owner, () =>
    YeetCommandError.make({
      message: "Failed to identify the pushed origin repository owner for GitHub REST pull request lookup.",
      command: "git remote get-url --push origin",
      exitCode: 1,
    })
  );
});

/**
 * Find the pushed branch's open PR through REST, preserving lookup failures.
 *
 * **Example** (Build a REST lookup)
 *
 * ```ts
 * import { findOpenPullRequestViaRest, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const branchPrNumber = (context: RepoRunContext) =>
 *   findOpenPullRequestViaRest(context).pipe(Effect.map(O.map((pr) => pr.number)))
 * ```
 *
 * @param context - Checkout and pushed branch to inspect.
 * @returns The open PR, or none only after a successful empty lookup.
 * @category clients
 * @since 0.0.0
 */
export const findOpenPullRequestViaRest = Effect.fn("Yeet.findOpenPullRequestViaRest")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<GhPrView>, YeetCommandError, YeetGithubServices | Git> {
  const headOwner = yield* originPushOwner(context);
  const endpoint = `repos/{owner}/{repo}/pulls?head=${encodeURIComponent(headOwner)}%3A${encodeURIComponent(context.branch)}&state=open&per_page=100`;
  const pulls = yield* GithubRest.use((rest) => rest.openPullRequestForBranch(headOwner, context.branch)).pipe(
    Effect.mapError((error) =>
      YeetCommandError.make({
        message: `Failed to inspect current branch pull request through GitHub REST: ${error.message}`,
        command: `gh api ${endpoint}`,
        exitCode: 1,
        cause: error,
      })
    )
  );
  return pipe(
    pulls,
    O.map(restPullRequestView),
    O.filter((view) => view.state === "OPEN" && view.headRefName === context.branch)
  );
});

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
 * import * as Effect from "effect/Effect";
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
): Effect.fn.Return<
  GhPrView,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  // REST first: its budget is separate from the shared GraphQL budget that
  // `gh pr view` spends. `gh pr view` stays as the fallback for a REST failure.
  const viaRest = yield* findOpenPullRequestViaRest(context).pipe(Effect.option, Effect.map(O.flatten));
  if (O.isSome(viaRest)) return viaRest.value;
  return yield* ghPullRequestViewOutput(context).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        Effect.fail(
          graphQlRateLimited(failure)
            ? YeetCommandError.make({
                message: "yeet monitor requires an open pull request for the current branch.",
                command: "gh api repos/{owner}/{repo}/pulls",
                exitCode: 1,
              })
            : ghPullRequestViewFailure(failure)
        ),
      onSuccess: (output) =>
        decodeGhPullRequestView(output).pipe(
          Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON."))
        ),
    })
  );
});

/**
 * Return the open pull request for the current branch when one exists.
 *
 * **Example** (Check open PR option tag)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
): Effect.fn.Return<
  O.Option<GhPrView>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  // REST first (separate budget); `gh pr view` only when the REST read failed,
  // and a spent GraphQL budget then reports the REST failure, never "no PR".
  const viaRest = yield* Effect.result(findOpenPullRequestViaRest(context));
  if (Result.isSuccess(viaRest)) return viaRest.success;
  return yield* ghPullRequestViewOutput(context).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        graphQlRateLimited(failure)
          ? Effect.fail(viaRest.failure)
          : failure._tag === "spawn"
            ? Effect.fail(YeetCommandError.new("Failed to inspect current branch pull request.")(failure.cause))
            : Effect.succeedNone,
      onSuccess: (output) =>
        decodeGhPullRequestView(output).pipe(
          Effect.mapBoth({
            onFailure: YeetCommandError.new("Failed to decode gh pr view JSON."),
            onSuccess: (view) =>
              view.state === "OPEN" && view.headRefName === context.branch ? O.some(view) : O.none(),
          })
        ),
    })
  );
});

// The branch's own commits: `<merge-base>..HEAD`, or all of `HEAD` when the
// base cannot be resolved. Shared by the PR body and the PR title so both
// describe the same commits.
const branchCommitRange = Effect.fn("Yeet.branchCommitRange")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Git> {
  const git = yield* Git;
  const mergeBase = yield* git.mergeBase(context.repoRoot, context.base, "HEAD").pipe(Effect.orElseSucceed(() => ""));
  return Str.isNonEmpty(mergeBase) ? `${mergeBase}..HEAD` : "HEAD";
});

/**
 * Build the PR body from commit log text and recorded local proof lanes.
 *
 * **Example** (Build body with recorder)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Ref from "effect/Ref";
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
 * @returns Markdown body text for the pull request the publish opens.
 * @category formatting
 * @since 0.0.0
 */
export const buildPrBody = Effect.fn("Yeet.buildPrBody")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  string,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
> {
  const range = yield* branchCommitRange(context);
  // `Git.log` with `includeBody` carries `%b`, so the body renders back to the `## %s%n%n%b` text
  // entries joined by a newline, as `--pretty=format:` separated them (W7a Y55, SPEC D-18).
  const git = yield* Git;
  const logOptions = { revisions: [range], reverse: true, omitPaths: true, includeBody: true };
  const commitLog = yield* git.log(context.repoRoot, logOptions).pipe(
    Effect.mapBoth({
      onFailure: yeetGitKitError(GitCommand.log([], false, undefined, false, logOptions)),
      onSuccess: flow(
        A.map((commit) => `## ${commit.subject}\n\n${commit.body ?? ""}`),
        A.join("\n")
      ),
    })
  );
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
export class YeetEnsuredPullRequest extends S.Opaque<YeetEnsuredPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Finite,
    url: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    created: S.Boolean,
  }).pipe(
    $I.annoteSchema("YeetEnsuredPullRequest", {
      description: "The pull request a publish created or found open for its branch.",
    })
  )
) {}

interface EnsurePullRequestDependencies {
  readonly findOpen?: typeof findOpenPullRequest;
  readonly registry?: PrSessionRegistryShape;
}

/**
 * Record a successful `gh pr create` lane in the Yeet execution recorder.
 *
 * **Example** (Record successful PR create)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Ref from "effect/Ref";
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
 * @param commandText - Command that created the PR when REST was used as a fallback.
 * @returns An Effect that updates the recorder when `prStep` is present.
 * @category diagnostics
 * @since 0.0.0
 */
export const recordPrCreateLane = Effect.fn("Yeet.recordPrCreateLane")(function* (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  output: string,
  commandText = "gh pr create"
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
          commandText,
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
 * import * as Effect from "effect/Effect";
 * import * as Ref from "effect/Ref";
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
          commandText:
            "gh api -X PATCH repos/{owner}/{repo}/pulls/<number> -F body=@<run-artifacts>/pr-provenance-body.md",
          exitCode: failed ? 1 : 0,
          output,
        }),
        status: skipped ? "skipped" : failed ? "failed" : "passed",
        step: stampStep.value,
      })
    )
  );
});

// Stamp the provenance footer for a pull request whose session was just
// recorded, or record why the stamp was skipped.
const stampPullRequestProvenance = Effect.fn("Yeet.stampPullRequestProvenance")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  stampStep: O.Option<RepoPlanStep>,
  number: number,
  url: O.Option<string>,
  state: "pushed" | "created",
  registry: EnsurePullRequestDependencies["registry"]
): Effect.fn.Return<
  void,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
  | YeetGithubServices
> {
  const recording = yield* recordCurrentPrSession(context, number, url, state, registry);
  const outcome = O.isSome(recording)
    ? yield* ensureProvenanceFooter(context, recording.value.repository, number, registry)
    : ProvenanceStampOutcome.make({
        status: "skipped",
        message: `[yeet] provenance footer stamp skipped for PR #${number}: session recording was unavailable`,
      });
  yield* recordPrProvenanceStampLane(recorder, stampStep, O.some(number), outcome);
});

const finishCreatedPullRequest = Effect.fn("Yeet.finishCreatedPullRequest")(function* (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  created: GithubPullRequestInfo,
  draft: boolean
): Effect.fn.Return<YeetEnsuredPullRequest> {
  yield* Console.log(`[yeet] --pr: created ${draft ? "draft " : ""}pull request through REST -> ${created.url}`);
  yield* recordPrCreateLane(recorder, prStep, created.url, pullRequestCreateCommand);
  return YeetEnsuredPullRequest.make({
    number: created.number,
    url: O.liftPredicate(created.url, Str.isNonEmpty),
    created: true,
  });
});

const pullRequestCreateCommand = "gh api -X POST repos/{owner}/{repo}/pulls";

// Every new PR targets the repository default branch, read once through REST.
// Neither `--base` (the affected-planning base) nor a
// `branch.<name>.gh-merge-base` setting may pick the target. A failed or empty
// read is an error, not a guessed `main`.
const resolveDefaultBranchViaRest = Effect.fn("Yeet.resolveDefaultBranchViaRest")(function* (): Effect.fn.Return<
  string,
  YeetCommandError,
  YeetGithubServices
> {
  const command = "gh api repos/{owner}/{repo} --jq .default_branch";
  const branch = yield* GitHubRepository.use((repository) => repository.defaultBranch).pipe(
    Effect.mapBoth({
      onFailure: (error) =>
        YeetCommandError.make({
          message: `GitHub REST default branch read failed:\n${error.message}`,
          command,
          exitCode: 1,
          cause: error,
        }),
      onSuccess: Str.trim,
    })
  );
  if (Str.isEmpty(branch)) {
    return yield* YeetCommandError.make({
      message: "GitHub REST default branch read returned no branch.",
      command,
      exitCode: 1,
    });
  }
  return branch;
});

// Open the pull request through REST (draft when the planned step says so) on
// the default branch, headed by the pushed origin owner's branch. The title
// comes from the `--message` first line, else the first non-merge commit
// subject: the head commit may be a merge commit publish did not create, and
// the squash-merge subject is taken from this title. The REST create spends no
// GraphQL budget, so a rate limit cannot move it onto another path.
const createPullRequest = Effect.fn("Yeet.createPullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  message: O.Option<string>
): Effect.fn.Return<
  YeetEnsuredPullRequest,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
  | YeetGithubServices
> {
  const commitRange = yield* branchCommitRange(context);
  const resolved = yield* resolvePullRequestTitle(context, message, commitRange);
  const title = resolved.title;
  yield* Console.log(`[yeet] --pr: title from ${resolved.source}: ${title}`);
  const bodyPath = yield* runOutputPathForContext(context, "pr-body.md");
  const body = yield* buildPrBody(context, recorder);
  yield* writeTextFile(bodyPath, body);
  const draft = O.exists(prStep, (step) => A.contains(step.args, "--draft"));
  const base = yield* resolveDefaultBranchViaRest();
  const headOwner = yield* originPushOwner(context);
  const created = yield* GithubPullRequest.use((pulls) =>
    pulls.create({ title, head: `${headOwner}:${context.branch}`, base, body, draft })
  ).pipe(
    Effect.mapError((error) =>
      YeetCommandError.make({
        message: `GitHub REST pull request creation failed:\n${error.message}`,
        command: pullRequestCreateCommand,
        exitCode: 1,
        cause: error,
      })
    )
  );
  return yield* finishCreatedPullRequest(recorder, prStep, created, draft);
});

// Replace an existing pull request's title through the REST PATCH. A failure
// is reported, never fatal: the branch is already pushed and the owner can
// rename by hand.
const editPullRequestTitle = Effect.fn("Yeet.editPullRequestTitle")(function* (
  number: number,
  title: string
): Effect.fn.Return<YeetPullRequestTitleSync, never, YeetGithubServices> {
  return yield* GithubRest.use((rest) => rest.updatePullRequest(number, { title })).pipe(
    Effect.match({
      onFailure: (error) =>
        YeetPullRequestTitleSync.make({
          status: "failed",
          message: `could not replace the merge-commit subject on pull request #${number} through REST; review and edit its title in GitHub.\n${error.message}`,
        }),
      onSuccess: () =>
        YeetPullRequestTitleSync.make({
          status: "updated",
          message: `replaced the merge-commit subject on pull request #${number} with: ${title}`,
        }),
    })
  );
});

// A re-publish keeps the pull request title it finds unless that title is a
// merge-commit subject left by an earlier publish; then it resolves the title
// the create path would have used and renames the pull request. Title
// resolution failures degrade to a reported `failed` sync.
const syncExistingPullRequestTitle = Effect.fn("Yeet.syncExistingPullRequestTitle")(function* (
  context: RepoRunContext,
  existing: GhPrView,
  message: O.Option<string>
): Effect.fn.Return<
  YeetPullRequestTitleSync,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  const current = O.fromUndefinedOr(existing.title);
  if (!O.exists(current, isMergeCommitSubject)) {
    return YeetPullRequestTitleSync.make({
      status: "kept",
      message: `pull request #${existing.number} keeps its title`,
    });
  }
  const commitRange = yield* branchCommitRange(context);
  const resolved = yield* resolvePullRequestTitle(context, message, commitRange).pipe(
    Effect.asSome,
    Effect.catchTag("YeetCommandError", (error) =>
      Effect.as(Console.error(`[yeet] warning: ${error.message}`), O.none())
    )
  );
  if (O.isNone(resolved)) {
    return YeetPullRequestTitleSync.make({
      status: "failed",
      message: `pull request #${existing.number} still carries a merge-commit subject; pass --message to rename it`,
    });
  }
  if (O.contains(current, resolved.value.title)) {
    return YeetPullRequestTitleSync.make({
      status: "kept",
      message: `pull request #${existing.number} keeps its title`,
    });
  }
  return yield* editPullRequestTitle(existing.number, resolved.value.title);
});

// Reuse the open pull request a re-publish found: record the skipped create
// lane, and rename the pull request when its title is a merge-commit subject.
const reuseExistingPullRequest = Effect.fn("Yeet.reuseExistingPullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  existing: GhPrView,
  message: O.Option<string>
): Effect.fn.Return<
  YeetEnsuredPullRequest,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  yield* Console.log(
    `[yeet] --pr: open pull request #${existing.number} already exists for ${context.branch}; skipping create`
  );
  const sync = yield* syncExistingPullRequestTitle(context, existing, message);
  yield* YeetPullRequestTitleSyncStatus.match(sync.status, {
    kept: () => Effect.void,
    updated: () => Console.log(`[yeet] --pr: ${sync.message}`),
    failed: () => Console.error(`[yeet] warning: ${sync.message}`),
  });
  const skipped = `skipped: open pull request #${existing.number} already exists`;
  yield* recordPrCreateLane(
    recorder,
    prStep,
    YeetPullRequestTitleSyncStatus.is.kept(sync.status) ? skipped : `${skipped}; ${sync.message}`
  );
  return YeetEnsuredPullRequest.make({
    number: existing.number,
    url: O.fromUndefinedOr(existing.url),
    created: false,
  });
});

/**
 * Create a pull request for publish when one does not already exist.
 *
 * **Details**
 *
 * The title is the `--message` first line when publish was given one, else the
 * branch's first non-merge commit subject, never the head commit's subject: a
 * re-publish whose head is a merge commit would otherwise title the pull
 * request, and its squash-merge commit, after the merge. An existing open
 * pull request keeps its title unless it still equals a merge-commit subject,
 * in which case this call renames it the same way.
 *
 * **Example** (Ensure PR when missing)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Ref from "effect/Ref";
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
 * @param dependencies - Injectable open pull request lookup and registry for deterministic tests.
 * @param message - The publish `--message`, whose first line titles the pull request.
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
  dependencies: EnsurePullRequestDependencies = {},
  message: O.Option<string> = O.none()
): Effect.fn.Return<
  YeetEnsuredPullRequest,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
  | YeetGithubServices
> {
  const existing = yield* (dependencies.findOpen ?? findOpenPullRequest)(context);
  const pullRequest = O.isSome(existing)
    ? yield* reuseExistingPullRequest(context, recorder, prStep, existing.value, message)
    : yield* createPullRequest(context, recorder, prStep, message);
  // A failed provenance stamp must not stop the heavy-admission label or the
  // readiness monitor that follow: the pull request already exists on the
  // remote, so record the failure and carry on.
  yield* stampPullRequestProvenance(
    context,
    recorder,
    stampStep,
    pullRequest.number,
    pullRequest.created ? pullRequest.url : O.none(),
    pullRequest.created ? "created" : "pushed",
    dependencies.registry
  ).pipe(
    Effect.catch((error) =>
      Effect.andThen(
        Console.error(
          `[yeet] warning: provenance footer stamp failed for PR #${pullRequest.number}; continuing: ${error.message}`
        ),
        recordPrProvenanceStampLane(
          recorder,
          stampStep,
          O.some(pullRequest.number),
          ProvenanceStampOutcome.make({ status: "failed", message: error.message })
        )
      )
    )
  );
  return pullRequest;
});

interface HeavyAdmissionLabelDependencies {
  readonly changedPaths?: (
    context: RepoRunContext
  ) => Effect.Effect<
    ReadonlyArray<string>,
    YeetCommandError,
    SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
  >;
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
          commandText: `gh api -X POST repos/{owner}/{repo}/issues/<number>/labels -f labels[]=${HEAVY_ADMISSION_LABEL}`,
          exitCode: status === "failed" ? 1 : 0,
          output,
        }),
        status,
        step: labelStep,
      })
    )
  );

const branchChangedPaths = (context: RepoRunContext) =>
  Effect.flatMap(Git, (git) => git.changedFiles(context.repoRoot, { base: context.base, head: "HEAD" })).pipe(
    Effect.mapBoth({
      onFailure: yeetGitKitError(GitCommand.changedFiles(context.base, "HEAD")),
      onSuccess: sortedUniquePaths,
    })
  );

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
 * import * as Effect from "effect/Effect";
 * import * as Ref from "effect/Ref";
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
 * @param dependencies - Injectable changed-path reader for tests.
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
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
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
  // REST, not `gh pr edit` (GraphQL): labelling must not fail when the shared GraphQL budget is spent.
  // `args` is the equivalent `gh` call the warning hands the operator.
  const args = [
    "api",
    "-X",
    "POST",
    `repos/{owner}/{repo}/issues/${pullRequest.number}/labels`,
    "-f",
    `labels[]=${HEAVY_ADMISSION_LABEL}`,
    "--jq",
    'map(.name) | join(",")',
  ];
  const result = yield* Effect.result(
    GithubRest.use((rest) => rest.addLabels(pullRequest.number, [HEAVY_ADMISSION_LABEL]))
  );
  if (Result.isFailure(result)) {
    yield* Console.error(
      `[yeet] warning: could not apply ${HEAVY_ADMISSION_LABEL} to PR #${pullRequest.number}; run: gh ${A.join(args, " ")}\n${result.failure.message}`
    );
    yield* recordPrLabelLane(recorder, labelStep.value, "failed", result.failure.message);
    return;
  }
  yield* Console.log(`[yeet] applied ${HEAVY_ADMISSION_LABEL} to PR #${pullRequest.number}`);
  yield* recordPrLabelLane(recorder, labelStep.value, "passed", A.join(result.success, ","));
});

/**
 * Ensure the current branch has an open PR whose head matches the branch.
 *
 * **Example** (Validate matching open PR)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
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
