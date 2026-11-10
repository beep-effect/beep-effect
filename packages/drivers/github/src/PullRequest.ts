/**
 * Pull requests through GitHub's REST and GraphQL APIs.
 *
 * **Details**
 *
 * Reads, lists, creates, updates, upserts, merges and labels pull requests,
 * requests reviewers, turns auto-merge on or off, and adds to, removes from
 * and reads merge-queue entries. REST answers are
 * projected to `PullRequestInfo`, the only pull-request type the package exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { fileOf } from "./GitHubCommit.ts";
import { GitHubError } from "./GitHubError.ts";
import { GraphQLDocument } from "./GraphQL.ts";
import { Repo } from "./Repo.ts";
import { PageOptions } from "./Rest.ts";
import type { CommitFile } from "./GitHubCommit.ts";
import type { GitHubGraphQLError } from "./GraphQL.ts";

const $I = $GithubId.create("PullRequest");

/**
 * How a pull request is merged.
 *
 * **Example** (Validate a squash merge method)
 *
 * ```ts
 * import { MergeMethod } from "@beep/github/PullRequest";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MergeMethod)("squash")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MergeMethod = LiteralKit(["merge", "squash", "rebase"]).pipe(
  $I.annoteSchema("MergeMethod", { description: "How a pull request is merged." })
);

/**
 * The values accepted by {@link MergeMethod}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MergeMethod = typeof MergeMethod.Type;

/**
 * A pull request, projected to what callers read.
 *
 * **Details**
 *
 * This is the **domain** shape, and the only pull-request type this package
 * exports. It flattens GitHub's nested `head`/`base` objects to
 * `head`/`headSha` and `base`/`baseSha`, and spells the link `url`. If you are
 * writing a test double or a fixture, this is the type you build.
 *
 * **Example** (Build an unmerged pull request fixture)
 *
 * ```ts
 * import { PullRequestInfo } from "@beep/github/PullRequest";
 * import * as O from "effect/Option";
 *
 * const pullRequest = PullRequestInfo.make({
 *   number: 123, nodeId: "PR_123", url: "https://github.com/effect-ts/effect/pull/123",
 *   title: "Fix a bug", state: "open", head: "fix", headSha: "abc",
 *   base: "main", baseSha: "def", draft: false, merged: false, mergedAt: O.none(),
 * });
 * console.log(O.isNone(pullRequest.mergedAt)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PullRequestInfo extends S.Opaque<PullRequestInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The number in `#123`. */
    number: S.Int.pipe($I.annoteKey("PullRequestInfo.number", { description: "The number in `#123`." })),
    /** The GraphQL node id, which the auto-merge mutations need. */
    nodeId: S.String.pipe(
      $I.annoteKey("PullRequestInfo.nodeId", {
        description: "The GraphQL node id, which the auto-merge mutations need.",
      })
    ),
    /** The web URL. */
    url: S.String.pipe($I.annoteKey("PullRequestInfo.url", { description: "The web URL." })),
    title: S.String.pipe(
      $I.annoteKey("PullRequestInfo.title", { description: "The pull request's heading as reported by GitHub" })
    ),
    state: S.Literals(["open", "closed"]).pipe(
      $I.annoteKey("PullRequestInfo.state", {
        description: "Whether the pull request is `open` or `closed`, with merge status reported separately",
      })
    ),
    /** The source branch name. */
    head: S.String.pipe($I.annoteKey("PullRequestInfo.head", { description: "The source branch name." })),
    /** The sha the source branch pointed at when GitHub answered. */
    headSha: S.String.pipe(
      $I.annoteKey("PullRequestInfo.headSha", {
        description: "The sha the source branch pointed at when GitHub answered.",
      })
    ),
    /** The target branch name. */
    base: S.String.pipe($I.annoteKey("PullRequestInfo.base", { description: "The target branch name." })),
    /** The sha the target branch pointed at when GitHub answered — the commit the pull request branches from. */
    baseSha: S.String.pipe(
      $I.annoteKey("PullRequestInfo.baseSha", {
        description:
          "The sha the target branch pointed at when GitHub answered — the commit the pull request branches from.",
      })
    ),
    draft: S.Boolean.pipe(
      $I.annoteKey("PullRequestInfo.draft", {
        description: "Whether GitHub marks the pull request as a draft, defaulting to false when omitted",
      })
    ),
    merged: S.Boolean.pipe(
      $I.annoteKey("PullRequestInfo.merged", {
        description:
          "Whether the pull request merged, using GitHub's explicit flag or, when absent, the presence of a merge timestamp",
      })
    ),
    /**
     * When it merged, if it did.
     *
     * **Details**
     *
     * An `Option`, not an optional field. Whether a pull request has merged is a
     * fact GitHub always reports, so modelling it as "maybe absent" would be
     * modelling a gap in our fixtures rather than a gap in the domain.
     */
    mergedAt: S.Option(S.DateTimeUtcFromString).pipe(
      $I.annoteKey("PullRequestInfo.mergedAt", { description: "When it merged, if it did." })
    ),
    /** The description, when GitHub sent one. */
    body: S.optionalKey(S.String).pipe(
      $I.annoteKey("PullRequestInfo.body", { description: "The description, when GitHub sent one." })
    ),
    /** The merge commit, once there is one. */
    mergeCommitSha: S.optionalKey(S.String).pipe(
      $I.annoteKey("PullRequestInfo.mergeCommitSha", { description: "The merge commit, once there is one." })
    ),
  }).pipe($I.annoteSchema("PullRequestInfo", { description: "A pull request, projected to what callers read." }))
) {}

