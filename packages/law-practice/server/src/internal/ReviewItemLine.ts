/**
 * The line codec of the review hub's `items.jsonl`: a private frozen reader of
 * the untagged v1 rows beside the versioned v2 envelope every write uses.
 *
 * **Details**
 *
 * A v1 row is the review item as it was stored before the shared quote
 * selector: untagged quotes whose `exact` may be empty. It is read through a
 * frozen v1 codec of its quotes, then projected. A non-empty quote gains the
 * `Quote` tag with its stored `prefix` and `suffix` keys exactly as stored.
 * An empty quote becomes a `LegacyQuoteUnresolved`, never a selector, and any
 * unresolved quote, at the item level or in a question fact, puts the whole
 * item in `LegacyReviewItemImported` with the row's raw JSON. The rest of the
 * row is proved under the current item schema with only the unresolved
 * references set aside. Writes always encode the v2 envelope of a current
 * item; a v1 row is never written. It is private to `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @internal
 * @category codecs
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  LegacyQuoteUnresolved,
  LegacyReviewItemImported,
  LegacySourceLocator,
  ReviewItem,
  ReviewItemId,
  ReviewItemKind,
  StoredReviewItem,
} from "@beep/law-practice-domain";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("internal/ReviewItemLine");

const TextQuoteV1 = S.Struct({
  exact: S.String,
  prefix: S.optionalKey(S.String),
  suffix: S.optionalKey(S.String),
}).pipe($I.annoteSchema("TextQuoteV1", { description: "An untagged quote as review-item v1 stored it." }));

const SourceRefV1 = S.Struct({
  boxFileId: S.String,
  page: S.optionalKey(S.Unknown),
  quote: TextQuoteV1,
  crop: S.optionalKey(S.Unknown),
}).pipe($I.annoteSchema("SourceRefV1", { description: "A source reference as review-item v1 stored it." }));

const QuestionFactV1 = S.Struct({ text: S.NonEmptyString, sourceRefs: S.Array(SourceRefV1) }).pipe(
  $I.annoteSchema("QuestionFactV1", { description: "A question fact as review-item v1 stored it." })
);

const ReviewItemV1 = S.Struct({
  kind: ReviewItemKind,
  itemId: ReviewItemId,
  text: S.NonEmptyString,
  sourceRefs: S.Array(SourceRefV1),
  facts: QuestionFactV1.pipe(S.Array, S.optionalKey),
}).pipe(
  $I.annoteSchema("ReviewItemV1", {
    description: "The fields of a review-item v1 row whose quotes changed shape, read with the frozen v1 codec.",
  })
);

type SourceRefV1 = typeof SourceRefV1.Type;

type ProjectedRefs = {
  readonly resolved: ReadonlyArray<SourceRefV1 & { readonly quote: { readonly _tag: "Quote" } }>;
  readonly unresolved: ReadonlyArray<LegacyQuoteUnresolved>;
};

const decodeV1 = S.decodeUnknownEffect(ReviewItemV1);
const decodeLocator = S.decodeUnknownEffect(LegacySourceLocator);
const decodeCurrent = S.decodeUnknownEffect(ReviewItem);

const projectRefs = Effect.fnUntraced(function* (
  itemId: ReviewItemId,
  path: string,
  refs: ReadonlyArray<SourceRefV1>
): Effect.fn.Return<ProjectedRefs, S.SchemaError> {
  const unresolved = yield* Effect.forEach(
    A.filter(
      A.map(refs, (ref, index) => [ref, index] as const),
      ([ref]) => Str.isEmpty(ref.quote.exact)
    ),
    ([{ quote, ...locator }, index]) =>
      Effect.map(decodeLocator(locator), (decoded) =>
        LegacyQuoteUnresolved.make({
          reason: "empty-legacy-quote",
          itemId,
          fieldPath: `${path}[${index}].quote`,
          exact: quote.exact,
          prefix: O.fromUndefinedOr(quote.prefix),
          suffix: O.fromUndefinedOr(quote.suffix),
          locator: decoded,
        })
      ),
    { concurrency: 1 }
  );
  return {
    resolved: A.map(
      A.filter(refs, (ref) => Str.isNonEmpty(ref.quote.exact)),
      (ref) => ({ ...ref, quote: { _tag: "Quote" as const, ...ref.quote } })
    ),
    unresolved,
  };
});

const projectV1 = Effect.fnUntraced(function* (raw: S.JsonObject): Effect.fn.Return<StoredReviewItem, S.SchemaError> {
  const v1 = yield* decodeV1(raw);
  const top = yield* projectRefs(v1.itemId, "sourceRefs", v1.sourceRefs);
  const facts = yield* Effect.forEach(
    v1.facts ?? [],
    (fact, index) =>
      Effect.map(projectRefs(v1.itemId, `facts[${index}].sourceRefs`, fact.sourceRefs), (refs) => ({
        encoded: { text: fact.text, sourceRefs: refs.resolved },
        unresolved: refs.unresolved,
      })),
    { concurrency: 1 }
  );
  const current = yield* decodeCurrent({
    ...raw,
    sourceRefs: top.resolved,
    ...(v1.facts === undefined ? {} : { facts: A.map(facts, ({ encoded }) => encoded) }),
  });
  return A.match([...top.unresolved, ...A.flatMap(facts, ({ unresolved }) => unresolved)], {
    onEmpty: (): StoredReviewItem => current,
    onNonEmpty: (unresolved): StoredReviewItem =>
      LegacyReviewItemImported.make({ itemId: v1.itemId, kind: v1.kind, text: v1.text, raw, unresolved }),
  });
});

const ReviewItemV1Line = S.JsonObject.pipe(
  S.decodeTo(S.toType(StoredReviewItem), {
    decode: SchemaGetter.transformEffect((raw: S.JsonObject) =>
      projectV1(raw).pipe(Effect.mapError((error) => error.issue))
    ),
    encode: SchemaGetter.forbidden(() => "review-item v1 rows are read only"),
  }),
  $I.annoteSchema("ReviewItemV1Line", {
    description: "Read-only projection of a review-item v1 row to a current item or an unresolved legacy import.",
  })
);

const ReviewItemV2Envelope = S.Struct({
  format: S.tag("review-item/v2"),
  item: ReviewItem,
}).pipe($I.annoteSchema("ReviewItemV2Envelope", { description: "A review-item v2 row: a versioned current item." }));

const ReviewItemV2Line = ReviewItemV2Envelope.pipe(
  S.decodeTo(S.toType(ReviewItem), {
    decode: SchemaGetter.transform(({ item }: typeof ReviewItemV2Envelope.Type) => item),
    encode: SchemaGetter.transform((item: ReviewItem) => ({ format: "review-item/v2" as const, item })),
  }),
  $I.annoteSchema("ReviewItemV2Line", { description: "A review-item v2 row read as, and written from, its item." })
);

/**
 * One line of `items.jsonl`: a v2 envelope read as its current item, or a v1
 * row read through the frozen v1 reader. Encoding always writes the v2
 * envelope of a current item and refuses an imported legacy item.
 *
 * **Example** (Read a v1 row with a non-empty quote)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReviewItemLine } from "./ReviewItemLine.ts"
 *
 * const item = S.decodeUnknownSync(ReviewItemLine)({
 *   kind: "kg-answer",
 *   itemId: "kg-answer:1",
 *   text: "Synthetic answer",
 *   sourceRefs: [{ boxFileId: "1234567890", quote: { exact: "synthetic passage" } }],
 * })
 * console.log("kind" in item && item.kind) // "kg-answer"
 * ```
 *
 * @internal
 * @category codecs
 * @since 0.0.0
 */
export const ReviewItemLine = S.Union([ReviewItemV2Line, ReviewItemV1Line]).pipe(
  $I.annoteSchema("ReviewItemLine", {
    description: "One items.jsonl line: a v2 envelope, or a frozen v1 row projected on read; writes are v2.",
  })
);
