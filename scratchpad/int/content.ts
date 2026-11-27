/**
 * Site-neutral posts, gallery items, profiles and follow connections, each
 * identified by the locator its URL decodes to.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  CollectionLocatorFromUrl,
  Locator,
  LocatorFromUrl,
  type MapFailure,
  PostLocatorFromUrl,
  MappedItem,
  Platform,
  type XTarget,
  type YouTubeTarget,
  type RedGifsTarget,
  type FacebookTarget,
  type FanslyTarget,
  type InstagramTarget,
  type OnlyFansTarget,
  type PinterestTarget,
  type SnapchatTarget,
  type ThreadsTarget,
  type TikTokTarget,
  type VscoTarget,
  type RedditTarget,
  type DzenTarget,
} from "./locator.ts";

const $I = $ScratchpadId.create("int/content");

const absent = <Schema extends S.Top>(schema: Schema, description: string) =>
  schema.pipe(
    S.OptionFromOptionalKey,
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeedNone)
  );

const listed = <Schema extends S.Top>(schema: Schema, description: string) =>
  S.Array(schema).pipe(
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed([])),
    S.withConstructorDefault(Effect.succeed([]))
  );

const SiteId = S.NonEmptyString.pipe(
  $I.annoteSchema("SiteId", {
    description: "Identifier a site assigns, kept as text because several sites exceed the safe integer range.",
  })
);

declare namespace SiteId {
  export type Encoded = string;
}

const Handle = S.NonEmptyString.pipe(
  $I.annoteSchema("Handle", {
    description: "Name an account chose for its URL, without a leading @; the owner can change it.",
  })
);

declare namespace Handle {
  export type Encoded = string;
}

const AccountBy = LiteralKit(["id", "handle"]).pipe(
  $I.annoteSchema("AccountBy", { description: "Strongest identifier a payload gives for an account." })
);

const displayName = absent(S.String, "Display name shown beside the handle.");

class AccountById extends S.Opaque<AccountById, { readonly brand: unique symbol }>()(
  S.Struct({
    by: S.tag("id"),
    id: SiteId,
    handle: absent(Handle, "Current URL name, when the payload also gives it."),
    name: displayName,
  }).pipe($I.annoteSchema("AccountById", { description: "An account known by an identifier that survives a rename." }))
) {}

declare namespace AccountById {
  export interface Encoded {
    readonly by: "id";
    readonly id: SiteId.Encoded;
    readonly handle?: Handle.Encoded;
    readonly name?: string;
  }
}

class AccountByHandle extends S.Opaque<AccountByHandle, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("handle"), handle: Handle, name: displayName }).pipe(
    $I.annoteSchema("AccountByHandle", { description: "An account known only by a URL name its owner can change." })
  )
) {}

declare namespace AccountByHandle {
  export interface Encoded {
    readonly by: "handle";
    readonly handle: Handle.Encoded;
    readonly name?: string;
  }
}

/**
 * **Details**
 *
 * Two `id` references name the same account when their ids agree, whatever
 * their handles say. A `handle` reference is only as stable as the name. The
 * platform comes from the post or profile that holds the reference: no site
 * tags or mentions an account of another site.
 *
 * **Example** (Read the handle of either kind of reference)
 *
 * ```ts import.meta.vitest name="Read the handle of either kind of reference"
 * import { Account, handleOf } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * handleOf(Account.cases.handle.make({ handle: "jack" })) // => O.some("jack")
 * handleOf(Account.cases.id.make({ id: "12" })) // => O.none()
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Account = AccountBy.mapMembers(() => Tuple.make(AccountById, AccountByHandle)).pipe(
  S.toTaggedUnion("by"),
  $I.annoteSchema("Account", {
    description: "Reference to an account on the site of the enclosing value, discriminated by `by`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Account = typeof Account.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Account {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = AccountById.Encoded | AccountByHandle.Encoded;
}

/**
 * The URL name of an account, when its reference carries one.
 *
 * **Example** (Read a handle from an id reference)
 *
 * ```ts import.meta.vitest name="Read a handle from an id reference"
 * import { Account, handleOf } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * handleOf(Account.cases.id.make({ id: "12", handle: O.some("jack") })) // => O.some("jack")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const handleOf: (account: Account) => O.Option<string> = Account.match({
  id: ({ handle }) => handle,
  handle: ({ handle }) => O.some(handle),
});

const Offset = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Offset", { description: "UTF-16 code unit offset into a text." })
);

class Span extends S.Opaque<Span, { readonly brand: unique symbol }>()(
  S.Struct({ start: Offset, end: Offset })
    .check(
      S.makeFilter(
        ({ start, end }) => start < end,
        $I.annote("SpanNonEmpty", {
          title: "Non-empty span",
          description: "A span covers at least one code unit.",
          message: "Expected the end of a span after its start.",
        })
      )
    )
    .pipe($I.annoteSchema("Span", { description: "Half-open range of a text that an entity occupies." }))
) {}

declare namespace Span {
  export interface Encoded {
    readonly start: number;
    readonly end: number;
  }
}

const span = absent(Span, "Where the entity sits in the text, when the site reports ranges or the reader derived them.");

const TextEntityKind = LiteralKit(["mention", "hashtag", "link"]).pipe(
  $I.annoteSchema("TextEntityKind", { description: "What a marked part of a text refers to." })
);

class Mention extends S.Opaque<Mention, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("mention"), account: Account, span }).pipe(
    $I.annoteSchema("Mention", { description: "An account named in a text." })
  )
) {}

declare namespace Mention {
  export interface Encoded {
    readonly kind: "mention";
    readonly account: Account.Encoded;
    readonly span?: Span.Encoded;
  }
}

class Hashtag extends S.Opaque<Hashtag, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("hashtag"), tag: S.NonEmptyString, span }).pipe(
    $I.annoteSchema("Hashtag", { description: "A hashtag in a text, without its leading #." })
  )
) {}

declare namespace Hashtag {
  export interface Encoded {
    readonly kind: "hashtag";
    readonly tag: string;
    readonly span?: Span.Encoded;
  }
}

class Link extends S.Opaque<Link, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("link"), url: S.URLFromString, span }).pipe(
    $I.annoteSchema("Link", { description: "A URL in a text, expanded from any shortener the site applied." })
  )
) {}

declare namespace Link {
  export interface Encoded {
    readonly kind: "link";
    readonly url: string;
    readonly span?: Span.Encoded;
  }
}

/**
 * **Example** (Mark a hashtag)
 *
 * ```ts import.meta.vitest name="Mark a hashtag"
 * import { TextEntity } from "@beep/scratchpad/int/content"
 *
 * const entity = TextEntity.cases.hashtag.make({ tag: "sunset" })
 * TextEntity.guards.hashtag(entity) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextEntity = TextEntityKind.mapMembers(() => Tuple.make(Mention, Hashtag, Link)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TextEntity", { description: "A mention, hashtag or link inside a text, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type TextEntity = typeof TextEntity.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TextEntity {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = Mention.Encoded | Hashtag.Encoded | Link.Encoded;
}

/**
 * **Details**
 *
 * Sites disagree on whether entities are data. X, TikTok and Facebook send
 * ranges; Instagram and Threads send raw text only; OnlyFans, Fansly and
 * Pinterest list mentioned accounts without saying where. One shape holds all
 * three: the entity is always present and its span is optional.
 *
 * **Example** (Read a caption with a mention)
 *
 * ```ts import.meta.vitest name="Read a caption with a mention"
 * import { RichText, mentions } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const caption = S.decodeUnknownOption(RichText)({
 *   text: "with @jack",
 *   entities: [{ kind: "mention", account: { by: "handle", handle: "jack" }, span: { start: 5, end: 10 } }],
 * })
 * O.map(caption, (text) => A.length(mentions(text))) // => O.some(1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RichText extends S.Opaque<RichText, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String,
    entities: listed(TextEntity, "Mentions, hashtags and links found in the text."),
  })
    .check(
      S.makeFilter(
        ({ text, entities }) =>
          A.every(entities, (entity) =>
            pipe(
              entity.span,
              O.map(({ end }) => end <= Str.length(text)),
              O.getOrElse(() => true)
            )
          ),
        $I.annote("SpansWithinText", {
          title: "Spans within the text",
          description: "No entity span reaches past the end of the text.",
          message: "Expected every span to end inside the text.",
        })
      )
    )
    .pipe($I.annoteSchema("RichText", { description: "A caption, description or biography and what it refers to." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RichText {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly text: string;
    readonly entities?: ReadonlyArray<TextEntity.Encoded>;
  }
}

const plain = RichText.pipe(
  S.withDecodingDefaultTypeKey(Effect.sync(() => RichText.make({ text: "" }))),
  S.withConstructorDefault(Effect.sync(() => RichText.make({ text: "" })))
);

const Taxonomy = LiteralKit(["tag", "niche", "flair", "topic"]).pipe(
  $I.annoteSchema("Taxonomy", {
    description: "Vocabulary a label belongs to when the site keeps it apart from the text.",
  })
);

class TagLabel extends S.Opaque<TagLabel, { readonly brand: unique symbol }>()(
  S.Struct({ taxonomy: S.tag("tag"), name: S.NonEmptyString }).pipe(
    $I.annoteSchema("TagLabel", { description: "A free-form keyword the author or site attached." })
  )
) {}

class NicheLabel extends S.Opaque<NicheLabel, { readonly brand: unique symbol }>()(
  S.Struct({ taxonomy: S.tag("niche"), name: S.NonEmptyString }).pipe(
    $I.annoteSchema("NicheLabel", { description: "A curated category the site files the post under." })
  )
) {}

class FlairLabel extends S.Opaque<FlairLabel, { readonly brand: unique symbol }>()(
  S.Struct({ taxonomy: S.tag("flair"), name: S.NonEmptyString }).pipe(
    $I.annoteSchema("FlairLabel", { description: "A label chosen from those a community defines." })
  )
) {}

class TopicLabel extends S.Opaque<TopicLabel, { readonly brand: unique symbol }>()(
  S.Struct({ taxonomy: S.tag("topic"), name: S.NonEmptyString }).pipe(
    $I.annoteSchema("TopicLabel", { description: "The single subject a post declares." })
  )
) {}

/**
 * **Details**
 *
 * A label is classification the site stores outside the caption: RedGifs tags
 * and niches, Reddit flair, a Threads topic, YouTube keywords. A hashtag
 * written in the caption is a {@link TextEntity} instead.
 *
 * **Example** (Label a clip with a niche)
 *
 * ```ts import.meta.vitest name="Label a clip with a niche"
 * import { Label } from "@beep/scratchpad/int/content"
 *
 * const label = Label.cases.niche.make({ name: "Sunsets" })
 * Label.isAnyOf(["niche", "topic"])(label) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Label = Taxonomy.mapMembers(() => Tuple.make(TagLabel, NicheLabel, FlairLabel, TopicLabel)).pipe(
  S.toTaggedUnion("taxonomy"),
  $I.annoteSchema("Label", {
    description: "One classification a site attaches to a post outside its text, discriminated by `taxonomy`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Label = typeof Label.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Label {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly taxonomy: "tag" | "niche" | "flair" | "topic";
    readonly name: string;
  }
}

const Pixels = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("Pixels", { description: "A positive length in pixels." })
);

/**
 * **Details**
 *
 * Most sites sign media URLs and let them expire, so a rendition is a cache
 * entry and never an identity. `label` keeps whatever the site calls the
 * variant (`hd`, `236x`, `thumb`, `_400x400`) for sites that name sizes
 * instead of measuring them.
 *
 * **Example** (Record one size of an image)
 *
 * ```ts import.meta.vitest name="Record one size of an image"
 * import { Rendition } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const rendition = S.decodeUnknownOption(Rendition)({ url: "https://cdn.example/a.jpg", width: 1080 })
 * O.flatMap(rendition, ({ width }) => width) // => O.some(1080)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Rendition extends S.Opaque<Rendition, { readonly brand: unique symbol }>()(
  S.Struct({
    url: S.URLFromString,
    width: absent(Pixels, "Width of this variant, when the site reports it."),
    height: absent(Pixels, "Height of this variant, when the site reports it."),
    label: absent(S.NonEmptyString, "Name the site gives this variant."),
    expiresAt: absent(S.DateTimeUtcFromMillis, "Instant a signed URL stops working."),
  }).pipe($I.annoteSchema("Rendition", { description: "One downloadable variant of an image or video." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Rendition {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly url: string;
    readonly width?: number;
    readonly height?: number;
    readonly label?: string;
    readonly expiresAt?: number;
  }
}

/**
 * **Example** (Pick the largest profile picture)
 *
 * ```ts import.meta.vitest name="Pick the largest profile picture"
 * import { Picture, largest } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const avatar = S.decodeUnknownOption(Picture)({
 *   renditions: [
 *     { url: "https://cdn.example/a_normal.jpg", width: 48 },
 *     { url: "https://cdn.example/a_400x400.jpg", width: 400 },
 *   ],
 * })
 * O.map(avatar, (picture) => largest(picture).url.href) // => O.some("https://cdn.example/a_400x400.jpg")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Picture extends S.Opaque<Picture, { readonly brand: unique symbol }>()(
  S.Struct({ renditions: S.NonEmptyArray(Rendition) }).pipe(
    $I.annoteSchema("Picture", {
      description: "A still image that stands for something else: a profile picture, a banner or a video poster.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Picture {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly renditions: readonly [Rendition.Encoded, ...Array<Rendition.Encoded>];
  }
}

const widest = Order.mapInput(Order.Number, ({ width }: Rendition) => O.getOrElse(width, () => 0));

/**
 * The rendition with the greatest reported width.
 *
 * **Gotchas**
 *
 * A rendition without a width ranks below every measured one, so a site that
 * only labels its sizes yields the first rendition it listed.
 *
 * **Example** (Choose among measured sizes)
 *
 * ```ts import.meta.vitest name="Choose among measured sizes"
 * import { Picture, largest } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const picture = S.decodeUnknownOption(Picture)({
 *   renditions: [{ url: "https://cdn.example/s.jpg", width: 150 }, { url: "https://cdn.example/l.jpg", width: 320 }],
 * })
 * O.flatMap(picture, (p) => largest(p).width) // => O.some(320)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const largest = (picture: Picture): Rendition => A.max(picture.renditions, widest);

const Unit = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
  $I.annoteSchema("Unit", { description: "Fraction of a width or height, from 0 at the left or top edge to 1." })
);

class Point extends S.Opaque<Point, { readonly brand: unique symbol }>()(
  S.Struct({ x: Unit, y: Unit }).pipe(
    $I.annoteSchema("Point", { description: "Position on a media item, independent of its pixel size." })
  )
) {}

declare namespace Point {
  export interface Encoded {
    readonly x: number;
    readonly y: number;
  }
}

/**
 * **Details**
 *
 * A tag belongs to one gallery item, never to the post: Instagram pins each
 * tag to a point on one carousel child, and X lists tagged accounts per photo
 * without a position.
 *
 * **Example** (Tag an account at a point)
 *
 * ```ts import.meta.vitest name="Tag an account at a point"
 * import { PersonTag } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const tag = S.decodeUnknownOption(PersonTag)({ account: { by: "handle", handle: "jack" }, position: { x: 0.5, y: 0.25 } })
 * O.isSome(O.flatMap(tag, ({ position }) => position)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersonTag extends S.Opaque<PersonTag, { readonly brand: unique symbol }>()(
  S.Struct({
    account: Account,
    position: absent(Point, "Where on the item the tag is pinned, on sites that position tags."),
  }).pipe($I.annoteSchema("PersonTag", { description: "An account tagged on one media item." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PersonTag {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly account: Account.Encoded;
    readonly position?: Point.Encoded;
  }
}

const MediaKind = LiteralKit(["image", "video"]).pipe(
  $I.annoteSchema("MediaKind", { description: "Whether a gallery item is a still image or a video." })
);

const AccessKind = LiteralKit(["full", "preview", "locked"]).pipe(
  $I.annoteSchema("AccessKind", {
    description: "How much of an item the viewer may fetch: all of it, a free preview, or nothing.",
  })
);

class FullAccess extends S.Opaque<FullAccess, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("full"), renditions: listed(Rendition, "Variants of the original.") }).pipe(
    $I.annoteSchema("FullAccess", { description: "The viewer may fetch the original." })
  )
) {}

declare namespace FullAccess {
  export interface Encoded {
    readonly kind: "full";
    readonly renditions?: ReadonlyArray<Rendition.Encoded>;
  }
}

class PreviewAccess extends S.Opaque<PreviewAccess, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("preview"), renditions: listed(Rendition, "Variants of the free preview.") }).pipe(
    $I.annoteSchema("PreviewAccess", {
      description: "A paywall withholds the original and the viewer may fetch a preview of it.",
    })
  )
) {}

declare namespace PreviewAccess {
  export interface Encoded {
    readonly kind: "preview";
    readonly renditions?: ReadonlyArray<Rendition.Encoded>;
  }
}

class LockedAccess extends S.Opaque<LockedAccess, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("locked") }).pipe(
    $I.annoteSchema("LockedAccess", { description: "A paywall withholds the item and nothing of it can be fetched." })
  )
) {}

declare namespace LockedAccess {
  export interface Encoded {
    readonly kind: "locked";
  }
}

/**
 * **Details**
 *
 * Only the variants that can be fetched have renditions, so a locked item
 * with a download URL cannot be written down.
 *
 * **Example** (List what a viewer may fetch)
 *
 * ```ts import.meta.vitest name="List what a viewer may fetch"
 * import { Access, Media, fetchable } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 *
 * const item = Media.cases.video.make({ access: Access.cases.locked.make({}) })
 * A.length(fetchable(item)) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Access = AccessKind.mapMembers(() => Tuple.make(FullAccess, PreviewAccess, LockedAccess)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Access", {
    description: "What of a media item the current viewer may fetch, discriminated by `kind`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Access = typeof Access.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Access {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = FullAccess.Encoded | PreviewAccess.Encoded | LockedAccess.Encoded;
}

const open = Effect.sync(() => Access.cases.full.make({}));

const itemFields = {
  id: absent(SiteId, "Identifier of this item apart from its post."),
  access: Access.pipe(
    S.annotateKey({ description: "What a paywall leaves the viewer of the item." }),
    S.withDecodingDefaultTypeKey(open),
    S.withConstructorDefault(open)
  ),
  width: absent(Pixels, "Width of the original."),
  height: absent(Pixels, "Height of the original."),
  alt: absent(S.String, "Description for readers who cannot see the item."),
  caption: absent(RichText, "Text of this item alone, on sites that caption items separately."),
  link: absent(S.URLFromString, "Outbound URL attached to this item alone."),
  tags: listed(PersonTag, "Accounts tagged on this item."),
};

interface ItemEncoded {
  readonly id?: SiteId.Encoded;
  readonly access?: Access.Encoded;
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
  readonly caption?: RichText.Encoded;
  readonly link?: string;
  readonly tags?: ReadonlyArray<PersonTag.Encoded>;
}

class Image extends S.Opaque<Image, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("image"), ...itemFields })
    .pipe($I.annoteSchema("Image", { description: "A still image in a post." }))
) {}

declare namespace Image {
  export interface Encoded extends ItemEncoded {
    readonly kind: "image";
  }
}

class Video extends S.Opaque<Video, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("video"),
    ...itemFields,
    duration: absent(S.DurationFromMillis, "Running time."),
    poster: absent(Picture, "Still shown before playback."),
  })
    .pipe($I.annoteSchema("Video", { description: "A video in a post." }))
) {}

declare namespace Video {
  export interface Encoded extends ItemEncoded {
    readonly kind: "video";
    readonly duration?: number;
    readonly poster?: Picture.Encoded;
  }
}

/**
 * **Details**
 *
 * A post is an ordered list of these. Each item owns its dimensions, alt
 * text, tags and, on some sites, its own caption and link, while the post
 * owns the shared caption and hashtags.
 *
 * **Example** (Describe a paywalled video)
 *
 * ```ts import.meta.vitest name="Describe a paywalled video"
 * import { Access, Media } from "@beep/scratchpad/int/content"
 *
 * const item = Media.cases.video.make({ access: Access.cases.locked.make({}) })
 * const described = Media.match(item, {
 *   image: () => "image",
 *   video: ({ access }) =>
 *     Access.match(access, {
 *       full: () => "video",
 *       preview: () => "preview of a video",
 *       locked: () => "locked video",
 *     }),
 * })
 * described // => "locked video"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Media = MediaKind.mapMembers(() => Tuple.make(Image, Video)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Media", { description: "One item of a post's gallery, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Media = typeof Media.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Media {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = Image.Encoded | Video.Encoded;
}

/**
 * Variants of a gallery item the current viewer may fetch: the original, a
 * preview of it, or none when the item is locked.
 *
 * **Example** (Fetch only what a paywall leaves)
 *
 * ```ts import.meta.vitest name="Fetch only what a paywall leaves"
 * import { Media, fetchable } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownOption(Media)({
 *   kind: "image",
 *   access: { kind: "preview", renditions: [{ url: "https://cdn.example/blurred.jpg" }] },
 * })
 * O.map(item, (media) => A.length(fetchable(media))) // => O.some(1)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const fetchable = ({ access }: Media): ReadonlyArray<Rendition> =>
  Access.match(access, {
    full: ({ renditions }) => renditions,
    preview: ({ renditions }) => renditions,
    locked: () => A.empty(),
  });

const TallyKind = LiteralKit(["exact", "rounded", "hidden"]).pipe(
  $I.annoteSchema("TallyKind", {
    description: "Whether a site reported a count in full, abbreviated it, or withheld it.",
  })
);

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Count", { description: "A whole number of accounts, posts or reactions." })
);

class ExactTally extends S.Opaque<ExactTally, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("exact"), count: Count }).pipe(
    $I.annoteSchema("ExactTally", { description: "A count the site reported in full." })
  )
) {}

declare namespace ExactTally {
  export interface Encoded {
    readonly kind: "exact";
    readonly count: number;
  }
}

class RoundedTally extends S.Opaque<RoundedTally, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("rounded"), count: Count }).pipe(
    $I.annoteSchema("RoundedTally", {
      description: "A count the site abbreviated, such as 1.4K, expanded to the nearest whole number.",
    })
  )
) {}

declare namespace RoundedTally {
  export interface Encoded {
    readonly kind: "rounded";
    readonly count: number;
  }
}

class HiddenTally extends S.Opaque<HiddenTally, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("hidden") }).pipe(
    $I.annoteSchema("HiddenTally", { description: "A count the site keeps but the account or site withholds." })
  )
) {}

declare namespace HiddenTally {
  export interface Encoded {
    readonly kind: "hidden";
  }
}

/**
 * **Details**
 *
 * `hidden` is a count that exists and is withheld, as when a creator turns
 * off a subscriber count. A site that has no such figure at all leaves the
 * tally absent on the enclosing value.
 *
 * **Example** (Tell an abbreviated count from a withheld one)
 *
 * ```ts import.meta.vitest name="Tell an abbreviated count from a withheld one"
 * import { Tally, counted } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * counted(Tally.cases.rounded.make({ count: 1400 })) // => O.some(1400)
 * counted(Tally.cases.hidden.make({})) // => O.none()
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Tally = TallyKind.mapMembers(() => Tuple.make(ExactTally, RoundedTally, HiddenTally)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Tally", {
    description: "A count a site publishes about a post or an account, discriminated by `kind`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Tally = typeof Tally.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Tally {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = ExactTally.Encoded | RoundedTally.Encoded | HiddenTally.Encoded;
}

/**
 * The number a tally reports, when the site shows one.
 *
 * **Example** (Read an exact count)
 *
 * ```ts import.meta.vitest name="Read an exact count"
 * import { Tally, counted } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * counted(Tally.cases.exact.make({ count: 20 })) // => O.some(20)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const counted: (tally: Tally) => O.Option<number> = Tally.match({
  exact: ({ count }) => O.some(count),
  rounded: ({ count }) => O.some(count),
  hidden: () => O.none(),
});

/**
 * **Details**
 *
 * An absent tally means the site has no such figure. A figure it keeps but
 * withholds is a `hidden` tally. Neither is zero.
 *
 * **Example** (Record only what a site shows)
 *
 * ```ts import.meta.vitest name="Record only what a site shows"
 * import { Engagement, Tally } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * const shown = Engagement.make({ likes: Tally.cases.exact.makeOption({ count: 12 }) })
 * O.isNone(shown.views) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Engagement extends S.Opaque<Engagement, { readonly brand: unique symbol }>()(
  S.Struct({
    likes: absent(Tally, "Likes, upvotes or hearts."),
    comments: absent(Tally, "Comments or replies."),
    shares: absent(Tally, "Reposts, repins or reshares."),
    views: absent(Tally, "Views or plays."),
    saves: absent(Tally, "Bookmarks or saves."),
  }).pipe($I.annoteSchema("Engagement", { description: "Audience reaction counts a site publishes for a post." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Engagement {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly likes?: Tally.Encoded;
    readonly comments?: Tally.Encoded;
    readonly shares?: Tally.Encoded;
    readonly views?: Tally.Encoded;
    readonly saves?: Tally.Encoded;
  }
}

class PostByLocator extends S.Opaque<PostByLocator, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("locator"), locator: PostLocatorFromUrl }).pipe(
    $I.annoteSchema("PostByLocator", { description: "Another post whose URL the payload makes known." })
  )
) {}

declare namespace PostByLocator {
  export interface Encoded {
    readonly by: "locator";
    readonly locator: PostLocatorFromUrl.Encoded;
  }
}

class PostById extends S.Opaque<PostById, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("id"), id: SiteId }).pipe(
    $I.annoteSchema("PostById", {
      description: "Another post of the same site known only by an identifier that prints no URL.",
    })
  )
) {}

declare namespace PostById {
  export interface Encoded {
    readonly by: "id";
    readonly id: SiteId.Encoded;
  }
}

const PostPointer = S.Union([PostByLocator, PostById]).pipe(
  S.toTaggedUnion("by"),
  $I.annoteSchema("PostPointer", { description: "How a payload names another post, discriminated by `by`." })
);

declare namespace PostPointer {
  export type Encoded = PostByLocator.Encoded | PostById.Encoded;
}

const Relation = LiteralKit(["reply", "quote", "repost", "crosspost", "remix"]).pipe(
  $I.annoteSchema("Relation", {
    description: "How a post builds on another: answers it, quotes it, repeats it, files it elsewhere, or reuses its media.",
  })
);

class Reply extends S.Opaque<Reply, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.tag("reply"), post: PostPointer }).pipe(
    $I.annoteSchema("Reply", { description: "A post that answers another." })
  )
) {}

declare namespace Reply {
  export interface Encoded {
    readonly relation: "reply";
    readonly post: PostPointer.Encoded;
  }
}

class Quote extends S.Opaque<Quote, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.tag("quote"), post: PostPointer }).pipe(
    $I.annoteSchema("Quote", { description: "A post that shows another beneath its own text." })
  )
) {}

declare namespace Quote {
  export interface Encoded {
    readonly relation: "quote";
    readonly post: PostPointer.Encoded;
  }
}

class Repost extends S.Opaque<Repost, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.tag("repost"), post: PostPointer }).pipe(
    $I.annoteSchema("Repost", { description: "A post that repeats another without adding text." })
  )
) {}

declare namespace Repost {
  export interface Encoded {
    readonly relation: "repost";
    readonly post: PostPointer.Encoded;
  }
}

class Crosspost extends S.Opaque<Crosspost, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.tag("crosspost"), post: PostPointer }).pipe(
    $I.annoteSchema("Crosspost", { description: "A post that files another in a different community." })
  )
) {}

declare namespace Crosspost {
  export interface Encoded {
    readonly relation: "crosspost";
    readonly post: PostPointer.Encoded;
  }
}

class Remix extends S.Opaque<Remix, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.tag("remix"), post: PostPointer }).pipe(
    $I.annoteSchema("Remix", { description: "A post that reuses the media of another, as a duet or stitch does." })
  )
) {}

declare namespace Remix {
  export interface Encoded {
    readonly relation: "remix";
    readonly post: PostPointer.Encoded;
  }
}

/**
 * **Details**
 *
 * A reference is a pointer, never an embedded copy. Sites that nest the whole
 * original (an X repost, a Reddit crosspost, a Threads quote) yield two posts
 * and one reference between them. Two layers discriminate it: `relation`
 * says how the post builds on the other, and `post.by` says how the payload
 * names it.
 *
 * **Example** (Describe a quoted post through both layers)
 *
 * ```ts import.meta.vitest name="Describe a quoted post through both layers"
 * import { PostReference } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const reference = S.decodeOption(PostReference)({
 *   relation: "quote",
 *   post: { by: "locator", locator: "https://twitter.com/jack/status/20" },
 * })
 * const described = O.map(
 *   reference,
 *   PostReference.matchOrElse(
 *     { quote: ({ post }) => `quotes a post named by ${post.by}` },
 *     ({ relation }) => relation
 *   )
 * )
 * described // => O.some("quotes a post named by locator")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PostReference = Relation.mapMembers(() => Tuple.make(Reply, Quote, Repost, Crosspost, Remix)).pipe(
  S.toTaggedUnion("relation"),
  $I.annoteSchema("PostReference", {
    description: "Another post this one builds on, discriminated by `relation`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type PostReference = typeof PostReference.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PostReference {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = Reply.Encoded | Quote.Encoded | Repost.Encoded | Crosspost.Encoded | Remix.Encoded;
}

const Shelf = LiteralKit(["community", "board", "playlist", "story", "highlight", "collection"]).pipe(
  $I.annoteSchema("Shelf", { description: "Kind of place a site files a post in besides its author's timeline." })
);

const shelfId = absent(SiteId, "Identifier of the container.");
const shelfName = absent(S.NonEmptyString, "Name of the container as the site shows it.");

class Community extends S.Opaque<Community, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("community"), id: shelfId, name: shelfName }).pipe(
    $I.annoteSchema("Community", { description: "A subreddit or community the post was submitted to." })
  )
) {}

declare namespace Community {
  export interface Encoded {
    readonly kind: "community";
    readonly id?: SiteId.Encoded;
    readonly name?: string;
  }
}

class Playlist extends S.Opaque<Playlist, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("playlist"), id: shelfId, name: shelfName }).pipe(
    $I.annoteSchema("Playlist", { description: "An ordered list of videos the post belongs to." })
  )
) {}

declare namespace Playlist {
  export interface Encoded {
    readonly kind: "playlist";
    readonly id?: SiteId.Encoded;
    readonly name?: string;
  }
}

class Highlight extends S.Opaque<Highlight, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("highlight"), id: shelfId, name: shelfName }).pipe(
    $I.annoteSchema("Highlight", { description: "A named set of kept stories." })
  )
) {}

declare namespace Highlight {
  export interface Encoded {
    readonly kind: "highlight";
    readonly id?: SiteId.Encoded;
    readonly name?: string;
  }
}

class Collection extends S.Opaque<Collection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), id: shelfId, name: shelfName }).pipe(
    $I.annoteSchema("Collection", { description: "A set of posts an account gathered." })
  )
) {}

declare namespace Collection {
  export interface Encoded {
    readonly kind: "collection";
    readonly id?: SiteId.Encoded;
    readonly name?: string;
  }
}

class Board extends S.Opaque<Board, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("board"),
    id: shelfId,
    name: shelfName,
    section: absent(S.NonEmptyString, "Section of the board the post sits in."),
  }).pipe($I.annoteSchema("Board", { description: "A board, and optionally one of its sections, a post was saved to." }))
) {}

declare namespace Board {
  export interface Encoded {
    readonly kind: "board";
    readonly id?: SiteId.Encoded;
    readonly name?: string;
    readonly section?: string;
  }
}

class Story extends S.Opaque<Story, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("story"), id: shelfId }).pipe(
    $I.annoteSchema("Story", { description: "The unnamed, expiring reel of an account." })
  )
) {}

declare namespace Story {
  export interface Encoded {
    readonly kind: "story";
    readonly id?: SiteId.Encoded;
  }
}

/**
 * **Example** (File a pin in a board section)
 *
 * ```ts import.meta.vitest name="File a pin in a board section"
 * import { Container } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 *
 * const shelf = Container.cases.board.make({ name: O.some("Recipes"), section: O.some("Soups") })
 * Container.matchOrElse(shelf, { board: ({ section }) => section }, () => O.none()) // => O.some("Soups")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Container = Shelf.mapMembers(() =>
  Tuple.make(Community, Board, Playlist, Story, Highlight, Collection)
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Container", {
    description: "Where a post was filed besides its author's timeline, discriminated by `kind`.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Container = typeof Container.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Container {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | Community.Encoded
    | Board.Encoded
    | Playlist.Encoded
    | Story.Encoded
    | Highlight.Encoded
    | Collection.Encoded;
}

const instant = (description: string) => absent(S.DateTimeUtcFromMillis, description);

/**
 * **Details**
 *
 * `source` is the identity and already carries the platform. Everything else
 * is what that site happened to publish: a missing title, an empty gallery or
 * an absent count is a fact about the site or the viewer, so each has an
 * empty default rather than a per-site variant.
 *
 * **Example** (Read a two-item gallery with a tag on the second item)
 *
 * ```ts import.meta.vitest name="Read a two-item gallery with a tag on the second item"
 * import { Post, tagged } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const post = S.decodeUnknownOption(Post)({
 *   source: "https://www.instagram.com/p/CxYz_12-ab",
 *   author: { by: "id", id: "25025320", handle: "example" },
 *   body: { text: "golden hour #sunset", entities: [{ kind: "hashtag", tag: "sunset" }] },
 *   media: [
 *     { kind: "image" },
 *     { kind: "image", tags: [{ account: { by: "handle", handle: "friend" }, position: { x: 0.4, y: 0.6 } }] },
 *   ],
 * })
 * O.map(post, (p) => A.length(tagged(p))) // => O.some(1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Post extends S.Opaque<Post, { readonly brand: unique symbol }>()(
  S.Struct({
    source: PostLocatorFromUrl,
    id: absent(SiteId, "Site identifier, where it differs from the one in the URL."),
    author: Account,
    collaborators: listed(Account, "Accounts credited as co-authors."),
    title: absent(S.NonEmptyString, "Headline, on sites that separate one from the body."),
    body: plain.pipe(S.annotateKey({ description: "Caption or description shared by every gallery item." })),
    media: listed(Media, "Gallery items in the order the site shows them."),
    labels: listed(Label, "Classification the site keeps outside the text."),
    links: listed(S.URLFromString, "Outbound URLs attached to the post rather than written in its text."),
    references: listed(PostReference, "Other posts this one builds on."),
    container: absent(Container, "Where the post was filed besides the author's timeline."),
    engagement: Engagement.pipe(
      S.annotateKey({ description: "Reaction counts the site publishes." }),
      S.withDecodingDefaultTypeKey(Effect.sync(() => Engagement.make({}))),
      S.withConstructorDefault(Effect.sync(() => Engagement.make({})))
    ),
    publishedAt: instant("Publication instant."),
    expiresAt: instant("Instant the site removes the post, for stories and timed posts."),
  }).pipe($I.annoteSchema("Post", { description: "One post as its site publishes it to the current viewer." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Post {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly source: PostLocatorFromUrl.Encoded;
    readonly id?: SiteId.Encoded;
    readonly author: Account.Encoded;
    readonly collaborators?: ReadonlyArray<Account.Encoded>;
    readonly title?: string;
    readonly body?: RichText.Encoded;
    readonly media?: ReadonlyArray<Media.Encoded>;
    readonly labels?: ReadonlyArray<Label.Encoded>;
    readonly links?: ReadonlyArray<string>;
    readonly references?: ReadonlyArray<PostReference.Encoded>;
    readonly container?: Container.Encoded;
    readonly engagement?: Engagement.Encoded;
    readonly publishedAt?: number;
    readonly expiresAt?: number;
  }
}

/**
 * **Example** (Link a storefront from a profile)
 *
 * ```ts import.meta.vitest name="Link a storefront from a profile"
 * import { ProfileLink } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const link = S.decodeUnknownOption(ProfileLink)({ url: "https://shop.example/", title: "Shop" })
 * O.flatMap(link, ({ title }) => title) // => O.some("Shop")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProfileLink extends S.Opaque<ProfileLink, { readonly brand: unique symbol }>()(
  S.Struct({
    url: S.URLFromString,
    title: absent(S.NonEmptyString, "Label the account gave the link."),
  }).pipe($I.annoteSchema("ProfileLink", { description: "An outbound link an account lists on its profile." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProfileLink {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly url: string;
    readonly title?: string;
  }
}

const Visibility = LiteralKit(["public", "private"]).pipe(
  $I.annoteSchema("Visibility", { description: "Whether an account shows its posts to viewers it has not approved." })
);

/**
 * **Details**
 *
 * `followers` and `following` are the counts a site prints. YouTube and
 * Reddit have no following count, VSCO prints neither, and OnlyFans hides its
 * subscriber count unless the creator opts in, so each is optional. The
 * accounts behind a count are a separate, rarely available stream: see
 * {@link SiteReader}.
 *
 * **Example** (Read a profile with a picture and counts)
 *
 * ```ts import.meta.vitest name="Read a profile with a picture and counts"
 * import { Profile, largest } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const profile = S.decodeUnknownOption(Profile)({
 *   source: "https://x.com/jack",
 *   account: { by: "id", id: "12", handle: "jack", name: "jack" },
 *   avatar: { renditions: [{ url: "https://pbs.example/a_400x400.jpg", width: 400, label: "_400x400" }] },
 *   followers: { kind: "rounded", count: 6400000 },
 * })
 * O.flatMap(profile, ({ avatar }) => O.map(avatar, (picture) => largest(picture).label)) // => O.some(O.some("_400x400"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Profile extends S.Opaque<Profile, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CollectionLocatorFromUrl,
    account: Account,
    bio: plain.pipe(S.annotateKey({ description: "Biography or channel description." })),
    links: listed(ProfileLink, "Outbound links the account lists."),
    avatar: absent(Picture, "Profile picture."),
    banner: absent(Picture, "Header image behind the profile picture."),
    followers: absent(Tally, "Accounts following or subscribed to this one."),
    following: absent(Tally, "Accounts this one follows."),
    posts: absent(Tally, "Posts the account has published."),
    verified: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the site marks the account as verified." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false)),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    visibility: Visibility.pipe(
      S.annotateKey({ description: "Whether the account is open to unapproved viewers." }),
      S.withDecodingDefaultTypeKey(Effect.succeed("public" as const)),
      S.withConstructorDefault(Effect.succeed("public" as const))
    ),
    joinedAt: instant("Instant the account was created."),
  }).pipe($I.annoteSchema("Profile", { description: "One account as its site publishes it to the current viewer." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Profile {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly source: CollectionLocatorFromUrl.Encoded;
    readonly account: Account.Encoded;
    readonly bio?: RichText.Encoded;
    readonly links?: ReadonlyArray<ProfileLink.Encoded>;
    readonly avatar?: Picture.Encoded;
    readonly banner?: Picture.Encoded;
    readonly followers?: Tally.Encoded;
    readonly following?: Tally.Encoded;
    readonly posts?: Tally.Encoded;
    readonly verified?: boolean;
    readonly visibility?: "public" | "private";
    readonly joinedAt?: number;
  }
}

/**
 * Accounts a text mentions, in the order the site listed them.
 *
 * **Example** (List the accounts a caption mentions)
 *
 * ```ts import.meta.vitest name="List the accounts a caption mentions"
 * import { Account, RichText, TextEntity, handleOf, mentions } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const jack = Account.cases.handle.make({ handle: "jack" })
 * const text = RichText.make({ text: "with @jack", entities: [TextEntity.cases.mention.make({ account: jack })] })
 * A.map(mentions(text), handleOf) // => [O.some("jack")]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const mentions = (text: RichText): ReadonlyArray<Account> =>
  A.map(A.filter(text.entities, TextEntity.guards.mention), ({ account }) => account);

/**
 * Hashtags a text carries, without their leading #.
 *
 * **Example** (List the hashtags of a caption)
 *
 * ```ts import.meta.vitest name="List the hashtags of a caption"
 * import { RichText, TextEntity, hashtags } from "@beep/scratchpad/int/content"
 *
 * const text = RichText.make({ text: "#sunset", entities: [TextEntity.cases.hashtag.make({ tag: "sunset" })] })
 * hashtags(text) // => ["sunset"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const hashtags = (text: RichText): ReadonlyArray<string> =>
  A.map(A.filter(text.entities, TextEntity.guards.hashtag), ({ tag }) => tag);

const locatorOf = S.decodeUnknownOption(LocatorFromUrl);

/**
 * Posts and accounts of supported sites that a text links to.
 *
 * **Details**
 *
 * A link to other material stays a plain link entity. Whether it names a
 * post is derived by decoding its URL, so the text never stores the same fact
 * twice.
 *
 * **Example** (Find a linked status in a caption)
 *
 * ```ts import.meta.vitest name="Find a linked status in a caption"
 * import { RichText, linked } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const text = S.decodeUnknownOption(RichText)({
 *   text: "see the original",
 *   entities: [
 *     { kind: "link", url: "https://twitter.com/jack/status/20?s=20" },
 *     { kind: "link", url: "https://example.org/essay" },
 *   ],
 * })
 * O.map(text, (t) => A.map(linked(t), ({ platform }) => platform)) // => O.some(["x"])
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const linked = (text: RichText): ReadonlyArray<Locator> =>
  pipe(
    A.filter(text.entities, TextEntity.guards.link),
    A.flatMap(({ url }) => A.fromOption(locatorOf(url.href)))
  );

/**
 * Every account tagged on any gallery item of a post, in gallery order.
 *
 * **Example** (Collect tags across a gallery)
 *
 * ```ts import.meta.vitest name="Collect tags across a gallery"
 * import { Post, handleOf, tagged } from "@beep/scratchpad/int/content"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const post = S.decodeUnknownOption(Post)({
 *   source: "https://x.com/jack/status/20",
 *   author: { by: "handle", handle: "jack" },
 *   media: [
 *     { kind: "image", tags: [{ account: { by: "handle", handle: "a" } }] },
 *     { kind: "video", tags: [{ account: { by: "handle", handle: "b" } }] },
 *   ],
 * })
 * O.map(post, (p) => A.map(tagged(p), handleOf)) // => O.some([O.some("a"), O.some("b")])
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const tagged = (post: Post): ReadonlyArray<Account> =>
  A.flatMap(post.media, ({ tags }) => A.map(tags, ({ account }) => account));

/**
 * The traversal row a post reduces to: its source, media counts and date.
 *
 * **Example** (Reduce a post to its traversal row)
 *
 * ```ts import.meta.vitest name="Reduce a post to its traversal row"
 * import { Post, summary } from "@beep/scratchpad/int/content"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const post = S.decodeUnknownOption(Post)({
 *   source: "https://x.com/jack/status/20",
 *   author: { by: "handle", handle: "jack" },
 *   media: [{ kind: "image" }, { kind: "image" }, { kind: "video" }],
 * })
 * O.map(post, (p) => summary(p).images) // => O.some(2)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const summary = (post: Post): MappedItem =>
  MappedItem.make({
    source: post.source,
    images: A.length(A.filter(post.media, Media.guards.image)),
    videos: A.length(A.filter(post.media, Media.guards.video)),
    publishedAt: post.publishedAt,
  });

/**
 * **Example** (Branch on a connection)
 *
 * ```ts import.meta.vitest name="Branch on a connection"
 * import { Connection } from "@beep/scratchpad/int/content"
 *
 * Connection.is.followers("followers") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Connection = LiteralKit(["followers", "following"]).pipe(
  $I.annoteSchema("Connection", { description: "Direction of a follow relationship seen from one account." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Connection = typeof Connection.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Connection {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = "followers" | "following";
}

/**
 * **Example** (Fall back to the printed count)
 *
 * ```ts import.meta.vitest name="Fall back to the printed count"
 * import { ConnectionsHidden } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(ConnectionsHidden.make({ platform: "reddit", connection: "followers" })).pipe(
 *   Effect.catchTag("ConnectionsHidden", () => Effect.succeed("count only"))
 * )
 * Effect.runSync(outcome) // => "count only"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ConnectionsHidden extends S.TaggedError<ConnectionsHidden, { readonly brand: unique symbol }>(
  $I`ConnectionsHidden`
)(
  "ConnectionsHidden",
  { platform: Platform, connection: Connection },
  $I.annoteError<ConnectionsHidden>("ConnectionsHidden", {
    description: "The site lists no such connections of this account to the current viewer.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConnectionsHidden {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "ConnectionsHidden";
    readonly platform: Platform.Encoded;
    readonly connection: Connection.Encoded;
  }
}

/**
 * Contract a site implementation fulfils to read what its targets publish.
 *
 * **Details**
 *
 * `posts` mirrors `SiteMapper.items` with full posts: one for a post target,
 * many for a listing. `connections` streams accounts and not profiles,
 * because a follower list entry carries an id, a handle and a name and little
 * else. It fails with {@link ConnectionsHidden} wherever the site prints a
 * count but no list: Reddit, RedGifs, VSCO, Snapchat, Dzen, and any account
 * the viewer is not allowed to enumerate.
 *
 * @typeParam Target - The site's own target union from the locator module.
 * @category ports
 * @since 0.0.0
 */
