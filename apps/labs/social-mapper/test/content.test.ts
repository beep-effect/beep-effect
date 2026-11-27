import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Access,
  Account,
  counted,
  fetchable,
  handleOf,
  Media,
  Picture,
  Post,
  Profile,
  RichText,
  RichTextFromString,
  TextEntity,
} from "@/core/content";
import { LocatorFromUrl } from "@/core/locator";

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
    expect(O.map(read, (post) => RichText.hashtags(post.body))).toEqual(O.some(["sunset"]));
    expect(O.map(read, (post) => A.map(post.media, ({ tags }) => A.length(tags)))).toEqual(O.some([1, 1]));
    expect(O.map(read, (post) => A.map(Post.tagged(post), handleOf))).toEqual(
      O.some([O.some("friend"), O.some("other")])
    );
    expect(O.map(read, (post) => A.map(RichText.mentions(post.body), handleOf))).toEqual(O.some([O.some("friend")]));
  });

  it("stores its source as the canonical URL", () => {
    const stored = O.flatMap(readPost(carousel), S.encodeOption(Post));
    expect(O.map(stored, ({ source }) => source)).toEqual(O.some("https://www.instagram.com/p/CxYz_12-ab"));
  });

  it("derives links to other posts from the caption's link entities", () => {
    const targets = O.map(readPost(carousel), (post) => A.map(RichText.linked(post.body), ({ platform }) => platform));
    expect(targets).toEqual(O.some(["x"]));
  });

  it("fills what a site does not publish with empty values", () => {
    const bare = readPost({
      source: "https://www.redgifs.com/watch/calmclip",
      author: { by: "handle", handle: "example" },
    });
    expect(O.map(bare, ({ body, media, title }) => [body.text, A.length(media), O.isNone(title)])).toEqual(
      O.some(["", 0, true])
    );
    expect(O.isNone(O.flatMap(bare, ({ engagement }) => engagement.likes))).toBe(true);
  });

  it("reduces to the traversal row of the locator module", () => {
    const row = O.map(readPost(carousel), Post.summary);
    expect(O.map(row, ({ images, videos }) => [images, videos])).toEqual(O.some([1, 1]));
  });

  it.each([
    ["a listing as its source", { ...carousel, source: "https://www.instagram.com/example" }],
    ["an author with neither id nor handle", { ...carousel, author: { by: "handle", name: "Example" } }],
    [
      "a span past the end of the caption",
      { ...carousel, body: { text: "hi", entities: [{ kind: "hashtag", tag: "x", span: { start: 0, end: 9 } }] } },
    ],
    [
      "a tag positioned outside the item",
      {
        ...carousel,
        media: [{ kind: "image", tags: [{ account: { by: "handle", handle: "a" }, position: { x: 1.5, y: 0 } }] }],
      },
    ],
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
    const label = O.flatMap(readProfile(profile), ({ avatar }) =>
      O.flatMap(avatar, (picture) => Picture.largest(picture).label)
    );
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
    expect(O.map(unplaced, (text) => A.length(RichText.mentions(text)))).toEqual(O.some(1));
    expect(O.isSome(Account.cases.id.makeOption({ id: "7" }))).toBe(true);
  });
});

