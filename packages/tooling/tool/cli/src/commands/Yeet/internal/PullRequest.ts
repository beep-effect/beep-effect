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
import { LiteralKit } from "@beep/schema";
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
import { ComputeProfileProbe } from "../../../internal/repo-run/ComputeProfile.ts";
import { COMPUTE_PROFILE_WORKER_LABEL } from "../../../internal/repo-run/GateRoute.schemas.ts";
import { RepoStepRunResult, sortedUniquePaths } from "../../../internal/repo-run/index.ts";
import { HEAVY_ADMISSION_LABEL, isHeavyDocsOnlyPath } from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
  writeTextFile,
} from "./ArtifactPaths.ts";
import { readFinalCheckReceipt } from "./FinalCheck.ts";
import { currentCommitSha, yeetGitKitError } from "./GitExec.ts";
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
import type { FinalCheckReceipt, FinalCheckStepResult } from "./FinalCheck.schemas.ts";
import type { YeetGithubServices } from "./GhOps.ts";
import type { PrNumber } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";
import type { YeetStackPublishDecision } from "./Stack.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/PullRequest");

// The stack layer a publish runs as: the parent's branch and head it builds on.
type YeetStackLayerTarget = typeof YeetStackPublishDecision.cases.Layer.Type;

// KEEP (W6): `gh pr view` of the checked-out branch resolves the pull request
// from the branch itself, which no kit member does; it stays the fallback for a
// REST lookup that failed.
const ghPullRequestViewArgs = ["pr", "view", "--json", "number,headRefName,state,url,title"] as const;
const ghPullRequestViewCommand = "gh pr view --json number,headRefName,state,url,title";
const decodeGhPullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));
const confirmedMissingPullRequest = (
  context: RepoRunContext,
  headOwner: O.Option<string>,
  failure: GhCommandFailure
): boolean =>
  failure._tag === "nonzero-exit" &&
  A.contains(
    [
      "no pull requests found",
      `no pull requests found for branch "${context.branch}"`,
      ...headOwner.pipe(
        O.map((owner) => `no pull requests found for branch "${owner}:${context.branch}"`),
        O.toArray
      ),
    ],
    Str.trim(failure.output)
  );
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

/**
 * Read the owner of the repository the checkout pushes to, the head owner of
 * every pull request a publish opens or finds.
 *
 * **Details**
 *
 * Parsed from `git remote get-url --push origin` (SSH, `ssh://` or HTTPS), so a
 * fork pushes as its own owner. A missing origin or an unparseable URL fails.
 *
 * **Example** (Read the head owner)
 *
 * ```ts
 * import { originPushOwner, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
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
 * console.log(Effect.isEffect(originPushOwner(context))) // true
 * ```
 *
 * @param context - The checkout whose push URL is read.
 * @returns The owner segment of the push URL.
 * @category clients
 * @since 0.0.0
 */
export const originPushOwner = Effect.fn("Yeet.originPushOwner")(function* (context: RepoRunContext) {
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

const ghPullRequestViewFailure = (
  context: RepoRunContext,
  headOwner: O.Option<string>,
  failure: GhCommandFailure
): YeetCommandError => {
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
    message: confirmedMissingPullRequest(context, headOwner, failure)
      ? "yeet monitor requires an open pull request for the current branch. Run the full local proof fallback with `bun run audit:github pre-push` when no PR is available."
      : "Failed to inspect current branch pull request through gh pr view; PR presence is unknown.",
    command: ghPullRequestViewCommand,
    exitCode: failure.exitCode,
    cause: failure,
  });
};