/**
 * What {@link PullRequestShape.upsert} did.
 *
 * **Example** (Validate the upsert result)
 *
 * ```ts
 * import { PullRequestInfo, UpsertedPullRequest } from "@beep/github/PullRequest";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const pullRequest = PullRequestInfo.make({
 *   number: 123, nodeId: "PR_123", url: "https://github.com/effect-ts/effect/pull/123",
 *   title: "Fix a bug", state: "open", head: "fix", headSha: "abc",
 *   base: "main", baseSha: "def", draft: false, merged: false, mergedAt: O.none(),
 * });
 * const result = { pullRequest, created: true };
 * console.log(S.is(UpsertedPullRequest)(result)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class UpsertedPullRequest extends S.Opaque<UpsertedPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The pull request, as created or as updated. */
    pullRequest: PullRequestInfo,
    /** `true` when a new pull request was opened, `false` when an open one was updated. */
    created: S.Boolean.pipe(
      $I.annoteKey("UpsertedPullRequest.created", {
        description: "Whether this operation opened a new pull request rather than updating one.",
      })
    ),
  }).pipe(
    $I.annoteSchema("UpsertedPullRequest", {
      description: "What PullRequest.upsert did: the pull request and whether this call opened it.",
    })
  )
) {}

const AutoMergeResponse = S.Struct({});

const EnableAutoMerge = GraphQLDocument.make({
  name: "enablePullRequestAutoMerge",
  document: `mutation ($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
    clientMutationId
  }
}`,
  response: AutoMergeResponse,
})<{ readonly pullRequestId: string; readonly mergeMethod: string }>();

const DisableAutoMerge = GraphQLDocument.make({
  name: "disablePullRequestAutoMerge",
  document: `mutation ($pullRequestId: ID!) {
  disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) { clientMutationId }
}`,
  response: AutoMergeResponse,
})<{ readonly pullRequestId: string }>();

/** GraphQL spells the merge methods in capitals. */
const GRAPHQL_MERGE_METHOD = { merge: "MERGE", squash: "SQUASH", rebase: "REBASE" } as const;

/**
 * Where a pull request stands in a merge queue.
 *
 * **Details**
 *
 * GitHub's `MergeQueueEntryState`. An entry is `QUEUED` until the queue builds
 * its merge group, `AWAITING_CHECKS` while the group's required checks run,
 * `MERGEABLE` once they pass, `UNMERGEABLE` when it cannot merge, and `LOCKED`
 * while the queue is merging it.
 *
 * **Example** (Validate a queued state)
 *
 * ```ts
 * import { MergeQueueEntryState } from "@beep/github/PullRequest";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MergeQueueEntryState)("AWAITING_CHECKS")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MergeQueueEntryState = LiteralKit([
  "AWAITING_CHECKS",
  "LOCKED",
  "MERGEABLE",
  "QUEUED",
  "UNMERGEABLE",
]).pipe($I.annoteSchema("MergeQueueEntryState", { description: "Where a pull request stands in a merge queue." }));

/**
 * The values accepted by {@link MergeQueueEntryState}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MergeQueueEntryState = typeof MergeQueueEntryState.Type;

/**
 * A pull request's entry in a merge queue, projected to what callers read.
 *
 * **Details**
 *
 * `headOid` and `baseOid` are the merge group's commits. GitHub leaves them
 * empty while the entry is `QUEUED` and fills them once the group is built, so
 * they are `Option`s. With a squash queue the landed commit is `headOid`.
 *
 * **Example** (Build a queued entry fixture)
 *
 * ```ts
 * import { MergeQueueEntry } from "@beep/github/PullRequest";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const entry = MergeQueueEntry.make({
 *   id: "MQE_1", pullRequestNumber: 123, state: "QUEUED", position: 1,
 *   enqueuedAt: DateTime.makeUnsafe("2026-11-10T04:54:37Z"), estimatedTimeToMerge: O.none(),
 *   jump: false, solo: false, enqueuer: O.some("beep-fleet-orchestrator"),
 *   headOid: O.none(), baseOid: O.none(),
 * });
 * console.log(entry.state) // QUEUED
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MergeQueueEntry extends S.Opaque<MergeQueueEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(
      $I.annoteKey("MergeQueueEntry.id", { description: "The entry's GraphQL node id, which dequeue needs." })
    ),
    pullRequestNumber: S.Int.pipe(
      $I.annoteKey("MergeQueueEntry.pullRequestNumber", { description: "The queued pull request's number." })
    ),
    state: MergeQueueEntryState,
    position: S.Int.pipe(
      $I.annoteKey("MergeQueueEntry.position", { description: "The entry's place in the queue, counting from 1." })
    ),
    enqueuedAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("MergeQueueEntry.enqueuedAt", { description: "When the pull request joined the queue." })
    ),
    estimatedTimeToMerge: S.Option(S.Int).pipe(
      $I.annoteKey("MergeQueueEntry.estimatedTimeToMerge", {
        description: "GitHub's estimate, in seconds, of when the entry merges, when it gives one.",
      })
    ),
    jump: S.Boolean.pipe(
      $I.annoteKey("MergeQueueEntry.jump", { description: "Whether the entry was put at the front of the queue." })
    ),
    solo: S.Boolean.pipe(
      $I.annoteKey("MergeQueueEntry.solo", { description: "Whether the entry merges alone, outside any group." })
    ),
    enqueuer: S.Option(S.String).pipe(
      $I.annoteKey("MergeQueueEntry.enqueuer", { description: "The login that queued the pull request." })
    ),
    headOid: S.Option(S.String).pipe(
      $I.annoteKey("MergeQueueEntry.headOid", {
        description: "The merge group's head commit, once the queue has built the group.",
      })
    ),
    baseOid: S.Option(S.String).pipe(
      $I.annoteKey("MergeQueueEntry.baseOid", {
        description: "The base commit the merge group was built on, once the queue has built the group.",
      })
    ),
  }).pipe(
    $I.annoteSchema("MergeQueueEntry", {
      description: "A pull request's entry in a merge queue, projected to what callers read.",
    })
  )
) {}

/** The `MergeQueueEntry` wire shape every queue document selects. */
const WireQueueEntry = S.Struct({
  id: S.String,
  state: MergeQueueEntryState,
  position: S.Int,
  enqueuedAt: S.DateTimeUtcFromString,
  estimatedTimeToMerge: S.OptionFromNullOr(S.Int),
  jump: S.Boolean,
  solo: S.Boolean,
  enqueuer: S.OptionFromNullOr(S.Struct({ login: S.String })),
  headCommit: S.OptionFromNullOr(S.Struct({ oid: S.String })),
  baseCommit: S.OptionFromNullOr(S.Struct({ oid: S.String })),
});

