/**
 * Review-item store port: where producers put the items that wait for the
 * attorney, and where the review hub reads them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  isCurrentReviewItem,
  isLegacyReviewItemImported,
  ReviewItem,
  ReviewItemId,
  StoredReviewItem,
} from "@beep/law-practice-domain";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type { ReviewItemStoreError } from "./ReviewItemStore.errors.ts";

const $I = $LawPracticeUseCasesId.create("ReviewItemStore/ReviewItemStore.ports");

/**
 * Service shape of the review-item store.
 *
 * **Details**
 *
 * `list` returns the latest version of every item, in the order the ids were
 * first stored. A stored legacy item whose quote could not become a selector
 * reads as a `LegacyReviewItemImported` and stays listed for repair.
 * `upsert` is idempotent by `itemId`: an item equal to its stored current
 * version is not written again, and any other item is stored as its latest
 * version, except over an id whose latest version is an unresolved import:
 * those ids are held, not written, and returned. `repair` stores the given
 * items as an explicit revision even over an unresolved import; earlier
 * versions stay stored. Producers own the items; the queues store only
 * verdicts and answers.
 *
 * **Example** (Name a store method)
 *
 * ```ts
 * import type { ReviewItemStoreShape } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * const method: keyof ReviewItemStoreShape = "upsert"
 * console.log(method) // "upsert"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ReviewItemStoreShape {
  /** The latest version of every stored item, in the order the ids were first stored. */
  readonly list: Effect.Effect<ReadonlyArray<StoredReviewItem>, ReviewItemStoreError>;
  /** Store the items as an explicit revision, replacing an unresolved import of the same id. */
  readonly repair: (items: ReadonlyArray<ReviewItem>) => Effect.Effect<void, ReviewItemStoreError>;
  /** Store the items; returns the ids held because their latest version is an unresolved import. */
  readonly upsert: (
    items: ReadonlyArray<ReviewItem>
  ) => Effect.Effect<ReadonlyArray<ReviewItemId>, ReviewItemStoreError>;
}

/**
 * The review items waiting for the attorney: verdict items and questions.
 *
 * **Details**
 *
 * The workstation adapter is a JSONL file (`@beep/law-practice-server/ReviewFiles`);
 * `ReviewItemStoreMemory` from `@beep/law-practice-use-cases/test` serves tests.
 *
 * **Example** (Reference the store service)
 *
 * ```ts
 * import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * console.log(ReviewItemStore.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ReviewItemStore extends Context.Service<ReviewItemStore, ReviewItemStoreShape>()($I`ReviewItemStore`) {}

const upsertOne = <Item extends StoredReviewItem>(items: ReadonlyArray<Item>, item: Item): Array<Item> =>
  A.some(items, ({ itemId }) => itemId === item.itemId)
    ? A.map(items, (stored) => (stored.itemId === item.itemId ? item : stored))
    : A.append(items, item);

/**
 * Collapse stored item versions into what `list` returns: the latest version
 * of each id, in the order the ids were first stored.
 *
 * **Details**
 *
 * Every `ReviewItemStore` adapter answers `list` with this function over its
 * stored versions in write order, so all adapters agree on order and on which
 * version wins.
 *
 * **Example** (Keep the latest version of each item)
 *
 * ```ts
 * import { ReviewItem } from "@beep/law-practice-domain"
 * import { latestItems } from "@beep/law-practice-use-cases/ReviewItemStore"
 * import * as A from "effect/Array"
 *
 * const item = (itemId: string, text: string) =>
 *   ReviewItem.cases["kg-answer"].make({ itemId, text, sourceRefs: [] })
 * const items = latestItems([item("a", "First"), item("b", "Other"), item("a", "Second")])
 * console.log(A.map(items, ({ itemId, text }) => `${itemId}:${text}`)) // ["a:Second", "b:Other"]
 * ```
 *
 * @param versions - Every stored version, in write order.
 * @returns The latest version of each id, in first-stored order.
 * @category utilities
 * @since 0.0.0
 */
