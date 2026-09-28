import {
  AbsoluteURI,
  areUrisEquivalent,
  normalizeUriReference,
  RelativeURIReference,
  resolveUriReference,
  URI,
  URIReference,
} from "@beep/rdf/Uri";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const URIDecodeEffect = S.decodeEffect(URI);
const URIIs = S.is(URI);
const URIToEquivalence = S.toEquivalence(URI);
const AbsoluteURIDecodeEffect = S.decodeEffect(AbsoluteURI);
const AbsoluteURIIs = S.is(AbsoluteURI);
const AbsoluteURIToEquivalence = S.toEquivalence(AbsoluteURI);
const URIReferenceDecodeEffect = S.decodeEffect(URIReference);
const URIReferenceIs = S.is(URIReference);
const URIReferenceToEquivalence = S.toEquivalence(URIReference);
const RelativeURIReferenceDecodeEffect = S.decodeEffect(RelativeURIReference);
const RelativeURIReferenceIs = S.is(RelativeURIReference);
const RelativeURIReferenceToEquivalence = S.toEquivalence(RelativeURIReference);
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
    pipe(areUrisEquivalent("https://example.com:443/%7Ealice", "https://example.com/~alice"), assertTrue);
    pipe(areUrisEquivalent("https://example.com/a", "https://example.com/b"), assertFalse);
  });

  it.effect("rejects malformed absolute and relative URI values", () =>
    Effect.gen(function* () {
      const invalidAbsolute = yield* Effect.exit(decodeAbsoluteUri("folder/child"));
      pipe(invalidAbsolute, Exit.isFailure, assertTrue);
      if (Exit.isFailure(invalidAbsolute)) {
        expect(Cause.pretty(invalidAbsolute.cause)).toContain("Expected a valid RFC 3986 absolute URI");
      }

      const leadingWhitespace = yield* Effect.exit(decodeUri(" https://example.com"));
      pipe(leadingWhitespace, Exit.isFailure, assertTrue);
      if (Exit.isFailure(leadingWhitespace)) {
        expect(Cause.pretty(leadingWhitespace.cause)).toContain(
          "URI values must not contain leading or trailing whitespace"
        );
      }

      const invalidRelative = yield* Effect.exit(decodeRelativeUriReference("scheme://example.com"));
      pipe(invalidRelative, Exit.isFailure, assertTrue);
      if (Exit.isFailure(invalidRelative)) {
        expect(Cause.pretty(invalidRelative.cause)).toContain("Expected a valid RFC 3986 relative URI reference");
      }
    })
  );
});

describe("schema-derived arbitraries", () => {
  it.effect.prop(
    "only generates RFC 3986 URI values that decode to themselves",
    [Arbitrary.schema(URI)],
    ([value]) => Effect.map(URIDecodeEffect(value), (decoded) => URIIs(value) && URIToEquivalence(decoded, value)),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3986 AbsoluteURI values that decode to themselves",
    [Arbitrary.schema(AbsoluteURI)],
    ([value]) =>
      Effect.map(
        AbsoluteURIDecodeEffect(value),
        (decoded) => AbsoluteURIIs(value) && AbsoluteURIToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3986 URIReference values that decode to themselves",
    [Arbitrary.schema(URIReference)],
    ([value]) =>
      Effect.map(
        URIReferenceDecodeEffect(value),
        (decoded) => URIReferenceIs(value) && URIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3986 RelativeURIReference values that decode to themselves",
    [Arbitrary.schema(RelativeURIReference)],
    ([value]) =>
      Effect.map(
        RelativeURIReferenceDecodeEffect(value),
        (decoded) => RelativeURIReferenceIs(value) && RelativeURIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );
});
