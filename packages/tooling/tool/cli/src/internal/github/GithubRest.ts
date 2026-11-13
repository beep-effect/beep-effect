/**
 * REST-first pull-request operations for the repo CLI, over `@beep/github`.
 *
 * **Details**
 *
 * GitHub REST has its own 5,000-request hourly budget that the workstation
 * almost never exhausts, while GraphQL (which `gh pr view|edit|ready|merge|checks`
 * all use under the hood) runs dry several times a day. {@link GithubRest}
 * covers every pull-request read and write that has a REST endpoint: the pull
 * request itself, labels, issue comments, check runs, the base ruleset's
 * required contexts, the review timeline, the head's first check-suite receipt,
 * the squash merge, native stacks (read and create), workflow re-runs and
 * cancels, and the rate limit.
 * The GraphQL-only operations (review-thread resolution state, the
 * draft-to-ready flip) live behind `GraphqlBudget`.
 *
 * Each method decodes the REST payload through a wire schema and returns a
 * repo-owned record, so callers never see octokit types.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { Repo } from "@beep/github/Repo";
import { PageOptions } from "@beep/github/Rest";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/github/GithubRest");

/**
 * Where a pull request sits in a native GitHub stack.
 *
 * **Details**
 *
 * `position` counts from 1 at the bottom layer, `size` counts every layer the
 * stack ever held (GitHub does not renumber after a layer merges), and
 * `baseRef` is the trunk the stack lands on, not the layer's own base: an
 * upper layer's `baseRef` on its pull record is the branch of the layer below.
 *
 * **Example** (The top of a two-layer stack)
 *
 * ```ts
 * import { GithubPullRequestStackRef } from "@beep/repo-cli/test/SharedInternals"
 *
 * const ref = GithubPullRequestStackRef.make({ number: 3150, position: 2, size: 2, baseRef: "main" })
 * console.log(ref.position === ref.size) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubPullRequestStackRef extends S.Opaque<GithubPullRequestStackRef, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    position: S.Int,
    size: S.Int,
    baseRef: S.String,
  }).pipe(
    $I.annoteSchema("GithubPullRequestStackRef", {
      description: "Where a pull request sits in a native GitHub stack.",
    })
  )
) {}

/**
 * A pull request as the REST `pulls/{n}` endpoint reports it, reduced to what
 * the CLI reads.
 *
 * **Details**
 *
 * `stack` is none for a pull request outside a native stack. `mergeCommitSha`
 * is the commit GitHub wrote when it merged the pull request and is none until
 * then: on an open pull request GitHub reports a test-merge commit under the
 * same key, which is not carried.
 *
 * **Example** (Build a record)
 *
 * ```ts
 * import { GithubPullRequestRecord } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 *
 * const pr = GithubPullRequestRecord.make({
 *   number: 7,
 *   nodeId: "PR_kw",
 *   title: "feat: x",
 *   body: "",
 *   state: "open",
 *   draft: true,
 *   merged: false,
 *   mergeableState: O.some("clean"),
 *   headRef: "feat/x",
 *   headSha: "abc",
 *   baseRef: "main",
 *   baseSha: "def",
 *   htmlUrl: "https://github.com/o/r/pull/7",
 *   author: "octocat",
 *   labels: [],
 *   createdAt: DateTime.makeUnsafe("2026-10-06T00:00:00Z"),
 *   updatedAt: DateTime.makeUnsafe("2026-10-06T00:00:00Z")
 * })
 * console.log(pr.draft) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubPullRequestRecord extends S.Opaque<GithubPullRequestRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    nodeId: S.String,
    title: S.String,
    body: S.String,
    state: S.String,
    draft: S.Boolean,
    merged: S.Boolean,
    mergeableState: S.Option(S.String),
    headRef: S.String,
    headSha: S.String,
    baseRef: S.String,
    baseSha: S.String,
    htmlUrl: S.String,
    author: S.String,
    labels: S.Array(S.String),
    createdAt: S.DateTimeUtc,
    updatedAt: S.DateTimeUtc,
    stack: S.Option(GithubPullRequestStackRef).pipe(S.withConstructorDefault(Effect.succeedNone)),
    mergeCommitSha: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe($I.annoteSchema("GithubPullRequestRecord", { description: "A pull request read over GitHub REST." }))
) {}

const PullStackWire = S.Struct({
  number: S.Int,
  position: S.Int,
  size: S.Int,
  base: S.Struct({ ref: S.String }),
});

const PullWire = S.Struct({
  number: S.Int,
  node_id: S.String,
  title: S.String,
  body: S.NullOr(S.String),
  state: S.String,
  draft: S.optionalKey(S.Boolean),
  merged: S.optionalKey(S.Boolean),
  merged_at: S.NullOr(S.String),
  merge_commit_sha: S.String.pipe(S.NullOr, S.optionalKey),
  mergeable_state: S.String.pipe(S.NullOr, S.optionalKey),
  head: S.Struct({ ref: S.String, sha: S.String }),
  base: S.Struct({ ref: S.String, sha: S.String }),
  html_url: S.String,
  user: S.NullOr(S.Struct({ login: S.String })),
  labels: S.Array(S.Struct({ name: S.String })),
  created_at: S.DateTimeUtcFromString,
  updated_at: S.DateTimeUtcFromString,
  stack: PullStackWire.pipe(S.NullOr, S.optionalKey),
});

const PullFileWire = S.Struct({ filename: S.String });

const toPullRequestRecord = (wire: typeof PullWire.Type): GithubPullRequestRecord => {
  const merged = wire.merged ?? wire.merged_at !== null;
  return GithubPullRequestRecord.make({
    number: wire.number,
    nodeId: wire.node_id,
    title: wire.title,
    body: wire.body ?? "",
    state: wire.state,
    draft: wire.draft ?? false,
    merged,
    mergeableState: O.fromNullishOr(wire.mergeable_state),
    headRef: wire.head.ref,
    headSha: wire.head.sha,
    baseRef: wire.base.ref,
    baseSha: wire.base.sha,
    htmlUrl: wire.html_url,
    author: wire.user?.login ?? "",
    labels: A.map(wire.labels, (label) => label.name),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
    stack: O.map(O.fromNullishOr(wire.stack), (stack) =>
      GithubPullRequestStackRef.make({
        number: stack.number,
        position: stack.position,
        size: stack.size,
        baseRef: stack.base.ref,
      })
    ),
    // An open pull request reports a test-merge commit under the same key.
    mergeCommitSha: merged ? O.filter(O.fromNullishOr(wire.merge_commit_sha), Str.isNonEmpty) : O.none(),
  });
};

/**
 * One layer of a native stack, as the Stacks endpoints list it.
 *
 * **Example** (An open lower layer)
 *
 * ```ts
 * import { GithubStackLayerRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const layer = GithubStackLayerRecord.make({
 *   number: 41,
 *   state: "open",
 *   draft: false,
 *   merged: false,
 *   headRef: "feat/parent",
 *   headSha: "abc",
 * })
 * console.log(layer.merged) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubStackLayerRecord extends S.Opaque<GithubStackLayerRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    state: S.String,
    draft: S.Boolean,
    merged: S.Boolean,
    headRef: S.String,
    headSha: S.String,
  }).pipe($I.annoteSchema("GithubStackLayerRecord", { description: "One layer of a native GitHub stack." }))
) {}

/**
 * A native GitHub stack: pull requests chained base to head on one trunk.
 *
 * **Details**
 *
 * `layers` runs bottom to top and keeps merged layers, so a layer's index plus
 * one is its `position`. `baseRef` is the trunk. `open` turns false once no
 * layer is open.
 *
 * **Example** (Count the open layers)
 *
 * ```ts
 * import { GithubStackLayerRecord, GithubStackRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const layer = (number: number, headRef: string) =>
 *   GithubStackLayerRecord.make({ number, state: "open", draft: false, merged: false, headRef, headSha: "abc" })
 * const stack = GithubStackRecord.make({
 *   number: 43,
 *   open: true,
 *   baseRef: "main",
 *   layers: [layer(41, "feat/parent"), layer(42, "feat/child")],
 * })
 * console.log(stack.layers.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubStackRecord extends S.Opaque<GithubStackRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    open: S.Boolean,
    baseRef: S.String,
    layers: S.Array(GithubStackLayerRecord),
  }).pipe($I.annoteSchema("GithubStackRecord", { description: "A native GitHub stack, layers bottom to top." }))
) {}

/**
 * What GitHub answered to a request to link pull requests into a stack.
 *
 * **Details**
 *
 * - `Linked`: GitHub created the stack (HTTP 201).
 * - `Refused`: GitHub understood and declined (HTTP 422); `message` is its
 *   sentence, such as "Pull requests must form a stack, where each PR's base
 *   ref is the previous PR's head ref" or "Pull requests #41, #42 are already
 *   part of a stack". Nothing was linked.
 *
 * **Example** (Branch on a refusal)
 *
 * ```ts
 * import { GithubStackLinkOutcome } from "@beep/repo-cli/test/SharedInternals"
 *
 * const outcome = GithubStackLinkOutcome.cases.Refused.make({ message: "Pull request #42 is already part of a stack" })
 * console.log(GithubStackLinkOutcome.guards.Refused(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubStackLinkOutcome = S.TaggedUnion({
  Linked: { stack: GithubStackRecord },
  Refused: { message: S.String },
}).pipe(
  $I.annoteSchema("GithubStackLinkOutcome", {
    description: "What GitHub answered to a stack link request: linked, or refused with its sentence.",
  })
);

/**
 * What GitHub answered to a request to link pull requests into a stack.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubStackLinkOutcome = typeof GithubStackLinkOutcome.Type;

// The Stacks endpoints' shared body: the list form carries these fields and the
// create and get forms add more (observed 2026-11-13:
// goals/yeet-async-merge-and-stacks/research/stack-p0-probes-2026-11.md).
const StackWire = S.Struct({
  number: S.Int,
  open: S.Boolean,
  base: S.Struct({ ref: S.String }),
  pull_requests: S.Array(
    S.Struct({
      number: S.Int,
      state: S.String,
      draft: S.optionalKey(S.Boolean),
      merged_at: S.NullOr(S.String),
      head: S.Struct({ ref: S.String, sha: S.String }),
    })
  ),
});

const toStackRecord = (wire: typeof StackWire.Type): GithubStackRecord =>
  GithubStackRecord.make({
    number: wire.number,
    open: wire.open,
    baseRef: wire.base.ref,
    layers: A.map(wire.pull_requests, (layer) =>
      GithubStackLayerRecord.make({
        number: layer.number,
        state: layer.state,
        draft: layer.draft ?? false,
        merged: layer.merged_at !== null,
        headRef: layer.head.ref,
        headSha: layer.head.sha,
      })
    ),
  });

const CompareWire = S.Struct({ behind_by: S.Int });

/**
 * One check run on a commit.
 *
 * **Example** (A green run)
 *
 * ```ts
 * import { GithubCheckRunRecord } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const run = GithubCheckRunRecord.make({ id: 1, name: "Lint", status: "completed", conclusion: O.some("success") })
 * console.log(run.name) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCheckRunRecord extends S.Opaque<GithubCheckRunRecord, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.Int, name: S.String, status: S.String, conclusion: S.Option(S.String) }).pipe(
    $I.annoteSchema("GithubCheckRunRecord", { description: "One check run on a commit, read over GitHub REST." })
  )
) {}

const CheckRunWire = S.Struct({ id: S.Int, name: S.String, status: S.String, conclusion: S.NullOr(S.String) });

/**
 * One commit status context (the legacy statuses API that deploy previews
 * such as Vercel report through), newest state per context.
 *
 * **Example** (A pending deploy preview)
 *
 * ```ts
 * import { GithubCommitStatusRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const status = GithubCommitStatusRecord.make({ context: "Vercel", state: "pending" })
 * console.log(status.state) // "pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCommitStatusRecord extends S.Opaque<GithubCommitStatusRecord, { readonly brand: unique symbol }>()(
  S.Struct({ context: S.String, state: S.String }).pipe(
    $I.annoteSchema("GithubCommitStatusRecord", {
      description: "The newest state of one commit status context, read over GitHub REST.",
    })
  )
) {}

const CombinedStatusWire = S.Struct({
  total_count: S.Int,
  statuses: S.Array(S.Struct({ context: S.String, state: S.String })),
});

/**
 * One GitHub Actions workflow run.
 *
 * **Example** (A failed run)
 *
 * ```ts
 * import { GithubWorkflowRunRecord } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const run = GithubWorkflowRunRecord.make({
 *   id: 9,
 *   name: "CI",
 *   status: "completed",
 *   conclusion: O.some("failure"),
 *   headSha: "abc",
 *   event: "pull_request",
 *   headBranch: O.some("feat/x"),
 * })
 * console.log(run.id) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubWorkflowRunRecord extends S.Opaque<GithubWorkflowRunRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    name: S.String,
    status: S.String,
    conclusion: S.Option(S.String),
    headSha: S.String,
    event: S.String,
    headBranch: S.Option(S.String),
  }).pipe($I.annoteSchema("GithubWorkflowRunRecord", { description: "One workflow run, read over GitHub REST." }))
) {}

/**
 * The workflow-run events a pull request triggers.
 *
 * **Details**
 *
 * Agent cancels are limited to these runs: no agent cancels a
 * `refs/heads/main` push run, queued or running (AGENTS.md, Inherited reds).
 * A run whose event is anything else (`push`, `merge_group`, `schedule`,
 * `workflow_dispatch`, or an event GitHub did not report) is left alone.
 *
 * **Example** (Check an event)
 *
 * ```ts
 * import { GithubPullRequestRunEvent } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubPullRequestRunEvent)("push")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubPullRequestRunEvent = LiteralKit(["pull_request", "pull_request_target"]).pipe(
  $I.annoteSchema("GithubPullRequestRunEvent", { description: "A workflow-run event a pull request triggers." })
);

/**
 * The workflow-run events a pull request triggers.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubPullRequestRunEvent = typeof GithubPullRequestRunEvent.Type;

const isPullRequestRunEvent = S.is(GithubPullRequestRunEvent);

/**
 * Whether an agent may cancel this workflow run: only runs a pull request
 * triggered, never a push run on any branch (so never a `refs/heads/main` run).
 *
 * **Example** (A main push run on the PR head sha is kept)
 *
 * ```ts
 * import { GithubWorkflowRunRecord, isAgentCancellableWorkflowRun } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const run = GithubWorkflowRunRecord.make({
 *   id: 9,
 *   name: "Check",
 *   status: "in_progress",
 *   conclusion: O.none(),
 *   headSha: "abc",
 *   event: "push",
 *   headBranch: O.some("main"),
 * })
 * console.log(isAgentCancellableWorkflowRun(run)) // false
 * ```
 *
 * @param run - The workflow run read over REST.
 * @returns `true` only for a run a pull request triggered.
 * @category predicates
 * @since 0.0.0
 */
