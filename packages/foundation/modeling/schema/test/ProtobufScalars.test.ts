import { fcRuns } from "@beep/fc-runs";
import { Double } from "@beep/schema/Double";
import { Fixed64 } from "@beep/schema/Fixed64";
import { Float } from "@beep/schema/Float";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";

const decodeUnknownDouble = S.decodeUnknownEffect(Double);
const decodeUnknownFixed64 = S.decodeUnknownEffect(Fixed64);
const decodeUnknownFloat = S.decodeUnknownEffect(Float);
const isDouble2 = S.is(Double);
const isFixed642 = S.is(Fixed64);
const isFloat2 = S.is(Float);

const floatMinimum = -3.4028234663852886e38;
const floatMaximum = 3.4028234663852886e38;
const uint64Minimum = BigInt(0);
const uint64Maximum = BigInt("18446744073709551615");

const makeLongLike = (value: string, unsigned = false) => ({
  high: 0,
  low: 0,
  toString: () => value,
  unsigned,
});

const isProtobufFloatValue = (value: number) =>
  globalThis.Number.isNaN(value) ||
  value === globalThis.Number.POSITIVE_INFINITY ||
  value === globalThis.Number.NEGATIVE_INFINITY ||
  (globalThis.Number.isFinite(value) && value >= floatMinimum && value <= floatMaximum);

