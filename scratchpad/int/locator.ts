/**
 * URL locators and per-site mapper services for social profile mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as UrlParams from "effect/http/UrlParams";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as T from "effect/SchemaTransformation";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $ScratchpadId.create("int/locator");

/**
 * **Example** (Branch on a platform)
 *
 * ```ts import.meta.vitest name="Branch on a platform"
 * import { Platform } from "@beep/scratchpad/int/locator"
 *
 * Platform.is.youtube("youtube") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Platform = LiteralKit([
  "x",
  "youtube",
  "redgifs",
  "facebook",
  "fansly",
  "instagram",
  "onlyfans",
  "pinterest",
  "snapchat",
  "threads",
  "tiktok",
  "vsco",
  "reddit",
  "dzen",
]).pipe(
  $I.annoteSchema("Platform", { description: "Site whose URLs decode to a locator." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Platform {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = "x" | "youtube" | "redgifs" | "facebook" | "fansly" | "instagram" | "onlyfans" | "pinterest" | "snapchat" | "threads" | "tiktok" | "vsco" | "reddit" | "dzen";
}

const TargetKind = LiteralKit(["collection", "post"]).pipe(
  $I.annoteSchema("TargetKind", {
    description: "Whether a locator denotes a listing of posts or one post.",
  })
);

declare namespace TargetKind {
  export type Encoded = "collection" | "post";
}

const text = (identifier: string, pattern: RegExp, description: string) =>
  S.String.check(
    S.isPattern(
      pattern,
      $I.annote(`${identifier}Pattern`, {
        title: identifier,
        description,
        message: `Expected ${Str.uncapitalize(description)}`,
      })
    )
  ).pipe($I.annoteSchema(identifier, { description }));

const unreserved = (identifier: string, ...reserved: ReadonlyArray<string>) => {
  const words = HashSet.fromIterable(reserved);
  return S.makeFilter(
    (segment: string) => !HashSet.has(words, Str.toLowerCase(segment)),
    $I.annote(`${identifier}Unreserved`, {
      title: `Unreserved ${identifier}`,
      description: "Excludes first path segments the site routes to its own pages.",
      message: "Expected an account name, not a path the site reserves.",
    })
  );
};

const PostNumber = text("PostNumber", /^\d{1,20}$/, "A decimal identifier of at most twenty digits.");

declare namespace PostNumber {
  export type Encoded = string;
}

const XHandle = text("XHandle", /^[A-Za-z0-9_]{1,15}$/, "An X handle of one to fifteen letters, digits or underscores.").check(
  unreserved("XHandle", "home", "explore", "i", "search", "settings", "notifications", "messages")
);

declare namespace XHandle {
  export type Encoded = string;
}

const YouTubeHandle = text("YouTubeHandle", /^[A-Za-z0-9_.-]{3,30}$/, "A YouTube handle without its leading @.");

declare namespace YouTubeHandle {
  export type Encoded = string;
}
const YouTubeChannelId = text("YouTubeChannelId", /^UC[A-Za-z0-9_-]{22}$/, "A YouTube channel ID beginning with UC.");

declare namespace YouTubeChannelId {
  export type Encoded = string;
}
const YouTubeLegacyName = text("YouTubeLegacyName", /^[A-Za-z0-9]{1,20}$/, "A username from the retired /user/ channel URL.");

declare namespace YouTubeLegacyName {
  export type Encoded = string;
}
const YouTubeVideoId = text("YouTubeVideoId", /^[A-Za-z0-9_-]{11}$/, "An eleven-character YouTube video ID.");

declare namespace YouTubeVideoId {
  export type Encoded = string;
}
const RedGifsUser = text("RedGifsUser", /^[A-Za-z0-9._-]{1,64}$/, "A RedGifs username.");

declare namespace RedGifsUser {
  export type Encoded = string;
}
const RedGifsClipId = text("RedGifsClipId", /^[a-z0-9-]{2,100}$/, "A lowercase RedGifs clip identifier.");

declare namespace RedGifsClipId {
  export type Encoded = string;
}

const XTab = MappedLiteralKit([
  ["", "tweets"],
  ["/media", "media"],
  ["/with_replies", "replies"],
  ["/highlights", "highlights"],
]).pipe($I.annoteSchema("XTab", { description: "Path suffix of an X account route and the timeline tab it selects." }));

declare namespace XTab {
  export type Encoded = "" | "/media" | "/with_replies" | "/highlights";
}

class XCollection extends S.Opaque<XCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), handle: XHandle, tab: S.toType(XTab) }).pipe(
    $I.annoteSchema("XCollection", { description: "One timeline tab of an X account." })
  )
) {}

declare namespace XCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly handle: XHandle.Encoded;
    readonly tab: "tweets" | "media" | "replies" | "highlights";
  }
}

class XPost extends S.Opaque<XPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), handle: XHandle, id: PostNumber }).pipe(
    $I.annoteSchema("XPost", { description: "One X status and the account that posted it." })
  )
) {}

declare namespace XPost {
  export interface Encoded {
    readonly kind: "post";
    readonly handle: XHandle.Encoded;
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build an X media tab)
 *
 * ```ts import.meta.vitest name="Build an X media tab"
 * import { XTarget } from "@beep/scratchpad/int/locator"
 *
 * const target = XTarget.cases.collection.make({ handle: "jack", tab: "media" })
 * XTarget.guards.collection(target) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XTarget = TargetKind.mapMembers(() => Tuple.make(XCollection, XPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("XTarget", { description: "What an X URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type XTarget = typeof XTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace XTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | XCollection.Encoded
    | XPost.Encoded;
}

const XTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", XHandle, XTab]).pipe(
    S.decodeTo(
      XCollection,
      T.transform({
        decode: ([, handle, tab]) => ({ kind: "collection", handle, tab }),
        encode: ({ handle, tab }) => ["/", handle, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/", XHandle, "/status/", PostNumber]).pipe(
    S.decodeTo(
      XPost,
      T.transform({
        decode: ([, handle, , id]) => ({ kind: "post", handle, id }),
        encode: ({ handle, id }) => ["/", handle, "/status/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("XTargetFromRoute", { description: "Reads and prints X targets as site-relative routes." }));

declare namespace XTargetFromRoute {
  export type Encoded =
    | `/${XHandle.Encoded}${XTab.Encoded}`
    | `/${XHandle.Encoded}/status/${PostNumber.Encoded}`;
}

class ChannelByHandle extends S.Opaque<ChannelByHandle, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("handle"), handle: YouTubeHandle }).pipe(
    $I.annoteSchema("ChannelByHandle", { description: "Channel named by its current handle." })
  )
) {}

declare namespace ChannelByHandle {
  export interface Encoded {
    readonly by: "handle";
    readonly handle: YouTubeHandle.Encoded;
  }
}

class ChannelById extends S.Opaque<ChannelById, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("id"), id: YouTubeChannelId }).pipe(
    $I.annoteSchema("ChannelById", { description: "Channel named by its permanent identifier." })
  )
) {}

declare namespace ChannelById {
  export interface Encoded {
    readonly by: "id";
    readonly id: YouTubeChannelId.Encoded;
  }
}

class ChannelByUser extends S.Opaque<ChannelByUser, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("user"), name: YouTubeLegacyName }).pipe(
    $I.annoteSchema("ChannelByUser", { description: "Channel named by its legacy username." })
  )
) {}

declare namespace ChannelByUser {
  export interface Encoded {
    readonly by: "user";
    readonly name: YouTubeLegacyName.Encoded;
  }
}

const YouTubeChannelFromPath = S.Union([
  S.TemplateLiteralParser(["/@", YouTubeHandle]).pipe(
    S.decodeTo(
      ChannelByHandle,
      T.transform({ decode: ([, handle]) => ({ by: "handle", handle }), encode: ({ handle }) => ["/@", handle] })
    )
  ),
  S.TemplateLiteralParser(["/channel/", YouTubeChannelId]).pipe(
    S.decodeTo(
      ChannelById,
      T.transform({ decode: ([, id]) => ({ by: "id", id }), encode: ({ id }) => ["/channel/", id] })
    )
  ),
  S.TemplateLiteralParser(["/user/", YouTubeLegacyName]).pipe(
    S.decodeTo(
      ChannelByUser,
      T.transform({ decode: ([, name]) => ({ by: "user", name }), encode: ({ name }) => ["/user/", name] })
    )
  ),
]).pipe(
  $I.annoteSchema("YouTubeChannelFromPath", {
    description: "Reads and prints the three ways a YouTube path names a channel.",
  })
);

declare namespace YouTubeChannelFromPath {
  export type Encoded =
    | `/@${YouTubeHandle.Encoded}`
    | `/channel/${YouTubeChannelId.Encoded}`
    | `/user/${YouTubeLegacyName.Encoded}`;
}

const YouTubeTab = MappedLiteralKit([
  ["", "home"],
  ["/videos", "videos"],
  ["/shorts", "shorts"],
  ["/streams", "streams"],
]).pipe($I.annoteSchema("YouTubeTab", { description: "Path suffix of a YouTube channel route and the channel tab it selects." }));

declare namespace YouTubeTab {
  export type Encoded = "" | "/videos" | "/shorts" | "/streams";
}

class YouTubeCollection extends S.Opaque<YouTubeCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), channel: YouTubeChannelFromPath, tab: S.toType(YouTubeTab) }).pipe(
    $I.annoteSchema("YouTubeCollection", { description: "One tab of a YouTube channel." })
  )
) {}

declare namespace YouTubeCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly channel: YouTubeChannelFromPath.Encoded;
    readonly tab: "home" | "videos" | "shorts" | "streams";
  }
}

class YouTubeVideo extends S.Opaque<YouTubeVideo, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), id: YouTubeVideoId }).pipe(
    $I.annoteSchema("YouTubeVideo", { description: "One YouTube video, which does not name its channel." })
  )
) {}

declare namespace YouTubeVideo {
  export interface Encoded {
    readonly kind: "post";
    readonly id: YouTubeVideoId.Encoded;
  }
}

/**
 * **Example** (Recognize a YouTube video target)
 *
 * ```ts import.meta.vitest name="Recognize a YouTube video target"
 * import { YouTubeTarget } from "@beep/scratchpad/int/locator"
 *
 * const video = YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" })
 * YouTubeTarget.guards.post(video) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YouTubeTarget = TargetKind.mapMembers(() => Tuple.make(YouTubeCollection, YouTubeVideo)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("YouTubeTarget", { description: "What a YouTube URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type YouTubeTarget = typeof YouTubeTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YouTubeTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | YouTubeCollection.Encoded
    | YouTubeVideo.Encoded;
}

const YouTubeTargetFromRoute = S.Union([
  S.TemplateLiteralParser([S.toEncoded(YouTubeChannelFromPath), YouTubeTab]).pipe(
    S.decodeTo(
      YouTubeCollection,
      T.transform({
        decode: ([channel, tab]) => ({ kind: "collection", channel, tab }),
        encode: ({ channel, tab }) => [channel, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/watch?v=", YouTubeVideoId]).pipe(
    S.decodeTo(
      YouTubeVideo,
      T.transform({ decode: ([, id]) => ({ kind: "post", id }), encode: ({ id }) => ["/watch?v=", id] })
    )
  ),
  S.TemplateLiteralParser(["/shorts/", YouTubeVideoId]).pipe(
    S.decodeTo(
      YouTubeVideo,
      T.transform({ decode: ([, id]) => ({ kind: "post", id }), encode: ({ id }) => ["/shorts/", id] })
    )
  ),
]).pipe(
  $I.annoteSchema("YouTubeTargetFromRoute", {
    description: "Reads every accepted YouTube route and prints the first one that fits.",
  })
);

declare namespace YouTubeTargetFromRoute {
  export type Encoded =
    | `${YouTubeChannelFromPath.Encoded}${YouTubeTab.Encoded}`
    | `/watch?v=${YouTubeVideoId.Encoded}`
    | `/shorts/${YouTubeVideoId.Encoded}`;
}

class RedGifsCollection extends S.Opaque<RedGifsCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: RedGifsUser }).pipe(
    $I.annoteSchema("RedGifsCollection", { description: "Every clip published by one RedGifs account." })
  )
) {}

declare namespace RedGifsCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: RedGifsUser.Encoded;
  }
}

class RedGifsClip extends S.Opaque<RedGifsClip, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), id: RedGifsClipId }).pipe(
    $I.annoteSchema("RedGifsClip", { description: "One RedGifs clip, which does not name its account." })
  )
) {}

declare namespace RedGifsClip {
  export interface Encoded {
    readonly kind: "post";
    readonly id: RedGifsClipId.Encoded;
  }
}

/**
 * **Example** (Build a RedGifs account listing)
 *
 * ```ts import.meta.vitest name="Build a RedGifs account listing"
 * import { RedGifsTarget } from "@beep/scratchpad/int/locator"
 *
 * RedGifsTarget.cases.collection.make({ user: "example" }).kind // => "collection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RedGifsTarget = TargetKind.mapMembers(() => Tuple.make(RedGifsCollection, RedGifsClip)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("RedGifsTarget", { description: "What a RedGifs URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type RedGifsTarget = typeof RedGifsTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RedGifsTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | RedGifsCollection.Encoded
    | RedGifsClip.Encoded;
}

const RedGifsTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/users/", RedGifsUser]).pipe(
    S.decodeTo(
      RedGifsCollection,
      T.transform({ decode: ([, user]) => ({ kind: "collection", user }), encode: ({ user }) => ["/users/", user] })
    )
  ),
  S.TemplateLiteralParser(["/watch/", RedGifsClipId]).pipe(
    S.decodeTo(
      RedGifsClip,
      T.transform({ decode: ([, id]) => ({ kind: "post", id }), encode: ({ id }) => ["/watch/", id] })
    )
  ),
]).pipe(
  $I.annoteSchema("RedGifsTargetFromRoute", { description: "Reads and prints RedGifs targets as site-relative routes." })
);

declare namespace RedGifsTargetFromRoute {
  export type Encoded =
    | `/users/${RedGifsUser.Encoded}`
    | `/watch/${RedGifsClipId.Encoded}`;
}

const FacebookName = text("FacebookName", /^[A-Za-z0-9][A-Za-z0-9.]{0,49}$/, "A Facebook page or profile name.").check(
  unreserved("FacebookName", "reel", "photo", "watch", "groups", "marketplace", "profile.php")
);

declare namespace FacebookName {
  export type Encoded = string;
}

class FacebookPageByName extends S.Opaque<FacebookPageByName, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("name"), name: FacebookName }).pipe(
    $I.annoteSchema("FacebookPageByName", { description: "Facebook page named by its vanity name." })
  )
) {}

declare namespace FacebookPageByName {
  export interface Encoded {
    readonly by: "name";
    readonly name: FacebookName.Encoded;
  }
}

class FacebookPageById extends S.Opaque<FacebookPageById, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("id"), id: PostNumber }).pipe(
    $I.annoteSchema("FacebookPageById", { description: "Facebook page named by its numeric identifier." })
  )
) {}

declare namespace FacebookPageById {
  export interface Encoded {
    readonly by: "id";
    readonly id: PostNumber.Encoded;
  }
}

const FacebookPageFromPath = S.Union([
  S.TemplateLiteralParser(["/", FacebookName]).pipe(
    S.decodeTo(
      FacebookPageByName,
      T.transform({
        decode: ([, name]) => ({ by: "name", name }),
        encode: ({ name }) => ["/", name],
      })
    )
  ),
  S.TemplateLiteralParser(["/profile.php?id=", PostNumber]).pipe(
    S.decodeTo(
      FacebookPageById,
      T.transform({
        decode: ([, id]) => ({ by: "id", id }),
        encode: ({ id }) => ["/profile.php?id=", id],
      })
    )
  ),
]).pipe($I.annoteSchema("FacebookPageFromPath", { description: "Reads and prints the two ways a Facebook route names a page." }));

declare namespace FacebookPageFromPath {
  export type Encoded =
    | `/${FacebookName.Encoded}`
    | `/profile.php?id=${PostNumber.Encoded}`;
}

const FacebookTab = MappedLiteralKit([
  ["", "posts"],
  ["/photos", "photos"],
  ["/photos_albums", "albums"],
  ["/reels", "reels"],
]).pipe($I.annoteSchema("FacebookTab", { description: "Path suffix of a Facebook page route and the listing it selects." }));

declare namespace FacebookTab {
  export type Encoded = "" | "/photos" | "/photos_albums" | "/reels";
}

const FacebookPostForm = MappedLiteralKit([
  ["/reel/", "reel"],
  ["/photo?fbid=", "photo"],
]).pipe($I.annoteSchema("FacebookPostForm", { description: "Route prefix of a Facebook post and whether it is a reel or a photo." }));

declare namespace FacebookPostForm {
  export type Encoded = "/reel/" | "/photo?fbid=";
}

class FacebookCollection extends S.Opaque<FacebookCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), page: FacebookPageFromPath, tab: S.toType(FacebookTab) }).check(
    S.makeFilter(
      ({ page, tab }) => page.by === "name" || tab === "posts",
      $I.annote("FacebookTabNeedsName", {
        title: "Facebook tab needs a page name",
        description: "A page named only by its identifier has no tab routes beyond its posts.",
        message: "Expected a named page for any listing other than posts.",
      })
    )
  ).pipe(
    $I.annoteSchema("FacebookCollection", { description: "One listing of a Facebook page." })
  )
) {}

declare namespace FacebookCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly page: FacebookPageFromPath.Encoded;
    readonly tab: "posts" | "photos" | "albums" | "reels";
  }
}

class FacebookPost extends S.Opaque<FacebookPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), form: S.toType(FacebookPostForm), id: PostNumber }).pipe(
    $I.annoteSchema("FacebookPost", { description: "One Facebook reel or photo, which does not name its page." })
  )
) {}

declare namespace FacebookPost {
  export interface Encoded {
    readonly kind: "post";
    readonly form: "reel" | "photo";
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build a Facebook reel target)
 *
 * ```ts import.meta.vitest name="Build a Facebook reel target"
 * import { FacebookTarget } from "@beep/scratchpad/int/locator"
 *
 * FacebookTarget.cases.post.make({ form: "reel", id: "1234567890" }).kind // => "post"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FacebookTarget = TargetKind.mapMembers(() => Tuple.make(FacebookCollection, FacebookPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("FacebookTarget", { description: "What a Facebook URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type FacebookTarget = typeof FacebookTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FacebookTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | FacebookCollection.Encoded
    | FacebookPost.Encoded;
}

const FacebookTargetFromRoute = S.Union([
  S.TemplateLiteralParser([S.toEncoded(FacebookPageFromPath), FacebookTab]).pipe(
    S.decodeTo(
      FacebookCollection,
      T.transform({
        decode: ([page, tab]) => ({ kind: "collection", page, tab }),
        encode: ({ page, tab }) => [page, tab],
      })
    )
  ),
  S.TemplateLiteralParser([FacebookPostForm, PostNumber]).pipe(
    S.decodeTo(
      FacebookPost,
      T.transform({
        decode: ([form, id]) => ({ kind: "post", form, id }),
        encode: ({ form, id }) => [form, id],
      })
    )
  ),
]).pipe($I.annoteSchema("FacebookTargetFromRoute", { description: "Reads and prints Facebook targets as site-relative routes." }));

declare namespace FacebookTargetFromRoute {
  export type Encoded =
    | `${FacebookPageFromPath.Encoded}${FacebookTab.Encoded}`
    | `${FacebookPostForm.Encoded}${PostNumber.Encoded}`;
}

const FanslyUser = text("FanslyUser", /^[A-Za-z0-9_-]{2,30}$/, "A Fansly username.").check(
  unreserved("FanslyUser", "post", "explore", "messages")
);

declare namespace FanslyUser {
  export type Encoded = string;
}

class FanslyCollection extends S.Opaque<FanslyCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: FanslyUser }).pipe(
    $I.annoteSchema("FanslyCollection", { description: "Every post published by one Fansly account." })
  )
) {}

declare namespace FanslyCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: FanslyUser.Encoded;
  }
}

class FanslyPost extends S.Opaque<FanslyPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), id: PostNumber }).pipe(
    $I.annoteSchema("FanslyPost", { description: "One Fansly post, which does not name its account." })
  )
) {}

declare namespace FanslyPost {
  export interface Encoded {
    readonly kind: "post";
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build a Fansly account listing)
 *
 * ```ts import.meta.vitest name="Build a Fansly account listing"
 * import { FanslyTarget } from "@beep/scratchpad/int/locator"
 *
 * FanslyTarget.cases.collection.make({ user: "example" }).kind // => "collection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FanslyTarget = TargetKind.mapMembers(() => Tuple.make(FanslyCollection, FanslyPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("FanslyTarget", { description: "What a Fansly URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type FanslyTarget = typeof FanslyTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FanslyTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | FanslyCollection.Encoded
    | FanslyPost.Encoded;
}

const FanslyTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", FanslyUser]).pipe(
    S.decodeTo(
      FanslyCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/post/", PostNumber]).pipe(
    S.decodeTo(
      FanslyPost,
      T.transform({
        decode: ([, id]) => ({ kind: "post", id }),
        encode: ({ id }) => ["/post/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("FanslyTargetFromRoute", { description: "Reads and prints Fansly targets as site-relative routes." }));

declare namespace FanslyTargetFromRoute {
  export type Encoded =
    | `/${FanslyUser.Encoded}`
    | `/post/${PostNumber.Encoded}`;
}

const InstagramUser = text("InstagramUser", /^[A-Za-z0-9_.]{1,30}$/, "An Instagram username.").check(
  unreserved("InstagramUser", "p", "reel", "reels", "stories", "explore", "accounts", "direct")
);

declare namespace InstagramUser {
  export type Encoded = string;
}
const InstagramShortcode = text("InstagramShortcode", /^[A-Za-z0-9_-]{5,64}$/, "An Instagram media shortcode.");

declare namespace InstagramShortcode {
  export type Encoded = string;
}

const InstagramKind = LiteralKit(["collection", "stories", "highlight", "post"]).pipe(
  $I.annoteSchema("InstagramKind", { description: "The four things an Instagram URL can denote." })
);

declare namespace InstagramKind {
  export type Encoded = "collection" | "stories" | "highlight" | "post";
}

const InstagramTab = MappedLiteralKit([
  ["", "posts"],
  ["/reels", "reels"],
  ["/tagged", "tagged"],
]).pipe($I.annoteSchema("InstagramTab", { description: "Path suffix of an Instagram account route and the grid tab it selects." }));

declare namespace InstagramTab {
  export type Encoded = "" | "/reels" | "/tagged";
}

const InstagramPostForm = MappedLiteralKit([
  ["/p/", "post"],
  ["/reel/", "reel"],
]).pipe($I.annoteSchema("InstagramPostForm", { description: "Route prefix of an Instagram post and whether it is a post or a reel." }));

declare namespace InstagramPostForm {
  export type Encoded = "/p/" | "/reel/";
}

class InstagramCollection extends S.Opaque<InstagramCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: InstagramUser, tab: S.toType(InstagramTab) }).pipe(
    $I.annoteSchema("InstagramCollection", { description: "One grid tab of an Instagram account." })
  )
) {}

declare namespace InstagramCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: InstagramUser.Encoded;
    readonly tab: "posts" | "reels" | "tagged";
  }
}

class InstagramStories extends S.Opaque<InstagramStories, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("stories"), user: InstagramUser }).pipe(
    $I.annoteSchema("InstagramStories", { description: "The current stories of an Instagram account." })
  )
) {}

declare namespace InstagramStories {
  export interface Encoded {
    readonly kind: "stories";
    readonly user: InstagramUser.Encoded;
  }
}

class InstagramHighlight extends S.Opaque<InstagramHighlight, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("highlight"), id: PostNumber }).pipe(
    $I.annoteSchema("InstagramHighlight", { description: "One Instagram highlight reel, which does not name its account." })
  )
) {}

declare namespace InstagramHighlight {
  export interface Encoded {
    readonly kind: "highlight";
    readonly id: PostNumber.Encoded;
  }
}

class InstagramPost extends S.Opaque<InstagramPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), form: S.toType(InstagramPostForm), shortcode: InstagramShortcode }).pipe(
    $I.annoteSchema("InstagramPost", { description: "One Instagram post or reel, which does not name its account." })
  )
) {}

declare namespace InstagramPost {
  export interface Encoded {
    readonly kind: "post";
    readonly form: "post" | "reel";
    readonly shortcode: InstagramShortcode.Encoded;
  }
}

/**
 * **Example** (Tell Instagram stories from a grid tab)
 *
 * ```ts import.meta.vitest name="Tell Instagram stories from a grid tab"
 * import { InstagramTarget } from "@beep/scratchpad/int/locator"
 *
 * const stories = InstagramTarget.cases.stories.make({ user: "example" })
 * InstagramTarget.guards.collection(stories) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InstagramTarget = InstagramKind.mapMembers(() => Tuple.make(InstagramCollection, InstagramStories, InstagramHighlight, InstagramPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("InstagramTarget", { description: "What an Instagram URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type InstagramTarget = typeof InstagramTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InstagramTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | InstagramCollection.Encoded
    | InstagramStories.Encoded
    | InstagramHighlight.Encoded
    | InstagramPost.Encoded;
}

const InstagramTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", InstagramUser, InstagramTab]).pipe(
    S.decodeTo(
      InstagramCollection,
      T.transform({
        decode: ([, user, tab]) => ({ kind: "collection", user, tab }),
        encode: ({ user, tab }) => ["/", user, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/stories/", InstagramUser]).pipe(
    S.decodeTo(
      InstagramStories,
      T.transform({
        decode: ([, user]) => ({ kind: "stories", user }),
        encode: ({ user }) => ["/stories/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/stories/highlights/", PostNumber]).pipe(
    S.decodeTo(
      InstagramHighlight,
      T.transform({
        decode: ([, id]) => ({ kind: "highlight", id }),
        encode: ({ id }) => ["/stories/highlights/", id],
      })
    )
  ),
  S.TemplateLiteralParser([InstagramPostForm, InstagramShortcode]).pipe(
    S.decodeTo(
      InstagramPost,
      T.transform({
        decode: ([form, shortcode]) => ({ kind: "post", form, shortcode }),
        encode: ({ form, shortcode }) => [form, shortcode],
      })
    )
  ),
]).pipe($I.annoteSchema("InstagramTargetFromRoute", { description: "Reads and prints Instagram targets as site-relative routes." }));

declare namespace InstagramTargetFromRoute {
  export type Encoded =
    | `/${InstagramUser.Encoded}${InstagramTab.Encoded}`
    | `/stories/${InstagramUser.Encoded}`
    | `/stories/highlights/${PostNumber.Encoded}`
    | `${InstagramPostForm.Encoded}${InstagramShortcode.Encoded}`;
}

const OnlyFansUser = text("OnlyFansUser", /^[A-Za-z][A-Za-z0-9._-]{1,63}$/, "An OnlyFans username beginning with a letter.").check(
  unreserved("OnlyFansUser", "my", "posts")
);

declare namespace OnlyFansUser {
  export type Encoded = string;
}

class OnlyFansCollection extends S.Opaque<OnlyFansCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: OnlyFansUser }).pipe(
    $I.annoteSchema("OnlyFansCollection", { description: "Every post published by one OnlyFans account." })
  )
) {}

declare namespace OnlyFansCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: OnlyFansUser.Encoded;
  }
}

class OnlyFansPost extends S.Opaque<OnlyFansPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), user: OnlyFansUser, id: PostNumber }).pipe(
    $I.annoteSchema("OnlyFansPost", { description: "One OnlyFans post and the account that published it." })
  )
) {}

declare namespace OnlyFansPost {
  export interface Encoded {
    readonly kind: "post";
    readonly user: OnlyFansUser.Encoded;
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build an OnlyFans post target)
 *
 * ```ts import.meta.vitest name="Build an OnlyFans post target"
 * import { OnlyFansTarget } from "@beep/scratchpad/int/locator"
 *
 * OnlyFansTarget.cases.post.make({ user: "example", id: "42" }).kind // => "post"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OnlyFansTarget = TargetKind.mapMembers(() => Tuple.make(OnlyFansCollection, OnlyFansPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("OnlyFansTarget", { description: "What an OnlyFans URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type OnlyFansTarget = typeof OnlyFansTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OnlyFansTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | OnlyFansCollection.Encoded
    | OnlyFansPost.Encoded;
}

const OnlyFansTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", OnlyFansUser]).pipe(
    S.decodeTo(
      OnlyFansCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/", PostNumber, "/", OnlyFansUser]).pipe(
    S.decodeTo(
      OnlyFansPost,
      T.transform({
        decode: ([, id, , user]) => ({ kind: "post", user, id }),
        encode: ({ user, id }) => ["/", id, "/", user],
      })
    )
  ),
]).pipe($I.annoteSchema("OnlyFansTargetFromRoute", { description: "Reads and prints OnlyFans targets as site-relative routes." }));

declare namespace OnlyFansTargetFromRoute {
  export type Encoded =
    | `/${OnlyFansUser.Encoded}`
    | `/${PostNumber.Encoded}/${OnlyFansUser.Encoded}`;
}

const PinterestUser = text("PinterestUser", /^[A-Za-z0-9_-]{3,30}$/, "A Pinterest username.").check(
  unreserved("PinterestUser", "pin", "ideas", "search", "today")
);

declare namespace PinterestUser {
  export type Encoded = string;
}

class PinterestCollection extends S.Opaque<PinterestCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: PinterestUser }).pipe(
    $I.annoteSchema("PinterestCollection", { description: "Every pin saved by one Pinterest account." })
  )
) {}

declare namespace PinterestCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: PinterestUser.Encoded;
  }
}

class PinterestPin extends S.Opaque<PinterestPin, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), id: PostNumber }).pipe(
    $I.annoteSchema("PinterestPin", { description: "One pin, which does not name its account." })
  )
) {}

declare namespace PinterestPin {
  export interface Encoded {
    readonly kind: "post";
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build a Pinterest pin target)
 *
 * ```ts import.meta.vitest name="Build a Pinterest pin target"
 * import { PinterestTarget } from "@beep/scratchpad/int/locator"
 *
 * PinterestTarget.cases.post.make({ id: "99" }).kind // => "post"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PinterestTarget = TargetKind.mapMembers(() => Tuple.make(PinterestCollection, PinterestPin)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("PinterestTarget", { description: "What a Pinterest URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type PinterestTarget = typeof PinterestTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PinterestTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | PinterestCollection.Encoded
    | PinterestPin.Encoded;
}

const PinterestTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", PinterestUser]).pipe(
    S.decodeTo(
      PinterestCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/pin/", PostNumber]).pipe(
    S.decodeTo(
      PinterestPin,
      T.transform({
        decode: ([, id]) => ({ kind: "post", id }),
        encode: ({ id }) => ["/pin/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("PinterestTargetFromRoute", { description: "Reads and prints Pinterest targets as site-relative routes." }));

declare namespace PinterestTargetFromRoute {
  export type Encoded =
    | `/${PinterestUser.Encoded}`
    | `/pin/${PostNumber.Encoded}`;
}

const SnapchatUser = text("SnapchatUser", /^[A-Za-z0-9._-]{3,15}$/, "A Snapchat username.");

declare namespace SnapchatUser {
  export type Encoded = string;
}
const SpotlightId = text("SpotlightId", /^[A-Za-z0-9_-]{8,128}$/, "A Snapchat spotlight identifier.");

declare namespace SpotlightId {
  export type Encoded = string;
}

const SnapchatTab = MappedLiteralKit([
  ["", "profile"],
  ["/stories", "stories"],
  ["/spotlights", "spotlight"],
]).pipe($I.annoteSchema("SnapchatTab", { description: "Path suffix of a Snapchat profile route and the listing it selects." }));

declare namespace SnapchatTab {
  export type Encoded = "" | "/stories" | "/spotlights";
}

class SnapchatCollection extends S.Opaque<SnapchatCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: SnapchatUser, tab: S.toType(SnapchatTab) }).pipe(
    $I.annoteSchema("SnapchatCollection", { description: "One listing of a public Snapchat profile." })
  )
) {}

declare namespace SnapchatCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: SnapchatUser.Encoded;
    readonly tab: "profile" | "stories" | "spotlight";
  }
}

class SnapchatSpotlight extends S.Opaque<SnapchatSpotlight, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), user: SnapchatUser, id: SpotlightId }).pipe(
    $I.annoteSchema("SnapchatSpotlight", { description: "One spotlight video and the account that posted it." })
  )
) {}

declare namespace SnapchatSpotlight {
  export interface Encoded {
    readonly kind: "post";
    readonly user: SnapchatUser.Encoded;
    readonly id: SpotlightId.Encoded;
  }
}

/**
 * **Example** (Build a Snapchat stories listing)
 *
 * ```ts import.meta.vitest name="Build a Snapchat stories listing"
 * import { SnapchatTarget } from "@beep/scratchpad/int/locator"
 *
 * SnapchatTarget.cases.collection.make({ user: "example", tab: "stories" }).tab // => "stories"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SnapchatTarget = TargetKind.mapMembers(() => Tuple.make(SnapchatCollection, SnapchatSpotlight)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("SnapchatTarget", { description: "What a Snapchat URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type SnapchatTarget = typeof SnapchatTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SnapchatTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | SnapchatCollection.Encoded
    | SnapchatSpotlight.Encoded;
}

const SnapchatTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/@", SnapchatUser, SnapchatTab]).pipe(
    S.decodeTo(
      SnapchatCollection,
      T.transform({
        decode: ([, user, tab]) => ({ kind: "collection", user, tab }),
        encode: ({ user, tab }) => ["/@", user, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/add/", SnapchatUser]).pipe(
    S.decodeTo(
      SnapchatCollection,
      T.transform({
        decode: ([, user]): typeof SnapchatCollection.Encoded => ({ kind: "collection", user, tab: "profile" }),
        encode: ({ user }) => ["/add/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/@", SnapchatUser, "/spotlight/", SpotlightId]).pipe(
    S.decodeTo(
      SnapchatSpotlight,
      T.transform({
        decode: ([, user, , id]) => ({ kind: "post", user, id }),
        encode: ({ user, id }) => ["/@", user, "/spotlight/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("SnapchatTargetFromRoute", { description: "Reads every accepted Snapchat route and prints the first one that fits." }));

declare namespace SnapchatTargetFromRoute {
  export type Encoded =
    | `/@${SnapchatUser.Encoded}${SnapchatTab.Encoded}`
    | `/add/${SnapchatUser.Encoded}`
    | `/@${SnapchatUser.Encoded}/spotlight/${SpotlightId.Encoded}`;
}

const ThreadsUser = text("ThreadsUser", /^[A-Za-z0-9_.]{1,30}$/, "A Threads username without its leading @.");

declare namespace ThreadsUser {
  export type Encoded = string;
}
const ThreadsShortcode = text("ThreadsShortcode", /^[A-Za-z0-9_-]{5,64}$/, "A Threads post shortcode.");

declare namespace ThreadsShortcode {
  export type Encoded = string;
}

const ThreadsTab = MappedLiteralKit([
  ["", "posts"],
  ["/media", "media"],
]).pipe($I.annoteSchema("ThreadsTab", { description: "Path suffix of a Threads profile route and the tab it selects." }));

declare namespace ThreadsTab {
  export type Encoded = "" | "/media";
}

class ThreadsCollection extends S.Opaque<ThreadsCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: ThreadsUser, tab: S.toType(ThreadsTab) }).pipe(
    $I.annoteSchema("ThreadsCollection", { description: "One tab of a Threads profile." })
  )
) {}

declare namespace ThreadsCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: ThreadsUser.Encoded;
    readonly tab: "posts" | "media";
  }
}

class ThreadsPost extends S.Opaque<ThreadsPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), user: ThreadsUser, shortcode: ThreadsShortcode }).pipe(
    $I.annoteSchema("ThreadsPost", { description: "One Threads post and the account that posted it." })
  )
) {}

declare namespace ThreadsPost {
  export interface Encoded {
    readonly kind: "post";
    readonly user: ThreadsUser.Encoded;
    readonly shortcode: ThreadsShortcode.Encoded;
  }
}

/**
 * **Example** (Build a Threads media tab)
 *
 * ```ts import.meta.vitest name="Build a Threads media tab"
 * import { ThreadsTarget } from "@beep/scratchpad/int/locator"
 *
 * ThreadsTarget.cases.collection.make({ user: "example", tab: "media" }).tab // => "media"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ThreadsTarget = TargetKind.mapMembers(() => Tuple.make(ThreadsCollection, ThreadsPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ThreadsTarget", { description: "What a Threads URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ThreadsTarget = typeof ThreadsTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ThreadsTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | ThreadsCollection.Encoded
    | ThreadsPost.Encoded;
}

const ThreadsTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/@", ThreadsUser, ThreadsTab]).pipe(
    S.decodeTo(
      ThreadsCollection,
      T.transform({
        decode: ([, user, tab]) => ({ kind: "collection", user, tab }),
        encode: ({ user, tab }) => ["/@", user, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/@", ThreadsUser, "/post/", ThreadsShortcode]).pipe(
    S.decodeTo(
      ThreadsPost,
      T.transform({
        decode: ([, user, , shortcode]) => ({ kind: "post", user, shortcode }),
        encode: ({ user, shortcode }) => ["/@", user, "/post/", shortcode],
      })
    )
  ),
]).pipe($I.annoteSchema("ThreadsTargetFromRoute", { description: "Reads and prints Threads targets as site-relative routes." }));

declare namespace ThreadsTargetFromRoute {
  export type Encoded =
    | `/@${ThreadsUser.Encoded}${ThreadsTab.Encoded}`
    | `/@${ThreadsUser.Encoded}/post/${ThreadsShortcode.Encoded}`;
}

const TikTokUser = text("TikTokUser", /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/, "A TikTok username without its leading @.");

declare namespace TikTokUser {
  export type Encoded = string;
}

const TikTokPostForm = MappedLiteralKit([
  ["/video/", "video"],
  ["/photo/", "photo"],
]).pipe($I.annoteSchema("TikTokPostForm", { description: "Path segment of a TikTok post route and whether it is a video or a photo post." }));

declare namespace TikTokPostForm {
  export type Encoded = "/video/" | "/photo/";
}

class TikTokCollection extends S.Opaque<TikTokCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: TikTokUser }).pipe(
    $I.annoteSchema("TikTokCollection", { description: "Every post published by one TikTok account." })
  )
) {}

declare namespace TikTokCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: TikTokUser.Encoded;
  }
}

class TikTokPost extends S.Opaque<TikTokPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), user: TikTokUser, form: S.toType(TikTokPostForm), id: PostNumber }).pipe(
    $I.annoteSchema("TikTokPost", { description: "One TikTok video or photo post and the account that posted it." })
  )
) {}

declare namespace TikTokPost {
  export interface Encoded {
    readonly kind: "post";
    readonly user: TikTokUser.Encoded;
    readonly form: "video" | "photo";
    readonly id: PostNumber.Encoded;
  }
}

/**
 * **Example** (Build a TikTok photo post)
 *
 * ```ts import.meta.vitest name="Build a TikTok photo post"
 * import { TikTokTarget } from "@beep/scratchpad/int/locator"
 *
 * TikTokTarget.cases.post.make({ user: "example", form: "photo", id: "7" }).form // => "photo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TikTokTarget = TargetKind.mapMembers(() => Tuple.make(TikTokCollection, TikTokPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TikTokTarget", { description: "What a TikTok URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type TikTokTarget = typeof TikTokTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TikTokTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | TikTokCollection.Encoded
    | TikTokPost.Encoded;
}

const TikTokTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/@", TikTokUser]).pipe(
    S.decodeTo(
      TikTokCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/@", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/@", TikTokUser, TikTokPostForm, PostNumber]).pipe(
    S.decodeTo(
      TikTokPost,
      T.transform({
        decode: ([, user, form, id]) => ({ kind: "post", user, form, id }),
        encode: ({ user, form, id }) => ["/@", user, form, id],
      })
    )
  ),
]).pipe($I.annoteSchema("TikTokTargetFromRoute", { description: "Reads and prints TikTok targets as site-relative routes." }));

declare namespace TikTokTargetFromRoute {
  export type Encoded =
    | `/@${TikTokUser.Encoded}`
    | `/@${TikTokUser.Encoded}${TikTokPostForm.Encoded}${PostNumber.Encoded}`;
}

const VscoUser = text("VscoUser", /^[A-Za-z0-9_-]{3,64}$/, "A VSCO username.");

declare namespace VscoUser {
  export type Encoded = string;
}
const VscoMediaId = text("VscoMediaId", /^[A-Za-z0-9-]{8,64}$/, "A VSCO media identifier.");

declare namespace VscoMediaId {
  export type Encoded = string;
}

const VscoPostForm = MappedLiteralKit([
  ["/media/", "image"],
  ["/video/", "video"],
]).pipe($I.annoteSchema("VscoPostForm", { description: "Path segment of a VSCO post route and whether it is an image or a video." }));

declare namespace VscoPostForm {
  export type Encoded = "/media/" | "/video/";
}

class VscoCollection extends S.Opaque<VscoCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: VscoUser }).pipe(
    $I.annoteSchema("VscoCollection", { description: "The gallery of one VSCO account." })
  )
) {}

declare namespace VscoCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: VscoUser.Encoded;
  }
}

class VscoPost extends S.Opaque<VscoPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), user: VscoUser, form: S.toType(VscoPostForm), id: VscoMediaId }).pipe(
    $I.annoteSchema("VscoPost", { description: "One VSCO image or video and the account that posted it." })
  )
) {}

declare namespace VscoPost {
  export interface Encoded {
    readonly kind: "post";
    readonly user: VscoUser.Encoded;
    readonly form: "image" | "video";
    readonly id: VscoMediaId.Encoded;
  }
}

/**
 * **Example** (Build a VSCO gallery)
 *
 * ```ts import.meta.vitest name="Build a VSCO gallery"
 * import { VscoTarget } from "@beep/scratchpad/int/locator"
 *
 * VscoTarget.cases.collection.make({ user: "example" }).kind // => "collection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VscoTarget = TargetKind.mapMembers(() => Tuple.make(VscoCollection, VscoPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("VscoTarget", { description: "What a VSCO URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type VscoTarget = typeof VscoTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VscoTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | VscoCollection.Encoded
    | VscoPost.Encoded;
}

const VscoTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/", VscoUser, "/gallery"]).pipe(
    S.decodeTo(
      VscoCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user, "/gallery"],
      })
    )
  ),
  S.TemplateLiteralParser(["/", VscoUser]).pipe(
    S.decodeTo(
      VscoCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user],
      })
    )
  ),
  S.TemplateLiteralParser(["/", VscoUser, "/images"]).pipe(
    S.decodeTo(
      VscoCollection,
      T.transform({
        decode: ([, user]) => ({ kind: "collection", user }),
        encode: ({ user }) => ["/", user, "/images"],
      })
    )
  ),
  S.TemplateLiteralParser(["/", VscoUser, VscoPostForm, VscoMediaId]).pipe(
    S.decodeTo(
      VscoPost,
      T.transform({
        decode: ([, user, form, id]) => ({ kind: "post", user, form, id }),
        encode: ({ user, form, id }) => ["/", user, form, id],
      })
    )
  ),
]).pipe($I.annoteSchema("VscoTargetFromRoute", { description: "Reads every accepted VSCO route and prints the first one that fits." }));

declare namespace VscoTargetFromRoute {
  export type Encoded =
    | `/${VscoUser.Encoded}/gallery`
    | `/${VscoUser.Encoded}`
    | `/${VscoUser.Encoded}/images`
    | `/${VscoUser.Encoded}${VscoPostForm.Encoded}${VscoMediaId.Encoded}`;
}

const RedditUser = text("RedditUser", /^[A-Za-z0-9_-]{3,20}$/, "A Reddit username.");

declare namespace RedditUser {
  export type Encoded = string;
}
const RedditPostId = text("RedditPostId", /^[a-z0-9]{2,12}$/, "A lowercase base-36 Reddit post identifier.");

declare namespace RedditPostId {
  export type Encoded = string;
}

const RedditTab = MappedLiteralKit([
  ["", "overview"],
  ["/submitted", "submitted"],
]).pipe($I.annoteSchema("RedditTab", { description: "Path suffix of a Reddit user route and the listing it selects." }));

declare namespace RedditTab {
  export type Encoded = "" | "/submitted";
}

class RedditCollection extends S.Opaque<RedditCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), user: RedditUser, tab: S.toType(RedditTab) }).pipe(
    $I.annoteSchema("RedditCollection", { description: "One listing of a Reddit user's activity." })
  )
) {}

declare namespace RedditCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly user: RedditUser.Encoded;
    readonly tab: "overview" | "submitted";
  }
}

class RedditPost extends S.Opaque<RedditPost, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("post"), id: RedditPostId }).pipe(
    $I.annoteSchema("RedditPost", { description: "One Reddit post, which does not name its author." })
  )
) {}

declare namespace RedditPost {
  export interface Encoded {
    readonly kind: "post";
    readonly id: RedditPostId.Encoded;
  }
}

/**
 * **Example** (Build a Reddit submissions listing)
 *
 * ```ts import.meta.vitest name="Build a Reddit submissions listing"
 * import { RedditTarget } from "@beep/scratchpad/int/locator"
 *
 * RedditTarget.cases.collection.make({ user: "example", tab: "submitted" }).tab // => "submitted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RedditTarget = TargetKind.mapMembers(() => Tuple.make(RedditCollection, RedditPost)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("RedditTarget", { description: "What a Reddit URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type RedditTarget = typeof RedditTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RedditTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | RedditCollection.Encoded
    | RedditPost.Encoded;
}

const RedditTargetFromRoute = S.Union([
  S.TemplateLiteralParser(["/user/", RedditUser, RedditTab]).pipe(
    S.decodeTo(
      RedditCollection,
      T.transform({
        decode: ([, user, tab]) => ({ kind: "collection", user, tab }),
        encode: ({ user, tab }) => ["/user/", user, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/u/", RedditUser, RedditTab]).pipe(
    S.decodeTo(
      RedditCollection,
      T.transform({
        decode: ([, user, tab]) => ({ kind: "collection", user, tab }),
        encode: ({ user, tab }) => ["/u/", user, tab],
      })
    )
  ),
  S.TemplateLiteralParser(["/comments/", RedditPostId]).pipe(
    S.decodeTo(
      RedditPost,
      T.transform({
        decode: ([, id]) => ({ kind: "post", id }),
        encode: ({ id }) => ["/comments/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("RedditTargetFromRoute", { description: "Reads every accepted Reddit route and prints the first one that fits." }));

declare namespace RedditTargetFromRoute {
  export type Encoded =
    | `/user/${RedditUser.Encoded}${RedditTab.Encoded}`
    | `/u/${RedditUser.Encoded}${RedditTab.Encoded}`
    | `/comments/${RedditPostId.Encoded}`;
}

const DzenName = text("DzenName", /^[A-Za-z0-9_.-]{2,64}$/, "A Dzen channel name.").check(unreserved("DzenName", "id"));

declare namespace DzenName {
  export type Encoded = string;
}
const DzenChannelId = text("DzenChannelId", /^[a-f0-9]{24}$/, "A twenty-four digit hexadecimal Dzen channel identifier.");

declare namespace DzenChannelId {
  export type Encoded = string;
}

class DzenChannelByName extends S.Opaque<DzenChannelByName, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("name"), name: DzenName }).pipe(
    $I.annoteSchema("DzenChannelByName", { description: "Dzen channel named by its public name." })
  )
) {}

declare namespace DzenChannelByName {
  export interface Encoded {
    readonly by: "name";
    readonly name: DzenName.Encoded;
  }
}

class DzenChannelById extends S.Opaque<DzenChannelById, { readonly brand: unique symbol }>()(
  S.Struct({ by: S.tag("id"), id: DzenChannelId }).pipe(
    $I.annoteSchema("DzenChannelById", { description: "Dzen channel named by its identifier." })
  )
) {}

declare namespace DzenChannelById {
  export interface Encoded {
    readonly by: "id";
    readonly id: DzenChannelId.Encoded;
  }
}

const DzenChannelFromPath = S.Union([
  S.TemplateLiteralParser(["/", DzenName]).pipe(
    S.decodeTo(
      DzenChannelByName,
      T.transform({
        decode: ([, name]) => ({ by: "name", name }),
        encode: ({ name }) => ["/", name],
      })
    )
  ),
  S.TemplateLiteralParser(["/id/", DzenChannelId]).pipe(
    S.decodeTo(
      DzenChannelById,
      T.transform({
        decode: ([, id]) => ({ by: "id", id }),
        encode: ({ id }) => ["/id/", id],
      })
    )
  ),
]).pipe($I.annoteSchema("DzenChannelFromPath", { description: "Reads and prints the two ways a Dzen path names a channel." }));

declare namespace DzenChannelFromPath {
  export type Encoded =
    | `/${DzenName.Encoded}`
    | `/id/${DzenChannelId.Encoded}`;
}

class DzenCollection extends S.Opaque<DzenCollection, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("collection"), channel: DzenChannelFromPath }).pipe(
    $I.annoteSchema("DzenCollection", { description: "Every publication of one Dzen channel." })
  )
) {}

declare namespace DzenCollection {
  export interface Encoded {
    readonly kind: "collection";
    readonly channel: DzenChannelFromPath.Encoded;
  }
}

/**
 * **Example** (Build a Dzen channel listing)
 *
 * ```ts import.meta.vitest name="Build a Dzen channel listing"
 * import { DzenTarget } from "@beep/scratchpad/int/locator"
 *
 * const channel = { by: "name", name: "example" } as const
 * DzenTarget.cases.collection.make({ channel }).kind // => "collection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DzenTarget = S.Union([DzenCollection]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DzenTarget", { description: "What a Dzen URL denotes, discriminated by `kind`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type DzenTarget = typeof DzenTarget.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DzenTarget {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = DzenCollection.Encoded;
}

const DzenTargetFromRoute = S.Union([
  S.TemplateLiteralParser([S.toEncoded(DzenChannelFromPath)]).pipe(
    S.decodeTo(
      DzenCollection,
      T.transform({
        decode: ([channel]) => ({ kind: "collection", channel }),
        encode: ({ channel }) => [channel],
      })
    )
  ),
]).pipe($I.annoteSchema("DzenTargetFromRoute", { description: "Reads and prints Dzen targets as site-relative routes." }));

declare namespace DzenTargetFromRoute {
  export type Encoded = `${DzenChannelFromPath.Encoded}`;
}

class XLocator extends S.Opaque<XLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("x"), target: XTargetFromRoute }).pipe(
    $I.annoteSchema("XLocator", { description: "An X target paired with its platform tag." })
  )
) {}

declare namespace XLocator {
  export interface Encoded {
    readonly platform: "x";
    readonly target: XTargetFromRoute.Encoded;
  }
}

class YouTubeLocator extends S.Opaque<YouTubeLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("youtube"), target: YouTubeTargetFromRoute }).pipe(
    $I.annoteSchema("YouTubeLocator", { description: "A YouTube target paired with its platform tag." })
  )
) {}

declare namespace YouTubeLocator {
  export interface Encoded {
    readonly platform: "youtube";
    readonly target: YouTubeTargetFromRoute.Encoded;
  }
}

class RedGifsLocator extends S.Opaque<RedGifsLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("redgifs"), target: RedGifsTargetFromRoute }).pipe(
    $I.annoteSchema("RedGifsLocator", { description: "A RedGifs target paired with its platform tag." })
  )
) {}

declare namespace RedGifsLocator {
  export interface Encoded {
    readonly platform: "redgifs";
    readonly target: RedGifsTargetFromRoute.Encoded;
  }
}

class FacebookLocator extends S.Opaque<FacebookLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("facebook"), target: FacebookTargetFromRoute }).pipe(
    $I.annoteSchema("FacebookLocator", { description: "A Facebook target paired with its platform tag." })
  )
) {}

declare namespace FacebookLocator {
  export interface Encoded {
    readonly platform: "facebook";
    readonly target: FacebookTargetFromRoute.Encoded;
  }
}

class FanslyLocator extends S.Opaque<FanslyLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("fansly"), target: FanslyTargetFromRoute }).pipe(
    $I.annoteSchema("FanslyLocator", { description: "A Fansly target paired with its platform tag." })
  )
) {}

declare namespace FanslyLocator {
  export interface Encoded {
    readonly platform: "fansly";
    readonly target: FanslyTargetFromRoute.Encoded;
  }
}

class InstagramLocator extends S.Opaque<InstagramLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("instagram"), target: InstagramTargetFromRoute }).pipe(
    $I.annoteSchema("InstagramLocator", { description: "An Instagram target paired with its platform tag." })
  )
) {}

declare namespace InstagramLocator {
  export interface Encoded {
    readonly platform: "instagram";
    readonly target: InstagramTargetFromRoute.Encoded;
  }
}

class OnlyFansLocator extends S.Opaque<OnlyFansLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("onlyfans"), target: OnlyFansTargetFromRoute }).pipe(
    $I.annoteSchema("OnlyFansLocator", { description: "An OnlyFans target paired with its platform tag." })
  )
) {}

declare namespace OnlyFansLocator {
  export interface Encoded {
    readonly platform: "onlyfans";
    readonly target: OnlyFansTargetFromRoute.Encoded;
  }
}

class PinterestLocator extends S.Opaque<PinterestLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("pinterest"), target: PinterestTargetFromRoute }).pipe(
    $I.annoteSchema("PinterestLocator", { description: "A Pinterest target paired with its platform tag." })
  )
) {}

declare namespace PinterestLocator {
  export interface Encoded {
    readonly platform: "pinterest";
    readonly target: PinterestTargetFromRoute.Encoded;
  }
}

class SnapchatLocator extends S.Opaque<SnapchatLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("snapchat"), target: SnapchatTargetFromRoute }).pipe(
    $I.annoteSchema("SnapchatLocator", { description: "A Snapchat target paired with its platform tag." })
  )
) {}

declare namespace SnapchatLocator {
  export interface Encoded {
    readonly platform: "snapchat";
    readonly target: SnapchatTargetFromRoute.Encoded;
  }
}

class ThreadsLocator extends S.Opaque<ThreadsLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("threads"), target: ThreadsTargetFromRoute }).pipe(
    $I.annoteSchema("ThreadsLocator", { description: "A Threads target paired with its platform tag." })
  )
) {}

declare namespace ThreadsLocator {
  export interface Encoded {
    readonly platform: "threads";
    readonly target: ThreadsTargetFromRoute.Encoded;
  }
}

class TikTokLocator extends S.Opaque<TikTokLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("tiktok"), target: TikTokTargetFromRoute }).pipe(
    $I.annoteSchema("TikTokLocator", { description: "A TikTok target paired with its platform tag." })
  )
) {}

declare namespace TikTokLocator {
  export interface Encoded {
    readonly platform: "tiktok";
    readonly target: TikTokTargetFromRoute.Encoded;
  }
}

class VscoLocator extends S.Opaque<VscoLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("vsco"), target: VscoTargetFromRoute }).pipe(
    $I.annoteSchema("VscoLocator", { description: "A VSCO target paired with its platform tag." })
  )
) {}

declare namespace VscoLocator {
  export interface Encoded {
    readonly platform: "vsco";
    readonly target: VscoTargetFromRoute.Encoded;
  }
}

class RedditLocator extends S.Opaque<RedditLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("reddit"), target: RedditTargetFromRoute }).pipe(
    $I.annoteSchema("RedditLocator", { description: "A Reddit target paired with its platform tag." })
  )
) {}

declare namespace RedditLocator {
  export interface Encoded {
    readonly platform: "reddit";
    readonly target: RedditTargetFromRoute.Encoded;
  }
}

class DzenLocator extends S.Opaque<DzenLocator, { readonly brand: unique symbol }>()(
  S.Struct({ platform: S.tag("dzen"), target: DzenTargetFromRoute }).pipe(
    $I.annoteSchema("DzenLocator", { description: "A Dzen target paired with its platform tag." })
  )
) {}

declare namespace DzenLocator {
  export interface Encoded {
    readonly platform: "dzen";
    readonly target: DzenTargetFromRoute.Encoded;
  }
}

/**
 * **Details**
 *
 * The encoded side keeps `target` as a site-relative route such as
 * `/jack/status/20`, so a locator stores compactly without a host.
 *
 * **Example** (Dispatch on the platform of a locator)
 *
 * ```ts import.meta.vitest name="Dispatch on the platform of a locator"
 * import { Locator, XTarget } from "@beep/scratchpad/int/locator"
 *
 * const locator = Locator.cases.x.make({
 *   target: XTarget.cases.post.make({ handle: "jack", id: "20" }),
 * })
 * const site = Locator.matchOrElse(locator, {
 *   x: () => "X",
 * }, () => "another site")
 * site // => "X"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Locator = Platform.mapMembers(() => 
  Tuple.make(
    XLocator,
    YouTubeLocator,
    RedGifsLocator,
    FacebookLocator,
    FanslyLocator,
    InstagramLocator,
    OnlyFansLocator,
    PinterestLocator,
    SnapchatLocator,
    ThreadsLocator,
    TikTokLocator,
    VscoLocator,
    RedditLocator,
    DzenLocator
  )
).pipe(
  S.toTaggedUnion("platform"),
  $I.annoteSchema("Locator", { description: "What a supported URL denotes, discriminated by `platform`." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Locator = typeof Locator.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Locator {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | XLocator.Encoded
    | YouTubeLocator.Encoded
    | RedGifsLocator.Encoded
    | FacebookLocator.Encoded
    | FanslyLocator.Encoded
    | InstagramLocator.Encoded
    | OnlyFansLocator.Encoded
    | PinterestLocator.Encoded
    | SnapchatLocator.Encoded
    | ThreadsLocator.Encoded
    | TikTokLocator.Encoded
    | VscoLocator.Encoded
    | RedditLocator.Encoded
    | DzenLocator.Encoded;
}

const Host = S.String.check(
  S.isPattern(
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    $I.annote("HostPattern", {
      title: "Host name",
      description: "Lowercase DNS labels joined by periods.",
      message: "Expected a lowercase host name.",
    })
  )
).pipe($I.annoteSchema("Host", { description: "Lowercase host name without a port." }));

declare namespace Host {
  export type Encoded = string;
}

class Site extends S.Opaque<Site, { readonly brand: unique symbol }>()(
  S.Struct({
    hosts: S.NonEmptyArray(Host).annotateKey({
      description: "Host printed in canonical URLs first, followed by every other accepted host.",
    }),
    routedQuery: S.Array(S.NonEmptyString).pipe(
      S.annotateKey({ description: "Query keys that select a target; every other key is dropped." }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
  }).pipe($I.annoteSchema("Site", { description: "How one platform's URLs reduce to a site-relative route." }))
) {}

declare namespace Site {
  export interface Encoded {
    readonly hosts: readonly [Host.Encoded, ...Array<Host.Encoded>];
    readonly routedQuery: ReadonlyArray<string>;
  }
}

const sites: Readonly<Record<Platform, Site>> = {
  x: Site.make({ hosts: ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"] }),
  youtube: Site.make({ hosts: ["www.youtube.com","youtube.com","m.youtube.com"], routedQuery: ["v"] }),
  redgifs: Site.make({ hosts: ["www.redgifs.com","redgifs.com"] }),
  facebook: Site.make({ hosts: ["www.facebook.com","facebook.com","m.facebook.com","mbasic.facebook.com","web.facebook.com"], routedQuery: ["id","fbid"] }),
  fansly: Site.make({ hosts: ["fansly.com","www.fansly.com"] }),
  instagram: Site.make({ hosts: ["www.instagram.com","instagram.com"] }),
  onlyfans: Site.make({ hosts: ["onlyfans.com","www.onlyfans.com"] }),
  pinterest: Site.make({ hosts: ["www.pinterest.com","pinterest.com"] }),
  snapchat: Site.make({ hosts: ["www.snapchat.com","snapchat.com"] }),
  threads: Site.make({ hosts: ["www.threads.com","threads.com","www.threads.net","threads.net"] }),
  tiktok: Site.make({ hosts: ["www.tiktok.com","tiktok.com","m.tiktok.com"] }),
  vsco: Site.make({ hosts: ["vsco.co","www.vsco.co"] }),
  reddit: Site.make({ hosts: ["www.reddit.com","reddit.com","old.reddit.com"] }),
  dzen: Site.make({ hosts: ["dzen.ru","www.dzen.ru"] }),
};

const platformByHost = HashMap.fromIterable(
  A.flatMap(R.toEntries(sites), ([platform, site]) => A.map(site.hosts, (host) => Tuple.make(host, platform)))
);

const WebUrl = S.URLFromString.check(
  S.makeFilter(
    (url) =>
      (url.protocol === "https:" || url.protocol === "http:") &&
      Str.isEmpty(url.username) &&
      Str.isEmpty(url.password) &&
      Str.isEmpty(url.port),
    $I.annote("PlainWebUrl", {
      title: "Plain web URL",
      description: "An HTTP or HTTPS URL on the default port with no embedded credentials.",
      message: "Expected an http(s) URL without credentials or an explicit port.",
    })
  )
).pipe(
  $I.annoteSchema("WebUrl", {
    description: "Reads URL text as a plain HTTP or HTTPS URL and prints it back as text.",
  })
);

declare namespace WebUrl {
  export type Encoded = string;
}

const routeOf = (url: URL, routedQuery: ReadonlyArray<string>): string => {
  const params = UrlParams.fromInput(url.searchParams);
  const query = A.getSomes(
    A.map(routedQuery, (key) => O.map(UrlParams.getFirst(params, key), (value) => `${key}=${value}`))
  );
  const path = Str.replace(/\/+$/, "")(url.pathname);
  return A.match(query, { onEmpty: () => path, onNonEmpty: (pairs) => `${path}?${A.join(pairs, "&")}` });
};

const SiteRoute = S.Struct({ platform: Platform, target: S.String }).pipe(
  $I.annoteSchema("SiteRoute", { description: "A platform and the site-relative route left after URL reduction." })
);

declare namespace SiteRoute {
  export interface Encoded {
    readonly platform: Platform.Encoded;
    readonly target: string;
  }
}

/**
 * **Details**
 *
 * Decoding lowercases the host, drops a trailing slash, the fragment and every
 * query key the site does not route on, then reads the remaining route.
 * Encoding prints the site's first host and the first route that fits, so
 * decoding a URL and encoding the result yields its canonical form.
 *
 * **Example** (Canonicalize a legacy X link)
 *
 * ```ts import.meta.vitest name="Canonicalize a legacy X link"
 * import { LocatorFromUrl } from "@beep/scratchpad/int/locator"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const canonical = S.decodeUnknownOption(LocatorFromUrl)("https://mobile.twitter.com/jack/status/20/?s=20").pipe(
 *   O.flatMap(S.encodeOption(LocatorFromUrl))
 * )
 * canonical // => O.some("https://x.com/jack/status/20")
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LocatorFromUrl = WebUrl.pipe(
  S.decodeTo(
    SiteRoute,
    T.transformEffect({
      decode: (url, options) =>
        pipe(
          HashMap.get(platformByHost, url.hostname),
          O.map((platform) => ({ platform, target: routeOf(url, sites[platform].routedQuery) })),
          Effect.fromOption,
          Effect.mapError(
            () => new SchemaIssue.InvalidValue({ expected: "a URL on a supported site" }, url.href, options)
          )
        ),
      encode: ({ platform, target }) =>
        Effect.succeed(new URL(`https://${A.headNonEmpty(sites[platform].hosts)}${target}`)),
    })
  ),
  S.decodeTo(Locator),
  $I.annoteSchema("LocatorFromUrl", { description: "Reads any accepted URL as a locator and prints its canonical URL." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type LocatorFromUrl = typeof LocatorFromUrl.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LocatorFromUrl {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = WebUrl.Encoded;
}

/**
 * **Example** (Report a link from an unsupported site)
 *
 * ```ts import.meta.vitest name="Report a link from an unsupported site"
 * import { UnrecognizedUrl } from "@beep/scratchpad/int/locator"
 *
 * UnrecognizedUrl.make({ input: "https://example.org/", reason: "no route" })._tag // => "UnrecognizedUrl"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnrecognizedUrl extends S.TaggedError<UnrecognizedUrl, { readonly brand: unique symbol }>(
  $I`UnrecognizedUrl`
)(
  "UnrecognizedUrl",
  { input: S.String, reason: S.String },
  $I.annoteError<UnrecognizedUrl>("UnrecognizedUrl", {
    description: "The text is not a URL that any supported site routes to a target.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnrecognizedUrl {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "UnrecognizedUrl";
    readonly input: string;
    readonly reason: string;
  }
}

const decodeLocator = S.decodeUnknownEffect(LocatorFromUrl);

/**
 * Reads pasted text as a locator at the boundary where a user or a saved
 * inventory supplies a URL.
 *
 * **Example** (Locate a YouTube short)
 *
 * ```ts import.meta.vitest name="Locate a YouTube short"
 * import { locate } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const locator = Effect.runSync(locate("https://youtube.com/shorts/dQw4w9WgXcQ"))
 * locator.platform // => "youtube"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const locate = Effect.fn("Locator.locate")(function* (input: string) {
  return yield* decodeLocator(input).pipe(
    Effect.mapError((issue) => UnrecognizedUrl.make({ input, reason: issue.message }))
  );
});

/**
 * Names the listing a locator belongs to, so any saved item can reopen the
 * mapper for its owner.
 *
 * **Details**
 *
 * A post that does not name its owner in the URL, such as a YouTube video or
 * a RedGifs clip, yields `O.none()`; only a traversal can attribute it.
 *
 * **Example** (Find the account behind an X status)
 *
 * ```ts import.meta.vitest name="Find the account behind an X status"
 * import { LocatorFromUrl, landing } from "@beep/scratchpad/int/locator"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const home = S.decodeUnknownOption(LocatorFromUrl)("https://x.com/jack/status/20").pipe(
 *   O.flatMap(landing),
 *   O.flatMap(S.encodeOption(LocatorFromUrl))
 * )
 * home // => O.some("https://x.com/jack")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const landing: (locator: Locator) => O.Option<Locator> = Locator.match({
  x: ({ target }) => Locator.cases.x.makeOption({ target: XCollection.make({ handle: target.handle, tab: "tweets" }) }),
  youtube: ({ target }) =>
    pipe(
      O.liftPredicate(target, YouTubeTarget.guards.collection),
      O.flatMap(({ channel }) =>
        Locator.cases.youtube.makeOption({ target: YouTubeCollection.make({ channel, tab: "home" }) })
      )
    ),
  redgifs: (locator) => O.liftPredicate(locator, ({ target }) => RedGifsTarget.guards.collection(target)),
  facebook: ({ target }) =>
    pipe(
      O.liftPredicate(target, FacebookTarget.guards.collection),
      O.flatMap(({ page }) =>
        Locator.cases.facebook.makeOption({ target: FacebookCollection.make({ page, tab: "posts" }) })
      )
    ),
  fansly: (locator) => O.liftPredicate(locator, ({ target }) => FanslyTarget.guards.collection(target)),
  instagram: ({ target }) =>
    pipe(
      O.liftPredicate(target, InstagramTarget.isAnyOf(["collection", "stories"])),
      O.flatMap(({ user }) =>
        Locator.cases.instagram.makeOption({ target: InstagramCollection.make({ user, tab: "posts" }) })
      )
    ),
  onlyfans: ({ target }) =>
    Locator.cases.onlyfans.makeOption({ target: OnlyFansCollection.make({ user: target.user }) }),
  pinterest: (locator) => O.liftPredicate(locator, ({ target }) => PinterestTarget.guards.collection(target)),
  snapchat: ({ target }) =>
    Locator.cases.snapchat.makeOption({ target: SnapchatCollection.make({ user: target.user, tab: "profile" }) }),
  threads: ({ target }) =>
    Locator.cases.threads.makeOption({ target: ThreadsCollection.make({ user: target.user, tab: "posts" }) }),
  tiktok: ({ target }) => Locator.cases.tiktok.makeOption({ target: TikTokCollection.make({ user: target.user }) }),
  vsco: ({ target }) => Locator.cases.vsco.makeOption({ target: VscoCollection.make({ user: target.user }) }),
  reddit: ({ target }) =>
    pipe(
      O.liftPredicate(target, RedditTarget.guards.collection),
      O.flatMap(({ user }) =>
        Locator.cases.reddit.makeOption({ target: RedditCollection.make({ user, tab: "overview" }) })
      )
    ),
  dzen: (locator) => O.some(locator),
});

const MediaCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("MediaCount", { description: "Number of media files of one format in a post." })
);

declare namespace MediaCount {
  export type Encoded = number;
}

/**
 * **Details**
 *
 * `source` is the item's identity: its encoded form is the canonical post URL,
 * which also carries the platform, the post identifier and, where the site
 * prints one, the author.
 *
 * **Example** (Record a mapped video)
 *
 * ```ts import.meta.vitest name="Record a mapped video"
 * import { Locator, MappedItem, YouTubeTarget } from "@beep/scratchpad/int/locator"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const item = MappedItem.make({
 *   source: Locator.cases.youtube.make({ target: YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" }) }),
 *   videos: 1,
 * })
 * const stored = O.map(S.encodeOption(MappedItem)(item), ({ source }) => source)
 * stored // => O.some("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MappedItem extends S.Opaque<MappedItem, { readonly brand: unique symbol }>()(
  S.Struct({
    source: LocatorFromUrl,
    images: MediaCount.pipe(
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    videos: MediaCount.pipe(
      S.withDecodingDefaultTypeKey(Effect.succeed(0)),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    publishedAt: S.DateTimeUtcFromMillis.pipe(
      S.annotateKey({ description: "Publication instant, when the site reports one." }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
  }).pipe($I.annoteSchema("MappedItem", { description: "One post discovered while traversing a listing." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MappedItem {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly source: LocatorFromUrl.Encoded;
    readonly images?: MediaCount.Encoded;
    readonly videos?: MediaCount.Encoded;
    readonly publishedAt?: number;
  }
}

/**
 * **Example** (Recover from a sign-in wall)
 *
 * ```ts import.meta.vitest name="Recover from a sign-in wall"
 * import { AuthRequired } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(AuthRequired.make({ platform: "x" })).pipe(
 *   Effect.catchTag("AuthRequired", ({ platform }) => Effect.succeed(`sign in to ${platform}`))
 * )
 * Effect.runSync(outcome) // => "sign in to x"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AuthRequired extends S.TaggedError<AuthRequired, { readonly brand: unique symbol }>($I`AuthRequired`)(
  "AuthRequired",
  { platform: Platform },
  $I.annoteError<AuthRequired>("AuthRequired", {
    description: "The site refused the traversal until the user signs in.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AuthRequired {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "AuthRequired";
    readonly platform: Platform.Encoded;
  }
}

/**
 * **Example** (Recover from a rate limit)
 *
 * ```ts import.meta.vitest name="Recover from a rate limit"
 * import { RateLimited } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(RateLimited.make({ platform: "redgifs" })).pipe(
 *   Effect.catchTag("RateLimited", () => Effect.succeed("retry later"))
 * )
 * Effect.runSync(outcome) // => "retry later"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RateLimited extends S.TaggedError<RateLimited, { readonly brand: unique symbol }>($I`RateLimited`)(
  "RateLimited",
  { platform: Platform },
  $I.annoteError<RateLimited>("RateLimited", {
    description: "The site is throttling requests; items already emitted remain valid.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RateLimited {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "RateLimited";
    readonly platform: Platform.Encoded;
  }
}

/**
 * **Example** (Explain why a traversal stopped)
 *
 * ```ts import.meta.vitest name="Explain why a traversal stopped"
 * import { MapFailure, RateLimited } from "@beep/scratchpad/int/locator"
 *
 * const reason = MapFailure.match(RateLimited.make({ platform: "redgifs" }), {
 *   AuthRequired: ({ platform }) => `sign in to ${platform}`,
 *   RateLimited: () => "retry later",
 * })
 * reason // => "retry later"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const MapFailure = S.Union([AuthRequired, RateLimited]).pipe(
  $I.annoteSchema("MapFailure", {
    description: "Why a traversal ended before the site ran out of items.",
  }),
  S.toTaggedUnion("_tag")
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type MapFailure = typeof MapFailure.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MapFailure {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | AuthRequired.Encoded
    | RateLimited.Encoded;
}

/**
 * Contract every site implementation fulfils: enumerate the posts a target
 * of that site denotes.
 *
 * **Details**
 *
 * A post target yields one item and a collection yields many. The stream
 * ending means the listing is complete, a failure names why it stopped, and
 * interrupting the consumer stops the traversal with the items seen so far.
 *
 * @typeParam Target - The site's own target union, so an implementation never
 * receives another site's locator.
 * @category ports
 * @since 0.0.0
 */