export const isAgentCancellableWorkflowRun = (run: GithubWorkflowRunRecord): boolean =>
  isPullRequestRunEvent(run.event);

const WorkflowRunWire = S.Struct({
  id: S.Int,
  name: S.String.pipe(S.NullOr, S.optionalKey),
  status: S.NullOr(S.String),
  conclusion: S.NullOr(S.String),
  head_sha: S.String,
  event: S.String.pipe(S.NullOr, S.optionalKey),
  head_branch: S.String.pipe(S.NullOr, S.optionalKey),
});

/**
 * The outcome of a REST squash merge.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubMergeRecord extends S.Opaque<GithubMergeRecord, { readonly brand: unique symbol }>()(
  S.Struct({ merged: S.Boolean, sha: S.String, message: S.String }).pipe(
    $I.annoteSchema("GithubMergeRecord", { description: "The REST merge response." })
  )
) {}

/**
 * What an async merge request asks GitHub to do.
 *
 * **Details**
 *
 * `direct_merge` merges now, `merge_queue` adds the pull request to the base
 * branch's merge queue, and `default` lets GitHub pick the queue when the base
 * has one. Yeet sends `direct_merge`; the queue action stays reachable for
 * `explorations/github-merge-queue`.
 *
 * **Example** (Check an action)
 *
 * ```ts
 * import { GithubAsyncMergeAction } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubAsyncMergeAction.is.direct_merge("direct_merge")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubAsyncMergeAction = LiteralKit(["default", "direct_merge", "merge_queue"]).pipe(
  $I.annoteSchema("GithubAsyncMergeAction", { description: "What an async merge request asks GitHub to do." })
);

/**
 * What an async merge request asks GitHub to do.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubAsyncMergeAction = typeof GithubAsyncMergeAction.Type;

/**
 * How GitHub folds the pull request into its base.
 *
 * **Example** (Check a method)
 *
 * ```ts
 * import { GithubMergeMethod } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubMergeMethod.is.squash("squash")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubMergeMethod = LiteralKit(["merge", "squash", "rebase"]).pipe(
  $I.annoteSchema("GithubMergeMethod", { description: "How GitHub folds a pull request into its base." })
);

/**
 * How GitHub folds the pull request into its base.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubMergeMethod = typeof GithubMergeMethod.Type;

/**
 * One `PUT pulls/{n}/merge-async` request.
 *
 * **Details**
 *
 * `sha` pins the head: GitHub refuses the request (HTTP 400) when the head
 * already moved, and fails the accepted merge when it moves before GitHub runs
 * it. `bypassRules` asks GitHub to merge over the base's rules; it defaults to
 * `false` and only an S11 merge sends `true`. Without a `commitTitle` or
 * `commitMessage` GitHub writes the subject or body its settings prescribe;
 * with them it writes exactly what was sent.
 *
 * **Example** (A strict squash request)
 *
 * ```ts
 * import { GithubAsyncMergeRequest } from "@beep/repo-cli/test/SharedInternals"
 *
 * const request = GithubAsyncMergeRequest.make({ action: "direct_merge", method: "squash", sha: "abc" })
 * console.log(request.bypassRules) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubAsyncMergeRequest extends S.Opaque<GithubAsyncMergeRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    action: GithubAsyncMergeAction,
    method: GithubMergeMethod,
    sha: S.NonEmptyString,
    bypassRules: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    commitTitle: S.optionalKey(S.NonEmptyString),
    commitMessage: S.optionalKey(S.String),
  }).pipe($I.annoteSchema("GithubAsyncMergeRequest", { description: "One async merge request, pinned to a head." }))
) {}

/**
 * What GitHub reports for an async merge, read from the request's answer or
 * from a poll of its result.
 *
 * **Details**
 *
 * - `Pending`: accepted and not yet run. `inFlight` is true when the answer
 *   was HTTP 409, meaning another request for this pull request was already
 *   pending and `uuid` is that request's: attach to it, and do not assume its
 *   commit title is the one this caller sent.
 * - `Enqueued`: added to a merge queue (queue requests only).
 * - `Merged`: GitHub merged it (or it already was) as `sha`.
 * - `Failed`: GitHub refused or abandoned it; `message` is GitHub's sentence,
 *   such as "A conversation must be resolved before this pull request can be
 *   merged." Repository rules are evaluated after acceptance, so a request that
 *   was accepted can still end here.
 * - `Expired`: the poll found no result for `uuid` (HTTP 404). Results expire
 *   after 24 hours, so this is unknown, never merged.
 *
 * **Example** (Branch on an outcome)
 *
 * ```ts
 * import { GithubAsyncMergeOutcome } from "@beep/repo-cli/test/SharedInternals"
 *
 * const outcome = GithubAsyncMergeOutcome.cases.Failed.make({ message: "Pull request is in draft." })
 * console.log(GithubAsyncMergeOutcome.guards.Failed(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubAsyncMergeOutcome = S.TaggedUnion({
  Pending: {
    uuid: S.NonEmptyString,
    message: S.String,
    inFlight: S.Boolean,
    expectedHeadSha: S.Option(S.String),
    bypassRules: S.Option(S.Boolean),
  },
  Enqueued: { uuid: S.Option(S.String), message: S.String },
  Merged: { sha: S.NonEmptyString, message: S.String },
  Failed: { message: S.String },
  Expired: { uuid: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("GithubAsyncMergeOutcome", {
    description: "What GitHub reports for an async merge: pending, enqueued, merged, failed or expired.",
  })
);

/**
 * What GitHub reports for an async merge.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubAsyncMergeOutcome = typeof GithubAsyncMergeOutcome.Type;

/**
 * A REST rate-limit bucket.
 *
 * **Details**
 *
 * REST `/rate_limit` reports a `graphql` bucket too, but it misreports the
 * remaining GraphQL points; `GraphqlBudget` probes GraphQL itself for the truth
 * and only uses this bucket's reset time as a fallback.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRateLimitBucket extends S.Opaque<GithubRateLimitBucket, { readonly brand: unique symbol }>()(
  S.Struct({ limit: S.Int, remaining: S.Int, resetAt: S.DateTimeUtc }).pipe(
    $I.annoteSchema("GithubRateLimitBucket", { description: "One REST rate-limit bucket." })
  )
) {}

/**
 * The REST `core` and `graphql` rate-limit buckets.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRateLimitRecord extends S.Opaque<GithubRateLimitRecord, { readonly brand: unique symbol }>()(
  S.Struct({ core: GithubRateLimitBucket, graphql: GithubRateLimitBucket }).pipe(
    $I.annoteSchema("GithubRateLimitRecord", { description: "REST rate-limit buckets." })
  )
) {}

/**
 * Repository activity kinds reported by GitHub REST.
 *
 * **Example** (GithubRefActivityType evidence)
 *
 * ```ts
 * import { GithubRefActivityType } from "@beep/repo-cli/test/SharedInternals"
 * console.log(GithubRefActivityType.is.force_push("force_push")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubRefActivityType = LiteralKit([
  "push",
  "force_push",
  "branch_creation",
  "branch_deletion",
  "pr_merge",
  "merge_queue_merge",
]).pipe($I.annoteSchema("GithubRefActivityType", { description: "GitHub repository ref activity kinds." }));
/** A GitHub ref activity kind. @category type-level @since 0.0.0 */
export type GithubRefActivityType = typeof GithubRefActivityType.Type;

