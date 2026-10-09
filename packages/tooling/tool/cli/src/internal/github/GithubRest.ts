/**
 * REST-first pull-request operations for the repo CLI, over `@effected/github`.
 *
 * **Details**
 *
 * GitHub REST has its own 5,000-request hourly budget that the workstation
 * almost never exhausts, while GraphQL (which `gh pr view|edit|ready|merge|checks`
 * all use under the hood) runs dry several times a day. {@link GithubRest}
 * covers every pull-request read and write that has a REST endpoint: the pull
 * request itself, labels, issue comments, check runs, the base ruleset's
 * required contexts, the ready-for-review timeline event, the head commit
 * time, the squash merge, workflow re-runs and cancels, and the rate limit.
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

import { $RepoCliId } from "@beep/identity/packages";
import { GitHubClient, GitHubError, Repo } from "@effected/github";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/github/GithubRest");

/**
 * A pull request as the REST `pulls/{n}` endpoint reports it, reduced to what
 * the CLI reads.
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
export class GithubPullRequestRecord extends S.Class<GithubPullRequestRecord>($I`GithubPullRequestRecord`)(
  {
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
    htmlUrl: S.String,
    author: S.String,
    labels: S.Array(S.String),
    createdAt: S.DateTimeUtc,
    updatedAt: S.DateTimeUtc,
  },
  $I.annote("GithubPullRequestRecord", { description: "A pull request read over GitHub REST." })
) {}

const PullWire = S.Struct({
  number: S.Int,
  node_id: S.String,
  title: S.String,
  body: S.NullOr(S.String),
  state: S.String,
  draft: S.optionalKey(S.Boolean),
  merged: S.optionalKey(S.Boolean),
  merged_at: S.NullOr(S.String),
  mergeable_state: S.String.pipe(S.NullOr, S.optionalKey),
  head: S.Struct({ ref: S.String, sha: S.String }),
  base: S.Struct({ ref: S.String }),
  html_url: S.String,
  user: S.NullOr(S.Struct({ login: S.String })),
  labels: S.Array(S.Struct({ name: S.String })),
  created_at: S.DateTimeUtcFromString,
  updated_at: S.DateTimeUtcFromString,
});

const toPullRequestRecord = (wire: typeof PullWire.Type): GithubPullRequestRecord =>
  GithubPullRequestRecord.make({
    number: wire.number,
    nodeId: wire.node_id,
    title: wire.title,
    body: wire.body ?? "",
    state: wire.state,
    draft: wire.draft ?? false,
    merged: wire.merged ?? wire.merged_at !== null,
    mergeableState: O.fromNullishOr(wire.mergeable_state),
    headRef: wire.head.ref,
    headSha: wire.head.sha,
    baseRef: wire.base.ref,
    htmlUrl: wire.html_url,
    author: wire.user?.login ?? "",
    labels: A.map(wire.labels, (label) => label.name),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  });

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
export class GithubCheckRunRecord extends S.Class<GithubCheckRunRecord>($I`GithubCheckRunRecord`)(
  { id: S.Int, name: S.String, status: S.String, conclusion: S.Option(S.String) },
  $I.annote("GithubCheckRunRecord", { description: "One check run on a commit, read over GitHub REST." })
) {}

const CheckRunWire = S.Struct({ id: S.Int, name: S.String, status: S.String, conclusion: S.NullOr(S.String) });

/**
 * One GitHub Actions workflow run.
 *
 * **Example** (A failed run)
 *
 * ```ts
 * import { GithubWorkflowRunRecord } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const run = GithubWorkflowRunRecord.make({ id: 9, name: "CI", status: "completed", conclusion: O.some("failure"), headSha: "abc" })
 * console.log(run.id) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubWorkflowRunRecord extends S.Class<GithubWorkflowRunRecord>($I`GithubWorkflowRunRecord`)(
  { id: S.Int, name: S.String, status: S.String, conclusion: S.Option(S.String), headSha: S.String },
  $I.annote("GithubWorkflowRunRecord", { description: "One workflow run, read over GitHub REST." })
) {}

const WorkflowRunWire = S.Struct({
  id: S.Int,
  name: S.String.pipe(S.NullOr, S.optionalKey),
  status: S.NullOr(S.String),
  conclusion: S.NullOr(S.String),
  head_sha: S.String,
});

/**
 * The outcome of a REST squash merge.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubMergeRecord extends S.Class<GithubMergeRecord>($I`GithubMergeRecord`)(
  { merged: S.Boolean, sha: S.String, message: S.String },
  $I.annote("GithubMergeRecord", { description: "The REST merge response." })
) {}

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
export class GithubRateLimitBucket extends S.Class<GithubRateLimitBucket>($I`GithubRateLimitBucket`)(
  { limit: S.Int, remaining: S.Int, resetAt: S.DateTimeUtc },
  $I.annote("GithubRateLimitBucket", { description: "One REST rate-limit bucket." })
) {}

/**
 * The REST `core` and `graphql` rate-limit buckets.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRateLimitRecord extends S.Class<GithubRateLimitRecord>($I`GithubRateLimitRecord`)(
  { core: GithubRateLimitBucket, graphql: GithubRateLimitBucket },
  $I.annote("GithubRateLimitRecord", { description: "REST rate-limit buckets." })
) {}

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
  event: S.String.pipe(S.NullOr, S.optionalKey),
  created_at: S.String.pipe(S.NullOr, S.optionalKey),
});

const CommitWire = S.Struct({ commit: S.Struct({ committer: S.NullOr(S.Struct({ date: S.String })) }) });
const CommentWire = S.Struct({ id: S.Int, html_url: S.String });
const LabelWire = S.Struct({ name: S.String });
const MergeWire = S.Struct({ merged: S.Boolean, sha: S.String, message: S.String });

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
  /** Cancel one workflow run. */
  readonly cancelWorkflowRun: (runId: number) => Effect.Effect<void, GitHubError>;
  /** Every check run on a commit (all pages). */
  readonly checkRuns: (sha: string) => Effect.Effect<ReadonlyArray<GithubCheckRunRecord>, GitHubError>;
  /** The committer time of a commit. */
  readonly commitCommittedAt: (sha: string) => Effect.Effect<DateTime.Utc, GitHubError>;
  /** Post an issue comment on a pull request; returns its URL. */
  readonly createIssueComment: (number: number, body: string) => Effect.Effect<string, GitHubError>;
  /**
   * Whether the pull request has any inline review comment (one-item REST page).
   * No comment proves zero review threads; any comment says nothing about their
   * resolution, which only GraphQL reports.
   */
  readonly hasReviewComments: (number: number) => Effect.Effect<boolean, GitHubError>;
  /** Squash-merge (or another method) pinned to a head sha. */
  readonly mergePullRequest: (
    number: number,
    options: {
      readonly sha: string;
      readonly commitTitle: string;
      readonly commitMessage: string;
      readonly method: "merge" | "squash" | "rebase";
    }
  ) => Effect.Effect<GithubMergeRecord, GitHubError>;
  /** The open pull request whose head is `owner:branch`, if any. */
  readonly openPullRequestForBranch: (
    headOwner: string,
    branch: string
  ) => Effect.Effect<O.Option<GithubPullRequestRecord>, GitHubError>;
  /** One pull request by number. */
  readonly pullRequest: (number: number) => Effect.Effect<GithubPullRequestRecord, GitHubError>;
  /** The REST rate-limit buckets. */
  readonly rateLimit: Effect.Effect<GithubRateLimitRecord, GitHubError>;
  /** When the pull request was last marked ready for review, if ever. */
  readonly readyForReviewAt: (number: number) => Effect.Effect<O.Option<DateTime.Utc>, GitHubError>;
  /** Remove one label; a label that is not there is not an error. */
  readonly removeLabel: (number: number, label: string) => Effect.Effect<void, GitHubError>;
  /** The required status-check contexts the branch's rulesets declare. */
  readonly requiredStatusContexts: (branch: string) => Effect.Effect<ReadonlyArray<string>, GitHubError>;
  /** Re-run the failed jobs of one workflow run. */
  readonly rerunFailedJobs: (runId: number) => Effect.Effect<void, GitHubError>;
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
      Effect.map((pulls) =>
        pipe(
          pulls,
          A.map(toPullRequestRecord),
          A.findFirst((pull) => pull.headRef === branch)
        )
      )
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
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.body === undefined ? {} : { body: patch.body }),
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

  const requiredStatusContexts = (branch: string) =>
    client.paginate("GET /repos/{owner}/{repo}/rules/branches/{branch}", { ...at, branch }).pipe(
      Effect.flatMap(decodeWith(S.Array(RulesetRuleWire), "GET /repos/{owner}/{repo}/rules/branches/{branch}")),
      Effect.map((rules) =>
        pipe(
          rules,
          A.filter((rule) => rule.type === "required_status_checks"),
          A.flatMap((rule) => rule.parameters?.required_status_checks ?? []),
          A.map((check) => check.context),
          A.dedupe
        )
      )
    );

  const readyForReviewAt = (number: number) =>
    client.paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/timeline", { ...at, issue_number: number }).pipe(
      Effect.flatMap(
        decodeWith(S.Array(TimelineEventWire), "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline")
      ),
      Effect.map((events) =>
        pipe(
          events,
          A.filter((event) => event.event === "ready_for_review"),
          A.map((event) => utcFromIso(event.created_at)),
          A.getSomes,
          A.last
        )
      )
    );

  const commitCommittedAt = (sha: string) =>
    client
      .requestDecoded("GET /repos/{owner}/{repo}/commits/{ref}", { ...at, ref: sha }, CommitWire)
      .pipe(
        Effect.flatMap((commit) =>
          Effect.fromOption(utcFromIso(commit.commit.committer?.date), () =>
            GitHubError.decode("GET /repos/{owner}/{repo}/commits/{ref}", "commit has no committer date")
          )
        )
      );

  const mergePullRequest = (
    number: number,
    options: {
      readonly sha: string;
      readonly commitTitle: string;
      readonly commitMessage: string;
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
          commit_title: options.commitTitle,
          commit_message: options.commitMessage,
        },
        MergeWire
      )
      .pipe(Effect.map((merge) => GithubMergeRecord.make(merge)));

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
    cancelWorkflowRun,
    checkRuns,
    commitCommittedAt,
    createIssueComment,
    mergePullRequest,
    openPullRequestForBranch,
    pullRequest,
    rateLimit,
    readyForReviewAt,
    hasReviewComments,
    removeLabel,
    rerunFailedJobs,
    requiredStatusContexts,
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