const QUEUE_ENTRY_FIELDS =
  "id state position enqueuedAt estimatedTimeToMerge jump solo enqueuer { login } headCommit { oid } baseCommit { oid }";

const EnqueuePullRequest = GraphQLDocument.make({
  name: "enqueuePullRequest",
  document: `mutation ($pullRequestId: ID!, $expectedHeadOid: GitObjectID, $jump: Boolean) {
  enqueuePullRequest(input: { pullRequestId: $pullRequestId, expectedHeadOid: $expectedHeadOid, jump: $jump }) {
    mergeQueueEntry { ${QUEUE_ENTRY_FIELDS} }
  }
}`,
  response: S.Struct({ enqueuePullRequest: S.Struct({ mergeQueueEntry: S.OptionFromNullOr(WireQueueEntry) }) }),
})<{ readonly pullRequestId: string; readonly expectedHeadOid: string; readonly jump: boolean }>();

const DequeuePullRequest = GraphQLDocument.make({
  name: "dequeuePullRequest",
  document: `mutation ($id: ID!) {
  dequeuePullRequest(input: { id: $id }) {
    mergeQueueEntry { ${QUEUE_ENTRY_FIELDS} }
  }
}`,
  response: S.Struct({ dequeuePullRequest: S.Struct({ mergeQueueEntry: S.OptionFromNullOr(WireQueueEntry) }) }),
})<{ readonly id: string }>();

const ReadQueueEntry = GraphQLDocument.make({
  name: "pullRequestMergeQueueEntry",
  document: `query ($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      mergeQueueEntry { ${QUEUE_ENTRY_FIELDS} }
    }
  }
}`,
  response: S.Struct({
    repository: S.OptionFromNullOr(
      S.Struct({ pullRequest: S.OptionFromNullOr(S.Struct({ mergeQueueEntry: S.OptionFromNullOr(WireQueueEntry) })) })
    ),
  }),
})<{ readonly owner: string; readonly name: string; readonly number: number }>();

const entryOf = (pullRequestNumber: number, wire: typeof WireQueueEntry.Type): MergeQueueEntry =>
  MergeQueueEntry.make({
    id: wire.id,
    pullRequestNumber,
    state: wire.state,
    position: wire.position,
    enqueuedAt: wire.enqueuedAt,
    estimatedTimeToMerge: wire.estimatedTimeToMerge,
    jump: wire.jump,
    solo: wire.solo,
    enqueuer: O.map(wire.enqueuer, (actor) => actor.login),
    headOid: O.map(wire.headCommit, (commit) => commit.oid),
    baseOid: O.map(wire.baseCommit, (commit) => commit.oid),
  });

