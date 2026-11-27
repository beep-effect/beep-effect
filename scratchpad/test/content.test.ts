import {
  Access,
  Account,
  counted,
  fetchable,
  handleOf,
  type Connection,
  ConnectionsHidden,
  DzenReader,
  FacebookReader,
  FanslyReader,
  InstagramReader,
  OnlyFansReader,
  PinterestReader,
  RedGifsReader,
  RedditReader,
  SnapchatReader,
  ThreadsReader,
  TikTokReader,
  VscoReader,
  XReader,
  YouTubeReader,
  connections,
  posts,
  profile,
  Media,
  Picture,
  Post,
  Profile,
  RichText,
  hashtags,
  largest,
  linked,
  mentions,
  summary,
  tagged,
} from "@beep/scratchpad/int/content";
import { AuthRequired, CollectionLocator, Locator, type Platform, PostLocator, XTarget, locate } from "@beep/scratchpad/int/locator";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const readPost = S.decodeUnknownOption(Post);
const readProfile = S.decodeUnknownOption(Profile);
const readText = S.decodeUnknownOption(RichText);

const carousel = {
  source: "https://instagram.com/p/CxYz_12-ab/?igsh=abc",
  id: "3210987654321098765",
  author: { by: "id", id: "25025320", handle: "example", name: "Example" },
  collaborators: [{ by: "handle", handle: "partner" }],
  body: {
    text: "golden hour with @friend #sunset https://x.com/jack/status/20",
    entities: [
      { kind: "mention", account: { by: "handle", handle: "friend" }, span: { start: 17, end: 24 } },
      { kind: "hashtag", tag: "sunset" },
      { kind: "link", url: "https://x.com/jack/status/20" },
    ],
  },
  media: [
    {
      kind: "image",
      width: 1080,
      height: 1350,
      alt: "A beach at dusk",
      access: {
        kind: "full",
        renditions: [{ url: "https://cdn.example/1_1080.jpg", width: 1080, height: 1350, expiresAt: 1790000000000 }],
      },
      tags: [{ account: { by: "id", id: "1", handle: "friend" }, position: { x: 0.25, y: 0.5 } }],
    },
    {
      kind: "video",
      duration: 12500,
      poster: { renditions: [{ url: "https://cdn.example/2_poster.jpg" }] },
      tags: [{ account: { by: "handle", handle: "other" } }],
    },
  ],
  engagement: { likes: { kind: "rounded", count: 1400 } },
  publishedAt: 1764115200000,
};