export const latestItems = <Item extends StoredReviewItem>(versions: ReadonlyArray<Item>): ReadonlyArray<Item> =>
  A.reduce(versions, A.empty<Item>(), upsertOne);

/**
 * What an upsert or a repair writes, and the ids an upsert holds.
 *
 * **Example** (Read an empty plan)
 *
 * ```ts
 * import { ReviewItemWritePlan } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * console.log(ReviewItemWritePlan.make({ held: [], write: [] }).write.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewItemWritePlan extends S.Opaque<ReviewItemWritePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    held: S.Array(ReviewItemId).annotateKey({
      description: "Ids not written because their latest version is an unresolved import awaiting repair.",
    }),
    write: S.Array(ReviewItem).annotateKey({ description: "Items to append, in the order given." }),
  }).pipe(
    $I.annoteSchema("ReviewItemWritePlan", {
      description: "What a review-item upsert or repair appends, and the ids an upsert holds for repair.",
    })
  )
) {}

const sameItem = S.toEquivalence(ReviewItem);

/**
 * A store write to plan: the latest stored versions, the items to store, and whether it is a repair.
 *
 * **Example** (Request a plain upsert)
 *
 * ```ts
 * import { ReviewItemWriteRequest } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * console.log(ReviewItemWriteRequest.make({ stored: [], items: [], repair: false }).repair) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewItemWriteRequest extends S.Opaque<ReviewItemWriteRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(ReviewItem).annotateKey({ description: "Items to store, in the order given." }),
    repair: S.Boolean.annotateKey({
      description: "Whether the write is an explicit repair that may revise an unresolved import.",
    }),
    stored: S.Array(StoredReviewItem).annotateKey({ description: "The latest stored version of each id." }),
  }).pipe(
    $I.annoteSchema("ReviewItemWriteRequest", {
      description: "The stored versions, the items and the repair flag one review-item write is planned from.",
    })
  )
) {}

/**
 * Plan a store write against the latest stored versions.
 *
 * **Details**
 *
 * An item equal to its stored current version is a no-op. With `repair`
 * false, an item whose id's latest version is an unresolved import is held,
 * never written over it; with `repair` true it is written as an explicit
 * revision. Every other item is written.
 *
 * **Example** (Hold an item over an unresolved import)
 *
 * ```ts
 * import { ReviewItem } from "@beep/law-practice-domain"
 * import { planReviewItemWrite, ReviewItemWriteRequest } from "@beep/law-practice-use-cases/ReviewItemStore"
 *
 * const item = ReviewItem.cases["kg-answer"].make({ itemId: "a", text: "Answer", sourceRefs: [] })
 * const request = ReviewItemWriteRequest.make({ stored: [item], items: [item], repair: false })
 * console.log(planReviewItemWrite(request).write.length) // 0
 * ```
 *
 * @param input - The latest stored version of each id, the items to store, and whether the write is an explicit repair.
 * @returns The items to append and the ids held for repair.
 * @category utilities
 * @since 0.0.0
 */
export const planReviewItemWrite = ({ items, repair, stored }: ReviewItemWriteRequest): ReviewItemWritePlan => {
  const latestOf = (item: ReviewItem) => A.findFirst(stored, ({ itemId }) => itemId === item.itemId);
  const isHeld = (item: ReviewItem) => !repair && O.exists(latestOf(item), isLegacyReviewItemImported);
  const isUnchanged = (item: ReviewItem) =>
    O.exists(latestOf(item), (current) => isCurrentReviewItem(current) && sameItem(current, item));
  return ReviewItemWritePlan.make({
    held: A.map(A.filter(items, isHeld), ({ itemId }) => itemId),
    write: A.filter(items, (item) => !isHeld(item) && !isUnchanged(item)),
  });
};