/**
 * Read, list, create, update, merge and label pull requests, and control
 * auto-merge.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface PullRequestShape {
  /**
   * Add labels to a pull request (as an issue), keeping the ones already there.
   *
   * **Example** (Construct a addLabels operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.addLabels(123, ["bug"]);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly addLabels: {
    (number: number, labels: ReadonlyArray<string>): Effect.Effect<void, GitHubError, Repo>;
    (labels: ReadonlyArray<string>): (number: number) => Effect.Effect<void, GitHubError, Repo>;
  };
  /**
   * Open a pull request from `head` into `base`.
   *
   * **Example** (Construct a create operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.create({ title: "Fix a bug", head: "fix", base: "main" });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly create: (input: {
    readonly title: string;
    readonly head: string;
    readonly base: string;
    readonly body?: string | undefined;
    readonly draft?: boolean | undefined;
  }) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
  /**
   * Remove a queue entry from its merge queue.
   *
   * **Details**
   *
   * Takes the entry, as {@link PullRequestShape.mergeQueueEntry} or
   * {@link PullRequestShape.enqueuePullRequest} returned it, because GitHub's
   * mutation is keyed by the entry's id. Answers the entry GitHub reports back,
   * if it reports one. Removing an entry rebuilds every group behind it.
   *
   * **Example** (Dequeue an entry)
   *
   * ```ts
   * import { MergeQueueEntry, PullRequest } from "@beep/github/PullRequest";
   * import * as DateTime from "effect/DateTime";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const entry = MergeQueueEntry.make({
   *   id: "MQE_1", pullRequestNumber: 123, state: "QUEUED", position: 1,
   *   enqueuedAt: DateTime.makeUnsafe("2026-11-10T04:54:37Z"), estimatedTimeToMerge: O.none(),
   *   jump: false, solo: false, enqueuer: O.none(), headOid: O.none(), baseOid: O.none(),
   * });
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.dequeuePullRequest(entry);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly dequeuePullRequest: (
    entry: MergeQueueEntry
  ) => Effect.Effect<O.Option<MergeQueueEntry>, GitHubGraphQLError, Repo>;
  /**
   * Add a pull request to its base branch's merge queue.
   *
   * **Details**
   *
   * The queue is pinned to `pullRequest.headSha` unless `expectedHeadOid` says
   * otherwise, so a push after the caller read the pull request fails the call
   * instead of queueing a head nobody proved. GitHub refuses the call, as a
   * `GitHubGraphQLError`, when the pull request cannot be queued now; there is
   * no auto-merge fallback. `jump` puts the entry at the front and rebuilds
   * every group already building.
   *
   * **Gotchas**
   *
   * The queue writes the squash commit itself: merge-method, title and body
   * inputs do not exist on this call. An App installation token can enqueue
   * without a "merge queues" permission, and the queue merges a pull request
   * that edits workflow files even when the enqueuer has no `workflows`
   * permission (`goals/merge-queue-lab` findings 10c).
   *
   * **Example** (Queue a pull request at its read head)
   *
   * ```ts
   * import { PullRequest, PullRequestInfo } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const pullRequest = PullRequestInfo.make({
   *   number: 123, nodeId: "PR_123", url: "https://github.com/effect-ts/effect/pull/123",
   *   title: "Fix a bug", state: "open", head: "fix", headSha: "abc",
   *   base: "main", baseSha: "def", draft: false, merged: false, mergedAt: O.none(),
   * });
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.enqueuePullRequest(pullRequest);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly enqueuePullRequest: (
    pullRequest: PullRequestInfo,
    options?: {
      readonly expectedHeadOid?: string | undefined;
      readonly jump?: boolean | undefined;
    }
  ) => Effect.Effect<O.Option<MergeQueueEntry>, GitHubGraphQLError, Repo>;
  /**
   * Read one pull request. Fails `notFound` when it does not exist.
   *
   * **Example** (Construct a get operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.get(123);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly get: (number: number) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
  /**
   * Open, closed or all pull requests, optionally filtered.
   *
   * **Gotchas**
   *
   * `head` accepts **either** the qualified `owner:ref` GitHub's filter wants
   * or a bare `ref`, which is qualified with the current repo's owner on the
   * way out. So for a pull request opened **from the current repository**,
   * feeding this method `PullRequestInfo.head` (the bare branch name)
   * round-trips correctly; GitHub's own route ignores an unqualified ref.
   *
   * **The round trip does not hold for a fork-originated pull request.**
   * `PullRequestInfo` projects only the ref and drops the source owner, so
   * qualifying it here prefixes the *current* repo's owner and names a branch
   * in the wrong account — the filter then matches nothing, silently. When the
   * head may live in a fork, pass a qualified `owner:ref` built from the source
   * owner rather than from anything this projection carries.
   *
   * **Example** (Construct a list operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.list({ head: "effect-ts:fix", state: "open" });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly list: (options?: {
    readonly head?: string | undefined;
    readonly base?: string | undefined;
    readonly state?: "open" | "closed" | "all" | undefined;
    readonly page?: PageOptions | undefined;
  }) => Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError, Repo>;
  /**
   * The pull requests associated with a commit.
   *
   * **Details**
   *
   * Paginated: pass `page` to bound the walk.
   *
   * **Example** (Construct a listAssociatedWithCommit operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.listAssociatedWithCommit("abc123");
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly listAssociatedWithCommit: {
    (
      sha: string,
      options?: { readonly page?: PageOptions | undefined }
    ): Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError, Repo>;
    (options?: {
      readonly page?: PageOptions | undefined;
    }): (sha: string) => Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError, Repo>;
  };
  /**
   * The files a pull request changes.
   *
   * **Details**
   *
   * Each entry is a full {@link CommitFile} — path **and** status, plus the
   * line counts and any pre-rename path — the same projection
   * `GitHubCommit.changedFiles` returns, because GitHub answers both
   * endpoints with the same `diff-entry` shape.
   *
   * **Example** (Construct a listFiles operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.listFiles(123);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly listFiles: {
    (
      number: number,
      options?: { readonly page?: PageOptions | undefined }
    ): Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
    (options?: {
      readonly page?: PageOptions | undefined;
    }): (number: number) => Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
  };
  /**
   * Merge a pull request and return the merge commit sha. `method` defaults to GitHub's choice.
   *
   * **Example** (Construct a merge operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.merge(123, { method: "squash" });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly merge: {
    (
      number: number,
      options?: {
        readonly method?: MergeMethod | undefined;
        readonly commitTitle?: string | undefined;
        readonly commitMessage?: string | undefined;
      }
    ): Effect.Effect<string, GitHubError, Repo>;
    (options?: {
      readonly method?: MergeMethod | undefined;
      readonly commitTitle?: string | undefined;
      readonly commitMessage?: string | undefined;
    }): (number: number) => Effect.Effect<string, GitHubError, Repo>;
  };
  /**
   * Read a pull request's merge-queue entry, if it is queued.
   *
   * **Details**
   *
   * One GraphQL read. `Option.none()` means the pull request is not in a queue
   * (never queued, merged, or removed) or does not exist; GitHub has no REST
   * read of a queue.
   *
   * **Example** (Read a queue entry)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.mergeQueueEntry(123);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly mergeQueueEntry: (number: number) => Effect.Effect<O.Option<MergeQueueEntry>, GitHubGraphQLError, Repo>;
  /**
   * Request reviews from users and/or teams (team slugs).
   *
   * **Example** (Construct a requestReviewers operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.requestReviewers(123, { users: ["octocat"] });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly requestReviewers: {
    (
      number: number,
      reviewers: {
        readonly users?: ReadonlyArray<string> | undefined;
        readonly teams?: ReadonlyArray<string> | undefined;
      }
    ): Effect.Effect<void, GitHubError, Repo>;
    (reviewers: {
      readonly users?: ReadonlyArray<string> | undefined;
      readonly teams?: ReadonlyArray<string> | undefined;
    }): (number: number) => Effect.Effect<void, GitHubError, Repo>;
  };
  /**
   * Turn auto-merge on or off.
   *
   * **Details**
   *
   * An explicit call, not an option on `create`/`update`, so a create that
   * worked is never reported as failed because auto-merge was refused. Pass
   * `"off"` to disable it.
   *
   * **Example** (Construct a setAutoMerge operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   * import { PullRequestInfo } from "@beep/github/PullRequest";
   * import * as O from "effect/Option";
   *
   * const pullRequest = PullRequestInfo.make({
   *   number: 123, nodeId: "PR_123", url: "https://github.com/effect-ts/effect/pull/123",
   *   title: "Fix a bug", state: "open", head: "fix", headSha: "abc",
   *   base: "main", baseSha: "def", draft: false, merged: false, mergedAt: O.none(),
   * });
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.setAutoMerge(pullRequest, "off");
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly setAutoMerge: {
    (pullRequest: PullRequestInfo, method: MergeMethod | "off"): Effect.Effect<void, GitHubGraphQLError, Repo>;
    (method: MergeMethod | "off"): (pullRequest: PullRequestInfo) => Effect.Effect<void, GitHubGraphQLError, Repo>;
  };
  /**
   * Patch a pull request; only the fields given are sent.
   *
   * **Example** (Construct a update operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.update(123, { title: "Fix a bug" });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly update: {
    (
      number: number,
      patch: {
        readonly title?: string | undefined;
        readonly body?: string | undefined;
        readonly state?: "open" | "closed" | undefined;
        readonly base?: string | undefined;
      }
    ): Effect.Effect<PullRequestInfo, GitHubError, Repo>;
    (patch: {
      readonly title?: string | undefined;
      readonly body?: string | undefined;
      readonly state?: "open" | "closed" | undefined;
      readonly base?: string | undefined;
    }): (number: number) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
  };
  /**
   * Update the open pull request for `head`→`base`, or open one.
   *
   * **Gotchas**
   *
   * When a pull request is already open, only `title` and `body` are updated;
   * `draft` applies only when a new pull request is opened.
   *
   * **Example** (Construct a upsert operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   return yield* pulls.upsert({ title: "Fix a bug", head: "fix", base: "main" });
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category commands
   * @since 0.0.0
   */
  readonly upsert: (input: {
    readonly title: string;
    readonly head: string;
    readonly base: string;
    readonly body?: string | undefined;
    readonly draft?: boolean | undefined;
  }) => Effect.Effect<UpsertedPullRequest, GitHubError, Repo>;
}

