/**
 * Local-first Yeet operator status snapshots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GhActor } from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext, runIdForContext } from "./ArtifactPaths.ts";
import { PrCloseoutReportJson } from "./Closeout.ts";
import {
  collectYeetGateStaleness,
  GateStale,
  GateUnproven,
  renderYeetGateStalenessBlock,
  staleGateVerdicts,
  unprovenGateVerdicts,
} from "./GateStaleness.ts";
import { yeetCommentExcerpt } from "./MonitorComments.ts";
import { YeetHeadTimeline } from "./MonitorPolicy.ts";
import {
  deriveYeetReviewThreadState,
  summarizeYeetReviewThreadStates,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateCounts,
  YeetReviewThreadStateInput,
  yeetReviewCommentAuthorKind,
} from "./ReviewThreadState.ts";
import { YeetSettleCheck } from "./Settle.ts";
import {
  mergeReadyCriterionHolds,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetMergeReadyFromEncoded,
  YeetVerdict,
} from "./Verdict.ts";
import { classifyYeetCheckOutcome, YeetCheckSignal } from "./WatchStream.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrCloseoutReport } from "./Closeout.ts";
import type { GateStalenessVerdict } from "./GateStaleness.ts";
import type { YeetReviewThreadState, YeetReviewThreadStateTag } from "./ReviewThreadState.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Status");
const threadExcerptLength = 140;

/**
 * Status of an optional Yeet artifact read.
 *
 * **Example** (Check yeet status artifact state membership)
 *
 * ```ts
 * import { YeetStatusArtifactState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetStatusArtifactState.is.present("present"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStatusArtifactState = LiteralKit(["missing", "present", "unreadable"]).pipe(
  $I.annoteSchema("YeetStatusArtifactState", {
    description: "Read status for an optional Yeet operator artifact.",
  })
);

/**
 * Status of an optional Yeet artifact read.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetStatusArtifactState = typeof YeetStatusArtifactState.Type;

/**
 * Local Git worktree counts used by `yeet status`.
 *
 * **Example** (Construct a yeet status worktree)
 *
 * ```ts
 * import { YeetStatusWorktree } from "@beep/repo-cli/test/Yeet"
 *
 * const worktree = YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 })
 * console.log(worktree.clean)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusWorktree extends S.Class<YeetStatusWorktree>($I`YeetStatusWorktree`)(
  {
    clean: S.Boolean,
    staged: S.Finite,
    unstaged: S.Finite,
    untracked: S.Finite,
  },
  $I.annote("YeetStatusWorktree", {
    description: "Local Git worktree counts used by yeet status.",
  })
) {}

/**
 * One verdict lane that recorded a Turbo-derived input digest (C3.6 per-lane hashes).
 *
 * **Example** (Name a lane digest)
 *
 * ```ts
 * import { YeetStatusLaneDigest } from "@beep/repo-cli/test/Yeet"
 *
 * const lane = YeetStatusLaneDigest.make({ id: "quality:knip", inputDigest: "0d5970886d36b416" })
 * console.log(lane.id) // "quality:knip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusLaneDigest extends S.Class<YeetStatusLaneDigest>($I`YeetStatusLaneDigest`)(
  { id: S.String, inputDigest: S.String },
  $I.annote("YeetStatusLaneDigest", { description: "Lane id and the input digest its Turbo summary produced." })
) {}

/**
 * Summary for a Yeet artifact read by status.
 *
 * **Details**
 *
 * Closeout summaries carry `reviewedHeadSha` so merge readiness can reject a
 * report written for an older pull request head. Legacy summaries decode with
 * no recorded head and therefore remain stale.
 *
 * **Example** (Construct a yeet status artifact)
 *
 * ```ts
 * import { YeetStatusArtifact } from "@beep/repo-cli/test/Yeet"
 *
 * const artifact = YeetStatusArtifact.make({
 *   detail: "no verdict found",
 *   path: ".beep/yeet/runs/branch/verdict.json",
 *   state: "missing",
 * })
 * console.log(artifact.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusArtifact extends S.Class<YeetStatusArtifact>($I`YeetStatusArtifact`)(
  {
    detail: S.String,
    path: S.String,
    state: YeetStatusArtifactState,
    issueCount: S.optionalKey(S.Finite),
    mode: S.optionalKey(S.String),
    outcome: S.optionalKey(S.String),
    repairCommand: S.optionalKey(S.String),
    reviewedHeadSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    schemaVersion: S.optionalKey(S.String),
    greptileScore: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    laneDigests: YeetStatusLaneDigest.pipe(S.Array, S.optionalKey),
  },
  $I.annote("YeetStatusArtifact", {
    description: "Compact summary for a Yeet artifact read by status, including closeout head binding.",
  })
) {}

/**
 * One unresolved review thread, carried with enough context to triage it.
 *
 * **Details**
 *
 * Status used to list threads as bare GraphQL node ids plus a file path, which
 * is the least actionable form of the data: triaging a wave meant a second REST
 * pass and hand-mapping thread ids to comment ids by file. Author, first-line
 * excerpt, and the numeric REST `commentDatabaseId` are exactly the fields that
 * turn the listing into something a reply drafts file can be written from
 * directly — `yeet reply` accepts either identifier.
 *
 * **Example** (Describe one unresolved thread)
 *
 * ```ts
 * import { YeetStatusReviewThread } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const thread = YeetStatusReviewThread.make({
 *   threadId: "PRRT_kwDO",
 *   author: "greptile-apps[bot]",
 *   excerpt: "logic: the rerun budget never resets across SHAs",
 *   path: O.some("src/commands/Yeet/internal/MonitorLoop.ts"),
 *   line: O.some(88),
 *   commentDatabaseId: O.some(2412551122),
 * })
 * console.log(thread.author)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusReviewThread extends S.Class<YeetStatusReviewThread>($I`YeetStatusReviewThread`)(
  {
    threadId: S.String,
    author: S.String,
    excerpt: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    commentDatabaseId: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetStatusReviewThread", {
    description: "One unresolved pull request review thread with the context needed to triage and reply to it.",
  })
) {}

/**
 * Optional remote pull request summary for `yeet status --remote`.
 *
 * **Example** (Construct a yeet status remote)
 *
 * ```ts
 * import { YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const remote = YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
 * console.log(remote.checked)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusRemote extends S.Class<YeetStatusRemote>($I`YeetStatusRemote`)(
  {
    available: S.Boolean,
    checked: S.Boolean,
    detail: S.String,
    checks: YeetSettleCheck.pipe(S.Array, SchemaUtils.withKeyDefaults(A.empty<YeetSettleCheck>())),
    checkCount: S.optionalKey(S.Finite),
    failingCheckCount: S.optionalKey(S.Finite),
    isDraft: S.optionalKey(S.Boolean),
    labels: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    mergeStateStatus: S.optionalKey(S.String),
    mergeable: S.optionalKey(S.String),
    number: S.optionalKey(S.Finite),
    pendingCheckCount: S.optionalKey(S.Finite),
    requiredCheckCount: S.optionalKey(S.Finite),
    failingRequiredCheckCount: S.optionalKey(S.Finite),
    pendingRequiredCheckCount: S.optionalKey(S.Finite),
    optionalCheckCount: S.optionalKey(S.Finite),
    failingOptionalCheckCount: S.optionalKey(S.Finite),
    pendingOptionalCheckCount: S.optionalKey(S.Finite),
    unresolvedReviewThreadCount: S.optionalKey(S.Finite),
    unresolvedReviewThreads: S.Array(S.String).pipe(S.optionalKey),
    unresolvedThreads: S.Array(YeetStatusReviewThread).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    followUpThreadCount: S.optionalKey(S.Finite),
    followUpThreads: S.Array(YeetStatusReviewThread).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    acknowledgedThreadCount: S.optionalKey(S.Finite),
    acknowledgedThreads: S.Array(YeetStatusReviewThread).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    headSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rerunFailedCommand: S.optionalKey(S.String),
    rerunFailedDecision: S.optionalKey(S.String),
    reviewDecision: S.optionalKey(S.String),
    state: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  },
  $I.annote("YeetStatusRemote", {
    description: "Optional remote pull request summary for yeet status.",
  })
) {}

/**
 * Machine-readable status snapshot emitted by `yeet status`.
 *
 * **Example** (Construct a yeet status snapshot)
 *
 * ```ts
 * import { YeetStatusSnapshot, YeetStatusWorktree, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const snapshot = YeetStatusSnapshot.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   closeout: YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" }),
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   head: "HEAD",
 *   nextCommand: "bun run beep yeet verify",
 *   remote: YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" }),
 *   runId: "feature",
 *   schemaVersion: "yeet-status/v1",
 *   statusPath: ".beep/yeet/runs/feature/status.json",
 *   verdict: YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
 *   worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
 * })
 * console.log(snapshot.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusSnapshot extends S.Class<YeetStatusSnapshot>($I`YeetStatusSnapshot`)(
  {
    base: S.String,
    branch: S.String,
    closeout: YeetStatusArtifact,
    createdAt: S.String,
    head: S.String,
    nextCommand: S.String,
    remote: YeetStatusRemote,
    runId: S.String,
    schemaVersion: S.Literal("yeet-status/v1"),
    statusPath: S.String,
    verdict: YeetStatusArtifact,
    worktree: YeetStatusWorktree,
    mergeReady: YeetMergeReadyFromEncoded.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    staleGates: S.Array(GateStale).pipe(SchemaUtils.withKeyDefaults([])),
    unprovenGates: S.Array(GateUnproven).pipe(SchemaUtils.withKeyDefaults([])),
    // Stamped by the merge loop (B7): push, settle, closeout, and ready
    // instants for the head this snapshot describes. A one-shot `yeet status`
    // read leaves it absent.
    timeline: YeetHeadTimeline.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetStatusSnapshot", {
    description: "Machine-readable status snapshot emitted by yeet status.",
  })
) {}

/**
 * JSON-string codec for the `status.json` artifact.
 *
 * **Gotchas**
 *
 * The status writer must go through this codec. Rendering the decoded snapshot
 * with a generic JSON encoder serializes `Option` fields as their runtime shape
 * (`{"_id":"Option","_tag":"Some","value":…}`), producing an artifact that no
 * longer decodes — the same trap the verdict artifact already fell into.
 *
 * **Example** (Encode a snapshot)
 *
 * ```ts
 * import { YeetStatusSnapshotJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetStatusSnapshotJson.encode)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetStatusSnapshotJson = JsonStringCodec(YeetStatusSnapshot);

class GhStatusLabel extends S.Class<GhStatusLabel>($I`GhStatusLabel`)(
  { name: S.String },
  $I.annote("GhStatusLabel", { description: "One label on the pull request as gh pr view reports it." })
) {}

class GhStatusPullRequest extends S.Class<GhStatusPullRequest>($I`GhStatusPullRequest`)(
  {
    id: S.String,
    headRefOid: S.String,
    isDraft: S.Boolean,
    labels: S.Array(GhStatusLabel).pipe(SchemaUtils.withKeyDefaults(A.empty<GhStatusLabel>())),
    mergeStateStatus: S.NullOr(S.String),
    mergeable: S.NullOr(S.String),
    number: S.Finite,
    reviewDecision: S.NullOr(S.String),
    state: S.String,
    url: S.String,
  },
  $I.annote("GhStatusPullRequest", {
    description: "GitHub pull request payload used by yeet status remote summaries.",
  })
) {}

class GhStatusThreadComment extends S.Class<GhStatusThreadComment>($I`GhStatusThreadComment`)(
  {
    author: S.NullOr(GhActor),
    body: S.NullOr(S.String),
    databaseId: S.NullOr(S.Finite),
  },
  $I.annote("GhStatusThreadComment", {
    description: "The opening comment of a review thread, used for status thread triage.",
  })
) {}

class GhStatusThreadCommentConnection extends S.Class<GhStatusThreadCommentConnection>(
  $I`GhStatusThreadCommentConnection`
)(
  { nodes: S.Array(GhStatusThreadComment) },
  $I.annote("GhStatusThreadCommentConnection", {
    description: "First-comment connection of a review thread returned by Yeet remote status.",
  })
) {}

class GhStatusReviewThread extends S.Class<GhStatusReviewThread>($I`GhStatusReviewThread`)(
  {
    id: S.String,
    isResolved: S.Boolean,
    isOutdated: S.Boolean,
    path: S.NullOr(S.String),
    line: S.NullOr(S.Finite),
    // Who closed the thread. A reviewer closing their own thread owes nothing;
    // only the pull request author closing it can leave a follow-up behind.
    resolvedBy: GhActor.pipe(S.NullOr, S.optionalKey),
    comments: GhStatusThreadCommentConnection,
    // The thread's newest comment; a resolved thread whose last word is not the
    // PR author's is a follow-up the author has not read or answered.
    latest: S.optionalKey(GhStatusThreadCommentConnection),
  },
  $I.annote("GhStatusReviewThread", {
    description:
      "Review-thread identity plus opening-comment and latest-comment triage context used by Yeet remote status.",
  })
) {}

class GhStatusReviewThreadPageInfo extends S.Class<GhStatusReviewThreadPageInfo>($I`GhStatusReviewThreadPageInfo`)(
  {
    hasNextPage: S.Boolean,
    endCursor: S.NullOr(S.String).pipe(SchemaUtils.withKeyDefaults(null)),
  },
  $I.annote("GhStatusReviewThreadPageInfo", {
    description: "Cursor metadata for one page of the Yeet review-thread status read.",
  })
) {}

class GhStatusReviewThreadConnection extends S.Class<GhStatusReviewThreadConnection>(
  $I`GhStatusReviewThreadConnection`
)(
  { nodes: S.Array(GhStatusReviewThread), pageInfo: GhStatusReviewThreadPageInfo },
  $I.annote("GhStatusReviewThreadConnection", {
    description: "Review threads returned by the single-query Yeet remote status check.",
  })
) {}

class GhStatusReviewThreadsNode extends S.Class<GhStatusReviewThreadsNode>($I`GhStatusReviewThreadsNode`)(
  { author: GhActor.pipe(S.NullOr, S.optionalKey), reviewThreads: GhStatusReviewThreadConnection },
  $I.annote("GhStatusReviewThreadsNode", { description: "Pull request review-thread status node." })
) {}

class GhStatusReviewThreadsData extends S.Class<GhStatusReviewThreadsData>($I`GhStatusReviewThreadsData`)(
  { node: GhStatusReviewThreadsNode },
  $I.annote("GhStatusReviewThreadsData", { description: "GraphQL review-thread status data." })
) {}

class GhStatusReviewThreadsDocument extends S.Class<GhStatusReviewThreadsDocument>($I`GhStatusReviewThreadsDocument`)(
  { data: GhStatusReviewThreadsData },
  $I.annote("GhStatusReviewThreadsDocument", { description: "GraphQL review-thread status document." })
) {}

/**
 * A branch workflow run as returned by `gh run list`.
 *
 * **Example** (Construct a workflow run row)
 *
 * ```ts
 * import { GhStatusWorkflowRun } from "@beep/repo-cli/test/Yeet"
 *
 * const run = GhStatusWorkflowRun.make({
 *   conclusion: "failure",
 *   databaseId: 42,
 *   headSha: "abc123",
 *   name: "check",
 *   status: "completed",
 * })
 * console.log(run.conclusion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhStatusWorkflowRun extends S.Class<GhStatusWorkflowRun>($I`GhStatusWorkflowRun`)(
  {
    conclusion: S.NullOr(S.String),
    databaseId: S.Finite,
    headSha: S.String,
    name: S.String,
    status: S.String,
  },
  $I.annote("GhStatusWorkflowRun", { description: "GitHub workflow run used for rerun-failed guidance." })
) {}

/**
 * GitHub check row used to derive required and optional status counts.
 *
 * @category models
 * @since 0.0.0
 */
