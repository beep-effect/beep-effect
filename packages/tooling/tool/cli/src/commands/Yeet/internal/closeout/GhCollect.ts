/**
 * GitHub data collection and write execution for Yeet closeout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Repo, RepoRef } from "@beep/github/Repo";
import { ReviewThread } from "@beep/github/ReviewThread";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { GhActor, GhComment, GhPageInfo, ghOutput } from "../../../../internal/github/index.ts";
import { YeetCommandError } from "../../Yeet.errors.ts";
import { ghActorFromReviewThread } from "../ReviewThreadState.ts";
import { PrCloseoutWriteAction } from "./Closeout.schemas.ts";
import {
  commentsPageQuery,
  decodeGhCommentsDocument,
  decodeGhPrView,
  decodeGhRepoView,
  decodeGhReviewsDocument,
  GhCloseoutPullRequest,
  GhPullRequestCommentConnection,
  GhReviewConnection,
  GhReviewThread,
  GhReviewThreadCommentConnection,
  GhReviewThreadConnection,
  GhReviewThreadLatestComment,
  GhReviewThreadLatestConnection,
  reviewsPageQuery,
} from "./Gh.schemas.ts";
import type { GitHubError } from "@beep/github/GitHubError";
import type { GitHubGraphQLError } from "@beep/github/GraphQL";
import type { ReviewThreadActor, ReviewThreadNode, ReviewThreads } from "@beep/github/ReviewThread";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GhPrView } from "../../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../../internal/repo-run/index.ts";
import type { GhRepoView, GhReview } from "./Gh.schemas.ts";
import type { closeoutWritePlan } from "./WritePlan.ts";

type CloseoutWriteIntent = ReturnType<typeof closeoutWritePlan>["intents"][number];

/**
 * Run a GitHub CLI command with Yeet closeout error normalization.
 *
 * **Example** (Read repository coordinates for closeout)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
): Effect.fn.Return<string, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
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
): Effect.fn.Return<string, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  // KEEP (D-13): the closeout comment and review pages have no kit resource.
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
): Effect.fn.Return<
  ReadonlyArray<GhComment>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
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

const closeoutThreadAuthor = (author: O.Option<ReviewThreadActor>): GhActor | null =>
  O.getOrNull(O.map(author, ghActorFromReviewThread));

// The kit thread in the shape the closeout triage reads: the first 100
// comments (the kit warns once per page about a thread with more) and the
// newest comment, quoted as evidence.
const closeoutReviewThread = (thread: ReviewThreadNode): GhReviewThread =>
  GhReviewThread.make({
    comments: GhReviewThreadCommentConnection.make({
      nodes: A.map(thread.comments, (comment) =>
        GhComment.make({
          author: closeoutThreadAuthor(comment.author),
          body: comment.body,
          createdAt: comment.createdAt,
          id: comment.id,
          url: comment.url,
        })
      ),
      pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: thread.commentsTruncated }),
    }),
    id: thread.id,
    isOutdated: thread.isOutdated,
    isResolved: thread.isResolved,
    latest: GhReviewThreadLatestConnection.make({
      nodes: A.map(O.toArray(thread.newestComment), (comment) =>
        GhReviewThreadLatestComment.make({
          author: closeoutThreadAuthor(comment.author),
          body: comment.body,
          createdAt: comment.createdAt,
          url: comment.url,
        })
      ),
    }),
    line: O.getOrNull(thread.line),
    path: thread.path,
    resolvedBy: O.getOrNull(O.map(thread.resolvedBy, (login) => GhActor.make({ login }))),
  });

/**
 * Name a failed GitHub read or write the way the closeout `gh` capture did:
 * `<label> failed.` and the kit's own message on the next line, exit 1.
 *
 * **Example** (Fold a refused resolve)
 *
 * ```ts
 * import { GitHubGraphQLError } from "@beep/github/GraphQL"
 * import { closeoutGithubFailure } from "@beep/repo-cli/test/Yeet"
 *
 * const error = closeoutGithubFailure("gh api graphql (resolve)")(GitHubGraphQLError.decode("resolveReviewThread", "no thread"))
 * console.log(error.message.startsWith("gh api graphql (resolve) failed.")) // true
 * ```
 *
 * @param label - Names the call in the message.
 * @returns The fold from a GitHub failure to a `YeetCommandError`.
 * @category errors
 * @since 0.0.0
 */