/**
 * Read, list, create, update, merge and label pull requests, and control
 * auto-merge.
 *
 * **Details**
 *
 * Provide it with {@link PullRequest.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * **Example** (Upsert a release pull request and enable squash auto-merge)
 *
 * ```ts
 * import { PullRequest } from "@beep/github/PullRequest";
 * import * as Effect from "effect/Effect";
 *
 * const openOrUpdate = Effect.gen(function* () {
 *   const pulls = yield* PullRequest;
 *   const { pullRequest, created } = yield* pulls.upsert({
 *     title: "chore: release",
 *     head: "changeset-release/main",
 *     base: "main",
 *   });
 *   yield* pulls.setAutoMerge(pullRequest, "squash");
 *   return created;
 * });
 * console.log(Effect.isEffect(openOrUpdate)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PullRequest extends Context.Service<PullRequest, PullRequestShape>()($I`PullRequest`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Compose the live service layer)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(PullRequest.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PullRequest, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub a merge operation)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   * import * as P from "effect/Predicate";
   *
   * const pulls = PullRequest.makeTest({
   *   merge: dual((args) => P.isNumber(args[0]), (_number: number, _options?: object) => Effect.succeed("abc123")),
   * });
   * const program = pulls.merge(123);
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<PullRequestShape> = {}): PullRequestShape => ({
    ...unstubbedShape(),
    ...overrides,
  });

  /**
   * {@link PullRequest.makeTest} behind a `Layer`.
   *
   * **Example** (Run a label operation with a test layer)
   *
   * ```ts
   * import { PullRequest } from "@beep/github/PullRequest";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   *
   * const program = Effect.gen(function* () {
   *   const pulls = yield* PullRequest;
   *   yield* pulls.addLabels(123, ["bug"]);
   *   return "labels added";
   * });
   * const layer = PullRequest.layerTest({
   *   addLabels: dual(2, (_number: number, _labels: ReadonlyArray<string>) => Effect.void),
   * });
   * console.log(Effect.runSync(Effect.provide(program, layer))) // labels added
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<PullRequestShape> = {}): Layer.Layer<PullRequest> =>
    Layer.succeed(PullRequest, PullRequest.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "PullRequest" });

/**
 * Every member unstubbed, each dying with its own name when called.
 *
 * **Details**
 *
 * A function rather than a constant because `makeTest` is a static initializer
 * that runs while the module body is still evaluating; the shape is only built
 * when a test double is requested. `exactOptionalPropertyTypes` keeps an
 * override from spreading an explicit `undefined` over a member.
 */
