/**
 * Reply engine: validate drafted review-thread replies against live GitHub
 * state, post them, resolve the threads, and record what happened.
 *
 * The drafts artifact ({@link ReplyDrafts}) is written by whoever verified the
 * review findings; this module is the half that touches GitHub, and it is
 * designed so *either party* can run it. An agent whose session denies the
 * write scope produces the same validated plan and the same report — every
 * draft it could not write lands as a `failed` outcome carrying the exact
 * command the operator re-runs. A permission wall is data in the report, never
 * a thrown crash that loses the other drafts' results, and that holds whether
 * the wall arrives on the reply mutation or on the read that precedes it.
 *
 * **Details**
 *
 * Drafts name a thread either way GitHub exposes one: the GraphQL thread id
 * (`PRRT_…`) that `yeet status` prints, or the numeric REST comment id in a
 * review-comment URL (`…#discussion_r<id>`). Mapping the second to the first is
 * what forced the hand-mapping pass this engine exists to remove, so one
 * `reviewThreads` query per pull request fetches every thread with its
 * comments' `databaseId`, and {@link findReplyThread} resolves either handle
 * against that one snapshot — no per-draft REST round trip.
 *
 * Classification is pure ({@link planReplyActions}) and separated from
 * execution: a thread that is already resolved settles as `stale` without a
 * write, an id that matches no live thread settles as `failed` with a detail
 * naming both handles, and only surviving drafts become
 * {@link ReplyPostAction}s. That split is what makes the interesting behaviour
 * testable without a network.
 *
 * **Gotchas**
 *
 * An `isOutdated` thread is deliberately *not* stale. Outdated only means the
 * diff moved under the comment; the thread is still open and still counts
 * against the "threads resolved" merge criterion, so skipping it would leave
 * the merge blocked — the opposite of this engine's purpose.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Effect, FileSystem, flow, HashSet, Match, Path, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  collectTruncatableThreadPages,
  GhPageInfo,
  ghGraphqlPage,
  ghOutput,
  nextCursor,
} from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { artifactDirForContext } from "./ArtifactPaths.ts";
import { decodeGhRepoView } from "./closeout/Gh.schemas.ts";
import { REPLY_THREAD_MUTATION, RESOLVE_THREAD_MUTATION } from "./closeout/WritePlan.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import { ReplyDraft, ReplyDraftOutcome, ReplyDraftsJson, ReplyReport, ReplyReportJson } from "./Reply.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GhCommandFailure } from "../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { GhRepoView } from "./closeout/Gh.schemas.ts";
import type { ReplyDrafts, ReplyOutcomeStatus } from "./Reply.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Reply");

const REPLY_FAILURE_DETAIL_MAX_CHARS = 240;

/**
 * File name of the reply drafts artifact inside the Yeet packet directory.
 *
 * **Example** (Name the drafts artifact)
 *
 * ```ts
 * import { REPLY_DRAFTS_FILE_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(`.beep/yeet/${REPLY_DRAFTS_FILE_NAME}`)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPLY_DRAFTS_FILE_NAME = "reply-drafts.json";

/**
 * File name of the reply report artifact inside the Yeet packet directory.
 *
 * **Example** (Name the report artifact)
 *
 * ```ts
 * import { REPLY_REPORT_FILE_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(`.beep/yeet/${REPLY_REPORT_FILE_NAME}`)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPLY_REPORT_FILE_NAME = "reply-report.json";

/**
 * Command that re-runs the whole reply pass.
 *
 * **Details**
 *
 * Quoted in `failed` details for drafts where nothing was written, because the
 * drafts file is untouched by a failed run: re-running it is the retry. It is
 * deliberately *not* quoted when a reply posted and only the resolve failed —
 * re-running would post the body a second time.
 *
 * **Example** (Print the retry command)
 *
 * ```ts
 * import { REPLY_RERUN_COMMAND } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(REPLY_RERUN_COMMAND)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPLY_RERUN_COMMAND = "bun run beep yeet reply";

/**
 * GraphQL query paginating a pull request's review threads with the numeric
 * `databaseId` of every thread comment.
 *
 * **Details**
 *
 * `databaseId` is the REST comment id, and it is the only field that joins the
 * two id surfaces a draft may use. Requesting it here is what lets one query
 * per pull request serve both validation and comment-id resolution.
 *
 * **Example** (Confirm the join field is requested)
 *
 * ```ts
 * import { replyReviewThreadsPageQuery } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(replyReviewThreadsPageQuery.includes("databaseId")) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const replyReviewThreadsPageQuery = `
query YeetReplyReviewThreads($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { id databaseId }
          }
        }
      }
    }
  }
}
`;

/**
 * One comment inside a live review thread, carrying both id surfaces.
 *
 * **Example** (Describe a thread comment)
 *
 * ```ts
 * import { ReplyThreadComment } from "@beep/repo-cli/test/Yeet"
 *
 * const comment = ReplyThreadComment.make({ databaseId: 2284119001, id: "PRRC_kwDOA" })
 * console.log(comment.databaseId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyThreadComment extends S.Class<ReplyThreadComment>($I`ReplyThreadComment`)(
  {
    databaseId: S.NullOr(S.Finite),
    id: S.String,
  },
  $I.annote("ReplyThreadComment", {
    description: "Review thread comment carrying the GraphQL node id and the numeric REST database id.",
  })
) {}

/**
 * Paginated comments nested under a live review thread.
 *
 * **Example** (Describe an empty comment page)
 *
 * ```ts
 * import { ReplyThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const connection = ReplyThreadCommentConnection.make({
 *   nodes: [],
 *   pageInfo: { endCursor: null, hasNextPage: false },
 * })
 * console.log(connection.nodes.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyThreadCommentConnection extends S.Class<ReplyThreadCommentConnection>(
  $I`ReplyThreadCommentConnection`
)(
  {
    nodes: S.Array(ReplyThreadComment),
    pageInfo: GhPageInfo,
  },
  $I.annote("ReplyThreadCommentConnection", {
    description: "Comment connection nested under a live pull request review thread.",
  })
) {}

/**
 * A live pull request review thread as the reply engine sees it.
 *
 * **Details**
 *
 * `id` stays a plain string rather than `ReplyThreadId`: it is GitHub's own
 * value, not human-typed draft input, so re-validating its prefix would only
 * add a construction-time throw on a payload the engine cannot influence. The
 * `PRRT_` check belongs on the drafts side, where a paste error is real.
 *
 * **Example** (Describe an unresolved thread)
 *
 * ```ts
 * import { ReplyLiveThread, ReplyThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 *
 * const thread = ReplyLiveThread.make({
 *   comments: ReplyThreadCommentConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false },
 *   }),
 *   id: "PRRT_kwDOA",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 42,
 *   path: "src/file.ts",
 * })
 * console.log(thread.isResolved)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyLiveThread extends S.Class<ReplyLiveThread>($I`ReplyLiveThread`)(
  {
    comments: ReplyThreadCommentConnection,
    id: S.String,
    isOutdated: S.Boolean,
    isResolved: S.Boolean,
    line: S.NullOr(S.Finite),
    path: S.NullOr(S.String),
  },
  $I.annote("ReplyLiveThread", {
    description: "Live pull request review thread inspected before a drafted reply is written.",
  })
) {}

const ReplyLiveThreadConnection = S.Struct({
  nodes: S.Array(ReplyLiveThread),
  pageInfo: GhPageInfo,
});

const ReplyReviewThreadsDocument = S.Struct({
  data: S.Struct({
    repository: S.Struct({
      pullRequest: S.Struct({
        reviewThreads: ReplyLiveThreadConnection,
      }),
    }),
  }),
});

const decodeReplyReviewThreadsDocument = S.decodeUnknownEffect(S.fromJsonString(ReplyReviewThreadsDocument));

/**
 * A drafted reply that survived validation and is ready to write.
 *
 * **Example** (Describe a ready reply)
 *
 * ```ts
 * import { ReplyDraft, ReplyPostAction } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const action = ReplyPostAction.make({
 *   draft: ReplyDraft.make({ threadId: O.some("PRRT_kwDOA"), body: "Fixed in 0123456." }),
 *   threadId: "PRRT_kwDOA",
 * })
 * console.log(action.threadId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplyPostAction extends S.TaggedClass<ReplyPostAction>($I`ReplyPostAction`)(
  "post",
  {
    draft: ReplyDraft,
    threadId: S.NonEmptyString,
  },
  $I.annote("ReplyPostAction", {
    description: "Drafted reply resolved to a live, unresolved review thread and ready to write.",
  })
) {}

/**
 * A drafted reply decided without touching GitHub.
 *
 * **Example** (Describe a stale draft)
 *
 * ```ts
 * import { ReplyDraftOutcome, ReplySettledAction } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const action = ReplySettledAction.make({
 *   outcome: ReplyDraftOutcome.make({
 *     threadId: O.some("PRRT_kwDOA"),
 *     status: "stale",
 *     detail: "thread was already resolved upstream",
 *   }),
 * })
 * console.log(action.outcome.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplySettledAction extends S.TaggedClass<ReplySettledAction>($I`ReplySettledAction`)(
  "settled",
  {
    outcome: ReplyDraftOutcome,
  },
  $I.annote("ReplySettledAction", {
    description: "Drafted reply whose outcome was decided during validation, before any write.",
  })
) {}

/**
 * What the reply run will do about one drafted reply.
 *
 * **Example** (Decode a settled action)
 *
 * ```ts
 * import { ReplyAction } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ReplyAction)({
 *   _tag: "settled",
 *   outcome: { threadId: "PRRT_kwDOA", status: "stale", detail: "already resolved" },
 * })
 * console.log(decoded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReplyAction = S.Union([ReplyPostAction, ReplySettledAction]).pipe(
  $I.annoteSchema("ReplyAction", {
    description: "Write or settled decision taken for one drafted review-thread reply.",
  })
);

/**
 * What the reply run will do about one drafted reply.
 *
 * @see {@link ReplyAction} for the runtime schema and its variants.
 * @category models
 * @since 0.0.0
 */
