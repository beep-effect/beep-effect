import { fcRuns } from "@beep/fc-runs";
import { Double } from "@beep/schema/Double";
import { Fixed64 } from "@beep/schema/Fixed64";
import { Float } from "@beep/schema/Float";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
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
        const decodedUnknownFloat = yield* decodeUnknownFloat(floatMinimum);
        expect(decodedUnknownFloat).toBe(floatMinimum);
        const decodedUnknownFloat1 = yield* decodeUnknownFloat(0.5);
        expect(decodedUnknownFloat1).toBe(0.5);
        const decodedUnknownFloat2 = yield* decodeUnknownFloat(floatMaximum);
        expect(decodedUnknownFloat2).toBe(floatMaximum);
        const decodedUnknownFloat3 = yield* decodeUnknownFloat(globalThis.Number.NaN);
        expect(globalThis.Number.isNaN(decodedUnknownFloat3)).toBe(true);
        const decodedUnknownFloat4 = yield* decodeUnknownFloat(globalThis.Number.POSITIVE_INFINITY);
        expect(decodedUnknownFloat4).toBe(globalThis.Number.POSITIVE_INFINITY);
        const decodedUnknownFloat5 = yield* decodeUnknownFloat(globalThis.Number.NEGATIVE_INFINITY);
        expect(decodedUnknownFloat5).toBe(globalThis.Number.NEGATIVE_INFINITY);
        const decodedUnknownDouble = yield* decodeUnknownDouble(-globalThis.Number.MAX_VALUE);
        expect(decodedUnknownDouble).toBe(-globalThis.Number.MAX_VALUE);
        const decodedUnknownDouble6 = yield* decodeUnknownDouble(globalThis.Number.MAX_VALUE);
        expect(decodedUnknownDouble6).toBe(globalThis.Number.MAX_VALUE);
        const decodedUnknownDouble7 = yield* decodeUnknownDouble(globalThis.Number.NaN);
        expect(globalThis.Number.isNaN(decodedUnknownDouble7)).toBe(true);
        const decodedUnknownDouble8 = yield* decodeUnknownDouble(globalThis.Number.POSITIVE_INFINITY);
        expect(decodedUnknownDouble8).toBe(globalThis.Number.POSITIVE_INFINITY);
        const decodedUnknownDouble9 = yield* decodeUnknownDouble(globalThis.Number.NEGATIVE_INFINITY);
        expect(decodedUnknownDouble9).toBe(globalThis.Number.NEGATIVE_INFINITY);
      })
    );

    it.effect(
      "rejects overflowing finite float values and non-number floating-point inputs",
      Effect.fnUntraced(function* () {
        const exit10 = yield* Effect.exit(decodeUnknownFloat(floatMaximum * 2));
        pipe(exit10, Exit.isFailure, assertTrue);
        const exit11 = yield* Effect.exit(decodeUnknownFloat("NaN"));
        pipe(exit11, Exit.isFailure, assertTrue);
        const exit12 = yield* Effect.exit(decodeUnknownDouble("1.5"));
        pipe(exit12, Exit.isFailure, assertTrue);
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
        const decodedUnknownFixed64 = yield* decodeUnknownFixed64(uint64Minimum);
        expect(decodedUnknownFixed64).toBe(uint64Minimum);
        const decodedUnknownFixed6413 = yield* decodeUnknownFixed64(uint64Maximum);
        expect(decodedUnknownFixed6413).toBe(uint64Maximum);
      })
    );

    it.effect(
      "accepts protobufjs-compatible unsigned 64-bit input shapes",
      Effect.fnUntraced(function* () {
        const decodedUnknownFixed6414 = yield* decodeUnknownFixed64("42");
        expect(decodedUnknownFixed6414).toBe(BigInt(42));
        const decodedUnknownFixed6415 = yield* decodeUnknownFixed64("18446744073709551615");
        expect(decodedUnknownFixed6415).toBe(uint64Maximum);
        const decodedUnknownFixed6416 = yield* decodeUnknownFixed64(42);
        expect(decodedUnknownFixed6416).toBe(BigInt(42));
        const decodedUnknownFixed6417 = yield* decodeUnknownFixed64(makeLongLike("18446744073709551615", true));
        expect(decodedUnknownFixed6417).toBe(uint64Maximum);
      })
    );

    it.effect(
      "rejects out-of-range and invalid 64-bit values",
      Effect.fnUntraced(function* () {
        const unsafePositive64Number = Number.MAX_SAFE_INTEGER + 1;

        const exit18 = yield* Effect.exit(decodeUnknownFixed64(-BigInt(1)));
        pipe(exit18, Exit.isFailure, assertTrue);
        const exit19 = yield* Effect.exit(decodeUnknownFixed64(uint64Maximum + BigInt(1)));
        pipe(exit19, Exit.isFailure, assertTrue);
        const exit20 = yield* Effect.exit(decodeUnknownFixed64(1.5));
        pipe(exit20, Exit.isFailure, assertTrue);
        const exit21 = yield* Effect.exit(decodeUnknownFixed64(unsafePositive64Number));
        pipe(exit21, Exit.isFailure, assertTrue);
        const exit22 = yield* Effect.exit(decodeUnknownFixed64("1.5"));
        pipe(exit22, Exit.isFailure, assertTrue);
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

        const exit23 = yield* Effect.exit(decodeUnknownFixed64(oversizedDecimal));
        pipe(exit23, Exit.isFailure, assertTrue);
        const exit24 = yield* Effect.exit(decodeUnknownFixed64(makeLongLike(oversizedDecimal, true)));
        pipe(exit24, Exit.isFailure, assertTrue);
        const exit25 = yield* Effect.exit(decodeUnknownFixed64(nonStringLongLike));
        pipe(exit25, Exit.isFailure, assertTrue);
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
              const value26 = yield* S.decodeUnknownEffect(codec)(encoded);
              expect(value26).toBe(value);
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
          const value27 = yield* S.decodeUnknownEffect(codec)(encoded);
          expect(value27).toBe(value);
          return true;
        }),
        { arbitrary: fcRuns(100) }
      );
    }
  });
});
