import { AtUri } from "@beep/schema/AtURI";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const AtUriArbitrary = S.toArbitrary(AtUri);
const decodeAtUri = S.decodeUnknownEffect(AtUri);

const validAtUriExamples = [
  "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz",
  "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post",
  "at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3jui7kd54zh2y",
  "at://did:web:example.com/app.bsky.feed.post/self",
  "at://did:example:abc%2Fdef/app.bsky.feed.post/A_B-1~z",
  "at://alice.example.com/app.bsky.feed.post/2026-06-29T12:34:56.000Z",
  "at://sub.alice.example.com/com.atproto.repo.strongRef/self",
  "at://alice.example.com/app.bsky.feed.Post/self",
];

const invalidAtUriExamples = [
  "",
  "at://",
  "AT://alice.example.com/app.bsky.feed.post/self",
  "at://Alice.example.com/app.bsky.feed.post/self",
  "at://alice.example.com/",
  "at://alice.example.com//self",
  "at://alice.example.com/app.bsky.feed.post/",
  "at://alice.example.com/app.bsky.feed.post/self/extra",
  "at://alice.example.com/app.bsky.feed.post/self?via=feed",
  "at://alice.example.com/app.bsky.feed.post/self#fragment",
  "at://alice.example.com/app.bsky",
  "at://alice.example.com/app.bsky.feed.post/.",
  "at://alice.example.com/app.bsky.feed.post/..",
  "at://alice.example.com/app.bsky.feed.post/key%2Fpart",
  "at://alice.test./app.bsky.feed.post/self",
  "at://-alice.example.com/app.bsky.feed.post/self",
  "at://alice.example.123/app.bsky.feed.post/self",
  "at://did:m123:val/app.bsky.feed.post/self",
  "at://did:plc:/app.bsky.feed.post/self",
  "at://did:plc:abc%2fdef/app.bsky.feed.post/self",
  "at://did:plc:abc%41def/app.bsky.feed.post/self",
  "at://did:example:abc%252Fdef/app.bsky.feed.post/self",
  "at://did:plc:abc/path/app.bsky.feed.post/self",
];

describe("AtUri", () => {
  it.effect("accepts normalized Lexicon AT URI references", () =>
    Effect.forEach(
      validAtUriExamples,
      (candidate) =>
        Effect.gen(function* () {
          expect(yield* decodeAtUri(candidate)).toBe(candidate);
        }),
      { discard: true }
    )
  );

  it.effect("rejects broader URI forms and malformed AT Protocol components", () =>
    Effect.forEach(
      invalidAtUriExamples,
      (candidate) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(decodeAtUri(candidate));

          expect(error.message).toContain("AT URI");
        }),
      { discard: true }
    )
  );

  it("derives schema arbitrary values that remain normalized Lexicon AT URIs", () => {
    const isAtUri = S.is(AtUri);

    fc.assert(
      fc.property(AtUriArbitrary, (uri) => {
        const withoutScheme = uri.slice("at://".length);
        const pathSegments = withoutScheme.split("/");

        expect(isAtUri(uri)).toBe(true);
        expect(uri.startsWith("at://")).toBe(true);
        expect(uri).not.toMatch(/[?#]/u);
        expect(uri.endsWith("/")).toBe(false);
        expect(pathSegments.length).toBeLessThanOrEqual(3);
        expect(pathSegments.every((segment) => segment.length > 0)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