export type ReplyAction = typeof ReplyAction.Type;

const compactWhitespace: (value: string) => string = flow(Str.replace(/\s+/gu, " "), Str.trim);

const excerpt = (value: string): string => {
  const normalized = compactWhitespace(value);
  return Str.length(normalized) <= REPLY_FAILURE_DETAIL_MAX_CHARS
    ? normalized
    : `${pipe(normalized, Str.takeLeft(REPLY_FAILURE_DETAIL_MAX_CHARS))}…`;
};

const threadLocation = (thread: ReplyLiveThread): string =>
  pipe(
    O.fromNullishOr(thread.path),
    O.map((path) =>
      pipe(
        O.fromNullishOr(thread.line),
        O.match({
          onNone: () => path,
          onSome: (line) => `${path}:${line}`,
        })
      )
    ),
    O.getOrElse(() => "unknown file")
  );

const draftTargetLabel = (draft: ReplyDraft): string =>
  pipe(
    [
      ...pipe(
        draft.threadId,
        O.map((threadId) => `thread id ${threadId}`),
        O.toArray
      ),
      ...pipe(
        draft.commentId,
        O.map((commentId) => `comment id ${commentId}`),
        O.toArray
      ),
    ],
    A.join(" / ")
  );

const settledAction = (
  draft: ReplyDraft,
  threadId: O.Option<string>,
  status: ReplyOutcomeStatus,
  detail: string
): ReplySettledAction =>
  ReplySettledAction.make({
    outcome: ReplyDraftOutcome.make({
      commentId: draft.commentId,
      detail,
      status,
      threadId: O.orElse(threadId, () => draft.threadId),
    }),
  });