const unstubbedShape = (): PullRequestShape => ({
  get: () => unstubbed("get"),
  list: () => unstubbed("list"),
  listFiles: () => unstubbed("listFiles"),
  listAssociatedWithCommit: () => unstubbed("listAssociatedWithCommit"),
  create: () => unstubbed("create"),
  update: () => unstubbed("update"),
  upsert: () => unstubbed("upsert"),
  merge: () => unstubbed("merge"),
  addLabels: () => unstubbed("addLabels"),
  requestReviewers: () => unstubbed("requestReviewers"),
  setAutoMerge: () => unstubbed("setAutoMerge"),
  enqueuePullRequest: () => unstubbed("enqueuePullRequest"),
  dequeuePullRequest: () => unstubbed("dequeuePullRequest"),
  mergeQueueEntry: () => unstubbed("mergeQueueEntry"),
});

/**
 * The raw REST wire shape, as GitHub answers it — **not** the domain type.
 * {@link PullRequestInfo} is what callers read; `project` below is the one
 * conversion between them. Private on purpose: nothing outside this module
 * should hold a value of this shape.
 */
interface RawPull {
  readonly base: { readonly ref: string; readonly sha: string };
  readonly body?: string | null | undefined;
  readonly draft?: boolean | undefined;
  readonly head: { readonly ref: string; readonly sha: string };
  readonly html_url: string;
  readonly merge_commit_sha?: string | null | undefined;
  readonly merged?: boolean | undefined;
  readonly merged_at?: string | null | undefined;
  readonly node_id: string;
  readonly number: number;
  readonly state: string;
  readonly title: string;
}