export class GhStatusCheck extends S.Class<GhStatusCheck>($I`GhStatusCheck`)(
  {
    bucket: S.String,
    name: S.String,
    state: S.String,
  },
  $I.annote("GhStatusCheck", {
    description: "GitHub PR check payload used by yeet status remote summaries.",
  })
) {}

const decodeYeetVerdict = S.decodeUnknownEffect(S.fromJsonString(YeetVerdict));
const decodePrCloseoutReport = PrCloseoutReportJson.decode;
const decodeGhStatusPullRequest = S.decodeUnknownEffect(S.fromJsonString(GhStatusPullRequest));
const decodeGhStatusReviewThreads = S.decodeUnknownEffect(S.fromJsonString(GhStatusReviewThreadsDocument));
const decodeGhStatusWorkflowRuns = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhStatusWorkflowRun)));
const reviewThreadsQuery =
  "query($id:ID!,$cursor:String){node(id:$id){... on PullRequest{author{login} reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated path line resolvedBy{login} comments(first:1){nodes{author{__typename login} body databaseId}} latest:comments(last:1){nodes{author{__typename login} body databaseId}}} pageInfo{hasNextPage endCursor}}}}}";
const decodeGhStatusChecks = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhStatusCheck)));

const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const pathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(Str.split("\0"), sortedUniquePaths);