/**
 * Resolve one draft against a snapshot of live review threads, by GraphQL
 * thread id first and by numeric REST comment id second.
 *
 * **Details**
 *
 * The comment-id path is the mapping this engine owns: GitHub exposes the REST
 * comment id as `databaseId` on the thread's comments, so a draft written
 * straight off a review-comment URL resolves without the caller ever seeing a
 * `PRRT_` id. A draft carrying both handles prefers the thread id and falls
 * back to the comment id, so one stale handle does not sink a locatable draft.
 *
 * **Example** (Resolve a draft by its REST comment id)
 *
 * ```ts
 * import { findReplyThread, ReplyDraft, ReplyLiveThread, ReplyThreadComment, ReplyThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const thread = ReplyLiveThread.make({
 *   comments: ReplyThreadCommentConnection.make({
 *     nodes: [ReplyThreadComment.make({ databaseId: 2284119001, id: "PRRC_kwDOA" })],
 *     pageInfo: { endCursor: null, hasNextPage: false },
 *   }),
 *   id: "PRRT_kwDOA",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 42,
 *   path: "src/file.ts",
 * })
 * const draft = ReplyDraft.make({ commentId: O.some(2284119001), body: "Fixed." })
 * console.log(O.map(findReplyThread([thread], draft), (found) => found.id))
 * ```
 *
 * @param threads - Live review threads collected for the pull request.
 * @param draft - Drafted reply naming a thread id, a comment id, or both.
 * @returns The matching live thread, or `None` when no thread carries either handle.
 * @category utilities
 * @since 0.0.0
 */
