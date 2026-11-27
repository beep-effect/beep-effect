import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  AuthRequired,
  Locator,
  locate,
  MappedItem,
  Page,
  PostLocator,
  RedGifsTarget,
  YouTubeTarget,
} from "@/core/locator";
import {
  DzenMapper,
  FacebookMapper,
  FanslyMapper,
  InstagramMapper,
  items,
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
} from "@/core/mapper";

const video = PostLocator.make(
  Locator.cases.youtube.make({ target: YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" }) })
);

it.layer(
  Layer.mergeAll(
    Layer.succeed(XMapper, { pages: () => Stream.fail(AuthRequired.make({ platform: "x" })) }),
    Layer.succeed(YouTubeMapper, {
      pages: YouTubeTarget.match({
        collection: () => Stream.make(Page.of(MappedItem.make({ source: video, videos: 1 }))),
        post: (target) =>
          Stream.make(
            Page.of(MappedItem.make({ source: PostLocator.make(Locator.cases.youtube.make({ target })), videos: 1 }))
          ),
      }),
    }),
    Layer.succeed(RedGifsMapper, {
      pages: RedGifsTarget.match({ collection: () => Stream.empty, post: () => Stream.empty }),
    }),
    Layer.succeed(DzenMapper, { pages: () => Stream.empty }),
    Layer.succeed(FacebookMapper, { pages: () => Stream.empty }),
    Layer.succeed(FanslyMapper, { pages: () => Stream.empty }),
    Layer.succeed(InstagramMapper, { pages: () => Stream.empty }),
    Layer.succeed(OnlyFansMapper, { pages: () => Stream.empty }),
    Layer.succeed(PinterestMapper, { pages: () => Stream.empty }),
    Layer.succeed(RedditMapper, { pages: () => Stream.empty }),
    Layer.succeed(SnapchatMapper, { pages: () => Stream.empty }),
    Layer.succeed(ThreadsMapper, { pages: () => Stream.empty }),
    Layer.succeed(TikTokMapper, { pages: () => Stream.empty }),
    Layer.succeed(VscoMapper, { pages: () => Stream.empty })
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
