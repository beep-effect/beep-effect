/**
 * The port a site implements to enumerate the posts its targets denote, one
 * service per platform, and the function that routes a locator to its mapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Context from "effect/Context"
import * as Stream from "effect/Stream"
import {
  type DzenTarget,
  type FacebookTarget,
  type FanslyTarget,
  type InstagramTarget,
  Locator,
  type MapFailure,
  type MappedItem,
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
 * import { XTarget } from "@beep/scratchpad/int/locator"
 * import { XMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(XMapper, { items: () => Stream.empty })
 * const target = XTarget.cases.collection.make({ handle: "jack", tab: "media" })
 * const count = Stream.runCount(XMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XMapper extends Context.Service<XMapper, SiteMapper<XTarget>>()($I`XMapper`) {
  static readonly items = (target: XTarget) => Stream.unwrap(XMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a YouTube target denotes: every video on a channel tab, or the one video. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a YouTube mapper)
 *
 * ```ts import.meta.vitest name="Provide a YouTube mapper"
 * import { YouTubeTarget } from "@beep/scratchpad/int/locator"
 * import { YouTubeMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(YouTubeMapper, { items: () => Stream.empty })
 * const target = YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" })
 * const count = Stream.runCount(YouTubeMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YouTubeMapper extends Context.Service<YouTubeMapper, SiteMapper<YouTubeTarget>>()($I`YouTubeMapper`) {
  static readonly items = (target: YouTubeTarget) => Stream.unwrap(YouTubeMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a RedGifs target denotes: every clip of an account, or the one clip. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a RedGifs mapper)
 *
 * ```ts import.meta.vitest name="Provide a RedGifs mapper"
 * import { RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { RedGifsMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedGifsMapper, { items: () => Stream.empty })
 * const target = RedGifsTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(RedGifsMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedGifsMapper extends Context.Service<RedGifsMapper, SiteMapper<RedGifsTarget>>()($I`RedGifsMapper`) {
  static readonly items = (target: RedGifsTarget) => Stream.unwrap(RedGifsMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a Facebook target denotes: every post in a page listing, or the one reel or photo. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Facebook mapper)
 *
 * ```ts import.meta.vitest name="Provide a Facebook mapper"
 * import { FacebookTarget } from "@beep/scratchpad/int/locator"
 * import { FacebookMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FacebookMapper, { items: () => Stream.empty })
 * const target = FacebookTarget.cases.post.make({ form: "reel", id: "1234567890" })
 * const count = Stream.runCount(FacebookMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FacebookMapper extends Context.Service<FacebookMapper, SiteMapper<FacebookTarget>>()($I`FacebookMapper`) {
  static readonly items = (target: FacebookTarget) => Stream.unwrap(FacebookMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a Fansly target denotes: every post of an account, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Fansly mapper)
 *
 * ```ts import.meta.vitest name="Provide a Fansly mapper"
 * import { FanslyTarget } from "@beep/scratchpad/int/locator"
 * import { FanslyMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(FanslyMapper, { items: () => Stream.empty })
 * const target = FanslyTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(FanslyMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FanslyMapper extends Context.Service<FanslyMapper, SiteMapper<FanslyTarget>>()($I`FanslyMapper`) {
  static readonly items = (target: FanslyTarget) => Stream.unwrap(FanslyMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts an Instagram target denotes: a grid tab, the current stories, a highlight reel, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide an Instagram mapper)
 *
 * ```ts import.meta.vitest name="Provide an Instagram mapper"
 * import { InstagramTarget } from "@beep/scratchpad/int/locator"
 * import { InstagramMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(InstagramMapper, { items: () => Stream.empty })
 * const target = InstagramTarget.cases.stories.make({ user: "example" })
 * const count = Stream.runCount(InstagramMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstagramMapper extends Context.Service<InstagramMapper, SiteMapper<InstagramTarget>>()($I`InstagramMapper`) {
  static readonly items = (target: InstagramTarget) => Stream.unwrap(InstagramMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts an OnlyFans target denotes: every post of an account, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide an OnlyFans mapper)
 *
 * ```ts import.meta.vitest name="Provide an OnlyFans mapper"
 * import { OnlyFansTarget } from "@beep/scratchpad/int/locator"
 * import { OnlyFansMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(OnlyFansMapper, { items: () => Stream.empty })
 * const target = OnlyFansTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(OnlyFansMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnlyFansMapper extends Context.Service<OnlyFansMapper, SiteMapper<OnlyFansTarget>>()($I`OnlyFansMapper`) {
  static readonly items = (target: OnlyFansTarget) => Stream.unwrap(OnlyFansMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the pins a Pinterest target denotes: every pin an account saved, or the one pin. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Pinterest mapper)
 *
 * ```ts import.meta.vitest name="Provide a Pinterest mapper"
 * import { PinterestTarget } from "@beep/scratchpad/int/locator"
 * import { PinterestMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(PinterestMapper, { items: () => Stream.empty })
 * const target = PinterestTarget.cases.post.make({ id: "99" })
 * const count = Stream.runCount(PinterestMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PinterestMapper extends Context.Service<PinterestMapper, SiteMapper<PinterestTarget>>()($I`PinterestMapper`) {
  static readonly items = (target: PinterestTarget) => Stream.unwrap(PinterestMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a Snapchat target denotes: every item of a profile listing, or the one spotlight video. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Snapchat mapper)
 *
 * ```ts import.meta.vitest name="Provide a Snapchat mapper"
 * import { SnapchatTarget } from "@beep/scratchpad/int/locator"
 * import { SnapchatMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(SnapchatMapper, { items: () => Stream.empty })
 * const target = SnapchatTarget.cases.collection.make({ user: "example", tab: "stories" })
 * const count = Stream.runCount(SnapchatMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SnapchatMapper extends Context.Service<SnapchatMapper, SiteMapper<SnapchatTarget>>()($I`SnapchatMapper`) {
  static readonly items = (target: SnapchatTarget) => Stream.unwrap(SnapchatMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a Threads target denotes: every post on a profile tab, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Threads mapper)
 *
 * ```ts import.meta.vitest name="Provide a Threads mapper"
 * import { ThreadsTarget } from "@beep/scratchpad/int/locator"
 * import { ThreadsMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(ThreadsMapper, { items: () => Stream.empty })
 * const target = ThreadsTarget.cases.collection.make({ user: "example", tab: "media" })
 * const count = Stream.runCount(ThreadsMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ThreadsMapper extends Context.Service<ThreadsMapper, SiteMapper<ThreadsTarget>>()($I`ThreadsMapper`) {
  static readonly items = (target: ThreadsTarget) => Stream.unwrap(ThreadsMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a TikTok target denotes: every post of an account, or the one video or photo post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a TikTok mapper)
 *
 * ```ts import.meta.vitest name="Provide a TikTok mapper"
 * import { TikTokTarget } from "@beep/scratchpad/int/locator"
 * import { TikTokMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(TikTokMapper, { items: () => Stream.empty })
 * const target = TikTokTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(TikTokMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TikTokMapper extends Context.Service<TikTokMapper, SiteMapper<TikTokTarget>>()($I`TikTokMapper`) {
  static readonly items = (target: TikTokTarget) => Stream.unwrap(TikTokMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a VSCO target denotes: every image and video in a gallery, or the one item. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Vsco mapper)
 *
 * ```ts import.meta.vitest name="Provide a Vsco mapper"
 * import { VscoTarget } from "@beep/scratchpad/int/locator"
 * import { VscoMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(VscoMapper, { items: () => Stream.empty })
 * const target = VscoTarget.cases.collection.make({ user: "example" })
 * const count = Stream.runCount(VscoMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VscoMapper extends Context.Service<VscoMapper, SiteMapper<VscoTarget>>()($I`VscoMapper`) {
  static readonly items = (target: VscoTarget) => Stream.unwrap(VscoMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the posts a Reddit target denotes: every post in a user listing, or the one post. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Reddit mapper)
 *
 * ```ts import.meta.vitest name="Provide a Reddit mapper"
 * import { RedditTarget } from "@beep/scratchpad/int/locator"
 * import { RedditMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(RedditMapper, { items: () => Stream.empty })
 * const target = RedditTarget.cases.post.make({ id: "abc123" })
 * const count = Stream.runCount(RedditMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedditMapper extends Context.Service<RedditMapper, SiteMapper<RedditTarget>>()($I`RedditMapper`) {
  static readonly items = (target: RedditTarget) => Stream.unwrap(RedditMapper.useSync((mapper) => mapper.items(target)));
}

/**
 * Enumerates the publications a Dzen target denotes: every publication of one channel. {@link items} routes every matching locator here.
 *
 * **Example** (Provide a Dzen mapper)
 *
 * ```ts import.meta.vitest name="Provide a Dzen mapper"
 * import { DzenTarget } from "@beep/scratchpad/int/locator"
 * import { DzenMapper } from "@beep/scratchpad/int/mapper"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as Stream from "effect/Stream"
 *
 * const empty = Layer.succeed(DzenMapper, { items: () => Stream.empty })
 * const target = DzenTarget.cases.collection.make({ channel: { by: "name", name: "example" } })
 * const count = Stream.runCount(DzenMapper.items(target))
 * Effect.runSync(Effect.provide(count, empty)) // => 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DzenMapper extends Context.Service<DzenMapper, SiteMapper<DzenTarget>>()($I`DzenMapper`) {
  static readonly items = (target: DzenTarget) => Stream.unwrap(DzenMapper.useSync((mapper) => mapper.items(target)));
}

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
 * import { Locator, MappedItem, PostLocator, RedGifsTarget } from "@beep/scratchpad/int/locator"
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
  x: ({ target }) => XMapper.items(target),
  youtube: ({ target }) => YouTubeMapper.items(target),
  redgifs: ({ target }) => RedGifsMapper.items(target),
  facebook: ({ target }) => FacebookMapper.items(target),
  fansly: ({ target }) => FanslyMapper.items(target),
  instagram: ({ target }) => InstagramMapper.items(target),
  onlyfans: ({ target }) => OnlyFansMapper.items(target),
  pinterest: ({ target }) => PinterestMapper.items(target),
  snapchat: ({ target }) => SnapchatMapper.items(target),
  threads: ({ target }) => ThreadsMapper.items(target),
  tiktok: ({ target }) => TikTokMapper.items(target),
  vsco: ({ target }) => VscoMapper.items(target),
  reddit: ({ target }) => RedditMapper.items(target),
  dzen: ({ target }) => DzenMapper.items(target)
})
