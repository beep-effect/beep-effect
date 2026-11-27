/**
 * Stand-ins for the platforms no mapper has been written for yet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { MapperFailed } from "../locator.ts";
import {
  DzenMapper,
  FacebookMapper,
  FanslyMapper,
  InstagramMapper,
  PinterestMapper,
  RedditMapper,
  RedGifsMapper,
  SnapchatMapper,
  ThreadsMapper,
  TikTokMapper,
  VscoMapper,
  XMapper,
  YouTubeMapper,
} from "../mapper.ts";
import {
  DzenReader,
  FacebookReader,
  FanslyReader,
  InstagramReader,
  PinterestReader,
  RedditReader,
  RedGifsReader,
  SnapchatReader,
  ThreadsReader,
  TikTokReader,
  VscoReader,
  XReader,
  YouTubeReader,
} from "../reader.ts";
import type { Platform } from "../locator.ts";

const absent = (platform: Platform) =>
  MapperFailed.make({ platform, detail: "no mapper is installed for this platform" });

const mapper = (platform: Platform) => ({ pages: () => Stream.fail(absent(platform)) });

const reader = (platform: Platform) => ({
  posts: () => Stream.fail(absent(platform)),
  profile: () => Effect.fail(absent(platform)),
  connections: () => Stream.fail(absent(platform)),
});

/**
 * Answers every platform but OnlyFans with a typed failure.
 *
 * **Details**
 *
 * A locator can name any platform the model knows, so a program needs an
 * answer for each. This layer supplies "not installed" for the ones still
 * to be written, which keeps a missing mapper a stored failure of one run
 * and not a missing service at startup.
 *
 * **Example** (Complete a program that maps one site)
 *
 * ```ts import.meta.vitest name="Complete a program that maps one site"
 * import { layer as onlyfans } from "@/core/sites/onlyfans"
 * import { layer as unmapped } from "@/core/sites/unmapped"
 * import * as Layer from "effect/Layer"
 *
 * const sites = Layer.merge(onlyfans(), unmapped)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = Layer.mergeAll(
  Layer.succeed(DzenMapper, mapper("dzen")),
  Layer.succeed(FacebookMapper, mapper("facebook")),
  Layer.succeed(FanslyMapper, mapper("fansly")),
  Layer.succeed(InstagramMapper, mapper("instagram")),
  Layer.succeed(PinterestMapper, mapper("pinterest")),
  Layer.succeed(RedditMapper, mapper("reddit")),
  Layer.succeed(RedGifsMapper, mapper("redgifs")),
  Layer.succeed(SnapchatMapper, mapper("snapchat")),
  Layer.succeed(ThreadsMapper, mapper("threads")),
  Layer.succeed(TikTokMapper, mapper("tiktok")),
  Layer.succeed(VscoMapper, mapper("vsco")),
  Layer.succeed(XMapper, mapper("x")),
  Layer.succeed(YouTubeMapper, mapper("youtube")),
  Layer.succeed(DzenReader, reader("dzen")),
  Layer.succeed(FacebookReader, reader("facebook")),
  Layer.succeed(FanslyReader, reader("fansly")),
  Layer.succeed(InstagramReader, reader("instagram")),
  Layer.succeed(PinterestReader, reader("pinterest")),
  Layer.succeed(RedditReader, reader("reddit")),
  Layer.succeed(RedGifsReader, reader("redgifs")),
  Layer.succeed(SnapchatReader, reader("snapchat")),
  Layer.succeed(ThreadsReader, reader("threads")),
  Layer.succeed(TikTokReader, reader("tiktok")),
  Layer.succeed(VscoReader, reader("vsco")),
  Layer.succeed(XReader, reader("x")),
  Layer.succeed(YouTubeReader, reader("youtube"))
);