const pullRequestLookupFailure = (
  context: RepoRunContext,
  headOwner: O.Option<string>,
  restFailure: O.Option<YeetCommandError>,
  fallbackFailure: GhCommandFailure
): YeetCommandError =>
  !confirmedMissingPullRequest(context, headOwner, fallbackFailure) && O.isSome(restFailure)
    ? restFailure.value
    : ghPullRequestViewFailure(context, headOwner, fallbackFailure);

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
  const viaRest = yield* Effect.result(findOpenPullRequestViaRest(context));
  if (Result.isSuccess(viaRest) && O.isSome(viaRest.success)) return viaRest.success.value;
  // Optional owner metadata only qualifies an exact fork-owner absence message.
  // An unresolved owner cannot confirm qualified absence.
  const headOwner = yield* originPushOwner(context).pipe(Effect.result, Effect.map(Result.getSuccess));
  return yield* ghPullRequestViewOutput(context).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        Effect.fail(pullRequestLookupFailure(context, headOwner, Result.getFailure(viaRest), failure)),
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
 * @returns `Some` open metadata, or `None` from a confirmed empty/closed/mismatched
 * lookup. Transport, rate, auth and undecodable failures remain typed errors.
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
  // and any unknown fallback failure preserves a typed error, never "no PR".
  const viaRest = yield* Effect.result(findOpenPullRequestViaRest(context));
  if (Result.isSuccess(viaRest)) return viaRest.success;
  const headOwner = yield* originPushOwner(context).pipe(Effect.result, Effect.map(Result.getSuccess));
  return yield* ghPullRequestViewOutput(context).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        confirmedMissingPullRequest(context, headOwner, failure)
          ? Effect.succeedNone
          : Effect.fail(pullRequestLookupFailure(context, headOwner, O.some(viaRest.failure), failure)),
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
// base cannot be resolved; a stack layer's start from its parent's head
// (`since`). Shared by the PR body and the PR title so both describe the same
// commits.
const branchCommitRange = Effect.fn("Yeet.branchCommitRange")(function* (
  context: RepoRunContext,
  since: O.Option<string> = O.none()
): Effect.fn.Return<string, never, Git> {
  if (O.isSome(since)) return `${since.value}..HEAD`;
  const git = yield* Git;
  const mergeBase = yield* git.mergeBase(context.repoRoot, context.base, "HEAD").pipe(Effect.orElseSucceed(() => ""));
  return Str.isNonEmpty(mergeBase) ? `${mergeBase}..HEAD` : "HEAD";
});

/**
 * What the body of a pull request a publish creates should carry.
 *
 * **Details**
 *
 * `summary` replaces the generated commit-log summary (`--body-file`), so an
 * agent writes its own description at creation instead of rewriting the body
 * afterwards, which is what used to drop the provenance footer. `hostedProof`
 * marks a `yeet open` body: no cheap gate ran, and the "Local proof" section
 * says so. A head with its own passing final-check receipt also gets a
 * "Final check" section naming the gates that ran and each skipped gate's reason.
 *
 * **Example** (Request a hosted-proof body)
 *
 * ```ts
 * import { YeetPrBodyRequest } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const request = YeetPrBodyRequest.make({ summary: O.some("## Summary\n\nWhy."), hostedProof: true })
 * console.log(request.hostedProof) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrBodyRequest extends S.Opaque<YeetPrBodyRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    summary: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    hostedProof: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("YeetPrBodyRequest", {
      description: "Summary override and proof route for the body of a pull request a publish creates.",
    })
  )
) {}

const HOSTED_PROOF_SECTION = "- none: `yeet open` pushed without the cheap gates; hosted CI proves them" as const;

/**
 * Render the "Final check" section of a pull request body from the head's
 * final-check receipt.
 *
 * **Details**
 *
 * A pull request opens ready on the strength of this receipt, so the body
 * names what it holds: the gates that ran, and each gate that was skipped with
 * the reason recorded at `yeet final-check --skip <gate>=<reason>`. A reviewer
 * then sees which gates hosted CI alone proves without asking the owner.
 *
 * **Example** (Name a skipped gate)
 *
 * ```ts
 * import { FinalCheckReceipt, FinalCheckStepResult, renderFinalCheckBodySection } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = FinalCheckReceipt.make({
 *   headSha: "a".repeat(40), mergeBase: "b".repeat(40), base: "origin/main", complete: true, verdict: "pass",
 *   startedAt: "2026-11-13T00:00:00.000Z", finishedAt: "2026-11-13T00:01:00.000Z", expectationRewrites: [],
 *   steps: [
 *     FinalCheckStepResult.make({
 *       gate: "coverage", label: "final-check:coverage", hostedContext: "Heavy / Coverage", command: "(skipped)",
 *       status: "skipped", durationMs: 0, reason: "admission waited 10 minutes",
 *     }),
 *   ],
 * })
 * console.log(renderFinalCheckBodySection(receipt))
 * // ## Final check
 * //
 * // - `yeet final-check` on aaaaaaaaaaaa: pass
 * // - skipped, proved by hosted CI only: coverage (admission waited 10 minutes)
 * ```
 *
 * @param receipt - The receipt of the head the pull request opens on.
 * @returns The Markdown section.
 * @category formatting
 * @since 0.0.0
 */