describe("Post", () => {
  it("keeps one caption for the post and separate tags for each gallery item", () => {
    const read = readPost(carousel);
    expect(O.map(read, (post) => hashtags(post.body))).toEqual(O.some(["sunset"]));
    expect(O.map(read, (post) => A.map(post.media, ({ tags }) => A.length(tags)))).toEqual(O.some([1, 1]));
    expect(O.map(read, (post) => A.map(tagged(post), handleOf))).toEqual(
      O.some([O.some("friend"), O.some("other")])
    );
    expect(O.map(read, (post) => A.map(mentions(post.body), handleOf))).toEqual(
      O.some([O.some("friend")])
    );
  });

  it("stores its source as the canonical URL", () => {
    const stored = O.flatMap(readPost(carousel), S.encodeOption(Post));
    expect(O.map(stored, ({ source }) => source)).toEqual(O.some("https://www.instagram.com/p/CxYz_12-ab"));
  });

  it("derives links to other posts from the caption's link entities", () => {
    const targets = O.map(readPost(carousel), (post) => A.map(linked(post.body), ({ platform }) => platform));
    expect(targets).toEqual(O.some(["x"]));
  });

  it("fills what a site does not publish with empty values", () => {
    const bare = readPost({ source: "https://www.redgifs.com/watch/calmclip", author: { by: "handle", handle: "example" } });
    expect(O.map(bare, ({ body, media, title }) => [body.text, A.length(media), O.isNone(title)])).toEqual(
      O.some(["", 0, true])
    );
    expect(O.isNone(O.flatMap(bare, ({ engagement }) => engagement.likes))).toBe(true);
  });

  it("reduces to the traversal row of the locator module", () => {
    const row = O.map(readPost(carousel), summary);
    expect(O.map(row, ({ images, videos }) => [images, videos])).toEqual(O.some([1, 1]));
  });

  it.each([
    ["a listing as its source", { ...carousel, source: "https://www.instagram.com/example" }],
    ["an author with neither id nor handle", { ...carousel, author: { by: "handle", name: "Example" } }],
    ["a span past the end of the caption", { ...carousel, body: { text: "hi", entities: [{ kind: "hashtag", tag: "x", span: { start: 0, end: 9 } }] } }],
    ["a tag positioned outside the item", { ...carousel, media: [{ kind: "image", tags: [{ account: { by: "handle", handle: "a" }, position: { x: 1.5, y: 0 } }] }] }],
  ])("refuses %s", (_, input) => {
    expect(O.isNone(readPost(input))).toBe(true);
  });

  it("lists what the viewer may fetch from each gallery item, through both layers", () => {
    const described = O.map(readPost(carousel), ({ media }) =>
      A.map(
        media,
        Media.match({
          image: (image) => `image with ${A.length(fetchable(image))} rendition`,
          video: ({ access }) =>
            Access.match(access, {
              full: ({ renditions }) => `video with ${A.length(renditions)} renditions`,
              preview: () => "preview of a video",
              locked: () => "locked video",
            }),
        })
      )
    );
    expect(described).toEqual(O.some(["image with 1 rendition", "video with 0 renditions"]));
  });

  it("cannot hold a rendition on a locked item, whatever the input lists", () => {
    const locked = S.decodeUnknownOption(Media)({
      kind: "video",
      access: { kind: "locked", renditions: [{ url: "https://cdn.example/v.mp4" }] },
    });
    expect(O.map(locked, (item) => A.length(fetchable(item)))).toEqual(O.some(0));
    expect(O.map(O.flatMap(locked, S.encodeOption(Media)), ({ access }) => access)).toEqual(O.some({ kind: "locked" }));
  });

  it("admits a locked item that only says it exists", () => {
    expect(O.isSome(Media.cases.image.makeOption({ access: Access.cases.locked.make({}) }))).toBe(true);
  });

  it("stores a post in a form that reads back unchanged", () => {
    const stored = O.flatMap(readPost(carousel), S.encodeOption(Post));
    expect(O.flatMap(O.flatMap(stored, readPost), S.encodeOption(Post))).toEqual(stored);
    expect(O.map(stored, ({ media }) => A.length(media ?? []))).toEqual(O.some(2));
  });
});

describe("Profile", () => {
  const profile = {
    source: "https://twitter.com/jack/",
    account: { by: "id", id: "12", handle: "jack", name: "jack" },
    bio: { text: "#bitcoin", entities: [{ kind: "hashtag", tag: "bitcoin", span: { start: 0, end: 8 } }] },
    links: [{ url: "https://example.org/", title: "Site" }],
    avatar: {
      renditions: [
        { url: "https://pbs.example/a_normal.jpg", width: 48, height: 48, label: "_normal" },
        { url: "https://pbs.example/a_400x400.jpg", width: 400, height: 400, label: "_400x400" },
      ],
    },
    followers: { kind: "rounded", count: 6400000 },
    following: { kind: "exact", count: 4600 },
    posts: { kind: "hidden" },
  };

  it("picks the largest profile picture a site offers", () => {
    const label = O.flatMap(readProfile(profile), ({ avatar }) => O.flatMap(avatar, (picture) => largest(picture).label));
    expect(label).toEqual(O.some("_400x400"));
  });

  it("keeps a count the site does not print absent instead of zero", () => {
    const read = readProfile(profile);
    expect(O.map(read, ({ followers }) => O.flatMap(followers, counted))).toEqual(O.some(O.some(6400000)));
    expect(O.map(read, ({ posts }) => O.flatMap(posts, counted))).toEqual(O.some(O.none()));
    expect(O.map(read, ({ banner }) => O.isNone(banner))).toEqual(O.some(true));
    expect(O.map(read, ({ verified, visibility }) => [verified, visibility])).toEqual(O.some([false, "public"]));
  });

  it("refuses a single post as its source", () => {
    expect(O.isNone(readProfile({ ...profile, source: "https://x.com/jack/status/20" }))).toBe(true);
  });

  it("refuses a picture without a rendition", () => {
    expect(O.isNone(S.decodeUnknownOption(Picture)({ renditions: [] }))).toBe(true);
  });
});