/**
 * One ref transition, in GitHub repository activity order.
 *
 * **Example** (GithubRefActivityRecord evidence)
 *
 * ```ts
 * import { GithubRefActivityRecord } from "@beep/repo-cli/test/SharedInternals"
 * console.log(GithubRefActivityRecord.fields.before) // string schema
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRefActivityRecord extends S.Opaque<GithubRefActivityRecord, { readonly brand: unique symbol }>()(
  S.Struct({ activityType: GithubRefActivityType, before: S.String, after: S.String, timestamp: S.DateTimeUtc }).pipe(
    $I.annoteSchema("GithubRefActivityRecord", {
      description: "One ref transition, in GitHub repository activity order.",
    })
  )
) {}

/**
 * A dated force push and its optional after commit.
 *
 * **Example** (GithubForcePushRecord evidence)
 *
 * ```ts
 * import { GithubForcePushRecord } from "@beep/repo-cli/test/SharedInternals"
 * console.log(GithubForcePushRecord.fields.commitId) // Option schema
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubForcePushRecord extends S.Opaque<GithubForcePushRecord, { readonly brand: unique symbol }>()(
  S.Struct({ at: S.DateTimeUtc, commitId: S.Option(S.String) }).pipe(
    $I.annoteSchema("GithubForcePushRecord", { description: "A dated force push and its optional after commit." })
  )
) {}

const RefActivityWire = S.Struct({
  activity_type: GithubRefActivityType,
  before: S.String,
  after: S.String,
  timestamp: S.DateTimeUtcFromString,
});

const BucketWire = S.Struct({ limit: S.Int, remaining: S.Int, reset: S.Int });
const RateLimitWire = S.Struct({ resources: S.Struct({ core: BucketWire, graphql: BucketWire }) });

const toBucket = (wire: typeof BucketWire.Type): GithubRateLimitBucket =>
  GithubRateLimitBucket.make({
    limit: wire.limit,
    remaining: wire.remaining,
    resetAt: DateTime.makeUnsafe(wire.reset * 1000),
  });

const RulesetRuleWire = S.Struct({
  type: S.String,
  parameters: S.optionalKey(
    S.Struct({
      required_status_checks: S.Struct({ context: S.String }).pipe(S.Array, S.optionalKey),
    })
  ),
});

const TimelineEventWire = S.Struct({
  commit_id: S.String.pipe(S.NullOr, S.optionalKey),
  event: S.String.pipe(S.NullOr, S.optionalKey),
  created_at: S.String.pipe(S.NullOr, S.optionalKey),
});

const CheckSuitesWire = S.Struct({ check_suites: S.Array(S.Struct({ created_at: S.String })) });
const CommentWire = S.Struct({ id: S.Int, html_url: S.String });
const LabelWire = S.Struct({ name: S.String });
const MergeWire = S.Struct({ merged: S.Boolean, sha: S.String, message: S.String });

// The one body `merge-async` and its poll answer with, on 202, 200, 400 and 409 alike
// (observed 2026-11-10: goals/yeet-async-merge-and-stacks/research/merge-async-p0-probes-2026-11.md).
const AsyncMergeWire = S.Struct({
  status: S.Literals(["pending", "enqueued", "merged", "failed"]),
  details: S.Struct({
    message: S.String,
    uuid: S.optionalKey(S.String),
    sha: S.optionalKey(S.String),
    expected_head_sha: S.optionalKey(S.String),
    bypass_rules: S.optionalKey(S.Boolean),
  }),
});

// A 400 or 409 reaches the caller as octokit's thrown error; its body is on `response.data`.
const AsyncMergeRejection = S.Struct({ response: S.Struct({ data: AsyncMergeWire }) });
const decodeAsyncMergeRejection = S.decodeUnknownOption(AsyncMergeRejection);

/**
 * The REST-first pull-request surface.
 *
 * @category models
 * @since 0.0.0
 */
