import { RegExpFromStr, RegExpStr } from "@beep/schema/RegExp";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("RegExpStr", () => {
  const decode = S.decodeUnknownSync(RegExpStr);

  it("accepts valid pattern strings without transforming them", () => {
    expect(decode("abc")).toBe("abc");
    expect(decode("^foo(bar)?$")).toBe("^foo(bar)?$");
    expect(decode("")).toBe("");
  });

  it("rejects invalid pattern strings", () => {
    expect(() => decode("(")).toThrow("Expected a valid regular expression pattern string");
    expect(() => decode("[")).toThrow("Expected a valid regular expression pattern string");
  });

  it("every schema-derived value is a valid pattern that decodes to itself", () => {
    const arbitrary = S.toArbitrary(RegExpStr);

    fc.assert(
      fc.property(arbitrary, (value) => {
        new globalThis.RegExp(value);
        return S.is(RegExpStr)(value) && decode(value) === value;
      }),
      fcRuns(50)
    );
  });
});

describe("RegExpFromStr", () => {
  const decode = S.decodeUnknownSync(RegExpFromStr);
  const encode = S.encodeSync(RegExpFromStr);

  it("decodes RegExpStr values into RegExp instances", () => {
    const decoded = decode("^foo(bar)?$");

    expect(decoded).toBeInstanceOf(RegExp);
    expect(S.is(S.RegExp)(decoded)).toBe(true);
    expect(decoded.source).toBe("^foo(bar)?$");
    expect(decoded.flags).toBe("");
  });

  it("preserves source schema validation failures", () => {
    expect(() => decode("(")).toThrow("Expected a valid regular expression pattern string");
  });

  it("rejects non-string unknown input with the source schema error", () => {
    expect(() => decode(1)).toThrow("Expected @beep/schema/RegExp/RegExpStr, got 1");
  });

  it("forbids encoding RegExp values back to the original pattern string", () => {
    expect(() => encode(/abc/)).toThrow("Encoding RegExpFromStr back to the original pattern string is not supported");
  });

  it("every schema-derived value is a RegExp instance", () => {
    const arbitrary = S.toArbitrary(RegExpFromStr);

    fc.assert(
      fc.property(arbitrary, (value) => value instanceof RegExp && S.is(S.RegExp)(value)),
      fcRuns(50)
    );
  });
});