export interface SiteMapper<Target> {
  readonly items: (target: Target) => Stream.Stream<MappedItem, MapFailure>;
}

/**
 * Enumerates the posts an X target denotes: every post on a timeline tab, or the one status. {@link items} routes every matching locator here.
 *
 * **Example** (Provide an X mapper)
 *
 * ```ts import.meta.vitest name="Provide an X mapper"
 * import { XMapper, XTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(XMapper, { items: () => Stream.empty })
 * const target = XTarget.cases.collection.make({ handle: "jack", tab: "media" })
 * const count = XMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XMapper extends Context.Service<XMapper, SiteMapper<XTarget>>()(
  $I`XMapper`
) {}

/**
 * Enumerates the posts a YouTube target denotes: every video on a channel tab, or the one video. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a YouTube mapper)
 *
 * ```ts import.meta.vitest name="Provide a YouTube mapper"
 * import { YouTubeMapper, YouTubeTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(YouTubeMapper, { items: () => Stream.empty })
 * const target = YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" })
 * const count = YouTubeMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YouTubeMapper extends Context.Service<YouTubeMapper, SiteMapper<YouTubeTarget>>()(
  $I`YouTubeMapper`
) {}

/**
 * Enumerates the posts a RedGifs target denotes: every clip of an account, or the one clip. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a RedGifs mapper)
 *
 * ```ts import.meta.vitest name="Provide a RedGifs mapper"
 * import { RedGifsMapper, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedGifsMapper, { items: () => Stream.empty })
 * const target = RedGifsTarget.cases.collection.make({ user: "example" })
 * const count = RedGifsMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedGifsMapper extends Context.Service<RedGifsMapper, SiteMapper<RedGifsTarget>>()(
  $I`RedGifsMapper`
) {}

/**
 * Enumerates the posts a Facebook target denotes: every post in a page listing, or the one reel or photo. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Facebook mapper)
 *
 * ```ts import.meta.vitest name="Provide a Facebook mapper"
 * import { FacebookMapper, FacebookTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FacebookMapper, { items: () => Stream.empty })
 * const target = FacebookTarget.cases.post.make({ form: "reel", id: "1234567890" })
 * const count = FacebookMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FacebookMapper extends Context.Service<FacebookMapper, SiteMapper<FacebookTarget>>()(
  $I`FacebookMapper`
) {}

/**
 * Enumerates the posts a Fansly target denotes: every post of an account, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Fansly mapper)
 *
 * ```ts import.meta.vitest name="Provide a Fansly mapper"
 * import { FanslyMapper, FanslyTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FanslyMapper, { items: () => Stream.empty })
 * const target = FanslyTarget.cases.collection.make({ user: "example" })
 * const count = FanslyMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FanslyMapper extends Context.Service<FanslyMapper, SiteMapper<FanslyTarget>>()(
  $I`FanslyMapper`
) {}

/**
 * Enumerates the posts an Instagram target denotes: a grid tab, the current stories, a highlight reel, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide an Instagram mapper)
 *
 * ```ts import.meta.vitest name="Provide an Instagram mapper"
 * import { InstagramMapper, InstagramTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(InstagramMapper, { items: () => Stream.empty })
 * const target = InstagramTarget.cases.stories.make({ user: "example" })
 * const count = InstagramMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstagramMapper extends Context.Service<InstagramMapper, SiteMapper<InstagramTarget>>()(
  $I`InstagramMapper`
) {}

/**
 * Enumerates the posts an OnlyFans target denotes: every post of an account, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide an OnlyFans mapper)
 *
 * ```ts import.meta.vitest name="Provide an OnlyFans mapper"
 * import { OnlyFansMapper, OnlyFansTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(OnlyFansMapper, { items: () => Stream.empty })
 * const target = OnlyFansTarget.cases.collection.make({ user: "example" })
 * const count = OnlyFansMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnlyFansMapper extends Context.Service<OnlyFansMapper, SiteMapper<OnlyFansTarget>>()(
  $I`OnlyFansMapper`
) {}

/**
 * Enumerates the pins a Pinterest target denotes: every pin an account saved, or the one pin. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Pinterest mapper)
 *
 * ```ts import.meta.vitest name="Provide a Pinterest mapper"
 * import { PinterestMapper, PinterestTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(PinterestMapper, { items: () => Stream.empty })
 * const target = PinterestTarget.cases.post.make({ id: "99" })
 * const count = PinterestMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PinterestMapper extends Context.Service<PinterestMapper, SiteMapper<PinterestTarget>>()(
  $I`PinterestMapper`
) {}

/**
 * Enumerates the posts a Snapchat target denotes: every item of a profile listing, or the one spotlight video. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Snapchat mapper)
 *
 * ```ts import.meta.vitest name="Provide a Snapchat mapper"
 * import { SnapchatMapper, SnapchatTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(SnapchatMapper, { items: () => Stream.empty })
 * const target = SnapchatTarget.cases.collection.make({ user: "example", tab: "stories" })
 * const count = SnapchatMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SnapchatMapper extends Context.Service<SnapchatMapper, SiteMapper<SnapchatTarget>>()(
  $I`SnapchatMapper`
) {}

/**
 * Enumerates the posts a Threads target denotes: every post on a profile tab, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Threads mapper)
 *
 * ```ts import.meta.vitest name="Provide a Threads mapper"
 * import { ThreadsMapper, ThreadsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(ThreadsMapper, { items: () => Stream.empty })
 * const target = ThreadsTarget.cases.collection.make({ user: "example", tab: "media" })
 * const count = ThreadsMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ThreadsMapper extends Context.Service<ThreadsMapper, SiteMapper<ThreadsTarget>>()(
  $I`ThreadsMapper`
) {}

/**
 * Enumerates the posts a TikTok target denotes: every post of an account, or the one video or photo post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a TikTok mapper)
 *
 * ```ts import.meta.vitest name="Provide a TikTok mapper"
 * import { TikTokMapper, TikTokTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(TikTokMapper, { items: () => Stream.empty })
 * const target = TikTokTarget.cases.collection.make({ user: "example" })
 * const count = TikTokMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TikTokMapper extends Context.Service<TikTokMapper, SiteMapper<TikTokTarget>>()(
  $I`TikTokMapper`
) {}

/**
 * Enumerates the posts a VSCO target denotes: every image and video in a gallery, or the one item. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Vsco mapper)
 *
 * ```ts import.meta.vitest name="Provide a Vsco mapper"
 * import { VscoMapper, VscoTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(VscoMapper, { items: () => Stream.empty })
 * const target = VscoTarget.cases.collection.make({ user: "example" })
 * const count = VscoMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VscoMapper extends Context.Service<VscoMapper, SiteMapper<VscoTarget>>()(
  $I`VscoMapper`
) {}

/**
 * Enumerates the posts a Reddit target denotes: every post in a user listing, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Reddit mapper)
 *
 * ```ts import.meta.vitest name="Provide a Reddit mapper"
 * import { RedditMapper, RedditTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedditMapper, { items: () => Stream.empty })
 * const target = RedditTarget.cases.post.make({ id: "abc123" })
 * const count = RedditMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedditMapper extends Context.Service<RedditMapper, SiteMapper<RedditTarget>>()(
  $I`RedditMapper`
) {}

/**
 * Enumerates the publications a Dzen target denotes: every publication of one channel. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Dzen mapper)
 *
 * ```ts import.meta.vitest name="Provide a Dzen mapper"
 * import { DzenMapper, DzenTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(DzenMapper, { items: () => Stream.empty })
 * const target = DzenTarget.cases.collection.make({ channel: { by: "name", name: "example" } })
 * const count = DzenMapper.use((mapper) => Stream.runCount(mapper.items(target)))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DzenMapper extends Context.Service<DzenMapper, SiteMapper<DzenTarget>>()(
  $I`DzenMapper`
) {}

/**
 * Enumerates the posts a locator denotes by handing its target to the mapper
 * service of its platform.
 *
 * **Details**
 *
 * The match is exhaustive over {@link Platform}: adding a platform fails to
 * compile here until a mapper service exists for it.
 *
 * **Gotchas**
 *
 * The returned stream requires every site's mapper service, not only the one for
 * the locator's platform, because the platform is known only at run time.
 *
 * **Example** (Traverse through the matching site service)
 *
 * ```ts import.meta.vitest name="Traverse through the matching site service"
 * import {
 *   DzenMapper,
 *   FacebookMapper,
 *   FanslyMapper,
 *   InstagramMapper,
 *   Locator,
 *   MappedItem,
 *   OnlyFansMapper,
 *   PinterestMapper,
 *   RedditMapper,
 *   RedGifsMapper,
 *   RedGifsTarget,
 *   SnapchatMapper,
 *   ThreadsMapper,
 *   TikTokMapper,
 *   VscoMapper,
 *   XMapper,
 *   YouTubeMapper,
 *   items,
 * } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const clip = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * const none = { items: () => Stream.empty }
 * const mappers = Layer.mergeAll(
 *   Layer.succeed(RedGifsMapper, { items: () => Stream.make(MappedItem.make({ source: clip, videos: 1 })) }),
 *   Layer.succeed(XMapper, none),
 *   Layer.succeed(YouTubeMapper, none),
 *   Layer.succeed(FacebookMapper, none),
 *   Layer.succeed(FanslyMapper, none),
 *   Layer.succeed(InstagramMapper, none),
 *   Layer.succeed(OnlyFansMapper, none),
 *   Layer.succeed(PinterestMapper, none),
 *   Layer.succeed(SnapchatMapper, none),
 *   Layer.succeed(ThreadsMapper, none),
 *   Layer.succeed(TikTokMapper, none),
 *   Layer.succeed(VscoMapper, none),
 *   Layer.succeed(RedditMapper, none),
 *   Layer.succeed(DzenMapper, none)
 * )
 * const user = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * Effect.runSync(Effect.provide(Stream.runCount(items(user)), mappers)) // => 1
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const items = Locator.match({
  x: ({ target }) => Stream.unwrap(XMapper.useSync((mapper) => mapper.items(target))),
  youtube: ({ target }) => Stream.unwrap(YouTubeMapper.useSync((mapper) => mapper.items(target))),
  redgifs: ({ target }) => Stream.unwrap(RedGifsMapper.useSync((mapper) => mapper.items(target))),
  facebook: ({ target }) => Stream.unwrap(FacebookMapper.useSync((mapper) => mapper.items(target))),
  fansly: ({ target }) => Stream.unwrap(FanslyMapper.useSync((mapper) => mapper.items(target))),
  instagram: ({ target }) => Stream.unwrap(InstagramMapper.useSync((mapper) => mapper.items(target))),
  onlyfans: ({ target }) => Stream.unwrap(OnlyFansMapper.useSync((mapper) => mapper.items(target))),
  pinterest: ({ target }) => Stream.unwrap(PinterestMapper.useSync((mapper) => mapper.items(target))),
  snapchat: ({ target }) => Stream.unwrap(SnapchatMapper.useSync((mapper) => mapper.items(target))),
  threads: ({ target }) => Stream.unwrap(ThreadsMapper.useSync((mapper) => mapper.items(target))),
  tiktok: ({ target }) => Stream.unwrap(TikTokMapper.useSync((mapper) => mapper.items(target))),
  vsco: ({ target }) => Stream.unwrap(VscoMapper.useSync((mapper) => mapper.items(target))),
  reddit: ({ target }) => Stream.unwrap(RedditMapper.useSync((mapper) => mapper.items(target))),
  dzen: ({ target }) => Stream.unwrap(DzenMapper.useSync((mapper) => mapper.items(target))),
});
