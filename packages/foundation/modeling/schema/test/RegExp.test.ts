import { fcRuns } from "@beep/fc-runs";
import { RegExpFromStr, RegExpStr } from "@beep/schema/RegExp";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownRegExpFromStrEffect = S.decodeUnknownEffect(RegExpFromStr);
const decodeUnknownRegExpStrEffect = S.decodeUnknownEffect(RegExpStr);
const encodeRegExpFromStrEffect = S.encodeEffect(RegExpFromStr);
const isRegExpStr = S.is(RegExpStr);
const isRegExp = S.is(S.RegExp);

describe("RegExpStr", () => {
  it.effect(
    "accepts valid pattern strings without transforming them",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownRegExpStrEffect("abc")).toBe("abc");
      expect(yield* decodeUnknownRegExpStrEffect("^foo(bar)?$")).toBe("^foo(bar)?$");
      expect(yield* decodeUnknownRegExpStrEffect("")).toBe("");
    })
  );

  it.effect(
    "rejects invalid pattern strings",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownRegExpStrEffect("("));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected a valid regular expression pattern string");
      }
      const failure2 = yield* Effect.result(decodeUnknownRegExpStrEffect("["));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Expected a valid regular expression pattern string");
      }
    })
  );

  {
    const arbitrary = Arbitrary.schema(RegExpStr);
    it.effect.prop(
      "every schema-derived value is a valid pattern that decodes to itself",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        new globalThis.RegExp(value);
        return isRegExpStr(value) && (yield* decodeUnknownRegExpStrEffect(value)) === value;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});

describe("RegExpFromStr", () => {
  it.effect(
    "decodes RegExpStr values into RegExp instances",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeUnknownRegExpFromStrEffect("^foo(bar)?$");

      expect(decoded).toBeInstanceOf(RegExp);
      expect(isRegExp(decoded)).toBe(true);
      expect(decoded.source).toBe("^foo(bar)?$");
      expect(decoded.flags).toBe("");
    })
  );

  it.effect(
    "preserves source schema validation failures",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.result(decodeUnknownRegExpFromStrEffect("("));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("Expected a valid regular expression pattern string");
      }
    })
  );

  it.effect(
    "rejects non-string unknown input with the source schema error",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.result(decodeUnknownRegExpFromStrEffect(1));
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain("Expected @beep/schema/RegExp/RegExpStr");
      }
    })
  );

  it.effect(
    "forbids encoding RegExp values back to the original pattern string",
    Effect.fnUntraced(function* () {
      const failure5 = yield* Effect.result(encodeRegExpFromStrEffect(/abc/));
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain(
          "Encoding RegExpFromStr back to the original pattern string is not supported"
        );
      }
    })
  );

  {
    const arbitrary = Arbitrary.schema(RegExpFromStr);
    it.effect.prop(
      "every schema-derived value is a RegExp instance",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        return value instanceof RegExp && isRegExp(value);
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
