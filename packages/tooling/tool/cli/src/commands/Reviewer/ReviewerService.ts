/**
 * App-owned review publishing operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, identity } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubAppAuth } from "./GitHubAppAuth.ts";
import { ReviewerError } from "./ReviewerErrors.ts";
import { ReviewerChangedFile } from "./ReviewerModels.ts";
import { ReviewerCheckExternalId, reviewerCheckExternalId, reviewerDocsOnly } from "./ReviewerRuleset.ts";
import type * as HttpMethod from "effect/http/HttpMethod";
import type { ReviewerResult, ReviewerReview } from "./ReviewerModels.ts";

const $I = $RepoCliId.create("commands/Reviewer/Reviewer.service");
const API = "https://api.github.com/repos/beep-effect/beep-effect";
const MARKER = "<!-- beep-reviewer:summary -->";
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
class CheckPage extends S.Class<CheckPage, { readonly brand: unique symbol }>($I`CheckPage`)(
  { total_count: S.Int, check_runs: S.Array(CheckRun) },
  $I.annote("CheckPage", { description: "Paginated check runs." })
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
class PullRequest extends S.Class<PullRequest, { readonly brand: unique symbol }>($I`PullRequest`)(
  { head: S.Struct({ sha: S.String }), base: S.Struct({ sha: S.String }) },
  $I.annote("PullRequest", { description: "The current PR head and base commits." })
) {}
const decodeCheckExternalId = S.decodeUnknownEffect(ReviewerCheckExternalId);
const decodeCheck = S.decodeUnknownEffect(CheckRun);
const decodeChecks = S.decodeUnknownEffect(CheckPage);
const decodeComments = S.decodeUnknownEffect(S.Array(SummaryComment));
const decodeResource = S.decodeUnknownEffect(CreatedResource);
class ClassifiedPull extends S.Class<ClassifiedPull, { readonly brand: unique symbol }>($I`ClassifiedPull`)(
  { ...PullRequest.fields, changed_files: S.Int },
  $I.annote("ClassifiedPull", { description: "PR head with complete changed-file count for L0 classification." })
) {}
const decodeClassifiedPull = S.decodeUnknownEffect(ClassifiedPull);
const decodeFilePage = S.decodeUnknownEffect(S.Array(ReviewerChangedFile));
const decodeAssociatedPulls = S.decodeUnknownEffect(
  S.Array(S.Struct({ number: S.Int, state: S.Literals(["open", "closed"]), head: S.Struct({ sha: S.String }) }))
);
const decodePull = S.decodeUnknownEffect(PullRequest);
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
    Str.includes(MARKER)(comment.body) &&
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
 * Implements reviewer operations with an injectable Effect HTTP client and App auth service.
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
    const http = yield* HttpClient.HttpClient;
    const request = Effect.fn("Reviewer.request")(
      function* (method: HttpMethod.HttpMethod, path: string, body?: unknown) {
        const token = yield* auth.token;
        const base = HttpClientRequest.make(method)(`${API}${path}`).pipe(
          HttpClientRequest.setHeaders({
            authorization: `Bearer ${Redacted.value(token)}`,
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
          })
        );
        const req = body === undefined ? base : yield* HttpClientRequest.bodyJson(base, body);
        const response = yield* http.execute(req);
        if (response.status < 200 || response.status >= 300)
          return yield* error(`GitHub ${method} returned HTTP ${response.status}.`);
        return yield* response.json;
      },
      Effect.mapError(() => error("Reviewer GitHub request failed; sensitive diagnostics suppressed."))
    );
    const currentHead = Effect.fn("Reviewer.currentHead")(function* (pr: number, sha: string) {
      const pull = yield* request("GET", `/pulls/${pr}`).pipe(Effect.flatMap(decodePull));
      if (pull.head.sha !== sha) return yield* error("PR head moved; refusing to publish a stale review.");
      return pull.base.sha;
    });
    const exclusiveOpenHead = Effect.fn("Reviewer.exclusiveOpenHead")(function* (pr: number, sha: string) {
      let ownHeadSeen = false;
      let page = 1;
      while (true) {
        if (page > 30) return yield* error("PR association listing exceeded its safe page limit.");
        const associated = yield* request("GET", `/commits/${sha}/pulls?per_page=100&page=${page}`).pipe(
          Effect.flatMap(decodeAssociatedPulls)
        );
        ownHeadSeen ||= A.some(
          associated,
          (pull) => pull.number === pr && pull.state === "open" && pull.head.sha === sha
        );
        if (A.some(associated, (pull) => pull.number !== pr && pull.state === "open" && pull.head.sha === sha))
          return false;
        if (associated.length < 100) return ownHeadSeen;
        page += 1;
      }
    });
    const confirmDocsOnlyHead = Effect.fn("Reviewer.confirmDocsOnlyHead")(function* (
      pr: number,
      sha: string,
      baseSha: string,
      fileCount: number
    ) {
      const confirmed = yield* request("GET", `/pulls/${pr}`).pipe(Effect.flatMap(decodeClassifiedPull));
      if (confirmed.head.sha !== sha || confirmed.base.sha !== baseSha || confirmed.changed_files !== fileCount)
        return yield* error("PR moved during L0 association check.");
    });
    const docsOnly = Effect.fn("Reviewer.docsOnly")(
      function* (pr: number, sha: string) {
        const before = yield* request("GET", `/pulls/${pr}`).pipe(Effect.flatMap(decodeClassifiedPull));
        if (!A.every([before.head.sha === sha, before.changed_files < 3000], identity))
          return yield* error("Cannot classify a moved or truncated PR head as L0.");
        const files: Array<ReviewerChangedFile> = [];
        let page = 1;
        while (true) {
          const batch = yield* request("GET", `/pulls/${pr}/files?per_page=100&page=${page}`).pipe(
            Effect.flatMap(decodeFilePage)
          );
          files.push(...batch);
          if (batch.length < 100) break;
          page += 1;
        }
        const after = yield* request("GET", `/pulls/${pr}`).pipe(Effect.flatMap(decodeClassifiedPull));
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
      const check = yield* request("GET", `/check-runs/${id}`).pipe(Effect.flatMap(decodeCheck));
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
        let page = 1;
        while (true) {
          const runs = yield* request(
            "GET",
            `/commits/${sha}/check-runs?check_name=beep-reviewer&filter=all&per_page=100&page=${page}`
          ).pipe(Effect.flatMap(decodeChecks));
          const existing = A.findFirst(
            runs.check_runs,
            (run) =>
              run.app.id === auth.appId &&
              run.head_sha === sha &&
              run.status === "in_progress" &&
              run.external_id === association
          );
          if (O.isSome(existing)) return existing.value.id;
          if (page * 100 >= runs.total_count) break;
          page += 1;
        }
        return (yield* request("POST", "/check-runs", {
          name: "beep-reviewer",
          head_sha: sha,
          status: "in_progress",
          external_id: association,
          output: { title: "Reviewing…", summary: "Reviewing the current PR head." },
        }).pipe(Effect.flatMap(decodeResource))).id;
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
    const complete = Effect.fn("Reviewer.complete")(
      function* (id: number, result: ReviewerResult) {
        yield* active(id);
        const title = `${result.score}/5 · ${result.tier} · P0 ${result.p0} · P1 ${result.p1} · P2 ${result.p2}`;
        // Append annotations before completing: a failed batch leaves an in-progress run, never false green.
        for (const annotations of A.chunksOf(result.annotations, 50)) {
          yield* request("PATCH", `/check-runs/${id}`, { output: { title, summary: result.summary, annotations } });
        }
        // Recheck after annotation requests so a cancellation or push during publication stays closed.
        yield* active(id);
        yield* request("PATCH", `/check-runs/${id}`, {
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
        yield* owned(id);
        yield* request("PATCH", `/check-runs/${id}`, {
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
        const content = Str.includes(MARKER)(body) ? body : `${MARKER}\n${body}`;
        let page = 1;
        while (true) {
          const comments = yield* request("GET", `/issues/${pr}/comments?per_page=100&page=${page}`).pipe(
            Effect.flatMap(decodeComments)
          );
          const own = A.findFirst(comments, (comment) => isReviewerSummary(comment, auth.appId));
          if (O.isSome(own))
            return (yield* request("PATCH", `/issues/comments/${own.value.id}`, { body: content }).pipe(
              Effect.flatMap(decodeResource)
            )).id;
          if (comments.length < 100) break;
          page += 1;
        }
        return (yield* request("POST", `/issues/${pr}/comments`, { body: content }).pipe(
          Effect.flatMap(decodeResource)
        )).id;
      },
      Effect.mapError(() => error("Cannot upsert reviewer summary."))
    );
    const review = Effect.fn("Reviewer.review")(
      function* (pr: number, sha: string, input: ReviewerReview) {
        yield* currentHead(pr, sha);
        return (yield* request("POST", `/pulls/${pr}/reviews`, {
          body: input.body,
          comments: input.comments,
          commit_id: sha,
          event: "COMMENT",
        }).pipe(Effect.flatMap(decodeResource))).id;
      },
      Effect.mapError(() => error("Cannot post COMMENT review."))
    );
    return Reviewer.of({ docsOnly, start, complete, cancel, upsert, review });
  })
);