const project = (raw: RawPull): Effect.Effect<PullRequestInfo, GitHubError> =>
  Effect.try({
    try: () =>
      PullRequestInfo.make({
        number: raw.number,
        nodeId: raw.node_id,
        url: raw.html_url,
        title: raw.title,
        state: raw.state === "closed" ? "closed" : "open",
        head: raw.head.ref,
        headSha: raw.head.sha,
        base: raw.base.ref,
        baseSha: raw.base.sha,
        draft: raw.draft ?? false,
        merged: raw.merged ?? raw.merged_at != null,
        // Constructed rather than decoded: the Type side of
        // `Schema.Option(DateTimeUtcFromString)` is an `Option<DateTime.Utc>`,
        // and GitHub's wire form is a nullable ISO string — two different
        // shapes, so the conversion belongs here rather than in a codec that
        // would have to describe GitHub's encoding as if it were ours.
        mergedAt: raw.merged_at == null ? O.none() : O.some(DateTime.makeUnsafe(raw.merged_at)),
        ...(raw.body != null ? { body: raw.body } : {}),
        ...(raw.merge_commit_sha != null ? { mergeCommitSha: raw.merge_commit_sha } : {}),
      }),
    catch: (error) => GitHubError.decode("PullRequest", "GitHub returned an unexpected pull request", error),
  });

/** `owner:branch` is what GitHub's `head` filter wants for a cross-fork search. */
const qualifyHead: {
  (head: string, owner: string): string;
  (owner: string): (head: string) => string;
} = dual(2, (head: string, owner: string): string => (Str.includes(":")(head) ? head : `${owner}:${head}`));