export const findReplyThread: {
  (draft: ReplyDraft): (threads: ReadonlyArray<ReplyLiveThread>) => O.Option<ReplyLiveThread>;
  (threads: ReadonlyArray<ReplyLiveThread>, draft: ReplyDraft): O.Option<ReplyLiveThread>;
} = dual(
  2,
  (threads: ReadonlyArray<ReplyLiveThread>, draft: ReplyDraft): O.Option<ReplyLiveThread> =>
    pipe(
      draft.threadId,
      O.flatMap((threadId) => A.findFirst(threads, (thread) => thread.id === threadId)),
      O.orElse(() =>
        pipe(
          draft.commentId,
          O.flatMap((commentId) =>
            A.findFirst(threads, (thread) =>
              A.some(thread.comments.nodes, (comment) => comment.databaseId === commentId)
            )
          )
        )
      )
    )
);

const classifyReplyDraft = (
  prNumber: number,
  threads: ReadonlyArray<ReplyLiveThread>,
  claimedThreadIds: HashSet.HashSet<string>,
  draft: ReplyDraft
): ReplyAction =>
  pipe(
    findReplyThread(threads, draft),
    O.match({
      onNone: () =>
        settledAction(
          draft,
          O.none(),
          "failed",
          `no live review thread on pull request #${prNumber} matches ${draftTargetLabel(draft)}; thread ids come from "yeet status" and comment ids from the review comment URL (#discussion_r<id>)`
        ),
      onSome: (thread) => {
        if (HashSet.has(claimedThreadIds, thread.id)) {
          return settledAction(
            draft,
            O.some(thread.id),
            "failed",
            `review thread ${thread.id} (${threadLocation(thread)}) is already targeted by an earlier draft in this file; merge the two bodies into one draft`
          );
        }
        if (thread.isResolved) {
          return settledAction(
            draft,
            O.some(thread.id),
            "stale",
            `review thread ${thread.id} (${threadLocation(thread)}) is already resolved upstream; nothing was posted`
          );
        }
        return ReplyPostAction.make({ draft, threadId: thread.id });
      },
    })
  );

