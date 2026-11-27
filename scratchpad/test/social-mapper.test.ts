import { Instagram, InstagramMapper, YouTubeMapper, SocialPlatform, socialMapperLayer, socialMappers } from "@beep/scratchpad/int/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const decode = S.decodeUnknownOption(SocialPlatform);
const encode = S.encodeOption(SocialPlatform);
const mapper = new Instagram();
const legacy = {
  baseUrl: "https://example.org",
  profileRoutes: ["/profile.php?id={userId}"],
  landingSection: {
    key: "posts",
    mediaFormats: ["Image"],
    detailRoutes: ["/p/{contentId}/?view={galleryIndex}&view=all"],
  },
};

describe("social mapper catalog", () => {
  it("preserves repeated query keys and encodes path and query bindings independently", () => {
    const metadata = O.getOrThrow(decode(legacy));
    const detail = A.headNonEmpty(metadata.profileRoutes);
    expect(O.getOrThrow(mapper.map(detail, { userId: "a&b" })).search).toBe("?id=a%26b");
    const gallery = O.getOrThrow(A.head(metadata.landingSection.detailRoutes));
    const url = O.getOrThrow(mapper.map(gallery, { contentId: "a/b", galleryIndex: "2 & 3" }));
    expect(url.pathname).toBe("/p/a%2Fb/");
    expect(url.searchParams.getAll("view")).toEqual(["2 & 3", "all"]);
    expect(O.isNone(metadata.logoUrl)).toBe(true);
  });

  it("rejects unresolved bindings, traversal segments and malformed Unicode", () => {
    const route = A.headNonEmpty(mapper.metadata.profileRoutes);
    for (const username of ["", ".", "..", "\uD800"]) {
      expect(O.isNone(mapper.map(route, { username }))).toBe(true);
    }
    expect(O.isNone(mapper.map(route, {}))).toBe(true);
    expect(O.isNone(decode({ ...legacy, profileRoutes: ["/{missing}"] }))).toBe(true);
    expect(O.isNone(decode({ ...legacy, profileRoutes: ["/{contentId}"] }))).toBe(true);
  });

  it("round-trips all registered platforms and preserves the landing route", () => {
    for (const { metadata } of R.values(socialMappers)) {
      const encoded = O.getOrThrow(encode(metadata));
      const decoded = O.getOrThrow(decode(encoded));
      expect(O.getOrThrow(encode(decoded))).toEqual(encoded);
      expect(decoded.contentRoutes[0].template).toEqual(decoded.profileRoutes[0]);
    }
  });
});

describe("platform mapper services", () => {
  const mapProfiles = Effect.gen(function* () {
    const instagram = yield* InstagramMapper;
    const youtube = yield* YouTubeMapper;
    return {
      instagram: instagram.map(instagram.metadata.profileRoutes[0], { username: "example" }),
      youtube: youtube.map(youtube.metadata.profileRoutes[0], { handle: "example" }),
    };
  });

  it("resolves concrete platform implementations from the catalog layer", () => {
    const urls = Effect.runSync(Effect.provide(mapProfiles, socialMapperLayer));
    expect(O.getOrThrow(urls.instagram).href).toBe("https://www.instagram.com/example/");
    expect(O.getOrThrow(urls.youtube).href).toBe("https://www.youtube.com/@example");
  });

  it("can replace the Instagram mapper independently of YouTube", () => {
    const substitute = Layer.succeed(InstagramMapper, {
      _tag: "Instagram",
      metadata: mapper.metadata,
      map: O.none,
    });
    const urls = Effect.runSync(Effect.provide(mapProfiles, Layer.merge(substitute, YouTubeMapper.layer)));
    expect(O.isNone(urls.instagram)).toBe(true);
    expect(O.getOrThrow(urls.youtube).href).toBe("https://www.youtube.com/@example");
  });
});