/**
 * Return the status artifact path for a Yeet run context.
 *
 * **Example** (Derive the status path for a context)
 *
 * ```ts
 * import { yeetStatusPathForTesting } from "@beep/repo-cli/test/Yeet"
 * import { RepoRunContext } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/status-work",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(Effect.isEffect(yeetStatusPathForTesting(context))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
const statusPathForContext = Effect.fn("YeetStatus.statusPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  return yield* runArtifactPathForContext(context, "status.json");
});

const runGitPaths = Effect.fn("YeetStatus.runGitPaths")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("git", args, repoRoot).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to run git ${A.join(args, " ")}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      command: `git ${A.join(args, " ")}`,
      exitCode: result.exitCode,
      message: `git ${A.join(args, " ")} failed with exit code ${result.exitCode}.`,
    });
  }
  return pathListFromNulOutput(result.output);
});

const collectWorktreeStatus = Effect.fn("YeetStatus.collectWorktreeStatus")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetStatusWorktree, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const staged = yield* runGitPaths(context.repoRoot, ["diff", "--cached", "--name-only", "-z"]);
  const unstaged = yield* runGitPaths(context.repoRoot, ["diff", "--name-only", "-z"]);
  const untracked = yield* runGitPaths(context.repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const stagedCount = A.length(staged);
  const unstagedCount = A.length(unstaged);
  const untrackedCount = A.length(untracked);
  return YeetStatusWorktree.make({
    clean: stagedCount === 0 && unstagedCount === 0 && untrackedCount === 0,
    staged: stagedCount,
    unstaged: unstagedCount,
    untracked: untrackedCount,
  });
});

const missingArtifact = (path: string, detail: string): YeetStatusArtifact =>
  YeetStatusArtifact.make({ detail, path, state: "missing" });

const unreadableArtifact = (path: string, detail: string): YeetStatusArtifact =>
  YeetStatusArtifact.make({ detail, path, state: "unreadable" });

const firstFailedRepairCommand = (verdict: YeetVerdict): O.Option<string> =>
  pipe(
    verdict.lanes,
    A.findFirst((lane) => lane.status === "failed"),
    O.flatMap((lane) => O.fromUndefinedOr(lane.repairCommand))
  );

const verdictLaneDigests = (verdict: YeetVerdict): ReadonlyArray<YeetStatusLaneDigest> =>
  pipe(
    verdict.lanes,
    A.map((lane) => O.map(lane.inputDigest, (inputDigest) => YeetStatusLaneDigest.make({ id: lane.id, inputDigest }))),
    A.getSomes
  );

/**
 * Render the `lane digests:` line plus one indented line per lane that recorded a Turbo digest.
 *
 * **Example** (Render two digests)
 *
 * ```ts
 * import { renderYeetLaneDigestBlock, YeetStatusArtifact } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = YeetStatusArtifact.make({
 *   detail: "verify success",
 *   path: "verdict.json",
 *   state: "present",
 *   laneDigests: [{ id: "quality:knip", inputDigest: "abc" }],
 * })
 * console.log(renderYeetLaneDigestBlock(verdict).split("\n").length) // 2
 * ```
 *
 * @param verdict - The verdict artifact summary carried by the status snapshot.
 * @returns The header line and one indented `id: digest` line per recorded lane.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetLaneDigestBlock = (verdict: YeetStatusArtifact): string => {
  const digests = verdict.laneDigests ?? A.empty<YeetStatusLaneDigest>();
  if (A.isReadonlyArrayEmpty(digests)) {
    return "lane digests: none recorded";
  }
  return A.join(
    [`lane digests: ${A.length(digests)} lane(s)`, ...A.map(digests, (lane) => `  ${lane.id}: ${lane.inputDigest}`)],
    "\n"
  );
};

const artifactFromVerdict = (path: string, verdict: YeetVerdict): YeetStatusArtifact =>
  YeetStatusArtifact.make({
    detail: `${verdict.mode} ${verdict.outcome}: ${verdict.message}`,
    path,
    state: "present",
    schemaVersion: verdict.schemaVersion,
    mode: verdict.mode,
    outcome: verdict.outcome,
    laneDigests: verdictLaneDigests(verdict),
    ...O.getSomesStruct({ repairCommand: firstFailedRepairCommand(verdict) }),
  });

const artifactFromCloseout = (path: string, report: PrCloseoutReport): YeetStatusArtifact =>
  YeetStatusArtifact.make({
    detail: `PR #${report.prNumber}: ${report.issueCount} closeout issue(s), ${report.actionableReviewThreadCount} actionable thread(s)`,
    issueCount: report.issueCount,
    path,
    reviewedHeadSha: report.reviewedHeadSha,
    schemaVersion: report.schemaVersion,
    state: "present",
    greptileScore: O.fromUndefinedOr(report.greptile.score),
  });

const readJsonArtifact = Effect.fn("YeetStatus.readJsonArtifact")(function* <Value>(
  path: string,
  missingDetail: string,
  unreadableDetail: string,
  undecodableDetail: string,
  decode: (text: string) => Effect.Effect<Value, S.SchemaError>,
  render: (value: Value) => YeetStatusArtifact
): Effect.fn.Return<YeetStatusArtifact, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* artifactExists(path);
  if (!exists) {
    return missingArtifact(path, missingDetail);
  }
  const text = yield* fs.readFileString(path).pipe(Effect.option);
  if (O.isNone(text)) {
    return unreadableArtifact(path, unreadableDetail);
  }
  return yield* decode(text.value).pipe(
    Effect.map(render),
    Effect.orElseSucceed(() => unreadableArtifact(path, undecodableDetail))
  );
});

const readVerdictArtifact = (path: string): Effect.Effect<YeetStatusArtifact, never, FileSystem.FileSystem> =>
  readJsonArtifact(
    path,
    "no verdict artifact found for this branch",
    "verdict artifact could not be read",
    "verdict artifact could not be decoded",
    decodeYeetVerdict,
    (verdict) => artifactFromVerdict(path, verdict)
  );

const readCloseoutArtifact = (path: string): Effect.Effect<YeetStatusArtifact, never, FileSystem.FileSystem> =>
  readJsonArtifact(
    path,
    "no closeout artifact found for this branch",
    "closeout artifact could not be read",
    "closeout artifact could not be decoded",
    decodePrCloseoutReport,
    (report) => artifactFromCloseout(path, report)
  );

const artifactExists = Effect.fn("YeetStatus.artifactExists")(function* (
  path: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
});

const checkIsFailing = (check: GhStatusCheck): boolean => {
  const bucket = Str.toLowerCase(check.bucket);
  const state = Str.toLowerCase(check.state);
  return (
    A.contains(["fail", "failing", "cancel", "cancelled", "error", "timed_out"], bucket) ||
    A.contains(["failure", "cancelled", "error", "timed_out"], state)
  );
};

const checkIsPending = (check: GhStatusCheck): boolean => {
  const bucket = Str.toLowerCase(check.bucket);
  const state = Str.toLowerCase(check.state);
  return (
    A.contains(["pending", "running", "queued", "waiting"], bucket) ||
    A.contains(["pending", "in_progress", "queued", "waiting"], state)
  );
};

type RemoteCheckSummary = {
  readonly checkCount: O.Option<number>;
  readonly failingCheckCount: O.Option<number>;
  readonly pendingCheckCount: O.Option<number>;
  readonly requiredCheckCount: O.Option<number>;
  readonly failingRequiredCheckCount: O.Option<number>;
  readonly pendingRequiredCheckCount: O.Option<number>;
  readonly optionalCheckCount: O.Option<number>;
  readonly failingOptionalCheckCount: O.Option<number>;
  readonly pendingOptionalCheckCount: O.Option<number>;
};

/**
 * Summarize all, required, and optional pull-request checks for status output.
 *
 * **Details**
 *
 * GitHub returns required checks as a second filtered view of the complete
 * check list. Optional checks are therefore the complete rows whose names do
 * not appear in that required view. When either capture is unavailable the
 * optional split remains unknown rather than being reported as empty.
 *
 * @param checks - Complete check-list capture, when available.
 * @param requiredChecks - Required-only check-list capture, when available.
 * @returns Optional counts for each observed check partition.
 * @category diagnostics
 * @since 0.0.0
 */
