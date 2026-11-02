/**
 * Yeet status vocabulary shared by `yeet status` and the merge-readiness
 * policy: artifact summaries, review-thread rows and the remote pull request
 * summary.
 *
 * **Details**
 *
 * Split from `Status.ts` so merge readiness reads the status shapes without
 * importing the status command's `gh` and git reads (beep-cli-composition
 * W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { YeetCommandError } from "../Yeet.errors.ts";
import { YeetReviewWindow } from "./ReviewWindow.ts";
import { YeetWatchCheck } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Status.schemas");

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
 * One verdict lane that recorded a Turbo-derived input digest (C3.6 per-lane hashes).
 *
 * **Example** (Name a lane digest)
 *
 * ```ts
 * import { YeetStatusLaneDigest } from "@beep/repo-cli/test/Yeet"
 *
 * const lane = YeetStatusLaneDigest.make({ id: "quality:fallow", inputDigest: "0d5970886d36b416" })
 * console.log(lane.id) // "quality:fallow"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStatusLaneDigest extends S.Opaque<YeetStatusLaneDigest, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.String, inputDigest: S.String }).pipe(
    $I.annoteSchema("YeetStatusLaneDigest", { description: "Lane id and the input digest its Turbo summary produced." })
  )
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
 * `issueCount` is every closeout issue; `gateIssues` names the ones a
 * review-bot gate raised (the Greptile score and issue-count gates). Merge
 * readiness charges the rest to `threads-resolved` and only displays
 * `gateIssues`, since review-bot gates are advisory. A summary without
 * `gateIssues` predates the split and charges every issue to threads, as
 * status always did before.
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
export class YeetStatusArtifact extends S.Opaque<YeetStatusArtifact, { readonly brand: unique symbol }>()(
  S.Struct({
    detail: S.String,
    path: S.String,
    state: YeetStatusArtifactState,
    issueCount: S.optionalKey(S.Finite),
    gateIssues: S.String.pipe(S.Array, S.optionalKey),
    mode: S.optionalKey(S.String),
    outcome: S.optionalKey(S.String),
    repairCommand: S.optionalKey(S.String),
    reviewedHeadSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    schemaVersion: S.optionalKey(S.String),
    greptileScore: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    laneDigests: YeetStatusLaneDigest.pipe(S.Array, S.optionalKey),
  }).pipe(
    $I.annoteSchema("YeetStatusArtifact", {
      description: "Compact summary for a Yeet artifact read by status, including closeout head binding.",
    })
  )
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
export class YeetStatusReviewThread extends S.Opaque<YeetStatusReviewThread, { readonly brand: unique symbol }>()(
  S.Struct({
    threadId: S.String,
    author: S.String,
    excerpt: S.String,
    path: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    line: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    commentDatabaseId: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetStatusReviewThread", {
      description: "One unresolved pull request review thread with the context needed to triage and reply to it.",
    })
  )
) {}

const yeetStatusRemoteChecksDefault = A.empty<YeetWatchCheck>();

const yeetStatusRemoteLabelsDefault = A.empty<string>();

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
export class YeetStatusRemote extends S.Opaque<YeetStatusRemote, { readonly brand: unique symbol }>()(
  S.Struct({
    available: S.Boolean,
    checked: S.Boolean,
    detail: S.String,
    // None on a complete read (including a confirmed absent PR).
    readFailure: YeetCommandError.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    // Each check's whole record (signal, link, workflow, GitHub's instants), so
    // a row the merge loop writes carries the same capsule a --watch row does.
    // The key default keeps artifacts written before checks existed decoding.
    checks: YeetWatchCheck.pipe(
      S.Array,
      S.withConstructorDefault(Effect.succeed(yeetStatusRemoteChecksDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(yeetStatusRemoteChecksDefault))
    ),
    checkCount: S.optionalKey(S.Finite),
    failingCheckCount: S.optionalKey(S.Finite),
    isDraft: S.optionalKey(S.Boolean),
    isCrossRepository: S.optionalKey(S.Boolean),
    labels: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(yeetStatusRemoteLabelsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(yeetStatusRemoteLabelsDefault))
    ),
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
    unresolvedThreads: S.Array(YeetStatusReviewThread).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    followUpThreadCount: S.optionalKey(S.Finite),
    followUpThreads: S.Array(YeetStatusReviewThread).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    acknowledgedThreadCount: S.optionalKey(S.Finite),
    acknowledgedThreads: S.Array(YeetStatusReviewThread).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    headSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    rerunFailedCommand: S.optionalKey(S.String),
    rerunFailedDecision: S.optionalKey(S.String),
    reviewDecision: S.optionalKey(S.String),
    // The review window of the merge gate, read only once it is the last
    // criterion standing; absent means unread, which never counts as elapsed.
    reviewWindow: YeetReviewWindow.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    state: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("YeetStatusRemote", {
      description: "Optional remote pull request summary for yeet status.",
    })
  )
) {}
