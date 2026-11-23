/**
 * Review-item value objects: the cross-producer envelope for every piece of
 * agent work that needs the attorney's judgement.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { CandidateClaimId } from "@beep/shared-domain/identity/Epistemic";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { QuestionFact, QuestionOptions } from "../Question/index.ts";
import { SourceRef } from "../SourceRef/index.ts";

const $I = $LawPracticeDomainId.create("values/ReviewItem/ReviewItem.model");

/**
 * Stable identifier of a review item; verdict rows key on it.
 *
 * **Details**
 *
 * Producers own the format. A `kg-answer` item uses
 * `kg-answer:<sessionId>:<turnId>` so the per-answer controls and the review
 * queue write to the same verdict log.
 *
 * **Example** (Check a review item id)
 *
 * ```ts
 * import { ReviewItemId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReviewItemId)("kg-answer:s1:t4")) // true
 * console.log(S.is(ReviewItemId)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewItemId = S.NonEmptyString.pipe(
  $I.annoteSchema("ReviewItemId", {
    description: "Stable, producer-assigned identifier of a review item; verdict rows key on it.",
  })
);

/**
 * Runtime type for {@link ReviewItemId}.
 *
 * @see {@link ReviewItemId} for the identifier conventions.
 * @category models
 * @since 0.0.0
 */
export type ReviewItemId = typeof ReviewItemId.Type;

/**
 * Kinds of agent work product, and agent questions, that reach the review queue.
 *
 * **Example** (Read the review item kinds)
 *
 * ```ts
 * import { ReviewItemKind } from "@beep/law-practice-domain"
 *
 * console.log(ReviewItemKind.Enum["claim-finding"]) // "claim-finding"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewItemKind = LiteralKit([
  "kg-answer",
  "claim-finding",
  "oa-analysis",
  "drawing",
  "classification",
  "draft-text",
  "question",
]).pipe(
  $I.annoteSchema("ReviewItemKind", {
    description: "Kinds of agent work product, and agent questions, that reach the attorney review queue.",
  })
);

/**
 * Runtime type for {@link ReviewItemKind}.
 *
 * @see {@link ReviewItemKind} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type ReviewItemKind = typeof ReviewItemKind.Type;

const ReviewItemFields = {
  itemId: ReviewItemId.annotateKey({
    description: "Stable identifier the verdict rows key on.",
  }),
  text: S.NonEmptyString.annotateKey({
    description: "The plain-language answer or finding the attorney judges, or the question the attorney answers.",
  }),
  label: S.NonEmptyString.pipe(
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({
      description: 'Optional plain label shown with the item, for example "examiner rejection".',
    })
  ),
  sourceRefs: S.Array(SourceRef).annotateKey({
    description: "Source passages that support the item, in display order.",
  }),
};

const ReviewItemDefinition = ReviewItemKind.toTaggedUnion("kind")({
  "kg-answer": ReviewItemFields,
  "claim-finding": {
    ...ReviewItemFields,
    claimId: CandidateClaimId.annotateKey({
      description: "Candidate claim the finding is about; the verdict projects onto its disposition.",
    }),
  },
  "oa-analysis": ReviewItemFields,
  drawing: ReviewItemFields,
  classification: ReviewItemFields,
  "draft-text": ReviewItemFields,
  question: {
    ...ReviewItemFields,
    facts: S.Array(QuestionFact).annotateKey({
      description: "Facts the asking agent already checked against records, each with its sources.",
    }),
    options: QuestionOptions.annotateKey({
      description: "The two to five answers the attorney can choose from.",
    }),
    docket: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Matter docket the question belongs to, when it belongs to one.",
      })
    ),
    conversationId: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Mail thread (Graph conversationId) the question came from, when it came from one.",
      })
    ),
  },
});

/**
 * One piece of agent work awaiting the attorney's verdict, discriminated on
 * `kind`.
 *
 * **Details**
 *
 * Every member carries `itemId`, the plain-language `text`, an optional
 * `label`, and `sourceRefs`. The `claim-finding` member also carries the
 * `claimId` its verdict projects onto. The `question` member is an agent's
 * question to the attorney: `text` is the question, `facts` are what the agent
 * already checked, `options` are the two to five answers, and the optional
 * `docket` and `conversationId` name its matter and mail thread. Questions are
 * answered with `AnswerRow`s, not verdicts. Unknown kinds fail to decode.
 *
 * **Example** (Decode a claim finding)
 *
 * ```ts
 * import { ReviewItem } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const item = Effect.runSync(
 *   S.decodeUnknownEffect(ReviewItem)({
 *     kind: "claim-finding",
 *     itemId: "claim-finding:1",
 *     text: "Claim 1 element (b) is disclosed by the cited reference.",
 *     claimId: 1,
 *     sourceRefs: [{ boxFileId: "1234567890", page: 3, quote: { _tag: "Quote", exact: "a hinge" } }],
 *   })
 * )
 *
 * console.log(ReviewItem.guards["claim-finding"](item)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ReviewItem = ReviewItemDefinition.pipe(
  $I.annoteSchema("ReviewItem", {
    description: "One piece of agent work awaiting the attorney's verdict, discriminated on its kind.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link ReviewItem}.
 *
 * @see {@link ReviewItem} for the tagged-union schema and its members.
 * @category value-objects
 * @since 0.0.0
 */
export type ReviewItem = typeof ReviewItem.Type;

/**
 * Companion namespace for `ReviewItem`.
 *
 * **Example** (Type an encoded review item kind)
 *
 * ```ts
 * import type { ReviewItem } from "@beep/law-practice-domain"
 *
 * const kind: ReviewItem.Encoded["kind"] = "drawing"
 * console.log(kind) // "drawing"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace ReviewItem {
  /**
   * Wire-encoded representation of a decoded {@link ReviewItem}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { ReviewItem } from "@beep/law-practice-domain"
   *
   * type Wire = ReviewItem.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof ReviewItem.Encoded;
}