export const renderFinalCheckBodySection = (receipt: FinalCheckReceipt): string => {
  const gatesWith = (status: FinalCheckStepResult["status"]) =>
    pipe(
      receipt.steps,
      A.filter((step) => step.status === status),
      A.dedupeWith((left, right) => left.gate === right.gate)
    );
  const ran = A.map(gatesWith("passed"), (step) => step.gate);
  const skipped = A.map(gatesWith("skipped"), (step) => `${step.gate} (${step.reason ?? "no reason recorded"})`);
  return A.join(
    [
      "## Final check",
      "",
      `- \`yeet final-check\` on ${Str.slice(0, 12)(receipt.headSha)}: ${receipt.verdict}`,
      ...(A.isReadonlyArrayNonEmpty(ran) ? [`- ran: ${A.join(ran, ", ")}`] : []),
      ...(A.isReadonlyArrayNonEmpty(skipped) ? [`- skipped, proved by hosted CI only: ${A.join(skipped, "; ")}`] : []),
    ],
    "\n"
  );
};

// The head's own passing receipt, when it has one: a carried or missing receipt adds no section.
const finalCheckBodySection = Effect.fn("Yeet.finalCheckBodySection")(function* (context: RepoRunContext) {
  const head = yield* currentCommitSha(context).pipe(Effect.option);
  if (O.isNone(head)) return "";
  const receipt = yield* readFinalCheckReceipt(context.repoRoot, head.value);
  return pipe(
    receipt,
    O.filter((value) => value.verdict === "pass" && value.complete),
    O.match({ onNone: () => "", onSome: (value) => `\n${renderFinalCheckBodySection(value)}\n` })
  );
});

