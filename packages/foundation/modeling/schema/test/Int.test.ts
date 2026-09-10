import { fcRuns } from "@beep/fc-runs";
import { Int64, Int64FromString, isInt64 } from "@beep/schema/Int";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeInt64 = S.decodeEffect(Int64);
const decodeUnknownInt64 = S.decodeUnknownEffect(Int64);
const decodeUnknownInt64FromString = S.decodeUnknownEffect(Int64FromString);
const encodeInt64FromString = S.encodeEffect(Int64FromString);
const isInt642 = S.is(Int64);

const int64Minimum = -BigInt("9223372036854775808");
const int64Maximum = BigInt("9223372036854775807");
const Int64Arbitrary = Arbitrary.schema(Int64);
const SignedInt64 = S.BigInt.check(isInt64());
const decodeSignedInt64 = S.decodeUnknownEffect(SignedInt64);

describe("Int64", () => {
  it.effect(
    "accepts signed 64-bit BigInt boundaries",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownInt64(int64Minimum)).toBe(int64Minimum);
      expect(yield* decodeUnknownInt64(BigInt(0))).toBe(BigInt(0));
      expect(yield* decodeUnknownInt64(int64Maximum)).toBe(int64Maximum);
    })
  );

  it.effect(
    "rejects values outside the signed 64-bit range",
    Effect.fnUntraced(function* () {
      const belowMinimum = yield* Effect.exit(decodeUnknownInt64(int64Minimum - BigInt(1)));
      const aboveMaximum = yield* Effect.exit(decodeUnknownInt64(int64Maximum + BigInt(1)));

      expect(Exit.isFailure(belowMinimum)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it.effect(
    "rejects JavaScript numbers instead of silently narrowing them",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(decodeUnknownInt64(Number.MAX_SAFE_INTEGER));

      expect(Exit.isFailure(decoded)).toBe(true);
    })
  );

  it.effect(
    "exposes the reusable signed int64 refinement",
    Effect.fnUntraced(function* () {
      expect(yield* decodeSignedInt64(int64Maximum)).toBe(int64Maximum);
      expect(Exit.isFailure(yield* Effect.exit(decodeSignedInt64(int64Maximum + BigInt(1))))).toBe(true);
    })
  );

  it("derives schema arbitrary values inside the signed 64-bit range", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Int64Arbitrary]),
          ([value]) => {
            expect(isInt642(value)).toBe(true);
            expect(value >= int64Minimum).toBe(true);
            expect(value <= int64Maximum).toBe(true);

            return true;
          },
          fcRuns(100)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});

describe("Int64FromString", () => {
  it.effect(
    "decodes decimal strings into signed 64-bit BigInts",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownInt64FromString("-9223372036854775808")).toBe(int64Minimum);
      expect(yield* decodeUnknownInt64FromString("0")).toBe(BigInt(0));
      expect(yield* decodeUnknownInt64FromString("9223372036854775807")).toBe(int64Maximum);
    })
  );

  it.effect(
    "encodes signed 64-bit BigInts back to decimal strings",
    Effect.fnUntraced(function* () {
      const value = yield* decodeInt64(int64Maximum);

      expect(yield* encodeInt64FromString(value)).toBe("9223372036854775807");
    })
  );

  it.effect(
    "rejects malformed and out-of-range decimal strings",
    Effect.fnUntraced(function* () {
      const decimal = yield* Effect.exit(decodeUnknownInt64FromString("1.5"));
      const belowMinimum = yield* Effect.exit(decodeUnknownInt64FromString("-9223372036854775809"));
      const aboveMaximum = yield* Effect.exit(decodeUnknownInt64FromString("9223372036854775808"));

      expect(Exit.isFailure(decimal)).toBe(true);
      expect(Exit.isFailure(belowMinimum)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );
});
