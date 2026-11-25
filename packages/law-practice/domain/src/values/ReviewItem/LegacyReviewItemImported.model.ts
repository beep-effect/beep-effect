/**
 * Read-side records for review items stored before the shared quote selector:
 * an unresolved legacy quote, the imported item that carries it, and the
 * stored-item union the review stores return.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { BoxFileId, PageCrop } from "../SourceRef/index.ts";
import { ReviewItem, ReviewItemId, ReviewItemKind } from "./ReviewItem.model.ts";

const $I = $LawPracticeDomainId.create("values/ReviewItem/LegacyReviewItemImported.model");

/**
 * **Example** (Read the unresolved reasons)
 *
 * ```ts
 * import { LegacyQuoteUnresolvedReason } from "@beep/law-practice-domain"
 *
 * console.log(LegacyQuoteUnresolvedReason.literals) // ["empty-legacy-quote"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LegacyQuoteUnresolvedReason = LiteralKit(["empty-legacy-quote"]).pipe(
  $I.annoteSchema("LegacyQuoteUnresolvedReason", {
    description: "Why a stored legacy quote could not become a quote selector.",
  })
);

/**
 * @see {@link LegacyQuoteUnresolvedReason} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type LegacyQuoteUnresolvedReason = typeof LegacyQuoteUnresolvedReason.Type;

/**
 * **Example** (Build a legacy locator)
 *
 * ```ts
 * import { LegacySourceLocator } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const locator = LegacySourceLocator.make({ boxFileId: "1234567890", page: O.some(2), crop: O.none() })
 * console.log(locator.boxFileId) // "1234567890"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LegacySourceLocator extends S.Opaque<LegacySourceLocator, { readonly brand: unique symbol }>()(
  S.Struct({
    boxFileId: BoxFileId.annotateKey({ description: "Box file the legacy reference named." }),
    page: S.OptionFromOptionalKey(PosInt).annotateKey({
      description: "One-based page the legacy reference named, when it named one.",
    }),
    crop: S.OptionFromOptionalKey(PageCrop).annotateKey({
      description: "Pre-rendered crop the legacy reference carried, when it carried one.",
    }),
  }).pipe(
    $I.annoteSchema("LegacySourceLocator", {
      description: "The Box file, page and crop a legacy source reference stated beside its quote.",
    })
  )
) {}

/**
 * **Details**
 *
 * The raw `exact`, `prefix` and `suffix` keep their stored values and
 * omissions. `fieldPath` names the quote inside its item, for example
 * `facts[0].sourceRefs[1].quote`. No quote text is invented and no selector
 * is produced.
 *
 * **Example** (Record an empty legacy quote)
 *
 * ```ts
 * import { LegacyQuoteUnresolved, LegacySourceLocator } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const unresolved = LegacyQuoteUnresolved.make({
 *   reason: "empty-legacy-quote",
 *   itemId: "kg-answer:1",
 *   fieldPath: "sourceRefs[0].quote",
 *   exact: "",
 *   prefix: O.none(),
 *   suffix: O.none(),
 *   locator: LegacySourceLocator.make({ boxFileId: "1234567890", page: O.none(), crop: O.none() }),
 * })
 * console.log(unresolved.fieldPath) // "sourceRefs[0].quote"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LegacyQuoteUnresolved extends S.Opaque<LegacyQuoteUnresolved, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LegacyQuoteUnresolved", {
    reason: LegacyQuoteUnresolvedReason.annotateKey({ description: "Why no selector was produced." }),
    itemId: ReviewItemId.annotateKey({ description: "Stored item the quote belongs to." }),
    fieldPath: S.NonEmptyString.annotateKey({ description: "Path of the quote inside its stored item." }),
    exact: S.String.annotateKey({ description: "Raw stored exact text." }),
    prefix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Raw stored prefix, when stored." }),
    suffix: S.OptionFromOptionalKey(S.String).annotateKey({ description: "Raw stored suffix, when stored." }),
    locator: LegacySourceLocator.annotateKey({ description: "Legal locator stored beside the quote." }),
  }).pipe(
    $I.annoteSchema("LegacyQuoteUnresolved", {
      description: "A stored legacy quote that cannot become a quote selector, kept raw for repair.",
    })
  )
) {}

/**
 * **Details**
 *
 * Any unresolved quote, at the item level or inside a question fact, puts the
 * whole item here. `raw` is the stored JSON object as read. Queues show the
 * item for repair; verdict admission and executable question writes refuse
 * it, and only an explicit repair stores a current item under its id.
 *
 * **Example** (Recognize an imported item)
 *
 * ```ts
 * import { LegacyQuoteUnresolved, LegacyReviewItemImported, LegacySourceLocator } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const imported = LegacyReviewItemImported.make({
 *   itemId: "kg-answer:1",
 *   storedKind: "kg-answer",
 *   text: "Synthetic answer",
 *   raw: { kind: "kg-answer", itemId: "kg-answer:1" },
 *   unresolved: [
 *     LegacyQuoteUnresolved.make({
 *       reason: "empty-legacy-quote",
 *       itemId: "kg-answer:1",
 *       fieldPath: "sourceRefs[0].quote",
 *       exact: "",
 *       prefix: O.none(),
 *       suffix: O.none(),
 *       locator: LegacySourceLocator.make({ boxFileId: "1234567890", page: O.none(), crop: O.none() }),
 *     }),
 *   ],
 * })
 * console.log(imported._tag) // "LegacyReviewItemImported"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LegacyReviewItemImported extends S.Opaque<LegacyReviewItemImported, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LegacyReviewItemImported", {
    itemId: ReviewItemId.annotateKey({ description: "Stored item id." }),
    storedKind: ReviewItemKind.annotateKey({
      description:
        "The stored row's item kind. Named apart from ReviewItem's kind discriminant so a kind check never matches an import.",
    }),
    text: S.NonEmptyString.annotateKey({ description: "Stored item text, shown with the repair request." }),
    raw: S.JsonObject.annotateKey({ description: "The stored JSON object exactly as read." }),
    unresolved: S.NonEmptyArray(LegacyQuoteUnresolved).annotateKey({
      description: "Every quote of the item that could not become a selector.",
    }),
  }).pipe(
    $I.annoteSchema("LegacyReviewItemImported", {
      description: "A stored legacy review item with at least one unresolved quote, kept for repair.",
    })
  )
) {}

/**
 * What a review store reads back: a current item or an imported legacy item
 * that still needs repair.
 *
 * **Example** (Tell the two cases apart)
 *
 * ```ts
 * import { ReviewItem, StoredReviewItem, isLegacyReviewItemImported } from "@beep/law-practice-domain"
 *
 * const stored: StoredReviewItem = ReviewItem.cases["kg-answer"].make({ itemId: "a", text: "Answer", sourceRefs: [] })
 * console.log(isLegacyReviewItemImported(stored)) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const StoredReviewItem = S.Union([LegacyReviewItemImported, ReviewItem]).pipe(
  $I.annoteSchema("StoredReviewItem", {
    description: "A stored review item as read: current, or an imported legacy item awaiting repair.",
  })
);

/**
 * @see {@link StoredReviewItem} for the two read cases.
 * @category value-objects
 * @since 0.0.0
 */
