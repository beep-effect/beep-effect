/**
 * The port a site implements to enumerate the posts its targets denote, one
 * service per platform, and the function that routes a locator to its mapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Context from "effect/Context"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Stream from "effect/Stream"
import {
  type Cursor,
  type DzenTarget,
  type FacebookTarget,
  type FanslyTarget,
  type InstagramTarget,
  Locator,
  type MapFailure,
  type MappedItem,
  type Page,
  type OnlyFansTarget,
  type PinterestTarget,
  type Platform,
  type RedditTarget,
  type RedGifsTarget,
  type SnapchatTarget,
  type ThreadsTarget,
  type TikTokTarget,
  type VscoTarget,
  type XTarget,
  type YouTubeTarget
} from "./locator.ts"

const $I = $ScratchpadId.create("int/mapper")

/**
 * Contract every site implementation fulfils: enumerate the posts a target
 * of that site denotes.
 *
 * **Details**
 *
 * A post target yields one page of one item and a collection yields a page
 * for each answer of the site. `from` is the `next` of an earlier page: a
 * mapper that can resume starts after it, and one that cannot starts over,
 * which the caller absorbs because storing a page twice changes nothing. The
 * stream ending means the listing is complete, a failure names why it
 * stopped, and interrupting the consumer stops the traversal with the pages
 * seen so far.
 *
 * @typeParam Target - The site's own target union, so an implementation never
 * receives another site's locator.
 * @category ports
 * @since 0.0.0
 */
export interface SiteMapper<Target> {
  readonly pages: (target: Target, from: O.Option<Cursor>) => Stream.Stream<Page, MapFailure>;
}