const commitLogSummary = Effect.fn("Yeet.commitLogSummary")(function* (
  context: RepoRunContext,
  since: O.Option<string>
) {
  const range = yield* branchCommitRange(context, since);
  // `Git.log` with `includeBody` carries `%b`, so the body renders back to the `## %s%n%n%b` text
  // entries joined by a newline, as `--pretty=format:` separated them (W7a Y55, SPEC D-18).
  const git = yield* Git;
  const logOptions = { revisions: [range], reverse: true, omitPaths: true, includeBody: true };
  return yield* git.log(context.repoRoot, logOptions).pipe(
    Effect.mapBoth({
      onFailure: yeetGitKitError(GitCommand.log([], false, undefined, false, logOptions)),
      onSuccess: flow(
        A.map((commit) => `## ${commit.subject}\n\n${commit.body ?? ""}`),
        A.join("\n")
      ),
    })
  );
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
 * @param request - Optional summary override and proof route; the default
 * summarizes the branch's commits and lists the recorded lanes.
 * @param since - For a stack layer, its parent's head: the summary then covers
 * only the layer's own commits.
 * @returns Markdown body text for the pull request the publish opens.
 * @category formatting
 * @since 0.0.0
 */
export const buildPrBody = Effect.fn("Yeet.buildPrBody")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  request: YeetPrBodyRequest = YeetPrBodyRequest.make({}),
  since: O.Option<string> = O.none()
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
  const summary = yield* O.match(request.summary, {
    onNone: () => commitLogSummary(context, since),
    onSome: Effect.succeed,
  });
  const executed = yield* Ref.get(recorder);
  const laneSummary = pipe(
    executed,
    A.map((entry) => `- ${entry.step.label}: ${entry.result.exitCode === 0 ? "passed" : "failed"}`),
    A.join("\n")
  );
  const proofSection = request.hostedProof
    ? HOSTED_PROOF_SECTION
    : Str.isNonEmpty(laneSummary)
      ? laneSummary
      : "- no local proof lane ran before the push; hosted CI is the authoritative proof";
  const runId = yield* runIdForContext(context);
  const finalCheck = yield* finalCheckBodySection(context);
  return `${Str.trim(summary)}\n\n## Local proof\n\n${proofSection}\n${finalCheck}\nVerdict: .beep/yeet/runs/${runId}/verdict.json\n`;
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

/**
 * Read the repository's default branch through REST: the trunk every new pull
 * request targets, and the trunk a stack lands on.
 *
 * **Details**
 *
 * Neither `--base` (the affected-planning base) nor a
 * `branch.<name>.gh-merge-base` setting may pick the target. A failed or empty
 * read is an error, not a guessed `main`. A stack layer targets its parent's
 * branch instead, and its stack lands on this branch.
 *
 * **Example** (Read the trunk)
 *
 * ```ts
 * import { resolveDefaultBranchViaRest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveDefaultBranchViaRest())) // true
 * ```
 *
 * @returns The default branch name.
 * @category clients
 * @since 0.0.0
 */
export const resolveDefaultBranchViaRest = Effect.fn("Yeet.resolveDefaultBranchViaRest")(function* (): Effect.fn.Return<
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
// GraphQL budget, so a rate limit cannot move it onto another path. A stack
// layer opens on its parent's branch, titled and summarized from its own
// commits since the parent's head.
const createPullRequest = Effect.fn("Yeet.createPullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  message: O.Option<string>,
  bodyRequest: YeetPrBodyRequest,
  stackLayer: O.Option<YeetStackLayerTarget>
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
  const since = O.map(stackLayer, (layer) => layer.parentHeadSha);
  const commitRange = yield* branchCommitRange(context, since);
  const resolved = yield* resolvePullRequestTitle(context, message, commitRange);
  const title = resolved.title;
  yield* Console.log(`[yeet] --pr: title from ${resolved.source}: ${title}`);
  const bodyPath = yield* runOutputPathForContext(context, "pr-body.md");
  const body = yield* buildPrBody(context, recorder, bodyRequest, since);
  yield* writeTextFile(bodyPath, body);
  const draft = O.exists(prStep, (step) => A.contains(step.args, "--draft"));
  const base = yield* O.match(stackLayer, {
    onNone: () => resolveDefaultBranchViaRest(),
    onSome: (layer) => Effect.succeed(layer.parentHeadRef),
  });
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
  message: O.Option<string>,
  since: O.Option<string>
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
  const commitRange = yield* branchCommitRange(context, since);
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
  message: O.Option<string>,
  since: O.Option<string>
): Effect.fn.Return<
  YeetEnsuredPullRequest,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  yield* Console.log(
    `[yeet] --pr: open pull request #${existing.number} already exists for ${context.branch}; skipping create`
  );
  const sync = yield* syncExistingPullRequestTitle(context, existing, message, since);
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
 * @param bodyRequest - Summary override and proof route for a pull request this
 * call creates; an existing pull request keeps its body.
 * @param stackLayer - The stack layer this branch publishes as, if any: a
 * created pull request opens on the parent's branch, titled and summarized
 * from the layer's own commits. Linking the two is the caller's step.
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
  message: O.Option<string> = O.none(),
  bodyRequest: YeetPrBodyRequest = YeetPrBodyRequest.make({}),
  stackLayer: O.Option<YeetStackLayerTarget> = O.none()
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
    ? yield* reuseExistingPullRequest(
        context,
        recorder,
        prStep,
        existing.value,
        message,
        O.map(stackLayer, (layer) => layer.parentHeadSha)
      )
    : yield* createPullRequest(context, recorder, prStep, message, bodyRequest, stackLayer);
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
 * What adding the heavy-admission label to one pull request did.
 *
 * **Example** (Recognize a docs-only skip)
 *
 * ```ts
 * import { YeetHeavyAdmissionLabelStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetHeavyAdmissionLabelStatus.is["docs-only"]("docs-only")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetHeavyAdmissionLabelStatus = LiteralKit(["applied", "docs-only", "failed"]).pipe(
  $I.annoteSchema("YeetHeavyAdmissionLabelStatus", {
    description: "Whether the heavy-admission label was applied, skipped for a docs-only diff, or failed.",
  })
);

/**
 * What adding the heavy-admission label to one pull request did.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetHeavyAdmissionLabelStatus = typeof YeetHeavyAdmissionLabelStatus.Type;

/**
 * The outcome of one heavy-admission label attempt, with the text a recorded
 * lane keeps.
 *
 * **Example** (Describe an applied label)
 *
 * ```ts
 * import { YeetHeavyAdmissionLabelOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = YeetHeavyAdmissionLabelOutcome.make({ status: "applied", detail: "ready-for-heavy" })
 * console.log(outcome.status) // "applied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeavyAdmissionLabelOutcome extends S.Opaque<
  YeetHeavyAdmissionLabelOutcome,
  { readonly brand: unique symbol }
>()(
  S.Struct({ status: YeetHeavyAdmissionLabelStatus, detail: S.String }).pipe(
    $I.annoteSchema("YeetHeavyAdmissionLabelOutcome", {
      description: "Status and recorded detail of one heavy-admission label attempt.",
    })
  )
) {}

/**
 * Admit one pull request to the heavy matrix by adding the `ready-for-heavy`
 * label, unless its diff is docs-only.
 *
 * **Details**
 *
 * The one label edit behind both callers: a publish that opens a pull request
 * ready (or as a heavy-admitted draft), and `yeet ready` when it flips a
 * cheap-tier draft. A diff whose every path is docs-only skips the label,
 * because the heavy matrix already treats it as satisfied. A failed edit is a
 * warning that names the equivalent `gh` call, never an error: the pull
 * request exists, and `monitor --until-ready` holds on `heavy-not-admitted`
 * until the label lands.
 *
 * **Example** (Build the admission effect)
 *
 * ```ts
 * import { admitPullRequestToHeavy, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main", branch: "feature/x", cwd: ".", head: "HEAD", originalArgv: [],
 *   packetDir: ".beep/yeet", repoRoot: ".", turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(Effect.isEffect(admitPullRequestToHeavy(context, 7))) // true
 * ```
 *
 * @param context - Repo context whose branch diff decides the docs-only skip.
 * @param prNumber - The pull request to label.
 * @param dependencies - Injectable changed-path reader for tests.
 * @returns What the attempt did.
 * @category workflows
 * @since 0.0.0
 */
export const admitPullRequestToHeavy = Effect.fn("Yeet.admitPullRequestToHeavy")(function* (
  context: RepoRunContext,
  prNumber: number,
  dependencies: HeavyAdmissionLabelDependencies = {}
): Effect.fn.Return<
  YeetHeavyAdmissionLabelOutcome,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  const changedPaths = yield* (dependencies.changedPaths ?? branchChangedPaths)(context);
  if (A.isReadonlyArrayNonEmpty(changedPaths) && A.every(changedPaths, isHeavyDocsOnlyPath)) {
    yield* Console.log(`[yeet] docs-only diff: ${HEAVY_ADMISSION_LABEL} not applied to PR #${prNumber}`);
    return YeetHeavyAdmissionLabelOutcome.make({
      status: "docs-only",
      detail: "skipped: docs-only diff needs no heavy matrix",
    });
  }
  // REST, not `gh pr edit` (GraphQL): labelling must not fail when the shared GraphQL budget is spent.
  // `args` is the equivalent `gh` call the warning hands the operator.
  const args = [
    "api",
    "-X",
    "POST",
    `repos/{owner}/{repo}/issues/${prNumber}/labels`,
    "-f",
    `labels[]=${HEAVY_ADMISSION_LABEL}`,
    "--jq",
    'map(.name) | join(",")',
  ];
  const result = yield* Effect.result(GithubRest.use((rest) => rest.addLabels(prNumber, [HEAVY_ADMISSION_LABEL])));
  if (Result.isFailure(result)) {
    yield* Console.error(
      `[yeet] warning: could not apply ${HEAVY_ADMISSION_LABEL} to PR #${prNumber}; run: gh ${A.join(args, " ")}\n${result.failure.message}`
    );
    return YeetHeavyAdmissionLabelOutcome.make({ status: "failed", detail: result.failure.message });
  }
  yield* Console.log(`[yeet] applied ${HEAVY_ADMISSION_LABEL} to PR #${prNumber}`);
  return YeetHeavyAdmissionLabelOutcome.make({ status: "applied", detail: A.join(result.success, ",") });
});

/**
 * Apply the heavy-admission label to the pull request a publish just created.
 *
 * **Details**
 *
 * A publish that opens its pull request ready, or as a heavy-admitted draft
 * (a stack layer, a worker compute profile), admits the heavy matrix at
 * creation, so the hosted proof starts with the open instead of waiting for
 * someone to add the label. A `--draft` open plans no label step, so this
 * does nothing and `yeet ready` applies the label at the flip. A diff whose
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
  const outcome = yield* admitPullRequestToHeavy(context, pullRequest.number, dependencies);
  yield* recordPrLabelLane(
    recorder,
    labelStep.value,
    YeetHeavyAdmissionLabelStatus.match(outcome.status, {
      applied: () => "passed" as const,
      "docs-only": () => "skipped" as const,
      failed: () => "failed" as const,
    }),
    outcome.detail
  );
});

/**
 * Add the `compute-profile-worker` label to a pull request `yeet open` pushed
 * from a `worker` host.
 *
 * **Details**
 *
 * Resolves the compute profile through `ComputeProfileProbe`; on `workstation`
 * (or an unreadable override) it does nothing. The REST issues endpoint
 * creates the label when the repository lacks it. A failed add is one warning:
 * the hosted regeneration job that keys on the label is a convenience, never a
 * reason to fail the publish.
 *
 * **Example** (Build the label effect)
 *
 * ```ts
 * import { applyComputeProfileLabel, YeetEnsuredPullRequest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const pullRequest = YeetEnsuredPullRequest.make({ number: 7, created: true })
 * console.log(Effect.isEffect(applyComputeProfileLabel(pullRequest))) // true
 * ```
 *
 * @param pullRequest - The pull request the open created or found.
 * @returns An Effect that completes once the label is added or skipped.
 * @category workflows
 * @since 0.0.0
 */
export const applyComputeProfileLabel = Effect.fn("Yeet.applyComputeProfileLabel")(function* (
  pullRequest: YeetEnsuredPullRequest
): Effect.fn.Return<void, never, YeetGithubServices> {
  const profile = yield* ComputeProfileProbe.use((probe) => probe.resolve).pipe(
    Effect.map((resolution) => O.some(resolution.profile)),
    Effect.orElseSucceed(O.none)
  );
  if (!O.contains(profile, "worker")) return;
  const result = yield* Effect.result(
    GithubRest.use((rest) => rest.addLabels(pullRequest.number, [COMPUTE_PROFILE_WORKER_LABEL]))
  );
  yield* Result.isFailure(result)
    ? Console.error(
        `[yeet] warning: could not apply ${COMPUTE_PROFILE_WORKER_LABEL} to PR #${pullRequest.number}; run: gh api -X POST repos/{owner}/{repo}/issues/${pullRequest.number}/labels -f labels[]=${COMPUTE_PROFILE_WORKER_LABEL}\n${result.failure.message}`
      )
    : Console.log(`[yeet] applied ${COMPUTE_PROFILE_WORKER_LABEL} to PR #${pullRequest.number}`);
});

/**
 * Label the pull request a publish created or found: the compute-profile
 * worker label first (only for `yeet open`'s hosted-proof route), then the
 * heavy-admission label.
 *
 * **Details**
 *
 * Every label event starts a Heavy Admit run, and the base ruleset reads only
 * the newest run's check suite. On a same-repository pull request that carries
 * `ready-for-heavy`, a later label's run waits behind the admitted run in the
 * shared concurrency group, then re-reports that run's passing proof (every
 * `Heavy / <lane>` skipped, no EC2 work) or skips (`heavy-admit.yml`). Adding
 * the worker label first leaves the `ready-for-heavy` run the newest, so
 * opening a pull request queues no second run behind the admitted matrix and
 * leaves one Heavy Admit suite for the ruleset to read.
 *
 * **Example** (Build the label effect)
 *
 * ```ts
 * import { applyPublishLabels, RepoRunContext, YeetEnsuredPullRequest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Ref from "effect/Ref"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main", branch: "feature/x", cwd: ".", head: "HEAD", originalArgv: [],
 *   packetDir: ".beep/yeet", repoRoot: ".", turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const program = Effect.gen(function* () {
 *   const recorder = yield* Ref.make([])
 *   yield* applyPublishLabels(context, recorder, O.none(), YeetEnsuredPullRequest.make({ number: 1, created: true }), false)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo context whose branch diff decides the docs-only skip.
 * @param recorder - Execution recorder updated with the heavy-admission label lane.
 * @param labelStep - Planned heavy-admission label step; `None` skips that label.
 * @param pullRequest - The pull request the publish created or found.
 * @param hostedProof - Whether this is `yeet open`'s hosted-proof route, which adds the worker label.
 * @param dependencies - Injectable changed-path reader for tests.
 * @returns An Effect that completes after both labels are added or skipped.
 * @category workflows
 * @since 0.0.0
 */
export const applyPublishLabels = Effect.fn("Yeet.applyPublishLabels")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  labelStep: O.Option<RepoPlanStep>,
  pullRequest: YeetEnsuredPullRequest,
  hostedProof: boolean,
  dependencies: HeavyAdmissionLabelDependencies = {}
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git | YeetGithubServices
> {
  if (hostedProof) yield* applyComputeProfileLabel(pullRequest);
  yield* applyHeavyAdmissionLabel(context, recorder, labelStep, pullRequest, dependencies);
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
