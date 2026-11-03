/**
 * App-owned review publishing operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { PullRequest as PullRequests } from "@beep/github/PullRequest";
import { CommentMarker, PullRequestComment } from "@beep/github/PullRequestComment";
import { Repo, RepoRef } from "@beep/github/Repo";
import { PageOptions } from "@beep/github/Rest";
import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubAppAuth } from "./GitHubAppAuth.ts";
import { ReviewerError } from "./ReviewerErrors.ts";
import { ReviewerChangedFile } from "./ReviewerModels.ts";
import { ReviewerCheckExternalId, reviewerCheckExternalId, reviewerDocsOnly } from "./ReviewerRuleset.ts";
import type { ReviewerResult, ReviewerReview } from "./ReviewerModels.ts";

const $I = $RepoCliId.create("commands/Reviewer/Reviewer.service");
const REVIEWER_REPO = RepoRef.make({ owner: "beep-effect", repo: "beep-effect" });
// The editable summary's identity: this hidden marker plus the App's own authorship (see isReviewerSummary).
const SUMMARY_MARKER = CommentMarker.make({ namespace: "beep-reviewer", key: "summary" });
// GitHub lists at most 3000 files and 100 per page; an association walk stops at the same 30 pages.
const ASSOCIATION_PAGES = PageOptions.make({ perPage: 100, maxPages: 30 });
class AppIdentity extends S.Class<AppIdentity, { readonly brand: unique symbol }>($I`AppIdentity`)(
  { id: S.Int },
  $I.annote("AppIdentity", { description: "The originating GitHub App id." })
) {}
class CheckRun extends S.Class<CheckRun, { readonly brand: unique symbol }>($I`CheckRun`)(
  {
    id: S.Int,
    name: S.String,
    head_sha: S.String,
    status: S.String,
    conclusion: S.NullOr(S.String),
    app: AppIdentity,
    external_id: S.NullOr(S.String),
  },
  $I.annote("CheckRun", { description: "App-owned check run response." })
) {}
class CommentUser extends S.Class<CommentUser, { readonly brand: unique symbol }>($I`CommentUser`)(
  { login: S.String, type: S.String },
  $I.annote("CommentUser", { description: "Comment author's login and actor kind." })
) {}
class SummaryComment extends S.Class<SummaryComment, { readonly brand: unique symbol }>($I`SummaryComment`)(
  {
    id: S.Int,
    body: S.String,
    user: CommentUser,
    performed_via_github_app: S.NullOr(AppIdentity),
  },
  $I.annote("SummaryComment", { description: "Summary comment including its authoring App." })
) {}
class CreatedResource extends S.Class<CreatedResource, { readonly brand: unique symbol }>($I`CreatedResource`)(
  { id: S.Int },
  $I.annote("CreatedResource", { description: "Created or edited GitHub resource id." })
) {}
const decodeCheckExternalId = S.decodeUnknownEffect(ReviewerCheckExternalId);
const decodeChecks = S.decodeUnknownEffect(S.Array(CheckRun));
const decodeComments = S.decodeUnknownEffect(S.Array(SummaryComment));
class ClassifiedPull extends S.Class<ClassifiedPull, { readonly brand: unique symbol }>($I`ClassifiedPull`)(
  { head: S.Struct({ sha: S.String }), base: S.Struct({ sha: S.String }), changed_files: S.Int },
  $I.annote("ClassifiedPull", { description: "PR head with complete changed-file count for L0 classification." })
) {}
const error = (message: string) => ReviewerError.make({ operation: "github", message });

/**
 * Maps severity counts to the automatic conclusion while honoring an explicit conclusion.
 *
 * **Example** (Fail a blocking finding)
 * ```ts
 * import { reviewerConclusion } from "@beep/repo-cli/commands/Reviewer";
 * console.log(reviewerConclusion({ conclusion: "auto", p0: 0, p1: 1 })); // failure
 * ```
 *
 * @param result - Requested conclusion and blocking severity counts; explicit conclusions take precedence.
 * @returns The explicit conclusion, or failure for automatic results with any P0 or P1 finding, otherwise success.
 * @category policies
 * @since 0.0.0
 */