export const summarizeRemoteChecksForTesting: {
  (
    requiredChecks: O.Option<ReadonlyArray<GhStatusCheck>>
  ): (checks: O.Option<ReadonlyArray<GhStatusCheck>>) => RemoteCheckSummary;
  (
    checks: O.Option<ReadonlyArray<GhStatusCheck>>,
    requiredChecks: O.Option<ReadonlyArray<GhStatusCheck>>
  ): RemoteCheckSummary;
} = dual(
  2,
  (
    checks: O.Option<ReadonlyArray<GhStatusCheck>>,
    requiredChecks: O.Option<ReadonlyArray<GhStatusCheck>>
  ): RemoteCheckSummary => {
    const checkCount = pipe(checks, O.map(A.length));
    const failingCheckCount = pipe(
      checks,
      O.map((values) => A.length(A.filter(values, checkIsFailing)))
    );
    const pendingCheckCount = pipe(
      checks,
      O.map((values) => A.length(A.filter(values, checkIsPending)))
    );
    const requiredCheckCount = pipe(requiredChecks, O.map(A.length));
    const failingRequiredCheckCount = pipe(
      requiredChecks,
      O.map((values) => A.length(A.filter(values, checkIsFailing)))
    );
    const pendingRequiredCheckCount = pipe(
      requiredChecks,
      O.map((values) => A.length(A.filter(values, checkIsPending)))
    );
    const optionalChecks = O.all({ checks, requiredChecks }).pipe(
      O.map(({ checks: all, requiredChecks: requiredRows }) =>
        A.filter(all, (check) => !A.some(requiredRows, (requiredCheck) => requiredCheck.name === check.name))
      )
    );
    const optionalCheckCount = pipe(optionalChecks, O.map(A.length));
    const failingOptionalCheckCount = pipe(
      optionalChecks,
      O.map((values) => A.length(A.filter(values, checkIsFailing)))
    );
    const pendingOptionalCheckCount = pipe(
      optionalChecks,
      O.map((values) => A.length(A.filter(values, checkIsPending)))
    );
    return {
      checkCount,
      failingCheckCount,
      pendingCheckCount,
      requiredCheckCount,
      failingRequiredCheckCount,
      pendingRequiredCheckCount,
      optionalCheckCount,
      failingOptionalCheckCount,
      pendingOptionalCheckCount,
    };
  }
);

/**
 * Read either check census, retaining an unreadable response as None.
 *
 * **Example** (Prepare a required census read)
 *
 * ```ts
 * import { collectRemoteChecksForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const readRequired = collectRemoteChecksForTesting(true)
 * ```
 *
 * @param context - Repository context whose current branch identifies the pull request.
 * @param required - Restrict the read to required checks when true; otherwise read all checks.
 * @returns Decoded rows, or None when the response is unreadable or truncated.
 * @category getters
 * @since 0.0.0
 */
export const collectRemoteChecks: {
  (
    required: boolean
  ): (
    context: RepoRunContext
  ) => Effect.Effect<O.Option<ReadonlyArray<GhStatusCheck>>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner>;
  (
    context: RepoRunContext,
    required: boolean
  ): Effect.Effect<O.Option<ReadonlyArray<GhStatusCheck>>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("YeetStatus.collectRemoteChecks")(function* (
    context: RepoRunContext,
    required: boolean
  ): Effect.fn.Return<
    O.Option<ReadonlyArray<GhStatusCheck>>,
    YeetCommandError,
    ChildProcessSpawner.ChildProcessSpawner
  > {
    const args = ["pr", "checks", ...(required ? ["--required"] : []), "--json", "name,state,bucket"];
    const result = yield* runRepoCommandCapture("gh", args, context.repoRoot).pipe(
      Effect.mapError(YeetCommandError.new("Failed to inspect PR checks for yeet status."))
    );
    if (result.truncated) {
      return O.none();
    }
    return yield* decodeGhStatusChecks(result.output).pipe(Effect.asSome, Effect.orElseSucceed(O.none));
  })
);

// One pull request's review threads, read to the end of the connection: the
// pull request author (the login `resolvedBy` is compared against) plus every
// thread node across every page.
interface GhStatusReviewThreadPages {
  readonly pullRequestAuthor: O.Option<string>;
  readonly threads: ReadonlyArray<GhStatusReviewThread>;
}

const pullRequestAuthorLogin = (node: GhStatusReviewThreadsNode): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(node.author),
    O.flatMap(O.fromNullishOr),
    O.map((author) => author.login)
  );

// fallow-ignore-next-line complexity -- the GraphQL cursor and page validity checks form one pagination state machine
const collectRemoteReviewThreads = Effect.fn("YeetStatus.collectRemoteReviewThreads")(function* (
  context: RepoRunContext,
  pullRequestId: string
): Effect.fn.Return<GhStatusReviewThreadPages, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const threads: Array<GhStatusReviewThread> = [];
  let pullRequestAuthor = O.none<string>();
  let cursor = O.none<string>();
  while (true) {
    const result = yield* runRepoCommandCapture(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${reviewThreadsQuery}`,
        "-F",
        `id=${pullRequestId}`,
        ...O.match(cursor, { onNone: () => [], onSome: (value) => ["-F", `cursor=${value}`] }),
      ],
      context.repoRoot
    ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect PR review threads for yeet status.")));
    if (result.exitCode !== 0 || result.truncated) {
      return yield* YeetCommandError.make({
        message: "Failed to collect the paginated PR review-thread closeout gate.",
        command: "gh api graphql",
        exitCode: result.exitCode === 0 ? 1 : result.exitCode,
      });
    }
    const node = yield* decodeGhStatusReviewThreads(result.output).pipe(
      Effect.map((document) => document.data.node),
      Effect.mapError(YeetCommandError.new("Failed to decode PR review threads for yeet status."))
    );
    pullRequestAuthor = O.orElse(pullRequestAuthor, () => pullRequestAuthorLogin(node));
    threads.push(...node.reviewThreads.nodes);
    const pageInfo = node.reviewThreads.pageInfo;
    if (!pageInfo.hasNextPage) {
      return { pullRequestAuthor, threads };
    }
    // A page that claims a successor without naming one would loop forever on
    // the same first hundred threads and under-report every thread past them.
    if (pageInfo.endCursor === null || Str.isEmpty(pageInfo.endCursor)) {
      return yield* YeetCommandError.make({
        message: "PR review threads reported another GraphQL page without an end cursor.",
        command: "gh api graphql",
        exitCode: 1,
      });
    }
    cursor = O.some(pageInfo.endCursor);
  }
});

/**
 * Fetch the branch's recent workflow runs, tolerating any `gh` failure.
 *
 * **Details**
 *
 * Shared with the `--until-merged` merge loop, which needs the same run list to
 * find the failed runs at the current head SHA before drilling into their jobs.
 *
 * **Example** (Reference the workflow-run collector)
 *
 * ```ts
 * import { collectRemoteWorkflowRuns } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(collectRemoteWorkflowRuns))) // true
 * ```
 *
 * @param context - Yeet run context naming the branch and repo root.
 * @returns The branch's most recent workflow runs, or an empty list.
 * @category diagnostics
 * @since 0.0.0
 */
export const collectRemoteWorkflowRuns = Effect.fn("YeetStatus.collectRemoteWorkflowRuns")(function* (
  context: RepoRunContext
): Effect.fn.Return<ReadonlyArray<GhStatusWorkflowRun>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["run", "list", "--branch", context.branch, "--limit", "20", "--json", "databaseId,headSha,status,conclusion,name"],
    context.repoRoot
  ).pipe(Effect.orElseSucceed(() => ({ exitCode: 1, output: "", truncated: false })));
  if (result.exitCode !== 0 || result.truncated) {
    return A.empty();
  }
  return yield* decodeGhStatusWorkflowRuns(result.output).pipe(Effect.orElseSucceed(A.empty<GhStatusWorkflowRun>));
});

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/gu;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/gu;
const HTML_TAG_PATTERN = /<[^>]*>/gu;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\([^)]*\)/gu;
const MARKDOWN_LINE_PREFIX_PATTERN = /^[\s>#*\-+]+/u;
const MARKDOWN_EMPHASIS_PATTERN = /[*_`]/gu;

/**
 * Reduce a review-comment body to one plain first line.
 *
 * **Details**
 *
 * Bot review bodies open with machine markers rather than prose — an HTML
 * comment, a shields.io severity badge image, then bolded category text — so a
 * naive first line is empty or a URL. Stripping comments, images, tags, and
 * link syntax first makes the first non-empty line the sentence a human would
 * read.
 *
 * **Example** (Strip a badge-prefixed bot comment)
 *
 * ```ts
 * import { yeetReviewThreadExcerpt } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetReviewThreadExcerpt("<!-- greptile -->\n![](https://img/badge.svg) **logic**: off by one"))
 * ```
 *
 * @param body - Raw review-comment markdown.
 * @returns A single-line, badge-free excerpt bounded for operator output.
 * @category formatting
 * @since 0.0.0
 */
