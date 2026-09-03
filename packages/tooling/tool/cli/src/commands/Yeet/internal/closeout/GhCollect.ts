/**
 * GitHub data collection and write execution for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import { collectTruncatableThreadPages, GhPageInfo, ghOutput } from "../../../../internal/github/index.ts";
import { YeetCommandError } from "../../Yeet.errors.ts";
import { PrCloseoutWriteAction } from "./Closeout.schemas.ts";
import {
  commentsPageQuery,
  decodeGhCommentsDocument,
  decodeGhPrView,
  decodeGhRepoView,
  decodeGhReviewsDocument,
  decodeGhReviewThreadsDocument,
  GhCloseoutPullRequest,
  GhPullRequestCommentConnection,
  GhReviewConnection,
  GhReviewThreadConnection,
  reviewsPageQuery,
  reviewThreadsPageQuery,
} from "./Gh.schemas.ts";
import { REPLY_THREAD_MUTATION, RESOLVE_THREAD_MUTATION } from "./WritePlan.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GhComment, GhPrView } from "../../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../../internal/repo-run/index.ts";
import type { GhRepoView, GhReview, GhReviewThread } from "./Gh.schemas.ts";
import type { closeoutWritePlan } from "./WritePlan.ts";

type CloseoutWriteIntent = ReturnType<typeof closeoutWritePlan>["intents"][number];

/**
 * Run a GitHub CLI command with Yeet closeout error normalization.
 *
 * **Example** (Read repository coordinates for closeout)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { closeoutGhOutput, RepoRunContext } from "@beep/repo-cli/test/Yeet"
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
 * const repoJson = closeoutGhOutput(context, ["repo", "view", "--json", "owner,name"], "gh repo view").pipe(
 *   Effect.map((output) => output.length)
 * )
 * ```
 *
 * @param context - Repo context whose root becomes the GitHub CLI working
 * directory.
 * @param args - GitHub CLI arguments excluding the `gh` executable.
 * @param label - Human-readable label included in closeout errors.
 * @returns Captured stdout when the command succeeds.
 * @category clients
 * @since 0.0.0
 */
export const closeoutGhOutput = Effect.fn("YeetCloseout.ghOutput")(function* (
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  label: string
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* ghOutput({
    args,
    cwd: context.repoRoot,
    label,
    onFailure: (failure) => {
      const command = `gh ${A.join(args, " ")}`;
      if (failure._tag === "spawn") {
        return YeetCommandError.new(`Failed to run ${label}.`)(failure.cause);
      }
      if (failure._tag === "truncated") {
        return YeetCommandError.make({
          message: `${label} output exceeded the repo-run capture limit.`,
          command,
          exitCode: 1,
        });
      }
      return YeetCommandError.make({
        message: `${label} failed with exit code ${failure.exitCode}.\n${failure.output}`,
        command,
        exitCode: failure.exitCode,
      });
    },
  });
});

const closedPageInfo = GhPageInfo.make({ endCursor: null, hasNextPage: false });

const cursorArgs = (cursor: O.Option<string>): ReadonlyArray<string> =>
  O.isSome(cursor) ? ["-F", `cursor=${cursor.value}`] : [];

const nextCursor = (label: string, pageInfo: GhPageInfo): Effect.Effect<O.Option<string>, YeetCommandError> => {
  if (!pageInfo.hasNextPage) {
    return Effect.succeedNone;
  }

  return pipe(
    O.fromNullishOr(pageInfo.endCursor),
    O.match({
      onNone: () =>
        Effect.fail(
          YeetCommandError.make({
            message: `${label} reported another GraphQL page without an end cursor.`,
            command: "gh api graphql",
            exitCode: 1,
          })
        ),
      onSome: (cursor) => Effect.succeedSome(cursor),
    })
  );
};

