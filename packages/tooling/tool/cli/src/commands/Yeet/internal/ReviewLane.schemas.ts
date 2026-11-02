/**
 * Schemas for the review lane ledger: the facts `yeet economics` measures the
 * review lane with (time-to-certainty ruling 81).
 *
 * **Details**
 *
 * Two numbers are measured, both from facts recorded as they happen rather
 * than reconstructed later. Rounds-to-ready counts the push → re-review
 * cycles between the first `yeet ready` flip and the first `merge-ready: yes`;
 * reviewer precision counts how the pull request author disposed of each
 * review thread. The ledger is append-only and lives in the owning clone, so
 * retiring a lane never deletes the sample; every row names the pull request
 * it belongs to, and the fold deduplicates by the row's own identity
 * (a review's id, a head's sha), so a row recorded twice counts once.
 *
 * **Gotchas**
 *
 * A thread resolved without a declared disposition is `unknown`. Nothing
 * reads a reply body to guess a disposition: `unknown` is a measurement
 * result, never a default that imputes `fixed`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewLane.schemas");

/**
 * Schema version carried by every review lane ledger row.
 *
 * **Example** (Recognise a review lane row)
 *
 * ```ts
 * import { YEET_REVIEW_LANE_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_REVIEW_LANE_SCHEMA_VERSION) // "yeet-review-lane/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_REVIEW_LANE_SCHEMA_VERSION = "yeet-review-lane/v1";

/**
 * File name of the review lane ledger inside the owning clone's `.beep/yeet`.
 *
 * **Example** (Name the ledger)
 *
 * ```ts
 * import { YEET_REVIEW_LANE_LEDGER_FILE_NAME } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(`.beep/yeet/${YEET_REVIEW_LANE_LEDGER_FILE_NAME}`)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_REVIEW_LANE_LEDGER_FILE_NAME = "review-lane.ndjson";

/**
 * How the pull request author disposed of one review thread, including the
 * absence of a declaration.
 *
 * **Details**
 *
 * The four declared values are the reviewer-noise categories the Claude Code
 * team measures by (fixed the issue, rejected it, clarified it as
 * intentional, decided it did not matter). `unknown` is the fifth, recorded
 * when a reply was posted without a declaration; it is never imputed.
 *
 * **Example** (Recognise an undeclared disposition)
 *
 * ```ts
 * import { YeetThreadDisposition } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetThreadDisposition.is.unknown("unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetThreadDisposition = LiteralKit(["fixed", "rejected", "intentional", "immaterial", "unknown"]).pipe(
  $I.annoteSchema("YeetThreadDisposition", {
    title: "Yeet Thread Disposition",
    description:
      "How the pull request author disposed of one review thread: fixed, rejected, intentional, immaterial, or unknown when none was declared.",
  })
);

/**
 * How the pull request author disposed of one review thread.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetThreadDisposition = typeof YeetThreadDisposition.Type;

/**
 * The dispositions a reply draft may declare: every thread disposition except
 * `unknown`, which is what an undeclared draft records.
 *
 * **Example** (Decode a declared disposition)
 *
 * ```ts
 * import { YeetReviewDisposition } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownOption(YeetReviewDisposition)("fixed"))
 * console.log(S.decodeUnknownOption(YeetReviewDisposition)("unknown")) // None
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewDisposition = YeetThreadDisposition.omit(["unknown"]).pipe(
  $I.annoteSchema("YeetReviewDisposition", {
    title: "Yeet Review Disposition",
    description:
      "A disposition a reply draft declares for the thread it answers: fixed, rejected, intentional, or immaterial.",
  })
);

/**
 * A disposition a reply draft declares.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewDisposition = typeof YeetReviewDisposition.Type;

/**
 * Which reviewer a review or a review thread came from, as the precision
 * table groups them.
 *
 * **Details**
 *
 * The three named reviewers are the ones the lane runs with; `human` is every
 * person, and `bot` is any other GitHub App. Classification reads a login and
 * an account type only, never a body.
 *
 * **Example** (Recognise the repository's reviewer app)
 *
 * ```ts
 * import { YeetReviewerKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewerKind.is["beep-reviewer"]("beep-reviewer")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewerKind = LiteralKit(["beep-reviewer", "greptile", "coderabbit", "human", "bot"]).pipe(
  $I.annoteSchema("YeetReviewerKind", {
    title: "Yeet Reviewer Kind",
    description: "Which reviewer a review came from: beep-reviewer, Greptile, CodeRabbit, a person, or another bot.",
  })
);

/**
 * Which reviewer a review came from.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewerKind = typeof YeetReviewerKind.Type;

/**
 * One reviewer: the login GitHub reported and the kind it classifies as.
 *
 * **Example** (Name Greptile)
 *
 * ```ts
 * import { YeetReviewerIdentity } from "@beep/repo-cli/test/Yeet"
 *
 * const reviewer = YeetReviewerIdentity.make({ login: "greptile-apps[bot]", kind: "greptile" })
 * console.log(reviewer.kind) // "greptile"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewerIdentity extends S.Opaque<YeetReviewerIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    login: S.String,
    kind: YeetReviewerKind,
  }).pipe(
    $I.annoteSchema("YeetReviewerIdentity", {
      description: "A reviewer's GitHub login and the reviewer kind it classifies as.",
    })
  )
) {}

const ReviewLanePullRequestNumber = S.Int.check(S.isGreaterThan(0));

// Every row names its schema version, pull request, the branch of the checkout
// that recorded it (what `--branch` narrows on), and when it was recorded.
const reviewLaneRowFields = {
  schemaVersion: S.tag(YEET_REVIEW_LANE_SCHEMA_VERSION),
  prNumber: ReviewLanePullRequestNumber,
  branch: S.String,
  recordedAt: S.String,
} satisfies S.Struct.Fields;

/**
 * `yeet ready` flipped the pull request from draft to ready.
 *
 * **Details**
 *
 * The flip starts the rounds-to-ready window. `headSha` is the head the gate
 * confirmed; the reviewer re-request `yeet ready` pushes next is a later head
 * and arrives as a `review` row's `commitSha`. `author` is the pull request
 * author at flip time: a reply on a thread is a review submission by its
 * author, so the fold counts the author's own submissions beside the rounds,
 * never inside them. It is absent when the flip could not read it, which
 * excludes nothing.
 *
 * **Example** (Record a flip)
 *
 * ```ts
 * import { ReviewLaneFlipRow } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = ReviewLaneFlipRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:00:00.000Z",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   at: "2026-10-27T10:00:00.000Z",
 *   author: O.some("octocat"),
 * })
 * console.log(row._tag) // "flip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneFlipRow extends S.Opaque<ReviewLaneFlipRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("flip", {
    ...reviewLaneRowFields,
    headSha: S.NonEmptyString,
    at: S.String,
    // The pull request author when the flip could read it; the fold keeps the
    // author's own review submissions out of the rounds.
    author: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ReviewLaneFlipRow", {
      description:
        "yeet ready flipped the pull request to ready at this instant, on this head; the pull request author when the flip could read it.",
    })
  )
) {}

/**
 * A monitor observed a new pull request head.
 *
 * **Details**
 *
 * `pushedAt` is the head commit's committer date when GitHub could name it;
 * `observedAt` is when the monitor first saw the head. Heads are the pushes;
 * a head becomes a round only when a review names it.
 *
 * **Example** (Record a head)
 *
 * ```ts
 * import { ReviewLaneHeadRow } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = ReviewLaneHeadRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:05:00.000Z",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   pushedAt: O.some("2026-10-27T10:04:00.000Z"),
 *   observedAt: "2026-10-27T10:05:00.000Z",
 * })
 * console.log(row._tag) // "head"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneHeadRow extends S.Opaque<ReviewLaneHeadRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("head", {
    ...reviewLaneRowFields,
    headSha: S.NonEmptyString,
    pushedAt: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    observedAt: S.String,
  }).pipe(
    $I.annoteSchema("ReviewLaneHeadRow", {
      description: "A monitor first observed this pull request head, with its push instant when known.",
    })
  )
) {}

/**
 * A reviewer submitted a review of the pull request.
 *
 * **Details**
 *
 * Recorded from the REST reviews collection, which returns every review on
 * each poll: `reviewId` is the dedupe key, `commitSha` the head the review
 * was submitted against (absent on a review GitHub no longer pins to a
 * commit), and `state` GitHub's review state. A review with no body is
 * recorded too: an approval with nothing to say is still a review of that
 * head, even though the comment stream prints nothing for it.
 *
 * **Example** (Record a review)
 *
 * ```ts
 * import { ReviewLaneReviewRow, YeetReviewerIdentity } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = ReviewLaneReviewRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:10:00.000Z",
 *   reviewId: 5275652920,
 *   reviewer: YeetReviewerIdentity.make({ login: "beep-reviewer[bot]", kind: "beep-reviewer" }),
 *   commitSha: O.some("0123456789abcdef0123456789abcdef01234567"),
 *   state: "COMMENTED",
 *   submittedAt: "2026-10-27T10:09:00.000Z",
 * })
 * console.log(row._tag) // "review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneReviewRow extends S.Opaque<ReviewLaneReviewRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("review", {
    ...reviewLaneRowFields,
    reviewId: S.Finite,
    reviewer: YeetReviewerIdentity,
    commitSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    state: S.String,
    submittedAt: S.String,
  }).pipe(
    $I.annoteSchema("ReviewLaneReviewRow", {
      description: "A reviewer submitted a review against this head at this instant; the review id deduplicates it.",
    })
  )
) {}

/**
 * A monitor announced `merge-ready: yes` for a head.
 *
 * **Details**
 *
 * The first announcement after the flip closes the rounds-to-ready window.
 *
 * **Example** (Record readiness)
 *
 * ```ts
 * import { ReviewLaneMergeReadyRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = ReviewLaneMergeReadyRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T11:00:00.000Z",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   at: "2026-10-27T11:00:00.000Z",
 * })
 * console.log(row._tag) // "merge-ready"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneMergeReadyRow extends S.Opaque<ReviewLaneMergeReadyRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("merge-ready", {
    ...reviewLaneRowFields,
    headSha: S.NonEmptyString,
    at: S.String,
  }).pipe(
    $I.annoteSchema("ReviewLaneMergeReadyRow", {
      description: "A monitor announced merge-ready: yes for this head at this instant.",
    })
  )
) {}

/**
 * `yeet reply` answered a review thread and recorded how the author disposed
 * of it.
 *
 * **Details**
 *
 * `reviewer` is the author of the thread's opening comment, when GitHub still
 * attributes it; `disposition` is what the draft declared, else `unknown`.
 * A thread answered twice records twice; the fold keeps the latest.
 *
 * **Example** (Record a fixed finding)
 *
 * ```ts
 * import { ReviewLaneDispositionRow, YeetReviewerIdentity } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = ReviewLaneDispositionRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:30:00.000Z",
 *   threadId: "PRRT_kwDOA",
 *   reviewer: O.some(YeetReviewerIdentity.make({ login: "greptile-apps[bot]", kind: "greptile" })),
 *   disposition: "fixed",
 * })
 * console.log(row.disposition) // "fixed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneDispositionRow extends S.Opaque<ReviewLaneDispositionRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("disposition", {
    ...reviewLaneRowFields,
    threadId: S.NonEmptyString,
    reviewer: YeetReviewerIdentity.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    disposition: YeetThreadDisposition,
  }).pipe(
    $I.annoteSchema("ReviewLaneDispositionRow", {
      description:
        "yeet reply answered this thread and recorded the declared disposition, or unknown when the draft declared none.",
    })
  )
) {}

/**
 * One append-only row of the review lane ledger.
 *
 * **Example** (Decode a flip row)
 *
 * ```ts
 * import { ReviewLaneRow } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ReviewLaneRow)({
 *   _tag: "flip",
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:00:00.000Z",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   at: "2026-10-27T10:00:00.000Z",
 * })
 * console.log(decoded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewLaneRow = S.Union([
  ReviewLaneFlipRow,
  ReviewLaneHeadRow,
  ReviewLaneReviewRow,
  ReviewLaneMergeReadyRow,
  ReviewLaneDispositionRow,
]).pipe(
  $I.annoteSchema("ReviewLaneRow", {
    title: "Review Lane Row",
    description:
      "One append-only row of the per-clone review lane ledger: a flip, an observed head, a submitted review, a merge-ready announcement, or a thread disposition.",
  })
);

/**
 * One append-only row of the review lane ledger.
 *
 * @see {@link ReviewLaneRow} for the runtime schema and its variants.
 * @category models
 * @since 0.0.0
 */
