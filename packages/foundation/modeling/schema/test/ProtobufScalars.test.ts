import { fcRuns } from "@beep/fc-runs";
import { Bytes } from "@beep/schema/Bytes";
import { Double } from "@beep/schema/Double";
import { Fixed32 } from "@beep/schema/Fixed32";
import { Fixed64 } from "@beep/schema/Fixed64";
import { Float } from "@beep/schema/Float";
import { Sfixed32 } from "@beep/schema/Sfixed32";
import { Sfixed64 } from "@beep/schema/Sfixed64";
import { Sint32 } from "@beep/schema/Sint32";
import { Sint64 } from "@beep/schema/Sint64";
import { Uint32 } from "@beep/schema/Uint32";
import { Uint64 } from "@beep/schema/Uint64";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownBytes = S.decodeUnknownEffect(Bytes);
const decodeUnknownDouble = S.decodeUnknownEffect(Double);
const decodeUnknownFixed32 = S.decodeUnknownEffect(Fixed32);
const decodeUnknownFixed64 = S.decodeUnknownEffect(Fixed64);
const decodeUnknownFloat = S.decodeUnknownEffect(Float);
const decodeUnknownSfixed32 = S.decodeUnknownEffect(Sfixed32);
const decodeUnknownSfixed64 = S.decodeUnknownEffect(Sfixed64);
const decodeUnknownSint32 = S.decodeUnknownEffect(Sint32);
const decodeUnknownSint64 = S.decodeUnknownEffect(Sint64);
const decodeUnknownUint32 = S.decodeUnknownEffect(Uint32);
const decodeUnknownUint64 = S.decodeUnknownEffect(Uint64);
const isBytes2 = S.is(Bytes);
const isDouble2 = S.is(Double);
const isFixed322 = S.is(Fixed32);
const isFixed642 = S.is(Fixed64);
const isFloat2 = S.is(Float);
const isSfixed322 = S.is(Sfixed32);
const isSfixed642 = S.is(Sfixed64);
const isSint322 = S.is(Sint32);
const isSint642 = S.is(Sint64);
const isUint322 = S.is(Uint32);
const isUint642 = S.is(Uint64);