const make = (client: GitHubClient["Service"]): PullRequestShape => {
  const list = Effect.fn("PullRequest.list")(function* (options?: {
    readonly head?: string | undefined;
    readonly base?: string | undefined;
    readonly state?: "open" | "closed" | "all" | undefined;
    readonly page?: PageOptions | undefined;
  }) {
    const { owner, repo } = yield* Repo;
    const raw = yield* client.paginate(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner,
        repo,
        ...O.getSomesStruct({ state: O.fromUndefinedOr(options?.state) }),
        ...O.getSomesStruct({ head: O.map(O.fromUndefinedOr(options?.head), qualifyHead(owner)) }),
        ...O.getSomesStruct({ base: O.fromUndefinedOr(options?.base) }),
      },
      options?.page
    );
    return yield* Effect.forEach(raw, project);
  });

  const create = Effect.fn("PullRequest.create")(function* (input: {
    readonly title: string;
    readonly head: string;
    readonly base: string;
    readonly body?: string | undefined;
    readonly draft?: boolean | undefined;
  }) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, head: input.head, base: input.base });
    const created = yield* client.request("POST /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      title: input.title,
      head: input.head,
      base: input.base,
      ...O.getSomesStruct({ body: O.fromUndefinedOr(input.body) }),
      ...O.getSomesStruct({ draft: O.fromUndefinedOr(input.draft) }),
    });
    return yield* project(created);
  });

  const update: PullRequestShape["update"] = dual(
    2,
    Effect.fn("PullRequest.update")(function* (
      number: number,
      patch: {
        readonly title?: string | undefined;
        readonly body?: string | undefined;
        readonly state?: "open" | "closed" | undefined;
        readonly base?: string | undefined;
      }
    ) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, number });
      const updated = yield* client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
        // Conditional spreads, not `...patch`: under exactOptionalPropertyTypes a
        // present-but-undefined key is not the same as an absent one, and octokit's
        // generated parameter types say so.
        ...O.getSomesStruct({ title: O.fromUndefinedOr(patch.title) }),
        ...O.getSomesStruct({ body: O.fromUndefinedOr(patch.body) }),
        ...O.getSomesStruct({ state: O.fromUndefinedOr(patch.state) }),
        ...O.getSomesStruct({ base: O.fromUndefinedOr(patch.base) }),
      });
      return yield* project(updated);
    })
  );

  return {
    list,
    create,
    update,

    get: Effect.fn("PullRequest.get")(function* (number: number) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, number });
      const raw = yield* client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: number,
      });
      return yield* project(raw);
    }),

    listFiles: dual(
      (args) => P.isNumber(args[0]),
      Effect.fn("PullRequest.listFiles")(function* (
        number: number,
        options?: { readonly page?: PageOptions | undefined }
      ) {
        const { owner, repo } = yield* Repo;
        yield* Effect.annotateCurrentSpan({ owner, repo, number });
        const files = yield* client.paginate(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
          { owner, repo, pull_number: number },
          options?.page
        );
        // The same `diff-entry` wire shape the single-commit read answers with,
        // so the same projection turns it into `CommitFile`s.
        return yield* Effect.forEach(files, fileOf("PullRequest.listFiles"));
      })
    ),

    listAssociatedWithCommit: dual(
      (args) => P.isString(args[0]),
      Effect.fn("PullRequest.listAssociatedWithCommit")(function* (
        sha: string,
        options?: { readonly page?: PageOptions | undefined }
      ) {
        const { owner, repo } = yield* Repo;
        yield* Effect.annotateCurrentSpan({ owner, repo, sha });
        const raw = yield* client.paginate(
          "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
          { owner, repo, commit_sha: sha },
          options?.page
        );
        return yield* Effect.forEach(raw, project);
      })
    ),

    upsert: Effect.fn("PullRequest.upsert")(function* (input: {
      readonly title: string;
      readonly head: string;
      readonly base: string;
      readonly body?: string | undefined;
      readonly draft?: boolean | undefined;
    }) {
      const existing = yield* list({
        head: input.head,
        base: input.base,
        state: "open",
        page: PageOptions.make({ perPage: 1, maxPages: 1 }),
      });
      const found = existing[0];
      if (found === undefined) {
        return UpsertedPullRequest.make({ pullRequest: yield* create(input), created: true });
      }
      const patch = {
        title: input.title,
        ...O.getSomesStruct({ body: O.fromUndefinedOr(input.body) }),
      };
      return UpsertedPullRequest.make({ pullRequest: yield* update(found.number, patch), created: false });
    }),

    merge: dual(
      (args) => P.isNumber(args[0]),
      Effect.fn("PullRequest.merge")(function* (
        number: number,
        options?: {
          readonly method?: MergeMethod | undefined;
          readonly commitTitle?: string | undefined;
          readonly commitMessage?: string | undefined;
        }
      ) {
        const { owner, repo } = yield* Repo;
        yield* Effect.annotateCurrentSpan({ owner, repo, number, method: options?.method ?? "merge" });
        const merged = yield* client.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
          owner,
          repo,
          pull_number: number,
          ...O.getSomesStruct({ merge_method: O.fromUndefinedOr(options?.method) }),
          ...O.getSomesStruct({ commit_title: O.fromUndefinedOr(options?.commitTitle) }),
          ...O.getSomesStruct({ commit_message: O.fromUndefinedOr(options?.commitMessage) }),
        });
        return merged.sha;
      })
    ),

    addLabels: dual(
      2,
      Effect.fn("PullRequest.addLabels")(function* (number: number, labels: ReadonlyArray<string>) {
        const { owner, repo } = yield* Repo;
        yield* Effect.annotateCurrentSpan({ owner, repo, number, labels: labels.length });
        yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
          owner,
          repo,
          issue_number: number,
          labels: [...labels],
        });
      })
    ),

    requestReviewers: dual(
      2,
      Effect.fn("PullRequest.requestReviewers")(function* (
        number: number,
        reviewers: {
          readonly users?: ReadonlyArray<string> | undefined;
          readonly teams?: ReadonlyArray<string> | undefined;
        }
      ) {
        const { owner, repo } = yield* Repo;
        yield* Effect.annotateCurrentSpan({ owner, repo, number });
        yield* client.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
          owner,
          repo,
          pull_number: number,
          ...O.getSomesStruct({ reviewers: O.map(O.fromUndefinedOr(reviewers.users), (values) => [...values]) }),
          ...O.getSomesStruct({ team_reviewers: O.map(O.fromUndefinedOr(reviewers.teams), (values) => [...values]) }),
        });
      })
    ),

    setAutoMerge: dual(
      2,
      Effect.fn("PullRequest.setAutoMerge")(function* (pullRequest: PullRequestInfo, method: MergeMethod | "off") {
        yield* Effect.annotateCurrentSpan({ number: pullRequest.number, method });
        if (method === "off") {
          yield* client.graphql(DisableAutoMerge, { pullRequestId: pullRequest.nodeId });
          return;
        }
        yield* client.graphql(EnableAutoMerge, {
          pullRequestId: pullRequest.nodeId,
          mergeMethod: GRAPHQL_MERGE_METHOD[method],
        });
      })
    ),

    enqueuePullRequest: Effect.fn("PullRequest.enqueuePullRequest")(function* (
      pullRequest: PullRequestInfo,
      options?: {
        readonly expectedHeadOid?: string | undefined;
        readonly jump?: boolean | undefined;
      }
    ) {
      const expectedHeadOid = options?.expectedHeadOid ?? pullRequest.headSha;
      const jump = options?.jump ?? false;
      yield* Effect.annotateCurrentSpan({ number: pullRequest.number, expectedHeadOid, jump });
      const response = yield* client.graphql(EnqueuePullRequest, {
        pullRequestId: pullRequest.nodeId,
        expectedHeadOid,
        jump,
      });
      return O.map(response.enqueuePullRequest.mergeQueueEntry, (wire) => entryOf(pullRequest.number, wire));
    }),

    dequeuePullRequest: Effect.fn("PullRequest.dequeuePullRequest")(function* (entry: MergeQueueEntry) {
      yield* Effect.annotateCurrentSpan({ number: entry.pullRequestNumber, entry: entry.id });
      const response = yield* client.graphql(DequeuePullRequest, { id: entry.id });
      return O.map(response.dequeuePullRequest.mergeQueueEntry, (wire) => entryOf(entry.pullRequestNumber, wire));
    }),

    mergeQueueEntry: Effect.fn("PullRequest.mergeQueueEntry")(function* (number: number) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, number });
      const response = yield* client.graphql(ReadQueueEntry, { owner, name: repo, number });
      return response.repository.pipe(
        O.flatMap((repository) => repository.pullRequest),
        O.flatMap((pull) => pull.mergeQueueEntry),
        O.map((wire) => entryOf(number, wire))
      );
    }),
  };
};