export const reviewerConclusion = (result: Pick<ReviewerResult, "conclusion" | "p0" | "p1">) =>
  result.conclusion === "auto" ? (result.p0 + result.p1 > 0 ? "failure" : "success") : result.conclusion;

/**
 * Requires both the hidden marker and the actual App identity before editing a comment.
 *
 * **Example** (Reject a marker copied by a human)
 * ```ts
 * import { isReviewerSummary } from "@beep/repo-cli/commands/Reviewer";
 * console.log(isReviewerSummary({ body: "<!-- beep-reviewer:summary -->", user: { login: "kriegcloud", type: "User" },
 *   performed_via_github_app: null }, 42)); // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isReviewerSummary: {
  (
    appId: number
  ): (comment: Pick<typeof SummaryComment.Encoded, "body" | "user" | "performed_via_github_app">) => boolean;
  (comment: Pick<typeof SummaryComment.Encoded, "body" | "user" | "performed_via_github_app">, appId: number): boolean;
} = dual(
  2,
  (comment: Pick<typeof SummaryComment.Encoded, "body" | "user" | "performed_via_github_app">, appId: number) =>
    SUMMARY_MARKER.matches(comment.body) &&
    comment.user.type === "Bot" &&
    comment.user.login === "beep-reviewer[bot]" &&
    comment.performed_via_github_app?.id === appId
);

interface ReviewerShape {
  readonly cancel: (id: number, reason: string) => Effect.Effect<number, ReviewerError>;
  readonly complete: (id: number, result: ReviewerResult) => Effect.Effect<number, ReviewerError>;
  readonly docsOnly: (pr: number, sha: string) => Effect.Effect<O.Option<string>, ReviewerError>;
  readonly review: (pr: number, sha: string, review: ReviewerReview) => Effect.Effect<number, ReviewerError>;
  readonly start: (pr: number, sha: string, expectedBase?: O.Option<string>) => Effect.Effect<number, ReviewerError>;
  readonly upsert: (pr: number, body: string) => Effect.Effect<number, ReviewerError>;
}

/**
 * Publishes checks, editable summaries, and COMMENT reviews using only the reviewer installation.
 *
 * **Example** (Compose a check start)
 * ```ts
 * import { Reviewer } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * const program = Reviewer.use((reviewer) => reviewer.start(123, "a".repeat(40)));
 * console.log(Effect.isEffect(program));
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Reviewer extends Context.Service<Reviewer, ReviewerShape>()($I`Reviewer`) {}

/**
 * Implements reviewer operations over the reviewer App's `@beep/github` installation client.
 *
 * **Details**
 *
 * Every call targets `beep-effect/beep-effect`. Pull request heads, file lists
 * and commit associations come from the kit's `PullRequest`; check runs, the
 * changed-file count, comment authorship and reviews are read through
 * `GitHubClient` with this module's own schemas, because the kit's projections
 * drop the fields the ownership checks compare (check `app.id` and
 * `external_id`, comment `performed_via_github_app`, `changed_files`).
 *
 * **Example** (Inspect the publishing layer)
 * ```ts
 * import { ReviewerLive } from "@beep/repo-cli/commands/Reviewer";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(ReviewerLive));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReviewerLive = Layer.effect(
  Reviewer,
  Effect.gen(function* () {
    const auth = yield* GitHubAppAuth;
    const client = yield* GitHubClient;
    const pulls = yield* PullRequests;
    const comments = yield* PullRequestComment;
    const at = { owner: REVIEWER_REPO.owner, repo: REVIEWER_REPO.repo };
    const onRepo = Effect.provideService(Repo, REVIEWER_REPO);
    const request = <A, I>(route: string, params: Record<string, unknown>, schema: S.Codec<A, I>) =>
      client
        .requestDecoded(route, { ...at, ...params }, schema)
        .pipe(Effect.mapError(() => error("Reviewer GitHub request failed; sensitive diagnostics suppressed.")));
    const write = (route: string, params: Record<string, unknown>) => request(route, params, CreatedResource);
    const readClassifiedPull = (pr: number) =>
      request("GET /repos/{owner}/{repo}/pulls/{pull_number}", { pull_number: pr }, ClassifiedPull);
    const currentHead = Effect.fn("Reviewer.currentHead")(function* (pr: number, sha: string) {
      const pull = yield* pulls.get(pr).pipe(onRepo);
      if (pull.headSha !== sha) return yield* error("PR head moved; refusing to publish a stale review.");
      return pull.baseSha;
    });
    const exclusiveOpenHead = Effect.fn("Reviewer.exclusiveOpenHead")(function* (pr: number, sha: string) {
      const associated = yield* pulls.listAssociatedWithCommit(sha, { page: ASSOCIATION_PAGES }).pipe(onRepo);
      if (A.some(associated, (pull) => pull.number !== pr && pull.state === "open" && pull.headSha === sha))
        return false;
      if (associated.length >= 3000) return yield* error("PR association listing exceeded its safe page limit.");
      return A.some(associated, (pull) => pull.number === pr && pull.state === "open" && pull.headSha === sha);
    });
    const confirmDocsOnlyHead = Effect.fn("Reviewer.confirmDocsOnlyHead")(function* (
      pr: number,
      sha: string,
      baseSha: string,
      fileCount: number
    ) {
      const confirmed = yield* readClassifiedPull(pr);
      if (confirmed.head.sha !== sha || confirmed.base.sha !== baseSha || confirmed.changed_files !== fileCount)
        return yield* error("PR moved during L0 association check.");
    });
    const docsOnly = Effect.fn("Reviewer.docsOnly")(
      function* (pr: number, sha: string) {
        const before = yield* readClassifiedPull(pr);
        if (!A.every([before.head.sha === sha, before.changed_files < 3000], identity))
          return yield* error("Cannot classify a moved or truncated PR head as L0.");
        const pipe1 = yield* pulls.listFiles(pr, { page: PageOptions.all }).pipe(onRepo);
        const files = A.map(pipe1, (file) =>
          ReviewerChangedFile.make({
            filename: file.path,
            ...O.getSomesStruct({ previous_filename: O.fromUndefinedOr(file.previousPath) }),
          })
        );
        const after = yield* readClassifiedPull(pr);
        if (
          !A.every(
            [
              after.head.sha === sha,
              after.base.sha === before.base.sha,
              after.changed_files === files.length,
              before.changed_files === files.length,
            ],
            identity
          )
        )
          return yield* error("PR changed or its file listing was incomplete during L0 classification.");
        if (!reviewerDocsOnly(files)) return O.none();
        if (!(yield* exclusiveOpenHead(pr, sha))) return O.none();
        yield* confirmDocsOnlyHead(pr, sha, before.base.sha, files.length);
        return O.some(before.base.sha);
      },
      Effect.mapError(() => error("L0 classification failed closed."))
    );
    const owned = Effect.fn("Reviewer.ownedCheck")(function* (id: number) {
      const check = yield* request(
        "GET /repos/{owner}/{repo}/check-runs/{check_run_id}",
        { check_run_id: id },
        CheckRun
      );
      if (check.name !== "beep-reviewer" || check.app.id !== auth.appId)
        return yield* error("Check does not belong to beep-reviewer.");
      return check;
    });
    const start = Effect.fn("Reviewer.start")(
      function* (pr: number, sha: string, expectedBase: O.Option<string> = O.none()) {
        const baseSha = yield* currentHead(pr, sha);
        if (O.isSome(expectedBase) && expectedBase.value !== baseSha)
          return yield* error("PR base moved after L0 classification.");
        const association = reviewerCheckExternalId(pr, sha, baseSha);
        const runs = yield* client
          .paginate(
            "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
            { ...at, ref: sha, check_name: "beep-reviewer", filter: "all" },
            PageOptions.all
          )
          .pipe(Effect.flatMap(decodeChecks));
        const existing = A.findFirst(
          runs,
          (run) =>
            run.app.id === auth.appId &&
            run.head_sha === sha &&
            run.status === "in_progress" &&
            run.external_id === association
        );
        if (O.isSome(existing)) return existing.value.id;
        return (yield* write("POST /repos/{owner}/{repo}/check-runs", {
          name: "beep-reviewer",
          head_sha: sha,
          status: "in_progress",
          external_id: association,
          output: { title: "Reviewing…", summary: "Reviewing the current PR head." },
        })).id;
      },
      Effect.mapError(() => error("Cannot start reviewer check; verify PR head and App access."))
    );
    const active = Effect.fn("Reviewer.activeCheck")(function* (id: number) {
      const check = yield* owned(id);
      if (check.status !== "in_progress") return yield* error("Check is no longer active.");
      // external_id records the intended PR even when GitHub omits pull_requests for a fork.
      const [, pr, , associatedHead, , associatedBase] = yield* decodeCheckExternalId(check.external_id);
      if (associatedHead !== check.head_sha) return yield* error("Check has an invalid PR association.");
      const currentBase = yield* currentHead(pr, check.head_sha);
      if (currentBase !== associatedBase) return yield* error("PR base moved; refusing to complete a stale review.");
    });
    const updateCheck = (id: number, body: Record<string, unknown>) =>
      write("PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", { check_run_id: id, ...body });
    const complete = Effect.fn("Reviewer.complete")(
      function* (id: number, result: ReviewerResult) {
        yield* active(id);
        const title = `${result.score}/5 · ${result.tier} · P0 ${result.p0} · P1 ${result.p1} · P2 ${result.p2}`;
        // Append annotations before completing: a failed batch leaves an in-progress run, never false green.
        for (const annotations of A.chunksOf(result.annotations, 50)) {
          yield* updateCheck(id, { output: { title, summary: result.summary, annotations } });
        }
        // Recheck after annotation requests so a cancellation or push during publication stays closed.
        yield* active(id);
        yield* updateCheck(id, {
          status: "completed",
          conclusion: reviewerConclusion(result),
          output: { title, summary: result.summary },
        });
        return id;
      },
      Effect.mapError(() => error("Cannot complete reviewer check."))
    );
    const cancel = Effect.fn("Reviewer.cancel")(
      function* (id: number, reason: string) {
        const check = yield* owned(id);
        if (check.status !== "in_progress") return yield* error("Check is no longer active.");
        yield* updateCheck(id, {
          status: "completed",
          conclusion: "cancelled",
          output: { title: "Review cancelled", summary: reason },
        });
        return id;
      },
      Effect.mapError(() => error("Cannot cancel reviewer check."))
    );
    const upsert = Effect.fn("Reviewer.upsert")(
      function* (pr: number, body: string) {
        // The marker leads the body, as the hand-rolled upsert wrote it; the kit's
        // `PullRequestComment.upsert` appends it and matches any author, so the
        // App-authorship check stays here.
        const content = SUMMARY_MARKER.matches(body) ? body : `${SUMMARY_MARKER.html}\n${body}`;
        const listed = yield* client
          .paginate(
            "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
            { ...at, issue_number: pr },
            PageOptions.all
          )
          .pipe(Effect.flatMap(decodeComments));
        const own = A.findFirst(listed, (comment) => isReviewerSummary(comment, auth.appId));
        if (O.isSome(own))
          return (yield* write("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
            comment_id: own.value.id,
            body: content,
          })).id;
        return (yield* comments.create(pr, content).pipe(onRepo)).id;
      },
      Effect.mapError(() => error("Cannot upsert reviewer summary."))
    );
    const review = Effect.fn("Reviewer.review")(
      function* (pr: number, sha: string, input: ReviewerReview) {
        yield* currentHead(pr, sha);
        return (yield* write("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
          pull_number: pr,
          body: input.body,
          comments: input.comments,
          commit_id: sha,
          event: "COMMENT",
        })).id;
      },
      Effect.mapError(() => error("Cannot post COMMENT review."))
    );
    return Reviewer.of({ docsOnly, start, complete, cancel, upsert, review });
  })
).pipe(Layer.provide(Layer.mergeAll(PullRequests.layer, PullRequestComment.layer)));