export const yeetReviewThreadExcerpt: (body: string) => string = flow(
  Str.replace(HTML_COMMENT_PATTERN, " "),
  Str.replace(MARKDOWN_IMAGE_PATTERN, " "),
  Str.replace(HTML_TAG_PATTERN, " "),
  Str.replace(MARKDOWN_LINK_PATTERN, "$1"),
  Str.split(/\r?\n/u),
  A.map(flow(Str.replace(MARKDOWN_LINE_PREFIX_PATTERN, ""), Str.replace(MARKDOWN_EMPHASIS_PATTERN, ""), Str.trim)),
  A.findFirst(Str.isNonEmpty),
  O.map((line) => yeetCommentExcerpt(line, threadExcerptLength)),
  O.getOrElse(() => "(no comment body)")
);

const reviewThreadTriage = (
  thread: GhStatusReviewThread,
  comment: O.Option<GhStatusThreadComment> = A.head(thread.comments.nodes)
): YeetStatusReviewThread => {
  const opening = comment;
  return YeetStatusReviewThread.make({
    threadId: thread.id,
    author: pipe(
      opening,
      O.flatMap((comment) => O.fromNullishOr(comment.author)),
      O.map((author) => author.login),
      O.getOrElse(() => "unknown")
    ),
    excerpt: pipe(
      opening,
      O.flatMap((comment) => O.fromNullishOr(comment.body)),
      O.map(yeetReviewThreadExcerpt),
      O.getOrElse(() => "(no comment body)")
    ),
    path: O.fromNullishOr(thread.path),
    line: O.fromNullishOr(thread.line),
    commentDatabaseId: pipe(
      opening,
      O.flatMap((comment) => O.fromNullishOr(comment.databaseId))
    ),
  });
};

const latestThreadComment = (thread: GhStatusReviewThread): O.Option<GhStatusThreadComment> =>
  pipe(
    O.fromUndefinedOr(thread.latest),
    O.flatMap((latest) => A.last(latest.nodes))
  );

// The newest comment reduced to the two structural facts the rule reads. A
// comment whose author GitHub no longer names (a deleted account) yields None:
// an unidentifiable last speaker is unknown, and unknown never gates.
const newestThreadComment = (thread: GhStatusReviewThread): O.Option<YeetReviewThreadNewestComment> =>
  pipe(
    latestThreadComment(thread),
    O.flatMap((comment) => O.fromNullishOr(comment.author)),
    O.map((author) =>
      YeetReviewThreadNewestComment.make({
        authorLogin: author.login,
        authorKind: yeetReviewCommentAuthorKind(O.fromUndefinedOr(author.__typename)),
      })
    )
  );

const reviewThreadStateInput = (
  thread: GhStatusReviewThread,
  pullRequestAuthor: O.Option<string>
): YeetReviewThreadStateInput =>
  YeetReviewThreadStateInput.make({
    threadId: thread.id,
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated,
    path: O.fromNullishOr(thread.path),
    line: O.fromNullishOr(thread.line),
    pullRequestAuthor,
    resolvedBy: pipe(
      O.fromUndefinedOr(thread.resolvedBy),
      O.flatMap(O.fromNullishOr),
      O.map((actor) => actor.login)
    ),
    newestComment: newestThreadComment(thread),
  });

/**
 * One pull request's review threads, partitioned by what each still owes.
 *
 * **Details**
 *
 * The unresolved rows are triaged from each thread's *opening* comment, which
 * is the objection being raised; the follow-up and acknowledgement rows are
 * triaged from the *newest* one, which is the sentence that made the thread
 * outstanding again. `counts` tallies every thread including the answered
 * ones, so the partition can be audited against the pull request's own total.
 *
 * **Example** (An empty pull request owes nothing)
 *
 * ```ts
 * import { YeetReviewThreadStateCounts, YeetStatusThreadTriage } from "@beep/repo-cli/test/Yeet"
 *
 * const triage = YeetStatusThreadTriage.make({
 *   counts: YeetReviewThreadStateCounts.make({ unresolved: 0, followUp: 0, acknowledged: 0, answered: 0 }),
 *   unresolvedThreads: [],
 *   followUpThreads: [],
 *   acknowledgedThreads: [],
 * })
 * console.log(triage.counts.followUp) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusThreadTriage extends S.Class<YeetStatusThreadTriage>($I`YeetStatusThreadTriage`)(
  {
    counts: YeetReviewThreadStateCounts,
    unresolvedThreads: S.Array(YeetStatusReviewThread),
    followUpThreads: S.Array(YeetStatusReviewThread),
    acknowledgedThreads: S.Array(YeetStatusReviewThread),
  },
  $I.annote("YeetStatusThreadTriage", {
    description: "A pull request's review threads partitioned by classified state, with per-state tallies.",
  })
) {}

const triageThreadsInState = (
  classified: ReadonlyArray<readonly [GhStatusReviewThread, YeetReviewThreadState]>,
  tag: YeetReviewThreadStateTag,
  comment: (thread: GhStatusReviewThread) => O.Option<GhStatusThreadComment>
): ReadonlyArray<YeetStatusReviewThread> =>
  pipe(
    classified,
    A.filter(([, state]) => Str.Equivalence(state.state, tag)),
    A.map(([thread]) => reviewThreadTriage(thread, comment(thread)))
  );

const classifyReviewThreads = (
  threads: ReadonlyArray<GhStatusReviewThread>,
  pullRequestAuthor: O.Option<string>
): YeetStatusThreadTriage => {
  const classified = A.map(
    threads,
    (thread) => [thread, deriveYeetReviewThreadState(reviewThreadStateInput(thread, pullRequestAuthor))] as const
  );
  return YeetStatusThreadTriage.make({
    counts: summarizeYeetReviewThreadStates(A.map(classified, ([, state]) => state)),
    unresolvedThreads: triageThreadsInState(classified, "unresolved", (thread) => A.head(thread.comments.nodes)),
    followUpThreads: triageThreadsInState(classified, "resolved-follow-up", latestThreadComment),
    acknowledgedThreads: triageThreadsInState(classified, "resolved-acknowledged", latestThreadComment),
  });
};

/**
 * Classify a raw review-thread GraphQL payload the way `yeet status` does.
 *
 * **Details**
 *
 * The seam the thread gate is tested through: it takes the JSON one page of
 * the status thread query prints and returns the same partition
 * `collectYeetStatus` builds the remote summary from, so a test can exercise
 * the rule against a real payload without a spawner.
 *
 * **Example** (Classify an empty page)
 *
 * ```ts
 * import { yeetStatusThreadTriageForTesting } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(yeetStatusThreadTriageForTesting("{}"))) // true
 * ```
 *
 * @param payload - One `gh api graphql` review-thread response body.
 * @returns The classified partition of that page's threads.
 * @category diagnostics
 * @since 0.0.0
 */
export const yeetStatusThreadTriageForTesting = Effect.fn("YeetStatus.yeetStatusThreadTriageForTesting")(function* (
  payload: string
): Effect.fn.Return<YeetStatusThreadTriage, YeetCommandError> {
  const node = yield* decodeGhStatusReviewThreads(payload).pipe(
    Effect.map((document) => document.data.node),
    Effect.mapError(YeetCommandError.new("Failed to decode PR review threads for yeet status."))
  );
  return classifyReviewThreads(node.reviewThreads.nodes, pullRequestAuthorLogin(node));
});

const skippedRemote = YeetStatusRemote.make({
  available: false,
  checked: false,
  detail: "pass --remote to include live GitHub PR data",
});

/**
 * Build the read-only failed-job listing suggested when a same-SHA red run is
 * rerunnable.
 *
 * **Details**
 *
 * Job-scoped on purpose, matching the merge loop's rerun command. A run-level
 * `--failed` rerun re-executes every failed job in the run, so a genuine red
 * sharing the run with a flake gets re-run as a side effect of the flake —
 * the exact behaviour the merge loop bans. Status has only the run-level
 * record at this seam, so it suggests the listing that surfaces
 * each failed job's `databaseId` and lets the decision text name the
 * job-scoped rerun form.
 *
 * **Example** (Suggest the failed-job listing for a run)
 *
 * ```ts
 * import { yeetRerunJobListingCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetRerunJobListingCommand(123).startsWith("gh run view 123")) // true
 * ```
 *
 * @param runId - Workflow run database id from `gh run list`.
 * @returns The read-only `gh run view` job listing command.
 * @category formatting
 * @since 0.0.0
 */