describe("RichText", () => {
  it("holds entities whether or not the site said where they sit", () => {
    const unplaced = readText({ text: "thanks", entities: [{ kind: "mention", account: { by: "id", id: "7" } }] });
    expect(O.map(unplaced, (text) => A.length(mentions(text)))).toEqual(O.some(1));
    expect(O.isSome(Account.cases.id.makeOption({ id: "7" }))).toBe(true);
  });
});

const jack = Account.cases.id.make({ id: "12", handle: O.some("jack") });
const follower = Account.cases.handle.make({ handle: "fan" });
const silent = (platform: Platform) => ({
  posts: () => Stream.empty,
  profile: () => Effect.fail(AuthRequired.make({ platform })),
  connections: (_: unknown, connection: Connection) =>
    Stream.fail(ConnectionsHidden.make({ platform, connection })),
});

it.layer(
  Layer.mergeAll(
    Layer.succeed(XReader, {
      posts: (target) =>
        Stream.make(Post.make({
            source: PostLocator.make(
              Locator.cases.x.make({ target: XTarget.cases.post.make({ handle: target.handle, id: "20" }) })
            ),
            author: jack,
          })),
      profile: Effect.fn("XReader.profile")((target: XTarget) =>
        Effect.succeed(Profile.make({ source: CollectionLocator.make(Locator.cases.x.make({ target })), account: jack }))
      ),
      connections: (_, connection) => (connection === "followers" ? Stream.make(follower) : Stream.empty),
    }),
    Layer.succeed(YouTubeReader, silent("youtube")),
    Layer.succeed(RedGifsReader, silent("redgifs")),
    Layer.succeed(FacebookReader, silent("facebook")),
    Layer.succeed(FanslyReader, silent("fansly")),
    Layer.succeed(InstagramReader, silent("instagram")),
    Layer.succeed(OnlyFansReader, silent("onlyfans")),
    Layer.succeed(PinterestReader, silent("pinterest")),
    Layer.succeed(SnapchatReader, silent("snapchat")),
    Layer.succeed(ThreadsReader, silent("threads")),
    Layer.succeed(TikTokReader, silent("tiktok")),
    Layer.succeed(VscoReader, silent("vsco")),
    Layer.succeed(RedditReader, silent("reddit")),
    Layer.succeed(DzenReader, silent("dzen"))
  )
)("readers", (it) => {
  it.effect("routes a locator to the reader of its platform", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://twitter.com/jack");
      const found = yield* profile(locator);
      const read = yield* posts(locator).pipe(Stream.runCollect);
      expect(handleOf(found.account)).toEqual(O.some("jack"));
      expect(A.length(read)).toBe(1);
    })
  );

  it.effect("streams the accounts behind a follower count in either argument order", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://x.com/jack");
      const followers = yield* connections(locator, "followers").pipe(Stream.runCollect);
      const following = yield* pipe(locator, connections("following"), Stream.runCollect);
      expect(A.map(followers, handleOf)).toEqual([O.some("fan")]);
      expect(A.length(following)).toBe(0);
    })
  );

  it.effect("names the hidden connection when a site lists none", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://www.reddit.com/user/example");
      const failure = yield* connections(locator, "followers").pipe(Stream.runCollect, Effect.flip);
      expect(failure._tag).toBe("ConnectionsHidden");
    })
  );
});