// Every BigInt consumer shares this boundary with the global coercion spy.
describe("protobuf scalar schemas", { concurrent: false }, () => {
  describe("protobuf floating-point scalar schemas", () => {
    it.effect(
      "accepts protobuf float and double boundaries",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownFloat(floatMinimum)).toBe(floatMinimum);
        expect(yield* decodeUnknownFloat(0.5)).toBe(0.5);
        expect(yield* decodeUnknownFloat(floatMaximum)).toBe(floatMaximum);
        expect(globalThis.Number.isNaN(yield* decodeUnknownFloat(globalThis.Number.NaN))).toBe(true);
        expect(yield* decodeUnknownFloat(globalThis.Number.POSITIVE_INFINITY)).toBe(
          globalThis.Number.POSITIVE_INFINITY
        );
        expect(yield* decodeUnknownFloat(globalThis.Number.NEGATIVE_INFINITY)).toBe(
          globalThis.Number.NEGATIVE_INFINITY
        );
        expect(yield* decodeUnknownDouble(-globalThis.Number.MAX_VALUE)).toBe(-globalThis.Number.MAX_VALUE);
        expect(yield* decodeUnknownDouble(globalThis.Number.MAX_VALUE)).toBe(globalThis.Number.MAX_VALUE);
        expect(globalThis.Number.isNaN(yield* decodeUnknownDouble(globalThis.Number.NaN))).toBe(true);
        expect(yield* decodeUnknownDouble(globalThis.Number.POSITIVE_INFINITY)).toBe(
          globalThis.Number.POSITIVE_INFINITY
        );
        expect(yield* decodeUnknownDouble(globalThis.Number.NEGATIVE_INFINITY)).toBe(
          globalThis.Number.NEGATIVE_INFINITY
        );
      })
    );

    it.effect(
      "rejects overflowing finite float values and non-number floating-point inputs",
      Effect.fnUntraced(function* () {
        pipe(yield* Effect.exit(decodeUnknownFloat(floatMaximum * 2)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFloat("NaN")), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownDouble("1.5")), Exit.isFailure, assertTrue);
      })
    );

    it.effect.prop(
      "derives protobuf float and double arbitraries from the schemas — Arbitrary.schema(Float)",
      [Arbitrary.schema(Float)],
      Effect.fnUntraced(function* ([value]) {
        expect(isFloat2(value)).toBe(true);
        expect(isProtobufFloatValue(value)).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
    it.effect.prop(
      "derives protobuf float and double arbitraries from the schemas — Arbitrary.schema(Double)",
      [Arbitrary.schema(Double)],
      Effect.fnUntraced(function* ([value]) {
        expect(isDouble2(value)).toBe(true);
        expect(typeof value).toBe("number");

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
  });

  describe("protobuf 64-bit integer scalar schemas", () => {
    it.effect(
      "accepts unsigned 64-bit protobuf bigint boundaries",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownFixed64(uint64Minimum)).toBe(uint64Minimum);
        expect(yield* decodeUnknownFixed64(uint64Maximum)).toBe(uint64Maximum);
      })
    );

    it.effect(
      "accepts protobufjs-compatible unsigned 64-bit input shapes",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownFixed64("42")).toBe(BigInt(42));
        expect(yield* decodeUnknownFixed64("18446744073709551615")).toBe(uint64Maximum);
        expect(yield* decodeUnknownFixed64(42)).toBe(BigInt(42));
        expect(yield* decodeUnknownFixed64(makeLongLike("18446744073709551615", true))).toBe(uint64Maximum);
      })
    );

    it.effect(
      "rejects out-of-range and invalid 64-bit values",
      Effect.fnUntraced(function* () {
        const unsafePositive64Number = Number.MAX_SAFE_INTEGER + 1;

        pipe(yield* Effect.exit(decodeUnknownFixed64(-BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(uint64Maximum + BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(1.5)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(unsafePositive64Number)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64("1.5")), Exit.isFailure, assertTrue);
      })
    );

    it.effect(
      "rejects invalid decimal inputs before BigInt conversion",
      Effect.fnUntraced(function* () {
        const oversizedDecimal = "184467440737095516150";
        const coerceDecimal = vi.fn(() => "42");
        const nonStringLongLike = {
          high: 0,
          low: 42,
          toString: () => ({ [Symbol.toPrimitive]: coerceDecimal }),
          unsigned: true,
        };
        const bigIntSpy = yield* Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(globalThis, "BigInt")),
          (spy) => Effect.sync(() => spy.mockRestore())
        );

        pipe(yield* Effect.exit(decodeUnknownFixed64(oversizedDecimal)), Exit.isFailure, assertTrue);
        pipe(
          yield* Effect.exit(decodeUnknownFixed64(makeLongLike(oversizedDecimal, true))),
          Exit.isFailure,
          assertTrue
        );
        pipe(yield* Effect.exit(decodeUnknownFixed64(nonStringLongLike)), Exit.isFailure, assertTrue);
        expect(coerceDecimal).not.toHaveBeenCalled();
        expect(bigIntSpy).not.toHaveBeenCalled();
      })
    );

    it.effect.prop(
      "derives valid unsigned 64-bit arbitraries from the schemas — Arbitrary.schema(Fixed64)",
      [Arbitrary.schema(Fixed64)],
      Effect.fnUntraced(function* ([value]) {
        expect(isFixed642(value)).toBe(true);
        expect(value >= uint64Minimum).toBe(true);
        expect(value <= uint64Maximum).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
  });

  describe("protobuf generation representations", () => {
    for (const schema of [Double, Float]) {
      it.effect(
        `encodes finite and special values through the ${schema === Double ? "Double" : "Float"} generation link`,
        () =>
          Effect.gen(function* () {
            const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(
              schema.ast
            ).annotations;
            const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
            if (link === undefined || link.transformation._tag !== "Transformation")
              throw new Error("Missing generation transformation");
            const codec = S.make<S.Codec<number, unknown>>(
              SchemaAST.decodeTo(link.to, SchemaAST.toType(schema.ast), link.transformation)
            );
            for (const value of [0, 1.25, -1.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
              const encoded = yield* S.encodeEffect(codec)(value);
              expect(encoded).toBe(Number.isFinite(value) ? value : String(value));
              expect(yield* S.decodeUnknownEffect(codec)(encoded)).toBe(value);
            }
          })
      );
      it.effect.prop(
        `round-trips generated values through the ${schema === Double ? "Double" : "Float"} generation link`,
        [Arbitrary.schema(schema)],
        Effect.fnUntraced(function* ([value]) {
          const annotations: S.Annotations.Declaration<unknown, []> | undefined = SchemaAST.toType(
            schema.ast
          ).annotations;
          const link = annotations?.toCodecArbitrary?.({ typeParameters: [], constraint: undefined });
          if (link === undefined || link.transformation._tag !== "Transformation")
            throw new Error("Missing generation transformation");
          const codec = S.make<S.Codec<number, unknown>>(
            SchemaAST.decodeTo(link.to, SchemaAST.toType(schema.ast), link.transformation)
          );

          const encoded = yield* S.encodeEffect(codec)(value);
          expect(yield* S.decodeUnknownEffect(codec)(encoded)).toBe(value);
          return true;
        }),
        { arbitrary: fcRuns(100) }
      );
    }
  });
});