export const yeetRerunJobListingCommand = (runId: number): string =>
  `gh run view ${runId} --json jobs --jq '.jobs[] | select(.conclusion == "failure") | [.databaseId, .name] | @tsv'`;

/**
 * Render the same-SHA rerun decision line that teaches the job-scoped form.
 *
 * **Example** (Name the job-scoped rerun for a red run)
 *
 * ```ts
 * import { yeetRerunDecisionText } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetRerunDecisionText("check").includes("--job")) // true
 * ```
 *
 * @param runName - Workflow run name from `gh run list`.
 * @returns Operator guidance naming `gh run rerun --job`, never `--failed`.
 * @category formatting
 * @since 0.0.0
 */
export const yeetRerunDecisionText = (runName: string): string =>
  `same-SHA red detected for ${runName}; rerun one job with \`gh run rerun --job <databaseId>\`, never \`--failed\``;

const collectRemoteStatus = Effect.fn("YeetStatus.collectRemoteStatus")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<YeetStatusRemote, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  if (!remote) {
    return skippedRemote;
  }
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "id,number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision,headRefOid,labels"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect PR for yeet status.")));
  if (result.exitCode !== 0) {
    return YeetStatusRemote.make({
      available: false,
      checked: true,
      detail: "gh pr view found no pull request for the current branch",
    });
  }
  if (result.truncated) {
    return YeetStatusRemote.make({
      available: false,
      checked: true,
      detail: "gh pr view output exceeded the repo-run capture limit",
    });
  }
  const view = yield* decodeGhStatusPullRequest(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON for yeet status."))
  );
  const [checks, requiredChecks] = yield* Effect.all([
    collectRemoteChecks(context, false),
    collectRemoteChecks(context, true),
  ]);
  const threadPages = yield* collectRemoteReviewThreads(context, view.id);
  const triage = classifyReviewThreads(threadPages.threads, threadPages.pullRequestAuthor);
  const unresolvedReviewThreads = A.map(
    triage.unresolvedThreads,
    (thread) => `${thread.threadId}${O.match(thread.path, { onNone: () => Str.empty, onSome: (path) => ` (${path})` })}`
  );
  const checkSummary = summarizeRemoteChecksForTesting(checks, requiredChecks);
  const workflowRuns = yield* collectRemoteWorkflowRuns(context);
  const hasFailingCheck = pipe(
    checkSummary.failingCheckCount,
    O.exists((count) => count > 0)
  );
  // A same-SHA failed run stays in `gh run list` after a rerun turns the checks
  // green, so rerun guidance is only actionable while a check is still red.
  const rerunnableFailedRun = pipe(
    workflowRuns,
    A.findFirst((run) => run.headSha === view.headRefOid && run.conclusion === "failure"),
    O.filter(() => hasFailingCheck)
  );
  const rerunFailedCommand = O.map(rerunnableFailedRun, (run) => yeetRerunJobListingCommand(run.databaseId));
  const rerunFailedDecision = pipe(
    rerunnableFailedRun,
    O.map((run) => yeetRerunDecisionText(run.name)),
    O.orElse(() => O.some("no same-SHA failed workflow rerun is currently indicated"))
  );
  return YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: `PR #${view.number} ${view.state}`,
    checks: A.map(O.getOrElse(checks, A.empty), (row) =>
      YeetSettleCheck.make({
        name: row.name,
        outcome: classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: row.bucket, state: row.state })),
        required: O.exists(
          requiredChecks,
          A.some((required) => required.name === row.name)
        ),
      })
    ),
    isDraft: view.isDraft,
    labels: A.map(view.labels, (label) => label.name),
    number: view.number,
    state: view.state,
    url: view.url,
    unresolvedReviewThreadCount: triage.counts.unresolved,
    unresolvedReviewThreads,
    unresolvedThreads: O.some(triage.unresolvedThreads),
    followUpThreadCount: triage.counts.followUp,
    followUpThreads: O.some(triage.followUpThreads),
    acknowledgedThreadCount: triage.counts.acknowledged,
    acknowledgedThreads: O.some(triage.acknowledgedThreads),
    headSha: O.some(view.headRefOid),
    ...O.getSomesStruct({
      ...checkSummary,
      rerunFailedCommand,
      rerunFailedDecision,
    }),
    ...O.getSomesStruct({
      mergeStateStatus: O.fromNullishOr(view.mergeStateStatus),
      mergeable: O.fromNullishOr(view.mergeable),
      reviewDecision: O.fromNullishOr(view.reviewDecision),
    }),
  });
});

const STAGE_AND_PUBLISH_COMMAND =
  'stage intended files, then run `bun run beep yeet publish --staged-only --pr --monitor --message "..."`';
const OPEN_PULL_REQUEST_COMMAND =
  'run `bun run beep yeet publish --pr --monitor --message "..."` when ready for PR review';
const MERGE_READY_COMMAND = "confirm GitHub mergeability, then merge the PR";
const REPLY_COMMAND = "run `bun run beep yeet reply` to answer the outstanding review threads";
const CLOSEOUT_COMMAND =
  "run `bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`";
const VERIFY_OR_REMOTE_COMMAND = "run `bun run beep yeet verify` or pass `--remote` for PR status";

const requiredChecksAreGreen = (remote: YeetStatusRemote): boolean =>
  pipe(
    O.fromUndefinedOr(remote.requiredCheckCount),
    O.exists(
      (count) =>
        count > 0 && (remote.failingRequiredCheckCount ?? 0) === 0 && (remote.pendingRequiredCheckCount ?? 0) === 0
    )
  );

const acceptableMergeStateStatuses: ReadonlyArray<string> = ["BEHIND", "CLEAN", "HAS_HOOKS", "UNSTABLE"];

const mergeStateIsAcceptable = (remote: YeetStatusRemote): boolean =>
  O.exists(O.fromUndefinedOr(remote.mergeStateStatus), (status) =>
    A.contains(acceptableMergeStateStatuses, Str.toUpperCase(status))
  );

const reviewDecisionIsAcceptable = (remote: YeetStatusRemote): boolean =>
  O.match(O.fromUndefinedOr(remote.reviewDecision), {
    onNone: () => true,
    onSome: (decision) => Str.isEmpty(decision) || Str.toUpperCase(decision) === "APPROVED",
  });

const sameHeadSha = S.toEquivalence(S.String);

// Every thread that still owes somebody an answer, whether or not GitHub
// still calls it open: unresolved threads plus threads the author resolved
// with a human reviewer speaking last. An acknowledgement is excluded on
// purpose — a review bot's confirmation is a receipt, not an objection.
const outstandingThreadCount = (remote: YeetStatusRemote): number =>
  (remote.unresolvedReviewThreadCount ?? 0) + (remote.followUpThreadCount ?? 0);

// The live remote thread counts are the authoritative surface; the closeout
// artifact is a prior run's record and only blocks when it EXISTS and still
// reports open issues. Requiring its presence would conflate "closeout has
// not run yet" with "threads are unresolved" — a missing artifact is
// unknown, and unknown must not masquerade as a named blocker.
const threadsAreResolved = (closeout: YeetStatusArtifact, remote: YeetStatusRemote): boolean =>
  outstandingThreadCount(remote) === 0 &&
  !pipe(
    O.fromUndefinedOr(closeout.issueCount),
    O.exists((count) => count > 0)
  );

// The closeout-run criterion binds to a specific revision: a closeout artifact
// satisfies it only when the head it reviewed is the head the PR currently
// points at. Legacy reports without a recorded head never bind.
const closeoutBindsCurrentHead = (closeout: YeetStatusArtifact, remote: YeetStatusRemote): boolean =>
  pipe(
    closeout.reviewedHeadSha,
    O.exists((reviewedHeadSha) => O.exists(remote.headSha, (headSha) => sameHeadSha(reviewedHeadSha, headSha)))
  );

// The first unsatisfied hard criterion in protocol order, or `None` when every
// one holds. Order mirrors the closeout -> checks -> threads escalation the
// merge protocol asks an operator to walk.
const firstFailingCriterion = (criteria: YeetMergeReadyCriteria): O.Option<YeetMergeReadyCriterion> =>
  pipe(
    YeetMergeReadyCriterion.Options,
    A.findFirst((criterion) => !mergeReadyCriterionHolds(criteria, criterion))
  );

