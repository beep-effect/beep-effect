/**
 * Cursor pagination: the request a caller sends and the page of results that comes back.
 *
 * **Details**
 *
 * List endpoints of the platform page the same way. The caller asks for up to
 * {@link PageSize} items, the response carries the items plus a
 * {@link PageToken} when more exist, and the caller echoes that token to get
 * the next page. A page with no token is the last one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("osdk/Page/Page.model");

// -----------------------------------------------------------------------------
// Cursor and counters
// -----------------------------------------------------------------------------

/**
 * Opaque cursor naming where the next page starts.
 *
 * **Details**
 *
 * A token is only meaningful to the endpoint that issued it and only for the
 * same query. Send none on the first request, then copy the previous
 * response's token verbatim.
 *
 * **Example** (Brand a page token)
 *
 * ```ts import.meta.vitest name="Brand a page token"
 * import * as S from "effect/Schema"
 * import { PageToken } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const isToken = S.is(PageToken)
 * const verdicts = [isToken(PageToken.make("v1.000000000000000a")), isToken("")]
 * verdicts // => [true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PageToken = S.NonEmptyString.pipe(
  S.brand("PageToken"),
  $I.annoteSchema("PageToken", {
    description: "Opaque cursor naming where the next page starts, issued by the previous response.",
  })
);

/**
 * Runtime type of {@link PageToken}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type PageToken = typeof PageToken.Type;

/**
 * Largest number of items a caller is willing to receive in one page.
 *
 * **Details**
 *
 * The size is a request, not a promise: read the page token, not the number
 * of items returned, to learn whether more pages exist.
 *
 * **Example** (Reject an empty page size)
 *
 * ```ts import.meta.vitest name="Reject an empty page size"
 * import * as S from "effect/Schema"
 * import { PageSize } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const isPageSize = S.is(PageSize)
 * const verdicts = [isPageSize(100), isPageSize(0), isPageSize(2.5)]
 * verdicts // => [true, false, false]
 * ```
 *
 * @invariant A page size is an integer of at least one.
 * @category models
 * @since 0.0.0
 */
export const PageSize = S.Int.check(
  S.isGreaterThanOrEqualTo(
    1,
    $I.annote("PageSizeCheck", {
      title: "Page Size",
      description: "A page size of at least one item.",
      message: "Expected a page size of at least one item",
    })
  )
).pipe(
  $I.annoteSchema("PageSize", {
    description: "Largest number of items a caller is willing to receive in one page.",
  })
);

/**
 * Runtime type of {@link PageSize}.
 *
 * @category models
 * @since 0.0.0
 */
export type PageSize = typeof PageSize.Type;

/**
 * Number of items across every page of a listing, decoded from the decimal string the wire carries.
 *
 * **Details**
 *
 * The platform sends the count as a decimal string. It decodes to a `bigint`,
 * so a count beyond the exact range of a JSON number loses no digit, and
 * encodes back to a decimal string.
 *
 * **Example** (Decode a total count)
 *
 * ```ts import.meta.vitest name="Decode a total count"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TotalCount } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const count = await Effect.runPromise(S.decodeEffect(TotalCount)("9007199254740993"))
 * const wire = await Effect.runPromise(S.encodeEffect(TotalCount)(count))
 * wire // => "9007199254740993"
 * ```
 *
 * **Example** (Reject a count that is not a whole number of items)
 *
 * ```ts import.meta.vitest name="Reject a count that is not a whole number of items"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { TotalCount } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const decode = S.decodeOption(TotalCount)
 * const accepted = A.map(["0", "42", "-1", "1.5", "many"], (wire) => O.isSome(decode(wire)))
 * accepted // => [true, true, false, false, false]
 * ```
 *
 * @invariant A total count is never negative.
 * @category codecs
 * @since 0.0.0
 */
export const TotalCount = S.BigIntFromString.check(
  S.isGreaterThanOrEqualToBigInt(
    BigInt("0"),
    $I.annote("TotalCountCheck", {
      title: "Total Count",
      description: "A count of items that is zero or more.",
      message: "Expected a total count of zero or more",
    })
  )
).pipe(
  $I.annoteSchema("TotalCount", {
    description: "Number of items across every page of a listing, carried on the wire as a decimal string.",
  })
);