/**
 * Classify every drafted reply against a snapshot of live review threads.
 *
 * **Details**
 *
 * Pure and total: each draft yields exactly one action in file order, so the
 * report always accounts for every line the human wrote. A thread already
 * resolved upstream settles as `stale`, an unmatched handle settles as
 * `failed`, and a thread already claimed by an earlier draft in the same file
 * settles as `failed` too — posting twice to one thread is the failure mode a
 * hand-written drafts file actually produces, and a single live snapshot
 * cannot see the first write.
 *
 * **Example** (Plan a drafts file against one open thread)
 *
 * ```ts
 * import { planReplyActions, ReplyDraft, ReplyDrafts, ReplyLiveThread, ReplyThreadCommentConnection } from "@beep/repo-cli/test/Yeet"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const thread = ReplyLiveThread.make({
 *   comments: ReplyThreadCommentConnection.make({
 *     nodes: [],
 *     pageInfo: { endCursor: null, hasNextPage: false },
 *   }),
 *   id: "PRRT_kwDOA",
 *   isOutdated: false,
 *   isResolved: false,
 *   line: 42,
 *   path: "src/file.ts",
 * })
 * const drafts = ReplyDrafts.make({
 *   schemaVersion: "yeet-reply-drafts/v1",
 *   prNumber: 558,
 *   drafts: [ReplyDraft.make({ threadId: O.some("PRRT_kwDOA"), body: "Fixed." })],
 * })
 * console.log(A.map(planReplyActions(drafts, [thread]), (action) => action._tag))
 * ```
 *
 * @param drafts - Decoded drafts artifact for one pull request.
 * @param threads - Live review threads collected for that pull request.
 * @returns One action per draft, in drafts-file order.
 * @category utilities
 * @since 0.0.0
 */
export const planReplyActions: {
  (threads: ReadonlyArray<ReplyLiveThread>): (drafts: ReplyDrafts) => ReadonlyArray<ReplyAction>;
  (drafts: ReplyDrafts, threads: ReadonlyArray<ReplyLiveThread>): ReadonlyArray<ReplyAction>;
} = dual(
  2,
  (drafts: ReplyDrafts, threads: ReadonlyArray<ReplyLiveThread>): ReadonlyArray<ReplyAction> =>
    A.reduce(drafts.drafts, { actions: A.empty<ReplyAction>(), claimed: HashSet.empty<string>() }, (state, draft) => {
      const action = classifyReplyDraft(drafts.prNumber, threads, state.claimed, draft);
      return {
        actions: [...state.actions, action],
        claimed: action._tag === "post" ? HashSet.add(state.claimed, action.threadId) : state.claimed,
      };
    }).actions
);

/**
 * The single `gh` command that resolves one review thread.
 *
 * **Details**
 *
 * Quoted in the report whenever a reply posted but resolving it did not — the
 * body is already on GitHub, so the retry must be resolve-only. Being
 * body-free it stays a one-line copy-paste for whoever holds the write scope.
 *
 * **Example** (Render the resolve retry)
 *
 * ```ts
 * import { replyResolveRetryCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(replyResolveRetryCommand("PRRT_kwDOA").includes("resolveReviewThread")) // true
 * ```
 *
 * @param threadId - GraphQL id of the thread left open.
 * @returns A copy-pasteable `gh api graphql` resolve command.
 * @category utilities
 * @since 0.0.0
 */
export const replyResolveRetryCommand = (threadId: string): string =>
  `gh api graphql -f 'query=${RESOLVE_THREAD_MUTATION}' -f threadId=${threadId}`;

const replyGhFailure = (failure: GhCommandFailure): YeetCommandError =>
  Match.value(failure).pipe(
    Match.tags({
      spawn: (spawnFailure) =>
        YeetCommandError.make({
          cause: spawnFailure.cause,
          command: spawnFailure.command,
          exitCode: 1,
          message: `${spawnFailure.label} could not be started; check that the GitHub CLI is installed and authenticated.`,
        }),
      "nonzero-exit": (exitFailure) =>
        YeetCommandError.make({
          command: exitFailure.command,
          exitCode: exitFailure.exitCode,
          message: `${exitFailure.label} failed with exit code ${exitFailure.exitCode}: ${excerpt(exitFailure.output)}`,
        }),
      truncated: (truncatedFailure) =>
        YeetCommandError.make({
          command: truncatedFailure.command,
          exitCode: 1,
          message: `${truncatedFailure.label} output exceeded the repo-run capture limit.`,
        }),
    }),
    Match.exhaustive
  );

const replyGhOutput = (
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  label: string
): Effect.Effect<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> =>
  ghOutput({ args, cwd: context.repoRoot, label, onFailure: replyGhFailure });

