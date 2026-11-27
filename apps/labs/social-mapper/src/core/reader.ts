/**
 * The port a site implements to read what its targets publish, one service
 * per platform, and the functions that route a locator to its reader.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import { dual } from "effect/Function";
import * as Stream from "effect/Stream";
import { Locator } from "./locator.ts";
import type * as Effect from "effect/Effect";
import type { Account, Connection, ConnectionsHidden, Post, Profile } from "./content.ts";
import type {
  DzenTarget,
  FacebookTarget,
  FanslyTarget,
  InstagramTarget,
  MapFailure,
  OnlyFansTarget,
  PinterestTarget,
  RedditTarget,
  RedGifsTarget,
  SnapchatTarget,
  ThreadsTarget,
  TikTokTarget,
  VscoTarget,
  XTarget,
  YouTubeTarget,
} from "./locator.ts";

const $I = $SocialMapperId.create("core/reader");

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
  readonly connections: (
    target: Target,
    connection: Connection
  ) => Stream.Stream<Account, MapFailure | ConnectionsHidden>;
  readonly posts: (target: Target) => Stream.Stream<Post, MapFailure>;
  readonly profile: (target: Target) => Effect.Effect<Profile, MapFailure>;
}

/**
 * Reads the posts, profile and connections of an X target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an X reader)
 *
 * ```ts import.meta.vitest name="Provide an X reader"
 * import { XReader } from "@/core/reader"
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
export class XReader extends Context.Service<XReader, SiteReader<XTarget>>()($I`XReader`) {
  static readonly posts = (target: XTarget) => Stream.unwrap(XReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: XTarget) => XReader.use((reader) => reader.profile(target));
  static readonly connections = (target: XTarget, connection: Connection) =>
    Stream.unwrap(XReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a YouTube target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a YouTube reader)
 *
 * ```ts import.meta.vitest name="Provide a YouTube reader"
 * import { YouTubeReader } from "@/core/reader"
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
export class YouTubeReader extends Context.Service<YouTubeReader, SiteReader<YouTubeTarget>>()($I`YouTubeReader`) {
  static readonly posts = (target: YouTubeTarget) =>
    Stream.unwrap(YouTubeReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: YouTubeTarget) => YouTubeReader.use((reader) => reader.profile(target));
  static readonly connections = (target: YouTubeTarget, connection: Connection) =>
    Stream.unwrap(YouTubeReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a RedGifs target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a RedGifs reader)
 *
 * ```ts import.meta.vitest name="Provide a RedGifs reader"
 * import { RedGifsReader } from "@/core/reader"
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
export class RedGifsReader extends Context.Service<RedGifsReader, SiteReader<RedGifsTarget>>()($I`RedGifsReader`) {
  static readonly posts = (target: RedGifsTarget) =>
    Stream.unwrap(RedGifsReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: RedGifsTarget) => RedGifsReader.use((reader) => reader.profile(target));
  static readonly connections = (target: RedGifsTarget, connection: Connection) =>
    Stream.unwrap(RedGifsReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Facebook target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Facebook reader)
 *
 * ```ts import.meta.vitest name="Provide a Facebook reader"
 * import { FacebookReader } from "@/core/reader"
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
export class FacebookReader extends Context.Service<FacebookReader, SiteReader<FacebookTarget>>()($I`FacebookReader`) {
  static readonly posts = (target: FacebookTarget) =>
    Stream.unwrap(FacebookReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: FacebookTarget) => FacebookReader.use((reader) => reader.profile(target));
  static readonly connections = (target: FacebookTarget, connection: Connection) =>
    Stream.unwrap(FacebookReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Fansly target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Fansly reader)
 *
 * ```ts import.meta.vitest name="Provide a Fansly reader"
 * import { FanslyReader } from "@/core/reader"
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
export class FanslyReader extends Context.Service<FanslyReader, SiteReader<FanslyTarget>>()($I`FanslyReader`) {
  static readonly posts = (target: FanslyTarget) =>
    Stream.unwrap(FanslyReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: FanslyTarget) => FanslyReader.use((reader) => reader.profile(target));
  static readonly connections = (target: FanslyTarget, connection: Connection) =>
    Stream.unwrap(FanslyReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of an Instagram target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an Instagram reader)
 *
 * ```ts import.meta.vitest name="Provide an Instagram reader"
 * import { InstagramReader } from "@/core/reader"
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
export class InstagramReader extends Context.Service<InstagramReader, SiteReader<InstagramTarget>>()(
  $I`InstagramReader`
) {
  static readonly posts = (target: InstagramTarget) =>
    Stream.unwrap(InstagramReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: InstagramTarget) => InstagramReader.use((reader) => reader.profile(target));
  static readonly connections = (target: InstagramTarget, connection: Connection) =>
    Stream.unwrap(InstagramReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of an OnlyFans target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide an OnlyFans reader)
 *
 * ```ts import.meta.vitest name="Provide an OnlyFans reader"
 * import { OnlyFansReader } from "@/core/reader"
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
export class OnlyFansReader extends Context.Service<OnlyFansReader, SiteReader<OnlyFansTarget>>()($I`OnlyFansReader`) {
  static readonly posts = (target: OnlyFansTarget) =>
    Stream.unwrap(OnlyFansReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: OnlyFansTarget) => OnlyFansReader.use((reader) => reader.profile(target));
  static readonly connections = (target: OnlyFansTarget, connection: Connection) =>
    Stream.unwrap(OnlyFansReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Pinterest target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Pinterest reader)
 *
 * ```ts import.meta.vitest name="Provide a Pinterest reader"
 * import { PinterestReader } from "@/core/reader"
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
export class PinterestReader extends Context.Service<PinterestReader, SiteReader<PinterestTarget>>()(
  $I`PinterestReader`
) {
  static readonly posts = (target: PinterestTarget) =>
    Stream.unwrap(PinterestReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: PinterestTarget) => PinterestReader.use((reader) => reader.profile(target));
  static readonly connections = (target: PinterestTarget, connection: Connection) =>
    Stream.unwrap(PinterestReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Snapchat target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Snapchat reader)
 *
 * ```ts import.meta.vitest name="Provide a Snapchat reader"
 * import { SnapchatReader } from "@/core/reader"
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
export class SnapchatReader extends Context.Service<SnapchatReader, SiteReader<SnapchatTarget>>()($I`SnapchatReader`) {
  static readonly posts = (target: SnapchatTarget) =>
    Stream.unwrap(SnapchatReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: SnapchatTarget) => SnapchatReader.use((reader) => reader.profile(target));
  static readonly connections = (target: SnapchatTarget, connection: Connection) =>
    Stream.unwrap(SnapchatReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Threads target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Threads reader)
 *
 * ```ts import.meta.vitest name="Provide a Threads reader"
 * import { ThreadsReader } from "@/core/reader"
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
export class ThreadsReader extends Context.Service<ThreadsReader, SiteReader<ThreadsTarget>>()($I`ThreadsReader`) {
  static readonly posts = (target: ThreadsTarget) =>
    Stream.unwrap(ThreadsReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: ThreadsTarget) => ThreadsReader.use((reader) => reader.profile(target));
  static readonly connections = (target: ThreadsTarget, connection: Connection) =>
    Stream.unwrap(ThreadsReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a TikTok target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a TikTok reader)
 *
 * ```ts import.meta.vitest name="Provide a TikTok reader"
 * import { TikTokReader } from "@/core/reader"
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
export class TikTokReader extends Context.Service<TikTokReader, SiteReader<TikTokTarget>>()($I`TikTokReader`) {
  static readonly posts = (target: TikTokTarget) =>
    Stream.unwrap(TikTokReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: TikTokTarget) => TikTokReader.use((reader) => reader.profile(target));
  static readonly connections = (target: TikTokTarget, connection: Connection) =>
    Stream.unwrap(TikTokReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a VSCO target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a VSCO reader)
 *
 * ```ts import.meta.vitest name="Provide a VSCO reader"
 * import { VscoReader } from "@/core/reader"
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
export class VscoReader extends Context.Service<VscoReader, SiteReader<VscoTarget>>()($I`VscoReader`) {
  static readonly posts = (target: VscoTarget) => Stream.unwrap(VscoReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: VscoTarget) => VscoReader.use((reader) => reader.profile(target));
  static readonly connections = (target: VscoTarget, connection: Connection) =>
    Stream.unwrap(VscoReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Reddit target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Reddit reader)
 *
 * ```ts import.meta.vitest name="Provide a Reddit reader"
 * import { RedditReader } from "@/core/reader"
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
export class RedditReader extends Context.Service<RedditReader, SiteReader<RedditTarget>>()($I`RedditReader`) {
  static readonly posts = (target: RedditTarget) =>
    Stream.unwrap(RedditReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: RedditTarget) => RedditReader.use((reader) => reader.profile(target));
  static readonly connections = (target: RedditTarget, connection: Connection) =>
    Stream.unwrap(RedditReader.useSync((reader) => reader.connections(target, connection)));
}

/**
 * Reads the posts, profile and connections of a Dzen target. {@link posts}, {@link profile} and {@link connections}
 * route every matching locator here.
 *
 * **Example** (Provide a Dzen reader)
 *
 * ```ts import.meta.vitest name="Provide a Dzen reader"
 * import { DzenReader } from "@/core/reader"
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
export class DzenReader extends Context.Service<DzenReader, SiteReader<DzenTarget>>()($I`DzenReader`) {
  static readonly posts = (target: DzenTarget) => Stream.unwrap(DzenReader.useSync((reader) => reader.posts(target)));
  static readonly profile = (target: DzenTarget) => DzenReader.use((reader) => reader.profile(target));
  static readonly connections = (target: DzenTarget, connection: Connection) =>
    Stream.unwrap(DzenReader.useSync((reader) => reader.connections(target, connection)));
}

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
 * import { RedGifsReader, posts } from "@/core/reader"
 * import { Locator, RedGifsTarget } from "@/core/locator"
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
  x: ({ target }) => XReader.posts(target),
  youtube: ({ target }) => YouTubeReader.posts(target),
  redgifs: ({ target }) => RedGifsReader.posts(target),
  facebook: ({ target }) => FacebookReader.posts(target),
  fansly: ({ target }) => FanslyReader.posts(target),
  instagram: ({ target }) => InstagramReader.posts(target),
  onlyfans: ({ target }) => OnlyFansReader.posts(target),
  pinterest: ({ target }) => PinterestReader.posts(target),
  snapchat: ({ target }) => SnapchatReader.posts(target),
  threads: ({ target }) => ThreadsReader.posts(target),
  tiktok: ({ target }) => TikTokReader.posts(target),
  vsco: ({ target }) => VscoReader.posts(target),
  reddit: ({ target }) => RedditReader.posts(target),
  dzen: ({ target }) => DzenReader.posts(target),
});

/**
 * Reads the profile of the account a locator denotes through the reader of
 * its platform.
 *
 * **Example** (Read the profile behind a locator)
 *
 * ```ts import.meta.vitest name="Read the profile behind a locator"
 * import { profile } from "@/core/reader"
 * import { locate } from "@/core/locator"
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
  x: ({ target }) => XReader.profile(target),
  youtube: ({ target }) => YouTubeReader.profile(target),
  redgifs: ({ target }) => RedGifsReader.profile(target),
  facebook: ({ target }) => FacebookReader.profile(target),
  fansly: ({ target }) => FanslyReader.profile(target),
  instagram: ({ target }) => InstagramReader.profile(target),
  onlyfans: ({ target }) => OnlyFansReader.profile(target),
  pinterest: ({ target }) => PinterestReader.profile(target),
  snapchat: ({ target }) => SnapchatReader.profile(target),
  threads: ({ target }) => ThreadsReader.profile(target),
  tiktok: ({ target }) => TikTokReader.profile(target),
  vsco: ({ target }) => VscoReader.profile(target),
  reddit: ({ target }) => RedditReader.profile(target),
  dzen: ({ target }) => DzenReader.profile(target),
});

/**
 * Streams the accounts that follow, or are followed by, the account a
 * locator denotes.
 *
 * **Example** (Count followers, or settle for the printed count)
 *
 * ```ts import.meta.vitest name="Count followers, or settle for the printed count"
 * import { connections } from "@/core/reader"
 * import { locate } from "@/core/locator"
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
  (connection: Connection): (locator: Locator) => Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers>;
  (locator: Locator, connection: Connection): Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers>;
} = dual(
  2,
  (locator: Locator, connection: Connection): Stream.Stream<Account, MapFailure | ConnectionsHidden, Readers> =>
    Locator.match(locator, {
      x: ({ target }) => XReader.connections(target, connection),
      youtube: ({ target }) => YouTubeReader.connections(target, connection),
      redgifs: ({ target }) => RedGifsReader.connections(target, connection),
      facebook: ({ target }) => FacebookReader.connections(target, connection),
      fansly: ({ target }) => FanslyReader.connections(target, connection),
      instagram: ({ target }) => InstagramReader.connections(target, connection),
      onlyfans: ({ target }) => OnlyFansReader.connections(target, connection),
      pinterest: ({ target }) => PinterestReader.connections(target, connection),
      snapchat: ({ target }) => SnapchatReader.connections(target, connection),
      threads: ({ target }) => ThreadsReader.connections(target, connection),
      tiktok: ({ target }) => TikTokReader.connections(target, connection),
      vsco: ({ target }) => VscoReader.connections(target, connection),
      reddit: ({ target }) => RedditReader.connections(target, connection),
      dzen: ({ target }) => DzenReader.connections(target, connection),
    })
);
