/**
 * Reviewer wire contracts. Every codec is compiled at module scope.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Reviewer/Reviewer.schemas");

/**
 * Credentials resolved from environment or 1Password; the signing key stays redacted.
 *
 * **Example** (Inspect a credential decoder)
 * ```ts
 * import { ReviewerCredentials } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerCredentials.fields.clientId.ast._tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerCredentials extends S.Class<ReviewerCredentials, { readonly brand: unique symbol }>(
  $I`ReviewerCredentials`
)(
  {
    appId: S.Int.check(S.isGreaterThan(0)),
    clientId: S.NonEmptyString,
    installationId: S.Int.check(S.isGreaterThan(0)),
    privateKey: S.Redacted(S.String),
  },
  $I.annote("ReviewerCredentials", { description: "GitHub App identity and redacted signing key." })
) {}

/**
 * One line annotation accepted by the Checks API.
 *
 * **Example** (Construct an annotation)
 * ```ts
 * import { ReviewerAnnotation } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerAnnotation.make({ path: "README.md", start_line: 1, end_line: 1,
 *   annotation_level: "warning", message: "Clarify this sentence" }).path);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerAnnotation extends S.Class<ReviewerAnnotation, { readonly brand: unique symbol }>(
  $I`ReviewerAnnotation`
)(
  {
    path: S.NonEmptyString,
    start_line: S.Int.check(S.isGreaterThan(0)),
    end_line: S.Int.check(S.isGreaterThan(0)),
    annotation_level: S.Literals(["notice", "warning", "failure"]),
    message: S.NonEmptyString,
    title: S.optionalKey(S.String),
  },
  $I.annote("ReviewerAnnotation", { description: "A GitHub Check Run line annotation." })
) {}

/**
 * A COMMENT review's inline remark, anchored to the supplied head commit.
 *
 * **Example** (Construct an inline remark)
 * ```ts
 * import { ReviewerInlineComment } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerInlineComment.make({ path: "README.md", line: 1, side: "RIGHT", body: "Explain why" }).line);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerInlineComment extends S.Class<ReviewerInlineComment, { readonly brand: unique symbol }>(
  $I`ReviewerInlineComment`
)(
  {
    path: S.NonEmptyString,
    line: S.Int.check(S.isGreaterThan(0)),
    side: S.Literals(["LEFT", "RIGHT"]),
    body: S.NonEmptyString,
    start_line: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
    start_side: S.optionalKey(S.Literals(["LEFT", "RIGHT"])),
  },
  $I.annote("ReviewerInlineComment", { description: "A diff-anchored review comment." })
) {}

/**
 * Review input deliberately excludes approval and change-request events.
 *
 * **Example** (Construct a comment review)
 * ```ts
 * import { ReviewerReview } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerReview.make({ body: "Two suggestions", comments: [] }).body);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerReview extends S.Class<ReviewerReview, { readonly brand: unique symbol }>($I`ReviewerReview`)(
  {
    body: S.NonEmptyString,
    comments: S.Array(ReviewerInlineComment),
    event: S.optionalKey(S.Literal("COMMENT")),
  },
  $I.annote("ReviewerReview", { description: "Input for a COMMENT-only GitHub review." })
) {}

/**
 * A changed PR path and its rename source, used to classify L0 reviews.
 *
 * **Example** (Describe a rename)
 * ```ts
 * import { ReviewerChangedFile } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerChangedFile.make({ filename: "docs/new.md", previous_filename: "docs/old.md" }).filename);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerChangedFile extends S.Class<ReviewerChangedFile, { readonly brand: unique symbol }>(
  $I`ReviewerChangedFile`
)(
  { filename: S.String, previous_filename: S.optionalKey(S.String) },
  $I.annote("ReviewerChangedFile", { description: "A changed PR path including a rename source." })
) {}

/**
 * Counts and presentation metadata for completing a reviewer check.
 *
 * **Example** (Construct a successful result)
 * ```ts
 * import { ReviewerResult } from "@beep/repo-cli/commands/Reviewer";
 * console.log(ReviewerResult.make({ score: 4, tier: "L2", p0: 0, p1: 0, p2: 2,
 *   summary: "Two suggestions", conclusion: "auto", annotations: [] }).score);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewerResult extends S.Class<ReviewerResult, { readonly brand: unique symbol }>($I`ReviewerResult`)(
  {
    score: S.Int.check(S.isBetween({ minimum: 0, maximum: 5 })),
    tier: S.Literals(["L0", "L1", "L2", "L3"]),
    p0: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    p1: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    p2: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    summary: S.String,
    conclusion: S.Literals(["auto", "success", "failure", "neutral", "cancelled", "timed_out", "action_required"]),
    annotations: S.Array(ReviewerAnnotation),
  },
  $I.annote("ReviewerResult", { description: "Reviewer check completion input." })
) {}

/**
 * Reuses module-scope codecs at the configuration, HTTP, and CLI boundaries.
 *
 * **Example** (Validate a review input)
 * ```ts
 * import { reviewerWire } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(reviewerWire.review('{"body":"Notes","comments":[]}')));
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const reviewerWire = {
  credentials: S.decodeUnknownEffect(ReviewerCredentials),
  review: S.decodeUnknownEffect(S.fromJsonString(ReviewerReview)),
  result: S.decodeUnknownEffect(ReviewerResult),
  annotations: S.decodeUnknownEffect(S.fromJsonString(S.Array(ReviewerAnnotation))),
};
