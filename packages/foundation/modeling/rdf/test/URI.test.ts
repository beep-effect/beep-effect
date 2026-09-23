import {
  AbsoluteURI,
  areUrisEquivalent,
  normalizeUriReference,
  RelativeURIReference,
  resolveUriReference,
  URI,
  URIReference,
} from "@beep/rdf/Uri";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";

const decodeUri = S.decodeUnknownEffect(URI);
const decodeAbsoluteUri = S.decodeUnknownEffect(AbsoluteURI);
const decodeUriReference = S.decodeUnknownEffect(URIReference);
const decodeRelativeUriReference = S.decodeUnknownEffect(RelativeURIReference);

describe("URI", () => {
  it.effect("accepts representative absolute and relative URI forms", () =>
    Effect.gen(function* () {
      expect(yield* decodeUri("https://example.com/path?q=1#frag")).toBe("https://example.com/path?q=1#frag");
      expect(yield* decodeAbsoluteUri("mailto:user@example.com")).toBe("mailto:user@example.com");
      expect(yield* decodeUriReference("../child?q=1")).toBe("../child?q=1");
      expect(yield* decodeRelativeUriReference("../child?q=1")).toBe("../child?q=1");
    })
  );

  it("normalizes scheme, host, default ports, and unreserved percent encoding", () => {
    expect(normalizeUriReference("HTTPS://Example.com:443/%7Ealice?q=%41#%7e")).toBe(
      "https://example.com/~alice?q=A#~"
    );
  });

  it("resolves relative URI references against an absolute base", () => {
    expect(resolveUriReference("https://example.com/root/base/", "../next?id=1")).toBe(
      "https://example.com/root/next?id=1"
    );
  });

  it("compares URIs by normalized equivalence", () => {
    expect(areUrisEquivalent("https://example.com:443/%7Ealice", "https://example.com/~alice")).toBe(true);
    expect(areUrisEquivalent("https://example.com/a", "https://example.com/b")).toBe(false);
  });

  it.effect("rejects malformed absolute and relative URI values", () =>
    Effect.gen(function* () {
      const invalidAbsolute = yield* Effect.exit(decodeAbsoluteUri("folder/child"));
      expect(Exit.isFailure(invalidAbsolute)).toBe(true);
      if (Exit.isFailure(invalidAbsolute)) {
        expect(Cause.pretty(invalidAbsolute.cause)).toContain("Expected a valid RFC 3986 absolute URI");
      }

      const leadingWhitespace = yield* Effect.exit(decodeUri(" https://example.com"));
      expect(Exit.isFailure(leadingWhitespace)).toBe(true);
      if (Exit.isFailure(leadingWhitespace)) {
        expect(Cause.pretty(leadingWhitespace.cause)).toContain(
          "URI values must not contain leading or trailing whitespace"
        );
      }

      const invalidRelative = yield* Effect.exit(decodeRelativeUriReference("scheme://example.com"));
      expect(Exit.isFailure(invalidRelative)).toBe(true);
      if (Exit.isFailure(invalidRelative)) {
        expect(Cause.pretty(invalidRelative.cause)).toContain("Expected a valid RFC 3986 relative URI reference");
      }
    })
  );
});

describe("schema-derived arbitraries", () => {
  it("only generates RFC 3986 URI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(URI);
  });

  it("only generates RFC 3986 AbsoluteURI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(AbsoluteURI);
  });

  it("only generates RFC 3986 URIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(URIReference);
  });

  it("only generates RFC 3986 RelativeURIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(RelativeURIReference);
  });
});