export const closeoutGithubFailure =
  (label: string) =>
  (error: GitHubError | GitHubGraphQLError): YeetCommandError =>
    YeetCommandError.make({ message: `${label} failed.\n${error.message}`, exitCode: 1, cause: error });

/**
 * Read every review thread of a pull request in the repository `gh repo view`
 * named, folding a failed read through the caller's `onFailure`.
 *
 * **Details**
 *
 * The closeout collector and the reply engine both resolve the repository
 * through `gh repo view` (gh's own base-repository choice) and then walk the
 * kit's `ReviewThread.list` there, so that choice also names the kit's `Repo`.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { GhRepoOwner, GhRepoView, listGhRepoViewThreads, YeetCommandError } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const read = listGhRepoViewThreads({
 *   repo: GhRepoView.make({ name: "beep-effect", owner: GhRepoOwner.make({ login: "beep-effect" }) }),
 *   prNumber: 7,
 *   onFailure: (error) => YeetCommandError.make({ message: error.message }),
 * })
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param options - The repository, the pull request number and the failure fold.
 * @returns Every thread with the pull request's author.
 * @category clients
 * @since 0.0.0
 */
export const listGhRepoViewThreads = Effect.fn("YeetCloseout.listGhRepoViewThreads")(function* ({
  repo,
  prNumber,
  onFailure,
}: {
  readonly repo: GhRepoView;
  readonly prNumber: number;
  readonly onFailure: (error: GitHubGraphQLError) => YeetCommandError;
}): Effect.fn.Return<ReviewThreads, YeetCommandError, ReviewThread> {
  const ref = yield* RepoRef.parse(`${repo.owner.login}/${repo.name}`).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh repo view JSON."))
  );
  return yield* ReviewThread.use((threads) => threads.list(prNumber)).pipe(
    Repo.provide(ref),
    Effect.mapError(onFailure)
  );
});

const collectReviewThreadPages = (repo: GhRepoView, pr: GhPrView) =>
  listGhRepoViewThreads({
    repo,
    prNumber: pr.number,
    onFailure: (error) =>
      error.kind === "decode"
        ? YeetCommandError.new(`Failed to decode PR closeout review threads GraphQL JSON: ${error.reason}.`)(error)
        : closeoutGithubFailure("gh api graphql review threads")(error),
  }).pipe(Effect.map((read) => A.map(read.threads, closeoutReviewThread)));

const collectReviewPages = Effect.fn("YeetCloseout.collectReviewPages")(function* (
  context: RepoRunContext,
  repo: GhRepoView,
  pr: GhPrView
): Effect.fn.Return<
  ReadonlyArray<GhReview>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
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
 * import * as Effect from "effect/Effect";
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
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | ReviewThread
> {
  // KEEP (D-13): `gh pr view` resolves the pull request from the checked-out branch.
  const pr = yield* closeoutGhOutput(
    context,
    ["pr", "view", "--json", "number,headRefName,state,url,headRefOid,isDraft,author"],
    "gh pr view"
  ).pipe(
    Effect.flatMap((output) =>
      decodeGhPrView(output).pipe(Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON.")))
    )
  );
  // KEEP (D-13): gh's base-repository resolution has no kit member.
  const repo = yield* closeoutGhOutput(context, ["repo", "view", "--json", "owner,name"], "gh repo view").pipe(
    Effect.flatMap((output) =>
      decodeGhRepoView(output).pipe(Effect.mapError(YeetCommandError.new("Failed to decode gh repo view JSON.")))
    )
  );
  const comments = yield* collectCommentPages(context, repo, pr);
  const reviewThreads = yield* collectReviewThreadPages(repo, pr);
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
 * import * as Effect from "effect/Effect";
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
  intents: ReadonlyArray<CloseoutWriteIntent>
): Effect.fn.Return<ReadonlyArray<PrCloseoutWriteAction>, YeetCommandError, ReviewThread> {
  const threads = yield* ReviewThread;
  const performWriteIntent = Effect.fnUntraced(function* (
    intent: CloseoutWriteIntent
  ): Effect.fn.Return<PrCloseoutWriteAction, YeetCommandError> {
    const write =
      intent.kind === "reply"
        ? Effect.asVoid(
            threads.reply(
              intent.threadId,
              O.getOrElse(intent.body, () => "")
            )
          )
        : Effect.asVoid(threads.resolve(intent.threadId));
    yield* write.pipe(Effect.mapError(closeoutGithubFailure(`gh api graphql (${intent.kind})`)));
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