/**
 * Fold the live pull request surfaces into one truthful merge-readiness verdict.
 *
 * **Details**
 *
 * Status already fetches everything the protocol asks a human to read, so the
 * only thing missing was a name for the answer. Pull request state, draft state,
 * current-head closeout, required checks, threads, mergeability, merge state,
 * and review decision are hard criteria. A missing closeout artifact is
 * its own blocker while the live thread criterion continues to report only the
 * state it knows. A present closeout satisfies `closeout-run` only when its
 * recorded reviewed head equals the current remote head; legacy headless and
 * stale reports remain blockers. The Greptile score rides along as display-only:
 * it is a target the operator judges, not a gate this verdict enforces.
 *
 * **Gotchas**
 *
 * Returns `None` when the pull request was not read at all (`yeet status`
 * without `--remote`, or no PR for the branch). Unknown is not the same as
 * blocked, and callers that flatten it to `false` would announce a failing
 * criterion that was never observed. Unread *checks*, by contrast, are treated
 * as not-green: the criterion is hard, so absence of proof blocks.
 *
 * **Example** (Name the blocking criterion)
 *
 * ```ts
 * import { deriveYeetMergeReady, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const mergeReady = deriveYeetMergeReady(
 *   YeetStatusArtifact.make({ detail: "closed", issueCount: 0, path: "pr-closeout.json", state: "present" }),
 *   YeetStatusRemote.make({
 *     available: true,
 *     checked: true,
 *     detail: "PR #42 OPEN",
 *     state: "OPEN", isDraft: false, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN",
 *     requiredCheckCount: 17, failingRequiredCheckCount: 1, pendingRequiredCheckCount: 0,
 *     unresolvedReviewThreadCount: 0,
 *   })
 * )
 * console.log(mergeReady)
 * ```
 *
 * @param closeout - Closeout artifact summary for the branch.
 * @param remote - Live pull request summary, checked or not.
 * @returns The merge-readiness verdict, or `None` when the PR was not read.
 * @category diagnostics
 * @since 0.0.0
 */
export const deriveYeetMergeReady: {
  (remote: YeetStatusRemote): (closeout: YeetStatusArtifact) => O.Option<YeetMergeReady>;
  (closeout: YeetStatusArtifact, remote: YeetStatusRemote): O.Option<YeetMergeReady>;
} = dual(2, (closeout: YeetStatusArtifact, remote: YeetStatusRemote): O.Option<YeetMergeReady> => {
  if (!remote.checked || !remote.available) {
    return O.none();
  }
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: remote.state === "OPEN",
    notDraft: remote.isDraft === false,
    closeoutRun: closeout.state === "present" && closeoutBindsCurrentHead(closeout, remote),
    requiredChecksGreen: requiredChecksAreGreen(remote),
    threadsResolved: threadsAreResolved(closeout, remote),
    mergeable: remote.mergeable === "MERGEABLE",
    mergeStateAcceptable: mergeStateIsAcceptable(remote),
    reviewDecisionAcceptable: reviewDecisionIsAcceptable(remote),
    greptileScore: closeout.greptileScore,
  });
  const failing = firstFailingCriterion(criteria);
  return O.some(YeetMergeReady.make({ ready: O.isNone(failing), failing, criteria }));
});

// Whether the merge is blocked by review threads and by nothing else. Read
// across every criterion rather than off `failing` alone: `failing` names only
// the first blocker in protocol order, so threads leading it says nothing
// about the checks, mergeability, or review decision behind it.
const threadsAreTheOnlyBlocker = (mergeReady: O.Option<YeetMergeReady>): boolean =>
  O.exists(
    mergeReady,
    (value) =>
      !mergeReadyCriterionHolds(value.criteria, "threads-resolved") &&
      A.every(
        YeetMergeReadyCriterion.Options,
        (criterion) =>
          Str.Equivalence(criterion, "threads-resolved") || mergeReadyCriterionHolds(value.criteria, criterion)
      )
  );

const nextCommandForRemote = (
  verdict: YeetStatusArtifact,
  closeout: YeetStatusArtifact,
  remote: YeetStatusRemote
): string => {
  if (closeout.state !== "present") {
    return CLOSEOUT_COMMAND;
  }
  const mergeReady = deriveYeetMergeReady(closeout, remote);
  if (O.exists(mergeReady, (value) => value.ready)) {
    return MERGE_READY_COMMAND;
  }
  // Threads are the one blocker with a command of its own, and it is suggested
  // only when posting those replies would finish the job: every other
  // criterion already holds and live threads are what is left. Naming it while
  // the pipeline is also red would send the operator to answer reviewers on a
  // branch that cannot merge either way. A `threads-resolved` failure carried
  // by the closeout artifact's own issue count is answered by re-running
  // closeout, not by posting replies nobody is owed.
  if (threadsAreTheOnlyBlocker(mergeReady) && outstandingThreadCount(remote) > 0) {
    return REPLY_COMMAND;
  }
  if (remote.rerunFailedCommand !== undefined && verdict.outcome === "success") {
    return `${remote.rerunFailedCommand} # ${remote.rerunFailedDecision ?? "same-SHA failed workflow"}`;
  }
  return CLOSEOUT_COMMAND;
};

const nextCommandForStatus = (
  worktree: YeetStatusWorktree,
  verdict: YeetStatusArtifact,
  closeout: YeetStatusArtifact,
  remote: YeetStatusRemote
): string =>
  pipe(
    [
      O.fromUndefinedOr(verdict.repairCommand),
      worktree.clean ? O.none<string>() : O.some(STAGE_AND_PUBLISH_COMMAND),
      remote.checked && !remote.available ? O.some(OPEN_PULL_REQUEST_COMMAND) : O.none<string>(),
      remote.available ? O.some(nextCommandForRemote(verdict, closeout, remote)) : O.none<string>(),
    ],
    A.getSomes,
    A.head,
    O.getOrElse(() => VERIFY_OR_REMOTE_COMMAND)
  );