/**
 * Resolve the reply drafts artifact path for a repo run context.
 *
 * **Example** (Locate the drafts artifact)
 *
 * ```ts
 * import { replyDraftsPathForContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(replyDraftsPathForContext))) // true
 * ```
 *
 * @param context - Repo run context carrying the Yeet packet directory.
 * @returns Absolute path to `reply-drafts.json`.
 * @category utilities
 * @since 0.0.0
 */
export const replyDraftsPathForContext = Effect.fn("Yeet.replyDraftsPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, REPLY_DRAFTS_FILE_NAME);
});

/**
 * Resolve the reply report artifact path for a repo run context.
 *
 * **Example** (Locate the report artifact)
 *
 * ```ts
 * import { replyReportPathForContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(replyReportPathForContext))) // true
 * ```
 *
 * @param context - Repo run context carrying the Yeet packet directory.
 * @returns Absolute path to `reply-report.json`.
 * @category utilities
 * @since 0.0.0
 */
export const replyReportPathForContext = Effect.fn("Yeet.replyReportPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, REPLY_REPORT_FILE_NAME);
});

/**
 * Load and decode the reply drafts artifact.
 *
 * **Details**
 *
 * A missing file and a malformed file are different operator mistakes, so they
 * fail with different messages; both name the absolute path, since the party
 * running the command is often not the party that wrote the drafts.
 *
 * **Example** (Build the drafts loader effect)
 *
 * ```ts
 * import { loadReplyDrafts, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/merge-loop",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * console.log(Effect.isEffect(loadReplyDrafts(context))) // true
 * ```
 *
 * @param context - Repo run context carrying the Yeet packet directory.
 * @returns The decoded drafts artifact.
 * @category queries
 * @since 0.0.0
 */
