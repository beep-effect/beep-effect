import {
  AuthRequired,
  DzenMapper,
  FacebookMapper,
  FanslyMapper,
  InstagramMapper,
  OnlyFansMapper,
  PinterestMapper,
  RedditMapper,
  SnapchatMapper,
  ThreadsMapper,
  TikTokMapper,
  VscoMapper,
  FacebookTarget,
  Locator,
  LocatorFromUrl,
  MappedItem,
  RedGifsMapper,
  RedGifsTarget,
  XMapper,
  XTarget,
  YouTubeMapper,
  YouTubeTarget,
  items,
  landing,
  locate,
} from "@beep/scratchpad/int/locator";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const decode = S.decodeUnknownOption(LocatorFromUrl);
const encode = S.encodeOption(LocatorFromUrl);
const sameLocator = S.toEquivalence(Locator);
const canonical = (url: string) => O.flatMap(decode(url), encode);

describe("LocatorFromUrl", () => {
  it.each([
    ["https://twitter.com/jack/", "https://x.com/jack"],
    ["http://www.x.com/jack/media?lang=en#top", "https://x.com/jack/media"],
    ["https://mobile.twitter.com/jack/status/20?s=20", "https://x.com/jack/status/20"],
    ["https://youtube.com/@veritasium/videos/", "https://www.youtube.com/@veritasium/videos"],
    ["https://m.youtube.com/user/schafer5", "https://www.youtube.com/user/schafer5"],
    ["https://www.youtube.com/watch?si=abc&v=dQw4w9WgXcQ&t=42s", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://redgifs.com/users/example/", "https://www.redgifs.com/users/example"],
    ["https://m.facebook.com/example.page/photos_albums/", "https://www.facebook.com/example.page/photos_albums"],
    ["https://facebook.com/profile.php?id=100012345&ref=share", "https://www.facebook.com/profile.php?id=100012345"],
    ["https://www.facebook.com/photo/?fbid=987654321&set=a.1", "https://www.facebook.com/photo?fbid=987654321"],
    ["https://www.fansly.com/post/123456789", "https://fansly.com/post/123456789"],
    ["https://instagram.com/example/tagged/", "https://www.instagram.com/example/tagged"],
    ["https://www.instagram.com/stories/example/", "https://www.instagram.com/stories/example"],
    ["https://www.instagram.com/stories/highlights/17900000000000000/", "https://www.instagram.com/stories/highlights/17900000000000000"],
    ["https://www.instagram.com/reel/CxYz_12-ab/?igsh=abc", "https://www.instagram.com/reel/CxYz_12-ab"],
    ["https://www.onlyfans.com/123456/example", "https://onlyfans.com/123456/example"],
    ["https://pinterest.com/pin/1234567890/", "https://www.pinterest.com/pin/1234567890"],
    ["https://snapchat.com/add/example", "https://www.snapchat.com/@example"],
    ["https://www.snapchat.com/@example/spotlights", "https://www.snapchat.com/@example/spotlights"],
    ["https://www.threads.net/@example/post/DAbCdEfGh", "https://www.threads.com/@example/post/DAbCdEfGh"],
    ["https://m.tiktok.com/@example/photo/7300000000000000000?lang=en", "https://www.tiktok.com/@example/photo/7300000000000000000"],
    ["https://vsco.co/example", "https://vsco.co/example/gallery"],
    ["https://www.vsco.co/example/images/", "https://vsco.co/example/gallery"],
    ["https://old.reddit.com/u/example/submitted/", "https://www.reddit.com/user/example/submitted"],
    ["https://dzen.ru/id/5a3def60e86a9e50b401ab4a", "https://dzen.ru/id/5a3def60e86a9e50b401ab4a"],
  ])("canonicalizes %s", (input, expected) => {
    expect(canonical(input)).toEqual(O.some(expected));
  });

  it.each([
    "not a url",
    "ftp://x.com/jack",
    "https://user:secret@x.com/jack",
    "https://x.com:8443/jack",
    "https://x.com/",
    "https://x.com/home",
    "https://x.com/jack/status/not-a-number",
    "https://x.com/a/b/status/20",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/channel/not-a-channel-id",
    "https://example.org/jack",
    "https://www.facebook.com/reel/not-a-number",
    "https://www.facebook.com/profile.php",
    "https://www.instagram.com/explore",
    "https://www.instagram.com/stories/highlights/abc",
    "https://www.pinterest.com/pin",
    "https://www.tiktok.com/@example/video/abc",
    "https://dzen.ru/id/short",
  ])("rejects %s", (input) => {
    expect(O.isNone(decode(input))).toBe(true);
  });

  it("discriminates the platform and then the kind of target", () => {
    const described = O.map(
      decode("https://x.com/jack/status/20"),
      Locator.matchOrElse(
        {
          x: ({ target }) =>
            XTarget.match(target, {
              collection: ({ handle, tab }) => `${handle} ${tab}`,
              post: ({ handle, id }) => `${handle} #${id}`,
            }),
        },
        ({ platform }) => platform
      )
    );
    expect(described).toEqual(O.some("jack #20"));
  });

  it("refuses a Facebook tab on a page named only by its identifier", () => {
    const page = { by: "id", id: "100012345" } as const;
    expect(O.isNone(FacebookTarget.cases.collection.makeOption({ page, tab: "photos" }))).toBe(true);
    expect(O.isSome(FacebookTarget.cases.collection.makeOption({ page, tab: "posts" }))).toBe(true);
  });

  it.prop("prints every locator as a URL that reads back as the same locator", [Arbitrary.schema(Locator)], ([locator]) => {
    const reread = O.flatMap(encode(locator), decode);
    expect(O.isSome(reread) && sameLocator(reread.value, locator)).toBe(true);
  });
});

const video = Locator.cases.youtube.make({ target: YouTubeTarget.cases.post.make({ id: "dQw4w9WgXcQ" }) });

describe("landing", () => {
  it("resolves a post to its owner's listing only when the URL names the owner", () => {
    const home = (url: string) => decode(url).pipe(O.flatMap(landing), O.flatMap(encode));
    expect(home("https://x.com/jack/status/20")).toEqual(O.some("https://x.com/jack"));
    expect(home("https://www.youtube.com/@veritasium/shorts")).toEqual(O.some("https://www.youtube.com/@veritasium"));
    expect(home("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(O.none());
    expect(home("https://www.redgifs.com/watch/calmclip")).toEqual(O.none());
    expect(home("https://www.instagram.com/stories/example")).toEqual(O.some("https://www.instagram.com/example"));
    expect(home("https://www.instagram.com/p/CxYz_12-ab")).toEqual(O.none());
    expect(home("https://onlyfans.com/123456/example")).toEqual(O.some("https://onlyfans.com/example"));
    expect(home("https://www.tiktok.com/@example/video/7300000000000000000")).toEqual(O.some("https://www.tiktok.com/@example"));
    expect(home("https://www.facebook.com/example.page/reels")).toEqual(O.some("https://www.facebook.com/example.page"));
    expect(home("https://www.reddit.com/comments/abc123")).toEqual(O.none());
  });
});

it.layer(
  Layer.mergeAll(
    Layer.succeed(XMapper, { items: () => Stream.fail(AuthRequired.make({ platform: "x" })) }),
    Layer.succeed(YouTubeMapper, {
      items: YouTubeTarget.match({
        collection: () => Stream.make(MappedItem.make({ source: video, videos: 1 })),
        post: (target) => Stream.make(MappedItem.make({ source: Locator.cases.youtube.make({ target }), videos: 1 })),
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

  it.effect("names the input when no site routes it", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(locate("https://example.org/jack"));
      expect(failure.input).toBe("https://example.org/jack");
    })
  );
});