export interface SiteReader<Target> {
  readonly posts: (target: Target) => Stream.Stream<Post, MapFailure>;
  readonly profile: (target: Target) => Effect.Effect<Profile, MapFailure>;
  readonly connections: (
    target: Target,
    connection: Connection
  ) => Stream.Stream<Account, MapFailure | ConnectionsHidden>;
}

/**
 * Reads the posts, profile and connections of an X target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an X reader)
 *
 * ```ts import.meta.vitest name="Provide an X reader"
 * import { XReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(XReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = XReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XReader extends Context.Service<XReader, SiteReader<XTarget>>()($I`XReader`) {}

/**
 * Reads the posts, profile and connections of a YouTube target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a YouTube reader)
 *
 * ```ts import.meta.vitest name="Provide a YouTube reader"
 * import { YouTubeReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(YouTubeReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = YouTubeReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YouTubeReader extends Context.Service<YouTubeReader, SiteReader<YouTubeTarget>>()($I`YouTubeReader`) {}

/**
 * Reads the posts, profile and connections of a RedGifs target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a RedGifs reader)
 *
 * ```ts import.meta.vitest name="Provide a RedGifs reader"
 * import { RedGifsReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(RedGifsReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = RedGifsReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedGifsReader extends Context.Service<RedGifsReader, SiteReader<RedGifsTarget>>()($I`RedGifsReader`) {}

/**
 * Reads the posts, profile and connections of a Facebook target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Facebook reader)
 *
 * ```ts import.meta.vitest name="Provide a Facebook reader"
 * import { FacebookReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(FacebookReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = FacebookReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FacebookReader extends Context.Service<FacebookReader, SiteReader<FacebookTarget>>()($I`FacebookReader`) {}

/**
 * Reads the posts, profile and connections of a Fansly target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Fansly reader)
 *
 * ```ts import.meta.vitest name="Provide a Fansly reader"
 * import { FanslyReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(FanslyReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = FanslyReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FanslyReader extends Context.Service<FanslyReader, SiteReader<FanslyTarget>>()($I`FanslyReader`) {}

/**
 * Reads the posts, profile and connections of an Instagram target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an Instagram reader)
 *
 * ```ts import.meta.vitest name="Provide an Instagram reader"
 * import { InstagramReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(InstagramReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = InstagramReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstagramReader extends Context.Service<InstagramReader, SiteReader<InstagramTarget>>()($I`InstagramReader`) {}

/**
 * Reads the posts, profile and connections of an OnlyFans target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an OnlyFans reader)
 *
 * ```ts import.meta.vitest name="Provide an OnlyFans reader"
 * import { OnlyFansReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(OnlyFansReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = OnlyFansReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnlyFansReader extends Context.Service<OnlyFansReader, SiteReader<OnlyFansTarget>>()($I`OnlyFansReader`) {}

/**
 * Reads the posts, profile and connections of a Pinterest target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Pinterest reader)
 *
 * ```ts import.meta.vitest name="Provide a Pinterest reader"
 * import { PinterestReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(PinterestReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = PinterestReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PinterestReader extends Context.Service<PinterestReader, SiteReader<PinterestTarget>>()($I`PinterestReader`) {}

/**
 * Reads the posts, profile and connections of a Snapchat target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Snapchat reader)
 *
 * ```ts import.meta.vitest name="Provide a Snapchat reader"
 * import { SnapchatReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(SnapchatReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = SnapchatReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SnapchatReader extends Context.Service<SnapchatReader, SiteReader<SnapchatTarget>>()($I`SnapchatReader`) {}

/**
 * Reads the posts, profile and connections of a Threads target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Threads reader)
 *
 * ```ts import.meta.vitest name="Provide a Threads reader"
 * import { ThreadsReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(ThreadsReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = ThreadsReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ThreadsReader extends Context.Service<ThreadsReader, SiteReader<ThreadsTarget>>()($I`ThreadsReader`) {}

/**
 * Reads the posts, profile and connections of a TikTok target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a TikTok reader)
 *
 * ```ts import.meta.vitest name="Provide a TikTok reader"
 * import { TikTokReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(TikTokReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = TikTokReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TikTokReader extends Context.Service<TikTokReader, SiteReader<TikTokTarget>>()($I`TikTokReader`) {}

/**
 * Reads the posts, profile and connections of a VSCO target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a VSCO reader)
 *
 * ```ts import.meta.vitest name="Provide a VSCO reader"
 * import { VscoReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(VscoReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = VscoReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VscoReader extends Context.Service<VscoReader, SiteReader<VscoTarget>>()($I`VscoReader`) {}

/**
 * Reads the posts, profile and connections of a Reddit target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Reddit reader)
 *
 * ```ts import.meta.vitest name="Provide a Reddit reader"
 * import { RedditReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(RedditReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = RedditReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedditReader extends Context.Service<RedditReader, SiteReader<RedditTarget>>()($I`RedditReader`) {}

/**
 * Reads the posts, profile and connections of a Dzen target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Dzen reader)
 *
 * ```ts import.meta.vitest name="Provide a Dzen reader"
 * import { DzenReader } from "@beep/scratchpad/int/content"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(DzenReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const wired = DzenReader.use(() => Effect.succeed("wired"))
 * Effect.runSync(Effect.provide(wired, layer)) // => "wired"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DzenReader extends Context.Service<DzenReader, SiteReader<DzenTarget>>()($I`DzenReader`) {}

/**
 * Every reader service the dispatching functions may require.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Readers =
  | XReader
  | YouTubeReader
  | RedGifsReader
  | FacebookReader
  | FanslyReader
  | InstagramReader
  | OnlyFansReader
  | PinterestReader
  | SnapchatReader
  | ThreadsReader
  | TikTokReader
  | VscoReader
  | RedditReader
  | DzenReader;

/**
 * Reads the posts a locator denotes through the reader of its platform: one
 * for a post, many for a listing.
 *
 * **Example** (Read the posts behind a locator)
 *
 * ```ts import.meta.vitest name="Read the posts behind a locator"
 * import { RedGifsReader, posts } from "@beep/scratchpad/int/content"
 * import { Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const layer = Layer.succeed(RedGifsReader, {
 *   posts: () => Stream.empty,
 *   profile: () => Effect.never,
 *   connections: () => Stream.empty,
 * })
 * const user = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * const count = Stream.runCount(posts(user)).pipe(Effect.provide(layer))
 * Effect.runSync(count) // => 0
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const posts = Locator.match({
  x: ({ target }) => Stream.unwrap(XReader.useSync((reader) => reader.posts(target))),
  youtube: ({ target }) => Stream.unwrap(YouTubeReader.useSync((reader) => reader.posts(target))),
  redgifs: ({ target }) => Stream.unwrap(RedGifsReader.useSync((reader) => reader.posts(target))),
  facebook: ({ target }) => Stream.unwrap(FacebookReader.useSync((reader) => reader.posts(target))),
  fansly: ({ target }) => Stream.unwrap(FanslyReader.useSync((reader) => reader.posts(target))),
  instagram: ({ target }) => Stream.unwrap(InstagramReader.useSync((reader) => reader.posts(target))),
  onlyfans: ({ target }) => Stream.unwrap(OnlyFansReader.useSync((reader) => reader.posts(target))),
  pinterest: ({ target }) => Stream.unwrap(PinterestReader.useSync((reader) => reader.posts(target))),
  snapchat: ({ target }) => Stream.unwrap(SnapchatReader.useSync((reader) => reader.posts(target))),
  threads: ({ target }) => Stream.unwrap(ThreadsReader.useSync((reader) => reader.posts(target))),
  tiktok: ({ target }) => Stream.unwrap(TikTokReader.useSync((reader) => reader.posts(target))),
  vsco: ({ target }) => Stream.unwrap(VscoReader.useSync((reader) => reader.posts(target))),
  reddit: ({ target }) => Stream.unwrap(RedditReader.useSync((reader) => reader.posts(target))),
  dzen: ({ target }) => Stream.unwrap(DzenReader.useSync((reader) => reader.posts(target))),
});

/**
 * Reads the profile of the account a locator denotes through the reader of
 * its platform.
 *
 * **Example** (Read the profile behind a locator)
 *
 * ```ts import.meta.vitest name="Read the profile behind a locator"
 * import { profile } from "@beep/scratchpad/int/content"
 * import { locate } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const avatar = locate("https://x.com/jack").pipe(
 *   Effect.flatMap(profile),
 *   Effect.map(({ avatar }) => avatar)
 * )
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const profile = Locator.match({
  x: ({ target }) => XReader.use((reader) => reader.profile(target)),
  youtube: ({ target }) => YouTubeReader.use((reader) => reader.profile(target)),
  redgifs: ({ target }) => RedGifsReader.use((reader) => reader.profile(target)),
  facebook: ({ target }) => FacebookReader.use((reader) => reader.profile(target)),
  fansly: ({ target }) => FanslyReader.use((reader) => reader.profile(target)),
  instagram: ({ target }) => InstagramReader.use((reader) => reader.profile(target)),
  onlyfans: ({ target }) => OnlyFansReader.use((reader) => reader.profile(target)),
  pinterest: ({ target }) => PinterestReader.use((reader) => reader.profile(target)),
  snapchat: ({ target }) => SnapchatReader.use((reader) => reader.profile(target)),
  threads: ({ target }) => ThreadsReader.use((reader) => reader.profile(target)),
  tiktok: ({ target }) => TikTokReader.use((reader) => reader.profile(target)),
  vsco: ({ target }) => VscoReader.use((reader) => reader.profile(target)),
  reddit: ({ target }) => RedditReader.use((reader) => reader.profile(target)),
  dzen: ({ target }) => DzenReader.use((reader) => reader.profile(target)),
});

/**
 * Streams the accounts that follow, or are followed by, the account a
 * locator denotes.
 *
 * **Example** (Count followers, or settle for the printed count)
 *
 * ```ts import.meta.vitest name="Count followers, or settle for the printed count"
 * import { connections } from "@beep/scratchpad/int/content"
 * import { locate } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const followers = locate("https://x.com/jack").pipe(
 *   Effect.flatMap((locator) => Stream.runCount(connections(locator, "followers"))),
 *   Effect.catchTag("ConnectionsHidden", () => Effect.succeed(0))
 * )
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const connections: {
  (
    connection: Connection
  ): (locator: Locator) => Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers>;
  (locator: Locator, connection: Connection): Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers>;
} = dual(
  2,
  (locator: Locator, connection: Connection): Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers> =>
    Locator.match(locator, {
      x: ({ target }) => Stream.unwrap(XReader.useSync((reader) => reader.connections(target, connection))),
      youtube: ({ target }) => Stream.unwrap(YouTubeReader.useSync((reader) => reader.connections(target, connection))),
      redgifs: ({ target }) => Stream.unwrap(RedGifsReader.useSync((reader) => reader.connections(target, connection))),
      facebook: ({ target }) => Stream.unwrap(FacebookReader.useSync((reader) => reader.connections(target, connection))),
      fansly: ({ target }) => Stream.unwrap(FanslyReader.useSync((reader) => reader.connections(target, connection))),
      instagram: ({ target }) => Stream.unwrap(InstagramReader.useSync((reader) => reader.connections(target, connection))),
      onlyfans: ({ target }) => Stream.unwrap(OnlyFansReader.useSync((reader) => reader.connections(target, connection))),
      pinterest: ({ target }) => Stream.unwrap(PinterestReader.useSync((reader) => reader.connections(target, connection))),
      snapchat: ({ target }) => Stream.unwrap(SnapchatReader.useSync((reader) => reader.connections(target, connection))),
      threads: ({ target }) => Stream.unwrap(ThreadsReader.useSync((reader) => reader.connections(target, connection))),
      tiktok: ({ target }) => Stream.unwrap(TikTokReader.useSync((reader) => reader.connections(target, connection))),
      vsco: ({ target }) => Stream.unwrap(VscoReader.useSync((reader) => reader.connections(target, connection))),
      reddit: ({ target }) => Stream.unwrap(RedditReader.useSync((reader) => reader.connections(target, connection))),
      dzen: ({ target }) => Stream.unwrap(DzenReader.useSync((reader) => reader.connections(target, connection))),
    })
);