const uint32Minimum = 0;
const uint32Maximum = 4_294_967_295;
const sint32Minimum = -2_147_483_648;
const sint32Maximum = 2_147_483_647;
const floatMinimum = -3.4028234663852886e38;
const floatMaximum = 3.4028234663852886e38;
const uint64Minimum = BigInt(0);
const uint64Maximum = BigInt("18446744073709551615");
const sint64Minimum = -BigInt("9223372036854775808");
const sint64Maximum = BigInt("9223372036854775807");

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
  describe("protobuf 32-bit integer scalar schemas", () => {
    it.effect(
      "accepts unsigned 32-bit protobuf number boundaries",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownUint32(uint32Minimum)).toBe(uint32Minimum);
        expect(yield* decodeUnknownUint32(uint32Maximum)).toBe(uint32Maximum);
        expect(yield* decodeUnknownFixed32(uint32Minimum)).toBe(uint32Minimum);
        expect(yield* decodeUnknownFixed32(uint32Maximum)).toBe(uint32Maximum);
      })
    );

    it.effect(
      "accepts signed 32-bit protobuf number boundaries",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownSint32(sint32Minimum)).toBe(sint32Minimum);
        expect(yield* decodeUnknownSint32(sint32Maximum)).toBe(sint32Maximum);
        expect(yield* decodeUnknownSfixed32(sint32Minimum)).toBe(sint32Minimum);
        expect(yield* decodeUnknownSfixed32(sint32Maximum)).toBe(sint32Maximum);
      })
    );

    it.effect(
      "rejects out-of-range, fractional, and non-number 32-bit values",
      Effect.fnUntraced(function* () {
        pipe(yield* Effect.exit(decodeUnknownUint32(-1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint32(uint32Maximum + 1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint32(1.5)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint32("1")), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed32(-1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed32(uint32Maximum + 1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint32(sint32Minimum - 1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint32(sint32Maximum + 1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint32(1.5)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSfixed32(sint32Minimum - 1)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSfixed32(sint32Maximum + 1)), Exit.isFailure, assertTrue);
      })
    );

    it.effect.prop(
      "derives valid unsigned 32-bit arbitraries from the schemas — Arbitrary.schema(Uint32)",
      [Arbitrary.schema(Uint32)],
      Effect.fnUntraced(function* ([value]) {
        expect(isUint322(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(uint32Minimum);
        expect(value).toBeLessThanOrEqual(uint32Maximum);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
    it.effect.prop(
      "derives valid unsigned 32-bit arbitraries from the schemas — Arbitrary.schema(Fixed32)",
      [Arbitrary.schema(Fixed32)],
      Effect.fnUntraced(function* ([value]) {
        expect(isFixed322(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(uint32Minimum);
        expect(value).toBeLessThanOrEqual(uint32Maximum);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );

    it.effect.prop(
      "derives valid signed 32-bit arbitraries from the schemas — Arbitrary.schema(Sint32)",
      [Arbitrary.schema(Sint32)],
      Effect.fnUntraced(function* ([value]) {
        expect(isSint322(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(sint32Minimum);
        expect(value).toBeLessThanOrEqual(sint32Maximum);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
    it.effect.prop(
      "derives valid signed 32-bit arbitraries from the schemas — Arbitrary.schema(Sfixed32)",
      [Arbitrary.schema(Sfixed32)],
      Effect.fnUntraced(function* ([value]) {
        expect(isSfixed322(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(sint32Minimum);
        expect(value).toBeLessThanOrEqual(sint32Maximum);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
  });

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
        expect(yield* decodeUnknownUint64(uint64Minimum)).toBe(uint64Minimum);
        expect(yield* decodeUnknownUint64(uint64Maximum)).toBe(uint64Maximum);
        expect(yield* decodeUnknownFixed64(uint64Minimum)).toBe(uint64Minimum);
        expect(yield* decodeUnknownFixed64(uint64Maximum)).toBe(uint64Maximum);
      })
    );

    it.effect(
      "accepts protobufjs-compatible unsigned 64-bit input shapes",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownUint64("42")).toBe(BigInt(42));
        expect(yield* decodeUnknownUint64("18446744073709551615")).toBe(uint64Maximum);
        expect(yield* decodeUnknownUint64(42)).toBe(BigInt(42));
        expect(yield* decodeUnknownUint64(makeLongLike("18446744073709551615", true))).toBe(uint64Maximum);
        expect(yield* decodeUnknownFixed64("42")).toBe(BigInt(42));
        expect(yield* decodeUnknownFixed64("18446744073709551615")).toBe(uint64Maximum);
        expect(yield* decodeUnknownFixed64(42)).toBe(BigInt(42));
        expect(yield* decodeUnknownFixed64(makeLongLike("18446744073709551615", true))).toBe(uint64Maximum);
      })
    );

    it.effect(
      "accepts signed 64-bit protobuf bigint boundaries",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownSint64(sint64Minimum)).toBe(sint64Minimum);
        expect(yield* decodeUnknownSint64(sint64Maximum)).toBe(sint64Maximum);
        expect(yield* decodeUnknownSfixed64(sint64Minimum)).toBe(sint64Minimum);
        expect(yield* decodeUnknownSfixed64(sint64Maximum)).toBe(sint64Maximum);
      })
    );

    it.effect(
      "accepts protobufjs-compatible signed 64-bit input shapes",
      Effect.fnUntraced(function* () {
        expect(yield* decodeUnknownSint64("-42")).toBe(-BigInt(42));
        expect(yield* decodeUnknownSint64("-9223372036854775808")).toBe(sint64Minimum);
        expect(yield* decodeUnknownSint64(-42)).toBe(-BigInt(42));
        expect(yield* decodeUnknownSint64(makeLongLike("-9223372036854775808"))).toBe(sint64Minimum);
        expect(yield* decodeUnknownSfixed64("-42")).toBe(-BigInt(42));
        expect(yield* decodeUnknownSfixed64("-9223372036854775808")).toBe(sint64Minimum);
        expect(yield* decodeUnknownSfixed64(-42)).toBe(-BigInt(42));
        expect(yield* decodeUnknownSfixed64(makeLongLike("-9223372036854775808"))).toBe(sint64Minimum);
      })
    );

    it.effect(
      "rejects out-of-range and invalid 64-bit values",
      Effect.fnUntraced(function* () {
        const unsafePositive64Number = Number.MAX_SAFE_INTEGER + 1;
        const unsafeNegative64Number = Number.MIN_SAFE_INTEGER - 1;

        pipe(yield* Effect.exit(decodeUnknownUint64(-BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64(uint64Maximum + BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64(1.5)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64(unsafePositive64Number)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64("1.5")), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(-BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(uint64Maximum + BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownFixed64(unsafePositive64Number)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint64(sint64Minimum - BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint64(sint64Maximum + BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint64(unsafeNegative64Number)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSint64("1.5")), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSfixed64(sint64Minimum - BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSfixed64(sint64Maximum + BigInt(1))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownSfixed64(unsafeNegative64Number)), Exit.isFailure, assertTrue);
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

        pipe(yield* Effect.exit(decodeUnknownUint64(oversizedDecimal)), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64(makeLongLike(oversizedDecimal, true))), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownUint64(nonStringLongLike)), Exit.isFailure, assertTrue);
        expect(coerceDecimal).not.toHaveBeenCalled();
        expect(bigIntSpy).not.toHaveBeenCalled();
      })
    );

    it.effect.prop(
      "derives valid unsigned 64-bit arbitraries from the schemas — Arbitrary.schema(Uint64)",
      [Arbitrary.schema(Uint64)],
      Effect.fnUntraced(function* ([value]) {
        expect(isUint642(value)).toBe(true);
        expect(value >= uint64Minimum).toBe(true);
        expect(value <= uint64Maximum).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(100) }
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

    it.effect.prop(
      "derives valid signed 64-bit arbitraries from the schemas — Arbitrary.schema(Sint64)",
      [Arbitrary.schema(Sint64)],
      Effect.fnUntraced(function* ([value]) {
        expect(isSint642(value)).toBe(true);
        expect(value >= sint64Minimum).toBe(true);
        expect(value <= sint64Maximum).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
    it.effect.prop(
      "derives valid signed 64-bit arbitraries from the schemas — Arbitrary.schema(Sfixed64)",
      [Arbitrary.schema(Sfixed64)],
      Effect.fnUntraced(function* ([value]) {
        expect(isSfixed642(value)).toBe(true);
        expect(value >= sint64Minimum).toBe(true);
        expect(value <= sint64Maximum).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(100) }
    );
  });

  describe("protobuf bytes scalar schema", () => {
    it.effect(
      "accepts Uint8Array bytes values",
      Effect.fnUntraced(function* () {
        const input = new Uint8Array([1, 2, 3]);
        const decoded = yield* decodeUnknownBytes(input);

        expect(decoded).toBe(input);
        expect(decoded.byteLength).toBe(3);
      })
    );

    it.effect(
      "rejects non-Uint8Array bytes values",
      Effect.fnUntraced(function* () {
        pipe(yield* Effect.exit(decodeUnknownBytes([1, 2, 3])), Exit.isFailure, assertTrue);
        pipe(yield* Effect.exit(decodeUnknownBytes("AQID")), Exit.isFailure, assertTrue);
      })
    );

    it.effect.prop(
      "derives Uint8Array arbitrary values from the schema",
      [Arbitrary.schema(Bytes)],
      Effect.fnUntraced(function* ([value]) {
        expect(isBytes2(value)).toBe(true);
        expect(value).toBeInstanceOf(Uint8Array);

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