/**
 * Runtime type of {@link TotalCount}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type TotalCount = typeof TotalCount.Type;

// -----------------------------------------------------------------------------
// Request
// -----------------------------------------------------------------------------

/**
 * Paging arguments a caller sends with a list request.
 *
 * **Details**
 *
 * Both are optional: without a size the endpoint picks its default, and without
 * a token it starts from the first page. The list requests of the library are
 * built from these fields and do not declare their own: the object load request
 * and the read options take both, the link load request takes the token only.
 *
 * **Example** (Ask for the first page)
 *
 * ```ts import.meta.vitest name="Ask for the first page"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PageRequest } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const first = PageRequest.make({ pageSize: O.some(50) })
 * const wire = await Effect.runPromise(S.encodeEffect(PageRequest)(first))
 * wire // => { pageSize: 50 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageRequest extends S.Opaque<PageRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    pageSize: S.OptionFromOptionalKey(PageSize).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Largest number of items wanted, absent to accept the endpoint's default." })
    ),
    pageToken: S.OptionFromOptionalKey(PageToken).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Cursor from the previous response, absent on the first request." })
    ),
  }).pipe(
    $I.annoteSchema("PageRequest", {
      description: "Paging arguments a caller sends with a list request.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Response
// -----------------------------------------------------------------------------

const pageImpl = <const Identifier extends string, Item extends S.Constraint>(identifier: Identifier, item: Item) => {
  const schemaIdentifier: string = identifier;
  return S.Struct({
    data: S.Array(item).annotateKey({ description: "Items of this page, in the order the endpoint returned them." }),
    nextPageToken: S.OptionFromOptionalKey(PageToken).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Cursor of the following page, absent when this page is the last." })
    ),
    totalCount: S.OptionFromOptionalKey(TotalCount).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Number of items across every page, when the endpoint reports it." })
    ),
  }).pipe(
    $I.annoteSchema(schemaIdentifier, {
      description: "One page of a listing: its items, the cursor of the next page and the overall count.",
    })
  );
};

/**
 * Builds the schema of one page of a listing whose items are decoded by `item`.
 *
 * **When to use**
 *
 * Use to declare the response of any list endpoint. Give each page its own
 * identifier so the resulting schema is distinguishable in errors and
 * generated documents.
 *
 * **Details**
 *
 * The result is a plain struct schema, generic in the item schema: its decoded
 * `data` holds the item's decoded type and its encoded `data` holds the item's
 * wire type. `nextPageToken` and `totalCount` are absent keys on the wire and
 * `Option`s in the domain, both defaulting to none in `make`. Wrap the result
 * in an `S.Opaque` class at the use site when the page deserves a nominal type.
 * An endpoint that always reports its count spreads the page's fields and
 * declares `totalCount` again as required, as the object load response does.
 *
 * **Example** (Decode a page of names)
 *
 * ```ts import.meta.vitest name="Decode a page of names"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Page } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const NamePage = Page("NamePage", S.NonEmptyString)
 * const page = await Effect.runPromise(
 *   S.decodeEffect(NamePage)({ data: ["Ada", "Grace"], nextPageToken: "v1.next", totalCount: "2" })
 * )
 * const summary = [page.data.length, O.isSome(page.nextPageToken), O.isSome(page.totalCount)]
 * summary // => [2, true, true]
 * ```
 *
 * **Example** (Recognise the last page)
 *
 * ```ts import.meta.vitest name="Recognise the last page"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Page } from "@beep/scratchpad/osdk/src/Page/index"
 *
 * const pageOfNames = Page(S.NonEmptyString)
 * const NamePage = pageOfNames("NamePage")
 * const page = await Effect.runPromise(S.decodeEffect(NamePage)({ data: ["Ada"] }))
 * const isLast = O.isNone(page.nextPageToken)
 * isLast // => true
 * ```
 *
 * @typeParam Identifier - Identifier the page schema is annotated with.
 * @typeParam Item - Schema of one item of the page.
 * @param identifier - Name that tells this page schema apart from every other page.
 * @param item - Schema that decodes one item.
 * @returns A struct schema of `data`, `nextPageToken` and `totalCount`.
 * @category factories
 * @since 0.0.0
 */
export const Page: {
  <Item extends S.Constraint>(
    item: Item
  ): <const Identifier extends string>(identifier: Identifier) => ReturnType<typeof pageImpl<Identifier, Item>>;
  <const Identifier extends string, Item extends S.Constraint>(
    identifier: Identifier,
    item: Item
  ): ReturnType<typeof pageImpl<Identifier, Item>>;
} = dual(2, pageImpl);