const ghGraphqlPage = Effect.fn("YeetCloseout.ghGraphqlPage")(function* (
  context: RepoRunContext,
  repo: GhRepoView,
  pr: GhPrView,
  query: string,
  cursor: O.Option<string>,
  label: string
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* closeoutGhOutput(
    context,
    [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-F",
      `owner=${repo.owner.login}`,
      "-F",
      `name=${repo.name}`,
      "-F",
      `number=${pr.number}`,
      ...cursorArgs(cursor),
    ],
    label
  );
});

const collectCommentPages = Effect.fn("YeetCloseout.collectCommentPages")(function* (
  context: RepoRunContext,
  repo: GhRepoView,
  pr: GhPrView
): Effect.fn.Return<ReadonlyArray<GhComment>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  let cursor = O.none<string>();
  let comments: ReadonlyArray<GhComment> = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const page = yield* ghGraphqlPage(context, repo, pr, commentsPageQuery, cursor, "gh api graphql comments").pipe(
      Effect.flatMap((output) =>
        decodeGhCommentsDocument(output).pipe(
          Effect.mapError(YeetCommandError.new("Failed to decode PR closeout comments GraphQL JSON."))
        )
      ),
      Effect.map((document) => document.data.repository.pullRequest.comments)
    );
    comments = [...comments, ...page.nodes];
    cursor = yield* nextCursor("pull request comments", page.pageInfo);
    hasNextPage = O.isSome(cursor);
  }

  return comments;
});

const collectReviewThreadPages = (
  context: RepoRunContext,
  repo: GhRepoView,
  pr: GhPrView
): Effect.Effect<ReadonlyArray<GhReviewThread>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> =>
  collectTruncatableThreadPages({
    advance: (pageInfo) => nextCursor("pull request review threads", pageInfo),
    fetchPage: (cursor) =>
      ghGraphqlPage(context, repo, pr, reviewThreadsPageQuery, cursor, "gh api graphql review threads").pipe(
        Effect.flatMap((output) =>
          decodeGhReviewThreadsDocument(output).pipe(
            Effect.mapError(YeetCommandError.new("Failed to decode PR closeout review threads GraphQL JSON."))
          )
        ),
        Effect.map((document) => document.data.repository.pullRequest.reviewThreads)
      ),
    truncationWarning: (threadIds) =>
      `Review thread(s) ${A.join(threadIds, ", ")} have more than 100 comments; Yeet closeout inspects only the first 100 nested comments per thread. Untrusted comment volume cannot block closeout.`,
  });

const collectReviewPages = Effect.fn("YeetCloseout.collectReviewPages")(function* (
  context: RepoRunContext,
  repo: GhRepoView,
  pr: GhPrView
): Effect.fn.Return<ReadonlyArray<GhReview>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  let cursor = O.none<string>();
  let reviews: ReadonlyArray<GhReview> = [];
  let hasNextPage = true;

  while (hasNextPage) {
    const page = yield* ghGraphqlPage(context, repo, pr, reviewsPageQuery, cursor, "gh api graphql reviews").pipe(
      Effect.flatMap((output) =>
        decodeGhReviewsDocument(output).pipe(
          Effect.mapError(YeetCommandError.new("Failed to decode PR closeout reviews GraphQL JSON."))
        )
      ),
      Effect.map((document) => document.data.repository.pullRequest.reviews)
    );
    const truncatedReviewIds = pipe(
      page.nodes,
      A.filter((review) => review.comments.pageInfo.hasNextPage),
      A.map((review) => review.id)
    );
    if (A.isReadonlyArrayNonEmpty(truncatedReviewIds)) {
      yield* Effect.logWarning(
        `Review(s) ${A.join(truncatedReviewIds, ", ")} have more than 100 inline comments; Yeet closeout inspects only the first 100 inline comments per review. Untrusted comment volume cannot block closeout.`
      );
    }

    reviews = [...reviews, ...page.nodes];
    cursor = yield* nextCursor("pull request reviews", page.pageInfo);
    hasNextPage = O.isSome(cursor);
  }

  return reviews;
});