export type StoredReviewItem = typeof StoredReviewItem.Type;

/**
 * Whether a stored item is an imported legacy item awaiting repair.
 *
 * **Example** (Guard an imported item)
 *
 * ```ts
 * import { ReviewItem, isLegacyReviewItemImported } from "@beep/law-practice-domain"
 *
 * console.log(isLegacyReviewItemImported(ReviewItem.cases.drawing.make({ itemId: "d", text: "Fig. 1", sourceRefs: [] }))) // false
 * ```
 *
 * @param item - The stored item to test.
 * @returns `true` for an imported legacy item.
 * @category guards
 * @since 0.0.0
 */
export const isLegacyReviewItemImported = (item: StoredReviewItem): item is LegacyReviewItemImported =>
  S.is(LegacyReviewItemImported)(item);

/**
 * Whether a stored item is a current review item.
 *
 * **Example** (Keep the current items)
 *
 * ```ts
 * import { ReviewItem, isCurrentReviewItem } from "@beep/law-practice-domain"
 *
 * console.log(isCurrentReviewItem(ReviewItem.cases.drawing.make({ itemId: "d", text: "Fig. 1", sourceRefs: [] }))) // true
 * ```
 *
 * @param item - The stored item to test.
 * @returns `true` for a current review item.
 * @category guards
 * @since 0.0.0
 */
export const isCurrentReviewItem = (item: StoredReviewItem): item is ReviewItem => !isLegacyReviewItemImported(item);
