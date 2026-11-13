/**
 * Media reference property values: which item of which media set a property points at.
 *
 * **Details**
 *
 * A media reference property does not hold the media. It names an item inside
 * a media set, seen through one of that set's views, and may carry a token
 * that grants read access to that item. The token is a credential: it decodes
 * into a `Redacted` value so it cannot leak through logs or formatted output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { Filename, MediaType } from "../Attachment/Attachment.model.ts";
import { MediaItemRid, MediaSetRid, MediaSetViewRid } from "../Identifier/Identifier.model.ts";

const $I = $ScratchpadId.create("osdk/Media/Media.model");

// -----------------------------------------------------------------------------
// Read token
// -----------------------------------------------------------------------------

/**
 * Token granting read access to specific media items, decoded into a `Redacted` value.
 *
 * **Details**
 *
 * The platform attaches a token to a media reference only when the caller asks
 * for signed references. Unwrap it with `Redacted.value` at the one place that
 * sends it back to the platform.
 *
 * **Example** (Keep a read token out of formatted output)
 *
 * ```ts import.meta.vitest name="Keep a read token out of formatted output"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 * import { MediaItemReadToken } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const token = await Effect.runPromise(S.decodeUnknownEffect(MediaItemReadToken)("s3cr3t"))
 * const views = [`${token}`, Redacted.value(token)]
 * views // => ["<redacted>", "s3cr3t"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaItemReadToken = S.RedactedFromValue(S.NonEmptyString).pipe(
  $I.annoteSchema("MediaItemReadToken", {
    description: "Token granting read access to specific media items; a credential that must never be logged.",
  })
);

/**
 * Runtime type of {@link MediaItemReadToken}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaItemReadToken = typeof MediaItemReadToken.Type;

// -----------------------------------------------------------------------------
// Locators
// -----------------------------------------------------------------------------

const MediaItemLocatorKind = LiteralKit(["mediaSetViewItem"]);

const MediaSetViewItemPayload = S.Struct({
  mediaSetRid: MediaSetRid.annotateKey({ description: "Media set that stores the item." }),
  mediaSetViewRid: MediaSetViewRid.annotateKey({ description: "View of the media set the item is read through." }),
  mediaItemRid: MediaItemRid.annotateKey({ description: "The item itself." }),
  token: S.OptionFromOptionalKey(MediaItemReadToken).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Read token for the item, present only when signed references were requested." })
  ),
});

/**
 * A media item addressed through a view of the media set that stores it.
 *
 * **Details**
 *
 * The wire nests the three identifiers and the token under a key that repeats
 * the tag (`{ type: "mediaSetViewItem", mediaSetViewItem: {...} }`). Here they
 * sit beside the tag, and encoding restores the nesting.
 *
 * **Example** (Flatten the wire wrapper)
 *
 * ```ts import.meta.vitest name="Flatten the wire wrapper"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MediaSetViewItem } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const item = await Effect.runPromise(
 *   S.decodeUnknownEffect(MediaSetViewItem)({
 *     type: "mediaSetViewItem",
 *     mediaSetViewItem: {
 *       mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
 *       mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
 *       mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
 *     },
 *   })
 * )
 * const facts = [item.mediaItemRid, O.isNone(item.token)]
 * facts // => ["ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MediaSetViewItem extends S.Opaque<MediaSetViewItem, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mediaSetViewItem"),
    mediaSetViewItem: S.toEncoded(MediaSetViewItemPayload),
  }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("mediaSetViewItem"), ...MediaSetViewItemPayload.fields }),
      SchemaTransformation.transform({
        decode: ({ type, mediaSetViewItem }) => ({ type, ...mediaSetViewItem }),
        encode: ({ type, ...mediaSetViewItem }) => ({ type, mediaSetViewItem }),
      })
    ),
    $I.annoteSchema("MediaSetViewItem", {
      description: "A media item addressed through a view of the media set that stores it.",
    })
  )
) {}

/**
 * Where a media item lives.
 *
 * **Details**
 *
 * The platform defines a single way to locate a media item today. It is still
 * a union on the wire, so it is one here: a second kind of locator becomes a
 * new case that every `match` must handle.
 *
 * **Example** (Branch on the kind of locator)
 *
 * ```ts import.meta.vitest name="Branch on the kind of locator"
 * import { MediaItemLocator, MediaSetViewItem } from "@beep/scratchpad/osdk/src/Media/index"
 * import { MediaItemRid, MediaSetRid, MediaSetViewRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const locator = MediaSetViewItem.make({
 *   mediaSetRid: MediaSetRid.make("ri.mio.main.media-set.a"),
 *   mediaSetViewRid: MediaSetViewRid.make("ri.mio.main.view.b"),
 *   mediaItemRid: MediaItemRid.make("ri.mio.main.media-item.c"),
 * })
 * const describe = MediaItemLocator.match({
 *   mediaSetViewItem: ({ mediaSetRid, mediaItemRid }) => `${mediaItemRid} in ${mediaSetRid}`,
 * })
 * describe(locator) // => "ri.mio.main.media-item.c in ri.mio.main.media-set.a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaItemLocator = MediaItemLocatorKind.mapMembers(() => Tuple.make(MediaSetViewItem)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("MediaItemLocator", { description: "Where a media item lives." })
);

/**
 * Runtime type of {@link MediaItemLocator}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaItemLocator = typeof MediaItemLocator.Type;

// -----------------------------------------------------------------------------
// Media values
// -----------------------------------------------------------------------------

/**
 * Value of a media reference property: a media item and the MIME type of its content.
 *
 * **Example** (Decode a media reference property value)
 *
 * ```ts import.meta.vitest name="Decode a media reference property value"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MediaReference } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const media = await Effect.runPromise(
 *   S.decodeUnknownEffect(MediaReference)({
 *     mimeType: "application/pdf",
 *     reference: {
 *       type: "mediaSetViewItem",
 *       mediaSetViewItem: {
 *         mediaSetRid: "ri.mio.main.media-set.4153d42f-ca4b-4e42-8ca5-8e6aa7edb642",
 *         mediaSetViewRid: "ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b",
 *         mediaItemRid: "ri.mio.main.media-item.001ec98b-1620-4814-9e17-8e9c4e536225",
 *       },
 *     },
 *   })
 * )
 * const summary = `${media.mimeType} at ${media.reference.mediaSetViewRid}`
 * summary // => "application/pdf at ri.mio.main.view.82a798ad-d637-4595-acc6-987bcf16629b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MediaReference extends S.Opaque<MediaReference, { readonly brand: unique symbol }>()(
  S.Struct({
    mimeType: MediaType.annotateKey({ description: "MIME type of the media item's content." }),
    reference: MediaItemLocator.annotateKey({ description: "Where the media item lives." }),
  }).pipe(
    $I.annoteSchema("MediaReference", {
      description: "Value of a media reference property: a media item and the MIME type of its content.",
    })
  )
) {}

/**
 * What accompanies the bytes of a file when it is uploaded as media.
 *
 * **Details**
 *
 * The file content travels as the request body and is not part of this record.
 * A successful upload answers with the {@link MediaReference} to store on a
 * media reference property or pass to an action.
 *
 * **Example** (Describe a media upload)
 *
 * ```ts import.meta.vitest name="Describe a media upload"
 * import { Filename } from "@beep/scratchpad/osdk/src/Attachment/index"
 * import { MediaUploadRequest } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const upload = MediaUploadRequest.make({ filename: Filename.make("scan.png") })
 * upload.filename // => "scan.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MediaUploadRequest extends S.Opaque<MediaUploadRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    filename: Filename.annotateKey({ description: "Name to store the uploaded media item under." }),
  }).pipe(
    $I.annoteSchema("MediaUploadRequest", {
      description: "What accompanies the bytes of a file when it is uploaded as media.",
    })
  )
) {}
