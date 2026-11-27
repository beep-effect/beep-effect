import { AuthRequired, Locator, MappedItem, PostLocator, RedGifsTarget, YouTubeTarget, locate } from "@beep/scratchpad/int/locator";
import {
  DzenMapper,
  FacebookMapper,
  FanslyMapper,
  InstagramMapper,
  OnlyFansMapper,
  PinterestMapper,
  RedditMapper,
  RedGifsMapper,
  SnapchatMapper,
  ThreadsMapper,
  TikTokMapper,
  VscoMapper,
  XMapper,
  YouTubeMapper,
  items,
} from "@beep/scratchpad/int/mapper";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const video = PostLocator.make(
  Locator.cases.youtube.make({ target: YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" }) })
);

it.layer(
  Layer.mergeAll(
    Layer.succeed(XMapper, { items: () => Stream.fail(AuthRequired.make({ platform: "x" })) }),
    Layer.succeed(YouTubeMapper, {
      items: YouTubeTarget.match({
        collection: () => Stream.make(MappedItem.make({ source: video, videos: 1 })),
        post: (target) => Stream.make(MappedItem.make({ source: PostLocator.make(Locator.cases.youtube.make({ target })), videos: 1 })),
      }),
    }),
    Layer.succeed(RedGifsMapper, {
      items: RedGifsTarget.match({ collection: () => Stream.empty, post: () => Stream.empty }),
    }),
    Layer.succeed(DzenMapper, { items: () => Stream.empty }),
    Layer.succeed(FacebookMapper, { items: () => Stream.empty }),
    Layer.succeed(FanslyMapper, { items: () => Stream.empty }),
    Layer.succeed(InstagramMapper, { items: () => Stream.empty }),
    Layer.succeed(OnlyFansMapper, { items: () => Stream.empty }),
    Layer.succeed(PinterestMapper, { items: () => Stream.empty }),
    Layer.succeed(RedditMapper, { items: () => Stream.empty }),
    Layer.succeed(SnapchatMapper, { items: () => Stream.empty }),
    Layer.succeed(ThreadsMapper, { items: () => Stream.empty }),
    Layer.succeed(TikTokMapper, { items: () => Stream.empty }),
    Layer.succeed(VscoMapper, { items: () => Stream.empty })
  )
)("items", (it) => {
  it.effect("routes a locator to the mapper service of its platform", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://youtube.com/@veritasium/videos");
      const found = yield* items(locator).pipe(Stream.runCollect);
      const stored = yield* S.encodeEffect(S.Array(MappedItem))(found);
      expect(A.map(stored, ({ source }) => source)).toEqual(["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]);
    })
  );

  it.effect("keeps a site failure typed for the caller", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://x.com/jack/media");
      const failure = yield* items(locator).pipe(Stream.runCollect, Effect.flip);
      expect(failure._tag).toBe("AuthRequired");
    })
  );
});