/**
 * Collect a local-first Yeet operator status snapshot.
 *
 * **Example** (Reference the status collector)
 *
 * ```ts
 * import { collectYeetStatus } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(collectYeetStatus)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const collectYeetStatus = Effect.fn("YeetStatus.collectYeetStatus")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<
  YeetStatusSnapshot,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const verdictPath = yield* runArtifactPathForContext(context, "verdict.json");
  const closeoutPath = yield* runArtifactPathForContext(context, "pr-closeout.json");
  const statusPath = yield* statusPathForContext(context);
  const [worktree, verdict, closeout, remoteStatus, gateVerdicts, createdAt] = yield* Effect.all(
    [
      collectWorktreeStatus(context),
      readVerdictArtifact(verdictPath),
      readCloseoutArtifact(closeoutPath),
      collectRemoteStatus(context, remote),
      collectYeetGateStaleness(context).pipe(Effect.orElseSucceed(A.empty<GateStalenessVerdict>)),
      DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    ],
    { concurrency: "unbounded" }
  );
  return YeetStatusSnapshot.make({
    base: context.base,
    branch: context.branch,
    closeout,
    createdAt,
    head: context.head,
    nextCommand: nextCommandForStatus(worktree, verdict, closeout, remoteStatus),
    remote: remoteStatus,
    runId: runIdForContext(context),
    schemaVersion: "yeet-status/v1",
    statusPath,
    verdict,
    worktree,
    mergeReady: deriveYeetMergeReady(closeout, remoteStatus),
    staleGates: staleGateVerdicts(gateVerdicts),
    unprovenGates: unprovenGateVerdicts(gateVerdicts),
  });
});

const renderWorktreeLine = (worktree: YeetStatusWorktree): string =>
  `${worktree.clean ? "clean" : "dirty"} (${worktree.staged} staged, ${worktree.unstaged} unstaged, ${worktree.untracked} untracked)`;

const optionalCount = (value: number | undefined): number =>
  pipe(
    O.fromUndefinedOr(value),
    O.getOrElse(() => 0)
  );

const renderCheckLine = (remote: YeetStatusRemote): string => {
  if (!remote.checked) return "checks: not checked";
  if (remote.requiredCheckCount !== undefined) {
    return `checks: ${remote.requiredCheckCount} required (${optionalCount(remote.failingRequiredCheckCount)} failing, ${optionalCount(remote.pendingRequiredCheckCount)} pending); ${optionalCount(remote.optionalCheckCount)} optional (${optionalCount(remote.failingOptionalCheckCount)} failing, ${optionalCount(remote.pendingOptionalCheckCount)} pending)`;
  }
  if (remote.checkCount !== undefined) {
    return `checks: ${remote.checkCount} total, ${optionalCount(remote.failingCheckCount)} failing, ${optionalCount(remote.pendingCheckCount)} pending (legacy unsplit snapshot)`;
  }
  return "checks: not checked";
};

const renderThreadTriageLine = (thread: YeetStatusReviewThread): string => {
  const location = pipe(
    thread.path,
    O.map((path) => ` ${path}${O.match(thread.line, { onNone: () => Str.empty, onSome: (line) => `:${line}` })}`),
    O.getOrElse(() => Str.empty)
  );
  const commentId = O.match(thread.commentDatabaseId, {
    onNone: () => Str.empty,
    onSome: (id) => ` comment ${id}`,
  });
  return `  - ${thread.threadId}${commentId}${location} @${thread.author}: ${thread.excerpt}`;
};

// A resolved-thread section prints only when it has threads: a snapshot taken
// before the state existed carries None, and a pull request with none carries
// an empty list, and neither should print a heading claiming zero.
const renderThreadSection = (
  threads: O.Option<ReadonlyArray<YeetStatusReviewThread>>,
  header: (count: number) => string
): ReadonlyArray<string> =>
  pipe(
    threads,
    O.filter(A.isReadonlyArrayNonEmpty),
    O.match({
      onNone: A.empty<string>,
      onSome: (present) => [header(A.length(present)), ...A.map(present, renderThreadTriageLine)],
    })
  );

/**
 * Render the unresolved-thread block of a status summary.
 *
 * **Details**
 *
 * When triage context is available each thread gets its own line carrying the
 * GraphQL thread id, the REST comment `databaseId`, the location, the author,
 * and a plain first-line excerpt — the exact columns a reply drafts file needs.
 * Snapshots written before that context existed fall back to the original
 * inline id list rather than losing the count.
 *
 * **Example** (Render an unchecked remote)
 *
 * ```ts
 * import { renderYeetReviewThreadBlock, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetReviewThreadBlock(
 *   YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
 * ))
 * ```
 *
 * @param remote - Live pull request summary, checked or not.
 * @returns The `review threads:` line plus one indented line per thread.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetReviewThreadBlock = (remote: YeetStatusRemote): string => {
  if (!remote.checked || !remote.available) {
    return "review threads: not checked";
  }
  const header = `review threads: ${remote.unresolvedReviewThreadCount ?? 0} unresolved`;
  const unresolvedBlock = pipe(
    remote.unresolvedThreads,
    O.filter(A.isReadonlyArrayNonEmpty),
    O.match({
      onNone: () => {
        const threads = remote.unresolvedReviewThreads ?? A.empty<string>();
        return A.isReadonlyArrayNonEmpty(threads) ? `${header} -> ${A.join(threads, ", ")}` : header;
      },
      onSome: (threads) => A.join([header, ...A.map(threads, renderThreadTriageLine)], "\n"),
    })
  );
  return A.join(
    [
      unresolvedBlock,
      ...renderThreadSection(
        remote.followUpThreads,
        (count) =>
          `review follow-ups: ${count} resolved thread(s) where a reviewer spoke last; read and answer them (yeet reply posts on them)`
      ),
      ...renderThreadSection(
        remote.acknowledgedThreads,
        (count) => `review acknowledgements: ${count} resolved thread(s) a review bot confirmed; advisory, nothing owed`
      ),
    ],
    "\n"
  );
};

const renderMergeReadyDetail = (mergeReady: YeetMergeReady): string => {
  const greptile = O.match(mergeReady.criteria.greptileScore, {
    onNone: () => Str.empty,
    onSome: (score) => ` (greptile ${score})`,
  });
  return O.match(mergeReady.failing, {
    onNone: () => `merge-ready: yes${greptile}`,
    onSome: (failing) => `merge-ready: no, blocked on ${failing}${greptile}`,
  });
};

const renderMergeReadyLine = (snapshot: YeetStatusSnapshot): string =>
  pipe(
    snapshot.mergeReady,
    O.match({
      onNone: () => "merge-ready: not checked",
      onSome: renderMergeReadyDetail,
    })
  );

/**
 * Render a concise human-readable Yeet status block.
 *
 * **Example** (Render a yeet status summary)
 *
 * ```ts
 * import { renderYeetStatusSummary, YeetStatusSnapshot, YeetStatusWorktree, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const text = renderYeetStatusSummary(YeetStatusSnapshot.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   closeout: YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" }),
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   head: "HEAD",
 *   nextCommand: "bun run beep yeet verify",
 *   remote: YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" }),
 *   runId: "feature",
 *   schemaVersion: "yeet-status/v1",
 *   statusPath: ".beep/yeet/runs/feature/status.json",
 *   verdict: YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
 *   worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
 * }))
 * console.log(text) // example value
 * ```
 *
 * @param snapshot - Yeet status snapshot to render.
 * @returns A compact text block for operator-facing status output.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetStatusSummary = (snapshot: YeetStatusSnapshot): string =>
  pipe(
    [
      "yeet status",
      `- branch: ${snapshot.branch}`,
      `- base/head: ${snapshot.base}...${snapshot.head}`,
      `- worktree: ${renderWorktreeLine(snapshot.worktree)}`,
      `- verdict: ${snapshot.verdict.detail}`,
      `- ${renderYeetLaneDigestBlock(snapshot.verdict)}`,
      `- closeout: ${snapshot.closeout.detail}`,
      `- remote: ${snapshot.remote.checked ? snapshot.remote.detail : "remote not checked"}`,
      `- ${renderCheckLine(snapshot.remote)}`,
      `- ${renderYeetReviewThreadBlock(snapshot.remote)}`,
      `- ${renderMergeReadyLine(snapshot)}`,
      `- ${renderYeetGateStalenessBlock(snapshot.staleGates, snapshot.unprovenGates)}`,
      `- rerun-failed: ${snapshot.remote.rerunFailedDecision ?? "not checked"}`,
      `- status artifact: ${snapshot.statusPath}`,
      `- next: ${snapshot.nextCommand}`,
    ],
    A.join("\n")
  );

/**
 * Write a Yeet status snapshot to its status artifact path.
 *
 * **Example** (Reference the snapshot writer)
 *
 * ```ts
 * import { writeYeetStatusSnapshot } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(writeYeetStatusSnapshot)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const writeYeetStatusSnapshot = Effect.fn("YeetStatus.writeYeetStatusSnapshot")(function* (
  snapshot: YeetStatusSnapshot
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const json = yield* YeetStatusSnapshotJson.encode(snapshot).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode yeet status JSON."))
  );
  yield* fs
    .makeDirectory(path.dirname(snapshot.statusPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create yeet status directory for ${snapshot.statusPath}.`)));
  yield* fs
    .writeFileString(snapshot.statusPath, `${json}\n`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write yeet status artifact ${snapshot.statusPath}.`)));
});

/**
 * Expose the status artifact path helper to focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const yeetStatusPathForTesting = statusPathForContext;

/**
 * Project a decoded verdict into the status artifact, exposed for tests.
 *
 * **Example** (Carry a lane digest into the artifact)
 *
 * ```ts
 * import { yeetStatusArtifactFromVerdictForTesting, YeetVerdict, YeetVerdictLane } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const lane = YeetVerdictLane.make({ id: "quality:knip", label: "quality:knip", phase: "full", status: "passed", inputDigest: O.some("abc") })
 * const verdict = YeetVerdict.make({
 *   schemaVersion: "yeet-verdict/v2",
 *   base: "origin/main",
 *   branch: "feat/x",
 *   committed: true,
 *   createdAt: "2026-09-12T00:00:00.000Z",
 *   head: "HEAD",
 *   lanes: [lane],
 *   message: "ok",
 *   mode: "publish",
 *   outcome: "success",
 *   packetPaths: [],
 *   pushed: true,
 *   runId: "feat_x",
 * })
 * console.log(yeetStatusArtifactFromVerdictForTesting("verdict.json", verdict).laneDigests?.length) // 1
 * ```
 *
 * @param path - The verdict artifact path recorded on the artifact.
 * @param verdict - The decoded verdict.
 * @returns The status artifact with its lane digests and first repair command.
 * @category testing
 * @since 0.0.0
 */
export const yeetStatusArtifactFromVerdictForTesting: {
  (verdict: YeetVerdict): (path: string) => YeetStatusArtifact;
  (path: string, verdict: YeetVerdict): YeetStatusArtifact;
} = dual(2, artifactFromVerdict);

/**
 * Expose next-command selection to focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const yeetStatusNextCommandForTesting: {
  (
    verdict: YeetStatusArtifact,
    closeout: YeetStatusArtifact,
    remote: YeetStatusRemote
  ): (worktree: YeetStatusWorktree) => string;
  (
    worktree: YeetStatusWorktree,
    verdict: YeetStatusArtifact,
    closeout: YeetStatusArtifact,
    remote: YeetStatusRemote
  ): string;
} = dual(4, nextCommandForStatus);
