import { fcRuns } from "@beep/fc-runs";
import { Float16Arr, Float16ArrayFromArray } from "@beep/schema/Float16Array";
import { Float32Arr, Float32ArrayFromArray } from "@beep/schema/Float32Array";
import { Float64Arr, Float64ArrayFromArray } from "@beep/schema/Float64Array";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeFloat16Arr = S.decodeUnknownEffect(Float16Arr);
const decodeFloat16ArrayFromArray = S.decodeUnknownEffect(Float16ArrayFromArray);
const decodeFloat32Arr = S.decodeUnknownEffect(Float32Arr);
const decodeFloat32ArrayFromArray = S.decodeUnknownEffect(Float32ArrayFromArray);
const decodeFloat64Arr = S.decodeUnknownEffect(Float64Arr);
const decodeFloat64ArrayFromArray = S.decodeUnknownEffect(Float64ArrayFromArray);
const decodeUnknownFloat16ArrayFromArray = S.decodeUnknownEffect(Float16ArrayFromArray);
const decodeUnknownFloat32ArrayFromArray = S.decodeUnknownEffect(Float32ArrayFromArray);
const decodeUnknownFloat64ArrayFromArray = S.decodeUnknownEffect(Float64ArrayFromArray);
const encodeFloat16ArrayFromArray = S.encodeEffect(Float16ArrayFromArray);
const encodeFloat32ArrayFromArray = S.encodeEffect(Float32ArrayFromArray);
const encodeFloat64ArrayFromArray = S.encodeEffect(Float64ArrayFromArray);

describe("Float16Array schemas", () => {
  it.effect(
    "accepts native Float16Array instances",
    Effect.fnUntraced(function* () {
      const value = new Float16Array([1, 2, 3]);

      expect(yield* decodeFloat16Arr(value)).toBe(value);
    })
  );

  it.effect(
    "round-trips numeric arrays through Float16Array instances",
    Effect.fnUntraced(function* () {
      const value = yield* decodeFloat16ArrayFromArray([1, 2, 3]);
      const encoded = yield* encodeFloat16ArrayFromArray(value);

      expect(value).toBeInstanceOf(Float16Array);
      expect(A.fromIterable(value)).toEqual([1, 2, 3]);
      expect(encoded).toEqual([1, 2, 3]);
    })
  );

  it.effect.prop(
    "derives Float16Array instances from the source schema arbitrary",
    [Arbitrary.schema(Float16ArrayFromArray)],
    Effect.fnUntraced(function* ([value]) {
      expect(value).toBeInstanceOf(Float16Array);
      const decoded = yield* decodeUnknownFloat16ArrayFromArray(yield* encodeFloat16ArrayFromArray(value));
      expect(decoded).toBeInstanceOf(Float16Array);
      expect(A.fromIterable(decoded)).toEqual(A.fromIterable(value));

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );
});

describe("Float32Array schemas", () => {
  it.effect(
    "accepts native Float32Array instances",
    Effect.fnUntraced(function* () {
      const value = new Float32Array([1, 2, 3]);

      expect(yield* decodeFloat32Arr(value)).toBe(value);
    })
  );

  it.effect(
    "round-trips numeric arrays through Float32Array instances",
    Effect.fnUntraced(function* () {
      const value = yield* decodeFloat32ArrayFromArray([1, 2, 3]);
      const encoded = yield* encodeFloat32ArrayFromArray(value);

      expect(value).toBeInstanceOf(Float32Array);
      expect(A.fromIterable(value)).toEqual([1, 2, 3]);
      expect(encoded).toEqual([1, 2, 3]);
    })
  );

  it.effect.prop(
    "derives Float32Array instances from the source schema arbitrary",
    [Arbitrary.schema(Float32ArrayFromArray)],
    Effect.fnUntraced(function* ([value]) {
      expect(value).toBeInstanceOf(Float32Array);
      const decoded = yield* decodeUnknownFloat32ArrayFromArray(yield* encodeFloat32ArrayFromArray(value));
      expect(decoded).toBeInstanceOf(Float32Array);
      expect(A.fromIterable(decoded)).toEqual(A.fromIterable(value));

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );
});

describe("Float64Array schemas", () => {
  it.effect(
    "accepts native Float64Array instances",
    Effect.fnUntraced(function* () {
      const value = new Float64Array([1, 2, 3]);

      expect(yield* decodeFloat64Arr(value)).toBe(value);
    })
  );

  it.effect(
    "round-trips numeric arrays through Float64Array instances",
    Effect.fnUntraced(function* () {
      const value = yield* decodeFloat64ArrayFromArray([1, 2, 3]);
      const encoded = yield* encodeFloat64ArrayFromArray(value);

      expect(value).toBeInstanceOf(Float64Array);
      expect(A.fromIterable(value)).toEqual([1, 2, 3]);
      expect(encoded).toEqual([1, 2, 3]);
    })
  );

  it.effect.prop(
    "derives Float64Array instances from the source schema arbitrary",
    [Arbitrary.schema(Float64ArrayFromArray)],
    Effect.fnUntraced(function* ([value]) {
      expect(value).toBeInstanceOf(Float64Array);
      const decoded = yield* decodeUnknownFloat64ArrayFromArray(yield* encodeFloat64ArrayFromArray(value));
      expect(decoded).toBeInstanceOf(Float64Array);
      expect(A.fromIterable(decoded)).toEqual(A.fromIterable(value));

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );
});