export interface GithubRestShape {
  /** Add labels; returns the labels now on the pull request. */
  readonly addLabels: (
    number: number,
    labels: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<string>, GitHubError>;
  /**
   * The result of one async merge request (`GET pulls/{n}/merge-async/{uuid}`).
   * A uuid GitHub no longer holds for this pull request (HTTP 404: expired
   * after 24 hours, or never this pull request's) answers `Expired`.
   */
  readonly asyncMergeResult: (number: number, uuid: string) => Effect.Effect<GithubAsyncMergeOutcome, GitHubError>;
  /** Cancel one workflow run. */
  readonly cancelWorkflowRun: (runId: number) => Effect.Effect<void, GitHubError>;
  /** Every check run on a commit (all pages). */
  readonly checkRuns: (sha: string) => Effect.Effect<ReadonlyArray<GithubCheckRunRecord>, GitHubError>;
  /**
   * The newest state of every commit status context on a commit (the combined
   * status, first 100 contexts). More contexts than one page fails the read
   * (`decode`), so a gate reading it never mistakes a partial list for all.
   */
  readonly commitStatuses: (sha: string) => Effect.Effect<ReadonlyArray<GithubCommitStatusRecord>, GitHubError>;
  /** Post an issue comment on a pull request; returns its URL. */
  readonly createIssueComment: (number: number, body: string) => Effect.Effect<string, GitHubError>;
  /**
   * Link pull requests, bottom to top, into a native stack
   * (`POST /repos/{owner}/{repo}/stacks`). Each pull request's base ref must be
   * the head ref of the one before it. An HTTP 201 answers `Linked`; a 422
   * answers `Refused` with GitHub's sentence (out of order, fewer than two,
   * already stacked). Every other failure stays a `GitHubError`.
   */
  readonly createStack: (pullRequests: ReadonlyArray<number>) => Effect.Effect<GithubStackLinkOutcome, GitHubError>;
  /**
   * Whether the pull request has any inline review comment (one-item REST page).
   * No comment proves zero review threads; any comment says nothing about their
   * resolution, which only GraphQL reports.
   */
  readonly hasReviewComments: (number: number) => Effect.Effect<boolean, GitHubError>;
  /**
   * Whether `headSha` contains every commit of `baseSha` (the compare
   * endpoint's `behind_by` is zero). Read from GitHub, so neither commit has
   * to exist locally.
   */
  readonly headContains: (baseSha: string, headSha: string) => Effect.Effect<boolean, GitHubError>;
  /**
   * First GitHub check-suite receipt for the head (its first 100 suites),
   * unknown when none exists.
   */
  readonly headFirstReceivedAt: (sha: string) => Effect.Effect<O.Option<DateTime.Utc>, GitHubError>;
  /**
   * Squash-merge (or another method) pinned to a head sha. Without a
   * `commitTitle` or `commitMessage` GitHub writes the subject or body its
   * merge settings prescribe.
   */
  readonly mergePullRequest: (
    number: number,
    options: {
      readonly sha: string;
      readonly commitTitle?: string | undefined;
      readonly commitMessage?: string | undefined;
      readonly method: "merge" | "squash" | "rebase";
    }
  ) => Effect.Effect<GithubMergeRecord, GitHubError>;
  /** The open pull request whose head is `owner:branch`, if any. */
  readonly openPullRequestForBranch: (
    headOwner: string,
    branch: string
  ) => Effect.Effect<O.Option<GithubPullRequestRecord>, GitHubError>;
  /** Every open pull request (all pages). */
  readonly openPullRequests: Effect.Effect<ReadonlyArray<GithubPullRequestRecord>, GitHubError>;
  /** One pull request by number. */
  readonly pullRequest: (number: number) => Effect.Effect<GithubPullRequestRecord, GitHubError>;
  /** The repository-relative paths the pull request changes (all pages). */
  readonly pullRequestFiles: (number: number) => Effect.Effect<ReadonlyArray<string>, GitHubError>;
  /** The REST rate-limit buckets. */
  readonly rateLimit: Effect.Effect<GithubRateLimitRecord, GitHubError>;
  /** Newest ref activity first, bounded to three pages of 100. */
  readonly refActivity: (headRef: string) => Effect.Effect<ReadonlyArray<GithubRefActivityRecord>, GitHubError>;
  /** Remove one label; a label that is not there is not an error. */
  readonly removeLabel: (number: number, label: string) => Effect.Effect<void, GitHubError>;
  /**
   * Ask GitHub to merge the pull request asynchronously
   * (`PUT pulls/{n}/merge-async`), pinned to `request.sha`.
   *
   * An HTTP 202 answers `Pending`; a 409 answers `Pending` with `inFlight`
   * and the uuid of the request already pending; a 200 answers `Merged` for a
   * pull request that already merged; a 400 answers `Failed` with GitHub's
   * sentence (a draft, a closed pull request, a head that already moved).
   * Every other failure stays a `GitHubError`. Acceptance is not success:
   * GitHub evaluates the base's rules after it accepts, so poll
   * {@link GithubRestShape.asyncMergeResult} to a terminal outcome.
   */
  readonly requestAsyncMerge: (
    number: number,
    request: GithubAsyncMergeRequest
  ) => Effect.Effect<GithubAsyncMergeOutcome, GitHubError>;
  /** The required status-check contexts the branch's rulesets declare. */
  readonly requiredStatusContexts: (branch: string) => Effect.Effect<ReadonlyArray<string>, GitHubError>;
  /** Re-run the failed jobs of one workflow run. */
  readonly rerunFailedJobs: (runId: number) => Effect.Effect<void, GitHubError>;
  /**
   * GitHub-owned ready and force-push timeline instants for the pull request.
   * A ready or force-push event without a parseable instant fails the read
   * (`decode`), so a merge gate reading it fails closed.
   */
  readonly reviewTimeline: (number: number) => Effect.Effect<
    {
      readonly readyAt: O.Option<DateTime.Utc>;
      readonly forcedAt: O.Option<DateTime.Utc>;
      readonly forcePushes: ReadonlyArray<GithubForcePushRecord>;
    },
    GitHubError
  >;
  /**
   * One native stack by number (`GET /repos/{owner}/{repo}/stacks/{n}`), layers
   * bottom to top with merged layers kept.
   */
  readonly stack: (stackNumber: number) => Effect.Effect<GithubStackRecord, GitHubError>;
  /** Replace the title and/or body. */
  readonly updatePullRequest: (
    number: number,
    patch: { readonly title?: string | undefined; readonly body?: string | undefined }
  ) => Effect.Effect<GithubPullRequestRecord, GitHubError>;
  /** Every workflow run for a head sha (all pages). */
  readonly workflowRunsForSha: (sha: string) => Effect.Effect<ReadonlyArray<GithubWorkflowRunRecord>, GitHubError>;
}

/**
 * REST-first pull-request operations.
 *
 * **Example** (Read a pull request)
 *
 * ```ts
 * import { GithubRest } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const rest = yield* GithubRest
 *   return yield* rest.pullRequest(1)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GithubRest extends Context.Service<GithubRest, GithubRestShape>()($I`GithubRest`) {}

const utcFromIso = (value: string | null | undefined): O.Option<DateTime.Utc> =>
  pipe(O.fromNullishOr(value), O.flatMap(DateTime.make), O.map(DateTime.toUtc));

const decodeWith =
  <A, I>(schema: S.Codec<A, I>, operation: string) =>
  (value: unknown): Effect.Effect<A, GitHubError> =>
    S.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((cause) => GitHubError.decode(operation, "response did not match its schema", cause))
    );

const makeGithubRest = Effect.gen(function* () {
  const client = yield* GitHubClient;
  const repo = yield* Repo;
  const at = { owner: repo.owner, repo: repo.repo };

  const pullRequest = (number: number) =>
    client
      .requestDecoded("GET /repos/{owner}/{repo}/pulls/{pull_number}", { ...at, pull_number: number }, PullWire)
      .pipe(Effect.map(toPullRequestRecord));

  const openPullRequestForBranch = (headOwner: string, branch: string) =>
    client.paginate("GET /repos/{owner}/{repo}/pulls", { ...at, head: `${headOwner}:${branch}`, state: "open" }).pipe(
      Effect.flatMap(decodeWith(S.Array(PullWire), "GET /repos/{owner}/{repo}/pulls")),
      Effect.map(
        flow(
          A.map(toPullRequestRecord),
          A.findFirst((pull) => pull.headRef === branch && pull.state === "open")
        )
      )
    );

  // Suspended: the read is built when run, not when the layer is, so a test client with the
  // paginator unstubbed still constructs the service.
  const openPullRequests = Effect.suspend(() =>
    client
      .paginate("GET /repos/{owner}/{repo}/pulls", { ...at, state: "open" })
      .pipe(
        Effect.flatMap(decodeWith(S.Array(PullWire), "GET /repos/{owner}/{repo}/pulls")),
        Effect.map(A.map(toPullRequestRecord))
      )
  );

  const pullRequestFiles = (number: number) =>
    client
      .paginate("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { ...at, pull_number: number })
      .pipe(
        Effect.flatMap(decodeWith(S.Array(PullFileWire), "GET /repos/{owner}/{repo}/pulls/{pull_number}/files")),
        Effect.map(A.map((file) => file.filename))
      );

  const updatePullRequest = (
    number: number,
    patch: { readonly title?: string | undefined; readonly body?: string | undefined }
  ) =>
    client
      .requestDecoded(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          ...at,
          pull_number: number,
          ...OptionUtils.getSomesStruct({ title: O.fromUndefinedOr(patch.title) }),
          ...OptionUtils.getSomesStruct({ body: O.fromUndefinedOr(patch.body) }),
        },
        PullWire
      )
      .pipe(Effect.map(toPullRequestRecord));

  const addLabels = (number: number, labels: ReadonlyArray<string>) =>
    client
      .requestDecoded(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
        { ...at, issue_number: number, labels: [...labels] },
        S.Array(LabelWire)
      )
      .pipe(Effect.map(A.map((label) => label.name)));

  const hasReviewComments = (number: number) =>
    client
      .requestDecoded(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
        { ...at, pull_number: number, per_page: 1 },
        S.Array(S.Unknown)
      )
      .pipe(Effect.map(A.isReadonlyArrayNonEmpty));

  const removeLabel = (number: number, label: string) =>
    client
      .requestDecoded(
        "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
        { ...at, issue_number: number, name: label },
        S.Unknown
      )
      .pipe(
        Effect.asVoid,
        Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.void)
      );

  const createIssueComment = (number: number, body: string) =>
    client
      .requestDecoded(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { ...at, issue_number: number, body },
        CommentWire
      )
      .pipe(Effect.map((comment) => comment.html_url));

  const checkRuns = (sha: string) =>
    client.paginate("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", { ...at, ref: sha }).pipe(
      Effect.flatMap(decodeWith(S.Array(CheckRunWire), "GET /repos/{owner}/{repo}/commits/{ref}/check-runs")),
      Effect.map(
        A.map((run) =>
          GithubCheckRunRecord.make({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: O.fromNullishOr(run.conclusion),
          })
        )
      )
    );

  const combinedStatusOperation = "GET /repos/{owner}/{repo}/commits/{ref}/status";
  const commitStatuses = (sha: string) =>
    client
      .requestDecoded(combinedStatusOperation, { ...at, ref: sha, per_page: 100 }, CombinedStatusWire)
      .pipe(
        Effect.flatMap((wire) =>
          wire.total_count > A.length(wire.statuses)
            ? Effect.fail(
                GitHubError.decode(
                  combinedStatusOperation,
                  `${wire.total_count} status contexts exceed one page of ${A.length(wire.statuses)}`,
                  wire.total_count
                )
              )
            : Effect.succeed(A.map(wire.statuses, (status) => GithubCommitStatusRecord.make(status)))
        )
      );

  const requiredStatusContexts = (branch: string) =>
    client.paginate("GET /repos/{owner}/{repo}/rules/branches/{branch}", { ...at, branch }).pipe(
      Effect.flatMap(decodeWith(S.Array(RulesetRuleWire), "GET /repos/{owner}/{repo}/rules/branches/{branch}")),
      Effect.map(
        flow(
          A.filter((rule) => rule.type === "required_status_checks"),
          A.flatMap((rule) => rule.parameters?.required_status_checks ?? []),
          A.map((check) => check.context),
          A.dedupe
        )
      )
    );

  // Fail closed: a ready or force-push event whose instant is missing or does not
  // parse fails the read, so a push that cannot be dated never lets a review
  // window look elapsed early. Other events carry no instant the window reads.
  const timelineOperation = "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline";
  const datedEvents = (events: ReadonlyArray<typeof TimelineEventWire.Type>, eventName: string) =>
    pipe(
      events,
      A.filter((event) => event.event === eventName),
      A.map((event) => utcFromIso(event.created_at)),
      O.all,
      Effect.fromOption,
      Effect.mapBoth({
        onFailure: () => GitHubError.decode(timelineOperation, `a ${eventName} event has no instant`, eventName),
        onSuccess: flow(A.sort(DateTime.Order), A.last),
      })
    );

  const reviewTimeline = (number: number) =>
    client.paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/timeline", { ...at, issue_number: number }).pipe(
      Effect.flatMap(decodeWith(S.Array(TimelineEventWire), timelineOperation)),
      Effect.flatMap((events) =>
        Effect.all({
          readyAt: datedEvents(events, "ready_for_review"),
          forcedAt: datedEvents(events, "head_ref_force_pushed"),
          forcePushes: Effect.forEach(
            A.filter(events, (event) => event.event === "head_ref_force_pushed"),
            (event) =>
              Effect.fromOption(utcFromIso(event.created_at)).pipe(
                Effect.mapBoth({
                  onSuccess: (at) => GithubForcePushRecord.make({ at, commitId: O.fromNullishOr(event.commit_id) }),
                  onFailure: () =>
                    GitHubError.decode(timelineOperation, "a head_ref_force_pushed event has no instant", event),
                })
              )
          ),
        })
      )
    );

  const refActivity = (headRef: string) =>
    client
      .paginate(
        "GET /repos/{owner}/{repo}/activity",
        { ...at, ref: `refs/heads/${headRef}` },
        PageOptions.make({ perPage: 100, maxPages: 3 })
      )
      .pipe(
        Effect.flatMap(decodeWith(S.Array(RefActivityWire), "GET repository activity")),
        Effect.map(
          A.map((row) =>
            GithubRefActivityRecord.make({
              activityType: row.activity_type,
              before: row.before,
              after: row.after,
              timestamp: row.timestamp,
            })
          )
        )
      );

  const headFirstReceivedAt = (sha: string) =>
    client
      .requestDecoded(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-suites",
        { ...at, ref: sha, per_page: 100 },
        CheckSuitesWire
      )
      .pipe(
        Effect.map((response) =>
          pipe(
            response.check_suites,
            A.map((suite) => utcFromIso(suite.created_at)),
            A.getSomes,
            A.sort(DateTime.Order),
            A.head
          )
        )
      );

  const mergePullRequest = (
    number: number,
    options: {
      readonly sha: string;
      readonly commitTitle?: string | undefined;
      readonly commitMessage?: string | undefined;
      readonly method: "merge" | "squash" | "rebase";
    }
  ) =>
    client
      .requestDecoded(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          ...at,
          pull_number: number,
          sha: options.sha,
          merge_method: options.method,
          ...OptionUtils.getSomesStruct({ commit_title: O.fromUndefinedOr(options.commitTitle) }),
          ...OptionUtils.getSomesStruct({ commit_message: O.fromUndefinedOr(options.commitMessage) }),
        },
        MergeWire
      )
      .pipe(Effect.map((merge) => GithubMergeRecord.make(merge)));

  const toAsyncMergeOutcome =
    (operation: string, inFlight: boolean) =>
    (wire: typeof AsyncMergeWire.Type): Effect.Effect<GithubAsyncMergeOutcome, GitHubError> => {
      const { details } = wire;
      const required = (field: "sha" | "uuid", value: string | undefined) =>
        pipe(
          O.fromUndefinedOr(value),
          O.filter(Str.isNonEmpty),
          Effect.fromOption,
          Effect.mapError(() => GitHubError.decode(operation, `a ${wire.status} result has no ${field}`, wire))
        );
      return Match.value(wire.status).pipe(
        Match.when("merged", () =>
          Effect.map(required("sha", details.sha), (sha) =>
            GithubAsyncMergeOutcome.cases.Merged.make({ sha, message: details.message })
          )
        ),
        Match.when("pending", () =>
          Effect.map(required("uuid", details.uuid), (uuid) =>
            GithubAsyncMergeOutcome.cases.Pending.make({
              uuid,
              message: details.message,
              inFlight,
              expectedHeadSha: O.fromUndefinedOr(details.expected_head_sha),
              bypassRules: O.fromUndefinedOr(details.bypass_rules),
            })
          )
        ),
        Match.when("enqueued", () =>
          Effect.succeed(
            GithubAsyncMergeOutcome.cases.Enqueued.make({
              uuid: O.fromUndefinedOr(details.uuid),
              message: details.message,
            })
          )
        ),
        Match.when("failed", () =>
          Effect.succeed(GithubAsyncMergeOutcome.cases.Failed.make({ message: details.message }))
        ),
        Match.exhaustive
      );
    };

  // A 400 or 409 carries the same body as a success; any other failure has none to read.
  const asyncMergeRejection = (error: GitHubError): O.Option<typeof AsyncMergeWire.Type> =>
    error.status === 400 || error.status === 409
      ? O.map(decodeAsyncMergeRejection(error.cause), (rejection) => rejection.response.data)
      : O.none();

  const asyncMergeOperation = "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async";
  const requestAsyncMerge = (number: number, request: GithubAsyncMergeRequest) =>
    client
      .requestDecoded(
        asyncMergeOperation,
        {
          ...at,
          pull_number: number,
          merge_action: request.action,
          merge_method: request.method,
          sha: request.sha,
          bypass_rules: request.bypassRules,
          ...OptionUtils.getSomesStruct({ commit_title: O.fromUndefinedOr(request.commitTitle) }),
          ...OptionUtils.getSomesStruct({ commit_message: O.fromUndefinedOr(request.commitMessage) }),
        },
        AsyncMergeWire
      )
      .pipe(
        Effect.flatMap(toAsyncMergeOutcome(asyncMergeOperation, false)),
        // A 409 whose message says the request "already exists" classifies as `alreadyExists`.
        Effect.catchIf(GitHubError.hasKind("rejected", "alreadyExists"), (error) =>
          O.match(asyncMergeRejection(error), {
            onNone: () => Effect.fail(error),
            onSome: toAsyncMergeOutcome(asyncMergeOperation, error.status === 409),
          })
        )
      );

  const asyncMergeResultOperation = "GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}";
  const asyncMergeResult = (number: number, uuid: string) =>
    client.requestDecoded(asyncMergeResultOperation, { ...at, pull_number: number, uuid }, AsyncMergeWire).pipe(
      Effect.flatMap(toAsyncMergeOutcome(asyncMergeResultOperation, false)),
      Effect.catchIf(GitHubError.hasKind("notFound"), () =>
        Effect.succeed(GithubAsyncMergeOutcome.cases.Expired.make({ uuid }))
      )
    );

  const stackOperation = "GET /repos/{owner}/{repo}/stacks/{stack_number}";
  const stack = (stackNumber: number) =>
    client
      .requestDecoded(stackOperation, { ...at, stack_number: stackNumber }, StackWire)
      .pipe(Effect.map(toStackRecord));

  // GitHub declines a link it understood with a 422 and a sentence; the caller
  // shows that sentence, so it is an outcome and not an error.
  const createStackOperation = "POST /repos/{owner}/{repo}/stacks";
  const createStack = (pullRequests: ReadonlyArray<number>) =>
    client.requestDecoded(createStackOperation, { ...at, pull_requests: pullRequests }, StackWire).pipe(
      Effect.map((wire) => GithubStackLinkOutcome.cases.Linked.make({ stack: toStackRecord(wire) })),
      Effect.catchIf(
        (error) => error.status === 422,
        (error) => Effect.succeed(GithubStackLinkOutcome.cases.Refused.make({ message: error.reason }))
      )
    );

  const headContains = (baseSha: string, headSha: string) =>
    client
      .requestDecoded(
        "GET /repos/{owner}/{repo}/compare/{basehead}",
        { ...at, basehead: `${baseSha}...${headSha}`, per_page: 1 },
        CompareWire
      )
      .pipe(Effect.map((wire) => wire.behind_by === 0));

  const workflowRunsForSha = (sha: string) =>
    client.paginate("GET /repos/{owner}/{repo}/actions/runs", { ...at, head_sha: sha }).pipe(
      Effect.flatMap(decodeWith(S.Array(WorkflowRunWire), "GET /repos/{owner}/{repo}/actions/runs")),
      Effect.map(
        A.map((run) =>
          GithubWorkflowRunRecord.make({
            id: run.id,
            name: run.name ?? "",
            status: run.status ?? "unknown",
            conclusion: O.fromNullishOr(run.conclusion),
            headSha: run.head_sha,
            event: run.event ?? "unknown",
            headBranch: O.fromNullishOr(run.head_branch),
          })
        )
      )
    );

  const rerunFailedJobs = (runId: number) =>
    client
      .requestDecoded(
        "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
        { ...at, run_id: runId },
        S.Unknown
      )
      .pipe(Effect.asVoid);

  const cancelWorkflowRun = (runId: number) =>
    client
      .requestDecoded("POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel", { ...at, run_id: runId }, S.Unknown)
      .pipe(Effect.asVoid);

  const rateLimit = client.requestDecoded("GET /rate_limit", {}, RateLimitWire).pipe(
    Effect.map((wire) =>
      GithubRateLimitRecord.make({
        core: toBucket(wire.resources.core),
        graphql: toBucket(wire.resources.graphql),
      })
    )
  );

  return GithubRest.of({
    addLabels,
    asyncMergeResult,
    cancelWorkflowRun,
    checkRuns,
    commitStatuses,
    headContains,
    headFirstReceivedAt,
    createIssueComment,
    createStack,
    mergePullRequest,
    openPullRequestForBranch,
    openPullRequests,
    pullRequest,
    pullRequestFiles,
    rateLimit,
    refActivity,
    requestAsyncMerge,
    reviewTimeline,
    hasReviewComments,
    removeLabel,
    rerunFailedJobs,
    requiredStatusContexts,
    stack,
    updatePullRequest,
    workflowRunsForSha,
  });
});

/**
 * The REST surface over a provided `GitHubClient` and `Repo`.
 *
 * **Example** (Compose with a fixture client)
 *
 * ```ts
 * import { layerGithubRest } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(typeof layerGithubRest) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGithubRest: Layer.Layer<GithubRest, never, GitHubClient | Repo> = Layer.effect(
  GithubRest,
  makeGithubRest
);
