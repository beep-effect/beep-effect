import { fcRuns } from "@beep/fc-runs";
import { RegExpFromStr, RegExpStr } from "@beep/schema/RegExp";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownRegExpFromStrSync = S.decodeUnknownSync(RegExpFromStr);
const decodeUnknownRegExpStrSync = S.decodeUnknownSync(RegExpStr);
const encodeRegExpFromStrSync = S.encodeSync(RegExpFromStr);
const isRegExpStr = S.is(RegExpStr);
const isRegExp = S.is(S.RegExp);

describe("RegExpStr", () => {
  it("accepts valid pattern strings without transforming them", () => {
    expect(decodeUnknownRegExpStrSync("abc")).toBe("abc");
    expect(decodeUnknownRegExpStrSync("^foo(bar)?$")).toBe("^foo(bar)?$");
    expect(decodeUnknownRegExpStrSync("")).toBe("");
  });

  it("rejects invalid pattern strings", () => {
    expect(() => decodeUnknownRegExpStrSync("(")).toThrow("Expected a valid regular expression pattern string");
    expect(() => decodeUnknownRegExpStrSync("[")).toThrow("Expected a valid regular expression pattern string");
  });

  it("every schema-derived value is a valid pattern that decodes to itself", () => {
    const arbitrary = S.toArbitrary(RegExpStr)(fc);

    fc.assert(
      fc.property(arbitrary, (value) => {
        new globalThis.RegExp(value);
        return isRegExpStr(value) && decodeUnknownRegExpStrSync(value) === value;
      }),
      fcRuns(50)
    );
  });
});

describe("RegExpFromStr", () => {
  it("decodes RegExpStr values into RegExp instances", () => {
    const decoded = decodeUnknownRegExpFromStrSync("^foo(bar)?$");

    expect(decoded).toBeInstanceOf(RegExp);
    expect(isRegExp(decoded)).toBe(true);
    expect(decoded.source).toBe("^foo(bar)?$");
    expect(decoded.flags).toBe("");
  });

  it("preserves source schema validation failures", () => {
    expect(() => decodeUnknownRegExpFromStrSync("(")).toThrow("Expected a valid regular expression pattern string");
  });

  it("rejects non-string unknown input with the source schema error", () => {
    expect(() => decodeUnknownRegExpFromStrSync(1)).toThrow("Expected @beep/schema/RegExp/RegExpStr");
  });

  it("forbids encoding RegExp values back to the original pattern string", () => {
    expect(() => encodeRegExpFromStrSync(/abc/)).toThrow(
      "Encoding RegExpFromStr back to the original pattern string is not supported"
    );
  });

  it("every schema-derived value is a RegExp instance", () => {
    const arbitrary = S.toArbitrary(RegExpFromStr)(fc);

    fc.assert(
      fc.property(arbitrary, (value) => value instanceof RegExp && isRegExp(value)),
      fcRuns(50)
    );
  });
});
