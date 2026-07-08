import { Int64, Int64FromString, isInt64 } from "@beep/schema/Int";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const int64Minimum = -BigInt("9223372036854775808");
const int64Maximum = BigInt("9223372036854775807");
const Int64Arbitrary = S.toArbitrary(Int64);

describe("Int64", () => {
  const decode = S.decodeUnknownEffect(Int64);

  it.effect("accepts signed 64-bit BigInt boundaries", () =>
    Effect.gen(function* () {
      expect(yield* decode(int64Minimum)).toBe(int64Minimum);
      expect(yield* decode(BigInt(0))).toBe(BigInt(0));
      expect(yield* decode(int64Maximum)).toBe(int64Maximum);
    })
  );

  it.effect("rejects values outside the signed 64-bit range", () =>
    Effect.gen(function* () {
      const belowMinimum = yield* Effect.exit(decode(int64Minimum - BigInt(1)));
      const aboveMaximum = yield* Effect.exit(decode(int64Maximum + BigInt(1)));

      expect(Exit.isFailure(belowMinimum)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );

  it.effect("rejects JavaScript numbers instead of silently narrowing them", () =>
    Effect.gen(function* () {
      const decoded = yield* Effect.exit(decode(Number.MAX_SAFE_INTEGER));

      expect(Exit.isFailure(decoded)).toBe(true);
    })
  );

  it.effect("exposes the reusable signed int64 refinement", () =>
    Effect.gen(function* () {
      const SignedInt64 = S.BigInt.check(isInt64());
      const decodeSignedInt64 = S.decodeUnknownEffect(SignedInt64);

      expect(yield* decodeSignedInt64(int64Maximum)).toBe(int64Maximum);
      expect(Exit.isFailure(yield* Effect.exit(decodeSignedInt64(int64Maximum + BigInt(1))))).toBe(true);
    })
  );

  it("derives schema arbitrary values inside the signed 64-bit range", () => {
    const isSignedInt64 = S.is(Int64);

    fc.assert(
      fc.property(Int64Arbitrary, (value) => {
        expect(isSignedInt64(value)).toBe(true);
        expect(value >= int64Minimum).toBe(true);
        expect(value <= int64Maximum).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Int64FromString", () => {
  const decode = S.decodeUnknownEffect(Int64FromString);
  const encode = S.encodeEffect(Int64FromString);

  it.effect("decodes decimal strings into signed 64-bit BigInts", () =>
    Effect.gen(function* () {
      expect(yield* decode("-9223372036854775808")).toBe(int64Minimum);
      expect(yield* decode("0")).toBe(BigInt(0));
      expect(yield* decode("9223372036854775807")).toBe(int64Maximum);
    })
  );

  it.effect("encodes signed 64-bit BigInts back to decimal strings", () =>
    Effect.gen(function* () {
      const value = yield* S.decodeUnknownEffect(Int64)(int64Maximum);

      expect(yield* encode(value)).toBe("9223372036854775807");
    })
  );

  it.effect("rejects malformed and out-of-range decimal strings", () =>
    Effect.gen(function* () {
      const decimal = yield* Effect.exit(decode("1.5"));
      const belowMinimum = yield* Effect.exit(decode("-9223372036854775809"));
      const aboveMaximum = yield* Effect.exit(decode("9223372036854775808"));

      expect(Exit.isFailure(decimal)).toBe(true);
      expect(Exit.isFailure(belowMinimum)).toBe(true);
      expect(Exit.isFailure(aboveMaximum)).toBe(true);
    })
  );
});
