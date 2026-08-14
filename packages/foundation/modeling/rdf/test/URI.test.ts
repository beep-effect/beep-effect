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
import * as S from "effect/Schema";

const decodeUri = S.decodeUnknownSync(URI);
const decodeAbsoluteUri = S.decodeUnknownSync(AbsoluteURI);
const decodeUriReference = S.decodeUnknownSync(URIReference);
const decodeRelativeUriReference = S.decodeUnknownSync(RelativeURIReference);

describe("URI", () => {
  it("accepts representative absolute and relative URI forms", () => {
    expect(decodeUri("https://example.com/path?q=1#frag")).toBe("https://example.com/path?q=1#frag");
    expect(decodeAbsoluteUri("mailto:user@example.com")).toBe("mailto:user@example.com");
    expect(decodeUriReference("../child?q=1")).toBe("../child?q=1");
    expect(decodeRelativeUriReference("../child?q=1")).toBe("../child?q=1");
  });

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

  it("rejects malformed absolute and relative URI values", () => {
    expect(() => decodeAbsoluteUri("folder/child")).toThrow("Expected a valid RFC 3986 absolute URI");
    expect(() => decodeUri(" https://example.com")).toThrow(
      "URI values must not contain leading or trailing whitespace"
    );
    expect(() => decodeRelativeUriReference("scheme://example.com")).toThrow(
      "Expected a valid RFC 3986 relative URI reference"
    );
  });
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