export type ReviewLaneRow = typeof ReviewLaneRow.Type;

/**
 * JSON-string codec for one ledger row; the ledger is one row per line.
 *
 * **Example** (Encode a merge-ready row)
 *
 * ```ts
 * import { ReviewLaneMergeReadyRow, ReviewLaneRowJson } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const row = ReviewLaneMergeReadyRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T11:00:00.000Z",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   at: "2026-10-27T11:00:00.000Z",
 * })
 * console.log(Effect.runSync(ReviewLaneRowJson.encode(row)).includes("merge-ready")) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ReviewLaneRowJson = JsonStringCodec(ReviewLaneRow);

/**
 * Everything one ledger file contributes to a report.
 *
 * **Details**
 *
 * `malformedRows` counts terminated lines that did not decode; an
 * unterminated last line is an append still in flight and is not counted.
 * `unreadable` is set when the file exists but could not be read, in which
 * case `rows` is empty.
 *
 * **Example** (An empty ledger)
 *
 * ```ts
 * import { ReviewLaneLedger } from "@beep/repo-cli/test/Yeet"
 *
 * const ledger = ReviewLaneLedger.make({ ledgerPath: "/repo/.beep/yeet/review-lane.ndjson", rows: [], malformedRows: 0 })
 * console.log(ledger.unreadable) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneLedger extends S.Opaque<ReviewLaneLedger, { readonly brand: unique symbol }>()(
  S.Struct({
    ledgerPath: S.String,
    rows: S.Array(ReviewLaneRow),
    malformedRows: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    unreadable: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("ReviewLaneLedger", {
      description: "One review lane ledger file's decoded rows, malformed-row count, and readability.",
    })
  )
) {}