export const loadReplyDrafts = Effect.fn("Yeet.loadReplyDrafts")(function* (
  context: RepoRunContext
): Effect.fn.Return<ReplyDrafts, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const draftsPath = yield* replyDraftsPathForContext(context);
  const exists = yield* fs.exists(draftsPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return yield* YeetCommandError.make({
      file: draftsPath,
      message: `No reply drafts at "${draftsPath}". Write one drafts file with schemaVersion "yeet-reply-drafts/v1", the pull request number, and a body per review thread.`,
    });
  }
  const text = yield* fs
    .readFileString(draftsPath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read "${draftsPath}".`, { file: draftsPath })));
  return yield* ReplyDraftsJson.decode(text).pipe(
    Effect.mapError(
      YeetCommandError.new(
        `Failed to decode "${draftsPath}"; every draft needs a non-empty body and either a PRRT_ thread id or a numeric comment id.`,
        { file: draftsPath }
      )
    )
  );
});

const collectReplyThreads = (
  context: RepoRunContext,
  repo: GhRepoView,
  prNumber: number
): Effect.Effect<ReadonlyArray<ReplyLiveThread>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> =>
  collectTruncatableThreadPages({
    advance: (pageInfo) =>
      nextCursor({
        label: "pull request review threads",
        onMissingCursor: (missingLabel) =>
          YeetCommandError.make({
            command: "gh api graphql",
            exitCode: 1,
            message: `${missingLabel} reported another GraphQL page without an end cursor.`,
          }),
        pageInfo,
      }),
    fetchPage: (cursor) =>
      ghGraphqlPage({
        cursor,
        cwd: context.repoRoot,
        label: "gh api graphql reply review threads",
        name: repo.name,
        number: prNumber,
        onFailure: replyGhFailure,
        owner: repo.owner.login,
        query: replyReviewThreadsPageQuery,
      }).pipe(
        Effect.flatMap((output) =>
          decodeReplyReviewThreadsDocument(output).pipe(
            // fallow-ignore-next-line code-duplication -- reply and closeout configure the shared internal/github thread-page collector with isomorphic decode pipelines over distinct schemas; the loop itself is extracted
            Effect.mapError(YeetCommandError.new("Failed to decode the reply review threads GraphQL JSON."))
          )
        ),
        Effect.map((document) => document.data.repository.pullRequest.reviewThreads)
      ),
    truncationWarning: (threadIds) =>
      `Review thread(s) ${A.join(threadIds, ", ")} have more than 100 comments; yeet reply reads only the first 100 per thread, so a comment id beyond that page will not resolve. Target those threads by PRRT_ thread id.`,
  });

const performReplyPost = Effect.fnUntraced(function* (
  context: RepoRunContext,
  action: ReplyPostAction
): Effect.fn.Return<ReplyDraftOutcome, never, ChildProcessSpawner.ChildProcessSpawner> {
  const target = { commentId: action.draft.commentId, threadId: O.some(action.threadId) };
  const posted = yield* Effect.result(
    replyGhOutput(
      context,
      [
        "api",
        "graphql",
        "-f",
        `query=${REPLY_THREAD_MUTATION}`,
        "-f",
        `threadId=${action.threadId}`,
        "-f",
        `body=${action.draft.body}`,
      ],
      "gh api graphql (reply)"
    )
  );
  if (Result.isFailure(posted)) {
    return ReplyDraftOutcome.make({
      ...target,
      detail: `${posted.failure.message} Nothing was posted; retry with: ${REPLY_RERUN_COMMAND}`,
      status: "failed",
    });
  }
  if (!action.draft.resolve) {
    return ReplyDraftOutcome.make({
      ...target,
      detail: "reply posted; the draft opted out of resolving the thread",
      status: "posted",
    });
  }
  const resolved = yield* Effect.result(
    replyGhOutput(
      context,
      ["api", "graphql", "-f", `query=${RESOLVE_THREAD_MUTATION}`, "-f", `threadId=${action.threadId}`],
      "gh api graphql (resolve)"
    )
  );
  if (Result.isFailure(resolved)) {
    return ReplyDraftOutcome.make({
      ...target,
      detail: `reply posted, but resolving the thread failed: ${resolved.failure.message} Do not re-run "${REPLY_RERUN_COMMAND}" — it would post the body again; resolve with: ${replyResolveRetryCommand(action.threadId)}`,
      status: "failed",
    });
  }
  return ReplyDraftOutcome.make({
    ...target,
    detail: "reply posted and thread resolved",
    status: "resolved",
  });
});

const executeReplyAction = (
  context: RepoRunContext,
  action: ReplyAction
): Effect.Effect<ReplyDraftOutcome, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Match.value(action).pipe(
    Match.tags({
      post: (post) => performReplyPost(context, post),
      settled: (settled) => Effect.succeed(settled.outcome),
    }),
    Match.exhaustive
  );

const countStatus = (outcomes: ReadonlyArray<ReplyDraftOutcome>, status: ReplyOutcomeStatus): number =>
  A.length(A.filter(outcomes, (outcome) => outcome.status === status));

const replyPreflight = Effect.fn("Yeet.replyPreflight")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<ReadonlyArray<ReplyLiveThread>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const repo = yield* replyGhOutput(context, ["repo", "view", "--json", "owner,name"], "gh repo view").pipe(
    Effect.flatMap((output) =>
      decodeGhRepoView(output).pipe(Effect.mapError(YeetCommandError.new("Failed to decode gh repo view JSON.")))
    )
  );
  return yield* collectReplyThreads(context, repo, prNumber);
});

/**
 * Settle every loaded draft against a preflight failure, so a wall hit before
 * the first write is reported exactly like a wall hit during one.
 *
 * @param drafts - The loaded drafts artifact whose drafts get failure outcomes.
 * @param failure - The preflight failure carried into every outcome's detail.
 * @returns One `failed` outcome per draft, each naming the whole-run retry.
 */
const preflightFailureOutcomes = (drafts: ReplyDrafts, failure: YeetCommandError): ReadonlyArray<ReplyDraftOutcome> =>
  A.map(drafts.drafts, (draft) =>
    ReplyDraftOutcome.make({
      commentId: draft.commentId,
      detail: `${failure.message} Nothing was posted for any draft; retry the whole run with: ${REPLY_RERUN_COMMAND}`,
      status: "failed",
      threadId: draft.threadId,
    })
  );

/**
 * Run one reply pass: load the drafts, validate them against live review
 * threads, write the survivors, and record every outcome.
 *
 * **Details**
 *
 * The pull request number comes from the drafts artifact rather than the
 * checked-out branch, so the operator can execute an agent's drafts from any
 * worktree. Writes run one at a time and never fail the run: a denied scope,
 * a deleted thread, or a rate limit becomes that draft's `failed` outcome with
 * the retry command, and the remaining drafts still get their turn. The report
 * is written through {@link ReplyReportJson} so `Option` fields encode as
 * omitted keys rather than runtime objects.
 *
 * The preflight — `gh repo view` plus the paginated `reviewThreads` query — is
 * held to a stronger contract. A denied repo read, a denied thread page, or a
 * page that reports another page without a cursor settles *every* loaded draft
 * as `failed` carrying that failure's text and the whole-run retry command,
 * writes the report, and then fails the run. A drafts file is a batch of work
 * someone did; losing the whole batch to a thrown error with no artifact is the
 * failure mode this command exists to remove — but a pass that posted nothing
 * is not a success either. The report is the accounting; the exit code is the
 * verdict, so a `beep yeet reply && ...` chain never proceeds past a run that
 * wrote zero replies.
 *
 * **Gotchas**
 *
 * Per-draft failures exit 0 — the batch ran and the report is authoritative.
 * Only the preflight (nothing attempted) fails the run, and with no drafts
 * loaded it fails without a report: there is no outcome to attach the failure
 * to, so an exit-0 empty report would be a silent green.
 *
 * **Example** (Build the reply run effect)
 *
 * ```ts
 * import { RepoRunContext, runYeetReply } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/merge-loop",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * console.log(Effect.isEffect(runYeetReply(context))) // true
 * ```
 *
 * @param context - Repo run context carrying the repo root and packet directory.
 * @returns The written reply report.
 * @category commands
 * @since 0.0.0
 */
export const runYeetReply = Effect.fn("Yeet.runReply")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  ReplyReport,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const drafts = yield* loadReplyDrafts(context);
  const preflight = yield* Effect.result(replyPreflight(context, drafts.prNumber));
  if (Result.isFailure(preflight) && A.isReadonlyArrayEmpty(drafts.drafts)) {
    return yield* preflight.failure;
  }
  const outcomes = Result.isSuccess(preflight)
    ? yield* Effect.forEach(
        planReplyActions(drafts, preflight.success),
        (action) => executeReplyAction(context, action),
        { concurrency: 1 }
      )
    : preflightFailureOutcomes(drafts, preflight.failure);
  yield* Effect.forEach(
    outcomes,
    (outcome) =>
      Console.log(
        `[yeet] reply ${outcome.status} ${O.getOrElse(outcome.threadId, () => `comment ${O.getOrElse(O.map(outcome.commentId, String), () => "?")}`)}: ${outcome.detail}`
      ),
    { concurrency: 1 }
  );

  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const report = ReplyReport.make({
    createdAt,
    outcomes,
    prNumber: drafts.prNumber,
    schemaVersion: "yeet-reply-report/v1",
  });
  const reportPath = yield* replyReportPathForContext(context);
  const reportJson = yield* ReplyReportJson.encode(report).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode the yeet reply report artifact."))
  );
  yield* writeTextFile(reportPath, `${reportJson}\n`);
  yield* Console.log(
    `[yeet] reply report written to ${reportPath} (${countStatus(outcomes, "resolved")} resolved, ${countStatus(outcomes, "posted")} posted, ${countStatus(outcomes, "stale")} stale, ${countStatus(outcomes, "failed")} failed)`
  );
  if (Result.isFailure(preflight)) {
    return yield* YeetCommandError.make({
      cause: preflight.failure,
      exitCode: 1,
      file: reportPath,
      message: `yeet reply preflight failed before any draft could be posted; every draft is settled as failed in ${reportPath}. ${preflight.failure.message}`,
    });
  }

  return report;
});
