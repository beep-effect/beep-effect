import { fcRuns } from "@beep/fc-runs";
import { RegExpFromStr, RegExpStr } from "@beep/schema/RegExp";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
      const failure1 = yield* Effect.exit(decodeUnknownRegExpStrEffect("("));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected a valid regular expression pattern string"
        );
      }
      const failure2 = yield* Effect.exit(decodeUnknownRegExpStrEffect("["));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected a valid regular expression pattern string"
        );
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
      const failure3 = yield* Effect.exit(decodeUnknownRegExpFromStrEffect("("));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected a valid regular expression pattern string"
        );
      }
    })
  );

  it.effect(
    "rejects non-string unknown input with the source schema error",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.exit(decodeUnknownRegExpFromStrEffect(1));
      pipe(failure4, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure4)) {
        expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected @beep/schema/RegExp/RegExpStr"
        );
      }
    })
  );

  it.effect(
    "forbids encoding RegExp values back to the original pattern string",
    Effect.fnUntraced(function* () {
      const failure5 = yield* Effect.exit(encodeRegExpFromStrEffect(/abc/));
      pipe(failure5, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
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
