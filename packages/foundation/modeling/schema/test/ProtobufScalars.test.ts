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
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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

describe("protobuf 32-bit integer scalar schemas", () => {
  it.effect("accepts unsigned 32-bit protobuf number boundaries", () =>
    Effect.gen(function* () {
      const decodeUint32 = S.decodeUnknownEffect(Uint32);
      const decodeFixed32 = S.decodeUnknownEffect(Fixed32);

      expect(yield* decodeUint32(uint32Minimum)).toBe(uint32Minimum);
      expect(yield* decodeUint32(uint32Maximum)).toBe(uint32Maximum);
      expect(yield* decodeFixed32(uint32Minimum)).toBe(uint32Minimum);
      expect(yield* decodeFixed32(uint32Maximum)).toBe(uint32Maximum);
    })
  );

  it.effect("accepts signed 32-bit protobuf number boundaries", () =>
    Effect.gen(function* () {
      const decodeSint32 = S.decodeUnknownEffect(Sint32);
      const decodeSfixed32 = S.decodeUnknownEffect(Sfixed32);

      expect(yield* decodeSint32(sint32Minimum)).toBe(sint32Minimum);
      expect(yield* decodeSint32(sint32Maximum)).toBe(sint32Maximum);
      expect(yield* decodeSfixed32(sint32Minimum)).toBe(sint32Minimum);
      expect(yield* decodeSfixed32(sint32Maximum)).toBe(sint32Maximum);
    })
  );

  it.effect("rejects out-of-range, fractional, and non-number 32-bit values", () =>
    Effect.gen(function* () {
      const decodeUint32 = S.decodeUnknownEffect(Uint32);
      const decodeSint32 = S.decodeUnknownEffect(Sint32);
      const decodeFixed32 = S.decodeUnknownEffect(Fixed32);
      const decodeSfixed32 = S.decodeUnknownEffect(Sfixed32);

      expect(Exit.isFailure(yield* Effect.exit(decodeUint32(-1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUint32(uint32Maximum + 1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUint32(1.5)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUint32("1")))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFixed32(-1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFixed32(uint32Maximum + 1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint32(sint32Minimum - 1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint32(sint32Maximum + 1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint32(1.5)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSfixed32(sint32Minimum - 1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSfixed32(sint32Maximum + 1)))).toBe(true);
    })
  );

  it("derives valid unsigned 32-bit arbitraries from the schemas", () => {
    const isUint32 = S.is(Uint32);
    const isFixed32 = S.is(Fixed32);

    fc.assert(
      fc.property(S.toArbitrary(Uint32), (value) => {
        expect(isUint32(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(uint32Minimum);
        expect(value).toBeLessThanOrEqual(uint32Maximum);
      }),
      fcRuns(100)
    );

    fc.assert(
      fc.property(S.toArbitrary(Fixed32), (value) => {
        expect(isFixed32(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(uint32Minimum);
        expect(value).toBeLessThanOrEqual(uint32Maximum);
      }),
      fcRuns(100)
    );
  });

  it("derives valid signed 32-bit arbitraries from the schemas", () => {
    const isSint32 = S.is(Sint32);
    const isSfixed32 = S.is(Sfixed32);

    fc.assert(
      fc.property(S.toArbitrary(Sint32), (value) => {
        expect(isSint32(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(sint32Minimum);
        expect(value).toBeLessThanOrEqual(sint32Maximum);
      }),
      fcRuns(100)
    );

    fc.assert(
      fc.property(S.toArbitrary(Sfixed32), (value) => {
        expect(isSfixed32(value)).toBe(true);
        expect(globalThis.Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(sint32Minimum);
        expect(value).toBeLessThanOrEqual(sint32Maximum);
      }),
      fcRuns(100)
    );
  });
});

describe("protobuf floating-point scalar schemas", () => {
  it.effect("accepts finite protobuf float and double boundaries", () =>
    Effect.gen(function* () {
      const decodeFloat = S.decodeUnknownEffect(Float);
      const decodeDouble = S.decodeUnknownEffect(Double);

      expect(yield* decodeFloat(floatMinimum)).toBe(floatMinimum);
      expect(yield* decodeFloat(0.5)).toBe(0.5);
      expect(yield* decodeFloat(floatMaximum)).toBe(floatMaximum);
      expect(yield* decodeDouble(-globalThis.Number.MAX_VALUE)).toBe(-globalThis.Number.MAX_VALUE);
      expect(yield* decodeDouble(globalThis.Number.MAX_VALUE)).toBe(globalThis.Number.MAX_VALUE);
    })
  );

  it.effect("rejects non-finite and overflowing floating-point values", () =>
    Effect.gen(function* () {
      const decodeFloat = S.decodeUnknownEffect(Float);
      const decodeDouble = S.decodeUnknownEffect(Double);

      expect(Exit.isFailure(yield* Effect.exit(decodeFloat(globalThis.Number.NaN)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFloat(globalThis.Number.POSITIVE_INFINITY)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFloat(floatMaximum * 2)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeDouble(globalThis.Number.NaN)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeDouble(globalThis.Number.NEGATIVE_INFINITY)))).toBe(true);
    })
  );

  it("derives finite protobuf float and double arbitraries from the schemas", () => {
    const isFloat = S.is(Float);
    const isDouble = S.is(Double);

    fc.assert(
      fc.property(S.toArbitrary(Float), (value) => {
        expect(isFloat(value)).toBe(true);
        expect(globalThis.Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(floatMinimum);
        expect(value).toBeLessThanOrEqual(floatMaximum);
      }),
      fcRuns(100)
    );

    fc.assert(
      fc.property(S.toArbitrary(Double), (value) => {
        expect(isDouble(value)).toBe(true);
        expect(globalThis.Number.isFinite(value)).toBe(true);
      }),
      fcRuns(100)
    );
  });
});

describe("protobuf 64-bit integer scalar schemas", () => {
  it.effect("accepts unsigned 64-bit protobuf bigint boundaries", () =>
    Effect.gen(function* () {
      const decodeUint64 = S.decodeUnknownEffect(Uint64);
      const decodeFixed64 = S.decodeUnknownEffect(Fixed64);

      expect(yield* decodeUint64(uint64Minimum)).toBe(uint64Minimum);
      expect(yield* decodeUint64(uint64Maximum)).toBe(uint64Maximum);
      expect(yield* decodeFixed64(uint64Minimum)).toBe(uint64Minimum);
      expect(yield* decodeFixed64(uint64Maximum)).toBe(uint64Maximum);
    })
  );

  it.effect("accepts signed 64-bit protobuf bigint boundaries", () =>
    Effect.gen(function* () {
      const decodeSint64 = S.decodeUnknownEffect(Sint64);
      const decodeSfixed64 = S.decodeUnknownEffect(Sfixed64);

      expect(yield* decodeSint64(sint64Minimum)).toBe(sint64Minimum);
      expect(yield* decodeSint64(sint64Maximum)).toBe(sint64Maximum);
      expect(yield* decodeSfixed64(sint64Minimum)).toBe(sint64Minimum);
      expect(yield* decodeSfixed64(sint64Maximum)).toBe(sint64Maximum);
    })
  );

  it.effect("rejects out-of-range and non-bigint 64-bit values", () =>
    Effect.gen(function* () {
      const decodeUint64 = S.decodeUnknownEffect(Uint64);
      const decodeSint64 = S.decodeUnknownEffect(Sint64);
      const decodeFixed64 = S.decodeUnknownEffect(Fixed64);
      const decodeSfixed64 = S.decodeUnknownEffect(Sfixed64);

      expect(Exit.isFailure(yield* Effect.exit(decodeUint64(-BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUint64(uint64Maximum + BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUint64(1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFixed64(-BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeFixed64(uint64Maximum + BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint64(sint64Minimum - BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint64(sint64Maximum + BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSint64("1")))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSfixed64(sint64Minimum - BigInt(1))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSfixed64(sint64Maximum + BigInt(1))))).toBe(true);
    })
  );

  it("derives valid unsigned 64-bit arbitraries from the schemas", () => {
    const isUint64 = S.is(Uint64);
    const isFixed64 = S.is(Fixed64);

    fc.assert(
      fc.property(S.toArbitrary(Uint64), (value) => {
        expect(isUint64(value)).toBe(true);
        expect(value >= uint64Minimum).toBe(true);
        expect(value <= uint64Maximum).toBe(true);
      }),
      fcRuns(100)
    );

    fc.assert(
      fc.property(S.toArbitrary(Fixed64), (value) => {
        expect(isFixed64(value)).toBe(true);
        expect(value >= uint64Minimum).toBe(true);
        expect(value <= uint64Maximum).toBe(true);
      }),
      fcRuns(100)
    );
  });

  it("derives valid signed 64-bit arbitraries from the schemas", () => {
    const isSint64 = S.is(Sint64);
    const isSfixed64 = S.is(Sfixed64);

    fc.assert(
      fc.property(S.toArbitrary(Sint64), (value) => {
        expect(isSint64(value)).toBe(true);
        expect(value >= sint64Minimum).toBe(true);
        expect(value <= sint64Maximum).toBe(true);
      }),
      fcRuns(100)
    );

    fc.assert(
      fc.property(S.toArbitrary(Sfixed64), (value) => {
        expect(isSfixed64(value)).toBe(true);
        expect(value >= sint64Minimum).toBe(true);
        expect(value <= sint64Maximum).toBe(true);
      }),
      fcRuns(100)
    );
  });
});

describe("protobuf bytes scalar schema", () => {
  it.effect("accepts Uint8Array bytes values", () =>
    Effect.gen(function* () {
      const decodeBytes = S.decodeUnknownEffect(Bytes);
      const input = new Uint8Array([1, 2, 3]);
      const decoded = yield* decodeBytes(input);

      expect(decoded).toBe(input);
      expect(decoded.byteLength).toBe(3);
    })
  );

  it.effect("rejects non-Uint8Array bytes values", () =>
    Effect.gen(function* () {
      const decodeBytes = S.decodeUnknownEffect(Bytes);

      expect(Exit.isFailure(yield* Effect.exit(decodeBytes([1, 2, 3])))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeBytes("AQID")))).toBe(true);
    })
  );

  it("derives Uint8Array arbitrary values from the schema", () => {
    const isBytes = S.is(Bytes);

    fc.assert(
      fc.property(S.toArbitrary(Bytes), (value) => {
        expect(isBytes(value)).toBe(true);
        expect(value).toBeInstanceOf(Uint8Array);
      }),
      fcRuns(100)
    );
  });
});