/**
 * Enumerates the posts an X target denotes: every post on a timeline tab, or the one status. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide an X mapper)
 *
 * ```ts import.meta.vitest name="Provide an X mapper"
 * import { XTarget } from "@beep/scratchpad/int/locator"
 * import { XMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(XMapper, { pages: () => Stream.empty })
 * const target = XTarget.cases.collection.make({ handle: "jack", tab: "media" })
 * const count = Stream.runCount(XMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XMapper extends Context.Service<XMapper, SiteMapper<XTarget>>()($I`XMapper`) {
  static readonly pages = (target: XTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(XMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a YouTube target denotes: every video on a channel tab, or the one video. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a YouTube mapper)
 *
 * ```ts import.meta.vitest name="Provide a YouTube mapper"
 * import { YouTubeTarget } from "@beep/scratchpad/int/locator"
 * import { YouTubeMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(YouTubeMapper, { pages: () => Stream.empty })
 * const target = YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" })
 * const count = Stream.runCount(YouTubeMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YouTubeMapper extends Context.Service<YouTubeMapper, SiteMapper<YouTubeTarget>>()($I`YouTubeMapper`) {
  static readonly pages = (target: YouTubeTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(YouTubeMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a RedGifs target denotes: every clip of an account, or the one clip. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a RedGifs mapper)
 *
 * ```ts import.meta.vitest name="Provide a RedGifs mapper"
 * import { RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { RedGifsMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedGifsMapper, { pages: () => Stream.empty })
 * const target = RedGifsTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(RedGifsMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedGifsMapper extends Context.Service<RedGifsMapper, SiteMapper<RedGifsTarget>>()($I`RedGifsMapper`) {
  static readonly pages = (target: RedGifsTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(RedGifsMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a Facebook target denotes: every post in a page listing, or the one reel or photo. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Facebook mapper)
 *
 * ```ts import.meta.vitest name="Provide a Facebook mapper"
 * import { FacebookTarget } from "@beep/scratchpad/int/locator"
 * import { FacebookMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FacebookMapper, { pages: () => Stream.empty })
 * const target = FacebookTarget.cases.post.make({ form: "reel", id: "1234567890" })
 * const count = Stream.runCount(FacebookMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FacebookMapper extends Context.Service<FacebookMapper, SiteMapper<FacebookTarget>>()($I`FacebookMapper`) {
  static readonly pages = (target: FacebookTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(FacebookMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a Fansly target denotes: every post of an account, or the one post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Fansly mapper)
 *
 * ```ts import.meta.vitest name="Provide a Fansly mapper"
 * import { FanslyTarget } from "@beep/scratchpad/int/locator"
 * import { FanslyMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FanslyMapper, { pages: () => Stream.empty })
 * const target = FanslyTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(FanslyMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FanslyMapper extends Context.Service<FanslyMapper, SiteMapper<FanslyTarget>>()($I`FanslyMapper`) {
  static readonly pages = (target: FanslyTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(FanslyMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts an Instagram target denotes: a grid tab, the current stories, a highlight reel, or the one post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide an Instagram mapper)
 *
 * ```ts import.meta.vitest name="Provide an Instagram mapper"
 * import { InstagramTarget } from "@beep/scratchpad/int/locator"
 * import { InstagramMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(InstagramMapper, { pages: () => Stream.empty })
 * const target = InstagramTarget.cases.stories.make({ user: "example" })
 * const count = Stream.runCount(InstagramMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstagramMapper extends Context.Service<InstagramMapper, SiteMapper<InstagramTarget>>()($I`InstagramMapper`) {
  static readonly pages = (target: InstagramTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(InstagramMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts an OnlyFans target denotes: every post of an account, or the one post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide an OnlyFans mapper)
 *
 * ```ts import.meta.vitest name="Provide an OnlyFans mapper"
 * import { OnlyFansTarget } from "@beep/scratchpad/int/locator"
 * import { OnlyFansMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(OnlyFansMapper, { pages: () => Stream.empty })
 * const target = OnlyFansTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(OnlyFansMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnlyFansMapper extends Context.Service<OnlyFansMapper, SiteMapper<OnlyFansTarget>>()($I`OnlyFansMapper`) {
  static readonly pages = (target: OnlyFansTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(OnlyFansMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the pins a Pinterest target denotes: every pin an account saved, or the one pin. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Pinterest mapper)
 *
 * ```ts import.meta.vitest name="Provide a Pinterest mapper"
 * import { PinterestTarget } from "@beep/scratchpad/int/locator"
 * import { PinterestMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(PinterestMapper, { pages: () => Stream.empty })
 * const target = PinterestTarget.cases.post.make({ id: "99" })
 * const count = Stream.runCount(PinterestMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PinterestMapper extends Context.Service<PinterestMapper, SiteMapper<PinterestTarget>>()($I`PinterestMapper`) {
  static readonly pages = (target: PinterestTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(PinterestMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a Snapchat target denotes: every item of a profile listing, or the one spotlight video. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Snapchat mapper)
 *
 * ```ts import.meta.vitest name="Provide a Snapchat mapper"
 * import { SnapchatTarget } from "@beep/scratchpad/int/locator"
 * import { SnapchatMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(SnapchatMapper, { pages: () => Stream.empty })
 * const target = SnapchatTarget.cases.collection.make({ user: "example", tab: "stories" })
 * const count = Stream.runCount(SnapchatMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SnapchatMapper extends Context.Service<SnapchatMapper, SiteMapper<SnapchatTarget>>()($I`SnapchatMapper`) {
  static readonly pages = (target: SnapchatTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(SnapchatMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a Threads target denotes: every post on a profile tab, or the one post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Threads mapper)
 *
 * ```ts import.meta.vitest name="Provide a Threads mapper"
 * import { ThreadsTarget } from "@beep/scratchpad/int/locator"
 * import { ThreadsMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(ThreadsMapper, { pages: () => Stream.empty })
 * const target = ThreadsTarget.cases.collection.make({ user: "example", tab: "media" })
 * const count = Stream.runCount(ThreadsMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ThreadsMapper extends Context.Service<ThreadsMapper, SiteMapper<ThreadsTarget>>()($I`ThreadsMapper`) {
  static readonly pages = (target: ThreadsTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(ThreadsMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a TikTok target denotes: every post of an account, or the one video or photo post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a TikTok mapper)
 *
 * ```ts import.meta.vitest name="Provide a TikTok mapper"
 * import { TikTokTarget } from "@beep/scratchpad/int/locator"
 * import { TikTokMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(TikTokMapper, { pages: () => Stream.empty })
 * const target = TikTokTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(TikTokMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TikTokMapper extends Context.Service<TikTokMapper, SiteMapper<TikTokTarget>>()($I`TikTokMapper`) {
  static readonly pages = (target: TikTokTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(TikTokMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a VSCO target denotes: every image and video in a gallery, or the one item. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Vsco mapper)
 *
 * ```ts import.meta.vitest name="Provide a Vsco mapper"
 * import { VscoTarget } from "@beep/scratchpad/int/locator"
 * import { VscoMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(VscoMapper, { pages: () => Stream.empty })
 * const target = VscoTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(VscoMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VscoMapper extends Context.Service<VscoMapper, SiteMapper<VscoTarget>>()($I`VscoMapper`) {
  static readonly pages = (target: VscoTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(VscoMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the posts a Reddit target denotes: every post in a user listing, or the one post. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Reddit mapper)
 *
 * ```ts import.meta.vitest name="Provide a Reddit mapper"
 * import { RedditTarget } from "@beep/scratchpad/int/locator"
 * import { RedditMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedditMapper, { pages: () => Stream.empty })
 * const target = RedditTarget.cases.post.make({ id: "abc123" })
 * const count = Stream.runCount(RedditMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedditMapper extends Context.Service<RedditMapper, SiteMapper<RedditTarget>>()($I`RedditMapper`) {
  static readonly pages = (target: RedditTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(RedditMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Enumerates the publications a Dzen target denotes: every publication of one channel. {@link pages} routes every matching locator here.
 *
 * **Example** (Provide a Dzen mapper)
 *
 * ```ts import.meta.vitest name="Provide a Dzen mapper"
 * import { DzenTarget } from "@beep/scratchpad/int/locator"
 * import { DzenMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(DzenMapper, { pages: () => Stream.empty })
 * const target = DzenTarget.cases.collection.make({ channel: { by: "name", name: "example" } })
 * const count = Stream.runCount(DzenMapper.pages(target, O.none()))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DzenMapper extends Context.Service<DzenMapper, SiteMapper<DzenTarget>>()($I`DzenMapper`) {
  static readonly pages = (target: DzenTarget, from: O.Option<Cursor>) =>
    Stream.unwrap(DzenMapper.useSync((mapper) => mapper.pages(target, from)))
}

/**
 * Every site's mapper service, which a dispatcher needs because the platform
 * of a locator is known only at run time.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Mappers =
  | XMapper
  | YouTubeMapper
  | RedGifsMapper
  | FacebookMapper
  | FanslyMapper
  | InstagramMapper
  | OnlyFansMapper
  | PinterestMapper
  | SnapchatMapper
  | ThreadsMapper
  | TikTokMapper
  | VscoMapper
  | RedditMapper
  | DzenMapper;

/**
 * Traverses the listing a locator denotes page by page, through the mapper
 * service of its platform.
 *
 * **Details**
 *
 * The match is exhaustive over {@link Platform}: adding a platform fails to
 * compile here until a mapper service exists for it.
 *
 * **Example** (Count the pages a site answers with)
 *
 * ```ts import.meta.vitest name="Count the pages a site answers with"
 * import { Locator, Page, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { RedGifsMapper, pages } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const two = Layer.succeed(RedGifsMapper, { pages: () => Stream.make(Page.make({}), Page.make({})) })
 * const user = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * const count = Stream.runCount(pages(user, O.none())).pipe(Effect.provide(two))
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const pages: {
  (from: O.Option<Cursor>): (locator: Locator) => Stream.Stream<Page, MapFailure, Mappers>;
  (locator: Locator, from: O.Option<Cursor>): Stream.Stream<Page, MapFailure, Mappers>;
} = dual(
  2,
  (locator: Locator, from: O.Option<Cursor>): Stream.Stream<Page, MapFailure, Mappers> =>
    Locator.match(locator, {
    x: ({ target }) => XMapper.pages(target, from),
    youtube: ({ target }) => YouTubeMapper.pages(target, from),
    redgifs: ({ target }) => RedGifsMapper.pages(target, from),
    facebook: ({ target }) => FacebookMapper.pages(target, from),
    fansly: ({ target }) => FanslyMapper.pages(target, from),
    instagram: ({ target }) => InstagramMapper.pages(target, from),
    onlyfans: ({ target }) => OnlyFansMapper.pages(target, from),
    pinterest: ({ target }) => PinterestMapper.pages(target, from),
    snapchat: ({ target }) => SnapchatMapper.pages(target, from),
    threads: ({ target }) => ThreadsMapper.pages(target, from),
    tiktok: ({ target }) => TikTokMapper.pages(target, from),
    vsco: ({ target }) => VscoMapper.pages(target, from),
    reddit: ({ target }) => RedditMapper.pages(target, from),
    dzen: ({ target }) => DzenMapper.pages(target, from)
    })
)

/**
 * Enumerates the posts a locator denotes by handing its target to the mapper
 * service of its platform.
 *
 * **Details**
 *
 * This is {@link pages} from the start of the listing with the page
 * boundaries dropped, for a caller that stores nothing and resumes nothing.
 *
 * **Example** (Traverse through the matching site service)
 *
 * ```ts import.meta.vitest name="Traverse through the matching site service"
 * import { Locator, MappedItem, Page, PostLocator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import {
 *   DzenMapper,
 *   FacebookMapper,
 *   FanslyMapper,
 *   InstagramMapper,
 *   OnlyFansMapper,
 *   PinterestMapper,
 *   RedditMapper,
 *   RedGifsMapper,
 *   SnapchatMapper,
 *   ThreadsMapper,
 *   TikTokMapper,
 *   VscoMapper,
 *   XMapper,
 *   YouTubeMapper,
 *   items,
 * } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const clip = PostLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * )
 * const none = { pages: () => Stream.empty }
 * const mappers = Layer.mergeAll(
 *   Layer.succeed(RedGifsMapper, { pages: () => Stream.make(Page.of(MappedItem.make({ source: clip, videos: 1 }))) }),
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
export const items = (locator: Locator): Stream.Stream<MappedItem, MapFailure, Mappers> =>
  Stream.flatMap(pages(locator, O.none()), ({ items }) => Stream.fromIterable(items))