/**
 * Collect the pull request, comments, review threads, and reviews for closeout.
 *
 * **Example** (Fetch the closeout payload for the current branch)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { collectPrCloseoutPayload, RepoRunContext } from "@beep/repo-cli/test/Yeet"
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
 * const prNumber = collectPrCloseoutPayload(context).pipe(Effect.map((payload) => payload.pr.number))
 * ```
 *
 * @param context - Repo context whose branch and repository are inspected with
 * GitHub CLI.
 * @returns Closeout payload plus the `gh pr view` metadata used to fetch it.
 * @category queries
 * @since 0.0.0
 */
export const collectPrCloseoutPayload = Effect.fn("YeetCloseout.collectPrCloseoutPayload")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  { readonly pullRequest: GhCloseoutPullRequest; readonly pr: GhPrView },
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const pr = yield* closeoutGhOutput(
    context,
    ["pr", "view", "--json", "number,headRefName,state,url,headRefOid,isDraft"],
    "gh pr view"
  ).pipe(
    Effect.flatMap((output) =>
      decodeGhPrView(output).pipe(Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON.")))
    )
  );
  const repo = yield* closeoutGhOutput(context, ["repo", "view", "--json", "owner,name"], "gh repo view").pipe(
    Effect.flatMap((output) =>
      decodeGhRepoView(output).pipe(Effect.mapError(YeetCommandError.new("Failed to decode gh repo view JSON.")))
    )
  );
  const comments = yield* collectCommentPages(context, repo, pr);
  const reviewThreads = yield* collectReviewThreadPages(context, repo, pr);
  const reviews = yield* collectReviewPages(context, repo, pr);
  const pullRequest = GhCloseoutPullRequest.make({
    comments: GhPullRequestCommentConnection.make({ nodes: comments, pageInfo: closedPageInfo }),
    reviewThreads: GhReviewThreadConnection.make({ nodes: reviewThreads, pageInfo: closedPageInfo }),
    reviews: GhReviewConnection.make({ nodes: reviews, pageInfo: closedPageInfo }),
  });

  return { pullRequest, pr };
});

/**
 * Execute explicit closeout writes such as replies and thread resolutions.
 *
 * **Example** (Resolve one review thread during closeout)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { performCloseoutWriteActions, RepoRunContext } from "@beep/repo-cli/test/Yeet"
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
 * const actions = performCloseoutWriteActions(context, [
 *   { body: O.none(), kind: "resolve", threadId: "PRRT_example" }
 * ]).pipe(Effect.map((written) => written.length))
 * ```
 *
 * @param context - Repo context whose repository receives the GraphQL writes.
 * @param intents - Planned write intents produced by closeout write planning.
 * @returns One successful write action record for each performed intent.
 * @category commands
 * @since 0.0.0
 */
export const performCloseoutWriteActions = Effect.fn("YeetCloseout.performCloseoutWriteActions")(function* (
  context: RepoRunContext,
  intents: ReadonlyArray<CloseoutWriteIntent>
): Effect.fn.Return<ReadonlyArray<PrCloseoutWriteAction>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const performWriteIntent = Effect.fnUntraced(function* (
    intent: CloseoutWriteIntent
  ): Effect.fn.Return<PrCloseoutWriteAction, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
    const args =
      intent.kind === "reply"
        ? [
            "api",
            "graphql",
            "-f",
            `query=${REPLY_THREAD_MUTATION}`,
            "-f",
            `threadId=${intent.threadId}`,
            "-f",
            `body=${O.getOrElse(intent.body, () => "")}`,
          ]
        : ["api", "graphql", "-f", `query=${RESOLVE_THREAD_MUTATION}`, "-f", `threadId=${intent.threadId}`];
    yield* closeoutGhOutput(context, args, `gh api graphql (${intent.kind})`);
    yield* Effect.log(`[yeet] closeout ${intent.kind} -> ${intent.threadId}`);
    return PrCloseoutWriteAction.make({
      detail: intent.kind === "reply" ? "replied to review thread" : "resolved review thread",
      kind: intent.kind,
      ok: true,
      threadId: intent.threadId,
    });
  });

  return yield* Effect.forEach(intents, performWriteIntent, { concurrency: 1 });
});