describe("a biography", () => {
  const read = S.decodeUnknownOption(RichTextFromString);
  const kinds = (text: string) => O.map(read(text), ({ entities }) => A.map(entities, ({ kind }) => kind));
  const sliced = (text: string) =>
    O.map(read(text), ({ entities }) =>
      A.flatMap(entities, ({ span }) => A.fromOption(O.map(span, ({ start, end }) => Str.slice(start, end)(text))))
    );

  it("finds hashtags, mentions and links in bare text, each at its span", () => {
    const text = "🌊 #vanlife w/ @jack.d — booking: https://shop.example/now. more: linktr.ee/jack";
    expect(kinds(text)).toStrictEqual(O.some(["hashtag", "mention", "link", "link"]));
    expect(sliced(text)).toStrictEqual(O.some(["#vanlife", "@jack.d", "https://shop.example/now", "linktr.ee/jack"]));
  });

  it("reads a bare host with a path as an https link", () => {
    const urls = O.map(read("linktr.ee/jack"), ({ entities }) =>
      A.map(A.filter(entities, TextEntity.guards.link), ({ url }) => url.href)
    );
    expect(urls).toStrictEqual(O.some(["https://linktr.ee/jack"]));
  });

  it("leaves addresses, abbreviations, numbers and a URL fragment as text", () => {
    expect(kinds("mail me@example.com, e.g. #1 fan, 24/7, a&#b")).toStrictEqual(O.some([]));
    expect(kinds("https://example.org/a#top @")).toStrictEqual(O.some(["link"]));
  });

  it("reads a host only where it is plainly one", () => {
    expect(sliced("Mr.Smith/Jones and v2.0/beta, site.com")).toStrictEqual(O.some([]));
    expect(sliced("see www.site.com, or Linktr.ee/jack.")).toStrictEqual(O.some(["www.site.com", "Linktr.ee/jack"]));
  });

  it("separates links and hashtags written without a space between them", () => {
    expect(sliced("https://x.com/jack,https://x.com/jill")).toStrictEqual(
      O.some(["https://x.com/jack", "https://x.com/jill"])
    );
    expect(sliced("#tag1#tag2 abc#def")).toStrictEqual(O.some(["#tag1", "#tag2"]));
  });

  it("reads a handle up to a doubled separator and skips an address of another network", () => {
    expect(sliced("@a..b @jack_ @jack's @jack.")).toStrictEqual(O.some(["@a", "@jack_", "@jack", "@jack"]));
    expect(sliced("@jack@mastodon.social")).toStrictEqual(O.some([]));
  });

  it("prints the text it was read from", () => {
    const text = "#a @b https://example.org/c";
    expect(O.flatMap(read(text), S.encodeOption(RichTextFromString))).toStrictEqual(O.some(text));
  });

  it("answers the same questions as a caption", () => {
    const bio = read("#bitcoin and #nostr with @jack, see https://x.com/jack/status/20");
    expect(O.map(bio, RichText.hashtags)).toStrictEqual(O.some(["bitcoin", "nostr"]));
    expect(O.map(bio, (text) => A.map(RichText.mentions(text), handleOf))).toStrictEqual(O.some([O.some("jack")]));
    expect(O.map(bio, (text) => A.map(RichText.linked(text), ({ platform }) => platform))).toStrictEqual(O.some(["x"]));
  });
});

describe("the links of a profile", () => {
  const decoded = S.decodeOption(Profile)({
    source: "https://www.instagram.com/example/",
    account: { by: "handle", handle: "example" },
    bio: {
      text: "snap + ig",
      entities: [
        { kind: "link", url: "https://www.snapchat.com/add/example" },
        { kind: "link", url: "https://instagram.com/example?igsh=abc" },
        { kind: "link", url: "https://shop.example/" },
      ],
    },
    links: [
      { url: "https://shop.example/", title: "Shop" },
      { url: "https://twitter.com/example/status/20" },
      { url: "https://www.threads.net/@example" },
      { url: "https://linktr.ee/example" },
    ],
  });
  const printed = S.encodeOption(LocatorFromUrl);

  it("lists link slots before biography links and each URL once", () => {
    expect(O.map(decoded, (p) => A.map(Profile.outbound(p), ({ hostname }) => hostname))).toStrictEqual(
      O.some(["shop.example", "twitter.com", "www.threads.net", "linktr.ee", "www.snapchat.com", "instagram.com"])
    );
  });

  it("treats one account written in two cases as one account", () => {
    const mixed = S.decodeOption(Profile)({
      source: "https://www.instagram.com/example/reels",
      account: { by: "handle", handle: "example" },
      links: [
        { url: "https://instagram.com/Example" },
        { url: "https://x.com/Example" },
        { url: "https://twitter.com/example/media" },
      ],
    });
    expect(
      O.map(mixed, (p) => A.flatMap(Profile.elsewhere(p), (locator) => A.fromOption(printed(locator))))
    ).toStrictEqual(O.some(["https://x.com/example"]));
  });

  it("names the accounts those links lead to, without the profile itself", () => {
    expect(
      O.map(decoded, (p) => A.flatMap(Profile.elsewhere(p), (locator) => A.fromOption(printed(locator))))
    ).toStrictEqual(
      O.some(["https://x.com/example", "https://www.threads.com/@example", "https://www.snapchat.com/@example"])
    );
  });
});
